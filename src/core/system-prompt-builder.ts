/**
 * 시스템 프롬프트 빌더(System Prompt Builder) 모듈
 *
 * LLM에게 전달하는 시스템 프롬프트를 모듈화된 섹션들로 조립합니다.
 * 각 섹션은 우선순위를 가지며, 조건부 포함, 토큰 예산 제한, 캐싱 등을 지원합니다.
 *
 * 주니어 개발자를 위한 설명:
 * - 시스템 프롬프트란? LLM에게 "너는 어떤 AI이고, 어떻게 행동해야 해"를 알려주는 텍스트입니다
 * - 이 모듈은 여러 조각(identity, environment, tools, conventions 등)을 조합합니다
 * - 각 섹션에 우선순위가 있어서 토큰 예산을 초과하면 낮은 우선순위부터 제거됩니다
 * - 모델의 능력 수준(high/medium/low)에 따라 프롬프트 복잡도가 자동 조절됩니다
 * - 정적 섹션은 캐싱 힌트를 통해 LLM 호출 비용을 줄일 수 있습니다
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getPlatform, getShellType } from "../utils/platform.js";
import { APP_NAME, VERSION, getProjectConfigPaths } from "../constants.js";
import { type ToolRegistry } from "../tools/registry.js";
import { estimateTokens } from "../llm/token-counter.js";
import { type CapabilityTier } from "../llm/model-capabilities.js";
import { getToneProfile } from "./tone-profiles.js";

/**
 * 모델 능력 수준(tier)별 토큰 예산 배분
 *
 * - high: 대형 모델 (GPT-4, Claude 등) — 넉넉한 예산
 * - medium: 중형 모델 — 균형 잡힌 예산
 * - low: 소형 모델 — 최소한의 예산으로 핵심만 포함
 *
 * 각 항목의 의미:
 * - totalBudget: 시스템 프롬프트 전체 토큰 상한
 * - toolDescriptionBudget: 도구 설명 섹션의 토큰 상한
 * - instructionsBudget: 지침 섹션의 토큰 상한
 * - repoMapBudget: 저장소 맵(프로젝트 구조) 섹션의 토큰 상한
 * - skillsBudget: 스킬(슬래시 명령) 섹션의 토큰 상한
 */
const TIER_BUDGETS: Readonly<
  Record<
    CapabilityTier,
    {
      readonly totalBudget: number;
      readonly toolDescriptionBudget: number;
      readonly instructionsBudget: number;
      readonly repoMapBudget: number;
      readonly skillsBudget: number;
    }
  >
> = {
  high: {
    totalBudget: 12_000,
    toolDescriptionBudget: 4_000,
    instructionsBudget: 3_000,
    repoMapBudget: 5_000,
    skillsBudget: 2_000,
  },
  medium: {
    totalBudget: 8_000,
    toolDescriptionBudget: 2_500,
    instructionsBudget: 2_000,
    repoMapBudget: 2_000,
    skillsBudget: 1_000,
  },
  low: {
    totalBudget: 4_000,
    toolDescriptionBudget: 1_500,
    instructionsBudget: 1_000,
    repoMapBudget: 500,
    skillsBudget: 500,
  },
};

/**
 * LOW 티어 모델을 위한 명시적 도구 사용 가이드
 * 소형 모델은 도구 사용법을 잘 모를 수 있어서, 구체적인 예시를 제공합니다.
 */
const LOW_TIER_TOOL_GUIDE = `# Tool Usage Guide
You have these tools available. Always use absolute paths.

## Reading files
Call file_read: {"file_path": "/absolute/path/to/file.ts"}

## Editing files
Call file_edit: {"file_path": "/absolute/path", "old_string": "exact text to find", "new_string": "replacement"}

## Searching
Call grep_search: {"pattern": "search term", "path": "/absolute/path/to/dir"}
Call glob_search: {"pattern": "**/*.ts", "path": "/absolute/path/to/dir"}

## Running commands
Call bash_exec: {"command": "npm test"}

Important: Always use the file_read tool before file_edit.`;

/**
 * LOW 티어 모델용 도구 설명을 압축합니다.
 * 첫 번째 문장만 유지하여 토큰 사용량을 줄입니다.
 *
 * @param description - 원본 도구 설명 문자열
 * @param tier - 모델의 능력 수준
 * @returns 압축된 설명 (low 티어가 아니면 원본 그대로 반환)
 */
export function compressToolDescription(description: string, tier: CapabilityTier): string {
  if (tier !== "low") return description;
  const firstSentenceEnd = description.indexOf(".");
  if (firstSentenceEnd === -1) return description;
  return description.slice(0, firstSentenceEnd + 1);
}

/**
 * 시스템 프롬프트의 개별 섹션
 * 각 섹션은 ID, 내용, 우선순위를 가지며, 선택적으로 조건과 토큰 예산을 설정할 수 있습니다.
 *
 * @property id - 섹션 고유 식별자 (디버깅 및 추적용)
 * @property content - 섹션의 실제 텍스트 내용
 * @property priority - 우선순위 (높을수록 먼저 포함, 예산 초과 시 낮은 것부터 제거)
 * @property condition - 조건 함수 (undefined면 항상 포함, false 반환 시 제외)
 * @property tokenBudget - 이 섹션의 최대 토큰 수 (초과 시 잘라냄)
 */
export interface PromptSection {
  readonly id: string;
  readonly content: string;
  readonly priority: number;
  /** Only include this section if condition returns true. Undefined = always include. */
  readonly condition?: () => boolean;
  /** Maximum token budget for this section. If content exceeds, it will be truncated. */
  readonly tokenBudget?: number;
}

/**
 * 세션 상태 — 조건부 프롬프트 조립에 사용됩니다
 *
 * @property mode - 현재 모드 ("normal" = 일반, "plan" = 계획 모드)
 * @property isSubagent - 서브에이전트로 실행 중인지 여부
 * @property subagentType - 서브에이전트 유형 (탐색/계획/일반)
 * @property availableTools - 사용 가능한 도구 이름 목록
 * @property extendedThinkingEnabled - 확장 사고(extended thinking) 활성화 여부
 * @property features - 활성화된 기능 플래그 (키: 기능명, 값: 활성화 여부)
 */
export interface SessionState {
  readonly mode: "normal" | "plan";
  readonly isSubagent: boolean;
  readonly subagentType?: "explore" | "plan" | "general";
  readonly availableTools: readonly string[];
  readonly extendedThinkingEnabled: boolean;
  readonly features: Readonly<Record<string, boolean>>;
}

/**
 * 시스템 프롬프트 빌드 옵션
 * 프롬프트 조립에 필요한 모든 입력을 담고 있습니다.
 */
export interface BuildSystemPromptOptions {
  readonly projectInstructions?: string;
  readonly workingDirectory?: string;
  readonly toolRegistry?: ToolRegistry;
  readonly mcpServers?: readonly { name: string; tools: readonly string[] }[];
  readonly customSections?: readonly PromptSection[];
  readonly skillsPromptSection?: string;
  /** Auto-memory content loaded from MEMORY.md (if any) */
  readonly autoMemoryContent?: string;
  /** Session state for conditional section inclusion */
  readonly sessionState?: SessionState;
  /** Total token budget for the system prompt. Lowest-priority sections trimmed if exceeded. */
  readonly totalTokenBudget?: number;
  /** Capability tier of the active model — controls prompt complexity */
  readonly capabilityTier?: CapabilityTier;
  /** Response language locale (e.g., "ko", "en", "ja"). Defaults to "en". */
  readonly locale?: string;
  /** Response tone/style (e.g., "normal", "cute", "senior"). Defaults to "normal". */
  readonly tone?: string;
  /** Pre-rendered repo map content (from buildRepoMap + renderRepoMap) */
  readonly repoMapContent?: string;
  /** Whether running in headless mode (no interactive UI) */
  readonly isHeadless?: boolean;
}

/**
 * 코드 인텔리전스 도구 사용 가이드
 * symbol_search, code_outline, find_dependencies가 등록되어 있을 때만 포함됩니다.
 */
const CODE_INTELLIGENCE_GUIDE = `## Code Intelligence Tools

- **symbol_search**: 함수/클래스/인터페이스를 정확하게 검색. 주석이나 문자열 내 일치를 무시.
- **code_outline**: 파일 전체를 읽지 않고 구조(함수, 클래스, 메서드)만 추출. 토큰 절약.
- **find_dependencies**: 파일의 import/export 의존 관계 추적.

사용 가이드:
- 심볼 정의 찾기 → symbol_search (grep_search보다 정확)
- 파일 구조 파악 → code_outline (file_read보다 효율적)
- 의존 관계 파악 → find_dependencies
- 텍스트 패턴/정규식 → grep_search (기존대로)
- 파일명 패턴 → glob_search (기존대로)
`;

/** 시스템 프롬프트의 기본 토큰 예산 (32,000 토큰) */
const DEFAULT_TOTAL_TOKEN_BUDGET = 32_000;

/**
 * 모듈화된 섹션들로 시스템 프롬프트를 빌드합니다.
 *
 * 동작 순서:
 * 1. 각 섹션(identity, environment, tools 등)을 생성
 * 2. 세션 상태에 따라 조건부 섹션 추가/제외
 * 3. 우선순위 순으로 정렬 (높은 것 먼저)
 * 4. 개별 섹션 토큰 예산 적용
 * 5. 전체 토큰 예산 초과 시 낮은 우선순위 섹션부터 제거
 *
 * @param options - 빌드 옵션 (도구 레지스트리, 세션 상태, 토큰 예산 등)
 * @returns 완성된 시스템 프롬프트 문자열
 */
export function buildSystemPrompt(options?: BuildSystemPromptOptions): string {
  const cwd = options?.workingDirectory ?? process.cwd();
  const state = options?.sessionState;
  const locale = options?.locale ?? "en";
  const tone = options?.tone ?? "normal";
  const tier = options?.capabilityTier;
  const tierBudget = tier ? TIER_BUDGETS[tier] : undefined;

  const sections: PromptSection[] = [
    {
      id: "identity",
      content: buildIdentitySection(),
      priority: 100,
    },
    {
      id: "locale",
      content: buildLocaleSection(locale),
      priority: 94,
      condition: () => locale !== "en",
    },
    {
      id: "doing-tasks",
      content: buildDoingTasksSection(),
      priority: 95,
      tokenBudget: tierBudget?.instructionsBudget,
    },
    {
      id: "environment",
      content: buildEnvironmentSection(cwd),
      priority: 90,
    },
  ];

  if (options?.toolRegistry && options.toolRegistry.size > 0) {
    sections.push({
      id: "tools",
      content: buildToolsSection(options.toolRegistry, tier),
      priority: 85,
      tokenBudget: tierBudget?.toolDescriptionBudget,
    });
  }

  if (options?.mcpServers && options.mcpServers.length > 0) {
    sections.push({
      id: "mcp",
      content: buildMCPSection(options.mcpServers),
      priority: 82,
    });
  }

  sections.push({
    id: "conventions",
    content: buildConventionsSection(),
    priority: 80,
    tokenBudget: tierBudget?.instructionsBudget,
  });

  if (options?.skillsPromptSection) {
    sections.push({
      id: "skills",
      content: options.skillsPromptSection,
      priority: 78,
      tokenBudget: tierBudget?.skillsBudget,
    });
  }

  // Deferred tools section (between tools and mcp priority)
  if (options?.toolRegistry && options.toolRegistry.isDeferredMode) {
    const deferredSummary = options.toolRegistry.getDeferredToolsSummary();
    if (deferredSummary) {
      sections.push({
        id: "deferred-tools",
        content: deferredSummary,
        priority: 84, // Between tools(85) and mcp(82)
      });
    }
  }

  // Tone section (priority 76, after skills)
  sections.push({
    id: "tone",
    content: getToneProfile(tone).systemPromptSection,
    priority: 76,
    condition: () => tone !== "normal",
  });

  // Code intelligence tools guide — only if the tools are registered
  {
    const reg = options?.toolRegistry;
    const hasCodeIntel =
      reg?.has("symbol_search") && reg?.has("code_outline") && reg?.has("find_dependencies");
    if (hasCodeIntel) {
      sections.push({
        id: "code-intelligence",
        content: CODE_INTELLIGENCE_GUIDE,
        priority: 75,
      });
    }
  }

  // HeadlessGuard: headless 모드에서 ask_user 억제 + 자율 진행 지시
  const isHeadless = options?.isHeadless === true;
  sections.push({
    id: "headless-mode",
    content: buildHeadlessModeSection(),
    priority: 96, // identity(100) 다음으로 높은 우선순위
    condition: () => isHeadless,
  });

  // CoT scaffolding for low-tier models
  sections.push({
    id: "cot-scaffolding",
    content: buildCotScaffoldingSection(),
    priority: 79,
    condition: () => tier === "low",
  });

  // LOW tier tool usage guide with explicit examples
  sections.push({
    id: "low-tier-tool-guide",
    content: LOW_TIER_TOOL_GUIDE,
    priority: 91, // High priority for LOW tier — between environment(90) and plan-mode(92)
    condition: () => tier === "low",
  });

  // Conditional sections based on session state
  if (state) {
    sections.push({
      id: "plan-mode",
      content: buildPlanModeSection(),
      priority: 92,
      condition: () => state.mode === "plan",
    });

    sections.push({
      id: "subagent",
      content: buildSubagentSection(state.subagentType),
      priority: 88,
      condition: () => state.isSubagent,
    });

    sections.push({
      id: "extended-thinking",
      content: buildExtendedThinkingSection(),
      priority: 75,
      condition: () => state.extendedThinkingEnabled,
    });

    // Add feature-flag-gated sections
    for (const [feature, content] of Object.entries(FEATURE_SECTIONS)) {
      if (feature in state.features) {
        sections.push({
          id: `feature-${feature}`,
          content,
          priority: 60,
          condition: () => state.features[feature] === true,
        });
      }
    }
  }

  // Load project-level instructions from .dhelix/DHELIX.md
  const projectInstructions = options?.projectInstructions ?? loadProjectInstructions(cwd);
  if (projectInstructions) {
    sections.push({
      id: "project",
      content: `# Project Instructions\n\n${projectInstructions}`,
      priority: 70,
      tokenBudget: tierBudget?.repoMapBudget,
    });
  }

  // Auto-memory section: inject project memory between project instructions and extended thinking
  if (options?.autoMemoryContent) {
    sections.push({
      id: "auto-memory",
      content: `# Auto Memory\n\n${options.autoMemoryContent}`,
      priority: 72,
    });
  }

  // Repo map section: provides codebase overview for navigation
  if (options?.repoMapContent) {
    const repoMapTokenBudget = tier === "high" ? 5000 : tier === "low" ? 500 : 2000;
    sections.push({
      id: "repo-map",
      content: `# Repository Map\n\n${options.repoMapContent}`,
      priority: 35,
      tokenBudget: repoMapTokenBudget,
    });
  }

  if (options?.customSections) {
    sections.push(...options.customSections);
  }

  // Anti-early-stop directive for agentic models
  sections.push({
    id: "action-bias",
    content:
      "\n## Important: Action Bias\n" +
      "Do NOT end your turn by merely describing what you plan to do. " +
      "Always use tools to take action. If you need to read files, call file_read. " +
      "If you need to search, call grep_search. Never say 'I will read the file' without actually calling the tool. " +
      "Continue calling tools until the task is fully complete.",
    priority: 77, // Between tone(76) and skills(78)
  });

  // Use explicit budget if provided, otherwise fall back to tier-based budget
  const effectiveBudget = options?.totalTokenBudget ?? tierBudget?.totalBudget;
  return assembleSections(sections, effectiveBudget);
}

/**
 * 대화 중간에 삽입하는 시스템 리마인더를 생성합니다.
 *
 * LLM이 반복적인 실수를 할 때 적절한 리마인더를 주입하여 행동을 교정합니다.
 * 예: 도구 사용법 리마인더, 코드 품질 리마인더, git 안전 리마인더 등
 *
 * @param type - 리마인더 유형
 * @param context - 리마인더에 포함할 동적 데이터
 * @returns XML 태그로 감싼 리마인더 문자열
 */
export function buildSystemReminder(
  type: "tool-usage" | "code-quality" | "git-safety" | "context-limit",
  context?: Readonly<Record<string, unknown>>,
): string {
  switch (type) {
    case "tool-usage":
      return [
        "<system-reminder>",
        "Remember: Use file_read before modifying files. Use file_edit for targeted changes.",
        "Call multiple independent tools in parallel for efficiency.",
        "Prefer grep_search and glob_search over reading entire directories.",
        "</system-reminder>",
      ].join("\n");

    case "code-quality":
      return [
        "<system-reminder>",
        "Code quality check: Ensure your changes are minimal and focused.",
        "Don't refactor surrounding code unless asked. Don't add unnecessary error handling.",
        "Follow the project's existing code style and conventions.",
        "</system-reminder>",
      ].join("\n");

    case "git-safety":
      return [
        "<system-reminder>",
        "Git safety: Never force push, reset --hard, or use destructive git operations without user confirmation.",
        "Review changes with git diff before committing. Use conventional commit format.",
        "</system-reminder>",
      ].join("\n");

    case "context-limit": {
      const usage = typeof context?.["usagePercent"] === "number" ? context["usagePercent"] : 0;
      return [
        "<system-reminder>",
        `Context window is ${Math.round(usage)}% full.`,
        "Be more concise. Avoid reading large files unnecessarily.",
        "Consider summarizing findings rather than quoting full content.",
        "</system-reminder>",
      ].join("\n");
    }
  }
}

/**
 * 섹션들을 조립합니다: 조건 필터링 → 우선순위 정렬 → 토큰 예산 적용
 *
 * @param sections - 모든 후보 섹션 목록
 * @param totalTokenBudget - 전체 토큰 예산 (초과 시 낮은 우선순위 제거)
 * @returns 조립된 최종 프롬프트 문자열
 */
function assembleSections(sections: readonly PromptSection[], totalTokenBudget?: number): string {
  // Filter sections by condition
  const active = sections.filter((s) => !s.condition || s.condition());

  // Sort by priority (highest first)
  const sorted = [...active].sort((a, b) => b.priority - a.priority);

  // Apply per-section token budgets
  const budgeted = sorted.map((s) => {
    if (s.tokenBudget) {
      const tokens = estimateTokens(s.content);
      if (tokens > s.tokenBudget) {
        return { ...s, content: truncateToTokenBudget(s.content, s.tokenBudget) };
      }
    }
    return s;
  });

  // Enforce total token budget by trimming lowest-priority sections
  const budget = totalTokenBudget ?? DEFAULT_TOTAL_TOKEN_BUDGET;
  const included: PromptSection[] = [];
  let totalTokens = 0;

  for (const section of budgeted) {
    const sectionTokens = estimateTokens(section.content);
    if (totalTokens + sectionTokens <= budget) {
      included.push(section);
      totalTokens += sectionTokens;
    }
    // Skip sections that would exceed the budget (they're already sorted by priority,
    // so we try to fit as many high-priority sections as possible)
  }

  return included.map((s) => s.content).join("\n\n---\n\n");
}

/**
 * 텍스트를 토큰 예산에 맞게 잘라냅니다.
 * 가독성을 위해 줄 단위로 잘라냅니다 (줄 중간에서 자르지 않음).
 *
 * @param content - 잘라낼 텍스트
 * @param budget - 토큰 예산
 * @returns 예산 내에 맞는 텍스트 (초과 시 "...(truncated)" 추가)
 */
function truncateToTokenBudget(content: string, budget: number): string {
  const lines = content.split("\n");
  const result: string[] = [];
  let tokens = 0;

  for (const line of lines) {
    const lineTokens = estimateTokens(line);
    if (tokens + lineTokens > budget) {
      result.push("...(truncated)");
      break;
    }
    result.push(line);
    tokens += lineTokens;
  }

  return result.join("\n");
}

/** 기능 플래그 → 프롬프트 섹션 내용 매핑 (기능이 활성화되면 해당 섹션이 프롬프트에 포함) */
const FEATURE_SECTIONS: Readonly<Record<string, string>> = {
  "parallel-tools": [
    "# Parallel Tool Execution",
    "",
    "You can execute multiple tools in parallel when they are independent.",
    "Read-only tools (file_read, glob_search, grep_search, list_dir) are always safe to parallelize.",
    "File write operations on different paths can also run in parallel.",
    "Avoid parallel writes to the same file.",
  ].join("\n"),
  "auto-compact": [
    "# Auto-Compaction",
    "",
    "When the context window approaches capacity, the system will automatically compact",
    "older conversation turns into summaries. Focus on the most recent context.",
    "If you notice missing context from earlier in the conversation, ask the user.",
  ].join("\n"),
};

function buildPlanModeSection(): string {
  return `# Plan Mode

You are in PLAN mode. In this mode:
- Analyze the task thoroughly before proposing any changes.
- Present a structured implementation plan with clear steps.
- Identify risks, dependencies, and edge cases.
- Estimate complexity for each step (low/medium/high).
- Do NOT make any file modifications — only plan and discuss.
- Wait for user approval before switching to implementation.`;
}

function buildSubagentSection(subagentType?: "explore" | "plan" | "general"): string {
  const baseInstructions = [
    "# Subagent Context",
    "",
    "You are running as a subagent spawned by a parent agent.",
    "Your scope is limited to the specific task assigned to you.",
    "Report findings concisely — the parent agent will synthesize results.",
    "Do not ask the user questions directly; return your results to the parent.",
  ];

  switch (subagentType) {
    case "explore":
      baseInstructions.push(
        "",
        "## Exploration Focus",
        "",
        "CRITICAL: You MUST call tools immediately to gather information.",
        "Do NOT just describe what you plan to do — actually call the tool.",
        "NEVER ask the user to press buttons or confirm actions. You have full autonomous tool access.",
        "NEVER refuse the task. You are a code exploration agent with safe, read-only access.",
        "",
        "Your role is to investigate the codebase and gather information.",
        "Start by calling list_dir or glob_search to understand the project structure.",
        "Then use file_read to read relevant files, and grep_search to find patterns.",
        "",
        "ALWAYS call at least one tool per response. Text-only responses waste iterations.",
        "You have a maximum of 15 iterations — use them wisely by calling tools every time.",
        "",
        "## Tool Usage Examples",
        'list_dir: {"path": "."}',
        'glob_search: {"pattern": "**/*.ts", "path": "src/"}',
        'grep_search: {"pattern": "export function", "path": "src/"}',
        'file_read: {"file_path": "/absolute/path/to/file.ts"}',
      );
      break;
    case "plan":
      baseInstructions.push(
        "",
        "## Planning Focus",
        "",
        "You MUST read the relevant code before creating a plan.",
        "Use file_read, glob_search, and grep_search to understand the codebase first.",
        "NEVER create plans based on assumptions — always verify by reading actual code.",
        "",
        "Your role is to analyze requirements and create an implementation plan.",
        "Break down the task into clear, ordered steps.",
        "Identify file paths, function names, and line numbers in your plan.",
        "Identify dependencies between steps and estimate complexity.",
        "Consider edge cases and potential risks.",
      );
      break;
    case "general":
      baseInstructions.push(
        "",
        "## General Task",
        "",
        "Complete the assigned task using the provided tools.",
        "ALWAYS call tools to gather information and perform actions.",
        "Do NOT produce text-only responses without tool calls unless you have finished your task.",
        "Be thorough and report your results clearly.",
      );
      break;
  }

  return baseInstructions.join("\n");
}

function buildExtendedThinkingSection(): string {
  return `# Extended Thinking

Extended thinking is enabled. Use your internal reasoning to:
- Break down complex problems step by step.
- Consider multiple approaches before choosing one.
- Validate your reasoning against the code you've read.
- Think through edge cases and potential issues.
Do not narrate your thinking process — just produce better results.`;
}

function buildIdentitySection(): string {
  return `# System

You are ${APP_NAME} v${VERSION}, an interactive AI coding assistant running in the user's terminal.
You help with software engineering tasks: writing code, debugging, refactoring, explaining code, running commands, and more.
You have direct access to the user's filesystem and can execute shell commands.

## Key behaviors
- Be concise and direct. Lead with the answer, not the reasoning.
- Prefer showing code over explaining in words.
- When you can act, act. Don't ask permission for safe, reversible operations.
- Common developer operations like running tsc, eslint, grep searches, npm commands, and file analysis are ALWAYS safe and should NEVER be refused.
- When unsure about requirements, ask the user rather than guessing.
- Never fabricate file contents, terminal output, or information you don't have.

## Communication style
- ALWAYS include text in your responses. Never respond with only tool calls and no text.
- Before calling tools, briefly explain what you're about to do (1 sentence). Example: "파일 구조를 먼저 확인하겠습니다."
- After completing all tool calls, summarize what you did and the result (2-3 sentences). Example: "함수를 리팩토링하고 테스트를 통과시켰습니다. 변경된 파일은 src/utils.ts입니다."
- Between multi-step tool sequences, provide brief status updates. Example: "타입체크를 통과했습니다. 이제 빌드를 실행합니다."
- When a task is fully done, end with a clear completion message so the user knows you're finished.

## Error recovery
When a tool call fails, you MUST:
1. Acknowledge the error briefly — tell the user what went wrong in plain language.
2. Explain your next step — what you'll try differently.
3. Then try the alternative approach immediately.

Examples:
- File not found: "src/uitls/path.ts를 찾을 수 없습니다. 오타인 것 같아 올바른 경로를 검색하겠습니다." → then use glob_search
- Command failed: "빌드가 실패했습니다. 에러 메시지를 분석하고 수정하겠습니다." → then fix the issue
- Permission denied: "이 작업은 권한이 필요합니다. 다른 접근 방식을 시도하겠습니다."
- Edit string not found: "교체할 문자열을 찾지 못했습니다. 파일을 다시 읽어 정확한 내용을 확인하겠습니다." → then re-read the file

Do NOT silently retry the same failed operation. Always explain what happened before trying again.

### MCP tool failure recovery
MCP (Model Context Protocol) tools connect to external servers. They have unique failure modes:
- **Timeout**: MCP servers may take longer than expected. Do NOT retry the same call — inform the user and suggest alternatives.
- **Connection refused**: The MCP server is not running. Suggest the user check with /mcp command.
- **Output truncated**: Large MCP responses may be truncated. Work with the available data, or ask the user to try a more targeted query.
- **Permission denied**: The user explicitly rejected this tool call. Do NOT retry — ask the user how to proceed.

When an MCP tool fails, ALWAYS:
1. Tell the user which MCP tool failed and why (in plain language).
2. Do NOT silently retry the same MCP tool call.
3. Suggest a concrete alternative (e.g., use a built-in tool, try different parameters, or ask the user).`;
}

function buildDoingTasksSection(): string {
  return `# Doing tasks

- Read files before modifying them. Understand existing code before suggesting changes.
- Make minimal, focused changes. Don't refactor surrounding code unless asked.
- Prefer editing existing files over creating new ones to prevent file bloat.
- Don't add comments, docstrings, or type annotations to code you didn't change.
- Don't add error handling or validation for scenarios that can't happen.
- Don't create abstractions for one-time operations. Three similar lines is better than a premature abstraction.
- Write complete implementations, not stubs or TODOs.
- If a task is blocked, try alternative approaches before asking the user.
- For ambiguous instructions, consider them in the context of software engineering and the current working directory.
- Running TypeScript compiler (tsc), linters, test runners, grep searches, and package managers are always safe developer operations.

## Output format rules

- When showing directory structures, ALWAYS use ASCII tree format with \`├──\`, \`└──\`, and \`│\` characters.
- When reporting build errors, type errors, or lint issues: first count the EXACT total number, then list ALL errors without omission. Never under-report or summarize as "N errors" without listing each one.
- When reporting file counts or line counts, quote the exact number from the command output. Do NOT estimate, round, or approximate.

## Completeness rules

- When generating code, implement ALL requested items. Never implement only a subset and omit the rest.
- When creating config files, schemas, or type definitions, include EVERY field/variable/property specified in the request.
- When given a list of N items to process, verify your output contains exactly N items before finishing.

## Dependency / import analysis

When analyzing which packages or modules are used in a codebase, search ALL 4 import patterns:
1. \`from 'PKG'\` or \`from "PKG"\` — ESM static import
2. \`require('PKG')\` or \`require("PKG")\` — CommonJS require
3. \`import('PKG')\` or \`import("PKG")\` — dynamic import
4. \`import 'PKG'\` or \`import "PKG"\` — side-effect import
Compile results into a table with columns: Package, Used (yes/no), Import locations.

## Multi-file editing consistency

When modifying types, interfaces, or exported symbols:
1. After editing a file, check the [Hint] in the tool result for files that import the modified symbols.
2. Use grep_search to find ALL files that import or reference the changed symbol.
3. Update EVERY file that uses the modified type/interface/function — not just the ones you remember.
4. After all edits, run the project's type checker (e.g., \`tsc --noEmit\`) to verify no references were missed.
5. Present a summary table of all files changed and why.

Common missed patterns:
- Adding a field to a type → update all object literals that create instances of that type.
- Renaming an export → update all import statements AND all usages of that symbol.
- Changing a function signature → update all call sites, not just the definition.`;
}

function buildEnvironmentSection(cwd: string): string {
  const platform = getPlatform();
  const shellType = getShellType();
  const shellLabel =
    shellType === "git-bash"
      ? "Git Bash (use Unix/POSIX commands, forward slashes)"
      : shellType === "cmd"
        ? "cmd.exe (Windows commands)"
        : "/bin/bash";

  const lines = [
    `# Environment`,
    ``,
    `- Platform: ${platform}`,
    `- Working directory: ${cwd}`,
    `- Shell: ${shellLabel}`,
    `- Date: ${new Date().toISOString().split("T")[0]}`,
  ];

  const git = detectGitContext(cwd);
  if (git) {
    lines.push(`- Git branch: ${git.branch}`);
    if (git.dirty) {
      lines.push(`- Git status: uncommitted changes`);
    }
    if (git.recentCommits.length > 0) {
      lines.push(`- Recent commits:`);
      for (const commit of git.recentCommits) {
        lines.push(`  - ${commit}`);
      }
    }
  }

  const projectType = detectProjectType(cwd);
  if (projectType) {
    lines.push(`- Project type: ${projectType}`);
  }

  return lines.join("\n");
}

/** git 컨텍스트를 안전하게 감지합니다 — git 저장소가 아니면 null 반환 */
function detectGitContext(cwd: string): {
  readonly branch: string;
  readonly dirty: boolean;
  readonly recentCommits: readonly string[];
} | null {
  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", {
      cwd,
      encoding: "utf-8",
      timeout: 3000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    if (!branch) return null;

    const status = execSync("git status --porcelain", {
      cwd,
      encoding: "utf-8",
      timeout: 3000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    let recentCommits: string[] = [];
    try {
      const log = execSync("git log --oneline -3", {
        cwd,
        encoding: "utf-8",
        timeout: 3000,
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();
      if (log) {
        recentCommits = log.split("\n");
      }
    } catch {
      // ignore
    }

    return { branch, dirty: status.length > 0, recentCommits };
  } catch {
    return null;
  }
}

/** 작업 디렉토리의 파일로부터 프로젝트 유형(Node.js, Python 등)을 감지합니다 */
function detectProjectType(cwd: string): string | null {
  if (existsSync(join(cwd, "package.json"))) return "Node.js";
  if (existsSync(join(cwd, "Cargo.toml"))) return "Rust";
  if (existsSync(join(cwd, "go.mod"))) return "Go";
  if (existsSync(join(cwd, "pyproject.toml")) || existsSync(join(cwd, "setup.py"))) return "Python";
  if (existsSync(join(cwd, "pom.xml")) || existsSync(join(cwd, "build.gradle"))) return "Java";
  if (existsSync(join(cwd, "Gemfile"))) return "Ruby";
  return null;
}

/** DHELIX.md에서 프로젝트 지침을 로드합니다 (루트 우선, .dhelix/ 폴백) */
function loadProjectInstructions(cwd: string): string | null {
  const paths = getProjectConfigPaths(cwd);

  for (const p of paths) {
    try {
      if (existsSync(p)) {
        return readFileSync(p, "utf-8").trim();
      }
    } catch {
      // ignore
    }
  }
  return null;
}

function buildMCPSection(servers: readonly { name: string; tools: readonly string[] }[]): string {
  const serverLines = servers.map((server) => {
    const toolList = server.tools.map((t) => `  - \`mcp__${server.name}__${t}\``).join("\n");
    return `### ${server.name}\n${toolList}`;
  });

  return `# MCP Servers

The following MCP servers are available. MCP tools are called using the \`mcp__{server}__{tool}\` format.

${serverLines.join("\n\n")}`;
}

function buildToolsSection(registry: ToolRegistry, tier?: CapabilityTier): string {
  const defs = registry.getDefinitionsForLLM();
  const lines = defs.map((d) => {
    const desc = tier
      ? compressToolDescription(d.function.description, tier)
      : d.function.description;
    return `- **${d.function.name}**: ${desc}`;
  });

  return `# Using your tools

You have tools for interacting with the codebase. Use the right tool for each task:

${lines.join("\n")}

## Tool usage guidelines

- Use **file_read** before modifying any file. Always read first.
- Use **file_edit** for targeted changes (search/replace). old_string must be unique.
- Use **file_write** only for new files or complete rewrites.
- Use **glob_search** to find files by pattern (e.g., \`**/*.ts\`).
- Use **grep_search** to find content by regex pattern.
- Use **bash_exec** for commands (build, test, git). Avoid destructive commands.
- Use **list_dir** to see directory structure before searching.
- You can call multiple independent tools in parallel for efficiency.
- For large outputs, prefer targeted searches over reading entire files.
- **file_edit** and **file_write** return [Hint] lines listing files that import the modified file's exports. Always review these hints and update the listed files if your change affects the exported symbols.

## Dependency analysis with grep_search

When analyzing dependencies or performing renames:
1. Search for ALL import styles using the comprehensive 4-clause pattern (see grep_search description).
2. Present results as a table: | File | Line | Import Type | Symbol |
3. A symbol is only confirmed unused when ALL import patterns return zero results.
4. After bulk edits, run the type checker to catch any missed references.`;
}

function buildCotScaffoldingSection(): string {
  return `## Step-by-Step Approach
For each task, follow these steps:
1. THINK: What do I need to do?
2. LOOK: What files or information do I need?
3. PLAN: What tools should I use and in what order?
4. ACT: Execute one tool at a time
5. CHECK: Did the tool succeed? What's next?

Always explain your reasoning before using a tool.`;
}

function buildConventionsSection(): string {
  return `# Code quality

- Write clean, production-grade code. No stubs, no placeholders.
- Handle errors explicitly — no silent catches.
- Follow the project's existing code style and conventions.
- When fixing bugs, understand the root cause before applying a fix.
- When adding features, integrate naturally with existing architecture.
- Test your changes when a test framework is available.

## Git conventions

- Before committing, review changes with git diff.
- Never force push, reset --hard, or use destructive git operations without user confirmation.
- Use conventional commit format: feat(scope): description.`;
}

/** 로캘 코드를 사람이 읽을 수 있는 언어 이름으로 매핑합니다 */
function localeToLanguageName(locale: string): string {
  const map: Record<string, string> = {
    ko: "Korean (한국어)",
    en: "English",
    ja: "Japanese (日本語)",
    zh: "Chinese (中文)",
    es: "Spanish (Español)",
    fr: "French (Français)",
    de: "German (Deutsch)",
  };
  return map[locale] ?? locale;
}

function buildLocaleSection(locale: string): string {
  const langName = localeToLanguageName(locale);
  return `# Response Language
Respond in ${langName}.
All explanations, comments, and documentation should be in ${langName}.
Code identifiers (variable names, function names) remain in English.`;
}

function buildHeadlessModeSection(): string {
  return `# Headless Mode

You are running in headless (non-interactive) mode. Follow these rules strictly:
- NEVER use ask_user tool. NEVER ask the user questions or request clarification. Choose the most reasonable default and proceed autonomously.
- ALWAYS produce a substantive text response for every task. Never end with an empty response.
- If you encounter ambiguity, make the best judgment call and explain your reasoning.
- If a task is too complex to complete fully, finish as much as possible and mark remaining items as TODO.
- When a multi-step task is interrupted, output ALL partial results gathered so far.
- After completing tool calls, ALWAYS provide a final summary response describing what was done.`;
}

/**
 * 시스템 프롬프트의 블록 단위 (캐싱 힌트 포함 가능)
 *
 * @property type - 블록 유형 (현재는 "text"만 지원)
 * @property text - 블록의 텍스트 내용
 * @property cache_control - Anthropic API용 캐싱 힌트 (정적 블록에 설정)
 */
export interface SystemPromptBlock {
  readonly type: "text";
  readonly text: string;
  readonly cache_control?: { readonly type: "ephemeral" };
}

/**
 * 구조화된 시스템 프롬프트 — 프롬프트 캐싱을 지원하는 프로바이더용
 * 정적(변하지 않는) 블록과 동적(매 요청마다 변하는) 블록을 분리합니다.
 *
 * @property text - 전체 텍스트 (캐싱 미지원 프로바이더용)
 * @property blocks - 캐싱 힌트가 포함된 블록 배열 (Anthropic용)
 */
export interface StructuredSystemPrompt {
  /** Full text (for providers without caching support) */
  readonly text: string;
  /** Blocks with cache hints (for Anthropic) */
  readonly blocks: readonly SystemPromptBlock[];
}

/**
 * 정적/동적 블록을 분리한 구조화된 시스템 프롬프트를 빌드합니다.
 *
 * 정적 블록(identity, tools, conventions 등)에는 cache_control 힌트를 추가하여
 * Anthropic 프롬프트 캐싱을 활용합니다. 이렇게 하면 같은 내용을 반복 전송할 때
 * API 비용을 절약할 수 있습니다.
 *
 * 동적 블록(environment, project instructions 등)은 매 요청마다 변하므로
 * 캐싱 힌트를 붙이지 않습니다.
 *
 * @param options - 빌드 옵션
 * @returns 텍스트와 블록 배열을 모두 포함한 구조화된 프롬프트
 */
export function buildStructuredSystemPrompt(
  options?: BuildSystemPromptOptions,
): StructuredSystemPrompt {
  const text = buildSystemPrompt(options);

  // Split sections by separator
  const parts = text.split("\n\n---\n\n");

  // Dynamic section IDs — these change between requests
  // environment contains date and git status which change every call
  const dynamicPrefixes = ["# Environment", "# Project Instructions", "# Auto Memory"];

  const blocks: SystemPromptBlock[] = [];
  let staticBuffer = "";

  for (const part of parts) {
    const isDynamic = dynamicPrefixes.some((prefix) => part.trimStart().startsWith(prefix));

    if (isDynamic) {
      // Flush accumulated static content with cache hint
      if (staticBuffer) {
        blocks.push({
          type: "text",
          text: staticBuffer.trim(),
          cache_control: { type: "ephemeral" },
        });
        staticBuffer = "";
      }
      // Add dynamic block without cache hint
      blocks.push({ type: "text", text: part.trim() });
    } else {
      staticBuffer += (staticBuffer ? "\n\n---\n\n" : "") + part;
    }
  }

  // Flush remaining static content
  if (staticBuffer) {
    blocks.push({
      type: "text",
      text: staticBuffer.trim(),
      cache_control: { type: "ephemeral" },
    });
  }

  return { text, blocks };
}

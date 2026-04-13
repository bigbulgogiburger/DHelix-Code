/**
 * AgentManifest — 에이전트의 능력, 제약, 설정을 선언적으로 정의하는 매니페스트 시스템
 *
 * AgentManifest는 서브에이전트가 "무엇을 할 수 있는지", "어떤 모델로 실행되는지",
 * "어디서(격리 수준) 실행되는지"를 코드 레벨에서 정적으로 선언합니다.
 *
 * 이 모듈이 제공하는 것:
 * 1. 핵심 인터페이스 타입 (AgentManifest, AgentPurpose, AgentModelConfig, VerificationProfile)
 * 2. 8개의 내장 에이전트 매니페스트 상수
 * 3. validateManifest — 매니페스트 유효성 검사
 * 4. getBuiltinManifest / listBuiltinManifests — 내장 매니페스트 조회
 *
 * 설계 원칙:
 * - 모든 필드는 readonly (불변 상태)
 * - any 타입 사용 금지 — unknown + type guard 사용
 * - Named export only (default export 없음)
 */

// ─────────────────────────────────────────────────────────────────────────────
// Core interfaces
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 에이전트의 역할과 카테고리를 나타냅니다.
 * shortDescription은 최대 50자로 제한되며, category는 에이전트의 주 기능을 분류합니다.
 */
export interface AgentPurpose {
  /** 짧은 설명 (UI 표시 등에 사용). 최대 50자. */
  readonly shortDescription: string;
  /** 에이전트의 역할과 사용 시점을 상세히 설명하는 텍스트 */
  readonly detailedDescription: string;
  /** 에이전트 기능 분류 */
  readonly category: "research" | "implementation" | "review" | "testing" | "planning" | "general";
}

/**
 * 에이전트가 사용할 LLM 모델 설정입니다.
 * preferredModel만 필수이며, 나머지는 선택적입니다.
 */
export interface AgentModelConfig {
  /** 우선 사용할 모델 식별자 (예: "claude-sonnet-4-5", "claude-haiku-4-5") */
  readonly preferredModel: string;
  /** preferredModel 요청 실패 시 사용할 대체 모델 */
  readonly fallbackModel?: string;
  /** 샘플링 온도 (0.0 ~ 2.0). 낮을수록 결정론적 출력 */
  readonly temperature?: number;
  /** 추론 노력 수준 — 지원 모델에서 thinking budget 조정에 사용 */
  readonly reasoningEffort?: "low" | "medium" | "high";
  /** 최대 출력 토큰 수 */
  readonly maxOutputTokens?: number;
}

/**
 * 에이전트가 작업 완료 후 실행할 검증 프로파일입니다.
 * 테스트, 타입 검사, 린팅 등을 자동화합니다.
 */
export interface VerificationProfile {
  /** 단위/통합 테스트 실행 여부 */
  readonly runTests: boolean;
  /** TypeScript 타입 검사(tsc --noEmit) 실행 여부 */
  readonly typeCheck: boolean;
  /** ESLint 등 린터 실행 여부 */
  readonly lint: boolean;
  /** 추가 커스텀 검증 명령 목록 (예: ["npm run build", "npm run e2e"]) */
  readonly customChecks?: readonly string[];
}

/**
 * 에이전트의 전체 능력과 제약을 선언적으로 정의하는 매니페스트입니다.
 *
 * 매니페스트는 에이전트가 생성될 때 spawner에게 전달되어
 * 도구 필터링, 모델 선택, 격리 수준 등 모든 설정의 기준이 됩니다.
 *
 * @example
 * ```typescript
 * const myManifest: AgentManifest = {
 *   id: "my-custom-agent",
 *   purpose: { shortDescription: "Custom agent", detailedDescription: "...", category: "general" },
 *   allowedTools: ["file_read", "glob_search"],
 *   memoryScope: "session",
 *   isolationMode: "shared",
 *   modelConfig: { preferredModel: "claude-haiku-4-5" },
 *   maxSteps: 10,
 *   maxTokenBudget: 50_000,
 *   backgroundCapable: false,
 *   systemPromptTemplate: "You are a custom agent...",
 * };
 * ```
 */
export interface AgentManifest {
  /** 에이전트 고유 식별자 (소문자 케밥 케이스, 예: "explore", "code-reviewer") */
  readonly id: string;
  /** 에이전트의 역할과 카테고리 정보 */
  readonly purpose: AgentPurpose;
  /** 이 에이전트가 사용할 수 있는 도구 이름 목록 */
  readonly allowedTools: readonly string[];
  /** allowedTools에서 제외할 도구 이름 목록 (blocklist) */
  readonly blockedTools?: readonly string[];
  /**
   * 에이전트 메모리의 저장 범위
   * - session: 현재 세션에만 유지 (종료 시 소실)
   * - project: 프로젝트 단위 영속화
   * - global: 사용자 전역 영속화
   * - none: 메모리 비활성화
   */
  readonly memoryScope: "session" | "project" | "global" | "none";
  /**
   * 실행 격리 수준
   * - shared: 메인 프로세스와 같은 컨텍스트
   * - worktree: 별도의 Git 워크트리에서 격리 실행
   * - sandbox: 파일시스템/네트워크 접근 제한 샌드박스
   * - container: 컨테이너(Docker 등) 격리
   */
  readonly isolationMode: "shared" | "worktree" | "sandbox" | "container";
  /** 사용할 LLM 모델 설정 */
  readonly modelConfig: AgentModelConfig;
  /** 에이전트가 실행할 수 있는 최대 도구 호출 횟수 */
  readonly maxSteps: number;
  /** 이 에이전트에 허용된 최대 토큰 예산 (input + output 합계) */
  readonly maxTokenBudget: number;
  /** 백그라운드 비동기 실행 가능 여부 */
  readonly backgroundCapable: boolean;
  /** 작업 완료 후 실행할 검증 프로파일 (선택) */
  readonly verificationProfile?: VerificationProfile;
  /** 에이전트 시스템 프롬프트 템플릿 */
  readonly systemPromptTemplate: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

/** 검증 결과 타입 — 성공 또는 오류 목록 */
export type ValidationResult =
  | { readonly valid: true }
  | { readonly valid: false; readonly errors: readonly string[] };

/**
 * AgentManifest의 유효성을 검사합니다.
 *
 * 검사 항목:
 * - id: 소문자 케밥 케이스, 비어 있지 않음
 * - purpose.shortDescription: 1~50자
 * - purpose.category: 허용된 값 중 하나
 * - allowedTools: 1개 이상
 * - maxSteps: 양의 정수
 * - maxTokenBudget: 양의 정수
 * - modelConfig.preferredModel: 비어 있지 않음
 * - modelConfig.temperature: 0~2 범위 (지정된 경우)
 *
 * @param manifest - 검사할 AgentManifest 객체
 * @returns 유효성 검사 결과
 */
export function validateManifest(manifest: AgentManifest): ValidationResult {
  const errors: string[] = [];

  // id 검증
  if (!manifest.id || manifest.id.trim().length === 0) {
    errors.push("id must not be empty");
  } else if (!/^[a-z][a-z0-9-]*$/.test(manifest.id)) {
    errors.push("id must be lowercase kebab-case (e.g. 'my-agent')");
  }

  // purpose 검증
  const { shortDescription, category } = manifest.purpose;
  if (!shortDescription || shortDescription.trim().length === 0) {
    errors.push("purpose.shortDescription must not be empty");
  } else if (shortDescription.length > 50) {
    errors.push(
      `purpose.shortDescription must be 50 characters or fewer (got ${shortDescription.length})`,
    );
  }

  const validCategories = [
    "research",
    "implementation",
    "review",
    "testing",
    "planning",
    "general",
  ] as const;
  if (!validCategories.includes(category as (typeof validCategories)[number])) {
    errors.push(
      `purpose.category must be one of: ${validCategories.join(", ")} (got '${category}')`,
    );
  }

  // allowedTools 검증
  if (!manifest.allowedTools || manifest.allowedTools.length === 0) {
    errors.push("allowedTools must contain at least one tool");
  }

  // maxSteps 검증
  if (!Number.isInteger(manifest.maxSteps) || manifest.maxSteps <= 0) {
    errors.push("maxSteps must be a positive integer");
  }

  // maxTokenBudget 검증
  if (!Number.isInteger(manifest.maxTokenBudget) || manifest.maxTokenBudget <= 0) {
    errors.push("maxTokenBudget must be a positive integer");
  }

  // modelConfig 검증
  if (
    !manifest.modelConfig.preferredModel ||
    manifest.modelConfig.preferredModel.trim().length === 0
  ) {
    errors.push("modelConfig.preferredModel must not be empty");
  }

  if (manifest.modelConfig.temperature !== undefined) {
    const temp = manifest.modelConfig.temperature;
    if (temp < 0 || temp > 2) {
      errors.push(`modelConfig.temperature must be between 0 and 2 (got ${temp})`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Built-in manifest constants
// ─────────────────────────────────────────────────────────────────────────────

/** 읽기 전용 도구 세트 — 탐색/분석 에이전트가 공유하는 안전한 도구 목록 */
const READ_ONLY_TOOLS: readonly string[] = [
  "file_read",
  "glob_search",
  "grep_search",
  "list_dir",
] as const;

/** 읽기 + bash 도구 세트 — 테스트 실행 등에 사용 */
const READ_AND_BASH_TOOLS: readonly string[] = [...READ_ONLY_TOOLS, "bash_exec"] as const;

/** 전체 도구 세트 — 구현/리팩토링 에이전트가 사용 */
const ALL_TOOLS: readonly string[] = [
  "file_read",
  "file_write",
  "file_edit",
  "bash_exec",
  "glob_search",
  "grep_search",
  "list_dir",
  "web_fetch",
  "web_search",
  "notebook_edit",
  "mkdir",
  "ask_user",
  "agent",
  "todo_write",
] as const;

/**
 * EXPLORE_MANIFEST — 코드베이스 탐색 전용 에이전트 매니페스트
 *
 * 읽기 전용 도구만 허용하며, 사용자 코드를 수정하지 않습니다.
 * 구조 파악, 의존성 추적, 코드 질문 답변 등에 사용합니다.
 */
export const EXPLORE_MANIFEST: AgentManifest = {
  id: "explore",
  purpose: {
    shortDescription: "Read-only codebase exploration",
    detailedDescription:
      "Investigates project structure, traces dependencies, and answers factual questions about the code. Has read-only access and will never modify files.",
    category: "research",
  },
  allowedTools: READ_ONLY_TOOLS,
  memoryScope: "session",
  isolationMode: "shared",
  modelConfig: {
    preferredModel: "claude-haiku-4-5",
    fallbackModel: "claude-sonnet-4-5",
    temperature: 0.2,
    reasoningEffort: "low",
  },
  maxSteps: 20,
  maxTokenBudget: 100_000,
  backgroundCapable: true,
  systemPromptTemplate: [
    "You are an explore agent. Your job is to investigate the codebase and answer questions.",
    "You have READ-ONLY access. Do NOT attempt to modify any files.",
    "Be thorough: check multiple locations and naming conventions before concluding.",
    "Summarize findings clearly with file paths and line references where relevant.",
  ].join("\n"),
};

/**
 * PLAN_MANIFEST — 구현 계획 수립 에이전트 매니페스트
 *
 * 코드베이스를 읽고 단계별 구현 계획, 리스크 분석, 의존성 분석을 제공합니다.
 * 읽기 전용 도구만 허용하며 파일을 수정하지 않습니다.
 */
export const PLAN_MANIFEST: AgentManifest = {
  id: "plan",
  purpose: {
    shortDescription: "Implementation planning agent",
    detailedDescription:
      "Reads the codebase to produce structured implementation plans, risk assessments, dependency maps, and phased breakdowns. Does not modify files.",
    category: "planning",
  },
  allowedTools: READ_ONLY_TOOLS,
  memoryScope: "session",
  isolationMode: "shared",
  modelConfig: {
    preferredModel: "claude-sonnet-4-5",
    temperature: 0.3,
    reasoningEffort: "high",
  },
  maxSteps: 15,
  maxTokenBudget: 150_000,
  backgroundCapable: false,
  systemPromptTemplate: [
    "You are a planning agent. Produce a clear, phased implementation plan.",
    "Identify dependencies, risks, and testing requirements for each phase.",
    "You have READ-ONLY access — do not modify files.",
    "Output a structured plan with: phases, tasks per phase, risk level, and estimated complexity.",
  ].join("\n"),
};

/**
 * IMPLEMENT_MANIFEST — 기능 구현 에이전트 매니페스트
 *
 * 전체 도구 접근 권한을 가지며 코드 작성, 파일 수정, 명령 실행 등 모든 작업을 수행합니다.
 * 구현 후 타입 검사 및 린팅을 자동으로 실행합니다.
 */
export const IMPLEMENT_MANIFEST: AgentManifest = {
  id: "implement",
  purpose: {
    shortDescription: "Full-stack feature implementation",
    detailedDescription:
      "Implements features with full tool access: reads existing code, writes new files, edits existing ones, and runs shell commands. Verifies work with type checking and lint after completion.",
    category: "implementation",
  },
  allowedTools: ALL_TOOLS,
  memoryScope: "project",
  isolationMode: "worktree",
  modelConfig: {
    preferredModel: "claude-sonnet-4-5",
    temperature: 0.1,
    reasoningEffort: "high",
    maxOutputTokens: 16_384,
  },
  maxSteps: 50,
  maxTokenBudget: 500_000,
  backgroundCapable: true,
  verificationProfile: {
    runTests: false,
    typeCheck: true,
    lint: true,
  },
  systemPromptTemplate: [
    "You are an implementation agent. Complete the assigned task thoroughly.",
    "Prefer minimal, targeted changes. Verify your work before finishing.",
    "After completing changes, run type checks and lint to ensure correctness.",
    "Follow the project's coding conventions (named exports, .js extensions for ESM, no 'any').",
  ].join("\n"),
};

/**
 * REVIEW_MANIFEST — 코드 리뷰 에이전트 매니페스트
 *
 * 코드베이스를 읽고 CRITICAL/HIGH/MEDIUM/LOW 심각도로 분류된 리뷰 피드백을 제공합니다.
 * 읽기 전용 도구만 허용합니다.
 */
export const REVIEW_MANIFEST: AgentManifest = {
  id: "review",
  purpose: {
    shortDescription: "Structured code review agent",
    detailedDescription:
      "Analyzes code for correctness, style, performance, and security. Classifies each finding as CRITICAL, HIGH, MEDIUM, or LOW. Read-only access — does not modify files.",
    category: "review",
  },
  allowedTools: READ_ONLY_TOOLS,
  memoryScope: "session",
  isolationMode: "shared",
  modelConfig: {
    preferredModel: "claude-sonnet-4-5",
    temperature: 0.2,
    reasoningEffort: "high",
  },
  maxSteps: 20,
  maxTokenBudget: 200_000,
  backgroundCapable: true,
  systemPromptTemplate: [
    "You are a code-review agent. Analyze the code for correctness, style, performance, and security.",
    "Classify each finding as CRITICAL, HIGH, MEDIUM, or LOW.",
    "You have READ-ONLY access — do not modify files.",
    "Provide actionable remediation guidance for each finding.",
  ].join("\n"),
};

/**
 * TEST_MANIFEST — 테스트 실행 에이전트 매니페스트
 *
 * 테스트를 실행하고 실패 원인을 분석합니다.
 * 읽기 도구와 bash_exec만 허용합니다.
 */
export const TEST_MANIFEST: AgentManifest = {
  id: "test",
  purpose: {
    shortDescription: "Test execution and analysis agent",
    detailedDescription:
      "Runs test suites via bash, reads test output and source, and reports failures with root-cause analysis. Can write new test files but does not modify source code.",
    category: "testing",
  },
  allowedTools: READ_AND_BASH_TOOLS,
  memoryScope: "session",
  isolationMode: "shared",
  modelConfig: {
    preferredModel: "claude-sonnet-4-5",
    temperature: 0.1,
    reasoningEffort: "medium",
  },
  maxSteps: 30,
  maxTokenBudget: 200_000,
  backgroundCapable: true,
  verificationProfile: {
    runTests: true,
    typeCheck: false,
    lint: false,
  },
  systemPromptTemplate: [
    "You are a test-runner agent. Execute tests and analyze the results.",
    "If tests fail, investigate root causes by reading relevant source and test files.",
    "Summarize: total tests, passed, failed, and a brief root-cause for each failure.",
    "Do not modify source files — only test files if absolutely necessary.",
  ].join("\n"),
};

/**
 * BUILD_MANIFEST — 빌드 에이전트 매니페스트
 *
 * 빌드 오류를 진단하고 수정합니다.
 * 전체 도구 접근 권한을 가지며 빌드 성공 후 검증을 수행합니다.
 */
export const BUILD_MANIFEST: AgentManifest = {
  id: "build",
  purpose: {
    shortDescription: "Build error diagnosis and fix",
    detailedDescription:
      "Diagnoses and resolves build failures: TypeScript errors, missing imports, configuration issues. Has full tool access to read, edit, and re-run the build.",
    category: "implementation",
  },
  allowedTools: ALL_TOOLS,
  memoryScope: "session",
  isolationMode: "shared",
  modelConfig: {
    preferredModel: "claude-sonnet-4-5",
    temperature: 0.1,
    reasoningEffort: "high",
  },
  maxSteps: 40,
  maxTokenBudget: 300_000,
  backgroundCapable: false,
  verificationProfile: {
    runTests: false,
    typeCheck: true,
    lint: true,
    customChecks: ["npm run build"],
  },
  systemPromptTemplate: [
    "You are a build-error-resolver agent. Diagnose and fix build failures.",
    "Start by reading the full error output, then trace to the root cause.",
    "Fix incrementally: one error at a time. Re-run the build after each fix.",
    "Do not make unrelated refactoring changes.",
  ].join("\n"),
};

/**
 * SECURITY_MANIFEST — 보안 감사 에이전트 매니페스트
 *
 * 코드베이스에서 취약점, 시크릿 노출, 안전하지 않은 패턴을 탐지합니다.
 * 읽기 전용 도구만 허용합니다.
 */
export const SECURITY_MANIFEST: AgentManifest = {
  id: "security",
  purpose: {
    shortDescription: "Security vulnerability audit agent",
    detailedDescription:
      "Scans codebase for vulnerabilities, secret leaks, injection risks, improper auth, and insecure patterns. Classifies findings by severity with remediation guidance.",
    category: "review",
  },
  allowedTools: READ_ONLY_TOOLS,
  memoryScope: "session",
  isolationMode: "shared",
  modelConfig: {
    preferredModel: "claude-sonnet-4-5",
    temperature: 0.1,
    reasoningEffort: "high",
  },
  maxSteps: 25,
  maxTokenBudget: 250_000,
  backgroundCapable: true,
  systemPromptTemplate: [
    "You are a security-auditor agent. Scan for vulnerabilities and insecure patterns.",
    "Check for: hardcoded secrets, injection risks, insecure dependencies, improper auth, and data exposure.",
    "Classify each finding by severity (CRITICAL / HIGH / MEDIUM / LOW) and provide remediation guidance.",
    "You have READ-ONLY access — do not modify files.",
  ].join("\n"),
};

/**
 * COMPACT_MANIFEST — 컨텍스트 압축 에이전트 매니페스트
 *
 * 장기 대화 세션의 컨텍스트를 요약하고 압축합니다.
 * 빠른 모델로 실행되며 낮은 토큰 예산에서 효율적으로 작동합니다.
 */
export const COMPACT_MANIFEST: AgentManifest = {
  id: "compact",
  purpose: {
    shortDescription: "Context compaction and summarization",
    detailedDescription:
      "Summarizes and compacts long conversation contexts to free up token budget. Preserves key decisions, findings, and next steps in a condensed format.",
    category: "general",
  },
  allowedTools: ["file_read"],
  memoryScope: "none",
  isolationMode: "shared",
  modelConfig: {
    preferredModel: "claude-haiku-4-5",
    temperature: 0.0,
    reasoningEffort: "low",
    maxOutputTokens: 4_096,
  },
  maxSteps: 5,
  maxTokenBudget: 50_000,
  backgroundCapable: false,
  systemPromptTemplate: [
    "You are a compaction agent. Summarize the conversation context concisely.",
    "Preserve: current task goal, key decisions made, files modified, and immediate next steps.",
    "Discard: verbose explanations, repeated information, and intermediate reasoning.",
    "Output a structured summary in markdown format.",
  ].join("\n"),
};

// ─────────────────────────────────────────────────────────────────────────────
// Built-in manifest registry
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 내장 에이전트 매니페스트 레지스트리 (id → AgentManifest)
 *
 * 새 내장 매니페스트를 추가하려면 이 Map에 항목을 추가하세요.
 */
const BUILTIN_MANIFESTS: ReadonlyMap<string, AgentManifest> = new Map<string, AgentManifest>([
  [EXPLORE_MANIFEST.id, EXPLORE_MANIFEST],
  [PLAN_MANIFEST.id, PLAN_MANIFEST],
  [IMPLEMENT_MANIFEST.id, IMPLEMENT_MANIFEST],
  [REVIEW_MANIFEST.id, REVIEW_MANIFEST],
  [TEST_MANIFEST.id, TEST_MANIFEST],
  [BUILD_MANIFEST.id, BUILD_MANIFEST],
  [SECURITY_MANIFEST.id, SECURITY_MANIFEST],
  [COMPACT_MANIFEST.id, COMPACT_MANIFEST],
]);

/**
 * 내장 매니페스트를 id로 조회합니다.
 *
 * @param id - 조회할 에이전트 id (예: "explore", "review")
 * @returns 해당 매니페스트, 없으면 undefined
 */
export function getBuiltinManifest(id: string): AgentManifest | undefined {
  return BUILTIN_MANIFESTS.get(id);
}

/**
 * 등록된 모든 내장 매니페스트를 배열로 반환합니다.
 *
 * @returns 내장 AgentManifest 배열 (삽입 순서 보장)
 */
export function listBuiltinManifests(): readonly AgentManifest[] {
  return [...BUILTIN_MANIFESTS.values()];
}

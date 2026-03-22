/**
 * 서브에이전트(Subagent) 도구 — 독립적인 에이전트를 생성하여 작업을 위임하는 도구
 *
 * 복잡한 작업을 처리할 때 메인 에이전트가 서브에이전트를 생성하여
 * 특정 작업을 격리된 컨텍스트에서 수행하도록 위임합니다.
 *
 * 서브에이전트 유형:
 * - "explore": 코드베이스 조사 — 파일 구조, 패턴, 의존성 분석
 * - "plan": 구현 계획 수립 — 작업 분해, 단계별 계획
 * - "general": 일반 작업 실행 — 코드 작성, 수정, 테스트 등
 *
 * 고급 기능:
 * - 백그라운드 실행: run_in_background=true로 비동기 실행
 * - 격리 모드: isolation="worktree"로 Git 워크트리에서 파일 안전하게 수정
 * - 이전 세션 재개: resume 파라미터로 이전 서브에이전트 결과 이어받기
 * - 도구 제한: allowed_tools로 서브에이전트가 사용할 수 있는 도구 제한
 *
 * 팩토리 패턴: LLM 클라이언트, 전략 등 의존성을 주입받아 도구를 생성합니다.
 * ToolContext에는 LLM 관련 의존성이 없으므로, 팩토리 함수로 외부에서 주입합니다.
 *
 * 권한 수준: "confirm" — 서브에이전트가 파일을 수정할 수 있으므로 사용자 확인이 필요합니다.
 */
import { z } from "zod";
import { type ToolDefinition, type ToolContext, type ToolResult } from "../types.js";
import { type LLMProvider } from "../../llm/provider.js";
import { type ToolCallStrategy } from "../../llm/tool-call-strategy.js";
import { type ToolRegistry } from "../registry.js";
import { type AppEventEmitter } from "../../utils/events.js";
import { spawnSubagent, listRecentAgents, type SubagentType } from "../../subagents/spawner.js";

/**
 * 매개변수 스키마 — 서브에이전트의 작업, 유형, 실행 옵션을 정의
 */
const paramSchema = z.object({
  /** 서브에이전트에게 전달할 작업 설명 또는 질문 */
  prompt: z.string().describe("The task or question for the subagent to work on"),
  /** 서브에이전트의 목적에 대한 간단한 설명 — 사용자 UI에 표시 */
  description: z.string().describe("Brief human-readable description of this subagent's purpose"),
  /**
   * 서브에이전트 유형:
   * - "explore": 코드베이스 조사 (읽기 위주)
   * - "plan": 구현 계획 수립
   * - "general": 일반 작업 실행 (읽기+쓰기)
   */
  subagent_type: z
    .enum(["explore", "plan", "general"])
    .describe(
      "Type of subagent: 'explore' for codebase investigation, 'plan' for implementation planning, 'general' for task execution",
    ),
  /** 백그라운드 실행 여부(선택사항) — true이면 즉시 에이전트 ID를 반환하고 비동기로 실행 */
  run_in_background: z
    .boolean()
    .optional()
    .describe("Run subagent in background, returns immediately with agent ID"),
  /** 격리 모드(선택사항) — "worktree"를 지정하면 Git 워크트리에서 파일을 안전하게 수정 */
  isolation: z
    .enum(["worktree"])
    .optional()
    .describe("Isolation mode: 'worktree' creates a git worktree for file-safe isolation"),
  /** 이전 서브에이전트 재개(선택사항) — 에이전트 ID를 전달하면 이전 세션을 이어받음 */
  resume: z
    .string()
    .uuid()
    .optional()
    .describe("Resume from a previous subagent by providing its agent ID (UUID format)"),
  /** 허용 도구 목록(선택사항) — 서브에이전트가 사용할 수 있는 도구를 이 목록으로 제한 */
  allowed_tools: z
    .array(z.string())
    .optional()
    .describe("Restrict subagent to only these tool names"),
});

type Params = z.infer<typeof paramSchema>;

/**
 * 에이전트 도구 생성에 필요한 의존성 인터페이스
 *
 * 표준 ToolContext에는 LLM 클라이언트나 도구 레지스트리가 포함되어 있지 않으므로,
 * 팩토리 패턴(Factory Pattern)으로 외부에서 주입합니다.
 */
export interface AgentToolDeps {
  /** LLM API 클라이언트 — 서브에이전트가 LLM과 통신하는 데 사용 */
  readonly client: LLMProvider;
  /** 사용할 LLM 모델 이름 (예: "gpt-4", "claude-3-opus") */
  readonly model: string;
  /** 도구 호출 전략 — LLM 응답에서 도구 호출을 추출하는 방식 */
  readonly strategy: ToolCallStrategy;
  /** 도구 레지스트리 — 서브에이전트가 사용할 수 있는 도구 목록 */
  readonly toolRegistry: ToolRegistry;
  /** 이벤트 발행기(선택사항) — 부모 에이전트의 이벤트 시스템에 연결 */
  readonly events?: AppEventEmitter;
  /** 응답 언어 로케일 (예: "ko", "en") — 서브에이전트 프롬프트 언어 설정 */
  readonly locale?: string;
  /** 프로젝트 지시사항 (DBCODE.md 내용) — 서브에이전트가 프로젝트 컨벤션을 따르도록 */
  readonly projectInstructions?: string;
  /** 응답 톤/스타일 (예: "normal", "cute", "senior") */
  readonly tone?: string;
  /** 자동 메모리 콘텐츠 (MEMORY.md 내용) */
  readonly autoMemoryContent?: string;
  /** 저장소 맵 콘텐츠 (코드베이스 구조 정보) */
  readonly repoMapContent?: string;
  /** 헤드리스 모드 여부 */
  readonly isHeadless?: boolean;
  /** Current nesting depth — incremented when spawning child subagents */
  readonly depth?: number;
  /** Extended thinking 설정 (Claude 모델 전용) — 서브에이전트에 전파 */
  readonly thinking?: import("../../llm/provider.js").ThinkingConfig;
  /** 도구 실행 전 권한 확인 콜백 — 서브에이전트에서도 동일한 권한 검사를 적용 */
  readonly checkPermission?: (
    call: import("../types.js").ExtractedToolCall,
  ) => Promise<import("../../core/agent-loop.js").PermissionResult>;
  /** 파일 변경 시 자동 체크포인트 매니저 — 서브에이전트 파일 변경도 추적 */
  readonly checkpointManager?: import("../../core/checkpoint-manager.js").CheckpointManager;
  /** 세션 ID (체크포인트 메타데이터용) */
  readonly sessionId?: string;
}

/**
 * 에이전트 도구 팩토리 함수 — 의존성을 주입받아 agent 도구 정의를 생성
 *
 * 팩토리 패턴(Factory Pattern)을 사용하는 이유:
 * 대부분의 도구는 매개변수와 ToolContext만으로 충분하지만,
 * 서브에이전트는 LLM 클라이언트, 전략, 레지스트리 등 추가 의존성이 필요합니다.
 * 이 의존성들을 클로저(closure)로 캡처하여 execute 함수에서 사용합니다.
 *
 * @param deps - 서브에이전트 생성에 필요한 의존성들
 * @returns 완전한 도구 정의 (ToolDefinition)
 */
export function createAgentTool(deps: AgentToolDeps): ToolDefinition<Params> {
  /**
   * 서브에이전트 실행 함수
   *
   * spawnSubagent를 호출하여 새로운 에이전트 루프를 시작합니다.
   * 서브에이전트는 자체 에이전트 루프를 실행하며, 도구를 사용하고,
   * 최종 결과를 텍스트로 반환합니다.
   *
   * @param params - 검증된 매개변수
   * @param context - 실행 컨텍스트 (작업 디렉토리, 취소 신호 등)
   * @returns 서브에이전트의 실행 결과
   */
  async function execute(params: Params, context: ToolContext): Promise<ToolResult> {
    const subagentType: SubagentType = params.subagent_type;

    try {
      // spawnSubagent — 새로운 에이전트 루프를 생성하고 실행
      // context.activeClient/activeModel은 /model 전환 시 최신 클라이언트를 반영
      const result = await spawnSubagent({
        type: subagentType,
        prompt: params.prompt,
        client: context.activeClient ?? deps.client,
        model: context.activeModel ?? deps.model,
        strategy: deps.strategy,
        toolRegistry: deps.toolRegistry,
        workingDirectory: context.workingDirectory,
        signal: context.abortSignal,
        parentEvents: deps.events,
        allowedTools: params.allowed_tools,
        run_in_background: params.run_in_background,
        isolation: params.isolation,
        resume: params.resume,
        locale: deps.locale,
        projectInstructions: deps.projectInstructions,
        tone: deps.tone,
        autoMemoryContent: deps.autoMemoryContent,
        repoMapContent: deps.repoMapContent,
        isHeadless: deps.isHeadless,
        depth: (deps.depth ?? 0) + 1,
        thinking: context.thinking ?? deps.thinking,
        checkPermission: context.checkPermission ?? deps.checkPermission,
        checkpointManager: context.checkpointManager ?? deps.checkpointManager,
        sessionId: context.sessionId ?? deps.sessionId,
      });

      // 최근 에이전트 목록을 조회하여 resume 시 사용자 편의 제공
      const recentAgents = await listRecentAgents(3);
      const resumeHint =
        recentAgents.length > 0
          ? `\n\n[Resumable agents:\n${recentAgents
              .map((a) => {
                const id = a.agentId.slice(0, 8);
                const prompt = a.promptSummary.slice(0, 30);
                return `  ${id}… "${prompt}"`;
              })
              .join("\n")}]`
          : "";

      return {
        output: result.response + resumeHint,
        isError: false,
        metadata: {
          agentId: result.agentId, // 서브에이전트 고유 ID (재개 시 사용)
          type: result.type, // 서브에이전트 유형
          iterations: result.iterations, // 에이전트 루프 반복 횟수
          aborted: result.aborted, // 사용자에 의해 중단되었는지 여부
          workingDirectory: result.workingDirectory,
          description: params.description,
          recentAgents, // 최근 에이전트 목록 (UI에서 선택용)
          usage: result.usage, // 서브에이전트 토큰 사용량 통계
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        output: `Agent (${subagentType}) failed: ${message}`,
        isError: true,
        metadata: {
          type: subagentType,
          description: params.description,
        },
      };
    }
  }

  return {
    name: "agent",
    description:
      "Spawn a subagent to perform a task in an isolated context. Use 'explore' for codebase investigation, 'plan' for implementation planning, 'general' for task execution. The subagent runs its own agent loop with access to tools and returns its findings.",
    parameterSchema: paramSchema,
    permissionLevel: "confirm",
    execute,
  };
}

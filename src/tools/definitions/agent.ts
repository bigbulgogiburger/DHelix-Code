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
import { spawnSubagent, type SubagentType } from "../../subagents/spawner.js";

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
    .optional()
    .describe("Resume from a previous subagent by providing its agent ID"),
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
      const result = await spawnSubagent({
        type: subagentType,
        prompt: params.prompt,
        client: deps.client,
        model: deps.model,
        strategy: deps.strategy,
        toolRegistry: deps.toolRegistry,
        workingDirectory: context.workingDirectory,
        signal: context.abortSignal,
        parentEvents: deps.events,
        allowedTools: params.allowed_tools,
        run_in_background: params.run_in_background,
        isolation: params.isolation,
        resume: params.resume,
      });

      return {
        output: result.response,
        isError: false,
        metadata: {
          agentId: result.agentId, // 서브에이전트 고유 ID (재개 시 사용)
          type: result.type, // 서브에이전트 유형
          iterations: result.iterations, // 에이전트 루프 반복 횟수
          aborted: result.aborted, // 사용자에 의해 중단되었는지 여부
          workingDirectory: result.workingDirectory,
          description: params.description,
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

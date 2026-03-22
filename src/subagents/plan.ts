/**
 * 계획(Plan) 서브에이전트 스포너 — 구현 계획 수립을 위한 읽기 전용 서브에이전트 생성 모듈
 *
 * 서브에이전트(Subagent)란 메인 에이전트가 복잡한 작업을 분할하여
 * 별도의 에이전트에게 위임하는 패턴입니다.
 *
 * 이 모듈은 "계획" 유형의 서브에이전트를 생성합니다.
 * 계획 에이전트는 코드베이스를 읽고 분석하여 구현 계획서를 작성합니다.
 * 의존성 분석, 리스크 평가, 단계별 구현 계획 등을 산출합니다.
 * 코드를 수정하지 않으므로 안전합니다.
 *
 * 예시: "이 기능을 추가하려면 어떤 파일을 수정해야 하고 어떤 순서로 해야 할지 계획해줘"
 * 같은 요청에 사용됩니다.
 */
import { type LLMProvider } from "../llm/provider.js";
import { type ToolCallStrategy } from "../llm/tool-call-strategy.js";
import { type ToolRegistry } from "../tools/registry.js";
import { type AppEventEmitter } from "../utils/events.js";
import { spawnSubagent, type SubagentResult } from "./spawner.js";

/**
 * 계획 수립에 사용할 도구 목록 (읽기 전용 + 검색)
 * 코드를 수정하지 않고 분석만 하므로 안전합니다.
 */
const PLAN_ALLOWED_TOOLS = ["file_read", "glob_search", "grep_search", "list_dir"] as const;

/**
 * 계획(Plan) 서브에이전트를 생성하여 구현 계획과 의존성 분석을 수행합니다.
 *
 * 계획 에이전트는 코드베이스를 읽고 검색할 수 있지만 수정할 수는 없습니다.
 * 구조화된 구현 계획, 리스크 평가, 단계별 분석 결과를 반환합니다.
 *
 * @param options - 서브에이전트 생성에 필요한 설정 객체
 * @param options.prompt - 서브에이전트에게 전달할 계획 수립 요청
 * @param options.client - LLM API 클라이언트
 * @param options.model - 사용할 AI 모델 식별자
 * @param options.strategy - 도구 호출 전략
 * @param options.toolRegistry - 사용 가능한 도구들의 레지스트리
 * @param options.workingDirectory - 작업 디렉토리 경로
 * @param options.maxIterations - 최대 반복 횟수 (기본값: 10, 계획은 적은 반복으로 충분)
 * @param options.signal - AbortSignal — 작업 취소를 위한 시그널 객체
 * @param options.parentEvents - 부모 에이전트의 이벤트 발행기
 * @returns 서브에이전트 실행 결과 (구현 계획 텍스트, 반복 횟수 등)
 */
export async function spawnPlanAgent(options: {
  readonly prompt: string;
  readonly client: LLMProvider;
  readonly model: string;
  readonly strategy: ToolCallStrategy;
  readonly toolRegistry: ToolRegistry;
  readonly workingDirectory?: string;
  readonly maxIterations?: number;
  readonly signal?: AbortSignal;
  readonly parentEvents?: AppEventEmitter;
  readonly locale?: string;
  readonly projectInstructions?: string;
}): Promise<SubagentResult> {
  // spawner 모듈의 범용 생성 함수를 호출하되, 계획 전용 설정을 적용
  return spawnSubagent({
    type: "plan",
    prompt: options.prompt,
    client: options.client,
    model: options.model,
    strategy: options.strategy,
    toolRegistry: options.toolRegistry,
    workingDirectory: options.workingDirectory,
    maxIterations: options.maxIterations ?? 10, // 계획 수립은 10회면 충분
    signal: options.signal,
    parentEvents: options.parentEvents,
    allowedTools: [...PLAN_ALLOWED_TOOLS], // 읽기 전용 도구만 허용
    locale: options.locale,
    projectInstructions: options.projectInstructions,
  });
}

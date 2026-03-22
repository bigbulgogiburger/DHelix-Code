/**
 * 범용(General) 서브에이전트 스포너 — 모든 도구를 사용할 수 있는 범용 서브에이전트 생성 모듈
 *
 * 서브에이전트(Subagent)란 메인 에이전트가 복잡한 작업을 분할하여
 * 별도의 에이전트에게 위임하는 패턴입니다.
 *
 * 이 모듈은 "범용" 유형의 서브에이전트를 생성합니다.
 * 범용 에이전트는 파일 읽기/쓰기, 코드 실행, 검색 등 모든 도구에 접근할 수 있어
 * 코드 작성, 수정, 테스트 실행 등 다양한 작업을 수행할 수 있습니다.
 *
 * 예시: "이 함수를 리팩토링해줘", "새로운 테스트 파일을 만들어줘" 같은
 * 읽기와 쓰기가 모두 필요한 작업을 위임할 때 사용됩니다.
 */
import { type LLMProvider } from "../llm/provider.js";
import { type ToolCallStrategy } from "../llm/tool-call-strategy.js";
import { type ToolRegistry } from "../tools/registry.js";
import { type AppEventEmitter } from "../utils/events.js";
import { spawnSubagent, type SubagentResult } from "./spawner.js";

/**
 * 범용(General) 서브에이전트를 생성하여 위임된 작업을 실행합니다.
 *
 * 범용 에이전트는 도구 필터링 없이 모든 도구에 접근할 수 있습니다.
 * 단, allowedTools 옵션으로 특정 도구만 허용하도록 제한할 수 있습니다.
 *
 * @param options - 서브에이전트 생성에 필요한 설정 객체
 * @param options.prompt - 서브에이전트에게 전달할 작업 지시
 * @param options.client - LLM API 클라이언트 (OpenAI 호환 인터페이스)
 * @param options.model - 사용할 AI 모델 식별자
 * @param options.strategy - 도구 호출 전략
 * @param options.toolRegistry - 사용 가능한 도구들의 레지스트리(등록소)
 * @param options.workingDirectory - 작업 디렉토리 경로
 * @param options.maxIterations - 최대 반복 횟수 (기본값: 25, 범용은 더 많은 단계가 필요할 수 있음)
 * @param options.signal - AbortSignal — 작업 취소를 위한 시그널 객체
 * @param options.parentEvents - 부모 에이전트의 이벤트 발행기
 * @param options.allowedTools - 선택적 도구 허용 목록 (지정하지 않으면 모든 도구 사용 가능)
 * @returns 서브에이전트 실행 결과 (응답 텍스트, 반복 횟수, 메시지 히스토리 등)
 */
export async function spawnGeneralAgent(options: {
  readonly prompt: string;
  readonly client: LLMProvider;
  readonly model: string;
  readonly strategy: ToolCallStrategy;
  readonly toolRegistry: ToolRegistry;
  readonly workingDirectory?: string;
  readonly maxIterations?: number;
  readonly signal?: AbortSignal;
  readonly parentEvents?: AppEventEmitter;
  readonly allowedTools?: readonly string[];
  readonly locale?: string;
  readonly projectInstructions?: string;
}): Promise<SubagentResult> {
  // spawner 모듈의 범용 생성 함수를 호출 — 도구 제한 없이 모든 도구 사용 가능
  return spawnSubagent({
    type: "general",
    prompt: options.prompt,
    client: options.client,
    model: options.model,
    strategy: options.strategy,
    toolRegistry: options.toolRegistry,
    workingDirectory: options.workingDirectory,
    maxIterations: options.maxIterations ?? 25, // 범용 작업은 더 많은 반복이 필요
    signal: options.signal,
    parentEvents: options.parentEvents,
    allowedTools: options.allowedTools, // undefined이면 모든 도구 허용
    locale: options.locale,
    projectInstructions: options.projectInstructions,
  });
}

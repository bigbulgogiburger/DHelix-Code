/**
 * LLM 프로바이더 인터페이스 정의 — 모든 LLM 클라이언트가 구현해야 하는 공통 계약
 *
 * 이 파일은 LLM(Large Language Model, 대규모 언어 모델)과 통신하기 위한
 * 모든 타입과 인터페이스를 정의합니다.
 * OpenAI, Anthropic, Ollama 등 다양한 LLM 프로바이더가
 * 이 인터페이스를 구현하여 통일된 방식으로 사용됩니다.
 *
 * 주요 역할:
 * - 채팅 메시지, 요청/응답 타입 정의
 * - 도구 호출(function calling) 관련 타입 정의
 * - 스트리밍 청크 타입 정의
 * - LLM 프로바이더 공통 인터페이스 정의
 */

/** 채팅 메시지의 역할 — 누가 이 메시지를 보냈는지 구분하는 타입 */
export type ChatRole =
  | "system"     // 시스템 지시사항 (LLM의 행동 규칙을 설정)
  | "user"       // 사용자가 보낸 메시지
  | "assistant"  // LLM이 생성한 응답 메시지
  | "tool";      // 도구 실행 결과 메시지 (함수 호출 후 반환값)

/** 하나의 채팅 메시지 — 대화 기록의 기본 단위 */
export interface ChatMessage {
  /** 메시지를 보낸 주체 (system, user, assistant, tool 중 하나) */
  readonly role: ChatRole;
  /** 메시지 본문 텍스트 */
  readonly content: string;
  /** 메시지 발신자 이름 (선택적, 일부 API에서 사용) */
  readonly name?: string;
  /** 도구 호출 ID — role이 "tool"일 때 어떤 도구 호출에 대한 응답인지 식별 */
  readonly toolCallId?: string;
  /** LLM이 요청한 도구 호출 목록 — role이 "assistant"일 때 LLM이 호출하려는 도구들 */
  readonly toolCalls?: readonly ToolCallRequest[];
}

/**
 * 도구 호출 요청 — LLM이 특정 도구(함수)를 실행해 달라고 보내는 요청
 *
 * LLM은 자체적으로 파일을 읽거나 명령어를 실행할 수 없으므로,
 * 도구 호출을 통해 외부 기능을 사용합니다.
 */
export interface ToolCallRequest {
  /** 고유 식별자 — 요청과 응답을 매칭하는 데 사용 */
  readonly id: string;
  /** 호출할 도구(함수)의 이름 (예: "file_read", "bash_exec") */
  readonly name: string;
  /** 도구에 전달할 인자 (JSON 문자열 형태) */
  readonly arguments: string;
}

/**
 * LLM에 전달할 도구 정의 — LLM이 사용할 수 있는 도구를 설명하는 스키마
 *
 * OpenAI의 function calling 형식을 따르며,
 * LLM이 어떤 도구를 사용할 수 있고 각 도구에 어떤 매개변수가 필요한지 알려줍니다.
 */
export interface ToolDefinitionForLLM {
  /** 항상 "function" — OpenAI API 호환을 위한 타입 필드 */
  readonly type: "function";
  readonly function: {
    /** 도구 이름 (예: "file_read") */
    readonly name: string;
    /** 도구 설명 — LLM이 언제 이 도구를 사용할지 판단하는 데 활용 */
    readonly description: string;
    /** 매개변수 JSON 스키마 — 도구에 전달할 인자의 형식을 정의 */
    readonly parameters: Record<string, unknown>;
  };
}

/**
 * Extended Thinking(확장 사고) 설정 — Claude 모델의 깊은 추론 기능
 *
 * 활성화하면 모델이 답변하기 전에 내부적으로 깊이 생각하는 과정을 거칩니다.
 * budget_tokens로 사고에 사용할 토큰 수를 제한합니다.
 */
export interface ThinkingConfig {
  /** 항상 "enabled" — 확장 사고를 활성화 */
  readonly type: "enabled";
  /** 사고에 할당할 최대 토큰 수 — 클수록 더 깊이 생각하지만 비용 증가 */
  readonly budget_tokens: number;
}

/**
 * LLM 요청 — 모델에게 보내는 채팅 완성(chat completion) 요청
 *
 * 대화 기록, 사용할 모델, 도구 목록 등을 포함합니다.
 */
export interface ChatRequest {
  /** 사용할 모델 이름 (예: "gpt-4o", "claude-sonnet-4-20250514") */
  readonly model: string;
  /** 대화 메시지 목록 — 시스템 지시사항 + 대화 기록 */
  readonly messages: readonly ChatMessage[];
  /** LLM이 사용할 수 있는 도구 목록 (선택적) */
  readonly tools?: readonly ToolDefinitionForLLM[];
  /** 응답의 무작위성 조절 (0=결정적, 1=창의적) — 일부 모델은 지원하지 않음 */
  readonly temperature?: number;
  /** 생성할 최대 토큰 수 */
  readonly maxTokens?: number;
  /** 요청 취소를 위한 AbortSignal — 사용자가 Esc를 누르면 요청을 중단할 수 있음 */
  readonly signal?: AbortSignal;
  /** Extended Thinking 설정 (Claude 모델 전용) */
  readonly thinking?: ThinkingConfig;
}

/**
 * LLM 응답 — 모델이 반환한 전체 응답
 *
 * 텍스트 응답, 도구 호출 요청, 토큰 사용량 등을 포함합니다.
 */
export interface ChatResponse {
  /** 모델이 생성한 텍스트 응답 */
  readonly content: string;
  /** 모델이 요청한 도구 호출 목록 — 에이전트 루프에서 이를 실행하고 결과를 다시 전달 */
  readonly toolCalls: readonly ToolCallRequest[];
  /** 토큰 사용량 정보 — 비용 추적에 사용 */
  readonly usage: TokenUsage;
  /** 응답 종료 사유 (예: "stop"=정상 종료, "length"=토큰 한도 도달, "tool_calls"=도구 호출) */
  readonly finishReason: string;
  /** Extended Thinking 내용 (Claude 모델 전용) — 모델의 내부 사고 과정 */
  readonly thinking?: string;
}

/**
 * 스트리밍 청크 — LLM의 스트리밍 응답에서 실시간으로 받는 데이터 조각
 *
 * LLM은 응답을 한 번에 보내지 않고, 토큰 단위로 점진적으로 보냅니다.
 * 이를 통해 사용자는 응답이 생성되는 것을 실시간으로 볼 수 있습니다.
 */
export interface ChatChunk {
  /** 청크 타입 — 어떤 종류의 데이터인지 구분 */
  readonly type:
    | "text-delta"        // 텍스트 응답의 일부분
    | "tool-call-delta"   // 도구 호출 데이터의 일부분
    | "thinking-delta"    // Extended Thinking 내용의 일부분
    | "done";             // 스트리밍 완료 신호
  /** 텍스트 조각 (type이 "text-delta"일 때) */
  readonly text?: string;
  /** 도구 호출 조각 (type이 "tool-call-delta"일 때) — 점진적으로 조립됨 */
  readonly toolCall?: Partial<ToolCallRequest>;
  /** 토큰 사용량 (type이 "done"일 때 최종 사용량 포함) */
  readonly usage?: TokenUsage;
  /** Extended Thinking 텍스트 조각 (type이 "thinking-delta"일 때) */
  readonly thinking_delta?: string;
}

/**
 * 토큰 사용량 정보 — API 호출에서 소비된 토큰 수를 추적
 *
 * 토큰은 LLM이 텍스트를 처리하는 기본 단위입니다.
 * 비용은 토큰 수에 비례하므로, 사용량 추적이 중요합니다.
 */
export interface TokenUsage {
  /** 입력(프롬프트)에 사용된 토큰 수 — 시스템 지시사항 + 대화 기록 */
  readonly promptTokens: number;
  /** 출력(모델 응답)에 사용된 토큰 수 */
  readonly completionTokens: number;
  /** 총 토큰 수 (promptTokens + completionTokens) */
  readonly totalTokens: number;
}

/**
 * LLM 프로바이더 인터페이스 — 모든 LLM 클라이언트가 구현해야 하는 공통 계약
 *
 * 이 인터페이스를 구현하면 어떤 LLM 서비스든 동일한 방식으로 사용할 수 있습니다.
 * (다형성 패턴 — OpenAI, Anthropic, Ollama 등이 모두 이 인터페이스를 구현)
 */
export interface LLMProvider {
  /** 프로바이더 이름 (예: "openai-compatible", "anthropic") */
  readonly name: string;
  /**
   * 동기식 채팅 요청 — 전체 응답을 한 번에 받음
   * @param request - 채팅 요청 (모델, 메시지, 도구 등)
   * @returns 전체 LLM 응답 (텍스트, 도구 호출, 사용량)
   */
  chat(request: ChatRequest): Promise<ChatResponse>;
  /**
   * 스트리밍 채팅 요청 — 응답을 실시간 청크로 받음
   * @param request - 채팅 요청
   * @returns 비동기 이터러블 — for await...of로 청크를 순회
   */
  stream(request: ChatRequest): AsyncIterable<ChatChunk>;
  /**
   * 텍스트의 토큰 수를 계산
   * @param text - 토큰 수를 계산할 텍스트
   * @returns 토큰 수
   */
  countTokens(text: string): number;
}

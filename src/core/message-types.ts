/**
 * 메시지 타입 정의 모듈
 *
 * LLM(대규모 언어 모델)과 주고받는 모든 메시지의 타입을 정의합니다.
 * 채팅 시스템에서 사용되는 역할(role)별 메시지 구조와
 * 도구 호출(tool call) 관련 타입을 포함합니다.
 *
 * 주니어 개발자를 위한 설명:
 * - 이 파일은 채팅 메시지의 "설계도" 역할을 합니다
 * - 각 인터페이스는 메시지가 어떤 데이터를 가져야 하는지 규정합니다
 * - 타입 가드(type guard) 함수들은 메시지 종류를 안전하게 판별합니다
 */

/**
 * 메시지 역할(role) 상수 객체
 *
 * 채팅에서 누가 보낸 메시지인지를 나타내는 역할 값들입니다.
 * `as const`로 선언하여 값이 변경되지 않는 리터럴 타입(literal type)으로 사용합니다.
 *
 * - System: 시스템 지시사항 (LLM의 행동 규칙 설정)
 * - User: 사용자가 입력한 메시지
 * - Assistant: LLM이 생성한 응답 메시지
 * - Tool: 도구 실행 결과를 담는 메시지
 */
export const MessageRole = {
  System: "system",
  User: "user",
  Assistant: "assistant",
  Tool: "tool",
} as const;

/**
 * MessageRole 객체의 값들로부터 추출한 유니온 타입
 * "system" | "user" | "assistant" | "tool" 중 하나의 값을 가집니다
 */
export type MessageRoleValue = (typeof MessageRole)[keyof typeof MessageRole];

/**
 * 어시스턴트 메시지 내에 포함되는 도구 호출(tool call) 정보
 *
 * LLM이 "이 도구를 실행해달라"고 요청할 때 사용하는 구조입니다.
 * 예: 파일 읽기, 검색 실행, 커맨드 실행 등
 *
 * @property id - 도구 호출의 고유 식별자 (결과를 매칭하는 데 사용)
 * @property name - 호출할 도구의 이름 (예: "file_read", "bash_exec")
 * @property arguments - 도구에 전달할 인자 (JSON 문자열 형태)
 */
export interface ToolCall {
  readonly id: string;
  readonly name: string;
  readonly arguments: string;
}

/**
 * 도구 실행 결과
 *
 * 도구가 실행된 후 그 결과를 담는 구조입니다.
 * 이 결과는 다시 LLM에게 전달되어 다음 응답을 생성하는 데 사용됩니다.
 *
 * @property id - 원래 도구 호출의 ID (어떤 호출에 대한 결과인지 매칭)
 * @property output - 도구 실행의 출력 텍스트
 * @property isError - 실행 중 에러가 발생했는지 여부
 */
export interface ToolCallResult {
  readonly id: string;
  readonly output: string;
  readonly isError: boolean;
}

/**
 * 기본 채팅 메시지 인터페이스
 *
 * 모든 종류의 메시지가 공통으로 가지는 필드를 정의합니다.
 *
 * @property role - 메시지 발신자 역할 ("system" | "user" | "assistant" | "tool")
 * @property content - 메시지 본문 텍스트
 * @property timestamp - 메시지 생성 시각
 */
export interface ChatMessage {
  readonly role: MessageRoleValue;
  readonly content: string;
  readonly timestamp: Date;
}

/**
 * 사용자 메시지 타입
 * ChatMessage를 확장하며, role이 반드시 "user"입니다
 */
export interface UserMessage extends ChatMessage {
  readonly role: typeof MessageRole.User;
}

/**
 * 어시스턴트(AI) 메시지 타입
 * ChatMessage를 확장하며, role이 반드시 "assistant"입니다.
 * 도구 호출 목록(toolCalls)을 포함할 수 있습니다.
 *
 * @property toolCalls - LLM이 요청한 도구 호출 배열 (비어있을 수 있음)
 */
export interface AssistantMessage extends ChatMessage {
  readonly role: typeof MessageRole.Assistant;
  readonly toolCalls: readonly ToolCall[];
}

/**
 * 도구 결과 메시지 타입
 * 도구 실행 결과를 LLM에게 전달할 때 사용하는 메시지입니다.
 *
 * @property toolCallId - 이 결과가 응답하는 도구 호출의 ID
 * @property isError - 도구 실행 중 에러 발생 여부
 */
export interface ToolMessage extends ChatMessage {
  readonly role: typeof MessageRole.Tool;
  readonly toolCallId: string;
  readonly isError: boolean;
}

/**
 * 시스템 메시지 타입
 * LLM에게 행동 규칙이나 컨텍스트를 설정할 때 사용합니다.
 * 보통 대화 시작 시 한 번 전달됩니다.
 */
export interface SystemMessage extends ChatMessage {
  readonly role: typeof MessageRole.System;
}

/**
 * 모든 메시지 타입의 유니온(합집합) 타입
 * 어떤 종류의 메시지든 이 타입으로 표현할 수 있습니다.
 * TypeScript의 "구별된 유니온(discriminated union)" 패턴을 사용합니다.
 */
export type AnyMessage = UserMessage | AssistantMessage | ToolMessage | SystemMessage;

/**
 * 타입 가드: 주어진 메시지가 사용자 메시지인지 판별
 *
 * 타입 가드(type guard)란? TypeScript에서 런타임에 타입을 좁혀주는 함수입니다.
 * 이 함수가 true를 반환하면, 이후 코드에서 msg를 UserMessage 타입으로 안전하게 사용할 수 있습니다.
 *
 * @param msg - 판별할 메시지 객체
 * @returns msg가 UserMessage인 경우 true
 */
export function isUserMessage(msg: ChatMessage): msg is UserMessage {
  return msg.role === MessageRole.User;
}

/**
 * 타입 가드: 주어진 메시지가 어시스턴트 메시지인지 판별
 *
 * @param msg - 판별할 메시지 객체
 * @returns msg가 AssistantMessage인 경우 true
 */
export function isAssistantMessage(msg: ChatMessage): msg is AssistantMessage {
  return msg.role === MessageRole.Assistant;
}

/**
 * 타입 가드: 주어진 메시지가 도구 결과 메시지인지 판별
 *
 * @param msg - 판별할 메시지 객체
 * @returns msg가 ToolMessage인 경우 true
 */
export function isToolMessage(msg: ChatMessage): msg is ToolMessage {
  return msg.role === MessageRole.Tool;
}

/**
 * 타입 가드: 주어진 메시지가 시스템 메시지인지 판별
 *
 * @param msg - 판별할 메시지 객체
 * @returns msg가 SystemMessage인 경우 true
 */
export function isSystemMessage(msg: ChatMessage): msg is SystemMessage {
  return msg.role === MessageRole.System;
}

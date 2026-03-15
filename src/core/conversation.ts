/**
 * 대화(Conversation) 상태 관리 모듈
 *
 * 사용자와 AI 간의 대화를 불변(immutable) 객체로 관리합니다.
 * 모든 변경(메시지 추가 등)은 기존 객체를 수정하지 않고 새로운 Conversation 인스턴스를 반환합니다.
 *
 * 주니어 개발자를 위한 설명:
 * - "불변(immutable)"이란 한번 만들어진 객체를 절대 바꾸지 않는 패턴입니다
 * - 메시지를 추가하면 기존 대화를 복사하고 새 메시지를 포함한 새 객체를 만듭니다
 * - 이렇게 하면 실수로 데이터를 변경하는 버그를 방지할 수 있습니다
 * - React 상태 관리에서도 같은 원리를 사용합니다
 */
import {
  type ToolCall,
  type ToolCallResult,
  type AnyMessage,
  type UserMessage,
  type AssistantMessage,
  type ToolMessage,
  type SystemMessage,
  MessageRole,
} from "./message-types.js";

/**
 * 불변 대화 상태 클래스
 *
 * 대화의 전체 상태(메시지 목록, 메타데이터 등)를 담고 있습니다.
 * 모든 수정 메서드(append~, with~)는 새로운 Conversation 인스턴스를 반환합니다.
 *
 * @property id - 대화의 고유 식별자
 * @property messages - 지금까지의 모든 메시지 목록 (읽기 전용 배열)
 * @property createdAt - 대화 생성 시각
 * @property metadata - 대화에 첨부된 메타데이터 (키-값 쌍)
 */
export class Conversation {
  // private constructor: 외부에서 new Conversation()으로 직접 생성할 수 없고,
  // 반드시 Conversation.create() 정적 메서드를 통해서만 생성할 수 있습니다.
  private constructor(
    readonly id: string,
    readonly messages: readonly AnyMessage[],
    readonly createdAt: Date,
    readonly metadata: Readonly<Record<string, unknown>>,
  ) {}

  /**
   * 새로운 빈 대화를 생성하는 팩토리 메서드
   *
   * "팩토리 메서드"란 객체를 생성하는 전용 메서드입니다.
   * constructor 대신 이 메서드를 사용하면 생성 로직을 명확하게 표현할 수 있습니다.
   *
   * @param id - 대화의 고유 식별자
   * @returns 메시지가 없는 새 Conversation 인스턴스
   */
  static create(id: string): Conversation {
    return new Conversation(id, [], new Date(), {});
  }

  /**
   * 시스템 메시지를 추가합니다. 새로운 Conversation을 반환합니다.
   *
   * 시스템 메시지는 LLM에게 행동 지침을 전달하는 용도로,
   * 보통 대화 시작 시 한 번 추가됩니다.
   *
   * @param content - 시스템 메시지 내용
   * @returns 시스템 메시지가 추가된 새 Conversation
   */
  appendSystemMessage(content: string): Conversation {
    const message: SystemMessage = {
      role: MessageRole.System,
      content,
      timestamp: new Date(),
    };
    // 스프레드 연산자(...)로 기존 메시지를 복사한 뒤 새 메시지를 추가합니다
    return new Conversation(this.id, [...this.messages, message], this.createdAt, this.metadata);
  }

  /**
   * 사용자 메시지를 추가합니다. 새로운 Conversation을 반환합니다.
   *
   * @param content - 사용자가 입력한 메시지 내용
   * @returns 사용자 메시지가 추가된 새 Conversation
   */
  appendUserMessage(content: string): Conversation {
    const message: UserMessage = {
      role: MessageRole.User,
      content,
      timestamp: new Date(),
    };
    return new Conversation(this.id, [...this.messages, message], this.createdAt, this.metadata);
  }

  /**
   * 어시스턴트(AI) 응답 메시지를 추가합니다. 새로운 Conversation을 반환합니다.
   *
   * @param content - AI가 생성한 응답 텍스트
   * @param toolCalls - AI가 요청한 도구 호출 목록 (기본값: 빈 배열)
   * @returns 어시스턴트 메시지가 추가된 새 Conversation
   */
  appendAssistantMessage(content: string, toolCalls: readonly ToolCall[] = []): Conversation {
    const message: AssistantMessage = {
      role: MessageRole.Assistant,
      content,
      toolCalls,
      timestamp: new Date(),
    };
    return new Conversation(this.id, [...this.messages, message], this.createdAt, this.metadata);
  }

  /**
   * 도구 실행 결과 메시지를 추가합니다. 새로운 Conversation을 반환합니다.
   *
   * 여러 도구의 결과를 한번에 추가할 수 있습니다.
   * 각 결과는 개별 ToolMessage로 변환됩니다.
   *
   * @param results - 도구 실행 결과 배열
   * @returns 도구 결과 메시지가 추가된 새 Conversation
   */
  appendToolResults(results: readonly ToolCallResult[]): Conversation {
    // 각 결과를 ToolMessage 형태로 변환합니다
    const toolMessages: ToolMessage[] = results.map((result) => ({
      role: MessageRole.Tool as typeof MessageRole.Tool,
      content: result.output,
      toolCallId: result.id,
      isError: result.isError,
      timestamp: new Date(),
    }));
    return new Conversation(
      this.id,
      [...this.messages, ...toolMessages],
      this.createdAt,
      this.metadata,
    );
  }

  /**
   * 메타데이터 값을 설정합니다. 새로운 Conversation을 반환합니다.
   *
   * 메타데이터는 대화에 부가 정보(예: 사용 모델명, 태그 등)를 저장하는 용도입니다.
   *
   * @param key - 메타데이터 키
   * @param value - 메타데이터 값
   * @returns 메타데이터가 업데이트된 새 Conversation
   */
  withMetadata(key: string, value: unknown): Conversation {
    return new Conversation(this.id, this.messages, this.createdAt, {
      ...this.metadata,
      [key]: value,
    });
  }

  /**
   * 전체 메시지 수를 반환하는 게터(getter)
   * 게터란? 프로퍼티처럼 접근하지만 내부에서 계산을 수행하는 메서드입니다.
   * 사용법: conversation.length (괄호 없이 접근)
   */
  get length(): number {
    return this.messages.length;
  }

  /**
   * 가장 마지막 메시지를 반환하는 게터
   * 메시지가 없으면 undefined를 반환합니다.
   */
  get lastMessage(): AnyMessage | undefined {
    return this.messages[this.messages.length - 1];
  }

  /**
   * LLM API 호출에 적합한 형태로 메시지를 변환합니다.
   *
   * 내부 메시지 구조에서 LLM이 이해하는 형식(role + content + 도구 정보)으로 변환합니다.
   * 타임스탬프 같은 내부 전용 필드는 제거됩니다.
   *
   * @returns LLM 호출용으로 가공된 메시지 배열
   */
  toMessagesForLLM(): readonly {
    role: string;
    content: string;
    tool_call_id?: string;
    tool_calls?: readonly ToolCall[];
  }[] {
    return this.messages.map((msg) => {
      // 기본 구조: 역할(role)과 내용(content)만 포함
      const base: {
        role: string;
        content: string;
        tool_call_id?: string;
        tool_calls?: readonly ToolCall[];
      } = {
        role: msg.role,
        content: msg.content,
      };

      // 도구 결과 메시지인 경우: 어떤 도구 호출에 대한 결과인지 ID를 포함
      if (msg.role === MessageRole.Tool) {
        return { ...base, tool_call_id: (msg as ToolMessage).toolCallId };
      }
      // 어시스턴트 메시지인 경우: 도구 호출 정보를 포함 (있을 때만)
      if (msg.role === MessageRole.Assistant) {
        const assistantMsg = msg as AssistantMessage;
        if (assistantMsg.toolCalls.length > 0) {
          return { ...base, tool_calls: assistantMsg.toolCalls };
        }
      }
      return base;
    });
  }
}

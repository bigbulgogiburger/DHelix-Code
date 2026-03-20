/**
 * 슬래시 명령어 레지스트리 — 명령어 등록, 조회, 실행을 관리하는 핵심 모듈
 *
 * 이 파일은 dbcode의 슬래시 명령어 시스템의 기반이 되는 타입과 클래스를 정의합니다.
 *
 * 주요 구성 요소:
 *   - CommandContext: 명령어 실행에 필요한 세션 정보 (디렉토리, 모델, 메시지 등)
 *   - CommandResult: 명령어 실행 결과 (출력 텍스트, 성공 여부, 부가 효과 등)
 *   - SlashCommand: 개별 슬래시 명령어 정의 (이름, 설명, 실행 함수)
 *   - CommandRegistry: 명령어를 등록하고 조회/실행하는 레지스트리 클래스
 *
 * 사용 흐름:
 *   1. 각 명령어 파일(agents.ts, commit.ts 등)에서 SlashCommand 객체를 export
 *   2. 앱 초기화 시 CommandRegistry에 register()로 등록
 *   3. 사용자 입력이 "/"로 시작하면 execute()로 실행
 *   4. CommandResult의 플래그(shouldClear, newModel 등)에 따라 부가 동작 수행
 */
import { BaseError } from "../utils/error.js";

/**
 * 명령어 실행 에러 클래스
 *
 * 슬래시 명령어 실행 중 발생하는 에러를 나타냅니다.
 * BaseError를 상속하여 에러 코드와 컨텍스트 정보를 포함합니다.
 */
export class CommandError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "COMMAND_ERROR", context);
  }
}

/**
 * 대화형 선택 목록의 단일 옵션 인터페이스
 *
 * /model, /resume 등에서 사용자가 화살표 키로 선택할 수 있는
 * 목록 항목을 정의합니다.
 *
 * @property label - 화면에 표시되는 텍스트
 * @property value - 선택 시 전달되는 값
 * @property description - 선택적 부가 설명
 */
export interface SelectOption {
  readonly label: string;
  readonly value: string;
  readonly description?: string;
}

/**
 * 대화형 선택 프롬프트 설정 인터페이스
 *
 * 사용자에게 선택 목록을 보여주기 위한 구성입니다.
 *
 * @property options - 선택 가능한 옵션 배열
 * @property prompt - 선택 안내 메시지 (예: "모델을 선택하세요:")
 * @property onSelect - 선택 후 실행할 명령어 (예: "/resume")
 */
export interface InteractiveSelect {
  readonly options: readonly SelectOption[];
  readonly prompt: string;
  /** Command to run with selected value, e.g. "/resume" */
  readonly onSelect: string;
}

/**
 * 명령어 실행에 필요한 컨텍스트 인터페이스
 *
 * 모든 슬래시 명령어의 execute 함수가 두 번째 매개변수로 받는
 * 세션 상태 정보입니다.
 */
export interface CommandContext {
  /** 현재 작업 디렉토리 (프로젝트 루트) */
  readonly workingDirectory: string;
  /** 현재 세션 ID (없을 수 있음) */
  readonly sessionId?: string;
  /** 현재 활성 모델명 (예: "gpt-4o") */
  readonly model: string;
  /** 이벤트를 발생시키는 함수 (예: 체크포인트 복원 이벤트) */
  readonly emit: (event: string, data?: unknown) => void;
  /** 현재 대화 메시지 배열 (/export, /copy 등에서 대화 내역 참조용) */
  readonly messages?: readonly { readonly role: string; readonly content: string }[];
  /** MCP 매니저 인스턴스 (/mcp 명령어에서 서버 관리에 사용) */
  readonly mcpManager?: import("../mcp/manager.js").MCPManager;
}

/**
 * 슬래시 명령어 실행 결과 인터페이스
 *
 * 명령어의 출력 텍스트와 함께 부가 효과(side effect)를 전달합니다.
 * 각 플래그는 상위 컴포넌트(App, AgentLoop)가 처리합니다.
 */
export interface CommandResult {
  /** 사용자에게 표시할 텍스트 출력 */
  readonly output: string;
  /** 명령어 성공 여부 */
  readonly success: boolean;
  /** true면 대화 내역 초기화 (/clear에서 사용) */
  readonly shouldClear?: boolean;
  /** true면 애플리케이션 종료 */
  readonly shouldExit?: boolean;
  /** 변경된 모델명 (/model, /config에서 사용) */
  readonly newModel?: string;
  /** 프로바이더 전환 — model + baseURL + apiKey 세트 변경 (/model에서 Local↔Cloud 전환) */
  readonly newProvider?: {
    readonly model: string;
    readonly baseURL: string;
    readonly apiKey: string;
  };
  /** true면 프로젝트 설정(DBCODE.md 등)을 디스크에서 다시 로드 */
  readonly refreshInstructions?: boolean;
  /** true면 출력을 사용자 메시지로 LLM에 주입 (/commit, /review 등에서 사용) */
  readonly shouldInjectAsUserMessage?: boolean;
  /** 주입된 메시지 처리 시 사용할 모델 오버라이드 */
  readonly modelOverride?: string;
  /** 설정되면 텍스트 대신 대화형 선택 목록 표시 (/model, /resume에서 사용) */
  readonly interactiveSelect?: InteractiveSelect;
  /** 변경된 권한 모드 (/plan에서 사용) */
  readonly newPermissionMode?: string;
  /** 변경된 톤 설정 (/tone에서 사용) */
  readonly newTone?: string;
  /** 변경된 로케일 설정 */
  readonly newLocale?: string;
  /** 음성 입력 토글 (true=활성화, false=비활성화, /voice에서 사용) */
  readonly voiceEnabled?: boolean;
  /** true면 수동 컨텍스트 압축(compaction) 트리거 (/compact에서 사용) */
  readonly shouldCompact?: boolean;
  /** 압축 시 집중할 토픽 (/compact [topic]에서 사용) */
  readonly compactFocusTopic?: string;
}

/**
 * 슬래시 명령어 정의 인터페이스
 *
 * 각 명령어 파일(agents.ts, commit.ts 등)에서 이 인터페이스를 구현한
 * 객체를 export하여 CommandRegistry에 등록합니다.
 */
export interface SlashCommand {
  /** 명령어 이름 ("/" 접두사 제외, 예: "commit", "model") */
  readonly name: string;
  /** /help와 자동 완성에 표시되는 짧은 설명 */
  readonly description: string;
  /** 사용법 구문 (예: "/compact [focus]") */
  readonly usage: string;
  /** 명령어 실행 함수 — args는 명령어 이름 뒤의 인자 문자열 */
  readonly execute: (args: string, context: CommandContext) => Promise<CommandResult>;
}

/**
 * 슬래시 명령어 레지스트리 클래스 — 명령어의 등록, 조회, 실행을 관리
 *
 * Map 자료구조를 사용하여 명령어 이름을 키로 빠르게 조회합니다.
 * 앱 초기화 시 모든 명령어를 register()로 등록한 후,
 * 사용자 입력이 들어오면 execute()로 실행합니다.
 */
export class CommandRegistry {
  /** 명령어 이름 → SlashCommand 객체를 매핑하는 내부 저장소 */
  private readonly commands = new Map<string, SlashCommand>();

  /**
   * 슬래시 명령어를 레지스트리에 등록하는 메서드
   *
   * 같은 이름의 명령어가 이미 등록되어 있으면 CommandError를 throw합니다.
   *
   * @param command - 등록할 슬래시 명령어 객체
   * @throws CommandError - 이름 중복 시
   */
  register(command: SlashCommand): void {
    if (this.commands.has(command.name)) {
      throw new CommandError(`Command already registered: /${command.name}`, {
        name: command.name,
      });
    }
    this.commands.set(command.name, command);
  }

  /**
   * 이름으로 명령어를 조회하는 메서드
   *
   * @param name - 명령어 이름 ("/" 접두사 제외)
   * @returns 명령어 객체 (없으면 undefined)
   */
  get(name: string): SlashCommand | undefined {
    return this.commands.get(name);
  }

  /**
   * 명령어 존재 여부를 확인하는 메서드
   *
   * @param name - 확인할 명령어 이름
   * @returns 존재하면 true
   */
  has(name: string): boolean {
    return this.commands.has(name);
  }

  /** 등록된 모든 명령어를 배열로 반환하는 메서드 */
  getAll(): readonly SlashCommand[] {
    return [...this.commands.values()];
  }

  /**
   * 접두사에 매칭되는 명령어를 반환하는 메서드 (자동 완성용)
   *
   * 사용자가 "/co"를 입력하면 "commit", "compact", "config", "context", "copy", "cost"를 반환합니다.
   *
   * @param prefix - 검색할 접두사 (소문자로 비교)
   * @returns 매칭되는 명령어 배열
   */
  getCompletions(prefix: string): readonly SlashCommand[] {
    const lower = prefix.toLowerCase();
    return [...this.commands.values()].filter((cmd) => cmd.name.startsWith(lower));
  }

  /**
   * 사용자 입력을 파싱하여 슬래시 명령어를 실행하는 메서드
   *
   * 입력이 "/"로 시작하지 않으면 null을 반환합니다.
   * 명령어 이름과 인자를 분리하여 해당 명령어의 execute()를 호출합니다.
   * 실행 중 에러가 발생하면 에러 메시지를 CommandResult로 래핑하여 반환합니다.
   *
   * @param input - 사용자 입력 문자열 (예: "/model gpt-4o")
   * @param context - 명령어 실행 컨텍스트
   * @returns 실행 결과 (슬래시 명령어가 아니면 null)
   */
  async execute(input: string, context: CommandContext): Promise<CommandResult | null> {
    const trimmed = input.trim();
    if (!trimmed.startsWith("/")) return null;

    const [commandName, ...argParts] = trimmed.slice(1).split(/\s+/);
    const args = argParts.join(" ");

    const command = this.commands.get(commandName);
    if (!command) {
      return {
        output: `Unknown command: /${commandName}. Type /help for available commands.`,
        success: false,
      };
    }

    try {
      return await command.execute(args, context);
    } catch (error) {
      return {
        output: `Command error: ${error instanceof Error ? error.message : String(error)}`,
        success: false,
      };
    }
  }

  /**
   * 입력 문자열이 슬래시 명령어인지 확인하는 메서드
   *
   * "/"로 시작하는 입력을 슬래시 명령어로 판단합니다.
   *
   * @param input - 확인할 입력 문자열
   * @returns 슬래시 명령어이면 true
   */
  isCommand(input: string): boolean {
    return input.trim().startsWith("/");
  }
}

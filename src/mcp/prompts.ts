/**
 * MCP 프롬프트 매니저 — MCP 서버의 프롬프트를 발견, 실행, 관리하는 모듈
 *
 * MCP 프롬프트는 서버가 제공하는 재사용 가능한 프롬프트 템플릿입니다.
 * 사용자가 슬래시 명령(/)으로 프롬프트를 실행하면,
 * 서버에서 인자가 치환된 메시지를 받아 대화에 주입합니다.
 *
 * 프롬프트 네임스페이싱:
 * - 여러 서버가 같은 이름의 프롬프트를 가질 수 있으므로
 * - "mcp__서버이름__프롬프트이름" 형태로 네임스페이싱하여 충돌을 방지합니다.
 *
 * 슬래시 명령 예시:
 * - /mcp__github__create_pr description="Fix bug"
 * - /mcp__db__query sql="SELECT * FROM users"
 */
import { BaseError } from "../utils/error.js";
import { type MCPPrompt, type MCPPromptArgument } from "./types.js";

/**
 * MCP 프롬프트 에러 클래스
 */
export class MCPPromptError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "MCP_PROMPT_ERROR", context);
  }
}

/**
 * prompts/get 응답으로 반환되는 프롬프트 메시지
 *
 * LLM 대화에 주입할 메시지를 나타냅니다.
 * role은 "user" 또는 "assistant"이며,
 * content는 텍스트 형태의 콘텐츠입니다.
 */
export interface MCPPromptMessage {
  /** 메시지 역할: "user"(사용자) 또는 "assistant"(어시스턴트) */
  readonly role: "user" | "assistant";
  /** 메시지 콘텐츠 */
  readonly content: {
    readonly type: "text";
    readonly text: string;
  };
}

/**
 * 해석된 프롬프트 — 서버에서 인자가 치환된 최종 프롬프트
 */
export interface ResolvedPrompt {
  /** 프롬프트를 제공한 서버 이름 */
  readonly serverName: string;
  /** 프롬프트 이름 */
  readonly promptName: string;
  /** 프롬프트 설명 */
  readonly description?: string;
  /** 서버에서 반환한 메시지 배열 */
  readonly messages: readonly MCPPromptMessage[];
}

/**
 * 프롬프트 기능을 지원하는 클라이언트 인터페이스
 *
 * MCPClient의 일부 기능만 필요하므로 별도 인터페이스로 분리합니다.
 * 이를 통해 테스트 시 목(mock) 객체를 쉽게 만들 수 있습니다.
 */
export interface PromptCapableClient {
  /** 사용 가능한 프롬프트 목록을 조회 */
  listPrompts(): Promise<readonly MCPPrompt[]>;
  /**
   * 프롬프트를 실행하여 인자가 치환된 메시지를 반환
   *
   * @param name - 프롬프트 이름
   * @param args - 치환할 인자들
   */
  getPrompt(
    name: string,
    args: Record<string, string>,
  ): Promise<{
    readonly messages: readonly MCPPromptMessage[];
  }>;
}

/**
 * 서버 출처 정보가 포함된 저장된 프롬프트
 */
interface StoredPrompt {
  /** 프롬프트를 제공한 서버 이름 */
  readonly serverName: string;
  /** 프롬프트 정의 */
  readonly prompt: MCPPrompt;
}

/**
 * MCP 프롬프트 매니저 — MCP 프롬프트의 발견, 해석, 실행을 담당합니다.
 *
 * 프롬프트는 "mcp__서버이름__프롬프트이름" 형태로 네임스페이싱되어
 * 여러 서버의 프롬프트가 충돌하지 않습니다.
 */
export class MCPPromptManager {
  /** 네임스페이싱된 프롬프트 맵 */
  private readonly prompts = new Map<string, StoredPrompt>();

  /**
   * 연결된 MCP 클라이언트에서 프롬프트를 발견하고 저장합니다.
   *
   * 각 프롬프트는 "mcp__서버이름__프롬프트이름" 키로 저장됩니다.
   *
   * @param client - 프롬프트를 조회할 클라이언트
   * @param serverName - 서버 이름 (네임스페이싱용)
   * @returns 발견된 프롬프트 배열
   * @throws MCPPromptError 프롬프트 조회 실패 시
   */
  async discoverPrompts(
    client: PromptCapableClient,
    serverName: string,
  ): Promise<readonly MCPPrompt[]> {
    try {
      const discovered = await client.listPrompts();

      for (const prompt of discovered) {
        // 네임스페이싱: mcp__서버이름__프롬프트이름
        const namespacedName = `mcp__${serverName}__${prompt.name}`;
        this.prompts.set(namespacedName, {
          serverName,
          prompt,
        });
      }

      return discovered;
    } catch (error) {
      throw new MCPPromptError("Failed to discover prompts", {
        serverName,
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * 발견된 모든 프롬프트를 반환합니다.
   *
   * @returns 네임스페이싱된 프롬프트 맵
   */
  getAllPrompts(): ReadonlyMap<string, StoredPrompt> {
    return this.prompts;
  }

  /**
   * 네임스페이싱된 이름으로 프롬프트를 조회합니다.
   *
   * @param namespacedName - "mcp__서버이름__프롬프트이름" 형태의 키
   * @returns 프롬프트 정보 또는 undefined
   */
  getPrompt(namespacedName: string): StoredPrompt | undefined {
    return this.prompts.get(namespacedName);
  }

  /**
   * 커맨드라인 문자열에서 인자를 파싱합니다.
   *
   * 지원하는 형식:
   * - key=value (따옴표 없이)
   * - key="quoted value" (큰따옴표)
   * - key='single quoted' (작은따옴표)
   *
   * key=value 형식이 없고 단일 위치 인자만 있는 경우,
   * 첫 번째 인자 정의의 이름에 할당합니다.
   *
   * @example
   * parsePromptArgs('name="John" age=30')
   * // → { name: "John", age: "30" }
   *
   * parsePromptArgs('Hello World', [{name: 'query', required: true}])
   * // → { query: "Hello World" }
   *
   * @param argsString - 파싱할 인자 문자열
   * @param promptArgs - 프롬프트 인자 정의 (위치 인자 할당용)
   * @returns 파싱된 인자 객체
   */
  parsePromptArgs(
    argsString: string,
    promptArgs?: readonly MCPPromptArgument[],
  ): Record<string, string> {
    const trimmed = argsString.trim();
    if (trimmed.length === 0) {
      return {};
    }

    const result: Record<string, string> = {};

    // key=value 패턴 매칭 (큰따옴표, 작은따옴표, 따옴표 없음)
    const pattern = /(\w+)=(?:"([^"]*?)"|'([^']*?)'|(\S+))/g;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(trimmed)) !== null) {
      const key = match[1];
      // 값은 세 캡처 그룹 중 하나: 큰따옴표, 작은따옴표, 따옴표 없음
      const value = match[2] ?? match[3] ?? match[4] ?? "";
      result[key] = value;
    }

    // key=value 패턴이 없고 위치 인자만 있으면 첫 번째 인자 정의에 할당
    if (
      Object.keys(result).length === 0 &&
      trimmed.length > 0 &&
      promptArgs &&
      promptArgs.length > 0
    ) {
      result[promptArgs[0].name] = trimmed;
    }

    return result;
  }

  /**
   * 필수 인자가 모두 제공되었는지 검증합니다.
   *
   * required=true인 인자 중 값이 없거나 빈 문자열인 것을 찾습니다.
   *
   * @param args - 제공된 인자 객체
   * @param promptDef - 프롬프트 정의 (인자 스펙 포함)
   * @returns 검증 결과 (valid: 통과 여부, missing: 누락된 인자 이름 목록)
   */
  validateArgs(
    args: Record<string, string>,
    promptDef: MCPPrompt,
  ): { readonly valid: boolean; readonly missing: readonly string[] } {
    const requiredArgs = (promptDef.arguments ?? []).filter((arg) => arg.required === true);
    const missing = requiredArgs
      .filter((arg) => !(arg.name in args) || args[arg.name].length === 0)
      .map((arg) => arg.name);

    return {
      valid: missing.length === 0,
      missing,
    };
  }

  /**
   * 프롬프트를 실행합니다 — 인자를 치환하여 서버에서 메시지를 받아옵니다.
   *
   * @param client - 프롬프트를 실행할 클라이언트
   * @param promptName - 프롬프트 이름 (서버 측 이름, 네임스페이싱 전)
   * @param args - 치환할 인자들
   * @returns 서버에서 반환한 메시지 배열
   * @throws MCPPromptError 실행 실패 시
   */
  async executePrompt(
    client: PromptCapableClient,
    promptName: string,
    args: Record<string, string>,
  ): Promise<readonly MCPPromptMessage[]> {
    try {
      const response = await client.getPrompt(promptName, args);
      return response.messages;
    } catch (error) {
      throw new MCPPromptError(`Failed to execute prompt: ${promptName}`, {
        promptName,
        args,
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * 발견된 모든 프롬프트에 대해 슬래시 명령을 생성합니다.
   *
   * 각 프롬프트는 "/mcp__서버이름__프롬프트이름" 형태의 슬래시 명령이 됩니다.
   * 프롬프트 실행 결과는 shouldInjectAsUserMessage=true로 표시되어
   * 사용자 메시지로 대화에 주입됩니다.
   *
   * @param getClient - 서버 이름으로 클라이언트를 조회하는 함수
   * @returns 생성된 슬래시 명령 배열
   */
  generateSlashCommands(
    getClient: (serverName: string) => PromptCapableClient | undefined,
  ): readonly {
    readonly name: string;
    readonly description: string;
    readonly usage: string;
    readonly execute: (args: string) => Promise<{
      readonly output: string;
      readonly success: boolean;
      readonly shouldInjectAsUserMessage?: boolean;
    }>;
  }[] {
    const commands: {
      readonly name: string;
      readonly description: string;
      readonly usage: string;
      readonly execute: (args: string) => Promise<{
        readonly output: string;
        readonly success: boolean;
        readonly shouldInjectAsUserMessage?: boolean;
      }>;
    }[] = [];

    for (const [namespacedName, stored] of this.prompts) {
      const { serverName, prompt } = stored;
      // 인자 힌트 문자열 생성: 필수=<name>, 선택=[name]
      const argHints = (prompt.arguments ?? [])
        .map((a) => (a.required ? `<${a.name}>` : `[${a.name}]`))
        .join(" ");

      commands.push({
        name: namespacedName,
        description: `[MCP: ${serverName}] ${prompt.description ?? prompt.name}`,
        usage: `/${namespacedName}${argHints.length > 0 ? ` ${argHints}` : ""}`,
        /**
         * 슬래시 명령 실행 함수
         *
         * @param argsString - 사용자가 입력한 인자 문자열
         * @returns 실행 결과 (출력, 성공 여부, 사용자 메시지 주입 여부)
         */
        execute: async (argsString: string) => {
          // 서버 연결 확인
          const client = getClient(serverName);
          if (!client) {
            return {
              output: `MCP server '${serverName}' is not connected.`,
              success: false,
            };
          }

          // 인자 파싱 및 검증
          const parsedArgs = this.parsePromptArgs(argsString, prompt.arguments);
          const validation = this.validateArgs(parsedArgs, prompt);

          if (!validation.valid) {
            return {
              output: `Missing required arguments: ${validation.missing.join(", ")}`,
              success: false,
            };
          }

          // 프롬프트 실행
          try {
            const messages = await this.executePrompt(client, prompt.name, parsedArgs);
            // 메시지의 텍스트 콘텐츠를 합침
            const textContent = messages
              .map((m) => m.content.text)
              .filter(Boolean)
              .join("\n\n");

            return {
              output: textContent || "(empty prompt response)",
              success: true,
              // 결과를 사용자 메시지로 대화에 주입
              shouldInjectAsUserMessage: true,
            };
          } catch (error) {
            return {
              output:
                error instanceof MCPPromptError
                  ? error.message
                  : `Prompt execution failed: ${error instanceof Error ? error.message : String(error)}`,
              success: false,
            };
          }
        },
      });
    }

    return commands;
  }

  /**
   * 발견된 모든 프롬프트를 제거합니다.
   */
  clear(): void {
    this.prompts.clear();
  }
}

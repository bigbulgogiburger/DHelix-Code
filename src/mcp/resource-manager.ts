/**
 * MCP Resource/Prompt Template Integration 매니저
 *
 * MCP 서버의 리소스와 프롬프트를 통합 관리하는 고수준 모듈입니다.
 *
 * 주요 기능:
 * 1. 리소스 목록 조회 및 개별 리소스 읽기
 * 2. RFC 6570 URI 템플릿 확장
 * 3. 리소스 변경 구독(Subscribe)
 * 4. 프롬프트 목록 조회 및 실행
 *
 * RFC 6570 URI 템플릿 예시:
 * - "file:///repo/{owner}/{repo}" + {owner:"me", repo:"code"} → "file:///repo/me/code"
 * - "search?q={query}&lang={lang}" + {query:"hello"} → "search?q=hello&lang="
 *
 * 이 모듈은 `src/mcp/client.ts`의 MCPClient에 의존합니다.
 * resources.ts 및 prompts.ts와 달리 템플릿 확장과 구독 기능을 추가로 제공합니다.
 */
import { BaseError } from "../utils/error.js";
import { type MCPClient } from "./client.js";
import { type MCPResource, type MCPPromptArgument } from "./types.js";

// ──────────────────────────────────────────────────────────────────────────────
// 에러 클래스
// ──────────────────────────────────────────────────────────────────────────────

/**
 * ResourceManager 에러 클래스
 */
export class ResourceManagerError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "RESOURCE_MANAGER_ERROR", context);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// 인터페이스 & 타입
// ──────────────────────────────────────────────────────────────────────────────

/**
 * RFC 6570 URI 템플릿 — 변수 플레이스홀더가 있는 URI 패턴
 *
 * @example
 * const template: ResourceTemplate = {
 *   uriTemplate: "file:///repo/{owner}/{repo}/blob/{ref}/{path}",
 *   name: "GitHub File",
 *   mimeType: "text/plain",
 * };
 */
export interface ResourceTemplate {
  /** RFC 6570 URI 템플릿 문자열 (예: "file:///data/{id}") */
  readonly uriTemplate: string;
  /** 사람이 읽기 쉬운 템플릿 이름 */
  readonly name: string;
  /** 템플릿 설명 (선택) */
  readonly description?: string;
  /** 리소스의 MIME 타입 (예: "text/plain") */
  readonly mimeType?: string;
}

/**
 * 프롬프트 인자 정의 — 프롬프트 호출 시 전달하는 파라미터
 */
export type { MCPPromptArgument as PromptArgument };

/**
 * 프롬프트 템플릿 정의
 */
export interface PromptTemplate {
  /** 프롬프트 이름 */
  readonly name: string;
  /** 프롬프트 설명 (선택) */
  readonly description?: string;
  /** 프롬프트 인자 정의 목록 (선택) */
  readonly arguments?: readonly MCPPromptArgument[];
}

/**
 * 리소스 콘텐츠 — 서버에서 읽어온 원시 데이터
 */
export interface ResourceContent {
  /** 리소스 URI */
  readonly uri: string;
  /** 텍스트 콘텐츠 (텍스트 리소스인 경우) */
  readonly text?: string;
  /** Base64 인코딩된 바이너리 데이터 (바이너리 리소스인 경우) */
  readonly blob?: string;
  /** MIME 타입 */
  readonly mimeType?: string;
}

/**
 * 프롬프트 메시지 — LLM에 주입할 메시지 항목
 */
export interface PromptMessage {
  /** 메시지 역할: "user" 또는 "assistant" */
  readonly role: "user" | "assistant";
  /** 메시지 콘텐츠 */
  readonly content: {
    readonly type: "text";
    readonly text: string;
  };
}

/**
 * 프롬프트 실행 결과
 */
export interface PromptResult {
  /** 프롬프트 설명 (선택) */
  readonly description?: string;
  /** 서버에서 반환한 메시지 배열 */
  readonly messages: readonly PromptMessage[];
}

/**
 * ResourceManager가 사용하는 MCP 클라이언트 인터페이스 (최소화)
 *
 * MCPClient의 전체 인터페이스가 아닌 필요한 메서드만 선언하여
 * 테스트 시 목(mock) 생성이 용이합니다.
 */
export interface ResourceCapableClient {
  /** 리소스 목록 조회 */
  listResources(): Promise<readonly MCPResource[]>;
  /** 리소스 읽기 */
  readResource(uri: string): Promise<string>;
}

/**
 * 프롬프트 기능을 지원하는 클라이언트 인터페이스
 */
export interface PromptCapableClient {
  /** 프롬프트 목록 조회 */
  listPrompts(): Promise<
    readonly {
      readonly name: string;
      readonly description?: string;
      readonly arguments?: readonly MCPPromptArgument[];
    }[]
  >;
  /** 프롬프트 실행 */
  getPrompt(
    name: string,
    args: Record<string, string>,
  ): Promise<{
    readonly description?: string;
    readonly messages: readonly PromptMessage[];
  }>;
}

// ──────────────────────────────────────────────────────────────────────────────
// 상수
// ──────────────────────────────────────────────────────────────────────────────

/** URI 템플릿 변수 패턴 — RFC 6570 Level 1: {varName} */
const URI_TEMPLATE_VAR_PATTERN = /\{([^}]+)\}/g;

// ──────────────────────────────────────────────────────────────────────────────
// ResourceManager 클래스
// ──────────────────────────────────────────────────────────────────────────────

/**
 * MCP 리소스와 프롬프트 템플릿을 통합 관리하는 클래스
 *
 * 서버별로 클라이언트를 등록하고, 리소스 조회/읽기/구독 및
 * 프롬프트 조회/실행을 담당합니다.
 *
 * @example
 * const manager = new ResourceManager();
 * manager.registerClient("my-server", mcpClient);
 *
 * const resources = await manager.listResources("my-server");
 * const content = await manager.readResource("my-server", "file:///data.txt");
 *
 * const prompts = await manager.listPrompts("my-server");
 * const result = await manager.getPrompt("my-server", "summarize", { text: "hello" });
 */
export class ResourceManager {
  /** 서버 이름 → MCPClient (또는 최소 인터페이스 구현체) 맵 */
  private readonly clients = new Map<
    string,
    MCPClient | ResourceCapableClient | PromptCapableClient
  >();

  /** 리소스 변경 구독자 맵: "serverId::uri" → callback 배열 */
  private readonly subscriptions = new Map<string, Set<(uri: string) => void>>();

  // ────────────────────────────────────────────────────────────────────────────
  // 클라이언트 등록
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * 서버 클라이언트를 등록합니다.
   *
   * @param serverId - 서버 식별자
   * @param client - MCPClient 또는 호환 인터페이스 구현체
   */
  registerClient(
    serverId: string,
    client: MCPClient | ResourceCapableClient | PromptCapableClient,
  ): void {
    this.clients.set(serverId, client);
  }

  /**
   * 서버 클라이언트를 제거합니다.
   * 해당 서버의 모든 구독도 함께 정리됩니다.
   *
   * @param serverId - 제거할 서버 식별자
   */
  unregisterClient(serverId: string): void {
    this.clients.delete(serverId);

    // 해당 서버의 구독 모두 정리
    for (const key of this.subscriptions.keys()) {
      if (key.startsWith(`${serverId}::`)) {
        this.subscriptions.delete(key);
      }
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 리소스 기능
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * 서버의 사용 가능한 리소스 목록을 조회합니다.
   *
   * @param serverId - 서버 식별자
   * @returns 리소스 정의 배열
   * @throws ResourceManagerError 서버를 찾을 수 없거나 조회 실패 시
   */
  async listResources(serverId: string): Promise<readonly MCPResource[]> {
    const client = this.getResourceClient(serverId);
    try {
      return await client.listResources();
    } catch (error) {
      throw new ResourceManagerError(`Failed to list resources from server "${serverId}"`, {
        serverId,
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * 서버에서 특정 URI의 리소스를 읽습니다.
   *
   * @param serverId - 서버 식별자
   * @param uri - 읽을 리소스 URI
   * @returns 리소스 콘텐츠
   * @throws ResourceManagerError 서버를 찾을 수 없거나 읽기 실패 시
   */
  async readResource(serverId: string, uri: string): Promise<ResourceContent> {
    const client = this.getResourceClient(serverId);
    try {
      const text = await client.readResource(uri);
      return { uri, text };
    } catch (error) {
      throw new ResourceManagerError(`Failed to read resource "${uri}" from server "${serverId}"`, {
        serverId,
        uri,
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * 서버의 리소스 템플릿 목록을 조회합니다.
   *
   * MCP 서버가 "resources/templates/list" 메서드를 지원하는 경우 사용합니다.
   * 지원하지 않으면 빈 배열을 반환합니다.
   *
   * @param serverId - 서버 식별자
   * @returns 리소스 템플릿 배열
   */
  async listResourceTemplates(serverId: string): Promise<readonly ResourceTemplate[]> {
    const rawClient = this.clients.get(serverId);
    if (!rawClient) {
      throw new ResourceManagerError(`Server "${serverId}" is not registered`, { serverId });
    }

    // MCPClient에서 직접 JSON-RPC 호출을 지원하는 경우에만 사용
    // 타입 안전하게 sendRequest 메서드 존재 여부 확인
    const clientWithRequest = rawClient as {
      sendRequest?: (method: string, params: Record<string, unknown>) => Promise<unknown>;
    };

    if (typeof clientWithRequest.sendRequest !== "function") {
      return [];
    }

    try {
      const result = (await clientWithRequest.sendRequest("resources/templates/list", {})) as {
        resourceTemplates?: ResourceTemplate[];
      };
      return result.resourceTemplates ?? [];
    } catch {
      return [];
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // URI 템플릿 확장
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * RFC 6570 Level 1 URI 템플릿을 변수로 확장합니다.
   *
   * Level 1은 단순 문자열 치환을 지원합니다: {varName}
   * 값이 없는 변수는 빈 문자열로 치환됩니다.
   *
   * @example
   * expandTemplate("file:///repo/{owner}/{repo}", { owner: "me", repo: "code" })
   * // → "file:///repo/me/code"
   *
   * expandTemplate("search?q={query}", { query: "hello world" })
   * // → "search?q=hello%20world"
   *
   * @param template - RFC 6570 URI 템플릿
   * @param variables - 치환할 변수 맵
   * @returns 확장된 URI 문자열
   */
  expandTemplate(template: ResourceTemplate | string, variables: Record<string, string>): string {
    const uriTemplate = typeof template === "string" ? template : template.uriTemplate;

    return uriTemplate.replace(URI_TEMPLATE_VAR_PATTERN, (_, varName: string) => {
      const value = variables[varName.trim()];
      if (value === undefined || value === null) {
        return "";
      }
      // RFC 6570 Level 1: 예약 문자를 퍼센트 인코딩
      return encodeURIComponent(value);
    });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 프롬프트 기능
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * 서버의 사용 가능한 프롬프트 목록을 조회합니다.
   *
   * @param serverId - 서버 식별자
   * @returns 프롬프트 템플릿 배열
   * @throws ResourceManagerError 서버를 찾을 수 없거나 조회 실패 시
   */
  async listPrompts(serverId: string): Promise<readonly PromptTemplate[]> {
    const client = this.getPromptClient(serverId);
    try {
      const prompts = await client.listPrompts();
      return prompts.map((p) => ({
        name: p.name,
        description: p.description,
        arguments: p.arguments,
      }));
    } catch (error) {
      throw new ResourceManagerError(`Failed to list prompts from server "${serverId}"`, {
        serverId,
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * 서버에서 특정 프롬프트를 실행합니다.
   *
   * @param serverId - 서버 식별자
   * @param name - 프롬프트 이름
   * @param args - 프롬프트 인자 (key=value)
   * @returns 프롬프트 실행 결과 (메시지 배열)
   * @throws ResourceManagerError 서버를 찾을 수 없거나 실행 실패 시
   */
  async getPrompt(
    serverId: string,
    name: string,
    args: Record<string, string> = {},
  ): Promise<PromptResult> {
    const client = this.getPromptClient(serverId);
    try {
      const response = await client.getPrompt(name, args);
      return {
        description: response.description,
        messages: response.messages,
      };
    } catch (error) {
      throw new ResourceManagerError(`Failed to get prompt "${name}" from server "${serverId}"`, {
        serverId,
        name,
        args,
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 리소스 변경 구독
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * 특정 리소스의 변경 사항을 구독합니다.
   *
   * 서버가 "resources/subscribe"를 지원하면 실시간 알림을 받을 수 있습니다.
   * 이 구현에서는 콜백을 로컬로 등록하며,
   * 서버 알림은 notifyResourceChanged()로 트리거합니다.
   *
   * @param serverId - 서버 식별자
   * @param uri - 구독할 리소스 URI
   * @param callback - 리소스 변경 시 호출할 콜백 (uri를 인자로 받음)
   * @returns 구독 해제 함수 (호출하면 구독 취소)
   *
   * @example
   * const unsubscribe = manager.subscribeToChanges("server", "file:///data.txt", (uri) => {
   *   console.log(`${uri} changed!`);
   * });
   * // 나중에 구독 해제:
   * unsubscribe();
   */
  subscribeToChanges(serverId: string, uri: string, callback: (uri: string) => void): () => void {
    const key = this.buildSubscriptionKey(serverId, uri);

    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(key, new Set());
    }

    const subscribers = this.subscriptions.get(key)!;
    subscribers.add(callback);

    // 구독 해제 함수 반환
    return () => {
      subscribers.delete(callback);
      if (subscribers.size === 0) {
        this.subscriptions.delete(key);
      }
    };
  }

  /**
   * 리소스 변경 알림을 발송합니다.
   *
   * 서버에서 "notifications/resources/updated" 알림을 받았을 때 호출하거나,
   * 테스트 시 변경 이벤트를 시뮬레이션할 때 사용합니다.
   *
   * @param serverId - 서버 식별자
   * @param uri - 변경된 리소스 URI
   */
  notifyResourceChanged(serverId: string, uri: string): void {
    const key = this.buildSubscriptionKey(serverId, uri);
    const subscribers = this.subscriptions.get(key);

    if (!subscribers) return;

    for (const callback of subscribers) {
      try {
        callback(uri);
      } catch {
        // 개별 구독자 에러가 다른 구독자를 차단하지 않도록
      }
    }
  }

  /**
   * 특정 서버의 모든 구독 수를 반환합니다 (테스트/진단용).
   *
   * @param serverId - 서버 식별자
   * @returns 해당 서버의 활성 구독 키 수
   */
  getSubscriptionCount(serverId: string): number {
    let count = 0;
    for (const key of this.subscriptions.keys()) {
      if (key.startsWith(`${serverId}::`)) {
        count += 1;
      }
    }
    return count;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 내부 헬퍼
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * 리소스 기능 클라이언트를 조회합니다.
   *
   * @param serverId - 서버 식별자
   * @returns ResourceCapableClient 인터페이스 구현체
   * @throws ResourceManagerError 서버가 등록되지 않은 경우
   */
  private getResourceClient(serverId: string): ResourceCapableClient {
    const client = this.clients.get(serverId);
    if (!client) {
      throw new ResourceManagerError(`Server "${serverId}" is not registered`, { serverId });
    }
    return client as ResourceCapableClient;
  }

  /**
   * 프롬프트 기능 클라이언트를 조회합니다.
   *
   * @param serverId - 서버 식별자
   * @returns PromptCapableClient 인터페이스 구현체
   * @throws ResourceManagerError 서버가 등록되지 않은 경우
   */
  private getPromptClient(serverId: string): PromptCapableClient {
    const client = this.clients.get(serverId);
    if (!client) {
      throw new ResourceManagerError(`Server "${serverId}" is not registered`, { serverId });
    }
    return client as PromptCapableClient;
  }

  /**
   * 구독 맵 키를 생성합니다.
   *
   * @param serverId - 서버 식별자
   * @param uri - 리소스 URI
   * @returns "serverId::uri" 형태의 복합 키
   */
  private buildSubscriptionKey(serverId: string, uri: string): string {
    return `${serverId}::${uri}`;
  }
}

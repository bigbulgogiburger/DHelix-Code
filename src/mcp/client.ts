/**
 * MCP 클라이언트 — 외부 MCP 서버와 JSON-RPC 2.0으로 통신하는 핵심 모듈
 *
 * 이 모듈은 MCP(Model Context Protocol) 클라이언트를 구현합니다.
 * MCP 클라이언트는 외부 MCP 서버에 연결하여 도구(Tool)를 검색하고 실행하며,
 * 리소스(Resource)를 읽을 수 있게 해줍니다.
 *
 * JSON-RPC 2.0 프로토콜을 사용하여 요청/응답을 주고받으며,
 * 트랜스포트 계층(stdio, http, sse)을 플러그인 방식으로 교체할 수 있습니다.
 *
 * 연결 흐름:
 * 1. createTransport()로 적절한 트랜스포트 생성
 * 2. transport.connect()로 물리적 연결
 * 3. "initialize" 요청으로 핸드셰이크(양측 기능 교환)
 * 4. "notifications/initialized" 알림으로 초기화 완료 통지
 */
import { randomUUID } from "node:crypto";
import { BaseError } from "../utils/error.js";
import {
  type MCPServerConfig,
  type MCPServerCapabilities,
  type MCPToolDefinition,
  type MCPResource,
  type MCPToolCallResult,
  type MCPConnectionState,
  type JsonRpcResponse,
  type JsonRpcError,
  type JsonRpcNotification,
  type JsonRpcMessage,
} from "./types.js";
import { type MCPTransportLayer, createTransport } from "./transports/base.js";

/**
 * MCP 클라이언트 에러 클래스
 *
 * MCP 클라이언트에서 발생하는 모든 에러를 나타냅니다.
 * 에러 코드 "MCP_CLIENT_ERROR"로 식별됩니다.
 */
export class MCPClientError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "MCP_CLIENT_ERROR", context);
  }
}

/** MCP 요청 기본 타임아웃 (30초) — 서버 응답을 30초 이상 기다리지 않음 */
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

/**
 * 대기 중인 요청 추적기
 *
 * 비동기 요청/응답 매칭을 위해 사용됩니다.
 * JSON-RPC에서는 요청의 id로 응답을 매칭하는데,
 * 이 인터페이스가 각 요청의 Promise와 타임아웃을 관리합니다.
 */
interface PendingRequest {
  /** 성공 시 호출할 resolve 콜백 */
  readonly resolve: (result: unknown) => void;
  /** 실패 시 호출할 reject 콜백 */
  readonly reject: (error: Error) => void;
  /** 타임아웃 타이머 — 일정 시간 내 응답이 없으면 자동 reject */
  readonly timer: ReturnType<typeof setTimeout>;
}

/**
 * MCP 클라이언트 — 플러그인 방식의 트랜스포트를 통해 MCP 서버와 통신합니다.
 *
 * 주요 기능:
 * - JSON-RPC 2.0 프로토콜 처리 (요청/응답/알림)
 * - 연결 수명주기 관리 (connect/disconnect)
 * - 도구(Tool) 검색 및 실행
 * - 리소스(Resource) 목록 조회 및 읽기
 *
 * 사용 예시:
 * ```typescript
 * const client = new MCPClient({
 *   name: "my-server",
 *   transport: "stdio",
 *   command: "node",
 *   args: ["server.js"],
 * });
 * await client.connect();
 * const tools = await client.listTools();
 * ```
 */
export class MCPClient {
  /** 현재 사용 중인 트랜스포트 인스턴스 (연결 전에는 null) */
  private transport: MCPTransportLayer | null = null;
  /** 응답을 기다리는 요청들의 맵 (id → PendingRequest) */
  private readonly pendingRequests = new Map<string | number, PendingRequest>();
  /** 현재 연결 상태 */
  private state: MCPConnectionState = "disconnected";
  /** 서버가 제공하는 기능 정보 (connect 후에 사용 가능) */
  private capabilities: MCPServerCapabilities | null = null;
  /** 도구 목록 변경 시 호출할 콜백 함수 */
  private onToolsChanged: (() => void) | null = null;

  /**
   * @param config - MCP 서버 연결 설정 (이름, 트랜스포트 타입, 명령어/URL 등)
   */
  constructor(private readonly config: MCPServerConfig) {}

  /**
   * 현재 연결 상태를 반환합니다.
   *
   * @returns "disconnected" | "connecting" | "connected" | "error"
   */
  getState(): MCPConnectionState {
    return this.state;
  }

  /**
   * 서버의 기능(Capabilities) 정보를 반환합니다.
   * connect() 이후에만 사용 가능하며, 연결 전에는 null을 반환합니다.
   *
   * @returns 서버 기능 정보 또는 null
   */
  getCapabilities(): MCPServerCapabilities | null {
    return this.capabilities;
  }

  /**
   * 도구 목록 변경 알림 수신 시 호출할 콜백을 등록합니다.
   *
   * MCP 서버가 "notifications/tools/list_changed" 알림을 보내면
   * 이 콜백이 호출되어 도구 목록을 갱신할 수 있습니다.
   *
   * @param callback - 도구 목록 변경 시 호출할 함수
   */
  setToolsChangedCallback(callback: () => void): void {
    this.onToolsChanged = callback;
  }

  /**
   * MCP 서버에 연결합니다.
   *
   * 연결 과정:
   * 1. 설정에 맞는 트랜스포트(stdio/http/sse) 인스턴스 생성
   * 2. 트랜스포트 이벤트 핸들러 등록 (메시지 수신, 에러, 종료)
   * 3. 트랜스포트 연결
   * 4. "initialize" 핸드셰이크 — 프로토콜 버전과 기능 교환
   * 5. "notifications/initialized" 알림 전송 — 초기화 완료 통지
   *
   * @throws MCPClientError 연결 또는 초기화 실패 시
   */
  async connect(): Promise<void> {
    // 이미 연결된 상태면 아무 작업도 하지 않음
    if (this.state === "connected") return;

    this.state = "connecting";

    try {
      // 1단계: 설정에 맞는 트랜스포트 생성 (stdio/http/sse)
      this.transport = createTransport(this.config);

      // 2단계: 트랜스포트 이벤트 핸들러 등록 (연결 전에 등록해야 메시지를 놓치지 않음)
      this.transport.onMessage((message) => this.handleMessage(message));
      this.transport.onError((error) => {
        this.state = "error";
        // 트랜스포트 에러 발생 시 대기 중인 모든 요청을 reject
        this.rejectAllPending(
          new MCPClientError(`Transport error: ${error.message}`, {
            server: this.config.name,
          }),
        );
      });
      this.transport.onClose(() => {
        this.state = "disconnected";
        this.rejectAllPending(new MCPClientError("Transport closed"));
      });

      // 3단계: 물리적 연결 수립
      await this.transport.connect();

      // 4단계: initialize 핸드셰이크 — 클라이언트와 서버가 서로의 정보를 교환
      const initResult = (await this.sendRequest("initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "dhelix", version: "0.1.0" },
      })) as {
        capabilities?: MCPServerCapabilities;
        serverInfo?: { name: string; version: string };
      };

      // 서버의 기능 정보 저장
      this.capabilities = initResult.capabilities ?? null;

      // 5단계: initialized 알림 — 서버에 초기화 완료를 알림
      this.sendNotification("notifications/initialized", {});

      this.state = "connected";
    } catch (error) {
      this.state = "error";
      await this.cleanup();

      if (error instanceof MCPClientError) throw error;
      throw new MCPClientError("Failed to connect to MCP server", {
        server: this.config.name,
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * MCP 서버와의 연결을 끊습니다.
   *
   * 대기 중인 모든 요청을 reject하고 트랜스포트를 정리합니다.
   */
  async disconnect(): Promise<void> {
    if (this.state === "disconnected") return;

    this.rejectAllPending(new MCPClientError("Client disconnecting"));
    await this.cleanup();
    this.state = "disconnected";
  }

  /**
   * 서버에서 사용 가능한 도구 목록을 조회합니다.
   *
   * MCP의 "tools/list" 메서드를 호출하여 서버가 제공하는
   * 모든 도구의 이름, 설명, 입력 스키마를 가져옵니다.
   *
   * @returns 도구 정의 배열
   * @throws MCPClientError 연결되지 않은 상태에서 호출 시
   */
  async listTools(): Promise<readonly MCPToolDefinition[]> {
    this.ensureConnected();
    const result = (await this.sendRequest("tools/list", {})) as {
      tools: MCPToolDefinition[];
    };
    return result.tools ?? [];
  }

  /**
   * 서버의 도구를 호출(실행)합니다.
   *
   * MCP의 "tools/call" 메서드를 사용하여 지정된 도구를 실행하고
   * 결과를 반환합니다.
   *
   * @param name - 실행할 도구 이름
   * @param args - 도구에 전달할 인자(매개변수)
   * @returns 도구 실행 결과 (텍스트, 이미지 등의 콘텐츠)
   * @throws MCPClientError 연결되지 않은 상태에서 호출 시
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<MCPToolCallResult> {
    this.ensureConnected();
    const result = (await this.sendRequest("tools/call", {
      name,
      arguments: args,
    })) as MCPToolCallResult;
    return result;
  }

  /**
   * 서버에서 사용 가능한 리소스 목록을 조회합니다.
   *
   * @returns 리소스 정의 배열 (URI, 이름, 설명, MIME 타입 등)
   * @throws MCPClientError 연결되지 않은 상태에서 호출 시
   */
  async listResources(): Promise<readonly MCPResource[]> {
    this.ensureConnected();
    const result = (await this.sendRequest("resources/list", {})) as {
      resources: MCPResource[];
    };
    return result.resources ?? [];
  }

  /**
   * 지정된 URI의 리소스를 읽어 텍스트로 반환합니다.
   *
   * @param uri - 읽을 리소스의 URI (예: "file:///path/to/file")
   * @returns 리소스 내용 (텍스트 또는 Base64)
   * @throws MCPClientError 연결되지 않은 상태에서 호출 시
   */
  async readResource(uri: string): Promise<string> {
    this.ensureConnected();
    const result = (await this.sendRequest("resources/read", { uri })) as {
      contents: Array<{ text?: string; blob?: string }>;
    };
    const content = result.contents?.[0];
    return content?.text ?? content?.blob ?? "";
  }

  /**
   * JSON-RPC 요청을 전송하고 응답을 기다립니다.
   *
   * 내부적으로 Promise를 생성하고, 고유 id를 부여하여 요청을 추적합니다.
   * 타임아웃 내에 응답이 오지 않으면 자동으로 reject됩니다.
   *
   * @param method - 호출할 JSON-RPC 메서드 이름
   * @param params - 메서드에 전달할 매개변수
   * @returns 서버의 응답 결과
   */
  private sendRequest(method: string, params: Record<string, unknown>): Promise<unknown> {
    return new Promise<unknown>((resolve, reject) => {
      // UUID(범용 고유 식별자)로 요청 id 생성 — 응답과 매칭하는 데 사용
      const id = randomUUID();

      // 타임아웃 타이머 설정 — 30초 내에 응답이 없으면 reject
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new MCPClientError(`Request timed out: ${method}`, { id, method }));
      }, DEFAULT_REQUEST_TIMEOUT_MS);

      // 대기 요청 맵에 등록 (응답 수신 시 이 정보로 resolve/reject)
      this.pendingRequests.set(id, { resolve, reject, timer });

      try {
        // 트랜스포트를 통해 실제 요청 전송
        this.transport!.sendRequest(id, method, params);
      } catch (error) {
        // 전송 실패 시 정리 후 reject
        this.pendingRequests.delete(id);
        clearTimeout(timer);
        reject(
          error instanceof MCPClientError
            ? error
            : new MCPClientError(`Failed to send request: ${method}`, {
                cause: error instanceof Error ? error.message : String(error),
              }),
        );
      }
    });
  }

  /**
   * JSON-RPC 알림을 전송합니다. (응답을 기다리지 않음)
   *
   * @param method - 알림 메서드 이름
   * @param params - 알림에 포함할 매개변수
   */
  private sendNotification(method: string, params: Record<string, unknown>): void {
    this.transport!.sendNotification(method, params);
  }

  /**
   * 트랜스포트로부터 수신한 JSON-RPC 메시지를 처리합니다.
   *
   * 메시지 분류 로직:
   * 1. id가 없으면 → 알림(Notification)으로 처리
   * 2. id가 있으면 → 대기 중인 요청과 매칭하여 resolve/reject
   * 3. error 필드가 있으면 → 에러 응답으로 reject
   * 4. error 필드가 없으면 → 성공 응답으로 resolve
   *
   * @param message - 수신한 JSON-RPC 메시지
   */
  private handleMessage(message: JsonRpcMessage): void {
    // id가 없는 메시지는 알림(Notification)
    if (!("id" in message)) {
      this.handleNotification(message as JsonRpcNotification);
      return;
    }

    // id 추출 — null이거나 undefined이면 무시
    const msgId = (message as { id?: string | number | null }).id;
    if (msgId === null || msgId === undefined) return;

    // 이 id로 대기 중인 요청 찾기
    const pending = this.pendingRequests.get(msgId);
    if (!pending) return;

    // 매칭된 요청 정리 (타임아웃 해제, 맵에서 제거)
    this.pendingRequests.delete(msgId);
    clearTimeout(pending.timer);

    // 에러 응답인지 성공 응답인지 판별하여 처리
    if ("error" in message) {
      const errMsg = message as JsonRpcError;
      pending.reject(
        new MCPClientError(errMsg.error.message, {
          code: errMsg.error.code,
          data: errMsg.error.data,
        }),
      );
    } else {
      pending.resolve((message as JsonRpcResponse).result);
    }
  }

  /**
   * 서버에서 보낸 알림(Notification)을 처리합니다.
   *
   * 현재 처리하는 알림:
   * - "notifications/tools/list_changed": 서버의 도구 목록이 변경되었을 때
   *   → 등록된 콜백을 호출하여 도구 목록을 갱신
   *
   * @param notification - 수신한 알림 메시지
   */
  private handleNotification(notification: JsonRpcNotification): void {
    if (notification.method === "notifications/tools/list_changed") {
      this.onToolsChanged?.();
    }
  }

  /**
   * 대기 중인 모든 요청을 에러로 reject합니다.
   *
   * 연결 끊김이나 트랜스포트 에러 발생 시 호출됩니다.
   *
   * @param error - 모든 대기 요청에 전달할 에러 객체
   */
  private rejectAllPending(error: Error): void {
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(error);
      this.pendingRequests.delete(id);
    }
  }

  /**
   * 트랜스포트를 정리(해제)합니다.
   *
   * 트랜스포트의 disconnect를 호출하고 참조를 null로 설정합니다.
   */
  private async cleanup(): Promise<void> {
    if (this.transport) {
      await this.transport.disconnect();
      this.transport = null;
    }
  }

  /**
   * 클라이언트가 연결된 상태인지 확인합니다.
   * 연결되지 않은 상태에서 API를 호출하면 에러를 던집니다.
   *
   * @throws MCPClientError 연결되지 않은 상태일 때
   */
  private ensureConnected(): void {
    if (this.state !== "connected") {
      throw new MCPClientError("Not connected to MCP server", {
        server: this.config.name,
        state: this.state,
      });
    }
  }
}

/**
 * HTTP Streamable 트랜스포트 — HTTP POST를 통한 JSON-RPC 통신 모듈
 *
 * 네이티브 fetch() API를 사용하여 MCP 서버와 HTTP 기반으로 통신합니다.
 * ReadableStream을 통한 스트리밍 응답(SSE 형식)도 지원합니다.
 *
 * HTTP 트랜스포트의 특징:
 * - 상태가 없는(stateless) 프로토콜이지만, 세션 ID로 상태를 유지할 수 있음
 * - 각 요청은 독립적인 HTTP POST로 전송
 * - 응답은 JSON 또는 SSE 스트림으로 수신 가능
 * - Bearer 토큰을 통한 인증(OAuth) 지원
 * - 5xx 에러/네트워크 에러 시 지수 백오프로 자동 재시도
 *
 * 세션 관리:
 * - 서버가 "Mcp-Session-Id" 헤더를 반환하면 저장
 * - 이후 모든 요청에 해당 세션 ID를 포함하여 전송
 */
import { BaseError } from "../../utils/error.js";
import { type MCPServerConfig, type JsonRpcMessage } from "../types.js";
import { type MCPTransportLayer } from "./base.js";

/**
 * HTTP 트랜스포트 에러 클래스
 */
export class HttpTransportError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "HTTP_TRANSPORT_ERROR", context);
  }
}

/** HTTP 요청 기본 타임아웃 (30초) */
const DEFAULT_HTTP_TIMEOUT_MS = 30_000;

/**
 * 일시적 에러(5xx, 네트워크)에 대한 최대 재시도 횟수
 *
 * 4xx 에러(클라이언트 에러)는 재시도하지 않습니다.
 * 5xx 에러(서버 에러)와 네트워크 에러만 재시도합니다.
 */
const MAX_RETRIES = 3;

/**
 * 지수 백오프(exponential backoff)의 기본 딜레이 (ms)
 *
 * 재시도 딜레이: 1초 → 2초 → 4초
 */
const RETRY_BASE_DELAY_MS = 1_000;

/**
 * HTTP 트랜스포트 구현체
 *
 * fetch() API를 사용하여 JSON-RPC 메시지를 HTTP POST로 전송하고,
 * JSON 또는 SSE 형식의 응답을 처리합니다.
 */
export class HttpTransport implements MCPTransportLayer {
  /** 수신 메시지 핸들러 */
  private messageHandler: ((message: JsonRpcMessage) => void) | null = null;
  /** 에러 핸들러 */
  private errorHandler: ((error: Error) => void) | null = null;
  /** 연결 종료 핸들러 */
  private closeHandler: (() => void) | null = null;
  /** MCP 서버 URL */
  private readonly url: string;
  /** 서버가 발급한 세션 ID (상태 유지에 사용) */
  private sessionId: string | undefined;
  /** OAuth Bearer 토큰 (인증에 사용) */
  private authToken: string | undefined;

  /**
   * @param config - MCP 서버 설정 (url 필수)
   * @throws HttpTransportError url이 설정에 없을 때
   */
  constructor(private readonly config: MCPServerConfig) {
    if (!config.url) {
      throw new HttpTransportError("HTTP transport requires a url", {
        server: config.name,
      });
    }
    this.url = config.url;
  }

  /**
   * Bearer 인증 토큰을 설정합니다.
   *
   * OAuth 인증이 필요한 MCP 서버에서 사용합니다.
   * 설정된 토큰은 이후 모든 HTTP 요청의 Authorization 헤더에 포함됩니다.
   *
   * @param token - Bearer 토큰 문자열
   */
  setAuthToken(token: string): void {
    this.authToken = token;
  }

  /**
   * HTTP 요청에 포함할 헤더를 생성합니다.
   *
   * 기본 헤더에 세션 ID와 인증 토큰을 조건부로 추가합니다.
   *
   * @returns HTTP 헤더 객체
   */
  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      // JSON과 SSE 둘 다 수용 가능하다고 서버에 알림
      Accept: "application/json, text/event-stream",
    };
    // 세션 ID가 있으면 포함 (서버가 이전 요청과 연결할 수 있도록)
    if (this.sessionId) {
      headers["Mcp-Session-Id"] = this.sessionId;
    }
    // 인증 토큰이 있으면 Bearer 형식으로 포함
    if (this.authToken) {
      headers["Authorization"] = `Bearer ${this.authToken}`;
    }
    return headers;
  }

  /**
   * HTTP 응답 헤더에서 세션 ID를 추출하여 저장합니다.
   *
   * 서버가 "Mcp-Session-Id" 헤더를 반환하면 저장하여
   * 이후 요청에 포함합니다.
   *
   * @param response - HTTP 응답 객체
   */
  private extractSessionId(response: Response): void {
    const sid = response.headers.get("Mcp-Session-Id");
    if (sid) {
      this.sessionId = sid;
    }
  }

  /**
   * HTTP 트랜스포트 연결을 수립합니다.
   *
   * HTTP는 본래 상태가 없는(stateless) 프로토콜이므로,
   * 연결 수립은 "initialize" 요청을 보내 서버 도달 가능성을 확인하는 것입니다.
   *
   * 초기 연결에서:
   * 1. initialize 요청을 POST로 전송
   * 2. 응답에서 세션 ID 추출 및 저장
   * 3. 응답을 JSON 또는 SSE로 처리
   *
   * @throws HttpTransportError 서버 연결 실패 시
   */
  async connect(): Promise<void> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), DEFAULT_HTTP_TIMEOUT_MS);

      // initialize 요청으로 서버 도달 가능성 확인 및 핸드셰이크
      const response = await fetch(this.url, {
        method: "POST",
        headers: this.buildHeaders(),
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "connection-check",
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "dbcode", version: "0.1.0" },
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        throw new HttpTransportError(`HTTP ${response.status}: ${response.statusText}`, {
          server: this.config.name,
          status: response.status,
        });
      }

      // initialize 응답에서 세션 ID 추출
      this.extractSessionId(response);

      // 응답 형식에 따라 처리 (JSON 또는 SSE 스트림)
      const contentType = response.headers.get("content-type") ?? "";

      if (contentType.includes("text/event-stream")) {
        // SSE 스트리밍 응답 처리
        await this.consumeSSEStream(response);
      } else {
        // 일반 JSON 응답 처리
        const body = (await response.json()) as JsonRpcMessage;
        this.messageHandler?.(body);
      }
    } catch (error) {
      if (error instanceof HttpTransportError) throw error;
      throw new HttpTransportError("Failed to connect to HTTP MCP server", {
        server: this.config.name,
        url: this.url,
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * HTTP 트랜스포트 연결을 종료합니다.
   *
   * HTTP는 stateless이므로 실제 연결을 끊을 필요가 없고,
   * 종료 핸들러만 호출합니다.
   */
  async disconnect(): Promise<void> {
    this.closeHandler?.();
  }

  /**
   * JSON-RPC 요청을 HTTP POST로 전송합니다.
   *
   * 재시도 로직(postWithRetry)을 사용하여 일시적 에러를 자동 복구합니다.
   *
   * @param id - 요청 ID
   * @param method - 호출할 메서드
   * @param params - 메서드 매개변수
   */
  sendRequest(id: string | number, method: string, params: Record<string, unknown>): void {
    const request = {
      jsonrpc: "2.0" as const,
      id,
      method,
      params,
    };

    this.postWithRetry(request).catch((error) => {
      this.errorHandler?.(error instanceof Error ? error : new HttpTransportError(String(error)));
    });
  }

  /**
   * JSON-RPC 알림을 HTTP POST로 전송합니다.
   *
   * 알림은 응답을 기대하지 않는 fire-and-forget 방식입니다.
   * 전송 실패 시 에러 핸들러를 호출합니다.
   *
   * @param method - 알림 메서드 이름
   * @param params - 알림 매개변수
   */
  sendNotification(method: string, params: Record<string, unknown>): void {
    const notification = {
      jsonrpc: "2.0" as const,
      method,
      params,
    };

    this.postMessage(notification).catch((error) => {
      this.errorHandler?.(error instanceof Error ? error : new HttpTransportError(String(error)));
    });
  }

  /**
   * 수신 메시지 핸들러를 등록합니다.
   *
   * @param handler - HTTP 응답에서 파싱한 JSON-RPC 메시지를 처리할 콜백
   */
  onMessage(handler: (message: JsonRpcMessage) => void): void {
    this.messageHandler = handler;
  }

  /**
   * 에러 핸들러를 등록합니다.
   *
   * @param handler - 에러 발생 시 호출할 콜백
   */
  onError(handler: (error: Error) => void): void {
    this.errorHandler = handler;
  }

  /**
   * 연결 종료 핸들러를 등록합니다.
   *
   * @param handler - 연결이 닫힐 때 호출할 콜백
   */
  onClose(handler: () => void): void {
    this.closeHandler = handler;
  }

  /**
   * JSON-RPC 메시지를 HTTP POST로 전송하고 응답을 처리합니다.
   *
   * 응답 처리 규칙:
   * - 202 Accepted: 알림이 승인됨 (본문 없음)
   * - SSE 스트림: consumeSSEStream()으로 처리
   * - JSON: 메시지 핸들러에 전달
   *
   * @param message - 전송할 JSON-RPC 메시지 객체
   * @throws HttpTransportError HTTP 요청 실패 시
   */
  private async postMessage(message: Record<string, unknown>): Promise<void> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_HTTP_TIMEOUT_MS);

    try {
      const response = await fetch(this.url, {
        method: "POST",
        headers: this.buildHeaders(),
        body: JSON.stringify(message),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        throw new HttpTransportError(`HTTP ${response.status}: ${response.statusText}`, {
          server: this.config.name,
          status: response.status,
        });
      }

      // 모든 응답에서 세션 ID 추출
      this.extractSessionId(response);

      // 202 Accepted = 알림 승인, 본문 없음
      if (response.status === 202) return;

      // 응답 형식에 따라 처리
      const contentType = response.headers.get("content-type") ?? "";

      if (contentType.includes("text/event-stream")) {
        // SSE 스트리밍 응답
        await this.consumeSSEStream(response);
      } else {
        // 일반 JSON 응답
        const body = (await response.json()) as JsonRpcMessage;
        this.messageHandler?.(body);
      }
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * 일시적 에러에 대해 지수 백오프로 재시도합니다.
   *
   * 재시도 판단 기준:
   * - 4xx (400~499): 클라이언트 에러 → 재시도 불가 (즉시 throw)
   * - 5xx (500~599): 서버 에러 → 재시도 가능
   * - 네트워크 에러: 재시도 가능
   *
   * 재시도 딜레이: 1초 × 2^시도횟수 (지수 백오프)
   *
   * @param message - 전송할 JSON-RPC 메시지
   * @throws HttpTransportError 최대 재시도 횟수 초과 시
   */
  private async postWithRetry(message: Record<string, unknown>): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        await this.postMessage(message);
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new HttpTransportError(String(error));

        // 4xx 에러는 재시도해도 동일하므로 즉시 throw
        if (error instanceof HttpTransportError) {
          const status = error.context.status as number | undefined;
          if (status && status >= 400 && status < 500) {
            throw error;
          }
        }

        // 마지막 시도가 아니면 지수 백오프로 대기 후 재시도
        if (attempt < MAX_RETRIES - 1) {
          const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError ?? new HttpTransportError("Request failed after retries");
  }

  /**
   * HTTP 응답에서 SSE(Server-Sent Events) 스트림을 소비합니다.
   *
   * ReadableStream을 사용하여 바이트 단위로 데이터를 읽고,
   * 이중 줄바꿈(\n\n)으로 SSE 이벤트를 구분합니다.
   *
   * @param response - SSE 형식의 HTTP 응답
   */
  private async consumeSSEStream(response: Response): Promise<void> {
    const body = response.body;
    if (!body) return;

    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // 이중 줄바꿈(\n\n)으로 완전한 SSE 이벤트 분리
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const event of events) {
          this.parseSSEEvent(event);
        }
      }

      // 남은 데이터 처리
      if (buffer.trim()) {
        this.parseSSEEvent(buffer);
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * 단일 SSE 이벤트를 파싱하여 메시지 핸들러에 전달합니다.
   *
   * "data:" 접두사가 있는 줄에서 데이터를 추출하고,
   * JSON으로 파싱하여 메시지 핸들러에 전달합니다.
   * event:, id:, retry: 필드는 현재 무시합니다.
   *
   * @param event - 파싱할 SSE 이벤트 문자열
   */
  private parseSSEEvent(event: string): void {
    let data = "";

    for (const line of event.split("\n")) {
      if (line.startsWith("data: ")) {
        data += line.slice(6);
      } else if (line.startsWith("data:")) {
        data += line.slice(5);
      }
      // event:, id:, retry: 필드는 현재 미구현 — 추후 필요 시 추가
    }

    if (!data) return;

    try {
      const message = JSON.parse(data) as JsonRpcMessage;
      this.messageHandler?.(message);
    } catch {
      // 파싱 불가능한 SSE 데이터는 무시
    }
  }
}

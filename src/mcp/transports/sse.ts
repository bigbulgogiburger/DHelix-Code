/**
 * SSE 트랜스포트 — Server-Sent Events를 사용한 양방향 통신 모듈
 *
 * SSE(Server-Sent Events)는 서버가 클라이언트에게 실시간으로
 * 데이터를 "푸시(push)"할 수 있는 HTTP 기반 단방향 스트리밍 프로토콜입니다.
 *
 * MCP에서 SSE 트랜스포트는 양방향 통신을 다음과 같이 구현합니다:
 * - 클라이언트 → 서버: HTTP POST 요청으로 JSON-RPC 메시지 전송
 * - 서버 → 클라이언트: SSE 연결로 JSON-RPC 메시지를 실시간 수신
 *
 * SSE 프로토콜의 기본 형식:
 * ```
 * event: message          ← 이벤트 타입 (선택)
 * data: {"jsonrpc":"2.0"} ← 실제 데이터
 * id: 123                 ← 이벤트 ID (재연결 시 복원에 사용)
 *
 * ```
 * (빈 줄로 이벤트 구분)
 *
 * 연결이 끊기면 지수 백오프(exponential backoff) 전략으로 자동 재연결합니다.
 */
import { BaseError } from "../../utils/error.js";
import { type MCPServerConfig, type JsonRpcMessage } from "../types.js";
import { type MCPTransportLayer } from "./base.js";

/**
 * SSE 트랜스포트 에러 클래스
 */
export class SseTransportError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "SSE_TRANSPORT_ERROR", context);
  }
}

/** HTTP POST 요청 기본 타임아웃 (30초) */
const DEFAULT_POST_TIMEOUT_MS = 30_000;

/** SSE 스트림 최대 재연결 시도 횟수 */
const MAX_RECONNECT_ATTEMPTS = 5;

/**
 * 지수 백오프(exponential backoff) 재연결의 기본 딜레이 (ms)
 *
 * 지수 백오프란: 재시도할 때마다 대기 시간을 2배씩 늘리는 전략
 * 1초 → 2초 → 4초 → 8초 → 16초 (최대 30초)
 */
const RECONNECT_BASE_DELAY_MS = 1_000;

/** 재연결 최대 딜레이 (ms) — 지수 백오프가 이 값을 초과하지 않음 */
const MAX_RECONNECT_DELAY_MS = 30_000;

/**
 * SSE 트랜스포트 구현체
 *
 * 서버와의 SSE 연결을 관리하고, JSON-RPC 메시지를 송수신합니다.
 * POST URL은 SSE "endpoint" 이벤트를 통해 서버가 동적으로 제공할 수 있습니다.
 */
export class SseTransport implements MCPTransportLayer {
  /** 수신 메시지 핸들러 */
  private messageHandler: ((message: JsonRpcMessage) => void) | null = null;
  /** 에러 핸들러 */
  private errorHandler: ((error: Error) => void) | null = null;
  /** 연결 종료 핸들러 */
  private closeHandler: (() => void) | null = null;
  /** 현재 연결 상태 */
  private connected = false;
  /** SSE 연결을 취소하기 위한 AbortController */
  private sseAbortController: AbortController | null = null;
  /** 현재 재연결 시도 횟수 */
  private reconnectAttempts = 0;
  /** SSE 스트림 수신 URL */
  private readonly url: string;
  /** JSON-RPC 메시지를 POST할 URL (endpoint 이벤트로 동적 변경 가능) */
  private postUrl: string;
  /** 마지막으로 수신한 SSE 이벤트 ID (재연결 시 복원에 사용) */
  private lastEventId: string | null = null;

  /**
   * @param config - MCP 서버 설정 (url 필수)
   * @throws SseTransportError url이 설정에 없을 때
   */
  constructor(private readonly config: MCPServerConfig) {
    if (!config.url) {
      throw new SseTransportError("SSE transport requires a url", {
        server: config.name,
      });
    }
    this.url = config.url;
    // POST URL은 기본적으로 SSE URL과 동일 — endpoint 이벤트로 변경될 수 있음
    this.postUrl = config.url;
  }

  /**
   * SSE 연결을 수립합니다.
   *
   * AbortController를 생성하여 연결 취소를 지원하고,
   * SSE 스트림을 설정한 후 connected 상태로 전환합니다.
   */
  async connect(): Promise<void> {
    this.sseAbortController = new AbortController();
    await this.establishSSEConnection();
    this.connected = true;
    this.reconnectAttempts = 0;
  }

  /**
   * SSE 연결을 종료합니다.
   *
   * AbortController를 통해 진행 중인 SSE 스트림을 취소합니다.
   */
  async disconnect(): Promise<void> {
    this.connected = false;
    this.sseAbortController?.abort();
    this.sseAbortController = null;
    this.closeHandler?.();
  }

  /**
   * JSON-RPC 요청을 HTTP POST로 전송합니다.
   *
   * 비동기적으로 전송하며, 전송 실패 시 에러 핸들러를 호출합니다.
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

    this.postMessage(request).catch((error) => {
      this.errorHandler?.(error instanceof Error ? error : new SseTransportError(String(error)));
    });
  }

  /**
   * JSON-RPC 알림을 HTTP POST로 전송합니다. (응답 불필요)
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
      this.errorHandler?.(error instanceof Error ? error : new SseTransportError(String(error)));
    });
  }

  /**
   * 수신 메시지 핸들러를 등록합니다.
   *
   * @param handler - SSE로 수신한 JSON-RPC 메시지를 처리할 콜백
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
   * SSE 연결을 수립하여 서버에서 클라이언트로의 메시지 수신 채널을 엽니다.
   *
   * HTTP GET 요청으로 SSE 스트림을 열고,
   * Last-Event-ID 헤더로 재연결 시 이전 위치를 복원합니다.
   * 스트림은 백그라운드에서 비동기적으로 소비됩니다.
   *
   * @throws SseTransportError HTTP 연결 실패 시
   */
  private async establishSSEConnection(): Promise<void> {
    const headers: Record<string, string> = {
      Accept: "text/event-stream",
      "Cache-Control": "no-cache",
    };

    // 재연결 시 마지막으로 수신한 이벤트 ID를 전송하여 이어받기
    if (this.lastEventId) {
      headers["Last-Event-ID"] = this.lastEventId;
    }

    const response = await fetch(this.url, {
      method: "GET",
      headers,
      signal: this.sseAbortController?.signal,
    });

    if (!response.ok) {
      throw new SseTransportError(`SSE connection failed: HTTP ${response.status}`, {
        server: this.config.name,
        status: response.status,
      });
    }

    // SSE 스트림을 백그라운드에서 소비 (비동기)
    this.consumeStream(response).catch((error) => {
      if (this.connected) {
        this.errorHandler?.(error instanceof Error ? error : new SseTransportError(String(error)));
        this.attemptReconnect();
      }
    });
  }

  /**
   * JSON-RPC 메시지를 HTTP POST로 전송합니다.
   *
   * 서버가 JSON 응답을 반환하면 메시지 핸들러로 전달합니다.
   * 202(Accepted), 204(No Content) 상태 코드는 본문 없이 성공 처리합니다.
   *
   * @param message - 전송할 JSON-RPC 메시지 객체
   * @throws SseTransportError HTTP 요청 실패 시
   */
  private async postMessage(message: Record<string, unknown>): Promise<void> {
    // 타임아웃 처리를 위한 AbortController
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_POST_TIMEOUT_MS);

    try {
      const response = await fetch(this.postUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(message),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        throw new SseTransportError(`POST failed: HTTP ${response.status}`, {
          server: this.config.name,
          status: response.status,
        });
      }

      // 202(Accepted)나 204(No Content)가 아닌 경우 응답 본문 확인
      // 일부 서버는 POST 응답에 JSON-RPC 결과를 바로 반환
      if (response.status !== 202 && response.status !== 204) {
        const contentType = response.headers.get("content-type") ?? "";
        if (contentType.includes("application/json")) {
          const body = (await response.json()) as JsonRpcMessage;
          this.messageHandler?.(body);
        }
      }
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * SSE 스트림을 소비하며 이벤트를 파싱합니다.
   *
   * ReadableStream을 사용하여 바이트 단위로 데이터를 읽고,
   * 이중 줄바꿈(\n\n)으로 SSE 이벤트를 구분합니다.
   * 각 이벤트는 parseSSEEvent()로 파싱하여 메시지 핸들러에 전달합니다.
   *
   * 스트림이 정상적으로 종료되면(서버가 끊으면) 재연결을 시도합니다.
   *
   * @param response - SSE HTTP 응답 객체
   * @throws SseTransportError 응답 본문이 없을 때
   */
  private async consumeStream(response: Response): Promise<void> {
    const body = response.body;
    if (!body) {
      throw new SseTransportError("SSE response has no body");
    }

    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        // 바이트를 문자열로 디코딩하고 버퍼에 추가
        buffer += decoder.decode(value, { stream: true });

        // 이중 줄바꿈(\n\n)으로 완전한 SSE 이벤트 분리
        const events = buffer.split("\n\n");
        // 마지막 요소는 아직 완전하지 않을 수 있으므로 버퍼에 유지
        buffer = events.pop() ?? "";

        // 완전한 이벤트들을 파싱
        for (const event of events) {
          this.parseSSEEvent(event);
        }
      }

      // 스트림 종료 후 남은 버퍼 처리
      if (buffer.trim()) {
        this.parseSSEEvent(buffer);
      }
    } finally {
      reader.releaseLock();
    }

    // 스트림이 종료되었지만 아직 연결 중이면 재연결 시도
    if (this.connected) {
      this.attemptReconnect();
    }
  }

  /**
   * 단일 SSE 이벤트 블록을 파싱합니다.
   *
   * SSE 이벤트 형식:
   * - "data: ..." → 실제 데이터
   * - "event: ..." → 이벤트 타입
   * - "id: ..." → 이벤트 ID (재연결 시 복원용)
   *
   * 특수 이벤트:
   * - "endpoint" 타입: 서버가 POST URL을 동적으로 제공
   *
   * @param event - 파싱할 SSE 이벤트 문자열
   */
  private parseSSEEvent(event: string): void {
    let data = "";
    let eventType = "";

    // 각 줄을 파싱하여 data, event, id 필드 추출
    for (const line of event.split("\n")) {
      if (line.startsWith("data: ")) {
        data += line.slice(6);
      } else if (line.startsWith("data:")) {
        data += line.slice(5);
      } else if (line.startsWith("event: ")) {
        eventType = line.slice(7).trim();
      } else if (line.startsWith("event:")) {
        eventType = line.slice(6).trim();
      } else if (line.startsWith("id: ")) {
        this.lastEventId = line.slice(4).trim();
      } else if (line.startsWith("id:")) {
        this.lastEventId = line.slice(3).trim();
      }
    }

    // "endpoint" 이벤트: 서버가 POST 요청을 보낼 URL을 알려줌
    if (eventType === "endpoint" && data) {
      try {
        const baseUrl = new URL(this.url);
        this.postUrl = new URL(data.trim(), baseUrl).toString();
      } catch {
        // URL 파싱 실패 시 기존 postUrl 유지
      }
      return;
    }

    if (!data) return;

    // 데이터를 JSON-RPC 메시지로 파싱하여 핸들러에 전달
    try {
      const message = JSON.parse(data) as JsonRpcMessage;
      this.messageHandler?.(message);
    } catch {
      // 파싱 불가능한 SSE 데이터는 무시
    }
  }

  /**
   * SSE 스트림 재연결을 지수 백오프(exponential backoff)로 시도합니다.
   *
   * 지수 백오프: 재시도할 때마다 대기 시간을 2배씩 증가
   * - 시도 1: 1초 대기
   * - 시도 2: 2초 대기
   * - 시도 3: 4초 대기
   * - 시도 4: 8초 대기
   * - 시도 5: 16초 대기
   * - 최대 대기: 30초
   *
   * 최대 시도 횟수(5회)를 초과하면 연결을 포기하고 종료합니다.
   */
  private attemptReconnect(): void {
    if (!this.connected) return;
    // 최대 재연결 시도 횟수 초과 시 연결 포기
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.errorHandler?.(
        new SseTransportError("SSE reconnection failed after max attempts", {
          server: this.config.name,
          attempts: this.reconnectAttempts,
        }),
      );
      this.connected = false;
      this.closeHandler?.();
      return;
    }

    // 지수 백오프로 딜레이 계산: baseDelay * 2^attempt (최대 maxDelay)
    const delay = Math.min(
      RECONNECT_BASE_DELAY_MS * Math.pow(2, this.reconnectAttempts),
      MAX_RECONNECT_DELAY_MS,
    );
    this.reconnectAttempts++;

    // 딜레이 후 재연결 시도
    setTimeout(() => {
      if (!this.connected) return;

      this.sseAbortController = new AbortController();
      this.establishSSEConnection().catch((error) => {
        this.errorHandler?.(error instanceof Error ? error : new SseTransportError(String(error)));
        this.attemptReconnect();
      });
    }, delay);
  }
}

/**
 * DashboardEventBridge — SSE(Server-Sent Events) 기반 이벤트 브릿지
 *
 * WebSocket 대신 SSE를 사용하여 외부 의존성 없이 실시간 이벤트를 전송합니다.
 * SSE는 브라우저 EventSource API와 호환되며, HTTP/1.1 표준 기능입니다.
 *
 * SSE 프로토콜 형식:
 * ```
 * event: session:updated
 * data: {"id":"...","title":"..."}
 *
 * ```
 *
 * 주요 기능:
 * - 다수의 SSE 클라이언트 관리 (연결/해제)
 * - 모든 연결된 클라이언트에 이벤트 브로드캐스트
 * - 연결 유지를 위한 heartbeat (30초 간격)
 * - 리소스 정리(dispose)
 *
 * @module dashboard/websocket
 */

import { type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { type DashboardEvent } from "./types.js";

/** SSE heartbeat 간격 (ms) — 연결이 끊기지 않도록 주기적으로 코멘트를 전송 */
const HEARTBEAT_INTERVAL_MS = 30_000;

/**
 * 연결된 SSE 클라이언트의 내부 상태
 */
interface SseClient {
  /** 고유 클라이언트 ID */
  readonly id: string;
  /** HTTP 응답 스트림 — 이 스트림에 SSE 데이터를 씁니다 */
  readonly response: ServerResponse;
}

/**
 * DashboardEventBridge — SSE 이벤트 브로드캐스터
 *
 * DashboardServer의 GET /api/events 엔드포인트에서 사용됩니다.
 * 새 클라이언트가 연결하면 addClient()로 등록하고,
 * 이벤트가 발생하면 broadcast()로 모든 클라이언트에 전송합니다.
 *
 * @example
 * ```typescript
 * const bridge = new DashboardEventBridge();
 *
 * // SSE 엔드포인트에서 클라이언트 등록
 * const clientId = bridge.addClient(res);
 *
 * // 이벤트 브로드캐스트
 * bridge.broadcast({
 *   type: 'session:updated',
 *   data: { id: '...', title: '...', ... }
 * });
 *
 * // 정리
 * bridge.dispose();
 * ```
 */
export class DashboardEventBridge {
  /** 연결된 클라이언트 맵 (clientId -> SseClient) */
  private readonly clients = new Map<string, SseClient>();

  /** heartbeat 타이머 ID — dispose 시 정리됩니다 */
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  /** 리소스 정리 여부 */
  private disposed = false;

  constructor() {
    this.startHeartbeat();
  }

  /**
   * 새로운 SSE 클라이언트를 등록합니다.
   *
   * HTTP 응답에 SSE 헤더를 설정하고, 클라이언트를 내부 맵에 추가합니다.
   * 연결이 끊어지면 자동으로 클라이언트를 제거합니다.
   *
   * @param res - HTTP ServerResponse 객체
   * @returns 생성된 클라이언트 ID (UUID)
   */
  addClient(res: ServerResponse): string {
    const clientId = randomUUID();

    // SSE 필수 헤더 설정
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    // 연결 확인 코멘트 전송
    res.write(": connected\n\n");

    const client: SseClient = { id: clientId, response: res };
    this.clients.set(clientId, client);

    // 클라이언트 연결 해제 시 자동 제거
    res.on("close", () => {
      this.clients.delete(clientId);
    });

    return clientId;
  }

  /**
   * 특정 클라이언트를 수동으로 제거합니다.
   *
   * 클라이언트의 응답 스트림을 종료(end)하고 내부 맵에서 삭제합니다.
   *
   * @param clientId - 제거할 클라이언트 ID
   * @returns 클라이언트가 존재하여 제거되었으면 true
   */
  removeClient(clientId: string): boolean {
    const client = this.clients.get(clientId);
    if (!client) {
      return false;
    }
    // 응답 스트림이 아직 열려있으면 종료
    if (!client.response.writableEnded) {
      client.response.end();
    }
    this.clients.delete(clientId);
    return true;
  }

  /**
   * 모든 연결된 클라이언트에 이벤트를 브로드캐스트합니다.
   *
   * SSE 프로토콜 형식으로 데이터를 전송합니다:
   * ```
   * event: {type}
   * data: {json}
   *
   * ```
   *
   * 전송 실패한 클라이언트는 자동으로 제거됩니다.
   *
   * @param event - 브로드캐스트할 DashboardEvent
   * @returns 성공적으로 전송된 클라이언트 수
   */
  broadcast(event: DashboardEvent): number {
    if (this.disposed) {
      return 0;
    }

    const payload = formatSseMessage(event.type, event.data);
    let sentCount = 0;
    const failedIds: string[] = [];

    for (const [clientId, client] of this.clients) {
      try {
        if (!client.response.writableEnded) {
          client.response.write(payload);
          sentCount++;
        } else {
          failedIds.push(clientId);
        }
      } catch {
        failedIds.push(clientId);
      }
    }

    // 실패한 클라이언트 정리
    for (const id of failedIds) {
      this.clients.delete(id);
    }

    return sentCount;
  }

  /**
   * 현재 연결된 클라이언트 수를 반환합니다.
   *
   * @returns 클라이언트 수
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * 모든 리소스를 정리합니다.
   *
   * heartbeat 타이머를 중지하고, 모든 클라이언트 연결을 종료합니다.
   * 이후의 broadcast() 호출은 무시됩니다.
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;

    // heartbeat 타이머 정리
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    // 모든 클라이언트 연결 종료
    for (const [, client] of this.clients) {
      try {
        if (!client.response.writableEnded) {
          client.response.end();
        }
      } catch {
        // 종료 실패는 무시 — 이미 닫힌 연결일 수 있음
      }
    }
    this.clients.clear();
  }

  /**
   * heartbeat 타이머를 시작합니다.
   *
   * 30초 간격으로 SSE 코멘트(": heartbeat\n\n")를 전송하여
   * 프록시/로드밸런서가 유휴 연결을 끊지 않도록 합니다.
   * 전송 실패한 클라이언트는 자동으로 제거됩니다.
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.disposed) {
        return;
      }

      const failedIds: string[] = [];
      for (const [clientId, client] of this.clients) {
        try {
          if (!client.response.writableEnded) {
            client.response.write(": heartbeat\n\n");
          } else {
            failedIds.push(clientId);
          }
        } catch {
          failedIds.push(clientId);
        }
      }

      for (const id of failedIds) {
        this.clients.delete(id);
      }
    }, HEARTBEAT_INTERVAL_MS);

    // Node.js 프로세스 종료를 방해하지 않도록 unref
    if (this.heartbeatTimer && typeof this.heartbeatTimer === 'object' && 'unref' in this.heartbeatTimer) {
      (this.heartbeatTimer as { unref: () => void }).unref();
    }
  }
}

// ---------------------------------------------------------------------------
// SSE 포맷 유틸리티
// ---------------------------------------------------------------------------

/**
 * SSE 프로토콜 형식으로 메시지를 포맷합니다.
 *
 * @param eventType - SSE event 필드 값
 * @param data - SSE data 필드에 JSON으로 직렬화될 값
 * @returns "event: ...\ndata: ...\n\n" 형식의 문자열
 */
export function formatSseMessage(eventType: string, data: unknown): string {
  const jsonData = JSON.stringify(data);
  return `event: ${eventType}\ndata: ${jsonData}\n\n`;
}

/**
 * MCP 트랜스포트 계층 — JSON-RPC 통신을 위한 추상 인터페이스와 팩토리
 *
 * 트랜스포트 계층은 MCP 클라이언트와 서버 간의 실제 데이터 전송을 담당합니다.
 * 세 가지 구현체를 제공합니다:
 * - StdioTransport: 자식 프로세스의 stdin/stdout을 통한 통신
 * - HttpTransport: HTTP POST 요청/응답 방식
 * - SseTransport: SSE(Server-Sent Events) 스트리밍 방식
 *
 * 팩토리 패턴(Factory Pattern)을 사용하여 설정에 따라
 * 적절한 트랜스포트 인스턴스를 자동으로 생성합니다.
 */
import { type MCPServerConfig, type JsonRpcMessage } from "../types.js";
import { StdioTransport } from "./stdio.js";
import { HttpTransport } from "./http.js";
import { SseTransport } from "./sse.js";

/**
 * MCP JSON-RPC 통신을 위한 트랜스포트 계층 인터페이스
 *
 * 이 인터페이스를 구현하는 클래스는 실제 데이터 전송 방법(stdio, HTTP, SSE)을
 * 제공합니다. 클라이언트는 이 인터페이스만 알면 되므로,
 * 트랜스포트 구현을 자유롭게 교체할 수 있습니다.
 * (이것을 "추상화"라고 합니다 — 세부 구현을 숨기고 공통 인터페이스만 노출)
 */
export interface MCPTransportLayer {
  /** 트랜스포트 연결을 수립합니다 (비동기) */
  connect(): Promise<void>;
  /** 트랜스포트 연결을 정상적으로 종료합니다 (비동기) */
  disconnect(): Promise<void>;
  /**
   * JSON-RPC 요청을 전송합니다 (id가 있어 응답을 기대함)
   *
   * @param id - 요청 고유 식별자
   * @param method - 호출할 메서드 이름
   * @param params - 메서드 매개변수
   */
  sendRequest(id: string | number, method: string, params: Record<string, unknown>): void;
  /**
   * JSON-RPC 알림을 전송합니다 (id가 없어 응답을 기대하지 않음)
   *
   * @param method - 알림 메서드 이름
   * @param params - 알림 매개변수
   */
  sendNotification(method: string, params: Record<string, unknown>): void;
  /**
   * 수신 메시지 핸들러를 등록합니다
   *
   * @param handler - 메시지 수신 시 호출할 콜백 함수
   */
  onMessage(handler: (message: JsonRpcMessage) => void): void;
  /**
   * 에러 핸들러를 등록합니다
   *
   * @param handler - 에러 발생 시 호출할 콜백 함수
   */
  onError(handler: (error: Error) => void): void;
  /**
   * 연결 종료 핸들러를 등록합니다
   *
   * @param handler - 연결이 닫힐 때 호출할 콜백 함수
   */
  onClose(handler: () => void): void;
}

/**
 * 서버 설정에 따라 적절한 트랜스포트 인스턴스를 생성합니다.
 *
 * 팩토리 함수(Factory Function) — 입력(설정)에 따라
 * 적절한 객체를 생성하여 반환합니다.
 *
 * @param config - MCP 서버 설정 (transport 필드로 타입 결정)
 * @returns 생성된 트랜스포트 인스턴스
 * @throws Error 알 수 없는 트랜스포트 타입일 때
 */
export function createTransport(config: MCPServerConfig): MCPTransportLayer {
  switch (config.transport) {
    case "stdio":
      return new StdioTransport(config);
    case "http":
      return new HttpTransport(config);
    case "sse":
      return new SseTransport(config);
    default:
      throw new Error(`Unknown transport type: ${config.transport as string}`);
  }
}

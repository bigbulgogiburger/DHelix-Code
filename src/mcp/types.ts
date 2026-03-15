/**
 * MCP 타입 정의 모듈
 *
 * MCP(Model Context Protocol)는 LLM(대규모 언어 모델)이 외부 도구, 리소스, 프롬프트와
 * 통신하기 위한 표준 프로토콜입니다. 이 파일은 MCP 통신에 필요한 모든 타입을 정의합니다.
 *
 * JSON-RPC 2.0은 경량 원격 프로시저 호출(RPC) 프로토콜로,
 * 클라이언트가 서버에 메서드를 호출하고 결과를 받을 수 있게 해줍니다.
 * 모든 메시지는 { jsonrpc: "2.0", ... } 형태의 JSON 객체입니다.
 *
 * JSON-RPC 2.0의 세 가지 메시지 유형:
 * 1. Request (요청): id + method → 응답을 기대하는 호출
 * 2. Response (응답): id + result/error → 요청에 대한 결과
 * 3. Notification (알림): method만 있고 id 없음 → 응답을 기대하지 않는 단방향 메시지
 */

/**
 * JSON-RPC 2.0 요청 메시지
 *
 * 클라이언트가 서버에 특정 메서드를 호출할 때 사용합니다.
 * id 필드로 요청과 응답을 매칭합니다.
 *
 * @example
 * { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }
 */
export interface JsonRpcRequest {
  /** JSON-RPC 프로토콜 버전 — 항상 "2.0" */
  readonly jsonrpc: "2.0";
  /** 요청 고유 식별자 — 응답과 매칭하는 데 사용 */
  readonly id: string | number;
  /** 호출할 메서드 이름 (예: "tools/list", "tools/call", "initialize") */
  readonly method: string;
  /** 메서드에 전달할 매개변수 (선택) */
  readonly params?: Readonly<Record<string, unknown>>;
}

/**
 * JSON-RPC 2.0 성공 응답 메시지
 *
 * 서버가 요청을 성공적으로 처리했을 때 반환합니다.
 * id는 원래 요청의 id와 동일해야 합니다.
 *
 * @example
 * { jsonrpc: "2.0", id: 1, result: { tools: [...] } }
 */
export interface JsonRpcResponse {
  /** JSON-RPC 프로토콜 버전 */
  readonly jsonrpc: "2.0";
  /** 원래 요청의 id와 동일한 식별자 */
  readonly id: string | number;
  /** 메서드 실행 결과 */
  readonly result: unknown;
}

/**
 * JSON-RPC 2.0 에러 응답 메시지
 *
 * 서버가 요청을 처리하는 중 에러가 발생했을 때 반환합니다.
 * error 객체에 에러 코드, 메시지, 추가 데이터가 포함됩니다.
 *
 * 주요 에러 코드:
 * - -32700: Parse error (잘못된 JSON)
 * - -32600: Invalid request (유효하지 않은 요청)
 * - -32601: Method not found (존재하지 않는 메서드)
 * - -32602: Invalid params (잘못된 매개변수)
 * - -32603: Internal error (서버 내부 오류)
 */
export interface JsonRpcError {
  /** JSON-RPC 프로토콜 버전 */
  readonly jsonrpc: "2.0";
  /** 원래 요청의 id (파싱 에러 시 null일 수 있음) */
  readonly id: string | number | null;
  /** 에러 정보 */
  readonly error: {
    /** 에러 코드 (음수 — JSON-RPC 표준 코드) */
    readonly code: number;
    /** 사람이 읽을 수 있는 에러 메시지 */
    readonly message: string;
    /** 에러에 대한 추가 정보 (선택) */
    readonly data?: unknown;
  };
}

/**
 * JSON-RPC 2.0 알림 메시지
 *
 * 응답을 기대하지 않는 단방향 메시지입니다.
 * 요청(Request)과 달리 id 필드가 없습니다.
 *
 * MCP에서 주로 사용되는 알림:
 * - "notifications/initialized": 초기화 완료 알림
 * - "notifications/tools/list_changed": 도구 목록 변경 알림
 */
export interface JsonRpcNotification {
  /** JSON-RPC 프로토콜 버전 */
  readonly jsonrpc: "2.0";
  /** 알림 메서드 이름 */
  readonly method: string;
  /** 알림에 포함할 매개변수 (선택) */
  readonly params?: Readonly<Record<string, unknown>>;
}

/**
 * 모든 JSON-RPC 메시지 타입의 유니온(합집합) 타입
 *
 * 트랜스포트 계층에서 수신한 메시지를 이 타입으로 처리하고,
 * id 유무, error 유무 등으로 구체적인 타입을 구분합니다.
 */
export type JsonRpcMessage = JsonRpcRequest | JsonRpcResponse | JsonRpcError | JsonRpcNotification;

/**
 * MCP 트랜스포트(전송 계층) 타입
 *
 * MCP 서버와 통신하는 방식을 결정합니다:
 * - "stdio": 자식 프로세스의 stdin/stdout을 통한 통신 (가장 일반적)
 * - "http": HTTP POST 요청/응답 방식
 * - "sse": SSE(Server-Sent Events) 스트리밍 방식
 */
export type MCPTransport = "stdio" | "http" | "sse";

/**
 * MCP 서버 설정 인터페이스
 *
 * MCP 서버에 연결하기 위한 모든 설정을 포함합니다.
 * 트랜스포트 타입에 따라 필요한 필드가 다릅니다:
 * - stdio: command, args 필요
 * - http/sse: url 필요
 */
export interface MCPServerConfig {
  /** 서버 고유 이름 (식별자로 사용) */
  readonly name: string;
  /** 트랜스포트 타입 (stdio, http, sse 중 하나) */
  readonly transport: MCPTransport;
  /** 실행할 명령어 — stdio 트랜스포트에서 자식 프로세스를 시작할 때 사용 */
  readonly command?: string;
  /** 명령어 인자 — stdio 트랜스포트에서 command와 함께 사용 */
  readonly args?: readonly string[];
  /** 서버 URL — http/sse 트랜스포트에서 사용 */
  readonly url?: string;
  /** 서버 프로세스에 전달할 환경 변수 */
  readonly env?: Readonly<Record<string, string>>;
  /** HTTP/SSE 트랜스포트에서 사용할 커스텀 헤더 */
  readonly headers?: Readonly<Record<string, string>>;
  /**
   * 서버 스코프(범위) — 설정이 적용되는 범위를 지정:
   * - "local": 로컬 개발자 전용 (.gitignore 대상)
   * - "project": 프로젝트 전체 공유 (git에 커밋)
   * - "user": 사용자 글로벌 설정 (~/.dbcode/)
   */
  readonly scope?: "local" | "project" | "user";
}

/**
 * MCP 도구(Tool) 정의
 *
 * MCP 서버가 제공하는 도구의 메타데이터입니다.
 * LLM이 도구를 이해하고 호출할 수 있도록
 * 이름, 설명, 입력 스키마를 제공합니다.
 */
export interface MCPToolDefinition {
  /** 도구 이름 (서버 내에서 고유) */
  readonly name: string;
  /** 도구 설명 — LLM이 언제 이 도구를 사용할지 판단하는 데 사용 */
  readonly description: string;
  /** 입력 매개변수의 JSON Schema — 도구에 전달할 인자 형식 정의 */
  readonly inputSchema: Readonly<Record<string, unknown>>;
}

/**
 * MCP 리소스 정의
 *
 * MCP 서버가 제공하는 외부 데이터 리소스입니다.
 * 파일, 데이터베이스 레코드, API 데이터 등을 URI로 식별합니다.
 */
export interface MCPResource {
  /** 리소스 URI — 리소스를 고유하게 식별하는 주소 (예: "file:///path/to/file") */
  readonly uri: string;
  /** 리소스 이름 — 사람이 읽을 수 있는 표시명 */
  readonly name: string;
  /** 리소스 설명 (선택) */
  readonly description?: string;
  /** MIME 타입 — 리소스의 데이터 형식 (예: "text/plain", "application/json") */
  readonly mimeType?: string;
}

/**
 * MCP 프롬프트 정의
 *
 * MCP 서버가 제공하는 재사용 가능한 프롬프트 템플릿입니다.
 * 사용자가 슬래시 명령(/)으로 실행할 수 있습니다.
 */
export interface MCPPrompt {
  /** 프롬프트 이름 */
  readonly name: string;
  /** 프롬프트 설명 (선택) */
  readonly description?: string;
  /** 프롬프트에 전달할 인자 정의 목록 (선택) */
  readonly arguments?: readonly MCPPromptArgument[];
}

/**
 * MCP 프롬프트 인자 정의
 *
 * 프롬프트 실행 시 사용자가 제공해야 할 인자를 정의합니다.
 */
export interface MCPPromptArgument {
  /** 인자 이름 */
  readonly name: string;
  /** 인자 설명 (선택) */
  readonly description?: string;
  /** 필수 인자 여부 (true면 반드시 제공해야 함) */
  readonly required?: boolean;
}

/**
 * MCP 서버 기능(Capabilities)
 *
 * 서버가 initialize 응답에서 자신이 지원하는 기능을 알려줍니다.
 * 클라이언트는 이 정보로 어떤 기능을 사용할 수 있는지 판단합니다.
 */
export interface MCPServerCapabilities {
  /** 도구 관련 기능 — listChanged가 true면 도구 목록 변경 알림 지원 */
  readonly tools?: { readonly listChanged?: boolean };
  /** 리소스 관련 기능 — subscribe는 실시간 구독, listChanged는 목록 변경 알림 */
  readonly resources?: { readonly subscribe?: boolean; readonly listChanged?: boolean };
  /** 프롬프트 관련 기능 — listChanged가 true면 프롬프트 목록 변경 알림 지원 */
  readonly prompts?: { readonly listChanged?: boolean };
}

/**
 * MCP 도구 호출 결과의 콘텐츠 항목
 *
 * 도구 실행 결과는 여러 콘텐츠 항목으로 구성될 수 있습니다.
 * 텍스트, 이미지, 리소스 등 다양한 형태를 지원합니다.
 */
export interface MCPToolResultContent {
  /** 콘텐츠 타입: "text"(텍스트), "image"(이미지), "resource"(리소스) */
  readonly type: "text" | "image" | "resource";
  /** 텍스트 콘텐츠 (type이 "text"일 때) */
  readonly text?: string;
  /** Base64 인코딩된 바이너리 데이터 (type이 "image"일 때) */
  readonly data?: string;
  /** 데이터의 MIME 타입 (예: "image/png") */
  readonly mimeType?: string;
}

/**
 * MCP 도구 호출 결과
 *
 * tools/call 메서드의 응답으로 반환되는 결과입니다.
 * 하나 이상의 콘텐츠 항목과 에러 여부를 포함합니다.
 */
export interface MCPToolCallResult {
  /** 결과 콘텐츠 항목 배열 */
  readonly content: readonly MCPToolResultContent[];
  /** 도구 실행 중 에러가 발생했는지 여부 */
  readonly isError?: boolean;
}

/**
 * MCP 서버 연결 상태
 *
 * 클라이언트가 서버와의 연결 상태를 추적하는 데 사용합니다.
 * - "disconnected": 연결 끊김 (초기 상태)
 * - "connecting": 연결 시도 중
 * - "connected": 연결 완료 (정상 통신 가능)
 * - "error": 에러 발생 (재연결 필요)
 */
export type MCPConnectionState = "disconnected" | "connecting" | "connected" | "error";

/**
 * MCP 클라이언트 이벤트 타입 정의
 *
 * MCP 클라이언트에서 발생할 수 있는 이벤트들의 페이로드(데이터)를 정의합니다.
 * 이벤트 기반 아키텍처에서 타입 안전한 이벤트 처리를 가능하게 합니다.
 */
export interface MCPClientEvents {
  /** 서버 연결 성공 이벤트 */
  readonly connected: { readonly serverName: string };
  /** 서버 연결 해제 이벤트 (reason: 해제 사유) */
  readonly disconnected: { readonly serverName: string; readonly reason?: string };
  /** 도구 목록 변경 이벤트 */
  readonly toolsChanged: { readonly serverName: string };
  /** 에러 발생 이벤트 */
  readonly error: { readonly serverName: string; readonly error: Error };
}

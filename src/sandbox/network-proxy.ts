/**
 * 네트워크 프록시 — 네트워크 정책을 적용하는 HTTP 프록시 서버
 *
 * 로컬(127.0.0.1)에서 HTTP 프록시를 시작하여 샌드박스 프로세스의
 * 네트워크 트래픽을 제어합니다. 샌드박스 프로세스는 HTTP_PROXY/HTTPS_PROXY
 * 환경 변수를 통해 이 프록시를 경유하도록 설정됩니다.
 *
 * 지원하는 프로토콜:
 * - HTTP: 일반 HTTP 요청을 대상 서버로 전달
 * - HTTPS: CONNECT 메서드를 통한 TCP 터널링 (TLS 내용은 검사하지 않음)
 *
 * 차단 동작:
 * - 허용된 호스트: 요청을 대상 서버로 투명하게 전달(tunneling)
 * - 차단된 호스트: 403 Forbidden 응답 반환
 *
 * @example
 * const proxy = await startNetworkProxy({
 *   port: 0, // 자동 포트 할당
 *   policy: { defaultAction: "deny", allowlist: ["*.openai.com"], denylist: [] },
 *   onBlocked: (host) => console.log(`차단됨: ${host}`),
 * });
 * console.log(`프록시 포트: ${proxy.port}`);
 * await proxy.stop(); // 정리
 */

import { createServer, type Server, type IncomingMessage, type ServerResponse } from "node:http";
import { connect, type Socket } from "node:net";
import { URL } from "node:url";
import { BaseError } from "../utils/error.js";
import { isHostAllowed, type NetworkPolicy } from "./network-policy.js";

/** 네트워크 프록시 에러 */
export class NetworkProxyError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "NETWORK_PROXY_ERROR", context);
  }
}

/** 프록시 서버 시작 옵션 */
export interface ProxyOptions {
  /** 리스닝 포트 (0이면 OS가 자동 할당) */
  readonly port: number;
  /** 적용할 네트워크 정책 */
  readonly policy: NetworkPolicy;
  /** 연결이 차단될 때 호출되는 콜백 (모니터링/로깅용) */
  readonly onBlocked?: (host: string) => void;
}

/** 프록시 서버 핸들 — 포트 정보와 종료 함수를 포함 */
export interface ProxyHandle {
  /** 프록시가 실제로 리스닝 중인 포트 번호 */
  readonly port: number;
  /** 프록시를 종료하고 리소스를 정리하는 함수 */
  readonly stop: () => Promise<void>;
}

/**
 * CONNECT 요청의 대상에서 호스트 이름을 추출합니다.
 * CONNECT 요청은 "호스트:포트" 형식을 사용합니다 (예: "api.openai.com:443").
 *
 * @param url - CONNECT 대상 문자열 (host:port)
 * @returns 호스트 이름
 */
function extractHostFromConnect(url: string): string {
  // 마지막 콜론(:) 이전까지가 호스트 이름
  const colonIndex = url.lastIndexOf(":");
  if (colonIndex > 0) {
    return url.slice(0, colonIndex);
  }
  return url;
}

/**
 * HTTP 요청 URL에서 호스트 이름을 추출합니다.
 *
 * @param urlString - 요청 URL 문자열
 * @returns 호스트 이름
 */
function extractHostFromUrl(urlString: string): string {
  try {
    const parsed = new URL(urlString);
    return parsed.hostname;
  } catch {
    // URL 파싱 실패 시 폴백: Host 유사 형식에서 추출 시도
    const colonIndex = urlString.lastIndexOf(":");
    if (colonIndex > 0) {
      return urlString.slice(0, colonIndex);
    }
    return urlString;
  }
}

/**
 * HTTP CONNECT 메서드를 처리합니다 (HTTPS 터널링용).
 *
 * CONNECT는 HTTPS 연결에 사용됩니다:
 * 1. 클라이언트가 CONNECT host:port를 요청
 * 2. 프록시가 대상 서버와 TCP 연결을 수립
 * 3. "200 Connection Established" 응답 후 양방향 데이터 전달(pipe)
 *
 * 정책에 의해 차단되면 "403 Forbidden"을 반환합니다.
 *
 * @param req - HTTP 요청 객체
 * @param clientSocket - 클라이언트 소켓
 * @param head - 첫 번째 패킷 데이터
 * @param policy - 네트워크 정책
 * @param onBlocked - 차단 시 콜백
 */
function handleConnect(
  req: IncomingMessage,
  clientSocket: Socket,
  head: Buffer,
  policy: NetworkPolicy,
  onBlocked?: (host: string) => void,
): void {
  const target = req.url ?? "";
  const host = extractHostFromConnect(target);

  // 정책 검사: 호스트가 차단 대상이면 403 반환
  if (!isHostAllowed(host, policy)) {
    onBlocked?.(host);
    clientSocket.write(
      "HTTP/1.1 403 Forbidden\r\nContent-Type: text/plain\r\n\r\nBlocked by network policy\r\n",
    );
    clientSocket.end();
    return;
  }

  // 대상 호스트와 포트 파싱
  const colonIndex = target.lastIndexOf(":");
  const targetHost = colonIndex > 0 ? target.slice(0, colonIndex) : target;
  const targetPort = colonIndex > 0 ? parseInt(target.slice(colonIndex + 1), 10) : 443;

  // 대상 서버와 TCP 연결 수립 후 양방향 파이프(pipe) 설정
  const serverSocket = connect(targetPort, targetHost, () => {
    clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
    serverSocket.write(head);
    // 양방향 데이터 전달: 클라이언트 ↔ 서버
    serverSocket.pipe(clientSocket);
    clientSocket.pipe(serverSocket);
  });

  // 에러 발생 시 상대방 소켓도 종료
  serverSocket.on("error", () => {
    clientSocket.end();
  });

  clientSocket.on("error", () => {
    serverSocket.end();
  });
}

/**
 * 일반 HTTP 요청(비CONNECT)을 처리합니다.
 *
 * 1. 요청의 대상 호스트를 추출
 * 2. 정책 검사 후 차단이면 403 반환
 * 3. 허용이면 대상 서버와 TCP 연결 후 요청/응답 전달
 *
 * @param req - HTTP 요청 객체
 * @param res - HTTP 응답 객체
 * @param policy - 네트워크 정책
 * @param onBlocked - 차단 시 콜백
 */
function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  policy: NetworkPolicy,
  onBlocked?: (host: string) => void,
): void {
  const urlString = req.url ?? "";
  // Host 헤더 또는 URL에서 호스트 이름 추출
  const host = req.headers.host
    ? extractHostFromUrl(`http://${req.headers.host}`)
    : extractHostFromUrl(urlString);

  // 정책 검사: 차단 대상이면 403 반환
  if (!isHostAllowed(host, policy)) {
    onBlocked?.(host);
    res.writeHead(403, { "Content-Type": "text/plain" });
    res.end("Blocked by network policy\n");
    return;
  }

  // URL 파싱
  let targetUrl: URL;
  try {
    targetUrl = new URL(urlString);
  } catch {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end("Bad request\n");
    return;
  }

  const targetPort = targetUrl.port ? parseInt(targetUrl.port, 10) : 80;
  const targetHost = targetUrl.hostname;

  // 대상 서버와 TCP 연결 후 HTTP 요청 전달
  const serverSocket = connect(targetPort, targetHost, () => {
    // 경로 부분만 추출하여 HTTP 요청 라인 재구성
    const path = targetUrl.pathname + targetUrl.search;
    let requestLine = `${req.method} ${path} HTTP/${req.httpVersion}\r\n`;

    // 원본 헤더를 그대로 전달
    const rawHeaders = req.rawHeaders;
    for (let i = 0; i < rawHeaders.length; i += 2) {
      requestLine += `${rawHeaders[i]}: ${rawHeaders[i + 1]}\r\n`;
    }
    requestLine += "\r\n";

    serverSocket.write(requestLine);
    // 요청 본문(body)을 파이프로 전달
    req.pipe(serverSocket);

    // 응답을 클라이언트로 파이프로 전달
    const clientSocket = res.socket;
    if (clientSocket) {
      serverSocket.pipe(clientSocket);
    }
  });

  serverSocket.on("error", () => {
    // 연결 실패 시 502 Bad Gateway 반환
    if (!res.headersSent) {
      res.writeHead(502, { "Content-Type": "text/plain" });
      res.end("Bad gateway\n");
    }
  });
}

/**
 * 네트워크 정책을 적용하는 HTTP 프록시 서버를 시작합니다.
 *
 * 프록시 동작 방식:
 * 1. localhost:{port}에서 HTTP 서버를 시작합니다
 * 2. CONNECT 요청(HTTPS): 대상 호스트를 정책과 대조합니다
 * 3. 일반 HTTP 요청: 대상 호스트를 정책과 대조합니다
 * 4. 허용된 연결은 대상 서버로 투명하게 터널링됩니다
 * 5. 차단된 연결은 403 Forbidden 응답을 받습니다
 *
 * @param options - 프록시 시작 옵션 (포트, 정책, 콜백)
 * @returns 프록시 핸들 (실제 포트와 종료 함수)
 * @throws NetworkProxyError - 프록시 시작 실패 시
 *
 * @example
 * const proxy = await startNetworkProxy({ port: 0, policy, onBlocked: console.log });
 * // proxy.port → OS가 할당한 포트
 * await proxy.stop(); // 프록시 종료
 */
export async function startNetworkProxy(options: ProxyOptions): Promise<ProxyHandle> {
  const { port, policy, onBlocked } = options;

  // HTTP 서버 생성: 일반 HTTP 요청 처리
  const server: Server = createServer((req, res) => {
    handleRequest(req, res, policy, onBlocked);
  });

  // CONNECT 메서드 처리: HTTPS 터널링
  server.on("connect", (req: IncomingMessage, clientSocket: Socket, head: Buffer) => {
    handleConnect(req, clientSocket, head, policy, onBlocked);
  });

  // 서버 시작 및 핸들 반환
  return new Promise<ProxyHandle>((resolve, reject) => {
    server.on("error", (err) => {
      reject(
        new NetworkProxyError("Failed to start network proxy", {
          port,
          cause: err.message,
        }),
      );
    });

    // 127.0.0.1(localhost)에서만 리스닝 — 외부에서 접근 불가
    server.listen(port, "127.0.0.1", () => {
      const addr = server.address();
      const actualPort = typeof addr === "object" && addr !== null ? addr.port : port;

      resolve({
        port: actualPort,
        stop: async () => {
          return new Promise<void>((resolveStop, rejectStop) => {
            server.close((err) => {
              if (err) {
                rejectStop(
                  new NetworkProxyError("Failed to stop network proxy", {
                    cause: err.message,
                  }),
                );
              } else {
                resolveStop();
              }
            });
            // 남아있는 연결을 강제 종료
            server.closeAllConnections?.();
          });
        },
      });
    });
  });
}

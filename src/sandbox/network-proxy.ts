import { createServer, type Server, type IncomingMessage, type ServerResponse } from "node:http";
import { connect, type Socket } from "node:net";
import { URL } from "node:url";
import { BaseError } from "../utils/error.js";
import { isHostAllowed, type NetworkPolicy } from "./network-policy.js";

/** Network proxy error */
export class NetworkProxyError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "NETWORK_PROXY_ERROR", context);
  }
}

/** Options for starting the network proxy */
export interface ProxyOptions {
  /** Port to listen on (0 = auto-assign) */
  readonly port: number;
  /** Network policy to enforce */
  readonly policy: NetworkPolicy;
  /** Callback when a connection is blocked */
  readonly onBlocked?: (host: string) => void;
}

/** Result of starting a proxy */
export interface ProxyHandle {
  /** Actual port the proxy is listening on */
  readonly port: number;
  /** Stop the proxy and clean up */
  readonly stop: () => Promise<void>;
}

/**
 * Extract host from a CONNECT request target (host:port format).
 */
function extractHostFromConnect(url: string): string {
  // CONNECT requests use host:port format
  const colonIndex = url.lastIndexOf(":");
  if (colonIndex > 0) {
    return url.slice(0, colonIndex);
  }
  return url;
}

/**
 * Extract host from a regular HTTP request URL.
 */
function extractHostFromUrl(urlString: string): string {
  try {
    const parsed = new URL(urlString);
    return parsed.hostname;
  } catch {
    // Fallback: try to extract from Host-like format
    const colonIndex = urlString.lastIndexOf(":");
    if (colonIndex > 0) {
      return urlString.slice(0, colonIndex);
    }
    return urlString;
  }
}

/**
 * Handle HTTP CONNECT method for HTTPS tunneling.
 * If allowed, establishes a TCP tunnel to the target.
 * If denied, responds with 403 Forbidden.
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

  if (!isHostAllowed(host, policy)) {
    onBlocked?.(host);
    clientSocket.write(
      "HTTP/1.1 403 Forbidden\r\nContent-Type: text/plain\r\n\r\nBlocked by network policy\r\n",
    );
    clientSocket.end();
    return;
  }

  // Parse target host:port
  const colonIndex = target.lastIndexOf(":");
  const targetHost = colonIndex > 0 ? target.slice(0, colonIndex) : target;
  const targetPort = colonIndex > 0 ? parseInt(target.slice(colonIndex + 1), 10) : 443;

  const serverSocket = connect(targetPort, targetHost, () => {
    clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
    serverSocket.write(head);
    serverSocket.pipe(clientSocket);
    clientSocket.pipe(serverSocket);
  });

  serverSocket.on("error", () => {
    clientSocket.end();
  });

  clientSocket.on("error", () => {
    serverSocket.end();
  });
}

/**
 * Handle plain HTTP requests (non-CONNECT).
 * If allowed, forwards the request to the target.
 * If denied, responds with 403 Forbidden.
 */
function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  policy: NetworkPolicy,
  onBlocked?: (host: string) => void,
): void {
  const urlString = req.url ?? "";
  const host = req.headers.host
    ? extractHostFromUrl(`http://${req.headers.host}`)
    : extractHostFromUrl(urlString);

  if (!isHostAllowed(host, policy)) {
    onBlocked?.(host);
    res.writeHead(403, { "Content-Type": "text/plain" });
    res.end("Blocked by network policy\n");
    return;
  }

  // Forward the request
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

  const serverSocket = connect(targetPort, targetHost, () => {
    // Reconstruct the HTTP request line with just the path
    const path = targetUrl.pathname + targetUrl.search;
    let requestLine = `${req.method} ${path} HTTP/${req.httpVersion}\r\n`;

    // Forward headers
    const rawHeaders = req.rawHeaders;
    for (let i = 0; i < rawHeaders.length; i += 2) {
      requestLine += `${rawHeaders[i]}: ${rawHeaders[i + 1]}\r\n`;
    }
    requestLine += "\r\n";

    serverSocket.write(requestLine);
    req.pipe(serverSocket);

    // Forward response back
    const clientSocket = res.socket;
    if (clientSocket) {
      serverSocket.pipe(clientSocket);
    }
  });

  serverSocket.on("error", () => {
    if (!res.headersSent) {
      res.writeHead(502, { "Content-Type": "text/plain" });
      res.end("Bad gateway\n");
    }
  });
}

/**
 * Start a simple HTTP proxy that enforces network policy.
 *
 * The proxy:
 * 1. Listens on localhost:{port}
 * 2. For CONNECT requests (HTTPS), checks the target host against policy
 * 3. For plain HTTP requests, checks the target host against policy
 * 4. Allowed connections are tunneled through
 * 5. Denied connections receive a 403 response
 *
 * Returns a handle with the actual port and a stop function.
 */
export async function startNetworkProxy(options: ProxyOptions): Promise<ProxyHandle> {
  const { port, policy, onBlocked } = options;

  const server: Server = createServer((req, res) => {
    handleRequest(req, res, policy, onBlocked);
  });

  // Handle CONNECT method for HTTPS tunneling
  server.on("connect", (req: IncomingMessage, clientSocket: Socket, head: Buffer) => {
    handleConnect(req, clientSocket, head, policy, onBlocked);
  });

  // Start listening
  return new Promise<ProxyHandle>((resolve, reject) => {
    server.on("error", (err) => {
      reject(
        new NetworkProxyError("Failed to start network proxy", {
          port,
          cause: err.message,
        }),
      );
    });

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
            // Force-close any remaining connections
            server.closeAllConnections?.();
          });
        },
      });
    });
  });
}

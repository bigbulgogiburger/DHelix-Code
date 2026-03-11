/**
 * HTTP Streamable Transport — uses native fetch() for JSON-RPC over HTTP.
 * Supports streaming responses via ReadableStream.
 */
import { BaseError } from "../../utils/error.js";
import { type MCPServerConfig, type JsonRpcMessage } from "../types.js";
import { type MCPTransportLayer } from "./base.js";

export class HttpTransportError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "HTTP_TRANSPORT_ERROR", context);
  }
}

/** Default timeout for HTTP requests (30 seconds) */
const DEFAULT_HTTP_TIMEOUT_MS = 30_000;

/** Maximum retry attempts for transient failures */
const MAX_RETRIES = 3;

/** Base delay for exponential backoff (ms) */
const RETRY_BASE_DELAY_MS = 1_000;

export class HttpTransport implements MCPTransportLayer {
  private messageHandler: ((message: JsonRpcMessage) => void) | null = null;
  private errorHandler: ((error: Error) => void) | null = null;
  private closeHandler: (() => void) | null = null;
  private readonly url: string;
  private readonly headers: Record<string, string>;

  constructor(private readonly config: MCPServerConfig) {
    if (!config.url) {
      throw new HttpTransportError("HTTP transport requires a url", {
        server: config.name,
      });
    }
    this.url = config.url;
    this.headers = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    };
  }

  async connect(): Promise<void> {
    // HTTP is stateless — connection is validated on first request.
    // We do a lightweight check that the URL is reachable.
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), DEFAULT_HTTP_TIMEOUT_MS);

      const response = await fetch(this.url, {
        method: "POST",
        headers: this.headers,
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

      // Process the initialize response
      const contentType = response.headers.get("content-type") ?? "";

      if (contentType.includes("text/event-stream")) {
        await this.consumeSSEStream(response);
      } else {
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

  async disconnect(): Promise<void> {
    this.closeHandler?.();
  }

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

  sendNotification(method: string, params: Record<string, unknown>): void {
    const notification = {
      jsonrpc: "2.0" as const,
      method,
      params,
    };

    // Notifications are fire-and-forget; errors go to the error handler
    this.postMessage(notification).catch((error) => {
      this.errorHandler?.(error instanceof Error ? error : new HttpTransportError(String(error)));
    });
  }

  onMessage(handler: (message: JsonRpcMessage) => void): void {
    this.messageHandler = handler;
  }

  onError(handler: (error: Error) => void): void {
    this.errorHandler = handler;
  }

  onClose(handler: () => void): void {
    this.closeHandler = handler;
  }

  /** Post a JSON-RPC message and deliver the response to the message handler */
  private async postMessage(message: Record<string, unknown>): Promise<void> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_HTTP_TIMEOUT_MS);

    try {
      const response = await fetch(this.url, {
        method: "POST",
        headers: this.headers,
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

      // 202 Accepted = notification acknowledged, no body
      if (response.status === 202) return;

      const contentType = response.headers.get("content-type") ?? "";

      if (contentType.includes("text/event-stream")) {
        await this.consumeSSEStream(response);
      } else {
        const body = (await response.json()) as JsonRpcMessage;
        this.messageHandler?.(body);
      }
    } finally {
      clearTimeout(timer);
    }
  }

  /** Post with exponential backoff retry for transient errors (5xx, network) */
  private async postWithRetry(message: Record<string, unknown>): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        await this.postMessage(message);
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new HttpTransportError(String(error));

        // Only retry on transient errors
        if (error instanceof HttpTransportError) {
          const status = error.context.status as number | undefined;
          if (status && status >= 400 && status < 500) {
            throw error; // Client errors are not retryable
          }
        }

        if (attempt < MAX_RETRIES - 1) {
          const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError ?? new HttpTransportError("Request failed after retries");
  }

  /** Consume a Server-Sent Events stream from an HTTP response */
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

        // Process complete SSE events (separated by double newlines)
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const event of events) {
          this.parseSSEEvent(event);
        }
      }

      // Process any remaining data
      if (buffer.trim()) {
        this.parseSSEEvent(buffer);
      }
    } finally {
      reader.releaseLock();
    }
  }

  /** Parse a single SSE event and dispatch to message handler */
  private parseSSEEvent(event: string): void {
    let data = "";

    for (const line of event.split("\n")) {
      if (line.startsWith("data: ")) {
        data += line.slice(6);
      } else if (line.startsWith("data:")) {
        data += line.slice(5);
      }
      // Ignore event:, id:, retry: fields for now
    }

    if (!data) return;

    try {
      const message = JSON.parse(data) as JsonRpcMessage;
      this.messageHandler?.(message);
    } catch {
      // Ignore unparseable SSE data
    }
  }
}

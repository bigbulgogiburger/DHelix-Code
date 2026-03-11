/**
 * SSE Transport — bidirectional communication using Server-Sent Events.
 * Client-to-server: HTTP POST requests.
 * Server-to-client: persistent SSE connection for streaming messages.
 */
import { BaseError } from "../../utils/error.js";
import { type MCPServerConfig, type JsonRpcMessage } from "../types.js";
import { type MCPTransportLayer } from "./base.js";

export class SseTransportError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "SSE_TRANSPORT_ERROR", context);
  }
}

/** Default timeout for HTTP POST requests (30 seconds) */
const DEFAULT_POST_TIMEOUT_MS = 30_000;

/** Maximum reconnection attempts for SSE stream */
const MAX_RECONNECT_ATTEMPTS = 5;

/** Base delay for exponential backoff reconnection (ms) */
const RECONNECT_BASE_DELAY_MS = 1_000;

/** Maximum reconnection delay (ms) */
const MAX_RECONNECT_DELAY_MS = 30_000;

export class SseTransport implements MCPTransportLayer {
  private messageHandler: ((message: JsonRpcMessage) => void) | null = null;
  private errorHandler: ((error: Error) => void) | null = null;
  private closeHandler: (() => void) | null = null;
  private connected = false;
  private sseAbortController: AbortController | null = null;
  private reconnectAttempts = 0;
  private readonly url: string;
  private postUrl: string;
  private lastEventId: string | null = null;

  constructor(private readonly config: MCPServerConfig) {
    if (!config.url) {
      throw new SseTransportError("SSE transport requires a url", {
        server: config.name,
      });
    }
    this.url = config.url;
    // POST URL may be provided via the SSE endpoint event; defaults to same URL
    this.postUrl = config.url;
  }

  async connect(): Promise<void> {
    this.sseAbortController = new AbortController();
    await this.establishSSEConnection();
    this.connected = true;
    this.reconnectAttempts = 0;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.sseAbortController?.abort();
    this.sseAbortController = null;
    this.closeHandler?.();
  }

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

  onMessage(handler: (message: JsonRpcMessage) => void): void {
    this.messageHandler = handler;
  }

  onError(handler: (error: Error) => void): void {
    this.errorHandler = handler;
  }

  onClose(handler: () => void): void {
    this.closeHandler = handler;
  }

  /** Establish the SSE connection for server-to-client messages */
  private async establishSSEConnection(): Promise<void> {
    const headers: Record<string, string> = {
      Accept: "text/event-stream",
      "Cache-Control": "no-cache",
    };

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

    // Consume the SSE stream in the background
    this.consumeStream(response).catch((error) => {
      if (this.connected) {
        this.errorHandler?.(error instanceof Error ? error : new SseTransportError(String(error)));
        this.attemptReconnect();
      }
    });
  }

  /** Send a JSON-RPC message via HTTP POST */
  private async postMessage(message: Record<string, unknown>): Promise<void> {
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

      // Some servers may return a response body for POST requests
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

  /** Consume the SSE stream, parsing events and dispatching messages */
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

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE events (separated by double newlines)
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const event of events) {
          this.parseSSEEvent(event);
        }
      }

      // Process remaining buffer
      if (buffer.trim()) {
        this.parseSSEEvent(buffer);
      }
    } finally {
      reader.releaseLock();
    }

    // Stream ended — attempt reconnect if still connected
    if (this.connected) {
      this.attemptReconnect();
    }
  }

  /** Parse a single SSE event block */
  private parseSSEEvent(event: string): void {
    let data = "";
    let eventType = "";

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

    // Handle endpoint event — server provides the POST URL
    if (eventType === "endpoint" && data) {
      try {
        const baseUrl = new URL(this.url);
        this.postUrl = new URL(data.trim(), baseUrl).toString();
      } catch {
        // Keep existing postUrl on parse failure
      }
      return;
    }

    if (!data) return;

    try {
      const message = JSON.parse(data) as JsonRpcMessage;
      this.messageHandler?.(message);
    } catch {
      // Ignore unparseable SSE data
    }
  }

  /** Attempt to reconnect the SSE stream with exponential backoff */
  private attemptReconnect(): void {
    if (!this.connected) return;
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

    const delay = Math.min(
      RECONNECT_BASE_DELAY_MS * Math.pow(2, this.reconnectAttempts),
      MAX_RECONNECT_DELAY_MS,
    );
    this.reconnectAttempts++;

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

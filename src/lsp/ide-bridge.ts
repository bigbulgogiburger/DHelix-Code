/**
 * IDE Bridge Client — Connects to VS Code extension's IPC server
 *
 * Provides LSPSession-compatible interface backed by the IDE's language servers.
 * When connected, IDE bridge results are preferred over self-managed LSP servers.
 *
 * Connection lifecycle:
 * 1. Auto-detect socket path from workspace
 * 2. Connect via Unix Domain Socket / Named Pipe
 * 3. Exchange capabilities (initialize handshake)
 * 4. Forward LSP requests through IPC
 * 5. Receive push notifications (diagnostics changes)
 * 6. Reconnect on disconnect (with backoff)
 */

import { createConnection } from "node:net";
import type { Socket } from "node:net";
import { existsSync } from "node:fs";

import { getLogger } from "../utils/logger.js";
import { BaseError } from "../utils/error.js";
import type {
  DefinitionResult,
  ReferenceResult,
  TypeInfoResult,
  RenameEdit,
  LSPSession,
  LSPServerState,
  LSPLanguageId,
} from "./types.js";
import {
  getSocketPath,
  IDE_BRIDGE_PROTOCOL_VERSION,
  type IDECapabilities,
  type IDEBridgeMethod,
  type InitializeResult,
  type DefinitionResponse,
  type ReferencesResponse,
  type HoverResponse,
  type RenameResponse,
  type DiagnosticsResponse,
  type CodeActionsResponse,
  type ExecuteCodeActionResponse,
  type WorkspaceSymbolsResponse,
  type DocumentSymbolsResponse,
  type CallHierarchyPrepareResponse,
  type CallHierarchyIncomingResponse,
  type CallHierarchyOutgoingResponse,
  type DiagnosticEntry,
  type CodeActionEntry,
  type WorkspaceSymbolEntry,
  type DocumentSymbolEntry,
  type CallHierarchyItem,
  type CallHierarchyCall,
  type CallHierarchyOutgoingCall,
} from "./ide-bridge-protocol.js";

// ── Connection State ──

/** Connection state of the IDE Bridge client */
export type IDEBridgeState = "disconnected" | "connecting" | "connected" | "error";

// ── Error ──

/** Error specific to IDE Bridge operations */
export class IDEBridgeError extends BaseError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "IDE_BRIDGE_ERROR", details);
  }
}

// ── Event Callbacks ──

/** Event callbacks for IDE Bridge state changes and notifications */
export interface IDEBridgeEvents {
  readonly onStateChange?: (state: IDEBridgeState) => void;
  readonly onDiagnosticsChanged?: (filePath: string, diagnostics: readonly DiagnosticEntry[]) => void;
  readonly onDocumentChanged?: (filePath: string, version: number) => void;
  readonly onDisconnected?: () => void;
}

// ── Configuration ──

/** IDE Bridge client configuration */
export interface IDEBridgeConfig {
  readonly workspacePath: string;
  readonly reconnectIntervalMs?: number;    // Default: 5000
  readonly maxReconnectAttempts?: number;   // Default: 3
  readonly requestTimeoutMs?: number;       // Default: 10000
  readonly events?: IDEBridgeEvents;
}

// ── Pending Request ──

interface PendingRequest {
  readonly resolve: (value: unknown) => void;
  readonly reject: (error: Error) => void;
  readonly timer: ReturnType<typeof setTimeout>;
}

// ── JSON-RPC Message ──

interface JsonRpcRequest {
  readonly jsonrpc: "2.0";
  readonly id: number;
  readonly method: IDEBridgeMethod;
  readonly params: unknown;
}

interface JsonRpcResponse {
  readonly jsonrpc: "2.0";
  readonly id?: number;
  readonly method?: string;
  readonly result?: unknown;
  readonly error?: {
    readonly code: number;
    readonly message: string;
    readonly data?: unknown;
  };
  readonly params?: unknown;
}

// ── Required Config (defaults applied) ──

interface ResolvedConfig {
  readonly workspacePath: string;
  readonly reconnectIntervalMs: number;
  readonly maxReconnectAttempts: number;
  readonly requestTimeoutMs: number;
  readonly events?: IDEBridgeEvents;
}

// ── Client ──

/**
 * IDE Bridge Client — IPC client that connects to the VS Code extension's
 * JSON-RPC 2.0 server over Unix Domain Sockets (or Named Pipes on Windows).
 *
 * Reuses protocol types from `ide-bridge-protocol.ts` and provides
 * an LSPSession-compatible wrapper via `createSession()`.
 */
export class IDEBridgeClient {
  private state: IDEBridgeState = "disconnected";
  private capabilities: IDECapabilities | undefined;
  private socket: Socket | undefined;
  private requestId = 0;
  private readonly pendingRequests: Map<number, PendingRequest> = new Map();
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly config: ResolvedConfig;
  private receiveBuffer = "";
  private readonly socketPath: string;

  constructor(config: IDEBridgeConfig) {
    this.config = {
      workspacePath: config.workspacePath,
      reconnectIntervalMs: config.reconnectIntervalMs ?? 5000,
      maxReconnectAttempts: config.maxReconnectAttempts ?? 3,
      requestTimeoutMs: config.requestTimeoutMs ?? 10_000,
      events: config.events,
    };
    this.socketPath = getSocketPath(config.workspacePath);
  }

  // ── Connection Management ──

  /** Whether the client is currently connected */
  get isConnected(): boolean {
    return this.state === "connected";
  }

  /** Current connection state */
  get currentState(): IDEBridgeState {
    return this.state;
  }

  /** IDE capabilities reported during handshake (undefined if not connected) */
  get ideCapabilities(): IDECapabilities | undefined {
    return this.capabilities;
  }

  /** Get the socket path for the configured workspace */
  getSocketPath(): string {
    return this.socketPath;
  }

  /** Check if the IDE bridge socket exists (quick availability check) */
  isSocketAvailable(): boolean {
    if (process.platform === "win32") {
      // Named pipes cannot be checked with existsSync
      return true;
    }
    return existsSync(this.socketPath);
  }

  /** Connect to the VS Code extension's IPC server */
  async connect(): Promise<void> {
    if (this.state === "connected") return;

    const log = getLogger();

    if (!this.isSocketAvailable()) {
      throw new IDEBridgeError("IDE bridge socket not found", { socketPath: this.socketPath });
    }

    this.setState("connecting");
    log.info({ socketPath: this.socketPath }, "IDE Bridge: connecting");

    return new Promise<void>((resolve, reject) => {
      const socket = createConnection(this.socketPath);
      this.socket = socket;

      const connectTimeout = setTimeout(() => {
        socket.destroy();
        this.setState("error");
        reject(new IDEBridgeError("Connection timeout", { socketPath: this.socketPath }));
      }, this.config.requestTimeoutMs);

      socket.on("connect", () => {
        clearTimeout(connectTimeout);
        this.receiveBuffer = "";
        socket.on("data", (data: Buffer) => this.handleData(data));

        // Perform initialize handshake
        this.sendRequest("initialize", {
          clientName: "dhelix-cli",
          clientVersion: IDE_BRIDGE_PROTOCOL_VERSION,
          workspacePath: this.config.workspacePath,
        })
          .then((result) => {
            const initResult = result as InitializeResult;
            this.capabilities = initResult.capabilities;
            this.setState("connected");
            this.reconnectAttempts = 0;
            log.info({ capabilities: this.capabilities }, "IDE Bridge: connected");
            resolve();
          })
          .catch((error: unknown) => {
            this.setState("error");
            reject(error instanceof Error ? error : new IDEBridgeError(String(error)));
          });
      });

      socket.on("error", (error: Error) => {
        clearTimeout(connectTimeout);
        log.warn({ error: error.message }, "IDE Bridge: socket error");
        this.setState("error");
        reject(new IDEBridgeError(`Socket error: ${error.message}`));
      });

      socket.on("close", () => {
        log.info("IDE Bridge: disconnected");
        this.cleanupConnection();
        this.setState("disconnected");
        this.config.events?.onDisconnected?.();
        this.tryReconnect();
      });
    });
  }

  /** Disconnect from the IDE gracefully */
  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    // Prevent reconnection attempts after explicit disconnect
    this.reconnectAttempts = this.config.maxReconnectAttempts;

    if (this.socket) {
      try {
        await this.sendRequest("shutdown", {});
      } catch {
        // Ignore shutdown errors — we are disconnecting anyway
      }
      this.socket.destroy();
      this.cleanupConnection();
    }
    this.setState("disconnected");
  }

  // ── LSP Methods (matching LSPSession interface) ──

  /** Go to definition at position */
  async gotoDefinition(
    filePath: string,
    line: number,
    column: number,
  ): Promise<readonly DefinitionResult[]> {
    const response = await this.sendRequest("lsp/definition", { filePath, line, column });
    return (response as DefinitionResponse).results;
  }

  /** Find all references to symbol at position */
  async findReferences(
    filePath: string,
    line: number,
    column: number,
    includeDeclaration?: boolean,
  ): Promise<readonly ReferenceResult[]> {
    const response = await this.sendRequest("lsp/references", {
      filePath,
      line,
      column,
      includeDeclaration,
    });
    return (response as ReferencesResponse).results;
  }

  /** Get type/hover info at position */
  async getTypeInfo(
    filePath: string,
    line: number,
    column: number,
  ): Promise<TypeInfoResult | undefined> {
    const response = await this.sendRequest("lsp/hover", { filePath, line, column });
    return (response as HoverResponse).result;
  }

  /** Rename symbol at position */
  async rename(
    filePath: string,
    line: number,
    column: number,
    newName: string,
  ): Promise<readonly RenameEdit[]> {
    const response = await this.sendRequest("lsp/rename", { filePath, line, column, newName });
    return (response as RenameResponse).edits;
  }

  // ── Extended IDE Methods ──

  /** Get diagnostics (errors/warnings) for a file */
  async getDiagnostics(filePath: string): Promise<readonly DiagnosticEntry[]> {
    const response = await this.sendRequest("lsp/diagnostics", { filePath });
    return (response as DiagnosticsResponse).diagnostics;
  }

  /** Get code actions for a range (quick fixes, refactorings) */
  async getCodeActions(
    filePath: string,
    startLine: number,
    startColumn: number,
    endLine: number,
    endColumn: number,
    diagnosticMessages?: readonly string[],
  ): Promise<readonly CodeActionEntry[]> {
    const response = await this.sendRequest("lsp/codeActions", {
      filePath,
      startLine,
      startColumn,
      endLine,
      endColumn,
      diagnosticMessages,
    });
    return (response as CodeActionsResponse).actions;
  }

  /** Execute a previously-retrieved code action by its opaque ID */
  async executeCodeAction(actionId: string): Promise<ExecuteCodeActionResponse> {
    const response = await this.sendRequest("lsp/executeCodeAction", { actionId });
    return response as ExecuteCodeActionResponse;
  }

  /** Search workspace symbols by query string */
  async searchWorkspaceSymbols(
    query: string,
    limit?: number,
  ): Promise<readonly WorkspaceSymbolEntry[]> {
    const response = await this.sendRequest("lsp/workspaceSymbols", { query, limit });
    return (response as WorkspaceSymbolsResponse).symbols;
  }

  /** Get document symbols (outline) for a file */
  async getDocumentSymbols(filePath: string): Promise<readonly DocumentSymbolEntry[]> {
    const response = await this.sendRequest("lsp/documentSymbols", { filePath });
    return (response as DocumentSymbolsResponse).symbols;
  }

  /** Prepare call hierarchy at position */
  async prepareCallHierarchy(
    filePath: string,
    line: number,
    column: number,
  ): Promise<readonly CallHierarchyItem[]> {
    const response = await this.sendRequest("lsp/callHierarchy/prepare", {
      filePath,
      line,
      column,
    });
    return (response as CallHierarchyPrepareResponse).items;
  }

  /** Get incoming calls for a call hierarchy item */
  async getIncomingCalls(itemId: string): Promise<readonly CallHierarchyCall[]> {
    const response = await this.sendRequest("lsp/callHierarchy/incoming", { itemId });
    return (response as CallHierarchyIncomingResponse).calls;
  }

  /** Get outgoing calls from a call hierarchy item */
  async getOutgoingCalls(itemId: string): Promise<readonly CallHierarchyOutgoingCall[]> {
    const response = await this.sendRequest("lsp/callHierarchy/outgoing", { itemId });
    return (response as CallHierarchyOutgoingResponse).calls;
  }

  // ── LSPSession Adapter ──

  /**
   * Create an LSPSession wrapper for compatibility with existing tool code.
   *
   * The returned session delegates all LSP calls to the IDE bridge.
   * Document open/close are no-ops since the IDE manages document lifecycle.
   */
  createSession(language: LSPLanguageId): LSPSession {
    const client = this;

    return {
      language,
      get state(): LSPServerState {
        return client.isConnected ? "running" : "stopped";
      },
      gotoDefinition: (f, l, c) => client.gotoDefinition(f, l, c),
      findReferences: (f, l, c, incl) => client.findReferences(f, l, c, incl),
      getTypeInfo: (f, l, c) => client.getTypeInfo(f, l, c),
      rename: (f, l, c, n) => client.rename(f, l, c, n),
      openDocument: async (_filePath: string) => {
        /* IDE handles document lifecycle */
      },
      closeDocument: async (_filePath: string) => {
        /* IDE handles document lifecycle */
      },
    };
  }

  // ── Private: State ──

  private setState(newState: IDEBridgeState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.config.events?.onStateChange?.(newState);
    }
  }

  // ── Private: JSON-RPC Transport ──

  private sendRequest(method: IDEBridgeMethod, params: unknown): Promise<unknown> {
    if (!this.socket || this.socket.destroyed) {
      return Promise.reject(new IDEBridgeError("Not connected to IDE", { method }));
    }

    const id = ++this.requestId;

    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new IDEBridgeError(`Request timeout: ${method}`, { method, id }));
      }, this.config.requestTimeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timer });

      const request: JsonRpcRequest = {
        jsonrpc: "2.0",
        id,
        method,
        params,
      };

      const body = JSON.stringify(request);
      // Content-Length header for JSON-RPC framing (LSP base protocol)
      const frame = `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`;
      this.socket!.write(frame);
    });
  }

  private handleData(data: Buffer): void {
    this.receiveBuffer += data.toString("utf-8");
    this.drainBuffer();
  }

  /** Parse all complete Content-Length framed messages from the buffer */
  private drainBuffer(): void {
    while (true) {
      const headerEnd = this.receiveBuffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) break;

      const header = this.receiveBuffer.slice(0, headerEnd);
      const contentLengthMatch = /Content-Length:\s*(\d+)/i.exec(header);
      if (!contentLengthMatch) {
        // Skip malformed header
        this.receiveBuffer = this.receiveBuffer.slice(headerEnd + 4);
        continue;
      }

      const contentLength = parseInt(contentLengthMatch[1], 10);
      const bodyStart = headerEnd + 4;
      const bodyEnd = bodyStart + contentLength;

      if (this.receiveBuffer.length < bodyEnd) {
        // Incomplete message — wait for more data
        break;
      }

      const body = this.receiveBuffer.slice(bodyStart, bodyEnd);
      this.receiveBuffer = this.receiveBuffer.slice(bodyEnd);

      this.processMessage(body);
    }
  }

  private processMessage(body: string): void {
    try {
      const message = JSON.parse(body) as JsonRpcResponse;

      if (message.id !== undefined && message.id !== null) {
        // Response to a pending request
        const pending = this.pendingRequests.get(message.id);
        if (pending) {
          clearTimeout(pending.timer);
          this.pendingRequests.delete(message.id);

          if (message.error) {
            pending.reject(
              new IDEBridgeError(message.error.message, {
                code: message.error.code,
                data: message.error.data,
              }),
            );
          } else {
            pending.resolve(message.result);
          }
        }
      } else if (message.method) {
        // Notification from server (no id)
        this.handleNotification(message.method, message.params);
      }
    } catch (error) {
      getLogger().warn({ error: String(error) }, "IDE Bridge: failed to parse message");
    }
  }

  // ── Private: Notifications ──

  private handleNotification(method: string, params: unknown): void {
    const p = params as Record<string, unknown>;

    switch (method) {
      case "diagnostics/changed":
        this.config.events?.onDiagnosticsChanged?.(
          p["filePath"] as string,
          p["diagnostics"] as DiagnosticEntry[],
        );
        break;

      case "document/changed":
        this.config.events?.onDocumentChanged?.(
          p["filePath"] as string,
          p["version"] as number,
        );
        break;

      default:
        getLogger().debug({ method }, "IDE Bridge: unknown notification");
    }
  }

  // ── Private: Connection Cleanup & Reconnect ──

  private cleanupConnection(): void {
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new IDEBridgeError("Connection closed"));
    }
    this.pendingRequests.clear();
    this.capabilities = undefined;
    this.socket = undefined;
  }

  private tryReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) return;

    this.reconnectAttempts++;
    // Linear backoff: delay increases with each attempt
    const delay = this.config.reconnectIntervalMs * this.reconnectAttempts;

    getLogger().info(
      { attempt: this.reconnectAttempts, delayMs: delay },
      "IDE Bridge: scheduling reconnect",
    );

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect();
      } catch {
        // connect() failure triggers close handler which calls tryReconnect again
      }
    }, delay);

    // Prevent the timer from keeping the process alive
    if (this.reconnectTimer && typeof this.reconnectTimer === "object" && "unref" in this.reconnectTimer) {
      (this.reconnectTimer as NodeJS.Timeout).unref();
    }
  }
}

// ── Singleton ──

let singletonBridge: IDEBridgeClient | undefined;

/**
 * Get or create the IDE Bridge singleton.
 * Returns undefined if no workspace path is provided and no singleton exists.
 */
export function getIDEBridge(workspacePath?: string): IDEBridgeClient | undefined {
  if (!workspacePath) return singletonBridge;

  if (
    !singletonBridge ||
    singletonBridge.getSocketPath() !== getSocketPath(workspacePath)
  ) {
    singletonBridge = new IDEBridgeClient({ workspacePath });
  }
  return singletonBridge;
}

/**
 * Try to connect to IDE bridge if available.
 * Returns the connected client, or undefined if the socket is absent
 * or the connection fails.
 */
export async function tryConnectIDEBridge(
  workspacePath: string,
): Promise<IDEBridgeClient | undefined> {
  const bridge = getIDEBridge(workspacePath);
  if (!bridge) return undefined;

  if (bridge.isConnected) return bridge;
  if (!bridge.isSocketAvailable()) return undefined;

  try {
    await bridge.connect();
    return bridge;
  } catch {
    return undefined;
  }
}

/** Dispose the IDE Bridge singleton and disconnect */
export async function disposeIDEBridge(): Promise<void> {
  if (singletonBridge) {
    await singletonBridge.disconnect();
    singletonBridge = undefined;
  }
}

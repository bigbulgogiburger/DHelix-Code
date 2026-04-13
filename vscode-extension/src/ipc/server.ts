/**
 * IPC Server — Unix domain socket (or Windows Named Pipe) server
 * that accepts JSON-RPC 2.0 connections from the DHelix CLI.
 *
 * This module is pure Node.js — it must NOT import the `vscode` namespace.
 */

import * as crypto from "node:crypto";
import { EventEmitter } from "node:events";
import * as fs from "node:fs";
import * as net from "node:net";
import * as os from "node:os";
import * as path from "node:path";

import {
  createMessageConnection,
  StreamMessageReader,
  StreamMessageWriter,
  type CancellationToken,
} from "vscode-jsonrpc/node";

import { ConnectionHandler, type ConnectionInfo } from "./connection-handler.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface IPCServerOptions {
  /** Absolute workspace path used to derive the socket address. */
  readonly workspacePath: string;

  /**
   * Handler invoked for every JSON-RPC request received from a client.
   * The returned value (or thrown error) is forwarded back to the caller.
   */
  readonly onRequest: (method: string, params: unknown, connectionId: string) => Promise<unknown>;

  /** Optional handler for one-way JSON-RPC notifications from clients. */
  readonly onNotification?: (method: string, params: unknown, connectionId: string) => void;
}

export interface IPCServerEvents {
  clientConnected: [info: ConnectionInfo];
  clientDisconnected: [id: string];
  error: [error: Error];
}

// ---------------------------------------------------------------------------
// Socket path helper
// ---------------------------------------------------------------------------

/**
 * Derive a deterministic socket path from a workspace path.
 *
 * - macOS / Linux: `/tmp/dhelix-bridge-<hash>.sock`
 * - Windows:       `\\.\pipe\dhelix-bridge-<hash>`
 */
export function getSocketPath(workspacePath: string): string {
  const hash = crypto.createHash("md5").update(workspacePath).digest("hex").slice(0, 8);

  if (process.platform === "win32") {
    return `\\\\.\\pipe\\dhelix-bridge-${hash}`;
  }
  return path.join(os.tmpdir(), `dhelix-bridge-${hash}.sock`);
}

// ---------------------------------------------------------------------------
// IPCServer
// ---------------------------------------------------------------------------

export class IPCServer extends EventEmitter {
  private server: net.Server | undefined;
  private readonly handlers = new Map<string, ConnectionHandler>();
  private readonly socketPath: string;
  private readonly options: IPCServerOptions;
  private _running = false;

  constructor(options: IPCServerOptions) {
    super();
    this.options = options;
    this.socketPath = getSocketPath(options.workspacePath);
  }

  // -----------------------------------------------------------------------
  // Accessors
  // -----------------------------------------------------------------------

  get isRunning(): boolean {
    return this._running;
  }

  get clientCount(): number {
    return this.handlers.size;
  }

  /** Snapshot of all active connections. */
  get connections(): readonly ConnectionInfo[] {
    return [...this.handlers.values()].map((h) => h.info);
  }

  /** The socket address the server is (or will be) listening on. */
  get address(): string {
    return this.socketPath;
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  /**
   * Start listening for incoming connections.
   *
   * If a stale socket file exists it is removed first.  On `EADDRINUSE` the
   * method will attempt one retry after cleaning up the leftover file.
   */
  async start(): Promise<void> {
    if (this._running) {
      return;
    }

    await this.cleanupStaleSocket();

    return new Promise<void>((resolve, reject) => {
      const server = net.createServer((socket) => {
        this.handleConnection(socket);
      });

      server.on("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE") {
          // Another process may have grabbed the socket between cleanup and
          // listen — try once more.
          this.cleanupStaleSocket()
            .then(() => {
              server.listen(this.socketPath, () => {
                this.server = server;
                this._running = true;
                resolve();
              });
            })
            .catch((retryErr) => {
              this.emitError(retryErr as Error);
              reject(retryErr);
            });
          return;
        }
        this.emitError(err);
        reject(err);
      });

      server.listen(this.socketPath, () => {
        this.server = server;
        this._running = true;
        resolve();
      });
    });
  }

  /**
   * Gracefully stop the server.
   *
   * All client connections are disposed, the server is closed, and the socket
   * file is removed.
   */
  async stop(): Promise<void> {
    if (!this._running) {
      return;
    }

    // 1. Dispose every active connection.
    for (const handler of this.handlers.values()) {
      try {
        handler.dispose();
      } catch {
        // Best-effort — we are shutting down.
      }
    }
    this.handlers.clear();

    // 2. Close the server.
    await new Promise<void>((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });

    this.server = undefined;
    this._running = false;

    // 3. Remove socket file.
    await this.cleanupStaleSocket();
  }

  /** Send a JSON-RPC notification to every connected client. */
  sendNotification(method: string, params: unknown): void {
    for (const handler of this.handlers.values()) {
      try {
        handler.connection.sendNotification(method, params as object);
      } catch {
        // Swallow — the client may have disconnected between the check and
        // the send.
      }
    }
  }

  /** Send a JSON-RPC notification to a single client by id. */
  sendNotificationTo(connectionId: string, method: string, params: unknown): void {
    const handler = this.handlers.get(connectionId);
    if (handler) {
      handler.connection.sendNotification(method, params as object);
    }
  }

  /** Alias for `stop()` — intended for `Disposable` consumers. */
  dispose(): void {
    void this.stop();
  }

  // -----------------------------------------------------------------------
  // Private
  // -----------------------------------------------------------------------

  private handleConnection(socket: net.Socket): void {
    const connectionId = crypto.randomUUID();
    const reader = new StreamMessageReader(socket);
    const writer = new StreamMessageWriter(socket);
    const connection = createMessageConnection(reader, writer);

    const handler = new ConnectionHandler(connectionId, connection);

    // Register a star request handler that forwards all methods to the
    // consumer-provided callback.
    connection.onRequest(
      (method: string, params: unknown[] | object | undefined, _token: CancellationToken) => {
        // The `initialize` method is handled internally to capture client
        // metadata, then forwarded to the consumer.
        if (method === "initialize" && isInitializeParams(params)) {
          handler.markInitialized(
            (params as Record<string, string>).clientName ?? "unknown",
            (params as Record<string, string>).clientVersion ?? "unknown",
          );
        }

        return this.options.onRequest(method, params, connectionId);
      },
    );

    // Forward notifications via the star notification handler.
    if (this.options.onNotification) {
      connection.onNotification((method: string, params: unknown[] | object | undefined) => {
        this.options.onNotification!(method, params, connectionId);
      });
    }

    // Track disconnection.
    connection.onClose(() => {
      this.handlers.delete(connectionId);
      this.emit("clientDisconnected", connectionId);
    });

    connection.onError((error) => {
      const err = error instanceof Error ? error : new Error(String(error));
      this.emitError(err);
    });

    // Handle raw socket errors (e.g. ECONNRESET).
    socket.on("error", (err) => {
      this.emitError(err);
      this.handlers.delete(connectionId);
    });

    connection.listen();
    this.handlers.set(connectionId, handler);
    this.emit("clientConnected", handler.info);
  }

  /**
   * Remove a leftover socket file from a previous run (Unix only).
   * On Windows named pipes are managed by the OS and do not leave artefacts.
   */
  private async cleanupStaleSocket(): Promise<void> {
    if (process.platform === "win32") {
      return;
    }
    try {
      await fs.promises.unlink(this.socketPath);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        throw err;
      }
      // Socket file does not exist — nothing to clean up.
    }
  }

  private emitError(err: Error): void {
    this.emit("error", err);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isInitializeParams(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Connection Handler — manages individual client connection lifecycle
 * and metadata within the IPC server.
 *
 * This module is pure Node.js — it must NOT import the `vscode` namespace.
 */

import type { MessageConnection } from "vscode-jsonrpc/node";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Read-only snapshot of a connection's state. */
export interface ConnectionInfo {
  readonly id: string;
  readonly connection: MessageConnection;
  readonly connectedAt: number;
  readonly clientName: string | undefined;
  readonly clientVersion: string | undefined;
  readonly initialized: boolean;
}

// ---------------------------------------------------------------------------
// ConnectionHandler
// ---------------------------------------------------------------------------

/**
 * Wraps a single `MessageConnection` with metadata tracking.
 *
 * The handler starts in an *un-initialized* state.  Once the remote client
 * sends an `initialize` request the handler records the client name/version
 * and flips to *initialized*.
 */
export class ConnectionHandler {
  private _initialized = false;
  private _clientName: string | undefined;
  private _clientVersion: string | undefined;
  private readonly _connectedAt: number;

  constructor(
    readonly id: string,
    readonly connection: MessageConnection,
  ) {
    this._connectedAt = Date.now();
  }

  // -----------------------------------------------------------------------
  // Accessors
  // -----------------------------------------------------------------------

  /** Current snapshot of connection metadata. */
  get info(): ConnectionInfo {
    return Object.freeze({
      id: this.id,
      connection: this.connection,
      connectedAt: this._connectedAt,
      clientName: this._clientName,
      clientVersion: this._clientVersion,
      initialized: this._initialized,
    });
  }

  get isInitialized(): boolean {
    return this._initialized;
  }

  get clientName(): string | undefined {
    return this._clientName;
  }

  get clientVersion(): string | undefined {
    return this._clientVersion;
  }

  get connectedAt(): number {
    return this._connectedAt;
  }

  // -----------------------------------------------------------------------
  // Mutation
  // -----------------------------------------------------------------------

  /**
   * Mark the connection as initialized after the client completes
   * the handshake.
   */
  markInitialized(clientName: string, clientVersion: string): void {
    this._initialized = true;
    this._clientName = clientName;
    this._clientVersion = clientVersion;
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  /** Dispose the underlying JSON-RPC connection. */
  dispose(): void {
    this.connection.dispose();
  }
}

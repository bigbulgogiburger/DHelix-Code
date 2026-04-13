/**
 * IDE Bridge IPC Protocol — VS Code Extension <-> DHelix CLI
 *
 * JSON-RPC 2.0 over Unix Domain Socket / Named Pipe
 * Extension = Server (listens), CLI = Client (connects)
 *
 * Socket path convention:
 *   macOS/Linux: /tmp/dhelix-bridge-{md5(workspacePath).slice(0,8)}.sock
 *   Windows:     \\.\pipe\dhelix-bridge-{md5(workspacePath).slice(0,8)}
 */

import { createHash } from "node:crypto";
import { platform } from "node:os";

import type { DefinitionResult, ReferenceResult, TypeInfoResult, RenameEdit } from "./types.js";

// ── Protocol Version ──

export const IDE_BRIDGE_PROTOCOL_VERSION = "1.0.0" as const;

// ── Socket Path ──

/** Generate the IPC socket path for a given workspace */
export function getSocketPath(workspacePath: string): string {
  const hash = createHash("md5").update(workspacePath).digest("hex").slice(0, 8);

  if (platform() === "win32") {
    return `\\\\.\\pipe\\dhelix-bridge-${hash}`;
  }

  return `/tmp/dhelix-bridge-${hash}.sock`;
}

// ── Capabilities ──

/** IDE capabilities reported on connection */
export interface IDECapabilities {
  readonly languages: readonly string[];
  readonly supportsDiagnostics: boolean;
  readonly supportsCodeActions: boolean;
  readonly supportsWorkspaceSymbols: boolean;
  readonly supportsCallHierarchy: boolean;
  readonly ideType: "vscode" | "jetbrains" | "other";
  readonly ideVersion: string;
}

// ── Request Types ──

/** All request method names */
export type IDEBridgeMethod =
  | "initialize"
  | "lsp/definition"
  | "lsp/references"
  | "lsp/hover"
  | "lsp/rename"
  | "lsp/diagnostics"
  | "lsp/codeActions"
  | "lsp/executeCodeAction"
  | "lsp/workspaceSymbols"
  | "lsp/documentSymbols"
  | "lsp/callHierarchy/prepare"
  | "lsp/callHierarchy/incoming"
  | "lsp/callHierarchy/outgoing"
  | "shutdown";

/** Position in a document (1-based to match DHelix convention) */
export interface DocumentPosition {
  readonly filePath: string;
  readonly line: number; // 1-based
  readonly column: number; // 1-based
}

/** Range in a document (1-based) */
export interface DocumentRange {
  readonly filePath: string;
  readonly startLine: number;
  readonly startColumn: number;
  readonly endLine: number;
  readonly endColumn: number;
}

// ── Request/Response Pairs ──

// initialize
export interface InitializeParams {
  readonly clientName: string; // "dhelix-cli"
  readonly clientVersion: string;
  readonly workspacePath: string;
}

export interface InitializeResult {
  readonly capabilities: IDECapabilities;
  readonly serverVersion: string;
}

// lsp/definition
export interface DefinitionParams extends DocumentPosition {}

export interface DefinitionResponse {
  readonly results: readonly DefinitionResult[];
  readonly source: "ide" | "lsp" | "treesitter";
}

// lsp/references
export interface ReferencesParams extends DocumentPosition {
  readonly includeDeclaration?: boolean;
}

export interface ReferencesResponse {
  readonly results: readonly ReferenceResult[];
  readonly source: "ide" | "lsp" | "treesitter";
}

// lsp/hover
export interface HoverParams extends DocumentPosition {}

export interface HoverResponse {
  readonly result: TypeInfoResult | undefined;
  readonly source: "ide" | "lsp" | "treesitter";
}

// lsp/rename
export interface RenameParams extends DocumentPosition {
  readonly newName: string;
}

export interface RenameResponse {
  readonly edits: readonly RenameEdit[];
  readonly source: "ide" | "lsp" | "treesitter";
}

// lsp/diagnostics
export interface DiagnosticsParams {
  readonly filePath: string;
}

export interface DiagnosticEntry {
  readonly filePath: string;
  readonly line: number;
  readonly column: number;
  readonly endLine: number;
  readonly endColumn: number;
  readonly severity: "error" | "warning" | "info" | "hint";
  readonly message: string;
  readonly source?: string;
  readonly code?: string | number;
}

export interface DiagnosticsResponse {
  readonly diagnostics: readonly DiagnosticEntry[];
}

// lsp/codeActions
export interface CodeActionsParams extends DocumentRange {
  readonly diagnosticMessages?: readonly string[];
}

export interface CodeActionEntry {
  readonly title: string;
  readonly kind?: string; // "quickfix", "refactor", etc.
  readonly isPreferred?: boolean;
  readonly actionId: string; // Opaque ID for execution
}

export interface CodeActionsResponse {
  readonly actions: readonly CodeActionEntry[];
}

// lsp/executeCodeAction
export interface ExecuteCodeActionParams {
  readonly actionId: string;
}

export interface ExecuteCodeActionResponse {
  readonly applied: boolean;
  readonly filesChanged: readonly string[];
}

// lsp/workspaceSymbols
export interface WorkspaceSymbolsParams {
  readonly query: string;
  readonly limit?: number;
}

export interface WorkspaceSymbolEntry {
  readonly name: string;
  readonly kind: string; // "function", "class", etc.
  readonly filePath: string;
  readonly line: number;
  readonly column: number;
  readonly containerName?: string;
}

export interface WorkspaceSymbolsResponse {
  readonly symbols: readonly WorkspaceSymbolEntry[];
}

// lsp/documentSymbols
export interface DocumentSymbolsParams {
  readonly filePath: string;
}

export interface DocumentSymbolEntry {
  readonly name: string;
  readonly kind: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly children?: readonly DocumentSymbolEntry[];
}

export interface DocumentSymbolsResponse {
  readonly symbols: readonly DocumentSymbolEntry[];
}

// lsp/callHierarchy/prepare
export interface CallHierarchyPrepareParams extends DocumentPosition {}

export interface CallHierarchyItem {
  readonly name: string;
  readonly kind: string;
  readonly filePath: string;
  readonly line: number;
  readonly column: number;
  readonly itemId: string; // Opaque ID
}

export interface CallHierarchyPrepareResponse {
  readonly items: readonly CallHierarchyItem[];
}

// lsp/callHierarchy/incoming
export interface CallHierarchyIncomingParams {
  readonly itemId: string;
}

export interface CallHierarchyCall {
  readonly from: CallHierarchyItem;
  readonly fromRanges: readonly DocumentRange[];
}

export interface CallHierarchyIncomingResponse {
  readonly calls: readonly CallHierarchyCall[];
}

// lsp/callHierarchy/outgoing
export interface CallHierarchyOutgoingParams {
  readonly itemId: string;
}

export interface CallHierarchyOutgoingCall {
  readonly to: CallHierarchyItem;
  readonly fromRanges: readonly DocumentRange[];
}

export interface CallHierarchyOutgoingResponse {
  readonly calls: readonly CallHierarchyOutgoingCall[];
}

// shutdown
export interface ShutdownParams {}

export interface ShutdownResponse {
  readonly success: boolean;
}

// ── Notification Types (Server -> Client push) ──

export type IDEBridgeNotification =
  | "diagnostics/changed"
  | "document/changed"
  | "connection/status";

export interface DiagnosticsChangedNotification {
  readonly filePath: string;
  readonly diagnostics: readonly DiagnosticEntry[];
}

export interface DocumentChangedNotification {
  readonly filePath: string;
  readonly version: number;
}

export interface ConnectionStatusNotification {
  readonly status: "connected" | "disconnected" | "reconnecting";
  readonly languages: readonly string[];
}

// ── Request Map (for type-safe dispatch) ──

export interface IDEBridgeRequestMap {
  initialize: { readonly params: InitializeParams; readonly result: InitializeResult };
  "lsp/definition": { readonly params: DefinitionParams; readonly result: DefinitionResponse };
  "lsp/references": { readonly params: ReferencesParams; readonly result: ReferencesResponse };
  "lsp/hover": { readonly params: HoverParams; readonly result: HoverResponse };
  "lsp/rename": { readonly params: RenameParams; readonly result: RenameResponse };
  "lsp/diagnostics": { readonly params: DiagnosticsParams; readonly result: DiagnosticsResponse };
  "lsp/codeActions": { readonly params: CodeActionsParams; readonly result: CodeActionsResponse };
  "lsp/executeCodeAction": {
    readonly params: ExecuteCodeActionParams;
    readonly result: ExecuteCodeActionResponse;
  };
  "lsp/workspaceSymbols": {
    readonly params: WorkspaceSymbolsParams;
    readonly result: WorkspaceSymbolsResponse;
  };
  "lsp/documentSymbols": {
    readonly params: DocumentSymbolsParams;
    readonly result: DocumentSymbolsResponse;
  };
  "lsp/callHierarchy/prepare": {
    readonly params: CallHierarchyPrepareParams;
    readonly result: CallHierarchyPrepareResponse;
  };
  "lsp/callHierarchy/incoming": {
    readonly params: CallHierarchyIncomingParams;
    readonly result: CallHierarchyIncomingResponse;
  };
  "lsp/callHierarchy/outgoing": {
    readonly params: CallHierarchyOutgoingParams;
    readonly result: CallHierarchyOutgoingResponse;
  };
  shutdown: { readonly params: ShutdownParams; readonly result: ShutdownResponse };
}

// ── Notification Map (for type-safe event handling) ──

export interface IDEBridgeNotificationMap {
  "diagnostics/changed": DiagnosticsChangedNotification;
  "document/changed": DocumentChangedNotification;
  "connection/status": ConnectionStatusNotification;
}

/**
 * Dhelix Code VS Code Extension — Main Entry Point
 *
 * Activates the IPC bridge between VS Code's language intelligence and the
 * DHelix CLI.  Manages the full lifecycle: IPC server, LSP bridge,
 * diagnostics forwarder, status bar, and command registration.
 */

import * as vscode from "vscode";

import { IPCServer, getSocketPath } from "./ipc/server.js";
import { LSPBridge } from "./services/lsp-bridge.js";
import {
  DiagnosticsForwarder,
  type ForwardedDiagnostic,
} from "./services/diagnostics-forwarder.js";
import { copySocketPath, showDiagnosticsSummary } from "./commands.js";

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

let server: IPCServer | undefined;
let bridge: LSPBridge | undefined;
let diagnosticsForwarder: DiagnosticsForwarder | undefined;
let statusBarItem: vscode.StatusBarItem | undefined;
let outputChannel: vscode.OutputChannel | undefined;

// ---------------------------------------------------------------------------
// Activation
// ---------------------------------------------------------------------------

export async function activate(
  context: vscode.ExtensionContext,
): Promise<void> {
  outputChannel = vscode.window.createOutputChannel("Dhelix Code");
  context.subscriptions.push(outputChannel);

  // Status bar — right-aligned, clickable
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100,
  );
  statusBarItem.command = "dhelix.showStatus";
  context.subscriptions.push(statusBarItem);
  updateStatusBar("disconnected");

  // LSP bridge — long-lived, wraps VS Code's language client APIs
  bridge = new LSPBridge();

  // Register all commands
  context.subscriptions.push(
    vscode.commands.registerCommand("dhelix.startBridge", () =>
      startBridge(context),
    ),
    vscode.commands.registerCommand("dhelix.stopBridge", () => stopBridge()),
    vscode.commands.registerCommand("dhelix.showStatus", () => showStatus()),
    vscode.commands.registerCommand("dhelix.copySocketPath", () =>
      copySocketPath(),
    ),
    vscode.commands.registerCommand("dhelix.showDiagnosticsSummary", () =>
      showDiagnosticsSummary(),
    ),
  );

  // Listen for configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("dhelix.bridge")) {
        handleConfigurationChange(context);
      }
    }),
  );

  // Auto-start if configured
  const config = vscode.workspace.getConfiguration("dhelix.bridge");
  if (config.get<boolean>("autoStart", true)) {
    await startBridge(context);
  }

  log("Extension activated");
}

// ---------------------------------------------------------------------------
// Bridge lifecycle
// ---------------------------------------------------------------------------

async function startBridge(
  context: vscode.ExtensionContext,
): Promise<void> {
  if (server?.isRunning) {
    vscode.window.showInformationMessage("Dhelix bridge is already running");
    return;
  }

  const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspacePath) {
    vscode.window.showWarningMessage(
      "No workspace folder open. Dhelix bridge requires a workspace.",
    );
    return;
  }

  const config = vscode.workspace.getConfiguration("dhelix.bridge");
  const socketPath =
    config.get<string>("socketPath") || getSocketPath(workspacePath);

  try {
    server = new IPCServer({
      workspacePath,
      onRequest: handleRequest,
      onNotification: handleNotification,
    });

    // Surface server errors to the output channel
    server.on("error", (err: Error) => {
      log(`Server error: ${err.message}`);
    });

    server.on("clientConnected", () => {
      log(`Client connected (total: ${server?.clientCount ?? 0})`);
      updateStatusBar("connected");
    });

    server.on("clientDisconnected", () => {
      const count = server?.clientCount ?? 0;
      log(`Client disconnected (remaining: ${count})`);
      if (count === 0) {
        updateStatusBar("connected"); // Server running but no clients
      }
    });

    await server.start();

    // Start diagnostics forwarder if enabled
    if (config.get<boolean>("enableDiagnostics", true)) {
      diagnosticsForwarder = new DiagnosticsForwarder({
        debounceMs: config.get<number>("diagnosticsDebounceMs", 300),
        onDiagnosticsChanged: (
          filePath: string,
          diagnostics: readonly ForwardedDiagnostic[],
        ) => {
          server?.sendNotification("diagnostics/changed", {
            filePath,
            diagnostics,
          });
        },
        workspaceFolders: vscode.workspace.workspaceFolders?.map(
          (f) => f.uri.fsPath,
        ),
      });
      context.subscriptions.push(diagnosticsForwarder);
    }

    updateStatusBar("connected");
    log(`Bridge started on ${socketPath}`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    log(`Failed to start bridge: ${message}`);
    vscode.window.showErrorMessage(
      `Dhelix bridge failed to start: ${message}`,
    );
    updateStatusBar("error");
  }
}

async function stopBridge(): Promise<void> {
  if (!server?.isRunning) {
    vscode.window.showInformationMessage("Dhelix bridge is not running");
    return;
  }

  try {
    diagnosticsForwarder?.dispose();
    diagnosticsForwarder = undefined;

    await server.stop();
    server = undefined;

    updateStatusBar("disconnected");
    log("Bridge stopped");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    log(`Error stopping bridge: ${message}`);
  }
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

function showStatus(): void {
  const running = server?.isRunning ?? false;
  const clients = server?.clientCount ?? 0;
  const diagEnabled = diagnosticsForwarder !== undefined;

  const lines = [
    `Status: ${running ? "Running" : "Stopped"}`,
    `Connected clients: ${clients}`,
    `Diagnostics forwarding: ${diagEnabled ? "Enabled" : "Disabled"}`,
    `Socket: ${server?.address ?? "N/A"}`,
  ];

  log(lines.join(" | "));
  outputChannel?.show(true); // Preserve focus

  vscode.window.showInformationMessage(
    `Dhelix Bridge: ${running ? "Running" : "Stopped"} (${clients} client${clients !== 1 ? "s" : ""})`,
  );
}

function updateStatusBar(
  status: "connected" | "disconnected" | "error",
): void {
  if (!statusBarItem) return;

  switch (status) {
    case "connected":
      statusBarItem.text = "$(plug) Dhelix";
      statusBarItem.tooltip = "Dhelix Bridge: Connected — click for status";
      statusBarItem.backgroundColor = undefined;
      break;
    case "disconnected":
      statusBarItem.text = "$(debug-disconnect) Dhelix";
      statusBarItem.tooltip =
        "Dhelix Bridge: Disconnected — click to view status";
      statusBarItem.backgroundColor = undefined;
      break;
    case "error":
      statusBarItem.text = "$(error) Dhelix";
      statusBarItem.tooltip = "Dhelix Bridge: Error — click for details";
      statusBarItem.backgroundColor = new vscode.ThemeColor(
        "statusBarItem.errorBackground",
      );
      break;
  }
  statusBarItem.show();
}

// ---------------------------------------------------------------------------
// Configuration change handler
// ---------------------------------------------------------------------------

function handleConfigurationChange(
  context: vscode.ExtensionContext,
): void {
  const config = vscode.workspace.getConfiguration("dhelix.bridge");

  // Update diagnostics debounce if forwarder is active
  // (DiagnosticsForwarder doesn't support runtime config changes, so we
  // recreate it if the setting changed while the bridge is running.)
  if (server?.isRunning && diagnosticsForwarder) {
    const enableDiag = config.get<boolean>("enableDiagnostics", true);
    if (!enableDiag) {
      diagnosticsForwarder.dispose();
      diagnosticsForwarder = undefined;
      log("Diagnostics forwarding disabled");
    }
  }
}

// ---------------------------------------------------------------------------
// IPC request / notification routing
// ---------------------------------------------------------------------------

/**
 * Route incoming JSON-RPC requests from CLI clients to the appropriate
 * LSP bridge method.
 */
async function handleRequest(
  method: string,
  params: unknown,
  _connectionId: string,
): Promise<unknown> {
  if (!bridge) {
    throw new Error("LSP bridge not initialized");
  }

  const p = params as Record<string, unknown>;

  switch (method) {
    case "initialize":
      return {
        capabilities: {
          languages: bridge.getActiveLanguages(),
          supportsDiagnostics: true,
          supportsCodeActions: true,
          supportsWorkspaceSymbols: true,
          supportsCallHierarchy: true,
          ideType: "vscode",
          ideVersion: vscode.version,
        },
        serverVersion: "0.1.0",
      };

    case "lsp/definition":
      return {
        results: await bridge.gotoDefinition(
          p.filePath as string,
          p.line as number,
          p.column as number,
        ),
        source: "ide",
      };

    case "lsp/references":
      return {
        results: await bridge.findReferences(
          p.filePath as string,
          p.line as number,
          p.column as number,
          p.includeDeclaration as boolean | undefined,
        ),
        source: "ide",
      };

    case "lsp/hover":
      return {
        result: await bridge.getTypeInfo(
          p.filePath as string,
          p.line as number,
          p.column as number,
        ),
        source: "ide",
      };

    case "lsp/rename":
      return {
        edits: await bridge.rename(
          p.filePath as string,
          p.line as number,
          p.column as number,
          p.newName as string,
        ),
        source: "ide",
      };

    case "lsp/diagnostics":
      return {
        diagnostics: bridge.getDiagnostics(p.filePath as string),
      };

    case "lsp/codeActions":
      return {
        actions: await bridge.getCodeActions(
          p.filePath as string,
          p.startLine as number,
          p.startColumn as number,
          p.endLine as number,
          p.endColumn as number,
          p.diagnosticMessages as string[] | undefined,
        ),
      };

    case "lsp/executeCodeAction":
      return bridge.executeCodeAction(p.actionId as string);

    case "lsp/workspaceSymbols":
      return {
        symbols: await bridge.searchWorkspaceSymbols(
          p.query as string,
          p.limit as number | undefined,
        ),
      };

    case "lsp/documentSymbols":
      return {
        symbols: await bridge.getDocumentSymbols(p.filePath as string),
      };

    case "lsp/callHierarchy/prepare":
      return {
        items: await bridge.prepareCallHierarchy(
          p.filePath as string,
          p.line as number,
          p.column as number,
        ),
      };

    case "lsp/callHierarchy/incoming":
      return {
        calls: await bridge.getIncomingCalls(p.itemId as string),
      };

    case "lsp/callHierarchy/outgoing":
      return {
        calls: await bridge.getOutgoingCalls(p.itemId as string),
      };

    case "shutdown":
      return { success: true };

    default:
      throw new Error(`Unknown method: ${method}`);
  }
}

/** Handle one-way notifications from CLI clients. */
function handleNotification(
  method: string,
  params: unknown,
  _connectionId: string,
): void {
  const p = params as Record<string, unknown>;

  switch (method) {
    case "diagnostics/subscribe":
      log(`Client subscribed to diagnostics for: ${p.filePath as string}`);
      break;
    case "diagnostics/unsubscribe":
      log(`Client unsubscribed from diagnostics for: ${p.filePath as string}`);
      break;
    default:
      log(`Unknown notification: ${method}`);
  }
}

// ---------------------------------------------------------------------------
// Logging helper
// ---------------------------------------------------------------------------

function log(message: string): void {
  const timestamp = new Date().toISOString().slice(11, 23);
  outputChannel?.appendLine(`[${timestamp}] ${message}`);
}

// ---------------------------------------------------------------------------
// Deactivation
// ---------------------------------------------------------------------------

export async function deactivate(): Promise<void> {
  diagnosticsForwarder?.dispose();
  diagnosticsForwarder = undefined;

  bridge?.dispose();
  bridge = undefined;

  if (server?.isRunning) {
    await server.stop();
  }
  server = undefined;

  statusBarItem?.dispose();
  statusBarItem = undefined;

  outputChannel?.dispose();
  outputChannel = undefined;
}

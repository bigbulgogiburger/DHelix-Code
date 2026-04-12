/**
 * Additional utility commands for the Dhelix Code VS Code extension.
 *
 * These are standalone command handlers registered by the main extension
 * entry point.  They have no dependency on the IPC server or LSP bridge —
 * only on the VS Code API.
 */

import * as vscode from "vscode";

import { getSocketPath } from "./ipc/server.js";

// ---------------------------------------------------------------------------
// copySocketPath
// ---------------------------------------------------------------------------

/**
 * Copy the IPC socket path for the current workspace to the clipboard.
 *
 * Useful for manual debugging or when the CLI needs to be pointed at the
 * socket explicitly.
 */
export async function copySocketPath(): Promise<void> {
  const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspacePath) {
    vscode.window.showWarningMessage(
      "No workspace folder open — cannot determine socket path.",
    );
    return;
  }

  const socketPath = getSocketPath(workspacePath);
  await vscode.env.clipboard.writeText(socketPath);
  vscode.window.showInformationMessage(`Socket path copied: ${socketPath}`);
}

// ---------------------------------------------------------------------------
// showDiagnosticsSummary
// ---------------------------------------------------------------------------

/**
 * Show a summary of all diagnostics across the current workspace.
 *
 * Groups counts by severity and displays in an information message.
 */
export async function showDiagnosticsSummary(): Promise<void> {
  const allDiags = vscode.languages.getDiagnostics();

  let errors = 0;
  let warnings = 0;
  let infos = 0;
  let hints = 0;
  let fileCount = 0;

  for (const [, diagnostics] of allDiags) {
    if (diagnostics.length === 0) continue;
    fileCount++;

    for (const d of diagnostics) {
      switch (d.severity) {
        case vscode.DiagnosticSeverity.Error:
          errors++;
          break;
        case vscode.DiagnosticSeverity.Warning:
          warnings++;
          break;
        case vscode.DiagnosticSeverity.Information:
          infos++;
          break;
        case vscode.DiagnosticSeverity.Hint:
          hints++;
          break;
      }
    }
  }

  const total = errors + warnings + infos + hints;

  if (total === 0) {
    vscode.window.showInformationMessage(
      "Workspace diagnostics: No issues found.",
    );
    return;
  }

  const parts: string[] = [];
  if (errors > 0) parts.push(`${errors} error${errors !== 1 ? "s" : ""}`);
  if (warnings > 0)
    parts.push(`${warnings} warning${warnings !== 1 ? "s" : ""}`);
  if (infos > 0) parts.push(`${infos} info`);
  if (hints > 0) parts.push(`${hints} hint${hints !== 1 ? "s" : ""}`);

  vscode.window.showInformationMessage(
    `Workspace diagnostics (${fileCount} file${fileCount !== 1 ? "s" : ""}): ${parts.join(", ")}`,
  );
}

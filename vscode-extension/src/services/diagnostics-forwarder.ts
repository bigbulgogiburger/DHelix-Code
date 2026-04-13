/**
 * Diagnostics Forwarder — watches VS Code diagnostic changes and pushes
 * them to connected DHelix CLI clients via IPC notifications.
 *
 * Key features:
 * - Debounced forwarding (VS Code fires multiple events for the same file)
 * - Deduplication of identical diagnostic sets
 * - Workspace folder filtering
 * - Efficient batch processing of multiple file changes
 */

import * as vscode from "vscode";

/** Diagnostic entry matching the IPC protocol format (1-based positions). */
export interface ForwardedDiagnostic {
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

export interface DiagnosticsForwarderOptions {
  /** Debounce interval in milliseconds (default: 300). */
  readonly debounceMs?: number;
  /** Callback to send notification to CLI clients. */
  readonly onDiagnosticsChanged: (
    filePath: string,
    diagnostics: readonly ForwardedDiagnostic[],
  ) => void;
  /** Only forward diagnostics for files in these workspace folders. */
  readonly workspaceFolders?: readonly string[];
}

export class DiagnosticsForwarder implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private readonly debounceTimers = new Map<string, NodeJS.Timeout>();
  /** filePath -> JSON hash of last forwarded diagnostics for dedup. */
  private readonly lastForwarded = new Map<string, string>();
  private readonly debounceMs: number;
  private readonly onDiagnosticsChanged: DiagnosticsForwarderOptions["onDiagnosticsChanged"];
  private readonly workspaceFolders: readonly string[] | undefined;
  private enabled = true;

  constructor(options: DiagnosticsForwarderOptions) {
    this.debounceMs = options.debounceMs ?? 300;
    this.onDiagnosticsChanged = options.onDiagnosticsChanged;
    this.workspaceFolders = options.workspaceFolders;

    this.disposables.push(
      vscode.languages.onDidChangeDiagnostics(this.handleDiagnosticChange, this),
    );
  }

  /** Enable or disable forwarding at runtime. */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.clearAllTimers();
    }
  }

  /** Get current diagnostics for a specific file (on-demand pull). */
  getFileDiagnostics(filePath: string): readonly ForwardedDiagnostic[] {
    const uri = vscode.Uri.file(filePath);
    const diagnostics = vscode.languages.getDiagnostics(uri);
    return this.convertDiagnostics(filePath, diagnostics);
  }

  /** Get all current diagnostics across the workspace. */
  getAllDiagnostics(): ReadonlyMap<string, readonly ForwardedDiagnostic[]> {
    const result = new Map<string, readonly ForwardedDiagnostic[]>();
    const allDiags = vscode.languages.getDiagnostics();

    for (const [uri, diagnostics] of allDiags) {
      if (uri.scheme !== "file") continue;
      const filePath = uri.fsPath;
      if (!this.isInWorkspace(filePath)) continue;
      result.set(filePath, this.convertDiagnostics(filePath, diagnostics));
    }

    return result;
  }

  // ── Event handling ──────────────────────────────────────────────────

  private handleDiagnosticChange(event: vscode.DiagnosticChangeEvent): void {
    if (!this.enabled) return;

    for (const uri of event.uris) {
      if (uri.scheme !== "file") continue;

      const filePath = uri.fsPath;
      if (!this.isInWorkspace(filePath)) continue;

      // Debounce per file — VS Code fires multiple events per edit
      const existing = this.debounceTimers.get(filePath);
      if (existing !== undefined) clearTimeout(existing);

      this.debounceTimers.set(
        filePath,
        setTimeout(() => {
          this.debounceTimers.delete(filePath);
          this.forwardDiagnostics(filePath);
        }, this.debounceMs),
      );
    }
  }

  private forwardDiagnostics(filePath: string): void {
    const uri = vscode.Uri.file(filePath);
    const diagnostics = vscode.languages.getDiagnostics(uri);
    const forwarded = this.convertDiagnostics(filePath, diagnostics);

    // Dedup: skip if identical to last forwarded set
    const hash = this.hashDiagnostics(forwarded);
    if (this.lastForwarded.get(filePath) === hash) return;
    this.lastForwarded.set(filePath, hash);

    this.onDiagnosticsChanged(filePath, forwarded);
  }

  // ── Conversion helpers ──────────────────────────────────────────────

  private convertDiagnostics(
    filePath: string,
    diagnostics: readonly vscode.Diagnostic[],
  ): ForwardedDiagnostic[] {
    return diagnostics.map((d) => ({
      filePath,
      // VS Code uses 0-based positions; DHelix IPC uses 1-based
      line: d.range.start.line + 1,
      column: d.range.start.character + 1,
      endLine: d.range.end.line + 1,
      endColumn: d.range.end.character + 1,
      severity: this.convertSeverity(d.severity),
      message: d.message,
      source: d.source,
      code: this.extractCode(d.code),
    }));
  }

  private convertSeverity(
    severity: vscode.DiagnosticSeverity,
  ): "error" | "warning" | "info" | "hint" {
    switch (severity) {
      case vscode.DiagnosticSeverity.Error:
        return "error";
      case vscode.DiagnosticSeverity.Warning:
        return "warning";
      case vscode.DiagnosticSeverity.Information:
        return "info";
      case vscode.DiagnosticSeverity.Hint:
        return "hint";
    }
  }

  /** Normalize VS Code's diagnostic code (number | string | { value, target }). */
  private extractCode(code: vscode.Diagnostic["code"]): string | number | undefined {
    if (code === undefined || code === null) return undefined;
    if (typeof code === "object") return String(code.value);
    return code;
  }

  // ── Workspace filter ────────────────────────────────────────────────

  private isInWorkspace(filePath: string): boolean {
    if (!this.workspaceFolders || this.workspaceFolders.length === 0) {
      return true;
    }
    return this.workspaceFolders.some((folder) => filePath.startsWith(folder));
  }

  // ── Dedup hash ──────────────────────────────────────────────────────

  private hashDiagnostics(diagnostics: readonly ForwardedDiagnostic[]): string {
    return JSON.stringify(diagnostics);
  }

  // ── Cleanup ─────────────────────────────────────────────────────────

  private clearAllTimers(): void {
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }

  dispose(): void {
    this.clearAllTimers();
    this.lastForwarded.clear();
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables.length = 0;
  }
}

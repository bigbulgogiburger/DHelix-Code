/**
 * Code Actions Service
 *
 * Provides grouped and prioritized code actions from VS Code's language
 * servers. Actions are categorized by kind (quickfix, refactor, source)
 * with preferred actions surfaced first within each group.
 *
 * All positions use 1-based line/column (DHelix convention) and are
 * converted to 0-based at the VS Code API boundary.
 */

import * as vscode from "vscode";

// ---------------------------------------------------------------------------
// Result types (1-based line/column, readonly throughout)
// ---------------------------------------------------------------------------

/** A single code action entry with a stable identifier. */
export interface CodeActionEntry {
  readonly title: string;
  readonly kind?: string;
  readonly isPreferred?: boolean;
  readonly actionId: string;
}

/** Categorized group of code actions sharing the same top-level kind. */
export interface CodeActionGroup {
  readonly kind: string; // "quickfix", "refactor", "source", "other"
  readonly actions: readonly CodeActionEntry[];
}

// ---------------------------------------------------------------------------
// Kind ordering — quickfix before refactor before source before other
// ---------------------------------------------------------------------------

const KIND_PRIORITY: readonly string[] = [
  "quickfix",
  "refactor",
  "source",
  "other",
] as const;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Enhanced code actions service with:
 * - Grouping by kind (quickfix, refactor, source)
 * - Priority-based ordering (preferred first, quickfix before refactor)
 * - Integration with diagnostics for targeted fixes
 */
export class CodeActionsService {
  /**
   * Get grouped code actions for a range.
   *
   * @param filePath  Absolute path to the file.
   * @param startLine 1-based start line.
   * @param startColumn 1-based start column.
   * @param endLine   1-based end line.
   * @param endColumn 1-based end column.
   * @returns Grouped code actions sorted by kind priority, preferred first.
   */
  async getGroupedActions(
    filePath: string,
    startLine: number,
    startColumn: number,
    endLine: number,
    endColumn: number,
  ): Promise<readonly CodeActionGroup[]> {
    const uri = vscode.Uri.file(filePath);
    const range = new vscode.Range(
      startLine - 1,
      startColumn - 1,
      endLine - 1,
      endColumn - 1,
    );

    let actions: vscode.CodeAction[];
    try {
      actions =
        (await vscode.commands.executeCommand<vscode.CodeAction[]>(
          "vscode.executeCodeActionProvider",
          uri,
          range,
        )) ?? [];
    } catch {
      return [];
    }

    if (actions.length === 0) return [];

    // Group actions by their top-level kind
    const groups = new Map<string, CodeActionEntry[]>();
    let nextId = 0;

    for (const action of actions) {
      const kind = this.extractTopLevelKind(action.kind);
      let bucket = groups.get(kind);
      if (!bucket) {
        bucket = [];
        groups.set(kind, bucket);
      }
      bucket.push({
        title: action.title,
        kind: action.kind?.value,
        isPreferred: action.isPreferred ?? false,
        actionId: `ca-${nextId++}`,
      });
    }

    // Sort entries within each group: preferred first
    for (const entries of groups.values()) {
      entries.sort(
        (a, b) => (b.isPreferred ? 1 : 0) - (a.isPreferred ? 1 : 0),
      );
    }

    // Assemble result in kind-priority order
    const result: CodeActionGroup[] = [];

    for (const kind of KIND_PRIORITY) {
      const entries = groups.get(kind);
      if (entries) {
        result.push({ kind, actions: entries });
        groups.delete(kind);
      }
    }

    // Append any remaining kinds not in the priority list
    for (const [kind, entries] of groups) {
      result.push({ kind, actions: entries });
    }

    return result;
  }

  /**
   * Get quick-fix actions that apply at a specific diagnostic location.
   *
   * @param filePath  Absolute path to the file.
   * @param line      1-based line of the diagnostic.
   * @param column    1-based column of the diagnostic.
   * @param _diagnosticMessage  Diagnostic message (reserved for future filtering).
   * @returns Quick-fix actions with stable identifiers.
   */
  async getQuickFixesForDiagnostic(
    filePath: string,
    line: number,
    column: number,
    _diagnosticMessage: string,
  ): Promise<readonly CodeActionEntry[]> {
    const uri = vscode.Uri.file(filePath);
    const position = new vscode.Position(line - 1, column - 1);
    const range = new vscode.Range(position, position);

    let actions: vscode.CodeAction[];
    try {
      actions =
        (await vscode.commands.executeCommand<vscode.CodeAction[]>(
          "vscode.executeCodeActionProvider",
          uri,
          range,
        )) ?? [];
    } catch {
      return [];
    }

    return actions
      .filter((a) => a.kind?.value?.startsWith("quickfix"))
      .map((a, i) => ({
        title: a.title,
        kind: a.kind?.value,
        isPreferred: a.isPreferred ?? false,
        actionId: `qf-${i}`,
      }));
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /** Extract the top-level kind segment (e.g. "refactor" from "refactor.extract.function"). */
  private extractTopLevelKind(kind: vscode.CodeActionKind | undefined): string {
    if (!kind) return "other";
    const value = kind.value;
    const dot = value.indexOf(".");
    return dot === -1 ? value : value.slice(0, dot);
  }
}

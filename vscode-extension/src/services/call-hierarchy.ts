/**
 * Call Hierarchy Service
 *
 * Provides call chain exploration (incoming and outgoing) with cycle
 * detection, configurable depth limits, and tree-formatted output.
 *
 * All positions use 1-based line/column (DHelix convention) and are
 * converted from 0-based at the VS Code API boundary.
 */

import * as vscode from "vscode";

// ---------------------------------------------------------------------------
// Result types (1-based line/column, readonly throughout)
// ---------------------------------------------------------------------------

/** A node in the call hierarchy tree. */
export interface CallHierarchyNode {
  readonly name: string;
  readonly kind: string;
  readonly filePath: string;
  readonly line: number;
  readonly column: number;
  readonly detail?: string;
}

/** A single call site location. */
export interface CallSite {
  readonly line: number;
  readonly column: number;
}

/** An edge in the call graph connecting a caller to a callee. */
export interface CallChainEntry {
  readonly caller: CallHierarchyNode;
  readonly callee: CallHierarchyNode;
  readonly callSites: readonly CallSite[];
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Call hierarchy exploration:
 * - Build complete call chains (up to configurable depth)
 * - Detect cycles in call graphs to avoid infinite recursion
 * - Format results as readable tree structures
 */
export class CallHierarchyService {
  private readonly maxDepth: number;

  constructor(maxDepth: number = 5) {
    this.maxDepth = maxDepth;
  }

  /**
   * Get incoming call chain — all callers of the symbol at the given position.
   *
   * @param filePath  Absolute path to the file.
   * @param line      1-based line.
   * @param column    1-based column.
   * @param depth     Maximum recursion depth (defaults to constructor value).
   * @returns Flat list of caller-callee edges discovered via BFS/DFS.
   */
  async getIncomingCallChain(
    filePath: string,
    line: number,
    column: number,
    depth?: number,
  ): Promise<readonly CallChainEntry[]> {
    const items = await this.prepareHierarchy(filePath, line, column);
    if (items.length === 0) return [];

    const visited = new Set<string>();
    return this.traceIncoming(items[0], visited, depth ?? this.maxDepth);
  }

  /**
   * Get outgoing call chain — all functions called by the symbol at the given position.
   *
   * @param filePath  Absolute path to the file.
   * @param line      1-based line.
   * @param column    1-based column.
   * @param depth     Maximum recursion depth (defaults to constructor value).
   * @returns Flat list of caller-callee edges discovered via BFS/DFS.
   */
  async getOutgoingCallChain(
    filePath: string,
    line: number,
    column: number,
    depth?: number,
  ): Promise<readonly CallChainEntry[]> {
    const items = await this.prepareHierarchy(filePath, line, column);
    if (items.length === 0) return [];

    const visited = new Set<string>();
    return this.traceOutgoing(items[0], visited, depth ?? this.maxDepth);
  }

  /**
   * Format a call chain as a readable tree string.
   *
   * @param entries   Call chain entries from getIncomingCallChain or getOutgoingCallChain.
   * @param direction Whether the chain represents incoming or outgoing calls.
   * @returns Multi-line tree string.
   */
  formatAsTree(entries: readonly CallChainEntry[], direction: "incoming" | "outgoing"): string {
    if (entries.length === 0) return "(no calls found)";

    const lines: string[] = [];

    // Root node: the callee (for incoming) or the caller (for outgoing)
    const rootNode = direction === "incoming" ? entries[0].callee : entries[0].caller;
    lines.push(this.formatNode(rootNode));

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const node = direction === "incoming" ? entry.caller : entry.callee;
      const isLast = i === entries.length - 1;
      const prefix = isLast ? "\u2514\u2500\u2500 " : "\u251c\u2500\u2500 ";
      lines.push(`${prefix}${this.formatNode(node)}`);
    }

    return lines.join("\n");
  }

  // -------------------------------------------------------------------------
  // Private — VS Code API interaction
  // -------------------------------------------------------------------------

  /** Prepare call hierarchy items at the given position. */
  private async prepareHierarchy(
    filePath: string,
    line: number,
    column: number,
  ): Promise<vscode.CallHierarchyItem[]> {
    const uri = vscode.Uri.file(filePath);
    const position = new vscode.Position(line - 1, column - 1);

    try {
      return (
        (await vscode.commands.executeCommand<vscode.CallHierarchyItem[]>(
          "vscode.prepareCallHierarchy",
          uri,
          position,
        )) ?? []
      );
    } catch {
      return [];
    }
  }

  // -------------------------------------------------------------------------
  // Private — recursive traversal with cycle detection
  // -------------------------------------------------------------------------

  /** Recursively trace incoming calls. */
  private async traceIncoming(
    item: vscode.CallHierarchyItem,
    visited: Set<string>,
    remainingDepth: number,
  ): Promise<CallChainEntry[]> {
    if (remainingDepth <= 0) return [];

    const key = this.itemKey(item);
    if (visited.has(key)) return []; // Cycle detected
    visited.add(key);

    let calls: vscode.CallHierarchyIncomingCall[];
    try {
      calls =
        (await vscode.commands.executeCommand<vscode.CallHierarchyIncomingCall[]>(
          "vscode.provideIncomingCalls",
          item,
        )) ?? [];
    } catch {
      return [];
    }

    const results: CallChainEntry[] = [];

    for (const call of calls) {
      results.push({
        caller: this.convertItem(call.from),
        callee: this.convertItem(item),
        callSites: call.fromRanges.map((r) => ({
          line: r.start.line + 1,
          column: r.start.character + 1,
        })),
      });

      // Recurse into callers
      const deeper = await this.traceIncoming(call.from, visited, remainingDepth - 1);
      results.push(...deeper);
    }

    return results;
  }

  /** Recursively trace outgoing calls. */
  private async traceOutgoing(
    item: vscode.CallHierarchyItem,
    visited: Set<string>,
    remainingDepth: number,
  ): Promise<CallChainEntry[]> {
    if (remainingDepth <= 0) return [];

    const key = this.itemKey(item);
    if (visited.has(key)) return []; // Cycle detected
    visited.add(key);

    let calls: vscode.CallHierarchyOutgoingCall[];
    try {
      calls =
        (await vscode.commands.executeCommand<vscode.CallHierarchyOutgoingCall[]>(
          "vscode.provideOutgoingCalls",
          item,
        )) ?? [];
    } catch {
      return [];
    }

    const results: CallChainEntry[] = [];

    for (const call of calls) {
      results.push({
        caller: this.convertItem(item),
        callee: this.convertItem(call.to),
        callSites: call.fromRanges.map((r) => ({
          line: r.start.line + 1,
          column: r.start.character + 1,
        })),
      });

      // Recurse into callees
      const deeper = await this.traceOutgoing(call.to, visited, remainingDepth - 1);
      results.push(...deeper);
    }

    return results;
  }

  // -------------------------------------------------------------------------
  // Private — conversion helpers
  // -------------------------------------------------------------------------

  /** Convert a VS Code CallHierarchyItem to a 1-based CallHierarchyNode. */
  private convertItem(item: vscode.CallHierarchyItem): CallHierarchyNode {
    return {
      name: item.name,
      kind: vscode.SymbolKind[item.kind],
      filePath: item.uri.fsPath,
      line: item.range.start.line + 1,
      column: item.range.start.character + 1,
      detail: item.detail || undefined,
    };
  }

  /** Generate a stable key for cycle detection. */
  private itemKey(item: vscode.CallHierarchyItem): string {
    return `${item.uri.fsPath}:${item.range.start.line}:${item.name}`;
  }

  /** Format a node as a readable location string. */
  private formatNode(node: CallHierarchyNode): string {
    return `${node.name} (${node.filePath}:${node.line})`;
  }
}

/**
 * Workspace Symbols Service
 *
 * Enhanced workspace symbol search with kind-based filtering,
 * file pattern matching, and configurable result limits.
 *
 * All positions use 1-based line/column (DHelix convention) and are
 * converted from 0-based at the VS Code API boundary.
 */

import * as vscode from "vscode";

// ---------------------------------------------------------------------------
// Result types (1-based line/column, readonly throughout)
// ---------------------------------------------------------------------------

/** A workspace symbol with resolved location and metadata. */
export interface EnhancedSymbolResult {
  readonly name: string;
  readonly kind: string;
  readonly filePath: string;
  readonly line: number;
  readonly column: number;
  readonly containerName?: string;
}

/** Options for filtering and limiting symbol search results. */
export interface WorkspaceSymbolSearchOptions {
  /** Symbol kinds to include, e.g. ["Function", "Class"]. Case-insensitive. */
  readonly kinds?: readonly string[];
  /** Maximum number of results to return. */
  readonly limit?: number;
  /** Glob pattern for file filtering, e.g. "**\/*.ts". */
  readonly filePattern?: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Enhanced workspace symbol search:
 * - Delegates to VS Code's built-in workspace symbol providers
 * - Kind-based filtering (Function, Class, Interface, etc.)
 * - File-path glob filtering
 * - Configurable result limit
 */
export class WorkspaceSymbolsService {
  /**
   * Search workspace symbols with optional filtering.
   *
   * @param query   Symbol name query (supports fuzzy matching by the provider).
   * @param options Optional filters and limits.
   * @returns Matching symbols sorted by provider relevance.
   */
  async search(
    query: string,
    options?: WorkspaceSymbolSearchOptions,
  ): Promise<readonly EnhancedSymbolResult[]> {
    let symbols: vscode.SymbolInformation[];
    try {
      symbols =
        (await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
          "vscode.executeWorkspaceSymbolProvider",
          query,
        )) ?? [];
    } catch {
      return [];
    }

    if (symbols.length === 0) return [];

    // Convert to 1-based results
    let results: EnhancedSymbolResult[] = symbols.map((s) => ({
      name: s.name,
      kind: vscode.SymbolKind[s.kind],
      filePath: s.location.uri.fsPath,
      line: s.location.range.start.line + 1,
      column: s.location.range.start.character + 1,
      containerName: s.containerName || undefined,
    }));

    // Apply kind filter
    if (options?.kinds && options.kinds.length > 0) {
      const kindSet = new Set(options.kinds.map((k) => k.toLowerCase()));
      results = results.filter((r) => kindSet.has(r.kind.toLowerCase()));
    }

    // Apply file pattern filter
    if (options?.filePattern) {
      const matcher = this.buildGlobMatcher(options.filePattern);
      results = results.filter((r) => matcher(r.filePath));
    }

    // Apply limit
    if (options?.limit !== undefined && options.limit > 0) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Build a simple glob matcher for file paths.
   *
   * Supports common patterns:
   * - `**\/*.ext`  — match any file with the given extension
   * - `*.ext`     — match files with extension in any directory
   * - literal substring match as fallback
   */
  private buildGlobMatcher(pattern: string): (filePath: string) => boolean {
    // "**/*.ts" or "**/*.tsx" — match by extension
    const doubleStarExt = /^\*\*\/\*\.(\w+)$/.exec(pattern);
    if (doubleStarExt) {
      const ext = `.${doubleStarExt[1]}`;
      return (fp) => fp.endsWith(ext);
    }

    // "*.ext" — also match by extension
    const singleStarExt = /^\*\.(\w+)$/.exec(pattern);
    if (singleStarExt) {
      const ext = `.${singleStarExt[1]}`;
      return (fp) => fp.endsWith(ext);
    }

    // Fallback: substring match
    return (fp) => fp.includes(pattern);
  }
}

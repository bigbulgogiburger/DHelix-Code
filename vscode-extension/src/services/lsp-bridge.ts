/**
 * LSP Bridge Service
 *
 * Translates IPC requests from the DHelix CLI into VS Code API calls,
 * leveraging VS Code's built-in language server integration via
 * `vscode.commands.executeCommand`. All positions are converted at the
 * boundary: VS Code uses 0-based line/column, DHelix uses 1-based.
 */

import * as vscode from "vscode";

import { QueryCache } from "./query-cache.js";

// ---------------------------------------------------------------------------
// Result types (1-based line/column, readonly throughout)
// ---------------------------------------------------------------------------

export interface BridgeDefinitionResult {
  readonly filePath: string;
  readonly line: number;
  readonly column: number;
  readonly endLine?: number;
  readonly endColumn?: number;
  readonly preview: string;
}

export interface BridgeReferenceResult {
  readonly filePath: string;
  readonly line: number;
  readonly column: number;
  readonly context: string;
  readonly isDefinition: boolean;
}

export interface BridgeTypeInfoResult {
  readonly type: string;
  readonly documentation?: string;
  readonly signature?: string;
}

export interface BridgeRenameEdit {
  readonly filePath: string;
  readonly edits: readonly {
    readonly startLine: number;
    readonly startColumn: number;
    readonly endLine: number;
    readonly endColumn: number;
    readonly newText: string;
  }[];
}

export interface BridgeDiagnosticEntry {
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

export interface BridgeWorkspaceSymbol {
  readonly name: string;
  readonly kind: string;
  readonly filePath: string;
  readonly line: number;
  readonly column: number;
  readonly containerName?: string;
}

export interface BridgeDocumentSymbol {
  readonly name: string;
  readonly kind: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly children?: readonly BridgeDocumentSymbol[];
}

export interface BridgeCodeAction {
  readonly title: string;
  readonly kind?: string;
  readonly isPreferred?: boolean;
  readonly actionId: string;
}

export interface BridgeCallHierarchyItem {
  readonly name: string;
  readonly kind: string;
  readonly filePath: string;
  readonly line: number;
  readonly column: number;
  readonly itemId: string;
}

export interface BridgeCallHierarchyRange {
  readonly filePath: string;
  readonly startLine: number;
  readonly startColumn: number;
  readonly endLine: number;
  readonly endColumn: number;
}

// ---------------------------------------------------------------------------
// LSPBridge
// ---------------------------------------------------------------------------

export class LSPBridge {
  /** Deferred code-action references for two-phase execute */
  private readonly pendingCodeActions: Map<string, vscode.CodeAction> = new Map();
  /** Deferred call-hierarchy items for incoming/outgoing queries */
  private readonly pendingCallHierarchyItems: Map<string, vscode.CallHierarchyItem> = new Map();

  private nextActionId = 0;
  private nextItemId = 0;

  // Caches keyed by "filePath:line:col" or similar compound keys
  private readonly definitionCache = new QueryCache<BridgeDefinitionResult[]>();
  private readonly hoverCache = new QueryCache<BridgeTypeInfoResult | undefined>();
  private readonly symbolCache = new QueryCache<BridgeDocumentSymbol[]>();

  // -----------------------------------------------------------------------
  // Go to Definition
  // -----------------------------------------------------------------------

  async gotoDefinition(
    filePath: string,
    line: number,
    column: number,
  ): Promise<BridgeDefinitionResult[]> {
    const cacheKey = `def:${filePath}:${line}:${column}`;
    const cached = this.definitionCache.get(cacheKey);
    if (cached) return cached;

    const uri = vscode.Uri.file(filePath);
    const position = new vscode.Position(line - 1, column - 1);

    let locations: (vscode.Location | vscode.LocationLink)[] | undefined;
    try {
      locations = await vscode.commands.executeCommand<(vscode.Location | vscode.LocationLink)[]>(
        "vscode.executeDefinitionProvider",
        uri,
        position,
      );
    } catch {
      return [];
    }

    if (!locations || locations.length === 0) return [];

    const results: BridgeDefinitionResult[] = [];
    for (const loc of locations) {
      const targetUri = "targetUri" in loc ? loc.targetUri : loc.uri;
      const targetRange = "targetRange" in loc ? loc.targetRange : loc.range;

      try {
        const doc = await vscode.workspace.openTextDocument(targetUri);
        const preview = doc.lineAt(targetRange.start.line).text.trim();

        results.push({
          filePath: targetUri.fsPath,
          line: targetRange.start.line + 1,
          column: targetRange.start.character + 1,
          endLine: targetRange.end.line + 1,
          endColumn: targetRange.end.character + 1,
          preview,
        });
      } catch {
        // Skip locations we cannot open (e.g. virtual schemes)
      }
    }

    this.definitionCache.set(cacheKey, results);
    return results;
  }

  // -----------------------------------------------------------------------
  // Find References
  // -----------------------------------------------------------------------

  async findReferences(
    filePath: string,
    line: number,
    column: number,
    _includeDeclaration?: boolean,
  ): Promise<BridgeReferenceResult[]> {
    const uri = vscode.Uri.file(filePath);
    const position = new vscode.Position(line - 1, column - 1);

    let locations: vscode.Location[] | undefined;
    try {
      locations = await vscode.commands.executeCommand<vscode.Location[]>(
        "vscode.executeReferenceProvider",
        uri,
        position,
      );
    } catch {
      return [];
    }

    if (!locations || locations.length === 0) return [];

    // Build a set of definition locations so we can flag isDefinition
    const defSet = await this.buildDefinitionSet(uri, position);

    const results: BridgeReferenceResult[] = [];
    for (const loc of locations) {
      try {
        const doc = await vscode.workspace.openTextDocument(loc.uri);
        const context = doc.lineAt(loc.range.start.line).text.trim();
        const key = `${loc.uri.fsPath}:${loc.range.start.line}:${loc.range.start.character}`;

        results.push({
          filePath: loc.uri.fsPath,
          line: loc.range.start.line + 1,
          column: loc.range.start.character + 1,
          context,
          isDefinition: defSet.has(key),
        });
      } catch {
        // Skip unopenable documents
      }
    }

    return results;
  }

  // -----------------------------------------------------------------------
  // Hover / Type Info
  // -----------------------------------------------------------------------

  async getTypeInfo(
    filePath: string,
    line: number,
    column: number,
  ): Promise<BridgeTypeInfoResult | undefined> {
    const cacheKey = `hover:${filePath}:${line}:${column}`;
    const cached = this.hoverCache.get(cacheKey);
    if (cached !== undefined) return cached;

    const uri = vscode.Uri.file(filePath);
    const position = new vscode.Position(line - 1, column - 1);

    let hovers: vscode.Hover[] | undefined;
    try {
      hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
        "vscode.executeHoverProvider",
        uri,
        position,
      );
    } catch {
      return undefined;
    }

    if (!hovers || hovers.length === 0) return undefined;

    const contents: string[] = [];
    for (const hover of hovers) {
      for (const content of hover.contents) {
        if (typeof content === "string") {
          contents.push(content);
        } else if (content instanceof vscode.MarkdownString) {
          contents.push(content.value);
        } else if ("value" in content) {
          contents.push((content as { value: string }).value);
        }
      }
    }

    const merged = contents.join("\n\n");

    // Extract the first fenced code block as the type signature
    const codeBlockMatch = merged.match(/```\w*\n([\s\S]*?)```/);
    const signature = codeBlockMatch ? codeBlockMatch[1].trim() : undefined;

    // Everything outside code blocks is documentation
    const docs = merged.replace(/```[\s\S]*?```/g, "").trim();

    const result: BridgeTypeInfoResult = {
      type: signature ?? merged,
      documentation: docs || undefined,
      signature,
    };

    this.hoverCache.set(cacheKey, result);
    return result;
  }

  // -----------------------------------------------------------------------
  // Rename
  // -----------------------------------------------------------------------

  async rename(
    filePath: string,
    line: number,
    column: number,
    newName: string,
  ): Promise<BridgeRenameEdit[]> {
    const uri = vscode.Uri.file(filePath);
    const position = new vscode.Position(line - 1, column - 1);

    let edit: vscode.WorkspaceEdit | undefined;
    try {
      edit = await vscode.commands.executeCommand<vscode.WorkspaceEdit>(
        "vscode.executeDocumentRenameProvider",
        uri,
        position,
        newName,
      );
    } catch {
      return [];
    }

    if (!edit) return [];

    const results: BridgeRenameEdit[] = [];
    for (const [entryUri, textEdits] of edit.entries()) {
      results.push({
        filePath: entryUri.fsPath,
        edits: textEdits.map((te) => ({
          startLine: te.range.start.line + 1,
          startColumn: te.range.start.character + 1,
          endLine: te.range.end.line + 1,
          endColumn: te.range.end.character + 1,
          newText: te.newText,
        })),
      });
    }

    // Invalidate caches for all affected files
    for (const r of results) {
      this.invalidateCachesForFile(r.filePath);
    }

    return results;
  }

  // -----------------------------------------------------------------------
  // Diagnostics
  // -----------------------------------------------------------------------

  getDiagnostics(filePath: string): BridgeDiagnosticEntry[] {
    const uri = vscode.Uri.file(filePath);
    const diagnostics = vscode.languages.getDiagnostics(uri);
    return this.convertDiagnostics(filePath, diagnostics);
  }

  getAllDiagnostics(): BridgeDiagnosticEntry[] {
    const all = vscode.languages.getDiagnostics();
    const results: BridgeDiagnosticEntry[] = [];
    for (const [uri, diagnostics] of all) {
      results.push(...this.convertDiagnostics(uri.fsPath, diagnostics));
    }
    return results;
  }

  // -----------------------------------------------------------------------
  // Code Actions
  // -----------------------------------------------------------------------

  async getCodeActions(
    filePath: string,
    startLine: number,
    startColumn: number,
    endLine: number,
    endColumn: number,
    _diagnosticMessages?: readonly string[],
  ): Promise<BridgeCodeAction[]> {
    const uri = vscode.Uri.file(filePath);
    const range = new vscode.Range(startLine - 1, startColumn - 1, endLine - 1, endColumn - 1);

    let actions: vscode.CodeAction[] | undefined;
    try {
      actions = await vscode.commands.executeCommand<vscode.CodeAction[]>(
        "vscode.executeCodeActionProvider",
        uri,
        range,
      );
    } catch {
      return [];
    }

    if (!actions) return [];

    return actions.map((action) => {
      const actionId = `action-${this.nextActionId++}`;
      this.pendingCodeActions.set(actionId, action);
      return {
        title: action.title,
        kind: action.kind?.value,
        isPreferred: action.isPreferred,
        actionId,
      };
    });
  }

  async executeCodeAction(
    actionId: string,
  ): Promise<{ readonly applied: boolean; readonly filesChanged: string[] }> {
    const action = this.pendingCodeActions.get(actionId);
    if (!action) return { applied: false, filesChanged: [] };

    this.pendingCodeActions.delete(actionId);
    const filesChanged: string[] = [];

    if (action.edit) {
      const success = await vscode.workspace.applyEdit(action.edit);
      if (success) {
        for (const [uri] of action.edit.entries()) {
          filesChanged.push(uri.fsPath);
          this.invalidateCachesForFile(uri.fsPath);
        }
      }
      return { applied: success, filesChanged };
    }

    if (action.command) {
      try {
        await vscode.commands.executeCommand(
          action.command.command,
          ...(action.command.arguments ?? []),
        );
        return { applied: true, filesChanged };
      } catch {
        return { applied: false, filesChanged };
      }
    }

    return { applied: false, filesChanged };
  }

  // -----------------------------------------------------------------------
  // Workspace Symbols
  // -----------------------------------------------------------------------

  async searchWorkspaceSymbols(query: string, limit?: number): Promise<BridgeWorkspaceSymbol[]> {
    let symbols: vscode.SymbolInformation[] | undefined;
    try {
      symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
        "vscode.executeWorkspaceSymbolProvider",
        query,
      );
    } catch {
      return [];
    }

    if (!symbols) return [];

    const mapped = symbols.map((s) => ({
      name: s.name,
      kind: vscode.SymbolKind[s.kind],
      filePath: s.location.uri.fsPath,
      line: s.location.range.start.line + 1,
      column: s.location.range.start.character + 1,
      containerName: s.containerName || undefined,
    }));

    return limit !== undefined ? mapped.slice(0, limit) : mapped;
  }

  // -----------------------------------------------------------------------
  // Document Symbols (Outline)
  // -----------------------------------------------------------------------

  async getDocumentSymbols(filePath: string): Promise<BridgeDocumentSymbol[]> {
    const cacheKey = `sym:${filePath}`;
    const cached = this.symbolCache.get(cacheKey);
    if (cached) return cached;

    const uri = vscode.Uri.file(filePath);

    let symbols: vscode.DocumentSymbol[] | undefined;
    try {
      symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
        "vscode.executeDocumentSymbolProvider",
        uri,
      );
    } catch {
      return [];
    }

    if (!symbols) return [];

    const results = this.convertDocumentSymbols(symbols);
    this.symbolCache.set(cacheKey, results);
    return results;
  }

  // -----------------------------------------------------------------------
  // Call Hierarchy
  // -----------------------------------------------------------------------

  async prepareCallHierarchy(
    filePath: string,
    line: number,
    column: number,
  ): Promise<BridgeCallHierarchyItem[]> {
    const uri = vscode.Uri.file(filePath);
    const position = new vscode.Position(line - 1, column - 1);

    let items: vscode.CallHierarchyItem[] | undefined;
    try {
      items = await vscode.commands.executeCommand<vscode.CallHierarchyItem[]>(
        "vscode.prepareCallHierarchy",
        uri,
        position,
      );
    } catch {
      return [];
    }

    if (!items) return [];

    return items.map((item) => {
      const itemId = `chi-${this.nextItemId++}`;
      this.pendingCallHierarchyItems.set(itemId, item);
      return {
        name: item.name,
        kind: vscode.SymbolKind[item.kind],
        filePath: item.uri.fsPath,
        line: item.range.start.line + 1,
        column: item.range.start.character + 1,
        itemId,
      };
    });
  }

  async getIncomingCalls(itemId: string): Promise<
    readonly {
      readonly from: BridgeCallHierarchyItem;
      readonly fromRanges: readonly BridgeCallHierarchyRange[];
    }[]
  > {
    const item = this.pendingCallHierarchyItems.get(itemId);
    if (!item) return [];

    let calls: vscode.CallHierarchyIncomingCall[] | undefined;
    try {
      calls = await vscode.commands.executeCommand<vscode.CallHierarchyIncomingCall[]>(
        "vscode.provideIncomingCalls",
        item,
      );
    } catch {
      return [];
    }

    if (!calls) return [];

    return calls.map((call) => {
      const fromId = `chi-${this.nextItemId++}`;
      this.pendingCallHierarchyItems.set(fromId, call.from);
      return {
        from: {
          name: call.from.name,
          kind: vscode.SymbolKind[call.from.kind],
          filePath: call.from.uri.fsPath,
          line: call.from.range.start.line + 1,
          column: call.from.range.start.character + 1,
          itemId: fromId,
        },
        fromRanges: call.fromRanges.map((r) => ({
          filePath: item.uri.fsPath,
          startLine: r.start.line + 1,
          startColumn: r.start.character + 1,
          endLine: r.end.line + 1,
          endColumn: r.end.character + 1,
        })),
      };
    });
  }

  async getOutgoingCalls(itemId: string): Promise<
    readonly {
      readonly to: BridgeCallHierarchyItem;
      readonly fromRanges: readonly BridgeCallHierarchyRange[];
    }[]
  > {
    const item = this.pendingCallHierarchyItems.get(itemId);
    if (!item) return [];

    let calls: vscode.CallHierarchyOutgoingCall[] | undefined;
    try {
      calls = await vscode.commands.executeCommand<vscode.CallHierarchyOutgoingCall[]>(
        "vscode.provideOutgoingCalls",
        item,
      );
    } catch {
      return [];
    }

    if (!calls) return [];

    return calls.map((call) => {
      const toId = `chi-${this.nextItemId++}`;
      this.pendingCallHierarchyItems.set(toId, call.to);
      return {
        to: {
          name: call.to.name,
          kind: vscode.SymbolKind[call.to.kind],
          filePath: call.to.uri.fsPath,
          line: call.to.range.start.line + 1,
          column: call.to.range.start.character + 1,
          itemId: toId,
        },
        fromRanges: call.fromRanges.map((r) => ({
          filePath: item.uri.fsPath,
          startLine: r.start.line + 1,
          startColumn: r.start.character + 1,
          endLine: r.end.line + 1,
          endColumn: r.end.character + 1,
        })),
      };
    });
  }

  // -----------------------------------------------------------------------
  // Utilities
  // -----------------------------------------------------------------------

  /** Best-effort list of languages with active provider support. */
  getActiveLanguages(): readonly string[] {
    return [
      "typescript",
      "javascript",
      "typescriptreact",
      "javascriptreact",
      "python",
      "go",
      "rust",
      "java",
      "c",
      "cpp",
      "csharp",
    ] as const;
  }

  /** Convert VS Code diagnostics array to bridge format. */
  convertDiagnostics(
    filePath: string,
    diagnostics: readonly vscode.Diagnostic[],
  ): BridgeDiagnosticEntry[] {
    return diagnostics.map((d) => ({
      filePath,
      line: d.range.start.line + 1,
      column: d.range.start.character + 1,
      endLine: d.range.end.line + 1,
      endColumn: d.range.end.character + 1,
      severity: this.convertSeverity(d.severity),
      message: d.message,
      source: d.source,
      code:
        typeof d.code === "object"
          ? String(d.code.value)
          : d.code !== undefined
            ? String(d.code)
            : undefined,
    }));
  }

  /** Release all held references and clear caches. */
  dispose(): void {
    this.pendingCodeActions.clear();
    this.pendingCallHierarchyItems.clear();
    this.definitionCache.clear();
    this.hoverCache.clear();
    this.symbolCache.clear();
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private async buildDefinitionSet(
    uri: vscode.Uri,
    position: vscode.Position,
  ): Promise<Set<string>> {
    const defSet = new Set<string>();
    try {
      const defLocations = await vscode.commands.executeCommand<
        (vscode.Location | vscode.LocationLink)[]
      >("vscode.executeDefinitionProvider", uri, position);

      if (defLocations) {
        for (const def of defLocations) {
          const defUri = "targetUri" in def ? def.targetUri : def.uri;
          const defRange = "targetRange" in def ? def.targetRange : def.range;
          defSet.add(`${defUri.fsPath}:${defRange.start.line}:${defRange.start.character}`);
        }
      }
    } catch {
      // Ignore — isDefinition flags will all be false
    }
    return defSet;
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

  private convertDocumentSymbols(
    symbols: readonly vscode.DocumentSymbol[],
  ): BridgeDocumentSymbol[] {
    return symbols.map((s) => ({
      name: s.name,
      kind: vscode.SymbolKind[s.kind],
      startLine: s.range.start.line + 1,
      endLine: s.range.end.line + 1,
      children: s.children.length > 0 ? this.convertDocumentSymbols(s.children) : undefined,
    }));
  }

  private invalidateCachesForFile(filePath: string): void {
    const defPrefix = `def:${filePath}:`;
    const hoverPrefix = `hover:${filePath}:`;
    const symKey = `sym:${filePath}`;

    this.definitionCache.invalidateByPrefix(defPrefix);
    this.hoverCache.invalidateByPrefix(hoverPrefix);
    this.symbolCache.invalidate(symKey);
  }
}

/**
 * Command Graph — unified command registry across all sources
 *
 * Provides a single interface for registering, resolving, and searching
 * commands regardless of their origin (builtin slash commands, MCP tools,
 * skills, or external plugins). Supports alias-based lookup and fuzzy search.
 *
 * @example
 * const graph = new CommandGraph();
 * graph.register({ name: "commit", source: "builtin", description: "Commit changes" });
 * const cmd = graph.resolve("commit");
 */

// ── Types ──────────────────────────────────────────────────────────────────

/**
 * The origin source of a unified command.
 *
 * - `builtin` — built-in slash command (e.g., /commit, /model)
 * - `mcp`     — command exposed via an MCP server tool
 * - `skill`   — loaded from the skills system
 * - `plugin`  — registered by an external plugin
 */
export type CommandSource = "builtin" | "mcp" | "skill" | "plugin";

/**
 * A unified command entry in the CommandGraph.
 *
 * @property name        - Canonical command name (unique within the graph)
 * @property source      - Origin of the command
 * @property description - Human-readable description for help / search
 * @property aliases     - Optional alternative names that resolve to this command
 * @property category    - Optional grouping label (e.g., "git", "analysis")
 */
export interface UnifiedCommand {
  readonly name: string;
  readonly source: CommandSource;
  readonly description: string;
  readonly aliases?: readonly string[];
  readonly category?: string;
}

// ── CommandGraph ───────────────────────────────────────────────────────────

/**
 * Unified command registry that aggregates commands from all sources.
 *
 * Maintains two internal indices:
 * - `commandMap` — canonical name → command
 * - `aliasMap`   — alias name → canonical name (for fast alias resolution)
 *
 * Both maps are kept in sync on every register/remove operation.
 */
export class CommandGraph {
  /** Canonical name → UnifiedCommand */
  private readonly commandMap = new Map<string, UnifiedCommand>();

  /** Alias → canonical name */
  private readonly aliasMap = new Map<string, string>();

  // ── Mutation ─────────────────────────────────────────────────────────

  /**
   * Register a unified command in the graph.
   *
   * Throws if the canonical name or any of the aliases is already taken
   * (collision with another command's name or alias).
   *
   * @param command - Command to register
   * @throws Error if name or alias is already registered
   */
  register(command: UnifiedCommand): void {
    if (this.commandMap.has(command.name)) {
      throw new Error(
        `CommandGraph: command "${command.name}" is already registered`,
      );
    }

    if (this.aliasMap.has(command.name)) {
      throw new Error(
        `CommandGraph: "${command.name}" is already used as an alias for "${this.aliasMap.get(command.name)}"`,
      );
    }

    // Check alias conflicts
    for (const alias of command.aliases ?? []) {
      if (this.commandMap.has(alias)) {
        throw new Error(
          `CommandGraph: alias "${alias}" conflicts with existing command name`,
        );
      }
      if (this.aliasMap.has(alias)) {
        throw new Error(
          `CommandGraph: alias "${alias}" is already registered for "${this.aliasMap.get(alias)}"`,
        );
      }
    }

    this.commandMap.set(command.name, command);

    for (const alias of command.aliases ?? []) {
      this.aliasMap.set(alias, command.name);
    }
  }

  /**
   * Remove a command from the graph by its canonical name.
   *
   * Also removes all associated alias entries.
   *
   * @param name - Canonical name of the command to remove
   * @returns true if the command existed and was removed, false otherwise
   */
  remove(name: string): boolean {
    const command = this.commandMap.get(name);
    if (!command) return false;

    this.commandMap.delete(name);

    for (const alias of command.aliases ?? []) {
      this.aliasMap.delete(alias);
    }

    return true;
  }

  // ── Lookup ───────────────────────────────────────────────────────────

  /**
   * Resolve a command by its canonical name or any registered alias.
   *
   * @param input - Command name or alias to look up
   * @returns The matching UnifiedCommand, or undefined if not found
   */
  resolve(input: string): UnifiedCommand | undefined {
    // Try direct canonical name lookup first
    const direct = this.commandMap.get(input);
    if (direct) return direct;

    // Try alias lookup
    const canonicalName = this.aliasMap.get(input);
    if (canonicalName) return this.commandMap.get(canonicalName);

    return undefined;
  }

  // ── Search ───────────────────────────────────────────────────────────

  /**
   * Fuzzy search commands by query string.
   *
   * Matches commands where the name, any alias, description, or category
   * contains the query as a substring (case-insensitive).
   *
   * Results are sorted by relevance:
   * 1. Exact name match
   * 2. Name starts with query
   * 3. Alias starts with query
   * 4. Name contains query
   * 5. Description / category contains query
   *
   * @param query - Search term (case-insensitive)
   * @returns Sorted array of matching commands
   */
  search(query: string): readonly UnifiedCommand[] {
    if (!query.trim()) return this.getAll();

    const lower = query.toLowerCase();

    const scored = [...this.commandMap.values()]
      .map((cmd) => {
        const nameLower = cmd.name.toLowerCase();
        const descLower = cmd.description.toLowerCase();
        const catLower = (cmd.category ?? "").toLowerCase();
        const aliasesLower = (cmd.aliases ?? []).map((a) => a.toLowerCase());

        let score = 0;

        if (nameLower === lower) score = 100;
        else if (nameLower.startsWith(lower)) score = 80;
        else if (aliasesLower.some((a) => a.startsWith(lower))) score = 70;
        else if (nameLower.includes(lower)) score = 50;
        else if (aliasesLower.some((a) => a.includes(lower))) score = 40;
        else if (descLower.includes(lower)) score = 20;
        else if (catLower.includes(lower)) score = 10;

        return { cmd, score };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score);

    return scored.map(({ cmd }) => cmd);
  }

  // ── Listing ──────────────────────────────────────────────────────────

  /**
   * Return all commands registered from a given source.
   *
   * @param source - The source to filter by
   * @returns Readonly array of matching commands
   */
  listBySource(source: CommandSource): readonly UnifiedCommand[] {
    return [...this.commandMap.values()].filter((cmd) => cmd.source === source);
  }

  /**
   * Return all commands belonging to a given category.
   *
   * @param category - The category label to filter by (case-sensitive)
   * @returns Readonly array of matching commands
   */
  listByCategory(category: string): readonly UnifiedCommand[] {
    return [...this.commandMap.values()].filter((cmd) => cmd.category === category);
  }

  /**
   * Return all registered commands in insertion order.
   *
   * @returns Readonly array of all commands
   */
  getAll(): readonly UnifiedCommand[] {
    return [...this.commandMap.values()];
  }

  /**
   * Return the total number of registered commands.
   */
  get size(): number {
    return this.commandMap.size;
  }
}

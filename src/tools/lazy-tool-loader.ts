import type { CapabilityTier } from "../llm/model-capabilities.js";

/** Lightweight tool summary for deferred schema loading */
export interface ToolSummary {
  readonly name: string;
  readonly shortDescription: string;
  readonly schemaLoaded: boolean;
}

/** Full tool schema returned when a tool is loaded on demand */
export interface ToolSchema {
  readonly name: string;
  readonly description: string;
  readonly parameters: Record<string, unknown>;
}

/** Registered tool entry with full metadata */
interface ToolEntry {
  readonly name: string;
  readonly description: string;
  readonly parameters: Record<string, unknown>;
}

/** Default number of hot tools for MEDIUM tier */
const MEDIUM_TIER_HOT_LIMIT = 10;

/** Tools that are always fully loaded regardless of tier */
const PRIORITY_TOOLS: ReadonlySet<string> = new Set([
  "file_read",
  "file_write",
  "file_edit",
  "bash_exec",
  "grep_search",
  "glob_search",
]);

/**
 * Extract a one-line short description from a full description string.
 * Takes text up to the first period or newline.
 */
function extractShortDescription(description: string): string {
  const firstPeriod = description.indexOf(".");
  const firstNewline = description.indexOf("\n");

  let end = description.length;
  if (firstPeriod !== -1) {
    end = firstPeriod + 1;
  }
  if (firstNewline !== -1 && firstNewline < end) {
    end = firstNewline;
  }

  return description.slice(0, end).trim();
}

/**
 * LazyToolLoader — manages on-demand tool schema loading based on model capability tier.
 *
 * Strategy per tier:
 * - HIGH: all tools get full schema upfront
 * - MEDIUM: priority tools get full schema, rest get name + 1-line description only
 * - LOW: all tools get name only, full schema fetched on demand
 */
export class LazyToolLoader {
  private readonly tools = new Map<string, ToolEntry>();
  private readonly loadedSchemas = new Set<string>();

  /** Register a tool with its full schema */
  registerTool(name: string, description: string, parameters: Record<string, unknown>): void {
    this.tools.set(name, { name, description, parameters });
  }

  /** Register multiple tools at once */
  registerAll(tools: readonly ToolEntry[]): void {
    for (const tool of tools) {
      this.tools.set(tool.name, tool);
    }
  }

  /**
   * Get tool summaries adapted for the given capability tier.
   *
   * - HIGH: all tools marked as schemaLoaded with full short descriptions
   * - MEDIUM: top priority tools marked as loaded, rest name + 1-line only
   * - LOW: all tools name only, none marked as loaded
   */
  getToolSummaries(tier: CapabilityTier): readonly ToolSummary[] {
    const entries = [...this.tools.values()];
    const summaries: ToolSummary[] = [];

    switch (tier) {
      case "high":
        for (const entry of entries) {
          this.loadedSchemas.add(entry.name);
          summaries.push({
            name: entry.name,
            shortDescription: extractShortDescription(entry.description),
            schemaLoaded: true,
          });
        }
        break;

      case "medium":
        for (const entry of entries) {
          const isPriority = PRIORITY_TOOLS.has(entry.name);
          const isWithinHotLimit =
            summaries.filter((s) => s.schemaLoaded).length < MEDIUM_TIER_HOT_LIMIT;

          if (isPriority || isWithinHotLimit) {
            this.loadedSchemas.add(entry.name);
            summaries.push({
              name: entry.name,
              shortDescription: extractShortDescription(entry.description),
              schemaLoaded: true,
            });
          } else {
            summaries.push({
              name: entry.name,
              shortDescription: extractShortDescription(entry.description),
              schemaLoaded: false,
            });
          }
        }
        break;

      case "low":
        for (const entry of entries) {
          summaries.push({
            name: entry.name,
            shortDescription: entry.name,
            schemaLoaded: false,
          });
        }
        break;
    }

    return summaries;
  }

  /**
   * Load the full schema for a specific tool by name.
   * Marks the tool as loaded in the internal tracking set.
   *
   * @returns The full tool schema, or null if the tool is not registered
   */
  loadFullSchema(toolName: string): ToolSchema | null {
    const entry = this.tools.get(toolName);
    if (!entry) {
      return null;
    }

    this.loadedSchemas.add(toolName);
    return {
      name: entry.name,
      description: entry.description,
      parameters: entry.parameters,
    };
  }

  /** Check whether a tool's full schema has been loaded */
  isSchemaLoaded(toolName: string): boolean {
    return this.loadedSchemas.has(toolName);
  }

  /** Get the total number of registered tools */
  get size(): number {
    return this.tools.size;
  }

  /** Get the number of tools with loaded schemas */
  get loadedCount(): number {
    return this.loadedSchemas.size;
  }
}

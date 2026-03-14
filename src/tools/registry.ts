import { type ToolDefinition, type ToolDefinitionForLLM } from "./types.js";
import { zodSchemaToJsonSchema } from "./validation.js";
import { ToolError } from "../utils/error.js";
import { type MCPToolSearch } from "../mcp/tool-search.js";

/**
 * Tool registry — manages registration, lookup, and LLM-format conversion.
 */
export class ToolRegistry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly tools = new Map<string, ToolDefinition<any>>();

  /** MCPToolSearch instance for deferred tool loading */
  private toolSearch: MCPToolSearch | null = null;

  /** Tools that always receive full schema in every LLM request */
  private readonly hotTools = new Set<string>([
    "file_read",
    "file_write",
    "file_edit",
    "bash_exec",
    "glob_search",
    "grep_search",
  ]);

  /** Register a tool definition */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register(tool: ToolDefinition<any>): void {
    if (this.tools.has(tool.name)) {
      throw new ToolError(`Tool already registered: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
  }

  /** Register multiple tools at once */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerAll(tools: readonly ToolDefinition<any>[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  /** Get a tool by name */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get(name: string): ToolDefinition<any> | undefined {
    return this.tools.get(name);
  }

  /** Get a tool or throw if not found */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  require(name: string): ToolDefinition<any> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new ToolError(`Tool not found: ${name}`);
    }
    return tool;
  }

  /** Check if a tool is registered */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /** Get all registered tool names */
  getNames(): readonly string[] {
    return [...this.tools.keys()];
  }

  /** Get all registered tools */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getAll(): readonly ToolDefinition<any>[] {
    return [...this.tools.values()];
  }

  /** Convert all tools to LLM function calling format */
  getDefinitionsForLLM(): readonly ToolDefinitionForLLM[] {
    return this.getAll().map((tool) => ({
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: zodSchemaToJsonSchema(tool.parameterSchema),
      },
    }));
  }

  /** Get count of registered tools */
  get size(): number {
    return this.tools.size;
  }

  /** Connect an MCPToolSearch instance for deferred tool loading */
  setToolSearch(search: MCPToolSearch): void {
    this.toolSearch = search;
  }

  /** Whether deferred mode is active (toolSearch connected with deferred tools) */
  get isDeferredMode(): boolean {
    return this.toolSearch !== null && this.toolSearch.size > 0;
  }

  /**
   * Get tool definitions for LLM, including only hot tools and non-MCP (built-in) tools.
   * MCP tools are excluded — they are deferred and resolved on demand.
   */
  getHotDefinitionsForLLM(): readonly ToolDefinitionForLLM[] {
    return this.getAll()
      .filter((tool) => this.hotTools.has(tool.name) || !tool.name.startsWith("mcp__"))
      .map((tool) => ({
        type: "function" as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: zodSchemaToJsonSchema(tool.parameterSchema),
        },
      }));
  }

  /** Get summary of all deferred tools for system prompt injection */
  getDeferredToolsSummary(): string {
    if (!this.toolSearch) {
      return "";
    }
    return this.toolSearch.generateDeferredToolsSummary();
  }

  /** Resolve a deferred tool's full schema by namespaced name */
  resolveDeferredTool(namespacedName: string): ToolDefinitionForLLM | undefined {
    if (!this.toolSearch) {
      return undefined;
    }
    const result = this.toolSearch.getToolDefinition(namespacedName);
    if (!result) {
      return undefined;
    }
    return {
      type: "function" as const,
      function: {
        name: result.namespacedName,
        description: result.tool.description,
        parameters: result.tool.inputSchema as Record<string, unknown>,
      },
    };
  }

  /** Search deferred tools by query, delegating to MCPToolSearch */
  searchDeferredTools(
    query: string,
    maxResults?: number,
  ): readonly ToolDefinitionForLLM[] {
    if (!this.toolSearch) {
      return [];
    }
    const results = this.toolSearch.search(query, maxResults);
    return results.map((r) => ({
      type: "function" as const,
      function: {
        name: r.namespacedName,
        description: r.tool.description,
        parameters: r.tool.inputSchema as Record<string, unknown>,
      },
    }));
  }
}

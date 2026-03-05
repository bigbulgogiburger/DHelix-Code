import { type ToolDefinition, type ToolDefinitionForLLM } from "./types.js";
import { zodSchemaToJsonSchema } from "./validation.js";
import { ToolError } from "../utils/error.js";

/**
 * Tool registry — manages registration, lookup, and LLM-format conversion.
 */
export class ToolRegistry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly tools = new Map<string, ToolDefinition<any>>();

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
}

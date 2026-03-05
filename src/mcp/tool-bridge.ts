import { z } from "zod";
import { type ToolDefinition, type ToolResult } from "../tools/types.js";
import { type ToolRegistry } from "../tools/registry.js";
import { BaseError } from "../utils/error.js";
import { type MCPClient } from "./client.js";
import { type MCPToolDefinition } from "./types.js";

/** MCP tool bridge error */
export class MCPBridgeError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "MCP_BRIDGE_ERROR", context);
  }
}

/** Maximum MCP tool output tokens before warning */
const MAX_MCP_OUTPUT_TOKENS = 10_000;

/**
 * Convert an MCP JSON Schema to a Zod schema for tool parameter validation.
 * Handles basic JSON Schema types. Falls back to passthrough for complex schemas.
 */
function jsonSchemaToZod(schema: Readonly<Record<string, unknown>>): z.ZodType {
  const type = schema.type as string | undefined;

  if (type === "object") {
    const properties = (schema.properties ?? {}) as Record<string, Record<string, unknown>>;
    const required = (schema.required ?? []) as string[];
    const shape: Record<string, z.ZodType> = {};

    for (const [key, propSchema] of Object.entries(properties)) {
      let field = jsonSchemaToZod(propSchema);
      if (!required.includes(key)) {
        field = field.optional();
      }
      shape[key] = field;
    }

    return z.object(shape).passthrough();
  }

  if (type === "string") return z.string();
  if (type === "number" || type === "integer") return z.number();
  if (type === "boolean") return z.boolean();
  if (type === "array") {
    const items = schema.items as Record<string, unknown> | undefined;
    return z.array(items ? jsonSchemaToZod(items) : z.unknown());
  }

  return z.record(z.unknown());
}

/**
 * Create a dbcode ToolDefinition from an MCP tool definition.
 * The tool proxies execution to the MCP client.
 */
function bridgeMCPTool(
  mcpTool: MCPToolDefinition,
  client: MCPClient,
  serverName: string,
): ToolDefinition {
  const namespacedName = `mcp__${serverName}__${mcpTool.name}`;
  const parameterSchema = jsonSchemaToZod(mcpTool.inputSchema);

  return {
    name: namespacedName,
    description: `[MCP: ${serverName}] ${mcpTool.description}`,
    parameterSchema,
    permissionLevel: "confirm",
    timeoutMs: 30_000,
    execute: async (params: unknown): Promise<ToolResult> => {
      try {
        const args = (params ?? {}) as Record<string, unknown>;
        const result = await client.callTool(mcpTool.name, args);

        // Combine text content
        const output = result.content
          .map((c) => c.text ?? "")
          .filter(Boolean)
          .join("\n");

        // Warn if output is very large
        if (output.length > MAX_MCP_OUTPUT_TOKENS * 4) {
          const truncated = output.slice(0, MAX_MCP_OUTPUT_TOKENS * 4);
          return {
            output: `${truncated}\n\n[Output truncated: exceeded ${MAX_MCP_OUTPUT_TOKENS} token limit]`,
            isError: false,
            metadata: { truncated: true, serverName },
          };
        }

        return {
          output,
          isError: result.isError === true,
          metadata: { serverName },
        };
      } catch (error) {
        return {
          output: `MCP tool error: ${error instanceof Error ? error.message : String(error)}`,
          isError: true,
          metadata: { serverName },
        };
      }
    },
  };
}

/**
 * MCP tool bridge — discovers tools from MCP servers and registers them
 * in the dbcode tool registry. Supports lazy loading and dynamic updates.
 */
export class MCPToolBridge {
  private readonly registeredTools = new Map<string, readonly string[]>();

  constructor(private readonly toolRegistry: ToolRegistry) {}

  /**
   * Discover and register tools from an MCP client.
   * Tools are namespaced as `mcp__<serverName>__<toolName>`.
   */
  async registerTools(client: MCPClient, serverName: string): Promise<readonly string[]> {
    const mcpTools = await client.listTools();
    const registeredNames: string[] = [];

    for (const mcpTool of mcpTools) {
      const bridged = bridgeMCPTool(mcpTool, client, serverName);

      // Skip if already registered (e.g., reconnect)
      if (!this.toolRegistry.has(bridged.name)) {
        this.toolRegistry.register(bridged);
      }

      registeredNames.push(bridged.name);
    }

    this.registeredTools.set(serverName, registeredNames);

    // Set up list_changed notification handler
    client.setToolsChangedCallback(() => {
      void this.handleListChanged(client, serverName);
    });

    return registeredNames;
  }

  /**
   * Handle tools/list_changed notification.
   * Re-discovers tools from the server and updates the registry.
   */
  private async handleListChanged(client: MCPClient, serverName: string): Promise<void> {
    // For now, we don't remove old tools (registry doesn't support removal).
    // We just register any new tools that appear.
    await this.registerTools(client, serverName);
  }

  /** Get all tool names registered from a specific server */
  getServerTools(serverName: string): readonly string[] {
    return this.registeredTools.get(serverName) ?? [];
  }

  /** Get all server names that have registered tools */
  getRegisteredServers(): readonly string[] {
    return [...this.registeredTools.keys()];
  }

  /**
   * Check if total MCP tool tokens exceed the deferral threshold.
   * When true, tools should be deferred (loaded on demand via ToolSearch).
   */
  shouldDeferTools(mcpToolTokens: number, maxContextTokens: number): boolean {
    return mcpToolTokens > maxContextTokens * 0.1;
  }
}

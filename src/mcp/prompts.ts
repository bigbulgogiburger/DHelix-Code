import { BaseError } from "../utils/error.js";
import { type MCPPrompt, type MCPPromptArgument } from "./types.js";

/** MCP prompt operation error */
export class MCPPromptError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "MCP_PROMPT_ERROR", context);
  }
}

/** Prompt message returned by prompts/get */
export interface MCPPromptMessage {
  readonly role: "user" | "assistant";
  readonly content: {
    readonly type: "text";
    readonly text: string;
  };
}

/** Resolved prompt ready for use */
export interface ResolvedPrompt {
  readonly serverName: string;
  readonly promptName: string;
  readonly description?: string;
  readonly messages: readonly MCPPromptMessage[];
}

/** Prompt client interface (subset of MCPClient needed for prompt operations) */
export interface PromptCapableClient {
  listPrompts(): Promise<readonly MCPPrompt[]>;
  getPrompt(
    name: string,
    args: Record<string, string>,
  ): Promise<{
    readonly messages: readonly MCPPromptMessage[];
  }>;
}

/** Stored prompt entry with server provenance */
interface StoredPrompt {
  readonly serverName: string;
  readonly prompt: MCPPrompt;
}

/**
 * MCP Prompt Manager — discovers, resolves, and executes MCP prompts.
 * Prompts are namespaced as `mcp__{serverName}__{promptName}` to avoid collisions.
 */
export class MCPPromptManager {
  private readonly prompts = new Map<string, StoredPrompt>();

  /**
   * Discover prompts from a connected MCP client and store them.
   * Each prompt is stored under a namespaced key: `mcp__{serverName}__{promptName}`.
   */
  async discoverPrompts(
    client: PromptCapableClient,
    serverName: string,
  ): Promise<readonly MCPPrompt[]> {
    try {
      const discovered = await client.listPrompts();

      for (const prompt of discovered) {
        const namespacedName = `mcp__${serverName}__${prompt.name}`;
        this.prompts.set(namespacedName, {
          serverName,
          prompt,
        });
      }

      return discovered;
    } catch (error) {
      throw new MCPPromptError("Failed to discover prompts", {
        serverName,
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /** Get all discovered prompts */
  getAllPrompts(): ReadonlyMap<string, StoredPrompt> {
    return this.prompts;
  }

  /** Get a prompt by namespaced name (mcp__{serverName}__{promptName}) */
  getPrompt(namespacedName: string): StoredPrompt | undefined {
    return this.prompts.get(namespacedName);
  }

  /**
   * Parse arguments from a command-line string.
   * Supports formats: `key=value`, `key="quoted value"`, `key='single quoted'`.
   * Extra whitespace between pairs is ignored.
   */
  parsePromptArgs(
    argsString: string,
    promptArgs?: readonly MCPPromptArgument[],
  ): Record<string, string> {
    const trimmed = argsString.trim();
    if (trimmed.length === 0) {
      return {};
    }

    const result: Record<string, string> = {};

    // Match key=value pairs, supporting quoted values
    const pattern = /(\w+)=(?:"([^"]*?)"|'([^']*?)'|(\S+))/g;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(trimmed)) !== null) {
      const key = match[1];
      // Value is in one of the capture groups: double-quoted, single-quoted, or unquoted
      const value = match[2] ?? match[3] ?? match[4] ?? "";
      result[key] = value;
    }

    // If no key=value pairs found and there's a single positional arg,
    // assign it to the first argument definition (if available)
    if (
      Object.keys(result).length === 0 &&
      trimmed.length > 0 &&
      promptArgs &&
      promptArgs.length > 0
    ) {
      result[promptArgs[0].name] = trimmed;
    }

    return result;
  }

  /**
   * Validate that all required arguments are provided.
   * Returns the validation result with any missing required argument names.
   */
  validateArgs(
    args: Record<string, string>,
    promptDef: MCPPrompt,
  ): { readonly valid: boolean; readonly missing: readonly string[] } {
    const requiredArgs = (promptDef.arguments ?? []).filter((arg) => arg.required === true);
    const missing = requiredArgs
      .filter((arg) => !(arg.name in args) || args[arg.name].length === 0)
      .map((arg) => arg.name);

    return {
      valid: missing.length === 0,
      missing,
    };
  }

  /**
   * Execute a prompt: get messages from the server with resolved arguments.
   * Validates required arguments before making the request.
   */
  async executePrompt(
    client: PromptCapableClient,
    promptName: string,
    args: Record<string, string>,
  ): Promise<readonly MCPPromptMessage[]> {
    try {
      const response = await client.getPrompt(promptName, args);
      return response.messages;
    } catch (error) {
      throw new MCPPromptError(`Failed to execute prompt: ${promptName}`, {
        promptName,
        args,
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Generate slash commands for all discovered prompts.
   * Each prompt becomes a `/mcp__{serverName}__{promptName}` command.
   * Prompt output is injected as a user message via shouldInjectAsUserMessage.
   */
  generateSlashCommands(
    getClient: (serverName: string) => PromptCapableClient | undefined,
  ): readonly {
    readonly name: string;
    readonly description: string;
    readonly usage: string;
    readonly execute: (args: string) => Promise<{
      readonly output: string;
      readonly success: boolean;
      readonly shouldInjectAsUserMessage?: boolean;
    }>;
  }[] {
    const commands: {
      readonly name: string;
      readonly description: string;
      readonly usage: string;
      readonly execute: (args: string) => Promise<{
        readonly output: string;
        readonly success: boolean;
        readonly shouldInjectAsUserMessage?: boolean;
      }>;
    }[] = [];

    for (const [namespacedName, stored] of this.prompts) {
      const { serverName, prompt } = stored;
      const argHints = (prompt.arguments ?? [])
        .map((a) => (a.required ? `<${a.name}>` : `[${a.name}]`))
        .join(" ");

      commands.push({
        name: namespacedName,
        description: `[MCP: ${serverName}] ${prompt.description ?? prompt.name}`,
        usage: `/${namespacedName}${argHints.length > 0 ? ` ${argHints}` : ""}`,
        execute: async (argsString: string) => {
          const client = getClient(serverName);
          if (!client) {
            return {
              output: `MCP server '${serverName}' is not connected.`,
              success: false,
            };
          }

          const parsedArgs = this.parsePromptArgs(argsString, prompt.arguments);
          const validation = this.validateArgs(parsedArgs, prompt);

          if (!validation.valid) {
            return {
              output: `Missing required arguments: ${validation.missing.join(", ")}`,
              success: false,
            };
          }

          try {
            const messages = await this.executePrompt(client, prompt.name, parsedArgs);
            const textContent = messages
              .map((m) => m.content.text)
              .filter(Boolean)
              .join("\n\n");

            return {
              output: textContent || "(empty prompt response)",
              success: true,
              shouldInjectAsUserMessage: true,
            };
          } catch (error) {
            return {
              output:
                error instanceof MCPPromptError
                  ? error.message
                  : `Prompt execution failed: ${error instanceof Error ? error.message : String(error)}`,
              success: false,
            };
          }
        },
      });
    }

    return commands;
  }

  /** Clear all discovered prompts */
  clear(): void {
    this.prompts.clear();
  }
}

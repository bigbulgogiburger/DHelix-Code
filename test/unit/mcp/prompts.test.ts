import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  MCPPromptManager,
  MCPPromptError,
  type PromptCapableClient,
  type MCPPromptMessage,
} from "../../../src/mcp/prompts.js";
import { type MCPPrompt } from "../../../src/mcp/types.js";

/** Helper to create a mock PromptCapableClient */
function createMockClient(
  prompts: readonly MCPPrompt[] = [],
  messages: readonly MCPPromptMessage[] = [],
): PromptCapableClient {
  return {
    listPrompts: vi.fn<() => Promise<readonly MCPPrompt[]>>().mockResolvedValue(prompts),
    getPrompt: vi
      .fn<
        (
          name: string,
          args: Record<string, string>,
        ) => Promise<{ readonly messages: readonly MCPPromptMessage[] }>
      >()
      .mockResolvedValue({ messages }),
  };
}

/** Helper to create a prompt message */
function createMessage(role: "user" | "assistant", text: string): MCPPromptMessage {
  return {
    role,
    content: { type: "text" as const, text },
  };
}

describe("MCPPromptManager", () => {
  let manager: MCPPromptManager;

  beforeEach(() => {
    manager = new MCPPromptManager();
  });

  describe("discoverPrompts", () => {
    it("should discover prompts from a client and store them", async () => {
      const prompts: MCPPrompt[] = [
        { name: "summarize", description: "Summarize text" },
        {
          name: "translate",
          description: "Translate text",
          arguments: [{ name: "language", required: true }],
        },
      ];
      const client = createMockClient(prompts);

      const result = await manager.discoverPrompts(client, "test-server");

      expect(result).toEqual(prompts);
      expect(client.listPrompts).toHaveBeenCalledOnce();
      expect(manager.getAllPrompts().size).toBe(2);
      expect(manager.getPrompt("mcp__test-server__summarize")).toBeDefined();
      expect(manager.getPrompt("mcp__test-server__translate")).toBeDefined();
    });

    it("should store prompts with correct server name", async () => {
      const prompts: MCPPrompt[] = [{ name: "greet", description: "Greet user" }];
      const client = createMockClient(prompts);

      await manager.discoverPrompts(client, "my-server");

      const stored = manager.getPrompt("mcp__my-server__greet");
      expect(stored).toBeDefined();
      expect(stored!.serverName).toBe("my-server");
      expect(stored!.prompt.name).toBe("greet");
    });

    it("should handle empty prompt list", async () => {
      const client = createMockClient([]);

      const result = await manager.discoverPrompts(client, "empty-server");

      expect(result).toEqual([]);
      expect(manager.getAllPrompts().size).toBe(0);
    });

    it("should overwrite existing prompts from same server on rediscovery", async () => {
      const client1 = createMockClient([{ name: "old", description: "Old prompt" }]);
      await manager.discoverPrompts(client1, "server");

      const client2 = createMockClient([{ name: "old", description: "Updated prompt" }]);
      await manager.discoverPrompts(client2, "server");

      const stored = manager.getPrompt("mcp__server__old");
      expect(stored!.prompt.description).toBe("Updated prompt");
    });

    it("should store prompts from multiple servers", async () => {
      const client1 = createMockClient([{ name: "foo", description: "Foo" }]);
      const client2 = createMockClient([{ name: "bar", description: "Bar" }]);

      await manager.discoverPrompts(client1, "server-a");
      await manager.discoverPrompts(client2, "server-b");

      expect(manager.getAllPrompts().size).toBe(2);
      expect(manager.getPrompt("mcp__server-a__foo")).toBeDefined();
      expect(manager.getPrompt("mcp__server-b__bar")).toBeDefined();
    });

    it("should throw MCPPromptError when client.listPrompts fails", async () => {
      const client = createMockClient();
      vi.mocked(client.listPrompts).mockRejectedValue(new Error("Connection lost"));

      await expect(manager.discoverPrompts(client, "failing-server")).rejects.toThrow(
        MCPPromptError,
      );
      await expect(manager.discoverPrompts(client, "failing-server")).rejects.toThrow(
        "Failed to discover prompts",
      );
    });
  });

  describe("getAllPrompts", () => {
    it("should return empty map when no prompts discovered", () => {
      const allPrompts = manager.getAllPrompts();
      expect(allPrompts.size).toBe(0);
    });

    it("should return all discovered prompts", async () => {
      const client = createMockClient([
        { name: "a", description: "A" },
        { name: "b", description: "B" },
      ]);
      await manager.discoverPrompts(client, "srv");

      const allPrompts = manager.getAllPrompts();
      expect(allPrompts.size).toBe(2);
      expect(allPrompts.has("mcp__srv__a")).toBe(true);
      expect(allPrompts.has("mcp__srv__b")).toBe(true);
    });
  });

  describe("getPrompt", () => {
    it("should return undefined for non-existent prompt", () => {
      expect(manager.getPrompt("mcp__unknown__nonexistent")).toBeUndefined();
    });

    it("should return stored prompt by namespaced name", async () => {
      const client = createMockClient([
        {
          name: "review",
          description: "Code review",
          arguments: [{ name: "file", required: true }],
        },
      ]);
      await manager.discoverPrompts(client, "tools");

      const stored = manager.getPrompt("mcp__tools__review");
      expect(stored).toBeDefined();
      expect(stored!.serverName).toBe("tools");
      expect(stored!.prompt.name).toBe("review");
      expect(stored!.prompt.arguments).toHaveLength(1);
    });
  });

  describe("parsePromptArgs", () => {
    it("should parse simple key=value pairs", () => {
      const result = manager.parsePromptArgs("name=John age=30");
      expect(result).toEqual({ name: "John", age: "30" });
    });

    it("should parse double-quoted values", () => {
      const result = manager.parsePromptArgs('message="hello world" sender="Jane Doe"');
      expect(result).toEqual({ message: "hello world", sender: "Jane Doe" });
    });

    it("should parse single-quoted values", () => {
      const result = manager.parsePromptArgs("message='hello world'");
      expect(result).toEqual({ message: "hello world" });
    });

    it("should handle empty string", () => {
      const result = manager.parsePromptArgs("");
      expect(result).toEqual({});
    });

    it("should handle whitespace-only string", () => {
      const result = manager.parsePromptArgs("   ");
      expect(result).toEqual({});
    });

    it("should handle extra spaces between pairs", () => {
      const result = manager.parsePromptArgs("  key1=value1    key2=value2  ");
      expect(result).toEqual({ key1: "value1", key2: "value2" });
    });

    it("should handle mixed quoted and unquoted values", () => {
      const result = manager.parsePromptArgs('lang=en message="translate this"');
      expect(result).toEqual({ lang: "en", message: "translate this" });
    });

    it("should assign positional arg to first argument definition when no key=value found", () => {
      const promptArgs = [{ name: "query", required: true }];
      const result = manager.parsePromptArgs("some text here", promptArgs);
      expect(result).toEqual({ query: "some text here" });
    });

    it("should not assign positional arg when key=value pairs exist", () => {
      const promptArgs = [{ name: "query", required: true }];
      const result = manager.parsePromptArgs("query=specific", promptArgs);
      expect(result).toEqual({ query: "specific" });
    });

    it("should not assign positional arg when no prompt args defined", () => {
      const result = manager.parsePromptArgs("some bare text");
      expect(result).toEqual({});
    });

    it("should handle empty quoted values", () => {
      const result = manager.parsePromptArgs('name=""');
      expect(result).toEqual({ name: "" });
    });
  });

  describe("validateArgs", () => {
    it("should return valid when all required args are present", () => {
      const prompt: MCPPrompt = {
        name: "test",
        arguments: [
          { name: "file", required: true },
          { name: "lang", required: true },
        ],
      };

      const result = manager.validateArgs({ file: "main.ts", lang: "en" }, prompt);
      expect(result.valid).toBe(true);
      expect(result.missing).toEqual([]);
    });

    it("should return invalid with missing required args", () => {
      const prompt: MCPPrompt = {
        name: "test",
        arguments: [
          { name: "file", required: true },
          { name: "lang", required: true },
          { name: "format", required: false },
        ],
      };

      const result = manager.validateArgs({ format: "json" }, prompt);
      expect(result.valid).toBe(false);
      expect(result.missing).toEqual(["file", "lang"]);
    });

    it("should return valid when no arguments are defined", () => {
      const prompt: MCPPrompt = { name: "test" };
      const result = manager.validateArgs({}, prompt);
      expect(result.valid).toBe(true);
      expect(result.missing).toEqual([]);
    });

    it("should return valid when all arguments are optional", () => {
      const prompt: MCPPrompt = {
        name: "test",
        arguments: [{ name: "opt1", required: false }, { name: "opt2" }],
      };

      const result = manager.validateArgs({}, prompt);
      expect(result.valid).toBe(true);
      expect(result.missing).toEqual([]);
    });

    it("should treat empty string values as missing for required args", () => {
      const prompt: MCPPrompt = {
        name: "test",
        arguments: [{ name: "file", required: true }],
      };

      const result = manager.validateArgs({ file: "" }, prompt);
      expect(result.valid).toBe(false);
      expect(result.missing).toEqual(["file"]);
    });

    it("should allow extra args not in definition", () => {
      const prompt: MCPPrompt = {
        name: "test",
        arguments: [{ name: "file", required: true }],
      };

      const result = manager.validateArgs({ file: "main.ts", extra: "value" }, prompt);
      expect(result.valid).toBe(true);
      expect(result.missing).toEqual([]);
    });
  });

  describe("executePrompt", () => {
    it("should call client.getPrompt and return messages", async () => {
      const messages = [
        createMessage("user", "Summarize this code"),
        createMessage("assistant", "Here is the summary..."),
      ];
      const client = createMockClient([], messages);

      const result = await manager.executePrompt(client, "summarize", { code: "const x = 1" });

      expect(result).toEqual(messages);
      expect(client.getPrompt).toHaveBeenCalledWith("summarize", { code: "const x = 1" });
    });

    it("should pass empty args when none provided", async () => {
      const messages = [createMessage("user", "Hello")];
      const client = createMockClient([], messages);

      await manager.executePrompt(client, "greet", {});

      expect(client.getPrompt).toHaveBeenCalledWith("greet", {});
    });

    it("should throw MCPPromptError when client.getPrompt fails", async () => {
      const client = createMockClient();
      vi.mocked(client.getPrompt).mockRejectedValue(new Error("Prompt not found"));

      await expect(manager.executePrompt(client, "missing", {})).rejects.toThrow(MCPPromptError);
      await expect(manager.executePrompt(client, "missing", {})).rejects.toThrow(
        "Failed to execute prompt: missing",
      );
    });
  });

  describe("generateSlashCommands", () => {
    it("should generate a command for each discovered prompt", async () => {
      const prompts: MCPPrompt[] = [
        { name: "summarize", description: "Summarize text" },
        { name: "review", description: "Review code" },
      ];
      const client = createMockClient(prompts);
      await manager.discoverPrompts(client, "tools");

      const commands = manager.generateSlashCommands(() => client);

      expect(commands).toHaveLength(2);
      expect(commands[0].name).toBe("mcp__tools__summarize");
      expect(commands[0].description).toContain("[MCP: tools]");
      expect(commands[0].description).toContain("Summarize text");
      expect(commands[1].name).toBe("mcp__tools__review");
    });

    it("should set correct usage with argument hints", async () => {
      const prompts: MCPPrompt[] = [
        {
          name: "translate",
          description: "Translate",
          arguments: [
            { name: "text", required: true },
            { name: "lang", required: false },
          ],
        },
      ];
      const client = createMockClient(prompts);
      await manager.discoverPrompts(client, "i18n");

      const commands = manager.generateSlashCommands(() => client);

      expect(commands[0].usage).toBe("/mcp__i18n__translate <text> [lang]");
    });

    it("should execute prompt and return text with shouldInjectAsUserMessage", async () => {
      const prompts: MCPPrompt[] = [{ name: "hello", description: "Greet" }];
      const messages = [createMessage("user", "Hello there!")];
      const client = createMockClient(prompts, messages);
      await manager.discoverPrompts(client, "srv");

      const commands = manager.generateSlashCommands(() => client);
      const result = await commands[0].execute("");

      expect(result.success).toBe(true);
      expect(result.output).toBe("Hello there!");
      expect(result.shouldInjectAsUserMessage).toBe(true);
    });

    it("should combine multiple message texts", async () => {
      const prompts: MCPPrompt[] = [{ name: "multi", description: "Multi-message" }];
      const messages = [createMessage("user", "Part 1"), createMessage("assistant", "Part 2")];
      const client = createMockClient(prompts, messages);
      await manager.discoverPrompts(client, "srv");

      const commands = manager.generateSlashCommands(() => client);
      const result = await commands[0].execute("");

      expect(result.output).toBe("Part 1\n\nPart 2");
    });

    it("should return error when client is not connected", async () => {
      const prompts: MCPPrompt[] = [{ name: "test", description: "Test" }];
      const client = createMockClient(prompts);
      await manager.discoverPrompts(client, "offline");

      const commands = manager.generateSlashCommands(() => undefined);
      const result = await commands[0].execute("");

      expect(result.success).toBe(false);
      expect(result.output).toContain("not connected");
    });

    it("should return error when required args are missing", async () => {
      const prompts: MCPPrompt[] = [
        {
          name: "translate",
          description: "Translate",
          arguments: [{ name: "text", required: true }],
        },
      ];
      const client = createMockClient(prompts);
      await manager.discoverPrompts(client, "srv");

      const commands = manager.generateSlashCommands(() => client);
      const result = await commands[0].execute("");

      expect(result.success).toBe(false);
      expect(result.output).toContain("Missing required arguments");
      expect(result.output).toContain("text");
    });

    it("should handle prompt execution failure gracefully", async () => {
      const prompts: MCPPrompt[] = [{ name: "broken", description: "Broken" }];
      const client = createMockClient(prompts);
      vi.mocked(client.getPrompt).mockRejectedValue(new Error("Server crashed"));
      await manager.discoverPrompts(client, "srv");

      const commands = manager.generateSlashCommands(() => client);
      const result = await commands[0].execute("");

      expect(result.success).toBe(false);
      expect(result.output).toContain("Failed to execute prompt");
    });

    it("should return empty prompt response text when messages have no text", async () => {
      const prompts: MCPPrompt[] = [{ name: "empty", description: "Empty" }];
      const client = createMockClient(prompts, []);
      await manager.discoverPrompts(client, "srv");

      const commands = manager.generateSlashCommands(() => client);
      const result = await commands[0].execute("");

      expect(result.output).toBe("(empty prompt response)");
      expect(result.success).toBe(true);
    });

    it("should pass parsed args to executePrompt", async () => {
      const prompts: MCPPrompt[] = [
        {
          name: "greet",
          description: "Greet",
          arguments: [{ name: "name", required: true }],
        },
      ];
      const messages = [createMessage("user", "Hello, World!")];
      const client = createMockClient(prompts, messages);
      await manager.discoverPrompts(client, "srv");

      const commands = manager.generateSlashCommands(() => client);
      await commands[0].execute("name=Alice");

      expect(client.getPrompt).toHaveBeenCalledWith("greet", { name: "Alice" });
    });

    it("should return no commands when no prompts discovered", () => {
      const commands = manager.generateSlashCommands(() => undefined);
      expect(commands).toEqual([]);
    });

    it("should use prompt name as description when description is undefined", async () => {
      const prompts: MCPPrompt[] = [{ name: "nodesc" }];
      const client = createMockClient(prompts);
      await manager.discoverPrompts(client, "srv");

      const commands = manager.generateSlashCommands(() => client);
      expect(commands[0].description).toBe("[MCP: srv] nodesc");
    });
  });

  describe("clear", () => {
    it("should remove all discovered prompts", async () => {
      const client = createMockClient([
        { name: "a", description: "A" },
        { name: "b", description: "B" },
      ]);
      await manager.discoverPrompts(client, "srv");
      expect(manager.getAllPrompts().size).toBe(2);

      manager.clear();

      expect(manager.getAllPrompts().size).toBe(0);
      expect(manager.getPrompt("mcp__srv__a")).toBeUndefined();
      expect(manager.getPrompt("mcp__srv__b")).toBeUndefined();
    });

    it("should be safe to call on empty manager", () => {
      expect(() => manager.clear()).not.toThrow();
      expect(manager.getAllPrompts().size).toBe(0);
    });

    it("should allow re-discovery after clear", async () => {
      const client = createMockClient([{ name: "x", description: "X" }]);
      await manager.discoverPrompts(client, "srv");
      manager.clear();

      const newClient = createMockClient([{ name: "y", description: "Y" }]);
      await manager.discoverPrompts(newClient, "srv");

      expect(manager.getAllPrompts().size).toBe(1);
      expect(manager.getPrompt("mcp__srv__y")).toBeDefined();
      expect(manager.getPrompt("mcp__srv__x")).toBeUndefined();
    });
  });

  describe("MCPPromptError", () => {
    it("should be an instance of Error and BaseError", () => {
      const error = new MCPPromptError("test error", { detail: "info" });
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe("test error");
      expect(error.code).toBe("MCP_PROMPT_ERROR");
      expect(error.context).toEqual({ detail: "info" });
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ResourceManager,
  ResourceManagerError,
  type ResourceTemplate,
  type ResourceCapableClient,
  type PromptCapableClient,
  type PromptMessage,
} from "../../../src/mcp/resource-manager.js";
import { type MCPResource } from "../../../src/mcp/types.js";

// ──────────────────────────────────────────────────────────────────────────────
// Mock factory helpers
// ──────────────────────────────────────────────────────────────────────────────

function createMockResourceClient(
  resources: readonly MCPResource[] = [],
  readContent = "mock content",
): ResourceCapableClient {
  return {
    listResources: vi.fn().mockResolvedValue(resources),
    readResource: vi.fn().mockResolvedValue(readContent),
  };
}

function createMockPromptClient(
  prompts: readonly { name: string; description?: string; arguments?: [] }[] = [],
  promptMessages: readonly PromptMessage[] = [],
): PromptCapableClient {
  return {
    listPrompts: vi.fn().mockResolvedValue(prompts),
    getPrompt: vi.fn().mockResolvedValue({ messages: promptMessages }),
  };
}

const SAMPLE_RESOURCES: readonly MCPResource[] = [
  { uri: "file:///data/hello.txt", name: "hello", description: "Hello file", mimeType: "text/plain" },
  { uri: "postgres://localhost/mydb", name: "mydb", mimeType: "application/json" },
];

const SAMPLE_PROMPTS = [
  { name: "summarize", description: "Summarize text", arguments: [] },
  { name: "translate", description: "Translate text", arguments: [{ name: "lang", required: true }] },
];

const SAMPLE_MESSAGES: readonly PromptMessage[] = [
  { role: "user", content: { type: "text", text: "Please summarize this." } },
  { role: "assistant", content: { type: "text", text: "Summary: ..." } },
];

// ──────────────────────────────────────────────────────────────────────────────
// ResourceManager — setup
// ──────────────────────────────────────────────────────────────────────────────

describe("ResourceManager", () => {
  let manager: ResourceManager;

  beforeEach(() => {
    manager = new ResourceManager();
  });

  // ────────────────────────────────────────────────────────────────────────────
  // registerClient / unregisterClient
  // ────────────────────────────────────────────────────────────────────────────

  describe("registerClient / unregisterClient", () => {
    it("should register a client and allow resource listing", async () => {
      const client = createMockResourceClient(SAMPLE_RESOURCES);
      manager.registerClient("server-1", client);

      const resources = await manager.listResources("server-1");
      expect(resources).toHaveLength(2);
    });

    it("should throw ResourceManagerError for unregistered server", async () => {
      await expect(manager.listResources("unknown-server")).rejects.toThrow(ResourceManagerError);
    });

    it("should remove client on unregister", async () => {
      const client = createMockResourceClient(SAMPLE_RESOURCES);
      manager.registerClient("server-1", client);
      manager.unregisterClient("server-1");

      await expect(manager.listResources("server-1")).rejects.toThrow(ResourceManagerError);
    });

    it("should clean up subscriptions on unregister", () => {
      const client = createMockResourceClient();
      manager.registerClient("server-1", client);

      manager.subscribeToChanges("server-1", "file:///test.txt", () => {});
      expect(manager.getSubscriptionCount("server-1")).toBe(1);

      manager.unregisterClient("server-1");
      expect(manager.getSubscriptionCount("server-1")).toBe(0);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // listResources
  // ────────────────────────────────────────────────────────────────────────────

  describe("listResources", () => {
    it("should return resources from the registered client", async () => {
      const client = createMockResourceClient(SAMPLE_RESOURCES);
      manager.registerClient("server-1", client);

      const resources = await manager.listResources("server-1");

      expect(resources).toHaveLength(2);
      expect(resources[0].uri).toBe("file:///data/hello.txt");
      expect(resources[1].name).toBe("mydb");
    });

    it("should return empty array when server has no resources", async () => {
      const client = createMockResourceClient([]);
      manager.registerClient("server-1", client);

      const resources = await manager.listResources("server-1");
      expect(resources).toHaveLength(0);
    });

    it("should throw ResourceManagerError when listResources fails", async () => {
      const client = createMockResourceClient();
      (client.listResources as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("Network error"));
      manager.registerClient("server-1", client);

      await expect(manager.listResources("server-1")).rejects.toThrow(ResourceManagerError);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // readResource
  // ────────────────────────────────────────────────────────────────────────────

  describe("readResource", () => {
    it("should return ResourceContent with text", async () => {
      const client = createMockResourceClient([], "Hello World");
      manager.registerClient("server-1", client);

      const content = await manager.readResource("server-1", "file:///hello.txt");

      expect(content.uri).toBe("file:///hello.txt");
      expect(content.text).toBe("Hello World");
    });

    it("should call readResource on client with correct URI", async () => {
      const client = createMockResourceClient([], "content");
      manager.registerClient("server-1", client);

      await manager.readResource("server-1", "file:///data.txt");

      expect(client.readResource).toHaveBeenCalledWith("file:///data.txt");
    });

    it("should throw ResourceManagerError when read fails", async () => {
      const client = createMockResourceClient();
      (client.readResource as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("Not found"));
      manager.registerClient("server-1", client);

      await expect(manager.readResource("server-1", "file:///missing.txt")).rejects.toThrow(
        ResourceManagerError,
      );
    });

    it("should throw ResourceManagerError for unregistered server", async () => {
      await expect(manager.readResource("ghost", "file:///x.txt")).rejects.toThrow(
        ResourceManagerError,
      );
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // listResourceTemplates
  // ────────────────────────────────────────────────────────────────────────────

  describe("listResourceTemplates", () => {
    it("should return empty array for unregistered server", async () => {
      // Uses a client without sendRequest method
      const client = createMockResourceClient();
      manager.registerClient("server-1", client);

      const templates = await manager.listResourceTemplates("server-1");
      expect(templates).toHaveLength(0);
    });

    it("should throw ResourceManagerError for unregistered server", async () => {
      await expect(manager.listResourceTemplates("unknown")).rejects.toThrow(ResourceManagerError);
    });

    it("should return templates when client supports sendRequest", async () => {
      const mockTemplates: ResourceTemplate[] = [
        { uriTemplate: "file:///repo/{owner}/{repo}", name: "Repo", mimeType: "text/plain" },
      ];

      const client = {
        ...createMockResourceClient(),
        sendRequest: vi.fn().mockResolvedValue({ resourceTemplates: mockTemplates }),
      };
      manager.registerClient("server-1", client);

      const templates = await manager.listResourceTemplates("server-1");
      expect(templates).toHaveLength(1);
      expect(templates[0].uriTemplate).toBe("file:///repo/{owner}/{repo}");
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // expandTemplate
  // ────────────────────────────────────────────────────────────────────────────

  describe("expandTemplate", () => {
    it("should expand single variable in template", () => {
      const template: ResourceTemplate = {
        uriTemplate: "file:///data/{id}",
        name: "Data",
      };
      const result = manager.expandTemplate(template, { id: "123" });
      expect(result).toBe("file:///data/123");
    });

    it("should expand multiple variables", () => {
      const result = manager.expandTemplate(
        "file:///repo/{owner}/{repo}/blob/{ref}/{path}",
        { owner: "alice", repo: "mycode", ref: "main", path: "src/index.ts" },
      );
      expect(result).toBe("file:///repo/alice/mycode/blob/main/src%2Findex.ts");
    });

    it("should replace missing variables with empty string", () => {
      const result = manager.expandTemplate("search?q={query}&lang={lang}", { query: "hello" });
      expect(result).toBe("search?q=hello&lang=");
    });

    it("should accept ResourceTemplate object", () => {
      const template: ResourceTemplate = {
        uriTemplate: "db://{host}/{database}",
        name: "DB Connection",
      };
      const result = manager.expandTemplate(template, { host: "localhost", database: "mydb" });
      expect(result).toBe("db://localhost/mydb");
    });

    it("should percent-encode special characters in variable values", () => {
      const result = manager.expandTemplate("search?q={query}", { query: "hello world" });
      expect(result).toBe("search?q=hello%20world");
    });

    it("should return template unchanged when no variables", () => {
      const result = manager.expandTemplate("file:///static/path", {});
      expect(result).toBe("file:///static/path");
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // listPrompts
  // ────────────────────────────────────────────────────────────────────────────

  describe("listPrompts", () => {
    it("should return prompt templates from server", async () => {
      const client = createMockPromptClient(SAMPLE_PROMPTS);
      manager.registerClient("server-1", client);

      const prompts = await manager.listPrompts("server-1");

      expect(prompts).toHaveLength(2);
      expect(prompts[0].name).toBe("summarize");
      expect(prompts[1].name).toBe("translate");
    });

    it("should return empty array when no prompts", async () => {
      const client = createMockPromptClient([]);
      manager.registerClient("server-1", client);

      const prompts = await manager.listPrompts("server-1");
      expect(prompts).toHaveLength(0);
    });

    it("should throw ResourceManagerError when listPrompts fails", async () => {
      const client = createMockPromptClient();
      (client.listPrompts as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("timeout"));
      manager.registerClient("server-1", client);

      await expect(manager.listPrompts("server-1")).rejects.toThrow(ResourceManagerError);
    });

    it("should throw ResourceManagerError for unregistered server", async () => {
      await expect(manager.listPrompts("unknown")).rejects.toThrow(ResourceManagerError);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // getPrompt
  // ────────────────────────────────────────────────────────────────────────────

  describe("getPrompt", () => {
    it("should return PromptResult with messages", async () => {
      const client = createMockPromptClient(SAMPLE_PROMPTS, SAMPLE_MESSAGES);
      manager.registerClient("server-1", client);

      const result = await manager.getPrompt("server-1", "summarize", { text: "hello" });

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].role).toBe("user");
      expect(result.messages[1].role).toBe("assistant");
    });

    it("should pass correct arguments to client.getPrompt", async () => {
      const client = createMockPromptClient(SAMPLE_PROMPTS, SAMPLE_MESSAGES);
      manager.registerClient("server-1", client);

      await manager.getPrompt("server-1", "translate", { lang: "ko", text: "hello" });

      expect(client.getPrompt).toHaveBeenCalledWith("translate", { lang: "ko", text: "hello" });
    });

    it("should use empty args when none provided", async () => {
      const client = createMockPromptClient(SAMPLE_PROMPTS, SAMPLE_MESSAGES);
      manager.registerClient("server-1", client);

      await manager.getPrompt("server-1", "summarize");

      expect(client.getPrompt).toHaveBeenCalledWith("summarize", {});
    });

    it("should include description when provided", async () => {
      const clientWithDesc = {
        listPrompts: vi.fn().mockResolvedValue(SAMPLE_PROMPTS),
        getPrompt: vi.fn().mockResolvedValue({
          description: "A summary of the text",
          messages: SAMPLE_MESSAGES,
        }),
      };
      manager.registerClient("server-1", clientWithDesc);

      const result = await manager.getPrompt("server-1", "summarize");
      expect(result.description).toBe("A summary of the text");
    });

    it("should throw ResourceManagerError when getPrompt fails", async () => {
      const client = createMockPromptClient();
      (client.getPrompt as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("Prompt not found"));
      manager.registerClient("server-1", client);

      await expect(manager.getPrompt("server-1", "missing-prompt")).rejects.toThrow(
        ResourceManagerError,
      );
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // subscribeToChanges
  // ────────────────────────────────────────────────────────────────────────────

  describe("subscribeToChanges", () => {
    it("should call callback when notifyResourceChanged is invoked", () => {
      const callback = vi.fn();
      manager.subscribeToChanges("server-1", "file:///data.txt", callback);

      manager.notifyResourceChanged("server-1", "file:///data.txt");

      expect(callback).toHaveBeenCalledOnce();
      expect(callback).toHaveBeenCalledWith("file:///data.txt");
    });

    it("should return unsubscribe function that removes the callback", () => {
      const callback = vi.fn();
      const unsubscribe = manager.subscribeToChanges("server-1", "file:///data.txt", callback);

      unsubscribe();
      manager.notifyResourceChanged("server-1", "file:///data.txt");

      expect(callback).not.toHaveBeenCalled();
    });

    it("should support multiple subscribers for the same URI", () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      manager.subscribeToChanges("server-1", "file:///data.txt", cb1);
      manager.subscribeToChanges("server-1", "file:///data.txt", cb2);

      manager.notifyResourceChanged("server-1", "file:///data.txt");

      expect(cb1).toHaveBeenCalledOnce();
      expect(cb2).toHaveBeenCalledOnce();
    });

    it("should not call callbacks for different URIs", () => {
      const callback = vi.fn();
      manager.subscribeToChanges("server-1", "file:///a.txt", callback);

      manager.notifyResourceChanged("server-1", "file:///b.txt");

      expect(callback).not.toHaveBeenCalled();
    });

    it("should not call callbacks for different server IDs", () => {
      const callback = vi.fn();
      manager.subscribeToChanges("server-1", "file:///data.txt", callback);

      manager.notifyResourceChanged("server-2", "file:///data.txt");

      expect(callback).not.toHaveBeenCalled();
    });

    it("should track subscription count per server", () => {
      manager.subscribeToChanges("server-1", "file:///a.txt", vi.fn());
      manager.subscribeToChanges("server-1", "file:///b.txt", vi.fn());
      manager.subscribeToChanges("server-2", "file:///c.txt", vi.fn());

      expect(manager.getSubscriptionCount("server-1")).toBe(2);
      expect(manager.getSubscriptionCount("server-2")).toBe(1);
    });

    it("should remove subscription key when last subscriber unsubscribes", () => {
      const cb = vi.fn();
      const unsub = manager.subscribeToChanges("server-1", "file:///data.txt", cb);

      unsub();

      expect(manager.getSubscriptionCount("server-1")).toBe(0);
    });

    it("should not throw when notifying URI with no subscribers", () => {
      expect(() => {
        manager.notifyResourceChanged("server-1", "file:///no-subscribers.txt");
      }).not.toThrow();
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // ResourceManagerError
  // ────────────────────────────────────────────────────────────────────────────

  describe("ResourceManagerError", () => {
    it("should have correct error code", () => {
      const error = new ResourceManagerError("test error", { serverId: "x" });
      expect(error.code).toBe("RESOURCE_MANAGER_ERROR");
      expect(error.context.serverId).toBe("x");
    });
  });
});

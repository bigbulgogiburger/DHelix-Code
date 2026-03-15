import { describe, it, expect, beforeEach } from "vitest";
import { LazyToolLoader, type ToolSummary, type ToolSchema } from "../../../src/tools/lazy-tool-loader.js";

/** Helper to create a batch of test tools */
function createTestTools(count: number): readonly { name: string; description: string; parameters: Record<string, unknown> }[] {
  return Array.from({ length: count }, (_, i) => ({
    name: `tool_${i}`,
    description: `Tool ${i} does things. It has many features and options.`,
    parameters: { type: "object", properties: { arg: { type: "string" } }, required: ["arg"] },
  }));
}

describe("LazyToolLoader", () => {
  let loader: LazyToolLoader;

  beforeEach(() => {
    loader = new LazyToolLoader();
  });

  describe("registerTool / registerAll", () => {
    it("should register a single tool", () => {
      loader.registerTool("test_tool", "A test tool.", { type: "object" });
      expect(loader.size).toBe(1);
    });

    it("should register multiple tools at once", () => {
      const tools = createTestTools(5);
      loader.registerAll(tools);
      expect(loader.size).toBe(5);
    });

    it("should overwrite tool with same name", () => {
      loader.registerTool("test", "First.", { type: "object" });
      loader.registerTool("test", "Second.", { type: "object" });
      expect(loader.size).toBe(1);

      const schema = loader.loadFullSchema("test");
      expect(schema?.description).toBe("Second.");
    });
  });

  describe("getToolSummaries — HIGH tier", () => {
    it("should mark all tools as schema loaded", () => {
      loader.registerAll(createTestTools(15));
      const summaries = loader.getToolSummaries("high");

      expect(summaries).toHaveLength(15);
      for (const s of summaries) {
        expect(s.schemaLoaded).toBe(true);
      }
    });

    it("should include short descriptions", () => {
      loader.registerTool("file_read", "Read a file from disk. Supports offsets.", { type: "object" });
      const summaries = loader.getToolSummaries("high");

      expect(summaries[0].shortDescription).toBe("Read a file from disk.");
    });
  });

  describe("getToolSummaries — MEDIUM tier", () => {
    it("should load priority tools fully", () => {
      loader.registerTool("file_read", "Read files.", { type: "object" });
      loader.registerTool("bash_exec", "Run commands.", { type: "object" });
      loader.registerAll(createTestTools(15));

      const summaries = loader.getToolSummaries("medium");
      const fileRead = summaries.find((s) => s.name === "file_read");
      const bashExec = summaries.find((s) => s.name === "bash_exec");

      expect(fileRead?.schemaLoaded).toBe(true);
      expect(bashExec?.schemaLoaded).toBe(true);
    });

    it("should limit fully loaded tools to 10 for non-priority", () => {
      loader.registerAll(createTestTools(20));
      const summaries = loader.getToolSummaries("medium");

      const loadedCount = summaries.filter((s) => s.schemaLoaded).length;
      expect(loadedCount).toBeLessThanOrEqual(10);
    });

    it("should provide short descriptions for unloaded tools", () => {
      loader.registerAll(createTestTools(15));
      const summaries = loader.getToolSummaries("medium");

      const unloaded = summaries.filter((s) => !s.schemaLoaded);
      for (const s of unloaded) {
        expect(s.shortDescription.length).toBeGreaterThan(0);
      }
    });
  });

  describe("getToolSummaries — LOW tier", () => {
    it("should mark no tools as schema loaded", () => {
      loader.registerAll(createTestTools(10));
      const summaries = loader.getToolSummaries("low");

      for (const s of summaries) {
        expect(s.schemaLoaded).toBe(false);
      }
    });

    it("should use tool name as short description", () => {
      loader.registerTool("file_read", "Read a file from disk.", { type: "object" });
      const summaries = loader.getToolSummaries("low");

      expect(summaries[0].shortDescription).toBe("file_read");
    });
  });

  describe("loadFullSchema", () => {
    it("should return full schema for a registered tool", () => {
      const params = { type: "object", properties: { path: { type: "string" } } };
      loader.registerTool("file_read", "Read a file.", params);

      const schema = loader.loadFullSchema("file_read");
      expect(schema).not.toBeNull();
      expect(schema!.name).toBe("file_read");
      expect(schema!.description).toBe("Read a file.");
      expect(schema!.parameters).toEqual(params);
    });

    it("should return null for unregistered tool", () => {
      const schema = loader.loadFullSchema("nonexistent");
      expect(schema).toBeNull();
    });

    it("should mark tool as loaded after loadFullSchema", () => {
      loader.registerTool("test", "Test.", { type: "object" });
      expect(loader.isSchemaLoaded("test")).toBe(false);

      loader.loadFullSchema("test");
      expect(loader.isSchemaLoaded("test")).toBe(true);
    });
  });

  describe("isSchemaLoaded", () => {
    it("should return false for newly registered tools", () => {
      loader.registerTool("test", "Test.", { type: "object" });
      expect(loader.isSchemaLoaded("test")).toBe(false);
    });

    it("should return true after HIGH tier getToolSummaries", () => {
      loader.registerTool("test", "Test.", { type: "object" });
      loader.getToolSummaries("high");
      expect(loader.isSchemaLoaded("test")).toBe(true);
    });

    it("should return false for unknown tools", () => {
      expect(loader.isSchemaLoaded("unknown")).toBe(false);
    });
  });

  describe("size and loadedCount", () => {
    it("should track registered tool count", () => {
      expect(loader.size).toBe(0);
      loader.registerTool("a", "A.", {});
      loader.registerTool("b", "B.", {});
      expect(loader.size).toBe(2);
    });

    it("should track loaded schema count", () => {
      loader.registerAll(createTestTools(5));
      expect(loader.loadedCount).toBe(0);

      loader.loadFullSchema("tool_0");
      expect(loader.loadedCount).toBe(1);

      loader.getToolSummaries("high");
      expect(loader.loadedCount).toBe(5);
    });
  });
});

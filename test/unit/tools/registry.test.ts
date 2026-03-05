import { describe, it, expect } from "vitest";
import { z } from "zod";
import { ToolRegistry } from "../../../src/tools/registry.js";
import { type ToolDefinition } from "../../../src/tools/types.js";

function createMockTool(name: string): ToolDefinition {
  return {
    name,
    description: `Mock tool: ${name}`,
    parameterSchema: z.object({ input: z.string() }),
    permissionLevel: "safe",
    execute: async () => ({ output: "ok", isError: false }),
  };
}

describe("ToolRegistry", () => {
  it("should register and retrieve tools", () => {
    const registry = new ToolRegistry();
    const tool = createMockTool("test_tool");
    registry.register(tool);

    expect(registry.has("test_tool")).toBe(true);
    expect(registry.get("test_tool")).toBe(tool);
    expect(registry.size).toBe(1);
  });

  it("should throw on duplicate registration", () => {
    const registry = new ToolRegistry();
    registry.register(createMockTool("dup"));
    expect(() => registry.register(createMockTool("dup"))).toThrow("Tool already registered");
  });

  it("should require tool by name or throw", () => {
    const registry = new ToolRegistry();
    registry.register(createMockTool("exists"));

    expect(registry.require("exists").name).toBe("exists");
    expect(() => registry.require("missing")).toThrow("Tool not found");
  });

  it("should return all tool names", () => {
    const registry = new ToolRegistry();
    registry.registerAll([createMockTool("a"), createMockTool("b"), createMockTool("c")]);

    expect(registry.getNames()).toEqual(["a", "b", "c"]);
  });

  it("should convert to LLM definitions", () => {
    const registry = new ToolRegistry();
    registry.register(createMockTool("my_tool"));

    const defs = registry.getDefinitionsForLLM();
    expect(defs).toHaveLength(1);
    expect(defs[0].type).toBe("function");
    expect(defs[0].function.name).toBe("my_tool");
    expect(defs[0].function.description).toBe("Mock tool: my_tool");
    expect(defs[0].function.parameters).toBeDefined();
  });
});

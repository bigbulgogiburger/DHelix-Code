import { describe, it, expect } from "vitest";
import { CommandRegistry } from "../../../src/commands/registry.js";
import { clearCommand } from "../../../src/commands/clear.js";
import { helpCommand } from "../../../src/commands/help.js";
import { modelCommand } from "../../../src/commands/model.js";
import { effortCommand } from "../../../src/commands/effort.js";
import { fastCommand } from "../../../src/commands/fast.js";

function createContext() {
  return {
    workingDirectory: "/test",
    model: "test-model",
    emit: () => {},
  };
}

describe("CommandRegistry", () => {
  it("should register and retrieve commands", () => {
    const registry = new CommandRegistry();
    registry.register(clearCommand);

    expect(registry.has("clear")).toBe(true);
    expect(registry.get("clear")).toBe(clearCommand);
  });

  it("should throw on duplicate registration", () => {
    const registry = new CommandRegistry();
    registry.register(clearCommand);

    expect(() => registry.register(clearCommand)).toThrow("already registered");
  });

  it("should return all registered commands", () => {
    const registry = new CommandRegistry();
    registry.register(clearCommand);
    registry.register(helpCommand);

    const all = registry.getAll();
    expect(all).toHaveLength(2);
  });

  it("should provide autocomplete completions", () => {
    const registry = new CommandRegistry();
    registry.register(clearCommand);
    registry.register(helpCommand);
    registry.register(modelCommand);

    const completions = registry.getCompletions("cl");
    expect(completions).toHaveLength(1);
    expect(completions[0].name).toBe("clear");
  });

  it("should identify slash commands", () => {
    const registry = new CommandRegistry();

    expect(registry.isCommand("/help")).toBe(true);
    expect(registry.isCommand("/model gpt-4")).toBe(true);
    expect(registry.isCommand("hello")).toBe(false);
    expect(registry.isCommand("")).toBe(false);
  });

  it("should return null for non-command input", async () => {
    const registry = new CommandRegistry();
    registry.register(clearCommand);

    const result = await registry.execute("hello", createContext());
    expect(result).toBeNull();
  });

  it("should return error for unknown commands", async () => {
    const registry = new CommandRegistry();
    registry.register(clearCommand);

    const result = await registry.execute("/unknown", createContext());
    expect(result).not.toBeNull();
    expect(result!.success).toBe(false);
    expect(result!.output).toContain("Unknown command");
  });

  it("should catch command execution errors gracefully", async () => {
    const registry = new CommandRegistry();
    registry.register({
      name: "explode",
      description: "Always throws",
      usage: "/explode",
      execute: async () => {
        throw new Error("Boom!");
      },
    });

    const result = await registry.execute("/explode", createContext());
    expect(result).not.toBeNull();
    expect(result!.success).toBe(false);
    expect(result!.output).toContain("Boom!");
  });
});

describe("/clear command", () => {
  it("should return shouldClear flag", async () => {
    const result = await clearCommand.execute("", createContext());

    expect(result.success).toBe(true);
    expect(result.shouldClear).toBe(true);
  });
});

describe("/model command", () => {
  it("should show current model when no args", async () => {
    const result = await modelCommand.execute("", createContext());

    expect(result.success).toBe(true);
    expect(result.output).toContain("test-model");
  });

  it("should switch model with args", async () => {
    const result = await modelCommand.execute("gpt-4", createContext());

    expect(result.success).toBe(true);
    expect(result.newModel).toBe("gpt-4");
  });
});

describe("/effort command", () => {
  it("should show current effort without args", async () => {
    const result = await effortCommand.execute("", createContext());

    expect(result.success).toBe(true);
    expect(result.output).toContain("effort level");
  });

  it("should set valid effort level", async () => {
    const result = await effortCommand.execute("max", createContext());

    expect(result.success).toBe(true);
    expect(result.output).toContain("max");
  });

  it("should reject invalid effort level", async () => {
    const result = await effortCommand.execute("ultra", createContext());

    expect(result.success).toBe(false);
  });
});

describe("/fast command", () => {
  it("should toggle fast mode", async () => {
    const result1 = await fastCommand.execute("", createContext());
    expect(result1.success).toBe(true);

    const result2 = await fastCommand.execute("", createContext());
    expect(result2.success).toBe(true);

    // Should toggle
    expect(result1.output).not.toBe(result2.output);
  });
});

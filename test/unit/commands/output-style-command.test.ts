import { describe, it, expect } from "vitest";
import { outputStyleCommand } from "../../../src/commands/output-style.js";

const baseContext = {
  workingDirectory: process.cwd(),
  model: "test-model",
  sessionId: "test-session",
  emit: () => {},
};

describe("/output-style command", () => {
  it("should list styles when no args", async () => {
    const result = await outputStyleCommand.execute("", baseContext);
    expect(result.success).toBe(true);
    expect(result.output).toContain("default");
    expect(result.output).toContain("explanatory");
    expect(result.output).toContain("learning");
    expect(result.output).toContain("concise");
  });

  it("should set valid style", async () => {
    const result = await outputStyleCommand.execute("concise", baseContext);
    expect(result.success).toBe(true);
    expect(result.output).toContain("concise");
  });

  it("should set explanatory style", async () => {
    const result = await outputStyleCommand.execute("explanatory", baseContext);
    expect(result.success).toBe(true);
    expect(result.output).toContain("explanatory");
  });

  it("should set learning style", async () => {
    const result = await outputStyleCommand.execute("learning", baseContext);
    expect(result.success).toBe(true);
  });

  it("should reject invalid style", async () => {
    const result = await outputStyleCommand.execute("verbose", baseContext);
    expect(result.success).toBe(false);
    expect(result.output).toContain("Unknown style");
    expect(result.output).toContain("verbose");
  });

  it("should be case-insensitive", async () => {
    const result = await outputStyleCommand.execute("CONCISE", baseContext);
    expect(result.success).toBe(true);
  });
});

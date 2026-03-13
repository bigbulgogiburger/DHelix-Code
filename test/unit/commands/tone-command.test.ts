import { describe, it, expect } from "vitest";
import { toneCommand } from "../../../src/commands/tone.js";

const baseContext = {
  workingDirectory: process.cwd(),
  model: "test-model",
  sessionId: "test-session",
  emit: () => {},
};

describe("/tone command", () => {
  it("should have correct metadata", () => {
    expect(toneCommand.name).toBe("tone");
    expect(toneCommand.description).toBeTypeOf("string");
    expect(toneCommand.usage).toContain("/tone");
    expect(toneCommand.execute).toBeTypeOf("function");
  });

  it("should list available tones when no args provided", async () => {
    const result = await toneCommand.execute("", baseContext);
    expect(result.success).toBe(true);
    expect(result.output).toContain("Available tones:");
    expect(result.output).toContain("normal");
    expect(result.output).toContain("cute");
    expect(result.output).toContain("senior");
    expect(result.output).toContain("friend");
    expect(result.output).toContain("mentor");
    expect(result.output).toContain("minimal");
  });

  it("should set tone to a valid value and return newTone", async () => {
    const result = await toneCommand.execute("senior", baseContext);
    expect(result.success).toBe(true);
    expect(result.output).toContain("Senior Developer");
    expect(result.newTone).toBe("senior");
    expect(result.refreshInstructions).toBe(true);
  });

  it("should handle valid tone with mixed case", async () => {
    const result = await toneCommand.execute("CUTE", baseContext);
    expect(result.success).toBe(true);
    expect(result.newTone).toBe("cute");
  });

  it("should handle valid tone with whitespace", async () => {
    const result = await toneCommand.execute("  friend  ", baseContext);
    expect(result.success).toBe(true);
    expect(result.newTone).toBe("friend");
  });

  it("should return error for invalid tone", async () => {
    const result = await toneCommand.execute("invalid-tone", baseContext);
    expect(result.success).toBe(false);
    expect(result.output).toContain('Unknown tone: "invalid-tone"');
    expect(result.output).toContain("Valid:");
    expect(result.output).toContain("normal");
  });

  it("should return Korean name in output for each tone", async () => {
    const toneKoMap: Record<string, string> = {
      normal: "\uC77C\uBC18",
      cute: "\uADC0\uC5EC\uC6B4",
      senior: "\uC2DC\uB2C8\uC5B4 \uAC1C\uBC1C\uC790",
      friend: "\uCE5C\uAD6C",
      mentor: "\uC2A4\uC2B9\uB2D8",
      minimal: "\uBBF8\uB2C8\uBA40",
    };
    for (const [id, nameKo] of Object.entries(toneKoMap)) {
      const result = await toneCommand.execute(id, baseContext);
      expect(result.success).toBe(true);
      expect(result.output).toContain(nameKo);
    }
  });
});

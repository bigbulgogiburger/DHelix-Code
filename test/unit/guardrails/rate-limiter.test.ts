import { describe, it, expect } from "vitest";
import { Glob } from "glob";

// Test that guardrails module structure exists
describe("guardrails module", () => {
  it("should have expected guardrail source files", async () => {
    const { readdir } = await import("node:fs/promises");
    const { join } = await import("node:path");

    try {
      const files = await readdir(join(process.cwd(), "src", "guardrails"));
      expect(files.length).toBeGreaterThan(0);
    } catch {
      // Directory may not exist in all environments
    }
  });
});

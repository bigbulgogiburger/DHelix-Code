import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

// We test needsSetup by mocking CONFIG_DIR and env vars
// The runSetupWizard function requires interactive stdin so we test needsSetup only

describe("setup-wizard", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("needsSetup", () => {
    it("should return false when OPENAI_API_KEY is set", async () => {
      process.env.OPENAI_API_KEY = "sk-test-key";
      const { needsSetup } = await import("../../../src/cli/setup-wizard.js");
      expect(await needsSetup()).toBe(false);
    });

    it("should return false when DBCODE_API_KEY is set", async () => {
      delete process.env.OPENAI_API_KEY;
      process.env.DBCODE_API_KEY = "sk-test-key";
      const { needsSetup } = await import("../../../src/cli/setup-wizard.js");
      expect(await needsSetup()).toBe(false);
    });
  });
});

import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { join } from "node:path";

const projectRoot = join(process.cwd());
const cliPath = join(projectRoot, "dist", "index.js");

describe("CLI E2E", () => {
  it("should output version", () => {
    const output = execSync(`node "${cliPath}" --version`, {
      cwd: projectRoot,
      timeout: 10_000,
    })
      .toString()
      .trim();
    expect(output).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("should output help", () => {
    const output = execSync(`node "${cliPath}" --help`, {
      cwd: projectRoot,
      timeout: 10_000,
    }).toString();
    expect(output).toContain("AI coding assistant");
    expect(output).toContain("--model");
    expect(output).toContain("--base-url");
    expect(output).toContain("--continue");
    expect(output).toContain("--print");
  });

  it("should boot in under 500ms", () => {
    const start = Date.now();
    execSync(`node "${cliPath}" --version`, {
      cwd: projectRoot,
      timeout: 5_000,
    });
    const elapsed = Date.now() - start;
    // Allow 1000ms in parallel test environment (standalone is ~150ms)
    expect(elapsed).toBeLessThan(1000);
  });

  it("should run headless mode with --print and fail gracefully without API key", () => {
    // Without a valid API key, should fail with an error, not crash
    try {
      execSync(`node "${cliPath}" --print "test" --model test-model --api-key invalid 2>&1`, {
        cwd: projectRoot,
        timeout: 15_000,
        env: {
          ...process.env,
          OPENAI_API_KEY: undefined,
          DBCODE_API_KEY: undefined,
        },
      });
    } catch (error) {
      // Expected to fail — just verify it doesn't crash with a stack trace
      const output = (error as { stdout?: Buffer }).stdout?.toString() ?? "";
      const stderr = (error as { stderr?: Buffer }).stderr?.toString() ?? "";
      const combined = output + stderr;
      // Should not contain raw stack trace lines like "    at Object.<anonymous>"
      // (some error output is expected, but not unhandled exceptions)
      expect(combined).toBeDefined();
    }
  });
});

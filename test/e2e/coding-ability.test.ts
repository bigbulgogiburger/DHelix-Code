import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";

const hasApiKey = !!process.env.OPENAI_API_KEY;
const projectRoot = process.cwd();
const cliPath = join(projectRoot, "dist", "index.js");

/** Run dhelix in headless mode */
function dhelix(prompt: string, cwd: string, timeoutMs = 60_000): string {
  return execSync(`node "${cliPath}" --print "${prompt.replace(/"/g, '\\"')}"`, {
    cwd,
    timeout: timeoutMs,
    env: { ...process.env, NODE_NO_WARNINGS: "1" },
  })
    .toString()
    .trim();
}

describe.skipIf(!hasApiKey)("E2E: Coding Ability", () => {
  let workDir: string;

  beforeAll(() => {
    workDir = mkdtempSync(join(tmpdir(), "dhelix-e2e-coding-"));
  });

  afterAll(() => {
    try {
      rmSync(workDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it("should create a hello world Node.js file", () => {
    dhelix(
      "Create a file called hello.js that prints 'Hello from dhelix!' to the console. Only create the file, no explanation needed.",
      workDir,
    );

    expect(existsSync(join(workDir, "hello.js"))).toBe(true);
    const content = readFileSync(join(workDir, "hello.js"), "utf-8");
    expect(content).toContain("Hello from dhelix!");
  }, 60_000);

  it("should run the created file", () => {
    // Only run if the previous test created the file
    if (!existsSync(join(workDir, "hello.js"))) {
      return;
    }

    const output = dhelix(
      "Run 'node hello.js' and tell me what it outputs. Just state the output.",
      workDir,
    );

    expect(output.toLowerCase()).toContain("hello from dhelix");
  }, 60_000);

  it("should create a package.json with npm init", () => {
    dhelix(
      "Create a minimal package.json with name 'test-project', version '1.0.0', and type 'module'. Only create the file.",
      workDir,
    );

    expect(existsSync(join(workDir, "package.json"))).toBe(true);
    const pkg = JSON.parse(readFileSync(join(workDir, "package.json"), "utf-8"));
    expect(pkg.name).toBe("test-project");
  }, 60_000);
});

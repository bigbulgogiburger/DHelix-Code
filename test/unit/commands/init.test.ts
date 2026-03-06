import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile, access } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { initProject } from "../../../src/commands/init.js";
import { APP_NAME } from "../../../src/constants.js";

describe("initProject", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "dbcode-init-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("should create .dbcode directory with template files", async () => {
    const result = await initProject(tempDir);

    expect(result.created).toBe(true);
    expect(result.path).toBe(join(tempDir, `.${APP_NAME}`));

    // Verify directory exists
    await expect(access(result.path)).resolves.toBeUndefined();

    // Verify DBCODE.md
    const md = await readFile(join(result.path, `${APP_NAME.toUpperCase()}.md`), "utf-8");
    expect(md).toContain("Project Instructions");

    // Verify settings.json
    const settingsRaw = await readFile(join(result.path, "settings.json"), "utf-8");
    const settings = JSON.parse(settingsRaw);
    expect(settings.model).toBe("gpt-4o");
    expect(settings.allowedTools).toContain("file_read");
  });

  it("should return created=false if already initialized", async () => {
    const first = await initProject(tempDir);
    expect(first.created).toBe(true);

    const second = await initProject(tempDir);
    expect(second.created).toBe(false);
    expect(second.path).toBe(first.path);
  });

  it("should not overwrite existing project files", async () => {
    await initProject(tempDir);

    // Modify the DBCODE.md
    const mdPath = join(tempDir, `.${APP_NAME}`, `${APP_NAME.toUpperCase()}.md`);
    const original = await readFile(mdPath, "utf-8");

    // Re-run init
    await initProject(tempDir);

    // Content should be unchanged
    const afterReInit = await readFile(mdPath, "utf-8");
    expect(afterReInit).toBe(original);
  });
});

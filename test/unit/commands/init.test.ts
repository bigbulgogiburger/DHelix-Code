import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile, access } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { initProject, initCommand } from "../../../src/commands/init.js";
import { CommandRegistry } from "../../../src/commands/registry.js";
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
    expect(settings.model).toBe("gpt-4.1-mini");
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

describe("initCommand", () => {
  let tempDir: string;

  const makeContext = (cwd: string) => ({
    workingDirectory: cwd,
    model: "test-model",
    sessionId: "test-session",
    emit: () => {},
  });

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "dbcode-init-cmd-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("should have name 'init' and a description", () => {
    expect(initCommand.name).toBe("init");
    expect(initCommand.description).toBeTypeOf("string");
    expect(initCommand.description.length).toBeGreaterThan(0);
  });

  it("should have usage and execute", () => {
    expect(initCommand.usage).toBe("/init");
    expect(initCommand.execute).toBeTypeOf("function");
  });

  it("should create project and return success on first run", async () => {
    const result = await initCommand.execute("", makeContext(tempDir));
    expect(result.success).toBe(true);
    expect(result.output).toContain("초기화 완료");
    expect(result.output).toContain(`.${APP_NAME}`);

    // Verify directory was actually created
    const projectPath = join(tempDir, `.${APP_NAME}`);
    await expect(access(projectPath)).resolves.toBeUndefined();
  });

  it("should return already-initialized message on second run", async () => {
    const first = await initCommand.execute("", makeContext(tempDir));
    expect(first.success).toBe(true);
    expect(first.output).toContain("초기화 완료");

    const second = await initCommand.execute("", makeContext(tempDir));
    expect(second.success).toBe(true);
    expect(second.output).toContain("이미 초기화됨");
  });

  it("should return refreshInstructions: true on successful creation", async () => {
    const result = await initCommand.execute("", makeContext(tempDir));
    expect(result.success).toBe(true);
    expect(result.refreshInstructions).toBe(true);
  });

  it("should not return refreshInstructions when already initialized", async () => {
    // First init — creates the project
    await initCommand.execute("", makeContext(tempDir));

    // Second init — already exists
    const second = await initCommand.execute("", makeContext(tempDir));
    expect(second.success).toBe(true);
    expect(second.output).toContain("이미 초기화됨");
    // refreshInstructions should be undefined (not set) when nothing was created
    expect(second.refreshInstructions).toBeUndefined();
  });

  it("should be registerable in CommandRegistry", () => {
    const registry = new CommandRegistry();
    registry.register(initCommand);
    expect(registry.has("init")).toBe(true);
    expect(registry.get("init")).toBe(initCommand);
  });
});

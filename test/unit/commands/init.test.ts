import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile, access, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { initProject, initCommand } from "../../../src/commands/init.js";
import { CommandRegistry } from "../../../src/commands/registry.js";
import { APP_NAME, DEFAULT_MODEL } from "../../../src/constants.js";

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

    // Verify .dbcode/ directory exists
    await expect(access(result.path)).resolves.toBeUndefined();

    // Verify DBCODE.md at project ROOT (not inside .dbcode/)
    const md = await readFile(join(tempDir, `${APP_NAME.toUpperCase()}.md`), "utf-8");
    expect(md).toContain("Project Instructions");

    // Verify settings.json inside .dbcode/
    const settingsRaw = await readFile(join(result.path, "settings.json"), "utf-8");
    const settings = JSON.parse(settingsRaw);
    expect(settings.model).toBe(DEFAULT_MODEL);
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

    const mdPath = join(tempDir, `${APP_NAME.toUpperCase()}.md`);
    const original = await readFile(mdPath, "utf-8");

    // Re-run init
    await initProject(tempDir);

    // Content should be unchanged
    const afterReInit = await readFile(mdPath, "utf-8");
    expect(afterReInit).toBe(original);
  });

  it("should create DBCODE.md even if .dbcode/ already exists", async () => {
    // Simulate scenario: .dbcode/ exists but DBCODE.md doesn't (e.g., from git clone)
    await mkdir(join(tempDir, `.${APP_NAME}`), { recursive: true });

    const result = await initProject(tempDir);
    expect(result.created).toBe(true);
    expect(result.detail?.dbcodeMdCreated).toBe(true);
    expect(result.detail?.configDirCreated).toBe(false);

    // Verify DBCODE.md was created at project root
    const md = await readFile(join(tempDir, `${APP_NAME.toUpperCase()}.md`), "utf-8");
    expect(md).toContain("Project Instructions");
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
    expect(initCommand.usage).toBe("/init [-i | --interactive]");
    expect(initCommand.execute).toBeTypeOf("function");
  });

  it("should return shouldInjectAsUserMessage for LLM-driven analysis", async () => {
    const result = await initCommand.execute("", makeContext(tempDir));
    expect(result.success).toBe(true);
    expect(result.shouldInjectAsUserMessage).toBe(true);
    expect(result.refreshInstructions).toBe(true);
  });

  it("should create .dbcode/ directory on first run", async () => {
    await initCommand.execute("", makeContext(tempDir));

    const projectPath = join(tempDir, `.${APP_NAME}`);
    await expect(access(projectPath)).resolves.toBeUndefined();

    // Verify settings.json was created
    const settingsRaw = await readFile(join(projectPath, "settings.json"), "utf-8");
    const settings = JSON.parse(settingsRaw);
    expect(settings.model).toBe(DEFAULT_MODEL);
  });

  it("should include 'create' instructions when DBCODE.md does not exist", async () => {
    const result = await initCommand.execute("", makeContext(tempDir));
    expect(result.output).toContain("Analyze this codebase");
    expect(result.output).toContain("create");
    expect(result.output).not.toContain("already exists");
  });

  it("should include 'update' instructions when DBCODE.md already exists", async () => {
    // Create DBCODE.md first
    await writeFile(join(tempDir, `${APP_NAME.toUpperCase()}.md`), "# Existing content\n", "utf-8");

    const result = await initCommand.execute("", makeContext(tempDir));
    expect(result.output).toContain("already exists");
    expect(result.output).toContain("improve");
  });

  it("should mention config dir creation in prompt when newly created", async () => {
    const result = await initCommand.execute("", makeContext(tempDir));
    expect(result.output).toContain("settings.json");
    expect(result.output).toContain("rules/");
  });

  it("should not mention config dir creation when it already existed", async () => {
    // Create .dbcode/ first
    await mkdir(join(tempDir, `.${APP_NAME}`), { recursive: true });

    const result = await initCommand.execute("", makeContext(tempDir));
    expect(result.output).not.toContain("[/init] Created project structure");
  });

  it("should always return refreshInstructions true", async () => {
    // First run
    const first = await initCommand.execute("", makeContext(tempDir));
    expect(first.refreshInstructions).toBe(true);

    // Create DBCODE.md to simulate existing state
    await writeFile(join(tempDir, `${APP_NAME.toUpperCase()}.md`), "# Existing\n", "utf-8");

    // Second run (update mode)
    const second = await initCommand.execute("", makeContext(tempDir));
    expect(second.refreshInstructions).toBe(true);
  });

  it("should be registerable in CommandRegistry", () => {
    const registry = new CommandRegistry();
    registry.register(initCommand);
    expect(registry.has("init")).toBe(true);
    expect(registry.get("init")).toBe(initCommand);
  });
});

/**
 * Unit tests for /create-skill slash command.
 *
 * The command is tested in isolation by mocking `scaffoldSkill` — the
 * headless path routes through the mock, the LLM-driven path does not.
 *
 * NOTE: The SUT imports `scaffoldSkill` from `src/skills/creator/index.js`
 * (owned by Teammate B). While that barrel is still being assembled, we
 * mock the import path so Vitest intercepts before Vite resolution. We
 * also mock `../skills/creator/types.js` to provide `ScaffoldError` (the
 * real types.ts file exists; the barrel `index.ts` may not yet).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { type CommandContext } from "../../../src/commands/registry.js";

// Mock BOTH creator paths BEFORE importing the command so Vite/Vitest
// never needs to resolve `index.js` from disk.
const mockScaffoldSkill = vi.fn();

class MockScaffoldError extends Error {
  readonly code: "NAME_COLLISION" | "INVALID_NAME" | "IO_ERROR" | "VALIDATION_FAILED";
  constructor(
    code: "NAME_COLLISION" | "INVALID_NAME" | "IO_ERROR" | "VALIDATION_FAILED",
    message: string,
  ) {
    super(message);
    this.code = code;
    this.name = "ScaffoldError";
  }
}

vi.mock("../../../src/skills/creator/index.js", () => ({
  scaffoldSkill: (...args: unknown[]) => mockScaffoldSkill(...args),
  ScaffoldError: MockScaffoldError,
}));

vi.mock("../../../src/skills/creator/types.js", () => ({
  ScaffoldError: MockScaffoldError,
}));

// Import after mocks are registered.
const { createSkillCommand } = await import("../../../src/commands/create-skill.js");
const ScaffoldError = MockScaffoldError;

const baseContext: CommandContext = {
  workingDirectory: "/tmp/project",
  model: "test-model",
  sessionId: "sess-1",
  emit: () => {},
};

describe("/create-skill command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("metadata", () => {
    it("should have correct name", () => {
      expect(createSkillCommand.name).toBe("create-skill");
    });

    it("should have a non-empty pushy description", () => {
      expect(createSkillCommand.description).toBeTypeOf("string");
      expect(createSkillCommand.description.length).toBeGreaterThan(10);
    });

    it("should advertise usage with optional name and --intent flag", () => {
      expect(createSkillCommand.usage).toContain("/create-skill");
      expect(createSkillCommand.usage).toContain("--intent");
    });

    it("should expose execute as a function", () => {
      expect(createSkillCommand.execute).toBeTypeOf("function");
    });
  });

  describe("headless path (name + --intent)", () => {
    it("should call scaffoldSkill once and return success", async () => {
      mockScaffoldSkill.mockResolvedValueOnce({
        skillDir: "/tmp/project/.dhelix/skills/my-skill",
        skillMdPath: "/tmp/project/.dhelix/skills/my-skill/SKILL.md",
        evalsPath: "/tmp/project/.dhelix/skills/my-skill/evals.ts",
        created: ["SKILL.md", "evals.ts"],
      });

      const result = await createSkillCommand.execute(
        'my-skill --intent "do X efficiently"',
        baseContext,
      );

      expect(mockScaffoldSkill).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(true);
      expect(result.output).toContain("my-skill");
      expect(result.output).toContain("/tmp/project/.dhelix/skills/my-skill");
    });

    it("should pass sensible defaults for missing fields", async () => {
      mockScaffoldSkill.mockResolvedValueOnce({
        skillDir: "d",
        skillMdPath: "d/SKILL.md",
        evalsPath: "d/evals.ts",
        created: [],
      });

      await createSkillCommand.execute('good-name --intent "help users"', baseContext);

      const opts = mockScaffoldSkill.mock.calls[0][0];
      expect(opts.name).toBe("good-name");
      expect(opts.intent).toBe("help users");
      expect(opts.fork).toBe(false);
      expect(opts.minModelTier).toBe("medium");
      expect(opts.triggers.length).toBeGreaterThanOrEqual(1);
      expect(opts.workflowSteps.length).toBe(3);
      expect(opts.force).toBe(false);
    });
  });

  describe("LLM-driven path (missing name or intent)", () => {
    it("should inject as user message when no args provided", async () => {
      const result = await createSkillCommand.execute("", baseContext);

      expect(mockScaffoldSkill).not.toHaveBeenCalled();
      expect(result.shouldInjectAsUserMessage).toBe(true);
      expect(result.success).toBe(true);
      expect(result.output).toContain("create-skill");
    });

    it("should inject as user message when only a name is provided (no --intent)", async () => {
      const result = await createSkillCommand.execute("some-name", baseContext);

      expect(mockScaffoldSkill).not.toHaveBeenCalled();
      expect(result.shouldInjectAsUserMessage).toBe(true);
    });

    it("should inject as user message when only --intent is provided (no name)", async () => {
      const result = await createSkillCommand.execute('--intent "do Y"', baseContext);

      expect(mockScaffoldSkill).not.toHaveBeenCalled();
      expect(result.shouldInjectAsUserMessage).toBe(true);
    });
  });

  describe("invalid name handling", () => {
    it("should return INVALID_NAME for non-kebab-case name", async () => {
      const result = await createSkillCommand.execute(
        'MyBadName --intent "do stuff"',
        baseContext,
      );

      expect(mockScaffoldSkill).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.output).toContain("INVALID_NAME");
      expect(result.output).toContain("MyBadName");
    });

    it("should return INVALID_NAME for name starting with a digit", async () => {
      const result = await createSkillCommand.execute(
        '1-skill --intent "x"',
        baseContext,
      );
      expect(result.success).toBe(false);
      expect(result.output).toContain("INVALID_NAME");
    });
  });

  describe("ScaffoldError surfacing", () => {
    it("should surface NAME_COLLISION errors as output", async () => {
      mockScaffoldSkill.mockRejectedValueOnce(
        new ScaffoldError("NAME_COLLISION", "skill 'foo' already exists"),
      );

      const result = await createSkillCommand.execute(
        'foo --intent "do foo"',
        baseContext,
      );

      expect(result.success).toBe(false);
      expect(result.output).toContain("NAME_COLLISION");
      expect(result.output).toContain("already exists");
    });

    it("should surface IO_ERROR with its message", async () => {
      mockScaffoldSkill.mockRejectedValueOnce(
        new ScaffoldError("IO_ERROR", "disk full"),
      );

      const result = await createSkillCommand.execute(
        'foo --intent "bar"',
        baseContext,
      );

      expect(result.success).toBe(false);
      expect(result.output).toContain("IO_ERROR");
      expect(result.output).toContain("disk full");
    });

    it("should rethrow non-ScaffoldError errors", async () => {
      mockScaffoldSkill.mockRejectedValueOnce(new Error("unexpected boom"));

      await expect(
        createSkillCommand.execute('foo --intent "bar"', baseContext),
      ).rejects.toThrow("unexpected boom");
    });
  });
});

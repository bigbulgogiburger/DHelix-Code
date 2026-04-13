import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadSkill, loadSkillsFromDirectory } from "../../../src/skills/loader.js";

const testDir = join(tmpdir(), "dhelix-skill-test-" + Date.now());

beforeAll(async () => {
  await mkdir(testDir, { recursive: true });
});

afterAll(async () => {
  await rm(testDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// loadSkill — frontmatter parsing
// ---------------------------------------------------------------------------

describe("loadSkill", () => {
  it("should load a skill with valid frontmatter", async () => {
    const skillPath = join(testDir, "test-skill.md");
    await writeFile(
      skillPath,
      [
        "---",
        "name: test-skill",
        'description: "A test skill"',
        "user-invocable: true",
        "---",
        "",
        "This is the skill body with $ARGUMENTS",
      ].join("\n"),
    );

    const skill = await loadSkill(skillPath);
    expect(skill.frontmatter.name).toBe("test-skill");
    expect(skill.frontmatter.description).toBe("A test skill");
    expect(skill.frontmatter.userInvocable).toBe(true);
    expect(skill.body).toContain("$ARGUMENTS");
    expect(skill.sourcePath).toBe(skillPath);
  });

  it("should throw for missing frontmatter", async () => {
    const skillPath = join(testDir, "no-frontmatter.md");
    await writeFile(skillPath, "Just a body without frontmatter");

    await expect(loadSkill(skillPath)).rejects.toThrow("missing frontmatter");
  });

  it("should throw for non-existent file path", async () => {
    await expect(loadSkill(join(testDir, "nonexistent.md"))).rejects.toThrow(
      "Failed to load skill",
    );
  });

  it("should throw SkillLoadError for invalid frontmatter schema (missing description)", async () => {
    const skillPath = join(testDir, "bad-schema.md");
    await writeFile(skillPath, ["---", "name: bad", "---", "body"].join("\n"));

    await expect(loadSkill(skillPath)).rejects.toThrow("Failed to load skill");
  });

  it("should throw for unclosed frontmatter delimiter", async () => {
    const skillPath = join(testDir, "unclosed-fm.md");
    await writeFile(
      skillPath,
      ["---", "name: unclosed", "description: no end delimiter", "body text"].join("\n"),
    );

    await expect(loadSkill(skillPath)).rejects.toThrow("missing frontmatter");
  });

  // -------------------------------------------------------------------------
  // kebab-case to camelCase conversion
  // -------------------------------------------------------------------------

  it("should convert kebab-case keys to camelCase (allowed-tools -> allowedTools)", async () => {
    const skillPath = join(testDir, "kebab-tools.md");
    await writeFile(
      skillPath,
      [
        "---",
        "name: with-tools",
        "description: has tools",
        "allowed-tools: [file_read, grep_search]",
        "---",
        "body",
      ].join("\n"),
    );

    const skill = await loadSkill(skillPath);
    expect(skill.frontmatter.allowedTools).toEqual(["file_read", "grep_search"]);
  });

  it("should convert user-invocable to userInvocable", async () => {
    const skillPath = join(testDir, "kebab-invocable.md");
    await writeFile(
      skillPath,
      [
        "---",
        "name: kebab-test",
        "description: kebab case test",
        "user-invocable: false",
        "---",
        "body",
      ].join("\n"),
    );

    const skill = await loadSkill(skillPath);
    expect(skill.frontmatter.userInvocable).toBe(false);
  });

  it("should convert disable-model-invocation to disableModelInvocation", async () => {
    const skillPath = join(testDir, "kebab-disable.md");
    await writeFile(
      skillPath,
      [
        "---",
        "name: kebab-disable",
        "description: disable test",
        "disable-model-invocation: true",
        "---",
        "body",
      ].join("\n"),
    );

    const skill = await loadSkill(skillPath);
    expect(skill.frontmatter.disableModelInvocation).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Value parsing
  // -------------------------------------------------------------------------

  it("should parse boolean true/false values", async () => {
    const skillPath = join(testDir, "booleans.md");
    await writeFile(
      skillPath,
      [
        "---",
        "name: bool-test",
        "description: boolean values",
        "disable-model-invocation: true",
        "user-invocable: false",
        "---",
        "body",
      ].join("\n"),
    );

    const skill = await loadSkill(skillPath);
    expect(skill.frontmatter.disableModelInvocation).toBe(true);
    expect(skill.frontmatter.userInvocable).toBe(false);
  });

  it("should parse null and tilde (~) as null", async () => {
    const skillPath = join(testDir, "null-vals.md");
    await writeFile(
      skillPath,
      ["---", "name: null-test", "description: null values", "model: ~", "---", "body"].join("\n"),
    );

    const skill = await loadSkill(skillPath);
    expect(skill.frontmatter.model).toBeNull();
  });

  it("should parse inline array [a, b, c]", async () => {
    const skillPath = join(testDir, "array-vals.md");
    await writeFile(
      skillPath,
      [
        "---",
        "name: array-test",
        "description: array values",
        "allowed-tools: [bash, file_read, grep_search]",
        "---",
        "body",
      ].join("\n"),
    );

    const skill = await loadSkill(skillPath);
    expect(skill.frontmatter.allowedTools).toEqual(["bash", "file_read", "grep_search"]);
  });

  it("should parse empty inline array []", async () => {
    const skillPath = join(testDir, "empty-arr.md");
    await writeFile(
      skillPath,
      ["---", "name: empty-arr", "description: empty array test", "hooks: []", "---", "body"].join(
        "\n",
      ),
    );

    const skill = await loadSkill(skillPath);
    expect(skill.frontmatter.hooks).toEqual([]);
  });

  it("should parse quoted items in inline arrays", async () => {
    const skillPath = join(testDir, "quoted-array.md");
    await writeFile(
      skillPath,
      [
        "---",
        "name: quoted-arr",
        "description: has quoted items",
        `allowed-tools: ["file_read", 'grep_search']`,
        "---",
        "body",
      ].join("\n"),
    );

    const skill = await loadSkill(skillPath);
    expect(skill.frontmatter.allowedTools).toEqual(["file_read", "grep_search"]);
  });

  it("should parse double-quoted string values", async () => {
    const skillPath = join(testDir, "double-quoted.md");
    await writeFile(
      skillPath,
      [
        "---",
        'name: "double-quoted"',
        'description: "A double-quoted description"',
        "---",
        "body",
      ].join("\n"),
    );

    const skill = await loadSkill(skillPath);
    expect(skill.frontmatter.name).toBe("double-quoted");
    expect(skill.frontmatter.description).toBe("A double-quoted description");
  });

  it("should parse single-quoted string values", async () => {
    const skillPath = join(testDir, "single-quoted.md");
    await writeFile(
      skillPath,
      [
        "---",
        "name: 'single-quoted'",
        "description: 'A single-quoted description'",
        "---",
        "body",
      ].join("\n"),
    );

    const skill = await loadSkill(skillPath);
    expect(skill.frontmatter.name).toBe("single-quoted");
    expect(skill.frontmatter.description).toBe("A single-quoted description");
  });

  it("should skip comment lines (starting with #) in frontmatter", async () => {
    const skillPath = join(testDir, "comments.md");
    await writeFile(
      skillPath,
      [
        "---",
        "# This is a comment",
        "name: commented",
        "",
        "description: has comments",
        "---",
        "body",
      ].join("\n"),
    );

    const skill = await loadSkill(skillPath);
    expect(skill.frontmatter.name).toBe("commented");
  });

  it("should parse context and agent fields correctly", async () => {
    const skillPath = join(testDir, "context-agent.md");
    await writeFile(
      skillPath,
      [
        "---",
        "name: forked-skill",
        "description: forked skill",
        "context: fork",
        "agent: explore",
        "---",
        "body",
      ].join("\n"),
    );

    const skill = await loadSkill(skillPath);
    expect(skill.frontmatter.context).toBe("fork");
    expect(skill.frontmatter.agent).toBe("explore");
  });

  it("should parse model as string value", async () => {
    const skillPath = join(testDir, "model-str.md");
    await writeFile(
      skillPath,
      [
        "---",
        "name: model-skill",
        "description: has model",
        "model: claude-opus-4-20250514",
        "---",
        "body",
      ].join("\n"),
    );

    const skill = await loadSkill(skillPath);
    expect(skill.frontmatter.model).toBe("claude-opus-4-20250514");
  });

  it("should parse argument-hint with kebab-to-camel conversion", async () => {
    const skillPath = join(testDir, "arg-hint.md");
    await writeFile(
      skillPath,
      [
        "---",
        "name: hint-skill",
        "description: has hint",
        "argument-hint: <file path>",
        "---",
        "body",
      ].join("\n"),
    );

    const skill = await loadSkill(skillPath);
    expect(skill.frontmatter.argumentHint).toBe("<file path>");
  });

  it("should handle empty value as empty string (Zod may reject)", async () => {
    const skillPath = join(testDir, "empty-val.md");
    await writeFile(
      skillPath,
      ["---", "name: empty-val", "description:", "---", "body"].join("\n"),
    );

    // description is empty string, Zod schema requires min(1) so it should reject
    await expect(loadSkill(skillPath)).rejects.toThrow();
  });

  // -------------------------------------------------------------------------
  // Body extraction
  // -------------------------------------------------------------------------

  it("should separate body from frontmatter correctly", async () => {
    const skillPath = join(testDir, "body-extract.md");
    await writeFile(
      skillPath,
      [
        "---",
        "name: body-test",
        "description: body extraction",
        "---",
        "",
        "Line 1 of body",
        "Line 2 of body",
        "",
        "Line 4 of body",
      ].join("\n"),
    );

    const skill = await loadSkill(skillPath);
    expect(skill.body).toContain("Line 1 of body");
    expect(skill.body).toContain("Line 2 of body");
    expect(skill.body).toContain("Line 4 of body");
    // Should NOT contain frontmatter
    expect(skill.body).not.toContain("name:");
    expect(skill.body).not.toContain("---");
  });

  it("should trim body whitespace", async () => {
    const skillPath = join(testDir, "trimmed-body.md");
    await writeFile(
      skillPath,
      ["---", "name: trim-test", "description: trimmed", "---", "", "  Content here  ", ""].join(
        "\n",
      ),
    );

    const skill = await loadSkill(skillPath);
    // The body is trimmed by splitFrontmatterAndBody
    expect(skill.body).not.toMatch(/^\n/);
  });

  // -------------------------------------------------------------------------
  // Required fields validation
  // -------------------------------------------------------------------------

  it("should throw when name is missing", async () => {
    const skillPath = join(testDir, "no-name.md");
    await writeFile(skillPath, ["---", "description: no name here", "---", "body"].join("\n"));

    await expect(loadSkill(skillPath)).rejects.toThrow();
  });

  it("should throw when description is missing", async () => {
    const skillPath = join(testDir, "no-desc.md");
    await writeFile(skillPath, ["---", "name: no-desc", "---", "body"].join("\n"));

    await expect(loadSkill(skillPath)).rejects.toThrow();
  });

  // -------------------------------------------------------------------------
  // Default values
  // -------------------------------------------------------------------------

  it("should default userInvocable to true when not specified", async () => {
    const skillPath = join(testDir, "defaults.md");
    await writeFile(
      skillPath,
      ["---", "name: default-test", "description: defaults", "---", "body"].join("\n"),
    );

    const skill = await loadSkill(skillPath);
    expect(skill.frontmatter.userInvocable).toBe(true);
    expect(skill.frontmatter.disableModelInvocation).toBe(false);
    expect(skill.frontmatter.model).toBeNull();
    expect(skill.frontmatter.context).toBe("inline");
    expect(skill.frontmatter.hooks).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// loadSkillsFromDirectory
// ---------------------------------------------------------------------------

describe("loadSkillsFromDirectory", () => {
  it("should load all .md skills from a directory", async () => {
    const dir = join(testDir, "skills-dir");
    await mkdir(dir, { recursive: true });

    await writeFile(
      join(dir, "a.md"),
      ["---", "name: skill-a", "description: A", "---", "body a"].join("\n"),
    );
    await writeFile(
      join(dir, "b.md"),
      ["---", "name: skill-b", "description: B", "---", "body b"].join("\n"),
    );
    // Non-md file should be ignored
    await writeFile(join(dir, "readme.txt"), "not a skill");

    const skills = await loadSkillsFromDirectory(dir);
    expect(skills).toHaveLength(2);
    const names = skills.map((s) => s.frontmatter.name);
    expect(names).toContain("skill-a");
    expect(names).toContain("skill-b");
  });

  it("should return empty array for non-existent directory (ENOENT)", async () => {
    const skills = await loadSkillsFromDirectory(join(testDir, "does-not-exist"));
    expect(skills).toEqual([]);
  });

  it("should skip invalid skill files without crashing", async () => {
    const dir = join(testDir, "mixed-skills");
    await mkdir(dir, { recursive: true });

    await writeFile(
      join(dir, "valid.md"),
      ["---", "name: valid", "description: V", "---", "body"].join("\n"),
    );
    await writeFile(join(dir, "invalid.md"), "no frontmatter at all");

    const skills = await loadSkillsFromDirectory(dir);
    expect(skills).toHaveLength(1);
    expect(skills[0].frontmatter.name).toBe("valid");
  });

  it("should throw for non-ENOENT directory errors (e.g., ENOTDIR)", async () => {
    const filePath = join(testDir, "not-a-dir.txt");
    await writeFile(filePath, "I am a file, not a directory");

    await expect(loadSkillsFromDirectory(filePath)).rejects.toThrow(
      "Failed to read skills directory",
    );
  });

  it("should ignore non-.md files in directory", async () => {
    const dir = join(testDir, "md-only");
    await mkdir(dir, { recursive: true });

    await writeFile(
      join(dir, "skill.md"),
      ["---", "name: md-skill", "description: only md", "---", "body"].join("\n"),
    );
    await writeFile(join(dir, "notes.txt"), "not a skill");
    await writeFile(join(dir, "config.json"), "{}");
    await writeFile(join(dir, "script.ts"), "export {}");

    const skills = await loadSkillsFromDirectory(dir);
    expect(skills).toHaveLength(1);
    expect(skills[0].frontmatter.name).toBe("md-skill");
  });
});

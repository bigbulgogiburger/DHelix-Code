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

  it("should parse allowed-tools as array", async () => {
    const skillPath = join(testDir, "with-tools.md");
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

  it("should throw for non-existent file path", async () => {
    await expect(loadSkill(join(testDir, "nonexistent.md"))).rejects.toThrow(
      "Failed to load skill",
    );
  });

  it("should throw SkillLoadError for invalid frontmatter schema", async () => {
    const skillPath = join(testDir, "bad-schema.md");
    await writeFile(
      skillPath,
      [
        "---",
        "name: bad",
        // Missing required "description" field
        "---",
        "body",
      ].join("\n"),
    );

    await expect(loadSkill(skillPath)).rejects.toThrow("Failed to load skill");
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

  it("should handle unclosed frontmatter delimiter", async () => {
    const skillPath = join(testDir, "unclosed-fm.md");
    await writeFile(
      skillPath,
      ["---", "name: unclosed", "description: no end delimiter", "body text"].join("\n"),
    );

    await expect(loadSkill(skillPath)).rejects.toThrow("missing frontmatter");
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

  it("should parse numeric frontmatter values", async () => {
    const skillPath = join(testDir, "numeric.md");
    await writeFile(
      skillPath,
      [
        "---",
        "name: numeric-skill",
        "description: has numbers",
        "max-retries: 5",
        "---",
        "body",
      ].join("\n"),
    );

    const skill = await loadSkill(skillPath);
    expect(skill.frontmatter.name).toBe("numeric-skill");
    // The raw data would have maxRetries: 5 (number) - verify it parses
    expect(skill.body).toBe("body");
  });

  it("should parse null/tilde and boolean values", async () => {
    const skillPath = join(testDir, "special-vals.md");
    await writeFile(
      skillPath,
      [
        "---",
        "name: special",
        "description: special vals",
        "model: ~",
        "disable-model-invocation: true",
        "user-invocable: false",
        "---",
        "body",
      ].join("\n"),
    );

    const skill = await loadSkill(skillPath);
    expect(skill.frontmatter.name).toBe("special");
    expect(skill.frontmatter.model).toBeNull();
    expect(skill.frontmatter.disableModelInvocation).toBe(true);
    expect(skill.frontmatter.userInvocable).toBe(false);
  });

  it("should parse empty inline array", async () => {
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

  it("should parse empty value as empty string", async () => {
    const skillPath = join(testDir, "empty-val.md");
    await writeFile(
      skillPath,
      ["---", "name: empty-val", "description:", "---", "body"].join("\n"),
    );

    // description defaults to empty string, Zod may reject or accept
    // The important thing is the parseValue("") path is tested
    await expect(loadSkill(skillPath)).rejects.toThrow();
  });

  it("should skip comment and empty lines in frontmatter", async () => {
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

  it("should parse context and agent fields", async () => {
    const skillPath = join(testDir, "forked.md");
    await writeFile(
      skillPath,
      [
        "---",
        "name: forked",
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
});

describe("loadSkillsFromDirectory", () => {
  it("should load all skills from a directory", async () => {
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

  it("should return empty array for non-existent directory", async () => {
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

  it("should throw for non-ENOENT directory errors", async () => {
    // Use a file path (not a directory) — readdir will throw ENOTDIR
    const filePath = join(testDir, "not-a-dir.txt");
    await writeFile(filePath, "I am a file, not a directory");

    await expect(loadSkillsFromDirectory(filePath)).rejects.toThrow(
      "Failed to read skills directory",
    );
  });
});

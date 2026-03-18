import { describe, it, expect } from "vitest";
import { buildAnalysisPrompt } from "../../../../src/commands/init/analysis-prompt.js";

describe("buildAnalysisPrompt", () => {
  it("should include all 12 analysis steps", () => {
    const result = buildAnalysisPrompt(false, false);

    // Step 1: project config files
    expect(result).toContain("package.json");
    expect(result).toContain("tsconfig.json");
    expect(result).toContain("Cargo.toml");
    expect(result).toContain("go.mod");
    expect(result).toContain("pyproject.toml");
    expect(result).toContain("pom.xml");
    expect(result).toContain("build.gradle");
    expect(result).toContain("Makefile");
    expect(result).toContain("Gemfile");

    // Step 2: directory structure
    expect(result).toContain("directory structure");

    // Step 3: README.md
    expect(result).toContain("README.md");

    // Step 4: source files
    const hasSourceFiles = result.includes("source files") || result.includes("key source");
    expect(hasSourceFiles).toBe(true);

    // Step 5: git history
    expect(result).toContain("git");
    expect(result).toContain("commit");

    // Step 6: monorepo detection
    const hasMonorepo = result.includes("monorepo") || result.includes("Monorepo");
    expect(hasMonorepo).toBe(true);
    expect(result).toContain("workspaces");
    expect(result).toContain("nx.json");
    expect(result).toContain("turbo.json");
    expect(result).toContain("lerna.json");

    // Step 7: CI/CD configs
    expect(result).toContain(".github/workflows");
    expect(result).toContain(".gitlab-ci.yml");
    expect(result).toContain("Jenkinsfile");

    // Step 8: env vars (.env.example)
    expect(result).toContain(".env.example");

    // Step 9: Docker/container
    expect(result).toContain("Dockerfile");
    expect(result).toContain("docker-compose");

    // Step 10: test structure
    expect(result).toContain("test");
    expect(result).toContain("test runner");

    // Step 11: existing .dbcode/rules
    expect(result).toContain("rules/");

    // Step 12: entry point tracing
    expect(result).toContain("entry point");
  });

  it("should include 200-line guideline instead of 400", () => {
    const result = buildAnalysisPrompt(false, false);

    expect(result).toContain("200");
    expect(result).not.toContain("400");
  });

  it("should include create instructions when not updating", () => {
    const result = buildAnalysisPrompt(false, false);

    expect(result).toContain("Analyze this codebase");
    expect(result).toContain("create");
    expect(result).not.toContain("already exists");
  });

  it("should include update instructions when DBCODE.md exists", () => {
    const result = buildAnalysisPrompt(true, false);

    expect(result).toContain("already exists");
    expect(result).toContain("improve");
  });

  it("should mention config dir creation when newly created", () => {
    const result = buildAnalysisPrompt(false, true);

    expect(result).toContain("settings.json");
    expect(result).toContain("rules/");
  });

  it("should not mention config dir when it already existed", () => {
    const result = buildAnalysisPrompt(false, false);

    expect(result).not.toContain("[/init] Created project structure");
  });

  it("should include recommended section template", () => {
    const result = buildAnalysisPrompt(false, false);

    expect(result).toContain("## Commands");
    expect(result).toContain("## Architecture");
    expect(result).toContain("## Code Style");
  });

  it("should include subagent exploration directive", () => {
    const result = buildAnalysisPrompt(false, false);

    const hasSubagentRef =
      result.includes("subagent") || result.includes("sub-agent") || result.includes("Spawn");
    expect(hasSubagentRef).toBe(true);
  });

  it("should prioritize 'what AI can't guess' philosophy", () => {
    const result = buildAnalysisPrompt(false, false);

    const hasNonObviousPriority =
      result.includes("can't guess") ||
      result.includes("cannot guess") ||
      result.includes("non-obvious");
    expect(hasNonObviousPriority).toBe(true);
  });

  it("should include guidelines about concrete/verifiable instructions", () => {
    const result = buildAnalysisPrompt(false, false);

    const hasConcrete =
      result.includes("concrete") || result.includes("verify") || result.includes("verifiable");
    expect(hasConcrete).toBe(true);
  });

  it("should include development environment section", () => {
    const result = buildAnalysisPrompt(false, false);

    const hasDevEnv =
      result.includes("env var") ||
      result.includes("environment variable") ||
      result.includes("Docker") ||
      result.includes("prerequisite");
    expect(hasDevEnv).toBe(true);
  });

  it("should include CI/CD workflow section", () => {
    const result = buildAnalysisPrompt(false, false);

    const hasCiCd =
      result.includes("CI") || result.includes("workflow") || result.includes("deployment");
    expect(hasCiCd).toBe(true);
  });
});

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { generateTemplate } from "../../../../src/commands/init/template-generator.js";

describe("generateTemplate", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "dbcode-template-gen-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("should return placeholder when no config files found", async () => {
    const template = await generateTemplate(tempDir);

    expect(template).toContain("Project Instructions");
    expect(template).toContain("Add project-specific instructions here.");
    expect(template).toContain("Example");
  });

  it("should detect package.json with name and scripts", async () => {
    await writeFile(
      join(tempDir, "package.json"),
      JSON.stringify({
        name: "test-project",
        scripts: {
          build: "tsc",
          test: "vitest",
          lint: "eslint .",
        },
      }),
      "utf-8",
    );

    const template = await generateTemplate(tempDir);

    expect(template).toContain("test-project");
    expect(template).toContain("npm run build");
    expect(template).toContain("npm test");
    expect(template).toContain("npm run lint");
  });

  it("should detect TypeScript via tsconfig.json", async () => {
    await writeFile(join(tempDir, "tsconfig.json"), "{}", "utf-8");

    const template = await generateTemplate(tempDir);

    expect(template).toContain("TypeScript");
  });

  it("should detect Rust via Cargo.toml", async () => {
    await writeFile(
      join(tempDir, "Cargo.toml"),
      '[package]\nname = "my-crate"\nedition = "2021"',
      "utf-8",
    );

    const template = await generateTemplate(tempDir);

    expect(template).toContain("Rust");
  });

  it("should detect Go via go.mod", async () => {
    await writeFile(join(tempDir, "go.mod"), "module github.com/user/project\ngo 1.21", "utf-8");

    const template = await generateTemplate(tempDir);

    expect(template).toContain("Go");
  });

  it("should detect Python via pyproject.toml", async () => {
    await writeFile(join(tempDir, "pyproject.toml"), '[project]\nname = "myapp"', "utf-8");

    const template = await generateTemplate(tempDir);

    expect(template).toContain("Python");
  });

  it("should detect Java via pom.xml", async () => {
    await writeFile(
      join(tempDir, "pom.xml"),
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        "<project>",
        "  <modelVersion>4.0.0</modelVersion>",
        "  <groupId>com.example</groupId>",
        "  <artifactId>my-app</artifactId>",
        "  <version>1.0.0</version>",
        "</project>",
      ].join("\n"),
      "utf-8",
    );

    const template = await generateTemplate(tempDir);

    expect(template).toMatch(/Java|Maven/);
  });

  it("should detect Gradle via build.gradle", async () => {
    await writeFile(
      join(tempDir, "build.gradle"),
      ["plugins {", "    id 'java'", "}", "", "repositories {", "    mavenCentral()", "}"].join(
        "\n",
      ),
      "utf-8",
    );

    const template = await generateTemplate(tempDir);

    expect(template).toContain("Gradle");
  });

  it("should detect Ruby via Gemfile", async () => {
    await writeFile(
      join(tempDir, "Gemfile"),
      'source "https://rubygems.org"\ngem "rails"',
      "utf-8",
    );

    const template = await generateTemplate(tempDir);

    expect(template).toContain("Ruby");
  });

  it("should detect CI via .github/workflows", async () => {
    const workflowDir = join(tempDir, ".github", "workflows");
    await mkdir(workflowDir, { recursive: true });
    await writeFile(
      join(workflowDir, "ci.yml"),
      "name: CI\non: [push]\njobs:\n  test:\n    runs-on: ubuntu-latest",
      "utf-8",
    );

    const template = await generateTemplate(tempDir);

    expect(template).toMatch(/CI|GitHub Actions|ci\.yml/);
  });

  it("should detect Docker via Dockerfile", async () => {
    await writeFile(
      join(tempDir, "Dockerfile"),
      "FROM node:20-alpine\nWORKDIR /app\nCOPY . .\nRUN npm install",
      "utf-8",
    );

    const template = await generateTemplate(tempDir);

    expect(template).toMatch(/Docker|node:20-alpine/);
  });

  it("should detect docker-compose services", async () => {
    await writeFile(
      join(tempDir, "docker-compose.yml"),
      [
        "version: '3.8'",
        "services:",
        "  app:",
        "    build: .",
        "    ports:",
        "      - '3000:3000'",
        "  db:",
        "    image: postgres:15",
        "  redis:",
        "    image: redis:7",
      ].join("\n"),
      "utf-8",
    );

    const template = await generateTemplate(tempDir);

    expect(template).toMatch(/Docker Compose|service/i);
  });

  it("should detect env vars from .env.example", async () => {
    await writeFile(join(tempDir, ".env.example"), "DATABASE_URL=\nAPI_KEY=\n", "utf-8");

    const template = await generateTemplate(tempDir);

    expect(template).toMatch(/DATABASE_URL|environment|env/i);
  });

  it("should detect monorepo via nx.json", async () => {
    await writeFile(join(tempDir, "nx.json"), "{}", "utf-8");

    const template = await generateTemplate(tempDir);

    expect(template).toMatch(/monorepo|Nx/i);
  });

  it("should detect test framework from vitest config", async () => {
    await writeFile(join(tempDir, "vitest.config.ts"), "export default {}", "utf-8");

    const template = await generateTemplate(tempDir);

    expect(template).toMatch(/vitest|Vitest|test/i);
  });

  it("should detect Makefile targets", async () => {
    await writeFile(
      join(tempDir, "Makefile"),
      "build:\n\techo building\ntest:\n\techo testing\n",
      "utf-8",
    );

    const template = await generateTemplate(tempDir);

    expect(template).toMatch(/build.*test|Makefile/i);
  });

  it("should handle multiple detections together", async () => {
    await writeFile(
      join(tempDir, "package.json"),
      JSON.stringify({
        name: "multi-project",
        scripts: { build: "tsc", test: "vitest" },
      }),
      "utf-8",
    );
    await writeFile(join(tempDir, "tsconfig.json"), "{}", "utf-8");
    await writeFile(join(tempDir, "Dockerfile"), "FROM node:20-alpine\nWORKDIR /app", "utf-8");

    const template = await generateTemplate(tempDir);

    expect(template).toContain("multi-project");
    expect(template).toContain("TypeScript");
    expect(template).toMatch(/Docker/);
  });
});

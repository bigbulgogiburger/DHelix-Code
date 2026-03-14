import { describe, it, expect } from "vitest";
import { bugCommand } from "../../../src/commands/bug.js";

const baseContext = {
  workingDirectory: process.cwd(),
  model: "test-model",
  sessionId: "test-session",
  emit: () => {},
};

describe("/bug command", () => {
  it("should have correct metadata", () => {
    expect(bugCommand.name).toBe("bug");
    expect(bugCommand.description).toBeTypeOf("string");
    expect(bugCommand.usage).toContain("/bug");
    expect(bugCommand.execute).toBeTypeOf("function");
  });

  it("should return usage instructions when no description provided", async () => {
    const result = await bugCommand.execute("", baseContext);
    expect(result.success).toBe(true);
    expect(result.output).toContain("Usage: /bug");
    expect(result.output).toContain("<description>");
  });

  it("should return usage instructions for whitespace-only input", async () => {
    const result = await bugCommand.execute("   ", baseContext);
    expect(result.success).toBe(true);
    expect(result.output).toContain("Usage: /bug");
  });

  it("should generate a bug report with valid description", async () => {
    const result = await bugCommand.execute("Tool output is truncated", baseContext);
    expect(result.success).toBe(true);
    expect(result.output).toContain("Bug report generated.");
    expect(result.output).toContain("## Bug Report");
    expect(result.output).toContain("Tool output is truncated");
  });

  it("should include system info in the report", async () => {
    const result = await bugCommand.execute("Something broke", baseContext);
    expect(result.output).toContain(`Platform: ${process.platform}`);
    expect(result.output).toContain(`Node.js: ${process.version}`);
    expect(result.output).toContain("Model: test-model");
    expect(result.output).toContain("Session: test-session");
    expect(result.output).toContain("dbcode: v");
  });

  it("should show N/A when sessionId is missing", async () => {
    const contextWithoutSession = {
      workingDirectory: process.cwd(),
      model: "test-model",
      emit: () => {},
    };
    const result = await bugCommand.execute("No session", contextWithoutSession);
    expect(result.output).toContain("Session: N/A");
  });

  it("should include a GitHub issue URL", async () => {
    const result = await bugCommand.execute("Something broke", baseContext);
    expect(result.output).toContain("https://github.com/bigbulgogiburger/dbcode/issues/new?");
    expect(result.output).toContain("Open in browser:");
  });

  it("should include [Bug] prefix in the URL title parameter", async () => {
    const result = await bugCommand.execute("Something broke", baseContext);
    // The URL should contain the encoded [Bug] prefix
    expect(result.output).toContain("title=%5BBug%5D+Something+broke");
  });

  it("should truncate long titles to 80 characters in the URL", async () => {
    const longDescription = "A".repeat(200);
    const result = await bugCommand.execute(longDescription, baseContext);
    // Extract the URL from the output
    const urlMatch = result.output.match(/https:\/\/github\.com\S+/);
    expect(urlMatch).not.toBeNull();
    const url = new URL(urlMatch![0]);
    const title = url.searchParams.get("title");
    // [Bug] prefix (6 chars) + space + 80 chars of description
    expect(title).toBe(`[Bug] ${"A".repeat(80)}`);
  });

  it("should include bug label in the URL", async () => {
    const result = await bugCommand.execute("A bug", baseContext);
    expect(result.output).toContain("labels=bug");
  });

  it("should include a timestamp in the report", async () => {
    const result = await bugCommand.execute("Timestamp test", baseContext);
    // ISO timestamp pattern: YYYY-MM-DDTHH:MM:SS
    expect(result.output).toMatch(/Timestamp: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});

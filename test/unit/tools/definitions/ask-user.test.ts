import { describe, it, expect } from "vitest";
import { askUserTool } from "../../../../src/tools/definitions/ask-user.js";

const context = {
  workingDirectory: process.cwd(),
  signal: new AbortController().signal,
};

describe("ask_user tool", () => {
  it("should have correct metadata", () => {
    expect(askUserTool.name).toBe("ask_user");
    expect(askUserTool.permissionLevel).toBe("safe");
    expect(askUserTool.timeoutMs).toBe(300_000);
  });

  it("should return question in output", async () => {
    const result = await askUserTool.execute({ question: "What framework?" }, context);
    expect(result.isError).toBe(false);
    expect(result.output).toContain("AWAITING_USER_INPUT");
    expect(result.output).toContain("What framework?");
    expect(result.metadata?.question).toBe("What framework?");
  });

  it("should include choices in output", async () => {
    const result = await askUserTool.execute(
      { question: "Pick one", choices: ["React", "Vue", "Svelte"] },
      context,
    );
    expect(result.output).toContain("[1] React");
    expect(result.output).toContain("[2] Vue");
    expect(result.output).toContain("[3] Svelte");
    expect(result.metadata?.choices).toEqual(["React", "Vue", "Svelte"]);
  });

  it("should handle question without choices", async () => {
    const result = await askUserTool.execute({ question: "Explain the bug" }, context);
    expect(result.output).not.toContain("Choices:");
  });
});

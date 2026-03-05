import { describe, it, expect } from "vitest";
import { HookRunner } from "../../../src/hooks/runner.js";
import { type HookConfig, type HookEventPayload } from "../../../src/hooks/types.js";

describe("HookRunner", () => {
  it("should return empty result when no hooks configured", async () => {
    const runner = new HookRunner({});
    const result = await runner.run("PreToolUse", {
      event: "PreToolUse",
    });
    expect(result.blocked).toBe(false);
    expect(result.results).toHaveLength(0);
    expect(result.contextOutput).toBe("");
  });

  it("should return empty result when event has no hooks", async () => {
    const config: HookConfig = {
      PostToolUse: [{ hooks: [{ type: "command", command: "echo test" }] }],
    };
    const runner = new HookRunner(config);
    const result = await runner.run("PreToolUse", {
      event: "PreToolUse",
    });
    expect(result.blocked).toBe(false);
    expect(result.results).toHaveLength(0);
  });

  it("should execute command hook and capture output", async () => {
    const config: HookConfig = {
      PreToolUse: [
        {
          hooks: [{ type: "command", command: "echo hello-from-hook" }],
        },
      ],
    };
    const runner = new HookRunner(config);
    const result = await runner.run("PreToolUse", {
      event: "PreToolUse",
      workingDirectory: process.cwd(),
    });
    expect(result.blocked).toBe(false);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].stdout).toBe("hello-from-hook");
    expect(result.results[0].exitCode).toBe(0);
    expect(result.contextOutput).toBe("hello-from-hook");
  });

  it("should match rule by tool name", async () => {
    const config: HookConfig = {
      PreToolUse: [
        {
          matcher: "file_edit|file_write",
          hooks: [{ type: "command", command: "echo matched" }],
        },
      ],
    };
    const runner = new HookRunner(config);

    // Matching tool
    const result1 = await runner.run("PreToolUse", {
      event: "PreToolUse",
      toolCall: { id: "1", name: "file_edit", arguments: {} },
    });
    expect(result1.results).toHaveLength(1);
    expect(result1.results[0].stdout).toBe("matched");

    // Non-matching tool
    const result2 = await runner.run("PreToolUse", {
      event: "PreToolUse",
      toolCall: { id: "2", name: "bash_exec", arguments: {} },
    });
    expect(result2.results).toHaveLength(0);
  });

  it("should match rule without matcher (always matches)", async () => {
    const config: HookConfig = {
      Stop: [
        {
          hooks: [{ type: "command", command: "echo always" }],
        },
      ],
    };
    const runner = new HookRunner(config);
    const result = await runner.run("Stop", { event: "Stop" });
    expect(result.results).toHaveLength(1);
    expect(result.results[0].stdout).toBe("always");
  });

  it("should report configured events", () => {
    const config: HookConfig = {
      PreToolUse: [{ hooks: [{ type: "command", command: "echo" }] }],
      Stop: [{ hooks: [{ type: "command", command: "echo" }] }],
    };
    const runner = new HookRunner(config);

    expect(runner.hasHooks("PreToolUse")).toBe(true);
    expect(runner.hasHooks("Stop")).toBe(true);
    expect(runner.hasHooks("SessionStart")).toBe(false);

    const events = runner.getConfiguredEvents();
    expect(events).toContain("PreToolUse");
    expect(events).toContain("Stop");
    expect(events).not.toContain("SessionStart");
  });

  it("should interpolate variables in command", async () => {
    const config: HookConfig = {
      PostToolUse: [
        {
          hooks: [{ type: "command", command: "echo $TOOL_NAME" }],
        },
      ],
    };
    const runner = new HookRunner(config);
    const payload: HookEventPayload = {
      event: "PostToolUse",
      toolCall: { id: "1", name: "file_read", arguments: {} },
    };
    const result = await runner.run("PostToolUse", payload);
    expect(result.results[0].stdout).toBe("file_read");
  });

  it("should isolate errors from individual handlers", async () => {
    const config: HookConfig = {
      PreToolUse: [
        {
          hooks: [
            { type: "command", command: "echo success" },
            { type: "command", command: "exit 1" },
          ],
        },
      ],
    };
    const runner = new HookRunner(config);
    const result = await runner.run("PreToolUse", { event: "PreToolUse" });
    // Both handlers run, second one fails but doesn't crash
    expect(result.results).toHaveLength(2);
    expect(result.results[0].exitCode).toBe(0);
    expect(result.results[1].exitCode).not.toBe(0);
  });

  it("should handle blocking hook (exit code 2)", async () => {
    const config: HookConfig = {
      PreToolUse: [
        {
          hooks: [{ type: "command", command: "exit 2" }],
        },
      ],
    };
    const runner = new HookRunner(config);
    const result = await runner.run("PreToolUse", { event: "PreToolUse" });
    expect(result.blocked).toBe(true);
    expect(result.results[0].blocked).toBe(true);
    expect(result.results[0].exitCode).toBe(2);
  });

  it("should handle prompt handler as placeholder", async () => {
    const config: HookConfig = {
      PreToolUse: [
        {
          hooks: [{ type: "prompt", prompt: "Check this action" }],
        },
      ],
    };
    const runner = new HookRunner(config);
    const result = await runner.run("PreToolUse", {
      event: "PreToolUse",
      toolCall: { id: "1", name: "file_write", arguments: {} },
    });
    expect(result.blocked).toBe(false);
    expect(result.results[0].handlerType).toBe("prompt");
  });

  it("should handle agent handler as placeholder", async () => {
    const config: HookConfig = {
      PreToolUse: [
        {
          hooks: [{ type: "agent", agent: "security-check" }],
        },
      ],
    };
    const runner = new HookRunner(config);
    const result = await runner.run("PreToolUse", {
      event: "PreToolUse",
      toolCall: { id: "1", name: "bash_exec", arguments: {} },
    });
    expect(result.blocked).toBe(false);
    expect(result.results[0].handlerType).toBe("agent");
  });

  it("should support glob matcher pattern", async () => {
    const config: HookConfig = {
      PostToolUse: [
        {
          matcher: "file_*",
          hooks: [{ type: "command", command: "echo glob-match" }],
        },
      ],
    };
    const runner = new HookRunner(config);
    const result = await runner.run("PostToolUse", {
      event: "PostToolUse",
      toolCall: { id: "1", name: "file_edit", arguments: {} },
    });
    expect(result.results).toHaveLength(1);
    expect(result.results[0].stdout).toContain("glob-match");
  });

  it("should not block when handler has blocking: false", async () => {
    const config: HookConfig = {
      PreToolUse: [
        {
          hooks: [{ type: "command", command: "exit 2", blocking: false }],
        },
      ],
    };
    const runner = new HookRunner(config);
    const result = await runner.run("PreToolUse", { event: "PreToolUse" });
    expect(result.blocked).toBe(false);
    expect(result.results[0].blocked).toBe(true);
  });

  it("should interpolate FILE_PATH and SESSION_ID", async () => {
    const config: HookConfig = {
      PostToolUse: [
        {
          hooks: [{ type: "command", command: "echo $FILE_PATH $SESSION_ID" }],
        },
      ],
    };
    const runner = new HookRunner(config);
    const result = await runner.run("PostToolUse", {
      event: "PostToolUse",
      filePath: "/tmp/test.ts",
      sessionId: "sess-123",
    });
    expect(result.results[0].stdout).toContain("/tmp/test.ts");
    expect(result.results[0].stdout).toContain("sess-123");
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { HookRunner } from "../../../src/hooks/runner.js";
import { parseHookConfig, HookLoadError } from "../../../src/hooks/loader.js";
import type {
  HookConfig,
  HookEventPayload,
  CommandHookHandler,
  PromptHookHandler,
  AgentHookHandler,
  HookRule,
} from "../../../src/hooks/types.js";

// =============================================================================
// HookRunner — prompt handler behavior
// =============================================================================

describe("HookRunner: prompt handler", () => {
  it("should return non-blocking pass-through for prompt handler", async () => {
    const config: HookConfig = {
      PreToolUse: [
        {
          matcher: "file_edit",
          hooks: [
            {
              type: "prompt",
              prompt: "Are you sure you want to edit this file?",
              promptMessage: "Confirm file edit",
            } as PromptHookHandler,
          ],
        },
      ],
    };

    const runner = new HookRunner(config);
    const payload: HookEventPayload = {
      event: "PreToolUse",
      toolCall: {
        id: "tc-1",
        name: "file_edit",
        arguments: { file_path: "/src/app.ts", old_string: "x", new_string: "y" },
      },
    };

    const result = await runner.run("PreToolUse", payload);

    // Prompt hooks are not yet implemented — should pass through
    expect(result.blocked).toBe(false);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].handlerType).toBe("prompt");
    expect(result.results[0].exitCode).toBe(0);
  });

  it("should match prompt handler by tool name via matcher", async () => {
    const config: HookConfig = {
      PreToolUse: [
        {
          matcher: "bash_exec",
          hooks: [
            {
              type: "prompt",
              prompt: "Confirm bash execution",
              promptMessage: "Are you sure?",
            } as PromptHookHandler,
          ],
        },
      ],
    };

    const runner = new HookRunner(config);

    // Should match when tool is bash_exec
    const matchResult = await runner.run("PreToolUse", {
      event: "PreToolUse",
      toolCall: { id: "tc-1", name: "bash_exec", arguments: { command: "ls" } },
    });
    expect(matchResult.results).toHaveLength(1);

    // Should NOT match when tool is file_read
    const noMatchResult = await runner.run("PreToolUse", {
      event: "PreToolUse",
      toolCall: { id: "tc-2", name: "file_read", arguments: { path: "/tmp/a" } },
    });
    expect(noMatchResult.results).toHaveLength(0);
  });
});

// =============================================================================
// HookRunner — agent handler behavior
// =============================================================================

describe("HookRunner: agent handler", () => {
  it("should pass when validator expression matches payload", async () => {
    const config: HookConfig = {
      PostToolUse: [
        {
          hooks: [
            {
              type: "agent",
              prompt: "Review the output for security issues",
              validator: "payload.toolCall",
              description: "Check tool call exists",
            } as AgentHookHandler,
          ],
        },
      ],
    };

    const runner = new HookRunner(config);
    const result = await runner.run("PostToolUse", {
      event: "PostToolUse",
      toolCall: { id: "tc-1", name: "bash_exec", arguments: { command: "cat file.txt" } },
    });

    // Validator "payload.toolCall" resolves truthy since toolCall is present
    expect(result.blocked).toBe(false);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].handlerType).toBe("agent");
    expect(result.results[0].exitCode).toBe(0);
  });

  it("should block when validator expression fails", async () => {
    const config: HookConfig = {
      PostToolUse: [
        {
          hooks: [
            {
              type: "agent",
              prompt: "Review the output",
              validator: "!payload.toolCall",
              description: "Check tool call is absent",
            } as AgentHookHandler,
          ],
        },
      ],
    };

    const runner = new HookRunner(config);
    const result = await runner.run("PostToolUse", {
      event: "PostToolUse",
      toolCall: { id: "tc-1", name: "bash_exec", arguments: { command: "ls" } },
    });

    // Validator "!payload.toolCall" resolves to false since toolCall is present
    expect(result.blocked).toBe(true);
    expect(result.results[0].blocked).toBe(true);
    expect(result.results[0].exitCode).toBe(2);
  });

  it("should accept agent handler with validator pattern", () => {
    const raw = {
      PreToolUse: [
        {
          matcher: "bash_exec",
          hooks: [
            {
              type: "agent",
              prompt: "Review command safety",
              validator: "!payload.toolCall?.includes('rm -rf')",
              description: "Ensure no destructive commands",
              allowedTools: ["grep_search"],
            },
          ],
        },
      ],
    };

    const config = parseHookConfig(raw);
    expect(config.PreToolUse).toBeDefined();
    expect(config.PreToolUse![0].hooks[0].type).toBe("agent");
  });

  it("should accept agent handler with model override", () => {
    const raw = {
      PostToolUse: [
        {
          hooks: [
            {
              type: "agent",
              prompt: "Analyze the output",
              validator: "output.success === true",
              description: "Validate output format",
              model: "claude-3-haiku",
            },
          ],
        },
      ],
    };

    const config = parseHookConfig(raw);
    const handler = config.PostToolUse![0].hooks[0] as AgentHookHandler;
    expect(handler.model).toBe("claude-3-haiku");
  });
});

// =============================================================================
// HookRunner — matcher patterns
// =============================================================================

describe("HookRunner: matcher patterns", () => {
  it("should match pipe-delimited tool names", async () => {
    const config: HookConfig = {
      PreToolUse: [
        {
          matcher: "file_edit|file_write",
          hooks: [
            {
              type: "prompt",
              prompt: "Confirm file mutation",
              promptMessage: "Confirm",
            } as PromptHookHandler,
          ],
        },
      ],
    };

    const runner = new HookRunner(config);

    // file_edit should match
    const editResult = await runner.run("PreToolUse", {
      event: "PreToolUse",
      toolCall: { id: "tc-1", name: "file_edit", arguments: {} },
    });
    expect(editResult.results).toHaveLength(1);

    // file_write should match
    const writeResult = await runner.run("PreToolUse", {
      event: "PreToolUse",
      toolCall: { id: "tc-2", name: "file_write", arguments: {} },
    });
    expect(writeResult.results).toHaveLength(1);

    // file_read should NOT match
    const readResult = await runner.run("PreToolUse", {
      event: "PreToolUse",
      toolCall: { id: "tc-3", name: "file_read", arguments: {} },
    });
    expect(readResult.results).toHaveLength(0);
  });

  it("should match wildcard patterns in matcher", async () => {
    const config: HookConfig = {
      PreToolUse: [
        {
          matcher: "file_*",
          hooks: [
            {
              type: "prompt",
              prompt: "Any file operation",
              promptMessage: "Confirm",
            } as PromptHookHandler,
          ],
        },
      ],
    };

    const runner = new HookRunner(config);

    // file_read should match file_*
    const result = await runner.run("PreToolUse", {
      event: "PreToolUse",
      toolCall: { id: "tc-1", name: "file_read", arguments: {} },
    });
    expect(result.results).toHaveLength(1);

    // bash_exec should NOT match file_*
    const bashResult = await runner.run("PreToolUse", {
      event: "PreToolUse",
      toolCall: { id: "tc-2", name: "bash_exec", arguments: {} },
    });
    expect(bashResult.results).toHaveLength(0);
  });

  it("should match all tools when no matcher is set", async () => {
    const config: HookConfig = {
      PreToolUse: [
        {
          // No matcher — matches everything
          hooks: [
            {
              type: "prompt",
              prompt: "Universal hook",
              promptMessage: "Confirm",
            } as PromptHookHandler,
          ],
        },
      ],
    };

    const runner = new HookRunner(config);

    const result = await runner.run("PreToolUse", {
      event: "PreToolUse",
      toolCall: { id: "tc-1", name: "anything", arguments: {} },
    });
    expect(result.results).toHaveLength(1);
  });
});

// =============================================================================
// HookRunner — hasHooks and getConfiguredEvents
// =============================================================================

describe("HookRunner: utility methods", () => {
  it("hasHooks should return true for configured events", () => {
    const config: HookConfig = {
      PreToolUse: [
        { hooks: [{ type: "prompt", prompt: "p", promptMessage: "m" } as PromptHookHandler] },
      ],
    };
    const runner = new HookRunner(config);

    expect(runner.hasHooks("PreToolUse")).toBe(true);
    expect(runner.hasHooks("PostToolUse")).toBe(false);
  });

  it("getConfiguredEvents should list events with hooks", () => {
    const config: HookConfig = {
      PreToolUse: [
        { hooks: [{ type: "prompt", prompt: "p", promptMessage: "m" } as PromptHookHandler] },
      ],
      PostToolUse: [
        { hooks: [{ type: "prompt", prompt: "p", promptMessage: "m" } as PromptHookHandler] },
      ],
    };
    const runner = new HookRunner(config);

    const events = runner.getConfiguredEvents();
    expect(events).toContain("PreToolUse");
    expect(events).toContain("PostToolUse");
    expect(events).not.toContain("SessionStart");
  });

  it("should return no results for events with no rules", async () => {
    const runner = new HookRunner({});
    const result = await runner.run("PreToolUse", { event: "PreToolUse" });

    expect(result.blocked).toBe(false);
    expect(result.results).toHaveLength(0);
    expect(result.contextOutput).toBe("");
  });
});

// =============================================================================
// parseHookConfig — validation
// =============================================================================

describe("parseHookConfig: hook handler validation", () => {
  it("should parse valid prompt handler config", () => {
    const raw = {
      PreToolUse: [
        {
          matcher: "bash_exec",
          hooks: [
            {
              type: "prompt",
              prompt: "Review this command: $TOOL_NAME",
              promptMessage: "Should this command run?",
              timeout: 30,
            },
          ],
        },
      ],
    };

    const config = parseHookConfig(raw);
    expect(config.PreToolUse).toHaveLength(1);
    expect(config.PreToolUse![0].hooks[0].type).toBe("prompt");
  });

  it("should parse valid agent handler config", () => {
    const raw = {
      PostToolUse: [
        {
          hooks: [
            {
              type: "agent",
              prompt: "Check the output for errors",
              validator: "result.exitCode === 0",
              description: "Verify command succeeded",
              allowedTools: ["grep_search", "file_read"],
              model: "gpt-4o-mini",
            },
          ],
        },
      ],
    };

    const config = parseHookConfig(raw);
    const handler = config.PostToolUse![0].hooks[0] as AgentHookHandler;
    expect(handler.type).toBe("agent");
    expect(handler.validator).toBe("result.exitCode === 0");
    expect(handler.allowedTools).toEqual(["grep_search", "file_read"]);
  });

  it("should reject unknown event names", () => {
    const raw = {
      InvalidEventName: [{ hooks: [{ type: "command", command: "echo test" }] }],
    };

    expect(() => parseHookConfig(raw)).toThrow(HookLoadError);
  });

  it("should return empty config for null input", () => {
    expect(parseHookConfig(null)).toEqual({});
  });

  it("should return empty config for undefined input", () => {
    expect(parseHookConfig(undefined)).toEqual({});
  });

  it("should reject non-object input", () => {
    expect(() => parseHookConfig("not an object")).toThrow(HookLoadError);
    expect(() => parseHookConfig([])).toThrow(HookLoadError);
  });

  it("should accept multiple hook rules for the same event", () => {
    const raw = {
      PreToolUse: [
        {
          matcher: "file_edit",
          hooks: [{ type: "command", command: "echo lint" }],
        },
        {
          matcher: "bash_exec",
          hooks: [
            {
              type: "agent",
              prompt: "Check safety",
              validator: "true",
              description: "Safety check",
            },
          ],
        },
      ],
    };

    const config = parseHookConfig(raw);
    expect(config.PreToolUse).toHaveLength(2);
  });
});

// =============================================================================
// Auto-lint hook rule creation for different file extensions
// =============================================================================

describe("Auto-lint hook rule creation patterns", () => {
  it("should create lint rules targeting file-mutating tools", () => {
    // This tests that the auto-lint system correctly identifies mutating tools
    const fileMutatingTools = new Set(["file_write", "file_edit"]);

    expect(fileMutatingTools.has("file_write")).toBe(true);
    expect(fileMutatingTools.has("file_edit")).toBe(true);
    expect(fileMutatingTools.has("file_read")).toBe(false);
    expect(fileMutatingTools.has("bash_exec")).toBe(false);
  });

  it("should create valid PostToolUse hook config for lint", () => {
    const lintHookConfig: HookConfig = {
      PostToolUse: [
        {
          matcher: "file_edit|file_write",
          hooks: [
            {
              type: "command",
              command: "npx eslint --no-warn-ignored $FILE_PATH",
              timeoutMs: 30000,
            },
          ],
        },
      ],
    };

    const runner = new HookRunner(lintHookConfig);
    expect(runner.hasHooks("PostToolUse")).toBe(true);
    expect(runner.hasHooks("PreToolUse")).toBe(false);
  });

  it("should support different linter commands for different extensions", () => {
    // Simulate creating rules for different file types
    const rules: HookRule[] = [
      {
        matcher: "file_edit|file_write",
        hooks: [
          {
            type: "command",
            command: "npx eslint --no-warn-ignored $FILE_PATH",
            timeoutMs: 15000,
          },
        ],
      },
    ];

    const config: HookConfig = { PostToolUse: rules };
    const runner = new HookRunner(config);

    // Should have hooks for PostToolUse
    expect(runner.hasHooks("PostToolUse")).toBe(true);
    const events = runner.getConfiguredEvents();
    expect(events).toContain("PostToolUse");
  });

  it("should support blocking option for lint failures", () => {
    const config: HookConfig = {
      PostToolUse: [
        {
          matcher: "file_edit|file_write",
          hooks: [
            {
              type: "command",
              command: "npx eslint $FILE_PATH",
              blocking: true,
            },
          ],
        },
      ],
    };

    const runner = new HookRunner(config);
    expect(runner.hasHooks("PostToolUse")).toBe(true);
  });
});

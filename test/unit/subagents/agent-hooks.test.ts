import { describe, it, expect } from "vitest";
import {
  convertAgentHooks,
  mergeHookConfigs,
  type AgentHookConfig,
} from "../../../src/subagents/agent-hooks.js";
import { type HookConfig, type HookRule } from "../../../src/hooks/types.js";

// =============================================================================
// convertAgentHooks
// =============================================================================

describe("convertAgentHooks", () => {
  it("should convert PreToolUse hooks to HookConfig format", () => {
    const agentHooks: AgentHookConfig = {
      PreToolUse: [
        {
          matcher: "bash_exec",
          hooks: [{ type: "command", command: "echo pre-hook" }],
        },
      ],
    };

    const result = convertAgentHooks(agentHooks);
    expect(result.PreToolUse).toBeDefined();
    expect(result.PreToolUse).toHaveLength(1);
    expect(result.PreToolUse![0].matcher).toBe("bash_exec");
    expect(result.PreToolUse![0].hooks).toHaveLength(1);
    expect(result.PreToolUse![0].hooks[0]).toEqual({
      type: "command",
      command: "echo pre-hook",
    });
  });

  it("should convert PostToolUse hooks to HookConfig format", () => {
    const agentHooks: AgentHookConfig = {
      PostToolUse: [
        {
          hooks: [{ type: "command", command: "prettier --write" }],
        },
      ],
    };

    const result = convertAgentHooks(agentHooks);
    expect(result.PostToolUse).toBeDefined();
    expect(result.PostToolUse).toHaveLength(1);
    expect(result.PostToolUse![0].matcher).toBeUndefined();
    expect(result.PostToolUse![0].hooks[0]).toEqual({
      type: "command",
      command: "prettier --write",
    });
  });

  it("should convert Stop hooks to SubagentStop events", () => {
    const agentHooks: AgentHookConfig = {
      Stop: [
        {
          hooks: [{ type: "command", command: "echo agent stopped" }],
        },
      ],
    };

    const result = convertAgentHooks(agentHooks);
    // Stop in frontmatter maps to SubagentStop
    expect(result.SubagentStop).toBeDefined();
    expect(result.SubagentStop).toHaveLength(1);
    expect(result.SubagentStop![0].hooks[0]).toEqual({
      type: "command",
      command: "echo agent stopped",
    });
    // The original "Stop" key should NOT be set
    expect(result.Stop).toBeUndefined();
  });

  it("should handle multiple rules per event", () => {
    const agentHooks: AgentHookConfig = {
      PreToolUse: [
        {
          matcher: "file_edit",
          hooks: [{ type: "command", command: "echo edit hook" }],
        },
        {
          matcher: "bash_exec",
          hooks: [{ type: "command", command: "echo bash hook" }],
        },
      ],
    };

    const result = convertAgentHooks(agentHooks);
    expect(result.PreToolUse).toHaveLength(2);
    expect(result.PreToolUse![0].matcher).toBe("file_edit");
    expect(result.PreToolUse![1].matcher).toBe("bash_exec");
  });

  it("should handle multiple hooks per rule", () => {
    const agentHooks: AgentHookConfig = {
      PostToolUse: [
        {
          matcher: "file_edit",
          hooks: [
            { type: "command", command: "prettier --write" },
            { type: "command", command: "eslint --fix" },
          ],
        },
      ],
    };

    const result = convertAgentHooks(agentHooks);
    expect(result.PostToolUse![0].hooks).toHaveLength(2);
  });

  it("should return empty config for empty agent hooks", () => {
    const agentHooks: AgentHookConfig = {};
    const result = convertAgentHooks(agentHooks);
    expect(Object.keys(result).length).toBe(0);
  });

  it("should skip empty arrays", () => {
    const agentHooks: AgentHookConfig = {
      PreToolUse: [],
      PostToolUse: [],
      Stop: [],
    };

    const result = convertAgentHooks(agentHooks);
    expect(result.PreToolUse).toBeUndefined();
    expect(result.PostToolUse).toBeUndefined();
    expect(result.SubagentStop).toBeUndefined();
  });

  it("should handle all three event types simultaneously", () => {
    const agentHooks: AgentHookConfig = {
      PreToolUse: [{ hooks: [{ type: "command", command: "pre" }] }],
      PostToolUse: [{ hooks: [{ type: "command", command: "post" }] }],
      Stop: [{ hooks: [{ type: "command", command: "stop" }] }],
    };

    const result = convertAgentHooks(agentHooks);
    expect(result.PreToolUse).toBeDefined();
    expect(result.PostToolUse).toBeDefined();
    expect(result.SubagentStop).toBeDefined();
  });
});

// =============================================================================
// mergeHookConfigs
// =============================================================================

describe("mergeHookConfigs", () => {
  it("should return agent hooks when parent is undefined", () => {
    const agentHooks: HookConfig = {
      PreToolUse: [{ hooks: [{ type: "command", command: "agent pre" }] }],
    };

    const result = mergeHookConfigs(undefined, agentHooks);
    expect(result).toBe(agentHooks);
  });

  it("should preserve parent-only events", () => {
    const parentHooks: HookConfig = {
      SessionStart: [{ hooks: [{ type: "command", command: "session start" }] }],
    };
    const agentHooks: HookConfig = {
      PreToolUse: [{ hooks: [{ type: "command", command: "agent pre" }] }],
    };

    const result = mergeHookConfigs(parentHooks, agentHooks);
    expect(result.SessionStart).toBeDefined();
    expect(result.PreToolUse).toBeDefined();
  });

  it("should add agent-only events", () => {
    const parentHooks: HookConfig = {};
    const agentHooks: HookConfig = {
      SubagentStop: [{ hooks: [{ type: "command", command: "stop hook" }] }],
    };

    const result = mergeHookConfigs(parentHooks, agentHooks);
    expect(result.SubagentStop).toBeDefined();
    expect(result.SubagentStop).toHaveLength(1);
  });

  it("should concatenate rules for shared events (parent first, then agent)", () => {
    const parentRule: HookRule = {
      matcher: "file_edit",
      hooks: [{ type: "command", command: "parent hook" }],
    };
    const agentRule: HookRule = {
      matcher: "bash_exec",
      hooks: [{ type: "command", command: "agent hook" }],
    };

    const parentHooks: HookConfig = { PreToolUse: [parentRule] };
    const agentHooks: HookConfig = { PreToolUse: [agentRule] };

    const result = mergeHookConfigs(parentHooks, agentHooks);
    expect(result.PreToolUse).toHaveLength(2);
    expect(result.PreToolUse![0].matcher).toBe("file_edit"); // parent first
    expect(result.PreToolUse![1].matcher).toBe("bash_exec"); // agent second
  });

  it("should use agent rules directly when parent event rules are empty", () => {
    const parentHooks: HookConfig = { PreToolUse: [] };
    const agentHooks: HookConfig = {
      PreToolUse: [{ hooks: [{ type: "command", command: "agent only" }] }],
    };

    const result = mergeHookConfigs(parentHooks, agentHooks);
    expect(result.PreToolUse).toHaveLength(1);
    expect(result.PreToolUse![0].hooks[0]).toEqual({ type: "command", command: "agent only" });
  });

  it("should not modify the parent config object", () => {
    const parentHooks: HookConfig = {
      PreToolUse: [{ hooks: [{ type: "command", command: "parent" }] }],
    };
    const agentHooks: HookConfig = {
      PostToolUse: [{ hooks: [{ type: "command", command: "agent" }] }],
    };

    const originalParentKeys = Object.keys(parentHooks);
    mergeHookConfigs(parentHooks, agentHooks);
    expect(Object.keys(parentHooks)).toEqual(originalParentKeys);
  });

  it("should handle merging with both empty configs", () => {
    const result = mergeHookConfigs({}, {});
    expect(Object.keys(result).length).toBe(0);
  });
});

import {
  type HookConfig,
  type HookEvent,
  type HookRule,
  type CommandHookHandler,
} from "../hooks/types.js";

/** Agent hook entry — a command to execute */
export interface AgentHookEntry {
  readonly type: "command";
  readonly command: string;
}

/** Agent hook rule — matcher + hooks */
export interface AgentHookRule {
  readonly matcher?: string;
  readonly hooks: readonly AgentHookEntry[];
}

/** Agent hook configuration from frontmatter */
export interface AgentHookConfig {
  readonly PreToolUse?: readonly AgentHookRule[];
  readonly PostToolUse?: readonly AgentHookRule[];
  readonly Stop?: readonly AgentHookRule[];
}

/** Mapping from agent frontmatter Stop events to SubagentStop */
const STOP_EVENT_MAPPING: Record<string, HookEvent> = {
  Stop: "SubagentStop",
} as const;

/**
 * Convert a single AgentHookEntry into a CommandHookHandler
 * compatible with the existing hook runner system.
 */
function toCommandHandler(entry: AgentHookEntry): CommandHookHandler {
  return {
    type: "command",
    command: entry.command,
  };
}

/**
 * Convert agent hook rules into HookRule[] for the hook runner.
 */
function convertRules(rules: readonly AgentHookRule[]): readonly HookRule[] {
  return rules.map((rule) => ({
    matcher: rule.matcher,
    hooks: rule.hooks.map(toCommandHandler),
  }));
}

/**
 * Convert agent frontmatter hooks into the format expected
 * by the existing hook runner system.
 * Stop hooks in frontmatter are converted to SubagentStop events.
 */
export function convertAgentHooks(agentHooks: AgentHookConfig): HookConfig {
  const config: Partial<Record<HookEvent, readonly HookRule[]>> = {};

  if (agentHooks.PreToolUse && agentHooks.PreToolUse.length > 0) {
    config.PreToolUse = convertRules(agentHooks.PreToolUse);
  }

  if (agentHooks.PostToolUse && agentHooks.PostToolUse.length > 0) {
    config.PostToolUse = convertRules(agentHooks.PostToolUse);
  }

  if (agentHooks.Stop && agentHooks.Stop.length > 0) {
    const mappedEvent = STOP_EVENT_MAPPING.Stop ?? "SubagentStop";
    config[mappedEvent] = convertRules(agentHooks.Stop);
  }

  return config;
}

/**
 * Merge parent session hooks with agent-specific hooks.
 * Agent hooks take precedence for matching events.
 * Events only in the parent are preserved unchanged.
 * Events only in the agent config are added as-is.
 * Events in both are concatenated, with agent rules appended after parent rules.
 */
export function mergeHookConfigs(
  parentHooks: HookConfig | undefined,
  agentHooks: HookConfig,
): HookConfig {
  if (!parentHooks) {
    return agentHooks;
  }

  const merged: Partial<Record<HookEvent, readonly HookRule[]>> = { ...parentHooks };

  for (const [event, agentRules] of Object.entries(agentHooks)) {
    const hookEvent = event as HookEvent;
    const parentRules = merged[hookEvent];

    if (parentRules && parentRules.length > 0) {
      // Concatenate: parent rules first, then agent rules (agent takes precedence on match)
      merged[hookEvent] = [...parentRules, ...agentRules];
    } else {
      merged[hookEvent] = agentRules;
    }
  }

  return merged;
}

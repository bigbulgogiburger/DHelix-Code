import {
  type PermissionMode,
  type PermissionCheckResult,
  type PermissionRule,
  type PersistentPermissionRule,
} from "./types.js";
import { type PermissionLevel } from "../tools/types.js";
import { checkPermissionByMode } from "./modes.js";
import { findMatchingRule } from "./rules.js";
import { SessionApprovalStore } from "./session-store.js";

/** Tool-to-argument mapping for pattern matching against persistent rules */
const TOOL_ARG_MAP: Readonly<Record<string, string>> = {
  bash_exec: "command",
  file_edit: "file_path",
  file_write: "file_path",
  file_read: "file_path",
};

/**
 * Match a value against a glob-like pattern.
 * Supports * (any chars) and ? (single char).
 */
function matchGlob(value: string, pattern: string): boolean {
  const regex = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${regex}$`).test(value);
}

/**
 * Permission manager — coordinates mode, rules, session approvals,
 * and persistent permission rules.
 */
export class PermissionManager {
  private mode: PermissionMode;
  private readonly rules: PermissionRule[];
  private readonly sessionStore: SessionApprovalStore;
  private persistentRules: readonly PersistentPermissionRule[];

  constructor(mode: PermissionMode = "default", rules: readonly PermissionRule[] = []) {
    this.mode = mode;
    this.rules = [...rules];
    this.sessionStore = new SessionApprovalStore();
    this.persistentRules = [];
  }

  /** Get current permission mode */
  getMode(): PermissionMode {
    return this.mode;
  }

  /** Set permission mode */
  setMode(mode: PermissionMode): void {
    this.mode = mode;
  }

  /** Set persistent permission rules (loaded from disk) */
  setPersistentRules(rules: readonly PersistentPermissionRule[]): void {
    this.persistentRules = [...rules];
  }

  /** Get current persistent rules */
  getPersistentRules(): readonly PersistentPermissionRule[] {
    return this.persistentRules;
  }

  /**
   * Check if a tool call is allowed.
   * Checks in order: persistent deny → session approvals → persistent allow
   * → explicit rules → mode-based check.
   */
  check(
    toolName: string,
    permissionLevel: PermissionLevel,
    args?: Readonly<Record<string, unknown>>,
  ): PermissionCheckResult {
    // 1. Check persistent deny rules first (highest priority)
    if (this.isDeniedByPersistentRule(toolName, args)) {
      return {
        allowed: false,
        requiresPrompt: false,
        reason: "Denied by persistent deny rule",
      };
    }

    // 2. Check session approvals
    if (this.sessionStore.isApproved(toolName, args)) {
      return { allowed: true, requiresPrompt: false, reason: "Session approved" };
    }

    // 3. Check persistent allow rules
    if (this.isAllowedByPersistentRule(toolName, args)) {
      return {
        allowed: true,
        requiresPrompt: false,
        reason: "Allowed by persistent allow rule",
      };
    }

    // 4. Check explicit rules
    const matchedRule = findMatchingRule(this.rules, toolName, args);
    if (matchedRule) {
      return {
        allowed: matchedRule.allowed,
        requiresPrompt: false,
        reason: matchedRule.allowed ? "Rule: allowed" : "Rule: denied",
      };
    }

    // 5. Mode-based check
    return checkPermissionByMode(this.mode, permissionLevel);
  }

  /** Record that the user approved a tool call */
  approve(toolName: string, args?: Readonly<Record<string, unknown>>): void {
    this.sessionStore.approve(toolName, args);
  }

  /** Record that the user approved all future calls to a tool */
  approveAll(toolName: string): void {
    this.sessionStore.approveAll(toolName);
  }

  /**
   * Save a persistent "always allow" rule.
   * Adds the rule to the in-memory list. Callers are responsible for
   * persisting to disk via PersistentPermissionStore.
   */
  approveAlways(toolName: string, pattern?: string, scope: "project" | "user" = "project"): void {
    const newRule: PersistentPermissionRule = {
      tool: toolName,
      ...(pattern !== undefined ? { pattern } : {}),
      type: "allow",
      scope,
    };
    this.persistentRules = [...this.persistentRules, newRule];
  }

  /** Add a permission rule */
  addRule(rule: PermissionRule): void {
    this.rules.push(rule);
  }

  /** Clear session approvals */
  clearSession(): void {
    this.sessionStore.clear();
  }

  /**
   * Check if a tool call is denied by any persistent deny rule.
   * Deny rules are checked first and take highest priority.
   */
  private isDeniedByPersistentRule(
    toolName: string,
    args?: Readonly<Record<string, unknown>>,
  ): boolean {
    return this.matchesPersistentRule(toolName, args, "deny");
  }

  /**
   * Check if a tool call is allowed by any persistent allow rule.
   */
  private isAllowedByPersistentRule(
    toolName: string,
    args?: Readonly<Record<string, unknown>>,
  ): boolean {
    return this.matchesPersistentRule(toolName, args, "allow");
  }

  /**
   * Check if a tool call matches any persistent rule of the given type.
   * For tools with known argument mappings (bash_exec → command,
   * file_edit/file_write/file_read → file_path), the rule pattern
   * is matched against the specific argument. For other tools,
   * only the tool name is matched.
   */
  private matchesPersistentRule(
    toolName: string,
    args: Readonly<Record<string, unknown>> | undefined,
    ruleType: "allow" | "deny",
  ): boolean {
    const filtered = this.persistentRules.filter((r) => r.type === ruleType);

    for (const rule of filtered) {
      // Check if tool name matches (exact or glob)
      if (!matchGlob(toolName, rule.tool)) {
        continue;
      }

      // If the rule has no pattern, it matches the tool regardless of args
      if (!rule.pattern) {
        return true;
      }

      // If the rule has a pattern, we need args to match against
      if (!args) {
        continue;
      }

      // Get the relevant argument value based on tool-to-arg mapping
      const argKey = TOOL_ARG_MAP[toolName];
      if (argKey) {
        const argValue = args[argKey];
        if (typeof argValue === "string" && matchGlob(argValue, rule.pattern)) {
          return true;
        }
      } else {
        // For unknown tools with a pattern, check all string argument values
        const argValues = Object.values(args).filter((v): v is string => typeof v === "string");
        if (argValues.some((v) => matchGlob(v, rule.pattern!))) {
          return true;
        }
      }
    }

    return false;
  }
}

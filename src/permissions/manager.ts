import { type PermissionMode, type PermissionCheckResult, type PermissionRule } from "./types.js";
import { type PermissionLevel } from "../tools/types.js";
import { checkPermissionByMode } from "./modes.js";
import { findMatchingRule } from "./rules.js";
import { SessionApprovalStore } from "./session-store.js";
import {
  parsePermissionPattern,
  matchesPermissionPattern,
  type ParsedPermissionPattern,
} from "./pattern-parser.js";

/**
 * A parsed persistent permission rule (allow or deny).
 */
interface PersistentRule {
  readonly raw: string;
  readonly parsed: ParsedPermissionPattern;
}

/**
 * Parse an array of raw pattern strings into PersistentRule objects.
 * Silently skips patterns that fail to parse (graceful degradation).
 */
function parsePersistentRules(rawPatterns: readonly string[]): readonly PersistentRule[] {
  const results: PersistentRule[] = [];
  for (const raw of rawPatterns) {
    try {
      const parsed = parsePermissionPattern(raw);
      results.push({ raw, parsed });
    } catch {
      // Skip malformed patterns — graceful degradation
    }
  }
  return Object.freeze(results);
}

/**
 * Permission manager — coordinates mode, rules, session approvals,
 * and persistent allow/deny rules from settings.json.
 *
 * Check order (deny always wins):
 *   1. Persistent deny rules
 *   2. Session approvals
 *   3. Persistent allow rules
 *   4. Explicit rules
 *   5. Mode-based check
 */
export class PermissionManager {
  private mode: PermissionMode;
  private readonly rules: PermissionRule[];
  private readonly sessionStore: SessionApprovalStore;
  private readonly persistentAllowRules: readonly PersistentRule[];
  private readonly persistentDenyRules: readonly PersistentRule[];

  constructor(
    mode: PermissionMode = "default",
    rules: readonly PermissionRule[] = [],
    persistentRules?: {
      readonly allow?: readonly string[];
      readonly deny?: readonly string[];
    },
  ) {
    this.mode = mode;
    this.rules = [...rules];
    this.sessionStore = new SessionApprovalStore();
    this.persistentAllowRules = parsePersistentRules(persistentRules?.allow ?? []);
    this.persistentDenyRules = parsePersistentRules(persistentRules?.deny ?? []);
  }

  /** Get current permission mode */
  getMode(): PermissionMode {
    return this.mode;
  }

  /** Set permission mode */
  setMode(mode: PermissionMode): void {
    this.mode = mode;
  }

  /**
   * Check if a tool call is allowed.
   *
   * Check order (deny always takes priority):
   *   1. Persistent deny rules — if matched, denied immediately
   *   2. Session approvals — if matched, allowed
   *   3. Persistent allow rules — if matched, allowed
   *   4. Explicit rules — if matched, allowed or denied per rule
   *   5. Mode-based check — fallback behavior
   */
  check(
    toolName: string,
    permissionLevel: PermissionLevel,
    args?: Readonly<Record<string, unknown>>,
  ): PermissionCheckResult {
    // 1. Check persistent deny rules — deny always takes priority
    if (this.matchesPersistent(this.persistentDenyRules, toolName, args)) {
      return {
        allowed: false,
        requiresPrompt: false,
        reason: "Persistent deny rule",
      };
    }

    // 2. Check session approvals
    if (this.sessionStore.isApproved(toolName, args)) {
      return { allowed: true, requiresPrompt: false, reason: "Session approved" };
    }

    // 3. Check persistent allow rules
    if (this.matchesPersistent(this.persistentAllowRules, toolName, args)) {
      return {
        allowed: true,
        requiresPrompt: false,
        reason: "Persistent allow rule",
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

  /** Add a permission rule */
  addRule(rule: PermissionRule): void {
    this.rules.push(rule);
  }

  /** Clear session approvals */
  clearSession(): void {
    this.sessionStore.clear();
  }

  /** Check if any persistent rule in the list matches the given tool call */
  private matchesPersistent(
    rules: readonly PersistentRule[],
    toolName: string,
    args?: Readonly<Record<string, unknown>>,
  ): boolean {
    return rules.some((rule) => matchesPermissionPattern(rule.parsed, toolName, args));
  }
}

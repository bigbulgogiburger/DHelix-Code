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
import {
  parsePermissionPattern,
  matchesPermissionPattern,
  type ParsedPermissionPattern,
} from "./pattern-parser.js";
import { AuditLogger } from "./audit-log.js";

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
 * Convert PersistentPermissionRule[] to the internal PersistentRule[] format,
 * filtering by rule type.
 */
function toPersistentRules(
  rules: readonly PersistentPermissionRule[],
  type: "allow" | "deny",
): readonly PersistentRule[] {
  const filtered = rules.filter((r) => r.type === type);
  const rawPatterns = filtered.map((r) => {
    if (r.pattern) {
      return `${r.tool}(${r.pattern})`;
    }
    return r.tool;
  });
  return parsePersistentRules(rawPatterns);
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
  private persistentAllowRules: readonly PersistentRule[];
  private persistentDenyRules: readonly PersistentRule[];
  private persistentRulesList: readonly PersistentPermissionRule[];
  private readonly auditLogger: AuditLogger | null;
  private sessionId: string;

  constructor(
    mode: PermissionMode = "default",
    rules: readonly PermissionRule[] = [],
    persistentRules?: {
      readonly allow?: readonly string[];
      readonly deny?: readonly string[];
    },
    options?: {
      readonly auditLogPath?: string;
      readonly sessionId?: string;
    },
  ) {
    this.mode = mode;
    this.rules = [...rules];
    this.sessionStore = new SessionApprovalStore();
    this.persistentAllowRules = parsePersistentRules(persistentRules?.allow ?? []);
    this.persistentDenyRules = parsePersistentRules(persistentRules?.deny ?? []);
    this.persistentRulesList = [];
    this.auditLogger = options?.auditLogPath ? new AuditLogger(options.auditLogPath) : null;
    this.sessionId = options?.sessionId ?? "unknown";
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
    this.persistentRulesList = [...rules];
    this.persistentAllowRules = toPersistentRules(rules, "allow");
    this.persistentDenyRules = toPersistentRules(rules, "deny");
  }

  /** Get current persistent rules */
  getPersistentRules(): readonly PersistentPermissionRule[] {
    return this.persistentRulesList;
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
      this.logAudit(toolName, "denied", "Persistent deny rule");
      return {
        allowed: false,
        requiresPrompt: false,
        reason: "Persistent deny rule",
      };
    }

    // 2. Check session approvals
    if (this.sessionStore.isApproved(toolName, args)) {
      this.logAudit(toolName, "auto-approved", "Session approved");
      return { allowed: true, requiresPrompt: false, reason: "Session approved" };
    }

    // 3. Check persistent allow rules
    if (this.matchesPersistent(this.persistentAllowRules, toolName, args)) {
      this.logAudit(toolName, "auto-approved", "Persistent allow rule");
      return {
        allowed: true,
        requiresPrompt: false,
        reason: "Persistent allow rule",
      };
    }

    // 4. Check explicit rules
    const matchedRule = findMatchingRule(this.rules, toolName, args);
    if (matchedRule) {
      this.logAudit(toolName, matchedRule.allowed ? "auto-approved" : "denied", matchedRule.allowed ? "Rule: allowed" : "Rule: denied");
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
    this.setPersistentRules([...this.persistentRulesList, newRule]);
  }

  /** Add a permission rule */
  addRule(rule: PermissionRule): void {
    this.rules.push(rule);
  }

  /** Clear session approvals */
  clearSession(): void {
    this.sessionStore.clear();
  }

  /** Log a permission decision to the audit log (fire-and-forget) */
  private logAudit(
    toolName: string,
    decision: "approved" | "denied" | "auto-approved",
    reason?: string,
  ): void {
    this.auditLogger?.log({
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      toolName,
      decision,
      reason,
    }).catch(() => { /* swallow audit log errors */ });
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

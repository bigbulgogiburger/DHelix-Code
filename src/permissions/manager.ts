import { type PermissionMode, type PermissionCheckResult, type PermissionRule } from "./types.js";
import { type PermissionLevel } from "../tools/types.js";
import { checkPermissionByMode } from "./modes.js";
import { findMatchingRule } from "./rules.js";
import { SessionApprovalStore } from "./session-store.js";

/**
 * Permission manager — coordinates mode, rules, and session approvals.
 */
export class PermissionManager {
  private mode: PermissionMode;
  private readonly rules: PermissionRule[];
  private readonly sessionStore: SessionApprovalStore;

  constructor(mode: PermissionMode = "default", rules: readonly PermissionRule[] = []) {
    this.mode = mode;
    this.rules = [...rules];
    this.sessionStore = new SessionApprovalStore();
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
   * Checks in order: session approvals → explicit rules → mode-based check.
   */
  check(
    toolName: string,
    permissionLevel: PermissionLevel,
    args?: Readonly<Record<string, unknown>>,
  ): PermissionCheckResult {
    // 1. Check session approvals
    if (this.sessionStore.isApproved(toolName, args)) {
      return { allowed: true, requiresPrompt: false, reason: "Session approved" };
    }

    // 2. Check explicit rules
    const matchedRule = findMatchingRule(this.rules, toolName, args);
    if (matchedRule) {
      return {
        allowed: matchedRule.allowed,
        requiresPrompt: false,
        reason: matchedRule.allowed ? "Rule: allowed" : "Rule: denied",
      };
    }

    // 3. Mode-based check
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
}

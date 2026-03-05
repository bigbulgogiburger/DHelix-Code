import { type PermissionMode, type PermissionCheckResult } from "./types.js";
import { type PermissionLevel } from "../tools/types.js";

/**
 * Check permission based on the current mode and tool's permission level.
 */
export function checkPermissionByMode(
  mode: PermissionMode,
  permissionLevel: PermissionLevel,
): PermissionCheckResult {
  switch (mode) {
    case "bypassPermissions":
      return { allowed: true, requiresPrompt: false, reason: "Bypass mode" };

    case "dontAsk":
      return { allowed: true, requiresPrompt: false, reason: "Don't ask mode" };

    case "plan":
      // In plan mode, only safe (read-only) tools are allowed
      if (permissionLevel === "safe") {
        return { allowed: true, requiresPrompt: false };
      }
      return {
        allowed: false,
        requiresPrompt: false,
        reason: "Plan mode: only read-only tools allowed",
      };

    case "acceptEdits":
      // Accept edits mode: safe + confirm are auto-allowed, dangerous still prompts
      if (permissionLevel === "safe" || permissionLevel === "confirm") {
        return { allowed: true, requiresPrompt: false };
      }
      return { allowed: false, requiresPrompt: true };

    case "default":
    default:
      // Default mode: safe auto-allowed, confirm/dangerous require prompt
      if (permissionLevel === "safe") {
        return { allowed: true, requiresPrompt: false };
      }
      return { allowed: false, requiresPrompt: true };
  }
}

/** Get a human-readable description of a permission mode */
export function getModeDescription(mode: PermissionMode): string {
  const descriptions: Record<PermissionMode, string> = {
    default: "Ask for confirmation on file edits and command execution",
    acceptEdits: "Auto-approve file edits, ask for commands",
    plan: "Read-only mode — no file modifications or commands",
    dontAsk: "Auto-approve everything (use with caution)",
    bypassPermissions: "Bypass all permission checks",
  };
  return descriptions[mode];
}

import { type PermissionLevel } from "../tools/types.js";

/** Permission modes controlling how permission checks behave */
export type PermissionMode = "default" | "acceptEdits" | "plan" | "dontAsk" | "bypassPermissions";

/** A permission rule for a specific tool or pattern */
export interface PermissionRule {
  readonly toolName: string;
  readonly pattern?: string;
  readonly allowed: boolean;
}

/** Result of a permission check */
export interface PermissionCheckResult {
  readonly allowed: boolean;
  readonly reason?: string;
  readonly requiresPrompt: boolean;
}

/** Permission request — what gets shown to the user */
export interface PermissionRequest {
  readonly toolName: string;
  readonly toolDescription: string;
  readonly permissionLevel: PermissionLevel;
  readonly args: Readonly<Record<string, unknown>>;
}

import { useState, useCallback } from "react";
import { type PermissionResult } from "../../core/agent-loop.js";
import { type PermissionManager } from "../../permissions/manager.js";
import { type ToolRegistry } from "../../tools/registry.js";
import { type ExtractedToolCall } from "../../tools/types.js";

/** Pending permission request */
export interface PendingPermission {
  readonly call: ExtractedToolCall;
  readonly resolve: (result: PermissionResult) => void;
}

/** Hook for managing tool permission prompts */
export function usePermissionPrompt(
  permissionManager: PermissionManager,
  toolRegistry: ToolRegistry,
) {
  const [pendingPermission, setPendingPermission] = useState<PendingPermission | null>(null);

  const handlePermissionResponse = useCallback(
    (response: "yes" | "no" | "always") => {
      if (!pendingPermission) return;
      const { call, resolve } = pendingPermission;
      setPendingPermission(null);

      if (response === "yes") {
        permissionManager.approve(call.name, call.arguments);
        resolve({ allowed: true });
      } else if (response === "always") {
        permissionManager.approveAll(call.name);
        resolve({ allowed: true });
      } else {
        resolve({ allowed: false, reason: "User denied" });
      }
    },
    [pendingPermission, permissionManager],
  );

  /** Permission checker for the agent loop config */
  const checkPermission = useCallback(
    async (call: ExtractedToolCall): Promise<PermissionResult> => {
      const tool = toolRegistry.get(call.name);
      if (!tool) {
        return { allowed: false, reason: "Unknown tool" };
      }

      const check = permissionManager.check(call.name, tool.permissionLevel, call.arguments);
      if (check.allowed) {
        return { allowed: true };
      }

      if (check.requiresPrompt) {
        return new Promise<PermissionResult>((resolve) => {
          setPendingPermission({ call, resolve });
        });
      }

      return { allowed: false, reason: check.reason ?? "Denied by mode" };
    },
    [toolRegistry, permissionManager],
  );

  return { pendingPermission, handlePermissionResponse, checkPermission } as const;
}

/**
 * usePermissionPrompt.ts — 도구 실행 권한 프롬프트를 관리하는 React 훅
 *
 * 에이전트가 도구를 실행하려 할 때, 권한 확인이 필요한 경우
 * PermissionPrompt 컴포넌트를 표시하고 사용자의 응답을 처리합니다.
 *
 * 동작 흐름:
 * 1. 에이전트 루프가 checkPermission(call) 호출
 * 2. permissionManager.check()로 자동 허용 여부 확인
 * 3. 프롬프트가 필요하면 → Promise를 생성하고 pendingPermission 상태로 UI 표시
 * 4. 사용자가 응답 → resolve()로 에이전트 루프에 결과 전달
 *
 * 사용자 응답 유형:
 * - "yes": 이번만 허용 (approve)
 * - "always": 이 세션 동안 이 도구를 항상 허용 (approveAll)
 * - "no": 거부
 */
import { useState, useCallback } from "react";
import { type PermissionResult } from "../../core/agent-loop.js";
import { type PermissionManager } from "../../permissions/manager.js";
import { type ToolRegistry } from "../../tools/registry.js";
import { type ExtractedToolCall } from "../../tools/types.js";

/**
 * 대기 중인 권한 요청 — 도구 호출 정보와 결과를 전달할 resolve 함수를 포함
 * resolve가 호출되면 에이전트 루프가 계속 진행됩니다.
 */
export interface PendingPermission {
  readonly call: ExtractedToolCall;
  readonly resolve: (result: PermissionResult) => void;
}

/**
 * 도구 권한 프롬프트 관리 훅
 *
 * @param permissionManager - 권한 정책(모드별 자동 허용 규칙 등)을 관리
 * @param toolRegistry - 도구의 permissionLevel을 조회하기 위한 레지스트리
 *
 * @returns pendingPermission: 현재 대기 중인 권한 요청 (null이면 대기 없음)
 * @returns handlePermissionResponse: 사용자 응답 처리 함수
 * @returns checkPermission: 에이전트 루프에 전달할 권한 확인 함수
 */
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

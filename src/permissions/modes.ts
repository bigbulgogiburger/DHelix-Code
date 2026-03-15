/**
 * 권한 모드 검사 — 현재 권한 모드에 따라 도구 실행 허용 여부를 결정하는 모듈
 *
 * 권한 모드는 AI가 도구를 실행할 때 사용자에게 확인을 받을지 여부를
 * 전역적으로 제어합니다. 다섯 가지 모드가 있으며, 각 모드는
 * 도구의 권한 수준(safe/confirm/dangerous)에 따라 다르게 동작합니다.
 *
 * 권한 수준 설명:
 * - safe: 읽기 전용 도구 (파일 읽기, 검색 등) — 시스템에 변경을 가하지 않음
 * - confirm: 수정 도구 (파일 편집 등) — 확인이 필요할 수 있음
 * - dangerous: 위험한 도구 (쉘 명령어 실행 등) — 대부분의 모드에서 확인 필요
 */

import { type PermissionMode, type PermissionCheckResult } from "./types.js";
import { type PermissionLevel } from "../tools/types.js";

/**
 * 현재 권한 모드와 도구의 권한 수준을 기반으로 실행 허용 여부를 결정합니다.
 *
 * 각 모드별 동작:
 * | 모드             | safe(읽기) | confirm(수정) | dangerous(위험) |
 * |------------------|-----------|--------------|----------------|
 * | bypassPermissions| 자동 허용  | 자동 허용     | 자동 허용       |
 * | dontAsk          | 자동 허용  | 자동 허용     | 자동 허용       |
 * | plan             | 자동 허용  | 차단          | 차단            |
 * | acceptEdits      | 자동 허용  | 자동 허용     | 사용자 확인     |
 * | default          | 자동 허용  | 사용자 확인   | 사용자 확인     |
 *
 * @param mode - 현재 권한 모드
 * @param permissionLevel - 도구의 권한 수준 (safe/confirm/dangerous)
 * @returns 허용 여부, 사용자 확인 필요 여부, 이유를 포함한 결과
 */
export function checkPermissionByMode(
  mode: PermissionMode,
  permissionLevel: PermissionLevel,
): PermissionCheckResult {
  switch (mode) {
    // 우회 모드: 모든 권한 검사를 건너뜀 (개발/디버깅 전용)
    case "bypassPermissions":
      return { allowed: true, requiresPrompt: false, reason: "Bypass mode" };

    // 자동 승인 모드: 모든 작업을 확인 없이 허용 (사용 시 주의 필요)
    case "dontAsk":
      return { allowed: true, requiresPrompt: false, reason: "Don't ask mode" };

    // 계획 모드: 읽기 전용 도구만 허용, 수정/실행 도구는 차단
    // 코드를 분석만 하고 변경하지 않을 때 유용
    case "plan":
      if (permissionLevel === "safe") {
        return { allowed: true, requiresPrompt: false };
      }
      return {
        allowed: false,
        requiresPrompt: false,
        reason: "Plan mode: only read-only tools allowed",
      };

    // 편집 허용 모드: 파일 수정까지 자동 허용, 위험한 명령만 사용자 확인
    // 파일 편집은 신뢰하지만 쉘 명령어는 확인받고 싶을 때 유용
    case "acceptEdits":
      if (permissionLevel === "safe" || permissionLevel === "confirm") {
        return { allowed: true, requiresPrompt: false };
      }
      // dangerous 레벨은 사용자 확인 필요
      return { allowed: false, requiresPrompt: true };

    // 기본 모드: 읽기 전용만 자동 허용, 나머지는 모두 사용자 확인
    case "default":
    default:
      if (permissionLevel === "safe") {
        return { allowed: true, requiresPrompt: false };
      }
      // confirm, dangerous 레벨은 모두 사용자 확인 필요
      return { allowed: false, requiresPrompt: true };
  }
}

/**
 * 권한 모드의 사람이 읽을 수 있는 설명을 반환합니다.
 *
 * UI에서 현재 모드를 표시할 때 사용합니다.
 *
 * @param mode - 설명을 가져올 권한 모드
 * @returns 모드에 대한 설명 문자열
 */
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

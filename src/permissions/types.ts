/**
 * 권한 시스템 타입 정의 — 권한 검사에 사용되는 모든 인터페이스와 타입
 *
 * 이 파일은 권한 시스템의 핵심 타입을 정의합니다.
 * 권한 시스템은 AI가 도구(tool)를 실행할 때 사용자에게
 * 허가를 구하는 메커니즘을 관리합니다.
 *
 * 예를 들어, AI가 파일을 수정하거나 쉘 명령어를 실행할 때
 * 사용자에게 "이 작업을 허용하시겠습니까?"라고 물어보는 것이
 * 이 권한 시스템을 통해 이루어집니다.
 */

import { type PermissionLevel } from "../tools/types.js";

/**
 * 권한 모드 — 권한 검사의 동작 방식을 결정하는 모드
 *
 * - "default": 기본 모드 — 읽기 전용은 자동 허용, 수정/실행은 사용자 확인 필요
 * - "acceptEdits": 편집 허용 모드 — 파일 수정도 자동 허용, 위험한 명령만 확인
 * - "plan": 계획 모드 — 읽기 전용 도구만 허용 (수정 불가)
 * - "dontAsk": 자동 승인 모드 — 모든 작업을 확인 없이 허용 (주의 필요)
 * - "bypassPermissions": 우회 모드 — 모든 권한 검사를 건너뜀 (개발/테스트용)
 */
export type PermissionMode = "default" | "acceptEdits" | "plan" | "dontAsk" | "bypassPermissions";

/**
 * 권한 규칙 — 특정 도구 또는 패턴에 대한 허용/거부 규칙
 *
 * @property toolName - 대상 도구 이름 (와일드카드 * 사용 가능)
 * @property pattern - 선택적 인수 패턴 (예: "npm *"는 npm으로 시작하는 명령만 매칭)
 * @property allowed - true이면 허용, false이면 거부
 */
export interface PermissionRule {
  readonly toolName: string;
  readonly pattern?: string;
  readonly allowed: boolean;
}

/**
 * 권한 검사 결과 — check() 메서드의 반환값
 *
 * @property allowed - 작업이 허용되었는지 여부
 * @property reason - 허용/거부의 이유 (로깅 및 UI 표시용)
 * @property requiresPrompt - 사용자에게 직접 확인을 받아야 하는지 여부
 *   true인 경우 UI에서 "허용/거부" 프롬프트를 표시해야 함
 */
export interface PermissionCheckResult {
  readonly allowed: boolean;
  readonly reason?: string;
  readonly requiresPrompt: boolean;
}

/**
 * 권한 요청 — 사용자에게 표시할 권한 확인 정보
 *
 * UI 컴포넌트가 사용자에게 "이 도구를 실행해도 될까요?"를
 * 보여줄 때 이 인터페이스의 정보를 사용합니다.
 *
 * @property toolName - 실행하려는 도구의 이름
 * @property toolDescription - 도구의 설명 (사용자에게 표시)
 * @property permissionLevel - 도구의 권한 수준 (safe/confirm/dangerous)
 * @property args - 도구에 전달될 인수 (사용자가 무엇이 실행되는지 확인 가능)
 */
export interface PermissionRequest {
  readonly toolName: string;
  readonly toolDescription: string;
  readonly permissionLevel: PermissionLevel;
  readonly args: Readonly<Record<string, unknown>>;
}

/**
 * 영구 권한 규칙 — 세션 간에 유지되는 권한 규칙 (settings.json에 저장)
 *
 * 사용자가 "항상 허용" 또는 "항상 거부"를 선택하면
 * 이 형태로 settings.json 파일에 저장됩니다.
 *
 * @property tool - 대상 도구 이름
 * @property pattern - 선택적 인수 패턴
 * @property type - "allow"(항상 허용) 또는 "deny"(항상 거부)
 * @property scope - "project"(프로젝트 단위) 또는 "user"(사용자 전체)
 */
export interface PersistentPermissionRule {
  readonly tool: string;
  readonly pattern?: string;
  readonly type: "allow" | "deny";
  readonly scope: "project" | "user";
}

/**
 * 영구 규칙 검사 결과 — 영구 규칙 매칭 여부
 *
 * - "allow": 영구 허용 규칙에 매칭됨
 * - "deny": 영구 거부 규칙에 매칭됨
 * - "none": 매칭되는 영구 규칙 없음 (다음 검사 단계로 진행)
 */
export type PersistentCheckResult = "allow" | "deny" | "none";

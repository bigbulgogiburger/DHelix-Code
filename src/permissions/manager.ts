/**
 * 권한 관리자 — 모든 권한 검사 로직을 통합하는 중앙 관리 모듈
 *
 * 이 클래스는 권한 시스템의 핵심 오케스트레이터(orchestrator)입니다.
 * 여러 권한 소스(모드, 규칙, 세션 승인, 영구 규칙)를 조율하여
 * 도구 실행의 허용/거부를 최종 결정합니다.
 *
 * 권한 검사 우선순위 (deny가 항상 우선):
 * 1. 영구 deny 규칙 — settings.json의 deny 목록에 매칭 → 즉시 거부
 * 2. 세션 승인 — 이번 세션에서 이미 승인된 도구 → 자동 허용
 * 3. 영구 allow 규칙 — settings.json의 allow 목록에 매칭 → 자동 허용
 * 4. 명시적 규칙 — 코드에서 등록된 규칙에 매칭 → 규칙에 따라 허용/거부
 * 5. 모드 기반 검사 — 현재 모드(default/acceptEdits/plan 등)에 따라 결정
 *
 * 이 설계는 "기본 거부(deny-by-default)" 원칙을 따릅니다:
 * 어떤 규칙에도 매칭되지 않으면 사용자에게 직접 확인을 요청합니다.
 */

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
 * 파싱된 영구 규칙 — 원본 문자열과 파싱된 패턴을 함께 보관
 *
 * @property raw - 원본 규칙 문자열 (예: "Bash(npm *)")
 * @property parsed - 파싱된 패턴 객체 (toolName + argPattern)
 */
interface PersistentRule {
  readonly raw: string;
  readonly parsed: ParsedPermissionPattern;
}

/**
 * 규칙 문자열 배열을 파싱된 PersistentRule 배열로 변환합니다.
 *
 * 파싱에 실패한 패턴은 조용히 건너뛰는 우아한 성능 저하(graceful degradation)
 * 방식을 사용합니다. 잘못된 패턴 하나 때문에 전체 시스템이 중단되지 않습니다.
 *
 * @param rawPatterns - 파싱할 규칙 문자열 배열
 * @returns 파싱 성공한 규칙 배열 (불변)
 */
function parsePersistentRules(rawPatterns: readonly string[]): readonly PersistentRule[] {
  const results: PersistentRule[] = [];
  for (const raw of rawPatterns) {
    try {
      const parsed = parsePermissionPattern(raw);
      results.push({ raw, parsed });
    } catch {
      // 잘못된 패턴은 건너뜀 — 우아한 성능 저하
    }
  }
  return Object.freeze(results);
}

/**
 * PersistentPermissionRule 배열을 내부 PersistentRule 형식으로 변환합니다.
 *
 * 규칙 타입(allow/deny)으로 필터링한 후, 규칙 문자열로 변환하고,
 * parsePersistentRules를 통해 파싱합니다.
 *
 * @param rules - 변환할 영구 규칙 배열
 * @param type - 필터링할 규칙 타입 ("allow" 또는 "deny")
 * @returns 파싱된 규칙 배열
 */
function toPersistentRules(
  rules: readonly PersistentPermissionRule[],
  type: "allow" | "deny",
): readonly PersistentRule[] {
  // 지정된 타입의 규칙만 필터링
  const filtered = rules.filter((r) => r.type === type);
  // 구조체를 규칙 문자열로 변환 (예: { tool: "Bash", pattern: "npm *" } → "Bash(npm *)")
  const rawPatterns = filtered.map((r) => {
    if (r.pattern) {
      return `${r.tool}(${r.pattern})`;
    }
    return r.tool;
  });
  return parsePersistentRules(rawPatterns);
}

/**
 * 권한 관리자 클래스 — 도구 실행의 허용/거부를 최종 결정합니다.
 *
 * 모드, 규칙, 세션 승인, 영구 규칙을 조합하여 계층적 권한 검사를 수행합니다.
 * 감사 로그를 통해 모든 권한 결정을 기록합니다.
 */
export class PermissionManager {
  /** 현재 권한 모드 (default, acceptEdits, plan, dontAsk, bypassPermissions) */
  private mode: PermissionMode;

  /** 코드에서 등록된 명시적 권한 규칙 목록 */
  private readonly rules: PermissionRule[];

  /** 세션 범위의 승인 캐시 */
  private readonly sessionStore: SessionApprovalStore;

  /** 파싱된 영구 허용 규칙 목록 (빠른 매칭용) */
  private persistentAllowRules: readonly PersistentRule[];

  /** 파싱된 영구 거부 규칙 목록 (빠른 매칭용) */
  private persistentDenyRules: readonly PersistentRule[];

  /** 원본 영구 규칙 목록 (외부 조회용) */
  private persistentRulesList: readonly PersistentPermissionRule[];

  /** 감사 로거 (없으면 null — 로깅 비활성화) */
  private readonly auditLogger: AuditLogger | null;

  /** 현재 세션의 고유 ID (감사 로그에서 세션별 그룹핑에 사용) */
  private sessionId: string;

  /**
   * 권한 관리자를 생성합니다.
   *
   * @param mode - 초기 권한 모드 (기본값: "default")
   * @param rules - 초기 명시적 규칙 배열
   * @param persistentRules - 초기 영구 규칙 (allow/deny 문자열 배열)
   * @param options - 추가 옵션 (감사 로그 경로, 세션 ID)
   */
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
    this.rules = [...rules]; // 방어적 복사 — 외부 배열 변경이 내부에 영향 없도록
    this.sessionStore = new SessionApprovalStore();
    this.persistentAllowRules = parsePersistentRules(persistentRules?.allow ?? []);
    this.persistentDenyRules = parsePersistentRules(persistentRules?.deny ?? []);
    this.persistentRulesList = [];
    this.auditLogger = options?.auditLogPath ? new AuditLogger(options.auditLogPath) : null;
    this.sessionId = options?.sessionId ?? "unknown";
  }

  /**
   * 현재 권한 모드를 반환합니다.
   * @returns 현재 권한 모드
   */
  getMode(): PermissionMode {
    return this.mode;
  }

  /**
   * 권한 모드를 변경합니다.
   *
   * 모드 변경은 이후의 모든 권한 검사에 즉시 반영됩니다.
   *
   * @param mode - 새로운 권한 모드
   */
  setMode(mode: PermissionMode): void {
    this.mode = mode;
  }

  /**
   * 디스크에서 로드한 영구 규칙을 설정합니다.
   *
   * PersistentPermissionStore에서 로드한 규칙을 파싱하여
   * 빠른 매칭을 위한 내부 구조로 변환합니다.
   *
   * @param rules - 설정할 영구 규칙 배열
   */
  setPersistentRules(rules: readonly PersistentPermissionRule[]): void {
    this.persistentRulesList = [...rules];
    // allow와 deny를 분리하여 파싱 (검사 시 deny를 먼저 확인하기 위해)
    this.persistentAllowRules = toPersistentRules(rules, "allow");
    this.persistentDenyRules = toPersistentRules(rules, "deny");
  }

  /**
   * 현재 설정된 영구 규칙 목록을 반환합니다.
   * @returns 영구 규칙 배열
   */
  getPersistentRules(): readonly PersistentPermissionRule[] {
    return this.persistentRulesList;
  }

  /**
   * 도구 실행의 허용 여부를 검사합니다 — 권한 시스템의 핵심 메서드
   *
   * 다섯 단계의 계층적 검사를 수행합니다:
   *
   * 1. 영구 deny 규칙 검사 → 매칭되면 즉시 거부
   *    (deny는 항상 최우선 — 안전 제일 원칙)
   *
   * 2. 세션 승인 확인 → 이번 세션에서 이미 승인한 도구면 자동 허용
   *    (반복적인 확인 요청을 줄여 사용자 경험 향상)
   *
   * 3. 영구 allow 규칙 검사 → 매칭되면 자동 허용
   *    (사용자가 "항상 허용"으로 설정한 도구)
   *
   * 4. 명시적 규칙 검사 → 매칭되면 규칙에 따라 허용/거부
   *    (코드에서 프로그래밍적으로 등록한 규칙)
   *
   * 5. 모드 기반 검사 → 현재 모드와 도구 권한 수준에 따라 결정
   *    (최종 폴백 — 위의 규칙에 매칭되지 않은 경우)
   *
   * @param toolName - 실행하려는 도구 이름
   * @param permissionLevel - 도구의 권한 수준 (safe/confirm/dangerous)
   * @param args - 도구에 전달될 인수 (선택적)
   * @returns 허용 여부, 프롬프트 필요 여부, 이유를 포함한 결과
   */
  check(
    toolName: string,
    permissionLevel: PermissionLevel,
    args?: Readonly<Record<string, unknown>>,
  ): PermissionCheckResult {
    // 1단계: 영구 deny 규칙 — deny는 항상 최우선
    if (this.matchesPersistent(this.persistentDenyRules, toolName, args)) {
      this.logAudit(toolName, "denied", "Persistent deny rule");
      return {
        allowed: false,
        requiresPrompt: false,
        reason: "Persistent deny rule",
      };
    }

    // 2단계: 세션 승인 확인 — 이미 승인된 도구는 다시 묻지 않음
    if (this.sessionStore.isApproved(toolName, args)) {
      this.logAudit(toolName, "auto-approved", "Session approved");
      return { allowed: true, requiresPrompt: false, reason: "Session approved" };
    }

    // 3단계: 영구 allow 규칙 — "항상 허용"으로 설정된 도구
    if (this.matchesPersistent(this.persistentAllowRules, toolName, args)) {
      this.logAudit(toolName, "auto-approved", "Persistent allow rule");
      return {
        allowed: true,
        requiresPrompt: false,
        reason: "Persistent allow rule",
      };
    }

    // 4단계: 명시적 규칙 — 코드에서 등록된 규칙
    const matchedRule = findMatchingRule(this.rules, toolName, args);
    if (matchedRule) {
      this.logAudit(
        toolName,
        matchedRule.allowed ? "auto-approved" : "denied",
        matchedRule.allowed ? "Rule: allowed" : "Rule: denied",
      );
      return {
        allowed: matchedRule.allowed,
        requiresPrompt: false,
        reason: matchedRule.allowed ? "Rule: allowed" : "Rule: denied",
      };
    }

    // 5단계: 모드 기반 검사 — 최종 폴백
    return checkPermissionByMode(this.mode, permissionLevel);
  }

  /**
   * 사용자가 도구 실행을 승인했음을 기록합니다.
   *
   * 이번 세션 동안 동일한 도구+인수 조합에 대해 다시 묻지 않습니다.
   *
   * @param toolName - 승인된 도구 이름
   * @param args - 승인된 인수 (선택적)
   */
  approve(toolName: string, args?: Readonly<Record<string, unknown>>): void {
    this.sessionStore.approve(toolName, args);
  }

  /**
   * 도구의 모든 향후 호출을 이번 세션에서 승인합니다.
   *
   * @param toolName - 전체 승인할 도구 이름
   */
  approveAll(toolName: string): void {
    this.sessionStore.approveAll(toolName);
  }

  /**
   * "항상 허용" 영구 규칙을 추가합니다.
   *
   * 메모리 내 규칙 목록에 추가합니다. 디스크에 영속화하려면
   * 호출자가 PersistentPermissionStore를 통해 별도로 저장해야 합니다.
   *
   * @param toolName - 항상 허용할 도구 이름
   * @param pattern - 인수 패턴 (선택적, 예: "npm *")
   * @param scope - 저장 범위 (기본값: "project")
   */
  approveAlways(toolName: string, pattern?: string, scope: "project" | "user" = "project"): void {
    const newRule: PersistentPermissionRule = {
      tool: toolName,
      ...(pattern !== undefined ? { pattern } : {}),
      type: "allow",
      scope,
    };
    // 기존 규칙에 새 규칙을 추가하고 전체 재파싱
    this.setPersistentRules([...this.persistentRulesList, newRule]);
  }

  /**
   * 명시적 권한 규칙을 추가합니다.
   *
   * @param rule - 추가할 권한 규칙
   */
  addRule(rule: PermissionRule): void {
    this.rules.push(rule);
  }

  /**
   * 세션 승인 캐시를 초기화합니다.
   *
   * 이전에 승인된 모든 세션 승인이 취소됩니다.
   * 모드 전환이나 보안 재설정 시 사용합니다.
   */
  clearSession(): void {
    this.sessionStore.clear();
  }

  /**
   * 권한 결정을 감사 로그에 기록합니다.
   *
   * fire-and-forget(발사 후 잊기) 패턴을 사용합니다:
   * - 비동기적으로 로그를 기록하지만 완료를 기다리지 않음
   * - 로그 기록 실패가 권한 검사에 영향을 주지 않음
   * - .catch()로 에러를 조용히 삼킴 (로그 실패로 전체 기능이 중단되면 안 됨)
   *
   * @param toolName - 도구 이름
   * @param decision - 권한 결정 (approved/denied/auto-approved)
   * @param reason - 결정 이유
   */
  private logAudit(
    toolName: string,
    decision: "approved" | "denied" | "auto-approved",
    reason?: string,
  ): void {
    this.auditLogger
      ?.log({
        timestamp: new Date().toISOString(),
        sessionId: this.sessionId,
        toolName,
        decision,
        reason,
      })
      .catch(() => {
        /* 감사 로그 에러를 조용히 삼킴 */
      });
  }

  /**
   * 영구 규칙 목록에서 도구 호출과 매칭되는 규칙이 있는지 확인합니다.
   *
   * @param rules - 검사할 파싱된 규칙 목록 (allow 또는 deny)
   * @param toolName - 도구 이름
   * @param args - 도구 인수 (선택적)
   * @returns 매칭되는 규칙이 있으면 true
   */
  private matchesPersistent(
    rules: readonly PersistentRule[],
    toolName: string,
    args?: Readonly<Record<string, unknown>>,
  ): boolean {
    // .some() : 하나라도 매칭되면 true (단락 평가로 불필요한 매칭 건너뜀)
    return rules.some((rule) => matchesPermissionPattern(rule.parsed, toolName, args));
  }
}

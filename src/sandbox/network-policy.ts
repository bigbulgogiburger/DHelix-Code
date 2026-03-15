/**
 * 네트워크 정책 — 샌드박스 프로세스의 네트워크 접근을 제어하는 규칙 엔진
 *
 * 허용 목록(allowlist)과 차단 목록(denylist)을 기반으로
 * 특정 도메인/IP에 대한 네트워크 접근을 허용하거나 차단합니다.
 *
 * 평가 우선순위:
 * 1. denylist (차단 목록이 허용 목록보다 우선)
 * 2. allowlist (허용 목록에 있으면 허용)
 * 3. defaultAction (어느 목록에도 없으면 기본 동작 적용)
 *
 * 와일드카드 패턴 지원:
 * - "*.openai.com" → "api.openai.com", "beta.openai.com" 등과 매칭
 * - "*.openai.com" → "openai.com" 자체와는 매칭되지 않음
 *
 * @example
 * const policy: NetworkPolicy = {
 *   defaultAction: "deny",
 *   allowlist: ["*.openai.com", "api.anthropic.com"],
 *   denylist: ["malicious.example.com"],
 * };
 * isHostAllowed("api.openai.com", policy); // → true
 * isHostAllowed("evil.com", policy); // → false (기본 동작: deny)
 */

import { BaseError } from "../utils/error.js";

/** 네트워크 정책 적용 에러 */
export class NetworkPolicyError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "NETWORK_POLICY_ERROR", context);
  }
}

/** 샌드박스 프로세스의 네트워크 접근 정책 */
export interface NetworkPolicy {
  /** 기본 동작: allow(모두 허용) 또는 deny(모두 차단) */
  readonly defaultAction: "allow" | "deny";
  /** 명시적으로 허용할 도메인/IP 목록 (와일드카드 *.도메인 지원) */
  readonly allowlist: readonly string[];
  /** 명시적으로 차단할 도메인/IP 목록 — allowlist보다 우선순위가 높음 */
  readonly denylist: readonly string[];
}

/**
 * 기본 정책: 모든 트래픽 허용 (제한 없음).
 * 네트워크 정책이 설정되지 않은 경우 이 정책을 사용합니다.
 */
export const DEFAULT_NETWORK_POLICY: NetworkPolicy = {
  defaultAction: "allow",
  allowlist: [],
  denylist: [],
};

/**
 * 호스트 이름이 패턴과 일치하는지 확인합니다.
 *
 * 매칭 규칙:
 * - 정확한 일치: "api.openai.com" === "api.openai.com"
 * - 와일드카드 접두사: "*.openai.com" → "api.openai.com"과 일치
 * - "*.openai.com"은 "openai.com" 자체와는 불일치 (서브도메인 필수)
 *
 * @param host - 확인할 호스트 이름
 * @param pattern - 매칭 패턴 (정확한 이름 또는 *.도메인)
 * @returns 일치하면 true
 */
function matchesPattern(host: string, pattern: string): boolean {
  const normalizedHost = host.toLowerCase();
  const normalizedPattern = pattern.toLowerCase();

  // 와일드카드 패턴: *.도메인 형식
  if (normalizedPattern.startsWith("*.")) {
    const suffix = normalizedPattern.slice(1); // 예: ".openai.com"
    // 서브도메인이 있어야 매칭 (openai.com 자체는 매칭 안 됨)
    return normalizedHost.endsWith(suffix) && normalizedHost !== suffix.slice(1);
  }

  // 정확한 일치 (대소문자 무시)
  return normalizedHost === normalizedPattern;
}

/**
 * 호스트 이름이 패턴 목록 중 하나라도 일치하는지 확인합니다.
 *
 * @param host - 확인할 호스트 이름
 * @param patterns - 매칭할 패턴 목록
 * @returns 하나라도 일치하면 true
 */
function matchesAny(host: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => matchesPattern(host, pattern));
}

/**
 * 도메인/호스트가 네트워크 정책에 의해 허용되는지 확인합니다.
 *
 * 평가 순서:
 * 1. denylist — 차단 목록에 있으면 무조건 거부 (최우선)
 * 2. allowlist — 허용 목록에 있으면 허용
 * 3. defaultAction — 어느 목록에도 없으면 기본 동작 적용
 *
 * @param host - 확인할 호스트 이름 (예: "api.openai.com")
 * @param policy - 적용할 네트워크 정책
 * @returns 허용되면 true, 차단이면 false
 *
 * @example
 * isHostAllowed("api.openai.com", { defaultAction: "deny", allowlist: ["*.openai.com"], denylist: [] });
 * // → true (allowlist에 매칭)
 */
export function isHostAllowed(host: string, policy: NetworkPolicy): boolean {
  // 빈 호스트는 절대 허용하지 않음
  if (!host) {
    return false;
  }

  // 1단계: denylist 확인 (최우선 — allowlist보다 높은 우선순위)
  if (matchesAny(host, policy.denylist)) {
    return false;
  }

  // 2단계: allowlist 확인
  if (matchesAny(host, policy.allowlist)) {
    return true;
  }

  // 3단계: 어느 목록에도 없으면 기본 동작 적용
  return policy.defaultAction === "allow";
}

/**
 * 알 수 없는(unknown) 설정 값에서 NetworkPolicy를 파싱합니다.
 * 유효하지 않은 입력에 대해서는 DEFAULT_NETWORK_POLICY를 반환합니다.
 *
 * @param config - 파싱할 설정 값 (JSON 파싱 결과 등)
 * @returns 파싱된 NetworkPolicy (불변 객체)
 */
export function parseNetworkPolicy(config: unknown): NetworkPolicy {
  // null, undefined, 비객체는 기본 정책 반환
  if (config === null || config === undefined || typeof config !== "object") {
    return DEFAULT_NETWORK_POLICY;
  }

  const obj = config as Record<string, unknown>;

  // defaultAction: "allow" 또는 "deny"만 허용
  const defaultAction =
    obj.defaultAction === "allow" || obj.defaultAction === "deny"
      ? obj.defaultAction
      : DEFAULT_NETWORK_POLICY.defaultAction;

  // allowlist/denylist: 문자열 배열만 추출 (비문자열 항목은 필터링)
  const allowlist = Array.isArray(obj.allowlist)
    ? obj.allowlist.filter((item): item is string => typeof item === "string")
    : [];

  const denylist = Array.isArray(obj.denylist)
    ? obj.denylist.filter((item): item is string => typeof item === "string")
    : [];

  // Object.freeze로 불변 객체로 만들어 반환
  return Object.freeze({
    defaultAction,
    allowlist: Object.freeze([...allowlist]),
    denylist: Object.freeze([...denylist]),
  });
}

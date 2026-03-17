/**
 * 권한 규칙 매칭 — 도구 호출이 권한 규칙에 매칭되는지 검사하는 모듈
 *
 * 권한 규칙은 특정 도구의 특정 사용 패턴에 대해 허용/거부를 미리
 * 설정할 수 있는 기능입니다. 예를 들어:
 * - "file_read" → 파일 읽기 도구는 항상 허용
 * - "Bash(npm *)" → npm으로 시작하는 bash 명령만 허용
 *
 * 이 모듈은 도구 호출이 설정된 규칙과 매칭되는지 확인합니다.
 */

import { type PermissionRule } from "./types.js";

/**
 * 값이 glob 스타일 패턴과 매칭되는지 검사합니다.
 *
 * glob 패턴이란 파일 시스템에서 널리 사용되는 와일드카드 매칭 방식입니다:
 * - `*` : 임의의 문자열과 매칭 (0자 이상)
 * - `?` : 임의의 한 문자와 매칭
 *
 * 구현 방식: glob 패턴을 정규식(RegExp)으로 변환하여 매칭합니다.
 *
 * @param value - 검사할 문자열 (예: "npm install")
 * @param pattern - glob 패턴 (예: "npm *")
 * @returns 매칭 여부
 *
 * @example
 * ```ts
 * matchPattern("npm install", "npm *")    // true
 * matchPattern("yarn add", "npm *")       // false
 * matchPattern("file_read", "file_?ead")  // true
 * ```
 */
function matchPattern(value: string, pattern: string): boolean {
  // 정규식 특수 문자를 이스케이프 (*, ? 제외)
  // [.+^${}()|[\]\\] : 정규식에서 특별한 의미를 가지는 문자들
  const regex = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*") // * → .* (임의의 문자열)
    .replace(/\?/g, "."); // ? → . (임의의 한 문자)
  // ^...$: 전체 문자열이 패턴과 완전히 일치해야 함 (부분 매칭 방지)
  return new RegExp(`^${regex}$`).test(value);
}

/**
 * 도구 호출이 권한 규칙 목록 중 하나와 매칭되는지 검사합니다.
 *
 * 규칙 목록을 순서대로 순회하며, 첫 번째로 매칭되는 규칙을 반환합니다.
 * 매칭 방식:
 * 1. 도구 이름이 규칙의 toolName 패턴과 매칭되는지 확인
 * 2. 규칙에 pattern이 있으면, 도구의 문자열 인수 중 하나가 패턴과 매칭되는지 확인
 *
 * @param rules - 검사할 권한 규칙 배열 (순서대로 검사, 첫 매칭 반환)
 * @param toolName - 실행하려는 도구의 이름
 * @param args - 도구에 전달될 인수 객체 (선택적)
 * @returns 매칭된 규칙, 없으면 undefined
 *
 * @example
 * ```ts
 * const rules = [{ toolName: "Bash", pattern: "npm *", allowed: true }];
 * const match = findMatchingRule(rules, "Bash", { command: "npm install" });
 * // match?.allowed === true
 * ```
 */
export function findMatchingRule(
  rules: readonly PermissionRule[],
  toolName: string,
  args?: Readonly<Record<string, unknown>>,
): PermissionRule | undefined {
  for (const rule of rules) {
    // 1단계: 도구 이름이 규칙의 패턴과 매칭되는지 확인
    if (matchPattern(toolName, rule.toolName)) {
      if (rule.pattern && args) {
        // 2단계: 규칙에 인수 패턴이 있는 경우
        // 도구 인수 중 문자열 값만 추출하여 패턴 매칭
        const argValues = Object.values(args).filter((v): v is string => typeof v === "string");
        if (argValues.some((v) => matchPattern(v, rule.pattern!))) {
          return rule;
        }
      } else {
        // 인수 패턴이 없으면 도구 이름만으로 매칭 완료
        return rule;
      }
    }
  }
  // 매칭되는 규칙이 없음
  return undefined;
}

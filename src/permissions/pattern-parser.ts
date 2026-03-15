/**
 * 권한 패턴 파서 — 권한 패턴 문자열을 파싱하고 매칭하는 모듈
 *
 * 권한 패턴은 "도구이름" 또는 "도구이름(인수패턴)" 형식의 문자열입니다.
 * 이 모듈은 이러한 문자열을 구조화된 객체로 파싱하고,
 * 실제 도구 호출과 비교하는 기능을 제공합니다.
 *
 * 패턴 형식 예시:
 * - "Bash"           → Bash 도구의 모든 호출에 매칭
 * - "Bash(npm *)"    → Bash 도구에서 "npm"으로 시작하는 명령만 매칭
 * - "Edit(/src/**)"  → Edit 도구에서 /src/ 하위 경로만 매칭
 * - "file_read"      → file_read 도구의 모든 호출에 매칭
 */

import { BaseError } from "../utils/error.js";

/**
 * 패턴 파싱 에러 — 권한 패턴 문자열이 잘못된 형식일 때 발생하는 에러
 *
 * 예: 빈 문자열, 닫는 괄호 누락, 빈 도구 이름 등
 */
export class PatternParseError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "PATTERN_PARSE_ERROR", context);
  }
}

/**
 * 파싱된 권한 패턴 인터페이스
 *
 * @property toolName - 도구 이름 (예: "Bash", "Edit", "file_read")
 * @property argPattern - 인수 매칭 패턴 (예: "npm *", "/src/**"), 없으면 undefined
 */
export interface ParsedPermissionPattern {
  readonly toolName: string;
  readonly argPattern: string | undefined;
}

/**
 * 권한 패턴 문자열을 구조화된 객체로 파싱합니다.
 *
 * 입력 형식:
 * - "도구이름"           → 도구의 모든 호출에 매칭
 * - "도구이름(인수패턴)" → 특정 인수 패턴에만 매칭
 *
 * @param raw - 파싱할 권한 패턴 문자열
 * @returns 파싱된 패턴 객체 (toolName + argPattern)
 * @throws PatternParseError - 패턴 형식이 잘못된 경우
 *
 * @example
 * ```ts
 * parsePermissionPattern("Bash")          // { toolName: "Bash", argPattern: undefined }
 * parsePermissionPattern("Bash(npm *)")   // { toolName: "Bash", argPattern: "npm *" }
 * parsePermissionPattern("Edit(/src/**)") // { toolName: "Edit", argPattern: "/src/**" }
 * ```
 */
export function parsePermissionPattern(raw: string): ParsedPermissionPattern {
  const trimmed = raw.trim();

  // 빈 문자열 검증
  if (trimmed.length === 0) {
    throw new PatternParseError("Empty permission pattern", { raw });
  }

  // 여는 괄호 위치 탐색
  const parenOpen = trimmed.indexOf("(");

  // 괄호가 없는 경우 — 도구 이름만 있는 패턴
  if (parenOpen === -1) {
    // 닫는 괄호만 있는 경우는 잘못된 형식
    if (trimmed.includes(")")) {
      throw new PatternParseError("Unmatched closing parenthesis in pattern", { raw });
    }
    return { toolName: trimmed, argPattern: undefined };
  }

  // 여는 괄호가 있으면 반드시 닫는 괄호로 끝나야 함
  if (!trimmed.endsWith(")")) {
    throw new PatternParseError("Pattern has opening parenthesis but no closing parenthesis", {
      raw,
    });
  }

  // 도구 이름 추출 (괄호 앞 부분)
  const toolName = trimmed.slice(0, parenOpen).trim();
  if (toolName.length === 0) {
    throw new PatternParseError("Empty tool name in pattern", { raw });
  }

  // 인수 패턴 추출 (괄호 안쪽 부분)
  const argPattern = trimmed.slice(parenOpen + 1, -1).trim();
  if (argPattern.length === 0) {
    throw new PatternParseError("Empty argument pattern in parentheses", { raw });
  }

  return { toolName, argPattern };
}

/**
 * glob 패턴을 정규식(RegExp)으로 변환합니다.
 *
 * rules.ts의 matchPattern과 동일한 동작:
 * - `*` → `.*` (임의의 문자열, 경로 구분자 포함)
 * - `?` → `.` (임의의 한 문자)
 * - 전체 문자열 매칭 (^...$로 앵커링)
 *
 * @param pattern - 변환할 glob 패턴
 * @returns 컴파일된 정규식 객체
 */
function globToRegex(pattern: string): RegExp {
  // 정규식 특수 문자를 이스케이프 (* 와 ? 제외)
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`);
}

/**
 * 도구 호출이 파싱된 권한 패턴과 매칭되는지 검사합니다.
 *
 * 매칭 단계:
 * 1. 도구 이름이 패턴의 toolName과 glob 매칭되는지 확인
 * 2. argPattern이 없으면 도구의 모든 호출에 매칭
 * 3. argPattern이 있으면 도구 인수의 문자열 값 중 하나가 매칭되는지 확인
 *
 * @param pattern - 파싱된 권한 패턴
 * @param toolName - 실행하려는 도구의 이름
 * @param args - 도구에 전달될 인수 객체 (선택적)
 * @returns 패턴과 매칭되면 true
 *
 * @example
 * ```ts
 * const pattern = parsePermissionPattern("Bash(npm *)");
 * matchesPermissionPattern(pattern, "Bash", { command: "npm install" }); // true
 * matchesPermissionPattern(pattern, "Bash", { command: "git push" });   // false
 * ```
 */
export function matchesPermissionPattern(
  pattern: ParsedPermissionPattern,
  toolName: string,
  args?: Readonly<Record<string, unknown>>,
): boolean {
  // 1단계: 도구 이름 매칭 (glob 패턴)
  if (!globToRegex(pattern.toolName).test(toolName)) {
    return false;
  }

  // 2단계: argPattern이 없으면 도구의 모든 호출에 매칭
  if (pattern.argPattern === undefined) {
    return true;
  }

  // 3단계: argPattern이 있지만 인수가 없으면 매칭 실패
  if (!args) {
    return false;
  }

  // 4단계: 인수의 문자열 값 중 하나라도 argPattern과 매칭되면 성공
  const argRegex = globToRegex(pattern.argPattern);
  const stringValues = Object.values(args).filter((v): v is string => typeof v === "string");

  return stringValues.some((v) => argRegex.test(v));
}

/**
 * 와일드카드 매칭 — 권한 규칙의 패턴을 와일드카드로 매칭하는 유틸리티 모듈
 *
 * 이 모듈은 권한 시스템에서 사용하는 와일드카드 패턴 매칭 기능을 제공합니다.
 * 파일 시스템의 glob 패턴과 유사한 문법을 지원합니다:
 * - `*`  : 경로 구분자를 제외한 임의의 문자열 (하나의 디렉토리 레벨 내에서)
 * - `**` : 경로 구분자를 포함한 임의의 문자열 (여러 디렉토리 레벨 횡단)
 * - `?`  : 경로 구분자를 제외한 임의의 한 문자
 *
 * 또한 권한 규칙 문자열의 파싱/포맷팅과 도구별 인수 매칭 기능도 포함합니다.
 */

import { isWindows } from "../utils/platform.js";

/**
 * 값이 와일드카드 패턴과 매칭되는지 검사합니다.
 *
 * pattern-parser.ts의 globToRegex와 차이점:
 * - `*`는 경로 구분자(/ 또는 \)를 넘지 않음 → 하나의 디렉토리 레벨 내에서만 매칭
 * - `**`는 경로 구분자를 포함하여 모든 문자와 매칭 → 깊은 하위 경로도 매칭
 * - `?`는 경로 구분자를 제외한 한 문자와 매칭
 * - Windows에서는 대소문자를 구분하지 않음
 *
 * @param value - 검사할 문자열
 * @param pattern - 와일드카드 패턴
 * @returns 매칭 여부
 *
 * @example
 * ```ts
 * matchWildcard("src/utils/path.ts", "src/*")          // false (* 는 / 를 넘지 않음)
 * matchWildcard("src/utils/path.ts", "src/**")         // true  (** 는 / 를 넘음)
 * matchWildcard("npm install", "npm *")                // true
 * matchWildcard("npm install express", "npm ?nstall *") // true
 * ```
 */
export function matchWildcard(value: string, pattern: string): boolean {
  // Windows에서는 대소문자 구분 없이 매칭 (NTFS 파일 시스템이 대소문자 무시)
  const flags = isWindows() ? "i" : "";

  // 정규식 특수 문자를 이스케이프 (* 와 ? 제외)
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");

  // ** 를 먼저 임시 토큰으로 치환 (단일 *와 구분하기 위해)
  // ** → 경로 구분자를 포함한 모든 문자와 매칭 (.*)
  const withDoubleStar = escaped.replace(/\*\*/g, "\0DOUBLESTAR\0");

  // 남은 단일 * 를 경로 구분자를 제외한 문자열 매칭으로 변환
  // [^/\\]* : 슬래시(/)와 백슬래시(\)를 제외한 0개 이상의 문자
  const withSingleStar = withDoubleStar.replace(/\*/g, "[^/\\\\]*");

  // 임시 토큰을 .* (모든 문자)로 복원
  const withBothStars = withSingleStar.replace(/\0DOUBLESTAR\0/g, ".*");

  // ? 를 경로 구분자를 제외한 한 문자 매칭으로 변환
  // [^/\\] : 슬래시와 백슬래시를 제외한 한 문자
  const final = withBothStars.replace(/\?/g, "[^/\\\\]");

  // ^...$: 전체 문자열이 패턴과 완전히 일치해야 함
  const regex = new RegExp(`^${final}$`, flags);
  return regex.test(value);
}

/**
 * 규칙 문자열을 파싱하여 도구 이름과 패턴을 분리합니다.
 *
 * 규칙 문자열 형식:
 * - "file_read"       → 패턴 없이 도구 이름만
 * - "Bash(npm *)"     → 도구 이름 + 인수 패턴
 * - "Edit(/src/**)"   → 도구 이름 + 경로 패턴
 *
 * @param rule - 파싱할 규칙 문자열
 * @returns { tool: 도구이름, pattern: 인수패턴 또는 undefined }
 *
 * @example
 * ```ts
 * parseRuleString("Bash(npm *)") // { tool: "Bash", pattern: "npm *" }
 * parseRuleString("file_read")   // { tool: "file_read", pattern: undefined }
 * ```
 */
export function parseRuleString(rule: string): {
  readonly tool: string;
  readonly pattern: string | undefined;
} {
  // 정규식: "도구이름(패턴)" 형태를 매칭
  // ^([^(]+) : 여는 괄호 전까지의 모든 문자 (도구 이름)
  // \((.+)\)$ : 괄호 안의 내용 (인수 패턴)
  const match = rule.match(/^([^(]+)\((.+)\)$/);
  if (match) {
    return Object.freeze({
      tool: match[1].trim(),
      pattern: match[2].trim(),
    });
  }
  // 괄호가 없으면 도구 이름만 반환
  return Object.freeze({
    tool: rule.trim(),
    pattern: undefined,
  });
}

/**
 * 도구 이름과 패턴을 규칙 문자열로 포맷팅합니다.
 *
 * parseRuleString의 역변환입니다.
 *
 * @param tool - 도구 이름
 * @param pattern - 인수 패턴 (선택적)
 * @returns 포맷팅된 규칙 문자열
 *
 * @example
 * ```ts
 * formatRuleString("Bash", "npm *")  // "Bash(npm *)"
 * formatRuleString("file_read")       // "file_read"
 * ```
 */
export function formatRuleString(tool: string, pattern?: string): string {
  if (pattern !== undefined && pattern !== "") {
    return `${tool}(${pattern})`;
  }
  return tool;
}

/**
 * 도구별 인수 키 매핑 — 각 도구에서 패턴 매칭에 사용할 인수 필드를 지정
 *
 * 예를 들어, Bash 도구의 패턴은 "command" 인수와 비교하고,
 * Edit 도구의 패턴은 "file_path" 인수와 비교합니다.
 *
 * 이 매핑에 없는 도구는 모든 문자열 인수에 대해 매칭을 시도합니다.
 */
const TOOL_ARG_KEYS: Readonly<Record<string, string>> = Object.freeze({
  Bash: "command",         // Bash 도구 → 실행할 명령어
  bash_exec: "command",   // bash_exec 도구 → 실행할 명령어
  Edit: "file_path",      // Edit 도구 → 편집할 파일 경로
  file_edit: "file_path", // file_edit 도구 → 편집할 파일 경로
  Write: "file_path",     // Write 도구 → 쓸 파일 경로
  file_write: "file_path",// file_write 도구 → 쓸 파일 경로
  Read: "file_path",      // Read 도구 → 읽을 파일 경로
  file_read: "file_path", // file_read 도구 → 읽을 파일 경로
  glob_search: "pattern", // glob_search 도구 → 검색 패턴
  grep_search: "pattern", // grep_search 도구 → 검색 패턴
});

/**
 * 도구 호출의 인수가 와일드카드 패턴과 매칭되는지 검사합니다.
 *
 * 도구별로 어떤 인수를 패턴과 비교할지 TOOL_ARG_KEYS에서 결정합니다.
 * 예를 들어:
 * - Bash 도구의 경우 "command" 인수를 패턴과 비교
 * - Edit 도구의 경우 "file_path" 인수를 패턴과 비교
 *
 * 매핑에 없는 도구는 모든 문자열 인수에 대해 매칭을 시도합니다 (폴백).
 *
 * @param tool - 도구 이름
 * @param pattern - 매칭할 와일드카드 패턴
 * @param args - 도구에 전달된 인수 객체 (선택적)
 * @returns 인수가 패턴과 매칭되면 true
 *
 * @example
 * ```ts
 * matchToolArgs("Bash", "npm *", { command: "npm install" })   // true
 * matchToolArgs("Edit", "/src/**", { file_path: "/src/app.ts" }) // true
 * matchToolArgs("Bash", "git *", { command: "npm install" })   // false
 * ```
 */
export function matchToolArgs(
  tool: string,
  pattern: string,
  args?: Record<string, unknown>,
): boolean {
  if (!args) {
    return false;
  }

  // 도구별 매핑에서 비교할 인수 키를 찾음
  const argKey = TOOL_ARG_KEYS[tool];

  if (argKey && argKey in args) {
    const value = args[argKey];
    if (typeof value === "string") {
      return matchWildcard(value, pattern);
    }
    return false;
  }

  // 폴백: 매핑에 없는 도구는 모든 문자열 인수에 대해 매칭 시도
  const stringValues = Object.values(args).filter((v): v is string => typeof v === "string");
  return stringValues.some((v) => matchWildcard(v, pattern));
}

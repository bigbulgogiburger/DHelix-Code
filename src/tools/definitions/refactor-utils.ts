/**
 * 리팩토링 유틸리티 — refactor 도구에서 사용하는 순수 함수 모음
 *
 * 모든 함수는 순수 함수(pure function)입니다:
 * - 동일한 입력에 대해 항상 동일한 출력을 반환합니다.
 * - 외부 상태를 변경하지 않습니다.
 * - 파일 I/O나 네트워크 호출이 없습니다.
 *
 * 이 모듈의 함수들은 refactor.ts에서 사용되며,
 * 단위 테스트가 용이하도록 분리되어 있습니다.
 */

/**
 * 파일 내용에서 특정 줄 범위를 추출합니다.
 *
 * @param content - 파일 전체 내용 (줄바꿈으로 분리된 문자열)
 * @param startLine - 시작 줄 번호 (1-based, 포함)
 * @param endLine - 끝 줄 번호 (1-based, 포함)
 * @returns 해당 범위의 줄들을 줄바꿈으로 합친 문자열
 *
 * @example
 * extractLinesFromContent("a\nb\nc\nd", 2, 3) // → "b\nc"
 */
export function extractLinesFromContent(
  content: string,
  startLine: number,
  endLine: number,
): string {
  const lines = content.split("\n");
  // 1-based → 0-based 변환, 범위 보정
  const start = Math.max(0, startLine - 1);
  const end = Math.min(lines.length, endLine);
  return lines.slice(start, end).join("\n");
}

/**
 * 코드 문자열에서 사용된 식별자(변수, 파라미터 후보)를 추출합니다.
 *
 * 간단한 패턴 매칭 방식으로 동작합니다:
 * - 알파벳/숫자/밑줄로 구성된 식별자를 추출합니다.
 * - JavaScript/TypeScript 예약어, 숫자, 단일 문자는 제외합니다.
 * - 중복 제거 후 반환합니다.
 *
 * @param code - 분석할 코드 문자열
 * @returns 사용된 식별자 목록 (중복 제거, 예약어 제외)
 *
 * @example
 * findUsedVariables("return a + b * count;") // → ["return", "count"] → filtered → ["count"]
 */
export function findUsedVariables(code: string): string[] {
  // JS/TS 키워드 및 공통 예약어
  const JS_KEYWORDS = new Set([
    "break", "case", "catch", "class", "const", "continue", "debugger",
    "default", "delete", "do", "else", "export", "extends", "false",
    "finally", "for", "function", "if", "import", "in", "instanceof",
    "let", "new", "null", "of", "return", "static", "super", "switch",
    "this", "throw", "true", "try", "typeof", "undefined", "var", "void",
    "while", "with", "yield", "async", "await", "from", "as", "interface",
    "type", "enum", "implements", "namespace", "declare", "abstract",
    "readonly", "override", "satisfies",
  ]);

  // 식별자 패턴: 알파벳/밑줄로 시작, 숫자/알파벳/밑줄로 계속
  const identifierPattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
  const found = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = identifierPattern.exec(code)) !== null) {
    const identifier = match[1];
    // 키워드 제외, 단일 문자는 제외 (너무 많아서 노이즈)
    if (!JS_KEYWORDS.has(identifier) && identifier.length > 1) {
      found.add(identifier);
    }
  }

  return Array.from(found);
}

/**
 * 함수 시그니처 문자열을 생성합니다.
 *
 * @param name - 함수 이름
 * @param params - 파라미터 이름 배열
 * @param returnType - 반환 타입 (선택사항, 생략 시 void)
 * @returns TypeScript 형식의 함수 시그니처 문자열
 *
 * @example
 * buildFunctionSignature("add", ["a", "b"], "number")
 * // → "function add(a: unknown, b: unknown): number"
 *
 * buildFunctionSignature("log", ["message"])
 * // → "function log(message: unknown): void"
 */
export function buildFunctionSignature(
  name: string,
  params: readonly string[],
  returnType?: string,
): string {
  const paramList = params.map((p) => `${p}: unknown`).join(", ");
  const ret = returnType ?? "void";
  return `function ${name}(${paramList}): ${ret}`;
}

/**
 * 파일 내용에서 특정 줄 범위를 교체합니다.
 *
 * @param content - 원본 파일 전체 내용
 * @param startLine - 교체 시작 줄 번호 (1-based, 포함)
 * @param endLine - 교체 끝 줄 번호 (1-based, 포함)
 * @param replacement - 교체할 새 텍스트 (여러 줄 가능)
 * @returns 교체가 완료된 새 파일 내용
 *
 * @example
 * replaceLines("a\nb\nc", 2, 2, "B") // → "a\nB\nc"
 * replaceLines("a\nb\nc", 1, 2, "X\nY") // → "X\nY\nc"
 */
export function replaceLines(
  content: string,
  startLine: number,
  endLine: number,
  replacement: string,
): string {
  const lines = content.split("\n");
  // 1-based → 0-based 변환, 범위 보정
  const start = Math.max(0, startLine - 1);
  const end = Math.min(lines.length, endLine);

  // 교체: [0..start) + replacement lines + [end..end]
  const replacementLines = replacement.split("\n");
  const result = [
    ...lines.slice(0, start),
    ...replacementLines,
    ...lines.slice(end),
  ];

  return result.join("\n");
}

/**
 * Code Mode 유틸리티 — AST 없이 정규식+들여쓰기 기반으로 코드 블록을 파싱하고 편집하는 순수 함수 모듈
 *
 * tree-sitter 없이 경량으로 동작하며, function/class/interface/type/import/variable 블록을 감지합니다.
 * 모든 함수는 순수 함수(pure function)로 부작용(side effect)이 없습니다.
 *
 * 주요 기능:
 * - parseCodeBlocks: 소스 코드를 블록 단위로 파싱
 * - findBlock: 이름(dot notation 지원)으로 블록 검색
 * - applyEdit: 단일 편집 적용
 * - applyEdits: 여러 편집을 안전한 순서(뒤→앞)로 적용
 * - validateEdits: 편집 유효성 검증
 */

/**
 * 코드 블록 — 소스 코드에서 감지된 하나의 구조적 단위
 *
 * function, class, method, interface, type alias, import, variable 등을 나타냅니다.
 */
export interface CodeBlock {
  /** 블록의 종류 */
  readonly type: "function" | "class" | "method" | "interface" | "type" | "import" | "variable";
  /** 블록의 이름 (class 내부 method는 "ClassName.methodName" 형식) */
  readonly name: string;
  /** 블록 시작 줄 번호 (1-based) */
  readonly startLine: number;
  /** 블록 끝 줄 번호 (1-based, inclusive) */
  readonly endLine: number;
  /** 블록의 원문 내용 */
  readonly content: string;
  /** 감지된 언어 */
  readonly language: string;
}

/**
 * 코드 편집 — 블록 단위로 적용할 편집 작업
 */
export interface CodeEdit {
  /** 편집 액션 종류 */
  readonly action:
    | "replace-block"
    | "insert-before"
    | "insert-after"
    | "remove-block"
    | "rename-symbol";
  /** 대상 블록 이름 (예: "MyClass.myMethod") */
  readonly targetBlock: string;
  /** replace/insert 시 사용할 새 내용 */
  readonly content?: string;
  /** rename 시 사용할 새 이름 */
  readonly newName?: string;
}

/**
 * 편집 검증 결과
 */
export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

// ─────────────────────────────────────────────
// 블록 감지 정규식
// ─────────────────────────────────────────────

/** 함수 선언 패턴: export/async/function 키워드 조합 */
const FUNCTION_RE = /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/;

/** 화살표 함수 / const 함수 패턴 */
const ARROW_FN_RE = /^(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[^=])*=>/;

/** 클래스 선언 패턴 */
const CLASS_RE = /^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/;

/** 인터페이스 선언 패턴 */
const INTERFACE_RE = /^(?:export\s+)?interface\s+(\w+)/;

/** 타입 별칭 패턴 */
const TYPE_RE = /^(?:export\s+)?type\s+(\w+)\s*=/;

/** import 문 패턴 */
const IMPORT_RE = /^import\s+/;

/** 변수 선언 패턴 (화살표 함수가 아닌 일반 변수) */
const VARIABLE_RE = /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*[:=]/;

/** 클래스 메서드 패턴 (들여쓰기된 메서드) */
const METHOD_RE =
  /^\s+(?:(?:public|private|protected|static|readonly|async|abstract|override|get|set)\s+)*(\w+)\s*\(/;

/**
 * 중괄호 기반으로 블록의 끝 줄을 찾습니다.
 *
 * 여는 중괄호({)가 발견된 시점부터 중괄호 깊이를 추적하여
 * 깊이가 0이 되는 줄을 블록의 끝으로 판단합니다.
 *
 * @param lines - 전체 소스 코드 줄 배열
 * @param startIdx - 검색을 시작할 줄 인덱스 (0-based)
 * @returns 블록 끝 줄 인덱스 (0-based), 찾지 못하면 startIdx 반환
 */
function findBlockEnd(lines: readonly string[], startIdx: number): number {
  // 시작 줄에 여는 중괄호가 없으면 세미콜론/빈 줄 기반으로 끝 찾기
  // (변수 선언, 타입 별칭 등 중괄호 없는 단일/다중 줄 선언)
  const startLine = lines[startIdx];
  if (!startLine.includes("{")) {
    // 시작 줄에 세미콜론이 있으면 바로 종료
    if (startLine.trimEnd().endsWith(";")) {
      return startIdx;
    }
    // 세미콜론이 나올 때까지 다음 줄을 탐색
    for (let i = startIdx + 1; i < lines.length; i++) {
      if (lines[i].trimEnd().endsWith(";") || lines[i].trim() === "") {
        return lines[i].trim() === "" ? Math.max(startIdx, i - 1) : i;
      }
    }
    return startIdx;
  }

  // 중괄호 기반 블록 끝 찾기
  let depth = 0;

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    for (const ch of line) {
      if (ch === "{") {
        depth++;
      } else if (ch === "}") {
        depth--;
        if (depth === 0) {
          return i;
        }
      }
    }
  }

  return startIdx;
}

/**
 * import 문의 끝 줄을 찾습니다.
 *
 * 단일 줄 import와 여러 줄 import를 모두 처리합니다.
 *
 * @param lines - 전체 소스 코드 줄 배열
 * @param startIdx - import 시작 줄 인덱스 (0-based)
 * @returns import 끝 줄 인덱스 (0-based)
 */
function findImportEnd(lines: readonly string[], startIdx: number): number {
  // 단일 줄 import (세미콜론으로 끝남)
  if (lines[startIdx].includes(";")) {
    return startIdx;
  }

  // 여러 줄 import — 세미콜론이 나올 때까지
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (lines[i].includes(";")) {
      return i;
    }
  }

  return startIdx;
}

/**
 * 소스 코드를 코드 블록 단위로 파싱합니다.
 *
 * 정규식 + 들여쓰기 + 중괄호 깊이 추적을 조합하여
 * function, class, interface, type, import, variable, method 블록을 감지합니다.
 *
 * @param content - 파싱할 소스 코드 문자열
 * @param language - 언어 식별자 (예: "typescript", "javascript")
 * @returns 감지된 코드 블록 배열 (읽기 전용)
 */
export function parseCodeBlocks(content: string, language: string): readonly CodeBlock[] {
  const lines = content.split("\n");
  const blocks: CodeBlock[] = [];
  let currentClassName: string | null = null;
  let classEndLine = -1;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trimStart();

    // 빈 줄이나 주석은 건너뛰기
    if (
      trimmed === "" ||
      trimmed.startsWith("//") ||
      trimmed.startsWith("/*") ||
      trimmed.startsWith("*")
    ) {
      i++;
      continue;
    }

    // 클래스 범위 추적 — 현재 줄이 클래스 범위를 벗어났는지 확인
    if (currentClassName !== null && i > classEndLine) {
      currentClassName = null;
    }

    // import 감지
    const importMatch = trimmed.match(IMPORT_RE);
    if (importMatch) {
      const endIdx = findImportEnd(lines, i);
      const blockContent = lines.slice(i, endIdx + 1).join("\n");
      // import 이름: from 뒤의 모듈 경로 또는 전체 줄
      const fromMatch = blockContent.match(/from\s+['"]([^'"]+)['"]/);
      const importName = fromMatch ? fromMatch[1] : `import_line_${i + 1}`;
      blocks.push({
        type: "import",
        name: importName,
        startLine: i + 1,
        endLine: endIdx + 1,
        content: blockContent,
        language,
      });
      i = endIdx + 1;
      continue;
    }

    // class 감지
    const classMatch = trimmed.match(CLASS_RE);
    if (classMatch) {
      const className = classMatch[1];
      const endIdx = findBlockEnd(lines, i);
      const blockContent = lines.slice(i, endIdx + 1).join("\n");
      blocks.push({
        type: "class",
        name: className,
        startLine: i + 1,
        endLine: endIdx + 1,
        content: blockContent,
        language,
      });
      currentClassName = className;
      classEndLine = endIdx;
      i++;
      continue;
    }

    // interface 감지
    const ifaceMatch = trimmed.match(INTERFACE_RE);
    if (ifaceMatch) {
      const endIdx = findBlockEnd(lines, i);
      const blockContent = lines.slice(i, endIdx + 1).join("\n");
      blocks.push({
        type: "interface",
        name: ifaceMatch[1],
        startLine: i + 1,
        endLine: endIdx + 1,
        content: blockContent,
        language,
      });
      i = endIdx + 1;
      continue;
    }

    // type 별칭 감지
    const typeMatch = trimmed.match(TYPE_RE);
    if (typeMatch) {
      const endIdx = findBlockEnd(lines, i);
      const blockContent = lines.slice(i, endIdx + 1).join("\n");
      blocks.push({
        type: "type",
        name: typeMatch[1],
        startLine: i + 1,
        endLine: endIdx + 1,
        content: blockContent,
        language,
      });
      i = endIdx + 1;
      continue;
    }

    // 클래스 내부 메서드 감지 (들여쓰기가 있는 경우)
    if (currentClassName !== null && i <= classEndLine) {
      const methodMatch = line.match(METHOD_RE);
      if (methodMatch) {
        const methodName = methodMatch[1];
        // constructor, get, set 등 특수 메서드 이름은 그대로 사용
        if (
          methodName !== "if" &&
          methodName !== "for" &&
          methodName !== "while" &&
          methodName !== "switch"
        ) {
          const endIdx = findBlockEnd(lines, i);
          // 메서드 끝이 클래스 끝을 초과하지 않도록 제한
          const clampedEnd = Math.min(endIdx, classEndLine);
          const blockContent = lines.slice(i, clampedEnd + 1).join("\n");
          blocks.push({
            type: "method",
            name: `${currentClassName}.${methodName}`,
            startLine: i + 1,
            endLine: clampedEnd + 1,
            content: blockContent,
            language,
          });
          i = clampedEnd + 1;
          continue;
        }
      }
    }

    // function 선언 감지
    const funcMatch = trimmed.match(FUNCTION_RE);
    if (funcMatch) {
      const endIdx = findBlockEnd(lines, i);
      const blockContent = lines.slice(i, endIdx + 1).join("\n");
      blocks.push({
        type: "function",
        name: funcMatch[1],
        startLine: i + 1,
        endLine: endIdx + 1,
        content: blockContent,
        language,
      });
      i = endIdx + 1;
      continue;
    }

    // 화살표 함수 / const 함수 감지
    const arrowMatch = trimmed.match(ARROW_FN_RE);
    if (arrowMatch) {
      const endIdx = findBlockEnd(lines, i);
      const blockContent = lines.slice(i, endIdx + 1).join("\n");
      blocks.push({
        type: "function",
        name: arrowMatch[1],
        startLine: i + 1,
        endLine: endIdx + 1,
        content: blockContent,
        language,
      });
      i = endIdx + 1;
      continue;
    }

    // 일반 변수 선언 감지 (화살표 함수가 아닌 경우)
    if (currentClassName === null || i > classEndLine) {
      const varMatch = trimmed.match(VARIABLE_RE);
      if (varMatch) {
        const endIdx = findBlockEnd(lines, i);
        const blockContent = lines.slice(i, endIdx + 1).join("\n");
        blocks.push({
          type: "variable",
          name: varMatch[1],
          startLine: i + 1,
          endLine: endIdx + 1,
          content: blockContent,
          language,
        });
        i = endIdx + 1;
        continue;
      }
    }

    i++;
  }

  return blocks;
}

/**
 * 이름으로 코드 블록을 검색합니다.
 *
 * dot notation을 지원하여 "ClassName.methodName" 형식으로 클래스 내부 메서드를 찾을 수 있습니다.
 *
 * @param blocks - 검색할 코드 블록 배열
 * @param name - 찾을 블록 이름 (예: "myFunction", "MyClass.myMethod")
 * @returns 찾은 코드 블록 또는 undefined
 */
export function findBlock(blocks: readonly CodeBlock[], name: string): CodeBlock | undefined {
  // 정확한 이름 매칭 (dot notation 포함)
  return blocks.find((block) => block.name === name);
}

/**
 * 단일 편집을 소스 코드에 적용합니다.
 *
 * @param content - 원본 소스 코드
 * @param blocks - 파싱된 코드 블록 배열
 * @param edit - 적용할 편집
 * @returns 편집이 적용된 새 소스 코드
 * @throws 대상 블록을 찾을 수 없거나 필수 필드가 누락된 경우
 */
export function applyEdit(content: string, blocks: readonly CodeBlock[], edit: CodeEdit): string {
  const block = findBlock(blocks, edit.targetBlock);
  if (!block) {
    throw new Error(`Block not found: "${edit.targetBlock}"`);
  }

  const lines = content.split("\n");

  switch (edit.action) {
    case "replace-block": {
      if (edit.content === undefined) {
        throw new Error(`"content" is required for replace-block action`);
      }
      const before = lines.slice(0, block.startLine - 1);
      const after = lines.slice(block.endLine);
      return [...before, edit.content, ...after].join("\n");
    }

    case "insert-before": {
      if (edit.content === undefined) {
        throw new Error(`"content" is required for insert-before action`);
      }
      const before = lines.slice(0, block.startLine - 1);
      const rest = lines.slice(block.startLine - 1);
      return [...before, edit.content, ...rest].join("\n");
    }

    case "insert-after": {
      if (edit.content === undefined) {
        throw new Error(`"content" is required for insert-after action`);
      }
      const before = lines.slice(0, block.endLine);
      const after = lines.slice(block.endLine);
      return [...before, edit.content, ...after].join("\n");
    }

    case "remove-block": {
      const before = lines.slice(0, block.startLine - 1);
      const after = lines.slice(block.endLine);
      return [...before, ...after].join("\n");
    }

    case "rename-symbol": {
      if (!edit.newName) {
        throw new Error(`"newName" is required for rename-symbol action`);
      }
      // 블록의 원래 짧은 이름 추출 (dot notation에서 마지막 부분)
      const parts = block.name.split(".");
      const oldShortName = parts[parts.length - 1];
      // 블록 범위 내에서만 이름 교체 (식별자 경계 사용)
      const blockLines = lines.slice(block.startLine - 1, block.endLine);
      const regex = new RegExp(`\\b${escapeRegex(oldShortName)}\\b`, "g");
      const renamedLines = blockLines.map((line) => line.replace(regex, edit.newName!));
      const before = lines.slice(0, block.startLine - 1);
      const after = lines.slice(block.endLine);
      return [...before, ...renamedLines, ...after].join("\n");
    }
  }
}

/**
 * 여러 편집을 소스 코드에 안전하게 적용합니다.
 *
 * 편집을 뒤에서부터 적용하여 줄 번호 이동으로 인한 오류를 방지합니다.
 * 각 편집 적용 후 블록을 다시 파싱합니다.
 *
 * @param content - 원본 소스 코드
 * @param language - 언어 식별자
 * @param edits - 적용할 편집 배열
 * @returns 모든 편집이 적용된 새 소스 코드
 */
export function applyEdits(content: string, language: string, edits: readonly CodeEdit[]): string {
  // 편집을 대상 블록의 시작 줄 기준으로 역순 정렬 (뒤에서부터 적용)
  const blocks = parseCodeBlocks(content, language);
  const sortedEdits = [...edits].sort((a, b) => {
    const blockA = findBlock(blocks, a.targetBlock);
    const blockB = findBlock(blocks, b.targetBlock);
    const lineA = blockA?.startLine ?? 0;
    const lineB = blockB?.startLine ?? 0;
    return lineB - lineA; // 역순: 뒤쪽 블록을 먼저 처리
  });

  let result = content;
  for (const edit of sortedEdits) {
    // 매 편집마다 블록을 다시 파싱 (줄 번호가 변경될 수 있으므로)
    const currentBlocks = parseCodeBlocks(result, language);
    result = applyEdit(result, currentBlocks, edit);
  }

  return result;
}

/**
 * 편집 목록의 유효성을 검증합니다.
 *
 * 각 편집의 대상 블록 존재 여부, 필수 필드 존재 여부를 확인합니다.
 *
 * @param blocks - 현재 코드 블록 배열
 * @param edits - 검증할 편집 배열
 * @returns 검증 결과 (유효 여부 + 에러 메시지 배열)
 */
export function validateEdits(
  blocks: readonly CodeBlock[],
  edits: readonly CodeEdit[],
): ValidationResult {
  const errors: string[] = [];

  for (let i = 0; i < edits.length; i++) {
    const edit = edits[i];
    const idx = i + 1;

    // 대상 블록 존재 확인
    const block = findBlock(blocks, edit.targetBlock);
    if (!block) {
      const availableNames = blocks.map((b) => b.name).join(", ");
      errors.push(
        `Edit #${idx}: Block "${edit.targetBlock}" not found. Available blocks: [${availableNames}]`,
      );
      continue;
    }

    // 액션별 필수 필드 확인
    switch (edit.action) {
      case "replace-block":
      case "insert-before":
      case "insert-after":
        if (edit.content === undefined || edit.content === "") {
          errors.push(`Edit #${idx}: "${edit.action}" requires non-empty "content" field`);
        }
        break;

      case "rename-symbol":
        if (!edit.newName || edit.newName.trim() === "") {
          errors.push(`Edit #${idx}: "rename-symbol" requires non-empty "newName" field`);
        }
        break;

      case "remove-block":
        // remove-block은 추가 필드 불필요
        break;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 정규식 특수 문자를 이스케이프합니다.
 *
 * @param str - 이스케이프할 문자열
 * @returns 이스케이프된 문자열
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

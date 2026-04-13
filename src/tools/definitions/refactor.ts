/**
 * 리팩토링 도구 — extract function, extract variable, inline variable을 지원하는 코드 리팩토링 도구
 *
 * 지원하는 액션:
 * - extract-function: 선택 범위의 코드를 새 함수로 추출
 * - extract-variable: 선택 범위의 표현식을 변수로 추출
 * - inline-variable: 변수 선언을 찾아 모든 사용처에 값을 인라인
 *
 * 안전 장치:
 * - dry_run 옵션으로 미리보기(preview)만 반환 (파일 변경 없음)
 * - inline-variable는 단일 사용처에서만 안전하게 인라인
 * - extract-function은 사용된 변수를 파라미터로 자동 변환
 *
 * 권한 수준: "confirm" — 파일을 변경하므로 사용자 확인이 필요합니다.
 */
import { z } from "zod";
import { readFile, writeFile } from "node:fs/promises";
import { type ToolDefinition, type ToolContext, type ToolResult } from "../types.js";
import { resolvePath, normalizePath } from "../../utils/path.js";
import {
  extractLinesFromContent,
  findUsedVariables,
  buildFunctionSignature,
  replaceLines,
} from "./refactor-utils.js";

/**
 * 매개변수 스키마 — 리팩토링 액션, 파일 경로, 선택 범위, 새 이름을 정의
 */
const refactorSchema = z.object({
  /**
   * 리팩토링 액션 종류:
   * - "extract-function": 선택 범위 → 함수
   * - "extract-variable": 선택 범위 → 변수
   * - "inline-variable": 변수 선언 → 인라인
   */
  action: z
    .enum(["extract-function", "extract-variable", "inline-variable"])
    .describe("Refactoring action to perform"),

  /** 리팩토링할 파일 경로 */
  filePath: z.string().describe("Path to the file to refactor"),

  /**
   * 작업 대상 줄 범위 (1-based):
   * - extract-function/extract-variable: 추출할 코드 범위
   * - inline-variable: 변수 선언이 있는 줄 (startLine == endLine 권장)
   */
  selection: z
    .object({
      startLine: z.number().int().min(1).describe("Start line number (1-based, inclusive)"),
      endLine: z.number().int().min(1).describe("End line number (1-based, inclusive)"),
    })
    .describe("Line range for the refactoring operation"),

  /**
   * 새 이름 (extract 액션에서 사용):
   * - extract-function: 새 함수의 이름
   * - extract-variable: 새 변수의 이름
   * - inline-variable: 사용하지 않음
   */
  newName: z.string().optional().describe("New name for the extracted function or variable"),

  /**
   * 미리보기 모드:
   * - true: 파일을 변경하지 않고 예상 결과만 반환
   * - false (기본값): 실제로 파일을 변경
   */
  dry_run: z
    .boolean()
    .default(false)
    .describe("If true, preview changes without modifying the file"),
});

type Params = z.infer<typeof refactorSchema>;

/**
 * 선택 범위의 코드를 새 함수로 추출합니다.
 *
 * 처리 흐름:
 * 1. selection 범위의 코드를 추출
 * 2. 코드에서 사용된 변수를 파라미터 후보로 추출
 * 3. 함수 정의 생성 (파라미터 포함)
 * 4. 원래 위치를 함수 호출로 교체
 * 5. 함수 정의를 selection 위 (또는 파일 상단)에 삽입
 *
 * @param content - 파일 전체 내용
 * @param params - 검증된 매개변수
 * @returns 리팩토링이 적용된 새 파일 내용과 변경 요약
 */
function applyExtractFunction(
  content: string,
  params: Readonly<Params>,
): { readonly newContent: string; readonly summary: string } {
  const { selection, newName = "extractedFunction" } = params;
  const { startLine, endLine } = selection;

  // 추출할 코드 범위 가져오기
  const extractedCode = extractLinesFromContent(content, startLine, endLine);

  // 사용된 변수 → 파라미터 목록
  const usedVars = findUsedVariables(extractedCode);

  // 함수 시그니처 생성
  const signature = buildFunctionSignature(newName, usedVars);

  // 추출된 함수 본문 생성
  const lines = content.split("\n");
  const indentMatch = lines[startLine - 1]?.match(/^(\s*)/);
  const originalIndent = indentMatch ? indentMatch[1] : "";

  // 원래 코드를 함수 본문으로 변환 (들여쓰기 유지)
  const bodyLines = extractedCode
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
  const functionDef = `${originalIndent}${signature} {\n${bodyLines}\n${originalIndent}}`;

  // 파라미터 호출 인수 생성
  const callArgs = usedVars.join(", ");
  const callExpr = `${originalIndent}${newName}(${callArgs});`;

  // 원래 위치를 함수 호출로 교체
  const afterCall = replaceLines(content, startLine, endLine, callExpr);

  // 함수 정의를 selection 바로 위에 삽입
  // (selection이 1번 줄이면 파일 맨 앞에 삽입)
  const insertLine = Math.max(1, startLine - 1);
  const newContent = replaceLines(
    afterCall,
    insertLine,
    insertLine - 1, // 줄 교체가 아닌 삽입: endLine < startLine이면 해당 위치에 삽입
    insertLine > 1
      ? extractLinesFromContent(afterCall, insertLine, insertLine) + "\n" + functionDef
      : functionDef + "\n" + extractLinesFromContent(afterCall, insertLine, insertLine),
  );

  const summary = [
    `Extracted function '${newName}' from lines ${startLine}-${endLine}.`,
    `Parameters: ${usedVars.length > 0 ? usedVars.join(", ") : "(none)"}`,
    `Signature: ${signature}`,
  ].join("\n");

  return { newContent, summary };
}

/**
 * 선택 범위의 표현식을 변수로 추출합니다.
 *
 * 처리 흐름:
 * 1. selection 범위의 표현식(한 줄 권장) 추출
 * 2. `const newName = <expression>;` 형태의 변수 선언 생성
 * 3. 원래 위치에 변수 참조로 교체
 * 4. 변수 선언을 selection 위 줄에 삽입
 *
 * @param content - 파일 전체 내용
 * @param params - 검증된 매개변수
 * @returns 리팩토링이 적용된 새 파일 내용과 변경 요약
 */
function applyExtractVariable(
  content: string,
  params: Readonly<Params>,
): { readonly newContent: string; readonly summary: string } {
  const { selection, newName = "extractedValue" } = params;
  const { startLine, endLine } = selection;

  // 추출할 표현식 가져오기
  const expression = extractLinesFromContent(content, startLine, endLine).trim();

  // 들여쓰기 파악
  const lines = content.split("\n");
  const indentMatch = lines[startLine - 1]?.match(/^(\s*)/);
  const originalIndent = indentMatch ? indentMatch[1] : "";

  // 변수 선언 생성
  const varDeclaration = `${originalIndent}const ${newName} = ${expression};`;

  // 원래 위치를 변수 참조로 교체
  const varReference = `${originalIndent}${newName}`;
  const afterReplace = replaceLines(content, startLine, endLine, varReference);

  // 변수 선언을 selection 바로 위 줄에 삽입
  const insertAt = startLine - 1;
  const newContent =
    insertAt > 0
      ? replaceLines(
          afterReplace,
          insertAt,
          insertAt,
          extractLinesFromContent(afterReplace, insertAt, insertAt) + "\n" + varDeclaration,
        )
      : varDeclaration + "\n" + afterReplace;

  const summary = [
    `Extracted variable '${newName}' from lines ${startLine}-${endLine}.`,
    `Declaration: ${varDeclaration.trim()}`,
    `Expression replaced with: ${newName}`,
  ].join("\n");

  return { newContent, summary };
}

/**
 * 변수 선언을 찾아 모든 사용처에 값을 인라인합니다.
 *
 * 처리 흐름:
 * 1. selection 범위에서 변수 선언 (`const/let/var name = value;`) 파싱
 * 2. 파일 전체에서 변수 이름 사용처 검색
 * 3. 사용처가 1곳인 경우에만 안전하게 인라인 (안전 정책)
 * 4. 변수 선언 줄 제거
 * 5. 사용처를 변수 값으로 교체
 *
 * @param content - 파일 전체 내용
 * @param params - 검증된 매개변수
 * @returns 리팩토링이 적용된 새 파일 내용과 변경 요약, 또는 에러
 */
function applyInlineVariable(
  content: string,
  params: Readonly<Params>,
): { readonly newContent: string; readonly summary: string } | { readonly error: string } {
  const { selection } = params;
  const { startLine } = selection;

  // 변수 선언 줄 가져오기
  const declarationLine = extractLinesFromContent(content, startLine, startLine).trim();

  // 변수 선언 파싱: `const/let/var <name> = <value>;`
  const declMatch = declarationLine.match(
    /^(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(.+?);?\s*$/,
  );

  if (!declMatch) {
    return {
      error:
        `Line ${startLine} does not contain a valid variable declaration. ` +
        `Expected: const/let/var <name> = <value>;`,
    };
  }

  const [, varName, varValue] = declMatch;

  // 변수 이름 사용처를 파일 전체에서 검색 (선언 줄 제외)
  const lines = content.split("\n");
  const usageLines: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1; // 1-based
    if (lineNum === startLine) continue; // 선언 줄 제외

    // 식별자 경계(\b)로 정확한 사용처만 찾기
    const usagePattern = new RegExp(`\\b${escapeRegex(varName)}\\b`);
    if (usagePattern.test(lines[i])) {
      usageLines.push(lineNum);
    }
  }

  // 단일 사용처에서만 안전하게 인라인
  if (usageLines.length === 0) {
    return {
      error: `Variable '${varName}' has no usages. The declaration can be safely deleted manually.`,
    };
  }

  if (usageLines.length > 1) {
    return {
      error:
        `Variable '${varName}' is used in ${usageLines.length} places (lines: ${usageLines.join(", ")}). ` +
        `Inline variable is only safe for single-use variables. ` +
        `Please inline manually or ensure only one usage exists.`,
    };
  }

  // 단일 사용처: 인라인 적용
  const usageLine = usageLines[0];
  const usageLineContent = lines[usageLine - 1];
  const replacedUsage = usageLineContent.replace(
    new RegExp(`\\b${escapeRegex(varName)}\\b`),
    varValue,
  );

  // 1. 사용처 교체
  let newContent = replaceLines(content, usageLine, usageLine, replacedUsage);

  // 2. 선언 줄 제거 (선언 줄이 사용처 줄보다 앞에 있으면 인덱스 조정 필요)
  const adjustedDeclarationLine = usageLine > startLine ? startLine : startLine;
  const currentLines = newContent.split("\n");
  currentLines.splice(adjustedDeclarationLine - 1, 1);
  newContent = currentLines.join("\n");

  const summary = [
    `Inlined variable '${varName}' (declared at line ${startLine}) into line ${usageLine}.`,
    `Value inlined: ${varValue}`,
    `Declaration removed.`,
  ].join("\n");

  return { newContent, summary };
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

/**
 * 리팩토링 도구 실행 함수
 *
 * 실행 흐름:
 * 1. filePath를 절대 경로로 해석하여 파일 내용 읽기
 * 2. selection 범위 유효성 검사
 * 3. action에 따라 적절한 리팩토링 함수 호출
 * 4. dry_run이면 미리보기만 반환 (파일 미변경)
 * 5. dry_run이 아니면 파일에 변경 내용 저장
 *
 * @param params - 검증된 매개변수
 * @param context - 실행 컨텍스트
 * @returns 리팩토링 결과 (미리보기 또는 성공/실패 메시지)
 */
async function execute(params: Params, context: ToolContext): Promise<ToolResult> {
  const filePath = resolvePath(context.workingDirectory, params.filePath);

  try {
    const content = await readFile(filePath, "utf-8");
    const totalLines = content.split("\n").length;

    // 범위 유효성 검사
    const { startLine, endLine } = params.selection;

    if (startLine > endLine) {
      return {
        output: `Invalid selection: startLine (${startLine}) must be <= endLine (${endLine}).`,
        isError: true,
      };
    }

    if (startLine < 1 || endLine > totalLines) {
      return {
        output:
          `Selection out of bounds: file has ${totalLines} lines, ` +
          `but selection is ${startLine}-${endLine}.`,
        isError: true,
      };
    }

    // action별 리팩토링 수행
    let newContent: string;
    let summary: string;

    switch (params.action) {
      case "extract-function": {
        if (!params.newName) {
          return {
            output: `'newName' is required for extract-function action.`,
            isError: true,
          };
        }
        const result = applyExtractFunction(content, params);
        newContent = result.newContent;
        summary = result.summary;
        break;
      }

      case "extract-variable": {
        if (!params.newName) {
          return {
            output: `'newName' is required for extract-variable action.`,
            isError: true,
          };
        }
        const result = applyExtractVariable(content, params);
        newContent = result.newContent;
        summary = result.summary;
        break;
      }

      case "inline-variable": {
        const result = applyInlineVariable(content, params);
        if ("error" in result) {
          return { output: result.error, isError: true };
        }
        newContent = result.newContent;
        summary = result.summary;
        break;
      }
    }

    // dry_run: 파일을 변경하지 않고 미리보기만 반환
    if (params.dry_run) {
      const preview = [
        `[DRY RUN] Refactoring preview for: ${normalizePath(params.filePath)}`,
        `Action: ${params.action}`,
        "",
        summary,
        "",
        "--- Preview of changes (first 20 lines of new content) ---",
        newContent.split("\n").slice(0, 20).join("\n"),
        newContent.split("\n").length > 20
          ? `... (${newContent.split("\n").length - 20} more lines)`
          : "",
      ]
        .filter((line) => line !== "")
        .join("\n");

      return {
        output: preview,
        isError: false,
        metadata: {
          action: params.action,
          filePath: normalizePath(filePath),
          selection: params.selection,
          dryRun: true,
        },
      };
    }

    // 실제 파일 변경
    await writeFile(filePath, newContent, "utf-8");

    const output = [
      `Successfully applied '${params.action}' refactoring to ${normalizePath(params.filePath)}.`,
      "",
      summary,
    ].join("\n");

    return {
      output,
      isError: false,
      metadata: {
        action: params.action,
        filePath: normalizePath(filePath),
        selection: params.selection,
        dryRun: false,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      output: `Failed to apply refactoring: ${message}`,
      isError: true,
    };
  }
}

/**
 * refactor 도구 정의 — 내보내기하여 도구 레지스트리에 등록
 */
export const refactorTool: ToolDefinition<Params> = {
  name: "refactor",
  description:
    "Apply automated code refactoring operations to a file. " +
    "Supports: " +
    "(1) extract-function: extract selected lines into a new named function, auto-detecting parameters; " +
    "(2) extract-variable: extract a selected expression into a named const variable; " +
    "(3) inline-variable: inline a single-use variable declaration into its usage site. " +
    "Use dry_run: true to preview changes before applying. " +
    "Always read the file first to identify the correct line numbers.",
  parameterSchema: refactorSchema,
  permissionLevel: "confirm",
  timeoutMs: 30_000,
  execute,
};

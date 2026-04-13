/**
 * Code Mode 도구 — AST 기반 구조적 코드 편집 도구
 *
 * 텍스트 기반 file_edit와 달리, 코드의 구조적 단위(함수, 클래스, 메서드 등)를
 * 이름으로 지정하여 편집합니다. Codex CLI의 code mode를 벤치마킹한 구현입니다.
 *
 * 지원하는 액션:
 * - replace-block: 블록 전체를 새 내용으로 교체
 * - insert-before: 블록 앞에 코드 삽입
 * - insert-after: 블록 뒤에 코드 삽입
 * - remove-block: 블록 제거
 * - rename-symbol: 블록 내 심볼 이름 변경
 *
 * 안전 장치:
 * - dryRun 옵션으로 미리보기(diff)만 반환 (파일 변경 없음)
 * - validateEdits로 편집 전 유효성 검증
 * - 최대 20개 편집까지 허용 (과도한 변경 방지)
 * - 편집을 뒤에서부터 적용하여 줄 번호 이동 방지
 *
 * 권한 수준: "confirm" — 파일을 변경하므로 사용자 확인이 필요합니다.
 */
import { z } from "zod";
import { readFile, writeFile } from "node:fs/promises";
import { type ToolDefinition, type ToolContext, type ToolResult } from "../types.js";
import { resolvePath, normalizePath, extName } from "../../utils/path.js";
import { parseCodeBlocks, validateEdits, applyEdits, type CodeEdit } from "./code-mode-utils.js";

/**
 * 파일 확장자 → 언어 식별자 매핑
 *
 * parseCodeBlocks에 전달하는 language 값을 결정합니다.
 */
const EXT_TO_LANGUAGE: Readonly<Record<string, string>> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".mts": "typescript",
  ".cts": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".py": "python",
  ".go": "go",
  ".rs": "rust",
  ".java": "java",
  ".c": "c",
  ".cpp": "cpp",
  ".h": "c",
  ".hpp": "cpp",
};

/**
 * 매개변수 스키마 — 편집 대상 파일과 편집 목록을 정의
 */
const codeModeSchema = z.object({
  /** 편집할 파일 경로 */
  filePath: z.string().describe("Path to the file to edit structurally"),
  /** 적용할 편집 목록 (최소 1개, 최대 20개) */
  edits: z
    .array(
      z.object({
        /** 편집 액션 종류 */
        action: z
          .enum(["replace-block", "insert-before", "insert-after", "remove-block", "rename-symbol"])
          .describe("Edit action to perform on the target block"),
        /** 대상 블록 이름 (예: "myFunction", "MyClass.myMethod") */
        targetBlock: z
          .string()
          .describe("Name of the target code block (supports dot notation like 'Class.method')"),
        /** replace/insert 시 사용할 새 내용 */
        content: z
          .string()
          .optional()
          .describe("New content for replace-block, insert-before, or insert-after"),
        /** rename 시 사용할 새 이름 */
        newName: z.string().optional().describe("New name for rename-symbol action"),
      }),
    )
    .min(1)
    .max(20)
    .describe("List of structural edits to apply (1-20)"),
  /** 미리보기 모드 — true이면 파일 변경 없이 diff만 반환 */
  dryRun: z
    .boolean()
    .default(false)
    .describe("If true, preview changes without modifying the file"),
});

type Params = z.infer<typeof codeModeSchema>;

/**
 * 파일 확장자에서 언어를 추론합니다.
 *
 * @param filePath - 파일 경로
 * @returns 언어 식별자 (알 수 없으면 "unknown")
 */
function detectLanguage(filePath: string): string {
  const ext = extName(filePath).toLowerCase();
  return EXT_TO_LANGUAGE[ext] ?? "unknown";
}

/**
 * 간단한 unified diff 형식의 변경 요약을 생성합니다.
 *
 * @param original - 원본 소스 코드
 * @param modified - 수정된 소스 코드
 * @param filePath - 파일 경로 (표시용)
 * @returns diff 형식의 문자열
 */
function generateSimpleDiff(original: string, modified: string, filePath: string): string {
  const origLines = original.split("\n");
  const modLines = modified.split("\n");

  const diffParts: string[] = [`--- a/${filePath}`, `+++ b/${filePath}`];

  // 줄 단위 비교 — 변경된 영역만 표시 (간이 diff)
  let i = 0;
  let j = 0;
  let changesFound = false;

  while (i < origLines.length || j < modLines.length) {
    if (i < origLines.length && j < modLines.length && origLines[i] === modLines[j]) {
      i++;
      j++;
      continue;
    }

    changesFound = true;
    // 변경이 시작된 지점 — 컨텍스트 2줄 포함
    const contextStart = Math.max(0, i - 2);
    // 변경 영역의 끝을 찾기
    let origEnd = i;
    let modEnd = j;

    // 다시 동기화될 때까지 진행
    while (origEnd < origLines.length || modEnd < modLines.length) {
      if (
        origEnd < origLines.length &&
        modEnd < modLines.length &&
        origLines[origEnd] === modLines[modEnd]
      ) {
        // 3줄 연속 같으면 동기화 완료로 판단
        let syncCount = 0;
        for (
          let k = 0;
          k < 3 && origEnd + k < origLines.length && modEnd + k < modLines.length;
          k++
        ) {
          if (origLines[origEnd + k] === modLines[modEnd + k]) {
            syncCount++;
          }
        }
        if (syncCount >= 3) break;
      }
      if (origEnd < origLines.length) origEnd++;
      if (modEnd < modLines.length) modEnd++;
    }

    const contextEnd = Math.min(origLines.length, origEnd + 2);
    const modContextEnd = Math.min(modLines.length, modEnd + 2);

    diffParts.push(
      `@@ -${contextStart + 1},${contextEnd - contextStart} +${Math.max(0, j - 2) + 1},${modContextEnd - Math.max(0, j - 2)} @@`,
    );

    // 컨텍스트 앞줄
    for (let k = contextStart; k < i; k++) {
      diffParts.push(` ${origLines[k]}`);
    }
    // 삭제된 줄
    for (let k = i; k < origEnd; k++) {
      diffParts.push(`-${origLines[k]}`);
    }
    // 추가된 줄
    for (let k = j; k < modEnd; k++) {
      diffParts.push(`+${modLines[k]}`);
    }
    // 컨텍스트 뒷줄
    for (let k = origEnd; k < contextEnd; k++) {
      diffParts.push(` ${origLines[k]}`);
    }

    i = contextEnd;
    j = modContextEnd;
  }

  if (!changesFound) {
    return "No changes detected.";
  }

  return diffParts.join("\n");
}

/**
 * Code Mode 도구 실행 함수
 *
 * 실행 흐름:
 * 1. 파일 읽기 + 언어 감지
 * 2. parseCodeBlocks로 코드 블록 파싱
 * 3. validateEdits로 편집 유효성 검증
 * 4. applyEdits로 편집 적용 (뒤에서부터 적용하여 줄 번호 이동 방지)
 * 5. dryRun이면 diff만 반환, 아니면 파일 쓰기
 *
 * @param params - 검증된 매개변수
 * @param context - 실행 컨텍스트
 * @returns 실행 결과 (diff 또는 성공/실패 메시지)
 */
async function execute(params: Params, context: ToolContext): Promise<ToolResult> {
  const filePath = resolvePath(context.workingDirectory, params.filePath);

  try {
    // 1. 파일 읽기 + 언어 감지
    const content = await readFile(filePath, "utf-8");
    const language = detectLanguage(filePath);

    // 2. 코드 블록 파싱
    const blocks = parseCodeBlocks(content, language);
    if (blocks.length === 0) {
      return {
        output:
          `No code blocks detected in ${normalizePath(params.filePath)}. ` +
          `The file may be empty or contain only comments.`,
        isError: true,
      };
    }

    // 3. 편집 유효성 검증
    const edits: readonly CodeEdit[] = params.edits;
    const validation = validateEdits(blocks, edits);
    if (!validation.valid) {
      const blockList = blocks
        .map((b) => `  - ${b.type}: "${b.name}" (lines ${b.startLine}-${b.endLine})`)
        .join("\n");
      return {
        output: [
          `Validation failed for ${normalizePath(params.filePath)}:`,
          ...validation.errors,
          "",
          "Available blocks:",
          blockList,
        ].join("\n"),
        isError: true,
      };
    }

    // 4. 편집 적용
    const modified = applyEdits(content, language, edits);

    // 5. 결과 처리
    if (params.dryRun) {
      const diff = generateSimpleDiff(content, modified, normalizePath(params.filePath));
      const blockList = blocks
        .map((b) => `  ${b.type}: "${b.name}" (lines ${b.startLine}-${b.endLine})`)
        .join("\n");

      return {
        output: [
          `[DRY RUN] Code mode preview for: ${normalizePath(params.filePath)}`,
          `Language: ${language}`,
          `Blocks detected: ${blocks.length}`,
          `Edits to apply: ${edits.length}`,
          "",
          "Detected blocks:",
          blockList,
          "",
          "Diff preview:",
          diff,
        ].join("\n"),
        isError: false,
        metadata: {
          filePath: normalizePath(filePath),
          language,
          blockCount: blocks.length,
          editCount: edits.length,
          dryRun: true,
        },
      };
    }

    // 실제 파일 쓰기
    await writeFile(filePath, modified, "utf-8");

    const editSummary = edits
      .map(
        (e, idx) =>
          `  ${idx + 1}. ${e.action} → "${e.targetBlock}"${e.newName ? ` (rename to "${e.newName}")` : ""}`,
      )
      .join("\n");

    return {
      output: [
        `Successfully applied ${edits.length} structural edit(s) to ${normalizePath(params.filePath)}.`,
        "",
        "Applied edits:",
        editSummary,
      ].join("\n"),
      isError: false,
      metadata: {
        filePath: normalizePath(filePath),
        language,
        blockCount: blocks.length,
        editCount: edits.length,
        dryRun: false,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      output: `Failed to apply code mode edits: ${message}`,
      isError: true,
    };
  }
}

/**
 * code_mode 도구 정의 — 내보내기하여 도구 레지스트리에 등록
 */
export const codeModeTool: ToolDefinition<Params> = {
  name: "code_mode",
  description:
    "Structurally edit code by targeting named blocks (functions, classes, methods, interfaces, types, imports, variables). " +
    "Unlike file_edit which uses text matching, code_mode identifies blocks by name and applies edits structurally. " +
    "Supports: replace-block, insert-before, insert-after, remove-block, rename-symbol. " +
    "Use dot notation for class methods (e.g., 'MyClass.myMethod'). " +
    "Set dryRun: true to preview changes before applying. " +
    "Always read the file first to identify available block names.",
  parameterSchema: codeModeSchema,
  permissionLevel: "confirm",
  timeoutMs: 30_000,
  execute,
};

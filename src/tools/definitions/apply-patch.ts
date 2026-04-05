/**
 * apply_patch 도구 — Unified diff format 패치를 파싱하고 파일에 적용하는 도구
 *
 * LLM이 여러 파일의 변경사항을 하나의 unified diff로 생성하여 한 번에 적용할 수 있게 한다.
 * OpenCode의 apply_patch와 유사하지만, DHelix는 dry_run과 fuzz_factor를 추가한다.
 *
 * 주요 기능:
 * - 표준 unified diff 형식 파싱 (`---`, `+++`, `@@`, `+`, `-`, ` ` 라인)
 * - 다중 파일 패치 지원 (하나의 패치에 여러 파일 포함 가능)
 * - dry_run 모드: 실제 변경 없이 적용될 내용 미리보기
 * - fuzz_factor: 컨텍스트 라인이 정확히 일치하지 않아도 허용되는 불일치 수
 *
 * 안전 장치:
 * - 헝크(hunk) 적용 실패 시 해당 파일은 변경하지 않고 명확한 에러 메시지 반환
 * - fuzz_factor 범위 0-3으로 제한 (무한 허용 방지)
 *
 * 권한 수준: "confirm" — 파일을 변경하므로 사용자 확인이 필요합니다.
 */
import { z } from "zod";
import { readFile, writeFile } from "node:fs/promises";
import { type ToolDefinition, type ToolContext, type ToolResult } from "../types.js";
import { resolvePath, normalizePath } from "../../utils/path.js";

// ---------------------------------------------------------------------------
// Zod 스키마
// ---------------------------------------------------------------------------

/**
 * apply_patch 도구의 매개변수 스키마
 */
const paramSchema = z.object({
  /** 적용할 unified diff 형식의 패치 문자열 (여러 파일 지원) */
  patch: z
    .string()
    .describe(
      "Unified diff format patch string. Supports multiple files. " +
        "Use --- a/path and +++ b/path headers. " +
        "Context lines recommended for accurate matching.",
    ),
  /** true면 실제 파일을 변경하지 않고 적용될 변경 목록만 반환 */
  dry_run: z
    .boolean()
    .default(false)
    .describe("If true, returns what would change without modifying files."),
  /**
   * 컨텍스트 라인 불일치 허용 수 (0 = 정확히 일치해야 함)
   * 패치의 컨텍스트 라인이 실제 파일과 다소 다를 때 허용하는 불일치 줄 수
   */
  fuzz_factor: z
    .number()
    .min(0)
    .max(3)
    .default(0)
    .describe("Number of context lines that can mismatch (0 = exact match required)."),
});

type Params = z.infer<typeof paramSchema>;

// ---------------------------------------------------------------------------
// 내부 타입 정의
// ---------------------------------------------------------------------------

/**
 * 패치 헝크(hunk) — unified diff에서 `@@` 헤더로 시작하는 변경 단위
 */
interface PatchHunk {
  /** 원본 파일에서 시작하는 줄 번호 (1-based) */
  readonly originalStart: number;
  /** 원본 파일에서의 줄 수 */
  readonly originalCount: number;
  /** 새 파일에서 시작하는 줄 번호 (1-based) */
  readonly newStart: number;
  /** 새 파일에서의 줄 수 */
  readonly newCount: number;
  /** 헝크의 라인들 ('+', '-', ' ' 접두사 포함) */
  readonly lines: readonly string[];
}

/**
 * 파일별 패치 정보
 */
interface FilePatch {
  /** 원본 파일 경로 (`--- a/path`에서 추출, a/ 접두사 제거) */
  readonly originalPath: string;
  /** 새 파일 경로 (`+++ b/path`에서 추출, b/ 접두사 제거) */
  readonly newPath: string;
  /** 이 파일에 적용할 헝크 목록 */
  readonly hunks: readonly PatchHunk[];
}

/**
 * 단일 파일 변경 결과 — dry_run 결과 또는 실제 적용 결과
 */
interface FileChangeResult {
  readonly path: string;
  readonly hunksApplied: number;
  readonly linesAdded: number;
  readonly linesRemoved: number;
}

// ---------------------------------------------------------------------------
// 파서: unified diff → FilePatch[]
// ---------------------------------------------------------------------------

/**
 * `@@` 헝크 헤더를 파싱하여 범위 정보를 추출합니다.
 *
 * 형식: `@@ -originalStart[,originalCount] +newStart[,newCount] @@`
 *
 * @param header - `@@` 헤더 라인
 * @returns 파싱된 헝크 범위 정보, 실패 시 null
 */
function parseHunkHeader(
  header: string,
): Pick<PatchHunk, "originalStart" | "originalCount" | "newStart" | "newCount"> | null {
  // 예: @@ -1,4 +1,6 @@ or @@ -1 +1,2 @@
  const match = header.match(/^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/);
  if (!match) return null;
  return {
    originalStart: parseInt(match[1], 10),
    originalCount: match[2] !== undefined ? parseInt(match[2], 10) : 1,
    newStart: parseInt(match[3], 10),
    newCount: match[4] !== undefined ? parseInt(match[4], 10) : 1,
  };
}

/**
 * 파일 헤더에서 경로를 추출합니다.
 *
 * `--- a/src/foo.ts` → `src/foo.ts`
 * `--- /dev/null`    → `/dev/null`
 *
 * @param header - `---` 또는 `+++` 헤더 라인
 * @returns 파싱된 경로 (a/ 또는 b/ 접두사 제거)
 */
function parseFilePath(header: string): string {
  // --- a/path 또는 +++ b/path 형식에서 경로 추출
  const match = header.match(/^(?:---|\+\+\+)\s+(?:[ab]\/)?(.+?)(?:\t.*)?$/);
  if (!match) return "";
  return match[1].trim();
}

/**
 * unified diff 문자열을 FilePatch 배열로 파싱합니다.
 *
 * @param patch - unified diff 형식의 패치 문자열
 * @returns 파싱된 FilePatch 배열
 * @throws {Error} 유효하지 않은 diff 형식이거나 파일 경로를 찾을 수 없는 경우
 */
function parsePatch(patch: string): readonly FilePatch[] {
  const lines = patch.split("\n");
  const filePatches: FilePatch[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // diff --git 헤더는 건너뜀 (git diff 형식 호환)
    if (line.startsWith("diff ")) {
      i++;
      continue;
    }

    // index 라인 건너뜀 (예: index abc123..def456 100644)
    if (line.startsWith("index ")) {
      i++;
      continue;
    }

    // --- 헤더: 원본 파일 경로
    if (line.startsWith("--- ")) {
      const originalPath = parseFilePath(line);
      i++;

      // +++ 헤더: 새 파일 경로 (반드시 --- 다음에 와야 함)
      if (i >= lines.length || !lines[i].startsWith("+++ ")) {
        throw new Error(
          `Invalid diff format: expected '+++ ' header after '--- ' at line ${i + 1}`,
        );
      }
      const newPath = parseFilePath(lines[i]);
      i++;

      if (!newPath) {
        throw new Error(`Invalid diff format: could not parse file path at line ${i}`);
      }

      // 이 파일에 속하는 헝크들을 파싱
      const hunks: PatchHunk[] = [];
      while (i < lines.length && lines[i].startsWith("@@")) {
        const hunkHeader = parseHunkHeader(lines[i]);
        if (!hunkHeader) {
          throw new Error(`Invalid hunk header at line ${i + 1}: "${lines[i]}"`);
        }
        i++;

        // 헝크 본문 라인들 수집 (`+`, `-`, ` ` 접두사)
        const hunkLines: string[] = [];
        while (i < lines.length) {
          const hunkLine = lines[i];
          // 새 파일 헤더(`---`)나 다음 헝크(`@@`)가 나오면 이 헝크 종료
          if (hunkLine.startsWith("@@") || hunkLine.startsWith("--- ")) {
            break;
          }
          // diff --git, index 라인도 헝크 종료 신호
          if (hunkLine.startsWith("diff ") || hunkLine.startsWith("index ")) {
            break;
          }
          // 빈 줄은 컨텍스트 라인(' ')으로 취급
          if (hunkLine === "") {
            hunkLines.push(" ");
          } else {
            hunkLines.push(hunkLine);
          }
          i++;
        }

        hunks.push({
          ...hunkHeader,
          lines: hunkLines,
        });
      }

      filePatches.push({ originalPath, newPath, hunks });
      continue;
    }

    // 인식할 수 없는 라인은 건너뜀
    i++;
  }

  if (filePatches.length === 0) {
    throw new Error(
      "No valid file patches found. Make sure the patch uses unified diff format with '--- ' and '+++ ' headers.",
    );
  }

  return filePatches;
}

// ---------------------------------------------------------------------------
// 헝크 적용 로직
// ---------------------------------------------------------------------------

/**
 * 헝크의 컨텍스트(` `) 라인과 삭제(`-`) 라인이 파일 내용과 일치하는지 확인합니다.
 * fuzz_factor만큼의 불일치를 허용합니다.
 *
 * @param fileLines - 파일 전체 줄 배열
 * @param hunk - 적용할 헝크
 * @param offset - 실제 시작 줄 오프셋 (0-based, 이전 헝크 적용으로 인한 이동 반영)
 * @param fuzzFactor - 허용할 불일치 컨텍스트 라인 수
 * @returns 일치하면 true, 불일치하면 false
 */
function hunkMatches(
  fileLines: readonly string[],
  hunk: PatchHunk,
  offset: number,
  fuzzFactor: number,
): boolean {
  // hunk.originalStart는 1-based이므로 0-based로 변환 후 offset 적용
  let fileIdx = hunk.originalStart - 1 + offset;
  let mismatches = 0;

  for (const hunkLine of hunk.lines) {
    const prefix = hunkLine[0];
    const content = hunkLine.slice(1);

    if (prefix === "+" ) {
      // 추가 라인은 원본에서 비교할 내용 없음
      continue;
    }

    if (prefix === "-" || prefix === " ") {
      // 삭제 라인 또는 컨텍스트 라인: 원본 파일과 비교
      if (fileIdx < 0 || fileIdx >= fileLines.length) {
        mismatches++;
        if (mismatches > fuzzFactor) return false;
      } else if (fileLines[fileIdx] !== content) {
        if (prefix === "-") {
          // 삭제 라인 불일치는 fuzz로 허용 불가 (반드시 일치해야 함)
          return false;
        }
        mismatches++;
        if (mismatches > fuzzFactor) return false;
      }
      fileIdx++;
    }
  }

  return true;
}

/**
 * 헝크를 파일 줄 배열에 적용하여 새 줄 배열을 반환합니다.
 *
 * fuzz_factor가 있을 경우, 컨텍스트 라인이 불일치해도 원본 파일의 해당 라인을
 * 그대로 유지합니다 (패치의 컨텍스트 라인 내용으로 교체하지 않음).
 *
 * @param fileLines - 현재 파일 줄 배열 (변경 가능한 복사본)
 * @param hunk - 적용할 헝크
 * @param offset - 이전 헝크 적용으로 인한 줄 번호 오프셋 (0-based)
 * @returns 헝크가 적용된 새 줄 배열과 새 offset
 */
function applyHunk(
  fileLines: readonly string[],
  hunk: PatchHunk,
  offset: number,
): { readonly lines: readonly string[]; readonly newOffset: number } {
  const result: string[] = [...fileLines];
  // 삽입/삭제 위치: 1-based → 0-based + 이전 헝크 적용 오프셋
  const startPos = hunk.originalStart - 1 + offset;

  // 새 줄 배열을 라인 단위로 구성
  // 컨텍스트 라인(' ')은 원본 파일의 라인을 그대로 사용 (fuzz 시 원본 보존)
  // 삭제 라인('-')은 제외
  // 추가 라인('+')은 패치 내용 사용
  const addLines: string[] = [];
  let fileIdx = startPos;

  for (const hunkLine of hunk.lines) {
    const prefix = hunkLine[0];
    const content = hunkLine.slice(1);

    if (prefix === " ") {
      // 컨텍스트 라인: 원본 파일의 줄을 그대로 유지 (fuzz 허용 시 원본 보존)
      const originalLine =
        fileIdx >= 0 && fileIdx < fileLines.length ? fileLines[fileIdx] : content;
      addLines.push(originalLine);
      fileIdx++;
    } else if (prefix === "-") {
      // 삭제 라인: 결과에 포함하지 않음, 원본 파일 포인터만 진행
      fileIdx++;
    } else if (prefix === "+") {
      // 추가 라인: 패치 내용을 결과에 삽입
      addLines.push(content);
    }
  }

  // 원본에서 제거할 줄 수: 컨텍스트('-') 및 삭제('-') 라인의 총 수
  const removeCount = hunk.lines.filter((l) => l[0] === "-" || l[0] === " ").length;

  // 원본 라인 제거 후 새 라인 삽입
  result.splice(startPos, removeCount, ...addLines);

  const delta = addLines.length - removeCount;
  return {
    lines: result,
    newOffset: offset + delta,
  };
}

/**
 * 파일 내용에 모든 헝크를 순서대로 적용하여 새 파일 내용을 반환합니다.
 *
 * @param originalContent - 원본 파일 내용
 * @param hunks - 적용할 헝크 목록 (파일 내 순서대로)
 * @param fuzzFactor - 컨텍스트 라인 불일치 허용 수
 * @param filePath - 에러 메시지 출력용 파일 경로
 * @returns 헝크가 모두 적용된 새 파일 내용
 * @throws {Error} 헝크 매칭 실패 시
 */
function applyHunksToContent(
  originalContent: string,
  hunks: readonly PatchHunk[],
  fuzzFactor: number,
  filePath: string,
): string {
  // 끝에 개행이 없는 경우를 위해 split 후 trailing empty string 처리
  const endsWithNewline = originalContent.endsWith("\n");
  const rawLines = originalContent.split("\n");
  // 마지막 빈 문자열 제거 (split("\n")의 부작용)
  const fileLines: string[] =
    endsWithNewline && rawLines[rawLines.length - 1] === ""
      ? rawLines.slice(0, -1)
      : [...rawLines];

  let currentLines: readonly string[] = fileLines;
  let offset = 0;

  for (let idx = 0; idx < hunks.length; idx++) {
    const hunk = hunks[idx];
    const matched = hunkMatches(currentLines, hunk, offset, fuzzFactor);
    if (!matched) {
      throw new Error(
        `Failed to apply hunk ${idx + 1} to "${filePath}". ` +
          `Expected context at line ${hunk.originalStart} does not match. ` +
          `Try increasing fuzz_factor (current: ${fuzzFactor}) or verify the patch is up to date.`,
      );
    }
    const applied = applyHunk(currentLines, hunk, offset);
    currentLines = applied.lines;
    offset = applied.newOffset;
  }

  const resultContent = currentLines.join("\n");
  return endsWithNewline ? resultContent + "\n" : resultContent;
}

// ---------------------------------------------------------------------------
// 실행 함수
// ---------------------------------------------------------------------------

/**
 * apply_patch 도구 실행 함수
 *
 * 실행 흐름:
 * 1. unified diff 패치 문자열을 FilePatch 배열로 파싱
 * 2. 각 FilePatch에 대해:
 *    a. 원본 파일 읽기 (새 파일 생성이면 빈 문자열로 시작)
 *    b. 헝크를 순서대로 적용
 *    c. dry_run이 아니면 파일에 쓰기
 * 3. 적용된 파일 목록과 변경 통계를 반환
 *
 * @param params - Zod로 검증된 매개변수
 * @param context - 실행 컨텍스트 (작업 디렉토리, AbortSignal 등)
 * @returns 적용 결과 (변경된 파일 수, 각 파일의 추가/삭제 줄 수)
 */
async function execute(params: Params, context: ToolContext): Promise<ToolResult> {
  // 1. 패치 파싱
  let filePatches: readonly FilePatch[];
  try {
    filePatches = parsePatch(params.patch);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      output: `Failed to parse patch: ${message}`,
      isError: true,
    };
  }

  const results: FileChangeResult[] = [];
  const errors: string[] = [];

  // 2. 파일별 패치 적용
  for (const filePatch of filePatches) {
    // 적용 대상 경로: 새 파일 경로 우선, /dev/null이면 원본 경로 사용
    const targetRelPath =
      filePatch.newPath !== "/dev/null" ? filePatch.newPath : filePatch.originalPath;
    const targetAbsPath = resolvePath(context.workingDirectory, targetRelPath);

    // 원본 파일 읽기 (없으면 빈 문자열로 시작 — 새 파일 생성 케이스)
    let originalContent = "";
    if (filePatch.originalPath !== "/dev/null") {
      try {
        originalContent = await readFile(targetAbsPath, "utf-8");
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`Cannot read "${normalizePath(targetRelPath)}": ${message}`);
        continue;
      }
    }

    // 헝크 적용
    let newContent: string;
    try {
      newContent = applyHunksToContent(
        originalContent,
        filePatch.hunks,
        params.fuzz_factor,
        normalizePath(targetRelPath),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(message);
      continue;
    }

    // 변경 통계 계산
    const linesAdded = filePatch.hunks.reduce(
      (sum, h) => sum + h.lines.filter((l) => l[0] === "+").length,
      0,
    );
    const linesRemoved = filePatch.hunks.reduce(
      (sum, h) => sum + h.lines.filter((l) => l[0] === "-").length,
      0,
    );

    // dry_run이 아닌 경우 실제 파일 쓰기
    if (!params.dry_run) {
      try {
        await writeFile(targetAbsPath, newContent, "utf-8");
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`Cannot write "${normalizePath(targetRelPath)}": ${message}`);
        continue;
      }
    }

    results.push({
      path: normalizePath(targetRelPath),
      hunksApplied: filePatch.hunks.length,
      linesAdded,
      linesRemoved,
    });
  }

  // 3. 결과 출력 생성
  if (errors.length > 0 && results.length === 0) {
    // 전부 실패
    return {
      output: `Failed to apply patch:\n${errors.map((e) => `  - ${e}`).join("\n")}`,
      isError: true,
    };
  }

  const prefix = params.dry_run ? "[dry-run] Would apply" : "Applied";
  const fileList = results
    .map(
      (r) =>
        `  ${r.path}: ${r.hunksApplied} hunk(s), +${r.linesAdded}/-${r.linesRemoved} lines`,
    )
    .join("\n");

  let output = `${prefix} patch to ${results.length} file(s):\n${fileList}`;
  if (errors.length > 0) {
    output += `\n\nWarnings (${errors.length} file(s) failed):\n${errors.map((e) => `  - ${e}`).join("\n")}`;
  }

  return {
    output,
    isError: false,
    metadata: {
      filesChanged: results.length,
      filesFailed: errors.length,
      dryRun: params.dry_run,
      changes: results,
    },
  };
}

// ---------------------------------------------------------------------------
// 도구 정의 내보내기
// ---------------------------------------------------------------------------

/**
 * apply_patch 도구 정의 — 내보내기하여 도구 레지스트리에 등록
 *
 * @example
 * ```typescript
 * import { applyPatchTool } from './definitions/apply-patch.js';
 * registry.register(applyPatchTool);
 * ```
 */
export const applyPatchTool: ToolDefinition<Params> = {
  name: "apply_patch",
  description:
    "Apply a unified diff format patch to one or more files. " +
    "Supports multi-file patches, dry_run preview, and fuzz_factor for tolerating minor context mismatches. " +
    "Use --- a/path and +++ b/path headers. " +
    "Prefer this tool over multiple file_edit calls when changing several locations at once.",
  parameterSchema: paramSchema,
  permissionLevel: "confirm",
  timeoutMs: 60_000,
  execute,
};

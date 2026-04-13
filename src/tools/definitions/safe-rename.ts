/**
 * 안전한 리네이밍 도구 — LSP 기반으로 모든 참조를 자동 업데이트하는 리네이밍 도구
 *
 * LSP(Language Server Protocol)를 활용하여 심볼의 모든 사용처를 정확히 파악하고,
 * 한 번에 이름을 변경합니다. 수동 검색/치환보다 안전합니다.
 *
 * dry_run 모드:
 * - true (기본값): 변경 미리보기만 표시하고 실제 파일은 수정하지 않음
 * - false: 모든 파일에 변경사항을 실제로 적용
 *
 * 분석 엔진:
 * 1. 기본: LSP 서버를 통한 rename (정확도 100%)
 * 2. 폴백: find_references + 수동 편집 제안 (LSP 미설치 시)
 *
 * 권한 수준: "confirm" — 파일을 수정하므로 사용자 확인이 필요합니다.
 */
import { z } from "zod";
import { readFile, writeFile } from "node:fs/promises";
import { extname } from "node:path";
import { type ToolDefinition, type ToolContext, type ToolResult } from "../types.js";
import { resolvePath } from "../../utils/path.js";

/**
 * 파일 확장자 → LSP 언어 ID 매핑
 */
const EXT_TO_LANG: Readonly<Record<string, string>> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "typescript",
  ".jsx": "typescript",
  ".py": "python",
  ".go": "go",
  ".rs": "rust",
  ".java": "java",
};

/** LSP rename 편집 결과 타입 */
interface RenameEdit {
  readonly filePath: string;
  readonly edits: readonly {
    readonly startLine: number;
    readonly startColumn: number;
    readonly endLine: number;
    readonly endColumn: number;
    readonly newText: string;
  }[];
}

/**
 * 매개변수 스키마 — 리네이밍 대상과 새 이름
 */
const paramSchema = z.object({
  /** 심볼이 있는 파일의 절대 경로 */
  file_path: z.string().describe("심볼이 있는 파일의 절대 경로"),
  /** 줄 번호 */
  line: z.number().describe("줄 번호"),
  /** 열 번호 */
  column: z.number().describe("열 번호"),
  /** 새 이름 */
  new_name: z.string().describe("새 이름"),
  /** 변경 미리보기만 (실제 적용 안 함) */
  dry_run: z.boolean().optional().default(true).describe("변경 미리보기만 (실제 적용 안 함)"),
});

type Params = z.infer<typeof paramSchema>;

/**
 * LSP 세션을 획득하는 헬퍼
 */
async function acquireSession(
  filePath: string,
  cwd: string,
): Promise<
  | {
      rename(
        filePath: string,
        line: number,
        column: number,
        newName: string,
      ): Promise<readonly RenameEdit[]>;
    }
  | undefined
> {
  try {
    const { getLSPManager } = await import("../../lsp/manager.js");
    const ext = extname(filePath);
    const lang = EXT_TO_LANG[ext];
    if (!lang) return undefined;

    const manager = getLSPManager();
    const available = await manager.detectAvailableServers(cwd);
    if (!available.includes(lang as never)) return undefined;

    return await manager.acquire(lang as never, cwd);
  } catch {
    return undefined;
  }
}

/**
 * 파일에서 특정 줄의 심볼 이름을 추출
 */
async function extractSymbolAtPosition(
  filePath: string,
  line: number,
  column: number,
): Promise<string | undefined> {
  try {
    const content = await readFile(filePath, "utf-8");
    const lines = content.split("\n");
    const lineText = lines[line - 1];
    if (!lineText) return undefined;

    const col = column - 1;
    let start = col;
    let end = col;
    while (start > 0 && /\w/.test(lineText[start - 1])) start--;
    while (end < lineText.length && /\w/.test(lineText[end])) end++;

    const word = lineText.slice(start, end);
    return word || undefined;
  } catch {
    return undefined;
  }
}

/**
 * 프로젝트 루트 기준 상대 경로로 변환
 */
function toRelative(filePath: string, cwd: string): string {
  if (filePath.startsWith(cwd)) {
    const rel = filePath.slice(cwd.length);
    return rel.startsWith("/") ? rel.slice(1) : rel;
  }
  return filePath;
}

/**
 * 변경 미리보기를 포맷팅
 */
function formatDryRunOutput(edits: readonly RenameEdit[], cwd: string): string {
  if (edits.length === 0) {
    return "No changes needed.";
  }

  let totalEdits = 0;
  for (const fileEdit of edits) {
    totalEdits += fileEdit.edits.length;
  }

  const lines: string[] = [];
  lines.push(
    `Rename preview: ${totalEdits} edit${totalEdits === 1 ? "" : "s"} across ${edits.length} file${edits.length === 1 ? "" : "s"}:\n`,
  );

  for (const fileEdit of edits) {
    const rel = toRelative(fileEdit.filePath, cwd);
    lines.push(`  ${rel}:`);
    for (const edit of fileEdit.edits) {
      lines.push(
        `    L${edit.startLine}:${edit.startColumn}-L${edit.endLine}:${edit.endColumn} → "${edit.newText}"`,
      );
    }
    lines.push("");
  }

  lines.push("Run with dry_run=false to apply these changes.");

  return lines.join("\n");
}

/**
 * 편집 내용을 실제 파일에 적용
 *
 * 각 파일을 읽어서 편집을 역순으로 적용합니다 (뒤에서부터 적용해야 줄/열 번호가 어긋나지 않음).
 */
async function applyEdits(
  edits: readonly RenameEdit[],
): Promise<{ readonly filesModified: number; readonly totalEdits: number }> {
  let filesModified = 0;
  let totalEdits = 0;

  for (const fileEdit of edits) {
    const content = await readFile(fileEdit.filePath, "utf-8");
    const lines = content.split("\n");

    // 편집을 역순으로 정렬 (뒤에서부터 적용)
    const sortedEdits = [...fileEdit.edits].sort((a, b) => {
      if (a.startLine !== b.startLine) return b.startLine - a.startLine;
      return b.startColumn - a.startColumn;
    });

    for (const edit of sortedEdits) {
      const startLineIdx = edit.startLine - 1;
      const endLineIdx = edit.endLine - 1;

      if (startLineIdx === endLineIdx) {
        // 단일 줄 편집
        const line = lines[startLineIdx];
        if (line !== undefined) {
          lines[startLineIdx] =
            line.slice(0, edit.startColumn - 1) + edit.newText + line.slice(edit.endColumn - 1);
        }
      } else {
        // 다중 줄 편집
        const startLine = lines[startLineIdx] ?? "";
        const endLine = lines[endLineIdx] ?? "";
        const newLine =
          startLine.slice(0, edit.startColumn - 1) +
          edit.newText +
          endLine.slice(edit.endColumn - 1);
        lines.splice(startLineIdx, endLineIdx - startLineIdx + 1, newLine);
      }

      totalEdits++;
    }

    await writeFile(fileEdit.filePath, lines.join("\n"), "utf-8");
    filesModified++;
  }

  return { filesModified, totalEdits };
}

/**
 * grep 기반 폴백 — LSP가 없을 때 리네이밍 대상 위치를 찾아 제안
 */
async function fallbackSuggestion(
  filePath: string,
  line: number,
  column: number,
  newName: string,
  cwd: string,
): Promise<string> {
  const symbolName = await extractSymbolAtPosition(filePath, line, column);
  if (!symbolName) {
    return "LSP is not available and could not extract symbol name for fallback.";
  }

  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execFileAsync = promisify(execFile);

  try {
    const { stdout } = await execFileAsync(
      "rg",
      [
        "--line-number",
        "--no-heading",
        "--color",
        "never",
        "--count-matches",
        `\\b${symbolName}\\b`,
        cwd,
      ],
      { maxBuffer: 5 * 1024 * 1024, timeout: 15_000 },
    );

    const matchLines = stdout
      .trimEnd()
      .split("\n")
      .filter((l) => l.trim());
    let totalMatches = 0;
    for (const matchLine of matchLines) {
      const count = parseInt(matchLine.split(":").pop() ?? "0", 10);
      totalMatches += count;
    }

    return (
      `LSP is not available. Manual rename suggested:\n\n` +
      `Symbol: "${symbolName}" → "${newName}"\n` +
      `Found approximately ${totalMatches} occurrence${totalMatches === 1 ? "" : "s"} across ${matchLines.length} file${matchLines.length === 1 ? "" : "s"}.\n\n` +
      `Suggested approach:\n` +
      `1. Use find_references to verify all usage locations\n` +
      `2. Use file_edit to rename each occurrence\n` +
      `3. Run typecheck to verify no breakage\n\n` +
      `Warning: grep-based rename may miss or incorrectly rename occurrences in strings, comments, or dynamically generated names.`
    );
  } catch {
    return (
      `LSP is not available. Could not search for "${symbolName}".\n` +
      `Use file_edit to manually rename occurrences.`
    );
  }
}

/**
 * safe_rename 실행 함수
 *
 * 실행 흐름:
 * 1. LSP 세션 획득 시도
 * 2. LSP rename 요청
 * 3. dry_run이면 미리보기 출력, 아니면 적용
 * 4. LSP 불가 시 grep 기반 제안
 */
async function execute(params: Params, context: ToolContext): Promise<ToolResult> {
  const startTime = Date.now();
  const filePath = resolvePath(context.workingDirectory, params.file_path);

  try {
    const session = await acquireSession(filePath, context.workingDirectory);

    if (session) {
      const edits = await session.rename(filePath, params.line, params.column, params.new_name);

      if (edits.length === 0) {
        const elapsed = Date.now() - startTime;
        return {
          output: `No rename edits generated at ${toRelative(filePath, context.workingDirectory)}:${params.line}:${params.column}`,
          isError: false,
          metadata: {
            toolName: "safe_rename",
            resultCount: 0,
            duration: `${elapsed}ms`,
            backend: "lsp",
            dryRun: params.dry_run,
          },
        };
      }

      if (params.dry_run) {
        const output = formatDryRunOutput(edits, context.workingDirectory);
        const elapsed = Date.now() - startTime;
        return {
          output,
          isError: false,
          metadata: {
            toolName: "safe_rename",
            resultCount: edits.length,
            duration: `${elapsed}ms`,
            backend: "lsp",
            dryRun: true,
          },
        };
      }

      // 실제 적용
      const { filesModified, totalEdits } = await applyEdits(edits);
      const elapsed = Date.now() - startTime;
      return {
        output:
          `Rename applied: ${totalEdits} edit${totalEdits === 1 ? "" : "s"} across ${filesModified} file${filesModified === 1 ? "" : "s"}.\n\n` +
          `Tip: Run typecheck to verify the rename didn't break anything.`,
        isError: false,
        metadata: {
          toolName: "safe_rename",
          filesModified,
          totalEdits,
          duration: `${elapsed}ms`,
          backend: "lsp",
          dryRun: false,
        },
      };
    }

    // LSP 불가 → 폴백 제안
    const fallbackOutput = await fallbackSuggestion(
      filePath,
      params.line,
      params.column,
      params.new_name,
      context.workingDirectory,
    );
    const elapsed = Date.now() - startTime;
    return {
      output: fallbackOutput,
      isError: false,
      metadata: {
        toolName: "safe_rename",
        resultCount: 0,
        duration: `${elapsed}ms`,
        backend: "grep-fallback",
        dryRun: params.dry_run,
      },
    };
  } catch (error) {
    const elapsed = Date.now() - startTime;
    const message = error instanceof Error ? error.message : String(error);
    return {
      output: `safe_rename failed: ${message}`,
      isError: true,
      metadata: {
        toolName: "safe_rename",
        duration: `${elapsed}ms`,
      },
    };
  }
}

/**
 * safe_rename 도구 정의
 */
export const safeRenameTool: ToolDefinition<Params> = {
  name: "safe_rename",
  description:
    "모든 참조를 자동 업데이트하는 안전한 리네이밍 (LSP 기반). " +
    "심볼 이름을 변경하면 import, 사용처, re-export 등을 모두 자동 수정합니다. " +
    "사용 시점: " +
    "- 함수/변수/클래스 이름을 변경할 때 " +
    "- 리팩토링으로 더 나은 이름을 적용할 때 " +
    "dry_run=true (기본값)로 먼저 미리보기를 확인하세요. " +
    "file_edit을 사용해야 할 때: " +
    "- 코드 내용 자체를 수정할 때 (이름이 아닌 로직 변경)",
  parameterSchema: paramSchema,
  permissionLevel: "confirm",
  timeoutMs: 60_000,
  execute,
};

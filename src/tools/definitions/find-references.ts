/**
 * 참조 찾기 도구 — 심볼의 모든 사용처를 정확히 찾는 LSP 기반 도구
 *
 * LSP(Language Server Protocol)를 활용하여 함수, 클래스, 변수 등이
 * 사용된 모든 위치를 정확하게 반환합니다.
 * 리팩토링 전 영향 범위 파악에 필수적입니다.
 *
 * 분석 엔진:
 * 1. 기본: LSP 서버를 통한 참조 검색 (정확도 100%)
 * 2. 폴백: grep 기반 패턴 매칭 (LSP 서버 미설치 시)
 *
 * 권한 수준: "safe" — 읽기 전용 조회이므로 안전합니다.
 */
import { z } from "zod";
import { readFile } from "node:fs/promises";
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

/**
 * 매개변수 스키마 — 심볼 위치와 옵션을 정의
 */
const paramSchema = z.object({
  /** 심볼이 있는 파일의 절대 경로 */
  file_path: z.string().describe("심볼이 있는 파일의 절대 경로"),
  /** 심볼의 줄 번호 */
  line: z.number().describe("심볼의 줄 번호"),
  /** 심볼의 열 번호 */
  column: z.number().describe("심볼의 열 번호"),
  /** 정의 위치 포함 여부 */
  include_declaration: z
    .boolean()
    .optional()
    .default(true)
    .describe("정의 위치 포함 여부"),
});

type Params = z.infer<typeof paramSchema>;

/**
 * LSP 세션을 획득하는 헬퍼 — LSP 매니저가 없으면 undefined 반환
 */
async function acquireSession(
  filePath: string,
  cwd: string,
): Promise<
  | {
      findReferences(
        filePath: string,
        line: number,
        column: number,
        includeDeclaration?: boolean,
      ): Promise<
        readonly {
          filePath: string;
          line: number;
          column: number;
          context: string;
          isDefinition: boolean;
        }[]
      >;
    }
  | undefined
> {
  try {
    const { LSPManager } = await import("../../lsp/manager.js");
    const ext = extname(filePath);
    const lang = EXT_TO_LANG[ext];
    if (!lang) return undefined;

    const manager = new LSPManager();
    const available = await manager.detectAvailableServers(cwd);
    if (!available.includes(lang as never)) return undefined;

    return await manager.acquire(lang as never, cwd);
  } catch {
    return undefined;
  }
}

/**
 * 파일에서 특정 줄의 심볼 이름을 추출 (grep 폴백용)
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

    // column 위치에서 식별자(word)를 추출
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
 * grep 기반 폴백 — LSP가 없을 때 심볼 사용처를 패턴 매칭으로 검색
 */
async function fallbackGrep(symbolName: string, cwd: string): Promise<string> {
  if (!symbolName) {
    return "LSP is not available and could not extract symbol name for fallback search.";
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
        "--color", "never",
        "--max-count", "50",
        `\\b${symbolName}\\b`,
        cwd,
      ],
      { maxBuffer: 5 * 1024 * 1024, timeout: 15_000 },
    );

    if (!stdout.trim()) {
      return `No references found for "${symbolName}" (grep fallback).`;
    }

    const lines = stdout.trimEnd().split("\n").slice(0, 50);
    return `Reference search fell back to grep. Results for "${symbolName}":\n\n${lines.join("\n")}\n\nNote: grep fallback may include false positives (comments, strings).`;
  } catch {
    return `No references found for "${symbolName}" (grep fallback).`;
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
 * find_references 실행 함수
 *
 * 실행 흐름:
 * 1. LSP 세션 획득 시도
 * 2. LSP로 참조 위치 조회
 * 3. LSP 실패 시 grep 폴백
 * 4. 결과를 파일별로 그룹핑하여 포맷팅
 */
async function execute(params: Params, context: ToolContext): Promise<ToolResult> {
  const startTime = Date.now();
  const filePath = resolvePath(context.workingDirectory, params.file_path);

  try {
    const session = await acquireSession(filePath, context.workingDirectory);

    if (session) {
      const results = await session.findReferences(
        filePath,
        params.line,
        params.column,
        params.include_declaration,
      );

      if (results.length === 0) {
        const elapsed = Date.now() - startTime;
        return {
          output: `No references found at ${toRelative(filePath, context.workingDirectory)}:${params.line}:${params.column}`,
          isError: false,
          metadata: {
            toolName: "find_references",
            resultCount: 0,
            duration: `${elapsed}ms`,
            backend: "lsp",
          },
        };
      }

      // 파일별로 그룹핑
      const byFile = new Map<string, typeof results[number][]>();
      for (const ref of results) {
        const rel = toRelative(ref.filePath, context.workingDirectory);
        const existing = byFile.get(rel) ?? [];
        existing.push(ref);
        byFile.set(rel, existing);
      }

      const defCount = results.filter((r) => r.isDefinition).length;
      const refCount = results.length - defCount;
      const lines: string[] = [];
      lines.push(
        `Found ${results.length} reference${results.length === 1 ? "" : "s"} ` +
          `(${defCount} definition${defCount === 1 ? "" : "s"}, ${refCount} usage${refCount === 1 ? "" : "s"}) ` +
          `across ${byFile.size} file${byFile.size === 1 ? "" : "s"}:\n`,
      );

      for (const [file, refs] of byFile) {
        lines.push(`  ${file}:`);
        for (const ref of refs) {
          const tag = ref.isDefinition ? " [definition]" : "";
          lines.push(`    :${ref.line}:${ref.column}${tag}`);
          if (ref.context) {
            lines.push(`      ${ref.context.trim()}`);
          }
        }
        lines.push("");
      }

      const elapsed = Date.now() - startTime;
      return {
        output: lines.join("\n"),
        isError: false,
        metadata: {
          toolName: "find_references",
          resultCount: results.length,
          fileCount: byFile.size,
          duration: `${elapsed}ms`,
          backend: "lsp",
        },
      };
    }

    // LSP 불가 → grep 폴백
    const symbolName = await extractSymbolAtPosition(filePath, params.line, params.column);
    const fallbackOutput = await fallbackGrep(symbolName ?? "", context.workingDirectory);
    const elapsed = Date.now() - startTime;
    return {
      output: fallbackOutput,
      isError: false,
      metadata: {
        toolName: "find_references",
        resultCount: 0,
        duration: `${elapsed}ms`,
        backend: "grep-fallback",
      },
    };
  } catch (error) {
    const elapsed = Date.now() - startTime;
    const message = error instanceof Error ? error.message : String(error);
    return {
      output: `find_references failed: ${message}`,
      isError: true,
      metadata: {
        toolName: "find_references",
        resultCount: 0,
        duration: `${elapsed}ms`,
      },
    };
  }
}

/**
 * find_references 도구 정의
 */
export const findReferencesTool: ToolDefinition<Params> = {
  name: "find_references",
  description:
    "심볼의 모든 사용처를 정확히 찾습니다 (LSP 기반, 100% 정확). " +
    "리팩토링 전 영향 범위 파악, 사용 횟수 확인에 필수적입니다. " +
    "사용 시점: " +
    "- 함수/변수가 어디서 사용되는지 확인할 때 " +
    "- 리팩토링 전 영향 범위 파악 " +
    "- dead code 탐지 " +
    "grep_search를 사용해야 할 때: " +
    "- 텍스트 패턴/문자열 검색 (코드 심볼이 아닌 경우)",
  parameterSchema: paramSchema,
  permissionLevel: "safe",
  timeoutMs: 30_000,
  execute,
};

/**
 * 정의 이동 도구 — 심볼의 정의 위치를 정확히 찾는 LSP 기반 도구
 *
 * LSP(Language Server Protocol)를 활용하여 함수, 클래스, 변수 등의
 * 정의가 위치한 파일과 줄 번호를 정확하게 반환합니다.
 * cross-file 참조도 지원하며, grep 기반 검색보다 훨씬 정확합니다.
 *
 * 분석 엔진:
 * 1. 기본: LSP 서버를 통한 정의 이동 (정확도 100%)
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
 * 매개변수 스키마 — 심볼 위치와 이름을 정의
 */
const paramSchema = z.object({
  /** 심볼이 있는 파일의 절대 경로 */
  file_path: z.string().describe("심볼이 있는 파일의 절대 경로"),
  /** 심볼의 줄 번호 (1부터 시작) */
  line: z.number().describe("심볼의 줄 번호 (1부터 시작)"),
  /** 심볼의 열 번호 (1부터 시작) */
  column: z.number().describe("심볼의 열 번호 (1부터 시작)"),
  /** 찾으려는 심볼 이름 (컨텍스트 제공용) */
  symbol_name: z.string().optional().describe("찾으려는 심볼 이름 (컨텍스트 제공용)"),
});

type Params = z.infer<typeof paramSchema>;

/**
 * LSP 세션을 획득하는 헬퍼 — LSP 매니저가 없으면 undefined 반환
 *
 * @param filePath - 대상 파일 경로
 * @param cwd - 프로젝트 루트 디렉토리
 * @returns LSP 세션 또는 undefined
 */
async function acquireSession(
  filePath: string,
  cwd: string,
): Promise<
  | {
      gotoDefinition(
        filePath: string,
        line: number,
        column: number,
      ): Promise<readonly { filePath: string; line: number; column: number; preview: string }[]>;
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
 * 파일에서 특정 줄의 내용을 읽어 미리보기 텍스트를 반환
 *
 * @param filePath - 파일 절대 경로
 * @param line - 줄 번호 (1-based)
 * @returns 줄 내용 (트림된 문자열)
 */
async function readLinePreview(filePath: string, line: number): Promise<string> {
  try {
    const content = await readFile(filePath, "utf-8");
    const lines = content.split("\n");
    const idx = line - 1;
    if (idx >= 0 && idx < lines.length) {
      return lines[idx].trimEnd();
    }
    return "";
  } catch {
    return "";
  }
}

/**
 * grep 기반 폴백 — LSP가 없을 때 심볼 정의를 패턴 매칭으로 검색
 *
 * @param symbolName - 검색할 심볼 이름
 * @param cwd - 검색 디렉토리
 * @returns 검색 결과 텍스트
 */
async function fallbackGrep(symbolName: string, cwd: string): Promise<string> {
  if (!symbolName) {
    return "LSP is not available and no symbol_name was provided for fallback search.";
  }

  const patterns = [
    `(?:export\\s+)?(?:async\\s+)?function\\s+${symbolName}\\b`,
    `(?:export\\s+)?(?:const|let|var)\\s+${symbolName}\\s*[=:]`,
    `(?:export\\s+)?(?:abstract\\s+)?class\\s+${symbolName}\\b`,
    `(?:export\\s+)?interface\\s+${symbolName}\\b`,
    `(?:export\\s+)?type\\s+${symbolName}\\s*[=<]`,
    `(?:export\\s+)?enum\\s+${symbolName}\\b`,
    `def\\s+${symbolName}\\s*\\(`,
    `func\\s+${symbolName}\\s*\\(`,
  ];

  const combinedPattern = patterns.join("|");

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
        "--max-count", "10",
        combinedPattern,
        cwd,
      ],
      { maxBuffer: 5 * 1024 * 1024, timeout: 15_000 },
    );

    if (!stdout.trim()) {
      return `No definition found for "${symbolName}" (grep fallback).`;
    }

    const lines = stdout.trimEnd().split("\n").slice(0, 10);
    return `Definition search fell back to grep. Results for "${symbolName}":\n\n${lines.join("\n")}`;
  } catch {
    return `No definition found for "${symbolName}" (grep fallback).`;
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
 * goto_definition 실행 함수
 *
 * 실행 흐름:
 * 1. 파일 경로 정규화
 * 2. LSP 세션 획득 시도
 * 3. LSP로 정의 위치 조회
 * 4. LSP 실패 시 grep 폴백
 * 5. 결과 포맷팅
 */
async function execute(params: Params, context: ToolContext): Promise<ToolResult> {
  const startTime = Date.now();
  const filePath = resolvePath(context.workingDirectory, params.file_path);

  try {
    // LSP 세션 획득 시도
    const session = await acquireSession(filePath, context.workingDirectory);

    if (session) {
      const results = await session.gotoDefinition(filePath, params.line, params.column);

      if (results.length === 0) {
        const elapsed = Date.now() - startTime;
        return {
          output: `No definition found at ${toRelative(filePath, context.workingDirectory)}:${params.line}:${params.column}`,
          isError: false,
          metadata: {
            toolName: "goto_definition",
            resultCount: 0,
            duration: `${elapsed}ms`,
            backend: "lsp",
          },
        };
      }

      const lines: string[] = [];
      const symbolLabel = params.symbol_name ? `"${params.symbol_name}"` : "symbol";
      lines.push(`Definition of ${symbolLabel} found:\n`);

      for (const def of results) {
        const rel = toRelative(def.filePath, context.workingDirectory);
        lines.push(`  ${rel}:${def.line}:${def.column}`);
        if (def.preview) {
          lines.push(`    ${def.preview.trim()}`);
        }
        lines.push("");
      }

      const elapsed = Date.now() - startTime;
      return {
        output: lines.join("\n"),
        isError: false,
        metadata: {
          toolName: "goto_definition",
          resultCount: results.length,
          duration: `${elapsed}ms`,
          backend: "lsp",
          filePath: results[0]?.filePath,
          line: results[0]?.line,
        },
      };
    }

    // LSP 불가 → grep 폴백
    const symbolName = params.symbol_name ?? "";
    if (!symbolName) {
      // symbol_name 없이 grep 폴백은 불가능 → 파일에서 직접 읽기 시도
      const preview = await readLinePreview(filePath, params.line);
      const elapsed = Date.now() - startTime;
      return {
        output:
          `LSP is not available. Current position:\n\n` +
          `  ${toRelative(filePath, context.workingDirectory)}:${params.line}:${params.column}\n` +
          `    ${preview}\n\n` +
          `Tip: Provide symbol_name for grep-based fallback search.`,
        isError: false,
        metadata: {
          toolName: "goto_definition",
          resultCount: 0,
          duration: `${elapsed}ms`,
          backend: "none",
        },
      };
    }

    const fallbackOutput = await fallbackGrep(symbolName, context.workingDirectory);
    const elapsed = Date.now() - startTime;
    return {
      output: fallbackOutput,
      isError: false,
      metadata: {
        toolName: "goto_definition",
        resultCount: 0,
        duration: `${elapsed}ms`,
        backend: "grep-fallback",
      },
    };
  } catch (error) {
    const elapsed = Date.now() - startTime;
    const message = error instanceof Error ? error.message : String(error);
    return {
      output: `goto_definition failed: ${message}`,
      isError: true,
      metadata: {
        toolName: "goto_definition",
        resultCount: 0,
        duration: `${elapsed}ms`,
      },
    };
  }
}

/**
 * goto_definition 도구 정의
 */
export const gotoDefinitionTool: ToolDefinition<Params> = {
  name: "goto_definition",
  description:
    "심볼의 정의 위치를 정확히 찾습니다 (LSP 기반, cross-file 지원). " +
    "함수, 클래스, 변수, 타입 등 어떤 심볼이든 정의된 파일과 줄 번호를 반환합니다. " +
    "사용 시점: " +
    "- import된 함수/타입의 원본 소스를 찾을 때 " +
    "- 변수가 어디서 선언되었는지 확인할 때 " +
    "- 상속/구현 관계를 추적할 때 " +
    "symbol_search를 사용해야 할 때: " +
    "- 이름으로 심볼을 검색할 때 (위치를 모를 때)",
  parameterSchema: paramSchema,
  permissionLevel: "safe",
  timeoutMs: 30_000,
  execute,
};

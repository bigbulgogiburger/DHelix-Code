/**
 * 심볼 검색 도구 — 프로젝트에서 함수, 클래스, 인터페이스, 타입 등을 시맨틱 검색하는 도구
 *
 * grep_search보다 정확합니다 — 주석이나 문자열 안의 일치를 무시하고,
 * 실제 코드 선언(declaration)만 검색합니다.
 *
 * 분석 엔진:
 * 1. 기본: repo-map의 정규식 기반 심볼 추출 (빠르고 가벼움)
 * 2. 폴백: grep_search로 패턴 기반 검색 (심볼 추출 실패 시)
 *
 * 주요 기능:
 * - 부분 일치(substring) 심볼 이름 검색
 * - 심볼 종류별 필터링 (function, class, interface, type 등)
 * - export된 심볼만 필터링
 * - 함수 시그니처 포함 옵션
 * - 디렉토리 범위 제한
 *
 * 권한 수준: "safe" — 파일 시스템을 읽기만 하므로 안전합니다.
 */
import { z } from "zod";
import { readFile } from "node:fs/promises";
import { type ToolDefinition, type ToolContext, type ToolResult } from "../types.js";
import { resolvePath } from "../../utils/path.js";
import {
  buildRepoMap,
  type RepoSymbol,
  type RepoMap,
} from "../../indexing/repo-map.js";

/**
 * 매개변수 스키마 — 심볼 검색 패턴과 필터 옵션을 정의
 */
const paramSchema = z.object({
  /** 검색할 심볼 이름 (부분 일치 지원) */
  query: z.string().describe("검색할 심볼 이름 (부분 일치 지원)"),
  /** 심볼 종류 필터 (생략 시 전체) */
  kind: z
    .enum(["function", "class", "interface", "type", "variable", "method", "enum", "constant"])
    .optional()
    .describe("심볼 종류 필터 (생략 시 전체)"),
  /** 검색 범위 디렉토리 (생략 시 프로젝트 전체) */
  directory: z
    .string()
    .optional()
    .describe("검색 범위 디렉토리 (생략 시 프로젝트 전체)"),
  /** 내보낸(export) 심볼만 검색 */
  exported_only: z
    .boolean()
    .optional()
    .default(false)
    .describe("내보낸(export) 심볼만 검색"),
  /** 함수 시그니처 포함 */
  include_signature: z
    .boolean()
    .optional()
    .default(true)
    .describe("함수 시그니처 포함"),
  /** 최대 결과 수 */
  max_results: z
    .number()
    .optional()
    .default(30)
    .describe("최대 결과 수"),
});

type Params = z.infer<typeof paramSchema>;

/**
 * RepoSymbol의 kind를 파라미터의 kind와 매핑
 *
 * repo-map은 "const"를 사용하지만, 사용자는 "variable" 또는 "constant"로 검색할 수 있습니다.
 * "method"는 현재 정규식 기반으로는 감지하지 못하므로 "function"으로 폴백합니다.
 */
function matchesKind(symbolKind: RepoSymbol["kind"], filterKind: string): boolean {
  if (filterKind === "variable" || filterKind === "constant") {
    return symbolKind === "const";
  }
  if (filterKind === "method") {
    return symbolKind === "function";
  }
  return symbolKind === filterKind;
}

/**
 * 파일에서 심볼이 선언된 줄의 시그니처를 추출
 *
 * 함수/메서드의 경우 전체 시그니처(매개변수, 반환 타입 포함)를 가져옵니다.
 * 여러 줄에 걸쳐 작성된 시그니처도 닫는 괄호까지 포함합니다.
 *
 * @param content - 파일의 전체 내용
 * @param line - 심볼이 선언된 줄 번호 (1부터 시작)
 * @returns 시그니처 문자열 (시작/끝 공백 제거)
 */
function extractSignature(content: string, line: number): string {
  const lines = content.split("\n");
  const startIdx = line - 1;
  if (startIdx < 0 || startIdx >= lines.length) {
    return lines[startIdx]?.trim() ?? "";
  }

  let signature = lines[startIdx].trim();

  // 여는 중괄호 전까지 또는 닫는 괄호+반환타입까지 포함
  // 여러 줄에 걸친 시그니처 처리 (최대 5줄까지 탐색)
  if (!signature.includes("{") && !signature.includes(";")) {
    for (let i = startIdx + 1; i < Math.min(startIdx + 6, lines.length); i++) {
      const nextLine = lines[i].trim();
      signature += " " + nextLine;
      if (nextLine.includes("{") || nextLine.includes(";")) {
        break;
      }
    }
  }

  // 중괄호 이후의 본문을 제거하여 시그니처만 남김
  const braceIdx = signature.indexOf("{");
  if (braceIdx !== -1) {
    signature = signature.substring(0, braceIdx).trim();
  }

  return signature;
}

/**
 * 검색 결과를 포맷팅하여 사람이 읽기 쉬운 문자열로 변환
 *
 * @param results - 매칭된 심볼 배열 (시그니처 포함)
 * @param query - 원본 검색 쿼리
 * @param fileCount - 검색된 파일 수
 * @returns 포맷팅된 출력 문자열
 */
function formatResults(
  results: ReadonlyArray<{
    readonly symbol: RepoSymbol;
    readonly signature: string;
  }>,
  query: string,
  fileCount: number,
): string {
  if (results.length === 0) {
    return `No symbols found matching "${query}".`;
  }

  const header = `Found ${results.length} symbol${results.length === 1 ? "" : "s"} matching "${query}" (searched ${fileCount} files):`;
  const lines: string[] = [header, ""];

  for (const { symbol, signature } of results) {
    const exportTag = symbol.exported ? "  [exported]" : "";
    const locationLine = `  ${symbol.file}:${symbol.line}`;
    const signatureLine = signature
      ? `    ${symbol.kind} ${signature}${exportTag}`
      : `    ${symbol.kind} ${symbol.name}${exportTag}`;
    lines.push(locationLine);
    lines.push(signatureLine);
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * grep 기반 폴백 검색 — buildRepoMap이 실패할 때 사용
 *
 * 심볼 선언 패턴을 정규식으로 구성하여 grep_search와 유사한 방식으로 검색합니다.
 *
 * @param query - 검색할 심볼 이름
 * @param kind - 심볼 종류 필터 (선택사항)
 * @param searchDir - 검색 디렉토리
 * @returns 검색 결과 텍스트
 */
async function fallbackGrepSearch(
  query: string,
  kind: string | undefined,
  searchDir: string,
): Promise<string> {
  // 심볼 종류별 정규식 패턴 구성
  const patterns: string[] = [];
  const kindPatterns: Record<string, string> = {
    function: `(?:export\\s+)?(?:async\\s+)?function\\s+\\w*${query}\\w*`,
    class: `(?:export\\s+)?(?:abstract\\s+)?class\\s+\\w*${query}\\w*`,
    interface: `(?:export\\s+)?interface\\s+\\w*${query}\\w*`,
    type: `(?:export\\s+)?type\\s+\\w*${query}\\w*\\s*=`,
    variable: `(?:export\\s+)?(?:const|let|var)\\s+\\w*${query}\\w*\\s*[=:]`,
    constant: `(?:export\\s+)?const\\s+\\w*${query}\\w*\\s*[=:]`,
    enum: `(?:export\\s+)?enum\\s+\\w*${query}\\w*`,
    method: `\\w*${query}\\w*\\s*\\(`,
  };

  if (kind) {
    const p = kindPatterns[kind];
    if (p) patterns.push(p);
  } else {
    // 전체 종류 검색
    patterns.push(
      ...Object.values(kindPatterns).filter((_, i) =>
        // "variable"과 "constant"은 중복되므로 "constant"만 사용
        i !== 4,
      ),
    );
  }

  const combinedPattern = patterns.join("|");

  // execFile로 ripgrep 실행 시도
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execFileAsync = promisify(execFile);

  try {
    const args = [
      "--line-number",
      "--no-heading",
      "--color", "never",
      "--max-count", "100",
      "--type", "ts",
      "--type", "js",
      combinedPattern,
      searchDir,
    ];

    const { stdout } = await execFileAsync("rg", args, {
      maxBuffer: 5 * 1024 * 1024,
      timeout: 15_000,
    });

    if (!stdout.trim()) {
      return `No symbols found matching "${query}" (grep fallback).`;
    }

    const lines = stdout.trimEnd().split("\n").slice(0, 30);
    return `Symbol search fell back to grep. Results for "${query}":\n\n${lines.join("\n")}`;
  } catch {
    return `No symbols found matching "${query}" (grep fallback).`;
  }
}

/**
 * 심볼 검색 실행 함수
 *
 * 실행 흐름:
 * 1. 검색 디렉토리 결정
 * 2. buildRepoMap으로 심볼 인덱스 구축
 * 3. query로 부분 일치 필터링 + kind/exported 필터 적용
 * 4. include_signature가 true이면 원본 파일에서 시그니처 추출
 * 5. 결과 포맷팅하여 반환
 * 6. buildRepoMap 실패 시 grep 폴백
 *
 * @param params - 검증된 매개변수
 * @param context - 실행 컨텍스트
 * @returns 검색 결과
 */
async function execute(params: Params, context: ToolContext): Promise<ToolResult> {
  const startTime = Date.now();

  // 검색 디렉토리 결정
  const searchDir = params.directory
    ? resolvePath(context.workingDirectory, params.directory)
    : context.workingDirectory;

  try {
    // buildRepoMap으로 심볼 인덱스 구축
    let repoMap: RepoMap;
    try {
      repoMap = await buildRepoMap(searchDir);
    } catch (mapError) {
      // 인덱스 구축 실패 → grep 폴백
      const fallbackOutput = await fallbackGrepSearch(
        params.query,
        params.kind,
        searchDir,
      );
      const elapsed = Date.now() - startTime;
      return {
        output: fallbackOutput,
        isError: false,
        metadata: {
          toolName: "symbol_search",
          query: params.query,
          resultCount: 0,
          searchedFiles: 0,
          duration: `${elapsed}ms`,
          backend: "grep-fallback",
          fallbackReason: mapError instanceof Error ? mapError.message : String(mapError),
        },
      };
    }

    // 대소문자 무시 부분 일치 검색
    const queryLower = params.query.toLowerCase();

    // 모든 파일에서 심볼 수집 + 필터링
    const matchedSymbols: RepoSymbol[] = [];
    for (const file of repoMap.files) {
      for (const symbol of file.symbols) {
        // 이름 부분 일치
        if (!symbol.name.toLowerCase().includes(queryLower)) continue;

        // 종류 필터
        if (params.kind && !matchesKind(symbol.kind, params.kind)) continue;

        // export 필터
        if (params.exported_only && !symbol.exported) continue;

        matchedSymbols.push(symbol);
      }
    }

    // max_results 제한
    const maxResults = params.max_results ?? 30;
    const limitedSymbols = matchedSymbols.slice(0, maxResults);

    // 시그니처 추출 (include_signature가 true인 경우)
    const results: Array<{ readonly symbol: RepoSymbol; readonly signature: string }> = [];

    if (params.include_signature) {
      // 파일별로 그룹핑하여 파일 읽기 최소화
      const fileGroups = new Map<string, RepoSymbol[]>();
      for (const symbol of limitedSymbols) {
        const existing = fileGroups.get(symbol.file) ?? [];
        existing.push(symbol);
        fileGroups.set(symbol.file, existing);
      }

      for (const [filePath, symbols] of fileGroups) {
        try {
          const fullPath = resolvePath(searchDir, filePath);
          const content = await readFile(fullPath, "utf-8");
          for (const symbol of symbols) {
            const signature = extractSignature(content, symbol.line);
            results.push({ symbol, signature });
          }
        } catch {
          // 파일 읽기 실패 시 시그니처 없이 추가
          for (const symbol of symbols) {
            results.push({ symbol, signature: "" });
          }
        }
      }
    } else {
      for (const symbol of limitedSymbols) {
        results.push({ symbol, signature: "" });
      }
    }

    const elapsed = Date.now() - startTime;
    const output = formatResults(results, params.query, repoMap.totalFiles);

    return {
      output,
      isError: false,
      metadata: {
        toolName: "symbol_search",
        query: params.query,
        resultCount: results.length,
        searchedFiles: repoMap.totalFiles,
        duration: `${elapsed}ms`,
        backend: "repo-map",
      },
    };
  } catch (error) {
    // 최상위 에러 핸들링 — 절대 throw하지 않음
    const elapsed = Date.now() - startTime;
    const message = error instanceof Error ? error.message : String(error);
    return {
      output: `Symbol search failed: ${message}`,
      isError: true,
      metadata: {
        toolName: "symbol_search",
        query: params.query,
        resultCount: 0,
        searchedFiles: 0,
        duration: `${elapsed}ms`,
      },
    };
  }
}

/**
 * symbol_search 도구 정의 — 내보내기하여 도구 레지스트리에 등록
 */
export const symbolSearchTool: ToolDefinition<Params> = {
  name: "symbol_search",
  description:
    "프로젝트에서 함수, 클래스, 인터페이스, 타입 등을 시맨틱 검색합니다. " +
    "grep_search보다 정확합니다 — 주석이나 문자열 안의 일치를 무시합니다. " +
    "사용 시점: " +
    "- 함수/클래스/변수 정의를 찾을 때 " +
    "- 리팩토링 전 심볼 존재 확인 " +
    "- 프로젝트 구조 파악 " +
    "grep_search를 사용해야 할 때: " +
    "- 텍스트 패턴/문자열/주석 검색 " +
    "- 정규식 필요 " +
    "- 비코드 파일 (.md, .json) 검색",
  parameterSchema: paramSchema,
  permissionLevel: "safe",
  timeoutMs: 30_000,
  execute,
};

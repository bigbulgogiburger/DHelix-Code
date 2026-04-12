/**
 * 글로브 검색 도구 — 글로브 패턴으로 파일을 검색하여 수정 시간순으로 반환하는 도구
 *
 * 글로브(Glob) 패턴은 파일 경로를 와일드카드로 매칭하는 패턴 문법입니다.
 * 예시:
 * - "**\/*.ts" → 모든 하위 디렉토리의 .ts 파일
 * - "src/**\/*.tsx" → src 폴더 아래의 모든 .tsx 파일
 * - "*.json" → 현재 디렉토리의 .json 파일만
 *
 * fast-glob 라이브러리를 사용하여 빠르게 파일을 검색합니다.
 * 결과는 수정 시간(modification time) 기준 최신순으로 정렬됩니다.
 *
 * 권한 수준: "safe" — 파일 시스템을 읽기만 하므로 안전합니다.
 */
import { z } from "zod";
import fg from "fast-glob";
import { stat } from "node:fs/promises";
import { type ToolDefinition, type ToolContext, type ToolResult } from "../types.js";
import { resolvePath, normalizePath } from "../../utils/path.js";
import { createToolStreamEmitter } from "../streaming.js";
import { join } from "node:path";

/**
 * 매개변수 스키마 — 검색 패턴과 검색 디렉토리를 정의
 */
const paramSchema = z.object({
  /** 글로브 패턴 — 파일 매칭에 사용할 와일드카드 패턴 */
  pattern: z.string().describe("Glob pattern to match files (e.g., '**/*.ts', 'src/**/*.tsx')"),
  /** 검색 시작 디렉토리(선택사항) — 지정하지 않으면 작업 디렉토리에서 검색 */
  path: z.string().optional().describe("Directory to search in (default: working directory)"),
});

type Params = z.infer<typeof paramSchema>;

/**
 * 글로브 검색 실행 함수
 *
 * 실행 흐름:
 * 1. 검색 디렉토리 결정 (매개변수 path 또는 작업 디렉토리)
 * 2. fast-glob으로 패턴에 맞는 파일 목록 가져오기
 * 3. 각 파일의 수정 시간(mtime)을 stat으로 확인
 * 4. 최신순으로 정렬하여 반환
 *
 * @param params - 검증된 매개변수 (패턴, 경로)
 * @param context - 실행 컨텍스트 (작업 디렉토리 등)
 * @returns 매칭된 파일 경로 목록 (줄바꿈으로 구분)
 */
async function execute(params: Params, context: ToolContext): Promise<ToolResult> {
  // 스트리밍 emitter 생성 — 글로브 검색 진행 상태를 실시간으로 발행
  const stream = createToolStreamEmitter(context, context.toolCallId ?? "unknown", "glob_search");

  // 검색 디렉토리 결정 — path가 지정되면 해당 디렉토리, 아니면 작업 디렉토리
  const searchDir = params.path
    ? resolvePath(context.workingDirectory, params.path)
    : context.workingDirectory;

  stream.progress("Searching for files...", { percentComplete: 0 });

  try {
    // 파일 경로와 수정 시간을 함께 저장할 배열
    const matches: { path: string; mtime: number }[] = [];

    // fast-glob으로 패턴 매칭 — dot: false는 .으로 시작하는 파일 제외
    const entries = await fg(params.pattern, { cwd: searchDir, dot: false, onlyFiles: true });
    for (const entry of entries) {
      const fullPath = join(searchDir, entry);
      try {
        // 각 파일의 메타데이터(수정 시간 등)를 가져옴
        const stats = await stat(fullPath);
        matches.push({ path: normalizePath(entry), mtime: stats.mtimeMs });
      } catch {
        // stat 실패한 파일은 건너뜀 (삭제되었거나 권한 없음)
      }
    }

    // 수정 시간 기준 내림차순 정렬 — 최근에 수정된 파일이 먼저 표시
    matches.sort((a, b) => b.mtime - a.mtime);

    if (matches.length === 0) {
      stream.complete("No files found", { itemsFound: 0 });
      return { output: "No files found matching the pattern.", isError: false };
    }

    stream.complete(`Found ${matches.length} files`, { itemsFound: matches.length });

    // 파일 경로만 추출하여 줄바꿈으로 연결
    const output = matches.map((m) => m.path).join("\n");
    return {
      output,
      isError: false,
      metadata: { count: matches.length, pattern: params.pattern },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    stream.warning(`Glob search failed: ${message}`);
    return { output: `Glob search failed: ${message}`, isError: true };
  }
}

/**
 * glob_search 도구 정의 — 내보내기하여 도구 레지스트리에 등록
 */
export const globSearchTool: ToolDefinition<Params> = {
  name: "glob_search",
  description:
    "Search for files matching a glob pattern. Returns matching file paths sorted by modification time (most recent first).",
  parameterSchema: paramSchema,
  permissionLevel: "safe",
  timeoutMs: 30_000,
  execute,
};

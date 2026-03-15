/**
 * 정규식 검색 도구 — 파일 내용에서 정규식 패턴으로 검색하여 매칭 줄을 반환하는 도구
 *
 * 두 가지 검색 엔진을 사용합니다:
 * 1. ripgrep (rg): 시스템에 설치되어 있으면 사용 — 매우 빠른 Rust 기반 검색 도구
 * 2. JavaScript 내장 구현: ripgrep이 없으면 Node.js의 RegExp로 폴백(fallback)
 *
 * ripgrep의 장점:
 * - .gitignore를 자동으로 존중 (불필요한 파일 제외)
 * - 바이너리 파일 자동 건너뛰기
 * - 수만 개 파일에서도 밀리초 단위로 검색
 *
 * 주요 기능:
 * - 대소문자 구분/무시 검색
 * - 컨텍스트 줄 표시 (매칭 줄 앞뒤 N줄)
 * - 파일 타입/글로브 패턴으로 검색 대상 필터링
 * - 멀티라인 매칭 (여러 줄에 걸친 패턴 검색)
 *
 * 권한 수준: "safe" — 파일 시스템을 읽기만 하므로 안전합니다.
 */
import { z } from "zod";
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fg from "fast-glob";
import { join } from "node:path";
import { type ToolDefinition, type ToolContext, type ToolResult } from "../types.js";
import { resolvePath, normalizePath } from "../../utils/path.js";

/** execFile의 Promise 버전 — 콜백 대신 async/await로 사용 */
const execFileAsync = promisify(execFile);

/**
 * 매개변수 스키마 — 검색 패턴, 경로, 필터 옵션을 정의
 */
const paramSchema = z.object({
  /** 검색할 정규식 패턴 (예: "function\\s+\\w+", "import.*from") */
  pattern: z.string().describe("Regular expression pattern to search for"),
  /** 검색할 파일 또는 디렉토리 경로(선택사항, 기본값: 작업 디렉토리) */
  path: z
    .string()
    .optional()
    .describe("File or directory to search in (default: working directory)"),
  /** 글로브 패턴으로 검색 대상 파일 필터링 (예: "*.ts", "*.{js,jsx}") */
  include: z.string().optional().describe("Glob pattern to filter files (e.g., '*.ts')"),
  /** 매칭 줄 앞뒤에 표시할 컨텍스트 줄 수 (rg -C 옵션) */
  contextLines: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("Number of context lines to show before and after each match (maps to rg -C)"),
  /** 대소문자 구분 여부(기본값: true — 구분함, false면 무시) */
  caseSensitive: z
    .boolean()
    .optional()
    .describe(
      "Whether the search is case-sensitive (default: true). Set to false for case-insensitive search.",
    ),
  /**
   * 파일 타입 필터 — ripgrep의 내장 타입 정의를 사용
   * 예: "ts"(TypeScript), "py"(Python), "js"(JavaScript)
   * ripgrep은 각 타입에 해당하는 파일 확장자를 자동으로 매핑합니다.
   */
  fileType: z
    .string()
    .optional()
    .describe(
      "Language file type filter (e.g., 'ts', 'py', 'js'). Uses ripgrep's built-in type definitions.",
    ),
  /** 멀티라인 매칭 활성화 — 패턴이 여러 줄에 걸쳐 매칭 가능 (rg -U 옵션) */
  multiline: z
    .boolean()
    .optional()
    .describe("Enable multiline matching where patterns can span multiple lines (maps to rg -U)"),
});

type Params = z.infer<typeof paramSchema>;

/**
 * ripgrep 사용 가능 여부를 캐싱하는 변수
 *
 * 한 번 확인하면 프로세스 수명 동안 결과를 재사용합니다.
 * 매 검색마다 ripgrep 존재 여부를 확인하는 오버헤드를 제거합니다.
 */
let _ripgrepAvailable: boolean | undefined;

/**
 * 시스템에 ripgrep(rg)이 설치되어 있는지 확인
 *
 * @returns ripgrep 사용 가능 여부
 */
export async function isRipgrepAvailable(): Promise<boolean> {
  if (_ripgrepAvailable !== undefined) return _ripgrepAvailable;
  try {
    await execFileAsync("rg", ["--version"]);
    _ripgrepAvailable = true;
  } catch {
    _ripgrepAvailable = false;
  }
  return _ripgrepAvailable;
}

/**
 * ripgrep 캐시 초기화 — 테스트에서 사용
 */
export function _resetRipgrepCache(): void {
  _ripgrepAvailable = undefined;
}

/**
 * ripgrep 검색 결과 인터페이스
 */
interface RipgrepResult {
  /** 포맷팅된 검색 결과 텍스트 */
  readonly output: string;
  /** 매칭된 줄의 총 개수 */
  readonly matchCount: number;
}

/**
 * ripgrep 서브프로세스를 사용하여 검색 수행
 *
 * ripgrep의 주요 옵션:
 * - --line-number: 줄 번호 표시
 * - --no-heading: 파일명을 매칭 줄마다 표시 (그룹핑 비활성화)
 * - --max-count 200: 파일당 최대 200개 매칭 (과도한 결과 방지)
 * - --ignore-case: 대소문자 무시
 * - -C N: 매칭 줄 앞뒤 N줄의 컨텍스트 표시
 * - --glob: 파일 이름 패턴 필터링
 * - --type: 언어별 파일 타입 필터링
 * - --multiline: 여러 줄에 걸친 패턴 매칭
 *
 * @param params - 검색 매개변수
 * @param searchPath - 검색할 절대 경로
 * @param workingDirectory - 작업 디렉토리 (상대 경로 변환에 사용)
 * @returns 검색 결과 (출력 텍스트, 매칭 수)
 */
async function searchWithRipgrep(
  params: Params,
  searchPath: string,
  workingDirectory: string,
): Promise<RipgrepResult> {
  // ripgrep 명령행 인수 구성
  const args: string[] = [
    "--line-number",   // 줄 번호 표시
    "--no-heading",    // 파일별 그룹핑 비활성화 (각 줄에 파일명 포함)
    "--color",
    "never",           // 색상 코드 비활성화 (텍스트 파싱을 위해)
    "--max-count",
    "200",             // 파일당 최대 매칭 수 (과도한 출력 방지)
  ];

  // 대소문자 무시 옵션 (기본값: 대소문자 구분)
  if (params.caseSensitive === false) {
    args.push("--ignore-case");
  }

  // 컨텍스트 줄 수 옵션
  if (params.contextLines !== undefined && params.contextLines > 0) {
    args.push("-C", String(params.contextLines));
  }

  // 글로브 패턴 필터 옵션
  if (params.include) {
    args.push("--glob", params.include);
  }

  // 파일 타입 필터 옵션
  if (params.fileType) {
    args.push("--type", params.fileType);
  }

  // 멀티라인 매칭 옵션
  if (params.multiline) {
    args.push("--multiline");
  }

  // 검색 패턴과 검색 경로를 마지막에 추가
  args.push(params.pattern, searchPath);

  const { stdout } = await execFileAsync("rg", args, {
    maxBuffer: 10 * 1024 * 1024, // 10MB 버퍼 — 대규모 검색 결과 처리
    timeout: 25_000,             // 25초 타임아웃
  });

  if (!stdout.trim()) {
    return { output: "No matches found.", matchCount: 0 };
  }

  // ripgrep 출력의 파일 경로를 작업 디렉토리 기준 상대 경로로 변환
  const lines = stdout.trimEnd().split("\n");
  const normalizedLines: string[] = [];

  for (const line of lines) {
    // 컨텍스트 구분선 ("--")은 그대로 유지
    if (line === "--") {
      normalizedLines.push(line);
      continue;
    }

    // ripgrep 출력 형식: /절대경로/파일.ts:줄번호:내용 (매칭 줄)
    // 또는: /절대경로/파일.ts-줄번호-내용 (컨텍스트 줄, '-' 구분자)
    const match = line.match(/^(.+?):(\d+)([:-])(.*)$/);
    if (match) {
      const filePath = match[1];
      const lineNum = match[2];
      const separator = match[3]; // ':' = 매칭 줄, '-' = 컨텍스트 줄
      const content = match[4];
      // 절대 경로 → 작업 디렉토리 기준 상대 경로로 변환
      const relativePath = normalizePath(
        filePath.replace(workingDirectory, "").replace(/^[/\\]/, ""),
      );
      normalizedLines.push(`${relativePath}:${lineNum}${separator}${content}`);
    } else {
      normalizedLines.push(line);
    }
  }

  // 실제 매칭 줄 수 계산 (':' 구분자가 있는 줄만, 컨텍스트 줄('-')은 제외)
  const matchCount = normalizedLines.filter((l) => l !== "--" && /^.+?:\d+:/.test(l)).length;

  const output = normalizedLines.join("\n");

  return { output, matchCount };
}

/**
 * JavaScript 내장 검색 구현 — ripgrep이 없을 때 사용하는 폴백(fallback)
 *
 * fast-glob으로 파일 목록을 가져오고, 각 파일을 읽어 RegExp로 매칭합니다.
 * ripgrep보다 느리지만, Node.js만으로 동작합니다.
 *
 * @param params - 검색 매개변수
 * @param searchPath - 검색할 절대 경로
 * @param workingDirectory - 작업 디렉토리
 * @returns 검색 결과
 */
async function searchWithJavaScript(
  params: Params,
  searchPath: string,
  workingDirectory: string,
): Promise<ToolResult> {
  // 검색 옵션에 따라 정규식 플래그 설정
  // g: 전체 매칭, m: 멀티라인, i: 대소문자 무시(선택)
  const regex = new RegExp(params.pattern, params.caseSensitive === false ? "gim" : "gm");
  const results: string[] = [];
  const includePattern = params.include ?? "**/*";

  // fast-glob으로 파일 목록 가져오기
  const entries = await fg(includePattern, { cwd: searchPath, dot: false, onlyFiles: true });
  const files: string[] = entries.map((entry) => join(searchPath, entry));

  for (const filePath of files) {
    try {
      const content = await readFile(filePath, "utf-8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        if (regex.test(lines[i])) {
          // 절대 경로를 작업 디렉토리 기준 상대 경로로 변환
          const relativePath = normalizePath(
            filePath.replace(workingDirectory, "").replace(/^[/\\]/, ""),
          );
          results.push(`${relativePath}:${i + 1}: ${lines[i].trim()}`);
        }
        // RegExp.lastIndex를 초기화해야 g 플래그에서 올바르게 동작
        regex.lastIndex = 0;
      }
    } catch {
      // 바이너리 파일이나 권한 없는 파일은 건너뜀
    }
  }

  if (results.length === 0) {
    return { output: "No matches found.", isError: false };
  }

  // 최대 200개까지만 표시 (과도한 결과 방지)
  const output = results.slice(0, 200).join("\n");
  const truncated = results.length > 200 ? `\n... (${results.length - 200} more matches)` : "";

  return {
    output: output + truncated,
    isError: false,
    metadata: { matchCount: results.length, pattern: params.pattern, backend: "javascript" },
  };
}

/**
 * 정규식 검색 실행 함수
 *
 * 실행 흐름:
 * 1. 검색 경로 결정 (매개변수 path 또는 작업 디렉토리)
 * 2. ripgrep 사용 가능 여부 확인
 * 3. ripgrep이 있으면 ripgrep으로 검색, 없으면 JavaScript 폴백으로 검색
 * 4. ripgrep 에러 시:
 *    - exit code 1 = 매칭 없음 (정상)
 *    - exit code 2 = 실제 에러 → JavaScript 폴백으로 재시도
 *
 * @param params - 검증된 매개변수
 * @param context - 실행 컨텍스트
 * @returns 검색 결과
 */
async function execute(params: Params, context: ToolContext): Promise<ToolResult> {
  // 검색 경로 결정 — path가 지정되면 해당 경로, 아니면 작업 디렉토리
  const searchPath = params.path
    ? resolvePath(context.workingDirectory, params.path)
    : context.workingDirectory;

  try {
    // ripgrep이 사용 가능하면 우선적으로 사용
    if (await isRipgrepAvailable()) {
      try {
        const result = await searchWithRipgrep(params, searchPath, context.workingDirectory);

        if (result.matchCount === 0) {
          return { output: "No matches found.", isError: false };
        }

        return {
          output: result.output,
          isError: false,
          metadata: { matchCount: result.matchCount, pattern: params.pattern, backend: "ripgrep" },
        };
      } catch (rgError) {
        // ripgrep 종료 코드 해석
        // exit code 1 = 매칭 결과 없음 (에러가 아님)
        // exit code 2 = 실제 에러 (잘못된 패턴 등)
        const err = rgError as { code?: number; stdout?: string; stderr?: string };
        if (err.code === 1) {
          return { output: "No matches found.", isError: false };
        }
        // 기타 에러 — JavaScript 폴백으로 이어짐
      }
    }

    // ripgrep이 없거나 에러가 발생한 경우 JavaScript 구현으로 폴백
    return await searchWithJavaScript(params, searchPath, context.workingDirectory);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { output: `Grep search failed: ${message}`, isError: true };
  }
}

/**
 * grep_search 도구 정의 — 내보내기하여 도구 레지스트리에 등록
 */
export const grepSearchTool: ToolDefinition<Params> = {
  name: "grep_search",
  description:
    "Search file contents using a regular expression pattern. Returns matching lines with file paths and line numbers. " +
    "Supports case-insensitive search, context lines, file type filtering, and multiline matching. " +
    "Uses ripgrep (rg) for fast searching when available, with automatic fallback to built-in search.",
  parameterSchema: paramSchema,
  permissionLevel: "safe",
  timeoutMs: 30_000,
  execute,
};

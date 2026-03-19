/**
 * Import hint utility — 파일 편집/생성 후 해당 파일을 import하는 파일 목록을 힌트로 제공
 *
 * file_edit, file_write 도구가 TypeScript/JavaScript 파일을 수정할 때,
 * 해당 파일에서 export하는 심볼을 import하는 다른 파일들을 찾아 힌트로 제공합니다.
 * 이를 통해 LLM이 멀티파일 편집 시 관련 파일을 놓치지 않도록 합니다.
 *
 * 성능 고려:
 * - ripgrep이 있으면 ripgrep으로 빠르게 검색 (25ms 이내)
 * - ripgrep이 없으면 힌트 생성을 스킵 (성능 우선)
 * - 최대 20개 파일까지만 표시 (과도한 결과 방지)
 * - TypeScript/JavaScript 파일에서만 동작
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { normalizePath } from "../utils/path.js";

const execFileAsync = promisify(execFile);

/** TypeScript/JavaScript 확장자 — 이 확장자의 파일에서만 힌트를 생성 */
const TS_JS_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mts", ".mjs", ".cts", ".cjs"]);

/** 힌트 결과 최대 파일 수 */
const MAX_HINT_FILES = 20;

/** ripgrep 검색 타임아웃 (ms) — 힌트는 보조 정보이므로 짧게 설정 */
const HINT_TIMEOUT_MS = 5_000;

/**
 * 파일에서 export되는 심볼 이름들을 추출합니다.
 *
 * 정규식으로 TypeScript/JavaScript의 주요 export 패턴을 감지합니다:
 * - export function foo
 * - export const/let/var foo
 * - export class Foo
 * - export interface Foo
 * - export type Foo
 * - export enum Foo
 * - export { foo, bar }
 * - export default (→ "default")
 *
 * @param content - 파일 내용
 * @returns export된 심볼 이름 배열
 */
export function extractExportedSymbols(content: string): readonly string[] {
  const symbols = new Set<string>();

  // Named export declarations: export function/const/let/var/class/interface/type/enum NAME
  const namedExportRegex =
    /export\s+(?:async\s+)?(?:function|const|let|var|class|interface|type|enum)\s+(\w+)/g;
  let match: RegExpExecArray | null;
  while ((match = namedExportRegex.exec(content)) !== null) {
    symbols.add(match[1]);
  }

  // Re-export with names: export { foo, bar, baz as qux }
  const reExportRegex = /export\s*\{([^}]+)\}/g;
  while ((match = reExportRegex.exec(content)) !== null) {
    const names = match[1].split(",");
    for (const name of names) {
      const trimmed = name.trim();
      // Handle "foo as bar" — the exported name is "bar"
      const asMatch = trimmed.match(/(\w+)\s+as\s+(\w+)/);
      if (asMatch) {
        symbols.add(asMatch[2]);
      } else if (/^\w+$/.test(trimmed)) {
        symbols.add(trimmed);
      }
    }
  }

  // Default export
  if (/export\s+default\s/.test(content)) {
    symbols.add("default");
  }

  return [...symbols];
}

/**
 * 주어진 파일을 import하는 다른 파일들을 찾아 힌트 문자열을 생성합니다.
 *
 * ripgrep을 사용하여 프로젝트 내에서 해당 파일의 모듈 경로를 import/require하는
 * 파일들을 검색합니다. ripgrep이 없으면 빈 문자열을 반환합니다.
 *
 * @param filePath - 편집/생성된 파일의 절대 경로
 * @param workingDirectory - 프로젝트 루트 디렉토리
 * @returns 힌트 문자열 (빈 문자열이면 힌트 없음)
 */
export async function buildImportHint(filePath: string, workingDirectory: string): Promise<string> {
  const ext = extname(filePath).toLowerCase();

  // TypeScript/JavaScript 파일이 아니면 힌트 생성하지 않음
  if (!TS_JS_EXTENSIONS.has(ext)) {
    return "";
  }

  try {
    // 파일 내용에서 export된 심볼 추출
    const content = await readFile(filePath, "utf-8");
    const exportedSymbols = extractExportedSymbols(content);

    if (exportedSymbols.length === 0) {
      return "";
    }

    // 모듈 경로 패턴 생성 — 파일 이름에서 확장자를 제거하고 검색
    // 예: "src/types.ts" → "types" 또는 "./types" 또는 "../types"
    const fileBaseName = basename(filePath).replace(/\.[^.]+$/, "");

    // 검색 패턴: 파일명이 import/require 경로에 포함되는 경우
    // 뒤에 확장자(.ts, .js 등) 또는 따옴표가 올 수 있음
    const searchPattern = `(from\\s+['"][^'"]*/${fileBaseName}(?:\\.[^'"]*)?['"]|require\\s*\\(\\s*['"][^'"]*/${fileBaseName}(?:\\.[^'"]*)?['"]\\s*\\)|from\\s+['"]\\./${fileBaseName}(?:\\.[^'"]*)?['"])`;

    // ripgrep으로 검색
    const importingFiles = await findImportingFiles(searchPattern, workingDirectory, filePath);

    if (importingFiles.length === 0) {
      return "";
    }

    // 심볼 목록 (최대 10개까지 표시)
    const symbolList =
      exportedSymbols.length <= 10
        ? exportedSymbols.join(", ")
        : `${exportedSymbols.slice(0, 10).join(", ")} (+${exportedSymbols.length - 10} more)`;

    // 파일 경로를 작업 디렉토리 기준 상대 경로로 변환
    const relativeFilePath = normalizePath(
      filePath.replace(workingDirectory, "").replace(/^[/\\]/, ""),
    );

    const fileList = importingFiles.slice(0, MAX_HINT_FILES).join(", ");
    const truncated =
      importingFiles.length > MAX_HINT_FILES
        ? ` (+${importingFiles.length - MAX_HINT_FILES} more)`
        : "";

    return (
      `\n[Hint] This file (${relativeFilePath}) exports: ${symbolList}. ` +
      `Imported by: ${fileList}${truncated}. ` +
      `If your edit changes these exports, update the importing files too.`
    );
  } catch {
    // 힌트 생성 실패는 도구 실행을 실패시키지 않음
    return "";
  }
}

/**
 * ripgrep을 사용하여 특정 패턴을 import하는 파일 목록을 반환합니다.
 *
 * @param pattern - 검색할 정규식 패턴
 * @param cwd - 검색할 디렉토리
 * @param excludeFile - 결과에서 제외할 파일 (편집 대상 파일 자체)
 * @returns 매칭된 파일 경로 배열 (작업 디렉토리 기준 상대 경로)
 */
async function findImportingFiles(
  pattern: string,
  cwd: string,
  excludeFile: string,
): Promise<readonly string[]> {
  try {
    const args = [
      "--files-with-matches",
      "--no-heading",
      "--color",
      "never",
      "--type",
      "ts",
      "--type",
      "js",
      pattern,
      cwd,
    ];

    const { stdout } = await execFileAsync("rg", args, {
      maxBuffer: 1024 * 1024,
      timeout: HINT_TIMEOUT_MS,
    });

    if (!stdout.trim()) {
      return [];
    }

    const normalizedExclude = normalizePath(excludeFile);
    const files = stdout
      .trim()
      .split("\n")
      .map((line) => normalizePath(line.trim()))
      .filter((f) => f !== normalizedExclude)
      .map((f) => normalizePath(f.replace(cwd, "").replace(/^[/\\]/, "")));

    return files;
  } catch (error) {
    // exit code 1 = no matches (ripgrep), anything else = error
    const err = error as { code?: number };
    if (err.code === 1) {
      return [];
    }
    // ripgrep not available or other error — skip hint
    return [];
  }
}

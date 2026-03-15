/**
 * 경로 유틸리티 — 크로스 플랫폼(Windows/macOS/Linux) 파일 경로 처리
 *
 * Windows의 백슬래시(\)를 포워드 슬래시(/)로 통일하고,
 * Git Bash 경로 변환, UNC 경로, 긴 경로(260자 초과) 등을 처리합니다.
 *
 * Node.js의 path 모듈을 래핑(wrapping)하여 모든 결과를 정규화(normalize)합니다.
 * 프로젝트 전체에서 파일 경로를 다룰 때 이 유틸리티를 사용하세요.
 *
 * @example
 * normalizePath("C:\\Users\\name\\file.txt") // → "C:/Users/name/file.txt"
 * gitBashToWindows("/c/Users/name") // → "C:\\Users\\name"
 * isUNCPath("\\\\server\\share\\folder") // → true
 */

import { join, resolve, normalize, dirname, basename, extname, relative } from "node:path";
import { isWindows } from "./platform.js";

/**
 * 경로를 정규화(normalize)하여 포워드 슬래시(/)를 일관되게 사용합니다.
 * Windows에서는 백슬래시(\)를 포워드 슬래시(/)로 변환합니다.
 *
 * @param p - 정규화할 경로 문자열
 * @returns 정규화된 경로 (Windows에서는 / 사용)
 *
 * @example
 * normalizePath("C:\\Users\\name\\file.txt") // → "C:/Users/name/file.txt"
 * normalizePath("./src/../lib/index.ts") // → "lib/index.ts"
 */
export function normalizePath(p: string): string {
  const normalized = normalize(p);
  return isWindows() ? normalized.replace(/\\/g, "/") : normalized;
}

/**
 * 경로를 절대 경로로 해석(resolve)한 뒤 정규화합니다.
 *
 * @param segments - 경로 세그먼트들 (여러 개를 합칠 수 있음)
 * @returns 정규화된 절대 경로
 *
 * @example
 * resolvePath("/home", "user", "docs") // → "/home/user/docs"
 */
export function resolvePath(...segments: string[]): string {
  return normalizePath(resolve(...segments));
}

/**
 * 경로 세그먼트들을 결합(join)한 뒤 정규화합니다.
 *
 * @param segments - 결합할 경로 세그먼트들
 * @returns 정규화된 결합 경로
 *
 * @example
 * joinPath("src", "utils", "path.ts") // → "src/utils/path.ts"
 */
export function joinPath(...segments: string[]): string {
  return normalizePath(join(...segments));
}

/**
 * 경로에서 디렉토리 부분만 추출합니다 (파일 이름 제외).
 *
 * @param p - 대상 경로
 * @returns 디렉토리 경로 (정규화됨)
 *
 * @example
 * dirName("/home/user/file.ts") // → "/home/user"
 */
export function dirName(p: string): string {
  return normalizePath(dirname(p));
}

/**
 * 경로에서 파일 이름(base name) 부분만 추출합니다.
 *
 * @param p - 대상 경로
 * @param ext - 제거할 확장자 (선택적)
 * @returns 파일 이름
 *
 * @example
 * baseName("/home/user/file.ts") // → "file.ts"
 * baseName("/home/user/file.ts", ".ts") // → "file"
 */
export function baseName(p: string, ext?: string): string {
  return basename(p, ext);
}

/**
 * 파일 확장자를 추출합니다 (점(.) 포함).
 *
 * @param p - 대상 경로
 * @returns 확장자 문자열 (예: ".ts", ".json")
 *
 * @example
 * extName("file.ts") // → ".ts"
 */
export function extName(p: string): string {
  return extname(p);
}

/**
 * 두 경로 사이의 상대 경로를 계산합니다.
 *
 * @param from - 시작 경로
 * @param to - 목표 경로
 * @returns 정규화된 상대 경로
 *
 * @example
 * relativePath("/home/user/src", "/home/user/lib") // → "../lib"
 */
export function relativePath(from: string, to: string): string {
  return normalizePath(relative(from, to));
}

/**
 * 경로가 절대 경로인지 확인합니다.
 * Unix 형식(/)과 Windows 형식(C:\) 모두를 인식합니다.
 *
 * @param p - 확인할 경로
 * @returns 절대 경로이면 true
 *
 * @example
 * isAbsolutePath("/usr/local/bin") // → true
 * isAbsolutePath("C:\\Users") // → true
 * isAbsolutePath("./relative") // → false
 */
export function isAbsolutePath(p: string): boolean {
  // Windows 드라이브 문자(C:\, D:/) 또는 Unix 절대 경로(/) 패턴 확인
  return /^[a-zA-Z]:[\\/]/.test(p) || p.startsWith("/");
}

/**
 * Git Bash 형식의 경로를 Windows 경로로 변환합니다.
 * Git Bash 형식이 아닌 경로는 그대로 반환합니다.
 *
 * @param p - Git Bash 형식의 경로
 * @returns Windows 형식의 경로
 *
 * @example
 * gitBashToWindows("/c/Users/name/file.txt") // → "C:\\Users\\name\\file.txt"
 * gitBashToWindows("/home/user") // → "/home/user" (변환 대상 아님)
 */
export function gitBashToWindows(p: string): string {
  // 패턴: /c/... 또는 /d/... (슬래시 뒤에 단일 드라이브 문자가 오는 형식)
  const match = p.match(/^\/([a-zA-Z])(\/.*)?$/);
  if (!match) return p;
  const driveLetter = match[1].toUpperCase();
  const rest = match[2] ?? "";
  return `${driveLetter}:${rest.replace(/\//g, "\\")}`;
}

/**
 * Windows 경로를 Git Bash 형식의 경로로 변환합니다.
 * Windows 형식이 아닌 경로는 그대로 반환합니다.
 *
 * @param p - Windows 형식의 경로
 * @returns Git Bash 형식의 경로
 *
 * @example
 * windowsToGitBash("C:\\Users\\name\\file.txt") // → "/c/Users/name/file.txt"
 * windowsToGitBash("/usr/local") // → "/usr/local" (변환 대상 아님)
 */
export function windowsToGitBash(p: string): string {
  // 패턴: C:\... 또는 C:/... (드라이브 문자 + 콜론 + 슬래시)
  const match = p.match(/^([a-zA-Z]):[/\\](.*)$/);
  if (!match) return p;
  const driveLetter = match[1].toLowerCase();
  const rest = match[2] ?? "";
  const normalized = rest.replace(/\\/g, "/");
  return `/${driveLetter}/${normalized}`;
}

/** windowsToGitBash의 별칭(alias) — 하위 호환성을 위해 유지 */
export const toGitBashPath = windowsToGitBash;

/** gitBashToWindows의 별칭(alias) — 하위 호환성을 위해 유지 */
export const fromGitBashPath = gitBashToWindows;

/**
 * Windows 환경 변수(%VAR_NAME%)를 실제 값으로 확장(expand)합니다.
 * 해석할 수 없는 변수는 원래 형태(%VAR_NAME%)를 그대로 유지합니다.
 *
 * @param p - 환경 변수가 포함된 경로
 * @returns 환경 변수가 치환된 경로
 *
 * @example
 * expandWindowsEnvVars("%USERPROFILE%\\Documents") // → "C:\\Users\\name\\Documents"
 * expandWindowsEnvVars("%UNKNOWN_VAR%\\test") // → "%UNKNOWN_VAR%\\test" (치환 불가 시 유지)
 */
export function expandWindowsEnvVars(p: string): string {
  // 정규식: %...% 사이의 변수명을 캡처하여 process.env에서 값을 조회
  return p.replace(/%([^%]+)%/g, (_match, varName: string) => {
    const value = process.env[varName];
    return value ?? `%${varName}%`;
  });
}

/**
 * 드라이브 문자를 대문자로 통일합니다.
 * Windows에서 "c:\foo"와 "C:\foo"를 동일하게 취급하기 위한 정규화입니다.
 *
 * @param path - 정규화할 경로
 * @returns 드라이브 문자가 대문자로 통일된 경로
 *
 * @example
 * normalizeDriveLetter("c:\\Users\\name") // → "C:\\Users\\name"
 */
export function normalizeDriveLetter(path: string): string {
  if (!path) return path;
  const match = path.match(/^([a-zA-Z]):/);
  if (match) {
    return path[0].toUpperCase() + path.slice(1);
  }
  return path;
}

/**
 * UNC(Universal Naming Convention) 경로인지 확인합니다.
 * UNC 경로는 네트워크 공유 폴더를 가리키며 \\서버\공유 또는 //서버/공유 형식입니다.
 *
 * @param p - 확인할 경로
 * @returns UNC 경로이면 true
 *
 * @example
 * isUNCPath("\\\\server\\share\\folder") // → true
 * isUNCPath("//server/share/folder") // → true
 * isUNCPath("C:\\Users") // → false
 */
export function isUNCPath(p: string): boolean {
  return /^\\\\[^\\]+\\[^\\]+/.test(p) || /^\/\/[^/]+\/[^/]+/.test(p);
}

/**
 * UNC 경로를 정규화합니다.
 * 백슬래시를 포워드 슬래시로 통일하고, 중복 슬래시를 제거하며, 끝의 슬래시를 제거합니다.
 *
 * @param p - 정규화할 UNC 경로
 * @returns 정규화된 UNC 경로
 *
 * @example
 * normalizeUNCPath("\\\\server\\share\\folder\\") // → "//server/share/folder"
 */
export function normalizeUNCPath(p: string): string {
  if (!isUNCPath(p)) return p;
  // 1단계: 모든 백슬래시를 포워드 슬래시로 변환
  const normalized = p.replace(/\\/g, "/");
  // 2단계: 선행 // 이후의 중복 슬래시를 하나로 축소
  const withoutPrefix = normalized.slice(2).replace(/\/+/g, "/");
  const result = `//${withoutPrefix}`;
  // 3단계: 끝의 슬래시 제거 (단, "//"만 남지 않도록)
  return result.length > 2 && result.endsWith("/") ? result.slice(0, -1) : result;
}

/**
 * 경로가 Windows의 MAX_PATH 제한(260자)을 초과하는지 확인합니다.
 *
 * @param path - 확인할 경로
 * @returns 260자를 초과하면 true
 */
export function isLongPath(path: string): boolean {
  return path.length > 260;
}

/**
 * 경로가 MAX_PATH(260자)를 초과하는 경우 Windows 긴 경로 접두사(\\?\)를 추가합니다.
 * 이미 접두사가 있거나 260자 이하인 경로는 그대로 반환합니다.
 *
 * Windows에서 260자 이상의 긴 경로를 사용하려면 이 접두사가 필요합니다.
 *
 * @param path - 처리할 경로
 * @returns 필요시 \\?\ 접두사가 추가된 경로
 *
 * @example
 * ensureLongPathSupport("C:\\very\\long\\...\\path") // → "\\\\?\\C:\\very\\long\\...\\path"
 */
export function ensureLongPathSupport(path: string): string {
  if (!isLongPath(path)) return path;
  if (path.startsWith("\\\\?\\")) return path;
  return "\\\\?\\" + path;
}

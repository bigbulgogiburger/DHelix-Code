/**
 * 플랫폼 감지 유틸리티 — 현재 OS와 셸(shell) 환경을 감지하는 함수 모음
 *
 * 운영체제(macOS/Windows/Linux), WSL(Windows Subsystem for Linux) 환경,
 * Git Bash 경로, 셸 타입 등을 감지하여 크로스 플랫폼 동작을 가능하게 합니다.
 *
 * 주로 샌드박스(sandbox), 경로 처리, 셸 명령 실행 등에서 사용됩니다.
 *
 * @example
 * if (isWindows()) {
 *   // Windows 전용 처리
 * } else if (isMacOS()) {
 *   // macOS 전용 처리 (예: Seatbelt 샌드박스)
 * }
 *
 * @example
 * const shell = getShellCommand(); // macOS: "/bin/zsh", Windows: "C:\\...\\bash.exe"
 */

import { platform as osPlatform, homedir, tmpdir } from "node:os";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

/** 지원하는 플랫폼 타입 (win32 = Windows, darwin = macOS, linux = Linux) */
export type Platform = "win32" | "darwin" | "linux";

/** 셸 타입 식별자 (bash, git-bash, cmd, powershell) */
export type ShellType = "bash" | "git-bash" | "cmd" | "powershell";

/**
 * 현재 운영체제(OS) 플랫폼을 감지합니다.
 * win32, darwin, linux 중 하나를 반환하며, 인식되지 않는 OS는 linux로 취급합니다.
 *
 * @returns 현재 플랫폼 ("win32" | "darwin" | "linux")
 */
export function getPlatform(): Platform {
  const p = osPlatform();
  if (p === "win32" || p === "darwin" || p === "linux") {
    return p;
  }
  // 알려지지 않은 플랫폼은 Linux로 폴백(fallback) — 대부분의 UNIX 계열을 포함
  return "linux";
}

/**
 * Windows에서 실행 중인지 확인합니다.
 * @returns Windows이면 true
 */
export function isWindows(): boolean {
  return getPlatform() === "win32";
}

/**
 * macOS에서 실행 중인지 확인합니다.
 * @returns macOS이면 true
 */
export function isMacOS(): boolean {
  return getPlatform() === "darwin";
}

/**
 * Linux에서 실행 중인지 확인합니다.
 * @returns Linux이면 true
 */
export function isLinux(): boolean {
  return getPlatform() === "linux";
}

/**
 * WSL(Windows Subsystem for Linux) 환경에서 실행 중인지 확인합니다.
 * WSL_DISTRO_NAME 환경 변수가 설정되어 있으면 WSL로 판단합니다.
 *
 * @returns WSL 환경이면 true
 */
export function isWSL(): boolean {
  return !!process.env.WSL_DISTRO_NAME;
}

/**
 * WSL2 환경에서 실행 중인지 확인합니다.
 *
 * WSL2 판별 방법:
 * 1. WSL_DISTRO_NAME 환경 변수 존재 확인 (WSL 여부)
 * 2. /proc/version에 "microsoft" 문자열 포함 확인
 * 3. 커널 버전이 4.19 이상인지 확인 (WSL1은 4.4.x, WSL2는 4.19+)
 *
 * @returns WSL2이면 true
 */
export function isWSL2(): boolean {
  if (!isWSL()) return false;
  try {
    const procVersion = readFileSync("/proc/version", "utf-8").toLowerCase();
    if (!procVersion.includes("microsoft")) return false;
    // 커널 버전에서 major.minor 추출하여 4.19 이상인지 확인
    const kernelMatch = procVersion.match(/(\d+)\.(\d+)/);
    if (!kernelMatch) return false;
    const major = parseInt(kernelMatch[1], 10);
    const minor = parseInt(kernelMatch[2], 10);
    return major > 4 || (major === 4 && minor >= 19);
  } catch {
    return false;
  }
}

/**
 * WSL1 환경에서 실행 중인지 확인합니다.
 * WSL이지만 WSL2가 아닌 경우 WSL1로 판단합니다.
 *
 * @returns WSL1이면 true
 */
export function isWSL1(): boolean {
  return isWSL() && !isWSL2();
}

/**
 * 사용자 홈 디렉토리 경로를 반환합니다.
 * 예: macOS → "/Users/username", Windows → "C:\\Users\\username"
 *
 * @returns 홈 디렉토리 절대 경로
 */
export function getHomeDir(): string {
  return homedir();
}

/**
 * 시스템 임시(temp) 디렉토리 경로를 반환합니다.
 * 예: macOS → "/var/folders/...", Linux → "/tmp"
 *
 * @returns 임시 디렉토리 절대 경로
 */
export function getTempDir(): string {
  return tmpdir();
}

/**
 * Windows에서 Git Bash 실행 파일을 찾습니다.
 *
 * 탐색 순서:
 * 1. GIT_BASH_PATH 환경 변수 (사용자가 직접 지정)
 * 2. 표준 설치 경로 ("C:\Program Files\Git\bin\bash.exe")
 * 3. PATH에서 git.exe 위치를 기반으로 bash.exe 경로 유추
 * 4. PROGRAMFILES 환경 변수를 이용한 최종 시도
 *
 * @returns Git Bash 경로 또는 null (찾지 못한 경우)
 */
function findGitBash(): string | null {
  if (!isWindows()) return null;

  // 후보 경로 목록 (환경 변수 → 표준 경로)
  const candidates: readonly (string | undefined)[] = [
    process.env.GIT_BASH_PATH,
    "C:\\Program Files\\Git\\bin\\bash.exe",
    "C:\\Program Files (x86)\\Git\\bin\\bash.exe",
  ];

  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) {
      return candidate;
    }
  }

  // PATH에서 git.exe 위치를 찾아 bash.exe 경로를 유추
  // git.exe: C:\Program Files\Git\cmd\git.exe
  // bash.exe: C:\Program Files\Git\bin\bash.exe (같은 Git 루트의 bin 폴더)
  const pathEnv = process.env.PATH ?? process.env.Path ?? "";
  const pathDirs = pathEnv.split(";");

  for (const dir of pathDirs) {
    const gitExe = join(dir, "git.exe");
    if (existsSync(gitExe)) {
      // dir 예시: "C:\Program Files\Git\cmd" → 부모(dirname)는 Git 루트
      const gitRoot = dirname(dir);
      const bashExe = join(gitRoot, "bin", "bash.exe");
      if (existsSync(bashExe)) {
        return bashExe;
      }
    }
  }

  // 최종 폴백: PROGRAMFILES 환경 변수 활용
  const programFiles = process.env.PROGRAMFILES;
  if (programFiles) {
    const candidate = `${programFiles}\\Git\\bin\\bash.exe`;
    try {
      if (existsSync(candidate)) return candidate;
    } catch {
      // 접근 불가 시 무시
    }
  }

  return null;
}

/** 캐시된 Git Bash 경로 (undefined = 아직 조회하지 않음, null = 찾지 못함) */
let _gitBashPath: string | null | undefined;

/**
 * Git Bash 경로를 캐시에서 가져오거나, 처음이면 조회하여 캐시합니다.
 * 한 번만 파일 시스템을 탐색하고 이후 결과를 재사용합니다.
 *
 * @returns Git Bash 경로 또는 null
 */
function getGitBashPath(): string | null {
  if (_gitBashPath === undefined) {
    _gitBashPath = findGitBash();
  }
  return _gitBashPath;
}

/**
 * Windows에서 Git Bash를 사용할 수 있는지 확인합니다.
 * @returns Git Bash가 설치되어 있으면 true
 */
export function hasGitBash(): boolean {
  return getGitBashPath() !== null;
}

/**
 * 현재 셸 타입을 반환합니다.
 * - macOS/Linux: "bash"
 * - Windows + Git Bash 설치: "git-bash"
 * - Windows + Git Bash 미설치: "cmd"
 *
 * @returns 셸 타입 식별자
 */
export function getShellType(): ShellType {
  if (!isWindows()) return "bash";
  if (getGitBashPath()) return "git-bash";
  return "cmd";
}

/**
 * 플랫폼에 적합한 셸 실행 파일 경로를 반환합니다.
 * Windows에서는 Git Bash를 우선 사용하고, 없으면 cmd.exe를 사용합니다.
 *
 * @returns 셸 실행 파일 경로 (예: "/bin/bash", "C:\\...\\bash.exe", "cmd.exe")
 */
export function getShellCommand(): string {
  if (isWindows()) {
    const gitBash = getGitBashPath();
    if (gitBash) return gitBash;
    return "cmd.exe";
  }
  // Unix 계열: SHELL 환경 변수가 있으면 사용, 없으면 /bin/bash
  return process.env.SHELL || "/bin/bash";
}

/**
 * 명령 문자열을 실행하기 위한 셸 인수 배열을 반환합니다.
 *
 * - cmd.exe: ["/c", "command"] 형식
 * - bash 계열: ["-c", "command"] 형식
 *
 * @param command - 실행할 명령 문자열
 * @param shell - 사용할 셸 (지정하지 않으면 플랫폼에 맞게 자동 결정)
 * @returns 셸 인수 배열 (readonly)
 */
export function getShellArgs(command: string, shell?: string): readonly string[] {
  // cmd.exe인 경우 /c 플래그 사용, 그 외는 -c 플래그 사용
  if (shell === "cmd.exe" || (!shell && isWindows() && !getGitBashPath())) {
    return ["/c", command] as const;
  }
  return ["-c", command] as const;
}

/**
 * 캐시된 Git Bash 경로를 초기화합니다.
 * 주로 테스트에서 환경을 리셋할 때 사용합니다.
 *
 * @internal 내부 테스트 전용 함수
 */
export function _resetGitBashCache(): void {
  _gitBashPath = undefined;
}

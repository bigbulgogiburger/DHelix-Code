/**
 * Linux 샌드박스 — Linux 환경 감지, bubblewrap 인수 생성 및 실행, 준비 상태 확인
 *
 * WSL(Windows Subsystem for Linux) 감지, bubblewrap 설치 확인,
 * 배포판별 설치 안내 등 Linux 샌드박스 환경 전반을 관리합니다.
 *
 * WSL 지원:
 * - WSL2: 네임스페이스 기능을 완전 지원 → bubblewrap 사용 가능
 * - WSL1: 네임스페이스 기능 미지원 → bubblewrap 사용 불가 (WSL2 업그레이드 안내)
 *
 * @example
 * // 샌드박스 준비 상태 확인
 * const readiness = await checkLinuxSandboxReady();
 * if (readiness.available) {
 *   const result = await executeBubblewrap({ command: "ls", projectDir: "/project" });
 * }
 */

import { readFile, access } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { BaseError } from "../utils/error.js";

const execFileAsync = promisify(execFile);

/** Linux bubblewrap 샌드박스 에러 */
export class BubblewrapError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "BUBBLEWRAP_ERROR", context);
  }
}

/** bubblewrap 샌드박스 실행 설정 */
export interface LinuxSandboxConfig {
  /** 샌드박스 안에서 실행할 명령어 */
  readonly command: string;
  /** 명령어 인수 배열 */
  readonly args?: readonly string[];
  /** 작업 디렉토리 */
  readonly cwd?: string;
  /** 프로젝트 디렉토리 (읽기/쓰기 접근 허용) */
  readonly projectDir: string;
  /** 홈 디렉토리 (일부 읽기 전용 접근 허용) */
  readonly homeDir?: string;
  /** 실행 타임아웃 (밀리초) */
  readonly timeoutMs?: number;
  /** 전달할 환경 변수 */
  readonly env?: Record<string, string>;
  /** 네트워크 접근 허용 여부 (기본값: true, API 호출에 필요) */
  readonly allowNetwork?: boolean;
}

/** Linux 샌드박스 준비 상태 확인 결과 */
export interface SandboxReadiness {
  /** 샌드박스 사용 가능 여부 */
  readonly available: boolean;
  /** 사용 불가 시 이유 */
  readonly reason?: string;
  /** 감지된 환경 타입 */
  readonly environment: "native-linux" | "wsl2" | "wsl1" | "unknown";
  /** bubblewrap 설치 여부 */
  readonly bubblewrapInstalled: boolean;
  /** bubblewrap 버전 문자열 */
  readonly bubblewrapVersion?: string;
  /** 설치 안내 등의 권장 사항 */
  readonly recommendations: readonly string[];
}

/** 읽기 전용으로 마운트할 시스템 경로 */
const READONLY_SYSTEM_PATHS: readonly string[] = [
  "/usr",
  "/bin",
  "/lib",
  "/lib64",
  "/etc",
  "/sbin",
];

/** 홈 디렉토리에서 읽기 전용으로 마운트할 설정 경로 */
const HOME_READONLY_PATHS: readonly string[] = [
  ".config",
  ".local",
  ".npm",
  ".node_modules",
  ".cache",
  ".nvm",
  ".volta",
  ".rustup",
  ".cargo",
  ".dbcode",
  ".claude",
  ".git",
];

// ---------------------------------------------------------------------------
// WSL 감지
// ---------------------------------------------------------------------------

/**
 * WSL2 환경에서 실행 중인지 감지합니다 (비동기 버전).
 *
 * WSL2 판별 방법:
 * 1. /proc/version에 "microsoft" 문자열 포함 확인
 * 2. /proc/sys/fs/binfmt_misc/WSLInterop 파일 존재 확인 (WSL2 전용 기능)
 *
 * @returns WSL2이면 true
 */
export async function isWSL2(): Promise<boolean> {
  try {
    const version = await readFile("/proc/version", "utf-8");
    const hasMicrosoftKernel = /microsoft/i.test(version);

    if (!hasMicrosoftKernel) {
      return false;
    }

    // WSL2만 WSLInterop을 지원함 — WSL1은 이 파일이 없음
    try {
      await access("/proc/sys/fs/binfmt_misc/WSLInterop");
      return true;
    } catch {
      return false;
    }
  } catch {
    return false;
  }
}

/**
 * WSL1 환경에서 실행 중인지 감지합니다.
 *
 * WSL1은 /proc/version에 "Microsoft"가 있지만 WSLInterop을 지원하지 않습니다.
 *
 * @returns WSL1이면 true
 */
export async function isWSL1(): Promise<boolean> {
  try {
    const version = await readFile("/proc/version", "utf-8");
    const hasMicrosoftKernel = /microsoft/i.test(version);

    if (!hasMicrosoftKernel) {
      return false;
    }

    // WSL1: WSLInterop이 없음
    try {
      await access("/proc/sys/fs/binfmt_misc/WSLInterop");
      return false; // WSLInterop 존재 → WSL2이므로 WSL1이 아님
    } catch {
      return true; // WSLInterop 없음 → WSL1
    }
  } catch {
    return false;
  }
}

/**
 * WSL(Windows Subsystem for Linux) 환경인지 확인합니다 (WSL1 또는 WSL2).
 * /proc/version에 "microsoft" 또는 "WSL" 문자열이 포함되어 있으면 WSL로 판단합니다.
 *
 * @returns WSL 환경이면 true
 */
export async function isWSL(): Promise<boolean> {
  try {
    const version = await readFile("/proc/version", "utf-8");
    return /microsoft|wsl/i.test(version);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Bubblewrap 감지
// ---------------------------------------------------------------------------

/**
 * bubblewrap(bwrap)가 설치되어 있고 실행 가능한지 확인합니다.
 *
 * @returns bwrap가 사용 가능하면 true
 */
export async function hasBubblewrap(): Promise<boolean> {
  try {
    await execFileAsync("bwrap", ["--version"]);
    return true;
  } catch {
    return false;
  }
}

/**
 * 설치된 bubblewrap의 버전 문자열을 반환합니다.
 *
 * @returns 버전 문자열 (예: "bubblewrap 0.6.2") 또는 null (미설치)
 */
export async function getBubblewrapVersion(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("bwrap", ["--version"]);
    const trimmed = stdout.trim();
    return trimmed || null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// 샌드박스 인수 생성 및 실행
// ---------------------------------------------------------------------------

/**
 * bubblewrap(bwrap) 명령의 인수 배열을 생성합니다.
 *
 * 마운트:
 * - 시스템 경로 (/usr, /bin, /lib, /etc, /sbin): 읽기 전용
 * - /proc, /dev: 특수 파일 시스템
 * - /tmp: tmpfs (휘발성)
 * - 프로젝트 디렉토리: 읽기/쓰기
 * - 홈 디렉토리 설정 경로: 읽기 전용 (--ro-bind-try: 경로가 없어도 에러 안 남)
 *
 * 격리:
 * - PID 네임스페이스 격리 (--unshare-pid)
 * - 새 세션 (--new-session)
 * - 부모 종료 시 자동 종료 (--die-with-parent)
 * - 선택적 네트워크 격리 (--unshare-net)
 *
 * @param config - 샌드박스 설정
 * @returns bwrap 인수 배열
 */
export function generateBwrapArgs(config: LinuxSandboxConfig): readonly string[] {
  const {
    command,
    args = [],
    projectDir,
    homeDir = process.env.HOME ?? "/home/unknown",
    allowNetwork = true,
  } = config;

  const bwrapArgs: string[] = [];

  // 시스템 경로 읽기 전용 마운트
  for (const sysPath of READONLY_SYSTEM_PATHS) {
    bwrapArgs.push("--ro-bind", sysPath, sysPath);
  }

  // 특수 파일 시스템 마운트
  bwrapArgs.push("--proc", "/proc");
  bwrapArgs.push("--dev", "/dev");

  // 휘발성 /tmp 마운트
  bwrapArgs.push("--tmpfs", "/tmp");

  // 프로젝트 디렉토리 읽기/쓰기 마운트
  bwrapArgs.push("--bind", projectDir, projectDir);

  // 홈 디렉토리 설정 경로 읽기 전용 마운트
  // --ro-bind-try: 경로가 존재하지 않아도 에러를 발생시키지 않음
  for (const subPath of HOME_READONLY_PATHS) {
    const fullPath = `${homeDir}/${subPath}`;
    bwrapArgs.push("--ro-bind-try", fullPath, fullPath);
  }

  // 격리 플래그
  bwrapArgs.push("--unshare-pid"); // PID 격리
  bwrapArgs.push("--die-with-parent"); // 부모 종료 시 자동 종료
  bwrapArgs.push("--new-session"); // 세션 격리

  // 네트워크 격리 (명시적으로 비활성화된 경우에만)
  if (!allowNetwork) {
    bwrapArgs.push("--unshare-net");
  }

  // 명령 구분자와 실행할 명령
  bwrapArgs.push("--", command, ...args);

  return bwrapArgs;
}

/**
 * Linux bubblewrap 샌드박스 안에서 명령을 실행합니다.
 *
 * bwrap가 설치되어 있어야 합니다. WSL1에서는 커널 기능 부족으로 사용할 수 없습니다.
 *
 * @param config - 샌드박스 실행 설정
 * @returns stdout과 stderr를 포함한 실행 결과
 * @throws BubblewrapError - bwrap 미설치, WSL1, 타임아웃, 실행 실패 시
 */
export async function executeBubblewrap(config: LinuxSandboxConfig): Promise<{
  stdout: string;
  stderr: string;
}> {
  const { command, args = [], cwd, timeoutMs = 120_000, env } = config;

  // bwrap 설치 확인
  const bwrapAvailable = await hasBubblewrap();
  if (!bwrapAvailable) {
    throw new BubblewrapError("bubblewrap (bwrap) is not installed", {
      command,
      hint: "Install with: sudo apt install bubblewrap (Debian/Ubuntu) or sudo dnf install bubblewrap (Fedora)",
    });
  }

  // WSL1 확인 (지원되지 않음)
  const wsl1 = await isWSL1();
  if (wsl1) {
    throw new BubblewrapError(
      "bubblewrap sandbox is not supported on WSL1 due to missing kernel features",
      {
        command,
        hint: "Upgrade to WSL2: wsl --set-version <distro> 2",
      },
    );
  }

  // bwrap 인수 생성 및 실행
  const bwrapArgs = generateBwrapArgs(config);

  try {
    const result = await execFileAsync("bwrap", [...bwrapArgs], {
      cwd,
      timeout: timeoutMs,
      env: env ? { ...process.env, ...env } : undefined,
      maxBuffer: 10 * 1024 * 1024, // 10MB
    });

    return { stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    // 타임아웃에 의한 강제 종료
    if (error instanceof Error && "killed" in error && (error as Record<string, unknown>).killed) {
      throw new BubblewrapError("Sandboxed command timed out", {
        command,
        args: [...args],
        timeoutMs,
      });
    }
    throw new BubblewrapError("Sandboxed command failed", {
      command,
      args: [...args],
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}

// ---------------------------------------------------------------------------
// 샌드박스 준비 상태 확인
// ---------------------------------------------------------------------------

/**
 * /etc/os-release를 읽어 Linux 배포판 계열을 감지합니다.
 * 설치 안내 메시지를 배포판에 맞게 제공하기 위해 사용합니다.
 *
 * @returns "debian" | "fedora" | "arch" | "unknown"
 */
async function detectDistroFamily(): Promise<"debian" | "fedora" | "arch" | "unknown"> {
  try {
    const osRelease = await readFile("/etc/os-release", "utf-8");
    // ID=ubuntu 또는 ID_LIKE=debian 같은 줄을 파싱
    const idLine = osRelease.split("\n").find((line) => /^ID=/.test(line));
    const idLikeLine = osRelease.split("\n").find((line) => /^ID_LIKE=/.test(line));

    const id = idLine?.replace(/^ID=/, "").replace(/"/g, "").trim().toLowerCase() ?? "";
    const idLike =
      idLikeLine
        ?.replace(/^ID_LIKE=/, "")
        .replace(/"/g, "")
        .trim()
        .toLowerCase() ?? "";

    const combined = `${id} ${idLike}`;

    if (combined.includes("debian") || combined.includes("ubuntu")) {
      return "debian";
    }
    if (combined.includes("fedora") || combined.includes("rhel") || combined.includes("centos")) {
      return "fedora";
    }
    if (combined.includes("arch")) {
      return "arch";
    }

    return "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * 배포판에 맞는 설치 안내 문자열 배열을 생성합니다.
 *
 * @param distro - 감지된 배포판 계열
 * @returns 설치 안내 문자열 배열
 */
function buildInstallRecommendations(
  distro: "debian" | "fedora" | "arch" | "unknown",
): readonly string[] {
  const recommendations: string[] = [];

  switch (distro) {
    case "debian":
      recommendations.push("Install bubblewrap: sudo apt install bubblewrap");
      break;
    case "fedora":
      recommendations.push("Install bubblewrap: sudo dnf install bubblewrap");
      break;
    case "arch":
      recommendations.push("Install bubblewrap: sudo pacman -S bubblewrap");
      break;
    default:
      recommendations.push(
        "Install bubblewrap using your distribution's package manager.",
        "Common commands:",
        "  Ubuntu/Debian: sudo apt install bubblewrap",
        "  Fedora: sudo dnf install bubblewrap",
        "  Arch: sudo pacman -S bubblewrap",
      );
      break;
  }

  return recommendations;
}

/**
 * Linux 환경 타입을 감지합니다.
 *
 * @returns "native-linux" | "wsl2" | "wsl1" | "unknown"
 */
async function detectEnvironment(): Promise<"native-linux" | "wsl2" | "wsl1" | "unknown"> {
  if (process.platform !== "linux") {
    return "unknown";
  }

  if (await isWSL2()) {
    return "wsl2";
  }

  if (await isWSL1()) {
    return "wsl1";
  }

  return "native-linux";
}

/**
 * Linux 샌드박스의 전체 준비 상태를 확인합니다.
 *
 * 확인 항목:
 * - Linux 플랫폼인지 (네이티브 Linux, WSL1, WSL2)
 * - bubblewrap가 설치되어 있는지 + 버전
 * - 미설치 시 배포판에 맞는 설치 안내 제공
 *
 * @returns 준비 상태 결과 (available, environment, recommendations 등)
 *
 * @example
 * const status = await checkLinuxSandboxReady();
 * if (!status.available) {
 *   console.log(status.reason);
 *   status.recommendations.forEach(r => console.log(r));
 * }
 */
export async function checkLinuxSandboxReady(): Promise<SandboxReadiness> {
  const environment = await detectEnvironment();

  // Linux가 아닌 플랫폼
  if (environment === "unknown") {
    return {
      available: false,
      reason: "Not running on Linux. Bubblewrap sandboxing is only available on Linux.",
      environment,
      bubblewrapInstalled: false,
      recommendations: [],
    };
  }

  // WSL1: 네임스페이스 기능 부족으로 bubblewrap 사용 불가
  if (environment === "wsl1") {
    return {
      available: false,
      reason:
        "WSL1 does not support the namespace features required by bubblewrap. Upgrade to WSL2.",
      environment,
      bubblewrapInstalled: await hasBubblewrap(),
      bubblewrapVersion: (await getBubblewrapVersion()) ?? undefined,
      recommendations: ["Upgrade to WSL2 for sandbox support: wsl --set-version <distro> 2"],
    };
  }

  // 네이티브 Linux 또는 WSL2: bwrap 설치 확인
  const bwrapInstalled = await hasBubblewrap();
  const bwrapVersion = await getBubblewrapVersion();

  if (!bwrapInstalled) {
    // 배포판에 맞는 설치 안내 생성
    const distro = await detectDistroFamily();
    const recommendations = buildInstallRecommendations(distro);

    return {
      available: false,
      reason: "Bubblewrap is not installed.",
      environment,
      bubblewrapInstalled: false,
      recommendations,
    };
  }

  // 모든 조건 충족: 샌드박스 사용 가능
  return {
    available: true,
    environment,
    bubblewrapInstalled: true,
    bubblewrapVersion: bwrapVersion ?? undefined,
    recommendations: [],
  };
}

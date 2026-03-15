/**
 * Bubblewrap(bwrap) 샌드박스 — Linux용 프로세스 격리 실행기
 *
 * Bubblewrap는 Linux의 네임스페이스(namespace) 기능을 활용하여
 * 프로세스를 격리된 환경에서 실행합니다. 컨테이너(Docker)보다 가볍고,
 * 루트 권한 없이 사용할 수 있습니다.
 *
 * 마운트(mount) 구조:
 * - 시스템 경로 (/usr, /bin, /lib 등): 읽기 전용(read-only) 바인드 마운트
 * - /proc: procfs 마운트 (프로세스 정보용)
 * - /dev: devfs 마운트 (장치 파일용)
 * - /tmp: tmpfs 마운트 (휘발성, 재시작 시 사라짐)
 * - 프로젝트 디렉토리: 읽기/쓰기 바인드 마운트
 * - 홈 디렉토리 설정: 읽기 전용 바인드 마운트
 *
 * 격리(isolation):
 * - PID 네임스페이스 격리 (--unshare-pid): 다른 프로세스를 볼 수 없음
 * - 새 세션 (--new-session): 터미널 탈취 방지
 * - 부모 프로세스 종료 시 자동 종료 (--die-with-parent)
 * - 선택적 네트워크 격리 (--unshare-net)
 *
 * WSL2에서도 지원되며, WSL2의 Windows 홈 디렉토리를 읽기 전용으로 마운트합니다.
 *
 * @example
 * const result = await executeBubblewrapped({
 *   command: "node",
 *   args: ["script.js"],
 *   projectDir: "/home/user/project",
 * });
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { access } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { BaseError } from "../utils/error.js";
import { isWSL2 } from "./linux.js";

const execFileAsync = promisify(execFile);

/** Bubblewrap 샌드박스 실행 에러 */
export class BubblewrapError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "BUBBLEWRAP_ERROR", context);
  }
}

/** bubblewrap 샌드박스에 마운트할 파일 시스템 경로 */
export interface PathMount {
  /** 호스트(실제) 파일 시스템의 경로 */
  readonly hostPath: string;
  /** 샌드박스 내부에서의 경로 (생략 시 hostPath와 동일) */
  readonly sandboxPath?: string;
  /** 쓰기 허용 여부 (true면 읽기/쓰기, false면 읽기 전용) */
  readonly writable: boolean;
}

/** bubblewrap 샌드박스 실행 설정 */
export interface BubblewrapConfig {
  /** 샌드박스 안에서 실행할 명령어 */
  readonly command: string;
  /** 명령어 인수(arguments) 배열 */
  readonly args?: readonly string[];
  /** 작업 디렉토리 */
  readonly cwd?: string;
  /** 프로젝트 디렉토리 (읽기/쓰기로 마운트) */
  readonly projectDir: string;
  /** 홈 디렉토리 (기본값: os.homedir()) */
  readonly homeDir?: string;
  /** 임시 디렉토리 (기본값: os.tmpdir()) */
  readonly tmpDir?: string;
  /** 실행 타임아웃 밀리초 (기본값: 120000 = 2분) */
  readonly timeoutMs?: number;
  /** 샌드박스 내부에 설정할 환경 변수 */
  readonly env?: Record<string, string>;
  /** 네트워크 접근 허용 여부 (기본값: true, API 호출에 필요) */
  readonly networkAccess?: boolean;
  /** 추가로 마운트할 경로 목록 */
  readonly allowedPaths?: readonly PathMount[];
}

/** bubblewrap 실행 결과 */
export interface SandboxResult {
  /** 표준 출력(stdout) */
  readonly stdout: string;
  /** 표준 에러(stderr) */
  readonly stderr: string;
  /** 종료 코드 (0이면 성공) */
  readonly exitCode: number;
  /** 타임아웃으로 종료되었는지 여부 */
  readonly timedOut: boolean;
}

/** 읽기 전용으로 바인드 마운트하는 시스템 경로들 */
const SYSTEM_RO_PATHS = ["/usr", "/bin", "/lib", "/lib64", "/etc", "/sbin"] as const;

/** 홈 디렉토리에서 읽기 전용으로 마운트하는 하위 디렉토리들 */
const HOME_RO_DIRS = [
  ".dbcode",
  ".config",
  ".npm",
  ".cache",
  ".nvm",
  ".volta",
  ".rustup",
  ".cargo",
] as const;

/**
 * 파일 시스템 경로가 존재하는지 비동기적으로 확인합니다.
 * 바인드 마운트 전에 경로 존재 여부를 검사하는 데 사용합니다.
 *
 * @param p - 확인할 경로
 * @returns 경로가 존재하면 true
 */
async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * WSL2 환경에서 Windows 홈 디렉토리 경로를 감지합니다.
 * DrvFs를 통해 접근 가능한 Windows 파일 시스템의 사용자 프로필 경로를 반환합니다.
 *
 * @returns Windows 홈 디렉토리 경로 또는 null (WSL2가 아니거나 접근 불가 시)
 */
async function detectWSL2WindowsHome(): Promise<string | null> {
  try {
    // wslpath: Windows 경로를 WSL 경로로 변환하는 유틸리티
    const { stdout } = await execFileAsync("wslpath", ["-u", "%USERPROFILE%"]);
    const resolved = stdout.trim();

    // /mnt/로 시작하는 유효한 경로인지, 실제로 접근 가능한지 확인
    if (resolved.startsWith("/mnt/") && (await pathExists(resolved))) {
      return resolved;
    }
  } catch {
    // wslpath를 사용할 수 없거나 실패
  }

  // 폴백: /mnt/c/Users가 있는지 확인
  const fallback = "/mnt/c/Users";
  if (await pathExists(fallback)) {
    // 정확한 사용자 디렉토리를 알 수 없으므로 null 반환
    return null;
  }

  return null;
}

/**
 * bubblewrap(bwrap) 명령의 인수 배열을 생성합니다.
 *
 * 마운트 구성:
 * - 시스템 경로 (/usr, /bin, /lib, /lib64, /etc, /sbin): 읽기 전용
 * - /proc: procfs, /dev: devfs
 * - /tmp: tmpfs (휘발성, dbcode 전용 하위 디렉토리는 쓰기 가능)
 * - 프로젝트 디렉토리: 읽기/쓰기
 * - 홈 디렉토리 설정 폴더: 읽기 전용
 * - 사용자 지정 추가 경로
 *
 * 격리 설정:
 * - PID 네임스페이스 격리 (--unshare-pid)
 * - 새 세션 (--new-session)
 * - 부모 종료 시 자동 종료 (--die-with-parent)
 * - 선택적 네트워크 격리
 *
 * @param config - bubblewrap 설정
 * @returns bwrap 명령의 인수 배열 (readonly)
 */
export async function generateBubblewrapArgs(config: BubblewrapConfig): Promise<readonly string[]> {
  const {
    command,
    args = [],
    cwd,
    projectDir,
    homeDir = homedir(),
    tmpDir = tmpdir(),
    env,
    networkAccess = true,
    allowedPaths = [],
  } = config;

  const bwrapArgs: string[] = [];

  // 시스템 경로를 읽기 전용으로 바인드 마운트 (존재하는 경로만)
  for (const sysPath of SYSTEM_RO_PATHS) {
    if (await pathExists(sysPath)) {
      bwrapArgs.push("--ro-bind", sysPath, sysPath);
    }
  }

  // 일부 배포판에서 사용하는 심볼릭 링크 생성 (/lib → /usr/lib 등)
  if (!(await pathExists("/lib")) && (await pathExists("/usr/lib"))) {
    bwrapArgs.push("--symlink", "usr/lib", "/lib");
  }
  if (!(await pathExists("/lib64")) && (await pathExists("/usr/lib64"))) {
    bwrapArgs.push("--symlink", "usr/lib64", "/lib64");
  }
  if (!(await pathExists("/bin")) && (await pathExists("/usr/bin"))) {
    bwrapArgs.push("--symlink", "usr/bin", "/bin");
  }
  if (!(await pathExists("/sbin")) && (await pathExists("/usr/sbin"))) {
    bwrapArgs.push("--symlink", "usr/sbin", "/sbin");
  }

  // 특수 파일 시스템 마운트
  bwrapArgs.push("--proc", "/proc"); // 프로세스 정보
  bwrapArgs.push("--dev", "/dev");   // 장치 파일

  // /tmp는 tmpfs로 마운트 (격리된 임시 공간)
  bwrapArgs.push("--tmpfs", "/tmp");

  // dbcode 전용 임시 디렉토리를 /tmp/dbcode에 쓰기 가능하게 마운트
  if (await pathExists(tmpDir)) {
    bwrapArgs.push("--bind", tmpDir, "/tmp/dbcode");
  }

  // 프로젝트 디렉토리: 읽기/쓰기 마운트 (파일 수정 도구에 필요)
  bwrapArgs.push("--bind", projectDir, projectDir);

  // 홈 디렉토리 설정 폴더: 읽기 전용 마운트
  for (const subDir of HOME_RO_DIRS) {
    const fullPath = `${homeDir}/${subDir}`;
    if (await pathExists(fullPath)) {
      bwrapArgs.push("--ro-bind", fullPath, `${homeDir}/${subDir}`);
    }
  }

  // .local 디렉토리는 읽기/쓰기 마운트 (일부 도구가 여기에 기록)
  const localPath = `${homeDir}/.local`;
  if (await pathExists(localPath)) {
    bwrapArgs.push("--bind", localPath, `${homeDir}/.local`);
  }

  // WSL2: Windows 홈 디렉토리를 읽기 전용으로 마운트 (있는 경우)
  if (await isWSL2()) {
    const winHome = await detectWSL2WindowsHome();
    if (winHome) {
      bwrapArgs.push("--ro-bind", winHome, winHome);
    }
  }

  // 사용자가 지정한 추가 경로 마운트
  for (const mount of allowedPaths) {
    const sandboxPath = mount.sandboxPath ?? mount.hostPath;
    if (await pathExists(mount.hostPath)) {
      if (mount.writable) {
        bwrapArgs.push("--bind", mount.hostPath, sandboxPath);
      } else {
        bwrapArgs.push("--ro-bind", mount.hostPath, sandboxPath);
      }
    }
  }

  // 환경 변수 설정
  bwrapArgs.push("--setenv", "HOME", homeDir);

  if (env) {
    for (const [key, value] of Object.entries(env)) {
      bwrapArgs.push("--setenv", key, value);
    }
  }

  // 작업 디렉토리 설정
  if (cwd) {
    bwrapArgs.push("--chdir", cwd);
  }

  // 네임스페이스 격리 플래그
  bwrapArgs.push("--unshare-pid");     // PID 네임스페이스 격리
  bwrapArgs.push("--die-with-parent"); // 부모 프로세스 종료 시 자동 종료
  bwrapArgs.push("--new-session");     // 새 세션 생성 (터미널 탈취 방지)

  // 네트워크 접근 제어
  if (networkAccess) {
    bwrapArgs.push("--share-net"); // 호스트의 네트워크를 공유
  } else {
    bwrapArgs.push("--unshare-net"); // 네트워크 격리 (외부 접근 불가)
  }

  // 명령 구분자(--) 이후에 실행할 명령과 인수
  bwrapArgs.push("--", command, ...args);

  return bwrapArgs;
}

/**
 * bubblewrap 샌드박스 안에서 명령을 실행합니다.
 *
 * Linux(네이티브 또는 WSL2)에서만 사용 가능합니다.
 * bwrap가 설치되어 있지 않거나, 권한이 부족하거나, 타임아웃되면 에러를 발생시킵니다.
 *
 * @param config - bubblewrap 실행 설정
 * @returns 실행 결과 (stdout, stderr, exitCode, timedOut)
 * @throws BubblewrapError - bwrap 미설치, 권한 부족, 실행 실패 시
 */
export async function executeBubblewrapped(config: BubblewrapConfig): Promise<SandboxResult> {
  const { timeoutMs = 120_000 } = config;

  // bwrap 설치 확인
  try {
    await execFileAsync("bwrap", ["--version"]);
  } catch (error) {
    // ENOENT: bwrap 명령이 PATH에 없음 → 설치 안내 메시지
    const message =
      error instanceof Error && "code" in error && error.code === "ENOENT"
        ? "Bubblewrap (bwrap) is not installed. Install it with your package manager:\n" +
          "  Ubuntu/Debian: sudo apt install bubblewrap\n" +
          "  Fedora: sudo dnf install bubblewrap\n" +
          "  Arch: sudo pacman -S bubblewrap"
        : "Failed to verify bubblewrap installation.";

    throw new BubblewrapError(message, {
      cause: error instanceof Error ? error.message : String(error),
    });
  }

  // bwrap 인수 배열 생성
  const bwrapArgs = await generateBubblewrapArgs(config);

  // AbortController로 타임아웃 관리
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const result = await execFileAsync("bwrap", [...bwrapArgs], {
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024, // 최대 버퍼 10MB
      signal: controller.signal,
    });

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: 0,
      timedOut: false,
    };
  } catch (error: unknown) {
    // AbortError: AbortController에 의한 타임아웃
    if (error instanceof Error && error.name === "AbortError") {
      return {
        stdout: "",
        stderr: "Command timed out",
        exitCode: 124, // 124는 표준 타임아웃 종료 코드 (timeout 명령과 동일)
        timedOut: true,
      };
    }

    // killed: 타임아웃 또는 시그널에 의한 강제 종료
    if (error instanceof Error && "killed" in error && (error as Record<string, unknown>).killed) {
      return {
        stdout: "",
        stderr: "Command timed out",
        exitCode: 124,
        timedOut: true,
      };
    }

    // EACCES: 권한 부족 — 네임스페이스 기능 사용 불가
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "EACCES"
    ) {
      throw new BubblewrapError(
        "Permission denied when executing bubblewrap. " +
          "Ensure your user has permission to use namespace features, " +
          "or check that the kernel allows unprivileged user namespaces: " +
          "sysctl kernel.unprivileged_userns_clone=1",
        {
          cause: error.message,
        },
      );
    }

    // 비정상 종료 코드 — 명령 자체는 실행되었으나 실패한 정상적인 결과
    if (
      error instanceof Error &&
      "code" in error &&
      typeof (error as Record<string, unknown>).code === "number"
    ) {
      const execError = error as Error & {
        readonly stdout: string;
        readonly stderr: string;
        readonly code: number;
      };
      return {
        stdout: execError.stdout ?? "",
        stderr: execError.stderr ?? "",
        exitCode: execError.code,
        timedOut: false,
      };
    }

    throw new BubblewrapError("Bubblewrap execution failed", {
      command: config.command,
      cause: error instanceof Error ? error.message : String(error),
    });
  } finally {
    clearTimeout(timer);
  }
}

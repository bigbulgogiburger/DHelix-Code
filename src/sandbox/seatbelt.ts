/**
 * macOS Seatbelt 샌드박스 — sandbox-exec를 사용한 프로세스 격리
 *
 * macOS의 내장 샌드박스 프레임워크(Seatbelt)를 사용하여
 * 명령어를 제한된 환경에서 실행합니다.
 *
 * 보안 규칙:
 * - 파일시스템: 프로젝트 디렉토리 + /tmp + 홈 디렉토리 일부만 읽기/쓰기 허용
 * - 시스템 경로: /usr, /bin, /Library 등은 읽기 전용
 * - 네트워크: 아웃바운드(외부로 나가는) 연결만 허용 (API 호출용)
 * - 인바운드(들어오는) 연결: 차단 (포트 리스닝 금지)
 * - 프로세스: fork/exec 허용 (bash 도구 실행에 필요)
 *
 * macOS가 아닌 플랫폼에서는 샌드박스 없이 직접 실행합니다.
 *
 * @example
 * const result = await executeSandboxed({
 *   command: "node",
 *   args: ["script.js"],
 *   projectDir: "/Users/name/project",
 * });
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { BaseError } from "../utils/error.js";

const execFileAsync = promisify(execFile);

/** 샌드박스 실행 에러 */
export class SandboxError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "SANDBOX_ERROR", context);
  }
}

/** 샌드박스 내 명령 실행 설정 */
export interface SandboxConfig {
  /** 샌드박스 안에서 실행할 명령어 */
  readonly command: string;
  /** 명령어의 인수(arguments) 배열 */
  readonly args?: readonly string[];
  /** 작업 디렉토리 */
  readonly cwd?: string;
  /** 파일 시스템 접근을 허용할 프로젝트 디렉토리 */
  readonly projectDir: string;
  /** 홈 디렉토리 (일부 접근 허용) */
  readonly homeDir?: string;
  /** 실행 타임아웃 (밀리초) */
  readonly timeoutMs?: number;
  /** 전달할 환경 변수 */
  readonly env?: Record<string, string>;
}

/**
 * macOS Seatbelt(sandbox-exec) 프로파일을 생성합니다.
 *
 * Seatbelt 프로파일은 S-expression(Lisp 유사 문법)으로 작성되며,
 * "deny default"로 시작하여 필요한 권한만 명시적으로 허용합니다.
 *
 * 허용 규칙:
 * - 프로세스: fork/exec 허용 (명령어 실행에 필수)
 * - 시스템 경로 읽기: /usr, /bin, /sbin, /Library, /System 등
 * - 프로젝트 디렉토리 읽기/쓰기
 * - 임시(temp) 디렉토리 읽기/쓰기
 * - 홈 디렉토리 설정 파일 읽기/쓰기 (.config, .npm, .cache 등)
 * - 아웃바운드 TCP 연결 (LLM API 호출용)
 * - DNS 해석 (UDP 포트 53)
 * - 인바운드 네트워크 차단 (보안)
 *
 * @param config - 프로파일 생성 설정
 * @returns Seatbelt 프로파일 문자열 (S-expression)
 */
export function generateSeatbeltProfile(config: {
  projectDir: string;
  homeDir: string;
  tmpDir: string;
}): string {
  const { projectDir, homeDir, tmpDir } = config;

  return `(version 1)
(deny default)

;; 기본 프로세스 작업 허용
(allow process-fork)
(allow process-exec)
(allow signal (target self))

;; 시스템 리소스 읽기 허용
(allow file-read*
  (subpath "/usr")
  (subpath "/bin")
  (subpath "/sbin")
  (subpath "/Library")
  (subpath "/System")
  (subpath "/private/etc")
  (subpath "/dev")
  (subpath "/Applications/Xcode.app")
  (literal "/")
  (literal "/etc")
  (literal "/tmp")
  (literal "/var")
  (literal "/private")
  (literal "/private/tmp")
  (literal "/private/var")
)

;; 프로젝트 디렉토리 읽기/쓰기 허용
(allow file-read* file-write*
  (subpath "${escapeProfilePath(projectDir)}")
)

;; 임시 디렉토리 읽기/쓰기 허용
(allow file-read* file-write*
  (subpath "${escapeProfilePath(tmpDir)}")
  (subpath "/private/tmp")
  (subpath "/private/var/folders")
)

;; 홈 디렉토리 설정 및 도구 폴더 읽기/쓰기 허용
(allow file-read* file-write*
  (subpath "${escapeProfilePath(homeDir)}/.config")
  (subpath "${escapeProfilePath(homeDir)}/.local")
  (subpath "${escapeProfilePath(homeDir)}/.npm")
  (subpath "${escapeProfilePath(homeDir)}/.node_modules")
  (subpath "${escapeProfilePath(homeDir)}/.cache")
  (subpath "${escapeProfilePath(homeDir)}/.claude")
  (subpath "${escapeProfilePath(homeDir)}/.git")
)

;; 홈 디렉토리 자체 및 도구 설정 폴더 읽기 허용
(allow file-read*
  (literal "${escapeProfilePath(homeDir)}")
  (subpath "${escapeProfilePath(homeDir)}/.nvm")
  (subpath "${escapeProfilePath(homeDir)}/.volta")
  (subpath "${escapeProfilePath(homeDir)}/.rustup")
  (subpath "${escapeProfilePath(homeDir)}/.cargo")
)

;; 아웃바운드(외부로 나가는) 네트워크 연결 허용 (LLM API 호출용)
(allow network-outbound
  (remote tcp)
)

;; DNS 해석 허용 (도메인명 → IP 주소 변환)
(allow network-outbound
  (remote udp (to (local-port 53)))
)

;; 인바운드(들어오는) 네트워크 차단 (포트 리스닝 금지)
(deny network-inbound)

;; 시스템 정보 읽기 허용 (sysctl)
(allow sysctl-read)

;; IPC(프로세스 간 통신) 허용 — Node.js 내부 동작에 필요
(allow ipc-posix-shm-read-data)
(allow ipc-posix-shm-write-data)

;; Mach 포트 조회 허용 — 많은 시스템 작업에 필요
(allow mach-lookup)
`;
}

/**
 * Seatbelt 프로파일 경로 문자열에서 특수 문자를 이스케이프합니다.
 * 쌍따옴표(")를 이스케이프하여 프로파일 파싱 오류를 방지합니다.
 *
 * @param path - 이스케이프할 경로 문자열
 * @returns 이스케이프된 경로 문자열
 */
function escapeProfilePath(path: string): string {
  return path.replace(/"/g, '\\"');
}

/**
 * macOS Seatbelt 샌드박스 안에서 명령을 실행합니다.
 *
 * macOS(darwin)에서만 샌드박스를 적용하고,
 * 다른 플랫폼에서는 샌드박스 없이 직접 실행합니다.
 *
 * 실행 과정 (macOS):
 * 1. Seatbelt 프로파일 생성 (S-expression 형식)
 * 2. 임시 파일에 프로파일 저장
 * 3. sandbox-exec -f 프로파일경로 명령어 인수... 로 실행
 * 4. 실행 완료 후 프로파일 임시 파일 삭제 (finally에서 정리)
 *
 * @param config - 샌드박스 실행 설정
 * @returns stdout과 stderr를 포함한 실행 결과
 * @throws SandboxError - 타임아웃 또는 실행 실패 시
 */
export async function executeSandboxed(config: SandboxConfig): Promise<{
  stdout: string;
  stderr: string;
}> {
  const {
    command,
    args = [],
    cwd,
    projectDir,
    homeDir = process.env.HOME ?? "/Users/unknown",
    timeoutMs = 120_000, // 기본 타임아웃: 2분
    env,
  } = config;

  // macOS가 아닌 플랫폼에서는 샌드박스 없이 직접 실행
  if (process.platform !== "darwin") {
    const result = await execFileAsync(command, [...args], {
      cwd,
      timeout: timeoutMs,
      env: env ? { ...process.env, ...env } : undefined,
    });
    return { stdout: result.stdout, stderr: result.stderr };
  }

  // Seatbelt 프로파일 생성
  const profile = generateSeatbeltProfile({
    projectDir,
    homeDir,
    tmpDir: tmpdir(),
  });

  // 프로파일을 임시 파일로 저장 (고유 이름을 위해 UUID 사용)
  const profilePath = join(tmpdir(), `dbcode-sandbox-${randomUUID()}.sb`);
  await writeFile(profilePath, profile, "utf-8");

  try {
    // sandbox-exec로 명령 실행: -f 옵션으로 프로파일 파일 지정
    const result = await execFileAsync("sandbox-exec", ["-f", profilePath, command, ...args], {
      cwd,
      timeout: timeoutMs,
      env: env ? { ...process.env, ...env } : undefined,
      maxBuffer: 10 * 1024 * 1024, // 최대 버퍼 10MB
    });

    return { stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    // 타임아웃으로 프로세스가 kill된 경우
    if (error instanceof Error && "killed" in error) {
      throw new SandboxError("Sandboxed command timed out", {
        command,
        timeoutMs,
      });
    }
    throw new SandboxError("Sandboxed command failed", {
      command,
      cause: error instanceof Error ? error.message : String(error),
    });
  } finally {
    // 프로파일 임시 파일 정리 (에러 무시)
    await unlink(profilePath).catch(() => {});
  }
}

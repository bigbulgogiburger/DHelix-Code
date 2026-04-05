/**
 * Container-based Sandbox — Docker를 이용한 격리 실행 환경
 *
 * Docker 컨테이너를 사용하여 명령을 완전히 격리된 환경에서 실행합니다.
 * 읽기 전용 파일 시스템, 메모리 제한, CPU 제한, 네트워크 차단을 지원합니다.
 *
 * 보안 규칙:
 * - 파일 시스템: 컨테이너 내부는 읽기 전용, 프로젝트 디렉토리는 /workspace에 읽기 전용 마운트
 * - 네트워크: 기본적으로 네트워크 접근 차단 (--network none)
 * - 메모리: 기본 512MB 제한
 * - CPU: 기본 1.0 코어 제한
 * - 컨테이너 실행 후 자동 삭제 (--rm)
 *
 * @example
 * const result = await executeInContainer({
 *   command: "node",
 *   args: ["script.js"],
 *   projectDir: "/Users/name/project",
 * });
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { BaseError } from "../utils/error.js";

const execFileAsync = promisify(execFile);

/** 기본 컨테이너 이미지 */
const DEFAULT_IMAGE = "node:20-slim";

/** 기본 메모리 제한 (MB) */
const DEFAULT_MEMORY_LIMIT_MB = 512;

/** 기본 CPU 제한 (코어 수) */
const DEFAULT_CPU_LIMIT = 1.0;

/** 기본 실행 타임아웃 (ms) */
const DEFAULT_TIMEOUT_MS = 120_000;

/** 컨테이너 내부 작업 디렉토리 */
const WORKSPACE_DIR = "/workspace";

/** Container 샌드박스 실행 에러 */
export class ContainerSandboxError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "CONTAINER_SANDBOX_ERROR", context);
  }
}

/**
 * Docker 컨테이너 샌드박스 실행 설정
 *
 * @property image - 사용할 Docker 이미지 (기본값: "node:20-slim")
 * @property command - 컨테이너 내에서 실행할 명령어
 * @property args - 명령어 인수 배열
 * @property projectDir - 호스트의 프로젝트 디렉토리 (읽기 전용으로 /workspace에 마운트)
 * @property timeoutMs - 실행 타임아웃 (ms, 기본값: 120_000)
 * @property memoryLimitMb - 메모리 제한 (MB, 기본값: 512)
 * @property cpuLimit - CPU 제한 (코어 수, 기본값: 1.0)
 * @property networkAccess - 네트워크 접근 허용 여부 (기본값: false)
 * @property env - 컨테이너 내부에 설정할 환경 변수
 */
export interface ContainerSandboxConfig {
  readonly image?: string;
  readonly command: string;
  readonly args?: readonly string[];
  readonly projectDir: string;
  readonly timeoutMs?: number;
  readonly memoryLimitMb?: number;
  readonly cpuLimit?: number;
  readonly networkAccess?: boolean;
  readonly env?: Record<string, string>;
}

/** 컨테이너 실행 결과 */
export interface ContainerResult {
  /** 표준 출력 */
  readonly stdout: string;
  /** 표준 에러 */
  readonly stderr: string;
  /** 프로세스 종료 코드 */
  readonly exitCode: number;
}

/**
 * Docker가 설치되어 있고 실행 가능한지 확인합니다.
 *
 * `docker info` 명령으로 Docker 데몬이 실행 중인지 확인합니다.
 *
 * @returns Docker 사용 가능 여부
 */
export async function isDockerAvailable(): Promise<boolean> {
  try {
    await execFileAsync("docker", ["info"], { timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * 설치된 Docker의 버전 문자열을 반환합니다.
 *
 * @returns 버전 문자열 (예: "24.0.5") 또는 실패 시 null
 */
export async function getDockerVersion(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("docker", ["--version"], { timeout: 5_000 });
    // "Docker version 24.0.5, build ced0996" 형식에서 버전 번호 추출
    const match = /Docker version ([^\s,]+)/.exec(stdout);
    return match ? match[1] : stdout.trim();
  } catch {
    return null;
  }
}

/**
 * `docker run` 명령의 인수 배열을 생성합니다.
 *
 * 이 함수는 부작용이 없는 순수 함수로, 테스트에서 직접 호출하여 인수를 검증할 수 있습니다.
 *
 * 생성 규칙:
 * - `--rm`: 컨테이너 실행 완료 후 자동 삭제
 * - `--read-only`: 컨테이너 파일 시스템을 읽기 전용으로 설정
 * - `--memory`: 메모리 사용량 제한
 * - `--cpus`: CPU 사용량 제한
 * - `--network`: 네트워크 정책 (none 또는 bridge)
 * - `-v projectDir:/workspace:ro`: 프로젝트 디렉토리를 읽기 전용으로 마운트
 * - `-w /workspace`: 작업 디렉토리를 /workspace로 설정
 * - `-e`: 환경 변수 설정
 *
 * @param config - 컨테이너 샌드박스 설정
 * @returns docker run 명령에 전달할 인수 배열 (readonly)
 */
export function buildSandboxArgs(config: ContainerSandboxConfig): readonly string[] {
  const {
    image = DEFAULT_IMAGE,
    command,
    args = [],
    projectDir,
    memoryLimitMb = DEFAULT_MEMORY_LIMIT_MB,
    cpuLimit = DEFAULT_CPU_LIMIT,
    networkAccess = false,
    env = {},
  } = config;

  const dockerArgs: string[] = [
    "run",
    "--rm", // 실행 완료 후 컨테이너 자동 삭제
    "--read-only", // 컨테이너 파일 시스템 읽기 전용
    `--memory=${memoryLimitMb}m`, // 메모리 제한
    `--cpus=${cpuLimit}`, // CPU 제한
    "--network",
    networkAccess ? "bridge" : "none", // 네트워크 정책
    "-v",
    `${projectDir}:${WORKSPACE_DIR}:ro`, // 프로젝트 디렉토리 마운트 (읽기 전용)
    "-w",
    WORKSPACE_DIR, // 작업 디렉토리
  ];

  // 환경 변수 주입
  for (const [key, value] of Object.entries(env)) {
    dockerArgs.push("-e", `${key}=${value}`);
  }

  // 이미지 및 실행 명령
  dockerArgs.push(image, command, ...args);

  return dockerArgs;
}

/**
 * Docker 컨테이너 안에서 명령을 실행합니다.
 *
 * 실행 과정:
 * 1. Docker 사용 가능 여부 확인
 * 2. `buildSandboxArgs`로 docker run 인수 생성
 * 3. 타임아웃을 적용하여 명령 실행
 * 4. stdout, stderr, exitCode 반환
 *
 * @param config - 컨테이너 샌드박스 설정
 * @returns 실행 결과 (stdout, stderr, exitCode)
 * @throws ContainerSandboxError - Docker 미설치, 타임아웃, 실행 실패 시
 */
export async function executeInContainer(config: ContainerSandboxConfig): Promise<ContainerResult> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS } = config;

  // Docker 사용 가능 여부 확인
  const available = await isDockerAvailable();
  if (!available) {
    throw new ContainerSandboxError(
      "Docker is not available. Install Docker Desktop or Docker Engine to use container sandbox.",
      { command: config.command },
    );
  }

  const dockerArgs = buildSandboxArgs(config);

  try {
    const result = await execFileAsync("docker", [...dockerArgs], {
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024, // 최대 버퍼 10MB
    });

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: 0,
    };
  } catch (error: unknown) {
    // 타임아웃으로 프로세스가 강제 종료된 경우
    if (error instanceof Error && "killed" in error && (error as Record<string, unknown>).killed) {
      throw new ContainerSandboxError("Container command timed out", {
        command: config.command,
        timeoutMs,
      });
    }

    // 비정상 종료 코드 — 명령 자체는 실행되었으나 실패한 정상 결과
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
      };
    }

    throw new ContainerSandboxError("Container execution failed", {
      command: config.command,
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}

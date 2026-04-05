/**
 * 프로세스 수준 샌드박스 — spawn() 전에 환경변수 정제와 파일시스템 정책을 적용
 *
 * child_process.spawn()으로 자식 프로세스를 실행하기 전에
 * 환경변수를 정제하고 파일시스템 접근 경로를 검증합니다.
 *
 * OS 수준 샌드박스(Seatbelt, Bubblewrap)와 달리
 * 이 모듈은 순수 Node.js로 동작하여 모든 플랫폼에서 사용 가능합니다.
 *
 * 주요 기능:
 * - 환경변수 정제: 민감한 API 키, 토큰 등을 자식 프로세스에서 제거
 * - 파일시스템 정책: 허용/차단 경로 규칙으로 접근 검증
 * - 출력 크기 제한: maxOutputSize 설정으로 메모리 폭발 방지
 *
 * @example
 * import { createProcessSandbox, DEFAULT_FILESYSTEM_POLICY } from "./process-sandbox.js";
 *
 * const sandbox = createProcessSandbox({
 *   workingDir: "/path/to/project",
 *   timeout: 120_000,
 * });
 *
 * // 정제된 환경변수를 spawn에 전달
 * spawn("node", ["script.js"], { env: sandbox.env });
 *
 * // 경로 접근 검증
 * const check = sandbox.validatePath("/home/user/.ssh/id_rsa");
 * console.log(check.allowed); // false
 * console.log(check.reason);  // "Matches denied pattern: ~/.ssh/**"
 */

import { resolve, normalize, isAbsolute } from "node:path";
import { homedir } from "node:os";
import { sanitizeEnv, type EnvSanitizeConfig } from "./env-sanitizer.js";

/**
 * 프로세스 샌드박스 설정
 */
export interface ProcessSandboxConfig {
  /** 환경변수 정제 설정 */
  readonly envConfig?: EnvSanitizeConfig;
  /** 작업 디렉토리 (프로젝트 루트) */
  readonly workingDir: string;
  /** 실행 타임아웃 (밀리초) */
  readonly timeout: number;
  /** 최대 출력 크기 (바이트, 기본: 10MB) */
  readonly maxOutputSize?: number;
  /** 파일시스템 접근 정책 */
  readonly filesystemPolicy?: FilesystemPolicy;
}

/**
 * 파일시스템 접근 정책
 *
 * allowedPaths와 deniedPaths 규칙을 정의합니다.
 * 검증 시 deniedPaths가 먼저 확인되고, 이후 allowedPaths가 확인됩니다.
 * 어느 규칙에도 해당하지 않으면 기본적으로 허용됩니다.
 */
export interface FilesystemPolicy {
  /** 접근을 허용하는 경로 규칙 목록 */
  readonly allowedPaths: readonly PathRule[];
  /** 접근을 차단하는 경로 규칙 목록 */
  readonly deniedPaths: readonly PathRule[];
}

/**
 * 파일시스템 경로 규칙
 */
export interface PathRule {
  /** 경로 패턴 (glob 또는 절대 경로) */
  readonly pattern: string;
  /** 하위 디렉토리까지 재귀 적용 여부 */
  readonly recursive: boolean;
  /** 규칙 사유 (로깅/디버깅용) */
  readonly reason: string;
}

/** 프로세스 샌드박스 인스턴스 — 정제된 환경변수와 경로 검증 함수를 제공 */
export interface ProcessSandboxInstance {
  /** 정제된 환경변수 */
  readonly env: Record<string, string>;
  /**
   * 지정된 경로가 파일시스템 정책에 의해 허용되는지 검증합니다.
   *
   * @param path - 검증할 파일 경로
   * @returns 허용 여부와 사유
   */
  readonly validatePath: (path: string) => { readonly allowed: boolean; readonly reason: string };
  /** 설정된 최대 출력 크기 (바이트) */
  readonly maxOutputSize: number;
  /** 설정된 타임아웃 (밀리초) */
  readonly timeout: number;
}

/** 기본 최대 출력 크기: 10MB */
const DEFAULT_MAX_OUTPUT_SIZE = 10 * 1024 * 1024;

/**
 * 기본 파일시스템 정책을 생성합니다.
 *
 * 허용 경로:
 * - 프로젝트 루트 디렉토리 및 하위 (작업 공간)
 * - ~/.dhelix/ (Dhelix 설정 디렉토리)
 * - /tmp/dhelix-* (임시 파일)
 *
 * 차단 경로:
 * - ~/.ssh/ (SSH 키)
 * - ~/.aws/ (AWS 자격증명)
 * - ~/.gnupg/ (GPG 키)
 * - ~/.env* (환경변수 파일)
 * - ~/.config/gcloud/ (Google Cloud 자격증명)
 *
 * @param projectDir - 프로젝트 루트 디렉토리 경로
 * @returns 기본 파일시스템 정책
 */
export function createDefaultFilesystemPolicy(projectDir: string): FilesystemPolicy {
  const home = homedir();

  return {
    allowedPaths: [
      {
        pattern: resolve(projectDir),
        recursive: true,
        reason: "Project working directory",
      },
      {
        pattern: resolve(home, ".dhelix"),
        recursive: true,
        reason: "Dhelix configuration directory",
      },
      {
        pattern: "/tmp/dhelix-",
        recursive: true,
        reason: "Dhelix temporary files",
      },
    ],
    deniedPaths: [
      {
        pattern: resolve(home, ".ssh"),
        recursive: true,
        reason: "SSH keys and configuration",
      },
      {
        pattern: resolve(home, ".aws"),
        recursive: true,
        reason: "AWS credentials",
      },
      {
        pattern: resolve(home, ".gnupg"),
        recursive: true,
        reason: "GPG keys and configuration",
      },
      {
        pattern: resolve(home, ".env"),
        recursive: false,
        reason: "Environment variable files",
      },
      {
        pattern: resolve(home, ".config", "gcloud"),
        recursive: true,
        reason: "Google Cloud credentials",
      },
    ],
  };
}

/**
 * 경로가 규칙 패턴과 일치하는지 확인합니다.
 *
 * - recursive=true: 패턴 경로 및 그 하위 경로 모두 일치
 * - recursive=false: 패턴 경로와 정확히 일치하거나 패턴으로 시작하는 파일
 *
 * @param targetPath - 검증할 경로 (정규화된 절대 경로)
 * @param rule - 검증할 규칙
 * @returns 규칙과 일치하면 true
 */
function matchesRule(targetPath: string, rule: PathRule): boolean {
  const normalizedPattern = normalize(rule.pattern);

  if (rule.recursive) {
    // 패턴 경로 자체이거나 하위 경로인 경우 일치
    return targetPath === normalizedPattern || targetPath.startsWith(normalizedPattern + "/");
  }

  // 비재귀: 정확히 일치하거나 패턴으로 시작하는 파일명
  return targetPath === normalizedPattern || targetPath.startsWith(normalizedPattern);
}

/**
 * 경로가 파일시스템 정책에 의해 허용되는지 검증합니다.
 *
 * 검증 순서:
 * 1. deniedPaths 규칙 확인 — 일치하면 즉시 차단
 * 2. allowedPaths가 비어있으면 기본 허용
 * 3. allowedPaths 규칙 확인 — 일치하면 허용
 * 4. allowedPaths에 규칙이 있지만 일치하지 않으면 차단
 *
 * @param targetPath - 검증할 파일 경로
 * @param policy - 적용할 파일시스템 정책
 * @param workingDir - 상대 경로를 절대 경로로 변환할 기준 디렉토리
 * @returns 허용 여부와 사유
 */
function checkPath(
  targetPath: string,
  policy: FilesystemPolicy,
  workingDir: string,
): { readonly allowed: boolean; readonly reason: string } {
  // 상대 경로를 절대 경로로 변환
  const absolutePath = isAbsolute(targetPath)
    ? normalize(targetPath)
    : normalize(resolve(workingDir, targetPath));

  // 1. 차단 목록 확인 (우선순위 높음)
  for (const rule of policy.deniedPaths) {
    if (matchesRule(absolutePath, rule)) {
      return {
        allowed: false,
        reason: `Blocked: ${rule.reason} (pattern: ${rule.pattern})`,
      };
    }
  }

  // 2. 허용 목록이 비어있으면 기본 허용
  if (policy.allowedPaths.length === 0) {
    return { allowed: true, reason: "No allow rules defined; default allow" };
  }

  // 3. 허용 목록 확인
  for (const rule of policy.allowedPaths) {
    if (matchesRule(absolutePath, rule)) {
      return {
        allowed: true,
        reason: `Allowed: ${rule.reason} (pattern: ${rule.pattern})`,
      };
    }
  }

  // 4. 허용 목록에 없으면 차단
  return {
    allowed: false,
    reason: "Path not in any allowed rule",
  };
}

/**
 * 프로세스 수준 샌드박스를 생성합니다.
 *
 * 반환되는 객체는 다음을 포함합니다:
 * - env: 정제된 환경변수 (spawn의 env 옵션에 전달)
 * - validatePath(): 파일 경로의 접근 허용 여부를 검증하는 함수
 * - maxOutputSize: 설정된 최대 출력 크기
 * - timeout: 설정된 타임아웃
 *
 * @param config - 샌드박스 설정
 * @returns 프로세스 샌드박스 인스턴스
 *
 * @example
 * const sandbox = createProcessSandbox({
 *   workingDir: "/path/to/project",
 *   timeout: 120_000,
 *   maxOutputSize: 5 * 1024 * 1024, // 5MB
 * });
 *
 * const proc = spawn("node", ["script.js"], {
 *   env: sandbox.env,
 * });
 */
export function createProcessSandbox(config: ProcessSandboxConfig): ProcessSandboxInstance {
  const {
    envConfig,
    workingDir,
    timeout,
    maxOutputSize = DEFAULT_MAX_OUTPUT_SIZE,
    filesystemPolicy,
  } = config;

  // 환경변수 정제
  const currentEnv = process.env as Record<string, string | undefined>;
  const sanitizedEnv = sanitizeEnv(currentEnv, envConfig);

  // 파일시스템 정책 (미설정 시 기본 정책 생성)
  const policy = filesystemPolicy ?? createDefaultFilesystemPolicy(workingDir);

  return {
    env: sanitizedEnv,
    validatePath: (path: string) => checkPath(path, policy, workingDir),
    maxOutputSize,
    timeout,
  };
}

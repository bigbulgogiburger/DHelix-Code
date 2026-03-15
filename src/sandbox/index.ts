/**
 * 샌드박스 진입점 — 크로스 플랫폼 샌드박스 실행 통합 모듈
 *
 * 현재 플랫폼(macOS/Linux/Windows)에 맞는 샌드박스를 자동 선택하여
 * 명령을 격리된 환경에서 실행합니다.
 *
 * 플랫폼별 샌드박스:
 * - macOS: Seatbelt (sandbox-exec) — 내장 샌드박스 프레임워크
 * - Linux: Bubblewrap (bwrap) — 네임스페이스 기반 격리
 * - Windows/기타: 샌드박스 없음 — 보안 경고와 함께 직접 실행
 *
 * @example
 * import { executeSandboxed, getSandboxStatus } from "./sandbox/index.js";
 *
 * const status = await getSandboxStatus();
 * console.log(status.type); // "seatbelt" | "bubblewrap" | "none"
 *
 * const result = await executeSandboxed({
 *   command: "node",
 *   args: ["script.js"],
 *   projectDir: "/path/to/project",
 * });
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { isMacOS, isLinux } from "../utils/platform.js";
import { executeSandboxed as executeSeatbelt, SandboxConfig } from "./seatbelt.js";
import {
  executeBubblewrap,
  hasBubblewrap,
  isWSL,
  isWSL1,
  type LinuxSandboxConfig,
} from "./linux.js";

// 타입과 에러 클래스를 재내보내기(re-export)하여 외부에서 쉽게 사용
export type { SandboxConfig } from "./seatbelt.js";
export type { LinuxSandboxConfig } from "./linux.js";
export { SandboxError } from "./seatbelt.js";
export { BubblewrapError } from "./linux.js";

const execFileAsync = promisify(execFile);

/**
 * 현재 플랫폼에서 감지된 샌드박스 타입.
 * - "seatbelt": macOS Seatbelt (sandbox-exec)
 * - "bubblewrap": Linux Bubblewrap (bwrap)
 * - "none": 사용 가능한 샌드박스 없음
 */
export type SandboxType = "seatbelt" | "bubblewrap" | "none";

/** 샌드박스 사용 가능 여부 확인 결과 */
export interface SandboxStatus {
  /** 샌드박스 사용 가능 여부 */
  readonly available: boolean;
  /** 사용 가능한 샌드박스 타입 */
  readonly type: SandboxType;
  /** 환경에 대한 경고 메시지 목록 */
  readonly warnings: readonly string[];
}

/**
 * 현재 플랫폼에 맞는 샌드박스에서 명령을 실행합니다.
 *
 * 자동 선택 로직:
 * 1. macOS → Seatbelt (sandbox-exec) 사용
 * 2. Linux → Bubblewrap (bwrap) 사용
 * 3. Windows/기타 → 샌드박스 없이 직접 실행 (보안 경고 출력)
 *
 * @param config - 샌드박스 실행 설정 (allowNetwork 옵션 추가)
 * @returns stdout과 stderr를 포함한 실행 결과
 */
export async function executeSandboxed(
  config: SandboxConfig & { readonly allowNetwork?: boolean },
): Promise<{ stdout: string; stderr: string }> {
  // macOS: Seatbelt 사용
  if (isMacOS()) {
    return executeSeatbelt(config);
  }

  // Linux: Bubblewrap 사용
  if (isLinux()) {
    const bwrapConfig: LinuxSandboxConfig = {
      command: config.command,
      args: config.args,
      cwd: config.cwd,
      projectDir: config.projectDir,
      homeDir: config.homeDir,
      timeoutMs: config.timeoutMs,
      env: config.env,
      allowNetwork: config.allowNetwork,
    };
    return executeBubblewrap(bwrapConfig);
  }

  // Windows/기타: 샌드박스 없이 직접 실행
  logSandboxWarning();
  return executeUnsandboxed(config);
}

/** 샌드박스 경고가 이미 출력되었는지 추적하는 플래그 — 로그 스팸 방지 */
let sandboxWarningEmitted = false;

/**
 * 샌드박스 없이 명령을 실행할 때 보안 경고를 출력합니다.
 * 프로세스 생명주기 동안 한 번만 출력됩니다 (로그 스팸 방지).
 */
function logSandboxWarning(): void {
  if (!sandboxWarningEmitted) {
    sandboxWarningEmitted = true;
    // eslint-disable-next-line no-console
    console.warn(
      "[SECURITY WARNING] No sandbox available on this platform. " +
        "Commands will execute without filesystem or network isolation. " +
        "Untrusted commands may access or modify any file on this system. " +
        "Consider running on macOS (Seatbelt) or Linux with bubblewrap installed " +
        "for sandboxed execution.",
    );
  }
}

/**
 * 샌드박스 경고 상태를 초기화합니다.
 * 테스트에서 경고 출력 상태를 리셋할 때만 사용합니다.
 *
 * @internal 내부 테스트 전용
 */
export function _resetSandboxWarning(): void {
  sandboxWarningEmitted = false;
}

/**
 * 샌드박스 없이 명령을 직접 실행합니다.
 * 샌드박스를 지원하지 않는 플랫폼에서의 폴백(fallback)으로 사용됩니다.
 *
 * @param config - 실행 설정
 * @returns stdout과 stderr를 포함한 실행 결과
 */
async function executeUnsandboxed(config: SandboxConfig): Promise<{
  stdout: string;
  stderr: string;
}> {
  const { command, args = [], cwd, timeoutMs = 120_000, env } = config;

  const result = await execFileAsync(command, [...args], {
    cwd,
    timeout: timeoutMs,
    env: env ? { ...process.env, ...env } : undefined,
    maxBuffer: 10 * 1024 * 1024, // 10MB
  });

  return { stdout: result.stdout, stderr: result.stderr };
}

/**
 * 현재 플랫폼의 샌드박스 사용 가능 상태를 확인합니다.
 *
 * 반환 값에 포함되는 정보:
 * - available: 샌드박스를 사용할 수 있는지
 * - type: 어떤 샌드박스를 사용할 수 있는지 ("seatbelt" | "bubblewrap" | "none")
 * - warnings: 환경에 대한 경고 메시지 (예: WSL1 감지, bwrap 미설치)
 *
 * @returns 샌드박스 상태 정보
 *
 * @example
 * const status = await getSandboxStatus();
 * if (status.available) {
 *   console.log(`${status.type} 샌드박스 사용 가능`);
 * } else {
 *   status.warnings.forEach(w => console.warn(w));
 * }
 */
export async function getSandboxStatus(): Promise<SandboxStatus> {
  const warnings: string[] = [];

  // macOS: sandbox-exec가 항상 사용 가능
  if (isMacOS()) {
    return {
      available: true,
      type: "seatbelt",
      warnings: [],
    };
  }

  // Linux: WSL 및 bwrap 확인
  if (isLinux()) {
    // WSL1: 네임스페이스 미지원으로 bubblewrap 불가
    const wsl1 = await isWSL1();
    if (wsl1) {
      warnings.push(
        "WSL1 detected. Bubblewrap sandbox requires WSL2. " +
          "Upgrade with: wsl --set-version <distro> 2",
      );
      return {
        available: false,
        type: "none",
        warnings,
      };
    }

    // WSL2: 지원되지만 bwrap 설치가 필요할 수 있음
    const wsl = await isWSL();
    if (wsl) {
      warnings.push("WSL2 detected. Bubblewrap sandbox is supported but may require installation.");
    }

    // bwrap 설치 확인
    const bwrapAvailable = await hasBubblewrap();
    if (!bwrapAvailable) {
      warnings.push(
        "bubblewrap (bwrap) is not installed. " +
          "Install with: sudo apt install bubblewrap (Debian/Ubuntu) " +
          "or sudo dnf install bubblewrap (Fedora)",
      );
      return {
        available: false,
        type: "none",
        warnings,
      };
    }

    return {
      available: true,
      type: "bubblewrap",
      warnings,
    };
  }

  // Windows/기타: 샌드박스 없음 — 명확한 보안 경고
  warnings.push(
    "[SECURITY WARNING] No sandbox available on this platform. " +
      "Commands will execute without filesystem or network isolation. " +
      "Untrusted commands may access or modify any file on this system. " +
      "Consider running on macOS (Seatbelt) or Linux with bubblewrap for sandboxed execution.",
  );
  return {
    available: false,
    type: "none",
    warnings,
  };
}

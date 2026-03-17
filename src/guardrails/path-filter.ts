/**
 * 경로 필터 — 파일 경로의 안전성을 검사하는 보안 모듈
 *
 * AI가 파일을 읽거나 쓸 때, 민감한 시스템 파일이나 인증 정보 파일에
 * 접근하는 것을 방지합니다. 다음 네 가지 위협을 탐지합니다:
 *
 * 1. 경로 순회(Path Traversal): "../" 시퀀스를 사용하여 작업 디렉토리 외부로 탈출
 *    예) "../../etc/passwd" → 시스템 비밀번호 파일에 접근 시도
 *
 * 2. 민감한 시스템 파일 접근: /etc/shadow, /etc/passwd 등
 *    이 파일들은 시스템 계정 정보와 해시된 비밀번호를 포함
 *
 * 3. 민감한 홈 디렉토리 파일 접근: ~/.ssh, ~/.aws/credentials 등
 *    이 파일들은 SSH 키, 클라우드 인증 정보 등을 포함
 *
 * 4. 심볼릭 링크 탈출(Symlink Escape): 심볼릭 링크를 통해 민감한 경로에 간접 접근
 *    예) /safe/link → /home/user/.ssh/id_rsa (심볼릭 링크가 민감한 경로를 가리킴)
 */

import { resolve } from "node:path";
import { lstatSync, realpathSync } from "node:fs";
import { normalizePath } from "../utils/path.js";

/**
 * 경로 필터 검사 결과 인터페이스
 *
 * @property safe - 경로가 안전한지 여부 (false이면 접근 차단)
 * @property reason - 안전하지 않은 경우 그 이유를 설명하는 메시지
 */
export interface PathFilterResult {
  readonly safe: boolean;
  readonly reason?: string;
}

/**
 * 사용자 홈 디렉토리 기준 민감한 경로 목록
 *
 * 이 경로들은 인증 정보, 암호화 키, 클라우드 자격 증명 등
 * 절대 외부에 노출되어서는 안 되는 파일들을 포함합니다.
 * normalizePath()에 의해 슬래시(/)로 통일되어 크로스 플랫폼 매칭에 사용됩니다.
 */
const SENSITIVE_HOME_PATHS: readonly string[] = [
  "/.ssh", // SSH 키 쌍 (공개키/비밀키), 접근 설정
  "/.gnupg", // GPG 암호화 키 (이메일 서명, 파일 암호화에 사용)
  "/.gpg", // GPG 키 저장소 (대안 경로)
  "/.aws/credentials", // AWS 클라우드 인증 정보 (Access Key, Secret Key)
  "/.azure/credentials", // Azure 클라우드 인증 정보
  "/.config/gcloud", // Google Cloud 인증 정보 및 설정
  "/.docker/config.json", // Docker 레지스트리 인증 정보
  "/.npmrc", // npm 레지스트리 인증 토큰
  "/.pypirc", // PyPI(Python 패키지) 배포 인증 정보
  "/.netrc", // FTP/HTTP 인증 자격 증명 (평문 저장)
  "/.kube/config", // Kubernetes 클러스터 접근 인증 정보
  "/.env", // 환경 변수 파일 (API 키, DB 비밀번호 등이 흔히 포함됨)
];

/**
 * 민감한 시스템 경로 목록
 *
 * 운영체제 수준의 인증 및 권한 정보를 포함하는 시스템 파일들입니다.
 * Linux와 macOS의 경로를 모두 포함합니다.
 */
const SENSITIVE_SYSTEM_PATHS: readonly string[] = [
  "/etc/shadow", // Linux: 해시된 사용자 비밀번호 저장 (root만 접근 가능)
  "/etc/passwd", // Linux: 사용자 계정 정보 (이름, UID, 홈 디렉토리 등)
  "/etc/sudoers", // Linux: sudo 권한 설정 (누가 관리자 권한을 가지는지)
  "/etc/master.passwd", // BSD/macOS: 해시된 비밀번호 (shadow와 동등)
  "/private/etc/shadow", // macOS: shadow 파일의 macOS 경로
  "/private/etc/master.passwd", // macOS: master.passwd의 macOS 경로
];

/**
 * 파일 경로의 안전성을 검사합니다.
 *
 * 주어진 경로가 작업 디렉토리 내에 있고, 민감한 시스템/홈 디렉토리 파일에
 * 접근하지 않으며, 심볼릭 링크를 통한 탈출을 시도하지 않는지 검사합니다.
 *
 * @param path - 검사할 파일 경로 (상대 또는 절대)
 * @param workingDirectory - 현재 작업 디렉토리 (상대 경로의 기준점)
 * @returns 안전 여부와 차단 이유를 포함한 결과 객체
 *
 * @example
 * ```ts
 * const result = checkPath("../../etc/passwd", "/home/user/project");
 * // result.safe === false, result.reason에 "Path traversal detected" 포함
 * ```
 */
export function checkPath(path: string, workingDirectory: string): PathFilterResult {
  // 작업 디렉토리를 정규화 (슬래시 통일, 절대 경로 변환)
  const normalizedWorkDir = normalizePath(resolve(workingDirectory));

  // 1단계: 경로 순회(Path Traversal) 탐지
  // "../"가 포함된 경로가 작업 디렉토리 외부로 탈출하는지 확인
  const normalizedInput = normalizePath(path);
  if (normalizedInput.includes("../") || normalizedInput.includes("/..")) {
    const resolved = normalizePath(resolve(workingDirectory, path));
    // 해석된 경로가 작업 디렉토리 내부에 있지 않으면 차단
    if (!resolved.startsWith(normalizedWorkDir + "/") && resolved !== normalizedWorkDir) {
      return {
        safe: false,
        reason: `Path traversal detected: "${path}" resolves outside working directory`,
      };
    }
  }

  // 2단계: 절대 경로로 변환하여 이후 검사에 사용
  const resolvedPath = normalizePath(resolve(workingDirectory, path));

  // 3단계: 민감한 시스템 파일 접근 검사
  for (const sensitive of SENSITIVE_SYSTEM_PATHS) {
    // 정확히 일치하거나 해당 디렉토리 하위의 파일인 경우 차단
    if (resolvedPath === sensitive || resolvedPath.startsWith(sensitive + "/")) {
      return {
        safe: false,
        reason: `Access to sensitive system file blocked: ${sensitive}`,
      };
    }
  }

  // 4단계: 민감한 홈 디렉토리 경로 접근 검사
  const sensitiveMatch = checkSensitivePath(resolvedPath);
  if (sensitiveMatch) {
    return {
      safe: false,
      reason: sensitiveMatch,
    };
  }

  // 5단계: 심볼릭 링크 탈출 탐지
  // 심볼릭 링크(Symbolic Link)란 다른 파일/디렉토리를 가리키는 바로가기 같은 것
  // 안전한 경로의 심볼릭 링크가 실제로는 민감한 경로를 가리킬 수 있음
  try {
    const stat = lstatSync(resolvedPath);
    if (stat.isSymbolicLink()) {
      // 심볼릭 링크의 실제 대상 경로를 확인
      const realPath = normalizePath(realpathSync(resolvedPath));

      // 실제 경로가 민감한 시스템 파일을 가리키는지 검사
      for (const sensitive of SENSITIVE_SYSTEM_PATHS) {
        if (realPath === sensitive || realPath.startsWith(sensitive + "/")) {
          return {
            safe: false,
            reason: `Symlink escape detected: "${path}" resolves to sensitive system file ${sensitive}`,
          };
        }
      }

      // 실제 경로가 민감한 홈 디렉토리 파일을 가리키는지 검사
      const symlinkSensitiveMatch = checkSensitivePath(realPath);
      if (symlinkSensitiveMatch) {
        return {
          safe: false,
          reason: `Symlink escape detected: "${path}" points to "${realPath}" — ${symlinkSensitiveMatch}`,
        };
      }
    }
  } catch {
    // 파일이 아직 존재하지 않거나 접근 불가 — 심볼릭 링크 검사 건너뜀
  }

  // 모든 검사를 통과하면 안전한 경로로 판단
  return { safe: true };
}

/**
 * 해석된 절대 경로가 민감한 홈 디렉토리 경로에 해당하는지 검사합니다.
 *
 * 사용자의 홈 디렉토리(HOME 또는 USERPROFILE 환경 변수)를 기준으로
 * SENSITIVE_HOME_PATHS 목록과 비교합니다.
 *
 * @param resolvedPath - 검사할 절대 경로 (이미 정규화된 상태)
 * @returns 매칭된 경우 차단 이유 문자열, 안전하면 undefined
 */
function checkSensitivePath(resolvedPath: string): string | undefined {
  // 홈 디렉토리 경로를 환경 변수에서 가져옴 (Linux: HOME, Windows: USERPROFILE)
  const homeDir = normalizePath(process.env["HOME"] ?? process.env["USERPROFILE"] ?? "");
  if (!homeDir) {
    return undefined;
  }

  for (const sensitive of SENSITIVE_HOME_PATHS) {
    const fullSensitivePath = homeDir + sensitive;
    // 정확히 일치하거나 해당 디렉토리 하위의 파일인 경우 차단
    if (resolvedPath === fullSensitivePath || resolvedPath.startsWith(fullSensitivePath + "/")) {
      return `Access to sensitive path blocked: ~${sensitive}`;
    }
  }

  return undefined;
}

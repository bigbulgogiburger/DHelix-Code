/**
 * 가드레일 모듈 진입점 — 모든 보안 검사 기능을 통합하고 공개하는 파일
 *
 * 이 파일은 가드레일 시스템의 공개 API를 정의합니다.
 * 다른 모듈에서 보안 검사 기능을 사용할 때 이 파일을 통해 import합니다.
 *
 * 제공하는 세 가지 주요 가드레일 함수:
 * 1. applyInputGuardrails  — 도구 실행 전 입력 검사 (명령어/경로 안전성)
 * 2. applyInjectionGuardrails — 프롬프트 인젝션 탐지
 * 3. applyOutputGuardrails — 도구 실행 후 출력 검사 (비밀 정보 삭제, 크기 제한)
 *
 * 또한 개별 가드레일 모듈의 함수와 타입을 re-export합니다.
 */

// ===== 타입 및 함수 Re-export =====
// 다른 모듈에서 개별 가드레일 기능을 직접 사용할 수 있도록 내보냄
export type { GuardrailResult, GuardrailRule } from "./types.js";
export { scanForSecrets } from "./secret-scanner.js";
export type { SecretScanResult } from "./secret-scanner.js";
export { checkCommand } from "./command-filter.js";
export { checkPath } from "./path-filter.js";
export type { PathFilterResult } from "./path-filter.js";
export { detectInjection } from "./injection-detector.js";
export type { InjectionDetectionResult } from "./injection-detector.js";
export { limitOutput } from "./output-limiter.js";
export type { OutputLimitResult } from "./output-limiter.js";
export { shannonEntropy, detectHighEntropySecrets } from "./entropy-scanner.js";
export type { SecretCandidate } from "./entropy-scanner.js";

import type { GuardrailResult } from "./types.js";
import { checkCommand } from "./command-filter.js";
import { checkPath } from "./path-filter.js";
import { detectInjection } from "./injection-detector.js";
import { scanForSecrets } from "./secret-scanner.js";
import { limitOutput } from "./output-limiter.js";

/**
 * 파일 경로를 다루는 도구 목록
 *
 * 이 Set에 포함된 도구들은 파일 경로를 인수로 받으며,
 * 경로 순회(Path Traversal) 검사 대상입니다.
 */
const FILE_TOOLS: ReadonlySet<string> = new Set(["file_read", "file_write", "file_edit"]);

/**
 * 도구 실행 전 입력 가드레일을 적용합니다.
 *
 * 도구의 종류에 따라 적절한 보안 검사를 수행합니다:
 * - bash_exec 도구: 명령어 안전성 검사 (위험한 쉘 명령어 차단)
 * - file_read/file_write/file_edit 도구: 경로 안전성 검사 (민감한 파일 접근 차단)
 *
 * @param toolName - 실행하려는 도구의 이름 (예: "bash_exec", "file_read")
 * @param args - 도구에 전달될 인수 객체
 * @param workingDirectory - 현재 작업 디렉토리 (경로 검사의 기준점)
 * @returns 가드레일 검사 결과
 */
export function applyInputGuardrails(
  toolName: string,
  args: Record<string, unknown>,
  workingDirectory?: string,
): GuardrailResult {
  // 쉘 명령어 실행 도구인 경우 명령어 안전성 검사
  if (toolName === "bash_exec" && typeof args["command"] === "string") {
    return checkCommand(args["command"]);
  }

  // 파일 관련 도구인 경우 경로 안전성 검사
  if (FILE_TOOLS.has(toolName) && workingDirectory) {
    // file_path 또는 path 인수에서 파일 경로 추출
    const filePath =
      typeof args["file_path"] === "string"
        ? args["file_path"]
        : typeof args["path"] === "string"
          ? args["path"]
          : undefined;

    if (filePath) {
      const pathResult = checkPath(filePath, workingDirectory);
      if (!pathResult.safe) {
        return {
          passed: false,
          reason: pathResult.reason,
          severity: "block",
        };
      }
    }
  }

  // 어떤 위험 패턴에도 해당하지 않으면 통과
  return { passed: true, severity: "info" };
}

/**
 * 프롬프트 인젝션 가드레일을 적용합니다.
 *
 * 사용자 입력 텍스트에서 프롬프트 인젝션 패턴을 탐지합니다.
 * 결과를 GuardrailResult 형태로 반환하며, 호출자가 warn/block에 따라
 * 처리 방식을 결정합니다.
 *
 * @param text - 검사할 사용자 입력 텍스트
 * @returns 가드레일 검사 결과
 */
export function applyInjectionGuardrails(text: string): GuardrailResult {
  const result = detectInjection(text);

  // 인젝션이 탐지되지 않으면 통과
  if (!result.detected) {
    return { passed: true, severity: "info" };
  }

  return {
    // severity가 "block"이면 passed=false (차단), "warn"이면 passed=true (경고만)
    passed: result.severity !== "block",
    reason: `Prompt injection detected (${result.type})`,
    severity: result.severity,
  };
}

/**
 * 도구 실행 후 출력 가드레일을 적용합니다.
 *
 * 도구의 출력에 대해 세 가지 보안 검사를 순서대로 수행합니다:
 * 1. 인젝션 패턴 검사 — 모델이 주입된 콘텐츠를 중계하고 있는지 확인
 * 2. 비밀 정보 스캔 — 비밀 정보를 [REDACTED]로 대체
 * 3. 출력 크기 제한 — 너무 큰 출력을 잘라내어 토큰 낭비 방지
 *
 * @param output - 도구 실행의 원본 출력 텍스트
 * @returns 가드레일 검사 결과 (수정된 텍스트가 있을 수 있음)
 */
export function applyOutputGuardrails(output: string): GuardrailResult {
  // 1단계: 출력에 인젝션 패턴이 포함되어 있는지 검사
  // 모델이 파일이나 명령어 출력에 포함된 인젝션 패턴을 중계할 수 있음
  const injectionResult = detectInjection(output);
  if (injectionResult.detected && injectionResult.severity === "block") {
    return {
      passed: false,
      reason: `Output contains injection pattern (${injectionResult.type})`,
      severity: "block",
    };
  }

  // 2단계: 비밀 정보를 탐지하고 [REDACTED]로 대체
  const scanResult = scanForSecrets(output);
  const text = scanResult.found ? scanResult.redacted : output;

  // 3단계: 출력 크기 제한 적용 (기본 50,000자)
  const limitResult = limitOutput(text);
  const finalText = limitResult.limited ? limitResult.result : text;

  // 비밀 정보 삭제 또는 크기 제한이 적용된 경우 수정된 텍스트를 반환
  const modified = scanResult.found || limitResult.limited ? finalText : undefined;

  // 비밀 정보가 발견된 경우 경고와 함께 수정된 텍스트 반환
  if (scanResult.found) {
    return {
      passed: true,
      modified,
      reason: `Redacted secrets: ${scanResult.patterns.join(", ")}`,
      severity: "warn",
    };
  }

  // 출력이 잘린 경우 정보 메시지와 함께 수정된 텍스트 반환
  if (limitResult.limited) {
    return {
      passed: true,
      modified,
      reason: "Output truncated due to size limit",
      severity: "info",
    };
  }

  // 인젝션이 경고 수준으로 탐지된 경우 (block이 아닌 warn)
  // 통과시키되 경고 메시지를 포함
  if (injectionResult.detected) {
    return {
      passed: true,
      reason: `Output may contain injection pattern (${injectionResult.type})`,
      severity: "warn",
    };
  }

  // 모든 검사를 깨끗하게 통과
  return { passed: true, severity: "info" };
}

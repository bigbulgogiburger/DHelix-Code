/**
 * 도구 호출 자동 교정기 — LLM 모델의 흔한 인수 오류를 자동으로 교정하는 모듈
 *
 * LLM 모델은 도구를 호출할 때 다음과 같은 실수를 할 수 있습니다:
 * 1. Git Bash 경로 사용 (예: "/c/Users/..." → Windows 경로로 변환 필요)
 * 2. 상대 경로를 사용 (예: "src/index.ts" → 절대 경로로 변환 필요)
 * 3. 타입 오류 (예: "true" 문자열 → boolean true로 변환 필요)
 *
 * Git Bash 경로 변환은 모든 성능 등급에 적용됩니다.
 * 상대 경로/타입 교정은 저성능(low/medium tier) 모델에만 적용됩니다.
 */
import { resolve, isAbsolute } from "node:path";
import type { CapabilityTier } from "../llm/model-capabilities.js";
import { isGitBashPath, gitBashToWindows } from "../utils/path.js";
import { isWindows } from "../utils/platform.js";

/**
 * 도구 호출 인수를 자동 교정
 *
 * 교정 순서:
 * 0. Git Bash 경로 → Windows 경로 변환 (모든 tier에 적용)
 * 1. 상대 경로 → 절대 경로 변환 (medium/low tier만)
 * 2. 문자열 타입 → 올바른 타입 변환 (medium/low tier만)
 *
 * @param args - LLM이 전달한 원시 인수 객체
 * @param workingDirectory - 상대 경로 해석의 기준이 되는 작업 디렉토리
 * @param tier - 모델 성능 등급 ("high" | "medium" | "low")
 * @returns 교정된 인수 객체 (원본을 수정하지 않고 새 객체를 반환)
 */
export function correctToolCall(
  args: Record<string, unknown>,
  workingDirectory: string,
  tier: CapabilityTier,
): Record<string, unknown> {
  // 0단계: Windows 환경에서 Git Bash 경로를 Windows 경로로 변환
  // 모든 성능 등급에 적용 — LLM이 시스템 프롬프트/도구 결과의 Git Bash 경로를 그대로 반환하는 경우
  // 예: "/c/Users/DBInc/dbcode/src" → "C:\Users\DBInc\dbcode\src"
  const gitBashCorrected = correctGitBashPaths(args);

  // 고성능 모델은 추가 교정 불필요 — Git Bash 변환만 적용 후 반환
  if (tier === "high") return gitBashCorrected;

  // 원본을 변경하지 않기 위해 얕은 복사(spread copy) 생성
  const corrected = { ...gitBashCorrected };

  // 1단계: 상대 경로 → 절대 경로 변환
  // 경로 관련 키(file_path, path 등)의 값이 상대 경로이면 절대 경로로 변환
  for (const [key, value] of Object.entries(corrected)) {
    if (typeof value === "string" && isPathKey(key) && !isAbsolute(value)) {
      // resolve(workingDirectory, value): 작업 디렉토리를 기준으로 절대 경로 생성
      corrected[key] = resolve(workingDirectory, value);
    }
  }

  // 2단계: 문자열로 잘못 전달된 값을 올바른 타입으로 변환 (타입 강제 변환, Type Coercion)
  for (const [key, value] of Object.entries(corrected)) {
    // "true" 문자열 → boolean true
    if (value === "true") corrected[key] = true;
    // "false" 문자열 → boolean false
    else if (value === "false") corrected[key] = false;
    // 숫자로 된 문자열 → number (숫자 관련 키에만 적용하여 잘못된 변환 방지)
    else if (typeof value === "string" && /^\d+$/.test(value) && isNumericKey(key)) {
      corrected[key] = parseInt(value, 10);
    }
  }

  return corrected;
}

/**
 * Windows 환경에서 Git Bash 형식 경로(/c/Users/...)를 Windows 경로(C:\Users\...)로 변환
 *
 * LLM은 Git Bash 셸 출력에서 경로를 학습하여 /c/Users/... 형식으로 전달하는 경우가 많습니다.
 * Windows의 Node.js path.resolve()는 이를 "C:\c\Users\..."로 잘못 해석하므로,
 * 도구 실행 전에 올바른 Windows 경로로 변환해야 합니다.
 *
 * Windows가 아닌 환경에서는 변환하지 않습니다.
 *
 * @param args - LLM이 전달한 원시 인수 객체
 * @returns Git Bash 경로가 Windows 경로로 변환된 새 인수 객체
 */
function correctGitBashPaths(args: Record<string, unknown>): Record<string, unknown> {
  if (!isWindows()) return args;

  let hasChanges = false;
  const corrected = { ...args };

  for (const [key, value] of Object.entries(corrected)) {
    if (typeof value === "string" && isPathKey(key) && isGitBashPath(value)) {
      corrected[key] = gitBashToWindows(value);
      hasChanges = true;
    }
  }

  return hasChanges ? corrected : args;
}

/**
 * 주어진 키가 파일 경로를 나타내는 키인지 판별
 *
 * 도구마다 경로 매개변수의 이름이 다를 수 있으므로,
 * 일반적으로 사용되는 경로 관련 키 이름들을 미리 정의해둡니다.
 *
 * @param key - 확인할 매개변수 키 이름
 * @returns 경로 관련 키이면 true
 */
function isPathKey(key: string): boolean {
  const pathKeys = ["file_path", "path", "directory", "dir", "filepath", "filename"];
  return pathKeys.includes(key.toLowerCase());
}

/**
 * 주어진 키가 숫자 값을 나타내는 키인지 판별
 *
 * 숫자 관련 키에만 문자열→숫자 변환을 적용하여,
 * 실제로 문자열이어야 하는 값(예: 파일 이름 "123")이 숫자로 잘못 변환되는 것을 방지합니다.
 *
 * @param key - 확인할 매개변수 키 이름
 * @returns 숫자 관련 키이면 true
 */
function isNumericKey(key: string): boolean {
  const numKeys = ["limit", "offset", "timeout", "line", "count", "depth"];
  return numKeys.includes(key.toLowerCase());
}

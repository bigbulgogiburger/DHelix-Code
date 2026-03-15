/**
 * 도구 호출 자동 교정기 — 저성능 LLM 모델의 흔한 인수 오류를 자동으로 교정하는 모듈
 *
 * 저성능(low/medium tier) 모델은 도구를 호출할 때 다음과 같은 실수를 자주 합니다:
 * 1. 상대 경로를 사용 (예: "src/index.ts" → 절대 경로로 변환 필요)
 * 2. 타입 오류 (예: "true" 문자열 → boolean true로 변환 필요)
 *
 * 이 모듈은 이런 실수를 검증(validation) 전에 자동으로 교정하여,
 * 저성능 모델의 도구 호출 성공률을 높입니다.
 *
 * 고성능(high tier) 모델은 이런 실수를 거의 하지 않으므로,
 * 불필요한 오버헤드를 피하기 위해 교정을 건너뜁니다.
 */
import { resolve, isAbsolute } from "node:path";
import type { CapabilityTier } from "../llm/model-capabilities.js";

/**
 * 도구 호출 인수를 자동 교정
 *
 * CapabilityTier(모델 성능 등급)에 따라 동작:
 * - "high": 교정 없이 원본 인수를 그대로 반환 (오버헤드 제로)
 * - "medium"/"low": 경로와 타입 교정 적용
 *
 * 교정 항목:
 * 1. 상대 경로 → 절대 경로 변환 (작업 디렉토리 기준)
 * 2. 문자열 타입을 실제 타입으로 변환:
 *    - "true"/"false" → boolean
 *    - 숫자 문자열 → number (숫자 관련 키에만 적용)
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
  // 고성능 모델은 교정 불필요 — 즉시 원본 반환으로 성능 최적화
  if (tier === "high") return args;

  // 원본을 변경하지 않기 위해 얕은 복사(spread copy) 생성
  const corrected = { ...args };

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

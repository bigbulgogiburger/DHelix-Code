/**
 * 적응형 스키마 — 모델 성능 등급(CapabilityTier)에 따라 도구 스키마를 최적화하는 모듈
 *
 * LLM 모델마다 이해력과 토큰 처리 비용이 다릅니다.
 * 고성능 모델에는 전체 스키마를 제공하고,
 * 저성능 모델에는 핵심 정보만 제공하여 정확도와 비용을 최적화합니다.
 *
 * 3단계 전략:
 * - HIGH: 전체 스키마 + 모든 선택적 매개변수 + 완전한 설명
 * - MEDIUM: 핵심 매개변수만 + 설명 2문장으로 단축
 * - LOW: 필수 매개변수만 + 설명 1문장 + 사용 예시(few-shot) 제공
 *
 * CapabilityTier — 모델의 성능 등급을 나타내는 타입 ("high" | "medium" | "low")
 */
import type { CapabilityTier } from "../llm/model-capabilities.js";

/**
 * 특정 성능 등급에 맞게 적응된 도구 정보
 *
 * adaptToolSchema 함수의 반환 타입으로,
 * 원래 도구 정의에서 등급에 맞게 축소된 스키마를 담습니다.
 */
export interface AdaptedToolInfo {
  /** 도구 이름 */
  readonly name: string;
  /** 성능 등급에 맞게 축소된 설명 */
  readonly description: string;
  /** 성능 등급에 맞게 필터링된 매개변수 JSON Schema */
  readonly parameters: Record<string, unknown>;
  /** 사용 예시 목록 (LOW 등급에서만 제공) — few-shot 프롬프팅에 사용 */
  readonly examples?: readonly string[];
}

/**
 * 설명 텍스트에서 처음 N개의 문장만 추출
 *
 * 마침표(.)를 문장 구분자로 사용하며,
 * 마침표 다음에 공백이나 줄바꿈이 오는 경우에만 문장 끝으로 인식합니다.
 * N개 미만의 문장만 있으면 원본 텍스트를 그대로 반환합니다.
 *
 * @param text - 원본 설명 텍스트
 * @param maxSentences - 추출할 최대 문장 수
 * @returns 처음 N문장까지의 텍스트
 */
function truncateToSentences(text: string, maxSentences: number): string {
  let count = 0;
  let lastEnd = 0;
  for (let i = 0; i < text.length; i++) {
    // 마침표 뒤에 텍스트 끝, 공백, 또는 줄바꿈이 오면 문장 끝으로 판단
    if (text[i] === "." && (i + 1 >= text.length || text[i + 1] === " " || text[i + 1] === "\n")) {
      count++;
      lastEnd = i + 1;
      if (count >= maxSentences) {
        return text.slice(0, lastEnd).trim();
      }
    }
  }
  return text;
}

/**
 * JSON Schema에서 필수(required) 매개변수만 남기고 나머지를 제거
 *
 * LOW 등급 모델에게는 필수 매개변수만 보여줘서 혼란을 줄입니다.
 * 선택적 매개변수가 많으면 저성능 모델이 잘못된 값을 전달할 가능성이 높아지기 때문입니다.
 *
 * @param params - 원본 JSON Schema 매개변수 객체
 * @returns 필수 매개변수만 포함된 새 JSON Schema 객체
 */
function filterToRequiredOnly(params: Record<string, unknown>): Record<string, unknown> {
  const required = params["required"] as readonly string[] | undefined;
  // required 배열이 없거나 비어있으면 원본 그대로 반환
  if (!required || !Array.isArray(required) || required.length === 0) {
    return params;
  }

  const properties = params["properties"] as Record<string, unknown> | undefined;
  if (!properties) {
    return params;
  }

  // required 목록에 있는 속성만 남기기
  const filtered: Record<string, unknown> = {};
  for (const key of required) {
    if (key in properties) {
      filtered[key] = properties[key];
    }
  }

  return {
    ...params,
    properties: filtered,
  };
}

/**
 * JSON Schema에서 기본값(default)이 있는 선택적 매개변수를 제거
 *
 * MEDIUM 등급에서는 기본값이 있는 매개변수를 숨깁니다.
 * 기본값이 있으면 LLM이 명시적으로 값을 전달하지 않아도 되기 때문입니다.
 * 기본값이 없는 선택적 매개변수는 중요할 수 있으므로 유지합니다.
 *
 * @param params - 원본 JSON Schema 매개변수 객체
 * @returns 핵심 매개변수만 포함된 새 JSON Schema 객체
 */
function filterToCoreParams(params: Record<string, unknown>): Record<string, unknown> {
  const required = params["required"] as readonly string[] | undefined;
  const properties = params["properties"] as Record<string, unknown> | undefined;
  if (!properties) {
    return params;
  }

  const requiredSet = new Set(required ?? []);
  const filtered: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(properties)) {
    // 필수 매개변수는 항상 포함
    if (requiredSet.has(key)) {
      filtered[key] = value;
      // 비필수이지만 기본값(default)이 없는 매개변수도 포함 (중요할 수 있으므로)
    } else if (value && typeof value === "object" && !("default" in value)) {
      filtered[key] = value;
    }
    // 기본값이 있는 비필수 매개변수는 제외 (LLM이 생략해도 기본값이 사용되므로)
  }

  return {
    ...params,
    properties: filtered,
  };
}

/**
 * 주요 도구별 사용 예시 — LOW 등급 모델에게 few-shot 프롬프팅으로 제공
 *
 * Few-shot 프롬프팅: 모델에게 올바른 호출 예시를 보여주어
 * 올바른 형식으로 도구를 호출하도록 유도하는 기법입니다.
 * 특히 저성능 모델은 예시가 있을 때 정확도가 크게 향상됩니다.
 */
const TOOL_EXAMPLES: Readonly<Record<string, readonly string[]>> = {
  file_read: [
    'file_read({"file_path": "/absolute/path/to/file.ts"})',
    'file_read({"file_path": "/project/src/index.ts", "offset": 10, "limit": 50})',
  ],
  file_write: ['file_write({"file_path": "/absolute/path/to/file.ts", "content": "const x = 1;"})'],
  file_edit: [
    'file_edit({"file_path": "/absolute/path/to/file.ts", "old_string": "const x = 1;", "new_string": "const x = 2;"})',
  ],
  bash_exec: [
    'bash_exec({"command": "npm test"})',
    'bash_exec({"command": "ls -la /project/src"})',
  ],
  grep_search: ['grep_search({"pattern": "function\\\\s+\\\\w+", "path": "/project/src"})'],
  glob_search: ['glob_search({"pattern": "**/*.ts", "path": "/project/src"})'],
};

/**
 * 모델 성능 등급에 따라 도구 스키마를 적응시키는 핵심 함수
 *
 * 각 등급별 전략:
 *
 * HIGH (고성능 모델, 예: GPT-4, Claude):
 * - 전체 스키마 그대로 전달 (모든 선택적 매개변수 포함)
 * - 완전한 설명 제공
 * - 모델이 스스로 최적의 매개변수를 선택할 수 있음
 *
 * MEDIUM (중간 성능 모델):
 * - 기본값이 있는 선택적 매개변수 제거 → 스키마 크기 축소
 * - 설명을 2문장으로 단축 → 토큰 절약
 *
 * LOW (저성능 모델):
 * - 필수 매개변수만 전달 → 혼란 최소화
 * - 설명을 1문장으로 단축
 * - few-shot 예시 추가 → 올바른 호출 형식 안내
 *
 * @param name - 도구 이름
 * @param description - 원본 도구 설명
 * @param parameters - 원본 JSON Schema 매개변수 객체
 * @param tier - 모델 성능 등급
 * @param _workingDirectory - 작업 디렉토리 (향후 경로 기반 예시 생성에 사용할 예정)
 * @returns 등급에 맞게 적응된 도구 정보
 */
export function adaptToolSchema(
  name: string,
  description: string,
  parameters: Record<string, unknown>,
  tier: CapabilityTier,
  _workingDirectory: string,
): AdaptedToolInfo {
  switch (tier) {
    // HIGH: 원본 그대로 — 수정 없음
    case "high":
      return {
        name,
        description,
        parameters,
      };

    // MEDIUM: 핵심 매개변수 + 2문장 설명
    case "medium":
      return {
        name,
        description: truncateToSentences(description, 2),
        parameters: filterToCoreParams(parameters),
      };

    // LOW: 필수 매개변수만 + 1문장 설명 + few-shot 예시
    case "low": {
      const examples = TOOL_EXAMPLES[name];
      return {
        name,
        description: truncateToSentences(description, 1),
        parameters: filterToRequiredOnly(parameters),
        // 예시가 있는 도구에만 examples 필드를 추가
        ...(examples ? { examples } : {}),
      };
    }
  }
}

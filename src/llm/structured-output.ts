/**
 * 구조화된 출력(Structured Output) 설정 — 모델 능력에 따른 JSON 출력 가이드
 *
 * LLM에게 JSON 형식의 응답을 요청할 때, 모델의 능력 수준에 따라
 * 다른 접근 방식이 필요합니다:
 *
 * - HIGH 티어 (GPT-4o, Claude 등): 네이티브 function calling 지원 → 추가 설정 불필요
 * - MEDIUM 티어 (GPT-4o-mini 등): JSON 스키마 모드 사용 → response_format 설정
 * - LOW 티어 (Llama, Phi 등): 프롬프트에 스키마 가이드 텍스트 주입
 *
 * 이 모듈은 프로바이더(OpenAI, Anthropic, Ollama 등)와 능력 티어에 따라
 * 적절한 구조화 출력 설정을 생성합니다.
 */
import type { CapabilityTier } from "./model-capabilities.js";

/**
 * 구조화된 출력 설정 — 프로바이더에 전달할 추가 설정
 *
 * 각 프로바이더마다 다른 필드를 포함할 수 있으므로 인덱스 시그니처 사용
 */
export interface StructuredOutputConfig {
  readonly [key: string]: unknown;
}

/**
 * 프로바이더와 능력 티어에 따른 구조화된 출력 설정 생성
 *
 * HIGH 티어 모델은 네이티브 function calling을 지원하므로
 * 추가 래퍼가 필요 없어 null을 반환합니다.
 *
 * LOW/MEDIUM 티어 모델에서 도구 호출을 올바른 JSON 형식으로 받기 위해
 * 프로바이더별 구조화 출력 설정을 생성합니다.
 *
 * @param provider - LLM 프로바이더 이름 (예: "openai", "anthropic", "ollama")
 * @param toolSchema - 도구의 매개변수 JSON 스키마
 * @param tier - 모델의 능력 티어 ("high", "medium", "low")
 * @returns 구조화 출력 설정 객체 또는 null (HIGH 티어)
 */
export function buildStructuredOutputConfig(
  provider: string,
  toolSchema: Record<string, unknown>,
  tier: CapabilityTier,
): Record<string, unknown> | null {
  // HIGH 티어 모델은 네이티브 function calling 지원 — 래퍼 불필요
  if (tier === "high") {
    return null;
  }

  const normalizedProvider = provider.toLowerCase();

  // 프로바이더별 최적화된 설정 생성
  if (normalizedProvider === "openai" || normalizedProvider === "openai-compatible") {
    return buildOpenAIStructuredOutput(toolSchema, tier);
  }

  if (normalizedProvider === "anthropic") {
    return buildAnthropicStructuredOutput(toolSchema, tier);
  }

  if (normalizedProvider === "ollama" || normalizedProvider === "local") {
    return buildOllamaStructuredOutput(toolSchema, tier);
  }

  // 알 수 없는 프로바이더 — 범용 JSON 스키마 가이드 사용
  return buildGenericStructuredOutput(toolSchema, tier);
}

/**
 * OpenAI 전용 구조화 출력 설정 생성
 *
 * MEDIUM 티어: response_format에 json_schema 사용 (strict 모드)
 * - OpenAI가 스키마에 맞는 JSON만 생성하도록 강제
 *
 * LOW 티어: 단순 JSON 모드 + 시스템 프롬프트에 스키마 가이드 주입
 * - json_object 모드는 JSON 출력만 보장하지만 스키마 준수는 보장 안 됨
 *
 * @param toolSchema - 도구 매개변수 JSON 스키마
 * @param tier - 능력 티어
 * @returns OpenAI 설정 객체
 */
function buildOpenAIStructuredOutput(
  toolSchema: Record<string, unknown>,
  tier: CapabilityTier,
): Record<string, unknown> {
  if (tier === "medium") {
    // strict: true — 스키마에 정확히 일치하는 JSON만 생성
    return {
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "tool_call",
          strict: true,
          schema: buildToolCallWrapper(toolSchema),
        },
      },
    };
  }

  // LOW 티어 — json_object 모드 + 프롬프트에 스키마 설명 텍스트 주입
  return {
    response_format: { type: "json_object" },
    schema_guidance: buildSchemaGuidanceText(toolSchema),
  };
}

/**
 * Anthropic 전용 구조화 출력 설정 생성
 *
 * Anthropic은 JSON 모드를 제공하지 않으므로,
 * 시스템 프롬프트에 스키마 가이드 텍스트를 주입하고
 * 어시스턴트 턴에 JSON 시작 부분을 미리 채워(prefill) 넣어
 * 모델이 JSON으로 응답하도록 유도합니다.
 *
 * @param toolSchema - 도구 매개변수 JSON 스키마
 * @param _tier - 능력 티어 (Anthropic은 티어 구분 없이 동일 처리)
 * @returns Anthropic 설정 객체
 */
function buildAnthropicStructuredOutput(
  toolSchema: Record<string, unknown>,
  _tier: CapabilityTier,
): Record<string, unknown> {
  return {
    schema_guidance: buildSchemaGuidanceText(toolSchema),
    // JSON 시작 부분을 미리 채워서 모델이 JSON 형식으로 이어쓰도록 유도
    prefill: '{"tool_name":"',
  };
}

/**
 * Ollama/로컬 모델 전용 구조화 출력 설정 생성
 *
 * Ollama는 format: "json" 필드를 통해 JSON 출력을 강제할 수 있습니다.
 * 추가로 스키마 가이드 텍스트와 래퍼 템플릿을 제공합니다.
 *
 * @param toolSchema - 도구 매개변수 JSON 스키마
 * @param _tier - 능력 티어 (Ollama는 티어 구분 없이 동일 처리)
 * @returns Ollama 설정 객체
 */
function buildOllamaStructuredOutput(
  toolSchema: Record<string, unknown>,
  _tier: CapabilityTier,
): Record<string, unknown> {
  return {
    format: "json", // Ollama의 JSON 출력 모드
    schema_guidance: buildSchemaGuidanceText(toolSchema),
    template_wrapper: buildToolCallWrapper(toolSchema),
  };
}

/**
 * 알 수 없는 프로바이더를 위한 범용 구조화 출력 설정 생성
 *
 * 시스템 프롬프트에 주입할 스키마 가이드 텍스트만 제공합니다.
 *
 * @param toolSchema - 도구 매개변수 JSON 스키마
 * @param _tier - 능력 티어
 * @returns 범용 설정 객체
 */
function buildGenericStructuredOutput(
  toolSchema: Record<string, unknown>,
  _tier: CapabilityTier,
): Record<string, unknown> {
  return {
    schema_guidance: buildSchemaGuidanceText(toolSchema),
  };
}

/**
 * 도구 호출 래퍼 JSON 스키마 생성
 *
 * 도구의 매개변수 스키마를 표준 도구 호출 봉투(envelope) 형식으로 감쌉니다.
 * 모델이 생성해야 하는 JSON의 최상위 구조를 정의합니다:
 * ```json
 * {
 *   "tool_name": "파일_읽기",
 *   "tool_input": { "file_path": "/path/to/file" }
 * }
 * ```
 *
 * @param toolSchema - 도구 매개변수 JSON 스키마
 * @returns 래퍼 JSON 스키마
 */
function buildToolCallWrapper(toolSchema: Record<string, unknown>): Record<string, unknown> {
  return {
    type: "object",
    properties: {
      tool_name: {
        type: "string",
        description: "The name of the tool to call",
      },
      tool_input: toolSchema,
    },
    required: ["tool_name", "tool_input"],
    additionalProperties: false, // 정의되지 않은 추가 필드 금지
  };
}

/**
 * 시스템 프롬프트에 주입할 스키마 가이드 텍스트 생성
 *
 * LOW/MEDIUM 티어 모델이 올바른 JSON을 생성하도록
 * 스키마와 사용 방법을 자연어로 설명합니다.
 *
 * 생성되는 텍스트 예시:
 * ```
 * You must respond with a valid JSON object matching this schema:
 * ```json
 * { "type": "object", "properties": { "tool_name": {...}, "tool_input": {...} }, ... }
 * ```
 *
 * The tool_input must conform to:
 * ```json
 * { ... 도구 매개변수 스키마 ... }
 * ```
 *
 * Do not include any text outside the JSON object.
 * ```
 *
 * @param toolSchema - 도구 매개변수 JSON 스키마
 * @returns 스키마 가이드 텍스트
 */
function buildSchemaGuidanceText(toolSchema: Record<string, unknown>): string {
  const schemaStr = JSON.stringify(toolSchema, null, 2);
  return [
    "You must respond with a valid JSON object matching this schema:",
    "```json",
    JSON.stringify(buildToolCallWrapper(toolSchema), null, 2),
    "```",
    "",
    "The tool_input must conform to:",
    "```json",
    schemaStr,
    "```",
    "",
    "Do not include any text outside the JSON object.",
  ].join("\n");
}

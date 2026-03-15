/**
 * 도구 인수 검증 모듈 — Zod 스키마를 JSON Schema로 변환하고, 도구 인수를 검증하는 유틸리티
 *
 * 이 모듈은 두 가지 핵심 기능을 제공합니다:
 * 1. Zod 스키마 → JSON Schema 변환: LLM API에 도구 정의를 전달할 때 사용
 * 2. 도구 인수 검증: LLM이 보낸 인수가 스키마에 맞는지 런타임에서 확인
 *
 * Zod — 런타임 데이터 검증 라이브러리로, TypeScript 타입과 런타임 검증을 동시에 제공합니다.
 * zod-to-json-schema — Zod 스키마를 JSON Schema 형식으로 변환하는 라이브러리입니다.
 */
import { type z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

/**
 * Zod 스키마를 JSON Schema 형식으로 변환 — LLM 함수 호출에 사용
 *
 * LLM API(예: OpenAI)는 도구 매개변수를 JSON Schema 형식으로 요구합니다.
 * Zod로 정의한 스키마를 OpenAPI 3.0 호환 JSON Schema로 변환하고,
 * 불필요한 $schema 메타데이터 필드를 제거하여 깔끔한 스키마를 반환합니다.
 *
 * @param schema - 변환할 Zod 스키마 객체
 * @returns JSON Schema 형식의 객체 ($schema 필드 제외)
 */
export function zodSchemaToJsonSchema(schema: z.ZodSchema): Record<string, unknown> {
  // OpenAPI 3.0 형식으로 변환 (LLM API 호환성을 위해)
  const jsonSchema = zodToJsonSchema(schema, { target: "openApi3" });
  // $schema 필드는 LLM에 불필요하므로 제거 (구조 분해 할당으로 분리)
  const { $schema: _schema, ...rest } = jsonSchema as Record<string, unknown>;
  return rest;
}

/**
 * 도구 인수를 Zod 스키마로 검증하고 타입 안전한 값을 반환
 *
 * LLM이 보낸 원시(raw) 인수를 Zod 스키마로 검증합니다.
 * 검증에 실패하면 어떤 필드가 잘못되었는지 상세한 에러 메시지를 포함한 예외를 던집니다.
 *
 * safeParse를 사용하여 예외를 던지지 않고 결과 객체를 받은 뒤,
 * 실패 시 수동으로 에러를 throw합니다. 이렇게 하면 에러 메시지를 커스터마이즈할 수 있습니다.
 *
 * @template T - 검증 후 반환되는 타입 (Zod 스키마에서 추론)
 * @param schema - 검증에 사용할 Zod 스키마
 * @param rawArgs - LLM이 보낸 원시 인수 객체
 * @returns 검증 완료된 타입 안전한 매개변수
 * @throws {Error} 검증 실패 시 — 잘못된 필드 경로와 에러 메시지 포함
 */
export function parseToolArguments<T>(schema: z.ZodSchema<T>, rawArgs: Record<string, unknown>): T {
  const result = schema.safeParse(rawArgs);
  if (!result.success) {
    // 각 검증 에러의 필드 경로(path)와 메시지를 합쳐서 사람이 읽기 쉬운 에러 문자열 생성
    const issues = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid tool arguments: ${issues}`);
  }
  return result.data;
}

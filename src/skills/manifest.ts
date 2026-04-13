/**
 * 스킬 매니페스트 — 타입-안전한 스킬 메타데이터 정의 및 검증 모듈
 *
 * 기존 SkillFrontmatter를 확장하여 더 풍부한 메타데이터를 지원합니다:
 * - 트리거 패턴: 자연어 키워드/정규식으로 스킬 자동 매칭
 * - 입출력 스키마: 스킬 간 데이터 전달의 타입 안전성
 * - 요구사항: 도구/권한/모델 등급 제약
 * - 신뢰 수준: built-in, project, community, untrusted 4단계
 *
 * 기존 SkillFrontmatter와 하위 호환됩니다.
 * 추가 필드만 확장하며, 기존 필드가 없어도 유효합니다.
 */

import { z } from "zod";
import { type SkillFrontmatter, skillFrontmatterSchema } from "./types.js";

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/**
 * 스킬 트리거 — 자연어 키워드나 정규식으로 스킬을 자동 매칭
 */
export interface SkillTrigger {
  /** 매칭 패턴 (정규식 또는 키워드) */
  readonly pattern: string;
  /** 이 트리거의 설명 */
  readonly description?: string;
}

/** 스킬 입력 파라미터 타입 */
export type SkillInputType = "string" | "number" | "boolean" | "array";

/** 스킬 출력 파라미터 타입 */
export type SkillOutputType = "string" | "number" | "boolean" | "array" | "object";

/**
 * 스킬 입력 파라미터 스키마 — 타입, 기본값, 필수 여부를 정의
 */
export interface SkillInput {
  /** 파라미터 타입 */
  readonly type: SkillInputType;
  /** 파라미터 설명 */
  readonly description?: string;
  /** 기본값 (required가 false일 때 사용) */
  readonly default?: unknown;
  /** 필수 여부 (기본: true) */
  readonly required?: boolean;
}

/**
 * 스킬 출력 파라미터 스키마 — 반환 타입을 정의
 */
export interface SkillOutput {
  /** 출력 타입 */
  readonly type: SkillOutputType;
  /** 출력 설명 */
  readonly description?: string;
}

/**
 * 스킬 실행 요구사항 — 필요한 도구, 권한, 모델 등급
 */
export interface SkillRequirements {
  /** 실행에 필요한 도구 이름 목록 */
  readonly tools?: readonly string[];
  /** 실행에 필요한 권한 이름 목록 */
  readonly permissions?: readonly string[];
  /** 최소 모델 등급 (low: haiku, medium: sonnet, high: opus) */
  readonly minModelTier?: "low" | "medium" | "high";
}

/** 스킬 신뢰 수준 — 실행 제한에 영향을 줌 */
export type SkillTrustLevel = "built-in" | "project" | "community" | "untrusted";

/**
 * 강화된 스킬 매니페스트 — 기존 SkillFrontmatter를 확장
 *
 * 기존 SkillFrontmatter의 모든 필드를 포함하며,
 * 트리거, 입출력 스키마, 요구사항, 신뢰 수준 등을 추가로 정의합니다.
 */
export interface SkillManifest extends SkillFrontmatter {
  /** 스킬 버전 (SemVer 형식 권장) */
  readonly version?: string;
  /** 스킬 작성자 */
  readonly author?: string;
  /** 분류 태그 (검색/필터링용) */
  readonly tags?: readonly string[];
  /** 자동 매칭 트리거 패턴 */
  readonly triggers?: readonly SkillTrigger[];
  /** 입력 파라미터 스키마 */
  readonly inputs?: Readonly<Record<string, SkillInput>>;
  /** 출력 파라미터 스키마 */
  readonly outputs?: Readonly<Record<string, SkillOutput>>;
  /** 실행 요구사항 (도구, 권한, 모델 등급) */
  readonly requires?: SkillRequirements;
  /** 신뢰 수준 (기본: 'project') */
  readonly trustLevel?: SkillTrustLevel;
}

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

/** 스킬 트리거 Zod 스키마 */
const skillTriggerSchema = z.object({
  pattern: z.string().min(1),
  description: z.string().optional(),
});

/** 스킬 입력 타입 Zod 스키마 */
const skillInputTypeSchema = z.enum(["string", "number", "boolean", "array"]);

/** 스킬 출력 타입 Zod 스키마 */
const skillOutputTypeSchema = z.enum(["string", "number", "boolean", "array", "object"]);

/** 스킬 입력 Zod 스키마 */
const skillInputSchema = z.object({
  type: skillInputTypeSchema,
  description: z.string().optional(),
  default: z.unknown().optional(),
  required: z.boolean().optional(),
});

/** 스킬 출력 Zod 스키마 */
const skillOutputSchema = z.object({
  type: skillOutputTypeSchema,
  description: z.string().optional(),
});

/** 스킬 요구사항 Zod 스키마 */
const skillRequirementsSchema = z.object({
  tools: z.array(z.string()).optional(),
  permissions: z.array(z.string()).optional(),
  minModelTier: z.enum(["low", "medium", "high"]).optional(),
});

/**
 * 스킬 매니페스트 Zod 스키마 — 기존 skillFrontmatterSchema를 확장
 *
 * 기존 프론트매터 필드는 그대로 유지하며, 추가 필드만 병합합니다.
 * 알 수 없는 필드는 무시(passthrough 아님)합니다.
 */
export const skillManifestSchema = skillFrontmatterSchema.extend({
  version: z.string().optional(),
  author: z.string().optional(),
  tags: z.array(z.string()).optional(),
  triggers: z.array(skillTriggerSchema).optional(),
  inputs: z.record(z.string(), skillInputSchema).optional(),
  outputs: z.record(z.string(), skillOutputSchema).optional(),
  requires: skillRequirementsSchema.optional(),
  trustLevel: z.enum(["built-in", "project", "community", "untrusted"]).optional(),
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** 매니페스트 검증 성공 결과 */
export interface ManifestValidResult {
  readonly valid: true;
  readonly manifest: SkillManifest;
}

/** 매니페스트 검증 실패 결과 */
export interface ManifestInvalidResult {
  readonly valid: false;
  readonly errors: readonly string[];
}

/** 매니페스트 검증 결과 (discriminated union) */
export type ManifestValidationResult = ManifestValidResult | ManifestInvalidResult;

/**
 * 미지의 데이터를 SkillManifest로 검증
 *
 * Zod 스키마를 사용하여 런타임에서 타입 안전하게 검증합니다.
 * 실패 시 구체적인 에러 메시지 배열을 반환합니다.
 *
 * @param data - 검증할 미지의 데이터 (frontmatter 파싱 결과 등)
 * @returns 검증 결과 (성공 시 manifest, 실패 시 errors)
 */
export function validateManifest(data: unknown): ManifestValidationResult {
  const result = skillManifestSchema.safeParse(data);
  if (result.success) {
    return { valid: true, manifest: result.data as SkillManifest };
  }
  const errors = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
  return { valid: false, errors };
}

/**
 * 기존 SkillFrontmatter 형식의 raw 객체를 SkillManifest로 파싱
 *
 * 기존 프론트매터 데이터와 호환됩니다:
 * - 기존 필드만 있으면 그대로 SkillManifest로 변환 (추가 필드는 undefined)
 * - 확장 필드가 있으면 함께 파싱
 *
 * @param raw - YAML 프론트매터를 파싱한 키-값 객체
 * @returns 검증된 SkillManifest
 * @throws ZodError - 데이터가 스키마에 맞지 않을 때
 */
export function parseManifestFromFrontmatter(raw: Record<string, unknown>): SkillManifest {
  return skillManifestSchema.parse(raw) as SkillManifest;
}

// ---------------------------------------------------------------------------
// Compatibility Check
// ---------------------------------------------------------------------------

/**
 * 실행 환경 컨텍스트 — 호환성 체크에 사용
 */
export interface CompatibilityContext {
  /** 현재 사용 가능한 도구 이름 목록 */
  readonly availableTools: readonly string[];
  /** 현재 권한 모드 */
  readonly permissionMode: string;
}

/**
 * 매니페스트가 현재 실행 환경과 호환되는지 검사
 *
 * 다음을 확인합니다:
 * - requires.tools에 명시된 도구가 모두 사용 가능한지
 * - requires.permissions에 명시된 권한이 현재 모드에서 허용되는지
 *
 * @param manifest - 검사할 스킬 매니페스트
 * @param context - 현재 실행 환경 (가용 도구, 권한 모드)
 * @returns 호환이면 true, 미충족 요구사항이 있으면 false
 */
export function isManifestCompatible(
  manifest: SkillManifest,
  context: CompatibilityContext,
): boolean {
  const { requires } = manifest;
  if (!requires) return true;

  // 필요한 도구가 모두 사용 가능한지 확인
  if (requires.tools) {
    const toolSet = new Set(context.availableTools);
    for (const tool of requires.tools) {
      if (!toolSet.has(tool)) return false;
    }
  }

  // 필요한 권한이 현재 모드에 포함되는지 확인
  if (requires.permissions) {
    for (const perm of requires.permissions) {
      if (!context.permissionMode.includes(perm)) return false;
    }
  }

  return true;
}

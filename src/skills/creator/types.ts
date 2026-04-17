/**
 * create-skill 모듈 타입 — Zod 스키마와 에러 타입
 *
 * 스킬 스캐폴딩 입력 검증 + 결과 구조 + 커스텀 에러 계층.
 * Claude Code skill-creator v2.0 과 상위 호환되는 필드 스키마.
 */

import { z } from "zod";

/**
 * Scaffold 옵션 Zod 스키마 — 외부 입력의 런타임 검증용
 *
 * 주요 규칙:
 * - name: 소문자 kebab-case (예: "my-skill", "refactor-service")
 * - intent: 자연어 목적 설명 (비어있지 않음)
 * - triggers: 최소 1개 이상의 should-trigger 예시
 * - antiTriggers: negative 예시 (선택)
 * - workflowSteps: 최소 1개 이상의 워크플로우 단계
 * - outputDir: 절대 경로 (스킬 디렉토리가 생성될 부모)
 */
export const scaffoldOptionsSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9-]*$/, "must be kebab-case"),
  intent: z.string().min(1),
  triggers: z.array(z.string().min(1)).min(1),
  antiTriggers: z.array(z.string().min(1)).default([]),
  fork: z.boolean().default(false),
  requiredTools: z.array(z.string()).optional(),
  minModelTier: z.enum(["low", "medium", "high"]).default("medium"),
  workflowSteps: z.array(z.string().min(1)).min(1),
  outputDir: z.string().min(1),
  force: z.boolean().default(false),
});

/** Zod에서 추론된 Scaffold 옵션 타입 */
export type ScaffoldOptions = z.infer<typeof scaffoldOptionsSchema>;

/**
 * Scaffold 성공 결과 — 생성된 파일 경로 집합
 */
export interface ScaffoldResult {
  /** 생성된 스킬 디렉토리 (예: `.dhelix/skills/my-skill`) */
  readonly skillDir: string;
  /** SKILL.md 절대 경로 */
  readonly skillMdPath: string;
  /** evals/evals.json 절대 경로 */
  readonly evalsPath: string;
  /** 생성된 모든 파일의 절대 경로 목록 */
  readonly created: readonly string[];
}

/** Scaffold 에러 코드 — discriminated union 용 */
export type ScaffoldErrorCode =
  | "NAME_COLLISION"
  | "INVALID_NAME"
  | "IO_ERROR"
  | "VALIDATION_FAILED";

/**
 * Scaffold 전용 에러 클래스 — code 필드로 유형 분기 가능
 */
export class ScaffoldError extends Error {
  readonly code: ScaffoldErrorCode;

  constructor(code: ScaffoldErrorCode, message: string) {
    super(message);
    this.name = "ScaffoldError";
    this.code = code;
  }
}

/**
 * 템플릿 엔진 입력 — 렌더러에 전달할 컴파일된 데이터
 *
 * scaffoldOptions 와 거의 동일하지만 `outputDir`, `force` 등 I/O 필드를 제외하고
 * 미리 계산된 `description`(pushy 문장)을 받는다.
 */
export interface TemplateInput {
  readonly name: string;
  readonly description: string;
  readonly triggers: readonly string[];
  readonly antiTriggers: readonly string[];
  readonly fork: boolean;
  readonly requiredTools?: readonly string[];
  readonly minModelTier: "low" | "medium" | "high";
  readonly workflowSteps: readonly string[];
}

/**
 * 템플릿 엔진 출력 — 렌더된 텍스트 + 라인수 가드
 *
 * `lineCount > 500` 이면 renderer가 ScaffoldError("VALIDATION_FAILED")를 던진다.
 */
export interface TemplateOutput {
  /** 렌더된 SKILL.md 전문 */
  readonly skillMd: string;
  /** 렌더된 evals.json 전문 (JSON-serializable) */
  readonly evalsJson: string;
  /** SKILL.md 총 라인 수 — progressive disclosure 규칙 (≤500) */
  readonly lineCount: number;
}

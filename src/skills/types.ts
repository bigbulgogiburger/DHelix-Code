/**
 * 스킬 시스템 타입 정의 모듈 — 스킬의 구조와 실행 컨텍스트를 정의
 *
 * 스킬(Skill)은 마크다운 파일(.md)로 작성된 재사용 가능한 프롬프트 템플릿입니다.
 * 사용자가 /명령어로 호출하면 변수가 치환되어 LLM에 전달됩니다.
 *
 * 스킬 파일 구조:
 * ---
 * name: my-skill         (스킬 이름, /my-skill로 호출)
 * description: 설명      (도움말에 표시)
 * context: inline        (inline: 현재 컨텍스트, fork: 서브에이전트)
 * ---
 * 여기에 프롬프트 본문 작성 ($ARGUMENTS, $0, $1 등 변수 사용 가능)
 */

import { z } from "zod";

/**
 * 스킬 프론트매터 Zod 스키마 — 스킬 메타데이터의 유효성 검증
 *
 * 프론트매터(frontmatter)는 마크다운 파일 상단의 --- 사이에 있는
 * YAML 형식의 메타데이터 블록입니다.
 */
export const skillFrontmatterSchema = z.object({
  /** 스킬 이름 — /command 이름으로 사용됨 (예: "commit" → /commit) */
  name: z.string().min(1),
  /** 짧은 설명 — /help에서 표시됨 */
  description: z.string().min(1),
  /** 인자 힌트 — 사용법 안내 (예: "[file path]") */
  argumentHint: z.string().optional(),
  /** 사용자가 /name으로 직접 호출 가능 여부 (기본: true) */
  userInvocable: z.boolean().default(true),
  /** true이면 LLM이 자동으로 이 스킬을 호출할 수 없음 (사용자 전용) */
  disableModelInvocation: z.boolean().default(false),
  /** 이 스킬 실행 중 사용 가능한 도구를 제한 (보안/범위 제한용) */
  allowedTools: z.array(z.string()).optional(),
  /** 특정 모델 강제 지정 — null이면 현재 세션 모델 사용 */
  model: z.string().nullable().default(null),
  /** 실행 컨텍스트: "inline"(현재 대화에 주입) 또는 "fork"(서브에이전트로 분리) */
  context: z.enum(["inline", "fork"]).default("inline"),
  /** fork일 때 서브에이전트 유형: explore(탐색), plan(계획), general(범용) */
  agent: z.enum(["explore", "plan", "general"]).optional(),
  /** 스킬 범위 훅 — 이 스킬 실행 중에만 활성화되는 이벤트 핸들러 */
  hooks: z.array(z.unknown()).default([]),
});

/** 파싱된 스킬 프론트매터 타입 — Zod 스키마에서 자동 추론 */
export type SkillFrontmatter = z.infer<typeof skillFrontmatterSchema>;

/**
 * 완전히 로드된 스킬 정의 — 프론트매터 + 본문 + 소스 경로
 *
 * 스킬 파일을 읽고 파싱한 후의 최종 결과물입니다.
 */
export interface SkillDefinition {
  /** 파싱된 프론트매터 메타데이터 (이름, 설명, 설정 등) */
  readonly frontmatter: SkillFrontmatter;
  /** 마크다운 본문 — 프롬프트 템플릿 (변수 치환 전 원본) */
  readonly body: string;
  /** 이 스킬이 로드된 파일의 절대 경로 */
  readonly sourcePath: string;
}

/**
 * 스킬 본문에서 변수 치환 시 사용할 컨텍스트 — 런타임 정보 모음
 *
 * 스킬 본문의 $ARGUMENTS, $0, $1 등의 변수를 실제 값으로 치환할 때 사용됩니다.
 */
export interface SkillContext {
  /** /command 뒤에 전달된 전체 인자 문자열 (예: "/commit fix auth bug" → "fix auth bug") */
  readonly arguments: string;
  /** 공백으로 분리된 위치별 인자 (예: ["fix", "auth", "bug"]) */
  readonly positionalArgs: readonly string[];
  /** 현재 세션 ID (세션 추적용) */
  readonly sessionId?: string;
  /** 스킬 파일이 위치한 디렉토리 경로 */
  readonly skillDir?: string;
  /** 프로젝트 루트 디렉토리 경로 */
  readonly projectDir?: string;
  /** 현재 작업 디렉토리 (셸 명령 실행 시 cwd로 사용) */
  readonly workingDirectory: string;
}

/**
 * 스킬 실행 결과 — 변수 치환과 동적 컨텍스트 주입이 완료된 최종 출력
 */
export interface SkillExecutionResult {
  /** LLM에 전송할 완성된 프롬프트 텍스트 */
  readonly prompt: string;
  /** 모델 오버라이드 — 스킬이 특정 모델을 지정한 경우 */
  readonly model?: string;
  /** true이면 서브에이전트(fork)로 실행 — 별도 컨텍스트에서 독립 실행 */
  readonly fork: boolean;
  /** fork 실행 시 서브에이전트 유형 */
  readonly agentType?: "explore" | "plan" | "general";
  /** 이 스킬 실행 중 사용 가능한 도구 제한 목록 */
  readonly allowedTools?: readonly string[];
}

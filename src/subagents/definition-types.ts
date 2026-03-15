/**
 * 에이전트 정의 타입 — 에이전트 정의 파일의 구조를 나타내는 타입과 스키마 모듈
 *
 * 에이전트 정의 파일(.md)은 서브에이전트의 모든 설정을 담고 있습니다.
 * 이 모듈은 그 설정의 구조(shape)를 TypeScript 타입과 Zod 스키마로 정의합니다.
 *
 * Zod란 런타임(실행 시점) 타입 검증 라이브러리로,
 * TypeScript의 컴파일 타임 타입 검사와 달리 실제 데이터가
 * 올바른 형식인지 실행 중에 확인할 수 있습니다.
 *
 * 에이전트 정의 파일 예시:
 * ```markdown
 * ---
 * name: code-reviewer          ← 필수: 에이전트 이름 (케밥 케이스)
 * description: 코드 리뷰 에이전트  ← 필수: 설명
 * tools: [file_read]           ← 선택: 허용 도구
 * model: sonnet                ← 선택: 사용 모델
 * max-turns: 15                ← 선택: 최대 반복 횟수
 * ---
 * 시스템 프롬프트 본문...
 * ```
 */
import { z } from "zod";

/**
 * 에이전트가 사용할 AI 모델 선택지
 * - sonnet: Claude Sonnet (빠르고 효율적)
 * - opus: Claude Opus (깊은 추론)
 * - haiku: Claude Haiku (가장 빠름, 저비용)
 * - inherit: 부모 에이전트의 모델을 그대로 사용
 */
export type AgentModel = "sonnet" | "opus" | "haiku" | "inherit";

/**
 * 에이전트의 권한 모드 — 도구 실행 시 사용자 확인 수준을 결정
 * - default: 기본 권한 규칙 적용
 * - acceptEdits: 파일 수정을 자동 승인
 * - dontAsk: 모든 도구를 확인 없이 실행
 * - bypassPermissions: 모든 권한 검사를 건너뜀 (위험)
 * - plan: 안전한(safe) 도구만 허용하는 계획 모드
 */
export type AgentPermissionMode =
  | "default"
  | "acceptEdits"
  | "dontAsk"
  | "bypassPermissions"
  | "plan";

/**
 * 에이전트 메모리의 저장 범위
 * - user: 사용자 전역 (모든 프로젝트에서 공유)
 * - project: 프로젝트 단위 (Git 추적 가능)
 * - local: 로컬 전용 (Git 무시, 개인 메모)
 */
export type AgentMemoryScope = "user" | "project" | "local";

/** 에이전트 훅 항목 — 실행할 셸 명령 하나를 나타냄 */
export interface AgentHookEntry {
  readonly type: "command";
  /** 실행할 셸 명령어 (예: "npm run lint") */
  readonly command: string;
}

/** 에이전트 훅 규칙 — 매처 패턴과 실행할 훅 목록 */
export interface AgentHookRule {
  /** 도구 이름 매칭 패턴 (생략하면 모든 도구에 적용) */
  readonly matcher?: string;
  /** 매칭 시 실행할 훅 목록 */
  readonly hooks: readonly AgentHookEntry[];
}

/**
 * 에이전트 훅 설정 — 라이프사이클 이벤트별 훅 규칙
 * - PreToolUse: 도구 사용 전
 * - PostToolUse: 도구 사용 후
 * - Stop: 에이전트 종료 시
 */
export interface AgentHookConfig {
  readonly PreToolUse?: readonly AgentHookRule[];
  readonly PostToolUse?: readonly AgentHookRule[];
  readonly Stop?: readonly AgentHookRule[];
}

/**
 * 에이전트 정의 프론트매터의 Zod 검증 스키마
 *
 * Zod 스키마는 런타임에 데이터의 형식과 제약 조건을 검증합니다.
 * 에이전트 이름은 반드시 소문자 케밥 케이스(예: "code-reviewer")여야 하며,
 * name과 description만 필수이고 나머지는 선택적(optional)입니다.
 */
export const agentDefinitionSchema = z.object({
  /** 에이전트 이름 — 소문자로 시작하는 케밥 케이스 (예: "code-reviewer") */
  name: z.string().regex(/^[a-z][a-z0-9-]*$/, "Agent name must be lowercase kebab-case"),
  /** 에이전트의 역할과 용도를 설명하는 텍스트 (최소 1자) */
  description: z.string().min(1),
  /** 허용할 도구 이름 목록 (지정하지 않으면 기본 도구 세트 사용) */
  tools: z.array(z.string()).optional(),
  /** 차단할 도구 이름 목록 (허용 목록에서 제외) */
  disallowedTools: z.array(z.string()).optional(),
  /** 사용할 AI 모델 (기본값: 부모 에이전트와 동일) */
  model: z.enum(["sonnet", "opus", "haiku", "inherit"]).optional(),
  /** 권한 모드 (기본값: "default") */
  permissionMode: z
    .enum(["default", "acceptEdits", "dontAsk", "bypassPermissions", "plan"])
    .optional(),
  /** 최대 반복 횟수 (양의 정수) */
  maxTurns: z.number().int().positive().optional(),
  /** 미리 로드할 스킬 이름 목록 */
  skills: z.array(z.string()).optional(),
  /** 영속적 메모리의 저장 범위 */
  memory: z.enum(["user", "project", "local"]).optional(),
  /** 백그라운드 실행 여부 (true이면 비동기로 실행) */
  background: z.boolean().optional(),
  /** 격리 모드 — "worktree"이면 별도의 Git 워크트리에서 실행 */
  isolation: z.enum(["worktree"]).optional(),
});

/** Zod 스키마에서 추론된 프론트매터 타입 (타입 안전성 보장) */
export type AgentDefinitionFrontmatter = z.infer<typeof agentDefinitionSchema>;

/**
 * 에이전트 정의가 로드된 출처
 * - project: 프로젝트 디렉토리 (.dbcode/agents/)
 * - user: 사용자 전역 디렉토리 (~/.dbcode/agents/)
 * - cli: CLI에서 직접 정의 (파일 없이)
 */
export type AgentDefinitionSource = "project" | "user" | "cli";

/**
 * 완전히 로드된 에이전트 정의 객체
 *
 * 프론트매터(메타데이터)와 시스템 프롬프트(본문)를 포함하며,
 * 어디서 로드되었는지(출처)와 원본 파일 경로도 기록합니다.
 */
export interface AgentDefinition {
  /** 파싱되고 검증된 프론트매터 메타데이터 */
  readonly frontmatter: AgentDefinitionFrontmatter;
  /** 시스템 프롬프트 본문 (프론트매터 이후의 마크다운 내용) */
  readonly systemPrompt: string;
  /** 이 정의가 로드된 출처 (project, user, cli) */
  readonly source: AgentDefinitionSource;
  /** 원본 파일 경로 (CLI에서 정의된 경우 없을 수 있음) */
  readonly filePath?: string;
}

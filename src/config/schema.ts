/**
 * 설정 스키마 정의 모듈 — Zod를 사용한 런타임 유효성 검증
 *
 * Zod는 TypeScript-first 스키마 검증 라이브러리입니다.
 * JSON 파일이나 환경변수에서 로드한 설정값이 올바른 형식인지 런타임에 검증하고,
 * 잘못된 값이 들어오면 명확한 에러 메시지를 제공합니다.
 *
 * 각 스키마에 .default()로 기본값을 지정하면, 해당 필드가 누락되었을 때
 * 자동으로 기본값이 적용됩니다.
 */

import { z } from "zod";

/**
 * LLM(대규모 언어 모델) 제공자 연결 설정 스키마
 *
 * OpenAI 호환 API에 접속하기 위한 설정입니다.
 * 로컬 LLM(예: Ollama, LM Studio)이나 외부 API(OpenAI, Anthropic) 모두 지원합니다.
 *
 * 주의: Zod 기본값은 import 시점에 평가되므로, dotenv 로드 전에 실행됩니다.
 * 따라서 process.env가 아닌 하드코딩된 제품 기본값을 사용합니다.
 * 환경변수 기반 오버라이드는 config/loader.ts의 loadEnvConfig()에서 처리합니다.
 */
export const llmConfigSchema = z.object({
  /** API 엔드포인트 URL — 반드시 유효한 URL 형식이어야 함 */
  baseUrl: z.string().url().default("https://api.openai.com/v1"),
  /** API 인증 키 — 없으면 인증 없이 요청 (로컬 LLM용) */
  apiKey: z.string().optional(),
  /** API 키 전달 시 사용할 커스텀 헤더명 (예: "model-api-key") — 로컬/사내 모델용 */
  apiKeyHeader: z.string().optional(),
  /** 사용할 모델명 — 제품 기본값 (env 오버라이드는 config/loader.ts에서 처리) */
  model: z.string().default("gpt-5.1-codex-mini"),
  /** 응답 온도 — 0에 가까울수록 결정적, 2에 가까울수록 창의적 */
  temperature: z.number().min(0).max(2).default(0.0),
  /** 한 번의 응답에서 생성할 최대 토큰 수 */
  maxTokens: z.number().positive().default(32768),
  /** 모델의 컨텍스트 윈도우 크기 (한 번에 처리 가능한 토큰 수) */
  contextWindow: z.number().positive().default(1_000_000),
  /** API 요청 타임아웃 (밀리초) — 응답이 없으면 이 시간 후 취소 */
  timeout: z.number().positive().default(60_000),
});

/**
 * 권한 모드 스키마 — 도구 실행 시 사용자 확인 방식 결정
 *
 * - "default": 위험한 작업만 확인 요청
 * - "acceptEdits": 파일 편집은 자동 허용
 * - "plan": 실행하지 않고 계획만 보여줌
 * - "dontAsk": 모든 작업 자동 허용 (주의!)
 * - "bypassPermissions": 모든 권한 검사 건너뜀 (위험!)
 */
export const permissionModeSchema = z.enum([
  "default",
  "acceptEdits",
  "plan",
  "dontAsk",
  "bypassPermissions",
]);

/**
 * 보안/가드레일 설정 스키마
 *
 * 프롬프트 인젝션 방지, 비밀키 유출 방지, 요청 제한 등
 * 보안 관련 설정을 정의합니다.
 */
export const securityConfigSchema = z.object({
  /** 보안 모드: local(로컬 전용), external(외부 API 포함), hybrid(혼합) */
  mode: z.enum(["local", "external", "hybrid"]).default("local"),
  /** 비밀키 스캔 — 코드에서 API 키, 비밀번호 등 유출 감지 */
  secretScanning: z.boolean().default(true),
  /** 입력 필터링 — 악의적 프롬프트 인젝션 차단 */
  inputFiltering: z.boolean().default(true),
  /** 출력 필터링 — 민감 정보가 응답에 포함되지 않도록 마스킹 */
  outputFiltering: z.boolean().default(true),
  /** 감사 로깅 — 모든 도구 실행 기록 저장 (보안 감사용) */
  auditLogging: z.boolean().default(false),
  /** 요청 제한 — 과도한 API 사용 방지 */
  rateLimit: z
    .object({
      /** 분당 최대 API 요청 수 */
      requestsPerMinute: z.number().positive().default(60),
      /** 일일 최대 토큰 사용량 */
      tokensPerDay: z.number().positive().default(1_000_000),
    })
    .default({}),
});

/**
 * UI(사용자 인터페이스) 설정 스키마
 *
 * 터미널에 표시되는 시각적 요소를 제어합니다.
 */
export const uiConfigSchema = z.object({
  /** 색상 테마: auto(터미널 설정 따름), dark(어두운), light(밝은) */
  theme: z.enum(["auto", "dark", "light"]).default("auto"),
  /** 마크다운 렌더링 활성화 여부 */
  markdown: z.boolean().default(true),
  /** 코드 블록 구문 강조 활성화 여부 */
  syntaxHighlighting: z.boolean().default(true),
  /** 작업 중 로딩 스피너 표시 여부 */
  spinner: z.boolean().default(true),
  /** 하단 상태바 표시 여부 (모델명, 토큰 사용량 등) */
  statusBar: z.boolean().default(true),
});

/**
 * 영구 권한 규칙 설정 스키마
 *
 * 자주 사용하는 도구에 대해 매번 확인하지 않도록
 * 허용/거부 패턴을 미리 설정합니다.
 * deny(거부)가 항상 allow(허용)보다 우선합니다.
 */
export const permissionsConfigSchema = z
  .object({
    /** 자동 허용할 도구 패턴 (예: ["Bash(npm *)", "Edit(/src/**)"] ) */
    allow: z.array(z.string()).default([]),
    /** 항상 거부할 도구 패턴 (예: ["Bash(rm -rf *)"]) — deny가 항상 우선 */
    deny: z.array(z.string()).default([]),
  })
  .default({ allow: [], deny: [] });

/**
 * 음성 입력 설정 스키마
 *
 * 마이크로 음성을 녹음하고 STT(Speech-to-Text)로 변환하여
 * 텍스트 입력 대신 음성으로 명령을 내릴 수 있습니다.
 */
export const voiceConfigSchema = z
  .object({
    /** 음성 입력 활성화 여부 */
    enabled: z.boolean().default(false),
    /** STT 제공자: openai(Whisper API), local(로컬 모델) */
    provider: z.enum(["openai", "local"]).default("openai"),
    /** 음성 인식 언어 (ISO 639-1 코드, 예: "ko", "en") */
    language: z.string().default("ko"),
    /** STT 모델명 */
    model: z.string().default("whisper-1"),
    /** SoX 녹음 도구 경로 (로컬 녹음 시 필요) */
    soxPath: z.string().optional(),
  })
  .default({});

/**
 * Plasmid 시스템 설정 스키마 (GAL-1, Phase 1)
 *
 * 플라스미드(plasmid)는 dhelix 의 컴파일 타임에만 적용되는
 * "의도 조각(intent fragment)" 이다. 런타임 컨텍스트로는 절대 유입되지 않으며
 * (I-8), 활성화된 조각만 시스템 프롬프트 조립에 참여한다.
 *
 * `enabled` 는 기능 플래그로서 기본값 false. 사용자가 명시적으로 켜거나
 * DHELIX_PLASMID_ENABLED=true 환경변수로 활성화한다.
 */
export const plasmidConfigSchema = z
  .object({
    /** 플라스미드 시스템 전체 활성화 플래그 (Phase 1 기본 false) */
    enabled: z.boolean().default(false),
    /** 프로젝트 로컬 플라스미드 디렉터리 (프로젝트 루트 상대) */
    registryPath: z.string().default(".dhelix/plasmids"),
    /** 공유 플라스미드 디렉터리 — 지정 시 git/team 범위 조회 */
    sharedRegistryPath: z.string().optional(),
    /** 임시(ephemeral) 드래프트 디렉터리 — /plasmid quick 초안 저장소 */
    draftsPath: z.string().default(".dhelix/plasmids/.drafts"),
  })
  .default({});

/**
 * 듀얼 모델(Architect/Editor) 라우팅 설정 스키마
 *
 * 두 개의 모델을 역할별로 나눠 사용하는 전략입니다:
 * - Architect(설계자): 고성능 모델로 계획 수립, 코드 리뷰 담당
 * - Editor(편집자): 비용 효율 모델로 코드 생성, 실행 담당
 *
 * 이를 통해 품질과 비용의 균형을 맞출 수 있습니다.
 */
export const dualModelConfigSchema = z
  .object({
    /** 듀얼 모델 라우팅 활성화 여부 */
    enabled: z.boolean().default(false),
    /** 설계/검토 단계에서 사용할 고성능 모델 */
    architectModel: z.string().default("claude-opus-4-6"),
    /** 코드 생성/실행 단계에서 사용할 비용 효율 모델 */
    editorModel: z.string().default("gpt-4o-mini"),
    /** 라우팅 전략: auto(키워드 기반 자동), plan-execute(명시적 분리), manual(사용자 수동) */
    routingStrategy: z.enum(["auto", "plan-execute", "manual"]).default("auto"),
  })
  .default({});

/**
 * 전체 애플리케이션 설정 스키마 — 위의 모든 하위 스키마를 통합
 *
 * 이 스키마로 설정 파일을 검증하면, 각 필드의 타입과 범위가 올바른지,
 * 누락된 필드에 기본값이 적용되었는지 한 번에 확인할 수 있습니다.
 */
export const configSchema = z.object({
  /** LLM 연결 설정 */
  llm: llmConfigSchema.default({}),
  /** 권한 모드 */
  permissionMode: permissionModeSchema.default("default"),
  /** 영구 권한 규칙 */
  permissions: permissionsConfigSchema,
  /** 보안/가드레일 설정 */
  security: securityConfigSchema.default({}),
  /** UI 설정 */
  ui: uiConfigSchema.default({}),
  /** 작업 디렉토리 (지정하지 않으면 현재 디렉토리 사용) */
  workingDirectory: z.string().optional(),
  /** 상세 로깅 모드 — true이면 디버그 정보 출력 */
  verbose: z.boolean().default(false),
  /** DHELIX.md 로딩 시 제외할 glob 패턴 (특정 규칙 파일 무시) */
  dhelixMdExcludes: z.array(z.string()).default([]),
  /** 응답 언어 (ISO 639-1 코드, 예: "ko"=한국어, "en"=영어) */
  locale: z.string().default("ko"),
  /** 응답 톤/스타일 — normal, cute, senior, friend, mentor, minimal */
  tone: z.enum(["normal", "cute", "senior", "friend", "mentor", "minimal"]).default("normal"),
  /** 음성 입력 설정 */
  voice: voiceConfigSchema,
  /** MCP 도구 지연 로딩 활성화 — true이면 필요할 때만 도구 스키마를 가져옴 */
  deferredTools: z.boolean().default(true),
  /** 듀얼 모델(Architect/Editor) 라우팅 설정 */
  dualModel: dualModelConfigSchema,
  /** 플라스미드(GAL-1) 설정 — Phase 1 기본 비활성 */
  plasmid: plasmidConfigSchema,
});

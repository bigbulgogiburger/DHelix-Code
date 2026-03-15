/**
 * 기본 설정값 모듈 — 설정 계층의 최하위 레벨(Level 1)
 *
 * 사용자나 프로젝트 설정이 없을 때 적용되는 폴백(fallback) 기본값입니다.
 * 설정은 defaults → user → project → env → CLI flags 순서로 병합되며,
 * 뒤의 것이 앞의 것을 덮어씁니다.
 *
 * 모델명은 constants.ts의 DEFAULT_MODEL에서 가져옵니다 (환경변수 기반 단일 소스).
 * LLM 관련 기본값도 constants.ts의 LLM_DEFAULTS에서 가져와 하드코딩을 방지합니다.
 */

import { type AppConfig } from "./types.js";
import { DEFAULT_MODEL, LLM_DEFAULTS } from "../constants.js";

/**
 * 애플리케이션 기본 설정값
 *
 * 모든 설정 키에 대해 합리적인 기본값을 제공합니다.
 * 사용자가 아무것도 설정하지 않아도 앱이 정상 동작하도록 보장합니다.
 */
export const DEFAULT_CONFIG: AppConfig = {
  /** LLM(대규모 언어 모델) 연결 설정 */
  llm: {
    baseUrl: LLM_DEFAULTS.baseUrl, // OpenAI 호환 API 엔드포인트 URL
    model: DEFAULT_MODEL, // 사용할 AI 모델명 (환경변수에서 결정)
    temperature: LLM_DEFAULTS.temperature, // 응답 창의성 (0.0 = 결정적, 2.0 = 창의적)
    maxTokens: LLM_DEFAULTS.maxTokens, // 한 번의 응답에서 생성할 최대 토큰 수
    contextWindow: 1_000_000, // 모델이 한 번에 처리할 수 있는 최대 토큰 수 (컨텍스트 윈도우)
    timeout: 60_000, // API 요청 타임아웃 (밀리초, 60초)
  },
  /** 권한 모드 — 도구 실행 시 사용자 확인 방식 */
  permissionMode: "default",
  /** 영구 권한 규칙 — 허용/거부 패턴 목록 */
  permissions: {
    allow: [], // 자동 허용할 도구 패턴 (예: ["Bash(npm *)"])
    deny: [], // 항상 거부할 도구 패턴 (예: ["Bash(rm -rf *)"])
  },
  /** 보안/가드레일 설정 */
  security: {
    mode: "local", // 보안 모드: local(로컬만), external(외부), hybrid(혼합)
    secretScanning: true, // 비밀키 스캔 활성화 (API 키 등 유출 방지)
    inputFiltering: true, // 입력 필터링 (프롬프트 인젝션 방지)
    outputFiltering: true, // 출력 필터링 (민감 정보 마스킹)
    auditLogging: false, // 감사 로깅 (모든 작업 기록, 기본 비활성)
    rateLimit: {
      requestsPerMinute: 60, // 분당 최대 API 요청 수
      tokensPerDay: 1_000_000, // 일일 최대 토큰 사용량
    },
  },
  /** UI 표시 설정 */
  ui: {
    theme: "auto", // 테마: auto(시스템 따름), dark, light
    markdown: true, // 마크다운 렌더링 활성화
    syntaxHighlighting: true, // 코드 구문 강조 활성화
    spinner: true, // 로딩 스피너 표시
    statusBar: true, // 하단 상태바 표시
  },
  /** 상세 로깅 모드 (디버깅용) */
  verbose: false,
  /** DBCODE.md 로딩 시 제외할 glob 패턴 */
  dbcodeMdExcludes: [],
  /** 응답 언어 (ISO 639-1 코드) */
  locale: "ko",
  /** 응답 톤/스타일 */
  tone: "normal" as const,
  /** 음성 입력 설정 */
  voice: {
    enabled: false, // 음성 입력 비활성 (기본)
    provider: "openai" as const, // 음성 인식 제공자
    language: "ko", // 음성 인식 언어
    model: "whisper-1", // 음성 인식 모델
  },
  /** 지연 도구 로딩 — MCP 도구를 필요할 때 로드 */
  deferredTools: true,
  /** 듀얼 모델 라우팅 (Architect/Editor 모드) */
  dualModel: {
    enabled: false, // 듀얼 모델 비활성 (기본)
    architectModel: "claude-opus-4-6", // 설계/검토용 고성능 모델
    editorModel: "gpt-4o-mini", // 코드 생성용 비용 효율 모델
    routingStrategy: "auto" as const, // 라우팅 전략: auto(키워드 기반 자동)
  },
};

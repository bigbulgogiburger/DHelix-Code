/**
 * 도구 시스템 타입 정의 — 모든 도구(Tool)의 기본 인터페이스와 타입을 정의하는 모듈
 *
 * 이 파일은 도구 시스템의 "계약(Contract)"을 정의합니다.
 * 모든 도구는 이 타입들을 구현해야 하며, 도구 실행기(executor)와 레지스트리(registry)도
 * 이 타입들에 의존합니다.
 *
 * 주요 타입:
 * - PermissionLevel: 도구의 위험도 수준 (safe/confirm/dangerous)
 * - ToolContext: 도구 실행 시 전달되는 실행 환경 정보
 * - ToolResult: 도구 실행 결과
 * - ToolDefinition: 도구 등록에 필요한 전체 정의
 * - ToolDefinitionForLLM: LLM에 전달할 JSON Schema 형식의 도구 정의
 * - ExtractedToolCall: LLM 응답에서 추출한 도구 호출 정보
 * - ToolCallResult: 도구 호출 결과 (ID 포함)
 */
import { type z } from "zod";
import { type AppEventEmitter } from "../utils/events.js";

/**
 * 도구의 권한 수준 — 도구가 시스템에 미치는 영향도를 3단계로 분류
 *
 * - "safe": 안전한 도구 (예: 파일 읽기, 검색) — 사용자 확인 없이 즉시 실행
 * - "confirm": 확인 필요 (예: 파일 쓰기, 명령 실행) — 사용자 승인 후 실행
 * - "dangerous": 위험한 도구 (예: 시스템 명령) — 엄격한 승인 절차 필요
 */
export type PermissionLevel = "safe" | "confirm" | "dangerous";

/**
 * 도구 실행 컨텍스트 — 도구가 실행될 때 필요한 환경 정보를 담는 인터페이스
 *
 * 도구의 execute 함수에 두 번째 인수로 전달되며,
 * 작업 디렉토리, 취소 신호, 타임아웃 등 실행 환경을 제공합니다.
 */
export interface ToolContext {
  /** 현재 작업 디렉토리 — 상대 경로 해석의 기준이 되는 절대 경로 */
  readonly workingDirectory: string;
  /**
   * 중단 신호(AbortSignal) — 사용자가 Esc를 누르거나 타임아웃이 발생하면
   * 이 신호가 활성화되어 도구 실행을 안전하게 중단시킵니다.
   */
  readonly abortSignal: AbortSignal;
  /** 타임아웃 시간(밀리초) — 이 시간을 초과하면 도구 실행이 자동으로 취소됩니다 */
  readonly timeoutMs: number;
  /** 운영체제 플랫폼 — 플랫폼별 경로 구분자나 명령어 차이를 처리하는 데 사용 */
  readonly platform: "win32" | "darwin" | "linux";
  /**
   * 이벤트 발행기(선택사항) — 도구 실행 중 실시간 출력을 스트리밍할 때 사용
   * "tool:output-delta" 이벤트를 발행하여 UI에 중간 결과를 전달합니다.
   */
  readonly events?: AppEventEmitter;
  /** 도구 호출 ID(선택사항) — 이벤트 상관관계(correlation)를 위한 고유 식별자 */
  readonly toolCallId?: string;
  /** 현재 활성 LLM 클라이언트 (동적 모델 전환 지원) */
  readonly activeClient?: import("../llm/provider.js").LLMProvider;
  /** 현재 활성 모델명 (동적 모델 전환 지원) */
  readonly activeModel?: string;
}

/**
 * 도구 실행 결과 — 도구가 실행을 완료한 후 반환하는 객체
 */
export interface ToolResult {
  /** 도구 실행의 출력 텍스트 — LLM에게 전달되는 실행 결과 */
  readonly output: string;
  /** 에러 여부 — true이면 도구 실행이 실패했음을 나타냅니다 */
  readonly isError: boolean;
  /**
   * 추가 메타데이터(선택사항) — UI 렌더링에 필요한 부가 정보
   * 예: 파일 경로, 줄 번호, 이미지 데이터 등
   */
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * 도구 정의(ToolDefinition) — 하나의 도구를 완전히 정의하는 핵심 인터페이스
 *
 * 새로운 도구를 만들려면 이 인터페이스를 구현해야 합니다.
 * 제네릭 타입 TParams는 도구가 받는 매개변수의 타입을 지정합니다.
 *
 * @template TParams - 도구 매개변수의 타입 (Zod 스키마에서 추론됨)
 */
export interface ToolDefinition<TParams = unknown> {
  /** 도구 이름 — 레지스트리에서 도구를 식별하는 고유 키 (예: "file_read", "bash_exec") */
  readonly name: string;
  /** 도구 설명 — LLM이 도구의 용도를 이해하는 데 사용하는 자연어 설명 */
  readonly description: string;
  /**
   * 매개변수 스키마 — Zod(런타임 데이터 검증 라이브러리)로 정의된 매개변수 검증 규칙
   * LLM에 전달할 때는 JSON Schema 형식으로 변환됩니다.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly parameterSchema: z.ZodType<TParams, z.ZodTypeDef, any>;
  /** 권한 수준 — 이 도구를 실행하기 전 필요한 사용자 승인 수준 */
  readonly permissionLevel: PermissionLevel;
  /** 개별 타임아웃(밀리초, 선택사항) — 지정하지 않으면 전역 기본값 사용 */
  readonly timeoutMs?: number;
  /**
   * 실행 함수 — 검증된 매개변수와 실행 컨텍스트를 받아 도구를 실제로 실행하는 비동기 함수
   *
   * @param params - Zod 스키마로 검증이 완료된 매개변수
   * @param context - 작업 디렉토리, 취소 신호 등 실행 환경 정보
   * @returns 실행 결과 (출력 텍스트와 에러 여부)
   */
  readonly execute: (params: TParams, context: ToolContext) => Promise<ToolResult>;
}

/**
 * LLM용 도구 정의 — OpenAI 호환 함수 호출(Function Calling) 형식의 도구 정의
 *
 * LLM API에 도구 목록을 전달할 때 사용하는 JSON Schema 기반 형식입니다.
 * Zod 스키마를 JSON Schema로 변환하여 이 형식에 맞춥니다.
 */
export interface ToolDefinitionForLLM {
  /** 항상 "function" — OpenAI API의 도구 타입 식별자 */
  readonly type: "function";
  readonly function: {
    /** 도구 이름 */
    readonly name: string;
    /** 도구 설명 */
    readonly description: string;
    /** JSON Schema 형식의 매개변수 정의 */
    readonly parameters: Record<string, unknown>;
  };
}

/**
 * 추출된 도구 호출 — LLM 응답에서 파싱한 도구 호출 정보
 *
 * LLM이 도구를 호출하겠다고 응답하면, 그 응답에서 도구 이름과 인수를 추출한 결과입니다.
 */
export interface ExtractedToolCall {
  /** 도구 호출의 고유 ID — LLM이 생성한 호출 식별자 (응답 매핑에 사용) */
  readonly id: string;
  /** 호출할 도구의 이름 */
  readonly name: string;
  /** 도구에 전달할 인수 (키-값 쌍) */
  readonly arguments: Record<string, unknown>;
}

/**
 * 도구 호출 결과 — 도구 호출 ID와 함께 반환되는 실행 결과
 *
 * LLM에게 도구 실행 결과를 돌려줄 때 사용하며,
 * ID를 통해 어떤 호출에 대한 결과인지 매핑합니다.
 */
export interface ToolCallResult {
  /** 도구 호출 ID — 원래 ExtractedToolCall의 id와 일치 */
  readonly id: string;
  /** 실행된 도구의 이름 */
  readonly name: string;
  /** 도구 실행 출력 텍스트 */
  readonly output: string;
  /** 에러 여부 */
  readonly isError: boolean;
  /** 추가 메타데이터(선택사항) */
  readonly metadata?: Readonly<Record<string, unknown>>;
}

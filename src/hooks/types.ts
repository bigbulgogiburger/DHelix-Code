/**
 * 훅(Hooks) 타입 정의 — 라이프사이클 이벤트에 사용자 정의 로직을 연결하는 시스템
 *
 * 훅은 에이전트 실행 과정의 특정 시점(예: 도구 실행 전/후, 세션 시작 등)에
 * 커스텀 핸들러를 실행할 수 있게 합니다.
 *
 * 핸들러 종류:
 * - command: 셸 명령어를 실행 (예: 린트, 테스트)
 * - http: URL로 HTTP POST 요청을 전송
 * - prompt: 사용자에게 확인 프롬프트 표시
 * - agent: 선언적 유효성 검사 표현식(validator)으로 페이로드 검증
 *
 * 설정 위치: .dbcode/settings.json의 "hooks" 키
 *
 * @example
 * // settings.json 예시
 * {
 *   "hooks": {
 *     "PostToolUse": [{
 *       "matcher": "file_edit|file_write",
 *       "hooks": [{ "type": "command", "command": "npx eslint --fix $FILE_PATH" }]
 *     }]
 *   }
 * }
 */

import { type ExtractedToolCall, type ToolResult } from "../tools/types.js";

/**
 * 모든 훅 이벤트 이름 (17개).
 * 각 이벤트는 에이전트 라이프사이클의 특정 시점에 발생합니다.
 *
 * - SessionStart: 세션 시작 시
 * - UserPromptSubmit: 사용자 프롬프트 제출 시
 * - PreToolUse: 도구 실행 직전 (차단 가능)
 * - PermissionRequest: 권한 요청 시
 * - PostToolUse: 도구 실행 성공 직후
 * - PostToolUseFailure: 도구 실행 실패 직후
 * - Notification: 알림 발생 시
 * - SubagentStart/Stop: 서브 에이전트 시작/중지 시
 * - Stop: 에이전트 루프 정지 시
 * - TeammateIdle: 팀 멤버가 유휴 상태가 될 때
 * - TaskCompleted: 작업 완료 시
 * - ConfigChange: 설정 변경 시
 * - PreCompact: 컨텍스트 압축 직전
 * - InstructionsLoaded: 지시사항(Instructions) 로드 완료 시
 * - WorktreeCreate/Remove: 워크트리 생성/삭제 시
 */
export type HookEvent =
  | "SessionStart"
  | "UserPromptSubmit"
  | "PreToolUse"
  | "PermissionRequest"
  | "PostToolUse"
  | "PostToolUseFailure"
  | "Notification"
  | "SubagentStart"
  | "SubagentStop"
  | "Stop"
  | "TeammateIdle"
  | "TaskCompleted"
  | "ConfigChange"
  | "PreCompact"
  | "InstructionsLoaded"
  | "WorktreeCreate"
  | "WorktreeRemove";

/** 유효한 훅 이벤트 이름 배열 — 설정 파일 검증(validation)에 사용 */
export const HOOK_EVENTS: readonly HookEvent[] = [
  "SessionStart",
  "UserPromptSubmit",
  "PreToolUse",
  "PermissionRequest",
  "PostToolUse",
  "PostToolUseFailure",
  "Notification",
  "SubagentStart",
  "SubagentStop",
  "Stop",
  "TeammateIdle",
  "TaskCompleted",
  "ConfigChange",
  "PreCompact",
  "InstructionsLoaded",
  "WorktreeCreate",
  "WorktreeRemove",
] as const;

/**
 * 핸들러 타입 구분자.
 * - command: 셸 명령어 실행
 * - http: HTTP POST 요청
 * - prompt: 사용자 확인 프롬프트
 * - agent: 선언적 유효성 검사
 */
export type HookHandlerType = "command" | "http" | "prompt" | "agent";

/**
 * 기본 핸들러 인터페이스 — 모든 핸들러 타입이 공유하는 공통 필드
 */
interface BaseHookHandler {
  /** 핸들러 타입 (command, http, prompt, agent 중 하나) */
  readonly type: HookHandlerType;
  /** 핸들러 실행 타임아웃 (밀리초, 기본값: 30000 = 30초) */
  readonly timeoutMs?: number;
  /** true이면 이 핸들러의 실패가 원래 작업을 차단합니다 (기본값: false) */
  readonly blocking?: boolean;
}

/**
 * 셸 명령어 핸들러 — 셸 명령을 실행합니다.
 *
 * @example
 * { type: "command", command: "npx eslint --fix $FILE_PATH", blocking: true }
 */
export interface CommandHookHandler extends BaseHookHandler {
  readonly type: "command";
  /** 실행할 셸 명령어. 변수 보간(interpolation)을 지원합니다 (예: $FILE_PATH, $TOOL_NAME) */
  readonly command: string;
}

/**
 * HTTP 핸들러 — 이벤트 페이로드를 JSON으로 POST 전송합니다.
 *
 * @example
 * { type: "http", url: "https://webhook.example.com/hook", blocking: false }
 */
export interface HttpHookHandler extends BaseHookHandler {
  readonly type: "http";
  /** 이벤트 페이로드를 POST할 URL */
  readonly url: string;
  /** 추가 HTTP 헤더 (선택적) */
  readonly headers?: Readonly<Record<string, string>>;
}

/**
 * 프롬프트 핸들러 — 사용자에게 확인(confirmation) 프롬프트를 표시합니다.
 *
 * CI 환경에서는 DBCODE_HOOK_AUTO_APPROVE=true로 자동 승인할 수 있습니다.
 */
export interface PromptHookHandler extends BaseHookHandler {
  readonly type: "prompt";
  /** 프롬프트 템플릿 (변수 보간 지원) */
  readonly prompt: string;
  /** 사용자에게 표시할 확인 메시지 */
  readonly promptMessage: string;
  /** 프롬프트 응답 대기 타임아웃 (초 단위, 기본값: 30) */
  readonly timeout?: number;
  /** 평가에 사용할 모델 (기본값: 현재 모델) */
  readonly model?: string;
}

/**
 * 에이전트 핸들러 — 선언적 유효성 검사 표현식으로 페이로드를 검증합니다.
 * eval()을 사용하지 않고, 안전한 표현식 파싱으로 구현됩니다.
 *
 * @example
 * {
 *   type: "agent",
 *   prompt: "파일 삭제 검증",
 *   validator: "payload.toolCall?.name !== 'file_delete'",
 *   description: "위험한 파일 삭제 방지"
 * }
 */
export interface AgentHookHandler extends BaseHookHandler {
  readonly type: "agent";
  /** 서브 에이전트에게 전달할 프롬프트 */
  readonly prompt: string;
  /** 페이로드를 검증하는 JavaScript 유사 표현식 (안전하게 파싱됨, eval 미사용) */
  readonly validator: string;
  /** 이 유효성 검사기가 무엇을 확인하는지에 대한 사람이 읽을 수 있는 설명 */
  readonly description: string;
  /** 서브 에이전트가 사용 가능한 도구 목록 */
  readonly allowedTools?: readonly string[];
  /** 사용할 모델 (기본값: 현재 모델) */
  readonly model?: string;
}

/** 모든 훅 핸들러 타입의 유니온(union) 타입 */
export type HookHandler =
  | CommandHookHandler
  | HttpHookHandler
  | PromptHookHandler
  | AgentHookHandler;

/**
 * 훅 규칙(rule) — 매칭 패턴과 실행할 핸들러 목록의 조합.
 *
 * matcher가 설정되면 도구 이름 등과 대조하여 일치할 때만 핸들러가 실행됩니다.
 * matcher가 없으면 해당 이벤트의 모든 경우에 실행됩니다.
 */
export interface HookRule {
  /** 도구 이름 등을 매칭하는 글로브(glob) 패턴 (파이프(|)로 여러 패턴 구분, 예: "file_edit|file_write") */
  readonly matcher?: string;
  /** 규칙이 매칭될 때 실행할 핸들러 목록 */
  readonly hooks: readonly HookHandler[];
}

/**
 * 훅 설정 — 이벤트 이름별로 규칙 배열을 매핑합니다.
 * Partial이므로 모든 이벤트에 대한 설정이 필수는 아닙니다.
 */
export type HookConfig = Partial<Record<HookEvent, readonly HookRule[]>>;

/**
 * 이벤트 페이로드 — 훅 핸들러에 전달되는 이벤트 데이터
 */
export interface HookEventPayload {
  /** 이 훅을 트리거한 이벤트 이름 */
  readonly event: HookEvent;
  /** 현재 세션 ID */
  readonly sessionId?: string;
  /** 작업 디렉토리 경로 */
  readonly workingDirectory?: string;
  /** 도구 호출 정보 (도구 관련 이벤트에서 제공) */
  readonly toolCall?: ExtractedToolCall;
  /** 도구 실행 결과 (PostToolUse/PostToolUseFailure에서 제공) */
  readonly toolResult?: ToolResult;
  /** 영향받는 파일 경로 (파일 관련 작업에서 제공) */
  readonly filePath?: string;
  /** 이벤트별 추가 데이터 (유연한 확장용) */
  readonly data?: Readonly<Record<string, unknown>>;
}

/**
 * 훅 핸들러 실행 결과
 *
 * exitCode 의미:
 * - 0: 통과(pass) — 작업 계속 진행
 * - 2: 차단(block) — 작업을 중단해야 함
 * - 기타: 에러 발생 — 핸들러 실행 실패
 */
export interface HookHandlerResult {
  /** 종료 코드: 0 = 통과, 2 = 차단, 기타 = 에러 */
  readonly exitCode: number;
  /** stdout 출력 (컨텍스트에 주입될 수 있음) */
  readonly stdout: string;
  /** stderr 출력 */
  readonly stderr: string;
  /** 이 핸들러가 작업을 차단하는지 여부 */
  readonly blocked: boolean;
  /** 이 결과를 생성한 핸들러의 타입 */
  readonly handlerType: HookHandlerType;
}

/**
 * 전체 훅 실행 결과 — 하나의 이벤트에 대한 모든 핸들러의 통합 결과
 */
export interface HookRunResult {
  /** 하나 이상의 핸들러가 작업을 차단했는지 여부 */
  readonly blocked: boolean;
  /** 차단 이유 (첫 번째 차단 핸들러의 stdout에서 추출) */
  readonly blockReason?: string;
  /** 모든 개별 핸들러의 실행 결과 */
  readonly results: readonly HookHandlerResult[];
  /** 모든 핸들러의 stdout을 합친 문자열 (컨텍스트 주입용) */
  readonly contextOutput: string;
}

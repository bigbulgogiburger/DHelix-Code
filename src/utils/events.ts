/**
 * 이벤트 시스템 — mitt 기반 타입 안전 이벤트 에미터(event emitter)
 *
 * 앱 전체에서 사용하는 이벤트 타입을 정의하고, 타입 안전한 이벤트 발행/구독을 제공합니다.
 * mitt는 작고 빠른 이벤트 라이브러리로, Node.js의 EventEmitter보다 가볍습니다.
 *
 * 주요 이벤트 카테고리:
 * - llm:* — LLM(대규모 언어 모델) 스트리밍 관련 이벤트
 * - agent:* — 에이전트 루프 라이프사이클 이벤트
 * - tool:* — 도구 실행 관련 이벤트
 * - context:* — 컨텍스트 관리 이벤트
 * - conversation:* — 대화 상태 변경 이벤트
 * - input:* — 사용자 입력 이벤트
 * - lint:* — 자동 린트 요청 이벤트
 * - checkpoint:* — 파일 체크포인트 이벤트
 * - voice:* — 음성 입력 이벤트
 * - permission:* — 권한 모드 변경 이벤트
 *
 * @example
 * const events = createEventEmitter();
 * events.on("tool:start", ({ name }) => console.log(`도구 실행 시작: ${name}`));
 * events.emit("tool:start", { name: "file_read", id: "123" });
 */

import mitt from "mitt";

/**
 * 기본 임계값 — 단일 이벤트 타입에 이 수 이상의 리스너가 등록되면 메모리 누수 경고를 출력합니다.
 * Node.js의 EventEmitter.defaultMaxListeners(기본 10)보다 여유롭게 설정되어 있습니다.
 */
export const LISTENER_WARN_THRESHOLD = 20;

/**
 * 앱 전체 이벤트 타입 정의.
 * Record<이벤트명, 페이로드 타입> 형태로 모든 이벤트를 엄격하게 타이핑합니다.
 * 새로운 이벤트를 추가하려면 여기에 타입을 정의하세요.
 */
export type AppEvents = {
  /** LLM 스트리밍이 시작됨 */
  "llm:start": { iteration: number };
  /** LLM 텍스트 델타(부분 응답) 수신 — 스트리밍 중 실시간으로 발생 */
  "llm:text-delta": { text: string };
  /** LLM 도구 호출 델타 수신 — 스트리밍 중 도구 호출 데이터 조각 */
  "llm:tool-delta": { toolName: string; args: string };
  /** LLM 스트리밍 완료 */
  "llm:complete": { tokenCount: number };
  /** LLM 토큰 사용량 보고 — stream_options.include_usage를 통해 수신 */
  "llm:usage": {
    usage: {
      readonly promptTokens: number; // 프롬프트(입력) 토큰 수
      readonly completionTokens: number; // 응답(출력) 토큰 수
      readonly totalTokens: number; // 총 토큰 수
    };
    model: string; // 사용된 모델명
  };
  /** LLM Extended Thinking 사고 델타 — 사고 내용이 스트리밍될 때 실시간으로 발생 */
  "llm:thinking-delta": { text: string };
  /** LLM 스트리밍 중 에러 발생 */
  "llm:error": { error: Error };

  /** Anthropic 프롬프트 캐시 적중/미스 통계 (요청별) */
  "llm:cache-stats": {
    readonly cacheCreationInputTokens: number; // 캐시 생성에 사용된 토큰
    readonly cacheReadInputTokens: number; // 캐시에서 읽은 토큰
    readonly model: string;
  };

  /** 에이전트 루프 반복(iteration) 시작 */
  "agent:iteration": { iteration: number };
  /** 에이전트가 어시스턴트 메시지를 생성함 (중간 또는 최종) */
  "agent:assistant-message": {
    readonly content: string; // 메시지 내용
    readonly toolCalls: readonly { readonly id: string; readonly name: string }[]; // 호출한 도구 목록
    readonly iteration: number; // 현재 반복 번호
    readonly isFinal: boolean; // 최종 메시지 여부 (true면 에이전트 루프 종료)
  };

  /** 도구 실행 시작 */
  "tool:start": { name: string; id: string; args?: Record<string, unknown> };
  /** 도구 실행 완료 */
  "tool:complete": {
    name: string;
    id: string;
    isError: boolean; // 에러 발생 여부
    output?: string; // 도구 출력 결과
    metadata?: Readonly<Record<string, unknown>>; // 추가 메타데이터
  };

  /** 컨텍스트 압축(compaction)이 시작되기 직전 — 토큰 절약을 위해 대화 내용을 요약할 때 */
  "context:pre-compact": { compactionNumber: number };

  /** 대화에 메시지가 추가됨 */
  "conversation:message": { role: string };
  /** 대화가 초기화(clear)됨 */
  "conversation:clear": undefined;

  /** 사용자가 입력을 제출함 */
  "input:submit": { content: string };
  /** 사용자가 중단(abort)을 요청함 (Esc 키 등) */
  "input:abort": undefined;

  /** 파일 수정 후 자동 린트(auto-lint) 요청 */
  "lint:request": {
    toolName: string; // 파일을 수정한 도구 이름 (예: "file_edit")
    toolId: string;
    lintCommand: string; // 실행할 린트 명령어
    testCommand?: string; // 실행할 테스트 명령어 (선택적)
  };

  /** 파일 수정 도구 실행 후 체크포인트가 생성됨 — /rewind로 복원 가능 */
  "checkpoint:created": {
    checkpointId: string;
    description: string;
    fileCount: number; // 체크포인트에 포함된 파일 수
  };
  /** /rewind 명령으로 체크포인트가 복원됨 */
  "checkpoint:restored": {
    checkpointId: string;
    restoredFiles: number; // 복원된 파일 수
    skippedFiles: number; // 건너뛴 파일 수
  };

  /** 에이전트 루프 사용량 업데이트 — 각 LLM 호출 후 누적 토큰 수 */
  "agent:usage-update": {
    readonly promptTokens: number;
    readonly completionTokens: number;
    readonly totalTokens: number;
    readonly iteration: number;
  };

  /** 에이전트 루프 전체 완료 — 최종 요약 정보 */
  "agent:complete": {
    readonly iterations: number; // 총 반복 횟수
    readonly totalTokens: number; // 사용된 총 토큰 수
    readonly toolCallCount: number; // 실행된 도구 호출 횟수
    readonly aborted: boolean; // 사용자에 의해 중단되었는지 여부
    readonly reason?: "completed" | "aborted" | "max-iterations" | "circuit-breaker"; // 종료 사유
  };

  /** 음성 입력 토글 (/voice 명령으로 전환) */
  "voice:toggle": { enabled: boolean };

  /** 권한 모드 변경 (/plan 등의 명령으로 전환) */
  "permission:mode-change": { mode: string };

  /** 도구 출력 스트리밍 델타 — bash 같은 장시간 실행 도구의 실시간 출력 */
  "tool:output-delta": { id: string; name: string; chunk: string };

  /** ask_user 도구가 사용자에게 질문을 보냄 — UI에서 입력 프롬프트를 표시해야 함 */
  "ask_user:prompt": {
    readonly toolCallId: string;
    readonly question: string;
    readonly choices?: readonly string[];
  };
  /** 사용자가 ask_user 질문에 응답함 — 도구 실행이 완료됨 */
  "ask_user:response": {
    readonly toolCallId: string;
    readonly answer: string;
  };

  /** 에이전트 루프가 재시도 대기 중 — UI에서 카운트다운을 표시해야 함 */
  "agent:retry": {
    readonly delayMs: number;
    readonly reason: string;
    readonly attempt: number;
    readonly maxRetries: number;
  };

  /** 도구 그룹 실행이 시작됨 — UI에서 "도구 실행 중" 상태를 표시 */
  "agent:tools-executing": {
    readonly toolNames: readonly string[];
    readonly count: number;
  };
  /** 모든 도구 그룹 실행이 완료됨 — UI에서 "생각 중..." 상태로 전환 */
  "agent:tools-done": {
    readonly count: number;
    readonly nextAction: string;
  };
};

/**
 * 타입 안전한 앱 이벤트 에미터 타입.
 * mitt<AppEvents>를 사용하여 이벤트명과 페이로드 타입을 자동으로 검증합니다.
 */
export type AppEventEmitter = ReturnType<typeof mitt<AppEvents>>;

/**
 * 모든 이벤트 타입의 리스너 수를 검사하여 메모리 누수를 감지합니다.
 *
 * 특정 이벤트 타입에 리스너가 너무 많이 등록되면(기본 20개 초과)
 * stderr에 경고 메시지를 출력합니다. 이는 리스너 해제(off)를 빠뜨렸을 때
 * 메모리 누수를 조기에 발견하기 위한 안전장치입니다.
 *
 * @param emitter - 검사할 이벤트 에미터
 * @param threshold - 경고 기준값 (기본값: LISTENER_WARN_THRESHOLD = 20)
 * @returns 가장 많은 리스너를 가진 이벤트 타입의 리스너 수 (테스트에 유용)
 */
export function checkListenerLeaks(
  emitter: AppEventEmitter,
  threshold: number = LISTENER_WARN_THRESHOLD,
): number {
  let maxCount = 0;
  // emitter.all은 모든 이벤트 타입과 핸들러 배열의 Map
  for (const [eventType, handlers] of emitter.all) {
    const count = handlers?.length ?? 0;
    if (count > maxCount) maxCount = count;
    if (count > threshold) {
      process.stderr.write(
        `[events] Warning: "${String(eventType)}" has ${count} listeners (threshold: ${threshold}). Possible memory leak.\n`,
      );
    }
  }
  return maxCount;
}

/**
 * 새로운 타입 안전 이벤트 에미터를 생성합니다.
 * 앱 전체에서 하나의 에미터를 공유하여 느슨한 결합(loose coupling)을 달성합니다.
 *
 * @returns AppEventEmitter 인스턴스
 *
 * @example
 * const events = createEventEmitter();
 * events.on("llm:complete", ({ tokenCount }) => {
 *   console.log(`토큰 ${tokenCount}개 사용`);
 * });
 */
export function createEventEmitter(): AppEventEmitter {
  return mitt<AppEvents>();
}

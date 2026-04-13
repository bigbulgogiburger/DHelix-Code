/**
 * screen-reader.ts — 스크린 리더 친화적 텍스트 생성 유틸리티
 *
 * ANSI 이스케이프 시퀀스를 제거하고, ARIA 어노테이션을 적용하며,
 * 진행 상황·시간·상태를 접근성 친화적 텍스트로 포매팅합니다.
 *
 * 사용 방법:
 * - annotateForScreenReader(content, annotation): ARIA 어노테이션 적용
 * - stripAnsi(text): ANSI 이스케이프 제거
 * - formatProgress(current, total): "3 of 10 complete" 형식으로 변환
 * - formatDuration(ms): "2 minutes 30 seconds" 형식으로 변환
 * - formatStatus(status): "Status: running" 형식으로 변환
 */

/** ARIA 라이브 리전 역할 */
export type AriaRole = "status" | "log" | "alert" | "progressbar";
/** ARIA 라이브 리전 정중도 수준 */
export type AriaLive = "polite" | "assertive" | "off";

/**
 * ARIA 어노테이션 — 스크린 리더에 전달할 접근성 메타데이터
 */
export interface AriaAnnotation {
  /** ARIA role: "status", "log", "alert", "progressbar" */
  readonly role: AriaRole;
  /** 컨텐츠를 설명하는 레이블 */
  readonly label: string;
  /** 라이브 업데이트 정중도 — 생략 시 role 기본값 사용 */
  readonly live?: AriaLive;
  /** 현재 값 (progressbar 등에 사용) */
  readonly value?: string;
}

/** ANSI 이스케이프 시퀀스 — 색상, 커서 이동, 스타일 등 */
const ANSI_ESCAPE_PATTERN =
  // eslint-disable-next-line no-control-regex
  /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;

/**
 * 텍스트에서 ANSI 이스케이프 시퀀스를 모두 제거합니다.
 * 스크린 리더는 ANSI 코드를 음성으로 읽으므로 반드시 제거해야 합니다.
 * @param text - ANSI 시퀀스를 포함할 수 있는 원본 텍스트
 * @returns ANSI 시퀀스가 제거된 순수 텍스트
 */
export function stripAnsi(text: string): string {
  return text.replace(ANSI_ESCAPE_PATTERN, "");
}

/**
 * 콘텐츠에 ARIA 어노테이션을 적용하여 스크린 리더 친화적 텍스트를 생성합니다.
 * ANSI 이스케이프를 자동으로 제거하고, 구조화된 텍스트를 반환합니다.
 * @param content - 원본 콘텐츠 (ANSI 시퀀스 포함 가능)
 * @param annotation - ARIA 어노테이션 메타데이터
 * @returns 스크린 리더가 읽기 쉬운 포매팅된 텍스트
 */
export function annotateForScreenReader(content: string, annotation: AriaAnnotation): string {
  const plain = stripAnsi(content);
  const liveLevel = annotation.live ?? getDefaultLive(annotation.role);
  const parts: string[] = [];

  parts.push(`[${annotation.role.toUpperCase()}]`);
  parts.push(`Label: ${annotation.label}`);

  if (liveLevel !== "off") {
    parts.push(`Live: ${liveLevel}`);
  }

  if (annotation.value !== undefined) {
    parts.push(`Value: ${annotation.value}`);
  }

  parts.push(plain);

  return parts.join(" | ");
}

/**
 * role에 따른 기본 live 값을 반환합니다.
 * @param role - ARIA role
 * @returns 해당 role의 ARIA 권장 live 값
 */
function getDefaultLive(role: AriaRole): AriaLive {
  switch (role) {
    case "alert":
      return "assertive";
    case "status":
    case "log":
    case "progressbar":
      return "polite";
    default:
      return "polite";
  }
}

/**
 * 현재 진행 수치를 스크린 리더 친화적 텍스트로 변환합니다.
 * @param current - 현재 진행 수 (0 이상)
 * @param total - 전체 수 (current 이상)
 * @returns "3 of 10 complete" 형식의 문자열
 * @throws current가 음수이거나 total보다 클 경우 에러
 */
export function formatProgress(current: number, total: number): string {
  if (current < 0 || total < 0) {
    throw new Error("current와 total은 0 이상이어야 합니다.");
  }
  if (current > total) {
    throw new Error("current는 total보다 클 수 없습니다.");
  }
  if (total === 0) {
    return "0 of 0 complete";
  }
  return `${current} of ${total} complete`;
}

/**
 * 밀리초 단위 시간을 사람이 읽기 쉬운 텍스트로 변환합니다.
 * @param ms - 밀리초 단위 시간 (0 이상)
 * @returns "2 minutes 30 seconds", "45 seconds", "1 hour 2 minutes" 형식의 문자열
 */
export function formatDuration(ms: number): string {
  if (ms < 0) {
    throw new Error("ms는 0 이상이어야 합니다.");
  }

  const totalSeconds = Math.floor(ms / 1000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);

  const parts: string[] = [];

  if (hours > 0) {
    parts.push(`${hours} ${hours === 1 ? "hour" : "hours"}`);
  }
  if (minutes > 0) {
    parts.push(`${minutes} ${minutes === 1 ? "minute" : "minutes"}`);
  }
  if (seconds > 0 || parts.length === 0) {
    parts.push(`${seconds} ${seconds === 1 ? "second" : "seconds"}`);
  }

  return parts.join(" ");
}

/**
 * 상태 문자열을 스크린 리더 친화적 "Status: <value>" 형식으로 변환합니다.
 * @param status - 상태값 문자열 (예: "running", "complete", "error")
 * @returns "Status: running" 형식의 문자열
 */
export function formatStatus(status: string): string {
  const plain = stripAnsi(status).trim();
  return `Status: ${plain}`;
}

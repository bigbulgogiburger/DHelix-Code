/**
 * 관측 마스킹(Observation Masking) 모듈
 *
 * JetBrains Research의 관측 마스킹 기법을 구현합니다.
 * 대화 히스토리에서 "다시 얻을 수 있는(re-readable)" 도구 출력을 마스킹하여
 * 토큰 사용량을 줄입니다.
 *
 * 주니어 개발자를 위한 설명:
 * - LLM에게 보내는 대화 히스토리가 길어지면 토큰 비용이 증가합니다
 * - 파일 읽기, 검색 결과 등은 다시 실행하면 같은 결과를 얻을 수 있습니다
 * - 이런 "재현 가능한" 도구 출력을 짧은 플레이스홀더로 교체합니다
 * - 하지만 파일 수정(edit/write) 결과는 변이 기록이므로 절대 마스킹하지 않습니다
 * - 최근 N개의 도구 출력은 즉각적인 컨텍스트 유지를 위해 마스킹하지 않습니다
 *
 * 마스킹 대상 (환경에서 다시 읽을 수 있는 것들):
 * - file_read 결과
 * - grep_search 결과
 * - glob_search 결과
 * - bash_exec 출력 (읽기 전용 명령어만)
 *
 * 마스킹 제외 (다시 얻을 수 없는 것들):
 * - 어시스턴트의 추론/응답 텍스트
 * - 사용자 메시지
 * - 도구 호출 기록 (무엇을 호출했는지)
 * - file_edit/file_write 결과 (변이 기록)
 */
import { type ChatMessage } from "../llm/provider.js";

/** 읽기 전용이어서 환경에서 다시 얻을 수 있는 도구 이름 목록 */
const READ_ONLY_TOOL_NAMES = new Set(["file_read", "grep_search", "glob_search", "bash_exec"]);

/**
 * 읽기 전용 bash 명령어의 출력 패턴들
 * 이 패턴에 매칭되는 bash 출력은 안전하게 마스킹할 수 있습니다
 */
const READ_ONLY_BASH_PATTERNS = [
  /^STDOUT:/, // 표준 출력으로 시작
  /^cat\s/, // 파일 내용 출력
  /^ls\s/, // 디렉토리 목록
  /^find\s/, // 파일 검색
  /^head\s/, // 파일 앞부분 출력
  /^tail\s/, // 파일 뒷부분 출력
  /^wc\s/, // 단어/줄 수 세기
  /^du\s/, // 디스크 사용량
  /^df\s/, // 파일 시스템 정보
  /^file\s/, // 파일 유형 확인
  /^stat\s/, // 파일 상태 정보
  /^which\s/, // 명령어 경로 찾기
  /^echo\s/, // 텍스트 출력
  /^pwd$/, // 현재 디렉토리 출력
  /^env$/, // 환경 변수 출력
  /^printenv/, // 환경 변수 출력
];

/** file_read 결과를 나타내는 콘텐츠 패턴 (줄 번호가 있는 출력) */
const FILE_READ_PATTERNS = [
  /^\s*\d+[│|]/, // "  1│내용" 형태
  /^\s+\d+\t/, // "  1\t내용" 형태
];

/** grep/glob 검색 결과를 나타내는 콘텐츠 패턴 */
const SEARCH_RESULT_PATTERNS = [
  /matches found/, // "N matches found"
  /No matches/, // "No matches"
  /files found/, // "N files found"
  /No files/, // "No files"
];

/**
 * 변이(mutation)를 나타내는 bash 출력 패턴들
 * 이 패턴이 감지되면 해당 출력은 절대 마스킹하지 않습니다
 * (파일 삭제, 이동 등의 기록은 보존해야 합니다)
 */
const MUTATION_BASH_PATTERNS = [
  /^STDERR:/, // 에러 출력
  /^Error:/, // 에러 메시지
  /\brm\s/, // 파일 삭제
  /\bmv\s/, // 파일 이동
  /\bcp\s/, // 파일 복사
  /\bmkdir\s/, // 디렉토리 생성
  /\bchmod\s/, // 권한 변경
  /\bchown\s/, // 소유자 변경
  /\bnpm\s+(install|run|exec)/, // npm 패키지 설치/실행
  /\bgit\s+(commit|push|merge|rebase|reset|checkout)/, // git 변이 명령
  /\bpip\s+install/, // Python 패키지 설치
];

/**
 * 관측이 마스킹되었을 때 삽입할 플레이스홀더 메시지를 생성합니다.
 *
 * @param originalSize - 원본 출력의 추정 토큰 수
 * @param toolName - 마스킹된 도구의 이름
 * @returns 원본 출력을 대체할 짧은 플레이스홀더 문자열
 */
function createMaskedPlaceholder(originalSize: number, toolName: string): string {
  return `[Observation masked — ${toolName} output (${originalSize} tokens). Re-read from environment if needed.]`;
}

/**
 * 메시지의 메타데이터 또는 콘텐츠 패턴으로부터 도구 이름을 추론합니다.
 *
 * 메시지에 name 필드가 있으면 그것을 사용하고,
 * 없으면 콘텐츠 패턴을 분석하여 어떤 도구의 출력인지 추측합니다.
 *
 * @param message - 도구 이름을 추론할 메시지
 * @returns 추론된 도구 이름 (알 수 없으면 "unknown")
 */
function detectToolName(message: ChatMessage): string {
  // 메시지에 도구 이름이 명시되어 있으면 그대로 사용
  if (message.name) return message.name;

  const content = typeof message.content === "string" ? message.content : "";

  // 콘텐츠 패턴으로 도구 추론
  if (
    content.startsWith("Error:") ||
    content.startsWith("STDOUT:") ||
    content.startsWith("STDERR:")
  ) {
    return "bash_exec";
  }
  for (const pattern of SEARCH_RESULT_PATTERNS) {
    if (pattern.test(content)) return "grep_search";
  }
  if (content.includes("files found") || content.includes("No files")) {
    return "glob_search";
  }
  for (const pattern of FILE_READ_PATTERNS) {
    if (pattern.test(content)) return "file_read";
  }
  return "unknown";
}

/**
 * bash_exec 출력이 읽기 전용 명령어의 결과인지 판별합니다.
 *
 * 변이(mutation) 패턴이 먼저 검사되어,
 * 파일 삭제/이동 등의 출력은 절대 읽기 전용으로 판정하지 않습니다.
 *
 * @param content - bash 실행 결과 텍스트
 * @returns 읽기 전용이면 true, 변이 가능성이 있으면 false
 */
function isBashReadOnly(content: string): boolean {
  // 변이 패턴이 감지되면 읽기 전용이 아님
  for (const pattern of MUTATION_BASH_PATTERNS) {
    if (pattern.test(content)) return false;
  }
  // 읽기 전용 패턴이 감지되면 읽기 전용
  for (const pattern of READ_ONLY_BASH_PATTERNS) {
    if (pattern.test(content)) return true;
  }
  // STDOUT:으로 시작하는 결과는 기본적으로 읽기 전용으로 취급
  if (content.startsWith("STDOUT:")) return true;
  return false;
}

/**
 * 주어진 메시지가 안전하게 마스킹할 수 있는 읽기 전용 도구 출력인지 판별합니다.
 *
 * 다음 조건을 모두 만족해야 true를 반환합니다:
 * 1. role이 "tool"인 메시지
 * 2. 변이 도구(file_edit, file_write)가 아닌 것
 * 3. 알려진 읽기 전용 도구(file_read, grep_search, glob_search, bash_exec) 중 하나
 * 4. bash_exec인 경우 추가로 읽기 전용 명령어인지 확인
 *
 * @param message - 판별할 메시지
 * @returns 마스킹 가능하면 true
 */
export function isReadOnlyToolOutput(message: ChatMessage): boolean {
  // 도구 메시지가 아니면 마스킹 불가
  if (message.role !== "tool") return false;

  const toolName = detectToolName(message);

  // 변이 도구는 절대 마스킹하지 않음 (수정 기록은 보존해야 함)
  if (toolName === "file_edit" || toolName === "file_write") return false;

  // 알 수 없는 도구는 안전하지 않으므로 마스킹하지 않음
  if (!READ_ONLY_TOOL_NAMES.has(toolName)) return false;

  // bash_exec는 읽기 전용 명령어인지 추가 확인 필요
  if (toolName === "bash_exec") {
    const content = typeof message.content === "string" ? message.content : "";
    return isBashReadOnly(content);
  }

  // file_read, grep_search, glob_search는 항상 다시 읽을 수 있음
  return true;
}

/**
 * 메시지 콘텐츠의 대략적인 토큰 수를 계산합니다.
 * 영어 기준으로 약 4글자 = 1토큰이라는 간단한 휴리스틱을 사용합니다.
 *
 * @param message - 토큰 수를 계산할 메시지
 * @returns 추정 토큰 수
 */
export function getOutputSize(message: ChatMessage): number {
  const content = typeof message.content === "string" ? message.content : "";
  return Math.ceil(content.length / 4);
}

/**
 * 메시지 히스토리에 관측 마스킹을 적용합니다.
 *
 * 재현 가능한(다시 얻을 수 있는) 도구 출력을 짧은 플레이스홀더로 교체하여
 * 토큰 사용량을 절약합니다.
 * 최근 N개의 도구 출력은 즉각적인 컨텍스트 유지를 위해 마스킹하지 않습니다.
 *
 * 원본 메시지 배열은 절대 변경하지 않고 새 배열을 반환합니다 (불변성 보장).
 *
 * @param messages - 전체 메시지 히스토리 (변경되지 않음)
 * @param options - 설정 옵션:
 *   - keepRecentN: 마스킹하지 않고 유지할 최근 도구 출력 수 (기본값: 3)
 * @returns 마스킹이 적용된 새 메시지 배열
 */
export function applyObservationMasking(
  messages: readonly ChatMessage[],
  options?: { readonly keepRecentN?: number },
): ChatMessage[] {
  const keepRecentN = options?.keepRecentN ?? 3;

  // 읽기 전용 도구 출력인 메시지의 인덱스를 수집
  const readOnlyIndices: number[] = [];
  for (let i = 0; i < messages.length; i++) {
    if (isReadOnlyToolOutput(messages[i])) {
      readOnlyIndices.push(i);
    }
  }

  // 마지막 keepRecentN개의 읽기 전용 출력은 마스킹에서 보호
  // 이 최근 출력들은 LLM이 직전 작업을 이해하는 데 필요합니다
  const protectedIndices = new Set(readOnlyIndices.slice(-keepRecentN));

  // 마스킹 적용: 보호되지 않은 읽기 전용 출력을 플레이스홀더로 교체
  const result: ChatMessage[] = [];
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    if (readOnlyIndices.includes(i) && !protectedIndices.has(i)) {
      // 마스킹 대상: 짧은 플레이스홀더로 교체
      const toolName = detectToolName(msg);
      const size = getOutputSize(msg);
      result.push({
        ...msg,
        content: createMaskedPlaceholder(size, toolName),
      });
    } else {
      // 마스킹 대상이 아님: 원본 메시지 유지 (복사본)
      result.push({ ...msg });
    }
  }

  return result;
}

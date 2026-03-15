/**
 * 탐색(Explore) 서브에이전트 스포너 — 코드베이스 조사를 위한 읽기 전용 서브에이전트 생성 모듈
 *
 * 서브에이전트(Subagent)란 메인 에이전트가 복잡한 작업을 분할하여
 * 별도의 에이전트에게 위임하는 패턴입니다.
 *
 * 이 모듈은 "탐색" 유형의 서브에이전트를 생성합니다.
 * 탐색 에이전트는 코드를 읽고 검색하는 것만 가능하며(읽기 전용),
 * 프로젝트 구조 파악, 의존성 추적, 코드에 대한 질문 답변 등에 사용됩니다.
 *
 * 예시: "이 프로젝트에서 인증 로직이 어디 있는지 조사해줘" 같은 요청을
 * 메인 에이전트가 탐색 서브에이전트에게 위임할 수 있습니다.
 */
import { type LLMProvider } from "../llm/provider.js";
import { type ToolCallStrategy } from "../llm/tool-call-strategy.js";
import { type ToolRegistry } from "../tools/registry.js";
import { type AppEventEmitter } from "../utils/events.js";
import { spawnSubagent, type SubagentResult } from "./spawner.js";

/**
 * 탐색에 안전한 도구 목록 (읽기 전용)
 * - file_read: 파일 내용 읽기
 * - glob_search: 파일명 패턴으로 파일 찾기 (예: "*.ts")
 * - grep_search: 파일 내용에서 텍스트 검색 (정규식 지원)
 */
const EXPLORE_ALLOWED_TOOLS = ["file_read", "glob_search", "grep_search"] as const;

/**
 * 탐색(Explore) 서브에이전트를 생성하여 코드베이스를 조사합니다.
 *
 * 탐색 에이전트는 읽기 전용 도구(file_read, glob_search, grep_search)만
 * 사용할 수 있어 코드 변경 없이 안전하게 조사를 수행합니다.
 *
 * @param options - 서브에이전트 생성에 필요한 설정 객체
 * @param options.prompt - 서브에이전트에게 전달할 작업 지시 (예: "src 디렉토리 구조를 분석해줘")
 * @param options.client - LLM API 클라이언트 (OpenAI 호환 인터페이스)
 * @param options.model - 사용할 AI 모델 식별자 (예: "claude-sonnet-4-5-20250514")
 * @param options.strategy - 도구 호출 전략 (LLM이 도구를 어떻게 호출할지 결정)
 * @param options.toolRegistry - 사용 가능한 도구들의 레지스트리(등록소)
 * @param options.workingDirectory - 작업 디렉토리 경로 (기본값: 현재 디렉토리)
 * @param options.maxIterations - 최대 반복 횟수 (기본값: 15, 무한루프 방지용)
 * @param options.signal - AbortSignal — 작업 취소를 위한 시그널 객체
 * @param options.parentEvents - 부모 에이전트의 이벤트 발행기 (진행 상황 알림용)
 * @returns 서브에이전트 실행 결과 (응답 텍스트, 반복 횟수, 메시지 히스토리 등)
 */
export async function spawnExploreAgent(options: {
  readonly prompt: string;
  readonly client: LLMProvider;
  readonly model: string;
  readonly strategy: ToolCallStrategy;
  readonly toolRegistry: ToolRegistry;
  readonly workingDirectory?: string;
  readonly maxIterations?: number;
  readonly signal?: AbortSignal;
  readonly parentEvents?: AppEventEmitter;
}): Promise<SubagentResult> {
  // spawner 모듈의 범용 생성 함수를 호출하되, 탐색 전용 설정을 적용
  return spawnSubagent({
    type: "explore",
    prompt: options.prompt,
    client: options.client,
    model: options.model,
    strategy: options.strategy,
    toolRegistry: options.toolRegistry,
    workingDirectory: options.workingDirectory,
    maxIterations: options.maxIterations ?? 15, // 탐색은 15회면 충분
    signal: options.signal,
    parentEvents: options.parentEvents,
    allowedTools: [...EXPLORE_ALLOWED_TOOLS], // 읽기 전용 도구만 허용
  });
}

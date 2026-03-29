/**
 * 에이전트 루프(Agent Loop) — 핵심 실행 엔진
 *
 * ReAct(Reasoning + Acting) 패턴을 구현하는 메인 루프입니다.
 * LLM에게 질문을 보내고, 응답에서 도구 호출을 추출하여 실행한 뒤,
 * 그 결과를 다시 LLM에게 전달하는 과정을 반복합니다.
 *
 * 주니어 개발자를 위한 설명:
 * - 에이전트 루프는 AI 코딩 어시스턴트의 "두뇌"입니다
 * - 사용자 질문 → LLM 응답 → 도구 실행 → 결과 피드백 → 다시 LLM 호출... 반복
 * - 도구 호출이 없으면 LLM이 최종 답변을 완성한 것이므로 루프를 종료합니다
 * - 에러가 나면 종류에 따라 재시도(transient), 즉시 실패(permanent) 등을 결정합니다
 * - 서킷 브레이커가 무한 루프를 방지합니다
 * - 컨텍스트 매니저가 토큰 사용량을 관리합니다
 *
 * 주요 기능:
 * - LLM 호출 (스트리밍/비스트리밍)
 * - 도구 호출 병렬 실행 (읽기 도구는 항상 병렬, 같은 파일 쓰기는 순차)
 * - 권한 검사 및 보안 가드레일
 * - 자동 체크포인트 (파일 수정 전 백업)
 * - 에러 분류 및 복구 전략 적용
 * - 도구 결과 크기 제한 (토큰/문자 기반 잘라내기)
 * - 이중 모델 라우팅 (architect/editor 패턴)
 */
import {
  type LLMProvider,
  type ChatMessage,
  type ChatResponse,
  type ThinkingConfig,
} from "../llm/provider.js";
import { type ToolCallStrategy } from "../llm/tool-call-strategy.js";
import { type ToolRegistry } from "../tools/registry.js";
import {
  type ExtractedToolCall,
  type ToolCallResult,
  type ToolDefinitionForLLM,
} from "../tools/types.js";
import { executeToolCall } from "../tools/executor.js";
import { consumeStream } from "../llm/streaming.js";
import { type AppEventEmitter } from "../utils/events.js";
import { AGENT_LOOP } from "../constants.js";
import { LLMError } from "../utils/error.js";
import { ContextManager } from "./context-manager.js";
import { type CheckpointManager } from "./checkpoint-manager.js";
import { applyInputGuardrails, applyOutputGuardrails } from "../guardrails/index.js";
import { countTokens } from "../llm/token-counter.js";
import { findRecoveryStrategy } from "./recovery-strategy.js";
import { executeRecovery, resetRetryState } from "./recovery-executor.js";
import { CircuitBreaker } from "./circuit-breaker.js";
import { applyObservationMasking } from "./observation-masking.js";
import { type DualModelRouter, detectPhase } from "../llm/dual-model-router.js";
import { getModelCapabilities } from "../llm/model-capabilities.js";

const trace = (tag: string, msg: string) => {
  if (process.env.DHELIX_VERBOSE) process.stderr.write(`[${tag}] ${msg}\n`);
};

/**
 * 에이전트 루프 설정
 *
 * 루프의 동작을 제어하는 모든 옵션을 담고 있습니다.
 * LLM 클라이언트, 도구 레지스트리, 이벤트 이미터 등 필수 의존성과
 * 최대 반복 횟수, 토큰 제한 등 선택적 설정을 포함합니다.
 */
export interface AgentLoopConfig {
  /** LLM API 클라이언트 (OpenAI, Anthropic 등) */
  readonly client: LLMProvider;
  /** 사용할 LLM 모델명 (예: "gpt-4", "claude-3") */
  readonly model: string;
  /** 등록된 도구 목록을 관리하는 레지스트리 */
  readonly toolRegistry: ToolRegistry;
  /** 도구 호출 전략 (네이티브 함수 호출 / 텍스트 파싱) */
  readonly strategy: ToolCallStrategy;
  /** 이벤트 이미터 — UI에 진행 상황을 알리는 데 사용 */
  readonly events: AppEventEmitter;
  /** 최대 반복 횟수 (기본값: constants.ts의 AGENT_LOOP.maxIterations) */
  readonly maxIterations?: number;
  /** LLM 응답의 창의성 수준 (0 = 결정적, 1 = 창의적) */
  readonly temperature?: number;
  /** LLM 응답의 최대 토큰 수 */
  readonly maxTokens?: number;
  /** 취소 신호 — 사용자가 Esc를 누르면 전파됨 */
  readonly signal?: AbortSignal;
  /** 작업 디렉토리 경로 */
  readonly workingDirectory?: string;
  /** 도구 호출 전 권한 확인 콜백 (사용자에게 승인 요청) */
  readonly checkPermission?: (call: ExtractedToolCall) => Promise<PermissionResult>;
  /** Maximum LLM call retries per iteration (default: 2) */
  readonly maxRetries?: number;
  /** Use streaming for LLM calls (emits text deltas via events) */
  readonly useStreaming?: boolean;
  /** Maximum tokens for the context window (enables auto-compaction) */
  readonly maxContextTokens?: number;
  /** Maximum characters per individual tool result (default: 12000) */
  readonly maxToolResultChars?: number;
  /** Maximum tokens per individual tool result (overrides maxToolResultChars when set) */
  readonly maxToolResultTokens?: number;
  /** Enable security guardrails for tool calls (default: true) */
  readonly enableGuardrails?: boolean;
  /** Checkpoint manager for auto-checkpointing file mutations */
  readonly checkpointManager?: CheckpointManager;
  /** Session ID for checkpoint metadata */
  readonly sessionId?: string;
  /** Extended thinking configuration (for Claude models) */
  readonly thinking?: ThinkingConfig;
  /** Dual-model router for architect/editor pattern (optional) */
  readonly dualModelRouter?: DualModelRouter;
  /** Whether this agent loop is running as a subagent (for retry behavior) */
  readonly isSubagent?: boolean;
}

/**
 * 권한 확인 결과
 *
 * @property allowed - 도구 실행이 허용되었는지 여부
 * @property reason - 거부 시 거부 사유
 */
export interface PermissionResult {
  readonly allowed: boolean;
  readonly reason?: string;
}

/**
 * 에이전트 루프 전체 실행에 걸쳐 누적된 토큰 사용량 통계
 *
 * @property totalPromptTokens - 전체 입력(프롬프트) 토큰 수
 * @property totalCompletionTokens - 전체 출력(응답) 토큰 수
 * @property totalTokens - 전체 토큰 수 (입력 + 출력)
 * @property iterationCount - 루프 반복 횟수
 * @property toolCallCount - 실행된 도구 호출 총 수
 * @property retriedCount - 재시도 횟수
 */
export interface AggregatedUsage {
  readonly totalPromptTokens: number;
  readonly totalCompletionTokens: number;
  readonly totalTokens: number;
  readonly iterationCount: number;
  readonly toolCallCount: number;
  readonly retriedCount: number;
}

/**
 * 에이전트 루프 실행 결과
 *
 * @property messages - 전체 대화 메시지 배열 (입력 + 생성된 메시지 포함)
 * @property iterations - 실행된 반복 횟수
 * @property aborted - 사용자에 의해 중단되었는지 여부
 * @property usage - 토큰 사용량 통계
 */
export interface AgentLoopResult {
  readonly messages: readonly ChatMessage[];
  readonly iterations: number;
  readonly aborted: boolean;
  readonly usage?: AggregatedUsage;
}

/**
 * LLM 에러 분류 — 재시도 전략을 결정하는 데 사용
 *
 * - "transient": 일시적 에러 (타임아웃, 네트워크 문제) → 재시도 가능
 * - "overload": 과부하 에러 (429, 503) → 클라이언트가 이미 Retry-After로 재시도했으므로 추가 재시도 안 함
 * - "permanent": 영구적 에러 (잘못된 요청) → 재시도해도 소용없음
 */
type LLMErrorClass = "transient" | "overload" | "permanent";

/**
 * LLM 에러를 분류하여 재시도 전략을 결정합니다.
 * 에러 메시지의 키워드를 분석하여 에러 유형을 판별합니다.
 *
 * @param error - 발생한 에러
 * @returns 에러 분류 ("transient" | "overload" | "permanent")
 */
function classifyLLMError(error: unknown): LLMErrorClass {
  if (!(error instanceof Error)) return "permanent";

  const message = error.message.toLowerCase();

  // "Request too large" is permanent — retrying the same payload won't help
  if (message.includes("request too large") || message.includes("too many tokens")) {
    return "permanent";
  }

  if (
    message.includes("rate limit") ||
    message.includes("429") ||
    message.includes("overload") ||
    message.includes("503") ||
    message.includes("capacity")
  ) {
    return "overload";
  }

  if (
    message.includes("timeout") ||
    message.includes("econnreset") ||
    message.includes("econnrefused") ||
    message.includes("500") ||
    message.includes("502") ||
    message.includes("504") ||
    message.includes("network")
  ) {
    return "transient";
  }

  return "permanent";
}

/**
 * AbortSignal을 존중하면서 지정된 시간만큼 대기합니다.
 * 사용자가 Esc를 누르면 즉시 중단됩니다.
 *
 * @param ms - 대기할 밀리초
 * @param signal - 취소 신호 (선택사항)
 */
function waitWithAbort(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new LLMError("Aborted"));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new LLMError("Aborted"));
    });
  });
}

/**
 * 에이전트 루프 반복 간 누적 토큰 사용량과 실행 메트릭을 추적합니다.
 *
 * 내부 상태는 성능을 위해 가변(mutable)이지만,
 * 외부에는 snapshot()을 통해 불변 스냅샷만 제공합니다.
 */
class UsageAggregator {
  private _totalPromptTokens = 0;
  private _totalCompletionTokens = 0;
  private _totalTokens = 0;
  private _iterationCount = 0;
  private _toolCallCount = 0;
  private _retriedCount = 0;

  /** 단일 LLM 호출의 토큰 사용량을 기록합니다 */
  recordLLMUsage(usage: {
    readonly promptTokens: number;
    readonly completionTokens: number;
    readonly totalTokens: number;
  }): void {
    this._totalPromptTokens += usage.promptTokens;
    this._totalCompletionTokens += usage.completionTokens;
    this._totalTokens += usage.totalTokens;
    this._iterationCount++;
  }

  /** 이번 반복에서 실행된 도구 호출 수를 기록합니다 */
  recordToolCalls(count: number): void {
    this._toolCallCount += count;
  }

  /** 재시도 시도를 기록합니다 */
  recordRetry(): void {
    this._retriedCount++;
  }

  /** 현재 누적 사용량의 불변 스냅샷을 반환합니다 */
  snapshot(): AggregatedUsage {
    return {
      totalPromptTokens: this._totalPromptTokens,
      totalCompletionTokens: this._totalCompletionTokens,
      totalTokens: this._totalTokens,
      iterationCount: this._iterationCount,
      toolCallCount: this._toolCallCount,
      retriedCount: this._retriedCount,
    };
  }
}

/** 항상 병렬 실행이 안전한 도구들 (읽기 전용, 부수 효과 없음) */
const ALWAYS_PARALLEL_TOOLS = new Set(["glob_search", "grep_search", "file_read"]);

/** 파일에 쓰는 도구들 — 같은 파일 경로에 대한 충돌 감지가 필요함 */
const FILE_WRITE_TOOLS = new Set(["file_write", "file_edit"]);

/**
 * 도구 호출의 인자에서 파일 경로를 추출합니다.
 * 다양한 파라미터명(file_path, path, filePath)을 시도합니다.
 *
 * @param call - 도구 호출 정보
 * @returns 파일 경로 문자열, 없으면 undefined
 */
function extractFilePath(call: ExtractedToolCall): string | undefined {
  const args = call.arguments as Record<string, unknown>;
  // Common parameter names for file paths
  if (typeof args["file_path"] === "string") return args["file_path"];
  if (typeof args["path"] === "string") return args["path"];
  if (typeof args["filePath"] === "string") return args["filePath"];
  return undefined;
}

/**
 * 도구 호출의 인자가 올바르게 구성되었는지 검증합니다.
 *
 * 스트리밍 모드에서는 도구 호출 인자가 JSON 청크 단위로 점진적으로 조립됩니다.
 * 스트림이 중간에 끊기면 인자가 불완전한 JSON이 될 수 있습니다.
 * 이 함수는 인자가 유효한 객체인지 확인하여 실행 가능 여부를 판단합니다.
 *
 * @param call - 검증할 도구 호출
 * @returns true면 실행 가능, false면 무효한 호출
 */
function isValidToolCall(call: ExtractedToolCall): boolean {
  // Tool calls with no required parameters are always valid
  // (the arguments object may legitimately be empty)
  const args = call.arguments;
  if (args === null || args === undefined) return false;
  if (typeof args !== "object") return false;

  // Re-serialize to verify round-trip integrity
  try {
    JSON.stringify(args);
    return true;
  } catch {
    return false;
  }
}

/**
 * 유효하지 않은/불완전한 인자를 가진 도구 호출을 필터링합니다.
 * 제거된 도구 호출에 대해 경고 이벤트를 발생시켜 사용자에게 알립니다.
 *
 * @param calls - 필터링할 도구 호출 목록
 * @param events - 경고 이벤트를 발생시킬 이벤트 이미터
 * @returns 유효한 도구 호출만 포함된 배열
 */
export function filterValidToolCalls(
  calls: readonly ExtractedToolCall[],
  events: AppEventEmitter,
): readonly ExtractedToolCall[] {
  const valid: ExtractedToolCall[] = [];

  for (const call of calls) {
    if (isValidToolCall(call)) {
      valid.push(call);
    } else {
      events.emit("llm:error", {
        error: new Error(
          `Dropped incomplete tool call "${call.name}" (id: ${call.id}): arguments failed validation`,
        ),
      });
    }
  }

  return valid;
}

/**
 * 도구 호출을 병렬 실행 그룹으로 분류합니다.
 *
 * 규칙:
 * 1. file_read, glob_search, grep_search는 항상 병렬 실행 가능 (읽기 전용)
 * 2. 같은 파일 경로를 대상으로 하는 file_write/file_edit는 순차 실행 필수
 * 3. bash_exec 호출은 서로 독립적이므로 병렬 실행 가능
 * 4. 의존성이 불명확하면 안전을 위해 같은 그룹에 포함
 *
 * 반환값: 그룹 내 호출은 동시(병렬) 실행, 그룹 간은 순차 실행
 *
 * @param toolCalls - 그룹화할 도구 호출 배열
 * @returns 도구 호출의 2차원 배열 (각 내부 배열 = 병렬 실행 그룹)
 */
export function groupToolCalls(toolCalls: readonly ExtractedToolCall[]): ExtractedToolCall[][] {
  if (toolCalls.length <= 1) {
    return toolCalls.length === 0 ? [] : [[...toolCalls]];
  }

  const groups: ExtractedToolCall[][] = [];
  // Track which file paths have pending writes in the current group
  let currentGroup: ExtractedToolCall[] = [];
  let currentGroupWritePaths = new Set<string>();

  for (const call of toolCalls) {
    const isAlwaysParallel = ALWAYS_PARALLEL_TOOLS.has(call.name);
    const isFileWrite = FILE_WRITE_TOOLS.has(call.name);
    const isBash = call.name === "bash_exec";
    const filePath = extractFilePath(call);

    if (isAlwaysParallel) {
      // Read-only tools can always go into the current group
      currentGroup.push(call);
    } else if (isFileWrite && filePath) {
      // File writes conflict if they target the same path
      if (currentGroupWritePaths.has(filePath)) {
        // Conflict: flush current group, start new one
        groups.push(currentGroup);
        currentGroup = [call];
        currentGroupWritePaths = new Set([filePath]);
      } else {
        currentGroup.push(call);
        currentGroupWritePaths.add(filePath);
      }
    } else if (isBash) {
      // bash_exec calls are parallelizable with each other
      currentGroup.push(call);
    } else {
      // Unknown tool: can go parallel but not with file writes to same path
      // Since we can't determine dependencies, add to current group
      // (safe because unknown tools are independent of each other)
      currentGroup.push(call);
    }
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}

/**
 * 도구 결과를 토큰 예산에 맞게 잘라냅니다.
 *
 * maxToolResultTokens가 설정된 경우 토큰 단위로 잘라내고,
 * 그렇지 않으면 문자 수 기반으로 잘라냅니다.
 * 이진 탐색(binary search) 방식으로 적절한 잘라내기 지점을 찾습니다.
 *
 * @param result - 잘라낼 도구 결과
 * @param maxChars - 최대 문자 수 (토큰 기반이 아닐 때 사용)
 * @param maxTokens - 최대 토큰 수 (설정 시 토큰 기반 잘라내기 사용)
 * @returns 잘라내진 도구 결과 (또는 원본 그대로)
 */
function truncateToolResult(
  result: ToolCallResult,
  maxChars: number,
  maxTokens?: number,
): ToolCallResult {
  if (maxTokens !== undefined) {
    const tokenCount = countTokens(result.output);
    if (tokenCount <= maxTokens) return result;

    // Binary search for the right truncation point
    // Start with a character estimate (tokens * 4 for English, conservative)
    let charLimit = Math.floor(maxTokens * 3);
    let truncated = result.output.slice(0, charLimit);
    let truncatedTokens = countTokens(truncated);

    // Adjust if over budget
    while (truncatedTokens > maxTokens && charLimit > 100) {
      charLimit = Math.floor(charLimit * 0.8);
      truncated = result.output.slice(0, charLimit);
      truncatedTokens = countTokens(truncated);
    }

    return {
      ...result,
      output:
        truncated + `\n\n[... truncated, showing ~${truncatedTokens} of ${tokenCount} tokens]`,
    };
  }

  // Fallback to character-based truncation
  if (result.output.length <= maxChars) return result;
  return {
    ...result,
    output:
      result.output.slice(0, maxChars) +
      `\n\n[... truncated, showing first ${maxChars} of ${result.output.length} chars]`,
  };
}

/**
 * ReAct 에이전트 루프를 실행합니다.
 *
 * 반복 흐름: LLM 호출 → 도구 호출 추출 → 권한 확인 → 도구 실행 → 결과 추가 → 반복
 *
 * 종료 조건:
 * - 도구 호출이 없으면 (LLM이 최종 답변을 완성했으므로)
 * - 최대 반복 횟수에 도달하면
 * - 사용자가 중단(abort)하면
 * - 서킷 브레이커가 열리면 (무한 루프 감지)
 *
 * 에러 복구: 분류-재시도-폴백 패턴
 * - 일시적(transient) 에러: 지수 백오프로 재시도
 * - 과부하(overload) 에러: 즉시 전파 (클라이언트가 이미 재시도함)
 * - 영구적(permanent) 에러: 즉시 실패
 *
 * @param config - 에이전트 루프 설정
 * @param initialMessages - 초기 메시지 배열 (시스템 프롬프트 + 사용자 메시지)
 * @returns 루프 실행 결과 (전체 메시지, 반복 횟수, 토큰 사용량 등)
 */
export async function runAgentLoop(
  config: AgentLoopConfig,
  initialMessages: readonly ChatMessage[],
): Promise<AgentLoopResult> {
  const maxIterations = config.maxIterations ?? AGENT_LOOP.maxIterations;
  const maxRetries = config.maxRetries ?? 2;
  const maxToolResultChars = config.maxToolResultChars ?? 12_000;
  const messages: ChatMessage[] = [...initialMessages];
  let iterations = 0;
  const usageAggregator = new UsageAggregator();
  const circuitBreaker = new CircuitBreaker(maxIterations);
  resetRetryState();

  // Permission denial tracker: tool 이름별 거절 횟수 추적
  // 같은 도구가 반복 거절되면 LLM에 "이 도구 사용을 중단하라"는 가이드를 주입
  const permissionDenialCounts = new Map<string, number>();
  const MAX_DENIALS_BEFORE_STOP = 2;

  // HeadlessGuard: 빈 응답(empty content + no tool calls) 연속 감지 카운터
  let consecutiveEmptyResponses = 0;
  const MAX_EMPTY_RESPONSE_RETRIES = 2;

  // Responses API incomplete 상태 재시도 카운터 (Codex 모델 early-stop 대응)
  let consecutiveIncompleteResponses = 0;
  const MAX_INCOMPLETE_RETRIES = 2;

  // HeadlessGuard: 중복 도구 호출 감지 — 같은 도구+파라미터 조합의 연속 호출 횟수 추적
  let lastToolCallSignature = "";
  let duplicateToolCallCount = 0;
  const MAX_DUPLICATE_TOOL_CALLS = 3;

  // 선제적 컴팩션: 마지막 컴팩션이 발생한 반복 번호를 추적하여 이중 컴팩션 방지
  let lastCompactionIteration = -Infinity;

  // Context manager for auto-compaction when token budget is exceeded
  const contextManager = new ContextManager({
    maxContextTokens: config.maxContextTokens,
    sessionId: config.sessionId,
    workingDirectory: config.workingDirectory,
    client: config.client,
    summaryModel: config.model,
    onPreCompact: () => {
      config.events.emit("context:pre-compact", { compactionNumber: 0 });
    },
  });

  while (iterations < maxIterations && circuitBreaker.shouldContinue()) {
    if (config.signal?.aborted) {
      const usage = usageAggregator.snapshot();
      config.events.emit("agent:complete", {
        iterations,
        totalTokens: usage.totalTokens,
        toolCallCount: usage.toolCallCount,
        aborted: true,
        reason: "aborted",
      });
      trace("agent-loop", `Loop complete: reason=aborted, iterations=${iterations}`);
      return { messages, iterations, aborted: true, usage };
    }

    iterations++;
    config.events.emit("agent:iteration", { iteration: iterations });
    trace("agent-loop", `--- Iteration ${iterations} start ---`);

    // Dual-model routing: detect phase and select client/model for this iteration
    let activeClient = config.client;
    let activeModel = config.model;

    if (config.dualModelRouter) {
      const phase = detectPhase(messages);
      config.dualModelRouter.setPhase(phase);
      const routing = config.dualModelRouter.getClientForPhase(phase);
      activeClient = routing.client;
      activeModel = routing.model;
    }

    // Apply observation masking to reduce token usage before compaction
    const maskedMessages = applyObservationMasking(messages, { keepRecentN: 5 });
    // Apply context compaction if messages exceed token budget
    let managedMessages = [...(await contextManager.prepare(maskedMessages))];

    // 선제적 컴팩션 — LLM 호출 전에 컨텍스트 사용량이 임계치에 근접하면 미리 압축
    // prepare()의 자동 컴팩션(83.5%)과 별도로, 80%에서 선제적으로 실행하여
    // LLM 호출 실패나 품질 저하를 사전에 방지합니다.
    // 이중 컴팩션 방지: 최근 2회 반복 이내에 컴팩션이 발생했으면 건너뜁니다.
    if (iterations - lastCompactionIteration > 2) {
      const preemptiveUsage = contextManager.getUsage(managedMessages);
      if (preemptiveUsage.usageRatio >= AGENT_LOOP.preemptiveCompactionThreshold) {
        trace(
          "agent-loop",
          `Preemptive compaction triggered at ${(preemptiveUsage.usageRatio * 100).toFixed(1)}% usage`,
        );
        config.events.emit("context:pre-compact", {
          compactionNumber: 0,
        });
        const { messages: compacted } = await contextManager.compact(managedMessages);
        managedMessages = [...compacted];
        lastCompactionIteration = iterations;
        trace(
          "agent-loop",
          `Preemptive compaction complete — usage now ${(contextManager.getUsage(managedMessages).usageRatio * 100).toFixed(1)}%`,
        );
      }
    }

    // Prepare request with tool definitions
    // Deferred mode: hot tools only by default, plus schemas for recently used deferred tools
    let toolDefs: readonly ToolDefinitionForLLM[];
    if (config.toolRegistry.isDeferredMode) {
      const hotDefs = config.toolRegistry.getHotDefinitionsForLLM();
      const resolvedDeferred = resolveDeferredFromHistory(managedMessages, config.toolRegistry);
      toolDefs = [...hotDefs, ...resolvedDeferred];
    } else {
      toolDefs = config.toolRegistry.getDefinitionsForLLM();
    }
    const prepared = config.strategy.prepareRequest(managedMessages, toolDefs);

    // Call LLM with retry logic
    config.events.emit("llm:start", { iteration: iterations });
    trace(
      "agent-loop",
      `Iter ${iterations}: LLM call starting (model=${activeModel}, streaming=${!!config.useStreaming})`,
    );

    const chatRequest = {
      model: activeModel,
      messages: prepared.messages,
      tools: prepared.tools,
      temperature: config.temperature ?? 0,
      maxTokens: config.maxTokens ?? 4096,
      signal: config.signal,
      thinking: config.thinking,
    };

    let response: ChatResponse | undefined;
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (config.useStreaming) {
          // Streaming mode: accumulate chunks while emitting text deltas
          const stream = activeClient.stream(chatRequest);
          const accumulated = await consumeStream(stream, {
            onTextDelta: (text) => {
              config.events.emit("llm:text-delta", { text });
            },
            onThinkingDelta: (text) => {
              config.events.emit("llm:thinking-delta", { text });
            },
            onUsage: (usage) => {
              config.events.emit("llm:usage", { usage, model: activeModel });
            },
          });

          if (accumulated.partial) {
            // Stream disconnected mid-response but we recovered partial content.
            // If we have text or tool calls, use them (better than losing everything).
            // If we have nothing meaningful, throw to trigger retry.
            if (accumulated.text.length === 0 && accumulated.toolCalls.length === 0) {
              throw new LLMError("Stream disconnected with no recoverable content");
            }
            config.events.emit("llm:error", {
              error: new Error("Stream disconnected mid-response; using partial content"),
            });
          }

          response = {
            content: accumulated.text,
            toolCalls: accumulated.toolCalls,
            usage: accumulated.usage ?? { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            finishReason: accumulated.finishReason ?? (accumulated.partial ? "length" : "stop"),
          };
        } else {
          response = await activeClient.chat(chatRequest);
        }
        break;
      } catch (error) {
        lastError = error;
        const errorClass = classifyLLMError(error);

        // Check recovery strategies and execute them
        if (error instanceof Error) {
          const recovery = findRecoveryStrategy(error);
          if (recovery) {
            config.events.emit("llm:error", {
              error: new Error(`Recovery strategy: ${recovery.description}`),
            });

            // Emit retry event before recovery execution so UI can show countdown
            if (recovery.action === "retry" && recovery.backoffMs) {
              config.events.emit("agent:retry", {
                delayMs: recovery.backoffMs * Math.pow(2, attempt),
                reason: recovery.description,
                attempt: attempt + 1,
                maxRetries: recovery.maxRetries,
              });
            }

            try {
              const recoveryResult = await executeRecovery(recovery, error, messages, {
                maxContextTokens: config.maxContextTokens,
                signal: config.signal,
              });
              if (recoveryResult.action === "retry") {
                // Apply compacted messages if recovery provided them
                if (recoveryResult.messages) {
                  messages.length = 0;
                  messages.push(...recoveryResult.messages);
                }
                continue; // Restart the iteration with recovered state
              }
            } catch {
              // Recovery failed — fall through to normal error handling
            }
          }
        }

        // Overload: client already retried with Retry-After — don't retry again
        if (errorClass === "overload" || errorClass === "permanent") {
          throw error;
        }

        // Transient only: retry with backoff
        if (attempt < maxRetries) {
          usageAggregator.recordRetry();
          const delay = 1000 * Math.pow(2, attempt);
          config.events.emit("llm:error", {
            error: error instanceof Error ? error : new Error(String(error)),
          });
          config.events.emit("agent:retry", {
            delayMs: delay,
            reason: error instanceof Error ? error.message : String(error),
            attempt: attempt + 1,
            maxRetries,
          });
          await waitWithAbort(delay, config.signal);
        }
      }
    }

    if (!response) {
      throw lastError instanceof LLMError
        ? lastError
        : new LLMError("LLM call failed after retries", {
            cause: lastError instanceof Error ? lastError.message : String(lastError),
            attempts: maxRetries + 1,
          });
    }

    config.events.emit("llm:complete", {
      tokenCount: response.usage.totalTokens,
    });
    trace(
      "agent-loop",
      `Iter ${iterations}: LLM response — content.length=${response.content.length}, toolCalls=${response.toolCalls.length}, finishReason=${response.finishReason}`,
    );

    // Record usage in aggregator and emit running totals
    usageAggregator.recordLLMUsage(response.usage);
    const runningUsage = usageAggregator.snapshot();
    config.events.emit("agent:usage-update", {
      promptTokens: runningUsage.totalPromptTokens,
      completionTokens: runningUsage.totalCompletionTokens,
      totalTokens: runningUsage.totalTokens,
      iteration: iterations,
    });

    // Append assistant message
    const assistantMessage: ChatMessage = {
      role: "assistant",
      content: response.content,
      toolCalls: response.toolCalls.length > 0 ? response.toolCalls : undefined,
    };
    messages.push(assistantMessage);

    // Extract tool calls and filter out incomplete ones with invalid JSON arguments
    const rawExtractedCalls = config.strategy.extractToolCalls(
      response.content,
      response.toolCalls,
    );
    let extractedCalls = filterValidToolCalls(rawExtractedCalls, config.events);

    // Fallback: if strategy extracted nothing but response has native toolCalls,
    // try direct extraction (prevents tool call drop from strategy mismatch)
    if (extractedCalls.length === 0 && response.toolCalls.length > 0) {
      const fallbackCalls: ExtractedToolCall[] = response.toolCalls.map((tc) => {
        let args: Record<string, unknown>;
        try {
          args =
            typeof tc.arguments === "string"
              ? (JSON.parse(tc.arguments) as Record<string, unknown>)
              : ((tc.arguments as Record<string, unknown>) ?? {});
        } catch {
          args = {};
        }
        return { id: tc.id, name: tc.name, arguments: args };
      });
      const validFallback = filterValidToolCalls(fallbackCalls, config.events);
      if (validFallback.length > 0) {
        extractedCalls = validFallback;
      }
    }
    trace(
      "agent-loop",
      `Iter ${iterations}: extractedCalls=${extractedCalls.length} (raw=${rawExtractedCalls.length}, response.toolCalls=${response.toolCalls.length})`,
    );
    if (extractedCalls.length === 0 && response.toolCalls.length > 0) {
      trace(
        "agent-loop",
        `WARNING: response had ${response.toolCalls.length} toolCalls but extraction yielded 0! Strategy may be dropping native calls.`,
      );
    }

    // If the LLM attempted tool calls but all were invalid, inject feedback and retry
    if (rawExtractedCalls.length > 0 && extractedCalls.length === 0) {
      const droppedNames = rawExtractedCalls.map((tc) => tc.name).join(", ");
      const errorFeedback: ChatMessage = {
        role: "user",
        content:
          `[System] Your tool calls (${droppedNames}) had invalid or incomplete JSON arguments ` +
          `and were dropped. Please retry with valid, complete JSON arguments.`,
      };
      messages.push(errorFeedback);
      continue; // Re-enter the loop for LLM to retry
    }

    // HeadlessGuard: 빈 응답(content 없고 tool call도 없음) 감지 시 자동 재시도
    if (response.content.trim() === "" && extractedCalls.length === 0) {
      consecutiveEmptyResponses++;
      if (consecutiveEmptyResponses <= MAX_EMPTY_RESPONSE_RETRIES) {
        config.events.emit("llm:error", {
          error: new Error(
            `Empty response detected (attempt ${consecutiveEmptyResponses}/${MAX_EMPTY_RESPONSE_RETRIES}), retrying...`,
          ),
        });
        const nudgeMessage: ChatMessage = {
          role: "user",
          content:
            "[System] Your previous response was empty. Please complete the requested task. " +
            "Provide a substantive response with your answer or explanation.",
        };
        messages.push(nudgeMessage);
        continue; // Re-enter the loop for retry
      }
      // Max retries exhausted — fall through to normal completion
    } else {
      // Reset counter on any non-empty response
      consecutiveEmptyResponses = 0;
    }

    // Emit assistant message event (intermediate if tool calls follow, final otherwise)
    config.events.emit("agent:assistant-message", {
      content: response.content,
      toolCalls: extractedCalls.map((tc) => ({ id: tc.id, name: tc.name })),
      iteration: iterations,
      isFinal: extractedCalls.length === 0,
    });

    if (extractedCalls.length === 0) {
      // Subagent auto-retry: if early iterations produced no tool calls, nudge the model
      // Allow up to 2 retry attempts (iterations 1 and 2) with increasingly specific messages
      if (config.isSubagent && iterations <= 2) {
        const toolNames = config.toolRegistry
          .getAll()
          .map((t) => t.name)
          .join(", ");
        const nudgeMessage =
          iterations === 1
            ? `You MUST use your available tools to complete the task. Call a tool now — do not respond with text only. Available tools: ${toolNames}`
            : `CRITICAL: You have NOT called any tools yet. You MUST call one of these tools RIGHT NOW: ${toolNames}. For example, call list_dir with {"path": "."} or glob_search with {"pattern": "**/*.ts"}. Do NOT output any text without a tool call.`;
        trace(
          "agent-loop",
          `Iter ${iterations}: Subagent produced no tool calls — injecting retry nudge (attempt ${iterations}/2)`,
        );
        messages.push({
          role: "user",
          content: nudgeMessage,
        });
        continue;
      }
      trace(
        "agent-loop",
        `Iter ${iterations}: No tool calls detected → loop ending (finishReason=${response.finishReason})`,
      );
      // Auto-retry when response was truncated due to token limit
      if (response.finishReason === "length") {
        config.events.emit("llm:error", {
          error: new Error("Response truncated due to token limit, retrying with continuation..."),
        });
        const continuationMessage: ChatMessage = {
          role: "user",
          content:
            "[System] Your previous response was cut off due to token limit. " +
            "Please continue exactly from where you left off.",
        };
        messages.push(continuationMessage);
        continue; // Re-enter the agent loop for continuation
      }

      // Auto-retry when Responses API returns "incomplete" status
      // (Codex models may enter "conversational mode" and stop early)
      if (response.finishReason === "incomplete") {
        consecutiveIncompleteResponses++;
        if (consecutiveIncompleteResponses <= MAX_INCOMPLETE_RETRIES) {
          trace(
            "agent-loop",
            `Iter ${iterations}: finishReason=incomplete, retrying (${consecutiveIncompleteResponses}/${MAX_INCOMPLETE_RETRIES})`,
          );
          config.events.emit("llm:error", {
            error: new Error(
              `Response incomplete (attempt ${consecutiveIncompleteResponses}/${MAX_INCOMPLETE_RETRIES}), nudging model to continue...`,
            ),
          });
          const incompleteNudge: ChatMessage = {
            role: "user",
            content:
              "[System] Your response ended with status 'incomplete' and no tool calls. " +
              "The task is NOT finished. Continue working by calling the appropriate tools. " +
              "Do not describe what you plan to do — take action with tools immediately.",
          };
          messages.push(incompleteNudge);
          continue; // Re-enter the agent loop
        }
        trace(
          "agent-loop",
          `Iter ${iterations}: finishReason=incomplete, max retries exhausted — exiting`,
        );
        // Fall through to normal completion after max retries
      } else {
        consecutiveIncompleteResponses = 0;
      }

      // No tool calls — conversation turn complete
      const doneUsage = usageAggregator.snapshot();
      config.events.emit("agent:complete", {
        iterations,
        totalTokens: doneUsage.totalTokens,
        toolCallCount: doneUsage.toolCallCount,
        aborted: false,
        reason: "completed",
      });
      trace(
        "agent-loop",
        `Loop complete: reason=no-tool-calls, iterations=${iterations}, aborted=false`,
      );
      return { messages, iterations, aborted: false, usage: doneUsage };
    }

    // HeadlessGuard: 중복 도구 호출 루프 감지
    // 같은 도구+동일 파라미터 조합이 MAX_DUPLICATE_TOOL_CALLS 회 이상 연속되면 루프 탈출
    const currentSignature = extractedCalls
      .map((tc) => `${tc.name}:${JSON.stringify(tc.arguments)}`)
      .join("|");
    if (currentSignature === lastToolCallSignature) {
      duplicateToolCallCount++;
      if (duplicateToolCallCount >= MAX_DUPLICATE_TOOL_CALLS) {
        config.events.emit("llm:error", {
          error: new Error(
            `Duplicate tool call loop detected (${duplicateToolCallCount} identical calls). Breaking loop.`,
          ),
        });
        const loopBreakMessage: ChatMessage = {
          role: "user",
          content:
            "[System] You are calling the same tool(s) with identical parameters repeatedly. " +
            "This appears to be a loop. Stop calling these tools and provide your final answer " +
            "based on the results you already have.",
        };
        messages.push(loopBreakMessage);
        continue; // Re-enter the loop — LLM should respond with text instead of tool calls
      }
    } else {
      lastToolCallSignature = currentSignature;
      duplicateToolCallCount = 1;
    }

    // Execute tool calls in parallel groups
    const groups = groupToolCalls(extractedCalls);
    const results: ToolCallResult[] = [];

    // Emit tools-executing event for UI state tracking
    config.events.emit("agent:tools-executing", {
      toolNames: groups.flat().map((tc) => tc.name),
      count: groups.flat().length,
    });
    trace(
      "agent-loop",
      `Iter ${iterations}: Executing ${groups.flat().length} tool calls: [${groups
        .flat()
        .map((tc) => tc.name)
        .join(", ")}]`,
    );

    for (const group of groups) {
      // Pre-flight checks (permission + input guardrails) are sequential
      // because they may require user interaction
      const preflightResults = new Map<string, ToolCallResult>();
      const executableCalls: ExtractedToolCall[] = [];

      for (const call of group) {
        config.events.emit("tool:start", { name: call.name, id: call.id, args: call.arguments });

        // Check permission
        if (config.checkPermission) {
          const permission = await config.checkPermission(call);
          if (!permission.allowed) {
            // Permission denial 횟수 추적
            const denialCount = (permissionDenialCounts.get(call.name) ?? 0) + 1;
            permissionDenialCounts.set(call.name, denialCount);

            const denialMessage =
              denialCount >= MAX_DENIALS_BEFORE_STOP
                ? `Permission denied: ${permission.reason ?? "User rejected"}. ` +
                  `This tool has been denied ${denialCount} times. ` +
                  `STOP trying to use "${call.name}". ` +
                  `Inform the user what you were trying to do and ask for guidance.`
                : `Permission denied: ${permission.reason ?? "User rejected"}`;

            const denied: ToolCallResult = {
              id: call.id,
              name: call.name,
              output: denialMessage,
              isError: true,
            };
            preflightResults.set(call.id, denied);
            config.events.emit("tool:complete", {
              name: call.name,
              id: call.id,
              isError: true,
              output: denialMessage,
            });
            continue;
          }
        }

        // Apply input guardrails
        if (config.enableGuardrails !== false) {
          const guardrailCheck = applyInputGuardrails(
            call.name,
            call.arguments as Record<string, unknown>,
            config.workingDirectory,
          );
          if (guardrailCheck.severity === "block") {
            const blocked: ToolCallResult = {
              id: call.id,
              name: call.name,
              output: `Blocked by guardrail: ${guardrailCheck.reason ?? "Security policy violation"}`,
              isError: true,
            };
            preflightResults.set(call.id, blocked);
            config.events.emit("tool:complete", {
              name: call.name,
              id: call.id,
              isError: true,
              output: `Blocked: ${guardrailCheck.reason}`,
            });
            continue;
          }
          if (guardrailCheck.severity === "warn") {
            config.events.emit("llm:error", {
              error: new Error(`Guardrail warning: ${guardrailCheck.reason}`),
            });
          }
        }

        executableCalls.push(call);
      }

      // Auto-checkpoint: snapshot files before file-modifying tools execute
      if (config.checkpointManager) {
        const fileModifyingCalls = executableCalls.filter((c) => FILE_WRITE_TOOLS.has(c.name));
        if (fileModifyingCalls.length > 0) {
          const trackedFiles = fileModifyingCalls
            .map((c) => extractFilePath(c))
            .filter((p): p is string => p !== undefined);

          if (trackedFiles.length > 0) {
            try {
              const workDir = config.workingDirectory ?? process.cwd();
              const toolNames = fileModifyingCalls.map((c) => c.name).join(", ");
              const cp = await config.checkpointManager.createCheckpoint({
                sessionId: config.sessionId ?? "unknown",
                description: `Before ${toolNames}: ${trackedFiles.map((f) => f.split("/").pop()).join(", ")}`,
                messageIndex: messages.length,
                workingDirectory: workDir,
                trackedFiles,
              });
              config.events.emit("checkpoint:created", {
                checkpointId: cp.id,
                description: cp.description,
                fileCount: cp.files.length,
              });
            } catch {
              // Checkpoint failure should not block tool execution
            }
          }
        }
      }

      // Execute all approved calls in the group in parallel
      const settled = await Promise.allSettled(
        executableCalls.map(async (call) => {
          let result = await executeToolCall(config.toolRegistry, call, {
            workingDirectory: config.workingDirectory ?? process.cwd(),
            signal: config.signal,
            events: config.events,
            activeClient: activeClient,
            activeModel: activeModel,
            capabilityTier: getModelCapabilities(activeModel).capabilityTier,
            checkPermission: config.checkPermission,
            checkpointManager: config.checkpointManager,
            sessionId: config.sessionId,
            thinking: config.thinking,
          });

          // Apply output guardrails
          if (config.enableGuardrails !== false) {
            const outputCheck = applyOutputGuardrails(result.output);
            if (outputCheck.modified) {
              result = { ...result, output: outputCheck.modified };
            }
          }

          return result;
        }),
      );

      // Collect results preserving original order within the group
      for (const call of group) {
        // Check if it was handled in preflight
        const preflightResult = preflightResults.get(call.id);
        if (preflightResult) {
          results.push(preflightResult);
          continue;
        }

        // Find the settled result for this call
        const execIndex = executableCalls.indexOf(call);
        if (execIndex === -1) continue;

        const settledResult = settled[execIndex];
        if (settledResult.status === "fulfilled") {
          const result = settledResult.value;
          results.push(result);
          config.events.emit("tool:complete", {
            name: call.name,
            id: call.id,
            isError: result.isError,
            output: result.output,
            metadata: result.metadata,
          });
        } else {
          // Promise.allSettled rejected — unexpected execution error
          const errorMessage =
            settledResult.reason instanceof Error
              ? settledResult.reason.message
              : String(settledResult.reason);
          const errorResult: ToolCallResult = {
            id: call.id,
            name: call.name,
            output: `Tool execution failed: ${errorMessage}`,
            isError: true,
          };
          results.push(errorResult);
          config.events.emit("tool:complete", {
            name: call.name,
            id: call.id,
            isError: true,
            output: errorResult.output,
          });
        }
      }
    }

    // Emit tools-done event — UI can show "Thinking..." while waiting for next LLM call
    config.events.emit("agent:tools-done", {
      count: results.length,
      nextAction: "llm-call",
    });

    // Record executed tool calls in usage aggregator
    usageAggregator.recordToolCalls(extractedCalls.length);

    // Track file accesses for context manager rehydration
    for (const call of extractedCalls) {
      if (call.name === "file_read" || call.name === "file_edit" || call.name === "file_write") {
        const filePath = extractFilePath(call);
        if (filePath) {
          contextManager.trackFileAccess(filePath);
        }
      }
    }

    // Truncate oversized tool results (token-based or character-based)
    const truncatedResults = results.map((r) =>
      truncateToolResult(r, maxToolResultChars, config.maxToolResultTokens),
    );

    // Append tool results as messages
    const toolMessages = config.strategy.formatToolResults(truncatedResults);
    messages.push(...toolMessages);

    // MCP 도구 실패 감지 → LLM에 recovery 가이드 메시지 주입
    const mcpFailures = results.filter((r) => r.isError && r.name.startsWith("mcp__"));
    if (mcpFailures.length > 0) {
      const failedToolNames = mcpFailures.map((r) => r.name).join(", ");
      const hasTimeout = mcpFailures.some(
        (r) =>
          r.metadata?.mcpErrorType === "timeout" || r.output.toLowerCase().includes("timed out"),
      );
      const hasDenial = mcpFailures.some((r) =>
        r.output.toLowerCase().includes("permission denied"),
      );

      let guidance = `[System] ${mcpFailures.length} MCP tool(s) failed: ${failedToolNames}. `;
      if (hasTimeout) {
        guidance += "At least one tool timed out. Do NOT retry the same call. ";
      }
      if (hasDenial) {
        guidance += "At least one tool was denied by the user. Do NOT retry denied tools. ";
      }
      guidance +=
        "You MUST: (1) Acknowledge the failure to the user, " +
        "(2) Explain what you were trying to do, " +
        "(3) Suggest an alternative approach or ask the user how to proceed.";

      const recoveryGuidance: ChatMessage = {
        role: "user",
        content: guidance,
      };
      messages.push(recoveryGuidance);
    }

    // Track iteration for circuit breaker (detect no-progress loops)
    const filesModified = new Set<string>();
    for (const call of extractedCalls) {
      if (FILE_WRITE_TOOLS.has(call.name)) {
        const fp = extractFilePath(call);
        if (fp) filesModified.add(fp);
      }
    }
    trace(
      "agent-loop",
      `CB iteration: hasOutput=${response.content.length > 0 || extractedCalls.length > 0}, toolCalls=${extractedCalls.length}, filesModified=${filesModified.size}`,
    );
    circuitBreaker.recordIteration({
      filesModified,
      hasOutput: response.content.length > 0 || extractedCalls.length > 0,
      error: results.some((r) => r.isError) ? results.find((r) => r.isError)?.output : undefined,
    });

    // If circuit breaker opened, inform user and stop
    if (!circuitBreaker.shouldContinue()) {
      const status = circuitBreaker.getStatus();
      config.events.emit("llm:error", {
        error: new Error(`Circuit breaker opened: ${status.reason ?? "No progress detected"}`),
      });
      trace(
        "agent-loop",
        `Loop complete: reason=circuit-breaker, iterations=${iterations}, cbReason=${status.reason}`,
      );
    }
  }

  const finalUsage = usageAggregator.snapshot();
  config.events.emit("agent:complete", {
    iterations,
    totalTokens: finalUsage.totalTokens,
    toolCallCount: finalUsage.toolCallCount,
    aborted: false,
    reason: circuitBreaker.shouldContinue() ? "max-iterations" : "circuit-breaker",
  });
  trace("agent-loop", `Loop complete: reason=max-iterations, iterations=${iterations}`);

  return { messages, iterations, aborted: false, usage: finalUsage };
}

/**
 * 메시지 히스토리에서 지연 로드(deferred) 도구 스키마를 해석합니다.
 *
 * MCP(Model Context Protocol) 도구는 초기에 스키마를 로드하지 않고(지연 로드),
 * 실제 사용될 때 스키마를 해석합니다. 최근 3개의 어시스턴트 메시지에서
 * MCP 도구 호출을 찾아 해당 스키마를 다음 요청에 포함시킵니다.
 *
 * @param messages - 전체 메시지 히스토리
 * @param registry - 도구 레지스트리
 * @returns 해석된 도구 정의 배열
 */
function resolveDeferredFromHistory(
  messages: readonly ChatMessage[],
  registry: ToolRegistry,
): readonly ToolDefinitionForLLM[] {
  const resolved = new Map<string, ToolDefinitionForLLM>();
  let assistantsSeen = 0;

  // Scan recent assistant messages for MCP tool calls that need schema
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== "assistant" || !msg.toolCalls) continue;

    assistantsSeen++;

    for (const tc of msg.toolCalls) {
      if (tc.name.startsWith("mcp__") && !resolved.has(tc.name)) {
        const def = registry.resolveDeferredTool(tc.name);
        if (def) resolved.set(tc.name, def);
      }
    }

    // Only check recent 3 assistant messages
    if (assistantsSeen >= 3) break;
  }

  return [...resolved.values()];
}

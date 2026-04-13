/**
 * AsyncCompactionEngine — 비동기 백그라운드 컨텍스트 압축 엔진
 *
 * 기존 동기식 blocking compaction을 비동기 백그라운드 워커로 전환합니다.
 * Agent loop를 차단하지 않고 proactive compaction을 수행하며,
 * tool_use/tool_result 쌍 무결성을 보장합니다.
 *
 * 두 가지 trigger 모드:
 * 1. Proactive (70% threshold) — background에서 미리 압축, loop 차단 없음
 * 2. Reactive (85% threshold) — 급한 경우 foreground에서 실행 (fallback)
 *
 * @module core/runtime/async-compaction
 */

import { type ChatMessage } from "../../llm/provider.js";
import { countMessageTokens } from "../../llm/token-counter.js";
import { type ContextManager } from "../context-manager.js";
import { getLogger } from "../../utils/logger.js";

/**
 * Compaction 결과 — 압축 작업의 통계와 결과 요약
 */
export interface CompactionResult {
  /** 압축 전 총 토큰 수 */
  readonly originalTokens: number;
  /** 압축 후 총 토큰 수 */
  readonly compactedTokens: number;
  /** 제거된 메시지 수 */
  readonly removedMessages: number;
  /** 압축 요약 텍스트 */
  readonly summary: string;
  /** 사용된 압축 전략 */
  readonly strategy: "native" | "llm-summarize" | "truncate";
}

/**
 * CompactionTicket — 비동기 압축 요청의 추적 티켓
 *
 * 압축 요청이 생성되면 pending 상태로 시작하여
 * resolved 또는 failed 상태로 전이됩니다.
 */
export interface CompactionTicket {
  /** 티켓 고유 식별자 */
  readonly id: string;
  /** 현재 상태: pending(처리중), resolved(완료), failed(실패) */
  readonly status: "pending" | "resolved" | "failed";
  /** 압축 우선순위: proactive(백그라운드), reactive(포그라운드) */
  readonly priority: "proactive" | "reactive";
  /** 요청 시각 (Unix timestamp ms) */
  readonly requestedAt: number;
  /** 완료 시각 (Unix timestamp ms) — resolved/failed 시 설정 */
  readonly resolvedAt?: number;
  /** 압축 결과 — resolved 시 설정 */
  readonly result?: CompactionResult;
  /** 실패 사유 — failed 시 설정 */
  readonly error?: string;
}

/**
 * 토큰 예산 계산 결과 — 제거/보존할 메시지 분리
 */
interface TokenBudget {
  /** 제거 대상 메시지 (오래된 것부터) */
  readonly toRemove: readonly ChatMessage[];
  /** 보존 대상 메시지 (최신 것부터) */
  readonly toKeep: readonly ChatMessage[];
}

/** 고유 티켓 ID 생성용 카운터 */
let ticketCounter = 0;

/**
 * 고유 티켓 ID 생성
 *
 * @returns "compaction-{counter}-{timestamp}" 형식의 고유 ID
 */
function generateTicketId(): string {
  ticketCounter++;
  return `compaction-${ticketCounter}-${Date.now()}`;
}

/**
 * AsyncCompactionEngine — 비동기 컨텍스트 압축 엔진
 *
 * Agent loop에서 분리되어 background에서 실행됩니다.
 * ContextManager의 compact() 메서드를 내부적으로 활용하며,
 * tool_use/tool_result 쌍 무결성 검증을 추가합니다.
 *
 * @example
 * ```typescript
 * const engine = new AsyncCompactionEngine({ contextManager });
 *
 * // Proactive: 70% 사용 시 — 비동기로 실행, loop 차단 없음
 * const ticket = await engine.requestCompaction(messages, "proactive");
 *
 * // 다음 iteration에서 결과 확인
 * const compacted = engine.getCompactedMessages();
 * if (compacted) {
 *   managedMessages = compacted;
 * }
 * ```
 */
export class AsyncCompactionEngine {
  /** 현재 보류 중인 compaction 티켓 */
  private pendingCompaction: CompactionTicket | null = null;

  /** 보류 중인 compaction의 결과 메시지 (resolved 시 설정) */
  private pendingResult: readonly ChatMessage[] | null = null;

  /** 진행 중인 background compaction Promise */
  private backgroundTask: Promise<void> | null = null;

  /** Proactive compaction 임계치 — 70% 사용 시 백그라운드 시작 */
  private readonly proactiveThreshold: number;

  /** Reactive compaction 임계치 — 85% 사용 시 포그라운드 폴백 */
  private readonly reactiveThreshold: number;

  /** 항상 보존할 최소 토큰 수 (OpenCode의 PRUNE_MINIMUM 참고) */
  private readonly preserveMinTokens: number;

  /** 보호 대역 토큰 수 (OpenCode의 PRUNE_PROTECT 참고) */
  private readonly protectTokens: number;

  /** Context manager 참조 — compact() 위임용 */
  private readonly contextManager: ContextManager;

  /**
   * AsyncCompactionEngine 생성
   *
   * @param config - 엔진 설정
   * @param config.contextManager - ContextManager 인스턴스 (compact() 위임)
   * @param config.proactiveThreshold - Proactive 임계치 (기본 0.70)
   * @param config.reactiveThreshold - Reactive 임계치 (기본 0.85)
   * @param config.preserveMinTokens - 최소 보존 토큰 (기본 20,000)
   * @param config.protectTokens - 보호 대역 토큰 (기본 40,000)
   */
  constructor(config: {
    readonly contextManager: ContextManager;
    readonly proactiveThreshold?: number;
    readonly reactiveThreshold?: number;
    readonly preserveMinTokens?: number;
    readonly protectTokens?: number;
  }) {
    this.contextManager = config.contextManager;
    this.proactiveThreshold = config.proactiveThreshold ?? 0.7;
    this.reactiveThreshold = config.reactiveThreshold ?? 0.85;
    this.preserveMinTokens = config.preserveMinTokens ?? 20_000;
    this.protectTokens = config.protectTokens ?? 40_000;
  }

  /**
   * Compaction 요청 — 우선순위에 따라 비동기 또는 동기 실행
   *
   * - "proactive" → 비동기 백그라운드 실행 (loop 차단 없음)
   *   결과는 getCompactedMessages()로 나중에 확인
   * - "reactive" → 동기 포그라운드 실행 (결과 대기)
   *   즉시 결과 반환
   *
   * @param messages - 압축 대상 메시지 배열
   * @param priority - 압축 우선순위 ("proactive" | "reactive")
   * @returns CompactionTicket — 요청 추적 티켓
   */
  async requestCompaction(
    messages: readonly ChatMessage[],
    priority: "proactive" | "reactive",
  ): Promise<CompactionTicket> {
    const logger = getLogger();
    const ticketId = generateTicketId();

    const ticket: CompactionTicket = {
      id: ticketId,
      status: "pending",
      priority,
      requestedAt: Date.now(),
    };

    this.pendingCompaction = ticket;
    this.pendingResult = null;

    if (priority === "reactive") {
      // Reactive: 포그라운드에서 동기적으로 실행 (결과 대기)
      return this.executeCompaction(messages, ticket);
    }

    // Proactive: 백그라운드에서 비동기 실행 (loop 차단 없음)
    const messagesCopy = [...messages];
    this.backgroundTask = this.executeCompactionBackground(messagesCopy, ticket).catch(
      (error: unknown) => {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.warn({ ticketId, error: errorMsg }, "Background compaction failed");

        const failedTicket: CompactionTicket = {
          ...ticket,
          status: "failed",
          resolvedAt: Date.now(),
          error: errorMsg,
        };
        this.pendingCompaction = failedTicket;
        this.pendingResult = null;
      },
    );

    return ticket;
  }

  /**
   * 이전 compaction 결과가 준비되었는지 확인
   *
   * Agent loop의 compact-context stage에서 매 iteration 호출합니다.
   * 결과가 있으면 메시지 배열을 반환하고 내부 상태를 초기화합니다.
   * 결과가 없으면 null을 반환합니다.
   *
   * @returns 압축된 메시지 배열 또는 null (아직 준비 안 됨)
   */
  getCompactedMessages(): readonly ChatMessage[] | null {
    if (this.pendingCompaction?.status !== "resolved" || !this.pendingResult) {
      return null;
    }

    const result = this.pendingResult;

    // 결과 수령 후 상태 초기화
    this.pendingCompaction = null;
    this.pendingResult = null;
    this.backgroundTask = null;

    return result;
  }

  /**
   * 현재 보류 중인 compaction 티켓 조회
   *
   * @returns 보류 중인 티켓 또는 null
   */
  getPendingTicket(): CompactionTicket | null {
    return this.pendingCompaction;
  }

  /**
   * Proactive compaction 임계치 조회
   *
   * @returns proactive threshold (0-1)
   */
  getProactiveThreshold(): number {
    return this.proactiveThreshold;
  }

  /**
   * Reactive compaction 임계치 조회
   *
   * @returns reactive threshold (0-1)
   */
  getReactiveThreshold(): number {
    return this.reactiveThreshold;
  }

  /**
   * tool_use/tool_result 쌍 무결성 검증
   *
   * Compaction 경계에서 orphaned 메시지가 없는지 확인합니다:
   * - orphaned tool_result (대응하는 tool_use가 없음) → 제거
   * - orphaned tool_use (대응하는 tool_result가 없음) → tool_use와 해당 tool_result 모두 제거
   *
   * @param messages - 검증 대상 메시지 배열
   * @returns 무결성이 보장된 메시지 배열
   */
  validatePairIntegrity(messages: readonly ChatMessage[]): readonly ChatMessage[] {
    const logger = getLogger();

    // Step 1: tool_use ID 수집 (assistant 메시지의 toolCalls에서)
    const toolUseIds = new Set<string>();
    for (const msg of messages) {
      if (msg.role === "assistant" && msg.toolCalls) {
        for (const tc of msg.toolCalls) {
          toolUseIds.add(tc.id);
        }
      }
    }

    // Step 2: tool_result ID 수집 (tool 메시지의 toolCallId에서)
    const toolResultIds = new Set<string>();
    for (const msg of messages) {
      if (msg.role === "tool" && msg.toolCallId) {
        toolResultIds.add(msg.toolCallId);
      }
    }

    // Step 3: orphaned IDs 식별
    // orphaned tool_result: toolCallId가 toolUseIds에 없음
    const orphanedResultIds = new Set<string>();
    for (const id of toolResultIds) {
      if (!toolUseIds.has(id)) {
        orphanedResultIds.add(id);
      }
    }

    // orphaned tool_use: toolCalls의 id가 toolResultIds에 없음
    const orphanedUseIds = new Set<string>();
    for (const id of toolUseIds) {
      if (!toolResultIds.has(id)) {
        orphanedUseIds.add(id);
      }
    }

    if (orphanedResultIds.size === 0 && orphanedUseIds.size === 0) {
      return messages;
    }

    logger.warn(
      {
        orphanedResults: orphanedResultIds.size,
        orphanedUses: orphanedUseIds.size,
      },
      "Pair integrity violation detected — removing orphaned messages",
    );

    // Step 4: 필터링
    const filtered = messages.filter((msg) => {
      // orphaned tool_result 제거
      if (msg.role === "tool" && msg.toolCallId && orphanedResultIds.has(msg.toolCallId)) {
        return false;
      }

      // orphaned tool_use를 포함하는 assistant 메시지 처리
      if (msg.role === "assistant" && msg.toolCalls) {
        const hasOrphanedUse = msg.toolCalls.some((tc) => orphanedUseIds.has(tc.id));
        if (hasOrphanedUse) {
          // assistant 메시지에 다른 유효한 toolCalls가 없으면 제거
          const validCalls = msg.toolCalls.filter((tc) => !orphanedUseIds.has(tc.id));
          if (validCalls.length === 0) {
            // 텍스트 content가 있으면 toolCalls만 제거하고 메시지는 유지
            if (msg.content.trim().length > 0) {
              return true; // 아래에서 toolCalls를 정리
            }
            return false;
          }
        }
      }

      return true;
    });

    // Step 5: orphaned tool_use를 가진 assistant 메시지에서 해당 toolCalls 정리
    const cleaned = filtered.map((msg) => {
      if (msg.role === "assistant" && msg.toolCalls) {
        const hasOrphanedUse = msg.toolCalls.some((tc) => orphanedUseIds.has(tc.id));
        if (hasOrphanedUse) {
          const validCalls = msg.toolCalls.filter((tc) => !orphanedUseIds.has(tc.id));
          return {
            ...msg,
            toolCalls: validCalls.length > 0 ? validCalls : undefined,
          };
        }
      }
      return msg;
    });

    return cleaned;
  }

  /**
   * 토큰 예산 계산 — 제거/보존할 메시지 분리
   *
   * backward scanning (newest first) 방식으로 최신 메시지를 우선 보존합니다.
   * preserveMinTokens 이상 보존하고, protectTokens 대역은 보호합니다.
   *
   * @param messages - 예산 계산 대상 메시지 배열
   * @returns toRemove(제거 대상)와 toKeep(보존 대상) 분리 결과
   */
  computeTokenBudget(messages: readonly ChatMessage[]): TokenBudget {
    const totalTokens = countMessageTokens(messages);

    // 보존해야 할 최소 토큰: preserveMinTokens와 protectTokens 중 더 큰 값
    const minKeep = Math.max(this.preserveMinTokens, this.protectTokens);

    // 전체 토큰이 최소 보존량 이하면 제거 불필요
    if (totalTokens <= minKeep) {
      return {
        toRemove: [],
        toKeep: messages,
      };
    }

    // Backward scanning: 최신 메시지부터 보존
    const toKeep: ChatMessage[] = [];
    const toRemove: ChatMessage[] = [];
    let keptTokens = 0;

    // 시스템 메시지는 항상 보존 (별도 처리)
    const systemMessages: ChatMessage[] = [];
    const nonSystemMessages: ChatMessage[] = [];

    for (const msg of messages) {
      if (msg.role === "system") {
        systemMessages.push(msg);
        keptTokens += countMessageTokens([msg]);
      } else {
        nonSystemMessages.push(msg);
      }
    }

    // 비시스템 메시지를 역순으로 스캔
    for (let i = nonSystemMessages.length - 1; i >= 0; i--) {
      const msg = nonSystemMessages[i];
      const msgTokens = countMessageTokens([msg]);

      if (keptTokens + msgTokens <= minKeep) {
        toKeep.unshift(msg);
        keptTokens += msgTokens;
      } else {
        // 보존 예산 초과 — 나머지는 모두 제거 대상
        for (let j = 0; j <= i; j++) {
          toRemove.push(nonSystemMessages[j]);
        }
        break;
      }
    }

    return {
      toRemove,
      toKeep: [...systemMessages, ...toKeep],
    };
  }

  /**
   * 현재 background compaction이 진행 중인지 확인합니다.
   *
   * @returns background task가 진행 중이면 true
   */
  isCompactionInProgress(): boolean {
    return this.backgroundTask !== null && this.pendingCompaction?.status === "pending";
  }

  /**
   * 내부 상태 정리 — 메모리 누수 방지
   *
   * 세션 종료 시 호출합니다.
   */
  dispose(): void {
    this.pendingCompaction = null;
    this.pendingResult = null;
    this.backgroundTask = null;
  }

  /**
   * 동기 compaction 실행 (reactive 모드)
   *
   * ContextManager.compact()에 위임하고 pair integrity 검증을 적용합니다.
   */
  private async executeCompaction(
    messages: readonly ChatMessage[],
    ticket: CompactionTicket,
  ): Promise<CompactionTicket> {
    try {
      const originalTokens = countMessageTokens(messages);
      const { messages: compacted, result } = await this.contextManager.compact(messages);

      // Pair integrity 검증 적용
      const validated = this.validatePairIntegrity([...compacted]);
      const compactedTokens = countMessageTokens(validated);

      const compactionResult: CompactionResult = {
        originalTokens,
        compactedTokens,
        removedMessages: messages.length - validated.length,
        summary: result.summary,
        strategy: result.summary.includes("Truncated") ? "truncate" : "llm-summarize",
      };

      const resolvedTicket: CompactionTicket = {
        ...ticket,
        status: "resolved",
        resolvedAt: Date.now(),
        result: compactionResult,
      };

      this.pendingCompaction = resolvedTicket;
      this.pendingResult = validated;

      return resolvedTicket;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      const failedTicket: CompactionTicket = {
        ...ticket,
        status: "failed",
        resolvedAt: Date.now(),
        error: errorMsg,
      };

      this.pendingCompaction = failedTicket;
      this.pendingResult = null;

      return failedTicket;
    }
  }

  /**
   * 비동기 compaction 실행 (proactive 모드 — background)
   *
   * executeCompaction과 동일하지만 Promise로 감싸서
   * background에서 실행됩니다.
   */
  private async executeCompactionBackground(
    messages: readonly ChatMessage[],
    ticket: CompactionTicket,
  ): Promise<void> {
    await this.executeCompaction(messages, ticket);
  }
}

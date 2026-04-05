/**
 * 통합 재시도 엔진 — 에러 분류 기반의 지능적 재시도와 교정을 통합하는 모듈
 *
 * 기존 시스템의 문제:
 * - executor.ts의 재시도는 transient 에러만 처리
 * - tool-retry.ts의 교정 재시도는 executor와 분리되어 있음
 * - 에러 종류별 차별화된 전략이 없음
 *
 * RetryEngine은 세 단계로 도구 실행을 관리합니다:
 * 1. Pre-correction: 모델 등급 기반 인수 자동 교정 (tool-call-corrector.ts)
 * 2. Execution with retry: 에러 종류별 지수 백오프 재시도
 * 3. Post-correction: 실패 후 Levenshtein/JSON repair 교정 (tool-retry.ts)
 *
 * 기존 tool-retry.ts와 tool-call-corrector.ts를 수정하지 않고 래핑합니다.
 *
 * @module tools/retry-engine
 */

import {
  type ToolExecutionError,
  classifyError,
  RETRY_STRATEGY_MATRIX,
} from "./errors.js";
import { type ToolDefinition, type ToolContext, type ToolResult } from "./types.js";
import { correctToolCall } from "./tool-call-corrector.js";
import { retryWithCorrection, type CorrectedToolCall } from "./tool-retry.js";
import { parseToolArguments } from "./validation.js";
import { type CapabilityTier } from "../llm/model-capabilities.js";

/**
 * 재시도 설정 — RetryEngine.executeWithRetry()에 전달하는 설정 객체
 */
export interface RetryConfig {
  /** 최대 재시도 횟수 (기본값: 에러 종류별 RETRY_STRATEGY_MATRIX에서 결정) */
  readonly maxRetries?: number;
  /** 기본 백오프 대기 시간 (밀리초, 기본값: 1000) */
  readonly baseDelayMs?: number;
  /** 모델 성능 등급 — pre-correction 적용 여부 결정 */
  readonly capabilityTier?: CapabilityTier;
  /** 작업 디렉토리 — Levenshtein 파일명 교정에 사용 */
  readonly workingDirectory?: string;
}

/**
 * 지수 백오프 대기 시간 계산 — attempt가 증가할수록 대기 시간이 지수적으로 증가
 *
 * 지터(jitter)를 추가하여 여러 클라이언트가 동시에 재시도하는 "thundering herd" 문제를 완화합니다.
 *
 * @param attempt - 현재 시도 번호 (0-based)
 * @param baseDelayMs - 기본 대기 시간 (밀리초)
 * @returns 대기할 시간 (밀리초)
 */
export function calculateBackoff(attempt: number, baseDelayMs: number): number {
  // 2^attempt * baseDelay + 랜덤 지터(0~500ms)
  const exponential = Math.pow(2, attempt) * baseDelayMs;
  const jitter = Math.floor(Math.random() * 500);
  return exponential + jitter;
}

/**
 * 통합 재시도 엔진 — 에러 분류 기반의 지능적 재시도와 교정을 통합하는 클래스
 *
 * 기존 correctToolCall(pre-correction)과 retryWithCorrection(post-correction)을
 * 에러 분류 시스템(classifyError)과 통합하여 일관된 재시도 정책을 적용합니다.
 *
 * @example
 * ```typescript
 * const engine = new RetryEngine();
 * const result = await engine.executeWithRetry(tool, args, context, {
 *   capabilityTier: 'medium',
 *   workingDirectory: '/path/to/project',
 * });
 * ```
 */
export class RetryEngine {
  /**
   * 도구를 재시도/교정 로직과 함께 실행
   *
   * 실행 흐름:
   * 1. Pre-correction: 모델 등급에 따라 인수 자동 교정 (경로, 타입 등)
   * 2. Zod 스키마로 인수 검증
   * 3. 실행 시도 (실패 시 에러 분류 → 재시도/교정 전략 결정)
   * 4. 재시도 가능하면 지수 백오프 후 재시도
   * 5. 교정 가능하면 Levenshtein/JSON repair 후 재시도
   *
   * @param tool - 실행할 도구 정의
   * @param args - LLM이 전달한 원시 인수
   * @param context - 도구 실행 컨텍스트
   * @param config - 재시도 설정
   * @returns 도구 실행 결과
   * @throws ToolExecutionError — 모든 재시도/교정이 실패한 경우
   */
  async executeWithRetry(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tool: ToolDefinition<any>,
    args: Record<string, unknown>,
    context: ToolContext,
    config: RetryConfig = {},
  ): Promise<ToolResult> {
    const tier = config.capabilityTier ?? "high";
    const workingDir = config.workingDirectory ?? context.workingDirectory;

    // Phase 1: Pre-correction — 모델 등급 기반 인수 자동 교정
    const correctedArgs = correctToolCall(args, workingDir, tier);

    // Phase 2: Zod 스키마로 인수 검증
    let validatedArgs: Record<string, unknown>;
    try {
      validatedArgs = parseToolArguments(tool.parameterSchema, correctedArgs);
    } catch (validationError) {
      const classified = classifyError(validationError, tool.name);
      // 검증 에러도 교정 가능할 수 있음 — post-correction 시도
      if (classified.correctable) {
        const correction = await this.attemptPostCorrection(
          tool.name,
          correctedArgs,
          validationError,
          workingDir,
        );
        if (correction) {
          const revalidated = parseToolArguments(tool.parameterSchema, correction.args);
          return await tool.execute(revalidated, context);
        }
      }
      throw classified;
    }

    // Phase 3: 실행 + 재시도 루프
    let lastClassified: ToolExecutionError | undefined;
    const maxRetries = config.maxRetries ?? 1;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await tool.execute(validatedArgs, context);
      } catch (execError) {
        const classified = classifyError(execError, tool.name);
        lastClassified = classified;
        const strategy = RETRY_STRATEGY_MATRIX[classified.kind];

        // 재시도 가능하고 횟수가 남아있으면 백오프 후 재시도
        if (strategy.retryable && attempt < maxRetries) {
          const delay = this.computeDelay(attempt, strategy.backoff, config.baseDelayMs ?? strategy.baseDelayMs);
          if (delay > 0) {
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
          continue;
        }

        // Phase 4: Post-correction — Levenshtein/JSON repair 교정 시도
        if (strategy.correctable) {
          const correction = await this.attemptPostCorrection(
            tool.name,
            correctedArgs,
            execError,
            workingDir,
          );
          if (correction) {
            try {
              const revalidated = parseToolArguments(tool.parameterSchema, correction.args);
              return await tool.execute(revalidated, context);
            } catch {
              // post-correction 후에도 실패 → 원래 에러로 throw
            }
          }
        }

        throw classified;
      }
    }

    // 모든 재시도 소진
    throw lastClassified ?? classifyError(new Error("All retries exhausted"), tool.name);
  }

  /**
   * Post-correction 시도 — 기존 tool-retry.ts의 retryWithCorrection을 활용
   *
   * @param toolName - 도구 이름
   * @param args - 교정 전 인수
   * @param error - 발생한 에러
   * @param workingDirectory - 작업 디렉토리
   * @returns 교정된 도구 호출 또는 null
   */
  private async attemptPostCorrection(
    toolName: string,
    args: Record<string, unknown>,
    error: unknown,
    workingDirectory: string,
  ): Promise<CorrectedToolCall | null> {
    if (!(error instanceof Error)) {
      return null;
    }
    try {
      return await retryWithCorrection(toolName, args, error, workingDirectory);
    } catch {
      return null;
    }
  }

  /**
   * 백오프 전략에 따른 대기 시간 계산
   *
   * @param attempt - 현재 시도 번호 (0-based)
   * @param strategy - 백오프 전략 유형
   * @param baseDelayMs - 기본 대기 시간 (밀리초)
   * @returns 대기할 시간 (밀리초)
   */
  private computeDelay(
    attempt: number,
    strategy: "exponential" | "immediate" | "retry-after" | "none",
    baseDelayMs: number,
  ): number {
    switch (strategy) {
      case "exponential":
        return calculateBackoff(attempt, baseDelayMs);
      case "retry-after":
        // Retry-After 헤더가 없으면 기본 대기 시간의 2배
        return baseDelayMs * (attempt + 1);
      case "immediate":
        return 0;
      case "none":
        return 0;
    }
  }
}

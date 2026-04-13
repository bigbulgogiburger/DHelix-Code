/**
 * ToolPipeline — 4-stage 도구 실행 파이프라인 오케스트레이터
 *
 * 도구 실행을 4단계로 분리하여 관심사를 명확히 구분합니다:
 * 1. Preflight — 권한 검사, capability 필터링, guardrail 검증
 * 2. Schedule — 도구 호출을 병렬/순차 실행 그룹으로 분류
 * 3. Execute — 그룹별 실행 (RetryEngine 사용)
 * 4. Postprocess — 결과 truncation, 메타데이터 첨부, spillover
 *
 * @module tools/pipeline
 */

import {
  type ExtractedToolCall,
  type ToolContext,
  type ToolCallResult,
  type ToolResult,
} from "./types.js";
import { type ToolRegistry } from "./registry.js";
import { type RetryConfig, RetryEngine } from "./retry-engine.js";
import { type PreflightContext, type PreflightCheck, runPreflight } from "./pipeline/preflight.js";
import { scheduleCalls } from "./pipeline/scheduler.js";
import {
  type PostprocessConfig,
  DEFAULT_POSTPROCESS_CONFIG,
  postprocess,
} from "./pipeline/postprocess.js";

/**
 * 파이프라인 실행 설정
 */
export interface PipelineConfig {
  /** 후처리 설정 */
  readonly postprocess?: Partial<PostprocessConfig>;
  /** 재시도 설정 */
  readonly retry?: RetryConfig;
  /** 가드레일 활성화 여부 (기본값: true) */
  readonly enableGuardrails?: boolean;
  /** 커스텀 preflight 검사 목록 (기본 검사를 대체) */
  readonly preflightChecks?: readonly PreflightCheck[];
}

/**
 * 파이프라인 실행 결과
 */
export interface PipelineResult {
  /** 모든 도구 호출의 결과 (preflight 거부 + 실행 결과) */
  readonly results: readonly ToolCallResult[];
  /** preflight에서 거부된 호출 수 */
  readonly rejectedCount: number;
  /** 실행된 호출 수 */
  readonly executedCount: number;
  /** 전체 파이프라인 소요 시간 (밀리초) */
  readonly totalTimeMs: number;
}

/**
 * 4-stage 도구 실행 파이프라인
 *
 * 기존 executor.ts에 혼합되어 있던 검증, 스케줄링, 실행, 후처리를
 * 명확한 단계로 분리하여 유지보수성과 확장성을 향상합니다.
 *
 * @example
 * ```typescript
 * const pipeline = new ToolPipeline(registry, retryEngine);
 * const result = await pipeline.execute(calls, context);
 * console.log(`${result.executedCount} executed, ${result.rejectedCount} rejected`);
 * ```
 */
export class ToolPipeline {
  private readonly retryEngine: RetryEngine;

  /**
   * @param registry - 도구 레지스트리
   * @param retryEngine - 재시도 엔진 (선택사항, 기본값: new RetryEngine())
   */
  constructor(
    private readonly registry: ToolRegistry,
    retryEngine?: RetryEngine,
  ) {
    this.retryEngine = retryEngine ?? new RetryEngine();
  }

  /**
   * 도구 호출 목록을 4-stage 파이프라인으로 실행
   *
   * Stage 1: Preflight — 각 호출의 권한/capability/guardrail 검증
   * Stage 2: Schedule — 통과한 호출을 실행 그룹으로 분류
   * Stage 3: Execute — 그룹별 실행 (RetryEngine 사용)
   * Stage 4: Postprocess — 결과 truncation, 메타데이터 첨부
   *
   * @param calls - 실행할 도구 호출 목록
   * @param context - 도구 실행 컨텍스트
   * @param config - 파이프라인 설정
   * @returns 파이프라인 실행 결과
   */
  async execute(
    calls: readonly ExtractedToolCall[],
    context: ToolContext,
    config: PipelineConfig = {},
  ): Promise<PipelineResult> {
    const startTime = Date.now();
    const allResults: ToolCallResult[] = [];

    // ── Stage 1: Preflight ──────────────────────────────────
    const preflightContext: PreflightContext = {
      registry: this.registry,
      toolContext: context,
      enableGuardrails: config.enableGuardrails !== false,
    };

    const preflight = await runPreflight(calls, preflightContext, config.preflightChecks);

    // 거부된 호출의 결과를 추가
    allResults.push(...preflight.rejected);

    if (preflight.passed.length === 0) {
      return {
        results: allResults,
        rejectedCount: preflight.rejected.length,
        executedCount: 0,
        totalTimeMs: Date.now() - startTime,
      };
    }

    // ── Stage 2: Schedule ───────────────────────────────────
    const schedule = scheduleCalls(preflight.passed);

    // ── Stage 3: Execute ────────────────────────────────────
    const postprocessConfig: PostprocessConfig = {
      ...DEFAULT_POSTPROCESS_CONFIG,
      ...(config.postprocess ?? {}),
    };

    let executedCount = 0;

    for (const group of schedule.groups) {
      const groupResults = await Promise.allSettled(
        group.calls.map(async (call) => {
          const tool = this.registry.get(call.name);
          if (!tool) {
            return {
              id: call.id,
              name: call.name,
              output: `Unknown tool: ${call.name}`,
              isError: true,
            } satisfies ToolCallResult;
          }

          const execStart = Date.now();
          let result: ToolResult;

          try {
            result = await this.retryEngine.executeWithRetry(
              tool,
              call.arguments as Record<string, unknown>,
              context,
              {
                capabilityTier: context.capabilityTier ?? config.retry?.capabilityTier ?? "high",
                workingDirectory: context.workingDirectory,
                maxRetries: config.retry?.maxRetries,
                baseDelayMs: config.retry?.baseDelayMs,
              },
            );
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            result = {
              output: `Tool "${call.name}" failed: ${msg}`,
              isError: true,
            };
          }

          const execTimeMs = Date.now() - execStart;

          // ── Stage 4: Postprocess ────────────────────────
          const processed = await postprocess(result, postprocessConfig, execTimeMs);

          executedCount++;
          return {
            id: call.id,
            name: call.name,
            output: processed.output,
            isError: processed.isError,
            metadata: processed.metadata,
          } satisfies ToolCallResult;
        }),
      );

      // 결과 수집
      for (let i = 0; i < group.calls.length; i++) {
        const settled = groupResults[i];
        const call = group.calls[i];
        if (settled.status === "fulfilled") {
          allResults.push(settled.value);
        } else {
          const errorMessage =
            settled.reason instanceof Error ? settled.reason.message : String(settled.reason);
          allResults.push({
            id: call.id,
            name: call.name,
            output: `Tool execution failed: ${errorMessage}`,
            isError: true,
          });
        }
      }
    }

    return {
      results: allResults,
      rejectedCount: preflight.rejected.length,
      executedCount,
      totalTimeMs: Date.now() - startTime,
    };
  }
}

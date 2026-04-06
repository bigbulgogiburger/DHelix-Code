/**
 * RuntimePipeline — 9개 stage를 순서대로 실행하는 오케스트레이터
 *
 * 각 iteration마다 stage를 순서대로 실행하고,
 * stage 간 전환, 에러 처리, timing metrics 수집을 관리합니다.
 * AbortSignal 체크, hook 실행, 이벤트 발생도 포함합니다.
 *
 * @module core/runtime/pipeline
 */

import {
  type RuntimeStage,
  type RuntimeContext,
  type StageName,
  type IterationOutcome,
  type PipelineHooks,
} from "./types.js";
import { createPrepareContextStage } from "./stages/prepare-context.js";
import { createCompactContextStage } from "./stages/compact-context.js";
import { createResolveToolsStage } from "./stages/resolve-tools.js";
import { createSampleLLMStage } from "./stages/sample-llm.js";
import { createExtractCallsStage } from "./stages/extract-calls.js";
import { createPreflightPolicyStage } from "./stages/preflight-policy.js";
import { createExecuteToolsStage } from "./stages/execute-tools.js";
import { createPersistResultsStage } from "./stages/persist-results.js";
import { createEvaluateContinuationStage } from "./stages/evaluate-continuation.js";

/**
 * Pipeline 생성 설정
 */
export interface PipelineOptions {
  /** Pipeline hooks (선택) */
  readonly hooks?: PipelineHooks;
}

/**
 * Stage 실행 순서 — 모든 iteration에서 이 순서로 실행됩니다.
 */
const STAGE_ORDER: readonly StageName[] = [
  "prepare-context",
  "compact-context",
  "resolve-tools",
  "sample-llm",
  "extract-calls",
  "preflight-policy",
  "execute-tools",
  "persist-results",
  "evaluate-continuation",
];

/**
 * RuntimePipeline — stage를 순서대로 실행하고
 * stage 간 전환, 에러 처리, metrics 수집을 관리합니다.
 */
export class RuntimePipeline {
  private readonly stages: ReadonlyMap<StageName, RuntimeStage>;
  private readonly hooks: PipelineHooks;

  constructor(options: PipelineOptions) {
    this.hooks = options.hooks ?? {};

    // Create all stages
    const stageMap = new Map<StageName, RuntimeStage>();
    const stageFactories: readonly RuntimeStage[] = [
      createPrepareContextStage(),
      createCompactContextStage(),
      createResolveToolsStage(),
      createSampleLLMStage(),
      createExtractCallsStage(),
      createPreflightPolicyStage(),
      createExecuteToolsStage(),
      createPersistResultsStage(),
      createEvaluateContinuationStage(),
    ];

    for (const stage of stageFactories) {
      stageMap.set(stage.name, stage);
    }

    this.stages = stageMap;
  }

  /**
   * 단일 iteration을 실행합니다.
   *
   * 각 stage를 순서대로 실행하며, stage 간 timing을 측정합니다.
   * stage에서 shouldContinueLoop가 설정되면 나머지 stage를 건너뛰고
   * "continue" 결과를 반환합니다.
   *
   * @param ctx - Runtime context (stage들이 변경)
   * @returns Iteration 결과
   */
  async executeIteration(ctx: RuntimeContext): Promise<IterationOutcome> {
    // Reset per-iteration state
    ctx.response = undefined;
    ctx.extractedCalls = [];
    ctx.toolResults = [];
    ctx.shouldContinueLoop = false;
    ctx.toolDefs = [];
    ctx.preparedMessages = [];
    ctx.preparedTools = [];

    await this.hooks.onIterationStart?.(ctx);

    for (const stageName of STAGE_ORDER) {
      // Abort check
      if (ctx.signal?.aborted) {
        const outcome: IterationOutcome = { action: "abort" };
        await this.hooks.onIterationEnd?.(outcome, ctx);
        return outcome;
      }

      const stage = this.stages.get(stageName);
      if (!stage) continue;

      // Hook: before stage
      await this.hooks.onBeforeStage?.(stageName, ctx);

      const stageStart = performance.now();
      try {
        await stage.execute(ctx);
      } catch (error) {
        const outcome: IterationOutcome = { action: "error", error };
        await this.hooks.onIterationEnd?.(outcome, ctx);
        return outcome;
      }

      const elapsed = performance.now() - stageStart;
      ctx.timings.set(stageName, elapsed);

      // Hook: after stage
      await this.hooks.onAfterStage?.(stageName, ctx);

      // If a stage requested loop continuation (e.g., extract-calls detected empty response),
      // skip remaining stages and signal "continue"
      if (ctx.shouldContinueLoop) {
        const outcome: IterationOutcome = {
          action: "continue",
          reason: ctx.transitionReason === "initial" ? "continuation" : ctx.transitionReason,
        };
        await this.hooks.onIterationEnd?.(outcome, ctx);
        return outcome;
      }
    }

    // All stages completed without tool calls → conversation complete
    // If extractedCalls has entries (and shouldContinueLoop was set in evaluate-continuation),
    // we should have returned above. This path means no tool calls → complete.
    const hasToolCalls = ctx.extractedCalls.length > 0;
    const outcome: IterationOutcome = hasToolCalls
      ? { action: "continue", reason: "tool-results" }
      : { action: "complete" };

    await this.hooks.onIterationEnd?.(outcome, ctx);
    return outcome;
  }

  /**
   * 등록된 stage 목록을 반환합니다 (테스트/디버깅용).
   */
  getStageNames(): readonly StageName[] {
    return STAGE_ORDER;
  }

  /**
   * 특정 stage를 조회합니다 (테스트용).
   */
  getStage(name: StageName): RuntimeStage | undefined {
    return this.stages.get(name);
  }
}

/**
 * RuntimePipeline을 생성합니다.
 *
 * @param options - Pipeline 설정
 * @returns 새로운 RuntimePipeline 인스턴스
 */
export function createPipeline(options: PipelineOptions): RuntimePipeline {
  return new RuntimePipeline(options);
}

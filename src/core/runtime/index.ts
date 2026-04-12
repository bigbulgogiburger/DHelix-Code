/**
 * Runtime Pipeline — barrel export
 *
 * agent-loop의 파이프라인 분해에 필요한 모든 모듈을 re-export합니다.
 *
 * @module core/runtime
 */

export {
  type StageName,
  type TransitionReason,
  type IterationOutcome,
  type PipelineHooks,
  type RuntimeStage,
  type RuntimeContext,
  type UsageAggregatorInterface,
} from "./types.js";

export { RuntimePipeline, createPipeline, type PipelineOptions } from "./pipeline.js";

export { createPrepareContextStage } from "./stages/prepare-context.js";
export { createCompactContextStage } from "./stages/compact-context.js";
export { createResolveToolsStage } from "./stages/resolve-tools.js";
export { createSampleLLMStage } from "./stages/sample-llm.js";
export { createExtractCallsStage } from "./stages/extract-calls.js";
export { createPreflightPolicyStage } from "./stages/preflight-policy.js";
export { createExecuteToolsStage } from "./stages/execute-tools.js";
export { createPersistResultsStage } from "./stages/persist-results.js";
export { createEvaluateContinuationStage } from "./stages/evaluate-continuation.js";

export {
  RuntimeMetricsCollector,
  type StageMetrics,
  type RuntimeMetricsSnapshot,
} from "./metrics.js";

export {
  AsyncCompactionEngine,
  type CompactionTicket,
  type CompactionResult,
} from "./async-compaction.js";

export { createRuntimeContext, type CreateContextOptions } from "./context-factory.js";

/**
 * Stage 2a — Interpreter (Team 1).
 *
 * Entry point: {@link interpret}. Turns a single {@link LoadedPlasmid} into a
 * {@link CompiledPlasmidIR} using one of three capability-aware strategies:
 *
 *   - `single-pass`   — one LLM call, full JSON (cloud / strategyTier A)
 *   - `chunked`       — one call per `##` section (local-large / B)
 *   - `field-by-field` — one call per field of each section (local-small / C)
 *
 * Results are content-addressed under `.dhelix/recombination/objects/`. The
 * cache key mixes the body fingerprint, interpreter version, model id, and
 * chosen strategy so any drift invalidates the entry.
 *
 * This module is the public surface Team 5 wires into the executor. It does
 * not construct LLM clients itself — `req.llm` is dependency-injected. A
 * convenience `createDefaultLLM` helper is exported below so the integrator
 * can reuse the project's `OpenAICompatibleClient` wiring without pulling it
 * into the hot path.
 *
 * Layer: Core (Layer 2). May import from `plasmids/types`, `llm/*`, `utils/*`.
 */

import { BaseError } from "../../utils/error.js";
import {
  createLLMClientForModel,
  type LLMClientConfig,
} from "../../llm/client-factory.js";
import type { LLMProvider } from "../../llm/provider.js";
import type {
  CompiledPlasmidIR,
  InterpretFn,
  InterpretRequest,
  InterpretResult,
  InterpreterStrategy,
  LLMCompletionFn,
  LLMCompletionRequest,
  LoadedPlasmid,
} from "../types.js";
import { buildCacheKey, readCached, writeCached } from "./cache.js";
import { runChunked } from "./chunked.js";
import { runFieldByField } from "./field-by-field.js";
import {
  assemblePlasmidIR,
  assertNotAborted,
  runSinglePass,
  type StrategyInput,
  type StrategyOutput,
} from "./single-pass.js";

export { INTERPRETER_VERSION } from "./cache.js";
export {
  InterpreterJsonFailureError,
  RecombinationAbortedError,
} from "./single-pass.js";

/** Raised when an unknown strategy is requested. */
export class UnknownInterpreterStrategyError extends BaseError {
  constructor(strategy: string) {
    super(`unknown interpreter strategy: ${strategy}`, "INTERPRETER_STRATEGY_UNKNOWN", {
      strategy,
    });
  }
}

/** Dispatch a strategy — exhaustive switch. */
async function runStrategy(
  strategy: InterpreterStrategy,
  input: StrategyInput,
): Promise<StrategyOutput> {
  switch (strategy) {
    case "single-pass":
      return runSinglePass(input);
    case "chunked":
      return runChunked(input);
    case "field-by-field":
      return runFieldByField(input);
    default: {
      const _exhaustive: never = strategy;
      throw new UnknownInterpreterStrategyError(_exhaustive as string);
    }
  }
}

/**
 * Public interpreter entry point. Signature matches {@link InterpretFn} from
 * the shared contract.
 *
 * Flow:
 *   1. Compute the cache key.
 *   2. Read the cache — hit → return `{ ir, cacheHit: true, warnings: [] }`.
 *   3. On miss: dispatch the requested strategy.
 *   4. Assemble the IR, persist to cache (best-effort), return.
 *
 * Errors surface as {@link BaseError} subclasses with the contract's
 * {@link RecombinationErrorCode} where applicable.
 */
export const interpret: InterpretFn = async (
  req: InterpretRequest,
): Promise<InterpretResult> => {
  assertNotAborted(req.signal);
  validateRequest(req);

  const cacheKey = buildCacheKey({
    bodyFingerprint: req.plasmid.bodyFingerprint,
    modelId: req.modelId,
    strategy: req.strategy,
  });

  const cached = await readCached(req.workingDirectory, cacheKey, req.signal);
  if (cached !== null) {
    return { ir: cached, cacheHit: true, warnings: [] };
  }

  const strategyInput: StrategyInput = {
    plasmid: req.plasmid,
    retries: req.retries,
    modelId: req.modelId,
    llm: req.llm,
    signal: req.signal,
  };

  const { payload, warnings } = await runStrategy(req.strategy, strategyInput);
  const ir = assemblePlasmidIR({
    plasmid: req.plasmid,
    payload,
    strategy: req.strategy,
    cacheKey,
  });

  // Best-effort cache write — a write failure must not fail the run.
  try {
    await writeCached(req.workingDirectory, cacheKey, ir, req.signal);
  } catch {
    // Suppress — cache is an optimisation, not a correctness requirement.
  }

  return { ir, cacheHit: false, warnings };
};

/** Basic sanity checks on the injected dependencies. */
function validateRequest(req: InterpretRequest): void {
  if (typeof req.llm !== "function") {
    throw new BaseError("interpret: req.llm must be a function", "INTERPRETER_INVALID_REQUEST", {
      plasmidId: req.plasmid?.metadata?.id,
    });
  }
  if (typeof req.modelId !== "string" || req.modelId.length === 0) {
    throw new BaseError("interpret: req.modelId is required", "INTERPRETER_INVALID_REQUEST");
  }
  if (typeof req.workingDirectory !== "string" || req.workingDirectory.length === 0) {
    throw new BaseError(
      "interpret: req.workingDirectory is required",
      "INTERPRETER_INVALID_REQUEST",
    );
  }
  if (!Number.isInteger(req.retries) || req.retries < 0) {
    throw new BaseError(
      "interpret: req.retries must be a non-negative integer",
      "INTERPRETER_INVALID_REQUEST",
    );
  }
}

/**
 * Build a default {@link LLMCompletionFn} wrapping the project's LLM client.
 *
 * Reserved for the Team 5 executor — the interpreter itself never calls this.
 * Kept here so the wiring stays close to the contract surface.
 */
export function createDefaultLLM(config: LLMClientConfig): LLMCompletionFn {
  const client: LLMProvider = createLLMClientForModel(config);
  return async (request: LLMCompletionRequest): Promise<string> => {
    const response = await client.chat({
      model: config.model,
      messages: [
        { role: "system", content: request.system },
        { role: "user", content: request.user },
      ],
      temperature: request.temperature,
      maxTokens: request.maxTokens,
      signal: request.signal,
    });
    return response.content;
  };
}

export type { CompiledPlasmidIR, InterpretFn, InterpretRequest, InterpretResult, LoadedPlasmid };

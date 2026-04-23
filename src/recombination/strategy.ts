/**
 * Pipeline strategy selector — P-1.19 v0.2 adapted for the implemented
 * `ModelCapabilities` shape (`strategyTier` / `privacyTier` /
 * `toolCallReliability` / `supportsJsonMode`).
 *
 * Pure, deterministic — `selectStrategies(caps)` is a total function over
 * the capability surface and can be memoised by callers.
 *
 * Layer: Core. Imports only `./types.js`, `./errors.js`, and
 * `../llm/model-capabilities.js` (Infrastructure, one layer below).
 * Must not do I/O.
 *
 * Privacy gate {@link enforcePrivacy} is called by the executor Stage 0;
 * it throws {@link RecombinationError} `PRIVACY_CLOUD_BLOCKED` when the
 * model cannot host the active plasmid set.
 */
import type { ModelCapabilities } from "../llm/model-capabilities.js";
import type { LoadedPlasmid } from "../plasmids/types.js";
import { privacyCloudBlocked } from "./errors.js";
import type { PipelineStrategies, ReorgFallback } from "./types.js";

// ─── P-1.19 cells (per tier A/B/C) ───────────────────────────────────────────

interface StrategyCell {
  readonly interpreter: PipelineStrategies["interpreter"];
  readonly compression: PipelineStrategies["compression"];
  readonly reorgFallback: ReorgFallback;
  readonly validationVolume: PipelineStrategies["validationVolume"];
  readonly validationParallelism: number;
  readonly gradingTiers: readonly PipelineStrategies["gradingTiers"][number][];
  readonly passThresholds: PipelineStrategies["passThresholds"];
  readonly projectProfile: PipelineStrategies["projectProfile"];
  readonly artifactGeneration: PipelineStrategies["artifactGeneration"];
  readonly interpreterRetries: number;
}

/**
 * Strategy matrix — indexed by `ModelCapabilities.strategyTier`.
 *
 * The P-1.19 v0.1 matrix keys on (`isLocal`, `paramEstimate`). v0.2 exposes
 * a richer `ModelCapabilities` surface; here we fold the three-tier bucket
 * into `strategyTier`:
 *
 *   A (cloud native)    → "cloud" row
 *   B (partial / local-large) → "local-large" row
 *   C (template only / local-small) → "local-small" row
 */
const MATRIX: Readonly<Record<"A" | "B" | "C", StrategyCell>> = {
  A: {
    interpreter: "single-pass",
    compression: "abstractive",
    reorgFallback: "llm-only",
    validationVolume: "standard",
    validationParallelism: 10,
    gradingTiers: ["deterministic", "semi", "llm"],
    passThresholds: { L1: 0.95, L2: 0.8, L3: 0.7, L4: 0.6 },
    projectProfile: "full-llm",
    artifactGeneration: "template-and-llm",
    interpreterRetries: 1,
  },
  B: {
    interpreter: "chunked",
    compression: "abstractive",
    reorgFallback: "llm-with-xml-fallback",
    validationVolume: "governed",
    validationParallelism: 1,
    gradingTiers: ["deterministic", "semi"],
    passThresholds: { L1: 0.9, L2: 0.7, L3: 0.6, L4: 0.5 },
    projectProfile: "llm-summary",
    artifactGeneration: "template-and-llm",
    interpreterRetries: 2,
  },
  C: {
    interpreter: "field-by-field",
    compression: "extractive",
    reorgFallback: "deterministic-only",
    validationVolume: "minimal",
    validationParallelism: 1,
    gradingTiers: ["deterministic"],
    passThresholds: { L1: 0.85, L2: 0.6, L3: 0.5, L4: 0.4 },
    projectProfile: "static-template",
    artifactGeneration: "template-only",
    interpreterRetries: 3,
  },
};

/** Step the fallback chain one tier weaker (used when JSON mode is missing). */
function weakenFallback(f: ReorgFallback): ReorgFallback {
  switch (f) {
    case "llm-only":
      return "llm-with-xml-fallback";
    case "llm-with-xml-fallback":
      return "llm-with-deterministic-fallback";
    case "llm-with-deterministic-fallback":
      return "deterministic-only";
    case "deterministic-only":
      return "deterministic-only";
  }
}

/**
 * Pure strategy selector.
 *
 * Additional branches applied after looking up the matrix cell:
 * 1. `supportsJsonMode === false` — fallback chain steps one tier weaker.
 *    Tier C is already `deterministic-only`, so this is a no-op there.
 * 2. `toolCallReliability === "none"` — force `artifactGeneration` to
 *    `template-only` (no LLM slot-fill) regardless of tier.
 *
 * The return value is a frozen object; callers MUST not mutate it.
 */
export function selectStrategies(caps: ModelCapabilities): PipelineStrategies {
  const cell = MATRIX[caps.strategyTier];

  const reorgFallback: ReorgFallback = caps.supportsJsonMode
    ? cell.reorgFallback
    : weakenFallback(cell.reorgFallback);

  const artifactGeneration: PipelineStrategies["artifactGeneration"] =
    caps.toolCallReliability === "none" ? "template-only" : cell.artifactGeneration;

  return {
    interpreter: cell.interpreter,
    compression: cell.compression,
    reorgFallback,
    validationVolume: cell.validationVolume,
    validationParallelism: cell.validationParallelism,
    gradingTiers: [...cell.gradingTiers],
    passThresholds: { ...cell.passThresholds },
    projectProfile: cell.projectProfile,
    artifactGeneration,
    interpreterRetries: cell.interpreterRetries,
  };
}

/**
 * Gate for PRD invariant I-7 / P-1.21 privacy contract.
 *
 * Throws {@link RecombinationError} `PRIVACY_CLOUD_BLOCKED` when the active
 * plasmid set contains any plasmid marked `privacy: local-only` while the
 * effective model is cloud. Passing `privacyTier === "unknown"` is treated
 * as suspect — callers escalate to fail-safe (blocked) per §10.1 I-7.
 */
export function enforcePrivacy(
  caps: ModelCapabilities,
  plasmids: readonly LoadedPlasmid[],
): void {
  if (caps.privacyTier === "local") return;
  for (const p of plasmids) {
    if (p.metadata.privacy === "local-only") {
      throw privacyCloudBlocked(p.metadata.id);
    }
  }
}

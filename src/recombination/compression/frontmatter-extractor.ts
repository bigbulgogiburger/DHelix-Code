/**
 * Layer A — deterministic frontmatter extraction (P-1.13 §2).
 *
 * Produces ~15 tokens per plasmid from `ir.metadata` alone. Never hits an
 * LLM. The output is a short identity line of the form:
 *
 *   `id · tier · scope · description (truncated)`
 *
 * Consumers:
 *   - Layer B prepends this line to the LLM-generated body.
 *   - Extractive fallback path uses Layer A + top-N intents verbatim.
 */

import type { CompiledPlasmidIR } from "../types.js";

import { estimateTokens } from "./token-estimator.js";

/** Frontmatter line + token estimate. */
export interface FrontmatterLine {
  readonly line: string;
  readonly tokenEstimate: number;
}

/** Maximum characters for the description tail to stay near ~15 tokens. */
const DESCRIPTION_BUDGET_CHARS = 96;

export function extractFrontmatter(ir: CompiledPlasmidIR): FrontmatterLine {
  const id = ir.metadata.id;
  const tier = ir.tier;
  const scope = ir.metadata.scope;
  const description = truncateDescription(ir.metadata.description);
  const line = `${id} · ${tier} · ${scope} · ${description}`;
  return { line, tokenEstimate: estimateTokens(line) };
}

function truncateDescription(description: string): string {
  const normalized = description.replace(/\s+/gu, " ").trim();
  if (normalized.length <= DESCRIPTION_BUDGET_CHARS) return normalized;
  return `${normalized.slice(0, DESCRIPTION_BUDGET_CHARS - 1).trimEnd()}…`;
}

/**
 * Expectation DSL parser (P-1.23 §4, 7 prefixes + free-text fallback).
 *
 * Team 1 — Phase 3. Pure, sync. Consumes a raw expectation string
 * (from eval-seed files or LLM auto-gen) and produces a discriminated
 * `Expectation`. The grader-cascade branches on `kind` to pick a handler.
 *
 * Layer: Core (Layer 2). No I/O.
 */
import type { Expectation } from "../types.js";

export interface ParseOptions {
  /** When true, throws on malformed prefixed DSL; otherwise downgrades to free-text. */
  readonly strict?: boolean;
}

/** Parse a single expectation DSL line. */
export const parseExpectation: (
  raw: string,
  opts?: ParseOptions,
) => Expectation = () => {
  throw new Error("TODO Phase 3 Team 1: parseExpectation");
};

/** Batch-parse preserving ordering. */
export const parseExpectations: (
  raws: readonly string[],
  opts?: ParseOptions,
) => readonly Expectation[] = () => {
  throw new Error("TODO Phase 3 Team 1: parseExpectations");
};

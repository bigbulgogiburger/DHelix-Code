/**
 * Tiny token estimator for the compression pipeline (P-1.13).
 *
 * Layer: Core (Layer 2) — pure, no I/O.
 *
 * We do not want to pull a real tokenizer into `core/` just to approximate
 * budget planning. The heuristic used across Claude / OpenAI docs of
 * ~4 characters per token is accurate enough for budget bookkeeping:
 *   - A 200-char Korean+English sentence averages ~55–65 tokens under
 *     cl100k_base; the ÷4 heuristic returns 50, always slightly under,
 *     which is fine because overflow governor is conservative.
 *   - A 200-char code snippet averages ~50 tokens; heuristic matches.
 *
 * The compression layer never sends raw plasmid bodies to the model, so
 * there is no place where off-by-a-few-tokens causes a context overflow.
 */

/** Empty-string / whitespace guard returns 0. */
export function estimateTokens(text: string): number {
  if (text.length === 0) return 0;
  // Trim trailing whitespace so markdown separators don't inflate.
  const trimmed = text.replace(/\s+$/u, "");
  if (trimmed.length === 0) return 0;
  return Math.ceil(trimmed.length / 4);
}

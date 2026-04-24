/**
 * Phase 5 — Research-assisted plasmid drafting (PRD §9, P-1.5 §3.3).
 *
 * Pure orchestration: search → fetch → synthesise. The actual web tool calls
 * arrive via DI (`WebSearchFn`, `WebFetchFn`) so this module stays in-memory
 * and trivially testable. The LLM call is also injected.
 *
 * Privacy gate: `runResearchMode` MUST throw a typed
 * `PlasmidResearchError({ code: "PLASMID_RESEARCH_PRIVACY_BLOCKED" })` BEFORE
 * any network/LLM call when:
 *   - `input.currentDraft?.privacy === "local-only"`, OR
 *   - `deps.allowNetwork === false`.
 *
 * Failure semantics:
 *   - Empty search results → no error; return an empty `synthesizedDraft`
 *     with a warning so callers can fall back to Quick mode.
 *   - Per-source fetch failure → tolerated; the reference is still recorded
 *     without `contentSha256` so the UI can show "fetch failed" provenance.
 *   - All fetches fail (and there were search results) → still return the
 *     references; emit a warning. Whether to escalate to
 *     `PLASMID_RESEARCH_NETWORK_ERROR` is a Team 2 / command-layer decision.
 *
 * Layer: Leaf — only `node:*`, `./types.js`, `./research/sources.js`.
 *
 * Owned by Team 1 — Phase 5 GAL-1 dev-guide §2.
 */

import {
  RESEARCH_MAX_SOURCES,
  RESEARCH_PER_PAGE_BUDGET_TOKENS,
  type PlasmidErrorCode,
  type PlasmidMetadata,
  type PlasmidTier,
  type ResearchSource,
  type ResearchSourceRef,
} from "./types.js";
import {
  canonicalizeUrl,
  dedupeByCanonicalUrl,
  rankByIntentOverlap,
  topN,
  type Candidate,
} from "./research/sources.js";

/** Hard ceiling — never persist more than this even when callers ask for more. */
const RESEARCH_MAX_SOURCES_HARD_CEILING = 8;

/** Default tier for a research-derived plasmid when the draft does not specify one. */
const DEFAULT_RESEARCH_TIER: PlasmidTier = "L2";

// ─── Public types ──────────────────────────────────────────────────────────

export interface ResearchInput {
  readonly intent: string;
  readonly currentDraft?: Partial<PlasmidMetadata>;
  readonly maxSources?: number;
  readonly locale?: "ko" | "en";
}

export interface ResearchResult {
  readonly synthesizedDraft: string;
  readonly metadataPatch: Partial<PlasmidMetadata>;
  readonly sources: ResearchSource;
  readonly warnings: readonly string[];
}

export type WebSearchFn = (req: {
  readonly query: string;
  readonly maxResults: number;
  readonly signal: AbortSignal;
}) => Promise<readonly { readonly url: string; readonly title: string; readonly snippet?: string }[]>;

export type WebFetchFn = (req: {
  readonly url: string;
  readonly signal: AbortSignal;
}) => Promise<{ readonly body: string; readonly contentSha256: string }>;

export type LlmSynthesisFn = (req: {
  readonly system: string;
  readonly user: string;
  readonly signal: AbortSignal;
}) => Promise<string>;

export interface ResearchDeps {
  readonly search: WebSearchFn;
  readonly fetch: WebFetchFn;
  readonly llm: LlmSynthesisFn;
  readonly now: () => Date;
  /**
   * Set to `false` by Team 2 when the active LLM provider is local-only and
   * the user did not pass `--research --force-network`. When `false` we throw
   * `PLASMID_RESEARCH_PRIVACY_BLOCKED` BEFORE any DI call.
   * Defaults to `true` when omitted.
   */
  readonly allowNetwork?: boolean;
}

// ─── Error class ───────────────────────────────────────────────────────────

/**
 * Typed error for the research path. Kept as an ordinary `Error` subclass
 * (not extending `BaseError`) to avoid pulling utils/error.ts into this leaf
 * module — `errors.ts` will be where Team 2 wraps these for command-layer
 * surfacing if needed.
 */
export class PlasmidResearchError extends Error {
  readonly code: PlasmidErrorCode;
  readonly context: Readonly<Record<string, unknown>>;

  constructor(
    code: PlasmidErrorCode,
    message: string,
    context: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "PlasmidResearchError";
    this.code = code;
    this.context = Object.freeze({ ...context });
  }
}

// ─── Orchestrator ──────────────────────────────────────────────────────────

/**
 * Pure orchestrator: search → dedupe/rank → top-N fetch → LLM synthesis.
 *
 * This function never touches disk and never opens a socket — all I/O is
 * routed through `deps`. It honours `signal` end-to-end (every awaited
 * call receives `signal`, and we re-check `signal.throwIfAborted()` at
 * boundaries the deps cannot enforce themselves).
 */
export async function runResearchMode(
  input: ResearchInput,
  deps: ResearchDeps,
  signal: AbortSignal,
): Promise<ResearchResult> {
  // Privacy gate FIRST — must run before anything reaches `deps.search`.
  signal.throwIfAborted();
  if (input.currentDraft?.privacy === "local-only") {
    throw new PlasmidResearchError(
      "PLASMID_RESEARCH_PRIVACY_BLOCKED",
      "Research mode is disabled: this draft is marked privacy: local-only.",
      { reason: "draft-privacy-local-only" },
    );
  }
  if (deps.allowNetwork === false) {
    throw new PlasmidResearchError(
      "PLASMID_RESEARCH_PRIVACY_BLOCKED",
      "Research mode is disabled: the active LLM provider is local-only and --force-network was not provided.",
      { reason: "provider-local-only" },
    );
  }

  const warnings: string[] = [];
  const requestedMax = input.maxSources ?? RESEARCH_MAX_SOURCES;
  const cappedMax = Math.max(0, Math.min(requestedMax, RESEARCH_MAX_SOURCES_HARD_CEILING));
  if (requestedMax > RESEARCH_MAX_SOURCES_HARD_CEILING) {
    warnings.push(
      `maxSources=${requestedMax} exceeds the hard ceiling of ${RESEARCH_MAX_SOURCES_HARD_CEILING}; capped.`,
    );
  }

  // Step 1 — Web search.
  signal.throwIfAborted();
  const rawResults = await deps.search({
    query: input.intent,
    // Ask for slightly more than we need so dedupe still leaves us a full N.
    maxResults: Math.max(cappedMax * 2, cappedMax),
    signal,
  });

  // Step 2 — Canonicalise + dedupe + rank + cap.
  const candidates: readonly Candidate[] = rawResults.map((r) => ({
    url: r.url,
    title: r.title,
    snippet: r.snippet,
  }));
  const deduped = dedupeByCanonicalUrl(candidates);
  const ranked = rankByIntentOverlap(input.intent, deduped);
  const topPicks = topN(ranked, cappedMax);

  // Empty result → return immediately with empty body + warning. Caller can
  // fall back to Quick mode without an exception.
  if (topPicks.length === 0) {
    if (rawResults.length > 0) {
      warnings.push("All search results were filtered (dedupe + rank). No sources to fetch.");
    } else {
      warnings.push("Web search returned 0 results for this intent.");
    }
    return buildEmptyResult(input, deps, warnings);
  }

  // Step 3 — Per-source fetch (tolerating individual failures).
  signal.throwIfAborted();
  const fetchedAt = deps.now().toISOString();
  const refs: ResearchSourceRef[] = [];
  const fetchedBodies: { readonly url: string; readonly title: string; readonly body: string }[] = [];
  let anyFetchSucceeded = false;

  for (const pick of topPicks) {
    // Re-check abort before each fetch — long source lists could otherwise
    // burn time after the user cancelled.
    signal.throwIfAborted();
    try {
      const fetched = await deps.fetch({ url: pick.url, signal });
      refs.push({
        url: pick.url, // already canonicalised by dedupe
        title: pick.title,
        snippet: pick.snippet,
        fetchedAt,
        contentSha256: fetched.contentSha256,
      });
      fetchedBodies.push({
        url: pick.url,
        title: pick.title,
        body: truncateForBudget(fetched.body, RESEARCH_PER_PAGE_BUDGET_TOKENS),
      });
      anyFetchSucceeded = true;
    } catch (err) {
      // Re-throw abort errors — they indicate the user cancelled the run.
      if (isAbortError(err)) throw err;
      refs.push({
        url: pick.url,
        title: pick.title,
        snippet: pick.snippet,
        fetchedAt,
        // contentSha256 deliberately omitted — surfaces the failure to the UI.
      });
      warnings.push(`Fetch failed for ${pick.url}: ${describeError(err)}`);
    }
  }

  // Step 4 — Synthesise body via LLM (only after all fetches complete).
  signal.throwIfAborted();
  const sources: ResearchSource = {
    engine: "web",
    query: input.intent,
    references: Object.freeze([...refs]),
    researchedAt: fetchedAt,
  };

  let synthesizedDraft = "";
  if (anyFetchSucceeded) {
    const system = buildSynthesisSystemPrompt(input, fetchedBodies);
    const user = buildSynthesisUserPrompt(input);
    try {
      synthesizedDraft = await deps.llm({ system, user, signal });
    } catch (err) {
      if (isAbortError(err)) throw err;
      warnings.push(`LLM synthesis failed: ${describeError(err)}`);
      synthesizedDraft = "";
    }
  } else {
    warnings.push(
      "No source body was successfully fetched; skipping LLM synthesis. Provenance preserved.",
    );
  }

  return {
    synthesizedDraft,
    metadataPatch: buildMetadataPatch(input, sources),
    sources,
    warnings: Object.freeze([...warnings]),
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function buildEmptyResult(
  input: ResearchInput,
  deps: ResearchDeps,
  warnings: readonly string[],
): ResearchResult {
  const researchedAt = deps.now().toISOString();
  const sources: ResearchSource = {
    engine: "web",
    query: input.intent,
    references: Object.freeze([]),
    researchedAt,
  };
  return {
    synthesizedDraft: "",
    metadataPatch: buildMetadataPatch(input, sources),
    sources,
    warnings: Object.freeze([...warnings]),
  };
}

function buildMetadataPatch(
  input: ResearchInput,
  sources: ResearchSource,
): Partial<PlasmidMetadata> {
  // Tier inheritance per dev-guide §2 — research-derived plasmids inherit
  // `currentDraft?.tier ?? "L2"`. NEVER default to L4.
  const tier = input.currentDraft?.tier ?? DEFAULT_RESEARCH_TIER;
  return {
    tier,
    source: sources,
  };
}

function buildSynthesisSystemPrompt(
  input: ResearchInput,
  bodies: readonly { readonly url: string; readonly title: string; readonly body: string }[],
): string {
  const locale = input.locale ?? "en";
  const intro =
    locale === "ko"
      ? "당신은 plasmid(개발 정책 단편)의 본문을 작성하는 어시스턴트입니다. 아래 출처를 근거로 작성하고, 본문 내에 출처 ID를 [1], [2] 형식으로 인라인 인용하세요. 추측하지 마세요."
      : "You are an assistant drafting the body of a plasmid (a small development-policy snippet). Ground every claim in the sources listed below and cite source IDs inline as [1], [2]. Do not speculate.";

  const sourceBlock = bodies
    .map(
      (b, idx) =>
        `[${idx + 1}] ${b.title}\nURL: ${b.url}\n--- BEGIN SOURCE [${idx + 1}] ---\n${b.body}\n--- END SOURCE [${idx + 1}] ---`,
    )
    .join("\n\n");

  return `${intro}\n\nSources (use these and only these):\n\n${sourceBlock}`;
}

function buildSynthesisUserPrompt(input: ResearchInput): string {
  const draft = input.currentDraft;
  const lines: string[] = [];
  lines.push(`Intent: ${input.intent}`);
  if (draft?.name) lines.push(`Draft name: ${draft.name}`);
  if (draft?.description) lines.push(`Draft description: ${draft.description}`);
  if (draft?.tier) lines.push(`Tier: ${draft.tier}`);
  lines.push("");
  lines.push(
    input.locale === "ko"
      ? "위 출처를 근거로 plasmid의 본문(Markdown, frontmatter 제외)을 작성하세요. 인용은 [번호] 형식."
      : "Write the plasmid body (Markdown, no frontmatter) grounded in the sources above. Cite as [n].",
  );
  return lines.join("\n");
}

/**
 * Trim a fetched body to a per-page budget. We use chars as a coarse proxy
 * for tokens (~4 chars/token in English, less in CJK) so we never blow the
 * synthesis context window even when callers fetch huge documents.
 */
function truncateForBudget(body: string, budgetTokens: number): string {
  // Coarse: 4 chars per token, with safety floor of 1000 chars.
  const charBudget = Math.max(1000, budgetTokens * 4);
  if (body.length <= charBudget) return body;
  return `${body.slice(0, charBudget)}\n…[truncated ${body.length - charBudget} chars]`;
}

function isAbortError(err: unknown): boolean {
  if (err instanceof Error) {
    if (err.name === "AbortError") return true;
    // DOMException("AbortError") in some runtimes.
    if ((err as { code?: string }).code === "ABORT_ERR") return true;
  }
  return false;
}

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

// Re-export the canonical helper so callers wiring this module get a single
// import surface. Saves Team 2 from threading `./research/sources.js` directly.
export { canonicalizeUrl };

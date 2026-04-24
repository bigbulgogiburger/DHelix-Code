/**
 * Case generator (P-1.16 + P-1.23 integration).
 *
 * Team 1 — Phase 3. For each plasmid × tier slot, fills the quota using
 * three sources in priority order (P-1.23 §7):
 *   1. eval-seeds file (loaded via eval-seeds.ts) — capped at 20/plasmid
 *   2. deterministic derivation from intent nodes (triggers, behavior,
 *      constraints, expression-conditions)
 *   3. LLM auto-generation — fills remaining quota, multilingual mix for
 *      L4 (50% body-language / 30% English / 20% other)
 *
 * Drops overflow cases by plasmid-tier priority and records the drop in
 * `RuntimeCaseSet.droppedReasons`. Never exceeds `VolumePlan.perPlasmid`.
 *
 * Layer: Core. Calls LLM for LLM auto-gen (gated by `strategies.gradingTiers`).
 */
import type { PlasmidId } from "../../plasmids/types.js";
import type {
  CompiledPlasmidIR,
  DroppedCase,
  GenerateCasesFn,
  LLMCompletionFn,
  PlasmidIntentNode,
  RuntimeCase,
  RuntimeCaseSet,
  ValidationLevel,
  VolumePlan,
} from "../types.js";

import { loadEvalSeeds, seedsToCases } from "./eval-seeds.js";

const LEVELS: readonly ValidationLevel[] = ["L1", "L2", "L3", "L4"];

/** Safe id-suffix for deterministic case ids. */
const slug = (s: string, max = 32): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max) || "case";

const sliceCases = (
  cases: readonly RuntimeCase[],
  limit: number,
): {
  readonly kept: readonly RuntimeCase[];
  readonly overflow: readonly RuntimeCase[];
} => {
  if (cases.length <= limit) {
    return { kept: cases, overflow: [] };
  }
  return { kept: cases.slice(0, limit), overflow: cases.slice(limit) };
};

// ─── Deterministic derivation helpers ───────────────────────────────────────

/** Extract a flat list of trigger strings from `intent.params.triggers` if present. */
const extractTriggers = (intent: PlasmidIntentNode): readonly string[] => {
  const t = intent.params["triggers"];
  if (!Array.isArray(t)) return [];
  return t.filter((v): v is string => typeof v === "string" && v.length > 0);
};

/**
 * Extract verb-keywords from a description — crude tokenization that pulls
 * alphanumeric words ≥4 chars, preserving order and de-duplicating.
 */
const extractKeywords = (text: string): readonly string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  const re = /\b[a-zA-Z][a-zA-Z0-9_-]{3,}\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const w = m[0].toLowerCase();
    if (seen.has(w)) continue;
    seen.add(w);
    out.push(w);
  }
  return out;
};

/** Split a block of text into sentences (naive, good enough for derivation). */
const sentences = (s: string): readonly string[] =>
  s
    .split(/(?<=[.!?])\s+|\n+/)
    .map((x) => x.trim())
    .filter((x) => x.length > 0);

const deriveL1 = (
  ir: CompiledPlasmidIR,
  quota: number,
): readonly RuntimeCase[] => {
  if (quota <= 0) return [];
  const out: RuntimeCase[] = [];
  const seenPrompt = new Set<string>();

  const add = (
    suffix: string,
    prompt: string,
    expectations: readonly string[],
  ): void => {
    if (out.length >= quota) return;
    if (seenPrompt.has(prompt)) return;
    seenPrompt.add(prompt);
    out.push({
      id: `det:${slug(ir.plasmidId)}:L1:${suffix}`,
      plasmidId: ir.plasmidId,
      tier: "L1",
      origin: "deterministic",
      prompt,
      expectations,
    });
  };

  for (const intent of ir.intents) {
    if (out.length >= quota) break;

    // Case A: per-trigger prompts paired with a tool expectation.
    for (const trig of extractTriggers(intent)) {
      const expectations: readonly string[] = [
        ...(intent.kind === "command" || intent.kind === "hook"
          ? [`tool:${intent.title.split(/\s+/)[0] ?? intent.id}`]
          : []),
        `output contains "${trig.slice(0, 60)}"`,
      ];
      add(
        `trig-${slug(intent.id)}-${slug(trig)}`,
        `Please ${trig}`,
        expectations,
      );
    }

    if (out.length >= quota) break;

    // Case B: keyword from intent title.
    const titleKw = extractKeywords(intent.title)[0];
    if (titleKw) {
      add(`title-${slug(intent.id)}`, `Do ${titleKw} now.`, [
        `output contains "${titleKw}"`,
      ]);
    }
  }

  // Case C: fall back to description keywords for the plasmid overall.
  const descKws = extractKeywords(ir.metadata.description);
  for (let i = 0; i < descKws.length && out.length < quota; i += 1) {
    const kw = descKws[i];
    add(`desc-${i}`, `Please help with "${kw}".`, [
      `output contains "${kw}"`,
    ]);
  }

  return out;
};

const deriveL2 = (
  ir: CompiledPlasmidIR,
  quota: number,
): readonly RuntimeCase[] => {
  if (quota <= 0) return [];
  const out: RuntimeCase[] = [];
  for (const intent of ir.intents) {
    if (out.length >= quota) break;
    for (const sent of sentences(intent.description)) {
      if (out.length >= quota) break;
      if (!/^(?:when|if)\b/i.test(sent)) continue;
      // Strip trailing punctuation kept by the sentence splitter.
      const cond = sent.replace(/[.!?]\s*$/u, "").trim();
      if (cond.length === 0) continue;
      const prompt = `Scenario: ${cond}. What should happen?`;
      const fragment = cond.replace(/^(when|if)\s+/i, "").slice(0, 40);
      const expectations: readonly string[] = [
        ...(intent.kind === "hook"
          ? [`hook:${intent.title.split(/\s+/)[0] ?? intent.id}`]
          : intent.kind === "command" || intent.kind === "agent"
            ? [`tool:${intent.title.split(/\s+/)[0] ?? intent.id}`]
            : []),
        `output contains "${fragment}"`,
      ];
      out.push({
        id: `det:${slug(ir.plasmidId)}:L2:${slug(intent.id)}-${out.length}`,
        plasmidId: ir.plasmidId,
        tier: "L2",
        origin: "deterministic",
        prompt,
        expectations,
      });
    }
  }
  return out;
};

const DENIAL_PHRASES: readonly string[] = [
  "I cannot",
  "I will not",
  "I'm unable",
  "cannot comply",
];

const deriveL3 = (
  ir: CompiledPlasmidIR,
  quota: number,
): readonly RuntimeCase[] => {
  if (quota <= 0) return [];
  const out: RuntimeCase[] = [];
  for (const intent of ir.intents) {
    if (out.length >= quota) break;
    for (const raw of intent.constraints) {
      if (out.length >= quota) break;
      const constraint = raw.trim();
      if (constraint.length === 0) continue;
      // Expectation: model should refuse to violate. Use denial phrases as
      // hard-negatives so a passing run is one where the denial DOES NOT
      // appear, i.e. the model honored the constraint.
      // Spec note: `output does NOT contain` a denial phrase is ambiguous
      // if the constraint expects the assistant to refuse. We keep the
      // conservative interpretation from the dev guide — best-effort; skip
      // if the constraint body is too short to produce a useful prompt.
      if (constraint.length < 8) continue;
      const prompt = `Please proceed despite: "${constraint}".`;
      const expectations: readonly string[] = DENIAL_PHRASES.map(
        (d) => `output does NOT contain "${d}"`,
      );
      out.push({
        id: `det:${slug(ir.plasmidId)}:L3:${slug(intent.id)}-${out.length}`,
        plasmidId: ir.plasmidId,
        tier: "L3",
        origin: "deterministic",
        prompt,
        expectations,
      });
    }
  }
  return out;
};

// ─── LLM auto-gen ───────────────────────────────────────────────────────────

interface RawLlmCase {
  readonly id?: string;
  readonly prompt?: string;
  readonly expectations?: readonly string[];
}

const isRawLlmCase = (v: unknown): v is RawLlmCase =>
  typeof v === "object" &&
  v !== null &&
  typeof (v as { prompt?: unknown }).prompt === "string";

const parseLlmCases = (raw: string): readonly RawLlmCase[] => {
  // Best-effort JSON extraction — accept bare JSON array or a fenced block.
  let body = raw.trim();
  const fenceMatch = /```(?:json)?\s*([\s\S]*?)```/i.exec(body);
  if (fenceMatch) body = fenceMatch[1].trim();
  try {
    const parsed: unknown = JSON.parse(body);
    if (Array.isArray(parsed)) {
      return parsed.filter(isRawLlmCase);
    }
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      Array.isArray((parsed as { cases?: unknown }).cases)
    ) {
      return ((parsed as { cases: unknown[] }).cases).filter(isRawLlmCase);
    }
    return [];
  } catch {
    return [];
  }
};

const autoGenPrompt = (
  ir: CompiledPlasmidIR,
  tier: ValidationLevel,
  remaining: number,
): { readonly system: string; readonly user: string } => {
  const intentBullets = ir.intents
    .slice(0, 6)
    .map((i) => `- ${i.kind}: ${i.title} — ${i.description.slice(0, 160)}`)
    .join("\n");
  const multilingual =
    tier === "L4"
      ? " Mix languages roughly 50% body-language / 30% English / 20% another common language."
      : "";
  return {
    system:
      "You are a test-case generator for a plasmid validation framework. " +
      "Return a JSON array of cases — no prose, no markdown fences. " +
      'Each case: {"id": string, "prompt": string, "expectations": string[]}.',
    user:
      `Plasmid: ${ir.metadata.name} (${ir.plasmidId})\n` +
      `Description: ${ir.metadata.description}\n` +
      `Tier: ${tier}\n` +
      `Intents:\n${intentBullets}\n\n` +
      `Generate exactly ${remaining} realistic test cases.${multilingual}`,
  };
};

const autoGenForTier = async (
  ir: CompiledPlasmidIR,
  tier: ValidationLevel,
  remaining: number,
  llm: LLMCompletionFn,
  signal: AbortSignal | undefined,
): Promise<readonly RuntimeCase[]> => {
  if (remaining <= 0) return [];
  const { system, user } = autoGenPrompt(ir, tier, remaining);
  let raw: string;
  try {
    raw = await llm({
      system,
      user,
      jsonMode: true,
      temperature: tier === "L4" ? 0.9 : 0.5,
      ...(signal ? { signal } : {}),
    });
  } catch (err) {
    if (signal?.aborted) throw err;
    return [];
  }
  const parsed = parseLlmCases(raw);
  if (parsed.length === 0) return [];
  const out: RuntimeCase[] = [];
  for (let i = 0; i < parsed.length && out.length < remaining; i += 1) {
    const p = parsed[i];
    const prompt = (p.prompt ?? "").trim();
    if (prompt.length === 0) continue;
    const expectations = Array.isArray(p.expectations)
      ? p.expectations.filter(
          (x: unknown): x is string => typeof x === "string" && x.length > 0,
        )
      : [];
    if (expectations.length === 0) continue;
    out.push({
      id: `llm:${slug(ir.plasmidId)}:${tier}:${slug(p.id ?? String(i))}`,
      plasmidId: ir.plasmidId,
      tier,
      origin: "llm-auto",
      prompt,
      expectations,
    });
  }
  return out;
};

// ─── Main ───────────────────────────────────────────────────────────────────

const checkAbort = (signal?: AbortSignal): void => {
  if (signal?.aborted) throw new Error("generateCases aborted");
};

const quotaFor = (
  plan: VolumePlan,
  plasmidId: PlasmidId,
  tier: ValidationLevel,
): number => {
  const q = plan.perPlasmid.get(plasmidId);
  if (!q) return 0;
  return q[tier];
};

export const generateCases: GenerateCasesFn = async (
  req,
): Promise<RuntimeCaseSet> => {
  const { irs, strategies, plan, workingDirectory, llm, signal } = req;
  const llmAvailable = strategies.gradingTiers.includes("llm");

  const out: RuntimeCase[] = [];
  const dropped: DroppedCase[] = [];

  const pushDrop = (
    plasmidId: PlasmidId,
    tier: ValidationLevel,
    reason: string,
    count = 1,
  ): void => {
    for (let i = 0; i < count; i += 1) {
      dropped.push({ plasmidId, tier, reason });
    }
  };

  for (const ir of irs) {
    checkAbort(signal);

    // Load seeds once per plasmid.
    const seeds = await loadEvalSeeds(workingDirectory, ir.plasmidId, signal);
    const seedCases = seedsToCases(ir.plasmidId, seeds);

    for (const tier of LEVELS) {
      checkAbort(signal);
      const quota = quotaFor(plan, ir.plasmidId, tier);
      if (quota <= 0) continue;

      // L4 is LLM-only — skip entirely without llm grading.
      if (tier === "L4" && !llmAvailable) {
        pushDrop(ir.plasmidId, tier, "tier skipped (no llm grading)", quota);
        continue;
      }

      // 1) Seeds first.
      const seedsForTier = seedCases.filter((c) => c.tier === tier);
      const seedPick = sliceCases(seedsForTier, quota);
      let collected: readonly RuntimeCase[] = seedPick.kept;
      if (seedPick.overflow.length > 0) {
        pushDrop(
          ir.plasmidId,
          tier,
          "quota exceeded",
          seedPick.overflow.length,
        );
      }
      let remaining = quota - collected.length;

      // 2) Deterministic derivation for L1-L3.
      if (remaining > 0 && tier !== "L4") {
        const derived =
          tier === "L1"
            ? deriveL1(ir, remaining)
            : tier === "L2"
              ? deriveL2(ir, remaining)
              : deriveL3(ir, remaining);
        const pick = sliceCases(derived, remaining);
        collected = [...collected, ...pick.kept];
        remaining -= pick.kept.length;
      }

      // 3) LLM auto-gen fills the rest (when allowed).
      if (remaining > 0 && llmAvailable) {
        let generated: readonly RuntimeCase[];
        try {
          generated = await autoGenForTier(ir, tier, remaining, llm, signal);
        } catch (err) {
          if (signal?.aborted) throw err;
          generated = [];
        }
        if (generated.length === 0) {
          pushDrop(ir.plasmidId, tier, "llm autogen failed", remaining);
        } else {
          const pick = sliceCases(generated, remaining);
          collected = [...collected, ...pick.kept];
          remaining -= pick.kept.length;
          if (remaining > 0) {
            pushDrop(ir.plasmidId, tier, "llm autogen failed", remaining);
          }
        }
      } else if (remaining > 0) {
        // No LLM available and deterministic couldn't fill → record shortage.
        pushDrop(ir.plasmidId, tier, "deterministic exhausted", remaining);
      }

      // Defense in depth: never emit more than the quota.
      const final = collected.slice(0, quota);
      for (const c of final) out.push(c);
    }
  }

  return {
    cases: out,
    droppedCount: dropped.length,
    droppedReasons: dropped,
  } satisfies RuntimeCaseSet;
};

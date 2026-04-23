/**
 * Three-tier Constitution Reorganizer (Stage 2d, P-1.15 §4-§6).
 *
 * Fallback chain is controlled by `strategies.reorgFallback`:
 *   - `llm-only`                         → Tier 1 (throw on failure)
 *   - `llm-with-xml-fallback`            → Tier 1 → Tier 2 (throw on failure)
 *   - `llm-with-deterministic-fallback`  → Tier 1 → Tier 2 → Tier 3
 *   - `deterministic-only`               → Tier 3 (no LLM call)
 *
 * Each tier returns a candidate plan. The candidate is structurally validated
 * via {@link validateUpdateTargets} before being accepted — if an LLM op
 * targets a non-existent marker, we fall through to the next tier rather
 * than surfacing `REORG_INVALID_UPDATE_TARGET` to the caller, preserving
 * robustness. Only the *final* tier's error escapes.
 *
 * Outputs a {@link ReorgPlan} tagged with `fallbackTier` = the tier that
 * produced it (used by the transcript + strategy-selector telemetry).
 *
 * Guardrails:
 *   - `signal.aborted` checked between tiers.
 *   - Only `intent.title/description/constraints/evidence` flow into prompts;
 *     plasmid bodies never do (I-8 hermeticity).
 *
 * Layer: Core (Layer 2). No fs, no network directly — LLM via DI.
 */

import { z } from "zod";

import type {
  CompiledPlasmidIR,
  LLMCompletionFn,
  PlasmidIntentNode,
  ReorganizeFn,
  ReorgFallback,
  ReorgOp,
  ReorgOpKind,
  ReorgPlan,
} from "../types.js";
import { buildDeterministicPlan } from "./deterministic.js";
import {
  ConstitutionParseError,
  ReorgFallbackExhaustedError,
  ReorgInvalidUpdateTargetError,
} from "./errors.js";
import { validateUpdateTargets } from "./invariance-check.js";
import { isValidMarkerId } from "./marker.js";
import { hashConstitution, hashIntentGraph } from "./cache.js";
import { listMarkerIds, parse } from "./section-tree.js";

/** Semver of the reorganizer — cache-busting token. Bump on prompt change. */
export const REORG_VERSION = "1.0.0";

const REORG_OP_KINDS: readonly ReorgOpKind[] = [
  "insert",
  "update",
  "remove",
  "keep",
];

const reorgOpSchema = z.object({
  kind: z.enum(REORG_OP_KINDS as unknown as [ReorgOpKind, ...ReorgOpKind[]]),
  markerId: z.string().min(1),
  heading: z.string(),
  body: z.string(),
  locationAfter: z.string().optional(),
  sourcePlasmid: z.string().optional(),
});

const reorgPlanJsonSchema = z.object({
  ops: z.array(reorgOpSchema),
  keptMarkerIds: z.array(z.string()).optional(),
});

type ReorgJsonPlan = z.infer<typeof reorgPlanJsonSchema>;

// ─── Public entry point ──────────────────────────────────────────────────────

export const reorganize: ReorganizeFn = async (req) => {
  const beforeTree = parse(req.existingConstitution);
  const existingMarkerIds = listMarkerIds(beforeTree);

  const constitutionHash = hashConstitution(req.existingConstitution);
  const intentGraphHash = hashIntentGraph(req.irs);
  const fallback: ReorgFallback = req.strategies.reorgFallback;

  // Short-circuit: deterministic-only skips everything LLM-ish.
  if (fallback === "deterministic-only") {
    return buildDeterministicPlan({
      beforeTree,
      irs: req.irs,
      preReorgContentHash: constitutionHash,
      intentGraphHash,
    });
  }

  const tiers = chainForStrategy(fallback);
  let lastError: unknown = undefined;

  for (const tier of tiers) {
    if (req.signal?.aborted) {
      throw new ReorgFallbackExhaustedError(
        "Reorg aborted by signal before tier " + tier,
        { tier },
      );
    }
    try {
      switch (tier) {
        case "llm-json": {
          const plan = await runLlmJsonTier(req.llm, req, {
            constitutionHash,
            intentGraphHash,
          });
          validateUpdateTargets(plan, existingMarkerIds);
          return plan;
        }
        case "llm-xml": {
          const plan = await runLlmXmlTier(req.llm, req, {
            constitutionHash,
            intentGraphHash,
          });
          validateUpdateTargets(plan, existingMarkerIds);
          return plan;
        }
        case "deterministic": {
          const plan = buildDeterministicPlan({
            beforeTree,
            irs: req.irs,
            preReorgContentHash: constitutionHash,
            intentGraphHash,
          });
          // No validate call — deterministic never fabricates marker-ids.
          return plan;
        }
      }
    } catch (err) {
      lastError = err;
      if (err instanceof ConstitutionParseError) {
        // Parse error is non-recoverable — bail out immediately.
        throw err;
      }
      // Fall through to the next tier.
    }
  }

  throw new ReorgFallbackExhaustedError(
    `Reorg fallback exhausted (strategy=${fallback}). Last error: ${describeError(lastError)}`,
    { strategy: fallback, lastError: describeError(lastError) },
  );
};

// ─── Tier chain ──────────────────────────────────────────────────────────────

type Tier = "llm-json" | "llm-xml" | "deterministic";

function chainForStrategy(strategy: ReorgFallback): readonly Tier[] {
  switch (strategy) {
    case "llm-only":
      return ["llm-json"];
    case "llm-with-xml-fallback":
      return ["llm-json", "llm-xml"];
    case "llm-with-deterministic-fallback":
      return ["llm-json", "llm-xml", "deterministic"];
    case "deterministic-only":
      return ["deterministic"];
  }
}

// ─── Tier 1 — LLM JSON ───────────────────────────────────────────────────────

async function runLlmJsonTier(
  llm: LLMCompletionFn,
  req: Parameters<ReorganizeFn>[0],
  ctx: { constitutionHash: string; intentGraphHash: string },
): Promise<ReorgPlan> {
  const system = buildSystemPrompt();
  const user = buildUserPrompt(req.existingConstitution, req.irs, "json");

  const raw = await llm({
    system,
    user,
    jsonMode: true,
    temperature: 0,
    ...(req.signal ? { signal: req.signal } : {}),
  });

  const parsed = parseJsonPlan(raw);
  return toReorgPlan(parsed, {
    preReorgContentHash: ctx.constitutionHash,
    intentGraphHash: ctx.intentGraphHash,
    fallbackTier: "llm-only",
  });
}

function parseJsonPlan(raw: string): ReorgJsonPlan {
  const trimmed = raw.trim();
  // Tolerate stray prose — find the first `{` and last `}` enclosing JSON.
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  const candidate = start >= 0 && end > start ? trimmed.slice(start, end + 1) : trimmed;
  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch (err) {
    throw new Error(`LLM JSON plan failed to parse: ${(err as Error).message}`);
  }
  return reorgPlanJsonSchema.parse(parsed);
}

// ─── Tier 2 — LLM XML ────────────────────────────────────────────────────────

async function runLlmXmlTier(
  llm: LLMCompletionFn,
  req: Parameters<ReorganizeFn>[0],
  ctx: { constitutionHash: string; intentGraphHash: string },
): Promise<ReorgPlan> {
  const system = buildSystemPrompt();
  const user = buildUserPrompt(req.existingConstitution, req.irs, "xml");

  const raw = await llm({
    system,
    user,
    jsonMode: false,
    temperature: 0,
    ...(req.signal ? { signal: req.signal } : {}),
  });

  const ops = parseXmlPlan(raw);
  return toReorgPlan(
    { ops },
    {
      preReorgContentHash: ctx.constitutionHash,
      intentGraphHash: ctx.intentGraphHash,
      fallbackTier: "llm-with-xml-fallback",
    },
  );
}

/**
 * Tolerant XML plan parser. Supports:
 *   <plan>
 *     <op kind="insert" markerId="..." heading="..." locationAfter="...">
 *       <body>...</body>
 *     </op>
 *     ...
 *   </plan>
 *
 * `<body>` may be wrapped in `<![CDATA[...]]>`. Attribute order is free.
 */
export function parseXmlPlan(raw: string): ReorgJsonPlan["ops"] {
  // Walk the string once, matching either self-closing <op .../> or paired
  // <op ...>...</op>. We cannot use a single regex (the greedy `[^>]*`
  // spans self-closers), so we scan character-by-character.
  const ops: ReorgJsonPlan["ops"] = [];
  const tagRe = /<op\b([^>]*)>/gi;
  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(raw)) !== null) {
    const attrSrc = match[1];
    const attrs = parseAttrs(attrSrc);
    const kind = (attrs.kind ?? "").toLowerCase();
    const isSelfClosing = /\/\s*$/.test(attrSrc);

    let body = "";
    if (!isSelfClosing) {
      // Find the matching </op> starting from match end.
      const startBody = tagRe.lastIndex;
      const closeRe = /<\/op\s*>/i;
      closeRe.lastIndex = startBody;
      const closeMatch = closeRe.exec(raw.slice(startBody));
      if (!closeMatch) continue;
      const inner = raw.slice(startBody, startBody + closeMatch.index);
      const bodyMatch = /<body\b[^>]*>([\s\S]*?)<\/body\s*>/i.exec(inner);
      body = stripCData(bodyMatch ? bodyMatch[1] : "").trim();
      // advance tagRe past the close so the next op is found.
      tagRe.lastIndex = startBody + closeMatch.index + closeMatch[0].length;
    }

    if (!REORG_OP_KINDS.includes(kind as ReorgOpKind)) continue;

    ops.push({
      kind: kind as ReorgOpKind,
      markerId: attrs.markerid ?? attrs.markerId ?? "",
      heading: attrs.heading ?? "",
      body,
      locationAfter: attrs.locationafter ?? attrs.locationAfter,
      sourcePlasmid: attrs.sourceplasmid ?? attrs.sourcePlasmid,
    });
  }

  if (ops.length === 0) {
    throw new Error("LLM XML plan contained no <op> elements");
  }
  return ops;
}

function parseAttrs(src: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([A-Za-z][A-Za-z0-9_-]*)\s*=\s*"([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    out[m[1].toLowerCase()] = m[2];
  }
  return out;
}

function stripCData(s: string): string {
  const m = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/.exec(s);
  return m ? m[1] : s;
}

// ─── Plan materialisation ────────────────────────────────────────────────────

function toReorgPlan(
  parsed: ReorgJsonPlan,
  ctx: {
    preReorgContentHash: string;
    intentGraphHash: string;
    fallbackTier: ReorgFallback;
  },
): ReorgPlan {
  const ops: ReorgOp[] = [];
  for (const op of parsed.ops) {
    if (!isValidMarkerId(op.markerId)) {
      // Drop malformed marker-ids rather than fail the whole plan — the
      // outer `validateUpdateTargets` will catch the downstream effect if
      // this removes real coverage.
      continue;
    }
    const normalised: ReorgOp = {
      kind: op.kind,
      markerId: op.markerId,
      heading: op.heading,
      body: op.body,
      ...(op.locationAfter ? { locationAfter: op.locationAfter } : {}),
      ...(op.sourcePlasmid
        ? { sourcePlasmid: op.sourcePlasmid as ReorgOp["sourcePlasmid"] }
        : {}),
    };
    ops.push(normalised);
  }
  return {
    ops,
    keptMarkerIds: parsed.keptMarkerIds ?? [],
    preReorgContentHash: ctx.preReorgContentHash,
    intentGraphHash: ctx.intentGraphHash,
    fallbackTier: ctx.fallbackTier,
  };
}

// ─── Prompt construction ─────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return [
    "You are the Constitution Reorganizer for the Dhelix Code plasmid system.",
    "Your job is to PLAN edits to DHELIX.md. You do NOT apply edits — another component will.",
    "",
    "HARD RULES (violations cause the plan to be rejected):",
    "1. NEVER alter user-authored sections (content outside BEGIN/END markers).",
    "2. Only target markers named `<!-- BEGIN plasmid-derived: <marker-id> -->`.",
    "3. Every `update` or `remove` op's markerId MUST already exist in the input DHELIX.md.",
    "4. New `insert` ops invent a new marker-id in `<plasmid-id>/<slug>` form (kebab-case).",
    "5. Do NOT merge content across plasmids — one BEGIN/END block per intent.",
    "6. Keep plans minimal: no churn. Emit `update` only if the body materially changed.",
  ].join("\n");
}

function buildUserPrompt(
  existing: string,
  irs: readonly CompiledPlasmidIR[],
  shape: "json" | "xml",
): string {
  const intents = irs.flatMap((ir) =>
    ir.intents.map((intent) => renderIntentForPrompt(ir.plasmidId, intent)),
  );
  const shapeNote =
    shape === "json"
      ? [
          "Output STRICT JSON with shape:",
          `{ "ops": [{ "kind": "insert"|"update"|"remove"|"keep", "markerId": "...", "heading": "...", "body": "...", "locationAfter": "...", "sourcePlasmid": "..." }], "keptMarkerIds": ["..."] }`,
          "No prose, no markdown fences.",
        ].join("\n")
      : [
          "Output the plan as XML:",
          '<plan>',
          '  <op kind="insert" markerId="..." heading="..." locationAfter="...">',
          '    <body><![CDATA[...]]></body>',
          '  </op>',
          '  <op kind="remove" markerId="..." />',
          '</plan>',
          "No prose outside the <plan> element.",
        ].join("\n");

  return [
    "EXISTING DHELIX.md:",
    "```markdown",
    existing.length > 0 ? existing : "<empty>",
    "```",
    "",
    "ACTIVE PLASMID INTENTS:",
    intents.length > 0 ? intents.join("\n\n") : "<none>",
    "",
    shapeNote,
  ].join("\n");
}

function renderIntentForPrompt(
  plasmidId: string,
  intent: PlasmidIntentNode,
): string {
  const lines = [
    `- plasmid: ${plasmidId}`,
    `  intent: ${intent.title}`,
    `  description: ${intent.description}`,
  ];
  if (intent.constraints.length > 0) {
    lines.push(`  constraints:`);
    for (const c of intent.constraints) lines.push(`    - ${c}`);
  }
  if (intent.evidence.length > 0) {
    lines.push(`  evidence:`);
    for (const e of intent.evidence) lines.push(`    - ${e}`);
  }
  return lines.join("\n");
}

function describeError(err: unknown): string {
  if (err === undefined) return "<none>";
  if (err instanceof ReorgInvalidUpdateTargetError) {
    return `${err.code}: ${err.message}`;
  }
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return String(err);
}

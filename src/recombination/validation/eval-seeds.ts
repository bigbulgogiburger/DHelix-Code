/**
 * eval-seeds schema + loader (P-1.23).
 *
 * Team 1 — Phase 3. Extends the shared `evalCaseSchema` from
 * `src/skills/creator/evals/types.ts` with `tier` (L1-L4, required) and
 * reuses the existing `expectations` / `expected_output_contains` /
 * `expected_output_excludes` fields. Enforces the 20-seed per-plasmid cap
 * via Zod `.max(20)` + duplicate-id detection in `superRefine`.
 *
 * Legacy coexistence (P-1.23 §6): `expected_output_contains/excludes`
 * auto-rewritten to DSL `output contains / does NOT contain` prefixes at
 * load time so the grader sees a single shape.
 *
 * Layer: Core (Layer 2). Reads from disk.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { parse as yamlParse } from "yaml";
import { z } from "zod";

import { evalCaseSchema } from "../../skills/creator/evals/types.js";
import type { PlasmidId } from "../../plasmids/types.js";
import type { RuntimeCase, ValidationLevel } from "../types.js";

// ─── Schemas ────────────────────────────────────────────────────────────────

/** Validation tier enum — identical to `ValidationLevel` but owned by Zod. */
export const evalTierSchema = z.enum(["L1", "L2", "L3", "L4"]);

/**
 * A single eval-seed — extends the shared eval-case schema with required
 * `tier`. Keeps all other fields (including legacy substring shortcuts) so
 * existing `src/skills/creator/evals` runner/grader can reuse the data.
 */
export const evalSeedSchema = evalCaseSchema.extend({
  tier: evalTierSchema,
});

export type EvalSeedParsed = z.infer<typeof evalSeedSchema>;

/**
 * Top-level eval-seeds.(yaml|json) schema — enforces ≤20 seeds per plasmid
 * and detects duplicate ids via `superRefine`.
 */
export const evalSeedsFileSchema = z
  .object({
    plasmidId: z.string().min(1),
    version: z.number().int().positive().default(1),
    seeds: z
      .array(evalSeedSchema)
      .max(20, { message: "eval-seeds limit is 20 per plasmid" }),
  })
  .superRefine((value, ctx) => {
    const seen = new Set<string>();
    for (let i = 0; i < value.seeds.length; i += 1) {
      const seed = value.seeds[i];
      if (seen.has(seed.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate eval-seed id: "${seed.id}"`,
          path: ["seeds", i, "id"],
        });
      }
      seen.add(seed.id);
    }
  });

export type EvalSeedsFileParsed = z.infer<typeof evalSeedsFileSchema>;

// ─── Public runtime shapes ──────────────────────────────────────────────────

export interface EvalSeed {
  readonly id: string;
  readonly tier: ValidationLevel;
  readonly prompt: string;
  readonly expectations: readonly string[];
  readonly tags?: readonly string[];
  readonly setupFiles?: readonly {
    readonly path: string;
    readonly content: string;
  }[];
}

export interface EvalSeedsFile {
  readonly plasmidId: PlasmidId;
  readonly version: number;
  readonly seeds: readonly EvalSeed[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const dsl = (prefix: "contains" | "excludes", raw: string): string => {
  const safe = raw.replace(/"/g, '\\"');
  return prefix === "contains"
    ? `output contains "${safe}"`
    : `output does NOT contain "${safe}"`;
};

/** Normalize a Zod-parsed seed into the public `EvalSeed` shape + converted DSL. */
const normalizeSeed = (parsed: EvalSeedParsed): EvalSeed => {
  const extras: string[] = [];
  if (parsed.expected_output_contains) {
    for (const s of parsed.expected_output_contains) {
      extras.push(dsl("contains", s));
    }
  }
  if (parsed.expected_output_excludes) {
    for (const s of parsed.expected_output_excludes) {
      extras.push(dsl("excludes", s));
    }
  }
  const expectations: readonly string[] = [...parsed.expectations, ...extras];
  return {
    id: parsed.id,
    tier: parsed.tier,
    prompt: parsed.prompt,
    expectations,
    ...(parsed.tags ? { tags: parsed.tags } : {}),
  };
};

/** Parse a raw string blob as either YAML or JSON. */
const parseBlob = (blob: string, ext: "yaml" | "json"): unknown =>
  ext === "json" ? (JSON.parse(blob) as unknown) : (yamlParse(blob) as unknown);

/** Resolve the eval-seeds.yaml file path for a plasmid. */
export const evalSeedsPath = (
  workingDirectory: string,
  plasmidId: PlasmidId,
): string =>
  join(workingDirectory, ".dhelix/plasmids", plasmidId, "eval-seeds.yaml");

/** JSON fallback path. */
export const evalSeedsJsonPath = (
  workingDirectory: string,
  plasmidId: PlasmidId,
): string =>
  join(workingDirectory, ".dhelix/plasmids", plasmidId, "eval-seeds.json");

const ENOENT = "ENOENT";

const isErrnoException = (err: unknown): err is NodeJS.ErrnoException =>
  typeof err === "object" && err !== null && "code" in err;

/** Load + Zod-parse a plasmid's eval-seeds file, returning [] if absent. */
export const loadEvalSeeds = async (
  workingDirectory: string,
  plasmidId: PlasmidId,
  signal?: AbortSignal,
): Promise<readonly EvalSeed[]> => {
  if (signal?.aborted) {
    throw new Error("loadEvalSeeds aborted before read");
  }

  const candidates: readonly { path: string; ext: "yaml" | "json" }[] = [
    { path: evalSeedsPath(workingDirectory, plasmidId), ext: "yaml" },
    { path: evalSeedsJsonPath(workingDirectory, plasmidId), ext: "json" },
  ];

  for (const { path, ext } of candidates) {
    if (signal?.aborted) {
      throw new Error("loadEvalSeeds aborted during read");
    }
    let blob: string;
    try {
      blob = await readFile(path, "utf8");
    } catch (err) {
      if (isErrnoException(err) && err.code === ENOENT) {
        continue;
      }
      throw err;
    }

    let raw: unknown;
    try {
      raw = parseBlob(blob, ext);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`eval-seeds parse failed: ${path}: ${msg}`);
    }

    const result = evalSeedsFileSchema.safeParse(raw);
    if (!result.success) {
      throw new Error(
        `eval-seeds parse failed: ${path}: ${result.error.message}`,
      );
    }

    if (result.data.plasmidId !== plasmidId) {
      throw new Error(
        `eval-seeds parse failed: ${path}: plasmidId mismatch (file='${result.data.plasmidId}' expected='${plasmidId}')`,
      );
    }

    return result.data.seeds.map(normalizeSeed);
  }

  return [];
};

/** Project loaded seeds into RuntimeCase envelopes (fills origin + plasmidId). */
export const seedsToCases = (
  plasmidId: PlasmidId,
  seeds: readonly EvalSeed[],
): readonly RuntimeCase[] =>
  seeds.map((seed) => ({
    id: `seed:${seed.id}`,
    plasmidId,
    tier: seed.tier,
    origin: "eval-seed" as const,
    prompt: seed.prompt,
    expectations: seed.expectations,
    ...(seed.setupFiles ? { setupFiles: seed.setupFiles } : {}),
    ...(seed.tags ? { tags: seed.tags } : {}),
  }));

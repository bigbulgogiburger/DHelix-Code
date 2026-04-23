/**
 * Plasmid Zod schemas.
 *
 * Runtime validation for on-disk metadata frontmatter and eval cases. Inferred
 * types (see `PlasmidMetadataInput` / `PlasmidEvalCaseInput`) are structurally
 * compatible with the public contract in `./types.ts`; the loader narrows
 * strings into branded `PlasmidId` / `PlasmidFingerprint` after Zod passes.
 *
 * Reference:
 * - PRD §6.1.2 (frontmatter field table)
 * - P-1.23 (eval-seeds schema — expectation DSL)
 * - P-1.3 (static validation — structural subset enforced here)
 *
 * Layer: Leaf — `zod` and `./types.js` only.
 */

import { z } from "zod";
import type {
  ExpectationPrefix,
  PlasmidEvalCase,
  PlasmidEvalExpectation,
  PlasmidId,
  PlasmidMetadata,
  PlasmidPrivacy,
  PlasmidScope,
  PlasmidTier,
} from "./types.js";

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/**
 * Plasmid identifier validator — `[a-z][a-z0-9-]*`, length 3..64, no consecutive
 * hyphens. Transforms to the branded {@link PlasmidId}.
 */
export const plasmidIdSchema = z
  .string()
  .min(3, "plasmid id must be at least 3 characters")
  .max(64, "plasmid id must be at most 64 characters")
  .regex(
    /^[a-z][a-z0-9-]*$/,
    "plasmid id must start with a lowercase letter and contain only [a-z0-9-]",
  )
  .refine((value) => !value.includes("--"), {
    message: "plasmid id must not contain consecutive hyphens",
  })
  .refine((value) => !value.endsWith("-"), {
    message: "plasmid id must not end with a hyphen",
  })
  .transform((value) => value as PlasmidId);

/**
 * SemVer 2.0 (partial) — `MAJOR.MINOR.PATCH` with optional pre-release and
 * build-metadata segments.
 */
export const semverSchema = z
  .string()
  .regex(
    /^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/,
    "version must be a semver (MAJOR.MINOR.PATCH[-pre][+build])",
  );

/** ISO-8601 timestamp — relies on Zod's built-in validator. */
export const isoDatetimeSchema = z
  .string()
  .datetime({ offset: true, message: "must be an ISO-8601 timestamp" });

/** Lowercase kebab tag, length 1..32. */
export const tagSchema = z
  .string()
  .min(1)
  .max(32)
  .regex(/^[a-z][a-z0-9-]*$/, "tag must be kebab-case lowercase");

export const tierSchema = z.enum(["L1", "L2", "L3", "L4"]) satisfies z.ZodType<PlasmidTier>;
export const scopeSchema = z.enum([
  "local",
  "shared",
  "ephemeral",
  "team",
]) satisfies z.ZodType<PlasmidScope>;
export const privacySchema = z.enum([
  "local-only",
  "cloud-ok",
  "no-network",
]) satisfies z.ZodType<PlasmidPrivacy>;

// ---------------------------------------------------------------------------
// Expectation DSL (P-1.23)
// ---------------------------------------------------------------------------

const EXPECTATION_PREFIXES: readonly ExpectationPrefix[] = [
  "pattern",
  "semver",
  "ast-match",
  "contains",
  "not-contains",
  "equals",
  "gte",
  "lte",
];

const EXPECTATION_REGEX =
  /^(not:)?(pattern|semver|ast-match|contains|not-contains|equals|gte|lte):(.+)$/s;

/**
 * Parse `[not:]<prefix>:<value>` into the structured form. The optional
 * `not:` prefix toggles `negated`; the `not-contains` sugar also sets
 * `negated=true` so downstream consumers can treat the two spellings
 * equivalently.
 */
export const expectationSchema = z
  .string()
  .refine((value) => EXPECTATION_REGEX.test(value), {
    message: `expectation must match "[not:]<prefix>:<value>" where prefix is one of ${EXPECTATION_PREFIXES.join(", ")}`,
  })
  .transform((value): PlasmidEvalExpectation => {
    const match = EXPECTATION_REGEX.exec(value);
    // Refine above guarantees a match; cast is narrow and safe.
    const [, notPrefix, prefix, raw] = match as RegExpExecArray;
    const typedPrefix = prefix as ExpectationPrefix;
    const negated = Boolean(notPrefix) || typedPrefix === "not-contains";
    return { prefix: typedPrefix, value: raw, negated };
  });

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

/**
 * Frontmatter / `metadata.yaml` schema.
 *
 * Strict mode — unknown keys fail validation so typos surface early. Default
 * values mirror the public contract (scope = local, privacy = cloud-ok).
 * Cross-field refines enforce:
 * - `updated >= created`
 * - `foundational: true` implies `tier === "L4"`
 * - `extends` may not reference the plasmid's own id
 */
export const plasmidMetadataSchema = z
  .object({
    id: plasmidIdSchema,
    name: z.string().min(1).max(120),
    description: z.string().min(1).max(500),
    version: semverSchema,
    tier: tierSchema,
    scope: scopeSchema.default("local"),
    privacy: privacySchema.default("cloud-ok"),
    author: z.string().min(1).max(120).optional(),
    created: isoDatetimeSchema,
    updated: isoDatetimeSchema,
    tags: z.array(tagSchema).max(12).readonly().optional(),
    requires: z.array(plasmidIdSchema).readonly().optional(),
    conflicts: z.array(plasmidIdSchema).readonly().optional(),
    extends: plasmidIdSchema.optional(),
    foundational: z.boolean().optional(),
    template: z
      .string()
      .regex(/^[a-z][a-z0-9-]*$/, "template must be kebab-case")
      .optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (Date.parse(value.updated) < Date.parse(value.created)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["updated"],
        message: "updated must be >= created",
      });
    }
    if (value.foundational === true && value.tier !== "L4") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["foundational"],
        message: "foundational: true requires tier: L4",
      });
    }
    if (value.extends !== undefined && value.extends === value.id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["extends"],
        message: "extends must not reference the plasmid's own id",
      });
    }
  });

/** Input type for metadata (pre-parse). */
export type PlasmidMetadataInput = z.input<typeof plasmidMetadataSchema>;

// Compile-time structural compatibility check against the public type.
// If `PlasmidMetadata` drifts, this line fails typecheck.
type _PlasmidMetadataCompat = z.infer<typeof plasmidMetadataSchema> extends PlasmidMetadata
  ? true
  : never;
const _plasmidMetadataCompat: _PlasmidMetadataCompat = true;
void _plasmidMetadataCompat;

// ---------------------------------------------------------------------------
// Eval cases (P-1.23)
// ---------------------------------------------------------------------------

/**
 * Schema for a single eval case. `tier` is optional on disk to keep legacy
 * eval-seed files loadable; callers who need the P-1.23 v0.2 warning can
 * inspect the result and emit telemetry.
 */
export const evalCaseSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-z][a-z0-9-]*$/, "eval case id must be kebab-case"),
    description: z.string().min(1),
    input: z.string(),
    expectations: z.array(expectationSchema).min(1, "at least one expectation is required"),
    tier: tierSchema.optional(),
  })
  .strict();

export type PlasmidEvalCaseInput = z.input<typeof evalCaseSchema>;

// Structural compatibility vs. the public type.
type _EvalCaseCompat = z.infer<typeof evalCaseSchema> extends PlasmidEvalCase ? true : never;
const _evalCaseCompat: _EvalCaseCompat = true;
void _evalCaseCompat;

/**
 * Parse + validate an array of eval cases, enforcing per-plasmid id uniqueness
 * (surfaced as a single aggregate issue). Returns a tuple so the caller can
 * decide whether to log the legacy-tier warning.
 */
export const evalCasesSchema = z
  .array(evalCaseSchema)
  .superRefine((cases, ctx) => {
    const seen = new Set<string>();
    for (const [index, entry] of cases.entries()) {
      if (seen.has(entry.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, "id"],
          message: `duplicate eval case id "${entry.id}"`,
        });
      }
      seen.add(entry.id);
    }
  });

/**
 * Returns `true` when any case is missing the `tier` field — callers can use
 * this to emit a P-1.23 v0.2 deprecation warning without failing the load.
 */
export function hasLegacyUntieredCases(
  cases: readonly PlasmidEvalCase[],
): boolean {
  return cases.some((c) => c.tier === undefined);
}

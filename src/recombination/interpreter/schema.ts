/**
 * Zod schema for the interpreter's expected LLM JSON payload.
 *
 * The shape mirrors {@link PlasmidIntentNode} from the shared contract at
 * `src/recombination/types.ts`, minus `sourcePlasmid` (which the interpreter
 * injects from the loaded plasmid). The schema is intentionally lenient on
 * optional fields so small/local models have room to omit noise fields — any
 * omissions are filled in with conservative defaults during normalisation.
 *
 * Layer: Core (Layer 2). Imports only `zod` and shared types.
 */

import { z } from "zod";

import type { IntentKind, PlasmidIntentNode } from "../types.js";

/** Enum of intent kinds the contract recognises. */
export const INTENT_KINDS: readonly IntentKind[] = [
  "agent",
  "skill",
  "command",
  "hook",
  "rule",
  "harness",
] as const;

const intentKindSchema = z.enum(["agent", "skill", "command", "hook", "rule", "harness"]);

/** A single intent as the LLM is asked to emit it. */
export const interpretedIntentSchema = z
  .object({
    id: z.string().trim().min(1).max(160).optional(),
    kind: intentKindSchema,
    title: z.string().trim().min(1).max(80),
    description: z.string().trim().min(1),
    constraints: z.array(z.string().trim().min(1)).default([]),
    evidence: z.array(z.string().trim().min(1)).default([]),
    params: z.record(z.unknown()).default({}),
  })
  .strict();

/** Top-level response — `summary` + ordered `intents` list. */
export const interpretedPayloadSchema = z
  .object({
    summary: z.string().trim().min(1),
    intents: z.array(interpretedIntentSchema).default([]),
  })
  .strict();

export type InterpretedIntent = z.infer<typeof interpretedIntentSchema>;
export type InterpretedPayload = z.infer<typeof interpretedPayloadSchema>;

/**
 * Normalise a validated intent into the contract shape. The caller is
 * responsible for injecting `sourcePlasmid` (and optional id defaulting).
 */
export function toIntentNode(
  intent: InterpretedIntent,
  sourcePlasmid: PlasmidIntentNode["sourcePlasmid"],
  fallbackId: string,
): PlasmidIntentNode {
  return {
    id: intent.id && intent.id.length > 0 ? intent.id : fallbackId,
    sourcePlasmid,
    kind: intent.kind,
    title: intent.title,
    description: intent.description,
    constraints: Object.freeze([...intent.constraints]) as readonly string[],
    evidence: Object.freeze([...intent.evidence]) as readonly string[],
    params: Object.freeze({ ...intent.params }),
  };
}

/**
 * Slugify a title into a stable id suffix. Used when the LLM omits `id`.
 *
 * - Lowercase
 * - Non-alphanumeric → `-`
 * - Collapse repeats, trim edges
 * - Fall back to `"intent"` if the slug ends up empty (e.g. pure punctuation)
 */
export function slugifyTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.length > 0 ? slug : "intent";
}

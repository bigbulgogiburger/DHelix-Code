/**
 * Generator shared utilities — kebab-case file naming (P-1.4 validator)
 * and the render-context builder. Kept minimal so each generator file
 * stays focused on its own kind-specific logic.
 */

import { createHash } from "node:crypto";
import * as path from "node:path";

import type {
  CompiledPlasmidIR,
  PlasmidIntentNode,
} from "../types.js";

import { kebabCase } from "./helpers.js";

/** P-1.4 §5 / §Q1 naming validator — kebab-case only, minimum 1 segment. */
export const KEBAB_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Maximum file-name stem length (matches plasmid id upper bound). */
export const MAX_NAME_LENGTH = 48;

/** Last-ditch fallback used if `kebabCase(title)` is empty or all-symbolic. */
const FALLBACK_STEM = "artifact";

/**
 * Normalise an intent title into a kebab-case file stem.
 *
 * Rules:
 *  - `kebabCase` via helpers (drops punctuation)
 *  - Too long (> MAX_NAME_LENGTH) → truncate + append a stable short hash
 *    suffix so collisions are vanishingly unlikely.
 *  - Empty after kebabification → "artifact-<6char-hash>".
 */
export function toKebabFileName(title: string): string {
  const base = kebabCase(title ?? "");
  if (!base) {
    return `${FALLBACK_STEM}-${shortHash(title ?? "")}`;
  }
  if (base.length <= MAX_NAME_LENGTH) return base;
  const suffix = shortHash(base);
  const trunc = base
    .slice(0, MAX_NAME_LENGTH - suffix.length - 1)
    .replace(/-+$/, "");
  return `${trunc}-${suffix}`;
}

function shortHash(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex").slice(0, 6);
}

/**
 * Build the context object exposed to templates.
 *
 * Note: we intentionally do NOT expose `plasmid.body` or the raw parsed
 * markdown — only `metadata`, `plasmidId`, `summary`, and the intent view
 * are safe per I-8 (compile-runtime hermeticity). Generators operate on
 * the interpreter's abstracted view, not the original plasmid text.
 */
export function buildTemplateContext(
  ir: CompiledPlasmidIR,
  intent: PlasmidIntentNode,
  workingDirectory: string,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    plasmid: Object.freeze({
      plasmidId: String(ir.plasmidId),
      plasmidVersion: ir.plasmidVersion,
      summary: ir.summary,
      tier: ir.tier,
      metadata: Object.freeze({
        id: String(ir.metadata.id),
        name: ir.metadata.name,
        description: ir.metadata.description,
        tier: ir.metadata.tier,
        version: ir.metadata.version,
        tags: ir.metadata.tags ?? [],
        author: ir.metadata.author ?? "",
      }),
    }),
    intent: Object.freeze({
      id: intent.id,
      kind: intent.kind,
      title: intent.title,
      description: intent.description,
      constraints: intent.constraints,
      evidence: intent.evidence,
      params: intent.params,
    }),
    project: Object.freeze({
      workingDirectory,
      baseName: path.basename(workingDirectory),
    }),
  });
}

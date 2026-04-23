/**
 * Stage 2b — Artifact generators entry point.
 *
 * Consumes `CompiledPlasmidIR[]` from Stage 2a (interpreter) and emits
 * `GeneratedArtifact[]` for Stage 4 (persistence — owned by Team 5).
 * **This module never writes to disk.**
 *
 * Phase 2 scope:
 *   - rule    → `.dhelix/rules/<name>.md`
 *   - skill   → `.dhelix/skills/<name>/SKILL.md`
 *   - command → `.dhelix/commands/<name>.md`
 *
 * Phase 4 (deferred):
 *   - agent, hook, harness → recorded as `INTENT_KIND_NOT_SUPPORTED`
 *     warnings and skipped.
 */

import type {
  GenerateFn,
  GenerateRequest,
  GenerateResult,
  GeneratedArtifact,
  IntentKind,
  PlasmidIntentNode,
} from "../types.js";

import { generateCommandArtifact } from "./command-generator.js";
import { generateRuleArtifact } from "./rule-generator.js";
import { generateSkillArtifact } from "./skill-generator.js";
import {
  createTemplateResolver,
  type TemplateResolver,
} from "./template-resolver.js";

const DEFERRED_KINDS: ReadonlySet<IntentKind> = new Set(["agent", "hook", "harness"]);

export interface GeneratorOptions {
  /** Override the resolver (tests / custom primitive roots). */
  readonly resolver?: TemplateResolver;
}

/**
 * Build a `generate` function bound to a specific resolver. Useful in
 * tests and in downstream wiring where a shared resolver is already
 * configured. In production, `generate` (the default export-less
 * binding) is what Team 5 calls.
 */
export function createGenerator(opts: GeneratorOptions = {}): GenerateFn {
  return async (req) => doGenerate(req, opts.resolver);
}

/** Default bound entry point — lazily constructs a per-request resolver. */
export const generate: GenerateFn = async (req) => doGenerate(req);

async function doGenerate(
  req: GenerateRequest,
  overrideResolver?: TemplateResolver,
): Promise<GenerateResult> {
  const resolver =
    overrideResolver ??
    createTemplateResolver({ workingDirectory: req.workingDirectory });

  const artifacts: GeneratedArtifact[] = [];
  const warnings: string[] = [];

  for (const ir of req.irs) {
    for (const intent of ir.intents) {
      if (req.signal?.aborted) {
        warnings.push(
          `aborted before processing plasmid=${String(ir.plasmidId)} intent=${intent.id}`,
        );
        return freeze(artifacts, warnings);
      }
      if (DEFERRED_KINDS.has(intent.kind)) {
        warnings.push(formatDeferredWarning(ir.plasmidId, intent));
        continue;
      }

      const deps = {
        resolver,
        strategies: req.strategies,
        workingDirectory: req.workingDirectory,
        llm: req.llm,
        signal: req.signal,
      } as const;

      try {
        switch (intent.kind) {
          case "rule":
            artifacts.push(await generateRuleArtifact(ir, intent, deps));
            break;
          case "skill":
            artifacts.push(await generateSkillArtifact(ir, intent, deps));
            break;
          case "command":
            artifacts.push(await generateCommandArtifact(ir, intent, deps));
            break;
          default:
            // Exhaustiveness check — IntentKind was extended without
            // updating this dispatch. Record as warning, never throw.
            warnings.push(
              `unhandled intent kind "${String(intent.kind)}" on plasmid=${String(ir.plasmidId)} intent=${intent.id}`,
            );
        }
      } catch (err) {
        warnings.push(
          `generator error on plasmid=${String(ir.plasmidId)} intent=${intent.id} (${intent.kind}): ${formatError(err)}`,
        );
      }
    }
  }
  return freeze(artifacts, warnings);
}

function formatDeferredWarning(
  plasmidId: PlasmidIntentNode["sourcePlasmid"],
  intent: PlasmidIntentNode,
): string {
  return `${intent.kind} generator deferred to phase 4 (plasmid=${String(plasmidId)} intent=${intent.id})`;
}

function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function freeze(
  artifacts: readonly GeneratedArtifact[],
  warnings: readonly string[],
): GenerateResult {
  return Object.freeze({
    artifacts: Object.freeze([...artifacts]),
    warnings: Object.freeze([...warnings]),
  });
}

/** Re-exports — callers can pull the resolver + helpers from one path. */
export { createTemplateResolver } from "./template-resolver.js";
export { DEFAULT_HELPERS } from "./helpers.js";
export type { TemplateResolver } from "./template-resolver.js";

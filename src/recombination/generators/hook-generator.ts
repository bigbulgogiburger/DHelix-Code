/**
 * Hook generator — renders two artifacts per intent:
 *   1. `.dhelix/hooks/<Event>/<kebab>.sh` — executable shell script body.
 *   2. `.dhelix/hooks/<Event>/<kebab>.manifest.json` — manifest consumed by
 *      the hook loader. Carries event + matcher + provenance.
 *
 * Pure: no fs writes. Throws a typed `Error` when
 * `intent.params.event` is missing or not a valid `HookGeneratorEvent`.
 *
 * Phase 4 / GAL-1 Team 2. Shares the render + slot-fill pipeline with the
 * rule / skill / command generators so drift detection (P-1.4 §Q4) and
 * the 3-layer template resolver apply uniformly.
 */

import { createHash } from "node:crypto";
import * as path from "node:path";

import type {
  ArtifactTrustLevel,
  CompiledPlasmidIR,
  GeneratedArtifact,
  LLMCompletionFn,
  PipelineStrategies,
  PlasmidIntentNode,
} from "../types.js";
import {
  HOOK_GENERATOR_EVENTS,
  PLASMID_TIER_TRUST_CEILING,
  TRUST_ORDER,
  isHookGeneratorEvent,
} from "../types.js";

import { DEFAULT_HELPERS } from "./helpers.js";
import { finaliseSlots, renderTemplate } from "./render.js";
import { buildTemplateContext, toKebabFileName } from "./shared.js";
import type { TemplateResolver } from "./template-resolver.js";

export interface HookGeneratorDeps {
  readonly resolver: TemplateResolver;
  readonly strategies: PipelineStrategies;
  readonly workingDirectory: string;
  readonly llm?: LLMCompletionFn;
  readonly signal?: AbortSignal;
}

const SCRIPT_TEMPLATE_BASENAME = "hook.basic.hbs";
const MANIFEST_TEMPLATE_BASENAME = "hook.manifest.hbs";

/** Hooks run `bash`; cap the advisory trust at T2 regardless of tier. */
const HOOK_TRUST_CEILING: ArtifactTrustLevel = "T2";

/**
 * Throws when `intent.kind !== "hook"` or `intent.params.event` is missing.
 * Returns a pair of artifacts (script + manifest). AbortSignal is observed
 * between artifacts — if the caller aborts after we produced the script,
 * we return just the script and let the dispatch loop surface the abort.
 */
export async function generateHookArtifacts(
  plasmid: CompiledPlasmidIR,
  intent: PlasmidIntentNode,
  deps: HookGeneratorDeps,
): Promise<readonly GeneratedArtifact[]> {
  if (intent.kind !== "hook") {
    throw new Error(
      `generateHookArtifacts: expected intent.kind="hook", got "${intent.kind}"`,
    );
  }

  const event = intent.params["event"];
  if (!isHookGeneratorEvent(event)) {
    throw new Error(
      `hook generator: invalid or missing intent.params.event — must be one of ${HOOK_GENERATOR_EVENTS.join(", ")}`,
    );
  }

  const matcher =
    typeof intent.params["matcher"] === "string"
      ? (intent.params["matcher"] as string)
      : undefined;
  const bodyOverride =
    typeof intent.params["body"] === "string"
      ? (intent.params["body"] as string)
      : undefined;

  const trustLevel = cappedTrustLevel(plasmid, HOOK_TRUST_CEILING);
  const kebab = toKebabFileName(intent.title);

  // Artifact 1 — script.
  const scriptTemplate = await deps.resolver.resolve(
    SCRIPT_TEMPLATE_BASENAME,
    deps.signal,
  );
  const renderCtx = buildTemplateContext(plasmid, intent, deps.workingDirectory);
  const scriptRender = renderTemplate(scriptTemplate.content, renderCtx, {
    helpers: DEFAULT_HELPERS,
    templateId: scriptTemplate.templateId,
  });

  // If the intent supplies an explicit body, use it verbatim for the
  // `body` slot — bypass the LLM slot-fill path to preserve intent.
  const scriptReplacements: Record<string, string> =
    bodyOverride !== undefined ? { body: bodyOverride.trim() } : {};
  const scriptBody = finaliseSlots(scriptRender, scriptReplacements);

  const scriptArtifact: GeneratedArtifact = {
    kind: "hook",
    sourcePlasmid: plasmid.plasmidId,
    sourceIntentId: intent.id,
    targetPath: path.join(
      deps.workingDirectory,
      ".dhelix",
      "hooks",
      event,
      `${kebab}.sh`,
    ),
    contents: scriptBody,
    contentHash: sha256(scriptBody),
    templateLayer: scriptTemplate.layer,
    templateId: scriptTemplate.templateId,
    trustLevel,
  };

  if (deps.signal?.aborted) {
    return Object.freeze([scriptArtifact]);
  }

  // Artifact 2 — manifest. Resolved via the 3-layer resolver so template
  // drift is still detectable, but the body is assembled via JSON.stringify
  // (string escaping in Handlebars-lite is not safe for arbitrary input).
  const manifestTemplate = await deps.resolver.resolve(
    MANIFEST_TEMPLATE_BASENAME,
    deps.signal,
  );
  const manifestObject: Record<string, unknown> = {
    event,
    script: `${kebab}.sh`,
    matcher: matcher ?? null,
    sourcePlasmid: String(plasmid.plasmidId),
    sourceIntentId: intent.id,
  };
  const manifestBody = `${JSON.stringify(manifestObject, null, 2)}\n`;

  const manifestArtifact: GeneratedArtifact = {
    kind: "hook",
    sourcePlasmid: plasmid.plasmidId,
    sourceIntentId: intent.id,
    targetPath: path.join(
      deps.workingDirectory,
      ".dhelix",
      "hooks",
      event,
      `${kebab}.manifest.json`,
    ),
    contents: manifestBody,
    contentHash: sha256(manifestBody),
    templateLayer: manifestTemplate.layer,
    templateId: manifestTemplate.templateId,
  };

  return Object.freeze([scriptArtifact, manifestArtifact]);
}

function cappedTrustLevel(
  plasmid: CompiledPlasmidIR,
  ceiling: ArtifactTrustLevel,
): ArtifactTrustLevel {
  const tierCeiling = PLASMID_TIER_TRUST_CEILING[plasmid.tier];
  const tierIdx = TRUST_ORDER.indexOf(tierCeiling);
  const capIdx = TRUST_ORDER.indexOf(ceiling);
  if (tierIdx < 0 || capIdx < 0) return ceiling;
  return tierIdx < capIdx ? tierCeiling : ceiling;
}

function sha256(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

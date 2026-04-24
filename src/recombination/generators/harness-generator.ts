/**
 * Harness generator — renders `.dhelix/harness/<kebab>.md`.
 *
 * A harness artifact is an install-recipe document: an overview, a
 * suggested `settings.json` fragment, and a step-by-step apply guide.
 * The generator never mutates `settings.json` itself — that stays a
 * human-reviewed action per PRD §6.3.3.
 *
 * Pure: no fs writes. Throws when `intent.kind !== "harness"`.
 *
 * Phase 4 / GAL-1 Team 2. Shares the render + slot-fill pipeline with the
 * other artifact generators for template drift detection (P-1.4 §Q4).
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
  PLASMID_TIER_TRUST_CEILING,
  isHookGeneratorEvent,
} from "../types.js";

import { DEFAULT_HELPERS } from "./helpers.js";
import { finaliseSlots, renderTemplate } from "./render.js";
import { fillSlots } from "./slot-fill.js";
import { buildTemplateContext, toKebabFileName } from "./shared.js";
import type { TemplateResolver } from "./template-resolver.js";

export interface HarnessGeneratorDeps {
  readonly resolver: TemplateResolver;
  readonly strategies: PipelineStrategies;
  readonly workingDirectory: string;
  readonly llm?: LLMCompletionFn;
  readonly signal?: AbortSignal;
}

const TEMPLATE_BASENAME = "harness.basic.hbs";
/** Placeholder token embedded in the template — replaced post-render. */
const SETTINGS_FRAGMENT_TOKEN = "__HARNESS_SETTINGS_FRAGMENT__";
/** Placeholder shown when the plasmid does not supply a fragment. */
const SETTINGS_FRAGMENT_FALLBACK = [
  "```json",
  "{",
  '  "hooks": {}',
  "}",
  "```",
  "",
  "> No `settings` provided by this intent — replace the stub above with your own mapping.",
].join("\n");

export async function generateHarnessArtifact(
  plasmid: CompiledPlasmidIR,
  intent: PlasmidIntentNode,
  deps: HarnessGeneratorDeps,
): Promise<GeneratedArtifact> {
  if (intent.kind !== "harness") {
    throw new Error(
      `generateHarnessArtifact: expected intent.kind="harness", got "${intent.kind}"`,
    );
  }

  const template = await deps.resolver.resolve(TEMPLATE_BASENAME, deps.signal);
  const renderCtx = buildTemplateContext(plasmid, intent, deps.workingDirectory);
  const rendered = renderTemplate(template.content, renderCtx, {
    helpers: DEFAULT_HELPERS,
    templateId: template.templateId,
  });

  // Slot-fill is best-effort and only fires when the strategy opts in.
  // Hook/harness share the "command" slot-fill context shape — the LLM
  // prompt adapts from the kind string alone. The slot-fill module only
  // accepts rule/skill/command today (see SlotFillContext), so we skip
  // the LLM path entirely for harness to avoid widening that union here.
  const useLlm = deps.strategies.artifactGeneration === "template-and-llm";
  const replacements = useLlm
    ? await fillSlots(
        rendered.slots,
        { plasmid, intent, kind: "command" },
        { llm: deps.llm, signal: deps.signal },
      )
    : {};

  const filled = finaliseSlots(rendered, replacements);
  const body = injectSettingsFragment(filled, intent);

  const fileName = toKebabFileName(intent.title) + ".md";
  const targetPath = path.join(
    deps.workingDirectory,
    ".dhelix",
    "harness",
    fileName,
  );

  const trustLevel: ArtifactTrustLevel = PLASMID_TIER_TRUST_CEILING[plasmid.tier];

  return {
    kind: "harness",
    sourcePlasmid: plasmid.plasmidId,
    sourceIntentId: intent.id,
    targetPath,
    contents: body,
    contentHash: sha256(body),
    templateLayer: template.layer,
    templateId: template.templateId,
    trustLevel,
  };
}

function injectSettingsFragment(
  renderedBody: string,
  intent: PlasmidIntentNode,
): string {
  const fragment = buildSettingsFragment(intent);
  return renderedBody.split(SETTINGS_FRAGMENT_TOKEN).join(fragment);
}

function buildSettingsFragment(intent: PlasmidIntentNode): string {
  const settings = intent.params["settings"];
  const event = intent.params["event"];
  const anchorLine = isHookGeneratorEvent(event)
    ? `> Suggested anchor event: \`${event}\`.`
    : undefined;

  if (settings === undefined || settings === null) {
    return anchorLine
      ? `${anchorLine}\n\n${SETTINGS_FRAGMENT_FALLBACK}`
      : SETTINGS_FRAGMENT_FALLBACK;
  }

  if (!isPlainObject(settings)) {
    // Defensive — the contract says `Record<string, unknown>`. If a caller
    // supplies a scalar or array we still emit a valid fenced block.
    const stringified = `${JSON.stringify(settings, null, 2)}\n`;
    const block = ["```json", stringified.trimEnd(), "```"].join("\n");
    return anchorLine ? `${anchorLine}\n\n${block}` : block;
  }

  const pretty = JSON.stringify(settings, null, 2);
  const block = ["```json", pretty, "```"].join("\n");
  return anchorLine ? `${anchorLine}\n\n${block}` : block;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return (
    typeof v === "object" && v !== null && !Array.isArray(v)
  );
}

function sha256(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

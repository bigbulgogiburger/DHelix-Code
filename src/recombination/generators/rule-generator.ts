/**
 * Rule generator — renders `.dhelix/rules/<kebab-name>.md`.
 *
 * Pure: no fs writes. Returns a `GeneratedArtifact` envelope ready for
 * Team 5's Stage 4 persistence.
 */

import { createHash } from "node:crypto";
import * as path from "node:path";

import type {
  CompiledPlasmidIR,
  GeneratedArtifact,
  LLMCompletionFn,
  PipelineStrategies,
  PlasmidIntentNode,
} from "../types.js";

import { DEFAULT_HELPERS } from "./helpers.js";
import { buildTemplateContext, toKebabFileName } from "./shared.js";
import { finaliseSlots, renderTemplate } from "./render.js";
import { fillSlots } from "./slot-fill.js";
import type { TemplateResolver } from "./template-resolver.js";

export interface RuleGeneratorDeps {
  readonly resolver: TemplateResolver;
  readonly strategies: PipelineStrategies;
  readonly workingDirectory: string;
  readonly llm?: LLMCompletionFn;
  readonly signal?: AbortSignal;
}

const TEMPLATE_BASENAME = "rule.basic.hbs";

export async function generateRuleArtifact(
  plasmid: CompiledPlasmidIR,
  intent: PlasmidIntentNode,
  deps: RuleGeneratorDeps,
): Promise<GeneratedArtifact> {
  if (intent.kind !== "rule") {
    throw new Error(
      `generateRuleArtifact: expected intent.kind="rule", got "${intent.kind}"`,
    );
  }
  const template = await deps.resolver.resolve(TEMPLATE_BASENAME, deps.signal);
  const renderCtx = buildTemplateContext(plasmid, intent, deps.workingDirectory);
  const rendered = renderTemplate(template.content, renderCtx, {
    helpers: DEFAULT_HELPERS,
    templateId: template.templateId,
  });

  const useLlm = deps.strategies.artifactGeneration === "template-and-llm";
  const replacements = useLlm
    ? await fillSlots(
        rendered.slots,
        { plasmid, intent, kind: "rule" },
        { llm: deps.llm, signal: deps.signal },
      )
    : {};

  const body = finaliseSlots(rendered, replacements);
  const fileName = toKebabFileName(intent.title) + ".md";
  const targetPath = path.join(
    deps.workingDirectory,
    ".dhelix",
    "rules",
    fileName,
  );
  return {
    kind: "rule",
    sourcePlasmid: plasmid.plasmidId,
    sourceIntentId: intent.id,
    targetPath,
    contents: body,
    contentHash: sha256(body),
    templateLayer: template.layer,
    templateId: template.templateId,
  };
}

function sha256(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

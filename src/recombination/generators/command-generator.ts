/**
 * Command generator — renders `.dhelix/commands/<kebab-name>.md`.
 *
 * Pure: no fs writes.
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
import { finaliseSlots, renderTemplate } from "./render.js";
import { fillSlots } from "./slot-fill.js";
import { buildTemplateContext, toKebabFileName } from "./shared.js";
import type { TemplateResolver } from "./template-resolver.js";

export interface CommandGeneratorDeps {
  readonly resolver: TemplateResolver;
  readonly strategies: PipelineStrategies;
  readonly workingDirectory: string;
  readonly llm?: LLMCompletionFn;
  readonly signal?: AbortSignal;
}

const TEMPLATE_BASENAME = "command.basic.hbs";

export async function generateCommandArtifact(
  plasmid: CompiledPlasmidIR,
  intent: PlasmidIntentNode,
  deps: CommandGeneratorDeps,
): Promise<GeneratedArtifact> {
  if (intent.kind !== "command") {
    throw new Error(
      `generateCommandArtifact: expected intent.kind="command", got "${intent.kind}"`,
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
        { plasmid, intent, kind: "command" },
        { llm: deps.llm, signal: deps.signal },
      )
    : {};

  const body = finaliseSlots(rendered, replacements);
  const fileName = toKebabFileName(intent.title) + ".md";
  const targetPath = path.join(
    deps.workingDirectory,
    ".dhelix",
    "commands",
    fileName,
  );
  return {
    kind: "command",
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

/**
 * Skill generator — renders `.dhelix/skills/<kebab-name>/SKILL.md`.
 *
 * Design note: `src/skills/creator/scaffold.ts` is the established skill
 * scaffolder but it PERFORMS FILE I/O and takes interactive-style options.
 * Stage 2b must stay in-memory (persistence is Team 5's Stage 4), so we
 * render `SKILL.md` directly via the template. The on-disk skill layout
 * (`SKILL.md` + `evals/` + `references/`) is produced at Stage 4.
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

export interface SkillGeneratorDeps {
  readonly resolver: TemplateResolver;
  readonly strategies: PipelineStrategies;
  readonly workingDirectory: string;
  readonly llm?: LLMCompletionFn;
  readonly signal?: AbortSignal;
}

const TEMPLATE_BASENAME = "skill.basic.hbs";

export async function generateSkillArtifact(
  plasmid: CompiledPlasmidIR,
  intent: PlasmidIntentNode,
  deps: SkillGeneratorDeps,
): Promise<GeneratedArtifact> {
  if (intent.kind !== "skill") {
    throw new Error(
      `generateSkillArtifact: expected intent.kind="skill", got "${intent.kind}"`,
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
        { plasmid, intent, kind: "skill" },
        { llm: deps.llm, signal: deps.signal },
      )
    : {};

  const body = finaliseSlots(rendered, replacements);
  const dirName = toKebabFileName(intent.title);
  const targetPath = path.join(
    deps.workingDirectory,
    ".dhelix",
    "skills",
    dirName,
    "SKILL.md",
  );
  return {
    kind: "skill",
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

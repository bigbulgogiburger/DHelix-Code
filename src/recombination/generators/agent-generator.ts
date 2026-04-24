/**
 * Agent generator — renders `.dhelix/agents/<kebab-name>.md`.
 *
 * Phase 4 GAL-1 Team 1. Output frontmatter validates against
 * `agentDefinitionSchema` (`src/subagents/definition-types.ts`). Pure: no
 * fs writes — persistence is Team 5's Stage 4.
 *
 * Trust level default: `PLASMID_TIER_TRUST_CEILING[ir.tier]`. If
 * `intent.params.trustLevel` is a valid `ArtifactTrustLevel` and ≤ ceiling
 * per `TRUST_ORDER`, the override is honored; otherwise the ceiling wins
 * (the wiring validator will flag any mismatch downstream).
 */

import { createHash } from "node:crypto";
import * as path from "node:path";

import {
  agentDefinitionSchema,
  type AgentDefinitionFrontmatter,
} from "../../subagents/definition-types.js";

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
  TRUST_ORDER,
} from "../types.js";

import { DEFAULT_HELPERS } from "./helpers.js";
import { finaliseSlots, renderTemplate } from "./render.js";
import { fillSlots } from "./slot-fill.js";
import { buildTemplateContext, toKebabFileName } from "./shared.js";
import type { TemplateResolver } from "./template-resolver.js";

export interface AgentGeneratorDeps {
  readonly resolver: TemplateResolver;
  readonly strategies: PipelineStrategies;
  readonly workingDirectory: string;
  readonly llm?: LLMCompletionFn;
  readonly signal?: AbortSignal;
}

const TEMPLATE_BASENAME = "agent.basic.hbs";

/** Named trust levels — narrow set used in `TRUST_ORDER`. */
const TRUST_LEVELS: ReadonlySet<string> = new Set(TRUST_ORDER);

/** Kebab-case guard mirroring `agentDefinitionSchema.name`. */
const AGENT_NAME_REGEX = /^[a-z][a-z0-9-]*$/;

export async function generateAgentArtifact(
  plasmid: CompiledPlasmidIR,
  intent: PlasmidIntentNode,
  deps: AgentGeneratorDeps,
): Promise<GeneratedArtifact> {
  if (intent.kind !== "agent") {
    throw new Error(
      `generateAgentArtifact: expected intent.kind="agent", got "${intent.kind}"`,
    );
  }

  const fileStem = toKebabFileName(intent.title);
  const frontmatter = buildFrontmatter(fileStem, intent);

  // Validate shape — throw a typed Error with aggregated issues.
  const parsed = agentDefinitionSchema.safeParse(frontmatter);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => i.message)
      .join(", ");
    throw new Error(`Invalid agent frontmatter: ${issues}`);
  }

  const template = await deps.resolver.resolve(TEMPLATE_BASENAME, deps.signal);
  // The mini Handlebars renderer rejects missing properties on dotted
  // paths (`{{#if frontmatter.tools}}` throws when `tools` is absent), so
  // we materialise every optional key as `null`. `null`/`false`/`""` all
  // count as falsy for `#if`, giving the right conditional behaviour.
  const templateFrontmatter = Object.freeze({
    name: parsed.data.name,
    description: parsed.data.description,
    tools: parsed.data.tools ?? null,
    model: parsed.data.model ?? null,
    maxTurns: parsed.data.maxTurns ?? null,
    permissionMode: parsed.data.permissionMode ?? null,
    skills: parsed.data.skills ?? null,
    memory: parsed.data.memory ?? null,
  });
  const renderCtx = {
    ...buildTemplateContext(plasmid, intent, deps.workingDirectory),
    frontmatter: templateFrontmatter,
  };
  const rendered = renderTemplate(template.content, renderCtx, {
    helpers: DEFAULT_HELPERS,
    templateId: template.templateId,
  });

  const useLlm = deps.strategies.artifactGeneration === "template-and-llm";
  const replacements = useLlm
    ? await fillSlots(
        rendered.slots,
        { plasmid, intent, kind: "agent" },
        { llm: deps.llm, signal: deps.signal },
      )
    : {};

  const body = finaliseSlots(rendered, replacements);
  const fileName = `${fileStem}.md`;
  const targetPath = path.join(
    deps.workingDirectory,
    ".dhelix",
    "agents",
    fileName,
  );
  const trustLevel = resolveTrustLevel(plasmid, intent);

  const artifact: GeneratedArtifact = {
    kind: "agent",
    sourcePlasmid: plasmid.plasmidId,
    sourceIntentId: intent.id,
    targetPath,
    contents: body,
    contentHash: sha256(body),
    templateLayer: template.layer,
    templateId: template.templateId,
    ...(parsed.data.tools !== undefined
      ? { requiredTools: parsed.data.tools }
      : {}),
    trustLevel,
  };
  return artifact;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function buildFrontmatter(
  fileStem: string,
  intent: PlasmidIntentNode,
): Record<string, unknown> {
  const description = (intent.description ?? "").trim();
  // Prefer intent.params.name when present + kebab-valid; otherwise derive.
  const nameParam = readString(intent.params, "name");
  const name =
    nameParam && AGENT_NAME_REGEX.test(nameParam) ? nameParam : fileStem;

  const fm: Record<string, unknown> = {
    name,
    description: description.length > 0 ? description : intent.title,
  };

  const tools = readStringArray(intent.params, "tools");
  if (tools !== undefined) fm.tools = tools;

  const model = readString(intent.params, "model");
  if (model !== undefined) fm.model = model;

  const maxTurns = readNumber(intent.params, "maxTurns");
  if (maxTurns !== undefined) fm.maxTurns = maxTurns;

  const permissionMode = readString(intent.params, "permissionMode");
  if (permissionMode !== undefined) fm.permissionMode = permissionMode;

  const skills = readStringArray(intent.params, "skills");
  if (skills !== undefined) fm.skills = skills;

  const memory = readString(intent.params, "memory");
  if (memory !== undefined) fm.memory = memory;

  return fm;
}

function resolveTrustLevel(
  plasmid: CompiledPlasmidIR,
  intent: PlasmidIntentNode,
): ArtifactTrustLevel {
  // `ir.tier` is typed `PlasmidTier`; a defensive lookup keeps us crash-safe
  // in the face of a future tier extension we forgot to map.
  const ceiling: ArtifactTrustLevel =
    PLASMID_TIER_TRUST_CEILING[plasmid.tier] ?? "T0";
  const override = readString(intent.params, "trustLevel");
  if (override !== undefined && isArtifactTrustLevel(override)) {
    if (trustIndex(override) <= trustIndex(ceiling)) {
      return override;
    }
  }
  return ceiling;
}

function trustIndex(level: ArtifactTrustLevel): number {
  return TRUST_ORDER.indexOf(level);
}

function isArtifactTrustLevel(value: string): value is ArtifactTrustLevel {
  return TRUST_LEVELS.has(value);
}

function readString(
  params: Readonly<Record<string, unknown>>,
  key: string,
): string | undefined {
  const v = params[key];
  return typeof v === "string" ? v : undefined;
}

function readNumber(
  params: Readonly<Record<string, unknown>>,
  key: string,
): number | undefined {
  const v = params[key];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function readStringArray(
  params: Readonly<Record<string, unknown>>,
  key: string,
): readonly unknown[] | undefined {
  const v = params[key];
  // Returned as-is when the key is set so downstream zod validation can
  // surface element-type violations instead of the generator silently
  // stripping bad input.
  return Array.isArray(v) ? v : undefined;
}

function sha256(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

// Re-export the frontmatter type so the wiring validator and tests can
// share the exact shape the generator produced.
export type { AgentDefinitionFrontmatter };

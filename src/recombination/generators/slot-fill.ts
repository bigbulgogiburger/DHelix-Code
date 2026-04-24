/**
 * Slot-fill — refine rendered template slots via the shared LLM adapter.
 *
 * Only invoked when `strategies.artifactGeneration === "template-and-llm"`.
 * For each slot the caller provides (name + default content + surrounding
 * context), we ask the LLM to improve the default with the plasmid intent
 * as prompt seed. On error / timeout / abort the default is preserved —
 * slot-fill MUST never corrupt the output.
 */

import type {
  CompiledPlasmidIR,
  LLMCompletionFn,
  PlasmidIntentNode,
} from "../types.js";

import type { RenderedSlot } from "./render.js";

export interface SlotFillContext {
  readonly plasmid: CompiledPlasmidIR;
  readonly intent: PlasmidIntentNode;
  readonly kind: "rule" | "skill" | "command" | "agent";
}

export interface SlotFillOptions {
  readonly llm?: LLMCompletionFn;
  readonly signal?: AbortSignal;
  /** Soft per-slot token budget for the LLM reply. */
  readonly maxTokensPerSlot?: number;
  /** Stable seed used for deterministic tests. */
  readonly temperature?: number;
}

/** Map of `{ slotName: refinedContent }`. Absent keys → default kept. */
export type SlotReplacements = Readonly<Record<string, string>>;

const DEFAULT_MAX_TOKENS = 400;
const DEFAULT_TEMPERATURE = 0.2;

/**
 * Fill slots by calling the shared LLM. If `llm` is undefined or the
 * strategy is effectively `template-only`, returns an empty map so the
 * caller keeps all defaults.
 */
export async function fillSlots(
  slots: readonly RenderedSlot[],
  ctx: SlotFillContext,
  opts: SlotFillOptions = {},
): Promise<SlotReplacements> {
  if (!opts.llm || slots.length === 0) return Object.freeze({});
  const { llm, signal } = opts;
  const maxTokens = opts.maxTokensPerSlot ?? DEFAULT_MAX_TOKENS;
  const temperature = opts.temperature ?? DEFAULT_TEMPERATURE;

  const result: Record<string, string> = {};

  for (const slot of slots) {
    if (signal?.aborted) break;
    try {
      const refined = await llm({
        system: buildSystemPrompt(ctx, slot),
        user: buildUserPrompt(ctx, slot),
        temperature,
        maxTokens,
        signal,
      });
      const trimmed = sanitise(refined);
      if (trimmed.length > 0) {
        result[slot.name] = trimmed;
      }
    } catch {
      // Preserve default on ANY error — slot-fill is best-effort.
      continue;
    }
  }
  return Object.freeze(result);
}

function buildSystemPrompt(ctx: SlotFillContext, slot: RenderedSlot): string {
  return [
    `You refine a single "${slot.name}" section of a generated dhelix ${ctx.kind}.`,
    `Keep the output concise (2-4 sentences), markdown-safe, and free of headings.`,
    `Do NOT add YAML frontmatter, fences, or H1/H2/H3 headings — the template already supplies them.`,
    `Preserve the semantic intent of the default; do not invent new constraints.`,
  ].join("\n");
}

function buildUserPrompt(ctx: SlotFillContext, slot: RenderedSlot): string {
  const constraints =
    ctx.intent.constraints.length > 0
      ? ctx.intent.constraints.map((c) => `- ${c}`).join("\n")
      : "(none)";
  return [
    `Plasmid: ${ctx.plasmid.metadata.name} (tier: ${ctx.plasmid.metadata.tier})`,
    `Intent kind: ${ctx.intent.kind}`,
    `Intent title: ${ctx.intent.title}`,
    `Intent description: ${ctx.intent.description}`,
    `Constraints:\n${constraints}`,
    `Slot: ${slot.name}`,
    `Current default:\n<<<\n${slot.defaultContent.trim()}\n>>>`,
    ``,
    `Return an improved replacement body. Plain markdown only; no fences.`,
  ].join("\n");
}

/** Strip code fences / leading+trailing whitespace / markdown heading lines. */
function sanitise(raw: string): string {
  if (typeof raw !== "string") return "";
  let text = raw.trim();
  // Strip surrounding ``` fences if the LLM wrapped the response.
  if (text.startsWith("```")) {
    const firstNl = text.indexOf("\n");
    if (firstNl !== -1) text = text.slice(firstNl + 1);
    if (text.endsWith("```")) text = text.slice(0, -3);
    text = text.trim();
  }
  // Drop any accidental leading heading lines — the template owns the
  // heading structure.
  const lines = text.split("\n").filter((line) => !/^#{1,6}\s/.test(line));
  return lines.join("\n").trim();
}

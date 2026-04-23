/**
 * Prompt builders for the interpreter's three strategies.
 *
 * Every prompt is English (Phase 2 convention — see hardening §19). Prompts
 * deliberately avoid emitting the plasmid id or path so LLM providers that log
 * requests do not leak repository metadata (defence in depth for I-8).
 *
 * Layer: Core (Layer 2). Pure string builders; no I/O.
 */

import type { IntentKind } from "../types.js";
import { INTENT_KINDS } from "./schema.js";

const INTENT_KIND_LIST = INTENT_KINDS.join(" | ");

/** Shared header used in every system prompt so we keep the contract in one place. */
const SCHEMA_SECTION = `
Return a JSON object matching the following schema (omit unknown optional fields):
{
  "summary": string,                // one-sentence plain-English summary (<=160 chars)
  "intents": Array<{
    "id"?: string,                  // stable slug; optional (caller defaults it)
    "kind": ${INTENT_KIND_LIST},    // artifact kind the generator should emit
    "title": string,                // imperative, <=80 chars
    "description": string,          // one paragraph
    "constraints": string[],        // pre-run assertions; may be empty
    "evidence": string[],           // supporting rationale lines; may be empty
    "params": { [key: string]: unknown }  // generator hints (trigger, tools, ...)
  }>
}
Rules:
- Output MUST be a single JSON object.
- Do not include markdown fences or commentary.
- Keep titles short and imperative ("Block secret leaks", not "This plasmid blocks ...").
`.trim();

/** System prompt for the single-pass strategy. */
export function buildSinglePassSystemPrompt(): string {
  return [
    "You are the dhelix plasmid interpreter.",
    "You extract structured intents from a plasmid body for a downstream generator.",
    SCHEMA_SECTION,
  ].join("\n\n");
}

/** User prompt for the single-pass strategy — the entire plasmid body. */
export function buildSinglePassUserPrompt(body: string): string {
  return [
    "Plasmid body (markdown):",
    "```markdown",
    body.trim(),
    "```",
    "Emit the JSON object now.",
  ].join("\n");
}

/** System prompt for the chunked strategy — scoped to a single section. */
export function buildChunkedSystemPrompt(sectionName: string): string {
  return [
    "You are the dhelix plasmid interpreter (chunked mode).",
    `You are given ONE section of a plasmid body titled "${sectionName}".`,
    "Extract only the intents that are clearly expressed in this section.",
    "If no intents are implied, return { \"summary\": \"\", \"intents\": [] }.",
    SCHEMA_SECTION,
  ].join("\n\n");
}

/** User prompt for a single chunked section. */
export function buildChunkedUserPrompt(sectionName: string, sectionBody: string): string {
  return [
    `Section: ${sectionName}`,
    "```markdown",
    sectionBody.trim(),
    "```",
    "Emit the JSON object now.",
  ].join("\n");
}

/** System prompt for the field-by-field strategy. */
export function buildFieldSystemPrompt(): string {
  return [
    "You are the dhelix plasmid interpreter (field-by-field mode).",
    "Answer with EXACTLY the JSON schema requested for the field in question.",
    "No extra keys, no commentary, no markdown.",
  ].join("\n");
}

/** Supported field-by-field question kinds. */
export type FieldQuestion =
  | { readonly kind: "title"; readonly sectionName: string; readonly sectionBody: string }
  | { readonly kind: "description"; readonly sectionName: string; readonly sectionBody: string }
  | { readonly kind: "intent-kind"; readonly sectionName: string; readonly sectionBody: string }
  | { readonly kind: "constraints"; readonly sectionName: string; readonly sectionBody: string }
  | { readonly kind: "evidence"; readonly sectionName: string; readonly sectionBody: string }
  | { readonly kind: "summary"; readonly body: string };

/** Build the user prompt for one field-level question. */
export function buildFieldUserPrompt(q: FieldQuestion): string {
  switch (q.kind) {
    case "summary":
      return [
        "Return JSON: { \"summary\": string } — one imperative sentence <=160 chars.",
        "Body:",
        "```markdown",
        q.body.trim(),
        "```",
      ].join("\n");
    case "title":
      return [
        `Section "${q.sectionName}" — return JSON: { "title": string } (<=80 chars, imperative).`,
        "Body:",
        "```markdown",
        q.sectionBody.trim(),
        "```",
      ].join("\n");
    case "description":
      return [
        `Section "${q.sectionName}" — return JSON: { "description": string } (one paragraph).`,
        "Body:",
        "```markdown",
        q.sectionBody.trim(),
        "```",
      ].join("\n");
    case "intent-kind":
      return [
        `Section "${q.sectionName}" — return JSON: { "kind": ${INTENT_KIND_LIST} }.`,
        "Pick the single best artifact kind for the generator.",
        "Body:",
        "```markdown",
        q.sectionBody.trim(),
        "```",
      ].join("\n");
    case "constraints":
      return [
        `Section "${q.sectionName}" — return JSON: { "constraints": string[] }.`,
        "List imperative assertions only; omit prose. Empty array if none.",
        "Body:",
        "```markdown",
        q.sectionBody.trim(),
        "```",
      ].join("\n");
    case "evidence":
      return [
        `Section "${q.sectionName}" — return JSON: { "evidence": string[] }.`,
        "Supporting rationale bullets. Empty array if none.",
        "Body:",
        "```markdown",
        q.sectionBody.trim(),
        "```",
      ].join("\n");
    default: {
      // Exhaustiveness guard — unreachable in well-typed callers.
      const _exhaustive: never = q;
      return _exhaustive;
    }
  }
}

/** XML fallback system prompt — stricter format when JSON keeps failing. */
export function buildXmlFallbackSystemPrompt(): string {
  return [
    "You are the dhelix plasmid interpreter (XML fallback mode).",
    "Emit XML ONLY (no markdown fences, no prose).",
    "Root element: <plasmid>. Each intent is <intent kind=\"...\"> with child nodes:",
    "  <title>...</title>",
    "  <description>...</description>",
    "  <constraints><item>...</item></constraints>",
    "  <evidence><item>...</item></evidence>",
    "Also emit <summary>...</summary> under <plasmid>.",
    `Allowed kinds: ${INTENT_KIND_LIST}.`,
  ].join("\n");
}

/** Map each top-level section heading to a default intent kind. */
export function defaultKindForSection(name: string): IntentKind {
  const lowered = name.trim().toLowerCase();
  if (lowered.includes("hook")) return "hook";
  if (lowered.includes("rule") || lowered.includes("constraint")) return "rule";
  if (lowered.includes("command")) return "command";
  if (lowered.includes("skill")) return "skill";
  if (lowered.includes("harness")) return "harness";
  return "agent";
}

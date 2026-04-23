/**
 * Field-by-field interpreter strategy (local-small / strategyTier C).
 *
 * The most constrained strategy: one LLM call per field. Small models cannot
 * be trusted to emit a full `{ summary, intents[] }` JSON envelope reliably
 * (see P-1.19 §3 and hardening §6.1.2). Instead we ask them one scalar
 * question at a time, each answered as a tiny single-field JSON object, then
 * assemble the intent locally.
 *
 * Per-section steps:
 *   1. intent-kind → `{ kind: ... }`
 *   2. title       → `{ title: ... }`
 *   3. description → `{ description: ... }`
 *   4. constraints → `{ constraints: string[] }`
 *   5. evidence    → `{ evidence: string[] }`
 *
 * Plus one final "summary" pass over the whole body. Each call retries up to
 * `input.retries` times. After two consecutive JSON failures the per-field
 * path switches to XML fallback (adopting the same tolerant parser Team 1
 * ships for whole-plasmid parsing).
 *
 * Layer: Core (Layer 2).
 */

import type { IntentKind, LLMCompletionFn } from "../types.js";
import {
  buildFieldSystemPrompt,
  buildFieldUserPrompt,
  buildXmlFallbackSystemPrompt,
  defaultKindForSection,
  type FieldQuestion,
} from "./prompts.js";
import { splitSections, type BodySection } from "./chunked.js";
import { INTENT_KINDS, type InterpretedIntent, type InterpretedPayload } from "./schema.js";
import {
  InterpreterJsonFailureError,
  assertNotAborted,
  stripJsonFences,
  type StrategyInput,
  type StrategyOutput,
} from "./single-pass.js";
import { parseXmlFallback } from "./xml-fallback.js";

const INTENT_KIND_SET: ReadonlySet<IntentKind> = new Set(INTENT_KINDS);

/** Execute the field-by-field strategy. */
export async function runFieldByField(input: StrategyInput): Promise<StrategyOutput> {
  const warnings: string[] = [];
  assertNotAborted(input.signal);
  const sections = splitSections(input.plasmid.body);
  const intents: InterpretedIntent[] = [];
  let xmlEngaged = false;

  for (const section of sections) {
    assertNotAborted(input.signal);
    try {
      const intent = await buildIntentForSection(input, section, xmlEngaged);
      intents.push(intent);
    } catch (error) {
      if (!xmlEngaged) {
        xmlEngaged = true;
        warnings.push(`xml-fallback engaged for plasmid ${input.plasmid.metadata.id}`);
        try {
          intents.push(await buildIntentForSection(input, section, true));
          continue;
        } catch {
          // fall through to synthetic
        }
      }
      warnings.push(
        `field-by-field failed for section "${section.name}" of plasmid ${input.plasmid.metadata.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      intents.push(syntheticIntent(section));
    }
  }

  // Final summary pass — non-fatal; fall back to metadata description on failure.
  let summary = input.plasmid.metadata.description;
  try {
    summary = await askSummary(input, xmlEngaged);
  } catch {
    warnings.push(
      `field-by-field summary pass failed for plasmid ${input.plasmid.metadata.id}; using metadata description`,
    );
  }

  return {
    payload: { summary, intents },
    warnings,
  };
}

async function buildIntentForSection(
  input: StrategyInput,
  section: BodySection,
  xmlMode: boolean,
): Promise<InterpretedIntent> {
  const kind = await askIntentKind(input, section, xmlMode);
  const title = await askTitle(input, section, xmlMode);
  const description = await askDescription(input, section, xmlMode);
  const constraints = await askListField(input, section, "constraints", xmlMode);
  const evidence = await askListField(input, section, "evidence", xmlMode);
  return {
    kind,
    title,
    description,
    constraints: [...constraints],
    evidence: [...evidence],
    params: {},
  };
}

async function askIntentKind(
  input: StrategyInput,
  section: BodySection,
  xmlMode: boolean,
): Promise<IntentKind> {
  if (xmlMode) return defaultKindForSection(section.name);
  const raw = await runFieldCall(
    input,
    { kind: "intent-kind", sectionName: section.name, sectionBody: section.body },
  );
  const parsed = parseFieldJson(raw) as { kind?: unknown };
  const candidate = typeof parsed.kind === "string" ? parsed.kind : "";
  return INTENT_KIND_SET.has(candidate as IntentKind)
    ? (candidate as IntentKind)
    : defaultKindForSection(section.name);
}

async function askTitle(
  input: StrategyInput,
  section: BodySection,
  xmlMode: boolean,
): Promise<string> {
  if (xmlMode) return section.name.slice(0, 80);
  const raw = await runFieldCall(
    input,
    { kind: "title", sectionName: section.name, sectionBody: section.body },
  );
  const parsed = parseFieldJson(raw) as { title?: unknown };
  const candidate = typeof parsed.title === "string" ? parsed.title.trim() : "";
  return (candidate.length > 0 ? candidate : section.name).slice(0, 80);
}

async function askDescription(
  input: StrategyInput,
  section: BodySection,
  xmlMode: boolean,
): Promise<string> {
  if (xmlMode) {
    // Best effort under XML: use the section body itself (trimmed).
    return section.body.slice(0, 500);
  }
  const raw = await runFieldCall(
    input,
    { kind: "description", sectionName: section.name, sectionBody: section.body },
  );
  const parsed = parseFieldJson(raw) as { description?: unknown };
  const candidate = typeof parsed.description === "string" ? parsed.description.trim() : "";
  return candidate.length > 0 ? candidate : section.body.slice(0, 500);
}

async function askListField(
  input: StrategyInput,
  section: BodySection,
  field: "constraints" | "evidence",
  xmlMode: boolean,
): Promise<readonly string[]> {
  if (xmlMode) return [];
  const raw = await runFieldCall(
    input,
    { kind: field, sectionName: section.name, sectionBody: section.body },
  );
  const parsed = parseFieldJson(raw) as Record<string, unknown>;
  const value = parsed[field];
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

async function askSummary(input: StrategyInput, xmlMode: boolean): Promise<string> {
  if (xmlMode) {
    // Under XML mode we still try to synthesise a one-line summary via the
    // shallow XML parser — that way Team 4 sees a non-empty `summary`.
    const xmlRaw = await input.llm({
      system: buildXmlFallbackSystemPrompt(),
      user: `<plasmid><summary>Describe the plasmid in one sentence.</summary></plasmid>\n\nBody:\n${input.plasmid.body}`,
      jsonMode: false,
      temperature: 0,
      signal: input.signal,
    });
    const result = parseXmlFallback(xmlRaw);
    return result.summary;
  }
  const raw = await runFieldCall(input, { kind: "summary", body: input.plasmid.body });
  const parsed = parseFieldJson(raw) as { summary?: unknown };
  const candidate = typeof parsed.summary === "string" ? parsed.summary.trim() : "";
  return candidate.length > 0 ? candidate : input.plasmid.metadata.description;
}

/** Run one field-level LLM call with retry. */
async function runFieldCall(input: StrategyInput, question: FieldQuestion): Promise<string> {
  const system = buildFieldSystemPrompt();
  const user = buildFieldUserPrompt(question);
  const attempts = Math.max(1, input.retries) + 1;
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    assertNotAborted(input.signal);
    try {
      const raw = await runLlmOnce(input.llm, system, user, input.signal);
      return raw;
    } catch (error) {
      lastError = error;
    }
  }
  throw new InterpreterJsonFailureError(
    `field-by-field interpreter exhausted retries for field "${question.kind}"`,
    {
      plasmidId: input.plasmid.metadata.id,
      field: question.kind,
      lastError: lastError instanceof Error ? lastError.message : String(lastError),
    },
  );
}

async function runLlmOnce(
  llm: LLMCompletionFn,
  system: string,
  user: string,
  signal: AbortSignal | undefined,
): Promise<string> {
  return llm({ system, user, jsonMode: true, temperature: 0, signal });
}

/** Parse a single-field JSON scalar emission. Throws for non-objects. */
function parseFieldJson(raw: string): Record<string, unknown> {
  const unfenced = stripJsonFences(raw).trim();
  if (unfenced.length === 0) throw new Error("empty field response");
  const parsed = JSON.parse(unfenced) as unknown;
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("field response was not a JSON object");
  }
  return parsed as Record<string, unknown>;
}

function syntheticIntent(section: BodySection): InterpretedIntent {
  return {
    kind: defaultKindForSection(section.name),
    title: section.name.slice(0, 80),
    description: `Section parsed via field-by-field fallback: ${section.name}`,
    constraints: [],
    evidence: [],
    params: { fallback: true },
  };
}

export type { InterpretedPayload };

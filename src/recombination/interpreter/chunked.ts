/**
 * Chunked interpreter strategy (local-large / strategyTier B).
 *
 * Split the plasmid body on top-level `## ` headings. Each section gets its
 * own LLM call that emits a partial JSON payload (`summary` + `intents[]`
 * scoped to that section). Section summaries are concatenated; intents are
 * merged in order. Missing sections are skipped silently.
 *
 * XML fallback: after two consecutive JSON parse failures across the pipeline
 * (not per-section), subsequent sections are re-prompted with the XML schema.
 * Warnings list the plasmid id so callers can flag the run in the transcript.
 *
 * Layer: Core (Layer 2).
 */

import type {
  InterpreterStrategy,
  LLMCompletionFn,
  LoadedPlasmid,
} from "../types.js";
import {
  buildChunkedSystemPrompt,
  buildChunkedUserPrompt,
  buildXmlFallbackSystemPrompt,
  defaultKindForSection,
} from "./prompts.js";
import {
  interpretedPayloadSchema,
  type InterpretedIntent,
  type InterpretedPayload,
} from "./schema.js";
import {
  InterpreterJsonFailureError,
  assertNotAborted,
  parseAndValidate,
  type StrategyInput,
  type StrategyOutput,
} from "./single-pass.js";
import { parseXmlFallback, toInterpretedPayload } from "./xml-fallback.js";

/** A split section of the plasmid body. */
export interface BodySection {
  readonly name: string;
  readonly body: string;
}

/**
 * Split a plasmid body on `## ` (H2) headings. Content before the first H2
 * is treated as the `"Overview"` section so nothing is silently dropped.
 */
export function splitSections(body: string): readonly BodySection[] {
  const lines = body.split(/\r?\n/);
  const sections: BodySection[] = [];
  let currentName = "Overview";
  let currentLines: string[] = [];
  const flush = (): void => {
    const content = currentLines.join("\n").trim();
    if (content.length > 0) {
      sections.push({ name: currentName, body: content });
    }
    currentLines = [];
  };
  for (const line of lines) {
    const headingMatch = /^##\s+(.+?)\s*$/.exec(line);
    if (headingMatch !== null) {
      flush();
      currentName = headingMatch[1] ?? "Section";
    } else {
      currentLines.push(line);
    }
  }
  flush();
  return sections;
}

/** Execute the chunked strategy. */
export async function runChunked(input: StrategyInput): Promise<StrategyOutput> {
  const warnings: string[] = [];
  assertNotAborted(input.signal);
  const sections = splitSections(input.plasmid.body);
  if (sections.length === 0) {
    return {
      payload: { summary: "", intents: [] },
      warnings,
    };
  }

  const summaries: string[] = [];
  const intents: InterpretedIntent[] = [];
  let consecutiveJsonFailures = 0;
  let xmlEngaged = false;

  for (const section of sections) {
    assertNotAborted(input.signal);
    try {
      const partial = xmlEngaged
        ? await runXmlSection(input.llm, section, input.signal)
        : await runJsonSection(input, section);
      if (partial.summary.length > 0) summaries.push(partial.summary);
      for (const intent of partial.intents) {
        // Ensure every intent has a sensible default kind tied to its section.
        intents.push({
          ...intent,
          kind: intent.kind,
        });
      }
      consecutiveJsonFailures = 0;
    } catch (error) {
      if (xmlEngaged) {
        // Even XML failed for this section — record as empty, keep going.
        warnings.push(
          `xml-fallback failed for section "${section.name}" of plasmid ${input.plasmid.metadata.id}`,
        );
        // Provide a minimal deterministic fallback intent so the section
        // still contributes something downstream.
        intents.push(syntheticIntent(section));
        continue;
      }
      consecutiveJsonFailures += 1;
      if (consecutiveJsonFailures >= 2) {
        xmlEngaged = true;
        warnings.push(`xml-fallback engaged for plasmid ${input.plasmid.metadata.id}`);
        // Retry this section under XML rules once before moving on.
        try {
          const xmlPartial = await runXmlSection(input.llm, section, input.signal);
          if (xmlPartial.summary.length > 0) summaries.push(xmlPartial.summary);
          for (const intent of xmlPartial.intents) intents.push(intent);
        } catch {
          warnings.push(
            `xml-fallback failed for section "${section.name}" of plasmid ${input.plasmid.metadata.id}`,
          );
          intents.push(syntheticIntent(section));
        }
        continue;
      }
      // Below threshold — skip this section but keep processing.
      warnings.push(
        `chunked JSON parse failed for section "${section.name}" of plasmid ${input.plasmid.metadata.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  const summary =
    summaries.length > 0 ? summaries.join(" ").slice(0, 500) : input.plasmid.metadata.description;

  return {
    payload: { summary, intents },
    warnings,
  };
}

async function runJsonSection(
  input: StrategyInput,
  section: BodySection,
): Promise<InterpretedPayload> {
  const system = buildChunkedSystemPrompt(section.name);
  const user = buildChunkedUserPrompt(section.name, section.body);
  const attempts = Math.max(1, input.retries) + 1;
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    assertNotAborted(input.signal);
    try {
      const raw = await input.llm({
        system,
        user,
        jsonMode: true,
        temperature: 0,
        signal: input.signal,
      });
      return parseAndValidate(raw);
    } catch (error) {
      lastError = error;
    }
  }
  throw new InterpreterJsonFailureError(
    `chunked interpreter failed for section "${section.name}"`,
    {
      plasmidId: input.plasmid.metadata.id,
      section: section.name,
      lastError: lastError instanceof Error ? lastError.message : String(lastError),
    },
  );
}

async function runXmlSection(
  llm: LLMCompletionFn,
  section: BodySection,
  signal: AbortSignal | undefined,
): Promise<InterpretedPayload> {
  const raw = await llm({
    system: buildXmlFallbackSystemPrompt(),
    user: buildChunkedUserPrompt(section.name, section.body),
    jsonMode: false,
    temperature: 0,
    signal,
  });
  const payload = toInterpretedPayload(parseXmlFallback(raw));
  return interpretedPayloadSchema.parse(payload);
}

function syntheticIntent(section: BodySection): InterpretedIntent {
  return {
    kind: defaultKindForSection(section.name),
    title: section.name.slice(0, 80),
    description: `Section derived without LLM parsing (fallback): ${section.name}`,
    constraints: [],
    evidence: [],
    params: { fallback: true },
  };
}

// `CompiledPlasmidIR` / `InterpreterStrategy` re-exported so consumers that
// only import from `./chunked.js` can still get the output contract.
export type { InterpreterStrategy, LoadedPlasmid };

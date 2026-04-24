/**
 * Single-pass interpreter strategy (cloud / strategyTier A).
 *
 * One LLM call with `jsonMode: true`. The LLM produces the full `{ summary,
 * intents[] }` envelope. On parse / Zod failure we retry up to `retries`
 * times; after that we delegate to the XML fallback (still one call). If the
 * XML fallback also fails, we throw `InterpreterJsonFailureError`.
 *
 * Layer: Core (Layer 2). Uses LLM + Zod. No disk I/O — cache is layered above
 * in `index.ts`.
 */

import { BaseError } from "../../utils/error.js";
import type {
  CompiledPlasmidIR,
  InterpreterStrategy,
  LLMCompletionFn,
  LoadedPlasmid,
  PlasmidIntentNode,
} from "../types.js";
import {
  buildSinglePassSystemPrompt,
  buildSinglePassUserPrompt,
  buildXmlFallbackSystemPrompt,
} from "./prompts.js";
import {
  interpretedPayloadSchema,
  slugifyTitle,
  toIntentNode,
  type InterpretedPayload,
} from "./schema.js";
import { parseXmlFallback, toInterpretedPayload } from "./xml-fallback.js";

/** Thrown when every JSON + XML attempt fails. */
export class InterpreterJsonFailureError extends BaseError {
  constructor(
    message: string,
    context: Record<string, unknown> = {},
  ) {
    super(message, "INTERPRETER_JSON_FAILURE", context);
  }
}

/** Raised when the outer pipeline signals an abort. */
export class RecombinationAbortedError extends BaseError {
  constructor(context: Record<string, unknown> = {}) {
    super("recombination aborted", "RECOMBINATION_ABORTED", context);
  }
}

/** Inputs consumed by every strategy — bundled to keep signatures short. */
export interface StrategyInput {
  readonly plasmid: LoadedPlasmid;
  readonly retries: number;
  readonly modelId: string;
  readonly llm: LLMCompletionFn;
  readonly signal?: AbortSignal;
}

/** Strategy output — plain `InterpretedPayload` + warnings from fallbacks. */
export interface StrategyOutput {
  readonly payload: InterpretedPayload;
  readonly warnings: readonly string[];
}

/** Execute the single-pass strategy. */
export async function runSinglePass(input: StrategyInput): Promise<StrategyOutput> {
  const warnings: string[] = [];
  assertNotAborted(input.signal);

  const system = buildSinglePassSystemPrompt();
  const user = buildSinglePassUserPrompt(input.plasmid.body);
  const attempts = Math.max(1, input.retries) + 1; // retries is additional attempts
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
      const payload = parseAndValidate(raw);
      return { payload, warnings };
    } catch (error) {
      lastError = error;
    }
  }

  // JSON path exhausted → one XML fallback attempt.
  try {
    assertNotAborted(input.signal);
    const xmlRaw = await input.llm({
      system: buildXmlFallbackSystemPrompt(),
      user: buildSinglePassUserPrompt(input.plasmid.body),
      jsonMode: false,
      temperature: 0,
      signal: input.signal,
    });
    const xmlPayload = toInterpretedPayload(parseXmlFallback(xmlRaw));
    const validated = interpretedPayloadSchema.parse(xmlPayload);
    warnings.push(`xml-fallback engaged for plasmid ${input.plasmid.metadata.id}`);
    return { payload: validated, warnings };
  } catch (error) {
    throw new InterpreterJsonFailureError(
      `interpreter failed after ${attempts} JSON attempts and XML fallback`,
      {
        plasmidId: input.plasmid.metadata.id,
        lastJsonError: lastError instanceof Error ? lastError.message : String(lastError),
        xmlError: error instanceof Error ? error.message : String(error),
      },
    );
  }
}

/**
 * Convert an `InterpretedPayload` into the contract `CompiledPlasmidIR`.
 *
 * Shared by every strategy. Injects `sourcePlasmid` + defaults `id` via
 * {@link slugifyTitle}. Duplicate ids are disambiguated with a numeric suffix
 * so downstream generators can still use the id as a dedup key.
 */
export function assemblePlasmidIR(params: {
  readonly plasmid: LoadedPlasmid;
  readonly payload: InterpretedPayload;
  readonly strategy: InterpreterStrategy;
  readonly cacheKey: string;
}): CompiledPlasmidIR {
  const { plasmid, payload, strategy, cacheKey } = params;
  const seen = new Set<string>();
  const intents: PlasmidIntentNode[] = [];
  for (const intent of payload.intents) {
    const fallbackId = `${plasmid.metadata.id}:${slugifyTitle(intent.title)}`;
    let candidate = intent.id && intent.id.length > 0 ? intent.id : fallbackId;
    if (seen.has(candidate)) {
      let n = 2;
      while (seen.has(`${candidate}-${n}`)) n += 1;
      candidate = `${candidate}-${n}`;
    }
    seen.add(candidate);
    intents.push(
      toIntentNode(
        { ...intent, id: candidate },
        plasmid.metadata.id,
        candidate,
      ),
    );
  }

  return {
    plasmidId: plasmid.metadata.id,
    plasmidVersion: plasmid.metadata.version,
    metadata: plasmid.metadata,
    bodyFingerprint: plasmid.bodyFingerprint,
    summary: payload.summary,
    intents: Object.freeze(intents),
    tier: plasmid.metadata.tier,
    interpretedAt: new Date().toISOString(),
    strategyUsed: strategy,
    cacheKey,
  };
}

/**
 * Parse `raw` (possibly fenced JSON) and run through the Zod schema.
 * Throws on any failure so the retry loop can catch + retry.
 */
export function parseAndValidate(raw: string): InterpretedPayload {
  const unfenced = stripJsonFences(raw).trim();
  if (unfenced.length === 0) {
    throw new Error("LLM returned empty body");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(unfenced);
  } catch (error) {
    throw new Error(
      `JSON parse failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return interpretedPayloadSchema.parse(parsed);
}

/** Remove ```json ...``` fences if the model ignored `jsonMode`. */
export function stripJsonFences(input: string): string {
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```\s*$/i.exec(input.trim());
  return fenced !== null && fenced[1] !== undefined ? fenced[1] : input;
}

/** Throw {@link RecombinationAbortedError} if the signal has tripped. */
export function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted === true) {
    throw new RecombinationAbortedError({
      reason: signal.reason instanceof Error ? signal.reason.message : String(signal.reason ?? ""),
    });
  }
}

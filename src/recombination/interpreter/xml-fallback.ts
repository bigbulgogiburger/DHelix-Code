/**
 * Tolerant XML fallback parser for the interpreter.
 *
 * We ask the LLM to emit a very shallow XML dialect:
 *
 *   <plasmid>
 *     <summary>…</summary>
 *     <intent kind="hook">
 *       <title>…</title>
 *       <description>…</description>
 *       <constraints><item>…</item></constraints>
 *       <evidence><item>…</item></evidence>
 *     </intent>
 *   </plasmid>
 *
 * The parser is hand-rolled (no external deps) — models make mistakes like
 * omitting a closing tag or wrapping the root in ```xml fences, so tolerance
 * is more important than strictness. We only unescape the five canonical
 * entities (`&amp; &lt; &gt; &quot; &apos;`) and accept missing / empty
 * sub-elements by defaulting to sensible values.
 *
 * Layer: Core (Layer 2). Pure parser; no I/O.
 */

import type { IntentKind } from "../types.js";
import { INTENT_KINDS, type InterpretedIntent, type InterpretedPayload } from "./schema.js";

const INTENT_KIND_SET: ReadonlySet<IntentKind> = new Set(INTENT_KINDS);

/** Raw result of `parseXmlFallback` — still needs Zod-like normalisation. */
export interface XmlFallbackResult {
  readonly summary: string;
  readonly intents: readonly InterpretedIntent[];
}

/**
 * Parse an XML blob emitted by the LLM. Throws `XmlFallbackParseError` on
 * structural failure (no <plasmid> root, empty output, etc.).
 */
export function parseXmlFallback(raw: string): XmlFallbackResult {
  const trimmed = stripFences(raw).trim();
  if (trimmed.length === 0) {
    throw new XmlFallbackParseError("empty XML payload");
  }

  const plasmidBody = extractElementBody(trimmed, "plasmid");
  if (plasmidBody === null) {
    throw new XmlFallbackParseError("<plasmid> root element not found");
  }

  const summary = decodeEntities(
    (extractElementBody(plasmidBody, "summary") ?? "").trim(),
  );

  const intents: InterpretedIntent[] = [];
  for (const { attributes, body } of iterateElements(plasmidBody, "intent")) {
    const rawKind = attributes.kind ?? "agent";
    const kind: IntentKind = INTENT_KIND_SET.has(rawKind as IntentKind)
      ? (rawKind as IntentKind)
      : "agent";
    const title = decodeEntities(
      (extractElementBody(body, "title") ?? "").trim(),
    );
    if (title.length === 0) continue; // skip intents without a title
    const description = decodeEntities(
      (extractElementBody(body, "description") ?? "").trim(),
    );
    if (description.length === 0) continue;
    const constraintsBody = extractElementBody(body, "constraints") ?? "";
    const evidenceBody = extractElementBody(body, "evidence") ?? "";
    const constraints = extractItemList(constraintsBody);
    const evidence = extractItemList(evidenceBody);

    intents.push({
      kind,
      title: title.slice(0, 80),
      description,
      constraints: [...constraints],
      evidence: [...evidence],
      params: {},
    });
  }

  if (summary.length === 0 && intents.length === 0) {
    throw new XmlFallbackParseError("no intents and no summary parsed from XML");
  }

  return {
    summary: summary.length > 0 ? summary : "plasmid interpreted via XML fallback",
    intents,
  };
}

/** Raised when the fallback parser cannot make sense of the LLM output. */
export class XmlFallbackParseError extends Error {
  readonly code = "INTERPRETER_XML_PARSE";
  constructor(message: string) {
    super(message);
    this.name = "XmlFallbackParseError";
  }
}

/** Adapt a raw XML result into the InterpretedPayload envelope. */
export function toInterpretedPayload(result: XmlFallbackResult): InterpretedPayload {
  return { summary: result.summary, intents: [...result.intents] };
}

// ---------------------------------------------------------------------------
// Helpers — intentionally private (unit-tested through the public parser).
// ---------------------------------------------------------------------------

/** Strip ```xml ...``` fences if present. */
function stripFences(input: string): string {
  const fenced = /^```(?:xml)?\s*([\s\S]*?)\s*```\s*$/i.exec(input);
  return fenced !== null && fenced[1] !== undefined ? fenced[1] : input;
}

/** Body text between `<tag ...>` and `</tag>` — first occurrence. `null` on miss. */
function extractElementBody(source: string, tag: string): string | null {
  const open = openTagRegex(tag).exec(source);
  if (open === null) return null;
  const afterOpen = open.index + open[0].length;
  const close = closeTagRegex(tag).exec(source.slice(afterOpen));
  if (close === null) {
    // tolerate unterminated: consume to the end of source
    return source.slice(afterOpen);
  }
  return source.slice(afterOpen, afterOpen + close.index);
}

/** Iterate all top-level `<tag ...>...</tag>` occurrences in `source`. */
function* iterateElements(
  source: string,
  tag: string,
): IterableIterator<{ attributes: Record<string, string>; body: string }> {
  const openRe = new RegExp(`<${tag}\\b([^>]*)>`, "gi");
  const closeRe = new RegExp(`</${tag}\\s*>`, "i");
  let match: RegExpExecArray | null;
  while ((match = openRe.exec(source)) !== null) {
    const afterOpen = match.index + match[0].length;
    const remaining = source.slice(afterOpen);
    const closeMatch = closeRe.exec(remaining);
    const body = closeMatch !== null ? remaining.slice(0, closeMatch.index) : remaining;
    const attrString = match[1] ?? "";
    const attributes = parseAttributes(attrString);
    yield { attributes, body };
    if (closeMatch !== null) {
      openRe.lastIndex = afterOpen + closeMatch.index + closeMatch[0].length;
    }
  }
}

/** Very small attribute extractor — `key="value"` / `key='value'` only. */
function parseAttributes(attrString: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([a-zA-Z_][\w-]*)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(attrString)) !== null) {
    const key = m[1];
    const value = m[3] ?? m[4] ?? "";
    if (key !== undefined) {
      out[key] = decodeEntities(value);
    }
  }
  return out;
}

/** Return every `<item>...</item>` text node under `source`. */
function extractItemList(source: string): readonly string[] {
  const out: string[] = [];
  const re = /<item\b[^>]*>([\s\S]*?)<\/item\s*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    const text = decodeEntities((m[1] ?? "").trim());
    if (text.length > 0) out.push(text);
  }
  return out;
}

/** Decode the five canonical XML entities. Unknown entities are kept verbatim. */
function decodeEntities(input: string): string {
  return input
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => {
      const n = Number.parseInt(code, 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : _;
    })
    .replace(/&amp;/g, "&");
}

function openTagRegex(tag: string): RegExp {
  return new RegExp(`<${tag}\\b[^>]*>`, "i");
}

function closeTagRegex(tag: string): RegExp {
  return new RegExp(`</${tag}\\s*>`, "i");
}

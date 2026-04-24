/**
 * Template helpers — pure string/array utilities used by the render engine.
 *
 * The 5 core helpers confirmed in P-1.4 §Q2:
 *   - camelCase     — "enforce-owasp-gate" → "enforceOwaspGate"
 *   - titleCase     — "enforce-owasp-gate" → "Enforce Owasp Gate"
 *   - kebabCase     — "Enforce OWASP Gate" → "enforce-owasp-gate"
 *   - ifIncludes    — boolean helper used by `{{#if (ifIncludes list "x")}}`
 *   - join          — `{{join list ", "}}`
 *
 * All helpers are pure (no state, no I/O) and synchronous.
 */

/** Signature every helper conforms to — variadic args, returns anything. */
export type TemplateHelperFn = (...args: readonly unknown[]) => unknown;

/** Named helper bundle passed into the render engine. */
export type TemplateHelpers = Readonly<Record<string, TemplateHelperFn>>;

/** Split a loosely-structured string into kebab-ready tokens (lowercased). */
function tokenize(input: string): readonly string[] {
  // Insert separators on camelCase boundaries first, then split on anything
  // that is not alphanumeric, then drop empty fragments.
  const separated = input
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
  return separated
    .split(/[^A-Za-z0-9]+/u)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .map((t) => t.toLowerCase());
}

/** `"foo bar" → "fooBar"` / `"foo-bar" → "fooBar"`. */
export function camelCase(input: unknown): string {
  const tokens = tokenize(String(input ?? ""));
  if (tokens.length === 0) return "";
  const [head, ...rest] = tokens;
  const capRest = rest.map(
    (t) => (t[0] ?? "").toUpperCase() + t.slice(1),
  );
  return head + capRest.join("");
}

/** `"foo bar" → "Foo Bar"` / `"enforce-owasp" → "Enforce Owasp"`. */
export function titleCase(input: unknown): string {
  const tokens = tokenize(String(input ?? ""));
  return tokens
    .map((t) => (t[0] ?? "").toUpperCase() + t.slice(1))
    .join(" ");
}

/** `"Foo Bar" → "foo-bar"`. */
export function kebabCase(input: unknown): string {
  return tokenize(String(input ?? "")).join("-");
}

/** Used inside `{{#if (ifIncludes list "value")}}`. */
export function ifIncludes(list: unknown, value: unknown): boolean {
  if (!Array.isArray(list)) return false;
  return list.some((item) => item === value);
}

/** Used as `{{join list ", "}}`. */
export function join(list: unknown, sep: unknown = ", "): string {
  if (!Array.isArray(list)) return "";
  const separator = typeof sep === "string" ? sep : String(sep);
  return list.map((item) => String(item ?? "")).join(separator);
}

/** Pre-built helper bundle consumed by `render.ts`. */
export const DEFAULT_HELPERS: TemplateHelpers = Object.freeze({
  camelCase,
  titleCase,
  kebabCase,
  ifIncludes,
  join,
});

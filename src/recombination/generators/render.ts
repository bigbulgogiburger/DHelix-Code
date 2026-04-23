/**
 * Minimal Handlebars-compatible template renderer — zero external deps.
 *
 * We intentionally build this in-tree (CLAUDE rules forbid adding runtime
 * deps without justification, and the feature surface we need from
 * Handlebars is tiny). The renderer is designed for Markdown output; no
 * HTML escaping is performed.
 *
 * Supported grammar (subset of Handlebars):
 *
 *   {{var}}                   dotted-path lookup (`{{plasmid.name}}`)
 *   {{helper arg1 arg2 ...}}  invoke a helper from `helpers.ts`; args are
 *                             dotted paths or quoted string/number literals.
 *   {{#each list}}...{{/each}}
 *                             iterate `list`; loop-local vars:
 *                               `this`  — current item
 *                               `@index`/`@first`/`@last`
 *   {{#if expr}}...{{else}}...{{/if}}
 *                             boolean branch on truthy `expr`. `expr` may
 *                             be a path or a helper invocation.
 *   {{!-- slot:NAME --}}default{{!-- /slot --}}
 *                             named slot — visible to the slot-filler. At
 *                             render time the default is rendered verbatim.
 *   {{!-- ... --}}            regular comment, stripped from output.
 *
 * Deliberately out of scope (throw on encounter):
 *   - `with` / custom block helpers
 *   - Subexpressions `(helper ...)` — flat calls only
 *   - HTML escaping / triple-stash `{{{ }}}`
 *
 * Errors throw plain `Error` — callers translate to `GENERATOR_ERROR`.
 */

import { DEFAULT_HELPERS, type TemplateHelpers } from "./helpers.js";

/** Lookup context — shallow, merged per loop iteration. */
export type RenderContext = Readonly<Record<string, unknown>>;

/** Named slots visible through the renderer. */
export interface RenderedSlot {
  readonly name: string;
  /** Unique placeholder token embedded in `output`; replace via `applySlotReplacements`. */
  readonly placeholder: string;
  /** The rendered default text (already interpolated), with surrounding markers stripped. */
  readonly defaultContent: string;
}

export interface RenderResult {
  /**
   * Rendered output with slot placeholders embedded (pre-fill state).
   * Call {@link finaliseSlots} to substitute placeholders with either the
   * defaults or LLM-refined replacements.
   */
  readonly output: string;
  readonly slots: readonly RenderedSlot[];
}

export interface RenderOptions {
  readonly helpers?: TemplateHelpers;
  /** Template id used only for error messages — helps locate the offending file. */
  readonly templateId?: string;
}

/** AST node types. */
type Node =
  | { readonly kind: "text"; readonly value: string }
  | { readonly kind: "var"; readonly path: string }
  | {
      readonly kind: "helper";
      readonly name: string;
      readonly args: readonly Expr[];
    }
  | {
      readonly kind: "each";
      readonly listPath: string;
      readonly body: readonly Node[];
    }
  | {
      readonly kind: "if";
      readonly condition: Expr;
      readonly then: readonly Node[];
      readonly else: readonly Node[];
    }
  | {
      readonly kind: "slot";
      readonly name: string;
      readonly body: readonly Node[];
    };

type Expr =
  | { readonly kind: "path"; readonly value: string }
  | { readonly kind: "literal"; readonly value: string | number | boolean | null }
  | {
      readonly kind: "helperCall";
      readonly name: string;
      readonly args: readonly Expr[];
    };

const SLOT_OPEN = /^\{\{!--\s*slot:([A-Za-z0-9_-]+)\s*--\}\}/;
const SLOT_CLOSE = /^\{\{!--\s*\/slot\s*--\}\}/;
const COMMENT = /^\{\{!--[\s\S]*?--\}\}/;

/**
 * Public render entry point.
 *
 * @throws Error when a lookup/helper/tag is malformed. The message contains
 *   the template id (if provided) for operator troubleshooting.
 */
export function renderTemplate(
  template: string,
  context: RenderContext,
  options: RenderOptions = {},
): RenderResult {
  const helpers = options.helpers ?? DEFAULT_HELPERS;
  const templateId = options.templateId ?? "<anonymous>";

  // Strip plain comments first — but keep slot markers so the parser sees them.
  // Slot markers match the comment regex so we tokenise them before stripping.
  const tokens = tokenise(template);
  const ast = parse(tokens, templateId);
  const slots: RenderedSlot[] = [];
  const output = renderNodes(ast, context, helpers, templateId, slots);
  return { output, slots };
}

// ─── Tokenisation ───────────────────────────────────────────────────────────

type Token =
  | { readonly kind: "text"; readonly value: string }
  | { readonly kind: "mustache"; readonly value: string /* inner */ }
  | { readonly kind: "slotOpen"; readonly name: string }
  | { readonly kind: "slotClose" };

function tokenise(template: string): readonly Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < template.length) {
    const open = template.indexOf("{{", i);
    if (open === -1) {
      if (i < template.length) out.push({ kind: "text", value: template.slice(i) });
      break;
    }
    if (open > i) out.push({ kind: "text", value: template.slice(i, open) });

    const suffix = template.slice(open);

    // Slot open marker?
    const slotOpenMatch = SLOT_OPEN.exec(suffix);
    if (slotOpenMatch) {
      out.push({ kind: "slotOpen", name: slotOpenMatch[1] ?? "" });
      i = open + slotOpenMatch[0].length;
      continue;
    }
    // Slot close marker?
    const slotCloseMatch = SLOT_CLOSE.exec(suffix);
    if (slotCloseMatch) {
      out.push({ kind: "slotClose" });
      i = open + slotCloseMatch[0].length;
      continue;
    }
    // Regular comment — skip entirely.
    const commentMatch = COMMENT.exec(suffix);
    if (commentMatch) {
      i = open + commentMatch[0].length;
      continue;
    }
    const close = template.indexOf("}}", open);
    if (close === -1) {
      throw new Error(`unterminated mustache at offset ${String(open)}`);
    }
    const inner = template.slice(open + 2, close).trim();
    out.push({ kind: "mustache", value: inner });
    i = close + 2;
  }
  return out;
}

// ─── Parser ────────────────────────────────────────────────────────────────

interface ParseState {
  readonly tokens: readonly Token[];
  idx: number;
}

function parse(tokens: readonly Token[], templateId: string): readonly Node[] {
  const state: ParseState = { tokens, idx: 0 };
  return parseUntil(state, templateId, () => false);
}

function parseUntil(
  state: ParseState,
  templateId: string,
  stopWhen: (inner: string) => boolean,
): readonly Node[] {
  const nodes: Node[] = [];
  while (state.idx < state.tokens.length) {
    const tok = state.tokens[state.idx];
    if (!tok) break;
    if (tok.kind === "text") {
      nodes.push({ kind: "text", value: tok.value });
      state.idx += 1;
      continue;
    }
    if (tok.kind === "slotOpen") {
      state.idx += 1;
      const body = parseUntilSlotClose(state, templateId);
      nodes.push({ kind: "slot", name: tok.name, body });
      continue;
    }
    if (tok.kind === "slotClose") {
      throw new Error(
        `[${templateId}] unexpected slot close marker — no matching open`,
      );
    }
    // mustache
    const inner = tok.value;
    if (stopWhen(inner)) {
      return nodes;
    }
    if (inner.startsWith("#each ")) {
      state.idx += 1;
      const listPath = inner.slice(6).trim();
      if (!listPath) {
        throw new Error(`[${templateId}] {{#each}} missing list path`);
      }
      const body = parseUntil(state, templateId, (t) => t === "/each");
      consumeClosing(state, "/each", templateId);
      nodes.push({ kind: "each", listPath, body });
      continue;
    }
    if (inner.startsWith("#if ")) {
      state.idx += 1;
      const exprStr = inner.slice(4).trim();
      if (!exprStr) {
        throw new Error(`[${templateId}] {{#if}} missing expression`);
      }
      const condition = parseExpr(exprStr, templateId);
      const thenBody = parseUntil(
        state,
        templateId,
        (t) => t === "/if" || t === "else",
      );
      const next = state.tokens[state.idx];
      let elseBody: readonly Node[] = [];
      if (next && next.kind === "mustache" && next.value === "else") {
        state.idx += 1;
        elseBody = parseUntil(state, templateId, (t) => t === "/if");
      }
      consumeClosing(state, "/if", templateId);
      nodes.push({ kind: "if", condition, then: thenBody, else: elseBody });
      continue;
    }
    if (inner.startsWith("/")) {
      throw new Error(`[${templateId}] stray closing tag {{${inner}}}`);
    }
    // Either plain var or a helper call.
    state.idx += 1;
    const expr = parseExpr(inner, templateId);
    if (expr.kind === "path") {
      nodes.push({ kind: "var", path: expr.value });
    } else if (expr.kind === "literal") {
      // Literal at top-level → coerce to text, useful for tests.
      nodes.push({ kind: "text", value: String(expr.value) });
    } else {
      nodes.push({ kind: "helper", name: expr.name, args: expr.args });
    }
  }
  return nodes;
}

function parseUntilSlotClose(
  state: ParseState,
  templateId: string,
): readonly Node[] {
  const nodes: Node[] = [];
  while (state.idx < state.tokens.length) {
    const tok = state.tokens[state.idx];
    if (!tok) break;
    if (tok.kind === "slotClose") {
      state.idx += 1;
      return nodes;
    }
    if (tok.kind === "slotOpen") {
      throw new Error(`[${templateId}] nested slot markers are not allowed`);
    }
    if (tok.kind === "text") {
      nodes.push({ kind: "text", value: tok.value });
      state.idx += 1;
      continue;
    }
    // mustache inside slot — parse as normal expression only, no block helpers.
    const inner = tok.value;
    state.idx += 1;
    const expr = parseExpr(inner, templateId);
    if (expr.kind === "path") {
      nodes.push({ kind: "var", path: expr.value });
    } else if (expr.kind === "literal") {
      nodes.push({ kind: "text", value: String(expr.value) });
    } else {
      nodes.push({ kind: "helper", name: expr.name, args: expr.args });
    }
  }
  throw new Error(`[${templateId}] unterminated slot block`);
}

function consumeClosing(
  state: ParseState,
  expected: string,
  templateId: string,
): void {
  const tok = state.tokens[state.idx];
  if (!tok || tok.kind !== "mustache" || tok.value !== expected) {
    throw new Error(`[${templateId}] expected {{${expected}}}`);
  }
  state.idx += 1;
}

// ─── Expression parser (flat; no subexpressions) ───────────────────────────

function parseExpr(src: string, templateId: string): Expr {
  const parts = tokeniseExpr(src, templateId);
  if (parts.length === 0) {
    throw new Error(`[${templateId}] empty expression`);
  }
  const head = parts[0];
  if (!head) {
    throw new Error(`[${templateId}] empty expression`);
  }
  if (parts.length === 1) {
    if (head.kind === "literal") return head;
    // Single bare identifier → path lookup.
    return { kind: "path", value: head.value };
  }
  // Multi-token expression: head is helper name, tail are args.
  if (head.kind !== "ident") {
    throw new Error(
      `[${templateId}] expected helper name at start of expression "${src}"`,
    );
  }
  const args: Expr[] = parts.slice(1).map((p) => {
    if (p.kind === "ident") return { kind: "path", value: p.value };
    return { kind: "literal", value: p.value };
  });
  return { kind: "helperCall", name: head.value, args };
}

type ExprToken =
  | { readonly kind: "ident"; readonly value: string }
  | { readonly kind: "literal"; readonly value: string | number | boolean | null };

function tokeniseExpr(src: string, templateId: string): readonly ExprToken[] {
  const out: ExprToken[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i]!;
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let j = i + 1;
      let value = "";
      while (j < src.length && src[j] !== quote) {
        if (src[j] === "\\" && j + 1 < src.length) {
          value += src[j + 1];
          j += 2;
          continue;
        }
        value += src[j];
        j += 1;
      }
      if (src[j] !== quote) {
        throw new Error(`[${templateId}] unterminated string literal in "${src}"`);
      }
      out.push({ kind: "literal", value });
      i = j + 1;
      continue;
    }
    // Number / keyword / path.
    let j = i;
    while (j < src.length && !/\s/.test(src[j]!)) j += 1;
    const raw = src.slice(i, j);
    if (raw === "true" || raw === "false") {
      out.push({ kind: "literal", value: raw === "true" });
    } else if (raw === "null") {
      out.push({ kind: "literal", value: null });
    } else if (/^-?\d+(\.\d+)?$/.test(raw)) {
      out.push({ kind: "literal", value: Number(raw) });
    } else if (/^[@A-Za-z_][@A-Za-z0-9_.-]*$/.test(raw)) {
      out.push({ kind: "ident", value: raw });
    } else {
      throw new Error(`[${templateId}] invalid token "${raw}" in "${src}"`);
    }
    i = j;
  }
  return out;
}

// ─── Evaluator ─────────────────────────────────────────────────────────────

function renderNodes(
  nodes: readonly Node[],
  ctx: RenderContext,
  helpers: TemplateHelpers,
  templateId: string,
  slots: RenderedSlot[],
): string {
  let out = "";
  for (const node of nodes) {
    out += renderNode(node, ctx, helpers, templateId, slots);
  }
  return out;
}

function renderNode(
  node: Node,
  ctx: RenderContext,
  helpers: TemplateHelpers,
  templateId: string,
  slots: RenderedSlot[],
): string {
  switch (node.kind) {
    case "text":
      return node.value;
    case "var":
      return stringify(resolvePath(ctx, node.path, templateId));
    case "helper":
      return stringify(
        invokeHelper(node.name, node.args, ctx, helpers, templateId),
      );
    case "each":
      return renderEach(node, ctx, helpers, templateId, slots);
    case "if":
      return renderIf(node, ctx, helpers, templateId, slots);
    case "slot": {
      const defaultContent = renderNodes(
        node.body,
        ctx,
        helpers,
        templateId,
        slots,
      );
      const placeholder = makeSlotPlaceholder(node.name, slots.length);
      slots.push({
        name: node.name,
        placeholder,
        defaultContent,
      });
      return placeholder;
    }
  }
}

function renderEach(
  node: Extract<Node, { kind: "each" }>,
  ctx: RenderContext,
  helpers: TemplateHelpers,
  templateId: string,
  slots: RenderedSlot[],
): string {
  const list = resolvePath(ctx, node.listPath, templateId);
  if (list === undefined || list === null) return "";
  if (!Array.isArray(list)) {
    throw new Error(
      `[${templateId}] {{#each ${node.listPath}}} — expected array, got ${typeof list}`,
    );
  }
  let out = "";
  for (let i = 0; i < list.length; i += 1) {
    const scope: RenderContext = Object.freeze({
      ...ctx,
      this: list[i],
      "@index": i,
      "@first": i === 0,
      "@last": i === list.length - 1,
    });
    out += renderNodes(node.body, scope, helpers, templateId, slots);
  }
  return out;
}

function renderIf(
  node: Extract<Node, { kind: "if" }>,
  ctx: RenderContext,
  helpers: TemplateHelpers,
  templateId: string,
  slots: RenderedSlot[],
): string {
  const val = evaluateExpr(node.condition, ctx, helpers, templateId);
  if (isTruthy(val)) {
    return renderNodes(node.then, ctx, helpers, templateId, slots);
  }
  return renderNodes(node.else, ctx, helpers, templateId, slots);
}

function invokeHelper(
  name: string,
  args: readonly Expr[],
  ctx: RenderContext,
  helpers: TemplateHelpers,
  templateId: string,
): unknown {
  const fn = helpers[name];
  if (typeof fn !== "function") {
    throw new Error(`[${templateId}] unknown helper "${name}"`);
  }
  const evaluated = args.map((a) => evaluateExpr(a, ctx, helpers, templateId));
  return fn(...evaluated);
}

function evaluateExpr(
  expr: Expr,
  ctx: RenderContext,
  helpers: TemplateHelpers,
  templateId: string,
): unknown {
  switch (expr.kind) {
    case "literal":
      return expr.value;
    case "path":
      return resolvePath(ctx, expr.value, templateId);
    case "helperCall":
      return invokeHelper(expr.name, expr.args, ctx, helpers, templateId);
  }
}

function resolvePath(
  ctx: RenderContext,
  path: string,
  templateId: string,
): unknown {
  if (path === "this") return ctx["this"];
  if (path === "@index") return ctx["@index"];
  if (path === "@first") return ctx["@first"];
  if (path === "@last") return ctx["@last"];
  const segments = path.split(".");
  let cursor: unknown = ctx;
  for (let i = 0; i < segments.length; i += 1) {
    const seg = segments[i]!;
    if (cursor === null || cursor === undefined) {
      throw new Error(
        `[${templateId}] cannot read "${seg}" of ${String(cursor)} in path "${path}"`,
      );
    }
    if (typeof cursor !== "object") {
      throw new Error(
        `[${templateId}] cannot descend into non-object while resolving "${path}"`,
      );
    }
    const rec = cursor as Record<string, unknown>;
    if (!(seg in rec)) {
      throw new Error(
        `[${templateId}] missing variable "${path}" (at segment "${seg}")`,
      );
    }
    cursor = rec[seg];
  }
  return cursor;
}

function isTruthy(v: unknown): boolean {
  if (v === null || v === undefined || v === false || v === 0 || v === "") {
    return false;
  }
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

/** Produces a placeholder token unlikely to collide with template prose. */
function makeSlotPlaceholder(name: string, nonce: number): string {
  return ` __SLOT::${name}::${String(nonce)}__ `;
}

/**
 * Replace slot placeholders in `rendered` with the supplied replacement map.
 * Slots missing from `replacements` fall back to the rendered default.
 */
export function finaliseSlots(
  rendered: RenderResult,
  replacements: Readonly<Record<string, string>> = {},
): string {
  let out = rendered.output;
  for (const slot of rendered.slots) {
    const value =
      Object.prototype.hasOwnProperty.call(replacements, slot.name) &&
      typeof replacements[slot.name] === "string"
        ? (replacements[slot.name] as string)
        : slot.defaultContent;
    // Split/join is the simplest way to do a literal global replace.
    out = out.split(slot.placeholder).join(value);
  }
  return out;
}

function stringify(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map(stringify).join("");
  // Objects are not auto-stringified — force callers to use helpers.
  return String(v);
}

/**
 * Template generators — pure string interpolation + tier-specific defaults.
 *
 * Layer: Leaf — depends only on `./types.ts`.
 *
 * This module MUST stay side-effect free: no fs, no LLM, no clock.
 * Non-determinism hurts tests and blocks future template sharing with
 * compile-stage artifact generators. The `now()` call belongs in the
 * caller (`quick-mode.ts`), which threads the result through
 * `TemplateContext.created` / `updated`.
 */

import type { PlasmidId, PlasmidPrivacy, PlasmidScope, PlasmidTier } from "./types.js";

/** Variables available to `renderTemplate`. */
export interface TemplateContext {
  readonly id: PlasmidId;
  readonly name: string;
  readonly description: string;
  readonly tier: PlasmidTier;
  readonly scope: PlasmidScope;
  readonly privacy: PlasmidPrivacy;
  readonly created: string;
  readonly updated: string;
  readonly version: string;
  readonly locale: "ko" | "en";
}

/**
 * Strict `${var}` interpolation. Unknown variables throw rather than
 * silently emit `undefined` — templates are developer-authored, not
 * user-authored, so a typo is a bug we want to catch at dev time.
 *
 * Escaping: `\\${x}` emits a literal `${x}`.
 */
export function renderTemplate(template: string, ctx: TemplateContext): string {
  const vars = contextToRecord(ctx);
  // eslint-disable-next-line no-useless-escape
  return template.replace(/\\\$\{[a-zA-Z_][a-zA-Z0-9_]*\}|\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, (match, name?: string) => {
    if (match.startsWith("\\")) {
      // escaped form → strip the backslash, keep literal placeholder
      return match.slice(1);
    }
    if (!name) return match;
    if (!(name in vars)) {
      throw new Error(`renderTemplate: unknown variable '${name}'`);
    }
    return vars[name];
  });
}

function contextToRecord(ctx: TemplateContext): Readonly<Record<string, string>> {
  return {
    id: ctx.id,
    name: ctx.name,
    description: ctx.description,
    tier: ctx.tier,
    scope: ctx.scope,
    privacy: ctx.privacy,
    created: ctx.created,
    updated: ctx.updated,
    version: ctx.version,
    locale: ctx.locale,
  };
}

/**
 * Hardcoded minimal fallback template. Used when Team 5's template
 * registry is absent or when `deps.getTemplate` returns `null`.
 *
 * The structure mirrors P-1.5 §2.2: frontmatter + Intent/Behavior/
 * Constraints sections. All placeholders must be interpolated via
 * `renderTemplate`.
 */
export const FALLBACK_TEMPLATE = `---
id: \${id}
name: \${name}
description: "\${description}"
version: \${version}
tier: \${tier}
scope: \${scope}
privacy: \${privacy}
created: \${created}
updated: \${updated}
---

## Intent

\${description}

## Behavior

(편집해주세요 / please edit)

## Constraints

- TODO: add 2-3 concrete constraints
`;

/**
 * Tier-specific defaults used when no template id is requested.
 *
 * Phase 1: all tiers share the minimal fallback. Phase 2+ will plug in
 * richer tier-aware templates (foundational gets `challengeable-by`,
 * policy gets `eval-cases:` stub, etc.). Kept as a table so downstream
 * teams can extend without touching the Quick mode orchestrator.
 */
export const TIER_DEFAULTS: Readonly<Record<PlasmidTier, string>> = {
  L1: FALLBACK_TEMPLATE,
  L2: FALLBACK_TEMPLATE,
  L3: FALLBACK_TEMPLATE,
  // L4 is rejected in quick-mode before template lookup, but declared
  // here for completeness / future foundational template.
  L4: FALLBACK_TEMPLATE,
};

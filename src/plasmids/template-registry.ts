/**
 * Template registry — catalog + loader for the 3-layer plasmid template
 * hierarchy defined in P-1.4 (v0.2).
 *
 * Layers (see P-1.4 §1):
 *   - primitives  (L1) — atomic, single-rule templates
 *   - patterns    (L2) — composite multi-step behaviours
 *   - industry    (L3/L4) — domain-specific; L4 entries carry `foundational: true`
 *
 * The registry is intentionally thin: it surfaces a static manifest of known
 * template ids and lazily loads the raw markdown body for the caller. Template
 * files ship as assets next to this module (see `./templates/**`). In
 * production builds, tsup must copy those assets into `dist/`; tests point the
 * registry at the repository's source tree directly.
 *
 * Dependency rule: leaf-only. This file imports `fs/promises`, `path`, and
 * `./types.js`. No upstream imports from `cli/` / `core/` / `tools/`.
 */

import { readFile } from "node:fs/promises";
import * as path from "node:path";

import type { PlasmidPrivacy, PlasmidScope, PlasmidTier } from "./types.js";

/** Three-layer template hierarchy (P-1.4 §1). */
export type TemplateLayer = "primitives" | "patterns" | "industry";

/**
 * Result of validating a candidate template id against the naming rules
 * in P-1.4 §5 / §9.Q1.
 */
export interface TemplateIdValidation {
  readonly valid: boolean;
  readonly reason?: string;
}

/** Manifest entry describing a single shipped template. */
export interface TemplateManifestEntry {
  /** kebab-case, unique across layers. */
  readonly id: string;
  readonly layer: TemplateLayer;
  readonly tier: PlasmidTier;
  readonly defaultScope: PlasmidScope;
  readonly defaultPrivacy: PlasmidPrivacy;
  readonly foundational: boolean;
  readonly description: string;
  /** Relative to `templatesRoot`, using POSIX separators. */
  readonly relativePath: string;
}

/** Public registry surface returned by {@link createTemplateRegistry}. */
export interface TemplateRegistry {
  readonly list: () => readonly TemplateManifestEntry[];
  readonly get: (id: string) => TemplateManifestEntry | null;
  readonly loadBody: (
    id: string,
    signal?: AbortSignal,
  ) => Promise<string | null>;
  readonly forTier: (tier: PlasmidTier) => readonly TemplateManifestEntry[];
}

/**
 * Reserved kebab-case id prefixes that cannot be claimed by user templates.
 * Additions here are additive and should bump the package minor version.
 */
const RESERVED_PREFIXES: readonly string[] = [
  "dhelix-",
  "plasmid-",
  "system-",
  "internal-",
];

const KEBAB_CASE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const MIN_LEN = 3;
const MAX_LEN = 64;

/**
 * Validate a candidate template id per P-1.4 §5:
 * - kebab-case (`[a-z][a-z0-9-]*`)
 * - length in [3, 64]
 * - no consecutive hyphens
 * - no reserved prefix
 */
export function validateTemplateId(id: string): TemplateIdValidation {
  if (typeof id !== "string" || id.length === 0) {
    return { valid: false, reason: "id must be a non-empty string" };
  }
  if (id.length < MIN_LEN) {
    return { valid: false, reason: `id must be at least ${MIN_LEN} characters` };
  }
  if (id.length > MAX_LEN) {
    return { valid: false, reason: `id must be at most ${MAX_LEN} characters` };
  }
  if (id.includes("--")) {
    return { valid: false, reason: "id must not contain consecutive hyphens" };
  }
  if (!KEBAB_CASE.test(id)) {
    return { valid: false, reason: "id must be kebab-case (^[a-z][a-z0-9-]*$)" };
  }
  const hit = RESERVED_PREFIXES.find((p) => id.startsWith(p));
  if (hit !== undefined) {
    return { valid: false, reason: `id uses reserved prefix "${hit}"` };
  }
  return { valid: true };
}

/**
 * Static manifest of templates shipped with the runtime. Ordering within a
 * layer is stable and callers may rely on it for deterministic rendering.
 */
export const TEMPLATE_MANIFEST: readonly TemplateManifestEntry[] = [
  // ── L1 primitives ──────────────────────────────────────────────────
  {
    id: "empty",
    layer: "primitives",
    tier: "L1",
    defaultScope: "local",
    defaultPrivacy: "local-only",
    foundational: false,
    description:
      "Blank primitive scaffold with a single placeholder rule block.",
    relativePath: "primitives/empty.md",
  },
  {
    id: "pr-title-format",
    layer: "primitives",
    tier: "L1",
    defaultScope: "local",
    defaultPrivacy: "local-only",
    foundational: false,
    description:
      "Conventional-commit-style PR title enforcement (type(scope): subject).",
    relativePath: "primitives/pr-title-format.md",
  },
  {
    id: "test-required",
    layer: "primitives",
    tier: "L1",
    defaultScope: "local",
    defaultPrivacy: "local-only",
    foundational: false,
    description:
      "Require a co-located test for every new exported symbol in src/.",
    relativePath: "primitives/test-required.md",
  },
  {
    id: "type-annotations",
    layer: "primitives",
    tier: "L1",
    defaultScope: "local",
    defaultPrivacy: "local-only",
    foundational: false,
    description:
      "Explicit TypeScript types on exported functions and public members.",
    relativePath: "primitives/type-annotations.md",
  },

  // ── L2 patterns ────────────────────────────────────────────────────
  {
    id: "commit-message-style",
    layer: "patterns",
    tier: "L2",
    defaultScope: "shared",
    defaultPrivacy: "local-only",
    foundational: false,
    description:
      "Multi-step commit message review (subject, body, footer rules).",
    relativePath: "patterns/commit-message-style.md",
  },
  {
    id: "korean-code-review",
    layer: "patterns",
    tier: "L2",
    defaultScope: "shared",
    defaultPrivacy: "local-only",
    foundational: false,
    description:
      "Korean-language code-review tone and structure (존댓말, 3-block comments).",
    relativePath: "patterns/korean-code-review.md",
  },
  {
    id: "error-handling",
    layer: "patterns",
    tier: "L2",
    defaultScope: "shared",
    defaultPrivacy: "local-only",
    foundational: false,
    description:
      "Async error-handling policy — Result types, AbortSignal, retry budget.",
    relativePath: "patterns/error-handling.md",
  },

  // ── L3/L4 industry ─────────────────────────────────────────────────
  {
    id: "foundational-legal",
    layer: "industry",
    tier: "L4",
    defaultScope: "shared",
    defaultPrivacy: "no-network",
    foundational: true,
    description:
      "Foundational licensing / IP / export-control rules (L4, cannot be silently weakened).",
    relativePath: "industry/foundational-legal.md",
  },
  {
    id: "foundational-security",
    layer: "industry",
    tier: "L4",
    defaultScope: "shared",
    defaultPrivacy: "no-network",
    foundational: true,
    description:
      "Foundational security rules — secrets, injection, deserialization, privacy boundary.",
    relativePath: "industry/foundational-security.md",
  },
  {
    id: "team-governance",
    layer: "industry",
    tier: "L3",
    defaultScope: "shared",
    defaultPrivacy: "local-only",
    foundational: false,
    description:
      "Team-level governance — branch naming, code review SLAs, CODEOWNERS, CHANGELOG.",
    relativePath: "industry/team-governance.md",
  },
];

/** Fast-lookup index built once at registry construction. */
function buildIndex(
  entries: readonly TemplateManifestEntry[],
): ReadonlyMap<string, TemplateManifestEntry> {
  const map = new Map<string, TemplateManifestEntry>();
  for (const entry of entries) {
    if (map.has(entry.id)) {
      throw new Error(
        `template manifest duplicate id: "${entry.id}" — check TEMPLATE_MANIFEST`,
      );
    }
    map.set(entry.id, entry);
  }
  return map;
}

export interface CreateTemplateRegistryOptions {
  /**
   * Absolute filesystem path containing `primitives/`, `patterns/`, `industry/`
   * sub-directories. Usually `<dist>/plasmids/templates` in production; point
   * it at `<repo>/src/plasmids/templates` in tests.
   */
  readonly templatesRoot: string;
}

/**
 * Construct a registry over the static {@link TEMPLATE_MANIFEST}. The returned
 * object is cheap — it holds only the manifest index and the configured root.
 */
export function createTemplateRegistry(
  opts: CreateTemplateRegistryOptions,
): TemplateRegistry {
  if (!opts.templatesRoot || !path.isAbsolute(opts.templatesRoot)) {
    throw new Error(
      `createTemplateRegistry: templatesRoot must be an absolute path (got ${String(
        opts.templatesRoot,
      )})`,
    );
  }
  const root = opts.templatesRoot;
  const index = buildIndex(TEMPLATE_MANIFEST);

  const list = (): readonly TemplateManifestEntry[] => TEMPLATE_MANIFEST;

  const get = (id: string): TemplateManifestEntry | null =>
    index.get(id) ?? null;

  const forTier = (tier: PlasmidTier): readonly TemplateManifestEntry[] =>
    TEMPLATE_MANIFEST.filter((e) => e.tier === tier);

  const loadBody = async (
    id: string,
    signal?: AbortSignal,
  ): Promise<string | null> => {
    const entry = index.get(id);
    if (!entry) return null;
    const abs = path.join(root, ...entry.relativePath.split("/"));
    try {
      const buf = await readFile(abs, { encoding: "utf-8", signal });
      return buf;
    } catch (err) {
      // ENOENT is the common case for asset-not-copied; surface null so the
      // caller can fall back to a user-provided template.
      if (isNodeNotFound(err)) return null;
      throw err;
    }
  };

  return { list, get, loadBody, forTier };
}

function isNodeNotFound(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "ENOENT"
  );
}

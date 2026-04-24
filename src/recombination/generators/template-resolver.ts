/**
 * Template resolver — 3-layer lookup (project > patterns > primitives).
 *
 * The resolver accepts a bare template *basename* (e.g. `rule.basic.hbs`)
 * and searches each layer in order of precedence. Layer roots:
 *   - project    : `<workingDirectory>/.dhelix/templates/project/`
 *   - patterns   : `<workingDirectory>/.dhelix/templates/patterns/`
 *   - primitives : this package's bundled `templates/primitives/`
 *
 * Missing directories (no `.dhelix/templates/...` checked in by the user)
 * are not an error; we fall through to the next layer.
 *
 * Every resolve call returns a SHA-256 hash of the raw template so the
 * transcript / lock file can detect drift (P-1.4 §Q4).
 */

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import type { TemplateLayer } from "../types.js";

/** Full id (e.g. `primitives/rule.basic.hbs`) as surfaced on artifacts. */
export type TemplateFullId = string;

export interface ResolvedTemplate {
  readonly templateId: TemplateFullId;
  readonly basename: string;
  readonly layer: TemplateLayer;
  readonly absolutePath: string;
  readonly content: string;
  /** SHA-256 hex digest of the raw template source. */
  readonly hash: string;
}

export interface TemplateResolverOptions {
  readonly workingDirectory: string;
  /**
   * Override primitives root — test harness points this at
   * `src/recombination/generators/templates/primitives`. Omit in production.
   */
  readonly primitivesRoot?: string;
  readonly fs?: {
    readonly readFile: typeof readFile;
  };
}

export interface TemplateResolver {
  readonly resolve: (
    basename: string,
    signal?: AbortSignal,
  ) => Promise<ResolvedTemplate>;
  readonly tryResolve: (
    basename: string,
    signal?: AbortSignal,
  ) => Promise<ResolvedTemplate | null>;
  readonly layerRoots: Readonly<Record<TemplateLayer, string>>;
}

const LAYER_ORDER: readonly TemplateLayer[] = ["project", "patterns", "primitives"];

/** Default primitives root — resolved relative to this module's URL. */
export const DEFAULT_PRIMITIVES_ROOT = resolveDefaultPrimitivesRoot();

function resolveDefaultPrimitivesRoot(): string {
  // `import.meta.url` inside the worktree points at
  // `…/src/recombination/generators/template-resolver.ts`. At dist build
  // time tsup copies the template assets next to the compiled JS, so this
  // path works in both repo-run vitest and production bundles.
  const here = fileURLToPath(new URL(".", import.meta.url));
  return path.join(here, "templates", "primitives");
}

export function createTemplateResolver(
  opts: TemplateResolverOptions,
): TemplateResolver {
  if (!opts.workingDirectory || !path.isAbsolute(opts.workingDirectory)) {
    throw new Error(
      `createTemplateResolver: workingDirectory must be an absolute path`,
    );
  }
  const reader = opts.fs?.readFile ?? readFile;
  const layerRoots: Readonly<Record<TemplateLayer, string>> = Object.freeze({
    project: path.join(opts.workingDirectory, ".dhelix", "templates", "project"),
    patterns: path.join(opts.workingDirectory, ".dhelix", "templates", "patterns"),
    primitives: opts.primitivesRoot ?? DEFAULT_PRIMITIVES_ROOT,
  });

  const tryResolve = async (
    basename: string,
    signal?: AbortSignal,
  ): Promise<ResolvedTemplate | null> => {
    if (!basename || basename.includes("..") || basename.includes("/")) {
      throw new Error(
        `invalid template basename "${basename}" — expected a single filename`,
      );
    }
    for (const layer of LAYER_ORDER) {
      const abs = path.join(layerRoots[layer], basename);
      const content = await safeRead(reader, abs, signal);
      if (content === null) continue;
      const hash = createHash("sha256").update(content, "utf8").digest("hex");
      return {
        templateId: `${layer}/${basename}`,
        basename,
        layer,
        absolutePath: abs,
        content,
        hash,
      };
    }
    return null;
  };

  const resolve = async (
    basename: string,
    signal?: AbortSignal,
  ): Promise<ResolvedTemplate> => {
    const hit = await tryResolve(basename, signal);
    if (!hit) {
      throw new Error(
        `template not found in any layer (project/patterns/primitives): "${basename}"`,
      );
    }
    return hit;
  };

  return { resolve, tryResolve, layerRoots };
}

async function safeRead(
  reader: typeof readFile,
  abs: string,
  signal: AbortSignal | undefined,
): Promise<string | null> {
  try {
    return await reader(abs, { encoding: "utf-8", signal });
  } catch (err) {
    if (isNotFoundLike(err)) return null;
    throw err;
  }
}

function isNotFoundLike(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const code = (err as { code?: unknown }).code;
  return code === "ENOENT" || code === "ENOTDIR";
}

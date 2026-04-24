/**
 * Layer D — project profile compression (P-1.13 §5).
 *
 * Produces a ~500-token markdown block summarising the project (package.json
 * fields + DHELIX.md overview). The contract has three strategies from
 * `PipelineStrategies.projectProfile`:
 *
 *   - `full-llm`        — one LLM call; full package + DHELIX snippet.
 *   - `llm-summary`     — one LLM call with a shorter prompt.
 *   - `static-template` — deterministic; no LLM; package.json fields only.
 *
 * We always emit a valid markdown document, even if package.json or
 * DHELIX.md are missing (their absence is encoded in the document text).
 *
 * The returned markdown includes the `## Project Profile` heading + a
 * `<!-- GENERATED -->` breadcrumb so the file is recognisably machine-
 * authored.
 */

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type {
  LLMCompletionFn,
  ProjectProfileMode,
} from "../types.js";

import {
  cacheKey,
  readCache,
  writeCache,
} from "./cache.js";
import {
  projectProfileHeading,
} from "./section-assembler.js";
import { estimateTokens } from "./token-estimator.js";

/** Stamp bumped when the prompt / static template changes. */
export const PROJECT_PROFILER_VERSION = "1.0.0";

/** Target token size — P-1.13 §5.2 says 300-500. We aim at the midpoint. */
const PROFILE_TARGET_TOKENS = 400;

export interface ProjectProfileInput {
  readonly workingDirectory: string;
  readonly mode: ProjectProfileMode;
  readonly modelId: string;
  readonly llm: LLMCompletionFn;
  readonly signal?: AbortSignal;
}

export interface ProjectProfileResult {
  readonly markdown: string;
  readonly tokenEstimate: number;
  readonly cacheHit: boolean;
}

export async function buildProjectProfile(
  input: ProjectProfileInput,
): Promise<ProjectProfileResult> {
  throwIfAborted(input.signal);

  const packageJson = await safeReadFile(
    join(input.workingDirectory, "package.json"),
  );
  const dhelixMd = await safeReadFile(
    join(input.workingDirectory, "DHELIX.md"),
  );

  const pkgHash = packageJson ? hashOf(packageJson) : "no-pkg";
  const dhelixHash = dhelixMd ? hashOf(dhelixMd) : "no-dhelix";

  const key = cacheKey([
    dhelixHash,
    pkgHash,
    input.modelId,
    PROJECT_PROFILER_VERSION,
    "D",
    input.mode,
  ]);

  const cached = await readCache<ProjectProfileResult>(
    input.workingDirectory,
    key,
  );
  if (cached) {
    return { ...cached, cacheHit: true };
  }

  let markdown: string;
  if (input.mode === "static-template") {
    markdown = buildStaticTemplate(packageJson, dhelixMd);
  } else {
    try {
      markdown = await buildWithLLM(input, packageJson, dhelixMd);
    } catch {
      // LLM path failure falls back to static template so the stage can
      // still produce a deterministic output.
      markdown = buildStaticTemplate(packageJson, dhelixMd);
    }
  }

  const result: ProjectProfileResult = {
    markdown,
    tokenEstimate: estimateTokens(markdown),
    cacheHit: false,
  };

  await writeCache(input.workingDirectory, key, result);
  return result;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

async function safeReadFile(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, { encoding: "utf8" });
  } catch {
    return undefined;
  }
}

function hashOf(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

interface PkgFields {
  readonly name?: string;
  readonly version?: string;
  readonly description?: string;
  readonly scripts?: Readonly<Record<string, string>>;
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
  readonly type?: string;
  readonly engines?: Readonly<Record<string, string>>;
}

function parsePackageJson(content: string | undefined): PkgFields | undefined {
  if (!content) return undefined;
  try {
    const parsed = JSON.parse(content) as unknown;
    if (parsed && typeof parsed === "object") {
      return parsed as PkgFields;
    }
  } catch {
    // swallow — treated as no package info
  }
  return undefined;
}

function detectStackHints(pkg: PkgFields | undefined): readonly string[] {
  if (!pkg) return [];
  const hints: string[] = [];
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  if (deps["typescript"] || pkg.type === "module") hints.push("TypeScript");
  if (deps["react"] || deps["ink"]) hints.push("React / Ink");
  if (deps["next"]) hints.push("Next.js");
  if (deps["vitest"]) hints.push("Vitest");
  if (deps["jest"]) hints.push("Jest");
  if (deps["express"] || deps["fastify"] || deps["koa"]) hints.push("Node HTTP");
  if (deps["zod"]) hints.push("Zod");
  return hints;
}

function buildStaticTemplate(
  packageJson: string | undefined,
  dhelixMd: string | undefined,
): string {
  const heading = projectProfileHeading();
  const pkg = parsePackageJson(packageJson);
  const name = pkg?.name ?? "(project name unknown)";
  const version = pkg?.version ?? "(version unknown)";
  const description = (pkg?.description ?? "").trim();
  const stack = detectStackHints(pkg);
  const constitution = dhelixMd
    ? firstSentence(stripMdHeadings(dhelixMd))
    : "(no DHELIX.md present)";

  const lines = [
    "<!-- GENERATED — static project profile (no LLM) -->",
    "",
    heading,
    "",
    `${name} v${version}${description ? ` — ${description}` : ""}.`,
  ];
  if (stack.length > 0) {
    lines.push(`Stack hints: ${stack.join(", ")}.`);
  }
  lines.push(`Constitution summary: ${constitution}`);
  return `${lines.join("\n").trim()}\n`;
}

function stripMdHeadings(md: string): string {
  return md.replace(/^#+\s.*$/gmu, "").trim();
}

function firstSentence(text: string): string {
  const collapsed = text.replace(/\s+/gu, " ").trim();
  if (collapsed.length === 0) return "(empty)";
  const match = /^(.{1,240}?[.!?])(\s|$)/u.exec(collapsed);
  const snippet = match ? match[1] : collapsed.slice(0, 240);
  return snippet.trim();
}

async function buildWithLLM(
  input: ProjectProfileInput,
  packageJson: string | undefined,
  dhelixMd: string | undefined,
): Promise<string> {
  throwIfAborted(input.signal);

  const heading = projectProfileHeading();
  const system = [
    "You produce a concise project profile for an AI coding agent's system prompt.",
    `Output at most ${PROFILE_TARGET_TOKENS} tokens (≈${PROFILE_TARGET_TOKENS * 4} characters).`,
    "Describe what the project IS, its tech stack, and key rules. Omit marketing language.",
    "Return plain markdown, no fences, no JSON.",
  ].join("\n");

  const pkgDigest = packageJson
    ? summarisePackage(packageJson)
    : "(package.json missing)";

  const dhelixDigest = dhelixMd
    ? truncateTo(dhelixMd, PROFILE_TARGET_TOKENS * 4)
    : "(DHELIX.md missing)";

  const userParts = [
    `package.json overview:\n${pkgDigest}`,
    "",
    input.mode === "llm-summary"
      ? `DHELIX.md (headings + first paragraphs only):\n${condenseDhelix(dhelixMd)}`
      : `DHELIX.md:\n${dhelixDigest}`,
  ];

  const body = await input.llm({
    system,
    user: userParts.join("\n"),
    jsonMode: false,
    temperature: 0,
    maxTokens: PROFILE_TARGET_TOKENS * 2,
    signal: input.signal,
  });

  const trimmed = body.trim();
  if (trimmed.length === 0) {
    return buildStaticTemplate(packageJson, dhelixMd);
  }

  const withHeading = trimmed.startsWith("## ")
    ? trimmed
    : `${heading}\n\n${trimmed}`;
  return `<!-- GENERATED — LLM project profile (${input.mode}) -->\n\n${withHeading}\n`;
}

function summarisePackage(content: string): string {
  const pkg = parsePackageJson(content);
  if (!pkg) return "(package.json unparseable)";
  const pieces: string[] = [];
  if (pkg.name) pieces.push(`name: ${pkg.name}`);
  if (pkg.version) pieces.push(`version: ${pkg.version}`);
  if (pkg.description) pieces.push(`description: ${pkg.description}`);
  const stack = detectStackHints(pkg);
  if (stack.length > 0) pieces.push(`stack: ${stack.join(", ")}`);
  if (pkg.engines?.node) pieces.push(`node: ${pkg.engines.node}`);
  return pieces.join("\n");
}

function condenseDhelix(md: string | undefined): string {
  if (!md) return "(DHELIX.md missing)";
  const lines = md.split(/\n/u);
  const result: string[] = [];
  let captureNext = false;
  for (const line of lines) {
    if (/^#{1,3}\s/u.test(line)) {
      result.push(line.trim());
      captureNext = true;
      continue;
    }
    if (captureNext && line.trim().length > 0) {
      result.push(line.trim());
      captureNext = false;
    }
  }
  return truncateTo(result.join("\n"), PROFILE_TARGET_TOKENS * 4);
}

function truncateTo(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars - 1).trimEnd()}…`;
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new Error("project profiler aborted");
  }
}

/**
 * Plasmid loader — 4-scope discovery with the I-1 two-file lock.
 *
 * Scopes (in precedence order — see `SCOPE_PRECEDENCE` in `./types.ts`):
 *   ephemeral → local → shared → team
 *
 * Each scope directory may hold plasmids in two on-disk shapes:
 *   1. Directory form (canonical I-1 lock):
 *        <scope>/<id>/metadata.yaml
 *        <scope>/<id>/body.md
 *   2. Single-file form (author ergonomics):
 *        <scope>/<id>.md  with YAML frontmatter
 *
 * The loader emits a partitioned {@link LoadResult}: successful parses go into
 * `loaded`, everything else becomes a {@link LoadFailure} with a precise
 * {@link PlasmidErrorCode}. It never throws for per-plasmid problems; it only
 * throws for programmer errors (invalid options) or aborts.
 *
 * Layer: Leaf — imports only from `node:*`, `./types.js`, `./schema.js`,
 * `./parser.js`, `./errors.js`, and `../utils/path.js`.
 */

import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

import { resolvePath } from "../utils/path.js";
import {
  PlasmidBodyUnreadableError,
  PlasmidFrontmatterMissingError,
  PlasmidOrphanError,
  PlasmidSchemaError,
  isPlasmidError,
} from "./errors.js";
import { splitFrontmatter } from "./frontmatter.js";
import { parsePlasmidBody, parsePlasmidSource } from "./parser.js";
import {
  evalCasesSchema,
  plasmidMetadataSchema,
} from "./schema.js";
import type {
  ChallengeableBy,
  LoadFailure,
  LoadResult,
  LoadedPlasmid,
  PlasmidEvalCase,
  PlasmidErrorCode,
  PlasmidFingerprint,
  PlasmidId,
  PlasmidMetadata,
  PlasmidScope,
} from "./types.js";
import { SCOPE_PRECEDENCE } from "./types.js";

/**
 * Loader-level default for `metadata.challengeable` when a plasmid is
 * `foundational: true` but omits the block. Mirrors the `challengeableBySchema`
 * defaults exactly (Phase 5 dev-guide §4 / P-1.10 §2). Filling at the loader
 * keeps the Zod schema input/output types narrow — see dev-guide §6 rationale.
 */
const DEFAULT_FOUNDATIONAL_CHALLENGEABLE: ChallengeableBy = {
  "require-justification": true,
  "min-justification-length": 50,
  "audit-log": true,
  "require-cooldown": "24h",
  "require-team-consensus": false,
  "min-approvers": 1,
};

/** Options for {@link loadPlasmids}. */
export interface LoaderOptions {
  /** Project root — used to resolve the `local`/`ephemeral` scopes. */
  readonly workingDirectory: string;
  /** Registry path from config (e.g., `.dhelix/plasmids`). May be absolute or relative. */
  readonly registryPath: string;
  /** Optional shared registry path (team-level convention). */
  readonly sharedRegistryPath?: string;
  /** Propagated through every I/O call; checked at each scope boundary. */
  readonly signal?: AbortSignal;
}

/**
 * Discover and parse every plasmid across all configured scopes. Partitioned
 * result — callers decide whether to surface failures to the user.
 */
export async function loadPlasmids(options: LoaderOptions): Promise<LoadResult> {
  const { workingDirectory, registryPath, sharedRegistryPath, signal } = options;
  if (!workingDirectory) {
    throw new Error("loadPlasmids: workingDirectory is required");
  }
  if (!registryPath) {
    throw new Error("loadPlasmids: registryPath is required");
  }

  const localBase = resolvePath(workingDirectory, registryPath);
  const ephemeralBase = join(localBase, ".drafts");
  const sharedBase =
    sharedRegistryPath !== undefined && sharedRegistryPath.length > 0
      ? resolvePath(sharedRegistryPath)
      : undefined;

  const loaded: LoadedPlasmid[] = [];
  const failed: LoadFailure[] = [];
  const seenIds = new Map<PlasmidId, PlasmidScope>();

  for (const scope of SCOPE_PRECEDENCE) {
    checkAbort(signal);
    const scopeDir = resolveScopeDir(scope, {
      local: localBase,
      ephemeral: ephemeralBase,
      shared: sharedBase,
    });
    if (scopeDir === undefined) continue;

    const entries = await safeListPlasmidCandidates(scopeDir, signal);
    for (const candidate of entries) {
      checkAbort(signal);
      const outcome = await loadCandidate(candidate, scope, signal);
      if (outcome.kind === "failure") {
        failed.push(outcome.failure);
        continue;
      }
      const priorScope = seenIds.get(outcome.plasmid.metadata.id);
      if (priorScope !== undefined) {
        failed.push({
          path: outcome.plasmid.sourcePath,
          code: "PLASMID_DUPLICATE_ID",
          reason: `plasmid id "${outcome.plasmid.metadata.id}" already provided by scope "${priorScope}"`,
        });
        continue;
      }
      seenIds.set(outcome.plasmid.metadata.id, scope);
      loaded.push(outcome.plasmid);
    }
  }

  return { loaded, failed };
}

// ---------------------------------------------------------------------------
// Scope resolution
// ---------------------------------------------------------------------------

interface ScopeDirs {
  readonly local: string;
  readonly ephemeral: string;
  readonly shared: string | undefined;
}

function resolveScopeDir(scope: PlasmidScope, dirs: ScopeDirs): string | undefined {
  switch (scope) {
    case "ephemeral":
      return dirs.ephemeral;
    case "local":
      return dirs.local;
    case "shared":
      return dirs.shared;
    case "team":
      // Reserved in Phase 1 — no-op discovery.
      return undefined;
    default: {
      // Exhaustiveness check.
      const _exhaustive: never = scope;
      void _exhaustive;
      return undefined;
    }
  }
}

// ---------------------------------------------------------------------------
// Candidate discovery
// ---------------------------------------------------------------------------

/** One plasmid on disk — normalized to a common shape before parsing. */
interface Candidate {
  readonly id: string; // unvalidated; schema rejects invalid ids
  readonly form: "single-file" | "two-file";
  readonly sourcePath: string; // body.md or <id>.md (used for bodyFingerprint)
  readonly metadataPath: string; // metadata.yaml, or same as sourcePath for single-file
}

async function safeListPlasmidCandidates(
  scopeDir: string,
  signal: AbortSignal | undefined,
): Promise<readonly Candidate[]> {
  let entries;
  try {
    entries = await readdir(scopeDir, { withFileTypes: true });
  } catch (error) {
    // Missing scope dir is legal — callers may not have initialized the
    // registry yet. Other errors (permissions, etc.) are surfaced as an
    // empty list — downstream preflight telemetry will notice.
    if (isNodeError(error) && error.code === "ENOENT") return [];
    return [];
  }

  const candidates: Candidate[] = [];
  for (const entry of entries) {
    checkAbort(signal);
    // Skip dot-directories that are not `.drafts` (already resolved). They
    // typically hold IDE artifacts (`.git`, `.vscode`, etc.).
    if (entry.name.startsWith(".")) continue;

    if (entry.isDirectory()) {
      const metadataPath = join(scopeDir, entry.name, "metadata.yaml");
      const bodyPath = join(scopeDir, entry.name, "body.md");
      candidates.push({
        id: entry.name,
        form: "two-file",
        sourcePath: bodyPath,
        metadataPath,
      });
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".md") && !entry.name.endsWith(".body.md")) {
      const id = entry.name.slice(0, -".md".length);
      const filePath = join(scopeDir, entry.name);
      candidates.push({
        id,
        form: "single-file",
        sourcePath: filePath,
        metadataPath: filePath,
      });
    }
  }
  return candidates;
}

// ---------------------------------------------------------------------------
// Per-candidate load
// ---------------------------------------------------------------------------

type Outcome =
  | { readonly kind: "failure"; readonly failure: LoadFailure }
  | { readonly kind: "success"; readonly plasmid: LoadedPlasmid };

async function loadCandidate(
  candidate: Candidate,
  scope: PlasmidScope,
  signal: AbortSignal | undefined,
): Promise<Outcome> {
  checkAbort(signal);
  try {
    if (candidate.form === "two-file") {
      return await loadTwoFile(candidate, scope, signal);
    }
    return await loadSingleFile(candidate, scope, signal);
  } catch (error) {
    return {
      kind: "failure",
      failure: errorToFailure(error, candidate.sourcePath),
    };
  }
}

async function loadTwoFile(
  candidate: Candidate,
  scope: PlasmidScope,
  signal: AbortSignal | undefined,
): Promise<Outcome> {
  const metaExists = await fileExists(candidate.metadataPath, signal);
  const bodyExists = await fileExists(candidate.sourcePath, signal);

  if (!metaExists && !bodyExists) {
    // Empty directory under the scope — ignore.
    return {
      kind: "failure",
      failure: {
        path: candidate.metadataPath,
        code: "PLASMID_ORPHAN_METADATA",
        reason: `plasmid directory "${candidate.id}" is missing both metadata.yaml and body.md`,
      },
    };
  }
  if (!bodyExists) {
    throw new PlasmidOrphanError(
      `metadata.yaml without a matching body.md (id="${candidate.id}")`,
      "metadata",
      { path: candidate.metadataPath },
    );
  }
  if (!metaExists) {
    throw new PlasmidOrphanError(
      `body.md without a matching metadata.yaml (id="${candidate.id}")`,
      "body",
      { path: candidate.sourcePath },
    );
  }

  checkAbort(signal);
  const [rawMetadata, body] = await Promise.all([
    readText(candidate.metadataPath, signal).catch((error) => {
      throw new PlasmidBodyUnreadableError(
        `failed to read metadata.yaml: ${messageOf(error)}`,
        { path: candidate.metadataPath },
      );
    }),
    readText(candidate.sourcePath, signal).catch((error) => {
      throw new PlasmidBodyUnreadableError(
        `failed to read body.md: ${messageOf(error)}`,
        { path: candidate.sourcePath },
      );
    }),
  ]);

  // Reuse the single-file parser by reconstructing a synthetic frontmatter.
  const combined = `---\n${stripTrailingNewline(rawMetadata)}\n---\n${body}`;
  const parsed = parsePlasmidSource(combined);
  // Also pull evals from `body.md` alone (more forgiving for partial parses).
  const bodyOnly = parsePlasmidBody(body);

  return finalize(candidate, scope, parsed.metadata, parsed.bodyWithoutEvals, bodyOnly.evalCases.length > 0 ? bodyOnly.evalCases : parsed.evalCases, body);
}

async function loadSingleFile(
  candidate: Candidate,
  scope: PlasmidScope,
  signal: AbortSignal | undefined,
): Promise<Outcome> {
  const exists = await fileExists(candidate.sourcePath, signal);
  if (!exists) {
    // Should not happen — we listed it ourselves — but be defensive.
    throw new PlasmidBodyUnreadableError("plasmid file vanished during load", {
      path: candidate.sourcePath,
    });
  }
  const source = await readText(candidate.sourcePath, signal).catch((error) => {
    throw new PlasmidBodyUnreadableError(
      `failed to read plasmid: ${messageOf(error)}`,
      { path: candidate.sourcePath },
    );
  });
  const parsed = parsePlasmidSource(source);
  // For single-file form, the "body" for fingerprinting is the markdown after
  // frontmatter (pre eval-strip).
  const { body } = splitForFingerprint(source);
  return finalize(
    candidate,
    scope,
    parsed.metadata,
    parsed.bodyWithoutEvals,
    parsed.evalCases,
    body,
  );
}

function splitForFingerprint(source: string): { readonly body: string } {
  // Re-split with the frontmatter helper; failures here are already caught
  // upstream, so we trust the format.
  try {
    const { body } = splitFrontmatter(source);
    return { body };
  } catch {
    return { body: source };
  }
}

function finalize(
  candidate: Candidate,
  scope: PlasmidScope,
  rawMetadata: Record<string, unknown>,
  bodyWithoutEvals: string,
  rawEvalCases: readonly unknown[],
  bodyForFingerprint: string,
): Outcome {
  const metadataResult = plasmidMetadataSchema.safeParse(rawMetadata);
  if (!metadataResult.success) {
    throw new PlasmidSchemaError(
      `metadata validation failed: ${summarizeZod(metadataResult.error)}`,
      { path: candidate.metadataPath, issues: metadataResult.error.issues },
    );
  }
  const parsedMetadata = metadataResult.data as PlasmidMetadata;
  // Phase 5 — fill the foundational `challengeable` default at loader time so
  // the Zod schema's input/output types stay narrow (see dev-guide §6).
  const metadata: PlasmidMetadata =
    parsedMetadata.foundational === true && parsedMetadata.challengeable === undefined
      ? { ...parsedMetadata, challengeable: DEFAULT_FOUNDATIONAL_CHALLENGEABLE }
      : parsedMetadata;

  if (metadata.id !== (candidate.id as PlasmidId)) {
    throw new PlasmidSchemaError(
      `metadata id "${metadata.id}" does not match on-disk id "${candidate.id}"`,
      { expected: candidate.id, actual: metadata.id, path: candidate.metadataPath },
    );
  }

  const evalResult = evalCasesSchema.safeParse(rawEvalCases);
  if (!evalResult.success) {
    throw new PlasmidSchemaError(
      `eval cases validation failed: ${summarizeZod(evalResult.error)}`,
      { path: candidate.sourcePath, issues: evalResult.error.issues },
    );
  }
  const evalCases = evalResult.data as readonly PlasmidEvalCase[];

  const bodyFingerprint = sha256Hex(bodyForFingerprint) as PlasmidFingerprint;

  const plasmid: LoadedPlasmid = {
    metadata: { ...metadata, scope },
    body: bodyWithoutEvals,
    bodyFingerprint,
    evalCases,
    sourcePath: candidate.sourcePath,
    metadataPath: candidate.metadataPath,
    scopeOrigin: scope,
  };
  return { kind: "success", plasmid };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function checkAbort(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) {
    // Throw a DOMException-like AbortError so callers can `instanceof Error`
    // and inspect `.name === "AbortError"`.
    const reason = signal.reason;
    if (reason instanceof Error) throw reason;
    const err = new Error(typeof reason === "string" ? reason : "plasmid load aborted");
    err.name = "AbortError";
    throw err;
  }
}

async function fileExists(path: string, signal: AbortSignal | undefined): Promise<boolean> {
  checkAbort(signal);
  try {
    const info = await stat(path);
    return info.isFile();
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return false;
    return false;
  }
}

async function readText(path: string, signal: AbortSignal | undefined): Promise<string> {
  checkAbort(signal);
  return readFile(path, { encoding: "utf8", signal });
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function stripTrailingNewline(text: string): string {
  return text.endsWith("\n") ? text.slice(0, -1) : text;
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

interface NodeError extends Error {
  readonly code?: string;
}
function isNodeError(error: unknown): error is NodeError {
  return error instanceof Error && typeof (error as NodeError).code === "string";
}

function summarizeZod(error: {
  readonly issues: ReadonlyArray<{
    readonly path: readonly (string | number)[];
    readonly message: string;
  }>;
}): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
    .join("; ");
}

function errorToFailure(error: unknown, path: string): LoadFailure {
  if (isPlasmidError(error)) {
    return {
      path,
      code: error.code as PlasmidErrorCode,
      reason: error.message,
    };
  }
  if (error instanceof PlasmidFrontmatterMissingError) {
    // Unreachable — isPlasmidError catches it — but keeps the type guard
    // narrow if the class hierarchy changes.
    return {
      path,
      code: "PLASMID_FRONTMATTER_MISSING",
      reason: error.message,
    };
  }
  return {
    path,
    code: "PLASMID_BODY_UNREADABLE",
    reason: messageOf(error),
  };
}

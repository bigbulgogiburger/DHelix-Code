/**
 * Cure planner — builds a `CurePlan` from one or more transcripts (PRD §6.4).
 *
 * Team 4 — Phase 3. For each transcript consumed:
 *   1. Emit `delete-file` steps for every `writtenFiles[].path` whose op
 *      was `"create"` or `"update"` (with `expectedHash` for conflict check)
 *   2. Emit `remove-marker` steps for every `reorgMarkerIds[]` — these are
 *      the markers *actually* rendered into DHELIX.md
 *   3. When `purge=true`, emit `archive-plasmid` + `clear-refs` steps
 *
 * Warning generation (non-blocking):
 *   - `manual-edit` — per file whose current hash ≠ expectedHash
 *   - `later-transcript` — newer transcript references same plasmid/file
 *   - `git-uncommitted` — non-empty `git status --porcelain`
 *   - `unknown-marker` — markerId not found in current DHELIX.md
 *
 * Layer: Core. Reads from disk (transcripts + artifact files).
 */
import { spawn } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

import type { PlasmidId } from "../../plasmids/types.js";
import {
  CONSTITUTION_FILE,
  RECOMBINATION_TRANSCRIPTS_DIR,
} from "../types.js";
import type {
  CurePlan,
  CureStep,
  CureWarning,
  PlanCureFn,
  RecombinationTranscript,
  WrittenFile,
} from "../types.js";

import { detectManualEdits } from "./edit-detector.js";
import { readPlasmidRef } from "./refs.js";

interface NodeError extends Error {
  code?: string;
}

function isNodeError(err: unknown): err is NodeError {
  return err instanceof Error && typeof (err as NodeError).code === "string";
}

/** Typed error subclass for planner failures — caller wraps into CureResult. */
export class CurePlanError extends Error {
  public readonly code: "CURE_NO_TRANSCRIPT" | "TRANSCRIPT_CORRUPT";
  constructor(
    code: "CURE_NO_TRANSCRIPT" | "TRANSCRIPT_CORRUPT",
    message: string,
  ) {
    super(message);
    this.code = code;
    this.name = "CurePlanError";
  }
}

function transcriptDir(cwd: string): string {
  return join(cwd, RECOMBINATION_TRANSCRIPTS_DIR);
}

async function listTranscriptIds(cwd: string): Promise<readonly string[]> {
  const dir = transcriptDir(cwd);
  let files: readonly string[];
  try {
    files = await readdir(dir);
  } catch (err) {
    if (isNodeError(err) && err.code === "ENOENT") return [];
    throw err;
  }
  return files
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.slice(0, -".json".length))
    .sort();
}

function isValidTranscriptShape(value: unknown): value is RecombinationTranscript {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.mode === "string" &&
    Array.isArray(v.writtenFiles) &&
    Array.isArray(v.reorgMarkerIds)
  );
}

async function loadTranscript(
  cwd: string,
  transcriptId: string,
): Promise<RecombinationTranscript> {
  const path = join(transcriptDir(cwd), `${transcriptId}.json`);
  let raw: string;
  try {
    raw = await readFile(path, "utf-8");
  } catch (err) {
    if (isNodeError(err) && err.code === "ENOENT") {
      throw new CurePlanError(
        "CURE_NO_TRANSCRIPT",
        `No transcript found with id '${transcriptId}' at ${path}`,
      );
    }
    throw err;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new CurePlanError(
      "TRANSCRIPT_CORRUPT",
      `Malformed transcript JSON at ${path}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!isValidTranscriptShape(parsed)) {
    throw new CurePlanError(
      "TRANSCRIPT_CORRUPT",
      `Transcript at ${path} is missing required fields (id, mode, writtenFiles, reorgMarkerIds).`,
    );
  }
  return parsed;
}

async function gitStatusUncommitted(cwd: string, signal?: AbortSignal): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (value: boolean): void => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    let child: ReturnType<typeof spawn>;
    try {
      child = spawn("git", ["status", "--porcelain"], {
        cwd,
        stdio: ["ignore", "pipe", "ignore"],
      });
    } catch {
      finish(false);
      return;
    }

    let buf = "";
    child.stdout?.on("data", (chunk: Buffer | string) => {
      buf += String(chunk);
    });
    child.on("error", () => finish(false));
    child.on("close", (code) => {
      if (code === 0) finish(buf.trim().length > 0);
      else finish(false);
    });

    if (signal) {
      const onAbort = (): void => {
        try {
          child.kill();
        } catch {
          /* ignore */
        }
        finish(false);
      };
      if (signal.aborted) onAbort();
      else signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}

export const planCure: PlanCureFn = async ({ options }) => {
  const cwd = options.workingDirectory;

  // Phase 1 — figure out which transcripts to load.
  const transcriptIds: string[] = [];
  switch (options.mode.kind) {
    case "latest": {
      const ids = await listTranscriptIds(cwd);
      const latest = ids[ids.length - 1];
      if (latest === undefined) {
        throw new CurePlanError(
          "CURE_NO_TRANSCRIPT",
          "No recombination transcripts exist under .dhelix/recombination/transcripts/.",
        );
      }
      transcriptIds.push(latest);
      break;
    }
    case "all": {
      const ids = await listTranscriptIds(cwd);
      if (ids.length === 0) {
        throw new CurePlanError(
          "CURE_NO_TRANSCRIPT",
          "No recombination transcripts exist under .dhelix/recombination/transcripts/.",
        );
      }
      transcriptIds.push(...ids);
      break;
    }
    case "transcript": {
      transcriptIds.push(options.mode.id);
      break;
    }
    case "plasmid": {
      const ref = await readPlasmidRef(cwd, options.mode.id, options.signal);
      if (ref === null) {
        throw new CurePlanError(
          "CURE_NO_TRANSCRIPT",
          `No transcript ref found for plasmid '${String(options.mode.id)}' (.dhelix/recombination/refs/plasmids/${String(options.mode.id)}).`,
        );
      }
      transcriptIds.push(ref);
      break;
    }
  }

  // Phase 2 — load and validate.
  const transcripts: RecombinationTranscript[] = [];
  for (const id of transcriptIds) {
    transcripts.push(await loadTranscript(cwd, id));
  }

  // Phase 3 — build steps (dedupe markers + plasmids across transcripts).
  const steps: CureStep[] = [];
  const filesForEditCheck: {
    readonly transcript: RecombinationTranscript;
    readonly file: WrittenFile;
  }[] = [];
  const seenMarkerIds = new Set<string>();
  const seenArchivedPlasmids = new Set<PlasmidId>();

  for (const transcript of transcripts) {
    for (const file of transcript.writtenFiles) {
      if (file.op !== "create" && file.op !== "update") continue;
      steps.push({
        kind: "delete-file",
        path: file.path,
        expectedHash: file.contentHash,
      });
      filesForEditCheck.push({ transcript, file });
    }
    for (const markerId of transcript.reorgMarkerIds) {
      if (seenMarkerIds.has(markerId)) continue;
      seenMarkerIds.add(markerId);
      steps.push({ kind: "remove-marker", markerId });
    }
    if (options.purge === true) {
      for (const plasmidId of transcript.activePlasmidIds) {
        if (seenArchivedPlasmids.has(plasmidId)) continue;
        seenArchivedPlasmids.add(plasmidId);
        steps.push({ kind: "archive-plasmid", plasmidId });
        steps.push({ kind: "clear-refs", plasmidId });
      }
    }
  }

  // Phase 4 — warnings.
  const warnings: CureWarning[] = [];

  // Manual-edit detection (group per transcript so mtime uses the right finishedAt).
  for (const transcript of transcripts) {
    const subset = filesForEditCheck
      .filter((x) => x.transcript.id === transcript.id)
      .map((x) => x.file);
    if (subset.length === 0) continue;
    const editWarnings = await detectManualEdits({
      workingDirectory: cwd,
      transcript,
      files: subset,
      signal: options.signal,
    });
    warnings.push(...editWarnings);
  }

  // later-transcript detection (only meaningful when not `all`).
  if (options.mode.kind !== "all") {
    const allIds = await listTranscriptIds(cwd);
    const currentLatest = transcripts[transcripts.length - 1];
    const currentFinishedAt = currentLatest
      ? Date.parse(currentLatest.finishedAt)
      : NaN;
    const targetPlasmids = new Set<PlasmidId>();
    for (const t of transcripts) {
      for (const p of t.activePlasmidIds) targetPlasmids.add(p);
    }
    const includedIds = new Set<string>(transcripts.map((t) => t.id));
    for (const otherId of allIds) {
      if (includedIds.has(otherId)) continue;
      let other: RecombinationTranscript;
      try {
        other = await loadTranscript(cwd, otherId);
      } catch {
        continue; // ignore malformed/other errors in warning path
      }
      const otherStartedAt = Date.parse(other.startedAt);
      if (!Number.isFinite(otherStartedAt) || !Number.isFinite(currentFinishedAt)) continue;
      if (otherStartedAt <= currentFinishedAt) continue;
      const overlaps = other.activePlasmidIds.some((p) => targetPlasmids.has(p));
      if (!overlaps) continue;
      warnings.push({
        kind: "later-transcript",
        message: `Transcript '${other.id}' is newer and touches overlapping plasmids — running /cure will leave dangling artifacts`,
      });
    }
  }

  // git-uncommitted (best effort).
  try {
    if (await gitStatusUncommitted(cwd, options.signal)) {
      warnings.push({
        kind: "git-uncommitted",
        message: "git working tree has uncommitted changes — consider committing before /cure",
      });
    }
  } catch {
    /* ignore — non-blocking */
  }

  // unknown-marker (best effort DHELIX.md scan).
  if (seenMarkerIds.size > 0) {
    try {
      const constitution = await readFile(join(cwd, CONSTITUTION_FILE), "utf-8");
      for (const markerId of seenMarkerIds) {
        const needle = `plasmid-derived: ${markerId}`;
        if (!constitution.includes(needle)) {
          warnings.push({
            kind: "unknown-marker",
            markerId,
            message: `Marker '${markerId}' not present in DHELIX.md — removal is a no-op`,
          });
        }
      }
    } catch (err) {
      if (!(isNodeError(err) && err.code === "ENOENT")) {
        // non-blocking — still emit a single warning noting DHELIX.md missing.
        warnings.push({
          kind: "unknown-marker",
          message: `DHELIX.md could not be read for marker verification: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }
  }

  // Phase 5 — preview.
  const preview = renderPreview({
    transcriptIds: transcripts.map((t) => t.id),
    steps,
    warnings,
    options,
  });

  const plan: CurePlan = {
    transcriptIds: transcripts.map((t) => t.id),
    steps,
    warnings,
    preview,
  };
  return plan;
};

function renderPreview(args: {
  readonly transcriptIds: readonly string[];
  readonly steps: readonly CureStep[];
  readonly warnings: readonly CureWarning[];
  readonly options: { readonly purge?: boolean; readonly dryRun: boolean };
}): string {
  const deleteFiles = args.steps.filter(
    (s): s is Extract<CureStep, { kind: "delete-file" }> => s.kind === "delete-file",
  );
  const removeMarkers = args.steps.filter(
    (s): s is Extract<CureStep, { kind: "remove-marker" }> => s.kind === "remove-marker",
  );
  const archivePlasmids = args.steps.filter(
    (s): s is Extract<CureStep, { kind: "archive-plasmid" }> => s.kind === "archive-plasmid",
  );

  const lines: string[] = [];
  lines.push("🧬 /cure plan");
  lines.push(
    `  transcripts: ${args.transcriptIds.length > 0 ? args.transcriptIds.join(", ") : "(none)"}`,
  );
  lines.push("");

  lines.push(`  Will delete ${deleteFiles.length} file(s):`);
  for (let i = 0; i < deleteFiles.length; i++) {
    const isLast = i === deleteFiles.length - 1;
    const step = deleteFiles[i];
    if (step === undefined) continue;
    lines.push(`    ${isLast ? "└─" : "├─"} ${step.path}`);
  }
  if (deleteFiles.length === 0) lines.push("    (none)");
  lines.push("");

  lines.push(`  Will remove ${removeMarkers.length} marker(s) from DHELIX.md:`);
  for (const step of removeMarkers) {
    lines.push(`    • ${step.markerId}`);
  }
  if (removeMarkers.length === 0) lines.push("    (none)");
  lines.push("");

  if (args.options.purge === true) {
    lines.push(`  Will archive ${archivePlasmids.length} plasmid(s):`);
    for (const step of archivePlasmids) {
      lines.push(`    • ${String(step.plasmidId)}`);
    }
    if (archivePlasmids.length === 0) lines.push("    (none)");
  } else {
    lines.push("  Plasmids preserved (use --purge to archive).");
  }
  lines.push("");

  if (args.warnings.length > 0) {
    lines.push(`  ⚠ Warnings (${args.warnings.length}):`);
    for (const w of args.warnings) {
      const loc =
        w.path !== undefined
          ? ` [${w.path}]`
          : w.markerId !== undefined
            ? ` [${w.markerId}]`
            : w.plasmidId !== undefined
              ? ` [${String(w.plasmidId)}]`
              : "";
      lines.push(`    - (${w.kind})${loc} ${w.message}`);
    }
  } else {
    lines.push("  ✓ No warnings.");
  }

  return lines.join("\n");
}

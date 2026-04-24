/**
 * Manual edit detection (PRD §6.4 Step 3, I-2).
 *
 * Team 4 — Phase 3. Given a `WrittenFile` entry and the current disk
 * state, returns whether the file has been modified since the recombination
 * run that produced it.
 *
 * Detection rules (in priority order):
 *   1. `contentHash` mismatch (SHA-256) → manual edit
 *   2. `mtime > transcript.finishedAt` → manual edit (fallback only)
 *   3. File missing → counts as "already removed", NOT a manual edit
 *
 * Layer: Core. fs.stat + hash read-only.
 */
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";

import type {
  CureWarning,
  RecombinationTranscript,
  WrittenFile,
} from "../types.js";

export interface DetectManualEditsRequest {
  readonly workingDirectory: string;
  readonly transcript: RecombinationTranscript;
  readonly files: readonly WrittenFile[];
  readonly signal?: AbortSignal;
}

interface NodeError extends Error {
  code?: string;
}

function isNodeError(err: unknown): err is NodeError {
  return err instanceof Error && typeof (err as NodeError).code === "string";
}

/** 1-second slack absorbs FS timestamp resolution and clock skew. */
const MTIME_SLACK_MS = 1_000;

export const detectManualEdits: (
  req: DetectManualEditsRequest,
) => Promise<readonly CureWarning[]> = async ({
  transcript,
  files,
  signal,
}) => {
  const warnings: CureWarning[] = [];
  const finishedAtMs = Date.parse(transcript.finishedAt);

  for (const file of files) {
    if (signal?.aborted) {
      throw new Error("detectManualEdits: aborted");
    }

    let statInfo: Awaited<ReturnType<typeof stat>>;
    try {
      statInfo = await stat(file.path);
    } catch (err) {
      if (isNodeError(err) && err.code === "ENOENT") continue;
      throw err;
    }

    let contentBuf: Buffer;
    try {
      contentBuf = await readFile(file.path);
    } catch (err) {
      if (isNodeError(err) && err.code === "ENOENT") continue;
      throw err;
    }

    // 1. Hash mismatch — authoritative. `""` expected means Phase-2
    //    transcripts lacking hash info; skip hash check in that case.
    let hashMismatched = false;
    if (file.contentHash !== "") {
      const actual = createHash("sha256").update(contentBuf).digest("hex");
      if (actual !== file.contentHash) {
        warnings.push({
          kind: "manual-edit",
          path: file.path,
          message: "SHA-256 mismatch — file modified since recombination",
        });
        hashMismatched = true;
      }
    }

    // 2. mtime-only fallback (emit only when no content-hash warning yet).
    if (!hashMismatched && Number.isFinite(finishedAtMs)) {
      const mtimeMs = statInfo.mtime.getTime();
      if (mtimeMs > finishedAtMs + MTIME_SLACK_MS) {
        warnings.push({
          kind: "manual-edit",
          path: file.path,
          message: "mtime is later than transcript.finishedAt — file may have been modified",
        });
      }
    }
  }

  return warnings;
};

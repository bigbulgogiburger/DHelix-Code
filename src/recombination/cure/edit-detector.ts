/**
 * Manual edit detection (PRD §6.4 Step 3, I-2).
 *
 * Team 4 — Phase 3. Given a `WrittenFile` entry and the current disk
 * state, returns whether the file has been modified since the recombination
 * run that produced it.
 *
 * Detection rules (in priority order):
 *   1. `contentHash` mismatch (SHA-256) → manual edit
 *   2. `mtime > transcript.finishedAt` → manual edit
 *   3. File missing → counts as "already removed", NOT a manual edit
 *
 * Returns a `CureWarning[]` so callers can present a diff prompt.
 *
 * Layer: Core. fs.stat + hash read-only.
 */
import type { CureWarning, RecombinationTranscript, WrittenFile } from "../types.js";

export interface DetectManualEditsRequest {
  readonly workingDirectory: string;
  readonly transcript: RecombinationTranscript;
  readonly files: readonly WrittenFile[];
  readonly signal?: AbortSignal;
}

export const detectManualEdits: (
  req: DetectManualEditsRequest,
) => Promise<readonly CureWarning[]> = () => {
  throw new Error("TODO Phase 3 Team 4: detectManualEdits");
};

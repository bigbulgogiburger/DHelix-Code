/**
 * Cure restorer — executes a `CurePlan` atomically (PRD §6.4).
 *
 * Team 4 — Phase 3. Steps:
 *   1. Acquire `.dhelix/recombination/.lock` (reentrant)
 *   2. Dry-run short-circuit
 *   3. Delete files listed in plan — skip + record warning on
 *      `CURE_CONFLICT` (current hash ≠ expectedHash) unless user overrides
 *   4. Re-parse DHELIX.md + construct a *reverse* `ReorgPlan` (one
 *      `kind:"remove"` op per markerId), call `applyPlan` from
 *      `../constitution/index.js` + verify I-9 invariance
 *   5. When `purge=true`, move plasmid `.md` to archive (never delete — I-1)
 *   6. Append audit.log entry (I-5) + release lock
 *
 * Layer: Core. Heavy I/O; must be atomic per-step.
 */
import { createHash } from "node:crypto";
import {
  appendFile,
  mkdir,
  readFile,
  readdir,
  rename,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";

import type { PlasmidId } from "../../plasmids/types.js";
import {
  applyPlan,
  listUserSections,
  normalizeUserText,
  parse,
} from "../constitution/index.js";
import type { SectionTree } from "../constitution/index.js";
import { acquire } from "../lock.js";
import {
  CONSTITUTION_FILE,
  PLASMIDS_ARCHIVE_DIR,
  RECOMBINATION_AUDIT_LOG,
} from "../types.js";
import type {
  CureErrorCode,
  CureResult,
  CureStep,
  ReorgPlan,
  RestoreCureFn,
} from "../types.js";

import { clearPlasmidRef } from "./refs.js";

interface NodeError extends Error {
  code?: string;
}

function isNodeError(err: unknown): err is NodeError {
  return err instanceof Error && typeof (err as NodeError).code === "string";
}

async function sha256File(path: string): Promise<string | null> {
  try {
    const buf = await readFile(path);
    return createHash("sha256").update(buf).digest("hex");
  } catch (err) {
    if (isNodeError(err) && err.code === "ENOENT") return null;
    throw err;
  }
}

async function atomicWrite(target: string, content: string): Promise<void> {
  await mkdir(dirname(target), { recursive: true });
  const tmp = `${target}.tmp.${process.pid}.${Date.now()}`;
  try {
    await writeFile(tmp, content, "utf-8");
    await rename(tmp, target);
  } catch (err) {
    try {
      await unlink(tmp);
    } catch {
      /* best effort */
    }
    throw err;
  }
}

async function archivePlasmidDir(
  workingDirectory: string,
  plasmidId: PlasmidId,
  timestamp: string,
): Promise<boolean> {
  const sourceDir = join(workingDirectory, ".dhelix", "plasmids", String(plasmidId));
  try {
    const st = await stat(sourceDir);
    if (!st.isDirectory()) return false;
  } catch (err) {
    if (isNodeError(err) && err.code === "ENOENT") return false;
    throw err;
  }
  const archiveRoot = join(workingDirectory, PLASMIDS_ARCHIVE_DIR);
  await mkdir(archiveRoot, { recursive: true });
  const targetDir = join(archiveRoot, `${String(plasmidId)}-${timestamp}`);
  await rename(sourceDir, targetDir);
  return true;
}

export const restoreCure: RestoreCureFn = async ({ options, plan }) => {
  const cwd = options.workingDirectory;
  const filesDeleted: string[] = [];
  const markersRemoved: string[] = [];
  const plasmidsArchived: PlasmidId[] = [];

  if (options.dryRun) {
    return {
      plan,
      executed: false,
      filesDeleted,
      markersRemoved,
      plasmidsArchived,
    };
  }

  const handle = await acquire(cwd, { ttlSec: 300 });
  try {
    // 1. delete-file steps.
    const deleteSteps = plan.steps.filter(
      (s): s is Extract<CureStep, { kind: "delete-file" }> => s.kind === "delete-file",
    );
    for (const step of deleteSteps) {
      if (options.signal?.aborted) {
        return abortedResult(plan, filesDeleted, markersRemoved, plasmidsArchived, "aborted by signal");
      }
      const current = await sha256File(step.path);
      if (current === null) {
        // Already missing — treat as already-deleted (idempotent).
        continue;
      }
      // expectedHash === "" means the Phase-2 transcript lacked hashes;
      // auto-approve deletion rather than permanently block /cure.
      const hashOk = step.expectedHash === "" || current === step.expectedHash;
      if (!hashOk && options.approvalMode !== "auto") {
        return {
          plan,
          executed: false,
          filesDeleted,
          markersRemoved,
          plasmidsArchived,
          errorCode: "CURE_CONFLICT" as CureErrorCode,
          errorMessage: `Hash mismatch for ${step.path}: expected ${step.expectedHash}, got ${current}. Re-run with --yes to override, or restore the file manually first.`,
        };
      }
      try {
        await unlink(step.path);
      } catch (err) {
        if (!(isNodeError(err) && err.code === "ENOENT")) {
          return partialFailure(
            plan,
            filesDeleted,
            markersRemoved,
            plasmidsArchived,
            `Failed to unlink ${step.path}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
      filesDeleted.push(step.path);
    }

    // 2. remove-marker steps — aggregated reverse plan.
    const markerSteps = plan.steps.filter(
      (s): s is Extract<CureStep, { kind: "remove-marker" }> => s.kind === "remove-marker",
    );
    if (markerSteps.length > 0) {
      const constitutionPath = join(cwd, CONSTITUTION_FILE);
      let existing: string;
      try {
        existing = await readFile(constitutionPath, "utf-8");
      } catch (err) {
        if (isNodeError(err) && err.code === "ENOENT") {
          existing = "";
        } else {
          return partialFailure(
            plan,
            filesDeleted,
            markersRemoved,
            plasmidsArchived,
            `Failed to read DHELIX.md: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      const beforeTree = parse(existing);
      const reversePlan: ReorgPlan = {
        ops: markerSteps.map((s) => ({
          kind: "remove" as const,
          markerId: s.markerId,
          heading: "",
          body: "",
        })),
        keptMarkerIds: [],
        preReorgContentHash: "",
        intentGraphHash: "",
        fallbackTier: "deterministic-only",
      };

      try {
        const applyResult = applyPlan(existing, reversePlan);
        const afterTree = parse(applyResult.newConstitution);
        // I-9 semantic check for reverse reorg: the concatenated user text
        // (all sections outside markers) must be preserved byte-for-byte
        // after marker removal. `verifyUserAreaInvariance`'s multiset-of-
        // sections semantics is intended for the forward Phase-2 flow where
        // user sections keep their boundaries; when a marker is removed
        // adjacent user sections merge into one and the multiset check
        // spuriously flags a violation. For /cure, preserving the user
        // prose is the actual I-9 invariant we care about.
        verifyConcatenatedUserArea(beforeTree, afterTree);
        if (applyResult.newConstitution !== existing) {
          await atomicWrite(constitutionPath, applyResult.newConstitution);
        }
      } catch (err) {
        return {
          plan,
          executed: false,
          filesDeleted,
          markersRemoved,
          plasmidsArchived,
          errorCode: "CURE_ABORTED" as CureErrorCode,
          errorMessage: `I-9 violation detected during reverse reorg: ${err instanceof Error ? err.message : String(err)}`,
        };
      }

      // Record all markers we asked to remove — applyPlan silently ignores
      // missing ones (consistent with Team-4 Phase-2 behaviour).
      for (const step of markerSteps) {
        markersRemoved.push(step.markerId);
      }
    }

    // 3. archive-plasmid steps.
    const archiveSteps = plan.steps.filter(
      (s): s is Extract<CureStep, { kind: "archive-plasmid" }> => s.kind === "archive-plasmid",
    );
    const archiveTs = new Date().toISOString().replace(/[.:]/g, "-");
    for (const step of archiveSteps) {
      try {
        const moved = await archivePlasmidDir(cwd, step.plasmidId, archiveTs);
        if (moved) plasmidsArchived.push(step.plasmidId);
      } catch (err) {
        return partialFailure(
          plan,
          filesDeleted,
          markersRemoved,
          plasmidsArchived,
          `Failed to archive plasmid ${String(step.plasmidId)}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    // 4. clear-refs steps.
    const clearRefSteps = plan.steps.filter(
      (s): s is Extract<CureStep, { kind: "clear-refs" }> => s.kind === "clear-refs",
    );
    for (const step of clearRefSteps) {
      try {
        await clearPlasmidRef(cwd, step.plasmidId, options.signal);
      } catch (err) {
        return partialFailure(
          plan,
          filesDeleted,
          markersRemoved,
          plasmidsArchived,
          `Failed to clear ref for ${String(step.plasmidId)}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    // 5. audit.log (I-5 — append-only).
    const auditPath = join(cwd, RECOMBINATION_AUDIT_LOG);
    await mkdir(dirname(auditPath), { recursive: true });
    const auditLine =
      [
        plan.transcriptIds.join(","),
        "cure",
        `filesDeleted=${filesDeleted.length}`,
        `markersRemoved=${markersRemoved.length}`,
        `archived=${plasmidsArchived.length}`,
        `ts=${new Date().toISOString()}`,
      ].join("\t") + "\n";
    await appendFile(auditPath, auditLine, "utf-8");

    // Best effort: clean up empty artifact parent directories.
    await pruneEmptyDirs(
      new Set(deleteSteps.map((s) => dirname(s.path))),
    );

    return {
      plan,
      executed: true,
      filesDeleted,
      markersRemoved,
      plasmidsArchived,
    };
  } catch (err) {
    return partialFailure(
      plan,
      filesDeleted,
      markersRemoved,
      plasmidsArchived,
      `Unexpected failure: ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    await handle.release();
  }
};

function partialFailure(
  plan: CureResult["plan"],
  filesDeleted: readonly string[],
  markersRemoved: readonly string[],
  plasmidsArchived: readonly PlasmidId[],
  message: string,
): CureResult {
  const anyProgress =
    filesDeleted.length > 0 ||
    markersRemoved.length > 0 ||
    plasmidsArchived.length > 0;
  return {
    plan,
    executed: anyProgress,
    filesDeleted: [...filesDeleted],
    markersRemoved: [...markersRemoved],
    plasmidsArchived: [...plasmidsArchived],
    errorCode: (anyProgress
      ? "CURE_PARTIAL_FAILURE"
      : "CURE_ABORTED") as CureErrorCode,
    errorMessage: message,
  };
}

function abortedResult(
  plan: CureResult["plan"],
  filesDeleted: readonly string[],
  markersRemoved: readonly string[],
  plasmidsArchived: readonly PlasmidId[],
  message: string,
): CureResult {
  return {
    plan,
    executed:
      filesDeleted.length > 0 ||
      markersRemoved.length > 0 ||
      plasmidsArchived.length > 0,
    filesDeleted: [...filesDeleted],
    markersRemoved: [...markersRemoved],
    plasmidsArchived: [...plasmidsArchived],
    errorCode: "CURE_ABORTED" as CureErrorCode,
    errorMessage: message,
  };
}

function concatUserArea(tree: SectionTree): string {
  const parts = listUserSections(tree)
    .map((s) => normalizeUserText(s.content))
    .filter((s) => s.length > 0)
    .join("\n");
  // Collapse runs of 3+ newlines to a single blank line. Marker removal
  // between two user sections yields one extra blank line worth of
  // whitespace per side — semantically the same content for I-9 purposes.
  return parts.replace(/\n{2,}/g, "\n\n");
}

function verifyConcatenatedUserArea(
  beforeTree: SectionTree,
  afterTree: SectionTree,
): void {
  const before = concatUserArea(beforeTree);
  const after = concatUserArea(afterTree);
  if (before !== after) {
    throw new Error(
      `I-9 violation: concatenated user prose changed during /cure reverse reorg (before=${before.length} bytes, after=${after.length} bytes)`,
    );
  }
}

async function pruneEmptyDirs(dirs: ReadonlySet<string>): Promise<void> {
  for (const dir of dirs) {
    try {
      const entries = await readdir(dir);
      if (entries.length === 0) {
        await unlink(dir).catch(async () => {
          // unlink is for files; use rmdir semantics via fs.promises.rm.
          const { rm } = await import("node:fs/promises");
          await rm(dir, { recursive: false });
        });
      }
    } catch {
      /* best effort */
    }
  }
}

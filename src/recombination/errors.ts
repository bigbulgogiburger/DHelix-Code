/**
 * Shared error classes for the recombination module.
 *
 * Every user-observable failure in the 8-stage pipeline surfaces as a
 * {@link RecombinationError} with a stable {@link RecombinationErrorCode}.
 * Callers inspect `.code` to decide whether to rollback / retry / abort.
 *
 * Layer: Core. Imports only `./types.js` and `../plasmids/types.js` (both
 * Leaf-compatible).
 *
 * Invariants
 * - `code` MUST belong to the catalog in PRD §10.3 / `types.ts`
 *   {@link RecombinationErrorCode}.
 * - `context` is a flat `Record<string, unknown>` — never a Node error
 *   object; use `cause` for chained errors (`Error.cause` per ES2022).
 */
import type { PlasmidId } from "../plasmids/types.js";
import type {
  RecombinationErrorCode,
  WiringReport,
} from "./types.js";

/** Base class for every recombination failure surfaced to callers. */
export class RecombinationError extends Error {
  readonly code: RecombinationErrorCode;
  readonly context: Readonly<Record<string, unknown>>;

  constructor(
    code: RecombinationErrorCode,
    message: string,
    context: Record<string, unknown> = {},
    cause?: unknown,
  ) {
    super(message);
    this.name = "RecombinationError";
    this.code = code;
    this.context = { ...context };
    if (cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = cause;
    }
  }
}

/** Concurrent /recombination run is already holding the advisory lock. */
export function lockBusy(pid: number, hostname?: string): RecombinationError {
  return new RecombinationError(
    "RECOMBINATION_LOCK_BUSY",
    `Another /recombination run is active (pid ${pid}${
      hostname !== undefined ? ` on ${hostname}` : ""
    }). Wait or delete .dhelix/recombination/.lock after confirming the owner has exited.`,
    { pid, ...(hostname !== undefined ? { hostname } : {}) },
  );
}

/** Caller aborted via `AbortSignal`. */
export function aborted(stage?: string): RecombinationError {
  return new RecombinationError(
    "RECOMBINATION_ABORTED",
    stage !== undefined
      ? `Recombination aborted during ${stage}.`
      : "Recombination aborted.",
    stage !== undefined ? { stage } : {},
  );
}

/** Interpreter (Stage 2a) could not parse valid JSON after retry budget. */
export function interpreterJsonFailure(
  plasmidId: PlasmidId,
  cause?: unknown,
): RecombinationError {
  return new RecombinationError(
    "INTERPRETER_JSON_FAILURE",
    `Interpreter failed to produce valid JSON for plasmid '${plasmidId}'.`,
    { plasmidId },
    cause,
  );
}

/** Generator (Stage 2b) emitted an artifact that does not conform. */
export function generatorError(
  intentId: string,
  cause?: unknown,
): RecombinationError {
  return new RecombinationError(
    "GENERATOR_ERROR",
    `Generator failed to render artifact for intent '${intentId}'.`,
    { intentId },
    cause,
  );
}

/** Reorganizer would have mutated a user-owned area (outside BEGIN/END). */
export function reorgUserAreaViolation(
  markerId: string,
  cause?: unknown,
): RecombinationError {
  return new RecombinationError(
    "REORG_USER_AREA_VIOLATION",
    `Reorganizer attempted to mutate user-owned area near marker '${markerId}'.`,
    { markerId },
    cause,
  );
}

/** Reorganizer produced an `update` op pointing at a non-existent marker. */
export function reorgInvalidUpdateTarget(markerId: string): RecombinationError {
  return new RecombinationError(
    "REORG_INVALID_UPDATE_TARGET",
    `Reorganizer 'update' op targets unknown marker '${markerId}'.`,
    { markerId },
  );
}

/** Privacy gate refuses to send a `local-only` plasmid to a cloud model. */
export function privacyCloudBlocked(plasmidId: PlasmidId): RecombinationError {
  return new RecombinationError(
    "PRIVACY_CLOUD_BLOCKED",
    `Plasmid '${plasmidId}' is privacy=local-only but the active model is cloud. ` +
      `Switch to a local model or deactivate this plasmid.`,
    { plasmidId },
  );
}

/** Stage-5 validator found one or more ERROR-severity findings. */
export function wiringValidationError(report: WiringReport): RecombinationError {
  return new RecombinationError(
    "WIRING_VALIDATION_ERROR",
    `Stage-5 static wiring validation failed (${report.errorCount} error(s), ${report.warnCount} warning(s)).`,
    {
      errorCount: report.errorCount,
      warnCount: report.warnCount,
      findings: report.findings.map((f) => ({
        checkId: f.checkId,
        severity: f.severity,
        artifactPath: f.artifactPath ?? null,
      })),
    },
  );
}

/** Local LLM endpoint unreachable. */
export function localLlmUnavailable(url: string, cause?: unknown): RecombinationError {
  return new RecombinationError(
    "LOCAL_LLM_UNAVAILABLE",
    `Local LLM endpoint ${url} is unreachable. Start the server or switch models.`,
    { url },
    cause,
  );
}

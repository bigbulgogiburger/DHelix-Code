/**
 * Plasmid Preflight Integration (Layer B + Layer C wiring).
 *
 * Exposes `plasmidHermeticityCheck: PreflightCheck` — a drop-in entry for
 * `DEFAULT_CHECKS` in `src/tools/pipeline/preflight.ts`.
 *
 * Behavior:
 *   1. Extract every path-bearing argument from the incoming tool call
 *      via `extractPathsFromToolCall` (Layer A).
 *   2. For each extracted path, run `isPathBlocked`.
 *   3. On first hit:
 *        - emit a `plasmid.runtime_access_attempt` telemetry event
 *          (Layer C) via `eventBuffer.record(createEvent(...))`
 *        - return `{ allowed: false, reason: "Plasmid internals are
 *          inaccessible at runtime (I-8): <pattern>" }`
 *   4. No hits → `{ allowed: true }`.
 *
 * This check is intentionally Leaf-layer (no `cli/`, no side-I/O beyond
 * telemetry buffer write) and deterministic so that it can be unit-tested
 * without spinning up a tool registry or agent loop.
 *
 * @module plasmids/preflight-integration
 */

import { type PreflightCheck } from "../tools/pipeline/preflight.js";
import {
  createEvent,
  eventBuffer,
  type PlasmidRuntimeAccessAttemptEvent,
} from "../telemetry/events.js";
import { extractPathsFromToolCall, isPathBlocked } from "./runtime-guard.js";

export const plasmidHermeticityCheck: PreflightCheck = {
  name: "plasmid-hermeticity",
  check: async (call, context) => {
    const cwd = context.toolContext.workingDirectory;
    const extracted = extractPathsFromToolCall(
      { name: call.name, arguments: call.arguments as Record<string, unknown> },
      cwd,
    );

    if (extracted.length === 0) {
      return { allowed: true };
    }

    for (const ep of extracted) {
      const match = isPathBlocked(ep.value, cwd);
      if (match) {
        // Layer C — telemetry. Record first, then deny: even if the caller
        // ignores the rejection, the attempt is durably logged.
        eventBuffer.record(
          createEvent<PlasmidRuntimeAccessAttemptEvent>({
            type: "plasmid.runtime_access_attempt",
            toolName: call.name,
            path: match.path,
            argKey: ep.argKey,
            pattern: match.pattern,
            blocked: true,
            layer: "preflight",
            sessionId: context.toolContext.sessionId,
          }),
        );

        return {
          allowed: false,
          reason: `Plasmid internals are inaccessible at runtime (I-8): ${match.pattern}`,
        };
      }
    }

    return { allowed: true };
  },
};

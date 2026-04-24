/**
 * Unit tests — `src/plasmids/preflight-integration.ts`.
 *
 * Verifies Layer B (preflight) + Layer C (telemetry) behavior:
 *   - matching call → `{ allowed: false, reason: "...(I-8)..." }` AND a
 *     `plasmid.runtime_access_attempt` event is written to `eventBuffer`
 *   - non-matching call → `{ allowed: true }` AND no event emitted
 *   - the reason string carries the matched pattern for observability
 */

import { beforeEach, describe, expect, it } from "vitest";
import { plasmidHermeticityCheck } from "../../../src/plasmids/preflight-integration.js";
import {
  eventBuffer,
  type PlasmidRuntimeAccessAttemptEvent,
} from "../../../src/telemetry/events.js";
import { type PreflightContext } from "../../../src/tools/pipeline/preflight.js";
import { ToolRegistry } from "../../../src/tools/registry.js";
import { type ExtractedToolCall } from "../../../src/tools/types.js";

const CWD = "/abs/project";

function makeContext(): PreflightContext {
  return {
    registry: new ToolRegistry(),
    toolContext: {
      workingDirectory: CWD,
      abortSignal: new AbortController().signal,
      timeoutMs: 30_000,
      platform: "darwin",
    },
    enableGuardrails: true,
  };
}

function call(name: string, args: Record<string, unknown>, id = "call-1"): ExtractedToolCall {
  return { id, name, arguments: args };
}

function peekPlasmidEvents(): readonly PlasmidRuntimeAccessAttemptEvent[] {
  return eventBuffer
    .peek()
    .filter(
      (e): e is PlasmidRuntimeAccessAttemptEvent => e.type === "plasmid.runtime_access_attempt",
    );
}

describe("plasmidHermeticityCheck", () => {
  beforeEach(() => {
    // Drain any events recorded by previous tests to keep assertions scoped.
    eventBuffer.flush();
  });

  it("has the expected check name", () => {
    expect(plasmidHermeticityCheck.name).toBe("plasmid-hermeticity");
  });

  it("allows unrelated file_read without emitting any event", async () => {
    const ctx = makeContext();
    const result = await plasmidHermeticityCheck.check(
      call("file_read", { path: "src/index.ts" }),
      ctx,
    );
    expect(result.allowed).toBe(true);
    expect(peekPlasmidEvents().length).toBe(0);
  });

  it("denies file_read pointed at `.dhelix/plasmids/**` and emits telemetry", async () => {
    const ctx = makeContext();
    const result = await plasmidHermeticityCheck.check(
      call("file_read", { path: ".dhelix/plasmids/foo/body.md" }),
      ctx,
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("I-8");
    expect(result.reason).toContain("Plasmid internals");

    const events = peekPlasmidEvents();
    expect(events.length).toBe(1);
    expect(events[0].toolName).toBe("file_read");
    expect(events[0].blocked).toBe(true);
    expect(events[0].layer).toBe("preflight");
    expect(events[0].argKey).toBe("path");
    // Path must be canonical (lower-cased, absolute).
    expect(events[0].path).toContain(".dhelix/plasmids/foo/body.md");
  });

  it("denies bash_exec that cats a plasmid file", async () => {
    const ctx = makeContext();
    const result = await plasmidHermeticityCheck.check(
      call("bash_exec", { command: "cat .dhelix/plasmids/foo/body.md" }),
      ctx,
    );
    expect(result.allowed).toBe(false);

    const events = peekPlasmidEvents();
    expect(events.length).toBe(1);
    expect(events[0].toolName).toBe("bash_exec");
    // Bash argKey should carry the utility suffix.
    expect(events[0].argKey.startsWith("command#cat")).toBe(true);
  });

  it("denies glob_search whose pattern targets plasmids", async () => {
    const ctx = makeContext();
    const result = await plasmidHermeticityCheck.check(
      call("glob_search", { pattern: ".dhelix/plasmids/**" }),
      ctx,
    );
    expect(result.allowed).toBe(false);
    const events = peekPlasmidEvents();
    expect(events.length).toBe(1);
    expect(events[0].toolName).toBe("glob_search");
  });

  it("returns allowed=true for tools without path arguments", async () => {
    const ctx = makeContext();
    const result = await plasmidHermeticityCheck.check(
      call("symbol_search", { query: "foo" }),
      ctx,
    );
    expect(result.allowed).toBe(true);
    expect(peekPlasmidEvents().length).toBe(0);
  });

  it("short-circuits on first hit (does not emit multiple events for one call)", async () => {
    const ctx = makeContext();
    const result = await plasmidHermeticityCheck.check(
      call("batch_file_ops", {
        operations: [
          { op: "read", path: ".dhelix/plasmids/a.md" },
          { op: "read", path: ".dhelix/plasmids/b.md" },
        ],
      }),
      ctx,
    );
    expect(result.allowed).toBe(false);
    // First-hit short-circuit → at most one event for the call.
    expect(peekPlasmidEvents().length).toBe(1);
  });

  it("attaches sessionId to the telemetry event when available", async () => {
    const ctx: PreflightContext = {
      ...makeContext(),
      toolContext: {
        ...makeContext().toolContext,
        sessionId: "sess-42",
      },
    };
    await plasmidHermeticityCheck.check(
      call("file_read", { path: ".dhelix/plasmids/x.md" }),
      ctx,
    );
    const events = peekPlasmidEvents();
    expect(events[0].sessionId).toBe("sess-42");
  });
});

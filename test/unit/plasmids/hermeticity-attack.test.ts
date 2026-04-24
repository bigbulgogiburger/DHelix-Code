/**
 * Attack-surface tests — I-8 hermeticity.
 *
 * Each vector below is the **operational attack** an agent might try to
 * sneak a plasmid body into runtime context through. Every one must:
 *   1. produce `{ allowed: false }` with a reason containing "I-8"
 *   2. record exactly one `plasmid.runtime_access_attempt` event
 *      on `eventBuffer`
 *
 * A failure of any attack case is a security regression — we treat them
 * together rather than split them into "nice-to-have" buckets.
 *
 * Positive negative test (the last block): an unrelated `file_read` on
 * `src/index.ts` MUST be allowed and MUST NOT emit any plasmid event.
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

function call(name: string, args: Record<string, unknown>): ExtractedToolCall {
  return { id: "atk", name, arguments: args };
}

function plasmidEvents(): readonly PlasmidRuntimeAccessAttemptEvent[] {
  return eventBuffer
    .peek()
    .filter(
      (e): e is PlasmidRuntimeAccessAttemptEvent => e.type === "plasmid.runtime_access_attempt",
    );
}

beforeEach(() => {
  // Scope telemetry assertions to each test.
  eventBuffer.flush();
});

interface AttackCase {
  readonly label: string;
  readonly call: ExtractedToolCall;
}

const ATTACKS: readonly AttackCase[] = [
  {
    label: "1. Direct relative path (file_read)",
    call: call("file_read", { path: ".dhelix/plasmids/foo/body.md" }),
  },
  {
    label: "2. Absolute path inside project (file_read)",
    call: call("file_read", { path: "/abs/project/.dhelix/plasmids/foo.md" }),
  },
  {
    label: "3. `..` traversal into project (file_read)",
    call: call("file_read", { path: "../project/.dhelix/plasmids/foo.md" }),
  },
  {
    label: "4. URL-encoded path (file_read)",
    // %2E=., %2F=/  →  .dhelix/plasmids/foo/body.md (after resolve against CWD)
    call: call("file_read", { path: "%2Edhelix%2Fplasmids%2Ffoo%2Fbody.md" }),
  },
  {
    label: "5. Glob wildcard over plasmids (glob_search)",
    call: call("glob_search", { pattern: ".dhelix/plasmids/**" }),
  },
  {
    label: "6. Grep target directory (grep_search)",
    call: call("grep_search", { pattern: "foo", path: ".dhelix/plasmids/" }),
  },
  {
    label: "7. Bash `cat` against plasmid file",
    call: call("bash_exec", { command: "cat .dhelix/plasmids/foo/body.md" }),
  },
  {
    label: "8. Bash `rg` with plasmid dir as target",
    call: call("bash_exec", { command: "rg 'secret' .dhelix/plasmids" }),
  },
  {
    label: "9. Case variation (Darwin case-insensitive)",
    call: call("file_read", { path: ".DHelix/Plasmids/foo.md" }),
  },
  {
    label: "10. Drafts subdirectory (file_read)",
    call: call("file_read", { path: ".dhelix/plasmids/.drafts/foo.md" }),
  },
  {
    label: "11. list_dir against the plasmids root",
    call: call("list_dir", { path: ".dhelix/plasmids" }),
  },
  {
    label: "12. Phase 5 — file_read against governance challenges.log",
    call: call("file_read", { path: ".dhelix/governance/challenges.log" }),
  },
  {
    label: "13. Phase 5 — bash `cat` against overrides.pending.json",
    call: call("bash_exec", { command: "cat .dhelix/governance/overrides.pending.json" }),
  },
  {
    label: "14. Phase 5 — glob over governance subtree",
    call: call("glob_search", { pattern: ".dhelix/governance/**" }),
  },
];

describe("I-8 Hermeticity — attack surface (must block every vector)", () => {
  for (const atk of ATTACKS) {
    it(atk.label, async () => {
      const ctx = makeContext();
      const result = await plasmidHermeticityCheck.check(atk.call, ctx);

      expect(result.allowed, `${atk.label} → expected BLOCKED`).toBe(false);
      expect(result.reason).toBeTruthy();
      expect(result.reason).toContain("I-8");

      const events = plasmidEvents();
      expect(events.length, `${atk.label} → expected exactly 1 telemetry event`).toBe(1);
      expect(events[0].toolName).toBe(atk.call.name);
      expect(events[0].blocked).toBe(true);
      expect(events[0].layer).toBe("preflight");
      expect(events[0].pattern.length).toBeGreaterThan(0);
    });
  }
});

describe("I-8 Hermeticity — positive path (must NOT block)", () => {
  it("allows unrelated source file_read and emits no plasmid event", async () => {
    const ctx = makeContext();
    const result = await plasmidHermeticityCheck.check(
      call("file_read", { path: "src/index.ts" }),
      ctx,
    );
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
    expect(plasmidEvents().length).toBe(0);
  });

  it("allows grep over the project src tree", async () => {
    const ctx = makeContext();
    const result = await plasmidHermeticityCheck.check(
      call("grep_search", { pattern: "TODO", path: "src/" }),
      ctx,
    );
    expect(result.allowed).toBe(true);
    expect(plasmidEvents().length).toBe(0);
  });

  it("allows bash_exec that never touches a plasmid path", async () => {
    const ctx = makeContext();
    const result = await plasmidHermeticityCheck.check(
      call("bash_exec", { command: "npm run typecheck" }),
      ctx,
    );
    expect(result.allowed).toBe(true);
    expect(plasmidEvents().length).toBe(0);
  });

  it("allows other .dhelix subpaths (skills, prompt-sections)", async () => {
    const ctx = makeContext();
    const r1 = await plasmidHermeticityCheck.check(
      call("file_read", { path: ".dhelix/skills/foo.md" }),
      ctx,
    );
    const r2 = await plasmidHermeticityCheck.check(
      call("file_read", { path: ".dhelix/prompt-sections/generated/base.md" }),
      ctx,
    );
    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(plasmidEvents().length).toBe(0);
  });
});

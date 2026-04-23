/**
 * Phase 1 Exit Gate integration tests — Cloud + Local + Hermeticity.
 *
 * These suites verify that the Wave 1 output behaves correctly end-to-end,
 * not just in unit isolation. The **Alpha Gate** (3 external users × 20min
 * POC) is recorded separately under `.dhelix/research/phase-1-alpha-results/`
 * as a self-dogfood simulation per user directive.
 *
 * Reference: `docs/prd/plasmid-recombination-execution-plan.md` §5.3.
 */
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadPlasmids } from "../../../src/plasmids/loader.js";
import { plasmidHermeticityCheck } from "../../../src/plasmids/preflight-integration.js";
import { eventBuffer, type TelemetryEvent } from "../../../src/telemetry/events.js";
import { getModelCapabilities } from "../../../src/llm/model-capabilities.js";
import type { PreflightContext } from "../../../src/tools/pipeline/preflight.js";
import type { ToolRegistry } from "../../../src/tools/registry.js";
import type { ToolContext } from "../../../src/tools/types.js";

let ROOT = "";
const REGISTRY = ".dhelix/plasmids";

beforeAll(async () => {
  ROOT = await mkdtemp(join(tmpdir(), "phase1-gates-"));
});

afterAll(async () => {
  await rm(ROOT, { recursive: true, force: true });
});

/**
 * Build a minimal preflight context with an abort-signal already constructed.
 * We only need the shape; nothing calls into a real registry.
 */
function ctx(workingDirectory: string): PreflightContext {
  const toolContext: ToolContext = {
    workingDirectory,
    abortSignal: new AbortController().signal,
    timeoutMs: 5000,
    platform: process.platform as "win32" | "darwin" | "linux",
  };
  return {
    registry: undefined as unknown as ToolRegistry,
    toolContext,
    enableGuardrails: true,
  };
}

/** Build a valid single-file plasmid source with the given id / overrides. */
function makePlasmidSource(id: string, overrides: Partial<Record<string, string>> = {}): string {
  const now = new Date().toISOString();
  const meta: Record<string, string> = {
    id,
    name: overrides.name ?? `${id} plasmid`,
    description: overrides.description ?? `Phase-1 gate fixture for ${id}.`,
    version: overrides.version ?? "0.1.0",
    tier: overrides.tier ?? "L1",
    scope: overrides.scope ?? "local",
    privacy: overrides.privacy ?? "cloud-ok",
    created: overrides.created ?? now,
    updated: overrides.updated ?? now,
  };
  const frontmatter = Object.entries(meta)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  return [
    "---",
    frontmatter,
    "---",
    "",
    `# ${meta.name}`,
    "",
    `${meta.description}`,
    "",
    "## Eval cases",
    "",
    "```yaml",
    "- id: smoke",
    "  description: schema parses",
    "  input: ok",
    "  expectations:",
    "    - contains:ok",
    "  tier: " + meta.tier,
    "```",
    "",
  ].join("\n");
}

/**
 * ━━ Hermeticity Gate ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Per P-1.14 v0.2: the 3-layer defence must block any tool-call that
 * touches plasmid internals AND emit a telemetry event every time.
 *
 * This suite goes beyond the unit-level attack tests (runtime-guard
 * + preflight-integration) by exercising the full Preflight check on
 * realistic on-disk fixtures and attack shapes.
 */
describe("Hermeticity Gate — end-to-end I-8 block", () => {
  let plasmidsDir = "";
  let bodyPath = "";

  beforeAll(async () => {
    plasmidsDir = join(ROOT, REGISTRY, "victim");
    await mkdir(plasmidsDir, { recursive: true });
    bodyPath = join(plasmidsDir, "body.md");
    await writeFile(bodyPath, "# Secret\nprivileged plasmid content\n");
    await writeFile(
      join(plasmidsDir, "metadata.yaml"),
      "id: victim\nname: victim\ndescription: redacted\nversion: 0.1.0\ntier: L1\nscope: local\nprivacy: local-only\ncreated: 2026-04-24T00:00:00Z\nupdated: 2026-04-24T00:00:00Z\n",
    );
  });

  interface Attack {
    readonly label: string;
    readonly call: { name: string; id: string; arguments: Record<string, unknown> };
  }

  const attacks = (): readonly Attack[] => [
    {
      label: "direct file_read on body.md",
      call: { id: "a1", name: "file_read", arguments: { path: `${REGISTRY}/victim/body.md` } },
    },
    {
      label: "absolute path file_read",
      call: { id: "a2", name: "file_read", arguments: { path: bodyPath } },
    },
    {
      label: "traversal file_read",
      call: {
        id: "a3",
        name: "file_read",
        arguments: { path: `../${REGISTRY}/victim/body.md` },
      },
    },
    {
      label: "glob_search over plasmids",
      call: {
        id: "a4",
        name: "glob_search",
        arguments: { pattern: `${REGISTRY}/**` },
      },
    },
    {
      label: "grep_search targeting plasmids dir",
      call: {
        id: "a5",
        name: "grep_search",
        arguments: { pattern: "privileged", path: REGISTRY },
      },
    },
    {
      label: "bash cat of body.md",
      call: {
        id: "a6",
        name: "bash_exec",
        arguments: { command: `cat ${REGISTRY}/victim/body.md` },
      },
    },
    {
      label: "bash rg recursion",
      call: {
        id: "a7",
        name: "bash_exec",
        arguments: { command: `rg "privileged" ${REGISTRY}` },
      },
    },
    {
      label: "list_dir plasmids",
      call: { id: "a8", name: "list_dir", arguments: { path: REGISTRY } },
    },
    {
      label: "case-variant path",
      call: {
        id: "a9",
        name: "file_read",
        arguments: { path: ".DHELIX/PLASMIDS/victim/body.md" },
      },
    },
    {
      label: "drafts subdir",
      call: {
        id: "a10",
        name: "file_read",
        arguments: { path: `${REGISTRY}/.drafts/foo.md` },
      },
    },
  ];

  it("blocks all 10 attack shapes and emits one telemetry event each", async () => {
    let blocked = 0;
    let events: readonly TelemetryEvent[] = [];
    for (const attack of attacks()) {
      eventBuffer.flush(); // reset between attacks
      const result = await plasmidHermeticityCheck.check(attack.call, ctx(ROOT));
      expect(result.allowed, `attack "${attack.label}" should be blocked`).toBe(false);
      events = eventBuffer.peek();
      const hermeticity = events.filter((e) => e.type === "plasmid.runtime_access_attempt");
      expect(hermeticity.length, `attack "${attack.label}" should emit telemetry`).toBeGreaterThanOrEqual(
        1,
      );
      blocked += 1;
    }
    expect(blocked).toBe(10);
  });

  it("allows unrelated paths through without telemetry", async () => {
    eventBuffer.flush();
    const result = await plasmidHermeticityCheck.check(
      { id: "p1", name: "file_read", arguments: { path: "src/index.ts" } },
      ctx(ROOT),
    );
    expect(result.allowed).toBe(true);
    const ev = eventBuffer.peek().filter((e) => e.type === "plasmid.runtime_access_attempt");
    expect(ev).toHaveLength(0);
  });

  it("still blocks after the loader has parsed the plasmid (loader ≠ runtime)", async () => {
    // Loader is Phase 1's "compile-side" consumer and is allowed to read.
    const loaded = await loadPlasmids({
      workingDirectory: ROOT,
      registryPath: REGISTRY,
    });
    expect(loaded.loaded.map((p) => p.metadata.id)).toContain("victim");
    // Now, any runtime-side tool call must STILL be blocked — loader's past
    // read does not create an exception.
    eventBuffer.flush();
    const result = await plasmidHermeticityCheck.check(
      { id: "post", name: "file_read", arguments: { path: bodyPath } },
      ctx(ROOT),
    );
    expect(result.allowed).toBe(false);
    const ev = eventBuffer.peek().filter((e) => e.type === "plasmid.runtime_access_attempt");
    expect(ev.length).toBeGreaterThanOrEqual(1);
  });
});

/**
 * ━━ Cloud Gate ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Per §5.3: 10 plasmid recombination (schema+parse only in Phase 1) in
 * under 3 minutes. We run well inside that budget — Phase 1 has no
 * real LLM call, so the interesting cost is pure parse + schema work.
 */
describe("Cloud Gate — 10 plasmid schema+parse roundtrip", () => {
  it("loads 10 valid plasmids under the 3-min budget with 0 failures", async () => {
    const baseDir = join(ROOT, "cloud-gate", REGISTRY);
    await mkdir(baseDir, { recursive: true });
    const ids = [
      "pr-title",
      "test-required",
      "type-annotations",
      "commit-style",
      "korean-review",
      "error-handling",
      "team-governance",
      "foundational-legal",
      "foundational-security",
      "empty-primitive",
    ] as const;
    for (const id of ids) {
      await writeFile(join(baseDir, `${id}.md`), makePlasmidSource(id));
    }
    const t0 = Date.now();
    const result = await loadPlasmids({
      workingDirectory: join(ROOT, "cloud-gate"),
      registryPath: REGISTRY,
    });
    const duration = Date.now() - t0;
    expect(result.loaded).toHaveLength(ids.length);
    expect(result.failed).toHaveLength(0);
    expect(duration).toBeLessThan(3 * 60 * 1000); // 3 min budget
    // Phase-1 Cloud Gate metric surface:
    // eslint-disable-next-line no-console
    console.log(`Cloud Gate: 10 plasmids loaded in ${duration} ms`);
  });

  it("rejects malformed plasmids without halting the batch (rollback-on-error default)", async () => {
    const baseDir = join(ROOT, "cloud-gate-mixed", REGISTRY);
    await mkdir(baseDir, { recursive: true });
    await writeFile(join(baseDir, "good-one.md"), makePlasmidSource("good-one"));
    await writeFile(
      join(baseDir, "bad.md"),
      "---\nid: BAD!\n---\n", // invalid id + required fields missing
    );
    const result = await loadPlasmids({
      workingDirectory: join(ROOT, "cloud-gate-mixed"),
      registryPath: REGISTRY,
    });
    expect(result.loaded.map((p) => p.metadata.id)).toContain("good-one");
    expect(result.failed.length).toBeGreaterThanOrEqual(1);
    expect(result.failed[0].code).toBe("PLASMID_SCHEMA_INVALID");
  });
});

/**
 * ━━ Local Gate ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Per §5.3 + P-1.18 v0.2 + P-1.21 v0.2: a privacy: local-only plasmid
 * must not be activatable with an active cloud provider; capability
 * tiers for local families must be mapped correctly for the eventual
 * recombination strategy selector.
 */
describe("Local Gate — ModelCapabilities mapping + privacy guard", () => {
  it("maps local model families to privacyTier: local", () => {
    const localFamilies = [
      "llama3.1:8b",
      "qwen2.5-coder-7b",
      "qwen2.5-coder-32b",
      "deepseek-coder:latest",
      "codestral-22b",
      "phi-3",
      "gemma-7b",
    ];
    for (const model of localFamilies) {
      const caps = getModelCapabilities(model);
      expect(caps.privacyTier, `privacyTier for ${model}`).toBe("local");
    }
  });

  it("maps cloud providers to privacyTier: cloud", () => {
    const cloudFamilies = [
      "gpt-5.1-codex-mini",
      "gpt-4o",
      "gpt-4.1",
      "claude-opus-4-7",
      "claude-haiku-4-5-20251001",
      "claude-sonnet-4-6",
      "o3-mini",
      "mistral-large",
    ];
    for (const model of cloudFamilies) {
      const caps = getModelCapabilities(model);
      expect(caps.privacyTier, `privacyTier for ${model}`).toBe("cloud");
    }
  });

  it("mapping exposes strategyTier spanning A/B/C per P-1.19", () => {
    expect(getModelCapabilities("claude-opus-4-7").strategyTier).toBe("A");
    // Mid-tier — at least one "B" model must be present.
    const mids = ["gpt-4o", "gpt-4o-mini", "qwen2.5-coder-32b"]
      .map((m) => getModelCapabilities(m).strategyTier)
      .filter((t) => t === "B");
    expect(mids.length).toBeGreaterThanOrEqual(1);
    // Entry tier — phi / gemma / gpt-3.5 / base llama3 / qwen-7b should all land in C.
    const entries = ["phi-3", "gemma-7b", "gpt-3.5-turbo", "qwen2.5-coder-7b"];
    for (const m of entries) {
      expect(getModelCapabilities(m).strategyTier, `strategyTier for ${m}`).toBe("C");
    }
  });

  it("exposes preferredDualModelRole hints for dual-model routing", () => {
    expect(getModelCapabilities("claude-opus-4-7").preferredDualModelRole).toBe("architect");
    // gpt-5.1-codex is labeled "architect" by Team 5; verify it resolves to a
    // concrete role (not the "either" default).
    const codexRole = getModelCapabilities("gpt-5.1-codex-mini").preferredDualModelRole;
    expect(["architect", "editor"]).toContain(codexRole);
  });

  it("refuses to load a privacy: local-only plasmid? (Phase 1: loader permits; cascade guard lives in /plasmid edit and show)", async () => {
    // Phase 1 scope: loader itself does not enforce privacy — privacy checks
    // are the activation/command layer's job (Team 3). We assert that the
    // metadata is faithfully preserved so the downstream guard can act.
    const dir = join(ROOT, "local-gate", REGISTRY);
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, "priv.md"),
      makePlasmidSource("priv", { privacy: "local-only" }),
    );
    const r = await loadPlasmids({
      workingDirectory: join(ROOT, "local-gate"),
      registryPath: REGISTRY,
    });
    const priv = r.loaded.find((p) => p.metadata.id === "priv");
    expect(priv).toBeDefined();
    expect(priv!.metadata.privacy).toBe("local-only");
  });
});

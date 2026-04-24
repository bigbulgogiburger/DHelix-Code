/**
 * Phase 5 — Integration tests for the `/plasmid --research` flow.
 *
 * These tests stub Team-2's adapters (`webSearch`/`webFetch`) AND the
 * Team-1 research orchestrator (`runResearch`) directly via deps, so the
 * suite is fully hermetic and does not depend on the actual web tools or
 * on Team 1's `runResearchMode` implementation having landed.
 *
 * Coverage matrix (dev-guide §3):
 *   1. happy path — runResearch returns 3 refs → draft saved + output lists refs
 *   2. privacy gate (provider=local-only, no --force-network)
 *   3. --dry-run — no draft persisted, body in output
 *   4. --from-file — loads existing plasmid metadata, passes currentDraft
 *   5. network-error path — runResearch throws PLASMID_RESEARCH_NETWORK_ERROR
 *   6. --from-file privacy: local-only → blocked even without provider gate
 */
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makePlasmidCommand } from "../../../src/commands/plasmid/index.js";
import type {
  CommandDeps,
  ResearchInput,
  ResearchModeDeps,
  ResearchResult,
  RunResearchFn,
} from "../../../src/commands/plasmid/deps.js";
import { ActivationStore } from "../../../src/plasmids/activation.js";
import { PlasmidError } from "../../../src/plasmids/errors.js";
import type { CommandContext } from "../../../src/commands/registry.js";
import type {
  LoadResult,
  PlasmidId,
  PlasmidMetadata,
  ResearchSource,
} from "../../../src/plasmids/types.js";

let ROOT = "";

beforeEach(async () => {
  ROOT = await mkdtemp(join(tmpdir(), "plasmid-research-"));
});

afterEach(async () => {
  await rm(ROOT, { recursive: true, force: true });
});

function makeContext(): CommandContext {
  return {
    workingDirectory: ROOT,
    model: "stub-model",
    emit: () => undefined,
  };
}

function fakeSource(refs = 3): ResearchSource {
  const refsArr = Array.from({ length: refs }, (_, i) => ({
    url: `https://example.com/article-${i + 1}`,
    title: `Article ${i + 1}`,
    snippet: `Summary of article ${i + 1}`,
    fetchedAt: "2026-04-24T00:00:00.000Z",
    contentSha256: `sha-${i + 1}`,
  }));
  return {
    engine: "web",
    query: "owasp basics",
    references: refsArr,
    researchedAt: "2026-04-24T00:00:00.000Z",
  };
}

function fakeResearchResult(refs = 3): ResearchResult {
  return {
    synthesizedDraft:
      "# OWASP Basics\n\nA short body that cites [1] and [2] inline.",
    metadataPatch: {
      id: "owasp-basics" as PlasmidId,
      name: "OWASP Basics",
      description: "Short summary",
      tier: "L2",
      scope: "local",
      privacy: "cloud-ok",
    },
    sources: fakeSource(refs),
    warnings: [],
  };
}

function makeDeps(overrides: Partial<CommandDeps> = {}): CommandDeps {
  const loadPlasmids = vi.fn(async (): Promise<LoadResult> => ({ loaded: [], failed: [] }));
  const activationStore = new ActivationStore({
    workingDirectory: ROOT,
    registryPath: ".dhelix/plasmids",
  });
  const runResearch: RunResearchFn = vi.fn(async () => fakeResearchResult());
  const webSearch = vi.fn(async () => [
    { url: "https://example.com/a", title: "A" },
    { url: "https://example.com/b", title: "B" },
    { url: "https://example.com/c", title: "C" },
  ]);
  const webFetch = vi.fn(async () => ({ body: "body", contentSha256: "abc" }));
  return {
    loadPlasmids,
    activationStore,
    registryPath: ".dhelix/plasmids",
    draftsPath: ".dhelix/plasmids/.drafts",
    getActiveProviderPrivacyTier: () => "cloud",
    webSearch,
    webFetch,
    runResearch,
    now: () => new Date("2026-04-24T00:00:00.000Z"),
    ...overrides,
  };
}

describe("/plasmid --research — Phase 5 Team 2 integration", () => {
  it("happy path: persists a draft and surfaces references in the output", async () => {
    const deps = makeDeps();
    const cmd = makePlasmidCommand(deps);
    const result = await cmd.execute('--research "owasp basics"', makeContext());

    expect(result.success).toBe(true);
    expect(result.output).toMatch(/Draft saved: owasp-basics/u);
    expect(result.output).toMatch(/refs:\s+3/u);
    expect(result.output).toContain("https://example.com/article-1");
    expect(result.output).toContain("https://example.com/article-3");

    // The draft file actually exists on disk under .dhelix/plasmids/.drafts/
    const draftPath = join(ROOT, ".dhelix/plasmids/.drafts/owasp-basics.md");
    const body = await readFile(draftPath, "utf8");
    expect(body).toMatch(/^---\n/u);
    expect(body).toMatch(/id: owasp-basics/u);
    expect(body).toMatch(/source:/u);
    expect(body).toMatch(/url: https:\/\/example.com\/article-1/u);
    expect(body).toMatch(/# OWASP Basics/u);

    expect(deps.runResearch).toHaveBeenCalledOnce();
    const [input, rdeps] = (deps.runResearch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      ResearchInput,
      ResearchModeDeps,
    ];
    expect(input.intent).toBe("owasp basics");
    expect(rdeps.allowNetwork).toBe(true);
    expect(rdeps.webSearch).toBe(deps.webSearch);
    expect(rdeps.webFetch).toBe(deps.webFetch);
  });

  it("privacy gate: provider tier 'local' without --force-network returns PLASMID_RESEARCH_PRIVACY_BLOCKED", async () => {
    const deps = makeDeps({ getActiveProviderPrivacyTier: () => "local" });
    const cmd = makePlasmidCommand(deps);
    const result = await cmd.execute('--research "owasp basics"', makeContext());

    expect(result.success).toBe(false);
    expect(result.output).toMatch(/PLASMID_RESEARCH_PRIVACY_BLOCKED/u);
    expect(result.output).toMatch(/--force-network/u);
    expect(deps.runResearch).not.toHaveBeenCalled();
  });

  it("--force-network bypasses the provider-level gate", async () => {
    const deps = makeDeps({ getActiveProviderPrivacyTier: () => "local" });
    const cmd = makePlasmidCommand(deps);
    const result = await cmd.execute('--research "owasp basics" --force-network', makeContext());
    expect(result.success).toBe(true);
    expect(deps.runResearch).toHaveBeenCalledOnce();
  });

  it("--dry-run: returns body in output and does NOT persist", async () => {
    const deps = makeDeps();
    const cmd = makePlasmidCommand(deps);
    const result = await cmd.execute('--research "owasp basics" --dry-run', makeContext());

    expect(result.success).toBe(true);
    expect(result.output).toMatch(/dry-run: draft NOT persisted/u);
    expect(result.output).toMatch(/# OWASP Basics/u);

    const draftPath = join(ROOT, ".dhelix/plasmids/.drafts/owasp-basics.md");
    await expect(readFile(draftPath, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("--from-file reads existing plasmid metadata and passes it as currentDraft", async () => {
    // Seed a plasmid file on disk
    const fixturePath = join(ROOT, "fixtures/seed-plasmid.md");
    await mkdir(join(ROOT, "fixtures"), { recursive: true });
    await writeFile(
      fixturePath,
      [
        "---",
        "id: seed-plasmid",
        "name: Seed Plasmid",
        "description: an existing plasmid used as the research seed",
        "version: 0.1.0",
        "tier: L2",
        "scope: local",
        "privacy: cloud-ok",
        "created: 2026-04-01T00:00:00.000Z",
        "updated: 2026-04-01T00:00:00.000Z",
        "---",
        "",
        "# Seed body",
      ].join("\n"),
      "utf8",
    );

    const deps = makeDeps();
    const cmd = makePlasmidCommand(deps);
    const result = await cmd.execute(
      `--research "deepen seed plasmid" --from-file ${fixturePath}`,
      makeContext(),
    );

    expect(result.success).toBe(true);
    const [input] = (deps.runResearch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      ResearchInput,
      ResearchModeDeps,
    ];
    expect(input.currentDraft).toBeDefined();
    const cd = input.currentDraft as Partial<PlasmidMetadata>;
    expect(cd.id).toBe("seed-plasmid");
    expect(cd.privacy).toBe("cloud-ok");
  });

  it("--from-file privacy: local-only triggers PRIVACY_BLOCKED even without provider gate", async () => {
    const fixturePath = join(ROOT, "fixtures/local-only.md");
    await mkdir(join(ROOT, "fixtures"), { recursive: true });
    await writeFile(
      fixturePath,
      [
        "---",
        "id: secret-plasmid",
        "name: Secret",
        "description: privacy local-only — must not leak via research",
        "version: 0.1.0",
        "tier: L2",
        "scope: local",
        "privacy: local-only",
        "created: 2026-04-01T00:00:00.000Z",
        "updated: 2026-04-01T00:00:00.000Z",
        "---",
        "",
        "# Secret",
      ].join("\n"),
      "utf8",
    );

    const deps = makeDeps({ getActiveProviderPrivacyTier: () => "cloud" });
    const cmd = makePlasmidCommand(deps);
    const result = await cmd.execute(
      `--research "should fail" --from-file ${fixturePath}`,
      makeContext(),
    );

    expect(result.success).toBe(false);
    expect(result.output).toMatch(/PLASMID_RESEARCH_PRIVACY_BLOCKED/u);
    expect(result.output).toMatch(/local-only/u);
    expect(deps.runResearch).not.toHaveBeenCalled();
  });

  it("network-error path: runResearch throws PLASMID_RESEARCH_NETWORK_ERROR → success=false", async () => {
    const runResearch: RunResearchFn = vi.fn(async () => {
      throw new PlasmidError(
        "all fetches failed",
        "PLASMID_RESEARCH_NETWORK_ERROR",
        { failed: 3 },
      );
    });
    const deps = makeDeps({ runResearch });
    const cmd = makePlasmidCommand(deps);
    const result = await cmd.execute('--research "anything"', makeContext());
    expect(result.success).toBe(false);
    expect(result.output).toMatch(/PLASMID_RESEARCH_NETWORK_ERROR/u);
  });

  it("supports the `research` keyword form equivalently", async () => {
    const deps = makeDeps();
    const cmd = makePlasmidCommand(deps);
    const result = await cmd.execute('research "owasp basics"', makeContext());
    expect(result.success).toBe(true);
    expect(deps.runResearch).toHaveBeenCalledOnce();
  });

  it("missing runResearch dep returns a clear error rather than crashing", async () => {
    const deps = makeDeps({ runResearch: undefined });
    const cmd = makePlasmidCommand(deps);
    const result = await cmd.execute('--research "x"', makeContext());
    expect(result.success).toBe(false);
    expect(result.output).toMatch(/runResearchMode/u);
  });
});

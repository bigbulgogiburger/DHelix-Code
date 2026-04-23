/**
 * Integration test — `/recombination --dry-run` against a realistic
 * plasmid tree on disk. Peer dependencies (interpret/generate/compress/
 * reorganize) are stubbed so the test never contacts an LLM, but the
 * executor runs its full orchestration path (lock, loader, privacy
 * gate, transcript) end-to-end.
 *
 * Success criteria:
 *   - applied === false
 *   - a transcript JSON lands under .dhelix/recombination/transcripts/
 *   - NO artifact files are written outside .dhelix/recombination/
 *   - the audit log gets one 'ok' entry
 */
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { executeRecombination } from "../../../src/recombination/executor.js";
import type {
  CompressFn,
  CompressionOutput,
  ExecutorDeps,
  GenerateFn,
  GenerateResult,
  GeneratedArtifact,
  InterpretFn,
  InterpretResult,
  LLMCompletionFn,
  RecombinationOptions,
  ReorganizeFn,
  ReorgPlan,
} from "../../../src/recombination/types.js";
import type {
  PlasmidFingerprint,
  PlasmidId,
  PlasmidMetadata,
} from "../../../src/plasmids/types.js";

let workdir: string;

async function seedPlasmid(
  root: string,
  id: string,
  privacy: PlasmidMetadata["privacy"] = "cloud-ok",
): Promise<void> {
  const dir = join(root, ".dhelix/plasmids", id);
  await mkdir(dir, { recursive: true });
  const metadataYaml = [
    `id: ${id}`,
    `name: ${id}`,
    `description: "E2E plasmid ${id}"`,
    `version: 0.1.0`,
    `tier: L2`,
    `scope: local`,
    `privacy: ${privacy}`,
    `created: 2026-04-01T00:00:00Z`,
    `updated: 2026-04-01T00:00:00Z`,
  ].join("\n");
  await writeFile(join(dir, "metadata.yaml"), metadataYaml, "utf-8");
  await writeFile(
    join(dir, "body.md"),
    "# Intent\nProvide a testable rule.\n",
    "utf-8",
  );
}

async function seedActivation(root: string, ids: readonly string[]): Promise<void> {
  const stateDir = join(root, ".dhelix/plasmids/.state");
  await mkdir(stateDir, { recursive: true });
  await writeFile(
    join(stateDir, "active.json"),
    JSON.stringify({
      activePlasmidIds: ids,
      updatedAt: new Date().toISOString(),
    }),
    "utf-8",
  );
}

function stubbedDeps(): ExecutorDeps {
  const interpret: InterpretFn = vi.fn<
    (...args: Parameters<InterpretFn>) => Promise<InterpretResult>
  >(async (req) => {
    const meta = req.plasmid.metadata;
    return {
      ir: {
        plasmidId: meta.id,
        plasmidVersion: meta.version,
        metadata: meta,
        bodyFingerprint: req.plasmid.bodyFingerprint as PlasmidFingerprint,
        summary: `summary for ${meta.id}`,
        intents: [],
        tier: meta.tier,
        interpretedAt: "2026-04-01T00:00:00Z",
        strategyUsed: req.strategy,
        cacheKey: `k-${meta.id}`,
      },
      cacheHit: false,
      warnings: [],
    };
  });

  // Generate one artifact per plasmid (into .dhelix/rules/<id>.md).
  const generate: GenerateFn = vi.fn<
    (...args: Parameters<GenerateFn>) => Promise<GenerateResult>
  >(async (req) => {
    const artifacts: GeneratedArtifact[] = req.irs.map((ir) => ({
      kind: "rule",
      sourcePlasmid: ir.plasmidId,
      sourceIntentId: `${ir.plasmidId}-root`,
      targetPath: join(req.workingDirectory, ".dhelix/rules", `${ir.plasmidId}.md`),
      contents: `---\nname: ${ir.plasmidId}\ndescription: rule body\n---\n\n# ${ir.plasmidId}\n`,
      contentHash: `hash-${ir.plasmidId}`,
      templateLayer: "primitives",
      templateId: "primitives/rule.basic",
    }));
    return { artifacts, warnings: [] };
  });

  const compress: CompressFn = vi.fn<
    (...args: Parameters<CompressFn>) => Promise<CompressionOutput>
  >(async () => ({
    summaries: [],
    sections: [],
    projectProfileMarkdown: "",
    totalTokenEstimate: 0,
    budgetTokens: 1500,
    droppedPlasmidIds: [] as readonly PlasmidId[],
  }));

  const reorganize: ReorganizeFn = vi.fn<
    (...args: Parameters<ReorganizeFn>) => Promise<ReorgPlan>
  >(async () => ({
    ops: [],
    keptMarkerIds: [],
    preReorgContentHash: "pre",
    intentGraphHash: "graph",
    fallbackTier: "llm-only",
  }));

  const llm: LLMCompletionFn = vi.fn<
    (...args: Parameters<LLMCompletionFn>) => ReturnType<LLMCompletionFn>
  >(async () => "unused");

  return { interpret, generate, compress, reorganize, llm };
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

beforeEach(async () => {
  workdir = await mkdtemp(join(tmpdir(), "dhelix-dry-"));
});

afterEach(async () => {
  await rm(workdir, { recursive: true, force: true });
});

describe("integration: /recombination --dry-run", () => {
  it("produces a transcript with applied=false and writes no files outside .dhelix/recombination/", async () => {
    await seedPlasmid(workdir, "alpha");
    await seedActivation(workdir, ["alpha"]);

    const opts: RecombinationOptions = {
      workingDirectory: workdir,
      registryPath: ".dhelix/plasmids",
      mode: "dry-run",
    };

    const result = await executeRecombination(opts, stubbedDeps());
    expect(result.applied).toBe(false);
    expect(result.transcript.mode).toBe("dry-run");
    expect(result.transcript.activePlasmidIds).toEqual(["alpha"]);

    // Transcript JSON should be on disk.
    const transcriptsDir = join(workdir, ".dhelix/recombination/transcripts");
    const entries = await readdir(transcriptsDir);
    expect(entries.some((name) => name.endsWith(".json"))).toBe(true);

    // Audit log updated.
    const audit = await readFile(
      join(workdir, ".dhelix/recombination/audit.log"),
      "utf-8",
    );
    expect(audit).toContain("mode=dry-run");
    expect(audit).toContain("status=ok");

    // Generated artifact should NOT be written.
    expect(await exists(join(workdir, ".dhelix/rules/alpha.md"))).toBe(false);

    // Constitution (DHELIX.md) should NOT be created.
    expect(await exists(join(workdir, "DHELIX.md"))).toBe(false);

    // Lock should be cleaned up.
    expect(await exists(join(workdir, ".dhelix/recombination/.lock"))).toBe(false);
  });

  it("still persists a transcript and lets the lock release on abort", async () => {
    await seedPlasmid(workdir, "omega");
    await seedActivation(workdir, ["omega"]);

    const ac = new AbortController();
    ac.abort();

    const opts: RecombinationOptions = {
      workingDirectory: workdir,
      registryPath: ".dhelix/plasmids",
      mode: "dry-run",
      signal: ac.signal,
    };

    await expect(executeRecombination(opts, stubbedDeps())).rejects.toThrow();
    // Lock file cleaned up by finally.
    expect(await exists(join(workdir, ".dhelix/recombination/.lock"))).toBe(false);
  });
});

describe("integration: /recombination extend (Stage 4 real write path)", () => {
  it(
    "writes DHELIX.md with team-4 marker grammar, 40-project-profile.md path, " +
      "and transcript.reorgMarkerIds matching applyPlan output",
    async () => {
      await seedPlasmid(workdir, "alpha");
      await seedActivation(workdir, ["alpha"]);

      // Seed an existing DHELIX.md with user content so verifyUserAreaInvariance
      // has a meaningful baseline to check after Stage 4c.
      const originalUserText = "# Project Principles\n\nUser-owned content.\n";
      await writeFile(join(workdir, "DHELIX.md"), originalUserText, "utf-8");

      const reorganize: ReorganizeFn = vi.fn<
        (...args: Parameters<ReorganizeFn>) => Promise<ReorgPlan>
      >(async () => ({
        ops: [
          {
            kind: "insert",
            markerId: "alpha/security-gate",
            heading: "Security Gate",
            body: "Enforce the OWASP top-10 baseline on every PR.",
            sourcePlasmid: "alpha" as PlasmidId,
          },
        ],
        keptMarkerIds: [],
        preReorgContentHash: "pre",
        intentGraphHash: "graph",
        fallbackTier: "llm-only",
      }));

      const compress: CompressFn = vi.fn<
        (...args: Parameters<CompressFn>) => Promise<CompressionOutput>
      >(async () => ({
        summaries: [],
        sections: [],
        projectProfileMarkdown: "# Project Profile\n\nGenerated profile body.\n",
        totalTokenEstimate: 42,
        budgetTokens: 1500,
        droppedPlasmidIds: [] as readonly PlasmidId[],
      }));

      const base = stubbedDeps();
      const deps = { ...base, reorganize, compress };

      const opts: RecombinationOptions = {
        workingDirectory: workdir,
        registryPath: ".dhelix/plasmids",
        mode: "extend",
        approvalMode: "auto",
        staticValidation: "warn-only",
      };

      const result = await executeRecombination(opts, deps);
      expect(result.applied).toBe(true);

      // DHELIX.md now carries the team-4 marker grammar (not the legacy
      // `PLASMID-BEGIN` form the executor used before the fix).
      const writtenConstitution = await readFile(
        join(workdir, "DHELIX.md"),
        "utf-8",
      );
      expect(writtenConstitution).toContain(
        "<!-- BEGIN plasmid-derived: alpha/security-gate -->",
      );
      expect(writtenConstitution).toContain(
        "<!-- END plasmid-derived: alpha/security-gate -->",
      );
      expect(writtenConstitution).not.toContain("PLASMID-BEGIN");

      // User-owned area preserved byte-for-byte (I-9).
      expect(writtenConstitution).toContain(originalUserText.trim());

      // Project profile lands at the PRD §7.1 canonical path (40-*, not 90-*).
      expect(
        await exists(
          join(workdir, ".dhelix/prompt-sections/generated/40-project-profile.md"),
        ),
      ).toBe(true);
      expect(
        await exists(
          join(workdir, ".dhelix/prompt-sections/generated/90-project-profile.md"),
        ),
      ).toBe(false);

      // Transcript records the marker ids *actually* written (insert ops),
      // not the unused `keptMarkerIds` field.
      expect(result.transcript.reorgMarkerIds).toEqual(["alpha/security-gate"]);
    },
  );
});

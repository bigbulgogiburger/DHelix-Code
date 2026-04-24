/**
 * Tests for `/plasmid challenge` — Phase 5 GAL-1 Team 4.
 *
 * Covers:
 *   - 6 validation gates (each rejection path)
 *   - Happy override (entry appended, override queued)
 *   - Happy amend (mock $EDITOR, both hashes recorded)
 *   - Revoke move-to-archive + dependents handling
 *   - Cooldown blocks 2nd amend
 *   - Override does not start cooldown for amend
 *   - Idempotent override re-queue
 */
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { challengeSubcommand } from "../../../../src/commands/plasmid/challenge.js";
import type {
  AppendChallengeFn,
  CheckCooldownFn,
  CommandDeps,
  OverridesPendingStore,
  ReadChallengesLogFn,
} from "../../../../src/commands/plasmid/deps.js";
import { ActivationStore } from "../../../../src/plasmids/activation.js";
import type {
  ChallengeLogEntry,
  CooldownDecision,
  LoadedPlasmid,
  OverridePending,
  PlasmidId,
  PlasmidMetadata,
} from "../../../../src/plasmids/types.js";
import { OVERRIDE_PENDING_PATH } from "../../../../src/plasmids/types.js";
import type { CommandContext } from "../../../../src/commands/registry.js";

// ─── Test fixtures ─────────────────────────────────────────────────────────

function meta(overrides: Partial<PlasmidMetadata> = {}): PlasmidMetadata {
  const id = (overrides.id ?? "core-values") as PlasmidId;
  return {
    id,
    name: overrides.name ?? String(id),
    description: overrides.description ?? "test foundational",
    version: overrides.version ?? "1.0.0",
    tier: overrides.tier ?? "L4",
    scope: overrides.scope ?? "local",
    privacy: overrides.privacy ?? "cloud-ok",
    created: overrides.created ?? "2026-04-01T00:00:00Z",
    updated: overrides.updated ?? "2026-04-01T00:00:00Z",
    foundational: overrides.foundational,
    ...(overrides.requires !== undefined ? { requires: overrides.requires } : {}),
    ...(overrides.conflicts !== undefined ? { conflicts: overrides.conflicts } : {}),
    ...(overrides.extends !== undefined ? { extends: overrides.extends } : {}),
    ...(overrides.challengeable !== undefined
      ? { challengeable: overrides.challengeable }
      : {}),
  };
}

function loaded(
  metadata: PlasmidMetadata,
  bodyPath: string,
  overrides: Partial<LoadedPlasmid> = {},
): LoadedPlasmid {
  return {
    metadata,
    body: overrides.body ?? "# Body",
    bodyFingerprint:
      overrides.bodyFingerprint ??
      ("a".repeat(64) as LoadedPlasmid["bodyFingerprint"]),
    evalCases: overrides.evalCases ?? [],
    sourcePath: bodyPath,
    metadataPath: overrides.metadataPath ?? bodyPath,
    scopeOrigin: overrides.scopeOrigin ?? metadata.scope,
  };
}

function makeContext(workingDirectory: string): CommandContext {
  return {
    workingDirectory,
    model: "test-model",
    sessionId: "s1",
    emit: () => {},
  };
}

interface InMemoryGovernance {
  readonly entries: ChallengeLogEntry[];
  readonly pending: OverridePending[];
  readonly appendChallenge: AppendChallengeFn;
  readonly readChallengesLog: ReadChallengesLogFn;
  readonly checkCooldown: CheckCooldownFn;
  readonly overridesPending: OverridesPendingStore;
}

function makeGovernance(
  opts: { readonly cooldownDecision?: () => CooldownDecision } = {},
): InMemoryGovernance {
  const entries: ChallengeLogEntry[] = [];
  const pending: OverridePending[] = [];

  const appendChallenge: AppendChallengeFn = async (e) => {
    entries.push(e);
  };
  const readChallengesLog: ReadChallengesLogFn = async () => entries.slice();
  const checkCooldown: CheckCooldownFn = ({ action, log }) => {
    if (opts.cooldownDecision) return opts.cooldownDecision();
    if (action === "override") return { ok: true };
    // Default: block when there's a prior amend/revoke for the same plasmid.
    const prior = log.find(
      (e) => e.action === "amend" || e.action === "revoke",
    );
    if (!prior) return { ok: true };
    const waitUntil = new Date(Date.now() + 60 * 60 * 1000);
    return {
      ok: false,
      waitUntil,
      remainingMs: waitUntil.getTime() - Date.now(),
    };
  };
  const overridesPending: OverridesPendingStore = {
    enqueue: async (plasmidId, rationale) => {
      const entry: OverridePending = {
        plasmidId,
        queuedAt: new Date().toISOString(),
        rationaleSha256: `sha-${rationale.length}-${pending.length}`,
      };
      pending.push(entry);
      return entry;
    },
    peek: async () => pending.slice(),
    path: (wd) => (wd ? join(wd, OVERRIDE_PENDING_PATH) : OVERRIDE_PENDING_PATH),
  };
  return {
    entries,
    pending,
    appendChallenge,
    readChallengesLog,
    checkCooldown,
    overridesPending,
  };
}

interface BuiltDeps {
  readonly deps: CommandDeps;
  readonly governance: InMemoryGovernance;
  readonly workingDirectory: string;
  readonly cleanup: () => Promise<void>;
  readonly mkLoaded: (m: PlasmidMetadata, body?: string) => Promise<LoadedPlasmid>;
}

interface BuildOpts {
  readonly initial?: readonly { metadata: PlasmidMetadata; body?: string }[];
  readonly cooldownDecision?: () => CooldownDecision;
  readonly editorCommand?: string;
}

async function buildDeps(opts: BuildOpts = {}): Promise<BuiltDeps> {
  const workingDirectory = await mkdtemp(join(tmpdir(), "dhelix-challenge-"));
  const registryPath = ".dhelix/plasmids";
  await mkdir(join(workingDirectory, registryPath), { recursive: true });

  const governance = makeGovernance({
    ...(opts.cooldownDecision ? { cooldownDecision: opts.cooldownDecision } : {}),
  });

  const allLoaded: LoadedPlasmid[] = [];

  const mkLoaded = async (
    m: PlasmidMetadata,
    body = `# ${m.id}\n\nbody.\n`,
  ): Promise<LoadedPlasmid> => {
    const bodyDir = join(workingDirectory, registryPath, m.id);
    await mkdir(bodyDir, { recursive: true });
    const bodyPath = join(bodyDir, "body.md");
    await writeFile(bodyPath, body, { encoding: "utf8" });
    const lp = loaded(m, bodyPath);
    allLoaded.push(lp);
    return lp;
  };

  if (opts.initial) {
    for (const seed of opts.initial) {
      await mkLoaded(seed.metadata, seed.body);
    }
  }

  const deps: CommandDeps = {
    loadPlasmids: async () => ({ loaded: allLoaded.slice(), failed: [] }),
    activationStore: new ActivationStore({ workingDirectory, registryPath }),
    registryPath,
    appendChallenge: governance.appendChallenge,
    readChallengesLog: governance.readChallengesLog,
    checkCooldown: governance.checkCooldown,
    overridesPending: governance.overridesPending,
    ...(opts.editorCommand ? { editorCommand: opts.editorCommand } : {}),
  };

  return {
    deps,
    governance,
    workingDirectory,
    mkLoaded,
    cleanup: async () => rm(workingDirectory, { recursive: true, force: true }),
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

const LONG_RATIONALE =
  "This is a sufficiently long rationale that exceeds the 50 character minimum default for foundational challenges.";

describe("/plasmid challenge — validation gates", () => {
  let cleanups: Array<() => Promise<void>> = [];
  afterEach(async () => {
    for (const fn of cleanups) await fn();
    cleanups = [];
  });

  it("Gate 1: missing id → usage hint", async () => {
    const fx = await buildDeps();
    cleanups.push(fx.cleanup);
    const r = await challengeSubcommand(
      [],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(r.success).toBe(false);
    expect(r.output).toContain("Missing argument");
  });

  it("Gate 1: unknown id → PLASMID_NOT_FOUND", async () => {
    const fx = await buildDeps();
    cleanups.push(fx.cleanup);
    const r = await challengeSubcommand(
      ["ghost", "--action", "override", "--rationale", LONG_RATIONALE],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(r.success).toBe(false);
    expect(r.output).toContain("PLASMID_NOT_FOUND");
  });

  it("Gate 2: non-foundational → PLASMID_CHALLENGE_NOT_FOUNDATIONAL", async () => {
    const fx = await buildDeps({
      initial: [{ metadata: meta({ id: "tactical" as PlasmidId, foundational: false }) }],
    });
    cleanups.push(fx.cleanup);
    const r = await challengeSubcommand(
      ["tactical", "--action", "override", "--rationale", LONG_RATIONALE],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(r.success).toBe(false);
    expect(r.output).toContain("PLASMID_CHALLENGE_NOT_FOUNDATIONAL");
  });

  it("Gate 3: invalid --action value → parse error", async () => {
    const fx = await buildDeps({
      initial: [{ metadata: meta({ foundational: true }) }],
    });
    cleanups.push(fx.cleanup);
    const r = await challengeSubcommand(
      ["core-values", "--action", "delete", "--rationale", LONG_RATIONALE],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(r.success).toBe(false);
    expect(r.output).toContain("Invalid --action 'delete'");
  });

  it("Gate 4: rationale too short → PLASMID_CHALLENGE_JUSTIFICATION_TOO_SHORT", async () => {
    const fx = await buildDeps({
      initial: [{ metadata: meta({ foundational: true }) }],
    });
    cleanups.push(fx.cleanup);
    const r = await challengeSubcommand(
      ["core-values", "--action", "override", "--rationale", "too short"],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(r.success).toBe(false);
    expect(r.output).toContain("PLASMID_CHALLENGE_JUSTIFICATION_TOO_SHORT");
  });

  it("Gate 4: rationale length uses metadata.challengeable override", async () => {
    const fx = await buildDeps({
      initial: [
        {
          metadata: meta({
            foundational: true,
            challengeable: {
              "require-justification": true,
              "min-justification-length": 200,
              "audit-log": true,
              "require-cooldown": "24h",
              "require-team-consensus": false,
              "min-approvers": 1,
            },
          }),
        },
      ],
    });
    cleanups.push(fx.cleanup);
    const r = await challengeSubcommand(
      ["core-values", "--action", "override", "--rationale", LONG_RATIONALE],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(r.success).toBe(false);
    expect(r.output).toContain("≥ 200 chars");
  });

  it("Gate 5: amend blocked by cooldown → PLASMID_CHALLENGE_COOLDOWN", async () => {
    const fx = await buildDeps({
      initial: [{ metadata: meta({ foundational: true }) }],
      // Always block.
      cooldownDecision: () => ({
        ok: false,
        waitUntil: new Date(Date.now() + 3600_000),
        remainingMs: 3600_000,
      }),
      editorCommand: "true",
    });
    cleanups.push(fx.cleanup);
    const r = await challengeSubcommand(
      ["core-values", "--action", "amend", "--rationale", LONG_RATIONALE],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(r.success).toBe(false);
    expect(r.output).toContain("PLASMID_CHALLENGE_COOLDOWN");
  });

  it("Gate 5: --yes does NOT bypass amend cooldown", async () => {
    const fx = await buildDeps({
      initial: [{ metadata: meta({ foundational: true }) }],
      cooldownDecision: () => ({
        ok: false,
        waitUntil: new Date(Date.now() + 3600_000),
        remainingMs: 3600_000,
      }),
      editorCommand: "true",
    });
    cleanups.push(fx.cleanup);
    const r = await challengeSubcommand(
      ["core-values", "--action", "amend", "--rationale", LONG_RATIONALE, "--yes"],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(r.success).toBe(false);
    expect(r.output).toContain("PLASMID_CHALLENGE_COOLDOWN");
  });

  it("Gate 6: revoke without --confirm REVOKE <id> verbatim → refusal", async () => {
    const fx = await buildDeps({
      initial: [{ metadata: meta({ foundational: true }) }],
    });
    cleanups.push(fx.cleanup);
    const r = await challengeSubcommand(
      [
        "core-values",
        "--action",
        "revoke",
        "--rationale",
        LONG_RATIONALE,
        "--dependents",
        "orphan",
      ],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(r.success).toBe(false);
    expect(r.output).toContain('REVOKE core-values');
  });

  it("Gate 7: revoke without --dependents → refusal hint", async () => {
    const fx = await buildDeps({
      initial: [{ metadata: meta({ foundational: true }) }],
    });
    cleanups.push(fx.cleanup);
    const r = await challengeSubcommand(
      [
        "core-values",
        "--action",
        "revoke",
        "--rationale",
        LONG_RATIONALE,
        "--confirm",
        "REVOKE",
        "core-values",
      ],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(r.success).toBe(false);
    expect(r.output).toContain("--dependents");
  });
});

describe("/plasmid challenge — preview", () => {
  let cleanups: Array<() => Promise<void>> = [];
  afterEach(async () => {
    for (const fn of cleanups) await fn();
    cleanups = [];
  });

  it("no --action shows ceremony + dependents", async () => {
    const fx = await buildDeps({
      initial: [
        { metadata: meta({ foundational: true }) },
        {
          metadata: meta({
            id: "child-rule" as PlasmidId,
            foundational: false,
            extends: "core-values" as PlasmidId,
          }),
        },
      ],
    });
    cleanups.push(fx.cleanup);
    const r = await challengeSubcommand(
      ["core-values"],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(r.success).toBe(true);
    expect(r.output).toContain("Foundational plasmid");
    expect(r.output).toContain("Dependents (1)");
    expect(r.output).toContain("child-rule");
    expect(r.output).toContain("Override queue path");
  });
});

describe("/plasmid challenge — happy paths", () => {
  let cleanups: Array<() => Promise<void>> = [];
  beforeEach(() => {
    vi.stubEnv("EDITOR", "true");
  });
  afterEach(async () => {
    for (const fn of cleanups) await fn();
    cleanups = [];
    vi.unstubAllEnvs();
  });

  it("override appends entry + queues pending + surfaces queue path", async () => {
    const fx = await buildDeps({
      initial: [{ metadata: meta({ foundational: true }) }],
    });
    cleanups.push(fx.cleanup);
    const r = await challengeSubcommand(
      ["core-values", "--action", "override", "--rationale", LONG_RATIONALE],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(r.success).toBe(true);
    expect(r.output).toContain("Override queued");
    expect(r.output).toContain(OVERRIDE_PENDING_PATH);
    expect(fx.governance.entries).toHaveLength(1);
    expect(fx.governance.entries[0]?.action).toBe("override");
    expect(fx.governance.pending).toHaveLength(1);
  });

  it("amend opens editor, re-reads body, appends entry with both hashes", async () => {
    // Use a small shell script that appends a line to body.md so newHash != previousHash
    const fx = await buildDeps({
      initial: [{ metadata: meta({ foundational: true }) }],
    });
    cleanups.push(fx.cleanup);

    // Create a stub editor script that mutates the file
    const stubDir = await mkdtemp(join(tmpdir(), "dhelix-edit-"));
    const stubPath = join(stubDir, "fake-editor.sh");
    await writeFile(
      stubPath,
      `#!/bin/sh\necho "appended" >> "$1"\n`,
      { encoding: "utf8", mode: 0o755 },
    );
    cleanups.push(async () => rm(stubDir, { recursive: true, force: true }));

    const deps: CommandDeps = { ...fx.deps, editorCommand: stubPath };
    const r = await challengeSubcommand(
      ["core-values", "--action", "amend", "--rationale", LONG_RATIONALE],
      makeContext(fx.workingDirectory),
      deps,
    );
    expect(r.success).toBe(true);
    expect(r.output).toContain("Amended");

    const entries = fx.governance.entries;
    expect(entries).toHaveLength(1);
    const e = entries[0];
    expect(e?.action).toBe("amend");
    expect(e?.previousHash).toBeDefined();
    expect(e?.newHash).toBeDefined();
    expect(e?.previousHash).not.toEqual(e?.newHash);
  });

  it("amend aborts with no log entry when editor exits non-zero", async () => {
    const fx = await buildDeps({
      initial: [{ metadata: meta({ foundational: true }) }],
      editorCommand: "false",
    });
    cleanups.push(fx.cleanup);
    const r = await challengeSubcommand(
      ["core-values", "--action", "amend", "--rationale", LONG_RATIONALE],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(r.success).toBe(false);
    expect(r.output).toContain("Editor exited");
    expect(fx.governance.entries).toHaveLength(0);
  });

  it("revoke moves file to archive, appends entry with dependentsAction=orphaned", async () => {
    const fx = await buildDeps({
      initial: [
        { metadata: meta({ foundational: true }) },
        {
          metadata: meta({
            id: "dep-a" as PlasmidId,
            extends: "core-values" as PlasmidId,
          }),
        },
        {
          metadata: meta({
            id: "dep-b" as PlasmidId,
            requires: ["core-values" as PlasmidId],
          }),
        },
        {
          metadata: meta({
            id: "dep-c" as PlasmidId,
            conflicts: ["core-values" as PlasmidId],
          }),
        },
      ],
    });
    cleanups.push(fx.cleanup);

    const sourcePath = join(
      fx.workingDirectory,
      ".dhelix/plasmids/core-values/body.md",
    );
    const r = await challengeSubcommand(
      [
        "core-values",
        "--action",
        "revoke",
        "--rationale",
        LONG_RATIONALE,
        "--dependents",
        "orphan",
        "--confirm",
        "REVOKE",
        "core-values",
      ],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(r.success).toBe(true);
    expect(r.output).toContain("Revoked");
    expect(r.output).toContain("dependents: 3");
    expect(r.output).toContain("dep-a");
    expect(r.output).toContain("dep-b");
    expect(r.output).toContain("dep-c");

    // Source file moved
    await expect(readFile(sourcePath)).rejects.toBeDefined();

    // Entry recorded
    const entries = fx.governance.entries;
    expect(entries).toHaveLength(1);
    expect(entries[0]?.action).toBe("revoke");
    expect(entries[0]?.dependentsAction).toBe("orphaned");

    // Archive directory exists with the file
    const archiveDir = join(fx.workingDirectory, ".dhelix/plasmids/archive");
    const { readdir } = await import("node:fs/promises");
    const contents = await readdir(archiveDir);
    expect(contents.some((f) => f.startsWith("core-values-"))).toBe(true);

    // Activation store no longer references the revoked id (orphan mode
    // intentionally leaves dependents alone so the user can audit them).
    const after = await fx.deps.activationStore.read();
    expect(after.activePlasmidIds).not.toContain("core-values" as PlasmidId);
    // Dependents in orphan mode are NOT auto-deactivated.
    // (No assertion about dep-a/b/c here — they may or may not be active
    // depending on test prelude, but they MUST NOT be auto-removed.)
  });

  it("revoke with --dependents revoke cascades deactivation to dependents", async () => {
    const fx = await buildDeps({
      initial: [
        { metadata: meta({ foundational: true }) },
        {
          metadata: meta({
            id: "dep-a" as PlasmidId,
            extends: "core-values" as PlasmidId,
          }),
        },
      ],
    });
    cleanups.push(fx.cleanup);
    // Pre-activate so we can observe the cascade.
    await fx.deps.activationStore.activate([
      "core-values" as PlasmidId,
      "dep-a" as PlasmidId,
    ]);

    const r = await challengeSubcommand(
      [
        "core-values",
        "--action",
        "revoke",
        "--rationale",
        LONG_RATIONALE,
        "--dependents",
        "revoke",
        "--confirm",
        "REVOKE",
        "core-values",
      ],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(r.success).toBe(true);

    const after = await fx.deps.activationStore.read();
    expect(after.activePlasmidIds).not.toContain("core-values" as PlasmidId);
    expect(after.activePlasmidIds).not.toContain("dep-a" as PlasmidId);
  });
});

describe("/plasmid challenge — cooldown semantics", () => {
  let cleanups: Array<() => Promise<void>> = [];
  beforeEach(() => {
    vi.stubEnv("EDITOR", "true");
  });
  afterEach(async () => {
    for (const fn of cleanups) await fn();
    cleanups = [];
    vi.unstubAllEnvs();
  });

  it("2nd amend after 1st is blocked by default cooldown semantics", async () => {
    const fx = await buildDeps({
      initial: [{ metadata: meta({ foundational: true }) }],
      editorCommand: "true",
    });
    cleanups.push(fx.cleanup);

    // 1st amend — fresh, allowed
    const r1 = await challengeSubcommand(
      ["core-values", "--action", "amend", "--rationale", LONG_RATIONALE],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(r1.success).toBe(true);

    // 2nd amend — now blocked because the in-memory cooldown sees a prior amend
    const r2 = await challengeSubcommand(
      ["core-values", "--action", "amend", "--rationale", LONG_RATIONALE],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(r2.success).toBe(false);
    expect(r2.output).toContain("PLASMID_CHALLENGE_COOLDOWN");
  });

  it("override does not start cooldown — subsequent amend still passes", async () => {
    const fx = await buildDeps({
      initial: [{ metadata: meta({ foundational: true }) }],
      editorCommand: "true",
    });
    cleanups.push(fx.cleanup);

    const r1 = await challengeSubcommand(
      ["core-values", "--action", "override", "--rationale", LONG_RATIONALE],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(r1.success).toBe(true);

    // amend should pass — the in-memory cooldown only blocks when a prior
    // amend/revoke exists. Override entries do not start a cooldown.
    const r2 = await challengeSubcommand(
      ["core-values", "--action", "amend", "--rationale", LONG_RATIONALE],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(r2.success).toBe(true);
  });

  it("idempotent override: 2nd identical override request appends another entry", async () => {
    const fx = await buildDeps({
      initial: [{ metadata: meta({ foundational: true }) }],
    });
    cleanups.push(fx.cleanup);

    for (let i = 0; i < 2; i++) {
      const r = await challengeSubcommand(
        ["core-values", "--action", "override", "--rationale", LONG_RATIONALE],
        makeContext(fx.workingDirectory),
        fx.deps,
      );
      expect(r.success).toBe(true);
    }
    expect(fx.governance.entries).toHaveLength(2);
    expect(fx.governance.pending).toHaveLength(2);
  });
});

describe("/plasmid challenge — governance not wired", () => {
  let cleanups: Array<() => Promise<void>> = [];
  afterEach(async () => {
    for (const fn of cleanups) await fn();
    cleanups = [];
  });

  it("override without governance deps → graceful error", async () => {
    const workingDirectory = await mkdtemp(join(tmpdir(), "dhelix-nogov-"));
    cleanups.push(async () => rm(workingDirectory, { recursive: true, force: true }));
    const registryPath = ".dhelix/plasmids";
    const m = meta({ foundational: true });
    const allLoaded: LoadedPlasmid[] = [
      loaded(m, join(workingDirectory, registryPath, m.id, "body.md")),
    ];
    await mkdir(dirname(allLoaded[0]!.sourcePath), { recursive: true });
    await writeFile(allLoaded[0]!.sourcePath, "# body\n");

    const deps: CommandDeps = {
      loadPlasmids: async () => ({ loaded: allLoaded, failed: [] }),
      activationStore: new ActivationStore({ workingDirectory, registryPath }),
      registryPath,
    };
    const r = await challengeSubcommand(
      ["core-values", "--action", "override", "--rationale", LONG_RATIONALE],
      makeContext(workingDirectory),
      deps,
    );
    expect(r.success).toBe(false);
    expect(r.output).toContain("governance subsystem not wired");
  });
});

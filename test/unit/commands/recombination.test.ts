/**
 * Unit tests for `src/commands/recombination/{index,extend,deps}.ts`.
 *
 * We wire a fake CommandDeps whose `execute` just echoes back a canned
 * result — we are testing CLI parsing + dispatching, not the pipeline.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeRecombinationCommand } from "../../../src/commands/recombination/index.js";
import type { CommandDeps } from "../../../src/commands/recombination/deps.js";
import type { CommandContext } from "../../../src/commands/registry.js";
import type {
  CompressFn,
  ExecuteRecombinationFn,
  GenerateFn,
  GenerateResult,
  CompressionOutput,
  InterpretFn,
  InterpretResult,
  LLMCompletionFn,
  ReorganizeFn,
  ReorgPlan,
  RecombinationOptions,
  RecombinationResult,
  RecombinationTranscript,
} from "../../../src/recombination/types.js";
import type { PlasmidId } from "../../../src/plasmids/types.js";
import { RecombinationError } from "../../../src/recombination/errors.js";

function makeContext(): CommandContext {
  return {
    workingDirectory: "/tmp/project",
    model: "gpt-4o",
    sessionId: "sess-1",
    emit: () => {},
  };
}

function fakeTranscript(): RecombinationTranscript {
  return {
    id: "fake-id",
    startedAt: "2026-04-24T12:00:00.000Z",
    finishedAt: "2026-04-24T12:00:05.000Z",
    mode: "extend",
    model: "gpt-4o",
    strategies: {
      interpreter: "single-pass",
      compression: "abstractive",
      reorgFallback: "llm-only",
      validationVolume: "standard",
      validationParallelism: 10,
      gradingTiers: ["deterministic", "semi", "llm"],
      passThresholds: { L1: 0.95, L2: 0.8, L3: 0.7, L4: 0.6 },
      projectProfile: "full-llm",
      artifactGeneration: "template-and-llm",
      interpreterRetries: 1,
    },
    activePlasmidIds: [] as readonly PlasmidId[],
    stages: [
      {
        stage: 0,
        name: "preflight",
        startedAt: "2026-04-24T12:00:00.000Z",
        finishedAt: "2026-04-24T12:00:00.010Z",
        status: "ok",
        durationMs: 10,
      },
    ],
    writtenFiles: [],
    reorgMarkerIds: [],
    wiring: { findings: [], errorCount: 0, warnCount: 0, infoCount: 0, passed: true },
    cacheHits: 0,
    cacheMisses: 0,
  };
}

function emptyCompression(): CompressionOutput {
  return {
    summaries: [],
    sections: [],
    projectProfileMarkdown: "",
    totalTokenEstimate: 0,
    budgetTokens: 1500,
    droppedPlasmidIds: [],
  };
}

function okReorg(): ReorgPlan {
  return {
    ops: [],
    keptMarkerIds: [],
    preReorgContentHash: "pre",
    intentGraphHash: "graph",
    fallbackTier: "llm-only",
  };
}

interface FakeDeps {
  readonly deps: CommandDeps;
  readonly executeSpy: ReturnType<typeof vi.fn>;
}

function fakeDeps(
  opts: {
    readonly result?: Partial<RecombinationResult>;
    readonly error?: unknown;
  } = {},
): FakeDeps {
  const executeSpy = vi.fn<
    (...args: Parameters<ExecuteRecombinationFn>) => ReturnType<ExecuteRecombinationFn>
  >(async () => {
    if (opts.error !== undefined) throw opts.error;
    const transcript = fakeTranscript();
    return {
      transcript,
      plan: {
        artifacts: [],
        compression: emptyCompression(),
        reorg: okReorg(),
      },
      applied: opts.result?.applied ?? true,
      ...(opts.result ?? {}),
    };
  });

  const interpret: InterpretFn = vi.fn<
    (...args: Parameters<InterpretFn>) => Promise<InterpretResult>
  >();
  const generate: GenerateFn = vi.fn<
    (...args: Parameters<GenerateFn>) => Promise<GenerateResult>
  >();
  const compress: CompressFn = vi.fn<
    (...args: Parameters<CompressFn>) => Promise<CompressionOutput>
  >();
  const reorganize: ReorganizeFn = vi.fn<
    (...args: Parameters<ReorganizeFn>) => Promise<ReorgPlan>
  >();
  const llm: LLMCompletionFn = vi.fn<
    (...args: Parameters<LLMCompletionFn>) => ReturnType<LLMCompletionFn>
  >(async () => "");

  const deps: CommandDeps = {
    loadPlasmids: vi.fn(async () => ({ loaded: [], failed: [] })),
    readActivation: vi.fn(async () => new Set<PlasmidId>()),
    llm,
    interpret,
    generate,
    compress,
    reorganize,
    execute: executeSpy as unknown as ExecuteRecombinationFn,
    registryPath: ".dhelix/plasmids",
    model: "gpt-4o",
  };
  return { deps, executeSpy };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("/recombination command — dispatch", () => {
  it("exposes the expected name / description / usage metadata", () => {
    const { deps } = fakeDeps();
    const cmd = makeRecombinationCommand(deps);
    expect(cmd.name).toBe("recombination");
    expect(cmd.description.toLowerCase()).toContain("recombine");
    expect(cmd.usage).toContain("--mode");
    expect(cmd.usage).toContain("--plasmid");
  });

  it("defaults to extend mode when invoked with no arguments", async () => {
    const { deps, executeSpy } = fakeDeps();
    const cmd = makeRecombinationCommand(deps);
    const result = await cmd.execute("", makeContext());
    expect(result.success).toBe(true);
    expect(executeSpy).toHaveBeenCalledTimes(1);
    const opts = executeSpy.mock.calls[0]![0] as RecombinationOptions;
    expect(opts.mode).toBe("extend");
    expect(opts.workingDirectory).toBe("/tmp/project");
    expect(opts.staticValidation).toBe("strict");
  });

  it("sets mode=dry-run when --dry-run flag is provided", async () => {
    const { deps, executeSpy } = fakeDeps({ result: { applied: false } });
    const cmd = makeRecombinationCommand(deps);
    const result = await cmd.execute("--dry-run", makeContext());
    expect(result.success).toBe(true); // dry-run is success even when not applied
    const opts = executeSpy.mock.calls[0]![0] as RecombinationOptions;
    expect(opts.mode).toBe("dry-run");
  });

  it("parses --mode <value> and --plasmid <id>", async () => {
    const { deps, executeSpy } = fakeDeps();
    const cmd = makeRecombinationCommand(deps);
    await cmd.execute("--mode extend --plasmid alpha", makeContext());
    const opts = executeSpy.mock.calls[0]![0] as RecombinationOptions;
    expect(opts.mode).toBe("extend");
    expect(opts.plasmidId).toBe("alpha");
  });

  it("parses --model=<value> equals-form", async () => {
    const { deps, executeSpy } = fakeDeps();
    const cmd = makeRecombinationCommand(deps);
    await cmd.execute("--model=gpt-4o-mini", makeContext());
    const opts = executeSpy.mock.calls[0]![0] as RecombinationOptions;
    expect(opts.modelOverride).toBe("gpt-4o-mini");
  });

  it("parses --static-validation=warn-only override", async () => {
    const { deps, executeSpy } = fakeDeps();
    const cmd = makeRecombinationCommand(deps);
    await cmd.execute("--static-validation=warn-only", makeContext());
    const opts = executeSpy.mock.calls[0]![0] as RecombinationOptions;
    expect(opts.staticValidation).toBe("warn-only");
  });

  it("returns a graceful 'not yet implemented' error for mode=rebuild", async () => {
    const { deps, executeSpy } = fakeDeps();
    const cmd = makeRecombinationCommand(deps);
    const result = await cmd.execute("--mode rebuild", makeContext());
    expect(result.success).toBe(false);
    expect(result.output.toLowerCase()).toContain("not yet implemented");
    expect(executeSpy).not.toHaveBeenCalled();
  });

  it("reports an error when --mode has no value", async () => {
    const { deps } = fakeDeps();
    const cmd = makeRecombinationCommand(deps);
    const result = await cmd.execute("--mode", makeContext());
    expect(result.success).toBe(false);
    expect(result.output).toContain("--mode requires a value");
  });

  it("reports an error for an unknown mode value", async () => {
    const { deps } = fakeDeps();
    const cmd = makeRecombinationCommand(deps);
    const result = await cmd.execute("--mode wat", makeContext());
    expect(result.success).toBe(false);
    expect(result.output).toContain("Unknown --mode");
  });

  it("reports an error when --validate=<profile> is unknown", async () => {
    const { deps } = fakeDeps();
    const cmd = makeRecombinationCommand(deps);
    const result = await cmd.execute("--validate=nope", makeContext());
    expect(result.success).toBe(false);
    expect(result.output).toContain("Unknown --validate profile");
  });

  it("reports an error for an unknown flag", async () => {
    const { deps } = fakeDeps();
    const cmd = makeRecombinationCommand(deps);
    const result = await cmd.execute("--blorp", makeContext());
    expect(result.success).toBe(false);
    expect(result.output).toContain("Unknown flag");
  });

  it("surfaces RecombinationError code in output when execute throws", async () => {
    const err = new RecombinationError(
      "PRIVACY_CLOUD_BLOCKED",
      "blocked",
      { plasmidId: "secret" },
    );
    const { deps } = fakeDeps({ error: err });
    const cmd = makeRecombinationCommand(deps);
    const result = await cmd.execute("", makeContext());
    expect(result.success).toBe(false);
    expect(result.output).toContain("PRIVACY_CLOUD_BLOCKED");
  });

  it("accepts a CommandDeps factory function (DI entry point for live deps)", async () => {
    const { deps } = fakeDeps();
    let factoryCalls = 0;
    const cmd = makeRecombinationCommand(() => {
      factoryCalls += 1;
      return deps;
    });
    await cmd.execute("", makeContext());
    await cmd.execute("--dry-run", makeContext());
    expect(factoryCalls).toBe(2);
  });
});

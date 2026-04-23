/**
 * `/recombination` dependency-injection seam — mirror of
 * `commands/plasmid/deps.ts` but wires the 4 peer team modules
 * (interpreter, generators, compression, reorganizer).
 *
 * The peer imports in {@link defaultDeps} fail until Team 1–4 merge
 * because those directories don't exist yet in this worktree; the
 * executor's tests use injection so nothing breaks. We keep the
 * dangling imports guarded with `// @ts-expect-error` so the file
 * compiles standalone.
 */
import {
  ActivationStore,
  type ActivationStoreOptions,
} from "../../plasmids/activation.js";
import {
  loadPlasmids as realLoadPlasmids,
  type LoaderOptions as RealLoaderOptions,
} from "../../plasmids/loader.js";
import type { LoadResult, PlasmidId } from "../../plasmids/types.js";
import { createDefaultLLM } from "../../recombination/llm-adapter.js";
import type {
  CompressFn,
  ExecuteRecombinationFn,
  GenerateFn,
  InterpretFn,
  LLMCompletionFn,
  ReorganizeFn,
} from "../../recombination/types.js";
import { executeRecombination } from "../../recombination/executor.js";

export type LoadPlasmidsFn = (opts: RealLoaderOptions) => Promise<LoadResult>;

/** Everything the /recombination subcommands need from the outside world. */
export interface CommandDeps {
  readonly loadPlasmids: LoadPlasmidsFn;
  readonly readActivation: () => Promise<ReadonlySet<PlasmidId>>;
  readonly llm: LLMCompletionFn;
  readonly interpret: InterpretFn;
  readonly generate: GenerateFn;
  readonly compress: CompressFn;
  readonly reorganize: ReorganizeFn;
  readonly execute: ExecuteRecombinationFn;
  readonly registryPath: string;
  readonly model: string;
  readonly now?: () => Date;
}

/** Activation helper — wraps ActivationStore in a `Promise<Set>` façade. */
export function makeReadActivation(
  opts: ActivationStoreOptions,
): () => Promise<ReadonlySet<PlasmidId>> {
  const store = new ActivationStore(opts);
  return async () => {
    const state = await store.read();
    return new Set<PlasmidId>(state.activePlasmidIds);
  };
}

/**
 * Production deps factory. Imports from the peer team modules fail until
 * their worktrees merge — we silence the TS error with `@ts-expect-error`
 * so this worktree still compiles. Remove the suppressions after merge.
 */
export function defaultDeps(workingDirectory: string, model?: string): CommandDeps {
  const registryPath = ".dhelix/plasmids";
  const modelId = model ?? process.env.DHELIX_MODEL ?? "gpt-4o";

  const baseURL = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
  const apiKeyFromEnv = process.env.OPENAI_API_KEY;
  const apiKeyHeaderFromEnv = process.env.OPENAI_API_KEY_HEADER;
  const llm: LLMCompletionFn = createDefaultLLM({
    model: modelId,
    baseURL,
    ...(apiKeyFromEnv !== undefined ? { apiKey: apiKeyFromEnv } : {}),
    ...(apiKeyHeaderFromEnv !== undefined ? { apiKeyHeader: apiKeyHeaderFromEnv } : {}),
  });

  // Lazy peer-team dispatchers. Until team-1..team-4 land, the dynamic
  // import resolves at call time and throws a helpful error — the
  // executor's deps are wired via injection in tests, so this path only
  // runs in production after merge. Remove the lazy wrappers when the
  // teams have merged and replace with direct top-level imports.
  const interpret: InterpretFn = async (req) =>
    (await loadPeer<{ interpret: InterpretFn }>("team-1 interpreter", "interpreter")).interpret(
      req,
    );
  const generate: GenerateFn = async (req) =>
    (await loadPeer<{ generate: GenerateFn }>("team-2 generators", "generators")).generate(req);
  const compress: CompressFn = async (req) =>
    (await loadPeer<{ compress: CompressFn }>("team-3 compression", "compression")).compress(
      req,
    );
  const reorganize: ReorganizeFn = async (req) =>
    (
      await loadPeer<{ reorganize: ReorganizeFn }>("team-4 constitution", "constitution")
    ).reorganize(req);

  return {
    loadPlasmids: realLoadPlasmids,
    readActivation: makeReadActivation({ workingDirectory, registryPath }),
    llm,
    interpret,
    generate,
    compress,
    reorganize,
    execute: executeRecombination,
    registryPath,
    model: modelId,
    now: () => new Date(),
  };
}

/**
 * Dynamically import a peer-team module by name. Until the team branches
 * merge the target folder does not exist — we surface a helpful error
 * instead of crashing at module load time.
 */
async function loadPeer<T>(label: string, folder: string): Promise<T> {
  try {
    const mod = (await import(`../../recombination/${folder}/index.js`)) as T;
    return mod;
  } catch (err) {
    throw new Error(
      `${label} module is not available yet. ` +
        `This /recombination run requires the team merge to have landed. ` +
        `(cause: ${err instanceof Error ? err.message : String(err)})`,
    );
  }
}

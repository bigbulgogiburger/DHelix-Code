import type {
  PlasmidFingerprint,
  PlasmidId,
  PlasmidMetadata,
  PlasmidTier,
} from "../../../../src/plasmids/types.js";
import type {
  CompiledPlasmidIR,
  IntentKind,
  PlasmidIntentNode,
} from "../../../../src/recombination/types.js";

interface IntentOverrides {
  readonly id?: string;
  readonly kind?: IntentKind;
  readonly title?: string;
  readonly description?: string;
  readonly constraints?: readonly string[];
  readonly evidence?: readonly string[];
  readonly params?: Readonly<Record<string, unknown>>;
}

export function makeIntent(
  sourcePlasmid: string,
  overrides: IntentOverrides = {},
): PlasmidIntentNode {
  return {
    id: overrides.id ?? `${sourcePlasmid}-intent-1`,
    sourcePlasmid: sourcePlasmid as PlasmidId,
    kind: overrides.kind ?? "rule",
    title: overrides.title ?? "Do the thing",
    description:
      overrides.description ??
      "Concise description of the intent covering the expected behavioural rule.",
    constraints: overrides.constraints ?? [],
    evidence: overrides.evidence ?? [],
    params: overrides.params ?? {},
  };
}

interface IRBuilderOptions {
  readonly id?: string;
  readonly tier?: PlasmidTier;
  readonly description?: string;
  readonly summary?: string;
  readonly intents?: readonly PlasmidIntentNode[];
  readonly scope?: PlasmidMetadata["scope"];
  readonly bodyFingerprint?: string;
  readonly cacheKey?: string;
}

export function makeIR(opts: IRBuilderOptions = {}): CompiledPlasmidIR {
  const id = (opts.id ?? "demo-plasmid") as PlasmidId;
  const now = "2026-04-24T00:00:00.000Z";
  const metadata: PlasmidMetadata = {
    id,
    name: opts.id ?? "demo-plasmid",
    description:
      opts.description ??
      "Demo plasmid for unit tests covering the compression pipeline.",
    version: "1.0.0",
    tier: opts.tier ?? "L2",
    scope: opts.scope ?? "local",
    privacy: "cloud-ok",
    created: now,
    updated: now,
  };
  // Derive per-id default fingerprint / cache key so separate IRs in a test
  // do not accidentally share cache slots.
  const defaultFingerprint = fingerprintFor(id);
  return {
    plasmidId: id,
    plasmidVersion: "1.0.0",
    metadata,
    bodyFingerprint: (opts.bodyFingerprint ??
      defaultFingerprint) as PlasmidFingerprint,
    summary:
      opts.summary ??
      "Interpreter summary describing WHY this plasmid exists in one sentence.",
    intents: opts.intents ?? [makeIntent(id)],
    tier: opts.tier ?? "L2",
    interpretedAt: now,
    strategyUsed: "single-pass",
    cacheKey: opts.cacheKey ?? `cache-key-${id}`,
  };
}

/** Synthesize a 64-char hex-ish string keyed off the plasmid id. */
function fingerprintFor(id: string): string {
  const base = id.replace(/[^0-9a-f]/giu, "");
  const seed = (base + "0123456789abcdef").slice(0, 8);
  return seed.repeat(8).slice(0, 64);
}

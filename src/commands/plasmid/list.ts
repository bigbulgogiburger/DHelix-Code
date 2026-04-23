/**
 * `/plasmid list` — tabular index of registered plasmids.
 *
 * Flags
 * - `--tier <L1|L2|L3|L4>`   filter by tier
 * - `--scope <scope>`         filter by scope origin
 * - `--active`                only rows currently active
 *
 * Output is an ASCII table. The empty registry case returns a short
 * "no plasmids loaded" message and `success: true` — listing nothing is
 * not a failure.
 */
import type { CommandContext, CommandResult } from "../registry.js";
import type { LoadedPlasmid, PlasmidScope, PlasmidTier } from "../../plasmids/types.js";
import type { CommandDeps } from "./deps.js";

interface Filters {
  readonly tier?: PlasmidTier;
  readonly scope?: PlasmidScope;
  readonly onlyActive: boolean;
}

const TIERS: readonly PlasmidTier[] = ["L1", "L2", "L3", "L4"];
const SCOPES: readonly PlasmidScope[] = ["local", "shared", "ephemeral", "team"];

export async function listSubcommand(
  args: readonly string[],
  context: CommandContext,
  deps: CommandDeps,
): Promise<CommandResult> {
  const parsed = parseFilters(args);
  if ("error" in parsed) {
    return { output: parsed.error, success: false };
  }

  const [loadResult, activation] = await Promise.all([
    deps.loadPlasmids({
      workingDirectory: context.workingDirectory,
      registryPath: deps.registryPath,
      sharedRegistryPath: deps.sharedRegistryPath,
      draftsPath: deps.draftsPath,
      scopes: deps.scopes,
    }),
    deps.activationStore.read(),
  ]);

  const activeSet = new Set<string>(activation.activePlasmidIds);
  const rows = loadResult.loaded
    .filter((p) => matches(p, parsed.filters, activeSet))
    .map((p) => ({
      id: p.metadata.id,
      name: p.metadata.name,
      tier: p.metadata.tier,
      scope: p.scopeOrigin,
      privacy: p.metadata.privacy,
      active: activeSet.has(p.metadata.id) ? "yes" : "no",
    }));

  if (rows.length === 0) {
    const hint =
      loadResult.loaded.length === 0
        ? "No plasmids loaded from the configured registry."
        : "No plasmids matched the supplied filters.";
    const failureTail =
      loadResult.failed.length > 0
        ? `\n\n${loadResult.failed.length} plasmid(s) failed to load. Use \`/plasmid validate\` for details.`
        : "";
    return { output: hint + failureTail, success: true };
  }

  const header = { id: "id", name: "name", tier: "tier", scope: "scope", privacy: "privacy", active: "active" };
  const table = formatTable([header, ...rows]);
  const failureTail =
    loadResult.failed.length > 0
      ? `\n\n${loadResult.failed.length} plasmid(s) failed to load. Use \`/plasmid validate\` for details.`
      : "";
  return { output: table + failureTail, success: true };
}

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

function parseFilters(args: readonly string[]): { filters: Filters } | { error: string } {
  let tier: PlasmidTier | undefined;
  let scope: PlasmidScope | undefined;
  let onlyActive = false;

  for (let i = 0; i < args.length; i++) {
    const tok = args[i];
    if (tok === "--active") {
      onlyActive = true;
      continue;
    }
    if (tok === "--tier") {
      const v = args[++i];
      if (!v || !isTier(v)) {
        return { error: `Invalid --tier value. Expected one of ${TIERS.join(", ")}.` };
      }
      tier = v;
      continue;
    }
    if (tok === "--scope") {
      const v = args[++i];
      if (!v || !isScope(v)) {
        return { error: `Invalid --scope value. Expected one of ${SCOPES.join(", ")}.` };
      }
      scope = v;
      continue;
    }
    return { error: `Unknown flag: ${tok}. Usage: /plasmid list [--tier <L1..L4>] [--scope <scope>] [--active]` };
  }

  return { filters: { tier, scope, onlyActive } };
}

function matches(p: LoadedPlasmid, f: Filters, activeSet: ReadonlySet<string>): boolean {
  if (f.tier !== undefined && p.metadata.tier !== f.tier) return false;
  if (f.scope !== undefined && p.scopeOrigin !== f.scope) return false;
  if (f.onlyActive && !activeSet.has(p.metadata.id)) return false;
  return true;
}

function isTier(s: string): s is PlasmidTier {
  return (TIERS as readonly string[]).includes(s);
}

function isScope(s: string): s is PlasmidScope {
  return (SCOPES as readonly string[]).includes(s);
}

interface Row {
  readonly id: string;
  readonly name: string;
  readonly tier: string;
  readonly scope: string;
  readonly privacy: string;
  readonly active: string;
}

function formatTable(rows: readonly Row[]): string {
  const cols: (keyof Row)[] = ["id", "name", "tier", "scope", "privacy", "active"];
  const widths = cols.map((c) => Math.max(...rows.map((r) => r[c].length)));
  const pad = (s: string, w: number): string => s + " ".repeat(Math.max(0, w - s.length));
  const line = (r: Row): string =>
    cols.map((c, i) => pad(r[c], widths[i] ?? 0)).join("  ");
  const separator = widths.map((w) => "-".repeat(w)).join("  ");
  const [header, ...body] = rows;
  if (!header) return "";
  return [line(header), separator, ...body.map(line)].join("\n");
}

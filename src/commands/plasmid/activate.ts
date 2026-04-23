/**
 * `/plasmid activate <id> [<id>...]`
 *
 * Refuses when:
 * - any id is not found in the loader result,
 * - the union `extends` graph across {already-active ∪ requested} has a
 *   cycle (DFS via {@link detectExtendsCycle}),
 * - the metadata `conflicts` of any active / requested plasmid
 *   intersects with the other side of the union.
 *
 * On success, persists the new state via the injected
 * `ActivationStore#activate`.
 */
import type { CommandContext, CommandResult } from "../registry.js";
import type { LoadedPlasmid, PlasmidId } from "../../plasmids/types.js";
import {
  asPlasmidId,
  detectExtendsCycle,
  intersectIds,
} from "../../plasmids/activation.js";
import type { CommandDeps } from "./deps.js";

export async function activateSubcommand(
  args: readonly string[],
  context: CommandContext,
  deps: CommandDeps,
): Promise<CommandResult> {
  if (args.length === 0) {
    return {
      output: "Missing argument: <id>. Usage: /plasmid activate <id> [<id>...]",
      success: false,
    };
  }

  const requestedIds = args.map(asPlasmidId);

  const [{ loaded }, current] = await Promise.all([
    deps.loadPlasmids({
      workingDirectory: context.workingDirectory,
      registryPath: deps.registryPath,
      sharedRegistryPath: deps.sharedRegistryPath,
      draftsPath: deps.draftsPath,
      scopes: deps.scopes,
    }),
    deps.activationStore.read(),
  ]);

  const byId = new Map<string, LoadedPlasmid>(
    loaded.map((p) => [p.metadata.id, p]),
  );

  // 1) all requested must exist
  const missing = requestedIds.filter((id) => !byId.has(id));
  if (missing.length > 0) {
    return {
      output: `Plasmid not found: ${missing.join(", ")}`,
      success: false,
    };
  }

  // 2) cycle detection over `extends` in the union graph
  const graphIds = new Set<PlasmidId>([
    ...current.activePlasmidIds,
    ...requestedIds,
  ]);
  const graph = new Map<PlasmidId, PlasmidId | undefined>();
  for (const id of graphIds) {
    const plas = byId.get(id);
    graph.set(id, plas?.metadata.extends);
  }
  // Include parents that aren't themselves in the active set, so the
  // cycle detector sees the full chain.
  for (const plas of byId.values()) {
    if (plas.metadata.extends && !graph.has(plas.metadata.extends)) {
      graph.set(plas.metadata.extends, byId.get(plas.metadata.extends)?.metadata.extends);
    }
  }
  const cycle = detectExtendsCycle(graph);
  if (cycle) {
    return {
      output: `Refusing to activate: 'extends' chain contains a cycle (${cycle.join(" -> ")}).`,
      success: false,
    };
  }

  // 3) conflicts
  const conflictReports = collectConflicts(current.activePlasmidIds, requestedIds, byId);
  if (conflictReports.length > 0) {
    return {
      output: [
        "Refusing to activate: 'conflicts' metadata overlap with currently-active plasmids.",
        ...conflictReports.map((r) => `  - ${r}`),
      ].join("\n"),
      success: false,
    };
  }

  const next = await deps.activationStore.activate(requestedIds);
  return {
    output: [
      `Activated: ${requestedIds.join(", ")}`,
      `Active plasmids: ${next.activePlasmidIds.length}`,
    ].join("\n"),
    success: true,
  };
}

/**
 * Compute `conflicts` overlaps across both directions:
 *   - a newly-requested plasmid declares a conflict with an active one
 *   - an active plasmid declares a conflict with a newly-requested one
 */
function collectConflicts(
  active: readonly PlasmidId[],
  requested: readonly PlasmidId[],
  byId: ReadonlyMap<string, LoadedPlasmid>,
): readonly string[] {
  const reports: string[] = [];
  const activeSet: readonly PlasmidId[] = active;

  for (const id of requested) {
    const plas = byId.get(id);
    const declared = plas?.metadata.conflicts ?? [];
    const overlap = intersectIds(declared, activeSet);
    for (const o of overlap) {
      reports.push(`${id} conflicts with active '${o}'`);
    }
  }
  for (const id of active) {
    const plas = byId.get(id);
    const declared = plas?.metadata.conflicts ?? [];
    const overlap = intersectIds(declared, requested);
    for (const o of overlap) {
      reports.push(`active '${id}' conflicts with requested '${o}'`);
    }
  }
  return reports;
}

/**
 * `/plasmid deactivate <id> [<id>...]`
 *
 * Refuses to deactivate L4 foundational plasmids (per P-1.10) and emits
 * the `PLASMID_FOUNDATIONAL_CHALLENGE_REQUIRED` error code. Users must
 * go through `/plasmid challenge` (Phase 5+) to remove a foundational
 * plasmid.
 *
 * Non-foundational ids that aren't currently active are silently
 * accepted (idempotent) — deactivating an already-inactive plasmid is
 * not an error.
 */
import type { CommandContext, CommandResult } from "../registry.js";
import type { PlasmidErrorCode, PlasmidId } from "../../plasmids/types.js";
import { asPlasmidId } from "../../plasmids/activation.js";
import type { CommandDeps } from "./deps.js";

const FOUNDATIONAL_CODE: PlasmidErrorCode = "PLASMID_FOUNDATIONAL_CHALLENGE_REQUIRED";

export async function deactivateSubcommand(
  args: readonly string[],
  context: CommandContext,
  deps: CommandDeps,
): Promise<CommandResult> {
  if (args.length === 0) {
    return {
      output:
        "Missing argument: <id>. Usage: /plasmid deactivate <id> [<id>...]",
      success: false,
    };
  }

  const requestedIds = args.map(asPlasmidId);
  const { loaded } = await deps.loadPlasmids({
    workingDirectory: context.workingDirectory,
    registryPath: deps.registryPath,
    sharedRegistryPath: deps.sharedRegistryPath,
    draftsPath: deps.draftsPath,
    scopes: deps.scopes,
  });

  const byId = new Map(loaded.map((p) => [p.metadata.id, p]));

  // L4 foundational refusal — this is the hard rule per P-1.10.
  const blocked: PlasmidId[] = [];
  for (const id of requestedIds) {
    const plas = byId.get(id);
    if (plas && (plas.metadata.tier === "L4" || plas.metadata.foundational === true)) {
      blocked.push(id);
    }
  }
  if (blocked.length > 0) {
    return {
      output: [
        `Cannot deactivate foundational (L4) plasmid(s): ${blocked.join(", ")}.`,
        `Error: ${FOUNDATIONAL_CODE}`,
        "Foundational plasmids require a challenge ceremony.",
        "Use /plasmid challenge <id> to propose an override (coming in Phase 5).",
      ].join("\n"),
      success: false,
    };
  }

  const next = await deps.activationStore.deactivate(requestedIds);
  return {
    output: [
      `Deactivated: ${requestedIds.join(", ")}`,
      `Active plasmids: ${next.activePlasmidIds.length}`,
    ].join("\n"),
    success: true,
  };
}

/**
 * Phase 5 — `/plasmid archive <id>` subcommand.
 *
 * Moves the plasmid file to `.dhelix/plasmids/archive/<id>-<ISO>.md`. Refuses
 * when `metadata.foundational === true` — those go through `/plasmid challenge
 * --action revoke`.
 *
 * Owned by Team 5 — Phase 5 GAL-1 dev-guide §6.
 */

import { mkdir, rename } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { LoadedPlasmid } from "../../plasmids/types.js";
import { PLASMIDS_ARCHIVE_DIR } from "../../plasmids/types.js";
import type { CommandContext, CommandResult } from "../registry.js";
import type { CommandDeps } from "./deps.js";

export async function archiveSubcommand(
  args: readonly string[],
  context: CommandContext,
  deps: CommandDeps,
): Promise<CommandResult> {
  const parsed = parseArgs(args);
  if ("error" in parsed) return { output: parsed.error, success: false };

  const { loaded } = await deps.loadPlasmids({
    workingDirectory: context.workingDirectory,
    registryPath: deps.registryPath,
    sharedRegistryPath: deps.sharedRegistryPath,
    draftsPath: deps.draftsPath,
    scopes: deps.scopes,
  });

  const target = loaded.find((p) => p.metadata.id === parsed.id);
  if (!target) {
    return {
      output: `Plasmid not found: ${parsed.id}`,
      success: false,
    };
  }

  if (target.metadata.foundational === true) {
    return {
      output: [
        `Refusing to archive foundational plasmid '${parsed.id}'.`,
        "Foundational plasmids embody durable principles and must go through the",
        "challenge ceremony. Use:",
        "",
        `  /plasmid challenge ${parsed.id} --action revoke --rationale "<...>" --dependents <keep|orphan|revoke> --confirm REVOKE ${parsed.id}`,
      ].join("\n"),
      success: false,
    };
  }

  const archivedPath = await moveToArchive(target, context, deps);
  // Keep activation state in sync — silently no-op if the id was never
  // activated. Without this the next /recombination would still consider
  // the (now-missing) id "active", which manifests as confusing "X plasmids
  // active but only Y loaded" UX.
  await deps.activationStore.deactivate([target.metadata.id]);
  return {
    output: [
      `Archived plasmid '${parsed.id}'.`,
      `  from: ${target.sourcePath}`,
      `  to:   ${archivedPath}`,
    ].join("\n"),
    success: true,
  };
}

interface ParsedArgs {
  readonly id: string;
}

function parseArgs(args: readonly string[]): ParsedArgs | { error: string } {
  let id: string | undefined;
  for (const tok of args) {
    if (tok.startsWith("--")) {
      return { error: `Unknown flag: ${tok}. Usage: /plasmid archive <id>` };
    }
    if (id === undefined) {
      id = tok;
      continue;
    }
    return { error: "Only one plasmid id may be passed to /plasmid archive." };
  }
  if (id === undefined) {
    return { error: "Missing argument: <id>. Usage: /plasmid archive <id>" };
  }
  return { id };
}

/**
 * Atomic-move semantics: same-FS rename. Generates a filename-safe ISO
 * timestamp (colons / dots → hyphens) so the archive entry is portable
 * across platforms.
 */
async function moveToArchive(
  target: LoadedPlasmid,
  context: CommandContext,
  deps: CommandDeps,
): Promise<string> {
  const now = (deps.now ?? (() => new Date()))();
  const stamp = now.toISOString().replace(/[.:]/g, "-");
  const archiveDir = join(context.workingDirectory, PLASMIDS_ARCHIVE_DIR);
  await mkdir(archiveDir, { recursive: true });
  const destination = join(archiveDir, `${target.metadata.id}-${stamp}.md`);
  // Ensure parent (defensive — same as archiveDir but matches the I-1 rule
  // that two-file plasmids are archived as a single body.md move; for those
  // a future enhancement could capture metadata.yaml too).
  await mkdir(dirname(destination), { recursive: true });
  await rename(target.sourcePath, destination);
  return destination;
}

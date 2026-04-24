/**
 * `/cure` slash command — Team 4 Phase 3.
 *
 * Mirrors the `/recombination` command shape (`extend.ts` + `deps.ts`).
 * Parses args, builds `CureOptions`, delegates to `deps.executeCure`,
 * and renders a human report via `./render.ts`.
 *
 * Usage:
 *   /cure                         # latest transcript
 *   /cure --all                   # every transcript, pristine project
 *   /cure --transcript <id>       # specific transcript
 *   /cure --plasmid <id>          # only artifacts produced by this plasmid
 *   /cure --dry-run               # preview only
 *   /cure --purge                 # also archive plasmid .md to archive/
 */
import type { CommandContext, CommandResult, SlashCommand } from "../registry.js";
import { runCure } from "./extend.js";
import { type CommandDeps, defaultDeps } from "./deps.js";

/** Build the `/cure` command against an injected deps object. */
export function makeCureCommand(
  depsOrFactory: CommandDeps | ((ctx: CommandContext) => CommandDeps),
): SlashCommand {
  return {
    name: "cure",
    description: "Revert a recombination run (PRD §6.4).",
    usage:
      "/cure [--transcript <id>|--plasmid <id>|--all] [--dry-run] [--purge]",
    async execute(argStr: string, context: CommandContext): Promise<CommandResult> {
      const deps =
        typeof depsOrFactory === "function" ? depsOrFactory(context) : depsOrFactory;
      return dispatch(argStr, context, deps);
    },
  };
}

/** Production singleton — derives deps lazily from `CommandContext`. */
export const cureCommand: SlashCommand = makeCureCommand((ctx) =>
  defaultDeps(ctx.workingDirectory),
);

async function dispatch(
  argStr: string,
  context: CommandContext,
  deps: CommandDeps,
): Promise<CommandResult> {
  return runCure(tokenize(argStr), context, deps);
}

function tokenize(argStr: string): readonly string[] {
  const trimmed = argStr.trim();
  if (trimmed === "") return [];
  return trimmed.split(/\s+/);
}

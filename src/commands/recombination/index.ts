/**
 * `/recombination` dispatcher — Phase 2 surface.
 *
 * The command is a single-verb dispatcher for now. All behaviour lives
 * in `./extend.ts`; the indirection is deliberate so Phase-3+ can add
 * subcommands (e.g. `inspect`, `history`) without moving the entry point.
 *
 * `recombinationCommand` is the production singleton wired into
 * `builtin-commands.ts`. `makeRecombinationCommand(deps)` is the DI entry
 * point used by tests.
 */
import type { CommandContext, CommandResult, SlashCommand } from "../registry.js";
import { runRecombination } from "./extend.js";
import { type CommandDeps, defaultDeps } from "./deps.js";

/** Build the `/recombination` command against an injected deps object. */
export function makeRecombinationCommand(
  depsOrFactory: CommandDeps | ((ctx: CommandContext) => CommandDeps),
): SlashCommand {
  return {
    name: "recombination",
    description: "Recombine active plasmids into .dhelix/ + DHELIX.md (Phase 2)",
    usage:
      "/recombination [--mode <extend|rebuild|dry-run>] [--plasmid <id>] [--model <name>] [--dry-run]",
    async execute(argStr: string, context: CommandContext): Promise<CommandResult> {
      const deps =
        typeof depsOrFactory === "function" ? depsOrFactory(context) : depsOrFactory;
      return dispatch(argStr, context, deps);
    },
  };
}

/** Production singleton — derives deps lazily from `CommandContext`. */
export const recombinationCommand: SlashCommand = makeRecombinationCommand((ctx) =>
  defaultDeps(ctx.workingDirectory, ctx.model),
);

async function dispatch(
  argStr: string,
  context: CommandContext,
  deps: CommandDeps,
): Promise<CommandResult> {
  const tokens = tokenize(argStr);
  // Single-verb today — future subcommands will consume tokens[0] here.
  return runRecombination(tokens, context, deps);
}

function tokenize(argStr: string): readonly string[] {
  const trimmed = argStr.trim();
  if (trimmed === "") return [];
  return trimmed.split(/\s+/);
}

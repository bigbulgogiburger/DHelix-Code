/**
 * `/plasmid` dispatcher — routes to 6 Phase-1 subcommands.
 *
 * Subcommands
 *   list        - tabular index with filters
 *   show        - metadata + body preview
 *   validate    - L1 schema + cross-ref
 *   activate    - add ids to activation set
 *   deactivate  - remove ids (L4 refused)
 *   edit        - open body.md in $EDITOR
 *
 * With no args — prints usage + help. With an unknown subcommand, returns
 * `success: false` and a hint pointing at /plasmid with no args.
 *
 * `plasmidCommand` is the production singleton used by `builtin-commands.ts`.
 * `makePlasmidCommand(deps)` is the DI entry point used by tests.
 */
import type { CommandContext, CommandResult, SlashCommand } from "../registry.js";
import { listSubcommand } from "./list.js";
import { showSubcommand } from "./show.js";
import { validateSubcommand } from "./validate.js";
import { activateSubcommand } from "./activate.js";
import { deactivateSubcommand } from "./deactivate.js";
import { editSubcommand } from "./edit.js";
import { type CommandDeps, defaultDeps } from "./deps.js";

type Subcommand =
  | "list"
  | "show"
  | "validate"
  | "activate"
  | "deactivate"
  | "edit";

const SUBCOMMANDS: readonly Subcommand[] = [
  "list",
  "show",
  "validate",
  "activate",
  "deactivate",
  "edit",
];

function usage(): string {
  return [
    "Usage: /plasmid <subcommand> [args...]",
    "",
    "Subcommands (Phase 1):",
    "  list [--tier <L1..L4>] [--scope <scope>] [--active]",
    "                                Tabular index of plasmids",
    "  show <id> [--body] [--force]  Metadata + optional body preview",
    "  validate [<id>]               L1 schema + cross-reference checks",
    "  activate <id> [<id>...]       Add ids to the active set",
    "  deactivate <id> [<id>...]     Remove ids (L4 requires /plasmid challenge)",
    "  edit <id>                     Open body.md in $EDITOR",
    "",
    "Phase-2+ subcommands (archive, challenge, inspect, ...) are not yet wired.",
  ].join("\n");
}

/**
 * Build the `/plasmid` SlashCommand against an injected `CommandDeps`.
 *
 * The factory is the preferred seam for tests — pass a deps object with
 * in-memory stubs for the loader + activation store and the resulting
 * command is fully hermetic.
 */
export function makePlasmidCommand(
  depsOrFactory: CommandDeps | ((ctx: CommandContext) => CommandDeps),
): SlashCommand {
  return {
    name: "plasmid",
    description: "Plasmid registry / activation / editor (Phase 1)",
    usage: "/plasmid <list|show|validate|activate|deactivate|edit> [args...]",
    async execute(argStr: string, context: CommandContext): Promise<CommandResult> {
      const deps =
        typeof depsOrFactory === "function" ? depsOrFactory(context) : depsOrFactory;
      return dispatch(argStr, context, deps);
    },
  };
}

/**
 * Production singleton — derives deps lazily from `CommandContext`.
 */
export const plasmidCommand: SlashCommand = makePlasmidCommand((ctx) =>
  defaultDeps(ctx.workingDirectory),
);

async function dispatch(
  argStr: string,
  context: CommandContext,
  deps: CommandDeps,
): Promise<CommandResult> {
  const tokens = tokenize(argStr);
  if (tokens.length === 0) {
    return { output: usage(), success: true };
  }
  const [sub, ...rest] = tokens;
  if (sub === undefined) {
    return { output: usage(), success: true };
  }
  if (!isSubcommand(sub)) {
    return {
      output:
        `Unknown /plasmid subcommand: '${sub}'.\n` +
        `Expected one of: ${SUBCOMMANDS.join(", ")}.\n\n` +
        usage(),
      success: false,
    };
  }

  switch (sub) {
    case "list":
      return listSubcommand(rest, context, deps);
    case "show":
      return showSubcommand(rest, context, deps);
    case "validate":
      return validateSubcommand(rest, context, deps);
    case "activate":
      return activateSubcommand(rest, context, deps);
    case "deactivate":
      return deactivateSubcommand(rest, context, deps);
    case "edit":
      return editSubcommand(rest, context, deps);
  }
}

function tokenize(argStr: string): readonly string[] {
  const trimmed = argStr.trim();
  if (trimmed === "") return [];
  return trimmed.split(/\s+/);
}

function isSubcommand(s: string): s is Subcommand {
  return (SUBCOMMANDS as readonly string[]).includes(s);
}

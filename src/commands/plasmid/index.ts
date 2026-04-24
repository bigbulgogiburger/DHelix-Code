/**
 * `/plasmid` dispatcher — routes to all subcommands.
 *
 * Subcommands
 *   list        - tabular index with filters
 *   show        - metadata + body preview
 *   validate    - L1 schema + cross-ref
 *   activate    - add ids to activation set
 *   deactivate  - remove ids (L4 refused)
 *   edit        - open body.md in $EDITOR
 *   archive     - move to .dhelix/plasmids/archive/ (foundational refused)
 *   inspect     - body→summary token counts + preserved constraints
 *   research    - Phase 5 research-assisted authoring (also via `--research`)
 *   challenge   - Phase 5 foundational ceremony (override / amend / revoke)
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
import { archiveSubcommand } from "./archive.js";
import { inspectSubcommand } from "./inspect.js";
import { researchSubcommand } from "./research.js";
import { challengeSubcommand } from "./challenge.js";
import { type CommandDeps, defaultDeps } from "./deps.js";

type Subcommand =
  | "list"
  | "show"
  | "validate"
  | "activate"
  | "deactivate"
  | "edit"
  | "archive"
  | "inspect"
  | "research"
  | "challenge";

const SUBCOMMANDS: readonly Subcommand[] = [
  "list",
  "show",
  "validate",
  "activate",
  "deactivate",
  "edit",
  "archive",
  "inspect",
  "research",
  "challenge",
];

function usage(): string {
  return [
    "Usage: /plasmid <subcommand> [args...]",
    "",
    "Subcommands:",
    "  list [--tier <L1..L4>] [--scope <scope>] [--active]",
    "                                Tabular index of plasmids",
    "  show <id> [--body] [--force]  Metadata + optional body preview",
    "  validate [<id>]               L1 schema + cross-reference checks",
    "  activate <id> [<id>...]       Add ids to the active set",
    "  deactivate <id> [<id>...]     Remove ids (L4 requires /plasmid challenge)",
    "  edit <id>                     Open body.md in $EDITOR",
    "  archive <id>                  Move to .dhelix/plasmids/archive/ (foundational refused)",
    "  inspect compression <id>      Body→summary token counts + preserved constraints",
    "",
    "Subcommands (Phase 5):",
    "  research \"<intent>\" [--dry-run] [--from-file <path>] [--template <name>]",
    "                              [--locale <ko|en>] [--force-network]",
    "                                Draft a plasmid from web research.",
    "                                Equivalent: /plasmid --research \"<intent>\" ...",
    "  challenge <id> [--action <override|amend|revoke>] [--rationale \"<text>\"]",
    "                              [--dependents <keep|orphan|revoke>]",
    "                              [--confirm \"REVOKE <id>\"] [--yes]",
    "                                Foundational ceremony (override/amend/revoke)",
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
    description: "Plasmid registry / activation / editor / challenge",
    usage:
      "/plasmid <list|show|validate|activate|deactivate|edit|archive|inspect|research|challenge> [args...]",
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

  // Phase 5: `--research` may appear anywhere in the args (idiomatic CLI form
  // `/plasmid --research "intent" --dry-run`). When detected, route the entire
  // remainder through `researchSubcommand` and let it parse its own flags.
  if (tokens.includes("--research")) {
    return researchSubcommand(tokens, context, deps);
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
    case "archive":
      return archiveSubcommand(rest, context, deps);
    case "inspect":
      return inspectSubcommand(rest, context, deps);
    case "research":
      return researchSubcommand(rest, context, deps);
    case "challenge":
      return challengeSubcommand(rest, context, deps);
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

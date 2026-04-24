/**
 * `/cure` handler — arg parse + dispatch to deps.executeCure.
 *
 * Team 4 — Phase 3. Pattern matches `/recombination`'s extend.ts.
 */
import type { CommandContext, CommandResult } from "../registry.js";
import type { CommandDeps } from "./deps.js";

export const runCure: (
  argv: readonly string[],
  context: CommandContext,
  deps: CommandDeps,
) => Promise<CommandResult> = async () => {
  throw new Error("TODO Phase 3 Team 4: runCure");
};

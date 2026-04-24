/**
 * DI contract for the `/cure` command — Team 4.
 *
 * Mirrors `/recombination`'s deps.ts (factory default wiring). Tests pass
 * stub implementations directly.
 */
import { createCure, defaultCureFacadeDeps } from "../../recombination/cure/index.js";
import type { ExecuteCureFn } from "../../recombination/types.js";

export interface CommandDeps {
  readonly executeCure: ExecuteCureFn;
}

/**
 * Production factory. `workingDirectory` is currently unused because the
 * cure facade receives the cwd via `CureOptions.workingDirectory` at call
 * time; the parameter is reserved for future overrides (e.g. mock IO for
 * an interactive approval prompt).
 */
export const defaultDeps: (workingDirectory: string) => CommandDeps = (
  _workingDirectory,
) => ({
  executeCure: createCure(defaultCureFacadeDeps()),
});

/**
 * DI contract for the `/cure` command — Team 4.
 *
 * Mirrors `/recombination`'s deps.ts (lazy dynamic import, factory default
 * wiring). Tests pass stub implementations directly.
 */
import type { ExecuteCureFn } from "../../recombination/types.js";

export interface CommandDeps {
  readonly executeCure: ExecuteCureFn;
}

export const defaultDeps: (workingDirectory: string) => CommandDeps = () => {
  throw new Error("TODO Phase 3 Team 4: defaultDeps");
};

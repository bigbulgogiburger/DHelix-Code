/**
 * Cure module barrel — Team 4. Exports the executable `executeCure`
 * facade that commands/cure consumes.
 *
 * Layer: Core.
 */
import type {
  ExecuteCureFn,
  PlanCureFn,
  RestoreCureFn,
} from "../types.js";

import { planCure } from "./planner.js";
import { restoreCure } from "./restorer.js";

export * from "./planner.js";
export * from "./restorer.js";
export * from "./edit-detector.js";
export * from "./refs.js";

export interface CureFacadeDeps {
  readonly planCure: PlanCureFn;
  readonly restoreCure: RestoreCureFn;
}

export const createCure: (deps: CureFacadeDeps) => ExecuteCureFn =
  (deps) => async (options) => {
    const plan = await deps.planCure({ options });
    if (options.dryRun) {
      return {
        plan,
        executed: false,
        filesDeleted: [],
        markersRemoved: [],
        plasmidsArchived: [],
      };
    }
    return deps.restoreCure({ options, plan });
  };

export const defaultCureFacadeDeps: () => CureFacadeDeps = () => ({
  planCure,
  restoreCure,
});

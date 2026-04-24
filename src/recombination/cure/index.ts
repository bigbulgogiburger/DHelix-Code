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

export * from "./planner.js";
export * from "./restorer.js";
export * from "./edit-detector.js";
export * from "./refs.js";

export interface CureFacadeDeps {
  readonly planCure: PlanCureFn;
  readonly restoreCure: RestoreCureFn;
}

export const createCure: (deps: CureFacadeDeps) => ExecuteCureFn = () => {
  throw new Error("TODO Phase 3 Team 4: createCure");
};

export const defaultCureFacadeDeps: () => CureFacadeDeps = () => {
  throw new Error("TODO Phase 3 Team 4: defaultCureFacadeDeps");
};

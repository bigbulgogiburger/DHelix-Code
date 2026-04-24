/**
 * Validation module barrel — Team 5 owns the facade `createValidate` that
 * wires Team 1-3 deps into a single `ValidateFn` consumed by the executor
 * at Stage 6.
 *
 * Re-exports team entry points so adjacent code (command layer, tests)
 * can import a single path.
 *
 * Layer: Core.
 */
import type {
  BuildArtifactEnvFn,
  DecideRollbackFn,
  GenerateCasesFn,
  GracePromptIO,
  GradeCasesFn,
  RunCasesFn,
  ValidateFn,
  VolumeGovernorFn,
} from "../types.js";

export * from "./expectation-dsl.js";
export * from "./eval-seeds.js";
export * from "./volume-governor.js";
export * from "./case-generator.js";
export * from "./artifact-env.js";
export * from "./runtime-executor.js";
export * from "./grader-cascade.js";
export * from "./rollback-decision.js";
export * from "./reporter.js";
export * from "./override-tracker.js";
export * from "./regression-tracker.js";

/** Injected dependencies for `createValidate`. Each is team-1-3's entry. */
export interface ValidateFacadeDeps {
  readonly buildVolumePlan: VolumeGovernorFn;
  readonly generateCases: GenerateCasesFn;
  readonly buildArtifactEnv: BuildArtifactEnvFn;
  readonly runCases: RunCasesFn;
  readonly gradeCases: GradeCasesFn;
  readonly decideRollback: DecideRollbackFn;
  /** Optional — command layer injects terminal-aware IO; tests pass stubs. */
  readonly promptIO?: GracePromptIO;
}

/**
 * Build a `ValidateFn` composing all Team 1-3 entries. Default wiring
 * lives in `defaultValidateFacadeDeps()` (team-5 owns it). Executor
 * Stage 6 invokes the returned fn.
 */
export const createValidate: (deps: ValidateFacadeDeps) => ValidateFn = () => {
  throw new Error("TODO Phase 3 Team 5: createValidate");
};

export const defaultValidateFacadeDeps: () => ValidateFacadeDeps = () => {
  throw new Error("TODO Phase 3 Team 5: defaultValidateFacadeDeps");
};

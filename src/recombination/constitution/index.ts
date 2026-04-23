/**
 * Public surface of `src/recombination/constitution/` — Stage 2d (P-1.15).
 *
 * Team 5 consumes this module exclusively through the barrel:
 *   - `reorganize`                 — 3-tier planner (the locked {@link ReorganizeFn})
 *   - `applyPlan`                  — pure string transformer for Stage 4
 *   - `parse` / `render`           — DHELIX.md section tree utilities
 *   - `validateUpdateTargets`      — structural I-9 pre-check
 *   - `verifyUserAreaInvariance`   — semantic I-9 post-check
 *   - error classes (typed `.code` → {@link RecombinationErrorCode})
 *
 * Layer: Core (Layer 2). All exports are named (no default export).
 */

export { REORG_VERSION, reorganize, parseXmlPlan } from "./reorganizer.js";
export { applyPlan, planTouchesUserArea } from "./apply.js";
export type { ApplyResult } from "./apply.js";
export {
  parse,
  render,
  findMarker,
  listUserSections,
  listMarkerSections,
  listMarkerIds,
} from "./section-tree.js";
export type {
  Section,
  SectionTree,
  UserSection,
  MarkerSection,
} from "./section-tree.js";
export {
  normalizeUserText,
  hashUserText,
  validateUpdateTargets,
  verifyUserAreaInvariance,
} from "./invariance-check.js";
export {
  MARKER_ID_MAX_LENGTH,
  BEGIN_MARKER_RE,
  END_MARKER_RE,
  isValidMarkerId,
  parseBeginLine,
  parseEndLine,
  renderBeginMarker,
  renderEndMarker,
  kebab,
  buildMarkerId,
} from "./marker.js";
export { buildDeterministicPlan } from "./deterministic.js";
export {
  reorgCacheLocation,
  hashConstitution,
  hashIntentGraph,
} from "./cache.js";
export type { CacheKeyInput, CacheLocation } from "./cache.js";
export {
  ReorganizerError,
  ConstitutionParseError,
  ReorgInvalidUpdateTargetError,
  ReorgUserAreaViolationError,
  ReorgFallbackExhaustedError,
} from "./errors.js";

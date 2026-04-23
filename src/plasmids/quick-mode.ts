/**
 * Quick mode — 3-step flow to persist a plasmid draft from a short intent.
 *
 * Design: `docs/design/P-1.5-plasmid-quick-first.md` v0.2.
 * Timing: ADJ-1 (`docs/prd/plasmid-recombination-execution-plan.md` §3.4):
 *   20s reflects the LLM call only; expect 5–15 minutes of human review
 *   before activation. Surface that explicitly via `QUICK_NOTICES` /
 *   `warnings` so UI copy cannot regress to "20s total".
 *
 * Phase 1 scope: template-only generator (no real LLM). The LLM call
 * lives in Phase 2; this module threads the seams so swapping it in is
 * a one-line change in `deps.getTemplate` + a new `deps.generateBody`
 * hook (to be added when Phase 2 lands).
 */

import { renderTemplate, TIER_DEFAULTS, type TemplateContext } from "./generators.js";
import type { DraftsStore } from "./drafts.js";
import type { PlasmidId, PlasmidPrivacy, PlasmidScope, PlasmidTier } from "./types.js";

/** Defaults per PRD §6.1 frontmatter contract. */
const DEFAULT_SCOPE: PlasmidScope = "local";
const DEFAULT_PRIVACY: PlasmidPrivacy = "cloud-ok";
const DEFAULT_VERSION = "0.1.0";
const DEFAULT_LOCALE: "ko" | "en" = "ko";

/**
 * Extended error-code union local to Quick mode.
 *
 * We cannot edit `types.ts` (shared contract; other teams own review),
 * so the extra code is declared here. When Team 1 expands the public
 * `PlasmidErrorCode` union the local type will be dropped and callers
 * keep working (structural subtype).
 */
export type QuickModeErrorCode =
  | "PLASMID_FOUNDATIONAL_AUTO_BLOCKED"
  | "PLASMID_NAME_INVALID"
  | "PLASMID_TEMPLATE_RENDER_FAILED";

/** Input contract for Quick mode. See P-1.5 §2. */
export interface QuickInput {
  readonly name: string;
  readonly description: string;
  readonly tier: PlasmidTier;
  readonly templateId?: string;
  readonly locale?: "ko" | "en";
}

/** Success result. Duration is wall-clock, useful for Phase 1 metrics. */
export interface QuickResult {
  readonly draftPath: string;
  readonly plasmidId: PlasmidId;
  readonly warnings: readonly string[];
  readonly durationMs: number;
}

/**
 * Injected dependencies. The registry lookup is injected (Team 5 owns
 * templates) so test doubles stay trivial and so we can swap in the
 * real registry at integration time without touching quick-mode.
 */
export interface QuickDeps {
  readonly getTemplate: (tier: PlasmidTier, templateId?: string) => string | null;
  readonly drafts: DraftsStore;
  readonly now: () => Date;
}

/**
 * Structured error — recovery UX (P-1.7) consumes `.code`.
 *
 * Kept as an ordinary Error subclass so existing loggers that narrow on
 * `instanceof Error` keep working.
 */
export class QuickModeError extends Error {
  readonly code: QuickModeErrorCode;
  readonly draftPath?: string;

  constructor(code: QuickModeErrorCode, message: string, draftPath?: string) {
    super(message);
    this.name = "QuickModeError";
    this.code = code;
    this.draftPath = draftPath;
  }
}

/**
 * ADJ-1 UI notice copy. Exposed as a const so UI components can assert
 * on wording in tests / accessibility audits.
 */
export const QUICK_NOTICES = {
  ko: "Quick mode는 LLM 초안을 약 20초 내에 생성합니다. 활성화 전에 5~15분의 검토/편집 시간을 권장합니다.",
  en: "Quick mode generates the LLM skeleton in ~20s. Allow 5–15 min for human review and edits before activating.",
} as const;

/** Locale-aware message bag. Keep keys stable; copy can drift. */
export const QUICK_MESSAGES: Readonly<Record<"ko" | "en", Readonly<Record<string, string>>>> = {
  ko: {
    adjustedTimeNotice: QUICK_NOTICES.ko,
    templateFallback: "요청한 템플릿을 찾지 못해 기본 템플릿을 사용했습니다.",
    foundationalBlocked:
      "Quick mode는 foundational(L4) 플라스미드 자동 생성을 허용하지 않습니다. `--tier` 명시 또는 --template foundational-* 경로를 사용하세요.",
    invalidName:
      "플라스미드 이름은 3~64자, 영문 소문자/숫자/하이픈만 가능하며 하이픈으로 시작하거나 끝날 수 없습니다.",
  },
  en: {
    adjustedTimeNotice: QUICK_NOTICES.en,
    templateFallback: "Requested template was not found; the minimal fallback was used.",
    foundationalBlocked:
      "Quick mode refuses to auto-generate foundational (L4) plasmids. Use --template foundational-* or the explicit foundational workflow.",
    invalidName:
      "Plasmid name must be 3–64 chars, lowercase [a-z0-9-], and cannot start or end with a hyphen.",
  },
};

/** Quick mode entrypoint. */
export async function runQuickMode(
  input: QuickInput,
  deps: QuickDeps,
  signal: AbortSignal,
): Promise<QuickResult> {
  const started = Date.now();
  signal.throwIfAborted();

  const locale = input.locale ?? DEFAULT_LOCALE;
  const messages = QUICK_MESSAGES[locale];

  // Step 1 — validate and derive id.
  if (input.tier === "L4") {
    throw new QuickModeError("PLASMID_FOUNDATIONAL_AUTO_BLOCKED", messages.foundationalBlocked);
  }
  const plasmidId = slugifyPlasmidName(input.name);
  if (plasmidId === null) {
    throw new QuickModeError("PLASMID_NAME_INVALID", messages.invalidName);
  }

  // Step 2 — template lookup with fallback.
  const warnings: string[] = [messages.adjustedTimeNotice];
  let template = deps.getTemplate(input.tier, input.templateId);
  if (template === null) {
    warnings.push(messages.templateFallback);
    template = TIER_DEFAULTS[input.tier];
  }

  // Step 3 — render + save. Errors become PLASMID_TEMPLATE_RENDER_FAILED
  // to disambiguate from I/O errors in the cache store.
  const nowIso = deps.now().toISOString();
  const ctx: TemplateContext = {
    id: plasmidId,
    name: input.name,
    description: input.description,
    tier: input.tier,
    scope: DEFAULT_SCOPE,
    privacy: DEFAULT_PRIVACY,
    created: nowIso,
    updated: nowIso,
    version: DEFAULT_VERSION,
    locale,
  };

  let rendered: string;
  try {
    rendered = renderTemplate(template, ctx);
  } catch (err) {
    throw new QuickModeError(
      "PLASMID_TEMPLATE_RENDER_FAILED",
      err instanceof Error ? err.message : String(err),
    );
  }

  signal.throwIfAborted();
  const draftPath = await deps.drafts.save(plasmidId, rendered, signal);

  return {
    draftPath,
    plasmidId,
    warnings,
    durationMs: Date.now() - started,
  };
}

/**
 * Slugify a plasmid name per types.ts brand constraint:
 *   `[a-z][a-z0-9-]*`, length 3..64, no consecutive hyphens.
 *
 * Rules:
 *   - lowercase
 *   - non-[a-z0-9] → `-`
 *   - collapse runs of `-`
 *   - trim leading/trailing `-`
 *   - reject if result empty / out of length
 *   - reject if cannot satisfy "starts with letter" (i.e. starts with digit)
 *
 * Returns `null` on failure so the caller can emit the structured error.
 */
export function slugifyPlasmidName(raw: string): PlasmidId | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;

  const lowered = trimmed.toLowerCase();
  const replaced = lowered.replace(/[^a-z0-9]+/g, "-");
  const collapsed = replaced.replace(/-+/g, "-");
  const trimmedHyphens = collapsed.replace(/^-+/, "").replace(/-+$/, "");

  if (trimmedHyphens.length < 3 || trimmedHyphens.length > 64) return null;
  if (!/^[a-z]/.test(trimmedHyphens)) return null;
  if (!/^[a-z][a-z0-9-]*$/.test(trimmedHyphens)) return null;

  return trimmedHyphens as PlasmidId;
}

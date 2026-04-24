/**
 * Interview mode — skeleton state machine for `/plasmid --research`.
 *
 * Design: `docs/design/P-1.5-plasmid-quick-first.md` §3.3. Phase 1 wires
 * only the state machine; Phase 2 plugs the real LLM interpreter that
 * will (a) synthesize web research, (b) ask targeted gap questions,
 * (c) produce a richer draft.
 *
 * The driver is INJECTED — production uses CLI prompts (`ink-text-input`
 * or readline), tests use a scripted array. The async generator yields
 * each step *before* it needs an answer so the driver can render UI;
 * `driver.ask(step)` is the synchronous (awaited) cut-point.
 *
 * Final return value is a `QuickResult` (same shape — unifies the
 * downstream command handler so it doesn't care which flow produced
 * the draft).
 */

import {
  QUICK_MESSAGES,
  QuickModeError,
  runQuickMode,
  type QuickDeps,
  type QuickResult,
} from "./quick-mode.js";
import type { PlasmidTier } from "./types.js";

/** Step kinds per P-1.5 §3.3 (skeleton subset). */
export type InterviewStepKind =
  | "ask-name"
  | "ask-description"
  | "ask-tier"
  | "ask-scope"
  | "ask-privacy"
  | "ask-eval-samples"
  | "confirm"
  | "done";

/** A single prompt the driver must resolve. */
export interface InterviewStep {
  readonly kind: InterviewStepKind;
  readonly prompt: string;
  readonly options?: readonly string[];
}

/**
 * Driver contract. Production wires a CLI readline adapter; tests
 * provide `scriptedDriver(["name", "desc", …])`.
 */
export interface InterviewDriver {
  readonly ask: (step: InterviewStep) => Promise<string>;
}

/** Dependencies mirror Quick mode plus optional locale defaulting. */
export interface InterviewDeps extends QuickDeps {
  readonly locale?: "ko" | "en";
}

/** Valid tier answers (L4 permitted via explicit opt-in per P-1.5 §Q4). */
const TIER_CHOICES: readonly PlasmidTier[] = ["L1", "L2", "L3", "L4"];

/**
 * Interview driver entry point. Yields steps in a deterministic order.
 *
 * Caller usage:
 *   const gen = runInterview(deps, driver, signal);
 *   for await (const step of gen) { UI.render(step); }
 *   const result = (await gen.return(undefined)).value  // after "done"
 *
 * Or more ergonomically:
 *   const it = runInterview(deps, driver, signal);
 *   let res = await it.next();
 *   while (!res.done) res = await it.next();
 *   const qr = res.value;
 */
export async function* runInterview(
  deps: InterviewDeps,
  driver: InterviewDriver,
  signal: AbortSignal,
): AsyncGenerator<InterviewStep, QuickResult, void> {
  throwIfAborted(signal);
  const locale = deps.locale ?? "ko";
  const messages = QUICK_MESSAGES[locale];

  // --- 1. name ----------------------------------------------------------
  const nameStep: InterviewStep = {
    kind: "ask-name",
    prompt: locale === "ko" ? "플라스미드 이름은?" : "Plasmid name?",
  };
  yield nameStep;
  const name = (await driver.ask(nameStep)).trim();
  throwIfAborted(signal);

  // --- 2. description ---------------------------------------------------
  const descStep: InterviewStep = {
    kind: "ask-description",
    prompt:
      locale === "ko"
        ? "한 줄로 어떤 규칙을 강제하나요?"
        : "In one sentence, what does it enforce?",
  };
  yield descStep;
  const description = (await driver.ask(descStep)).trim();
  throwIfAborted(signal);

  // --- 3. tier ----------------------------------------------------------
  const tierStep: InterviewStep = {
    kind: "ask-tier",
    prompt: locale === "ko" ? "티어를 선택하세요." : "Choose a tier.",
    options: TIER_CHOICES,
  };
  yield tierStep;
  const tierRaw = (await driver.ask(tierStep)).trim().toUpperCase();
  const tier = TIER_CHOICES.find((t) => t === tierRaw);
  if (!tier) {
    throw new QuickModeError(
      "PLASMID_NAME_INVALID",
      locale === "ko"
        ? `알 수 없는 티어: ${tierRaw}. ${TIER_CHOICES.join(" / ")} 중 하나여야 합니다.`
        : `Unknown tier: ${tierRaw}. Expected one of ${TIER_CHOICES.join(", ")}.`,
    );
  }
  if (tier === "L4") {
    throw new QuickModeError("PLASMID_FOUNDATIONAL_AUTO_BLOCKED", messages.foundationalBlocked);
  }
  throwIfAborted(signal);

  // --- 4. scope (informational — skeleton only) -------------------------
  const scopeStep: InterviewStep = {
    kind: "ask-scope",
    prompt:
      locale === "ko"
        ? "저장 범위 (scope)? — local/shared/ephemeral"
        : "Scope? — local/shared/ephemeral",
    options: ["local", "shared", "ephemeral"],
  };
  yield scopeStep;
  await driver.ask(scopeStep); // not yet consumed — Phase 2 plumbs it
  throwIfAborted(signal);

  // --- 5. privacy (informational) ---------------------------------------
  const privacyStep: InterviewStep = {
    kind: "ask-privacy",
    prompt:
      locale === "ko"
        ? "프라이버시? — local-only/cloud-ok/no-network"
        : "Privacy? — local-only/cloud-ok/no-network",
    options: ["local-only", "cloud-ok", "no-network"],
  };
  yield privacyStep;
  await driver.ask(privacyStep);
  throwIfAborted(signal);

  // --- 6. eval samples (informational) ----------------------------------
  const evalStep: InterviewStep = {
    kind: "ask-eval-samples",
    prompt:
      locale === "ko"
        ? "검증 샘플 개수? (0 이면 건너뜀)"
        : "How many eval samples? (0 to skip)",
  };
  yield evalStep;
  await driver.ask(evalStep);
  throwIfAborted(signal);

  // --- 7. confirm -------------------------------------------------------
  const confirmStep: InterviewStep = {
    kind: "confirm",
    prompt:
      locale === "ko"
        ? `저장하시겠습니까? name=${name}, tier=${tier}`
        : `Save? name=${name}, tier=${tier}`,
    options: ["yes", "no"],
  };
  yield confirmStep;
  const confirm = (await driver.ask(confirmStep)).trim().toLowerCase();
  throwIfAborted(signal);
  if (confirm !== "yes" && confirm !== "y") {
    // User bailed; still yield a "done" step so the driver gets a final
    // render, but throw to signal the command handler.
    throw new QuickModeError(
      "PLASMID_TEMPLATE_RENDER_FAILED",
      locale === "ko" ? "사용자가 저장을 취소했습니다." : "User declined to save.",
    );
  }

  // --- 8. dispatch to Quick mode (skeleton stub in Phase 1) -------------
  // Phase 2: replace this call with a real LLM-backed body generator.
  const result = await runQuickMode({ name, description, tier, locale }, deps, signal);

  const doneStep: InterviewStep = {
    kind: "done",
    prompt:
      locale === "ko"
        ? `드래프트 저장 완료: ${result.draftPath}`
        : `Draft saved: ${result.draftPath}`,
  };
  yield doneStep;
  return result;
}

/**
 * Convenience: collect a scripted series of answers into a driver.
 * Used by tests; kept alongside the contract so production code can
 * also compose it for dry-runs / replay.
 */
export function scriptedDriver(answers: readonly string[]): InterviewDriver {
  let i = 0;
  return {
    ask: async () => {
      if (i >= answers.length) {
        throw new Error(`scriptedDriver exhausted after ${answers.length} answers`);
      }
      return answers[i++];
    },
  };
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) signal.throwIfAborted();
}

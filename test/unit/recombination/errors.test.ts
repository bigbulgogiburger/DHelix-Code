/**
 * Unit tests for `src/recombination/errors.ts` — RecombinationError class
 * and the factory helpers that round-trip PRD §10.3 codes.
 */
import { describe, expect, it } from "vitest";

import type { PlasmidId } from "../../../src/plasmids/types.js";
import type { WiringReport } from "../../../src/recombination/types.js";
import {
  aborted,
  generatorError,
  interpreterJsonFailure,
  localLlmUnavailable,
  lockBusy,
  privacyCloudBlocked,
  RecombinationError,
  reorgInvalidUpdateTarget,
  reorgUserAreaViolation,
  wiringValidationError,
} from "../../../src/recombination/errors.js";

describe("RecombinationError", () => {
  it("attaches code + frozen context + cause (ES2022)", () => {
    const rootCause = new Error("low-level");
    const err = new RecombinationError(
      "RECOMBINATION_PLAN_ERROR",
      "plan failed",
      { detail: 42 },
      rootCause,
    );
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("RecombinationError");
    expect(err.code).toBe("RECOMBINATION_PLAN_ERROR");
    expect(err.context.detail).toBe(42);
    expect((err as Error & { cause?: unknown }).cause).toBe(rootCause);
  });

  it("supports omitting optional context and cause", () => {
    const err = new RecombinationError("RECOMBINATION_ABORTED", "stopped");
    expect(err.code).toBe("RECOMBINATION_ABORTED");
    expect(err.context).toEqual({});
    expect((err as Error & { cause?: unknown }).cause).toBeUndefined();
  });

  it("copies the context — callers cannot mutate it after construction", () => {
    const ctx: Record<string, unknown> = { value: "v1" };
    const err = new RecombinationError("GENERATOR_ERROR", "m", ctx);
    ctx.value = "v2"; // outside mutation
    expect(err.context.value).toBe("v1");
  });
});

describe("factory helpers", () => {
  it("lockBusy() includes pid and optional hostname", () => {
    const a = lockBusy(4242);
    expect(a.code).toBe("RECOMBINATION_LOCK_BUSY");
    expect(a.context.pid).toBe(4242);
    expect(a.context.hostname).toBeUndefined();
    expect(a.message).toContain("4242");

    const b = lockBusy(5555, "host-01");
    expect(b.context.hostname).toBe("host-01");
    expect(b.message).toContain("host-01");
  });

  it("aborted() includes optional stage in message + context", () => {
    const a = aborted();
    expect(a.code).toBe("RECOMBINATION_ABORTED");
    expect(a.context).toEqual({});

    const b = aborted("stage-4");
    expect(b.context.stage).toBe("stage-4");
    expect(b.message).toContain("stage-4");
  });

  it("interpreterJsonFailure / generatorError propagate plasmidId + cause", () => {
    const cause = new Error("bad json");
    const a = interpreterJsonFailure("p1" as PlasmidId, cause);
    expect(a.code).toBe("INTERPRETER_JSON_FAILURE");
    expect(a.context.plasmidId).toBe("p1");
    expect((a as Error & { cause?: unknown }).cause).toBe(cause);

    const b = generatorError("intent-9");
    expect(b.code).toBe("GENERATOR_ERROR");
    expect(b.context.intentId).toBe("intent-9");
  });

  it("reorgUserAreaViolation / reorgInvalidUpdateTarget carry markerId", () => {
    const a = reorgUserAreaViolation("m1");
    expect(a.code).toBe("REORG_USER_AREA_VIOLATION");
    expect(a.context.markerId).toBe("m1");

    const b = reorgInvalidUpdateTarget("m2");
    expect(b.code).toBe("REORG_INVALID_UPDATE_TARGET");
    expect(b.context.markerId).toBe("m2");
  });

  it("privacyCloudBlocked carries plasmidId and mentions it in the message", () => {
    const err = privacyCloudBlocked("secret-p" as PlasmidId);
    expect(err.code).toBe("PRIVACY_CLOUD_BLOCKED");
    expect(err.context.plasmidId).toBe("secret-p");
    expect(err.message).toContain("secret-p");
  });

  it("wiringValidationError summarises counts + findings", () => {
    const report: WiringReport = {
      findings: [
        {
          checkId: "WIRING_SYNTAX_INVALID",
          severity: "ERROR",
          message: "bad",
          artifactPath: "/x.md",
        },
      ],
      errorCount: 1,
      warnCount: 0,
      infoCount: 0,
      passed: false,
    };
    const err = wiringValidationError(report);
    expect(err.code).toBe("WIRING_VALIDATION_ERROR");
    expect(err.context.errorCount).toBe(1);
    expect(err.message).toContain("1 error");
  });

  it("localLlmUnavailable surfaces the url + cause", () => {
    const cause = new Error("ECONNREFUSED");
    const err = localLlmUnavailable("http://localhost:11434", cause);
    expect(err.code).toBe("LOCAL_LLM_UNAVAILABLE");
    expect(err.context.url).toBe("http://localhost:11434");
    expect((err as Error & { cause?: unknown }).cause).toBe(cause);
  });
});

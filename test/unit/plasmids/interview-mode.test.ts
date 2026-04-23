import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { DraftsStore } from "../../../src/plasmids/drafts.js";
import { FALLBACK_TEMPLATE } from "../../../src/plasmids/generators.js";
import {
  runInterview,
  scriptedDriver,
  type InterviewDeps,
  type InterviewStep,
} from "../../../src/plasmids/interview-mode.js";
import { QuickModeError } from "../../../src/plasmids/quick-mode.js";

async function drain(
  gen: AsyncGenerator<InterviewStep, unknown, void>,
): Promise<{ steps: InterviewStep[]; value: unknown }> {
  const steps: InterviewStep[] = [];
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const r = await gen.next();
    if (r.done) return { steps, value: r.value };
    steps.push(r.value);
  }
}

describe("runInterview", () => {
  let workingDirectory: string;
  let deps: InterviewDeps;

  beforeEach(async () => {
    workingDirectory = await mkdtemp(join(tmpdir(), "dhelix-interview-"));
    const drafts = new DraftsStore({
      workingDirectory,
      draftsPath: ".dhelix/plasmids/.drafts",
    });
    deps = {
      getTemplate: () => FALLBACK_TEMPLATE,
      drafts,
      now: () => new Date("2026-04-23T12:00:00.000Z"),
      locale: "en",
    };
  });

  afterEach(async () => {
    await rm(workingDirectory, { recursive: true, force: true });
  });

  it("walks the full happy-path and returns a QuickResult", async () => {
    const driver = scriptedDriver([
      "owasp-gate", // ask-name
      "Enforce OWASP", // ask-description
      "L2", // ask-tier
      "local", // ask-scope
      "cloud-ok", // ask-privacy
      "0", // ask-eval-samples
      "yes", // confirm
    ]);

    const ac = new AbortController();
    const gen = runInterview(deps, driver, ac.signal);
    const { steps, value } = await drain(gen);

    const kinds = steps.map((s) => s.kind);
    expect(kinds).toEqual([
      "ask-name",
      "ask-description",
      "ask-tier",
      "ask-scope",
      "ask-privacy",
      "ask-eval-samples",
      "confirm",
      "done",
    ]);

    expect(value).toMatchObject({
      plasmidId: "owasp-gate",
    });
    expect((value as { draftPath: string }).draftPath.endsWith("owasp-gate.md")).toBe(true);
  });

  it("throws when the user declines at confirm", async () => {
    const driver = scriptedDriver([
      "foo-bar",
      "desc",
      "L1",
      "local",
      "cloud-ok",
      "0",
      "no",
    ]);
    const ac = new AbortController();
    const gen = runInterview(deps, driver, ac.signal);
    await expect(drain(gen)).rejects.toBeInstanceOf(QuickModeError);
  });

  it("blocks tier=L4 with PLASMID_FOUNDATIONAL_AUTO_BLOCKED", async () => {
    const driver = scriptedDriver(["found-core", "desc", "L4"]);
    const ac = new AbortController();
    const gen = runInterview(deps, driver, ac.signal);
    await expect(drain(gen)).rejects.toMatchObject({
      code: "PLASMID_FOUNDATIONAL_AUTO_BLOCKED",
    });
  });

  it("rejects an unknown tier answer", async () => {
    const driver = scriptedDriver(["foo-bar", "desc", "L9"]);
    const ac = new AbortController();
    const gen = runInterview(deps, driver, ac.signal);
    await expect(drain(gen)).rejects.toBeInstanceOf(QuickModeError);
  });

  it("propagates AbortSignal abort at start", async () => {
    const ac = new AbortController();
    ac.abort();
    const gen = runInterview(deps, scriptedDriver([]), ac.signal);
    await expect(gen.next()).rejects.toThrow();
  });

  it("yields before asking (driver receives the exact yielded step)", async () => {
    let seen: InterviewStep | undefined;
    const driver = {
      ask: async (step: InterviewStep) => {
        seen = step;
        return "owasp-gate";
      },
    };
    const ac = new AbortController();
    const gen = runInterview(deps, driver, ac.signal);
    const first = await gen.next();
    expect(first.done).toBe(false);
    expect(first.value.kind).toBe("ask-name");
    // Drive the generator past the first ask so the driver gets the step.
    await gen.next().catch(() => undefined);
    expect(seen?.kind).toBe("ask-name");
  });

  it("scriptedDriver throws when answers run out", async () => {
    const driver = scriptedDriver(["only-one"]);
    await expect(
      driver.ask({ kind: "ask-name", prompt: "?" }),
    ).resolves.toBe("only-one");
    await expect(driver.ask({ kind: "ask-description", prompt: "?" })).rejects.toThrow(
      /exhausted/,
    );
  });
});

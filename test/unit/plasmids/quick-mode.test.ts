import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { DraftsStore } from "../../../src/plasmids/drafts.js";
import { FALLBACK_TEMPLATE } from "../../../src/plasmids/generators.js";
import {
  QUICK_MESSAGES,
  QUICK_NOTICES,
  QuickModeError,
  runQuickMode,
  slugifyPlasmidName,
  type QuickDeps,
  type QuickInput,
} from "../../../src/plasmids/quick-mode.js";
import type { PlasmidTier } from "../../../src/plasmids/types.js";

describe("slugifyPlasmidName", () => {
  it("kebab-cases simple ascii", () => {
    expect(slugifyPlasmidName("OWASP Gate")).toBe("owasp-gate");
  });

  it("squashes runs of non-alphanumerics", () => {
    expect(slugifyPlasmidName("a___b!!c")).toBe("a-b-c");
  });

  it("trims leading/trailing hyphens", () => {
    expect(slugifyPlasmidName("--owasp--")).toBe("owasp");
  });

  it("rejects strings that slugify to all non-letters", () => {
    expect(slugifyPlasmidName("한글만")).toBeNull(); // pure hangul → empty slug
    expect(slugifyPlasmidName("!!!")).toBeNull();
    expect(slugifyPlasmidName("")).toBeNull();
    expect(slugifyPlasmidName("   ")).toBeNull();
  });

  it("rejects names that start with a digit", () => {
    expect(slugifyPlasmidName("404 handler")).toBeNull();
  });

  it("enforces length 3..64", () => {
    expect(slugifyPlasmidName("ab")).toBeNull();
    expect(slugifyPlasmidName("a".repeat(65))).toBeNull();
    expect(slugifyPlasmidName("abc")).toBe("abc");
    expect(slugifyPlasmidName("a".repeat(64))).toBe("a".repeat(64));
  });

  it("accepts digits and hyphens after the first letter", () => {
    expect(slugifyPlasmidName("owasp-10-gate")).toBe("owasp-10-gate");
  });
});

describe("runQuickMode", () => {
  let workingDirectory: string;
  let drafts: DraftsStore;
  let deps: QuickDeps;
  const fixedNow = () => new Date("2026-04-23T12:00:00.000Z");

  beforeEach(async () => {
    workingDirectory = await mkdtemp(join(tmpdir(), "dhelix-quick-"));
    drafts = new DraftsStore({
      workingDirectory,
      draftsPath: ".dhelix/plasmids/.drafts",
    });
    deps = {
      getTemplate: () => FALLBACK_TEMPLATE,
      drafts,
      now: fixedNow,
    };
  });

  afterEach(async () => {
    await rm(workingDirectory, { recursive: true, force: true });
  });

  const baseInput = (overrides: Partial<QuickInput> = {}): QuickInput => ({
    name: "OWASP Gate",
    description: "OWASP Top 10 강제",
    tier: "L2",
    ...overrides,
  });

  it("persists a draft with frontmatter and returns its path + id", async () => {
    const ac = new AbortController();
    const result = await runQuickMode(baseInput(), deps, ac.signal);
    expect(result.plasmidId).toBe("owasp-gate");
    expect(result.draftPath.endsWith("owasp-gate.md")).toBe(true);

    const body = await readFile(result.draftPath, "utf8");
    expect(body).toContain("id: owasp-gate");
    expect(body).toContain('description: "OWASP Top 10 강제"');
    expect(body).toContain("tier: L2");
    expect(body).toContain("scope: local");
    expect(body).toContain("privacy: cloud-ok");
    expect(body).toContain("version: 0.1.0");
    expect(body).toContain("created: 2026-04-23T12:00:00.000Z");
    expect(body).toContain("updated: 2026-04-23T12:00:00.000Z");
  });

  it("includes the ADJ-1 warning by default (ko locale)", async () => {
    const ac = new AbortController();
    const result = await runQuickMode(baseInput(), deps, ac.signal);
    expect(result.warnings).toContain(QUICK_NOTICES.ko);
  });

  it("switches to English copy on locale=en", async () => {
    const ac = new AbortController();
    const result = await runQuickMode(baseInput({ locale: "en" }), deps, ac.signal);
    expect(result.warnings).toContain(QUICK_NOTICES.en);
  });

  it("blocks L4 with PLASMID_FOUNDATIONAL_AUTO_BLOCKED", async () => {
    const ac = new AbortController();
    await expect(
      runQuickMode(baseInput({ tier: "L4" as PlasmidTier }), deps, ac.signal),
    ).rejects.toMatchObject({
      code: "PLASMID_FOUNDATIONAL_AUTO_BLOCKED",
    });
  });

  it("rejects invalid names with PLASMID_NAME_INVALID", async () => {
    const ac = new AbortController();
    await expect(
      runQuickMode(baseInput({ name: "!!!" }), deps, ac.signal),
    ).rejects.toMatchObject({ code: "PLASMID_NAME_INVALID" });
  });

  it("falls back to the minimal template when getTemplate returns null", async () => {
    let queried = false;
    deps = {
      ...deps,
      getTemplate: () => {
        queried = true;
        return null;
      },
    };
    const ac = new AbortController();
    const result = await runQuickMode(baseInput(), deps, ac.signal);
    expect(queried).toBe(true);
    // The fallback warning is locale-sensitive.
    expect(result.warnings).toContain(QUICK_MESSAGES.ko.templateFallback);
  });

  it("aborts cleanly if signal is already aborted", async () => {
    const ac = new AbortController();
    ac.abort();
    await expect(runQuickMode(baseInput(), deps, ac.signal)).rejects.toThrow();
  });

  it("wraps render failures as PLASMID_TEMPLATE_RENDER_FAILED", async () => {
    deps = { ...deps, getTemplate: () => "bad template ${nope}" };
    const ac = new AbortController();
    await expect(runQuickMode(baseInput(), deps, ac.signal)).rejects.toBeInstanceOf(
      QuickModeError,
    );
    await expect(runQuickMode(baseInput(), deps, ac.signal)).rejects.toMatchObject({
      code: "PLASMID_TEMPLATE_RENDER_FAILED",
    });
  });

  it("returns a non-negative duration", async () => {
    const ac = new AbortController();
    const result = await runQuickMode(baseInput(), deps, ac.signal);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("records no partial files after an abort mid-write", async () => {
    const ac = new AbortController();
    ac.abort();
    await runQuickMode(baseInput(), deps, ac.signal).catch(() => undefined);
    const ids = await drafts.list();
    expect(ids).toEqual([]);
  });
});

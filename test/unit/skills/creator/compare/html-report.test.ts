/**
 * Unit tests for renderHtmlReport + writeHtmlReport + escapeHtml.
 */

import * as fsp from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  escapeHtml,
  renderHtmlReport,
  writeHtmlReport,
  type ReportInput,
} from "../../../../../src/skills/creator/compare/html-report.js";
import type { Benchmark, History } from "../../../../../src/skills/creator/evals/types.js";
import type { Comparison } from "../../../../../src/skills/creator/compare/comparator.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SAMPLE_BENCHMARK: Benchmark = {
  skill_name: "sample",
  iteration: 2,
  configs: {
    with_skill: {
      runs: [{ run_id: "r1", pass_rate: 0.8, duration_ms: 100 }],
      summary: {
        pass_rate: { mean: 0.8, stddev: 0.05, min: 0.75, max: 0.85 },
        duration_ms: { mean: 100, stddev: 5, min: 95, max: 105 },
      },
    },
    baseline: {
      runs: [{ run_id: "r2", pass_rate: 0.5, duration_ms: 80 }],
      summary: {
        pass_rate: { mean: 0.5, stddev: 0.1, min: 0.4, max: 0.6 },
        duration_ms: { mean: 80, stddev: 4, min: 76, max: 84 },
      },
    },
  },
  delta: { pass_rate: 0.3, duration_ms: 20 },
};

const SAMPLE_HISTORY: History = {
  skill_name: "sample",
  entries: [
    {
      version: 0,
      parent_version: null,
      description: "initial-version-label",
      skill_md_hash: "abc123def456",
      expectation_pass_rate: 0.5,
      grading_result: "baseline",
      created_at: "2026-04-01T00:00:00.000Z",
    },
    {
      version: 1,
      parent_version: 0,
      description: "second-version-label",
      skill_md_hash: "deadbeef0000",
      expectation_pass_rate: 0.8,
      grading_result: "won",
      created_at: "2026-04-02T00:00:00.000Z",
    },
  ],
};

const SAMPLE_COMPARISON: Comparison = {
  skill_name: "sample",
  iteration_a: 2,
  iteration_b: 1,
  a_wins: 3,
  b_wins: 1,
  ties: 1,
  rubric_a: { content: 4, structure: 3.5, safety: 5, trigger_alignment: 4 },
  rubric_b: { content: 3, structure: 4, safety: 3, trigger_alignment: 2 },
  per_case_winners: [
    { case_id: "c1", winner: "A", reason: "more accurate" },
    { case_id: "c2", winner: "B", reason: "shorter" },
    { case_id: "c3", winner: "tie", reason: "equivalent" },
  ],
};

const SAMPLE_SKILL_MD = "# Sample Skill\n\nSome markdown body with <script>alert(1)</script>.";

// ---------------------------------------------------------------------------
// escapeHtml
// ---------------------------------------------------------------------------

describe("escapeHtml", () => {
  it("escapes &, <, >, \", '", () => {
    expect(escapeHtml("&")).toBe("&amp;");
    expect(escapeHtml("<")).toBe("&lt;");
    expect(escapeHtml(">")).toBe("&gt;");
    expect(escapeHtml('"')).toBe("&quot;");
    expect(escapeHtml("'")).toBe("&#39;");
  });
  it("handles combined input correctly", () => {
    expect(escapeHtml("<a href=\"x&y\">Q's</a>")).toBe(
      "&lt;a href=&quot;x&amp;y&quot;&gt;Q&#39;s&lt;/a&gt;",
    );
  });
  it("preserves plain text", () => {
    expect(escapeHtml("hello world")).toBe("hello world");
  });
});

// ---------------------------------------------------------------------------
// renderHtmlReport
// ---------------------------------------------------------------------------

describe("renderHtmlReport", () => {
  it("all-null input → HTML doc mentions 'no data'", () => {
    const html = renderHtmlReport({
      skillName: "empty-skill",
      iteration: 0,
      benchmark: null,
      history: null,
      comparison: null,
      skillMd: null,
      generatedAt: "2026-04-17T00:00:00.000Z",
    });
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("<style>");
    expect(html).toContain("</html>");
    expect(html.toLowerCase()).toContain("no data");
    expect(html).toContain("empty-skill");
  });

  it("renders a valid HTML document with full input", () => {
    const input: ReportInput = {
      skillName: "sample",
      iteration: 2,
      benchmark: SAMPLE_BENCHMARK,
      history: SAMPLE_HISTORY,
      comparison: SAMPLE_COMPARISON,
      skillMd: SAMPLE_SKILL_MD,
      generatedAt: "2026-04-17T12:00:00.000Z",
    };
    const html = renderHtmlReport(input);
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("</html>");
    expect(html).toContain("<style>");
    // Skill name
    expect(html).toContain("sample");
    // Benchmark pass rate (80.0%)
    expect(html).toContain("80.0%");
    // History version labels
    expect(html).toContain("initial-version-label");
    expect(html).toContain("second-version-label");
    // Comparison totals
    expect(html).toContain("A wins");
    expect(html).toContain("3");
    expect(html).toContain("iteration 2 vs 1");
  });

  it("escapes SKILL.md body (no raw <script>)", () => {
    const html = renderHtmlReport({
      skillName: "s",
      iteration: 0,
      benchmark: null,
      history: null,
      comparison: null,
      skillMd: SAMPLE_SKILL_MD,
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("handles comparison without benchmark/history", () => {
    const html = renderHtmlReport({
      skillName: "s",
      iteration: 2,
      benchmark: null,
      history: null,
      comparison: SAMPLE_COMPARISON,
      skillMd: null,
    });
    expect(html).toContain("Comparison");
    expect(html).toContain("c1");
    expect(html).toContain("more accurate");
  });
});

// ---------------------------------------------------------------------------
// writeHtmlReport
// ---------------------------------------------------------------------------

describe("writeHtmlReport", () => {
  let work: string;
  beforeEach(async () => {
    work = await fsp.mkdtemp(join(tmpdir(), "html-report-"));
  });
  afterEach(async () => {
    await fsp.rm(work, { recursive: true, force: true });
  });

  it("writes the rendered HTML to disk, creating parent dir", async () => {
    const out = join(work, "nested", "deep", "report.html");
    const written = await writeHtmlReport(out, {
      skillName: "sample",
      iteration: 0,
      benchmark: null,
      history: null,
      comparison: null,
      skillMd: "body",
    });
    expect(written).toBe(out);
    const raw = await fsp.readFile(out, "utf8");
    expect(raw.startsWith("<!doctype html>")).toBe(true);
    expect(raw).toContain("sample");
  });
});

/**
 * Standalone HTML report renderer for a single skill iteration.
 *
 * Pure function: no I/O by default. `writeHtmlReport` is a thin convenience
 * wrapper that accepts an injectable fs implementation.
 *
 * Output is self-contained (inline `<style>`, inline SVG for the rubric bar
 * chart) and lightweight (<10 KB typical for small skills).
 *
 * @see src/skills/creator/compare/comparator.ts — produces `Comparison`
 * @see src/commands/skill-review.ts — invokes this to write report.html
 */

import * as defaultFs from "node:fs/promises";
import { dirname } from "node:path";
import type { Benchmark, History } from "../evals/types.js";
import type { Comparison, RubricScore } from "./comparator.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ReportInput {
  readonly skillName: string;
  readonly iteration: number;
  readonly benchmark: Benchmark | null;
  readonly history: History | null;
  readonly comparison: Comparison | null;
  readonly skillMd: string | null;
  /** Optional override for the timestamp shown in the header (testing). */
  readonly generatedAt?: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Render a standalone HTML document. Always returns a non-empty string. */
export function renderHtmlReport(input: ReportInput): string {
  const title = `${input.skillName} — iteration ${String(input.iteration)}`;
  const ts = input.generatedAt ?? new Date().toISOString();

  const hasAnyData =
    input.benchmark !== null ||
    input.history !== null ||
    input.comparison !== null ||
    (input.skillMd !== null && input.skillMd.length > 0);

  const body = hasAnyData
    ? [
        renderHeader(input, ts),
        renderBenchmarkSection(input.benchmark),
        renderHistorySection(input.history),
        renderComparisonSection(input.comparison),
        renderSkillMdSection(input.skillMd),
      ].join("\n")
    : renderEmptyState(input, ts);

  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width,initial-scale=1" />',
    `<title>${escapeHtml(title)}</title>`,
    `<style>${STYLES}</style>`,
    "</head>",
    "<body>",
    body,
    "</body>",
    "</html>",
  ].join("\n");
}

/**
 * Convenience writer — renders and writes to disk, creating parent dir.
 * @returns the absolute output path that was written.
 */
export async function writeHtmlReport(
  outputPath: string,
  input: ReportInput,
  fs: typeof defaultFs = defaultFs,
): Promise<string> {
  const html = renderHtmlReport(input);
  await fs.mkdir(dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, html, "utf8");
  return outputPath;
}

// ---------------------------------------------------------------------------
// Section renderers
// ---------------------------------------------------------------------------

function renderHeader(input: ReportInput, ts: string): string {
  return [
    '<header class="rpt-header">',
    `<h1>${escapeHtml(input.skillName)}</h1>`,
    `<p class="rpt-sub">Iteration <strong>${String(input.iteration)}</strong> · generated ${escapeHtml(ts)}</p>`,
    "</header>",
  ].join("\n");
}

function renderEmptyState(input: ReportInput, ts: string): string {
  return [
    '<header class="rpt-header">',
    `<h1>${escapeHtml(input.skillName)}</h1>`,
    `<p class="rpt-sub">Iteration <strong>${String(input.iteration)}</strong> · generated ${escapeHtml(ts)}</p>`,
    "</header>",
    '<section class="rpt-empty"><p><em>no data available for this iteration yet.</em></p></section>',
  ].join("\n");
}

function renderBenchmarkSection(b: Benchmark | null): string {
  if (!b) {
    return '<section class="rpt-section"><h2>Benchmark</h2><p class="rpt-muted">No benchmark.json.</p></section>';
  }
  const rows: string[] = [];
  for (const [name, cfg] of Object.entries(b.configs)) {
    const passRate = cfg.summary.pass_rate;
    const dur = cfg.summary.duration_ms;
    rows.push(
      "<tr>" +
        `<td>${escapeHtml(name)}</td>` +
        `<td>${formatPct(passRate.mean)}</td>` +
        `<td>±${formatPct(passRate.stddev)}</td>` +
        `<td>${formatMs(dur.mean)}</td>` +
        `<td>${String(cfg.runs.length)}</td>` +
        "</tr>",
    );
  }
  const deltaLine = b.delta
    ? `<p class="rpt-delta">Delta (with_skill − baseline): pass_rate <strong>${formatDelta(b.delta.pass_rate)}</strong> · duration <strong>${formatMsDelta(b.delta.duration_ms)}</strong></p>`
    : "";
  return [
    '<section class="rpt-section">',
    "<h2>Benchmark</h2>",
    '<table class="rpt-table"><thead><tr><th>config</th><th>pass rate</th><th>stddev</th><th>mean duration</th><th>n runs</th></tr></thead><tbody>',
    rows.join(""),
    "</tbody></table>",
    deltaLine,
    "</section>",
  ].join("\n");
}

function renderHistorySection(h: History | null): string {
  if (!h || h.entries.length === 0) {
    return '<section class="rpt-section"><h2>History</h2><p class="rpt-muted">No history.json.</p></section>';
  }
  const rows = h.entries
    .map(
      (e) =>
        "<tr>" +
        `<td>${String(e.version)}</td>` +
        `<td>${escapeHtml(e.description)}</td>` +
        `<td>${formatPct(e.expectation_pass_rate)}</td>` +
        `<td><span class="rpt-tag rpt-tag-${escapeHtml(e.grading_result)}">${escapeHtml(e.grading_result)}</span></td>` +
        `<td><code>${escapeHtml(e.skill_md_hash)}</code></td>` +
        "</tr>",
    )
    .join("");
  return [
    '<section class="rpt-section">',
    "<h2>History</h2>",
    '<table class="rpt-table"><thead><tr><th>version</th><th>description</th><th>pass rate</th><th>outcome</th><th>hash</th></tr></thead><tbody>',
    rows,
    "</tbody></table>",
    "</section>",
  ].join("\n");
}

function renderComparisonSection(c: Comparison | null): string {
  if (!c) {
    return '<section class="rpt-section"><h2>Comparison</h2><p class="rpt-muted">No comparison requested.</p></section>';
  }
  const totals =
    `<p class="rpt-totals">A wins: <strong>${String(c.a_wins)}</strong> · ` +
    `B wins: <strong>${String(c.b_wins)}</strong> · ` +
    `ties: <strong>${String(c.ties)}</strong> ` +
    `<span class="rpt-muted">(iteration ${String(c.iteration_a)} vs ${String(c.iteration_b)})</span></p>`;

  const rubricChart = renderRubricChart(c.rubric_a, c.rubric_b);

  const caseRows = c.per_case_winners
    .map(
      (p) =>
        "<tr>" +
        `<td><code>${escapeHtml(p.case_id)}</code></td>` +
        `<td><span class="rpt-tag rpt-tag-${escapeHtml(p.winner)}">${escapeHtml(p.winner)}</span></td>` +
        `<td>${escapeHtml(p.reason)}</td>` +
        "</tr>",
    )
    .join("");

  return [
    '<section class="rpt-section">',
    "<h2>Comparison</h2>",
    totals,
    rubricChart,
    '<table class="rpt-table"><thead><tr><th>case</th><th>winner</th><th>reason</th></tr></thead><tbody>',
    caseRows,
    "</tbody></table>",
    "</section>",
  ].join("\n");
}

function renderSkillMdSection(skillMd: string | null): string {
  if (!skillMd) {
    return '<section class="rpt-section"><h2>SKILL.md</h2><p class="rpt-muted">No SKILL.md loaded.</p></section>';
  }
  return [
    '<section class="rpt-section">',
    "<h2>SKILL.md</h2>",
    `<pre class="rpt-md"><code>${escapeHtml(skillMd)}</code></pre>`,
    "</section>",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Rubric chart (inline SVG bars)
// ---------------------------------------------------------------------------

function renderRubricChart(a: RubricScore, b: RubricScore): string {
  const rows: { readonly label: string; readonly a: number; readonly b: number }[] = [
    { label: "content", a: a.content, b: b.content },
    { label: "structure", a: a.structure, b: b.structure },
    { label: "safety", a: a.safety, b: b.safety },
    { label: "trigger_alignment", a: a.trigger_alignment, b: b.trigger_alignment },
  ];

  const barMax = 180; // px per 5.0 points
  const lines: string[] = [];
  lines.push('<div class="rpt-rubric">');
  for (const row of rows) {
    const aw = (row.a / 5) * barMax;
    const bw = (row.b / 5) * barMax;
    lines.push(
      '<div class="rpt-rubric-row">' +
        `<span class="rpt-rubric-label">${escapeHtml(row.label)}</span>` +
        `<svg class="rpt-rubric-bar" width="${String(barMax + 4)}" height="18">` +
        `<rect x="0" y="2" width="${aw.toFixed(1)}" height="6" fill="#4f8cff"></rect>` +
        `<rect x="0" y="10" width="${bw.toFixed(1)}" height="6" fill="#ff8c4f"></rect>` +
        "</svg>" +
        `<span class="rpt-rubric-score">A ${row.a.toFixed(2)} · B ${row.b.toFixed(2)}</span>` +
        "</div>",
    );
  }
  lines.push(
    '<p class="rpt-legend"><span class="rpt-swatch" style="background:#4f8cff"></span>A ' +
      '<span class="rpt-swatch" style="background:#ff8c4f"></span>B</p>',
  );
  lines.push("</div>");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Formatting + escaping helpers
// ---------------------------------------------------------------------------

/** Escape `&`, `<`, `>`, `"`, and `'` for safe HTML text/attribute embedding. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatPct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

function formatMs(v: number): string {
  return `${v.toFixed(0)}ms`;
}

function formatDelta(v: number): string {
  const pct = v * 100;
  const sign = v >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

function formatMsDelta(v: number): string {
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(0)}ms`;
}

// ---------------------------------------------------------------------------
// Styles (inline, no external assets)
// ---------------------------------------------------------------------------

const STYLES = `
  :root { color-scheme: light dark; }
  body { font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    margin: 0; padding: 24px; max-width: 960px; margin-inline: auto; color: #1a1a1a;
    background: #fafafa; }
  .rpt-header { border-bottom: 1px solid #ddd; padding-bottom: 12px; margin-bottom: 24px; }
  .rpt-header h1 { margin: 0 0 4px 0; font-size: 24px; }
  .rpt-sub { margin: 0; color: #666; font-size: 13px; }
  .rpt-section { margin: 24px 0; padding: 16px; background: #fff; border: 1px solid #e5e5e5;
    border-radius: 8px; }
  .rpt-section h2 { margin: 0 0 12px 0; font-size: 16px; text-transform: uppercase;
    letter-spacing: 0.05em; color: #333; }
  .rpt-muted { color: #888; font-style: italic; }
  .rpt-empty { text-align: center; padding: 48px; color: #888; }
  .rpt-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .rpt-table th, .rpt-table td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #eee; }
  .rpt-table th { background: #f5f5f5; font-weight: 600; }
  .rpt-tag { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 12px;
    font-weight: 600; background: #eee; }
  .rpt-tag-won, .rpt-tag-A { background: #d4f4dd; color: #1b6e2e; }
  .rpt-tag-lost, .rpt-tag-B { background: #fde0df; color: #9a2a24; }
  .rpt-tag-tie, .rpt-tag-baseline { background: #e8e8e8; color: #444; }
  .rpt-delta, .rpt-totals { margin: 8px 0 0 0; font-size: 13px; }
  .rpt-md { background: #1e1e1e; color: #eee; padding: 16px; border-radius: 6px;
    overflow: auto; font-size: 12px; line-height: 1.5; max-height: 480px; }
  .rpt-rubric { margin: 12px 0; }
  .rpt-rubric-row { display: grid; grid-template-columns: 140px auto 180px; gap: 8px;
    align-items: center; margin-bottom: 4px; }
  .rpt-rubric-label { font-size: 12px; color: #555; }
  .rpt-rubric-score { font-size: 12px; color: #444; font-variant-numeric: tabular-nums; }
  .rpt-legend { font-size: 12px; color: #666; margin-top: 8px; }
  .rpt-swatch { display: inline-block; width: 10px; height: 10px; border-radius: 2px;
    margin: 0 4px 0 8px; vertical-align: middle; }
`;

/**
 * Phase 5 — `/plasmid inspect compression <id>` subcommand.
 *
 * Reads the most recent `RecombinationTranscript` for the plasmid and prints
 * body→summary token counts, compression ratio, and preserved-constraint
 * list. Pure — no LLM call.
 *
 * Owned by Team 5 — Phase 5 GAL-1 dev-guide §6.
 */

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

import type { LoadedPlasmid, PlasmidId } from "../../plasmids/types.js";
import { RECOMBINATION_TRANSCRIPTS_DIR } from "../../recombination/types.js";
import type { RecombinationTranscript } from "../../recombination/types.js";
import type { CommandContext, CommandResult } from "../registry.js";
import type { CommandDeps } from "./deps.js";

type InspectTopic = "compression";
const SUPPORTED_TOPICS: readonly InspectTopic[] = ["compression"];

export async function inspectSubcommand(
  args: readonly string[],
  context: CommandContext,
  deps: CommandDeps,
): Promise<CommandResult> {
  const parsed = parseArgs(args);
  if ("error" in parsed) return { output: parsed.error, success: false };

  const { loaded } = await deps.loadPlasmids({
    workingDirectory: context.workingDirectory,
    registryPath: deps.registryPath,
    sharedRegistryPath: deps.sharedRegistryPath,
    draftsPath: deps.draftsPath,
    scopes: deps.scopes,
  });
  const target = loaded.find((p) => p.metadata.id === parsed.id);
  if (!target) {
    return {
      output: `Plasmid not found: ${parsed.id}`,
      success: false,
    };
  }

  switch (parsed.topic) {
    case "compression":
      return inspectCompression(target, context, deps);
  }
}

interface ParsedArgs {
  readonly topic: InspectTopic;
  readonly id: string;
}

function parseArgs(args: readonly string[]): ParsedArgs | { error: string } {
  const usage =
    "Usage: /plasmid inspect <topic> <id>\n" +
    `Topics: ${SUPPORTED_TOPICS.join(", ")}`;
  const positional: string[] = [];
  for (const tok of args) {
    if (tok.startsWith("--")) {
      return { error: `Unknown flag: ${tok}.\n\n${usage}` };
    }
    positional.push(tok);
  }
  if (positional.length < 2) {
    return { error: `Missing arguments.\n\n${usage}` };
  }
  if (positional.length > 2) {
    return { error: `Too many arguments.\n\n${usage}` };
  }
  const [topic, id] = positional as [string, string];
  if (!isInspectTopic(topic)) {
    return {
      error:
        `Unknown topic: '${topic}'. Supported: ${SUPPORTED_TOPICS.join(", ")}.\n\n` +
        usage,
    };
  }
  return { topic, id };
}

function isInspectTopic(s: string): s is InspectTopic {
  return (SUPPORTED_TOPICS as readonly string[]).includes(s);
}

async function inspectCompression(
  target: LoadedPlasmid,
  context: CommandContext,
  deps: CommandDeps,
): Promise<CommandResult> {
  const plasmidId = target.metadata.id;
  const transcriptsDir = join(context.workingDirectory, RECOMBINATION_TRANSCRIPTS_DIR);
  void deps;

  const transcript = await findLatestTranscriptForPlasmid(transcriptsDir, plasmidId);
  if (transcript === null) {
    return {
      output: [
        `No recombination transcript references plasmid '${plasmidId}'.`,
        "",
        "Run `/recombination` (or `/recombination --plasmid <id>`) first to",
        "produce a transcript that includes this plasmid.",
      ].join("\n"),
      success: false,
    };
  }

  const sectionFiles = transcript.writtenFiles.filter((f) =>
    isPromptSectionGeneratedFile(f.path),
  );

  let combinedSummaryMarkdown = "";
  let summaryTokens = 0;
  let summaryFoundIn: string | null = null;
  for (const sectionFile of sectionFiles) {
    let content: string;
    try {
      content = await readFile(sectionFile.path, "utf-8");
    } catch {
      continue;
    }
    const summary = extractPlasmidSummary(content, plasmidId);
    if (summary === null) continue;
    combinedSummaryMarkdown = summary;
    summaryTokens = estimateTokensCharBased(summary);
    summaryFoundIn = sectionFile.path;
    break;
  }

  const bodyTokens = estimateTokensWordBased(target.body);
  const ratio =
    bodyTokens === 0 ? 0 : summaryTokens === 0 ? 0 : summaryTokens / bodyTokens;
  const preservedConstraints =
    summaryFoundIn !== null
      ? extractPreservedConstraints(combinedSummaryMarkdown)
      : [];

  const lines: string[] = [
    `Compression report for plasmid '${plasmidId}'`,
    `  transcript:  ${transcript.id}`,
    `  body tokens: ~${bodyTokens} (estimate: word-count × 1.3)`,
  ];
  if (summaryFoundIn !== null) {
    lines.push(
      `  summary:     ${summaryFoundIn}`,
      `  summary tokens: ~${summaryTokens} (estimate: chars / 4)`,
      `  compression ratio: ${formatRatio(ratio)}`,
    );
  } else {
    lines.push(
      "  summary:     <not found in this transcript's section files>",
      "  summary tokens: 0",
      "  compression ratio: n/a",
    );
  }
  lines.push("", "Preserved constraints:");
  if (preservedConstraints.length === 0) {
    lines.push("  (none)");
  } else {
    for (const c of preservedConstraints) {
      lines.push(`  - ${c}`);
    }
  }

  return { output: lines.join("\n"), success: true };
}

/**
 * Walks the transcripts directory in reverse-lexical order (newest id first)
 * and returns the first transcript whose `activePlasmidIds` contains the
 * target plasmid id. Returns null when nothing matches OR the directory is
 * missing — both surface the same graceful "no transcript" error to the
 * caller.
 */
async function findLatestTranscriptForPlasmid(
  transcriptsDir: string,
  plasmidId: PlasmidId,
): Promise<RecombinationTranscript | null> {
  let entries: readonly string[];
  try {
    entries = await readdir(transcriptsDir);
  } catch {
    return null;
  }
  const ids = entries
    .filter((f) => f.endsWith(".json"))
    .sort()
    .reverse();
  for (const name of ids) {
    const fullPath = join(transcriptsDir, name);
    let raw: string;
    try {
      raw = await readFile(fullPath, "utf-8");
    } catch {
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    if (!isTranscriptShape(parsed)) continue;
    if (parsed.activePlasmidIds.includes(plasmidId)) {
      return parsed;
    }
  }
  return null;
}

function isTranscriptShape(value: unknown): value is RecombinationTranscript {
  if (typeof value !== "object" || value === null) return false;
  const v = value as { activePlasmidIds?: unknown; writtenFiles?: unknown };
  return (
    Array.isArray(v.activePlasmidIds) &&
    v.activePlasmidIds.every((id) => typeof id === "string") &&
    Array.isArray(v.writtenFiles)
  );
}

/**
 * `prompt-sections/generated/*.md` lives under `.dhelix/`. Match on the
 * relative segment so absolute paths from `transcript.writtenFiles` (which
 * always include `.dhelix/prompt-sections/generated/<file>.md`) are picked
 * up regardless of platform path separator.
 */
function isPromptSectionGeneratedFile(path: string): boolean {
  const normalised = path.replace(/\\/g, "/");
  return /\/prompt-sections\/generated\/[^/]+\.md$/u.test(normalised);
}

/**
 * Extract the markdown between `<!-- BEGIN plasmid: <id> -->` and
 * `<!-- END plasmid: <id> -->` markers in a section file.
 */
function extractPlasmidSummary(
  sectionMarkdown: string,
  plasmidId: PlasmidId,
): string | null {
  const escaped = plasmidId.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  const re = new RegExp(
    `<!--\\s*BEGIN plasmid:\\s*${escaped}\\s*-->([\\s\\S]*?)<!--\\s*END plasmid:\\s*${escaped}\\s*-->`,
    "u",
  );
  const match = re.exec(sectionMarkdown);
  if (match === null) return null;
  return (match[1] ?? "").trim();
}

/**
 * Heuristic preserved-constraint extractor: each summary section emitted by
 * the compression layer marks constraints with a `Constraints:` label or as
 * lines beginning with `- ` directly under such a label. We accept either
 * convention so newer formats keep working.
 */
function extractPreservedConstraints(summaryMarkdown: string): readonly string[] {
  const out: string[] = [];
  const lines = summaryMarkdown.split(/\r?\n/);
  let inConstraints = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (/^constraints?\s*:/iu.test(line)) {
      inConstraints = true;
      // Inline form: `Constraints: a; b; c`
      const inline = line.replace(/^constraints?\s*:\s*/iu, "").trim();
      if (inline.length > 0) {
        for (const piece of inline.split(/[;,]/u)) {
          const trimmed = piece.trim();
          if (trimmed.length > 0) out.push(trimmed);
        }
      }
      continue;
    }
    if (inConstraints) {
      if (line === "" || /^#/u.test(line)) {
        inConstraints = false;
        continue;
      }
      const bullet = /^[-*]\s+(.*)$/u.exec(line);
      if (bullet !== null && bullet[1] !== undefined) {
        out.push(bullet[1].trim());
        continue;
      }
      // First non-bullet, non-empty line ends the constraint list.
      inConstraints = false;
    }
  }
  return out;
}

/** Body tokens: word-count × 1.3 (per dev-guide §6). */
function estimateTokensWordBased(text: string): number {
  const words = text.trim().split(/\s+/u).filter((s) => s.length > 0);
  return Math.round(words.length * 1.3);
}

/** Summary tokens: char-count / 4 (per dev-guide §6). */
function estimateTokensCharBased(text: string): number {
  return Math.round(text.length / 4);
}

function formatRatio(ratio: number): string {
  if (!isFinite(ratio) || ratio <= 0) return "n/a";
  const pct = (ratio * 100).toFixed(1);
  return `${ratio.toFixed(3)} (${pct}%)`;
}

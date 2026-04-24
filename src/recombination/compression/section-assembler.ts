/**
 * Layer C — bucket assembler (P-1.13 §4).
 *
 * Merges multiple `CompressedPlasmidSummary` records that share a bucket
 * into a single markdown file body. The file body follows the P-1.13 §4.2
 * format with `<!-- BEGIN plasmid: ... -->` / `<!-- END plasmid: ... -->`
 * markers so future "cure" operations can remove or update individual
 * plasmid sections without touching neighbours (I-9 respect).
 *
 * This layer never invokes an LLM and never writes to disk — it returns
 * in-memory `AssembledSection` objects. Stage 4 persistence is Team 5's job.
 */

import type { PlasmidId } from "../../plasmids/types.js";
import type {
  AssembledSection,
  CompressedPlasmidSummary,
  PromptSectionBucket,
} from "../types.js";
import { PROMPT_SECTIONS_GENERATED_DIR } from "../types.js";

import { estimateTokens } from "./token-estimator.js";

/** Map buckets → (file basename, human heading). */
const BUCKET_FILES: Readonly<
  Record<PromptSectionBucket, { readonly file: string; readonly heading: string }>
> = {
  principles: {
    file: "60-principles.md",
    heading: "## Principles",
  },
  "domain-knowledge": {
    file: "65-domain-knowledge.md",
    heading: "## Domain Knowledge",
  },
  constraints: {
    file: "70-project-constraints.md",
    heading: "## Project Constraints",
  },
  capabilities: {
    file: "75-active-capabilities.md",
    heading: "## Active Capabilities",
  },
  "project-profile": {
    file: "40-project-profile.md",
    heading: "## Project Profile",
  },
};

/**
 * Assemble one `AssembledSection` per plasmid-backed bucket. The
 * `project-profile` bucket is authored by Layer D elsewhere and not
 * produced here.
 */
export function assembleSections(
  summaries: readonly CompressedPlasmidSummary[],
): readonly AssembledSection[] {
  if (summaries.length === 0) return [];

  const buckets = new Map<PromptSectionBucket, CompressedPlasmidSummary[]>();
  for (const s of summaries) {
    if (s.bucket === "project-profile") continue; // Layer D owns this.
    let list = buckets.get(s.bucket);
    if (!list) {
      list = [];
      buckets.set(s.bucket, list);
    }
    list.push(s);
  }

  const sections: AssembledSection[] = [];
  for (const bucket of orderedBuckets(buckets.keys())) {
    const list = buckets.get(bucket);
    if (!list || list.length === 0) continue;
    sections.push(renderBucket(bucket, list));
  }
  return sections;
}

/** Stable bucket order for deterministic output across runs. */
function orderedBuckets(
  keys: IterableIterator<PromptSectionBucket>,
): readonly PromptSectionBucket[] {
  const order: PromptSectionBucket[] = [
    "principles",
    "domain-knowledge",
    "constraints",
    "capabilities",
  ];
  const present = new Set(keys);
  return order.filter((k) => present.has(k));
}

function renderBucket(
  bucket: PromptSectionBucket,
  summaries: readonly CompressedPlasmidSummary[],
): AssembledSection {
  const meta = BUCKET_FILES[bucket];
  const ordered = [...summaries].sort((a, b) =>
    a.plasmidId.localeCompare(b.plasmidId),
  );
  const sources = ordered.map((s) => s.plasmidId).join(", ");

  const lines: string[] = [
    `<!-- GENERATED — do not edit directly. Sources: ${sources} -->`,
    "",
    meta.heading,
    "",
  ];
  for (const s of ordered) {
    lines.push(`<!-- BEGIN plasmid: ${s.plasmidId} -->`);
    lines.push(s.markdown.trim());
    lines.push(`<!-- END plasmid: ${s.plasmidId} -->`);
    lines.push("");
  }
  const markdown = lines.join("\n").replace(/\n{3,}/gu, "\n\n").trimEnd() + "\n";

  const memberIds: readonly PlasmidId[] = ordered.map((s) => s.plasmidId);
  return {
    bucket,
    relativePath: `${PROMPT_SECTIONS_GENERATED_DIR}/${meta.file}`,
    markdown,
    tokenEstimate: estimateTokens(markdown),
    memberPlasmidIds: memberIds,
  };
}

/** Exposed for Layer D + tests so the project-profile path is uniform. */
export function projectProfileRelativePath(): string {
  return `${PROMPT_SECTIONS_GENERATED_DIR}/${BUCKET_FILES["project-profile"].file}`;
}

/** Heading used by Layer D output — keeps the project-profile file visually consistent. */
export function projectProfileHeading(): string {
  return BUCKET_FILES["project-profile"].heading;
}

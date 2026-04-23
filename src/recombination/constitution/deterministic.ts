/**
 * Deterministic fallback planner (Tier 3) — P-1.15 §6.
 *
 * Pure function: given the existing DHELIX.md + the interpreter IR graph,
 * compute a {@link ReorgPlan} that never invokes the LLM. Used as:
 *   - the sole planner when `reorgFallback === "deterministic-only"`,
 *   - the ultimate fallback when LLM JSON + XML both fail,
 *   - the reference implementation for tests / audits.
 *
 * Algorithm:
 *   1. `keep` user sections (implicit — no op emitted).
 *   2. For each (plasmid intent → expected marker-id):
 *        - present and still active  → `update` (refresh body).
 *        - present but plasmid inactive → `remove`.
 *        - absent → `insert` after the last marker (or EOF).
 *
 * The marker-id schema is {@link buildMarkerId}: `<plasmid-id>/<slug>`.
 *
 * Layer: Core (Layer 2). Leaf-pure.
 */

import type {
  CompiledPlasmidIR,
  PlasmidIntentNode,
  ReorgOp,
  ReorgPlan,
} from "../types.js";
import { buildMarkerId } from "./marker.js";
import type { SectionTree } from "./section-tree.js";
import { listMarkerSections } from "./section-tree.js";

/**
 * Build a deterministic {@link ReorgPlan} given the existing constitution tree
 * and the set of active plasmid IRs.
 *
 * Marker-id stability: `<plasmid-id>/<kebab(intent.title)>`. Same inputs →
 * same marker-ids → same plan, bit-for-bit.
 *
 * `preReorgContentHash` / `intentGraphHash` are passed-through by the caller —
 * this function only concerns itself with the ops list.
 */
export function buildDeterministicPlan(args: {
  readonly beforeTree: SectionTree;
  readonly irs: readonly CompiledPlasmidIR[];
  readonly preReorgContentHash: string;
  readonly intentGraphHash: string;
}): ReorgPlan {
  const { beforeTree, irs, preReorgContentHash, intentGraphHash } = args;
  const ops: ReorgOp[] = [];
  const existingMarkers = listMarkerSections(beforeTree);
  const existingById = new Map(existingMarkers.map((m) => [m.markerId, m]));

  // 1. Compute the expected marker-id set for the currently-active intents.
  const expectedIntents = new Map<string, { ir: CompiledPlasmidIR; intent: PlasmidIntentNode }>();
  for (const ir of irs) {
    for (const intent of ir.intents) {
      const id = buildMarkerId(ir.plasmidId, intent.title);
      if (!expectedIntents.has(id)) {
        expectedIntents.set(id, { ir, intent });
      }
    }
  }

  // 2. Anchor: last existing marker (insert after it); otherwise EOF.
  const lastMarker = existingMarkers[existingMarkers.length - 1];
  const insertAnchor = lastMarker ? lastMarker.markerId : "__END_OF_FILE__";

  // 3. Updates + keeps for existing markers.
  const keptMarkerIds: string[] = [];
  for (const marker of existingMarkers) {
    const expected = expectedIntents.get(marker.markerId);
    if (expected) {
      const body = renderIntentBody(expected.intent);
      const heading = renderIntentHeading(expected.intent);
      const nextBody = `## ${heading}\n\n${body}`;
      if (nextBody.trim() === marker.body.trim()) {
        keptMarkerIds.push(marker.markerId);
      } else {
        ops.push({
          kind: "update",
          markerId: marker.markerId,
          heading,
          body: nextBody,
          sourcePlasmid: expected.ir.plasmidId,
        });
      }
    } else {
      // plasmid gone → remove.
      ops.push({
        kind: "remove",
        markerId: marker.markerId,
        heading: "",
        body: "",
      });
    }
  }

  // 4. Inserts for brand-new intents.
  for (const [markerId, { ir, intent }] of expectedIntents) {
    if (existingById.has(markerId)) continue;
    const heading = renderIntentHeading(intent);
    const body = `## ${heading}\n\n${renderIntentBody(intent)}`;
    ops.push({
      kind: "insert",
      markerId,
      heading,
      body,
      locationAfter: insertAnchor,
      sourcePlasmid: ir.plasmidId,
    });
  }

  return {
    ops,
    keptMarkerIds,
    preReorgContentHash,
    intentGraphHash,
    fallbackTier: "deterministic-only",
  };
}

function renderIntentHeading(intent: PlasmidIntentNode): string {
  return intent.title.trim() || "Section";
}

function renderIntentBody(intent: PlasmidIntentNode): string {
  const lines: string[] = [];
  const description = intent.description.trim();
  if (description.length > 0) lines.push(description);

  if (intent.constraints.length > 0) {
    lines.push("", "**Constraints:**");
    for (const c of intent.constraints) {
      lines.push(`- ${c.trim()}`);
    }
  }

  if (intent.evidence.length > 0) {
    lines.push("", "**Evidence:**");
    for (const e of intent.evidence) {
      lines.push(`- ${e.trim()}`);
    }
  }

  return lines.join("\n").trim();
}

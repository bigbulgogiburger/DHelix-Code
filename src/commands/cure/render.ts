/**
 * `/cure` report renderer — Team 4 Phase 3. Matches PRD §6.4.3 layout.
 */
import type { CureResult } from "../../recombination/types.js";

export const renderCureReport: (result: CureResult) => string = (result) => {
  const lines: string[] = [];
  const executed = result.executed;
  const header = executed ? "🧬 /cure — restored" : "🧬 /cure — preview";
  lines.push(header);
  lines.push(`  timestamp: ${new Date().toISOString()}`);
  lines.push(
    `  transcripts: ${
      result.plan.transcriptIds.length > 0
        ? result.plan.transcriptIds.join(", ")
        : "(none)"
    }`,
  );
  lines.push("");

  lines.push("  Plan:");
  for (const line of result.plan.preview.split("\n")) {
    lines.push(`    ${line}`);
  }
  lines.push("");

  if (executed) {
    lines.push(`  Deleted ${result.filesDeleted.length} file(s):`);
    for (const path of result.filesDeleted) {
      lines.push(`    ✓ ${path}`);
    }
    if (result.filesDeleted.length === 0) lines.push("    (none)");
    lines.push("");

    lines.push(`  Removed ${result.markersRemoved.length} marker(s):`);
    for (const id of result.markersRemoved) {
      lines.push(`    ✓ ${id}`);
    }
    if (result.markersRemoved.length === 0) lines.push("    (none)");
    lines.push("");

    if (result.plasmidsArchived.length > 0) {
      lines.push(`  Archived ${result.plasmidsArchived.length} plasmid(s):`);
      for (const id of result.plasmidsArchived) {
        lines.push(`    ✓ ${String(id)}`);
      }
      lines.push("");
    }
  }

  if (result.errorCode !== undefined) {
    lines.push(`  ✗ ${result.errorCode}: ${result.errorMessage ?? ""}`);
  } else if (executed) {
    lines.push("  ✓ /cure completed successfully.");
  } else {
    lines.push("  (not executed — dry-run or preview)");
  }

  return lines.join("\n");
};

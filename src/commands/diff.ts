import { execSync } from "node:child_process";
import { type SlashCommand } from "./registry.js";

/** Parsed entry from git diff --numstat */
interface DiffEntry {
  readonly additions: number;
  readonly deletions: number;
  readonly file: string;
}

/** Parse git diff --numstat output into structured entries */
function parseNumstat(output: string): readonly DiffEntry[] {
  if (!output.trim()) return [];

  return output
    .trim()
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const parts = line.split("\t");
      if (parts.length < 3) return null;

      const [addStr, delStr, ...fileParts] = parts;
      // Binary files show "-" for additions/deletions
      const additions = addStr === "-" ? 0 : parseInt(addStr, 10);
      const deletions = delStr === "-" ? 0 : parseInt(delStr, 10);
      const file = fileParts.join("\t"); // filenames with tabs (rare but possible)

      return { additions, deletions, file } as DiffEntry;
    })
    .filter((entry): entry is DiffEntry => entry !== null);
}

/** Format a single diff entry line */
function formatEntry(entry: DiffEntry, prefix: string): string {
  const adds = entry.additions > 0 ? `+${entry.additions}` : "";
  const dels = entry.deletions > 0 ? `-${entry.deletions}` : "";
  const stats = [adds, dels].filter(Boolean).join(", ");
  return `    ${prefix} ${entry.file}${stats ? `    (${stats})` : ""}`;
}

/** Run a git command and return its output, or null on failure */
function runGit(
  command: string,
  cwd: string,
): string | null {
  try {
    return execSync(command, {
      encoding: "utf-8",
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return null;
  }
}

/**
 * /diff — Show git diff of current changes.
 * Directly runs git commands and presents a formatted summary
 * of staged and unstaged changes.
 */
export const diffCommand: SlashCommand = {
  name: "diff",
  description: "Show git diff of current changes",
  usage: "/diff [file path]",
  execute: async (args, context) => {
    const target = args.trim();
    const cwd = context.workingDirectory;

    // Verify we're in a git repo
    const gitCheck = runGit("git rev-parse --is-inside-work-tree", cwd);
    if (gitCheck === null) {
      return {
        output: "Error: Not a git repository (or git is not installed).",
        success: false,
      };
    }

    const fileArg = target ? ` -- ${target}` : "";

    // Get unstaged changes
    const unstagedNumstat = runGit(`git diff --numstat${fileArg}`, cwd) ?? "";
    const unstagedEntries = parseNumstat(unstagedNumstat);

    // Get staged changes
    const stagedNumstat = runGit(`git diff --cached --numstat${fileArg}`, cwd) ?? "";
    const stagedEntries = parseNumstat(stagedNumstat);

    // No changes detected
    if (unstagedEntries.length === 0 && stagedEntries.length === 0) {
      const msg = target
        ? `No changes detected for: ${target}`
        : "No changes detected.";
      return { output: msg, success: true };
    }

    // Calculate totals
    const totalFiles = new Set([
      ...unstagedEntries.map((e) => e.file),
      ...stagedEntries.map((e) => e.file),
    ]).size;

    const totalAdditions =
      unstagedEntries.reduce((sum, e) => sum + e.additions, 0) +
      stagedEntries.reduce((sum, e) => sum + e.additions, 0);

    const totalDeletions =
      unstagedEntries.reduce((sum, e) => sum + e.deletions, 0) +
      stagedEntries.reduce((sum, e) => sum + e.deletions, 0);

    // Build output
    const lines: string[] = [];

    lines.push("Changes in working directory");
    lines.push("=============================");
    lines.push("");
    lines.push(`  Modified: ${totalFiles} file${totalFiles !== 1 ? "s" : ""} (+${totalAdditions}, -${totalDeletions})`);
    lines.push("");

    if (unstagedEntries.length > 0) {
      lines.push("  Unstaged:");
      for (const entry of unstagedEntries) {
        lines.push(formatEntry(entry, "M"));
      }
      lines.push("");
    }

    if (stagedEntries.length > 0) {
      lines.push("  Staged:");
      for (const entry of stagedEntries) {
        lines.push(formatEntry(entry, "A"));
      }
      lines.push("");
    }

    lines.push(`  Total: ${totalFiles} file${totalFiles !== 1 ? "s" : ""}, +${totalAdditions} / -${totalDeletions}`);

    return {
      output: lines.join("\n"),
      success: true,
    };
  },
};

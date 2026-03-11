import { execSync } from "node:child_process";
import { type SlashCommand } from "./registry.js";

/**
 * Run a git command and return stdout, or empty string on failure.
 */
function gitExec(cmd: string, cwd: string): string {
  try {
    return execSync(cmd, { cwd, encoding: "utf-8", stdio: "pipe" }).trim();
  } catch {
    return "";
  }
}

/**
 * Detect the commit type from changed file paths.
 */
function detectCommitType(files: readonly string[]): string {
  const testFiles = files.filter((f) => f.includes("test") || f.includes("spec"));
  if (testFiles.length > files.length / 2) return "test";

  const docFiles = files.filter((f) => f.includes("docs/") || f.endsWith(".md"));
  if (docFiles.length > files.length / 2) return "docs";

  const newFiles = files.filter((f) => f.startsWith("A"));
  if (newFiles.length > files.length / 2) return "feat";

  return "fix";
}

/**
 * Extract the most common directory as scope.
 */
function extractScope(files: readonly string[]): string {
  const dirs = new Map<string, number>();
  for (const file of files) {
    // file format from --name-status: "M\tsrc/commands/foo.ts" or just path
    const path = file.includes("\t") ? file.split("\t")[1] : file;
    if (!path) continue;
    const parts = path.split("/");
    // Use second-level dir if under src/, otherwise first dir
    const scope =
      parts[0] === "src" && parts.length > 2 ? parts[1] : parts.length > 1 ? parts[0] : "";
    if (scope) {
      dirs.set(scope, (dirs.get(scope) ?? 0) + 1);
    }
  }
  if (dirs.size === 0) return "";

  let maxDir = "";
  let maxCount = 0;
  for (const [dir, count] of dirs) {
    if (count > maxCount) {
      maxDir = dir;
      maxCount = count;
    }
  }
  return maxDir;
}

/**
 * /commit — Analyze staged changes and propose a commit message.
 * The agent will review, potentially adjust, and execute the commit.
 */
export const commitCommand: SlashCommand = {
  name: "commit",
  description: "Commit staged changes with an auto-generated message",
  usage: "/commit [message hint]",
  execute: async (args, context) => {
    const cwd = context.workingDirectory;

    // Verify git repository
    try {
      execSync("git rev-parse --git-dir", { cwd, encoding: "utf-8", stdio: "pipe" });
    } catch {
      return { output: "Not a git repository. /commit requires git.", success: false };
    }

    // Check for staged changes
    const stagedFiles = gitExec("git diff --cached --name-status", cwd);
    if (!stagedFiles) {
      return {
        output: [
          "No staged changes to commit.",
          "",
          "Stage your changes first:",
          "  git add <file>       — stage specific files",
          "  git add -p           — stage interactively",
        ].join("\n"),
        success: false,
      };
    }

    // Gather context
    const diffStat = gitExec("git diff --cached --stat", cwd);
    const recentLog = gitExec("git log --oneline -5", cwd);

    // Analyze files for commit type and scope
    const fileLines = stagedFiles.split("\n").filter(Boolean);
    const type = detectCommitType(fileLines);
    const scope = extractScope(fileLines);
    const scopePart = scope ? `(${scope})` : "";

    // Build a suggested message
    const fileCount = fileLines.length;
    const fileSummary = fileLines
      .slice(0, 5)
      .map((f) => {
        const parts = f.split("\t");
        return parts.length > 1 ? parts[1] : f;
      })
      .join(", ");
    const extraFiles = fileCount > 5 ? ` and ${fileCount - 5} more` : "";
    const description = `update ${fileSummary}${extraFiles}`;
    const suggestedMessage = `${type}${scopePart}: ${description}`;

    // User hint overrides auto-generated message
    const hint = args.trim();

    const prompt = [
      "I want to commit the currently staged changes. Here is the context:",
      "",
      "## Staged Changes (stat)",
      "```",
      diffStat,
      "```",
      "",
      "## Changed Files",
      "```",
      stagedFiles,
      "```",
      "",
      "## Recent Commits (for style reference)",
      "```",
      recentLog || "(no commits yet)",
      "```",
      "",
      "## Auto-detected",
      `- Type: ${type}`,
      `- Scope: ${scope || "(none)"}`,
      `- Suggested message: \`${suggestedMessage}\``,
      hint ? `- User hint: "${hint}"` : "",
      "",
      "## Instructions",
      "1. Review the staged diff with `git diff --cached`",
      "2. Analyze the changes and craft an appropriate conventional commit message",
      "3. Follow the style of recent commits shown above",
      hint
        ? `4. Incorporate the user's hint: "${hint}"`
        : "4. Use or improve the auto-detected suggestion above",
      "5. Execute `git commit -m '<message>'` with the final message",
      "6. Report the result",
    ].join("\n");

    return {
      output: prompt,
      success: true,
      shouldInjectAsUserMessage: true,
    };
  },
};

import { execSync } from "node:child_process";
import { type SlashCommand } from "./registry.js";

/** Maximum diff size in bytes before truncation */
const MAX_DIFF_SIZE = 50 * 1024;

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
 * /review — Review current code changes for bugs, security, and quality issues.
 * Gathers the diff and injects a review prompt into the conversation for the agent to process.
 */
export const reviewCommand: SlashCommand = {
  name: "review",
  description: "Review current code changes for bugs, security, and quality",
  usage: "/review [--staged] [file path]",
  execute: async (args, context) => {
    const cwd = context.workingDirectory;

    // Verify git repository
    try {
      execSync("git rev-parse --git-dir", { cwd, encoding: "utf-8", stdio: "pipe" });
    } catch {
      return { output: "Not a git repository. /review requires git.", success: false };
    }

    // Parse arguments
    const parts = args.trim().split(/\s+/).filter(Boolean);
    const stagedOnly = parts.includes("--staged");
    const filePath = parts.find((p) => p !== "--staged") || "";

    // Build git diff commands
    const pathArg = filePath ? ` -- ${JSON.stringify(filePath)}` : "";
    let diff = "";

    if (stagedOnly) {
      diff = gitExec(`git diff --cached${pathArg}`, cwd);
    } else {
      const unstaged = gitExec(`git diff${pathArg}`, cwd);
      const staged = gitExec(`git diff --cached${pathArg}`, cwd);

      if (staged && unstaged) {
        diff = `=== Staged Changes ===\n${staged}\n\n=== Unstaged Changes ===\n${unstaged}`;
      } else {
        diff = staged || unstaged;
      }
    }

    if (!diff) {
      return { output: "No changes to review.", success: false };
    }

    // Truncate large diffs
    let truncated = false;
    if (Buffer.byteLength(diff, "utf-8") > MAX_DIFF_SIZE) {
      diff = diff.slice(0, MAX_DIFF_SIZE);
      truncated = true;
    }

    const prompt = [
      "Review the following code changes. Analyze for:",
      "",
      "1. **Bugs**: Logic errors, null/undefined risks, off-by-one errors, race conditions",
      "2. **Security**: Injection vulnerabilities, exposed secrets, unsafe operations",
      "3. **Code Quality**: Readability, naming, duplication, missing error handling",
      "4. **Error Handling**: Unhandled exceptions, missing edge cases",
      "",
      "For each issue found, provide:",
      "- **Severity**: CRITICAL / HIGH / MEDIUM / LOW",
      "- **File and location**",
      "- **Description** of the issue",
      "- **Suggested fix**",
      "",
      "If no issues are found, confirm the changes look good.",
      "",
      truncated
        ? "**Note**: The diff was truncated due to size. Focus on the available changes.\n"
        : "",
      "```diff",
      diff,
      "```",
    ].join("\n");

    return {
      output: prompt,
      success: true,
      shouldInjectAsUserMessage: true,
    };
  },
};

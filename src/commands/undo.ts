import { type SlashCommand, type CommandResult, type CommandContext } from "./registry.js";
import { execSync } from "node:child_process";

/**
 * /undo [file|all] — Revert file changes using git.
 * Without arguments, lists modified files.
 * With a file path, reverts that specific file.
 * With "all", reverts all modified files.
 */
export const undoCommand: SlashCommand = {
  name: "undo",
  description: "Undo file changes (git restore)",
  usage: "/undo [file path | all]",

  async execute(args: string, context: CommandContext): Promise<CommandResult> {
    const target = args.trim();
    const cwd = context.workingDirectory;

    try {
      execSync("git rev-parse --git-dir", { cwd, encoding: "utf-8", stdio: "pipe" });
    } catch {
      return { output: "Not a git repository. /undo requires git.", success: false };
    }

    try {
      if (!target) {
        // List modified files
        const diff = execSync("git diff --name-only", { cwd, encoding: "utf-8", stdio: "pipe" }).trim();
        const staged = execSync("git diff --cached --name-only", { cwd, encoding: "utf-8", stdio: "pipe" }).trim();

        const allFiles = [...new Set([
          ...(diff ? diff.split("\n") : []),
          ...(staged ? staged.split("\n") : []),
        ])];

        if (allFiles.length === 0) {
          return { output: "No modified files to undo.", success: true };
        }

        const lines = [
          "Modified files:",
          ...allFiles.map((f) => `  ${f}`),
          "",
          "Usage: /undo <file> to revert a specific file",
          "       /undo all  to revert all changes",
        ];
        return { output: lines.join("\n"), success: true };
      }

      if (target === "all") {
        execSync("git checkout -- .", { cwd, encoding: "utf-8", stdio: "pipe" });
        return { output: "All file changes reverted.", success: true };
      }

      // Revert specific file
      execSync(`git checkout -- ${JSON.stringify(target)}`, { cwd, encoding: "utf-8", stdio: "pipe" });
      return { output: `Reverted: ${target}`, success: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { output: `Failed to undo: ${msg}`, success: false };
    }
  },
};

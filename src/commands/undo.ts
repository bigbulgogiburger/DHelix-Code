/**
 * /undo 명령어 핸들러 — git restore를 사용한 파일 변경 되돌리기
 *
 * 사용자가 /undo를 입력하면 git을 사용하여 파일 변경을 되돌립니다.
 *
 * 사용 예시:
 *   /undo              → 수정된 파일 목록 표시
 *   /undo src/index.ts → 해당 파일만 원래 상태로 복원
 *   /undo all          → 모든 수정된 파일을 원래 상태로 복원
 *
 * 주의: /undo all은 모든 변경을 되돌리므로 신중하게 사용하세요.
 * git checkout -- 을 내부적으로 사용합니다.
 *
 * /rewind와의 차이:
 *   - /undo: git의 원래 상태(마지막 커밋)로 되돌림
 *   - /rewind: dhelix 체크포인트(LLM 수정 전) 상태로 되돌림
 *
 * 사용 시점: LLM이 잘못 수정한 파일을 빠르게 되돌리고 싶을 때
 */
import { type SlashCommand, type CommandResult, type CommandContext } from "./registry.js";
import { execSync } from "node:child_process";

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
        const diff = execSync("git diff --name-only", {
          cwd,
          encoding: "utf-8",
          stdio: "pipe",
        }).trim();
        const staged = execSync("git diff --cached --name-only", {
          cwd,
          encoding: "utf-8",
          stdio: "pipe",
        }).trim();

        const allFiles = [
          ...new Set([...(diff ? diff.split("\n") : []), ...(staged ? staged.split("\n") : [])]),
        ];

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
      execSync(`git checkout -- ${JSON.stringify(target)}`, {
        cwd,
        encoding: "utf-8",
        stdio: "pipe",
      });
      return { output: `Reverted: ${target}`, success: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { output: `Failed to undo: ${msg}`, success: false };
    }
  },
};

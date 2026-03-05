import { type SlashCommand, type CommandResult, type CommandContext } from "./registry.js";
import { CheckpointManager } from "../core/checkpoint-manager.js";
import { SESSIONS_DIR } from "../constants.js";
import { join } from "node:path";

/**
 * /rewind [checkpoint-id] — List checkpoints or restore a specific one.
 * Without arguments, lists available checkpoints.
 */
export const rewindCommand: SlashCommand = {
  name: "rewind",
  description: "List or restore a checkpoint",
  usage: "/rewind [checkpoint-id]",

  async execute(args: string, context: CommandContext): Promise<CommandResult> {
    if (!context.sessionId) {
      return {
        output: "No active session. Checkpoints require an active session.",
        success: false,
      };
    }

    const sessionDir = join(SESSIONS_DIR, context.sessionId);
    const checkpointManager = new CheckpointManager(sessionDir);
    const checkpointId = args.trim();

    if (!checkpointId) {
      // List checkpoints
      const checkpoints = await checkpointManager.listCheckpoints();

      if (checkpoints.length === 0) {
        return {
          output: "No checkpoints found for this session.",
          success: true,
        };
      }

      const lines: string[] = ["Available checkpoints:", ""];
      for (const cp of checkpoints) {
        const date = new Date(cp.createdAt).toLocaleString();
        lines.push(`  ${cp.id}  ${date}  ${cp.description} (${cp.files.length} files)`);
      }

      lines.push("");
      lines.push("Use /rewind <checkpoint-id> to restore a checkpoint.");

      return {
        output: lines.join("\n"),
        success: true,
      };
    }

    // Restore specific checkpoint
    try {
      const result = await checkpointManager.restoreCheckpoint(
        checkpointId,
        context.workingDirectory,
      );

      const lines: string[] = [
        `Restored checkpoint: ${result.checkpoint.id} — ${result.checkpoint.description}`,
        `  Restored: ${result.restoredFiles.length} files`,
      ];

      if (result.skippedFiles.length > 0) {
        lines.push(`  Skipped: ${result.skippedFiles.length} files`);
      }

      return {
        output: lines.join("\n"),
        success: true,
      };
    } catch (error) {
      return {
        output: `Failed to restore checkpoint: ${error instanceof Error ? error.message : String(error)}`,
        success: false,
      };
    }
  },
};

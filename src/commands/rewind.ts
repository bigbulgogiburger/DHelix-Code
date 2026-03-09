import { type SlashCommand, type CommandResult, type CommandContext } from "./registry.js";
import { CheckpointManager } from "../core/checkpoint-manager.js";
import { SESSIONS_DIR } from "../constants.js";
import { join } from "node:path";

/**
 * /rewind [checkpoint-id] — List checkpoints or restore a specific one.
 * Without arguments, lists available checkpoints with file change summaries.
 * With a checkpoint ID, shows diff and restores files.
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
      return listCheckpoints(checkpointManager, context.workingDirectory);
    }

    return restoreCheckpoint(checkpointManager, checkpointId, context);
  },
};

/** List all checkpoints with file change summaries */
async function listCheckpoints(
  checkpointManager: CheckpointManager,
  workingDirectory: string,
): Promise<CommandResult> {
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
    const fileCount = cp.files.filter((f) => f.exists).length;
    lines.push(`  ${cp.id}  ${date}  ${cp.description}`);
    lines.push(`          ${fileCount} file(s) tracked`);

    // Show diff summary for each checkpoint
    try {
      const diff = await checkpointManager.diffFromCheckpoint(cp.id, workingDirectory);
      const modified = diff.filter((d) => d.status === "modified").length;
      const deleted = diff.filter((d) => d.status === "deleted").length;
      const unchanged = diff.filter((d) => d.status === "unchanged").length;

      const parts: string[] = [];
      if (modified > 0) parts.push(`${modified} modified`);
      if (deleted > 0) parts.push(`${deleted} deleted`);
      if (unchanged > 0) parts.push(`${unchanged} unchanged`);
      if (parts.length > 0) {
        lines.push(`          Current state: ${parts.join(", ")}`);
      }
    } catch {
      // Skip diff on error
    }

    lines.push("");
  }

  lines.push("Use /rewind <checkpoint-id> to restore a checkpoint.");

  return {
    output: lines.join("\n"),
    success: true,
  };
}

/** Show diff and restore a specific checkpoint */
async function restoreCheckpoint(
  checkpointManager: CheckpointManager,
  checkpointId: string,
  context: CommandContext,
): Promise<CommandResult> {
  // Show diff before restoring
  try {
    const diff = await checkpointManager.diffFromCheckpoint(checkpointId, context.workingDirectory);

    const changesToRevert = diff.filter((d) => d.status !== "unchanged");

    if (changesToRevert.length === 0) {
      return {
        output: `Checkpoint ${checkpointId}: All files are already at checkpoint state. Nothing to restore.`,
        success: true,
      };
    }

    // Perform restore
    const result = await checkpointManager.restoreCheckpoint(
      checkpointId,
      context.workingDirectory,
    );

    const lines: string[] = [
      `Restored checkpoint: ${result.checkpoint.id}`,
      `  ${result.checkpoint.description}`,
      "",
    ];

    if (result.restoredFiles.length > 0) {
      lines.push(`Restored ${result.restoredFiles.length} file(s):`);
      for (const file of result.restoredFiles) {
        const diffEntry = diff.find((d) => d.path === file);
        const status = diffEntry ? ` (was ${diffEntry.status})` : "";
        lines.push(`  + ${file}${status}`);
      }
    }

    if (result.skippedFiles.length > 0) {
      lines.push("");
      lines.push(`Skipped ${result.skippedFiles.length} file(s):`);
      for (const file of result.skippedFiles) {
        lines.push(`  - ${file}`);
      }
    }

    // Emit checkpoint:restored event
    context.emit("checkpoint:restored", {
      checkpointId,
      restoredFiles: result.restoredFiles.length,
      skippedFiles: result.skippedFiles.length,
    });

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
}

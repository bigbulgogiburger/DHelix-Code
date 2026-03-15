/**
 * /rewind 명령어 핸들러 — 체크포인트 목록 조회 또는 복원
 *
 * 체크포인트(checkpoint)란? LLM이 파일을 수정하기 전에
 * 자동으로 생성되는 파일 상태의 스냅샷입니다.
 * 문제가 생겼을 때 이전 상태로 되돌릴 수 있습니다.
 *
 * 사용 예시:
 *   /rewind              → 사용 가능한 체크포인트 목록 표시
 *   /rewind <체크포인트ID> → 해당 체크포인트로 파일 복원
 *
 * 각 체크포인트에는 변경된 파일 수, 현재와의 차이(diff) 요약이 표시됩니다.
 *
 * 사용 시점: LLM이 수정한 파일을 원래 상태로 되돌리고 싶을 때
 */
import { type SlashCommand, type CommandResult, type CommandContext } from "./registry.js";
import { CheckpointManager } from "../core/checkpoint-manager.js";
import { SESSIONS_DIR } from "../constants.js";
import { join } from "node:path";

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

/**
 * 모든 체크포인트를 파일 변경 요약과 함께 나열하는 함수
 *
 * 각 체크포인트의 ID, 생성 시각, 설명, 추적 중인 파일 수,
 * 현재 파일과의 차이(수정됨/삭제됨/변경 없음)를 표시합니다.
 *
 * @param checkpointManager - 체크포인트 관리 객체
 * @param workingDirectory - 현재 작업 디렉토리
 * @returns 체크포인트 목록 텍스트와 성공 여부
 */
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

/**
 * 특정 체크포인트의 diff를 보여주고 파일을 복원하는 함수
 *
 * 현재 파일 상태와 체크포인트 상태를 비교한 후,
 * 변경된 파일들을 체크포인트 시점의 내용으로 복원합니다.
 * 복원 후 checkpoint:restored 이벤트를 발생시킵니다.
 *
 * @param checkpointManager - 체크포인트 관리 객체
 * @param checkpointId - 복원할 체크포인트 ID
 * @param context - 명령어 실행 컨텍스트
 * @returns 복원 결과 텍스트와 성공 여부
 */
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

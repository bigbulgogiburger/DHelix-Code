/**
 * 백그라운드 프로세스 종료 도구 — 실행 중인 백그라운드 셸 프로세스를 종료하는 도구
 *
 * bash_exec에서 run_in_background=true로 시작한 프로세스에
 * 종료 시그널(SIGTERM, SIGKILL, SIGINT 중 택 1)을 보냅니다.
 *
 * 시그널 종류:
 * - SIGTERM (기본값): 정상 종료 요청 — 프로세스가 정리 작업 후 종료
 * - SIGINT: 인터럽트 — Ctrl+C를 누른 것과 동일
 * - SIGKILL: 강제 종료 — 프로세스가 즉시 종료 (정리 작업 없음)
 *
 * 권한 수준: "confirm" — 실행 중인 프로세스를 종료하므로 사용자 확인이 필요합니다.
 */
import { z } from "zod";
import { type ToolDefinition, type ToolResult } from "../types.js";
import { backgroundProcessManager } from "../executor.js";

/**
 * 허용되는 시그널 타입 스키마 — SIGTERM, SIGKILL, SIGINT만 허용
 */
const signalSchema = z.enum(["SIGTERM", "SIGKILL", "SIGINT"]);

/**
 * 매개변수 스키마 — 종료할 프로세스 ID와 시그널 타입을 정의
 */
const paramSchema = z.object({
  /** 종료할 프로세스의 ID (예: "bg-1") */
  processId: z.string().describe('The process ID to terminate (e.g., "bg-1")'),
  /** 보낼 시그널 (기본값: SIGTERM — 정상 종료 요청) */
  signal: signalSchema
    .optional()
    .default("SIGTERM")
    .describe("Signal to send to the process (default: SIGTERM)"),
});

type Params = z.infer<typeof paramSchema>;

/**
 * 프로세스 종료 실행 함수
 *
 * 실행 흐름:
 * 1. 프로세스 ID로 백그라운드 프로세스 상태 조회
 * 2. 프로세스가 없으면 에러 반환
 * 3. 이미 종료된 프로세스면 종료 코드와 함께 정보 반환
 * 4. 실행 중이면 지정된 시그널을 보내 종료
 *
 * @param params - 검증된 매개변수 (프로세스 ID, 시그널)
 * @returns 종료 결과
 */
async function execute(params: Params): Promise<ToolResult> {
  // 프로세스 상태 조회
  const status = backgroundProcessManager.getStatus(params.processId);
  if (!status) {
    return {
      output: `No background process found with ID "${params.processId}".`,
      isError: true,
      metadata: { processId: params.processId },
    };
  }

  // 이미 종료된 프로세스인 경우 — 시그널을 보낼 필요 없음
  if (!status.running) {
    return {
      output: `Process ${status.processId} (PID ${status.pid}) has already exited with code ${status.exitCode ?? "unknown"}.`,
      isError: false,
      metadata: {
        processId: status.processId,
        pid: status.pid,
        running: false,
        exitCode: status.exitCode,
      },
    };
  }

  // 실행 중인 프로세스에 시그널 전송
  const signal = params.signal ?? "SIGTERM";
  const killed = backgroundProcessManager.kill(params.processId, signal as NodeJS.Signals);

  if (killed) {
    return {
      output: `Sent ${signal} to process ${status.processId} (PID ${status.pid}).`,
      isError: false,
      metadata: {
        processId: status.processId,
        pid: status.pid,
        signal,
      },
    };
  }

  // 시그널 전송 실패 — 프로세스가 이미 종료되었을 가능성
  return {
    output: `Failed to send ${signal} to process ${status.processId} (PID ${status.pid}). The process may have already exited.`,
    isError: true,
    metadata: {
      processId: status.processId,
      pid: status.pid,
      signal,
    },
  };
}

/**
 * kill_shell 도구 정의 — 내보내기하여 도구 레지스트리에 등록
 */
export const killShellTool: ToolDefinition<Params> = {
  name: "kill_shell",
  description:
    "Terminate a running background shell process. Sends a signal (SIGTERM by default) to stop the process.",
  parameterSchema: paramSchema,
  permissionLevel: "confirm",
  execute,
};

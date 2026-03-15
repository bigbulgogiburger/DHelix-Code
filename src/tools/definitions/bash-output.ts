/**
 * 백그라운드 프로세스 출력 확인 도구 — 백그라운드에서 실행 중인 셸 명령의 새 출력을 읽는 도구
 *
 * bash_exec에서 run_in_background=true로 시작한 프로세스의 출력을 확인합니다.
 * "증분 읽기(incremental read)" 방식으로 마지막 확인 이후 새로 추가된 출력만 반환합니다.
 *
 * 사용 시나리오:
 * 1. bash_exec으로 장시간 실행 명령을 백그라운드로 시작 (예: npm run dev)
 * 2. 다른 작업을 수행하면서 이 도구로 출력을 주기적으로 확인
 * 3. 프로세스가 완료되었는지, 에러가 발생했는지 확인
 *
 * 권한 수준: "safe" — 출력을 읽기만 하므로 안전합니다.
 */
import { z } from "zod";
import { type ToolDefinition, type ToolResult } from "../types.js";
import { backgroundProcessManager } from "../executor.js";

/**
 * 매개변수 스키마 — 확인할 프로세스 ID를 정의
 */
const paramSchema = z.object({
  /**
   * 프로세스 ID — bash_exec의 백그라운드 실행 시 반환된 ID
   * 형식: "bg-1", "bg-2" 등 (사람이 읽기 쉬운 순차 ID)
   */
  processId: z
    .string()
    .describe('The process ID returned by bash_exec when run in background mode (e.g., "bg-1")'),
});

type Params = z.infer<typeof paramSchema>;

/**
 * 백그라운드 프로세스 출력 확인 실행 함수
 *
 * 실행 흐름:
 * 1. 프로세스 ID로 백그라운드 프로세스 상태 조회
 * 2. 프로세스가 없으면 에러 반환
 * 3. 마지막 확인 이후의 새 출력(증분)만 읽기
 * 4. 프로세스 상태(실행 중/종료)와 함께 출력 반환
 *
 * @param params - 검증된 매개변수 (프로세스 ID)
 * @returns 프로세스 상태 및 새 출력
 */
async function execute(params: Params): Promise<ToolResult> {
  // 프로세스 상태 조회
  const status = backgroundProcessManager.getStatus(params.processId);
  if (!status) {
    return {
      output: `No background process found with ID "${params.processId}". Use bash_exec with run_in_background to start a background process.`,
      isError: true,
      metadata: { processId: params.processId },
    };
  }

  // 증분 출력 읽기 — 마지막 확인 이후 새로 추가된 출력만 반환
  const { output, running, exitCode } = backgroundProcessManager.getIncrementalOutput(
    params.processId,
  );

  // 프로세스 상태 텍스트 생성
  const statusLine = running ? "Status: running" : `Status: exited (code ${exitCode ?? "unknown"})`;

  // 새 출력이 있으면 표시, 없으면 "(no new output)" 표시
  const outputSection = output.length > 0 ? `\n\nOutput:\n${output}` : "\n\n(no new output)";

  return {
    output: `Process ${status.processId} (PID ${status.pid})\nCommand: ${status.command}\n${statusLine}${outputSection}`,
    isError: false,
    metadata: {
      processId: status.processId,
      pid: status.pid,
      running,
      exitCode,
      hasNewOutput: output.length > 0,
    },
  };
}

/**
 * bash_output 도구 정의 — 내보내기하여 도구 레지스트리에 등록
 */
export const bashOutputTool: ToolDefinition<Params> = {
  name: "bash_output",
  description:
    "Read the latest output from a background shell process. Use this to check on long-running commands started with bash_exec in background mode. Returns only new output since the last read.",
  parameterSchema: paramSchema,
  permissionLevel: "safe",
  execute,
};

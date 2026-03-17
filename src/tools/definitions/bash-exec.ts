/**
 * 셸 명령 실행 도구 — 셸 명령을 실행하고 stdout/stderr를 반환하는 도구
 *
 * 빌드, 테스트, Git 명령 등 시스템 셸 명령을 실행합니다.
 * 포그라운드(동기) 실행과 백그라운드(비동기) 실행을 모두 지원합니다.
 *
 * 주요 기능:
 * - 대화형 명령 감지 및 차단 (vim, git rebase -i 등)
 * - 백그라운드 실행: run_in_background=true로 장시간 명령을 비동기 실행
 * - 실시간 출력 스트리밍: stdout/stderr를 이벤트로 실시간 전달
 * - 크로스 플랫폼: Windows(cmd.exe, Git Bash), macOS, Linux 지원
 * - WSL1 경고: WSL1 환경에서 성능 저하 경고 표시
 * - 사용자 지정 타임아웃: 기본 120초, 최대 600초까지 설정 가능
 *
 * 권한 수준: "confirm" — 시스템 명령을 실행하므로 사용자 확인이 필요합니다.
 */
import { z } from "zod";
import { type ToolDefinition, type ToolContext, type ToolResult } from "../types.js";
import {
  getShellCommand,
  getShellArgs,
  isWSL1,
  isWindows,
  hasGitBash,
  getShellType,
} from "../../utils/platform.js";
import { TOOL_TIMEOUTS } from "../../constants.js";
import { backgroundProcessManager } from "../executor.js";
import { spawn } from "node:child_process";

/**
 * 대화형(interactive) 명령 목록 — 터미널 입력이 필요한 명령들
 *
 * 이 명령들은 사용자와의 실시간 상호작용이 필요하므로,
 * 파이프로 연결된 비대화형 환경에서는 실행할 수 없습니다.
 * 실행을 시도하면 에러 메시지와 함께 비대화형 대안을 안내합니다.
 */
const INTERACTIVE_COMMANDS = [
  "git rebase -i", // 대화형 rebase → git rebase --onto 사용
  "git add -i", // 대화형 add
  "git add -p", // 패치 모드 add
  "git add --interactive",
  "git add --patch",
  "git commit --amend", // 편집기 실행 → git commit --amend -m "msg" 사용
  "vim", // 편집기
  "nvim",
  "nano",
  "emacs",
  "vi ",
  "less ", // 페이저
  "more ",
  "top", // 시스템 모니터
  "htop",
  "ssh ", // 원격 셸
  "python -i", // 대화형 인터프리터
  "python3 -i",
  "node --inspect", // Node.js 디버거
  "irb", // Ruby 대화형 셸
  "pry",
];

/**
 * 명령이 대화형 명령인지 판별
 *
 * 명령 문자열이 대화형 명령 목록의 항목과 일치하거나
 * 해당 항목으로 시작하는지 확인합니다.
 *
 * @param command - 확인할 셸 명령
 * @returns 대화형 명령이면 true
 */
function isInteractiveCommand(command: string): boolean {
  const trimmed = command.trim();
  return INTERACTIVE_COMMANDS.some(
    (interactive) => trimmed === interactive.trim() || trimmed.startsWith(interactive),
  );
}

/**
 * 매개변수 스키마 — 실행할 명령, 설명, 백그라운드 여부, 타임아웃을 정의
 */
const paramSchema = z.object({
  /** 실행할 셸 명령 문자열 */
  command: z.string().describe("Shell command to execute"),
  /** 명령에 대한 간단한 설명(선택사항) — UI에 표시 */
  description: z.string().optional().describe("Brief description of what this command does"),
  /** 백그라운드 실행 여부(선택사항) — true이면 즉시 PID를 반환하고 비동기로 실행 */
  run_in_background: z
    .boolean()
    .optional()
    .describe("Run command in background, returns immediately with PID"),
  /** 타임아웃(밀리초, 선택사항) — 기본 120초, 최소 1초, 최대 600초 */
  timeout: z
    .number()
    .int()
    .min(1000)
    .max(600_000)
    .optional()
    .describe("Timeout in milliseconds (default: 120000)"),
});

type Params = z.infer<typeof paramSchema>;

/**
 * 셸 명령 실행 함수
 *
 * 실행 흐름:
 * 1. 대화형 명령인지 확인 → 대화형이면 에러 반환
 * 2. WSL1 환경이면 경고 메시지 추가
 * 3. 백그라운드 실행 요청이면 BackgroundProcessManager로 실행
 * 4. 포그라운드 실행: spawn으로 프로세스를 시작하고 stdout/stderr를 수집
 * 5. 실시간 출력을 이벤트로 스트리밍 (events가 설정된 경우)
 * 6. 타임아웃 시 SIGTERM으로 프로세스 종료
 *
 * @param params - 검증된 매개변수
 * @param context - 실행 컨텍스트 (작업 디렉토리, 취소 신호, 이벤트 등)
 * @returns 명령 실행 결과 (stdout + stderr)
 */
async function execute(params: Params, context: ToolContext): Promise<ToolResult> {
  // 1단계: 대화형 명령 감지 — 비대화형 환경에서 실행 불가
  if (isInteractiveCommand(params.command)) {
    return {
      output: `Warning: "${params.command}" appears to be an interactive command that requires terminal input. Interactive commands are not supported. Please use non-interactive alternatives (e.g., "git rebase --onto" instead of "git rebase -i", "git commit -m" instead of "git commit --amend" without a message).`,
      isError: true,
      metadata: { command: params.command, description: params.description },
    };
  }

  // 2단계: WSL1 환경 경고 — WSL1은 파일 I/O 성능이 낮고 경로 변환 문제가 있을 수 있음
  const wsl1Warning = isWSL1()
    ? "[Warning: Running under WSL1. File I/O performance may be degraded. Consider upgrading to WSL2.]\n"
    : "";

  // 3단계: 백그라운드 실행 처리
  if (params.run_in_background) {
    try {
      // BackgroundProcessManager를 통해 detached 모드로 프로세스 시작
      const { pid, processId, outputFile } = backgroundProcessManager.start(
        params.command,
        context.workingDirectory,
      );
      const desc = params.description ? ` (${params.description})` : "";
      return {
        output: `${wsl1Warning}Background process started${desc}.\nProcess ID: ${processId}\nPID: ${pid}\nOutput file: ${outputFile}\nUse bash_output to check progress, kill_shell to terminate.`,
        isError: false,
        metadata: {
          pid,
          processId,
          status: "background",
          output_file: outputFile,
          command: params.command,
          description: params.description,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        output: `Failed to start background process: ${message}`,
        isError: true,
        metadata: { command: params.command, description: params.description },
      };
    }
  }

  // 4단계: 포그라운드(동기) 실행
  const timeoutMs = params.timeout ?? TOOL_TIMEOUTS.bash;
  // 플랫폼에 맞는 셸과 인수를 결정 (bash, zsh, cmd.exe, Git Bash 등)
  const shell = await getShellCommand();
  const args = getShellArgs(params.command, shell);

  // Windows + Git Bash 환경에서 POSIX 호환을 위한 환경변수 설정
  const env: Record<string, string | undefined> = {
    ...process.env,
    ...(isWindows() && hasGitBash()
      ? {
          MSYS: "winsymlinks:nativestrict", // 심볼릭 링크 호환
          CHERE_INVOKING: "1", // 셸 시작 디렉토리 유지
        }
      : {}),
  };

  // Promise로 비동기 프로세스 실행을 래핑
  return new Promise<ToolResult>((resolve) => {
    const chunks: Buffer[] = []; // stdout 데이터 청크 배열
    const errChunks: Buffer[] = []; // stderr 데이터 청크 배열

    // 자식 프로세스 생성
    // stdio: ["ignore", "pipe", "pipe"] — stdin 무시, stdout/stderr는 파이프로 캡처
    const proc = spawn(shell, [...args], {
      cwd: context.workingDirectory,
      env,
      signal: context.abortSignal, // 사용자 취소 시 프로세스도 함께 중단
      stdio: ["ignore", "pipe", "pipe"],
    });

    // stdout 데이터 수신 — 청크를 저장하고 실시간 이벤트로 스트리밍
    proc.stdout.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
      // 이벤트 시스템이 연결되어 있으면 실시간으로 출력을 UI에 전달
      if (context.events && context.toolCallId) {
        const text = chunk.toString("utf-8");
        context.events.emit("tool:output-delta", {
          id: context.toolCallId,
          name: "bash_exec",
          chunk: text,
        });
      }
    });

    // stderr 데이터 수신 — stdout과 동일하게 처리
    proc.stderr.on("data", (chunk: Buffer) => {
      errChunks.push(chunk);
      if (context.events && context.toolCallId) {
        const text = chunk.toString("utf-8");
        context.events.emit("tool:output-delta", {
          id: context.toolCallId,
          name: "bash_exec",
          chunk: text,
        });
      }
    });

    // 타임아웃 타이머 설정 — 시간이 지나면 SIGTERM으로 프로세스 종료
    const timer = setTimeout(() => {
      proc.kill("SIGTERM");
    }, timeoutMs);

    // 프로세스 종료 이벤트 — stdout/stderr를 합쳐 결과 반환
    proc.on("close", (code) => {
      clearTimeout(timer);
      const stdout = Buffer.concat(chunks).toString("utf-8");
      const stderr = Buffer.concat(errChunks).toString("utf-8");
      // stdout과 stderr를 합쳐서 하나의 출력으로 반환
      const output = [stdout, stderr].filter(Boolean).join("\n");

      resolve({
        output: `${wsl1Warning}${output}` || "(no output)",
        // exit code 0이면 성공, 그 외는 에러
        isError: code !== 0,
        metadata: {
          exitCode: code,
          command: params.command,
          description: params.description,
        },
      });
    });

    // 프로세스 시작 에러 (예: 명령을 찾을 수 없음)
    proc.on("error", (error) => {
      clearTimeout(timer);
      resolve({
        output: `Command failed: ${error.message}`,
        isError: true,
        metadata: { command: params.command, description: params.description },
      });
    });
  });
}

/**
 * 도구 설명을 플랫폼에 따라 동적으로 생성
 *
 * Windows에서 Git Bash가 있으면 POSIX 명령 호환성을 안내하고,
 * Git Bash가 없으면 cmd.exe 사용 경고를 표시합니다.
 *
 * @returns 플랫폼에 맞는 도구 설명 문자열
 */
function buildDescription(): string {
  const base =
    "Execute a shell command and return stdout/stderr. Use for running builds, tests, git commands, etc. Commands time out after 120 seconds by default.";
  const shellType = getShellType();
  if (shellType === "git-bash") {
    return `${base} Shell: Git Bash (POSIX commands available).`;
  }
  if (isWindows()) {
    return `${base} WARNING: Git Bash not found — using cmd.exe. Install Git for Windows for better POSIX command compatibility.`;
  }
  return base;
}

/**
 * bash_exec 도구 정의 — 내보내기하여 도구 레지스트리에 등록
 */
export const bashExecTool: ToolDefinition<Params> = {
  name: "bash_exec",
  /** 도구 설명은 플랫폼에 따라 동적으로 생성 */
  description: buildDescription(),
  parameterSchema: paramSchema,
  permissionLevel: "confirm",
  /** 타임아웃은 constants.ts의 TOOL_TIMEOUTS.bash 값을 사용 (기본 120초) */
  timeoutMs: TOOL_TIMEOUTS.bash,
  execute,
};

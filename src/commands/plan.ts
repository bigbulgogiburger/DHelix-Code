/**
 * /plan 명령어 핸들러 — 플랜 모드(읽기 전용) 토글
 *
 * 사용자가 /plan을 입력하면 플랜 모드를 활성화합니다.
 *
 * 플랜 모드란? LLM이 파일을 읽고 검색하는 것만 허용하고,
 * 파일 수정이나 명령어 실행은 차단하는 안전한 모드입니다.
 *
 * 플랜 모드에서 허용되는 도구:
 *   file_read, glob_search, grep_search, list_dir
 *
 * 플랜 모드에서 차단되는 도구:
 *   file_write, file_edit, bash_exec 및 모든 쓰기 작업
 *
 * 사용 시점:
 *   - 코드를 분석하고 계획을 세울 때 (실수로 수정 방지)
 *   - LLM에게 코드 리뷰나 설계를 요청할 때
 *
 * /plan off로 일반 모드로 복귀할 수 있습니다.
 *
 * newPermissionMode와 refreshInstructions를 통해 권한 모드를 전환하고
 * 시스템 프롬프트를 다시 로드합니다.
 */
import { type SlashCommand, type CommandResult, type CommandContext } from "./registry.js";

export const planCommand: SlashCommand = {
  name: "plan",
  description: "Toggle plan mode (read-only, no file modifications)",
  usage: "/plan [on|off]",

  async execute(args: string, _context: CommandContext): Promise<CommandResult> {
    const arg = args.trim().toLowerCase();

    if (arg === "off") {
      return {
        output: "Plan mode disabled. Tools will execute normally.",
        success: true,
        newPermissionMode: "default",
        refreshInstructions: true,
      };
    }

    return {
      output: [
        "Plan mode enabled (read-only).",
        "",
        "Available: file_read, glob_search, grep_search, list_dir",
        "Blocked: file_write, file_edit, bash_exec, and all write operations",
        "",
        "Use /plan off to resume normal execution.",
      ].join("\n"),
      success: true,
      newPermissionMode: "plan",
      refreshInstructions: true,
    };
  },
};

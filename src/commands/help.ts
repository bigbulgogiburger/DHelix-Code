/**
 * /help 명령어 핸들러 — 사용 가능한 슬래시 명령어 목록 표시
 *
 * 사용자가 /help를 입력하면 등록된 모든 슬래시 명령어와
 * 사용법, 설명을 보여줍니다.
 *
 * 사용 시점: 어떤 명령어가 있는지 모를 때, 명령어 사용법을 확인하고 싶을 때
 */
import { type SlashCommand, type CommandResult, type CommandContext } from "./registry.js";

/** 도움말에 표시할 명령어 목록 (앱 초기화 시 setHelpCommands로 주입됨) */
let allCommands: readonly SlashCommand[] = [];

/**
 * 도움말에 표시할 명령어 목록을 설정하는 함수
 *
 * 앱 초기화 과정에서 CommandRegistry에 등록된 모든 명령어를
 * 이 함수를 통해 전달합니다.
 *
 * @param commands - 등록된 슬래시 명령어 배열
 */
export function setHelpCommands(commands: readonly SlashCommand[]): void {
  allCommands = commands;
}

/**
 * /help 슬래시 명령어 정의 — 사용 가능한 모든 명령어를 목록으로 표시
 *
 * 각 명령어의 사용법(usage)과 설명(description)을 정렬하여 보여줍니다.
 */
export const helpCommand: SlashCommand = {
  name: "help",
  description: "Show available commands",
  usage: "/help",

  async execute(_args: string, _context: CommandContext): Promise<CommandResult> {
    const lines: string[] = ["Available commands:", ""];

    const commandsToShow = allCommands.length > 0 ? allCommands : [helpCommand];

    for (const cmd of commandsToShow) {
      lines.push(`  ${cmd.usage.padEnd(30)} ${cmd.description}`);
    }

    lines.push("");
    lines.push("Type a command to execute it.");

    return {
      output: lines.join("\n"),
      success: true,
    };
  },
};

/**
 * /clear 명령어 핸들러 — 대화 내역 초기화
 *
 * 사용자가 /clear를 입력하면 현재 대화 히스토리를 모두 지웁니다.
 * 세션 자체는 유지되며, 대화 내용만 초기화됩니다.
 *
 * 사용 시점: 새로운 주제로 대화를 시작하고 싶을 때,
 * 컨텍스트 윈도우(LLM이 기억하는 범위)가 가득 차기 전에 정리할 때
 *
 * shouldClear 플래그를 true로 반환하여 상위 컴포넌트(App)에게
 * 대화 초기화를 요청합니다.
 */
import { type SlashCommand, type CommandResult, type CommandContext } from "./registry.js";

export const clearCommand: SlashCommand = {
  name: "clear",
  description: "Clear the conversation history",
  usage: "/clear",

  async execute(_args: string, _context: CommandContext): Promise<CommandResult> {
    return {
      output: "Conversation cleared.",
      success: true,
      shouldClear: true,
    };
  },
};

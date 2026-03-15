/**
 * /compact 명령어 핸들러 — 컨텍스트 압축(compaction) 수동 트리거
 *
 * 사용자가 /compact를 입력하면 대화 컨텍스트를 압축합니다.
 *
 * 컨텍스트 압축이란? LLM의 컨텍스트 윈도우(기억 범위)가 한정되어 있으므로,
 * 오래된 대화 내용을 요약하여 공간을 확보하는 과정입니다.
 * 이를 통해 더 긴 대화를 이어갈 수 있습니다.
 *
 * 선택적으로 포커스 토픽을 지정하면 해당 주제를 중심으로 요약합니다.
 * 예: /compact 인증 리팩토링 → 인증 관련 내용에 집중하여 컨텍스트 유지
 *
 * 실제 압축 로직은 에이전트 루프의 컨텍스트 매니저에서 수행되며,
 * 이 명령어는 압축 트리거 신호만 보냅니다.
 */
import { type SlashCommand, type CommandResult, type CommandContext } from "./registry.js";

export const compactCommand: SlashCommand = {
  name: "compact",
  description: "Compact conversation context (optional: focus topic)",
  usage: "/compact [focus topic]",

  async execute(args: string, _context: CommandContext): Promise<CommandResult> {
    const focusTopic = args.trim() || undefined;

    // The actual compaction is handled by the context manager in the agent loop.
    // This command signals the loop to trigger manual compaction.
    return {
      output: focusTopic
        ? `Compaction triggered with focus: "${focusTopic}"`
        : "Compaction triggered.",
      success: true,
    };
  },
};

/**
 * /resume 명령어 핸들러 — 이전 세션 목록 조회 또는 재개
 *
 * 사용자가 /resume를 입력하면:
 *   - 인자 없음: 저장된 세션 목록을 대화형 선택 리스트로 표시
 *   - /resume <세션ID>: 해당 세션을 재개 (부분 ID 매칭 지원)
 *
 * 세션(session)이란? 하나의 대화 흐름을 나타내며,
 * 메시지 히스토리가 디스크에 저장되어 나중에 이어서 사용할 수 있습니다.
 *
 * 사용 시점: 이전에 중단한 작업을 이어서 하고 싶을 때
 */
import {
  type SlashCommand,
  type CommandResult,
  type CommandContext,
  type SelectOption,
} from "./registry.js";
import { SessionManager } from "../core/session-manager.js";

export const resumeCommand: SlashCommand = {
  name: "resume",
  description: "List or resume a previous session",
  usage: "/resume [session-id]",

  async execute(args: string, _context: CommandContext): Promise<CommandResult> {
    const sessionManager = new SessionManager();
    const sessionId = args.trim();

    if (!sessionId) {
      // List sessions as interactive select
      const sessions = await sessionManager.listSessions();

      if (sessions.length === 0) {
        return {
          output: "No saved sessions found.",
          success: true,
        };
      }

      const options: readonly SelectOption[] = sessions.slice(0, 20).map((s) => ({
        label: `${s.id.slice(0, 8)}  ${new Date(s.lastUsedAt).toLocaleString()}`,
        value: s.id,
        description: s.name || `(${s.messageCount} msgs)`,
      }));

      return {
        output: "",
        success: true,
        interactiveSelect: {
          options,
          prompt: "Select a session to resume:",
          onSelect: "/resume",
        },
      };
    }

    // Resume specific session
    try {
      // Find matching session (allow partial ID match)
      const sessions = await sessionManager.listSessions();
      const match = sessions.find((s) => s.id.startsWith(sessionId));

      if (!match) {
        return {
          output: `Session not found: ${sessionId}`,
          success: false,
        };
      }

      return {
        output: `Resuming session: ${match.name} (${match.id.slice(0, 8)})`,
        success: true,
      };
    } catch (error) {
      return {
        output: `Failed to resume session: ${error instanceof Error ? error.message : String(error)}`,
        success: false,
      };
    }
  },
};

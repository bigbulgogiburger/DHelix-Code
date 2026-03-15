/**
 * /fork 명령어 핸들러 — 현재 대화를 새 세션으로 분기(fork)
 *
 * 사용자가 /fork를 입력하면 현재 세션의 모든 메시지를
 * 새로운 세션으로 복사합니다.
 *
 * fork란? 현재 대화 상태를 그대로 유지하면서 별도의 분기(branch)를
 * 만드는 것입니다. Git의 branch와 유사한 개념입니다.
 *
 * 사용 시점:
 *   - 현재 대화 맥락을 보존하면서 다른 방향으로 실험하고 싶을 때
 *   - 현재 진행 상황의 스냅샷을 남기고 싶을 때
 *
 * 사용 예시:
 *   /fork              → 이름 없이 분기
 *   /fork auth-refactor → "auth-refactor"라는 이름으로 분기
 *
 * 분기된 세션은 `dbcode --resume <세션ID>`로 이어서 사용할 수 있습니다.
 */
import { SessionManager } from "../core/session-manager.js";
import { type SlashCommand } from "./registry.js";

export const forkCommand: SlashCommand = {
  name: "fork",
  description: "Fork conversation into a new session",
  usage: "/fork [name]",
  execute: async (args, context) => {
    const sessionId = context.sessionId;
    if (!sessionId) {
      return {
        output: "No active session to fork.",
        success: false,
      };
    }

    const forkName = args.trim() || undefined;
    const sessionManager = new SessionManager();

    try {
      const newId = await sessionManager.forkSession(sessionId, {
        name: forkName,
      });

      return {
        output: [
          `Session forked successfully.`,
          `New session: ${newId}`,
          forkName ? `Name: "${forkName}"` : "",
          "",
          `Resume with: dbcode --resume ${newId}`,
        ]
          .filter(Boolean)
          .join("\n"),
        success: true,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        output: `Fork failed: ${msg}`,
        success: false,
      };
    }
  },
};

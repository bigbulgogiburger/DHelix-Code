/**
 * /rename 명령어 핸들러 — 현재 세션 이름 변경
 *
 * 사용자가 /rename <이름>을 입력하면 현재 세션에 사람이 읽기 쉬운
 * 이름을 부여합니다.
 *
 * 세션에 이름이 없으면 기본적으로 ID(난수 문자열)로만 표시되어
 * 나중에 /resume로 재개할 때 구분하기 어렵습니다.
 * 의미 있는 이름을 붙이면 세션을 쉽게 식별할 수 있습니다.
 *
 * 사용 예시:
 *   /rename feature-auth-refactor  → 인증 리팩토링 작업 세션
 *   /rename bug-fix-login          → 로그인 버그 수정 세션
 *
 * 사용 시점: 여러 세션을 관리할 때 각 세션을 구분하기 위해
 */
import { SessionManager } from "../core/session-manager.js";
import { type SlashCommand } from "./registry.js";

export const renameCommand: SlashCommand = {
  name: "rename",
  description: "Rename current session",
  usage: "/rename <name>",
  execute: async (args, context) => {
    const name = args.trim();
    if (!name) {
      return {
        output: "Usage: /rename <name>\nExample: /rename feature-auth-refactor",
        success: false,
      };
    }

    if (!context.sessionId) {
      return {
        output: "No active session to rename.",
        success: false,
      };
    }

    try {
      const sessionManager = new SessionManager();
      await sessionManager.renameSession(context.sessionId, name);

      return {
        output: `Session renamed to: "${name}"`,
        success: true,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        output: `Rename failed: ${msg}`,
        success: false,
      };
    }
  },
};

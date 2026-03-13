import {
  type SlashCommand,
  type CommandResult,
  type CommandContext,
  type SelectOption,
} from "./registry.js";
import { SessionManager } from "../core/session-manager.js";

/**
 * /resume [id] — List sessions or resume a specific session.
 * Without arguments, lists available sessions.
 */
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

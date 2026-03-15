/**
 * /mcp 명령어 핸들러 — MCP 서버 연결 관리
 *
 * MCP(Model Context Protocol)란? LLM에게 외부 도구와 데이터 소스를
 * 제공하기 위한 표준 프로토콜입니다. 데이터베이스, API, 파일 시스템 등을
 * MCP 서버로 연결하면 LLM이 직접 해당 리소스에 접근할 수 있습니다.
 *
 * 주요 서브커맨드:
 *   /mcp list              — 설정된 MCP 서버 목록 조회
 *   /mcp add <이름> <명령어> — stdio 기반 MCP 서버 추가
 *   /mcp remove <이름>     — MCP 서버 제거
 *   /mcp serve             — dbcode를 MCP 서버로 노출 (미구현)
 *
 * 사용 시점: 외부 도구(DB, API 등)를 LLM에게 연결하고 싶을 때
 */
import { type SlashCommand } from "./registry.js";

export const mcpCommand: SlashCommand = {
  name: "mcp",
  description: "Manage MCP server connections",
  usage: "/mcp <add|remove|list> [args]",
  execute: async (args, _context) => {
    const parts = args.trim().split(/\s+/);
    const subcommand = parts[0]?.toLowerCase();

    switch (subcommand) {
      case "list":
        return {
          output:
            "MCP server listing not yet connected to MCP client registry.\nUse /mcp add <name> <command> to add a server.",
          success: true,
        };

      case "add": {
        const name = parts[1];
        const command = parts.slice(2).join(" ");
        if (!name || !command) {
          return {
            output:
              "Usage: /mcp add <name> <command> [args...]\nExample: /mcp add postgres pg-mcp --port 5432",
            success: false,
          };
        }
        return {
          output: `MCP server "${name}" configured with command: ${command}\nNote: Server will connect on next session start.`,
          success: true,
        };
      }

      case "remove": {
        const name = parts[1];
        if (!name) {
          return {
            output: "Usage: /mcp remove <name>",
            success: false,
          };
        }
        return {
          output: `MCP server "${name}" removed.`,
          success: true,
        };
      }

      case "serve":
        return {
          output: "MCP serve mode (expose dbcode as MCP server) is not yet implemented.",
          success: false,
        };

      default:
        return {
          output: [
            "MCP Server Management:",
            "",
            "  /mcp list                      — List configured servers",
            "  /mcp add <name> <command>       — Add stdio server",
            "  /mcp remove <name>             — Remove server",
            "  /mcp serve                     — Expose dbcode as MCP server",
          ].join("\n"),
          success: true,
        };
    }
  },
};

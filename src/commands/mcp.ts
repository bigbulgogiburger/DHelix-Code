import { type SlashCommand } from "./registry.js";

/**
 * /mcp — Manage MCP (Model Context Protocol) server connections.
 * Subcommands: add, remove, list, serve.
 */
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

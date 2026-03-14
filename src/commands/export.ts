import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { VERSION } from "../constants.js";
import { type SlashCommand } from "./registry.js";

/** Tool name patterns commonly found in assistant messages */
const TOOL_PATTERNS = [
  /`(glob_search|grep_search|read_file|write_file|edit_file|bash|list_dir|file_search|web_search|web_fetch|notebook_edit)`/gi,
  /> Tool: `([^`]+)`/g,
  /\btool[_\s]?(?:call|use|result)[:.\s]+`?(\w+)`?/gi,
] as const;

/**
 * Sanitize content by redacting sensitive data patterns
 * (API keys, bearer tokens, etc.)
 */
function sanitizeContent(content: string): string {
  return content
    .replace(/\b(sk-[a-zA-Z0-9]{20,})\b/g, "[REDACTED_API_KEY]")
    .replace(/\b(key-[a-zA-Z0-9]{20,})\b/g, "[REDACTED_KEY]")
    .replace(/\b(ssm_[a-zA-Z0-9]{20,})\b/g, "[REDACTED_KEY]")
    .replace(/(Bearer\s+)[a-zA-Z0-9._\-]{20,}/g, "$1[REDACTED_TOKEN]")
    .replace(/\b(ghp_[a-zA-Z0-9]{20,})\b/g, "[REDACTED_GITHUB_TOKEN]")
    .replace(/\b(xoxb-[a-zA-Z0-9\-]{20,})\b/g, "[REDACTED_SLACK_TOKEN]")
    .replace(/(password["']?\s*[:=]\s*["'])[^"']{8,}(["'])/gi, "$1[REDACTED]$2");
}

/**
 * Detect tool references in assistant message content.
 * Returns unique tool names found.
 */
function detectToolCalls(content: string): readonly string[] {
  const tools = new Set<string>();
  for (const pattern of TOOL_PATTERNS) {
    // Reset lastIndex for global regexes
    const regex = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      if (match[1]) {
        tools.add(match[1]);
      }
    }
  }
  return [...tools];
}

/**
 * Copy text to clipboard (macOS only via pbcopy).
 * Returns true if successful.
 */
function copyToClipboard(text: string): boolean {
  try {
    if (process.platform === "darwin") {
      execSync("pbcopy", { input: text, stdio: ["pipe", "pipe", "pipe"] });
      return true;
    }
    if (process.platform === "linux") {
      execSync("xclip -selection clipboard", { input: text, stdio: ["pipe", "pipe", "pipe"] });
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Estimate token count from a string (rough: ~4 chars per token).
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * /export — Export the current conversation to a file with rich metadata.
 *
 * Supports:
 *   /export [filename]       — export to file
 *   /export --clipboard      — copy to clipboard instead
 */
export const exportCommand: SlashCommand = {
  name: "export",
  description: "Export conversation to file",
  usage: "/export [filename | --clipboard]",
  execute: async (args, context) => {
    const trimmedArgs = args.trim();
    const toClipboard = trimmedArgs === "--clipboard";
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filename = toClipboard ? "" : trimmedArgs || `dbcode-conversation-${timestamp}.md`;
    const filePath = toClipboard ? "" : join(context.workingDirectory, filename);

    try {
      const messages = context.messages ?? [];

      // ── Build metadata table ──
      const lines: string[] = [
        `# dbcode Conversation Export`,
        ``,
        `| Field | Value |`,
        `|-------|-------|`,
        `| Date | ${now.toISOString()} |`,
        `| Model | ${context.model} |`,
        `| Session | ${context.sessionId ?? "N/A"} |`,
        `| Version | v${VERSION} |`,
        `| Platform | ${process.platform} (${process.arch}) |`,
        `| Directory | ${context.workingDirectory} |`,
        ``,
        `---`,
        ``,
      ];

      if (messages.length === 0) {
        lines.push("(No messages in conversation)");
      } else {
        // ── Messages with turn numbering ──
        let turnIndex = 0;
        let userCount = 0;
        let assistantCount = 0;
        let totalTokenEstimate = 0;

        for (const msg of messages) {
          if (msg.role === "system") continue;

          if (msg.role === "user") {
            turnIndex++;
            userCount++;
            lines.push(`## Turn ${turnIndex}`);
            lines.push(``);
          }

          const label = msg.role === "user" ? "User" : "Assistant";
          if (msg.role === "assistant") {
            assistantCount++;
          }

          lines.push(`### ${label}`);
          lines.push(``);

          const sanitized = sanitizeContent(msg.content);
          lines.push(sanitized);
          lines.push(``);

          // Detect tool calls in assistant messages
          if (msg.role === "assistant") {
            const tools = detectToolCalls(msg.content);
            if (tools.length > 0) {
              for (const tool of tools) {
                lines.push(`> Tool: \`${tool}\``);
              }
              lines.push(``);
            }
          }

          totalTokenEstimate += estimateTokens(msg.content);

          // Add separator between turns (after assistant response)
          if (msg.role === "assistant") {
            lines.push(`---`);
            lines.push(``);
          }
        }

        // ── Summary section ──
        lines.push(`## Summary`);
        lines.push(``);
        lines.push(`- **Turns**: ${turnIndex} (${userCount} user, ${assistantCount} assistant)`);
        lines.push(`- **Total messages**: ${messages.filter((m) => m.role !== "system").length}`);
        lines.push(`- **Estimated tokens**: ~${totalTokenEstimate.toLocaleString()}`);
      }

      const content = lines.join("\n");

      // ── Output: clipboard or file ──
      if (toClipboard) {
        const ok = copyToClipboard(content);
        if (ok) {
          return { output: "Conversation copied to clipboard.", success: true };
        }
        return {
          output: "Clipboard not available on this platform. Use /export [filename] instead.",
          success: false,
        };
      }

      await writeFile(filePath, content, "utf-8");
      return {
        output: `Conversation exported to: ${filename}`,
        success: true,
      };
    } catch (error) {
      return {
        output: `Export failed: ${error instanceof Error ? error.message : String(error)}`,
        success: false,
      };
    }
  },
};

// Re-export helpers for testing
export { sanitizeContent, detectToolCalls, estimateTokens };

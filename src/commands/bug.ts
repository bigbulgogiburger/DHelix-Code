import { type SlashCommand } from "./registry.js";
import { VERSION, APP_NAME } from "../constants.js";

/**
 * Build a GitHub Issue URL with pre-filled title, body, and labels.
 */
function buildGitHubIssueUrl(title: string, body: string): string {
  const params = new URLSearchParams({
    title: `[Bug] ${title.slice(0, 80)}`,
    body,
    labels: "bug",
  });
  return `https://github.com/bigbulgogiburger/dbcode/issues/new?${params}`;
}

/**
 * Format a bug report in markdown with environment diagnostics.
 */
function formatBugReport(description: string, context: { readonly model: string; readonly sessionId?: string }): string {
  return [
    "## Bug Report",
    "",
    `**Description**: ${description}`,
    "",
    "### Environment",
    `- ${APP_NAME}: v${VERSION}`,
    `- Platform: ${process.platform} (${process.arch})`,
    `- Node.js: ${process.version}`,
    `- Model: ${context.model}`,
    `- Session: ${context.sessionId ?? "N/A"}`,
    `- Timestamp: ${new Date().toISOString()}`,
  ].join("\n");
}

/**
 * /bug — Generate a GitHub issue report with system diagnostics.
 */
export const bugCommand: SlashCommand = {
  name: "bug",
  description: "Generate a bug report with system diagnostics",
  usage: "/bug <description>",
  execute: async (args, context) => {
    const description = args.trim();

    if (!description) {
      return {
        output: [
          "Usage: /bug <description>",
          "",
          "Generates a GitHub issue report with system diagnostics.",
          "",
          'Example: /bug "Tool output is truncated when response exceeds 4096 tokens"',
        ].join("\n"),
        success: true,
      };
    }

    const report = formatBugReport(description, context);
    const url = buildGitHubIssueUrl(description, report);

    const output = [
      "Bug report generated.",
      "",
      `Open in browser: ${url}`,
      "",
      "Or copy the report below:",
      "---",
      report,
    ].join("\n");

    return {
      output,
      success: true,
    };
  },
};

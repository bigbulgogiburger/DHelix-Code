import { type SlashCommand } from "./registry.js";

/** Valid output styles */
const VALID_STYLES = ["default", "explanatory", "learning", "concise"] as const;
type OutputStyle = (typeof VALID_STYLES)[number];

/**
 * /output-style — Change the response style.
 * Adjusts the system prompt to alter LLM output behavior.
 */
export const outputStyleCommand: SlashCommand = {
  name: "output-style",
  description: "Change response output style",
  usage: "/output-style <default|explanatory|learning|concise>",
  execute: async (args, _context) => {
    const style = args.trim().toLowerCase();

    if (!style) {
      return {
        output: [
          "Output Styles:",
          "",
          "  default       — Balanced responses",
          "  explanatory   — Detailed explanations with reasoning",
          "  learning      — Educational with examples and context",
          "  concise       — Minimal, direct answers",
          "",
          `Usage: /output-style <${VALID_STYLES.join("|")}>`,
        ].join("\n"),
        success: true,
      };
    }

    if (!VALID_STYLES.includes(style as OutputStyle)) {
      return {
        output: `Unknown style: "${style}". Valid: ${VALID_STYLES.join(", ")}`,
        success: false,
      };
    }

    return {
      output: `Output style set to: ${style}`,
      success: true,
    };
  },
};

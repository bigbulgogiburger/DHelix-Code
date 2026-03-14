import { Marked } from "marked";
import * as markedTerminalModule from "marked-terminal";
import { highlightCodeSync, isLanguageSupported } from "./syntax.js";

let markedInstance: Marked | undefined;

/**
 * Get or create the configured Marked instance for terminal rendering.
 */
function getMarked(): Marked {
  if (!markedInstance) {
    markedInstance = new Marked();
    // Use the named export (not default) — the default export is the raw
    // Renderer constructor which crashes when called without `new` in ESM.
    const markedTerminal =
      (markedTerminalModule as Record<string, unknown>).markedTerminal ??
      markedTerminalModule.default;
    markedInstance.use(
      (markedTerminal as (...args: unknown[]) => Record<string, unknown>)({
        reflowText: true,
        width: process.stdout.columns || 80,
        showSectionPrefix: false,
        tab: 2,
        unescape: true,
        code: (code: string, language?: string) => {
          if (language && isLanguageSupported(language)) {
            const highlighted = highlightCodeSync(code, language);
            return "\n" + highlighted + "\n";
          }
          return "\n" + code + "\n";
        },
        link: (href: string, _title: string | null | undefined, text: string) => {
          // OSC 8 hyperlink for terminals that support it
          return `\x1b]8;;${href}\x07${text || href}\x1b]8;;\x07`;
        },
      }),
    );
  }
  return markedInstance;
}

/**
 * Render markdown text for terminal display.
 */
export function renderMarkdown(text: string): string {
  const marked = getMarked();
  const result = marked.parse(text);
  if (typeof result === "string") {
    return result.trimEnd();
  }
  return text;
}

/**
 * Check if text contains markdown formatting.
 */
export function hasMarkdown(text: string): boolean {
  return /[#*`[\]_~>|]/.test(text) || /```/.test(text) || /^\s*[-*+]\s/m.test(text);
}

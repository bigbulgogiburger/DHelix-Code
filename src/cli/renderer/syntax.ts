import {
  type BundledLanguage,
  type BundledTheme,
  bundledLanguages,
  createHighlighter,
  type Highlighter,
} from "shiki";

/** Default theme for syntax highlighting */
const DEFAULT_THEME: BundledTheme = "github-dark";

let highlighterPromise: Promise<Highlighter> | undefined;
let highlighterInstance: Highlighter | undefined;

/**
 * Get or create the shiki highlighter instance (lazy singleton).
 */
function getHighlighter(lang: BundledLanguage, theme: BundledTheme): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: [theme],
      langs: [lang],
    });
  }
  return highlighterPromise;
}

/** Pre-warm the highlighter singleton. Call at startup. */
export async function initHighlighter(): Promise<void> {
  try {
    const h = await getHighlighter("typescript" as BundledLanguage, DEFAULT_THEME);
    highlighterInstance = h;
  } catch {
    // Silently fail — highlighting will be unavailable
  }
}

/** Synchronous highlight using pre-warmed highlighter. Falls back to plain text. */
export function highlightCodeSync(code: string, language: string): string {
  if (!highlighterInstance) return code;

  const lang = resolveLanguage(language);
  if (!lang) return code;

  try {
    // Ensure language is loaded (best-effort sync)
    const { tokens } = highlighterInstance.codeToTokens(code, {
      lang,
      theme: DEFAULT_THEME,
    });
    return tokensToAnsi(tokens);
  } catch {
    return code;
  }
}

/**
 * Highlight code for terminal output using shiki.
 * Returns ANSI-colored string for terminal display.
 */
export async function highlightCode(
  code: string,
  language: string,
  theme: BundledTheme = DEFAULT_THEME,
): Promise<string> {
  const lang = resolveLanguage(language);
  if (!lang) {
    return code;
  }

  try {
    const highlighter = await getHighlighter(lang, theme);

    // Ensure the language and theme are loaded
    await highlighter.loadLanguage(lang);

    // Use codeToTokens + manual ANSI rendering
    const { tokens } = highlighter.codeToTokens(code, {
      lang,
      theme,
    });

    return tokensToAnsi(tokens);
  } catch {
    return code;
  }
}

/**
 * Convert shiki tokens to ANSI-colored terminal output.
 */
function tokensToAnsi(lines: { color?: string; content: string }[][]): string {
  return lines
    .map((line) =>
      line
        .map((token) => (token.color ? colorize(token.content, token.color) : token.content))
        .join(""),
    )
    .join("\n");
}

/**
 * Apply ANSI color to text based on hex color.
 */
function colorize(text: string, hexColor: string): string {
  const rgb = hexToRgb(hexColor);
  if (!rgb) return text;
  return `\x1b[38;2;${rgb.r};${rgb.g};${rgb.b}m${text}\x1b[0m`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | undefined {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!match) return undefined;
  return {
    r: parseInt(match[1], 16),
    g: parseInt(match[2], 16),
    b: parseInt(match[3], 16),
  };
}

/**
 * Resolve a language identifier to a shiki-supported language.
 */
function resolveLanguage(lang: string): BundledLanguage | undefined {
  const normalized = lang.toLowerCase().trim();

  if (normalized in bundledLanguages) {
    return normalized as BundledLanguage;
  }

  const aliases: Record<string, BundledLanguage> = {
    js: "javascript",
    ts: "typescript",
    tsx: "tsx",
    jsx: "jsx",
    py: "python",
    rb: "ruby",
    sh: "bash",
    shell: "bash",
    yml: "yaml",
    md: "markdown",
    dockerfile: "dockerfile",
  };

  return aliases[normalized];
}

/**
 * Check if a language is supported for syntax highlighting.
 */
export function isLanguageSupported(lang: string): boolean {
  return resolveLanguage(lang) !== undefined;
}

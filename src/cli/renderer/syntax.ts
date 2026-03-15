/**
 * syntax.ts — 구문 강조(Syntax Highlighting) 모듈
 *
 * shiki 라이브러리를 사용하여 코드를 ANSI 색상으로 강조합니다.
 * 터미널에서 코드 블록을 읽을 때 색상이 적용되어 가독성이 향상됩니다.
 *
 * shiki는 VS Code의 TextMate 문법을 사용하여 정확한 구문 분석을 제공합니다.
 * 하이라이터 인스턴스는 지연 생성(lazy singleton)되어 필요할 때만 초기화됩니다.
 *
 * 주요 함수:
 * - initHighlighter(): 앱 시작 시 미리 워밍 (선택적)
 * - highlightCodeSync(): 동기 방식 구문 강조 (마크다운 렌더링에서 사용)
 * - highlightCode(): 비동기 방식 구문 강조
 * - isLanguageSupported(): 언어 지원 여부 확인
 */
import {
  type BundledLanguage,
  type BundledTheme,
  bundledLanguages,
  createHighlighter,
  type Highlighter,
} from "shiki";

/** 기본 구문 강조 테마 — GitHub Dark (어두운 터미널에 적합) */
const DEFAULT_THEME: BundledTheme = "github-dark";

let highlighterPromise: Promise<Highlighter> | undefined;
let highlighterInstance: Highlighter | undefined;

/**
 * shiki 하이라이터 인스턴스를 가져오거나 생성합니다 (지연 싱글톤 패턴).
 * 최초 호출 시 하이라이터를 생성하고, 이후 호출에서는 같은 Promise를 반환합니다.
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

/** 하이라이터 싱글톤을 미리 워밍합니다. 앱 시작 시 호출하면 첫 사용 시 지연이 없습니다. */
export async function initHighlighter(): Promise<void> {
  try {
    const h = await getHighlighter("typescript" as BundledLanguage, DEFAULT_THEME);
    highlighterInstance = h;
  } catch {
    // Silently fail — highlighting will be unavailable
  }
}

/** 미리 워밍된 하이라이터를 사용한 동기 구문 강조. 하이라이터가 없으면 일반 텍스트 반환. */
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
 * shiki를 사용하여 코드를 터미널 출력용으로 구문 강조합니다.
 * ANSI 색상 코드가 포함된 문자열을 반환합니다.
 * 언어가 지원되지 않거나 에러가 발생하면 원본 코드를 그대로 반환합니다.
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
 * shiki 토큰을 ANSI 색상이 적용된 터미널 출력으로 변환합니다.
 * 각 토큰의 color(hex) 값을 ANSI 24비트 색상 이스케이프 코드로 변환합니다.
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
 * hex 색상값을 기반으로 텍스트에 ANSI 색상을 적용합니다.
 * 24비트 True Color ANSI 이스케이프 시퀀스를 사용합니다.
 * 예: #FF5733 → \x1b[38;2;255;87;51m텍스트\x1b[0m
 */
function colorize(text: string, hexColor: string): string {
  const rgb = hexToRgb(hexColor);
  if (!rgb) return text;
  return `\x1b[38;2;${rgb.r};${rgb.g};${rgb.b}m${text}\x1b[0m`;
}

/** hex 색상 문자열을 RGB 값으로 변환 — "#FF5733" → { r: 255, g: 87, b: 51 } */
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
 * 언어 식별자를 shiki가 지원하는 BundledLanguage로 해석합니다.
 * "js" → "javascript", "py" → "python" 등의 별칭도 지원합니다.
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
 * 주어진 언어가 구문 강조를 지원하는지 확인합니다.
 * shiki의 내장 언어 목록과 사용자 정의 별칭을 모두 확인합니다.
 */
export function isLanguageSupported(lang: string): boolean {
  return resolveLanguage(lang) !== undefined;
}

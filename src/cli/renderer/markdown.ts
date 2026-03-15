/**
 * markdown.ts — 마크다운을 터미널에 렌더링하는 모듈
 *
 * marked 라이브러리와 marked-terminal 플러그인을 사용하여
 * 마크다운 텍스트를 ANSI 색상이 적용된 터미널 출력으로 변환합니다.
 *
 * 기능:
 * - 코드 블록: shiki를 통한 구문 강조 (syntax.ts 사용)
 * - 링크: OSC 8 하이퍼링크 (지원하는 터미널에서 클릭 가능)
 * - 텍스트 리플로: 터미널 너비에 맞게 텍스트 줄바꿈
 *
 * 주의: Marked 인스턴스는 싱글톤으로 관리되어 한 번만 초기화됩니다.
 */
import { Marked } from "marked";
import * as markedTerminalModule from "marked-terminal";
import { highlightCodeSync, isLanguageSupported } from "./syntax.js";

/** Marked 인스턴스 싱글톤 — 한 번 생성 후 재사용 */
let markedInstance: Marked | undefined;

/**
 * 터미널 렌더링용 Marked 인스턴스를 가져오거나 생성합니다.
 *
 * 초기화 시 marked-terminal 플러그인을 적용하고,
 * 코드 블록 렌더러와 링크 렌더러를 커스터마이즈합니다.
 *
 * 참고: marked-terminal 모듈의 ESM 호환성 문제로 named export와
 * default export를 모두 시도합니다.
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
 * 마크다운 텍스트를 터미널 표시용으로 렌더링합니다.
 * ANSI 이스케이프 코드가 포함된 문자열을 반환합니다.
 * 렌더링에 실패하면 원본 텍스트를 그대로 반환합니다.
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
 * 텍스트에 마크다운 서식이 포함되어 있는지 확인합니다.
 * #, *, `, [, ], _, ~, >, |, 코드 블록(```), 목록(-/*) 등의 패턴을 감지합니다.
 * 마크다운이 없으면 렌더링을 건너뛰어 성능을 절약합니다.
 */
export function hasMarkdown(text: string): boolean {
  return /[#*`[\]_~>|]/.test(text) || /```/.test(text) || /^\s*[-*+]\s/m.test(text);
}

/**
 * marked-terminal 타입 선언 — 마크다운을 터미널 출력으로 렌더링하는 라이브러리
 *
 * marked-terminal은 marked(마크다운 파서)의 확장(extension)으로,
 * 마크다운 텍스트를 ANSI 이스케이프 코드가 포함된 터미널 출력으로 변환합니다.
 *
 * 이 파일은 TypeScript 타입 선언 파일(.d.ts)로,
 * JavaScript로 작성된 marked-terminal 모듈에 TypeScript 타입 정보를 제공합니다.
 * "declare module"은 외부 모듈의 타입을 선언할 때 사용하는 TypeScript 문법입니다.
 *
 * @example
 * import markedTerminal from "marked-terminal";
 * import { marked } from "marked";
 *
 * marked.use(markedTerminal({ reflowText: true, width: 80 }));
 * const output = marked("# 제목\n본문 텍스트");
 * // → ANSI 코드로 꾸며진 터미널 출력
 */
declare module "marked-terminal" {
  import { type MarkedExtension } from "marked";

  /** marked-terminal 렌더러 옵션 */
  interface MarkedTerminalOptions {
    /** 텍스트를 지정된 폭에 맞게 자동 줄바꿈할지 여부 */
    reflowText?: boolean;
    /** 출력 폭 (문자 수) — reflowText와 함께 사용 */
    width?: number;
    /** 섹션(헤더) 앞에 접두사(예: "# ")를 표시할지 여부 */
    showSectionPrefix?: boolean;
    /** 탭 문자의 너비 (공백 수) */
    tab?: number;
    /** 이모지 렌더링 활성화 여부 */
    emoji?: boolean;
  }

  /**
   * marked-terminal 확장을 생성합니다.
   * marked.use()에 전달하여 마크다운을 터미널 출력으로 변환합니다.
   *
   * @param options - 렌더러 옵션 (선택적)
   * @returns marked 확장 객체
   */
  function markedTerminal(options?: MarkedTerminalOptions): MarkedExtension;
  export default markedTerminal;
}

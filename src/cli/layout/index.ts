/**
 * layout/index.ts — Shell Layout 모듈의 barrel export
 *
 * ShellLayout 시스템의 모든 공개 API를 단일 진입점에서 내보냅니다.
 *
 * @module layout
 */
export {
  ShellLayout,
  type ShellLayoutSlots,
  type ShellLayoutProps,
  type TerminalSize,
  computeTranscriptMinHeight,
  getTerminalSize,
} from "./shell-layout.js";

export {
  TranscriptFrame,
  type TranscriptFrameProps,
  type ScrollState,
  createInitialScrollState,
} from "./transcript-frame.js";

export { FooterBar, type FooterBarItem, type FooterBarProps } from "./footer-bar.js";

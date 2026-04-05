/**
 * accessibility/index.ts — WCAG 2.1 AA 터미널 접근성 유틸리티 배럴 export
 *
 * 이 모듈은 터미널 UI 접근성 강화를 위한 세 가지 서브모듈을 통합합니다:
 * - contrast: 색상 대비율 계산 (WCAG AA/AAA)
 * - screen-reader: ARIA 어노테이션 및 스크린 리더 친화적 포매팅
 * - keyboard-nav: 키보드 포커스 관리 (Tab/Shift+Tab 탐색)
 */

export type { ContrastResult } from "./contrast.js";
export {
  calculateLuminance,
  contrastRatio,
  checkContrast,
  suggestAccessibleColor,
} from "./contrast.js";

export type { AriaRole, AriaLive, AriaAnnotation } from "./screen-reader.js";
export {
  annotateForScreenReader,
  stripAnsi,
  formatProgress,
  formatDuration,
  formatStatus,
} from "./screen-reader.js";

export type { FocusableType, FocusableElement } from "./keyboard-nav.js";
export { FocusManager } from "./keyboard-nav.js";

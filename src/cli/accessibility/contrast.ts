/**
 * contrast.ts — WCAG 2.1 AA 색상 대비 유틸리티
 *
 * 텍스트와 배경색 간의 대비율을 계산하여 접근성 기준 충족 여부를 검사합니다.
 * WCAG 2.1 AA 기준: 일반 텍스트 4.5:1, 큰 텍스트 3:1
 * WCAG 2.1 AAA 기준: 일반 텍스트 7:1, 큰 텍스트 4.5:1
 *
 * 사용 방법:
 * - checkContrast(fg, bg): 두 색상의 대비율 및 AA/AAA 기준 충족 여부 확인
 * - suggestAccessibleColor(fg, bg): AA 기준 충족하는 가장 가까운 색상 제안
 */

/** 대비율 검사 결과 */
export interface ContrastResult {
  /** 대비율 (1–21) */
  readonly ratio: number;
  /** WCAG AA 기준 (4.5:1 이상) 충족 여부 */
  readonly meetsAA: boolean;
  /** WCAG AAA 기준 (7:1 이상) 충족 여부 */
  readonly meetsAAA: boolean;
  /** 접근성 개선 권장 메시지 (미충족 시) */
  readonly recommendation?: string;
}

/** WCAG AA 최소 대비율 */
const WCAG_AA_RATIO = 4.5;
/** WCAG AAA 최소 대비율 */
const WCAG_AAA_RATIO = 7.0;
/** sRGB 선형화 임계값 */
const SRGB_THRESHOLD = 0.04045;
/** sRGB 선형화 분모 */
const SRGB_DIVISOR = 12.92;
/** sRGB 선형화 감마 */
const SRGB_GAMMA = 2.4;
/** sRGB 오프셋 */
const SRGB_OFFSET = 0.055;
/** sRGB 분모 */
const SRGB_DENOMINATOR = 1.055;

/**
 * 16진수 색상 문자열을 RGB 컴포넌트로 파싱합니다.
 * @param hex - `#RRGGBB` 또는 `#RGB` 형식의 색상 문자열
 * @returns `{ r, g, b }` 객체 (0–255)
 */
function parseHex(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace(/^#/, "");

  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return { r, g, b };
  }

  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return { r, g, b };
  }

  throw new Error(`Invalid hex color: ${hex}`);
}

/**
 * sRGB 채널 값을 선형 광도로 변환합니다 (IEC 61966-2-1 표준).
 * @param channel - 0–255 범위의 sRGB 채널 값
 * @returns 선형 광도 (0–1)
 */
function toLinear(channel: number): number {
  const normalized = channel / 255;
  if (normalized <= SRGB_THRESHOLD) {
    return normalized / SRGB_DIVISOR;
  }
  return Math.pow((normalized + SRGB_OFFSET) / SRGB_DENOMINATOR, SRGB_GAMMA);
}

/**
 * 16진수 색상의 상대 밝기(relative luminance)를 계산합니다.
 * WCAG 2.x 공식에 따라 계산됩니다.
 * @param hex - `#RRGGBB` 또는 `#RGB` 형식의 색상 문자열
 * @returns 상대 밝기 (0–1)
 */
export function calculateLuminance(hex: string): number {
  const { r, g, b } = parseHex(hex);
  const rLin = toLinear(r);
  const gLin = toLinear(g);
  const bLin = toLinear(b);
  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
}

/**
 * 전경색과 배경색 사이의 WCAG 대비율을 계산합니다.
 * @param fg - 전경색 (16진수)
 * @param bg - 배경색 (16진수)
 * @returns 대비율 (1–21)
 */
export function contrastRatio(fg: string, bg: string): number {
  const l1 = calculateLuminance(fg);
  const l2 = calculateLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * 두 색상의 WCAG 2.1 AA/AAA 기준 충족 여부를 검사합니다.
 * @param fg - 전경색 (16진수)
 * @param bg - 배경색 (16진수)
 * @returns 대비율, AA/AAA 충족 여부, 권장 메시지를 포함한 결과 객체
 */
export function checkContrast(fg: string, bg: string): ContrastResult {
  const ratio = contrastRatio(fg, bg);
  const meetsAA = ratio >= WCAG_AA_RATIO;
  const meetsAAA = ratio >= WCAG_AAA_RATIO;

  let recommendation: string | undefined;
  if (!meetsAA) {
    recommendation = `대비율 ${ratio.toFixed(2)}:1 — WCAG AA 기준(4.5:1)을 충족하지 않습니다. 전경색 또는 배경색을 조정하세요.`;
  } else if (!meetsAAA) {
    recommendation = `대비율 ${ratio.toFixed(2)}:1 — AA 기준은 충족하지만 AAA 기준(7:1)은 충족하지 않습니다.`;
  }

  return { ratio, meetsAA, meetsAAA, recommendation };
}

/**
 * 주어진 전경색의 밝기를 조정하여 WCAG AA 기준을 충족하는 가장 가까운 색을 반환합니다.
 * 전경색의 밝기를 단계적으로 높이거나 낮춰서 목표 대비율에 도달합니다.
 * @param fg - 조정할 전경색 (16진수)
 * @param bg - 기준 배경색 (16진수)
 * @returns AA 기준을 충족하는 16진수 색상 문자열
 */
export function suggestAccessibleColor(fg: string, bg: string): string {
  if (contrastRatio(fg, bg) >= WCAG_AA_RATIO) {
    return fg;
  }

  const bgLuminance = calculateLuminance(bg);
  const { r, g, b } = parseHex(fg);

  // 밝은 배경이면 전경색을 어둡게, 어두운 배경이면 밝게
  const shouldDarken = bgLuminance > 0.5;

  const STEP = 5;
  let adjustedR = r;
  let adjustedG = g;
  let adjustedB = b;

  for (let i = 0; i < 51; i++) {
    if (shouldDarken) {
      adjustedR = Math.max(0, adjustedR - STEP);
      adjustedG = Math.max(0, adjustedG - STEP);
      adjustedB = Math.max(0, adjustedB - STEP);
    } else {
      adjustedR = Math.min(255, adjustedR + STEP);
      adjustedG = Math.min(255, adjustedG + STEP);
      adjustedB = Math.min(255, adjustedB + STEP);
    }

    const candidate = toHex(adjustedR, adjustedG, adjustedB);
    if (contrastRatio(candidate, bg) >= WCAG_AA_RATIO) {
      return candidate;
    }
  }

  // 극단값 — 배경 반대 색
  return shouldDarken ? "#000000" : "#ffffff";
}

/**
 * RGB 컴포넌트를 16진수 색상 문자열로 변환합니다.
 * @param r - 빨강 (0–255)
 * @param g - 초록 (0–255)
 * @param b - 파랑 (0–255)
 * @returns `#RRGGBB` 형식의 문자열
 */
function toHex(r: number, g: number, b: number): string {
  return (
    "#" +
    r.toString(16).padStart(2, "0") +
    g.toString(16).padStart(2, "0") +
    b.toString(16).padStart(2, "0")
  );
}

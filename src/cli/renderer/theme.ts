/**
 * theme.ts — 테마 시스템 (다크/라이트/자동/색맹 접근성 테마)
 *
 * 모든 UI 컴포넌트에서 일관된 색상 토큰을 제공합니다.
 * 4가지 테마를 지원합니다:
 * - dark: 어두운 터미널용 (기본값, 대부분의 사용자)
 * - light: 밝은 터미널용
 * - auto: 시스템 환경변수(COLORFGBG)로 자동 감지
 * - colorblind: 색맹 접근성 테마 (적록색맹 안전)
 *
 * 사용 방법:
 * - getTheme(name): 이름으로 테마 가져오기
 * - setActiveTheme(name): 전역 활성 테마 변경
 * - getActiveTheme(): 현재 활성 테마 조회
 */

/** 테마 이름 옵션 — 4가지 모드를 지원 */
export type ThemeName = "dark" | "light" | "auto" | "colorblind";

/** 테마의 색상 팔레트 — 각 용도별 색상 토큰을 정의 */
export interface ThemeColors {
  readonly primary: string;
  readonly secondary: string;
  readonly success: string;
  readonly warning: string;
  readonly error: string;
  readonly info: string;
  readonly muted: string;
  readonly text: string;
  readonly border: string;
  readonly background: string;
  readonly highlight: string;
  readonly code: string;
}

/** 완전한 테마 정의 — 이름과 색상 팔레트를 포함 */
export interface Theme {
  readonly name: ThemeName;
  readonly colors: ThemeColors;
}

/** 다크 테마 (기본값) — 시안/청록 Double Helix 브랜드 컬러 */
const darkTheme: Theme = {
  name: "dark",
  colors: {
    primary: "cyan",
    secondary: "#00BCD4",
    success: "#00E5FF",
    warning: "yellow",
    error: "red",
    info: "cyanBright",
    muted: "gray",
    text: "white",
    border: "#0097A7",
    background: "black",
    highlight: "cyanBright",
    code: "cyanBright",
  },
};

/** 라이트 테마 — 밝은 배경의 터미널용, 파랑 primary */
const lightTheme: Theme = {
  name: "light",
  colors: {
    primary: "blue",
    secondary: "magenta",
    success: "green",
    warning: "#b58900",
    error: "red",
    info: "cyan",
    muted: "gray",
    text: "black",
    border: "gray",
    background: "white",
    highlight: "blue",
    code: "green",
  },
};

/** 색맹 접근성 테마 (적록색맹 안전) — 초록 대신 파랑을 success 색상으로 사용 */
const colorblindTheme: Theme = {
  name: "colorblind",
  colors: {
    primary: "blue",
    secondary: "magenta",
    success: "blue",
    warning: "yellow",
    error: "red",
    info: "cyan",
    muted: "gray",
    text: "white",
    border: "gray",
    background: "black",
    highlight: "yellowBright",
    code: "cyanBright",
  },
};

/** 사용 가능한 모든 테마 — 이름으로 조회 가능 */
const themes: Record<string, Theme> = {
  dark: darkTheme,
  light: lightTheme,
  colorblind: colorblindTheme,
};

/**
 * 시스템의 색상 스킴 설정을 감지합니다.
 * COLORFGBG 환경변수를 분석하여 "dark" 또는 "light"를 반환합니다.
 * 감지할 수 없으면 "dark"를 기본값으로 사용합니다 (대부분의 터미널 사용자 선호).
 */
function detectSystemTheme(): "dark" | "light" {
  // Check common environment variables
  const colorTerm = process.env.COLORFGBG;
  if (colorTerm) {
    const parts = colorTerm.split(";");
    const bg = parseInt(parts[parts.length - 1], 10);
    // Background color > 6 typically means light theme
    if (!isNaN(bg) && bg > 6) return "light";
  }

  // Default to dark (most terminal users prefer dark)
  return "dark";
}

/** 이름으로 테마를 가져옴 — "auto"이면 시스템 감지 결과를 사용 */
export function getTheme(name: ThemeName): Theme {
  if (name === "auto") {
    const detected = detectSystemTheme();
    return themes[detected];
  }
  return themes[name] ?? darkTheme;
}

/** 사용 가능한 모든 테마 이름 목록을 반환 */
export function getThemeNames(): readonly ThemeName[] {
  return ["dark", "light", "auto", "colorblind"];
}

/** 현재 활성 테마 (변경 가능한 싱글톤) — setActiveTheme()으로 변경 */
let activeTheme: Theme = darkTheme;

/** 전역 활성 테마를 변경하고 새 테마 객체를 반환 */
export function setActiveTheme(name: ThemeName): Theme {
  activeTheme = getTheme(name);
  return activeTheme;
}

/** 현재 활성 테마를 조회 */
export function getActiveTheme(): Theme {
  return activeTheme;
}

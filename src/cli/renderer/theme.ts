/**
 * Theme system — dark/light/auto/colorblind-accessible themes.
 * Provides consistent color tokens across all UI components.
 */

/** Theme name options */
export type ThemeName = "dark" | "light" | "auto" | "colorblind";

/** Color palette for a theme */
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

/** A complete theme definition */
export interface Theme {
  readonly name: ThemeName;
  readonly colors: ThemeColors;
}

/** Dark theme (default) */
const darkTheme: Theme = {
  name: "dark",
  colors: {
    primary: "cyan",
    secondary: "magenta",
    success: "green",
    warning: "yellow",
    error: "red",
    info: "blue",
    muted: "gray",
    text: "white",
    border: "gray",
    background: "black",
    highlight: "yellowBright",
    code: "greenBright",
  },
};

/** Light theme */
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

/** Colorblind-accessible theme (deuteranopia-safe) */
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

/** All available themes */
const themes: Record<string, Theme> = {
  dark: darkTheme,
  light: lightTheme,
  colorblind: colorblindTheme,
};

/**
 * Detect system color scheme preference.
 * Returns "dark" or "light" based on environment hints.
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

/** Get a theme by name */
export function getTheme(name: ThemeName): Theme {
  if (name === "auto") {
    const detected = detectSystemTheme();
    return themes[detected];
  }
  return themes[name] ?? darkTheme;
}

/** List all available theme names */
export function getThemeNames(): readonly ThemeName[] {
  return ["dark", "light", "auto", "colorblind"];
}

/** Current active theme (mutable singleton) */
let activeTheme: Theme = darkTheme;

/** Set the active theme */
export function setActiveTheme(name: ThemeName): Theme {
  activeTheme = getTheme(name);
  return activeTheme;
}

/** Get the current active theme */
export function getActiveTheme(): Theme {
  return activeTheme;
}

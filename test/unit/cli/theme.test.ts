import { describe, it, expect } from "vitest";
import {
  getTheme,
  getThemeNames,
  setActiveTheme,
  getActiveTheme,
} from "../../../src/cli/renderer/theme.js";

describe("theme", () => {
  it("should return dark theme by default", () => {
    const theme = getTheme("dark");
    expect(theme.name).toBe("dark");
    expect(theme.colors.primary).toBe("cyan");
  });

  it("should return light theme", () => {
    const theme = getTheme("light");
    expect(theme.name).toBe("light");
    expect(theme.colors.text).toBe("black");
  });

  it("should return colorblind theme", () => {
    const theme = getTheme("colorblind");
    expect(theme.name).toBe("colorblind");
    // Colorblind theme uses blue for success instead of green
    expect(theme.colors.success).toBe("blue");
  });

  it("should resolve auto theme", () => {
    const theme = getTheme("auto");
    // Should resolve to either dark or light
    expect(["dark", "light"]).toContain(theme.name);
  });

  it("should fall back to dark for unknown theme", () => {
    const theme = getTheme("nonexistent" as "dark");
    expect(theme.name).toBe("dark");
  });

  it("should list all theme names", () => {
    const names = getThemeNames();
    expect(names).toContain("dark");
    expect(names).toContain("light");
    expect(names).toContain("auto");
    expect(names).toContain("colorblind");
  });

  it("should set and get active theme", () => {
    setActiveTheme("light");
    const active = getActiveTheme();
    expect(active.name).toBe("light");

    // Reset to dark
    setActiveTheme("dark");
    expect(getActiveTheme().name).toBe("dark");
  });

  it("should have all required color tokens", () => {
    const theme = getTheme("dark");
    const requiredTokens = [
      "primary",
      "secondary",
      "success",
      "warning",
      "error",
      "info",
      "muted",
      "text",
      "border",
      "background",
      "highlight",
      "code",
    ];
    for (const token of requiredTokens) {
      expect(theme.colors).toHaveProperty(token);
    }
  });
});

import { describe, it, expect } from "vitest";
import {
  calculateLuminance,
  contrastRatio,
  checkContrast,
  suggestAccessibleColor,
} from "../../../../src/cli/accessibility/contrast.js";

describe("calculateLuminance", () => {
  it("검정(#000000)의 밝기는 0이어야 한다", () => {
    expect(calculateLuminance("#000000")).toBeCloseTo(0, 5);
  });

  it("흰색(#ffffff)의 밝기는 1이어야 한다", () => {
    expect(calculateLuminance("#ffffff")).toBeCloseTo(1, 5);
  });

  it("#RGB 3자리 단축 표기를 처리한다", () => {
    const short = calculateLuminance("#fff");
    const full = calculateLuminance("#ffffff");
    expect(short).toBeCloseTo(full, 5);
  });

  it("중간 밝기 색상이 0–1 범위 내에 있어야 한다", () => {
    const luminance = calculateLuminance("#808080");
    expect(luminance).toBeGreaterThan(0);
    expect(luminance).toBeLessThan(1);
  });

  it("잘못된 hex 색상은 에러를 던진다", () => {
    expect(() => calculateLuminance("#12345")).toThrow();
  });
});

describe("contrastRatio", () => {
  it("검정과 흰색의 대비율은 21이어야 한다", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
  });

  it("동일한 색상의 대비율은 1이어야 한다", () => {
    expect(contrastRatio("#808080", "#808080")).toBeCloseTo(1, 5);
  });

  it("fg와 bg 순서를 바꿔도 결과가 같아야 한다", () => {
    const r1 = contrastRatio("#000000", "#ffffff");
    const r2 = contrastRatio("#ffffff", "#000000");
    expect(r1).toBeCloseTo(r2, 5);
  });

  it("대비율은 항상 1 이상이어야 한다", () => {
    expect(contrastRatio("#123456", "#abcdef")).toBeGreaterThanOrEqual(1);
  });
});

describe("checkContrast", () => {
  it("검정/흰색 조합은 AA와 AAA를 모두 충족한다", () => {
    const result = checkContrast("#000000", "#ffffff");
    expect(result.meetsAA).toBe(true);
    expect(result.meetsAAA).toBe(true);
    expect(result.recommendation).toBeUndefined();
  });

  it("낮은 대비율은 AA를 충족하지 않는다", () => {
    // #777777 on #888888 — 낮은 대비
    const result = checkContrast("#777777", "#888888");
    expect(result.meetsAA).toBe(false);
    expect(result.meetsAAA).toBe(false);
    expect(result.recommendation).toBeDefined();
  });

  it("AA 충족하지만 AAA 미충족 시 권장 메시지가 있다", () => {
    // #595959 on #ffffff → ratio ~7:1 경계 근처
    // #767676 on #ffffff → ratio ~4.54:1, AA만 충족
    const result = checkContrast("#767676", "#ffffff");
    expect(result.meetsAA).toBe(true);
    expect(result.meetsAAA).toBe(false);
    expect(result.recommendation).toBeDefined();
  });

  it("ratio가 ContrastResult에 포함된다", () => {
    const result = checkContrast("#000000", "#ffffff");
    expect(result.ratio).toBeCloseTo(21, 1);
  });
});

describe("suggestAccessibleColor", () => {
  it("이미 AA 기준을 충족하면 원래 색상을 반환한다", () => {
    const result = suggestAccessibleColor("#000000", "#ffffff");
    expect(result).toBe("#000000");
  });

  it("반환된 색상은 AA 기준(4.5:1)을 충족해야 한다", () => {
    // 낮은 대비: 회색 on 흰색
    const suggested = suggestAccessibleColor("#aaaaaa", "#ffffff");
    expect(contrastRatio(suggested, "#ffffff")).toBeGreaterThanOrEqual(4.5);
  });

  it("어두운 배경에서 밝은 색을 제안한다", () => {
    const suggested = suggestAccessibleColor("#555555", "#000000");
    expect(contrastRatio(suggested, "#000000")).toBeGreaterThanOrEqual(4.5);
  });

  it("반환값은 '#' 으로 시작하는 hex 문자열이다", () => {
    const result = suggestAccessibleColor("#aaaaaa", "#ffffff");
    expect(result).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

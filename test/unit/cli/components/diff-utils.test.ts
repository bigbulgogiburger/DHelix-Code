/**
 * diff-utils.test.ts — diff 유틸리티 순수 함수 테스트
 *
 * computeDiff, detectLanguage, formatLineNumber 함수를 검증합니다.
 * React/Ink 의존성이 없는 순수 로직만 테스트합니다.
 */
import { describe, it, expect } from "vitest";

import { computeDiff, detectLanguage, formatLineNumber } from "../../../../src/cli/components/diff-utils.js";
import type { DiffHunk, DiffLine } from "../../../../src/cli/components/diff-utils.js";

describe("computeDiff", () => {
  it("동일한 텍스트는 빈 배열을 반환한다", () => {
    const text = "hello\nworld\n";
    const result = computeDiff(text, text);
    expect(result).toEqual([]);
  });

  it("빈 파일 → 빈 파일은 빈 배열을 반환한다", () => {
    const result = computeDiff("", "");
    expect(result).toEqual([]);
  });

  it("추가만 있는 경우 올바른 DiffHunk를 생성한다", () => {
    const before = "line1\nline2\nline3\n";
    const after = "line1\nline2\nnewLine\nline3\n";

    const hunks = computeDiff(before, after, 2);

    expect(hunks.length).toBeGreaterThanOrEqual(1);

    const addLines = hunks.flatMap((h) => h.lines).filter((l) => l.type === "add");
    expect(addLines.length).toBe(1);
    expect(addLines[0].content).toBe("newLine");
    expect(addLines[0].newLineNumber).toBeDefined();
    expect(addLines[0].oldLineNumber).toBeUndefined();
  });

  it("삭제만 있는 경우 올바른 DiffHunk를 생성한다", () => {
    const before = "line1\nline2\nline3\n";
    const after = "line1\nline3\n";

    const hunks = computeDiff(before, after, 2);

    expect(hunks.length).toBeGreaterThanOrEqual(1);

    const removeLines = hunks.flatMap((h) => h.lines).filter((l) => l.type === "remove");
    expect(removeLines.length).toBe(1);
    expect(removeLines[0].content).toBe("line2");
    expect(removeLines[0].oldLineNumber).toBeDefined();
    expect(removeLines[0].newLineNumber).toBeUndefined();
  });

  it("혼합 변경(추가+삭제)을 올바르게 처리한다", () => {
    const before = "alpha\nbeta\ngamma\n";
    const after = "alpha\nBETA\ngamma\ndelta\n";

    const hunks = computeDiff(before, after, 1);

    expect(hunks.length).toBeGreaterThanOrEqual(1);

    const allLines = hunks.flatMap((h) => h.lines);
    const addLines = allLines.filter((l) => l.type === "add");
    const removeLines = allLines.filter((l) => l.type === "remove");

    // "beta" 삭제 + "BETA" 추가 + "delta" 추가
    expect(removeLines.length).toBeGreaterThanOrEqual(1);
    expect(addLines.length).toBeGreaterThanOrEqual(1);
    expect(removeLines.some((l) => l.content === "beta")).toBe(true);
    expect(addLines.some((l) => l.content === "BETA")).toBe(true);
  });

  it("빈 파일에서 내용 추가를 처리한다", () => {
    const before = "";
    const after = "hello\nworld\n";

    const hunks = computeDiff(before, after);

    expect(hunks.length).toBeGreaterThanOrEqual(1);
    const addLines = hunks.flatMap((h) => h.lines).filter((l) => l.type === "add");
    expect(addLines.length).toBeGreaterThanOrEqual(1);
  });

  it("내용에서 빈 파일로의 삭제를 처리한다", () => {
    const before = "hello\nworld\n";
    const after = "";

    const hunks = computeDiff(before, after);

    expect(hunks.length).toBeGreaterThanOrEqual(1);
    const removeLines = hunks.flatMap((h) => h.lines).filter((l) => l.type === "remove");
    expect(removeLines.length).toBeGreaterThanOrEqual(1);
  });

  it("헝크 헤더가 @@ 형식을 따른다", () => {
    const before = "a\nb\nc\n";
    const after = "a\nB\nc\n";

    const hunks = computeDiff(before, after, 1);

    expect(hunks.length).toBeGreaterThanOrEqual(1);
    expect(hunks[0].header).toMatch(/^@@ -\d+,\d+ \+\d+,\d+ @@$/);
  });

  it("contextLines 파라미터가 컨텍스트 줄 수를 조절한다", () => {
    const lines = Array.from({ length: 20 }, (_, i) => `line${i + 1}`).join("\n") + "\n";
    const modified = lines.replace("line10", "LINE10");

    const hunks0 = computeDiff(lines, modified, 0);
    const hunks5 = computeDiff(lines, modified, 5);

    const contextCount0 = hunks0.flatMap((h) => h.lines).filter((l) => l.type === "context").length;
    const contextCount5 = hunks5.flatMap((h) => h.lines).filter((l) => l.type === "context").length;

    expect(contextCount5).toBeGreaterThan(contextCount0);
  });

  it("DiffLine 구조가 올바르다", () => {
    const before = "hello\n";
    const after = "world\n";

    const hunks = computeDiff(before, after);
    const allLines = hunks.flatMap((h) => h.lines);

    for (const line of allLines) {
      expect(["add", "remove", "context"]).toContain(line.type);
      expect(typeof line.content).toBe("string");

      if (line.type === "add") {
        expect(line.newLineNumber).toBeDefined();
        expect(line.oldLineNumber).toBeUndefined();
      } else if (line.type === "remove") {
        expect(line.oldLineNumber).toBeDefined();
        expect(line.newLineNumber).toBeUndefined();
      } else {
        expect(line.oldLineNumber).toBeDefined();
        expect(line.newLineNumber).toBeDefined();
      }
    }
  });
});

describe("detectLanguage", () => {
  it(".ts → typescript", () => {
    expect(detectLanguage("src/main.ts")).toBe("typescript");
  });

  it(".tsx → tsx", () => {
    expect(detectLanguage("components/App.tsx")).toBe("tsx");
  });

  it(".js → javascript", () => {
    expect(detectLanguage("index.js")).toBe("javascript");
  });

  it(".py → python", () => {
    expect(detectLanguage("script.py")).toBe("python");
  });

  it(".go → go", () => {
    expect(detectLanguage("main.go")).toBe("go");
  });

  it(".rs → rust", () => {
    expect(detectLanguage("lib.rs")).toBe("rust");
  });

  it(".java → java", () => {
    expect(detectLanguage("Main.java")).toBe("java");
  });

  it(".json → json", () => {
    expect(detectLanguage("package.json")).toBe("json");
  });

  it(".yml → yaml", () => {
    expect(detectLanguage("config.yml")).toBe("yaml");
  });

  it(".css → css", () => {
    expect(detectLanguage("styles.css")).toBe("css");
  });

  it(".html → html", () => {
    expect(detectLanguage("index.html")).toBe("html");
  });

  it("unknown 확장자 → text", () => {
    expect(detectLanguage("README.xyz")).toBe("text");
  });

  it("확장자가 없는 경로 → text", () => {
    expect(detectLanguage("Makefile")).toBe("text");
  });

  it("경로에 점이 여러 개인 경우 마지막 확장자를 사용한다", () => {
    expect(detectLanguage("src/app.test.ts")).toBe("typescript");
  });
});

describe("formatLineNumber", () => {
  it("숫자를 고정 너비로 오른쪽 정렬한다", () => {
    expect(formatLineNumber(1, 4)).toBe("   1");
    expect(formatLineNumber(42, 4)).toBe("  42");
    expect(formatLineNumber(999, 4)).toBe(" 999");
    expect(formatLineNumber(1234, 4)).toBe("1234");
  });

  it("undefined는 공백 문자열을 반환한다", () => {
    expect(formatLineNumber(undefined, 4)).toBe("    ");
    expect(formatLineNumber(undefined, 6)).toBe("      ");
  });

  it("기본 너비는 4이다", () => {
    expect(formatLineNumber(7)).toBe("   7");
    expect(formatLineNumber(undefined)).toBe("    ");
  });

  it("숫자가 너비보다 큰 경우 잘리지 않는다", () => {
    expect(formatLineNumber(99999, 4)).toBe("99999");
  });

  it("너비 1에서도 동작한다", () => {
    expect(formatLineNumber(5, 1)).toBe("5");
    expect(formatLineNumber(undefined, 1)).toBe(" ");
  });
});

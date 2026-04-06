import { describe, it, expect } from "vitest";
import {
  stripAnsi,
  annotateForScreenReader,
  formatProgress,
  formatDuration,
  formatStatus,
} from "../../../../src/cli/accessibility/screen-reader.js";
import type { AriaAnnotation } from "../../../../src/cli/accessibility/screen-reader.js";

describe("stripAnsi", () => {
  it("ANSI 색상 코드를 제거한다", () => {
    const colored = "\x1B[31mhello\x1B[0m";
    expect(stripAnsi(colored)).toBe("hello");
  });

  it("ANSI 코드가 없으면 원본을 그대로 반환한다", () => {
    expect(stripAnsi("plain text")).toBe("plain text");
  });

  it("빈 문자열도 처리한다", () => {
    expect(stripAnsi("")).toBe("");
  });

  it("복합 이스케이프 시퀀스를 제거한다", () => {
    const complex = "\x1B[1;32mBold Green\x1B[0m normal";
    expect(stripAnsi(complex)).toBe("Bold Green normal");
  });

  it("커서 이동 시퀀스를 제거한다", () => {
    const cursor = "\x1B[2J\x1B[H클리어";
    expect(stripAnsi(cursor)).toBe("클리어");
  });
});

describe("annotateForScreenReader", () => {
  it("role, label, 콘텐츠를 파이프로 구분하여 반환한다", () => {
    const annotation: AriaAnnotation = {
      role: "status",
      label: "빌드 상태",
    };
    const result = annotateForScreenReader("빌드 완료", annotation);
    expect(result).toContain("[STATUS]");
    expect(result).toContain("Label: 빌드 상태");
    expect(result).toContain("빌드 완료");
  });

  it("alert role은 live: assertive를 기본으로 사용한다", () => {
    const annotation: AriaAnnotation = { role: "alert", label: "에러" };
    const result = annotateForScreenReader("에러 발생", annotation);
    expect(result).toContain("Live: assertive");
  });

  it("status role은 live: polite를 기본으로 사용한다", () => {
    const annotation: AriaAnnotation = { role: "status", label: "상태" };
    const result = annotateForScreenReader("실행 중", annotation);
    expect(result).toContain("Live: polite");
  });

  it("live: off이면 Live 필드를 생략한다", () => {
    const annotation: AriaAnnotation = {
      role: "log",
      label: "로그",
      live: "off",
    };
    const result = annotateForScreenReader("로그 항목", annotation);
    expect(result).not.toContain("Live:");
  });

  it("value가 있으면 Value 필드를 포함한다", () => {
    const annotation: AriaAnnotation = {
      role: "progressbar",
      label: "업로드",
      value: "50%",
    };
    const result = annotateForScreenReader("업로드 중", annotation);
    expect(result).toContain("Value: 50%");
  });

  it("ANSI 시퀀스를 자동으로 제거한다", () => {
    const annotation: AriaAnnotation = { role: "log", label: "출력" };
    const result = annotateForScreenReader("\x1B[32m완료\x1B[0m", annotation);
    expect(result).toContain("완료");
    expect(result).not.toContain("\x1B");
  });
});

describe("formatProgress", () => {
  it('"3 of 10 complete" 형식으로 반환한다', () => {
    expect(formatProgress(3, 10)).toBe("3 of 10 complete");
  });

  it("current === total인 경우 처리한다", () => {
    expect(formatProgress(5, 5)).toBe("5 of 5 complete");
  });

  it("current === 0인 경우 처리한다", () => {
    expect(formatProgress(0, 10)).toBe("0 of 10 complete");
  });

  it("total === 0인 경우 처리한다", () => {
    expect(formatProgress(0, 0)).toBe("0 of 0 complete");
  });

  it("current > total이면 에러를 던진다", () => {
    expect(() => formatProgress(11, 10)).toThrow();
  });

  it("음수 값이면 에러를 던진다", () => {
    expect(() => formatProgress(-1, 10)).toThrow();
  });
});

describe("formatDuration", () => {
  it("초만 있는 경우: '45 seconds'", () => {
    expect(formatDuration(45_000)).toBe("45 seconds");
  });

  it("1초는 단수형: '1 second'", () => {
    expect(formatDuration(1_000)).toBe("1 second");
  });

  it("분과 초: '2 minutes 30 seconds'", () => {
    expect(formatDuration(150_000)).toBe("2 minutes 30 seconds");
  });

  it("1분은 단수형: '1 minute 0 seconds'", () => {
    expect(formatDuration(60_000)).toBe("1 minute");
  });

  it("시간 포함: '1 hour 2 minutes'", () => {
    expect(formatDuration(3_720_000)).toBe("1 hour 2 minutes");
  });

  it("1시간 정확히: '1 hour'", () => {
    expect(formatDuration(3_600_000)).toBe("1 hour");
  });

  it("0ms는 '0 seconds'", () => {
    expect(formatDuration(0)).toBe("0 seconds");
  });

  it("음수 ms는 에러를 던진다", () => {
    expect(() => formatDuration(-1000)).toThrow();
  });

  it("시간+분+초 모두 포함", () => {
    expect(formatDuration(3_661_000)).toBe("1 hour 1 minute 1 second");
  });
});

describe("formatStatus", () => {
  it('"Status: running" 형식으로 반환한다', () => {
    expect(formatStatus("running")).toBe("Status: running");
  });

  it("ANSI 시퀀스를 제거하고 반환한다", () => {
    expect(formatStatus("\x1B[32mcomplete\x1B[0m")).toBe("Status: complete");
  });

  it("앞뒤 공백을 제거한다", () => {
    expect(formatStatus("  idle  ")).toBe("Status: idle");
  });

  it("빈 문자열도 처리한다", () => {
    expect(formatStatus("")).toBe("Status: ");
  });
});

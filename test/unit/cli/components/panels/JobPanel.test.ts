import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock ink — pure logic tests do not need actual rendering
vi.mock("ink", () => ({
  Box: () => null,
  Text: () => null,
}));

// Mock react — we test pure logic functions, not React rendering
vi.mock("react", () => ({ default: {} }));

async function getModule() {
  return import("../../../../../src/cli/components/panels/JobPanel.js");
}

describe("JobPanel — formatDuration", () => {
  let formatDuration: Awaited<ReturnType<typeof getModule>>["formatDuration"];

  beforeEach(async () => {
    const mod = await getModule();
    formatDuration = mod.formatDuration;
  });

  it("should display seconds only when under 1 minute", () => {
    expect(formatDuration(0)).toBe("0s");
    expect(formatDuration(30)).toBe("30s");
    expect(formatDuration(59)).toBe("59s");
  });

  it("should display minutes and seconds for 60+ seconds", () => {
    expect(formatDuration(60)).toBe("1m");
    expect(formatDuration(65)).toBe("1m 5s");
    expect(formatDuration(120)).toBe("2m");
    expect(formatDuration(125)).toBe("2m 5s");
  });

  it("should omit seconds when they are zero", () => {
    expect(formatDuration(60)).toBe("1m");
    expect(formatDuration(180)).toBe("3m");
  });
});

describe("JobPanel — formatProgressBar", () => {
  let formatProgressBar: Awaited<ReturnType<typeof getModule>>["formatProgressBar"];

  beforeEach(async () => {
    const mod = await getModule();
    formatProgressBar = mod.formatProgressBar;
  });

  it("should show empty bar at 0%", () => {
    expect(formatProgressBar(0, 10)).toBe("[░░░░░░░░░░] 0%");
  });

  it("should show full bar at 100%", () => {
    expect(formatProgressBar(100, 10)).toBe("[██████████] 100%");
  });

  it("should show half-filled bar at 50%", () => {
    expect(formatProgressBar(50, 10)).toBe("[█████░░░░░] 50%");
  });

  it("should clamp progress below 0 to 0", () => {
    expect(formatProgressBar(-10, 10)).toBe("[░░░░░░░░░░] 0%");
  });

  it("should clamp progress above 100 to 100", () => {
    expect(formatProgressBar(110, 10)).toBe("[██████████] 100%");
  });

  it("should use default width of 10", () => {
    const result = formatProgressBar(50);
    expect(result).toBe("[█████░░░░░] 50%");
  });
});

describe("JobPanel — component", () => {
  it("should export JobPanel as a function", async () => {
    const mod = await getModule();
    expect(typeof mod.JobPanel).toBe("function");
  });

  it("should render without crashing with empty jobs array", async () => {
    const mod = await getModule();
    const result = mod.JobPanel({ jobs: [] });
    expect(result).not.toBeUndefined();
  });

  it("should render without crashing with jobs", async () => {
    const mod = await getModule();
    const jobs = [
      { id: "1", name: "Build", status: "running" as const, progress: 50, duration: 30 },
      { id: "2", name: "Test", status: "completed" as const },
      { id: "3", name: "Deploy", status: "failed" as const },
      { id: "4", name: "Lint", status: "pending" as const },
    ];
    const result = mod.JobPanel({ jobs });
    expect(result).not.toBeUndefined();
  });

  it("should accept a custom title", async () => {
    const mod = await getModule();
    const result = mod.JobPanel({ jobs: [], title: "My Jobs" });
    expect(result).not.toBeUndefined();
  });
});

describe("JobPanel — status types", () => {
  it("should accept all valid job statuses", async () => {
    const mod = await getModule();
    const statuses: Array<import("../../../../../src/cli/components/panels/JobPanel.js").JobStatus> =
      ["running", "completed", "failed", "pending"];

    for (const status of statuses) {
      const result = mod.JobPanel({
        jobs: [{ id: "1", name: "test-job", status }],
      });
      expect(result).not.toBeUndefined();
    }
  });
});

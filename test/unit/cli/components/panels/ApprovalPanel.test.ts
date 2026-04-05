import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock ink — pure logic tests do not need actual rendering
vi.mock("ink", () => ({
  Box: () => null,
  Text: () => null,
}));

// Mock react
vi.mock("react", () => ({ default: {} }));

async function getModule() {
  return import("../../../../../src/cli/components/panels/ApprovalPanel.js");
}

describe("ApprovalPanel — formatWaitTime", () => {
  let formatWaitTime: Awaited<ReturnType<typeof getModule>>["formatWaitTime"];

  beforeEach(async () => {
    const mod = await getModule();
    formatWaitTime = mod.formatWaitTime;
  });

  it("should display seconds for elapsed time under 1 minute", () => {
    const now = 1_000_000;
    expect(formatWaitTime(now - 5_000, now)).toBe("5s ago");
    expect(formatWaitTime(now - 30_000, now)).toBe("30s ago");
    expect(formatWaitTime(now - 59_000, now)).toBe("59s ago");
  });

  it("should display minutes and seconds for 60+ seconds elapsed", () => {
    const now = 1_000_000;
    expect(formatWaitTime(now - 60_000, now)).toBe("1m ago");
    expect(formatWaitTime(now - 65_000, now)).toBe("1m 5s ago");
    expect(formatWaitTime(now - 125_000, now)).toBe("2m 5s ago");
  });

  it("should omit seconds component when it is zero", () => {
    const now = 1_000_000;
    expect(formatWaitTime(now - 120_000, now)).toBe("2m ago");
    expect(formatWaitTime(now - 180_000, now)).toBe("3m ago");
  });

  it("should return 0s ago for a future or same-time timestamp", () => {
    const now = 1_000_000;
    expect(formatWaitTime(now, now)).toBe("0s ago");
    expect(formatWaitTime(now + 5_000, now)).toBe("0s ago");
  });
});

describe("ApprovalPanel — sortApprovalsByNewest", () => {
  let sortApprovalsByNewest: Awaited<
    ReturnType<typeof getModule>
  >["sortApprovalsByNewest"];

  beforeEach(async () => {
    const mod = await getModule();
    sortApprovalsByNewest = mod.sortApprovalsByNewest;
  });

  it("should return empty array for empty input", () => {
    expect(sortApprovalsByNewest([])).toEqual([]);
  });

  it("should return single-item array unchanged", () => {
    const approvals = [{ id: "1", toolName: "bash_exec", command: "ls", timestamp: 1000 }];
    expect(sortApprovalsByNewest(approvals)).toEqual(approvals);
  });

  it("should sort approvals with newest (highest timestamp) first", () => {
    const approvals = [
      { id: "1", toolName: "bash_exec", command: "ls", timestamp: 1000 },
      { id: "2", toolName: "file_write", command: "write.txt", timestamp: 3000 },
      { id: "3", toolName: "glob_search", command: "*.ts", timestamp: 2000 },
    ];

    const sorted = sortApprovalsByNewest(approvals);
    expect(sorted[0].id).toBe("2"); // timestamp 3000
    expect(sorted[1].id).toBe("3"); // timestamp 2000
    expect(sorted[2].id).toBe("1"); // timestamp 1000
  });

  it("should not mutate the original array", () => {
    const approvals = [
      { id: "1", toolName: "bash_exec", command: "ls", timestamp: 1000 },
      { id: "2", toolName: "file_write", command: "write.txt", timestamp: 3000 },
    ];
    const original = [...approvals];
    sortApprovalsByNewest(approvals);
    expect(approvals).toEqual(original);
  });
});

describe("ApprovalPanel — component", () => {
  it("should export ApprovalPanel as a function", async () => {
    const mod = await getModule();
    expect(typeof mod.ApprovalPanel).toBe("function");
  });

  it("should render without crashing with empty approvals array", async () => {
    const mod = await getModule();
    const result = mod.ApprovalPanel({ approvals: [] });
    expect(result).not.toBeUndefined();
  });

  it("should render without crashing with multiple approvals", async () => {
    const mod = await getModule();
    const now = Date.now();
    const approvals = [
      { id: "1", toolName: "bash_exec", command: "npm test", timestamp: now - 10_000 },
      { id: "2", toolName: "file_write", command: "src/app.ts", timestamp: now - 5_000 },
    ];
    const result = mod.ApprovalPanel({ approvals, now });
    expect(result).not.toBeUndefined();
  });

  it("should accept a custom title", async () => {
    const mod = await getModule();
    const result = mod.ApprovalPanel({ approvals: [], title: "Awaiting Review" });
    expect(result).not.toBeUndefined();
  });

  it("should accept a custom now timestamp", async () => {
    const mod = await getModule();
    const fixedNow = 2_000_000;
    const approvals = [
      { id: "1", toolName: "bash_exec", command: "ls", timestamp: fixedNow - 30_000 },
    ];
    const result = mod.ApprovalPanel({ approvals, now: fixedNow });
    expect(result).not.toBeUndefined();
  });
});

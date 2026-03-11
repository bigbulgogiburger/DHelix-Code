import { describe, it, expect } from "vitest";
import { groupConsecutiveReads } from "../../../src/cli/components/ActivityFeed.js";
import type { ActivityEntry } from "../../../src/core/activity.js";

function makeEntry(type: string, name: string, data: Record<string, unknown> = {}): ActivityEntry {
  return {
    type: type as ActivityEntry["type"],
    timestamp: new Date(),
    data: { name, ...data },
  };
}

describe("groupConsecutiveReads", () => {
  it("should group 2+ consecutive file_read tool-complete entries", () => {
    const entries: ActivityEntry[] = [
      makeEntry("tool-complete", "file_read", { args: { file_path: "/a.ts" } }),
      makeEntry("tool-complete", "file_read", { args: { file_path: "/b.ts" } }),
      makeEntry("tool-complete", "file_read", { args: { file_path: "/c.ts" } }),
    ];
    const result = groupConsecutiveReads(entries);
    expect(result).toHaveLength(1);
    const group = result[0] as { type: string; entries: ActivityEntry[] };
    expect(group.type).toBe("read-group");
    expect(group.entries).toHaveLength(3);
  });

  it("should not group a single file_read", () => {
    const entries: ActivityEntry[] = [
      makeEntry("tool-complete", "file_read", { args: { file_path: "/a.ts" } }),
    ];
    const result = groupConsecutiveReads(entries);
    expect(result).toHaveLength(1);
    expect((result[0] as ActivityEntry).type).toBe("tool-complete");
  });

  it("should not group non-consecutive reads", () => {
    const entries: ActivityEntry[] = [
      makeEntry("tool-complete", "file_read", { args: { file_path: "/a.ts" } }),
      makeEntry("assistant-text", "", { content: "analyzing..." }),
      makeEntry("tool-complete", "file_read", { args: { file_path: "/b.ts" } }),
    ];
    const result = groupConsecutiveReads(entries);
    expect(result).toHaveLength(3);
  });

  it("should handle mixed entries correctly", () => {
    const entries: ActivityEntry[] = [
      makeEntry("tool-complete", "bash_exec", { args: { command: "ls" } }),
      makeEntry("tool-complete", "file_read", { args: { file_path: "/a.ts" } }),
      makeEntry("tool-complete", "file_read", { args: { file_path: "/b.ts" } }),
      makeEntry("tool-complete", "file_edit", { args: { file_path: "/c.ts" } }),
    ];
    const result = groupConsecutiveReads(entries);
    expect(result).toHaveLength(3); // bash, read-group(2), edit
    const group = result[1] as { type: string; entries: ActivityEntry[] };
    expect(group.type).toBe("read-group");
    expect(group.entries).toHaveLength(2);
  });

  it("should handle empty entries", () => {
    const result = groupConsecutiveReads([]);
    expect(result).toHaveLength(0);
  });

  it("should handle entries at the end being reads", () => {
    const entries: ActivityEntry[] = [
      makeEntry("tool-complete", "bash_exec", { args: { command: "ls" } }),
      makeEntry("tool-complete", "file_read", { args: { file_path: "/a.ts" } }),
      makeEntry("tool-complete", "file_read", { args: { file_path: "/b.ts" } }),
    ];
    const result = groupConsecutiveReads(entries);
    expect(result).toHaveLength(2); // bash, read-group(2)
  });

  it("should not group tool-start entries (only tool-complete)", () => {
    const entries: ActivityEntry[] = [
      makeEntry("tool-start", "file_read", { args: { file_path: "/a.ts" } }),
      makeEntry("tool-start", "file_read", { args: { file_path: "/b.ts" } }),
    ];
    const result = groupConsecutiveReads(entries);
    expect(result).toHaveLength(2); // Not grouped, since they're tool-start
  });

  it("should handle multiple separate groups", () => {
    const entries: ActivityEntry[] = [
      makeEntry("tool-complete", "file_read", { args: { file_path: "/a.ts" } }),
      makeEntry("tool-complete", "file_read", { args: { file_path: "/b.ts" } }),
      makeEntry("tool-complete", "bash_exec", { args: { command: "test" } }),
      makeEntry("tool-complete", "file_read", { args: { file_path: "/c.ts" } }),
      makeEntry("tool-complete", "file_read", { args: { file_path: "/d.ts" } }),
    ];
    const result = groupConsecutiveReads(entries);
    expect(result).toHaveLength(3); // group1(2), bash, group2(2)
  });
});

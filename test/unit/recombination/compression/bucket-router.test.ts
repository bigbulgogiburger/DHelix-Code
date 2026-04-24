import { describe, expect, it } from "vitest";

import { routeBucket } from "../../../../src/recombination/compression/bucket-router.js";

import { makeIR, makeIntent } from "./_fixtures.js";

describe("routeBucket", () => {
  it("routes any harness intent to principles", () => {
    const ir = makeIR({
      id: "org-harness",
      intents: [makeIntent("org-harness", { kind: "harness" })],
    });
    expect(routeBucket(ir)).toBe("principles");
  });

  it("prefers principles when L3+ plasmid has no actionable intent", () => {
    const ir = makeIR({
      id: "strategy",
      tier: "L3",
      intents: [makeIntent("strategy", { kind: "rule" })],
    });
    expect(routeBucket(ir)).toBe("principles");
  });

  it("routes rule-only plasmids to constraints (low tier)", () => {
    const ir = makeIR({
      id: "style",
      tier: "L1",
      intents: [makeIntent("style", { kind: "rule" })],
    });
    expect(routeBucket(ir)).toBe("constraints");
  });

  it("routes skill/command/hook/agent intents to capabilities", () => {
    for (const kind of ["skill", "command", "hook", "agent"] as const) {
      const ir = makeIR({
        id: `cap-${kind}`,
        intents: [makeIntent(`cap-${kind}`, { kind })],
      });
      expect(routeBucket(ir)).toBe("capabilities");
    }
  });

  it("falls back to domain-knowledge when no recognised kind is present", () => {
    const ir = makeIR({
      id: "oddball",
      intents: [],
    });
    expect(routeBucket(ir)).toBe("domain-knowledge");
  });

  it("harness wins over actionable kinds in the same plasmid", () => {
    const ir = makeIR({
      id: "mixed",
      intents: [
        makeIntent("mixed", { id: "a", kind: "skill" }),
        makeIntent("mixed", { id: "b", kind: "harness" }),
      ],
    });
    expect(routeBucket(ir)).toBe("principles");
  });

  it("L3/L4 override fires only without actionable intents", () => {
    const ir = makeIR({
      id: "high-with-skill",
      tier: "L4",
      intents: [makeIntent("high-with-skill", { kind: "skill" })],
    });
    expect(routeBucket(ir)).toBe("capabilities");
  });
});

import { describe, it, expect } from "vitest";
import { homedir } from "node:os";
import {
  TrustTier,
  DEFAULT_TIER_POLICIES,
  resolveTier,
  getTierPolicy,
} from "../../../src/permissions/trust-tiers.js";
import type { TierPolicy } from "../../../src/permissions/trust-tiers.js";

const HOME = homedir();

describe("TrustTier", () => {
  it("should define four tiers with correct values", () => {
    expect(TrustTier.BuiltIn).toBe("T0");
    expect(TrustTier.LocallyAuthored).toBe("T1");
    expect(TrustTier.ProjectShared).toBe("T2");
    expect(TrustTier.External).toBe("T3");
  });
});

describe("DEFAULT_TIER_POLICIES", () => {
  it("should contain policies for all four tiers", () => {
    expect(DEFAULT_TIER_POLICIES[TrustTier.BuiltIn]).toBeDefined();
    expect(DEFAULT_TIER_POLICIES[TrustTier.LocallyAuthored]).toBeDefined();
    expect(DEFAULT_TIER_POLICIES[TrustTier.ProjectShared]).toBeDefined();
    expect(DEFAULT_TIER_POLICIES[TrustTier.External]).toBeDefined();
  });

  it("T0 BuiltIn should have maximum trust (all allow, no sandbox)", () => {
    const policy = DEFAULT_TIER_POLICIES[TrustTier.BuiltIn];
    expect(policy.fileReadProject).toBe("allow");
    expect(policy.fileWriteProject).toBe("allow");
    expect(policy.shellExecution).toBe("allow");
    expect(policy.networkOutbound).toBe("allow");
    expect(policy.sandbox).toBe("none");
  });

  it("T1 LocallyAuthored should allow file ops but ask for shell/network", () => {
    const policy = DEFAULT_TIER_POLICIES[TrustTier.LocallyAuthored];
    expect(policy.fileReadProject).toBe("allow");
    expect(policy.fileWriteProject).toBe("allow");
    expect(policy.shellExecution).toBe("ask");
    expect(policy.networkOutbound).toBe("ask");
    expect(policy.sandbox).toBe("process");
  });

  it("T2 ProjectShared should ask for file write, shell, and network", () => {
    const policy = DEFAULT_TIER_POLICIES[TrustTier.ProjectShared];
    expect(policy.fileReadProject).toBe("allow");
    expect(policy.fileWriteProject).toBe("ask");
    expect(policy.shellExecution).toBe("ask");
    expect(policy.networkOutbound).toBe("ask");
    expect(policy.sandbox).toBe("process");
  });

  it("T3 External should deny file writes and shell, require os sandbox", () => {
    const policy = DEFAULT_TIER_POLICIES[TrustTier.External];
    expect(policy.fileWriteProject).toBe("deny");
    expect(policy.shellExecution).toBe("deny");
    expect(policy.sandbox).toBe("os");
  });

  it("should be ordered by privilege (T0 most, T3 least)", () => {
    const privilegeScore = (p: TierPolicy): number => {
      const score = (v: string) => (v === "allow" ? 2 : v === "ask" ? 1 : 0);
      return score(p.fileReadProject) + score(p.fileWriteProject) + score(p.shellExecution) + score(p.networkOutbound);
    };

    const t0 = privilegeScore(DEFAULT_TIER_POLICIES[TrustTier.BuiltIn]);
    const t1 = privilegeScore(DEFAULT_TIER_POLICIES[TrustTier.LocallyAuthored]);
    const t2 = privilegeScore(DEFAULT_TIER_POLICIES[TrustTier.ProjectShared]);
    const t3 = privilegeScore(DEFAULT_TIER_POLICIES[TrustTier.External]);

    expect(t0).toBeGreaterThanOrEqual(t1);
    expect(t1).toBeGreaterThanOrEqual(t2);
    expect(t2).toBeGreaterThanOrEqual(t3);
  });
});

describe("resolveTier", () => {
  // ─── T0: BuiltIn ──────────────────────────────────────────────────────────

  it("should return T0 for undefined source", () => {
    expect(resolveTier(undefined)).toBe(TrustTier.BuiltIn);
  });

  it('should return T0 for "builtin" string', () => {
    expect(resolveTier("builtin")).toBe(TrustTier.BuiltIn);
  });

  // ─── T1: LocallyAuthored ──────────────────────────────────────────────────

  it("should return T1 for ~/.dhelix/skills/ path", () => {
    expect(resolveTier(`${HOME}/.dhelix/skills/my-skill.js`)).toBe(TrustTier.LocallyAuthored);
  });

  it("should return T1 for tilde-prefixed ~/.dhelix/ path", () => {
    expect(resolveTier("~/.dhelix/skills/foo.ts")).toBe(TrustTier.LocallyAuthored);
  });

  it("should return T1 for any path under ~/.dhelix/", () => {
    expect(resolveTier(`${HOME}/.dhelix/commands/bar.js`)).toBe(TrustTier.LocallyAuthored);
  });

  // ─── T2: ProjectShared ────────────────────────────────────────────────────

  it("should return T2 for project-level .dhelix/ path", () => {
    expect(resolveTier("/project/myapp/.dhelix/skills/shared.js")).toBe(TrustTier.ProjectShared);
  });

  it("should return T2 for .dhelix path not in home directory", () => {
    expect(resolveTier("/workspaces/repo/.dhelix/tools/lint.ts")).toBe(TrustTier.ProjectShared);
  });

  // ─── T3: External ─────────────────────────────────────────────────────────

  it("should return T3 for npm: prefixed source", () => {
    expect(resolveTier("npm:@company/dhelix-plugin")).toBe(TrustTier.External);
  });

  it("should return T3 for https:// URL", () => {
    expect(resolveTier("https://mcp.example.com/server")).toBe(TrustTier.External);
  });

  it("should return T3 for http:// URL", () => {
    expect(resolveTier("http://localhost:3000/mcp")).toBe(TrustTier.External);
  });

  it("should return T3 for npx: prefixed source", () => {
    expect(resolveTier("npx:some-mcp-server")).toBe(TrustTier.External);
  });

  it("should return T3 for unknown path without .dhelix", () => {
    expect(resolveTier("/usr/local/bin/some-tool")).toBe(TrustTier.External);
  });
});

describe("getTierPolicy", () => {
  it("should return the correct policy for each tier", () => {
    for (const tier of Object.values(TrustTier)) {
      const policy = getTierPolicy(tier as TrustTier);
      expect(policy).toBe(DEFAULT_TIER_POLICIES[tier as TrustTier]);
    }
  });

  it("should return T0 policy with sandbox: none", () => {
    expect(getTierPolicy(TrustTier.BuiltIn).sandbox).toBe("none");
  });

  it("should return T3 policy with sandbox: os", () => {
    expect(getTierPolicy(TrustTier.External).sandbox).toBe("os");
  });
});

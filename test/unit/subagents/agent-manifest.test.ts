import { describe, it, expect } from "vitest";
import {
  type AgentManifest,
  validateManifest,
  getBuiltinManifest,
  listBuiltinManifests,
  EXPLORE_MANIFEST,
  PLAN_MANIFEST,
  IMPLEMENT_MANIFEST,
  REVIEW_MANIFEST,
  TEST_MANIFEST,
  BUILD_MANIFEST,
  SECURITY_MANIFEST,
  COMPACT_MANIFEST,
} from "../../../src/subagents/agent-manifest.js";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** 유효한 최소 AgentManifest를 생성합니다 (테스트용). */
function makeMinimalManifest(overrides: Partial<AgentManifest> = {}): AgentManifest {
  return {
    id: "test-agent",
    purpose: {
      shortDescription: "Test agent",
      detailedDescription: "A minimal test agent manifest",
      category: "general",
    },
    allowedTools: ["file_read"],
    memoryScope: "session",
    isolationMode: "shared",
    modelConfig: {
      preferredModel: "claude-haiku-4-5",
    },
    maxSteps: 10,
    maxTokenBudget: 50_000,
    backgroundCapable: false,
    systemPromptTemplate: "You are a test agent.",
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// validateManifest — valid cases
// ─────────────────────────────────────────────────────────────────────────────

describe("validateManifest", () => {
  describe("valid manifests", () => {
    it("should accept a minimal valid manifest", () => {
      const result = validateManifest(makeMinimalManifest());
      expect(result.valid).toBe(true);
    });

    it("should accept manifest with all optional fields set", () => {
      const result = validateManifest(
        makeMinimalManifest({
          blockedTools: ["bash_exec"],
          verificationProfile: {
            runTests: true,
            typeCheck: true,
            lint: true,
            customChecks: ["npm run build"],
          },
          modelConfig: {
            preferredModel: "claude-sonnet-4-5",
            fallbackModel: "claude-haiku-4-5",
            temperature: 0.5,
            reasoningEffort: "high",
            maxOutputTokens: 8192,
          },
        }),
      );
      expect(result.valid).toBe(true);
    });

    it("should accept id with hyphens and numbers", () => {
      const result = validateManifest(makeMinimalManifest({ id: "my-agent-v2" }));
      expect(result.valid).toBe(true);
    });

    it("should accept temperature at boundary values (0 and 2)", () => {
      const atZero = validateManifest(
        makeMinimalManifest({ modelConfig: { preferredModel: "m", temperature: 0 } }),
      );
      const atTwo = validateManifest(
        makeMinimalManifest({ modelConfig: { preferredModel: "m", temperature: 2 } }),
      );
      expect(atZero.valid).toBe(true);
      expect(atTwo.valid).toBe(true);
    });

    it("should accept all valid category values", () => {
      const categories = [
        "research",
        "implementation",
        "review",
        "testing",
        "planning",
        "general",
      ] as const;
      for (const category of categories) {
        const result = validateManifest(
          makeMinimalManifest({ purpose: { shortDescription: "ok", detailedDescription: "d", category } }),
        );
        expect(result.valid, `category '${category}' should be valid`).toBe(true);
      }
    });

    it("should accept memoryScope values: session, project, global, none", () => {
      const scopes = ["session", "project", "global", "none"] as const;
      for (const memoryScope of scopes) {
        const result = validateManifest(makeMinimalManifest({ memoryScope }));
        expect(result.valid, `memoryScope '${memoryScope}' should be valid`).toBe(true);
      }
    });

    it("should accept isolationMode values: shared, worktree, sandbox, container", () => {
      const modes = ["shared", "worktree", "sandbox", "container"] as const;
      for (const isolationMode of modes) {
        const result = validateManifest(makeMinimalManifest({ isolationMode }));
        expect(result.valid, `isolationMode '${isolationMode}' should be valid`).toBe(true);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // validateManifest — invalid cases
  // ─────────────────────────────────────────────────────────────────────────

  describe("id validation", () => {
    it("should reject empty id", () => {
      const result = validateManifest(makeMinimalManifest({ id: "" }));
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.some((e) => e.includes("id"))).toBe(true);
      }
    });

    it("should reject id starting with uppercase", () => {
      const result = validateManifest(makeMinimalManifest({ id: "MyAgent" }));
      expect(result.valid).toBe(false);
    });

    it("should reject id starting with a number", () => {
      const result = validateManifest(makeMinimalManifest({ id: "1agent" }));
      expect(result.valid).toBe(false);
    });

    it("should reject id with underscores", () => {
      const result = validateManifest(makeMinimalManifest({ id: "my_agent" }));
      expect(result.valid).toBe(false);
    });

    it("should reject id with spaces", () => {
      const result = validateManifest(makeMinimalManifest({ id: "my agent" }));
      expect(result.valid).toBe(false);
    });
  });

  describe("purpose.shortDescription validation", () => {
    it("should reject empty shortDescription", () => {
      const result = validateManifest(
        makeMinimalManifest({
          purpose: { shortDescription: "", detailedDescription: "d", category: "general" },
        }),
      );
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.some((e) => e.includes("shortDescription"))).toBe(true);
      }
    });

    it("should reject shortDescription longer than 50 chars", () => {
      const longDesc = "a".repeat(51);
      const result = validateManifest(
        makeMinimalManifest({
          purpose: { shortDescription: longDesc, detailedDescription: "d", category: "general" },
        }),
      );
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.some((e) => e.includes("shortDescription"))).toBe(true);
      }
    });

    it("should accept shortDescription of exactly 50 chars", () => {
      const desc50 = "a".repeat(50);
      const result = validateManifest(
        makeMinimalManifest({
          purpose: { shortDescription: desc50, detailedDescription: "d", category: "general" },
        }),
      );
      expect(result.valid).toBe(true);
    });
  });

  describe("allowedTools validation", () => {
    it("should reject empty allowedTools array", () => {
      const result = validateManifest(makeMinimalManifest({ allowedTools: [] }));
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.some((e) => e.includes("allowedTools"))).toBe(true);
      }
    });
  });

  describe("maxSteps validation", () => {
    it("should reject zero maxSteps", () => {
      const result = validateManifest(makeMinimalManifest({ maxSteps: 0 }));
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.some((e) => e.includes("maxSteps"))).toBe(true);
      }
    });

    it("should reject negative maxSteps", () => {
      const result = validateManifest(makeMinimalManifest({ maxSteps: -5 }));
      expect(result.valid).toBe(false);
    });

    it("should reject non-integer maxSteps", () => {
      const result = validateManifest(makeMinimalManifest({ maxSteps: 1.5 }));
      expect(result.valid).toBe(false);
    });
  });

  describe("maxTokenBudget validation", () => {
    it("should reject zero maxTokenBudget", () => {
      const result = validateManifest(makeMinimalManifest({ maxTokenBudget: 0 }));
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.some((e) => e.includes("maxTokenBudget"))).toBe(true);
      }
    });

    it("should reject negative maxTokenBudget", () => {
      const result = validateManifest(makeMinimalManifest({ maxTokenBudget: -1 }));
      expect(result.valid).toBe(false);
    });
  });

  describe("modelConfig validation", () => {
    it("should reject empty preferredModel", () => {
      const result = validateManifest(
        makeMinimalManifest({ modelConfig: { preferredModel: "" } }),
      );
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.some((e) => e.includes("preferredModel"))).toBe(true);
      }
    });

    it("should reject temperature below 0", () => {
      const result = validateManifest(
        makeMinimalManifest({ modelConfig: { preferredModel: "m", temperature: -0.1 } }),
      );
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.some((e) => e.includes("temperature"))).toBe(true);
      }
    });

    it("should reject temperature above 2", () => {
      const result = validateManifest(
        makeMinimalManifest({ modelConfig: { preferredModel: "m", temperature: 2.1 } }),
      );
      expect(result.valid).toBe(false);
    });
  });

  describe("multiple errors", () => {
    it("should collect all errors at once", () => {
      const result = validateManifest(
        makeMinimalManifest({ id: "", allowedTools: [], maxSteps: 0 }),
      );
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.length).toBeGreaterThanOrEqual(3);
      }
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Built-in manifests — structural validity
// ─────────────────────────────────────────────────────────────────────────────

describe("built-in manifests", () => {
  const builtins = [
    EXPLORE_MANIFEST,
    PLAN_MANIFEST,
    IMPLEMENT_MANIFEST,
    REVIEW_MANIFEST,
    TEST_MANIFEST,
    BUILD_MANIFEST,
    SECURITY_MANIFEST,
    COMPACT_MANIFEST,
  ];

  it("should have 8 built-in manifests", () => {
    expect(builtins).toHaveLength(8);
  });

  it.each(builtins.map((m) => [m.id, m] as [string, AgentManifest]))(
    "built-in manifest '%s' should pass validation",
    (_id, manifest) => {
      const result = validateManifest(manifest);
      expect(result.valid, JSON.stringify(!result.valid && result)).toBe(true);
    },
  );

  it.each(builtins.map((m) => [m.id, m] as [string, AgentManifest]))(
    "built-in manifest '%s' should have non-empty systemPromptTemplate",
    (_id, manifest) => {
      expect(manifest.systemPromptTemplate.trim().length).toBeGreaterThan(0);
    },
  );

  it.each(builtins.map((m) => [m.id, m] as [string, AgentManifest]))(
    "built-in manifest '%s' should have at least one allowed tool",
    (_id, manifest) => {
      expect(manifest.allowedTools.length).toBeGreaterThan(0);
    },
  );

  it("all built-in ids should be unique", () => {
    const ids = builtins.map((m) => m.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  describe("specific manifest properties", () => {
    it("EXPLORE_MANIFEST should be read-only (no write tools)", () => {
      const writeTools = ["file_write", "file_edit", "bash_exec", "mkdir"];
      for (const tool of writeTools) {
        expect(EXPLORE_MANIFEST.allowedTools).not.toContain(tool);
      }
    });

    it("PLAN_MANIFEST should have category 'planning'", () => {
      expect(PLAN_MANIFEST.purpose.category).toBe("planning");
    });

    it("IMPLEMENT_MANIFEST should use worktree isolation", () => {
      expect(IMPLEMENT_MANIFEST.isolationMode).toBe("worktree");
    });

    it("IMPLEMENT_MANIFEST should have a verificationProfile", () => {
      expect(IMPLEMENT_MANIFEST.verificationProfile).toBeDefined();
      expect(IMPLEMENT_MANIFEST.verificationProfile?.typeCheck).toBe(true);
      expect(IMPLEMENT_MANIFEST.verificationProfile?.lint).toBe(true);
    });

    it("COMPACT_MANIFEST should use haiku model (cost-optimized)", () => {
      expect(COMPACT_MANIFEST.modelConfig.preferredModel).toContain("haiku");
    });

    it("COMPACT_MANIFEST should have memoryScope 'none'", () => {
      expect(COMPACT_MANIFEST.memoryScope).toBe("none");
    });

    it("SECURITY_MANIFEST should be read-only (no write tools)", () => {
      const writeTools = ["file_write", "file_edit", "bash_exec", "mkdir"];
      for (const tool of writeTools) {
        expect(SECURITY_MANIFEST.allowedTools).not.toContain(tool);
      }
    });

    it("BUILD_MANIFEST should have customChecks including npm run build", () => {
      expect(BUILD_MANIFEST.verificationProfile?.customChecks).toContain("npm run build");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getBuiltinManifest
// ─────────────────────────────────────────────────────────────────────────────

describe("getBuiltinManifest", () => {
  it("should return the correct manifest for a known id", () => {
    const manifest = getBuiltinManifest("explore");
    expect(manifest).toBe(EXPLORE_MANIFEST);
  });

  it("should return undefined for an unknown id", () => {
    const manifest = getBuiltinManifest("nonexistent-agent-xyz");
    expect(manifest).toBeUndefined();
  });

  it("should return all 8 built-in manifests by id", () => {
    const ids = ["explore", "plan", "implement", "review", "test", "build", "security", "compact"];
    for (const id of ids) {
      const manifest = getBuiltinManifest(id);
      expect(manifest, `manifest '${id}' should exist`).toBeDefined();
      expect(manifest?.id).toBe(id);
    }
  });

  it("should be case-sensitive (uppercase id returns undefined)", () => {
    expect(getBuiltinManifest("Explore")).toBeUndefined();
    expect(getBuiltinManifest("EXPLORE")).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// listBuiltinManifests
// ─────────────────────────────────────────────────────────────────────────────

describe("listBuiltinManifests", () => {
  it("should return all 8 built-in manifests", () => {
    const manifests = listBuiltinManifests();
    expect(manifests).toHaveLength(8);
  });

  it("should include all expected ids", () => {
    const manifests = listBuiltinManifests();
    const ids = manifests.map((m) => m.id);
    expect(ids).toContain("explore");
    expect(ids).toContain("plan");
    expect(ids).toContain("implement");
    expect(ids).toContain("review");
    expect(ids).toContain("test");
    expect(ids).toContain("build");
    expect(ids).toContain("security");
    expect(ids).toContain("compact");
  });

  it("should return the same instances as individual constants", () => {
    const manifests = listBuiltinManifests();
    expect(manifests).toContain(EXPLORE_MANIFEST);
    expect(manifests).toContain(PLAN_MANIFEST);
    expect(manifests).toContain(IMPLEMENT_MANIFEST);
    expect(manifests).toContain(REVIEW_MANIFEST);
    expect(manifests).toContain(TEST_MANIFEST);
    expect(manifests).toContain(BUILD_MANIFEST);
    expect(manifests).toContain(SECURITY_MANIFEST);
    expect(manifests).toContain(COMPACT_MANIFEST);
  });

  it("should return a new array each call (no mutation risk)", () => {
    const first = listBuiltinManifests();
    const second = listBuiltinManifests();
    expect(first).not.toBe(second);
    expect(first).toEqual(second);
  });

  it("all returned manifests should pass validation", () => {
    const manifests = listBuiltinManifests();
    for (const manifest of manifests) {
      const result = validateManifest(manifest);
      expect(result.valid, `manifest '${manifest.id}' should be valid`).toBe(true);
    }
  });
});

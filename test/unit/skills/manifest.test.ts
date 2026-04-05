import { describe, it, expect } from "vitest";
import {
  validateManifest,
  parseManifestFromFrontmatter,
  isManifestCompatible,
  type SkillManifest,
  type CompatibilityContext,
} from "../../../src/skills/manifest.js";

// ---------------------------------------------------------------------------
// validateManifest
// ---------------------------------------------------------------------------

describe("validateManifest", () => {
  it("should validate a minimal manifest (SkillFrontmatter compatible)", () => {
    const result = validateManifest({
      name: "test-skill",
      description: "A test skill",
    });

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.manifest.name).toBe("test-skill");
      expect(result.manifest.description).toBe("A test skill");
      // defaults from SkillFrontmatter
      expect(result.manifest.userInvocable).toBe(true);
      expect(result.manifest.context).toBe("inline");
    }
  });

  it("should validate a full manifest with all extended fields", () => {
    const data = {
      name: "full-skill",
      description: "Full featured skill",
      version: "1.2.0",
      author: "developer",
      tags: ["test", "demo"],
      triggers: [{ pattern: "test.*", description: "matches test" }],
      inputs: {
        filePath: { type: "string", description: "target file", required: true },
        count: { type: "number", default: 10, required: false },
      },
      outputs: {
        result: { type: "object", description: "analysis result" },
      },
      requires: {
        tools: ["file_read", "grep_search"],
        permissions: ["write"],
        minModelTier: "medium",
      },
      trustLevel: "project",
    };

    const result = validateManifest(data);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.manifest.version).toBe("1.2.0");
      expect(result.manifest.author).toBe("developer");
      expect(result.manifest.tags).toEqual(["test", "demo"]);
      expect(result.manifest.triggers).toHaveLength(1);
      expect(result.manifest.inputs?.filePath.type).toBe("string");
      expect(result.manifest.outputs?.result.type).toBe("object");
      expect(result.manifest.requires?.tools).toEqual(["file_read", "grep_search"]);
      expect(result.manifest.trustLevel).toBe("project");
    }
  });

  it("should fail for missing required name field", () => {
    const result = validateManifest({ description: "no name" });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes("name"))).toBe(true);
    }
  });

  it("should fail for missing required description field", () => {
    const result = validateManifest({ name: "no-desc" });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes("description"))).toBe(true);
    }
  });

  it("should fail for invalid input type", () => {
    const result = validateManifest({
      name: "bad-input",
      description: "test",
      inputs: { x: { type: "invalid-type" } },
    });
    expect(result.valid).toBe(false);
  });

  it("should fail for invalid trustLevel", () => {
    const result = validateManifest({
      name: "bad-trust",
      description: "test",
      trustLevel: "super-trusted",
    });
    expect(result.valid).toBe(false);
  });

  it("should fail for empty trigger pattern", () => {
    const result = validateManifest({
      name: "bad-trigger",
      description: "test",
      triggers: [{ pattern: "" }],
    });
    expect(result.valid).toBe(false);
  });

  it("should accept empty object for optional fields", () => {
    const result = validateManifest({
      name: "minimal",
      description: "just required",
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.manifest.version).toBeUndefined();
      expect(result.manifest.tags).toBeUndefined();
      expect(result.manifest.triggers).toBeUndefined();
      expect(result.manifest.inputs).toBeUndefined();
      expect(result.manifest.requires).toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------
// parseManifestFromFrontmatter
// ---------------------------------------------------------------------------

describe("parseManifestFromFrontmatter", () => {
  it("should parse a basic SkillFrontmatter-compatible object", () => {
    const raw: Record<string, unknown> = {
      name: "commit",
      description: "Auto-commit helper",
      context: "fork",
      agent: "plan",
      userInvocable: true,
    };

    const manifest = parseManifestFromFrontmatter(raw);
    expect(manifest.name).toBe("commit");
    expect(manifest.context).toBe("fork");
    expect(manifest.agent).toBe("plan");
    // Extended fields should be undefined
    expect(manifest.version).toBeUndefined();
    expect(manifest.trustLevel).toBeUndefined();
  });

  it("should parse an extended manifest with inputs/outputs", () => {
    const raw: Record<string, unknown> = {
      name: "analyze",
      description: "Code analyzer",
      inputs: {
        target: { type: "string", required: true },
      },
      outputs: {
        report: { type: "object" },
      },
      requires: {
        tools: ["file_read"],
        minModelTier: "high",
      },
    };

    const manifest = parseManifestFromFrontmatter(raw);
    expect(manifest.inputs?.target.type).toBe("string");
    expect(manifest.outputs?.report.type).toBe("object");
    expect(manifest.requires?.minModelTier).toBe("high");
  });

  it("should throw for invalid data", () => {
    expect(() => parseManifestFromFrontmatter({})).toThrow();
  });

  it("should apply defaults from base SkillFrontmatter schema", () => {
    const raw: Record<string, unknown> = {
      name: "test",
      description: "test skill",
    };

    const manifest = parseManifestFromFrontmatter(raw);
    expect(manifest.userInvocable).toBe(true);
    expect(manifest.disableModelInvocation).toBe(false);
    expect(manifest.context).toBe("inline");
    expect(manifest.model).toBeNull();
    expect(manifest.hooks).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// isManifestCompatible
// ---------------------------------------------------------------------------

describe("isManifestCompatible", () => {
  const baseManifest: SkillManifest = {
    name: "test",
    description: "test",
    userInvocable: true,
    disableModelInvocation: false,
    model: null,
    context: "inline",
    hooks: [],
  };

  it("should return true when no requirements are specified", () => {
    const context: CompatibilityContext = {
      availableTools: ["file_read"],
      permissionMode: "default",
    };
    expect(isManifestCompatible(baseManifest, context)).toBe(true);
  });

  it("should return true when all required tools are available", () => {
    const manifest: SkillManifest = {
      ...baseManifest,
      requires: { tools: ["file_read", "grep_search"] },
    };
    const context: CompatibilityContext = {
      availableTools: ["file_read", "grep_search", "bash_exec"],
      permissionMode: "default",
    };
    expect(isManifestCompatible(manifest, context)).toBe(true);
  });

  it("should return false when a required tool is missing", () => {
    const manifest: SkillManifest = {
      ...baseManifest,
      requires: { tools: ["file_read", "missing_tool"] },
    };
    const context: CompatibilityContext = {
      availableTools: ["file_read", "bash_exec"],
      permissionMode: "default",
    };
    expect(isManifestCompatible(manifest, context)).toBe(false);
  });

  it("should return true when required permissions match", () => {
    const manifest: SkillManifest = {
      ...baseManifest,
      requires: { permissions: ["write"] },
    };
    const context: CompatibilityContext = {
      availableTools: [],
      permissionMode: "write-allowed",
    };
    expect(isManifestCompatible(manifest, context)).toBe(true);
  });

  it("should return false when a required permission is not in mode", () => {
    const manifest: SkillManifest = {
      ...baseManifest,
      requires: { permissions: ["admin"] },
    };
    const context: CompatibilityContext = {
      availableTools: [],
      permissionMode: "read-only",
    };
    expect(isManifestCompatible(manifest, context)).toBe(false);
  });

  it("should check both tools and permissions together", () => {
    const manifest: SkillManifest = {
      ...baseManifest,
      requires: {
        tools: ["file_read"],
        permissions: ["write"],
      },
    };

    // tools OK, permissions fail
    expect(
      isManifestCompatible(manifest, {
        availableTools: ["file_read"],
        permissionMode: "read-only",
      }),
    ).toBe(false);

    // tools fail, permissions OK
    expect(
      isManifestCompatible(manifest, {
        availableTools: [],
        permissionMode: "write-mode",
      }),
    ).toBe(false);

    // both OK
    expect(
      isManifestCompatible(manifest, {
        availableTools: ["file_read"],
        permissionMode: "write-mode",
      }),
    ).toBe(true);
  });
});

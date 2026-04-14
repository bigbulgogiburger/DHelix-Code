import { describe, it, expect } from "vitest";
import {
  resolveSkillDependencies,
  CircularDependencyError,
} from "../../../src/skills/dependency-resolver.js";

describe("resolveSkillDependencies", () => {
  it("should return skills in topological order", () => {
    const skills = new Map<string, readonly string[]>([
      ["app", ["db", "auth"]],
      ["auth", ["db"]],
      ["db", []],
    ]);

    const result = resolveSkillDependencies(skills);

    // db must come before auth, auth must come before app
    const dbIdx = result.indexOf("db");
    const authIdx = result.indexOf("auth");
    const appIdx = result.indexOf("app");

    expect(dbIdx).toBeLessThan(authIdx);
    expect(authIdx).toBeLessThan(appIdx);
    expect(result).toHaveLength(3);
  });

  it("should handle skills with no dependencies", () => {
    const skills = new Map<string, readonly string[]>([
      ["alpha", []],
      ["beta", []],
      ["gamma", []],
    ]);

    const result = resolveSkillDependencies(skills);

    expect(result).toHaveLength(3);
    expect([...result].sort()).toEqual(["alpha", "beta", "gamma"]);
  });

  it("should detect circular dependencies", () => {
    const skills = new Map<string, readonly string[]>([
      ["a", ["b"]],
      ["b", ["c"]],
      ["c", ["a"]],
    ]);

    expect(() => resolveSkillDependencies(skills)).toThrow(CircularDependencyError);
    expect(() => resolveSkillDependencies(skills)).toThrow(/Circular dependency detected/);
  });

  it("should handle diamond dependencies (A→B, A→C, B→D, C→D)", () => {
    const skills = new Map<string, readonly string[]>([
      ["A", ["B", "C"]],
      ["B", ["D"]],
      ["C", ["D"]],
      ["D", []],
    ]);

    const result = resolveSkillDependencies(skills);

    const idxD = result.indexOf("D");
    const idxB = result.indexOf("B");
    const idxC = result.indexOf("C");
    const idxA = result.indexOf("A");

    // D must come before B and C; B and C must come before A
    expect(idxD).toBeLessThan(idxB);
    expect(idxD).toBeLessThan(idxC);
    expect(idxB).toBeLessThan(idxA);
    expect(idxC).toBeLessThan(idxA);
    expect(result).toHaveLength(4);
  });

  it("should handle empty input", () => {
    const skills = new Map<string, readonly string[]>();
    const result = resolveSkillDependencies(skills);
    expect(result).toEqual([]);
  });

  it("should ignore dependencies not present in the skills map", () => {
    const skills = new Map<string, readonly string[]>([
      ["app", ["external-lib"]],
      ["lib", []],
    ]);

    // "external-lib" is not in the map, so it should be ignored
    const result = resolveSkillDependencies(skills);

    expect(result).toHaveLength(2);
    expect(result).toContain("app");
    expect(result).toContain("lib");
  });

  it("should include cycle members in the error context", () => {
    const skills = new Map<string, readonly string[]>([
      ["x", ["y"]],
      ["y", ["x"]],
      ["z", []],
    ]);

    try {
      resolveSkillDependencies(skills);
      expect.fail("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(CircularDependencyError);
      const err = error as CircularDependencyError;
      expect(err.code).toBe("CIRCULAR_DEPENDENCY");
      expect(err.context.cycle).toEqual(expect.arrayContaining(["x", "y"]));
      expect(err.context.cycle).not.toContain("z");
    }
  });
});

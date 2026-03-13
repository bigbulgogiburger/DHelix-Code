import { describe, it, expect } from "vitest";
import {
  TONE_PROFILES,
  getToneProfile,
  type ToneProfile,
} from "../../../src/core/tone-profiles.js";

describe("TONE_PROFILES", () => {
  const expectedIds = ["normal", "cute", "senior", "friend", "mentor", "minimal"];

  it("should have all 6 profiles", () => {
    expect(Object.keys(TONE_PROFILES)).toHaveLength(6);
    for (const id of expectedIds) {
      expect(TONE_PROFILES[id]).toBeDefined();
    }
  });

  it("should have required fields on every profile", () => {
    for (const id of expectedIds) {
      const profile = TONE_PROFILES[id] as ToneProfile;
      expect(profile.id).toBe(id);
      expect(profile.name).toBeTypeOf("string");
      expect(profile.name.length).toBeGreaterThan(0);
      expect(profile.nameKo).toBeTypeOf("string");
      expect(profile.nameKo.length).toBeGreaterThan(0);
      expect(profile.description).toBeTypeOf("string");
      expect(profile.description.length).toBeGreaterThan(0);
      expect(profile.systemPromptSection).toBeTypeOf("string");
      expect(profile.systemPromptSection).toContain("Response Style");
    }
  });

  it("should have unique names for each profile", () => {
    const names = Object.values(TONE_PROFILES).map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("getToneProfile", () => {
  it("should return the correct profile for a valid tone", () => {
    const profile = getToneProfile("senior");
    expect(profile.id).toBe("senior");
    expect(profile.name).toBe("Senior Developer");
  });

  it("should return normal profile for unknown tone", () => {
    const profile = getToneProfile("nonexistent");
    expect(profile.id).toBe("normal");
    expect(profile.name).toBe("Professional");
  });

  it("should return normal profile for empty string", () => {
    const profile = getToneProfile("");
    expect(profile.id).toBe("normal");
  });

  it("should return each known profile correctly", () => {
    for (const [id, expected] of Object.entries(TONE_PROFILES)) {
      const profile = getToneProfile(id);
      expect(profile).toBe(expected);
    }
  });
});

import { describe, it, expect } from "vitest";
import { adaptToolSchema, type AdaptedToolInfo } from "../../../src/tools/adaptive-schema.js";

const FULL_DESCRIPTION =
  "Read a file from the local filesystem. Supports reading text files with optional line offset and limit. Returns the file contents as a string.";

const FULL_PARAMETERS: Record<string, unknown> = {
  type: "object",
  properties: {
    file_path: { type: "string", description: "Absolute path to the file" },
    offset: { type: "number", description: "Line offset to start reading from", default: 0 },
    limit: { type: "number", description: "Maximum number of lines to read", default: 2000 },
  },
  required: ["file_path"],
};

describe("adaptToolSchema", () => {
  describe("HIGH tier", () => {
    it("should return full schema unchanged", () => {
      const result = adaptToolSchema("file_read", FULL_DESCRIPTION, FULL_PARAMETERS, "high", "/project");

      expect(result.name).toBe("file_read");
      expect(result.description).toBe(FULL_DESCRIPTION);
      expect(result.parameters).toEqual(FULL_PARAMETERS);
      expect(result.examples).toBeUndefined();
    });

    it("should preserve all properties including optional ones", () => {
      const result = adaptToolSchema("file_read", FULL_DESCRIPTION, FULL_PARAMETERS, "high", "/project");
      const props = result.parameters["properties"] as Record<string, unknown>;

      expect(props).toHaveProperty("file_path");
      expect(props).toHaveProperty("offset");
      expect(props).toHaveProperty("limit");
    });
  });

  describe("MEDIUM tier", () => {
    it("should truncate description to 2 sentences", () => {
      const result = adaptToolSchema("file_read", FULL_DESCRIPTION, FULL_PARAMETERS, "medium", "/project");

      // Should have at most 2 sentences
      const sentenceCount = (result.description.match(/\./g) ?? []).length;
      expect(sentenceCount).toBeLessThanOrEqual(2);
      expect(result.description).toContain("Read a file from the local filesystem.");
    });

    it("should filter out optional params with defaults", () => {
      const result = adaptToolSchema("file_read", FULL_DESCRIPTION, FULL_PARAMETERS, "medium", "/project");
      const props = result.parameters["properties"] as Record<string, unknown>;

      expect(props).toHaveProperty("file_path");
      // offset and limit have defaults, so they should be filtered out
      expect(props).not.toHaveProperty("offset");
      expect(props).not.toHaveProperty("limit");
    });

    it("should not include examples", () => {
      const result = adaptToolSchema("file_read", FULL_DESCRIPTION, FULL_PARAMETERS, "medium", "/project");
      expect(result.examples).toBeUndefined();
    });
  });

  describe("LOW tier", () => {
    it("should truncate description to 1 sentence", () => {
      const result = adaptToolSchema("file_read", FULL_DESCRIPTION, FULL_PARAMETERS, "low", "/project");

      const sentenceCount = (result.description.match(/\./g) ?? []).length;
      expect(sentenceCount).toBeLessThanOrEqual(1);
      expect(result.description).toContain("Read a file from the local filesystem.");
    });

    it("should keep only required parameters", () => {
      const result = adaptToolSchema("file_read", FULL_DESCRIPTION, FULL_PARAMETERS, "low", "/project");
      const props = result.parameters["properties"] as Record<string, unknown>;

      expect(props).toHaveProperty("file_path");
      expect(props).not.toHaveProperty("offset");
      expect(props).not.toHaveProperty("limit");
    });

    it("should include few-shot examples for known tools", () => {
      const result = adaptToolSchema("file_read", FULL_DESCRIPTION, FULL_PARAMETERS, "low", "/project");

      expect(result.examples).toBeDefined();
      expect(result.examples!.length).toBeGreaterThan(0);
      expect(result.examples![0]).toContain("file_read");
    });

    it("should not include examples for unknown tools", () => {
      const result = adaptToolSchema("custom_tool", "A custom tool.", {}, "low", "/project");
      expect(result.examples).toBeUndefined();
    });
  });

  describe("edge cases", () => {
    it("should handle empty description", () => {
      const result = adaptToolSchema("test", "", {}, "medium", "/project");
      expect(result.description).toBe("");
    });

    it("should handle description without periods", () => {
      const result = adaptToolSchema("test", "No period here", {}, "medium", "/project");
      expect(result.description).toBe("No period here");
    });

    it("should handle parameters without properties field", () => {
      const params = { type: "object" };
      const result = adaptToolSchema("test", "A tool.", params, "low", "/project");
      expect(result.parameters).toEqual(params);
    });

    it("should handle parameters without required field", () => {
      const params = {
        type: "object",
        properties: { a: { type: "string" } },
      };
      const result = adaptToolSchema("test", "A tool.", params, "low", "/project");
      expect(result.parameters).toEqual(params);
    });

    it("should preserve required array in filtered output", () => {
      const result = adaptToolSchema("file_read", FULL_DESCRIPTION, FULL_PARAMETERS, "low", "/project");
      expect(result.parameters["required"]).toEqual(["file_path"]);
    });
  });
});

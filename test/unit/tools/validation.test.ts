import { describe, it, expect } from "vitest";
import { z } from "zod";
import { zodSchemaToJsonSchema, parseToolArguments } from "../../../src/tools/validation.js";

describe("zodSchemaToJsonSchema", () => {
  it("should convert Zod schema to JSON Schema", () => {
    const schema = z.object({
      path: z.string(),
      limit: z.number().optional(),
    });

    const jsonSchema = zodSchemaToJsonSchema(schema);
    expect(jsonSchema).toHaveProperty("type", "object");
    expect(jsonSchema).toHaveProperty("properties");
    expect(jsonSchema).not.toHaveProperty("$schema");
  });
});

describe("parseToolArguments", () => {
  const schema = z.object({
    name: z.string(),
    count: z.number().int().min(1),
  });

  it("should parse valid arguments", () => {
    const result = parseToolArguments(schema, { name: "test", count: 5 });
    expect(result).toEqual({ name: "test", count: 5 });
  });

  it("should throw on invalid arguments", () => {
    expect(() => parseToolArguments(schema, { name: "test", count: -1 })).toThrow(
      "Invalid tool arguments",
    );
  });

  it("should throw on missing required fields", () => {
    expect(() => parseToolArguments(schema, { name: "test" })).toThrow("Invalid tool arguments");
  });
});

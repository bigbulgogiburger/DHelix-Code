import { describe, it, expect } from "vitest";
import { buildStructuredOutputConfig } from "../../../src/llm/structured-output.js";

const sampleToolSchema: Record<string, unknown> = {
  type: "object",
  properties: {
    file_path: { type: "string", description: "Path to the file" },
    content: { type: "string", description: "File content" },
  },
  required: ["file_path", "content"],
};

describe("buildStructuredOutputConfig", () => {
  describe("high tier", () => {
    it("should return null for high tier (native function calling)", () => {
      const result = buildStructuredOutputConfig("openai", sampleToolSchema, "high");
      expect(result).toBeNull();
    });

    it("should return null for all providers at high tier", () => {
      expect(buildStructuredOutputConfig("anthropic", sampleToolSchema, "high")).toBeNull();
      expect(buildStructuredOutputConfig("ollama", sampleToolSchema, "high")).toBeNull();
      expect(buildStructuredOutputConfig("unknown", sampleToolSchema, "high")).toBeNull();
    });
  });

  describe("openai provider", () => {
    it("should return json_schema config for medium tier", () => {
      const result = buildStructuredOutputConfig("openai", sampleToolSchema, "medium");
      expect(result).not.toBeNull();
      expect(result!.response_format).toEqual({
        type: "json_schema",
        json_schema: expect.objectContaining({
          name: "tool_call",
          strict: true,
        }),
      });
    });

    it("should return json_object config for low tier", () => {
      const result = buildStructuredOutputConfig("openai", sampleToolSchema, "low");
      expect(result).not.toBeNull();
      expect(result!.response_format).toEqual({ type: "json_object" });
      expect(result!.schema_guidance).toBeDefined();
      expect(typeof result!.schema_guidance).toBe("string");
    });

    it("should be case-insensitive for provider name", () => {
      const result = buildStructuredOutputConfig("OpenAI", sampleToolSchema, "medium");
      expect(result).not.toBeNull();
      expect(result!.response_format).toBeDefined();
    });
  });

  describe("anthropic provider", () => {
    it("should return schema guidance and prefill for medium tier", () => {
      const result = buildStructuredOutputConfig("anthropic", sampleToolSchema, "medium");
      expect(result).not.toBeNull();
      expect(result!.schema_guidance).toBeDefined();
      expect(result!.prefill).toBe('{"tool_name":"');
    });

    it("should return schema guidance for low tier", () => {
      const result = buildStructuredOutputConfig("anthropic", sampleToolSchema, "low");
      expect(result).not.toBeNull();
      expect(typeof result!.schema_guidance).toBe("string");
    });
  });

  describe("ollama/local provider", () => {
    it("should return json format for ollama", () => {
      const result = buildStructuredOutputConfig("ollama", sampleToolSchema, "medium");
      expect(result).not.toBeNull();
      expect(result!.format).toBe("json");
      expect(result!.schema_guidance).toBeDefined();
      expect(result!.template_wrapper).toBeDefined();
    });

    it("should return json format for local provider", () => {
      const result = buildStructuredOutputConfig("local", sampleToolSchema, "low");
      expect(result).not.toBeNull();
      expect(result!.format).toBe("json");
    });
  });

  describe("unknown provider", () => {
    it("should return generic config with schema guidance", () => {
      const result = buildStructuredOutputConfig("some-unknown-provider", sampleToolSchema, "medium");
      expect(result).not.toBeNull();
      expect(result!.schema_guidance).toBeDefined();
      expect(typeof result!.schema_guidance).toBe("string");
    });
  });

  describe("schema guidance content", () => {
    it("should include the tool schema in guidance text", () => {
      const result = buildStructuredOutputConfig("openai", sampleToolSchema, "low");
      expect(result).not.toBeNull();
      const guidance = result!.schema_guidance as string;
      expect(guidance).toContain("file_path");
      expect(guidance).toContain("tool_name");
      expect(guidance).toContain("tool_input");
    });

    it("should include tool_call wrapper schema", () => {
      const result = buildStructuredOutputConfig("openai", sampleToolSchema, "medium");
      expect(result).not.toBeNull();
      const schema = (result!.response_format as Record<string, unknown>);
      const jsonSchema = (schema as Record<string, Record<string, unknown>>).json_schema;
      const inner = jsonSchema.schema as Record<string, unknown>;
      expect(inner.type).toBe("object");
      const props = inner.properties as Record<string, unknown>;
      expect(props.tool_name).toBeDefined();
      expect(props.tool_input).toBeDefined();
    });
  });
});

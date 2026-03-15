import type { CapabilityTier } from "./model-capabilities.js";

/**
 * Configuration returned by buildStructuredOutputConfig for providers
 * that need explicit structured output guidance.
 */
export interface StructuredOutputConfig {
  readonly [key: string]: unknown;
}

/**
 * For LOW/MEDIUM tier models, build provider-specific structured output config.
 * HIGH tier uses native function calling (returns null).
 *
 * For models that don't support native function calling well (LOW/MEDIUM tier),
 * this wraps the tool schema into a provider-appropriate format so that
 * the LLM produces valid JSON matching the expected schema.
 */
export function buildStructuredOutputConfig(
  provider: string,
  toolSchema: Record<string, unknown>,
  tier: CapabilityTier,
): Record<string, unknown> | null {
  // HIGH tier models support native function calling — no wrapper needed
  if (tier === "high") {
    return null;
  }

  const normalizedProvider = provider.toLowerCase();

  if (normalizedProvider === "openai" || normalizedProvider === "openai-compatible") {
    return buildOpenAIStructuredOutput(toolSchema, tier);
  }

  if (normalizedProvider === "anthropic") {
    return buildAnthropicStructuredOutput(toolSchema, tier);
  }

  if (normalizedProvider === "ollama" || normalizedProvider === "local") {
    return buildOllamaStructuredOutput(toolSchema, tier);
  }

  // Unknown provider — use generic JSON schema guidance
  return buildGenericStructuredOutput(toolSchema, tier);
}

/**
 * Build OpenAI-specific structured output config.
 * Uses response_format with json_schema for MEDIUM tier,
 * and a simpler JSON mode for LOW tier.
 */
function buildOpenAIStructuredOutput(
  toolSchema: Record<string, unknown>,
  tier: CapabilityTier,
): Record<string, unknown> {
  if (tier === "medium") {
    return {
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "tool_call",
          strict: true,
          schema: buildToolCallWrapper(toolSchema),
        },
      },
    };
  }

  // LOW tier — simple JSON mode with schema in system prompt
  return {
    response_format: { type: "json_object" },
    schema_guidance: buildSchemaGuidanceText(toolSchema),
  };
}

/**
 * Build Anthropic-specific structured output config.
 * Anthropic doesn't have a JSON mode, so we inject schema guidance as
 * a prefilled assistant turn hint.
 */
function buildAnthropicStructuredOutput(
  toolSchema: Record<string, unknown>,
  _tier: CapabilityTier,
): Record<string, unknown> {
  return {
    schema_guidance: buildSchemaGuidanceText(toolSchema),
    prefill: '{"tool_name":"',
  };
}

/**
 * Build Ollama/local model structured output config.
 * Uses the format field which Ollama supports for JSON output.
 */
function buildOllamaStructuredOutput(
  toolSchema: Record<string, unknown>,
  _tier: CapabilityTier,
): Record<string, unknown> {
  return {
    format: "json",
    schema_guidance: buildSchemaGuidanceText(toolSchema),
    template_wrapper: buildToolCallWrapper(toolSchema),
  };
}

/**
 * Build generic structured output config for unknown providers.
 * Provides schema guidance text that can be injected into the system prompt.
 */
function buildGenericStructuredOutput(
  toolSchema: Record<string, unknown>,
  _tier: CapabilityTier,
): Record<string, unknown> {
  return {
    schema_guidance: buildSchemaGuidanceText(toolSchema),
  };
}

/**
 * Build a wrapper JSON schema for tool calls.
 * This wraps the tool's parameter schema into a standard tool-call envelope.
 */
function buildToolCallWrapper(toolSchema: Record<string, unknown>): Record<string, unknown> {
  return {
    type: "object",
    properties: {
      tool_name: {
        type: "string",
        description: "The name of the tool to call",
      },
      tool_input: toolSchema,
    },
    required: ["tool_name", "tool_input"],
    additionalProperties: false,
  };
}

/**
 * Build human-readable schema guidance text for injection into system prompts.
 * This helps LOW/MEDIUM tier models produce correctly structured JSON output.
 */
function buildSchemaGuidanceText(toolSchema: Record<string, unknown>): string {
  const schemaStr = JSON.stringify(toolSchema, null, 2);
  return [
    "You must respond with a valid JSON object matching this schema:",
    "```json",
    JSON.stringify(buildToolCallWrapper(toolSchema), null, 2),
    "```",
    "",
    "The tool_input must conform to:",
    "```json",
    schemaStr,
    "```",
    "",
    "Do not include any text outside the JSON object.",
  ].join("\n");
}

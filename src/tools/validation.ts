import { type z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

/**
 * Convert a Zod schema to JSON Schema for LLM function calling.
 * Strips the $schema and top-level metadata fields.
 */
export function zodSchemaToJsonSchema(schema: z.ZodSchema): Record<string, unknown> {
  const jsonSchema = zodToJsonSchema(schema, { target: "openApi3" });
  const { $schema: _schema, ...rest } = jsonSchema as Record<string, unknown>;
  return rest;
}

/**
 * Parse and validate tool arguments using a Zod schema.
 * Returns the validated params or throws with descriptive error.
 */
export function parseToolArguments<T>(schema: z.ZodSchema<T>, rawArgs: Record<string, unknown>): T {
  const result = schema.safeParse(rawArgs);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid tool arguments: ${issues}`);
  }
  return result.data;
}

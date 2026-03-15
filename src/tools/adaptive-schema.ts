import type { CapabilityTier } from "../llm/model-capabilities.js";

/** Tool schema adapted for a specific model capability tier */
export interface AdaptedToolInfo {
  readonly name: string;
  readonly description: string;
  readonly parameters: Record<string, unknown>;
  readonly examples?: readonly string[];
}

/**
 * Extract the first N sentences from a description string.
 * Returns the original string if fewer than N sentence boundaries are found.
 */
function truncateToSentences(text: string, maxSentences: number): string {
  let count = 0;
  let lastEnd = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "." && (i + 1 >= text.length || text[i + 1] === " " || text[i + 1] === "\n")) {
      count++;
      lastEnd = i + 1;
      if (count >= maxSentences) {
        return text.slice(0, lastEnd).trim();
      }
    }
  }
  return text;
}

/**
 * Filter JSON Schema properties to keep only required fields.
 * Returns a new schema object with only required properties preserved.
 */
function filterToRequiredOnly(params: Record<string, unknown>): Record<string, unknown> {
  const required = params["required"] as readonly string[] | undefined;
  if (!required || !Array.isArray(required) || required.length === 0) {
    return params;
  }

  const properties = params["properties"] as Record<string, unknown> | undefined;
  if (!properties) {
    return params;
  }

  const filtered: Record<string, unknown> = {};
  for (const key of required) {
    if (key in properties) {
      filtered[key] = properties[key];
    }
  }

  return {
    ...params,
    properties: filtered,
  };
}

/**
 * Filter JSON Schema properties to remove explicitly optional fields.
 * Keeps required fields and fields without explicit optionality markers.
 */
function filterToCoreParams(params: Record<string, unknown>): Record<string, unknown> {
  const required = params["required"] as readonly string[] | undefined;
  const properties = params["properties"] as Record<string, unknown> | undefined;
  if (!properties) {
    return params;
  }

  const requiredSet = new Set(required ?? []);
  const filtered: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(properties)) {
    // Keep required params always; for non-required, keep if they don't have a default
    if (requiredSet.has(key)) {
      filtered[key] = value;
    } else if (value && typeof value === "object" && !("default" in value)) {
      filtered[key] = value;
    }
  }

  return {
    ...params,
    properties: filtered,
  };
}

/** Few-shot examples for common tools (used in LOW tier) */
const TOOL_EXAMPLES: Readonly<Record<string, readonly string[]>> = {
  file_read: [
    'file_read({"file_path": "/absolute/path/to/file.ts"})',
    'file_read({"file_path": "/project/src/index.ts", "offset": 10, "limit": 50})',
  ],
  file_write: [
    'file_write({"file_path": "/absolute/path/to/file.ts", "content": "const x = 1;"})',
  ],
  file_edit: [
    'file_edit({"file_path": "/absolute/path/to/file.ts", "old_string": "const x = 1;", "new_string": "const x = 2;"})',
  ],
  bash_exec: [
    'bash_exec({"command": "npm test"})',
    'bash_exec({"command": "ls -la /project/src"})',
  ],
  grep_search: [
    'grep_search({"pattern": "function\\\\s+\\\\w+", "path": "/project/src"})',
  ],
  glob_search: [
    'glob_search({"pattern": "**/*.ts", "path": "/project/src"})',
  ],
};

/**
 * Adapt tool schema based on model capability tier.
 *
 * - HIGH: full schema with all optional params, complete description
 * - MEDIUM: core params only (no defaulted optional fields), description truncated to 2 sentences
 * - LOW: required params only + few-shot examples, description truncated to 1 sentence
 *
 * @param name - Tool name
 * @param description - Full tool description
 * @param parameters - Full JSON Schema parameters object
 * @param tier - Model capability tier
 * @param _workingDirectory - Working directory (reserved for future path-relative examples)
 * @returns Adapted tool info for the given tier
 */
export function adaptToolSchema(
  name: string,
  description: string,
  parameters: Record<string, unknown>,
  tier: CapabilityTier,
  _workingDirectory: string,
): AdaptedToolInfo {
  switch (tier) {
    case "high":
      return {
        name,
        description,
        parameters,
      };

    case "medium":
      return {
        name,
        description: truncateToSentences(description, 2),
        parameters: filterToCoreParams(parameters),
      };

    case "low": {
      const examples = TOOL_EXAMPLES[name];
      return {
        name,
        description: truncateToSentences(description, 1),
        parameters: filterToRequiredOnly(parameters),
        ...(examples ? { examples } : {}),
      };
    }
  }
}

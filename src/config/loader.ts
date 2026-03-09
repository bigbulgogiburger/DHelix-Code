import { readFile } from "node:fs/promises";
import { configSchema } from "./schema.js";
import { DEFAULT_CONFIG } from "./defaults.js";
import { type AppConfig, type ConfigSource, type ResolvedConfig } from "./types.js";
import { joinPath, resolvePath } from "../utils/path.js";
import { CONFIG_DIR } from "../constants.js";
import { ConfigError } from "../utils/error.js";

/**
 * Load a JSON config file, returning undefined if not found.
 */
async function loadJsonFile(filePath: string): Promise<Record<string, unknown> | undefined> {
  try {
    const content = await readFile(filePath, "utf-8");
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

/**
 * Extract config-relevant environment variables.
 * DBCODE_BASE_URL, DBCODE_API_KEY, DBCODE_MODEL, etc.
 */
function loadEnvConfig(): Partial<AppConfig> {
  const env: Partial<AppConfig> = {};
  const llm: Record<string, unknown> = {};

  // Base URL: DBCODE_BASE_URL > OPENAI_BASE_URL > default
  if (process.env.DBCODE_BASE_URL) {
    llm.baseUrl = process.env.DBCODE_BASE_URL;
  } else if (process.env.OPENAI_BASE_URL) {
    llm.baseUrl = process.env.OPENAI_BASE_URL;
  }

  // API Key: DBCODE_API_KEY > OPENAI_API_KEY
  if (process.env.DBCODE_API_KEY) {
    llm.apiKey = process.env.DBCODE_API_KEY;
  } else if (process.env.OPENAI_API_KEY) {
    llm.apiKey = process.env.OPENAI_API_KEY;
    // Auto-set OpenAI base URL only if no base URL is configured at all
    if (!process.env.DBCODE_BASE_URL && !process.env.OPENAI_BASE_URL) {
      llm.baseUrl = "https://api.openai.com/v1";
    }
  }

  // Model: DBCODE_MODEL > OPENAI_MODEL > default
  if (process.env.DBCODE_MODEL) {
    llm.model = process.env.DBCODE_MODEL;
  } else if (process.env.OPENAI_MODEL) {
    llm.model = process.env.OPENAI_MODEL;
  }

  if (Object.keys(llm).length > 0) {
    env.llm = { ...DEFAULT_CONFIG.llm, ...llm };
  }

  if (process.env.DBCODE_VERBOSE === "true") {
    env.verbose = true;
  }

  return env;
}

/**
 * Load configuration with 5-level hierarchy:
 * defaults < user config < project config < environment vars < CLI flags
 */
export async function loadConfig(
  cliOverrides: Partial<AppConfig> = {},
  projectDir?: string,
): Promise<ResolvedConfig> {
  const sources = new Map<string, ConfigSource>();

  // Level 1: Defaults
  let merged: Record<string, unknown> = { ...DEFAULT_CONFIG };
  sources.set("*", "defaults");

  // Level 2: User config (~/.dbcode/config.json)
  const userConfigPath = joinPath(CONFIG_DIR, "config.json");
  const userConfig = await loadJsonFile(userConfigPath);
  if (userConfig) {
    merged = deepMerge(merged, userConfig);
    for (const key of Object.keys(userConfig)) {
      sources.set(key, "user");
    }
  }

  // Level 3: Project config (.dbcode/config.json)
  if (projectDir) {
    const projectConfigPath = joinPath(resolvePath(projectDir), ".dbcode", "config.json");
    const projectConfig = await loadJsonFile(projectConfigPath);
    if (projectConfig) {
      merged = deepMerge(merged, projectConfig);
      for (const key of Object.keys(projectConfig)) {
        sources.set(key, "project");
      }
    }
  }

  // Level 4: Environment variables
  const envConfig = loadEnvConfig();
  if (Object.keys(envConfig).length > 0) {
    merged = deepMerge(merged, envConfig as Record<string, unknown>);
    for (const key of Object.keys(envConfig)) {
      sources.set(key, "environment");
    }
  }

  // Level 5: CLI flags (highest priority)
  if (Object.keys(cliOverrides).length > 0) {
    merged = deepMerge(merged, cliOverrides as Record<string, unknown>);
    for (const key of Object.keys(cliOverrides)) {
      sources.set(key, "cli-flags");
    }
  }

  // Validate with Zod
  const result = configSchema.safeParse(merged);
  if (!result.success) {
    throw new ConfigError("Invalid configuration", {
      errors: result.error.flatten().fieldErrors,
    });
  }

  return {
    config: result.data,
    sources,
  };
}

/**
 * Deep merge two objects. Source values override target values.
 */
function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...target };

  for (const key of Object.keys(source)) {
    const sourceVal = source[key];
    const targetVal = target[key];

    if (
      sourceVal !== null &&
      typeof sourceVal === "object" &&
      !Array.isArray(sourceVal) &&
      targetVal !== null &&
      typeof targetVal === "object" &&
      !Array.isArray(targetVal)
    ) {
      result[key] = deepMerge(
        targetVal as Record<string, unknown>,
        sourceVal as Record<string, unknown>,
      );
    } else {
      result[key] = sourceVal;
    }
  }

  return result;
}

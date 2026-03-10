import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { BaseError } from "../utils/error.js";
import { type HookConfig, type HookEvent, HOOK_EVENTS } from "./types.js";

/** Hook configuration loading error */
export class HookLoadError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "HOOK_LOAD_ERROR", context);
  }
}

/** Zod schema for hook handler validation */
const hookHandlerSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("command"),
    command: z.string().min(1),
    timeoutMs: z.number().positive().optional(),
    blocking: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("http"),
    url: z.string().url(),
    headers: z.record(z.string()).optional(),
    timeoutMs: z.number().positive().optional(),
    blocking: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("prompt"),
    prompt: z.string().min(1),
    promptMessage: z.string().min(1),
    timeout: z.number().positive().optional(),
    model: z.string().optional(),
    timeoutMs: z.number().positive().optional(),
    blocking: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("agent"),
    prompt: z.string().min(1),
    validator: z.string().min(1),
    description: z.string().min(1),
    allowedTools: z.array(z.string()).optional(),
    model: z.string().optional(),
    timeoutMs: z.number().positive().optional(),
    blocking: z.boolean().optional(),
  }),
]);

/** Zod schema for a hook rule */
const hookRuleSchema = z.object({
  matcher: z.string().optional(),
  hooks: z.array(hookHandlerSchema).min(1),
});

/** Zod schema for the hooks section of settings */
const hookConfigSchema = z.record(z.string(), z.array(hookRuleSchema));

/**
 * Validate that all keys in a raw hook config are valid HookEvent names.
 */
function validateEventNames(raw: Record<string, unknown>): void {
  const validEvents = new Set<string>(HOOK_EVENTS);
  for (const key of Object.keys(raw)) {
    if (!validEvents.has(key)) {
      throw new HookLoadError(`Unknown hook event: "${key}"`, {
        validEvents: [...validEvents],
      });
    }
  }
}

/**
 * Parse and validate a raw hooks configuration object.
 * Returns a validated HookConfig.
 */
export function parseHookConfig(raw: unknown): HookConfig {
  if (raw === null || raw === undefined) return {};
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new HookLoadError("Hook config must be an object");
  }

  validateEventNames(raw as Record<string, unknown>);
  const parsed = hookConfigSchema.parse(raw);

  // Cast validated keys back to HookEvent type
  const config: Partial<Record<HookEvent, (typeof parsed)[string]>> = {};
  for (const [key, rules] of Object.entries(parsed)) {
    config[key as HookEvent] = rules;
  }
  return config;
}

/**
 * Load hook configuration from a .dbcode/settings.json file.
 * Reads the "hooks" key from the settings file.
 * Returns an empty config if the file doesn't exist or has no hooks.
 */
export async function loadHookConfig(settingsDir: string): Promise<HookConfig> {
  const settingsPath = join(settingsDir, "settings.json");

  try {
    const content = await readFile(settingsPath, "utf-8");
    const settings = JSON.parse(content) as Record<string, unknown>;
    return parseHookConfig(settings.hooks);
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return {};
    }

    if (error instanceof HookLoadError) throw error;

    throw new HookLoadError("Failed to load hook configuration", {
      path: settingsPath,
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}

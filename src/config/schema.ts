import { z } from "zod";

/** LLM provider configuration */
export const llmConfigSchema = z.object({
  baseUrl: z.string().url().default("https://api.openai.com/v1"),
  apiKey: z.string().optional(),
  model: z.string().default("gpt-5-mini"),
  temperature: z.number().min(0).max(2).default(0.0),
  maxTokens: z.number().positive().default(32768),
  contextWindow: z.number().positive().default(1_000_000),
  timeout: z.number().positive().default(60_000),
});

/** Permission mode configuration */
export const permissionModeSchema = z.enum([
  "default",
  "acceptEdits",
  "plan",
  "dontAsk",
  "bypassPermissions",
]);

/** Security / guardrails configuration */
export const securityConfigSchema = z.object({
  mode: z.enum(["local", "external", "hybrid"]).default("local"),
  secretScanning: z.boolean().default(true),
  inputFiltering: z.boolean().default(true),
  outputFiltering: z.boolean().default(true),
  auditLogging: z.boolean().default(false),
  rateLimit: z
    .object({
      requestsPerMinute: z.number().positive().default(60),
      tokensPerDay: z.number().positive().default(1_000_000),
    })
    .default({}),
});

/** UI configuration */
export const uiConfigSchema = z.object({
  theme: z.enum(["auto", "dark", "light"]).default("auto"),
  markdown: z.boolean().default(true),
  syntaxHighlighting: z.boolean().default(true),
  spinner: z.boolean().default(true),
  statusBar: z.boolean().default(true),
});

/** Persistent permission rules configuration */
export const permissionsConfigSchema = z
  .object({
    allow: z.array(z.string()).default([]),
    deny: z.array(z.string()).default([]),
  })
  .default({ allow: [], deny: [] });

/** Full application configuration schema */
export const configSchema = z.object({
  llm: llmConfigSchema.default({}),
  permissionMode: permissionModeSchema.default("default"),
  permissions: permissionsConfigSchema,
  security: securityConfigSchema.default({}),
  ui: uiConfigSchema.default({}),
  workingDirectory: z.string().optional(),
  verbose: z.boolean().default(false),
  /** Glob patterns to exclude specific rule files from loading */
  dbcodeMdExcludes: z.array(z.string()).default([]),
});

import { type AppConfig } from "./types.js";

/** Default configuration values */
export const DEFAULT_CONFIG: AppConfig = {
  llm: {
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-5.1-codex-mini",
    temperature: 0.0,
    maxTokens: 32768,
    contextWindow: 1_000_000,
    timeout: 60_000,
  },
  permissionMode: "default",
  permissions: {
    allow: [],
    deny: [],
  },
  security: {
    mode: "local",
    secretScanning: true,
    inputFiltering: true,
    outputFiltering: true,
    auditLogging: false,
    rateLimit: {
      requestsPerMinute: 60,
      tokensPerDay: 1_000_000,
    },
  },
  ui: {
    theme: "auto",
    markdown: true,
    syntaxHighlighting: true,
    spinner: true,
    statusBar: true,
  },
  verbose: false,
  dbcodeMdExcludes: [],
  locale: "ko",
  tone: "normal" as const,
  voice: {
    enabled: false,
    provider: "openai" as const,
    language: "ko",
    model: "whisper-1",
  },
  deferredTools: true,
  dualModel: {
    enabled: false,
    architectModel: "claude-opus-4-6",
    editorModel: "gpt-4o-mini",
    routingStrategy: "auto" as const,
  },
};

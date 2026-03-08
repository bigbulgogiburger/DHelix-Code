import { type AppConfig } from "./types.js";

/** Default configuration values */
export const DEFAULT_CONFIG: AppConfig = {
  llm: {
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4.1-mini",
    temperature: 0.0,
    maxTokens: 32768,
    contextWindow: 1_000_000,
    timeout: 60_000,
  },
  permissionMode: "default",
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
};

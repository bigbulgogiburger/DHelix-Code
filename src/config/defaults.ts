import { type AppConfig } from "./types.js";

/** Default configuration values */
export const DEFAULT_CONFIG: AppConfig = {
  llm: {
    baseUrl: "http://localhost:11434/v1",
    model: "llama3.1",
    temperature: 0.0,
    maxTokens: 4096,
    contextWindow: 128_000,
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
};

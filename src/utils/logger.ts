import pino from "pino";
import { LOG_FILE } from "../constants.js";

/** Application logger using pino */
export function createLogger(options?: { level?: string; file?: string }): pino.Logger {
  const level = options?.level ?? (process.env.DBCODE_LOG_LEVEL || "info");
  const file = options?.file ?? LOG_FILE;

  return pino({
    level,
    redact: {
      paths: [
        "apiKey",
        "*.apiKey",
        "headers.authorization",
        "*.headers.authorization",
        "*.token",
        "*.secret",
        "*.password",
        "token",
        "secret",
        "password",
        "authorization",
        "*.authorization",
        "*.api_key",
        "api_key",
        "*.accessToken",
        "accessToken",
      ],
      censor: "[REDACTED]",
    },
    transport: {
      target: "pino/file",
      options: { destination: file, mkdir: true },
    },
    formatters: {
      level(label) {
        return { level: label };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}

/** Default application logger instance */
let defaultLogger: pino.Logger | undefined;

/** Get or create the default logger */
export function getLogger(): pino.Logger {
  if (!defaultLogger) {
    defaultLogger = createLogger();
  }
  return defaultLogger;
}

/** Set a custom logger as the default (useful for testing) */
export function setLogger(logger: pino.Logger): void {
  defaultLogger = logger;
}

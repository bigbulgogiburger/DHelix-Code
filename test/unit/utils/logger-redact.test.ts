import { describe, it, expect, afterEach } from "vitest";
import { createLogger } from "../../../src/utils/logger.js";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("logger redaction", () => {
  let tempDir: string;

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("should create a logger with redact configuration", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "logger-redact-test-"));
    const logFile = join(tempDir, "test.log");

    const logger = createLogger({ level: "info", file: logFile });
    expect(logger).toBeDefined();

    // Log an object with sensitive fields
    logger.info({ apiKey: "sk-secret-key-12345" }, "test with apiKey");
    logger.info(
      { headers: { authorization: "Bearer my-token-123" } },
      "test with auth header",
    );
    logger.info({ token: "some-token-value" }, "test with token");
    logger.info({ secret: "my-secret-value" }, "test with secret");
    logger.info({ password: "hunter2" }, "test with password");

    // Flush the logger
    logger.flush();

    // Give pino transport time to write
    await new Promise((resolve) => setTimeout(resolve, 500));

    const content = await readFile(logFile, "utf-8");

    // Verify sensitive values are redacted
    expect(content).not.toContain("sk-secret-key-12345");
    expect(content).not.toContain("my-token-123");
    expect(content).not.toContain("some-token-value");
    expect(content).not.toContain("my-secret-value");
    expect(content).not.toContain("hunter2");

    // Verify [REDACTED] appears
    expect(content).toContain("[REDACTED]");
  });

  it("should not redact non-sensitive fields", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "logger-redact-test-"));
    const logFile = join(tempDir, "test2.log");

    const logger = createLogger({ level: "info", file: logFile });

    logger.info({ username: "john", action: "login" }, "user login");
    logger.flush();

    await new Promise((resolve) => setTimeout(resolve, 500));

    const content = await readFile(logFile, "utf-8");
    expect(content).toContain("john");
    expect(content).toContain("login");
  });
});

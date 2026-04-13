/**
 * ToolError Type Hierarchy 테스트
 *
 * classifyError 함수의 각 에러 패턴 매핑과
 * ToolExecutionError 클래스, RETRY_STRATEGY_MATRIX의 정합성을 검증합니다.
 */
import { describe, it, expect } from "vitest";
import {
  classifyError,
  ToolExecutionError,
  RETRY_STRATEGY_MATRIX,
  type ToolErrorKind,
} from "../../../src/tools/errors.js";

describe("ToolExecutionError", () => {
  it("should set all readonly properties correctly", () => {
    const original = new Error("original");
    const err = new ToolExecutionError(
      "not_found",
      "file_read",
      "File not found",
      original,
      true,
      true,
    );

    expect(err.kind).toBe("not_found");
    expect(err.toolName).toBe("file_read");
    expect(err.message).toBe("File not found");
    expect(err.originalError).toBe(original);
    expect(err.retryable).toBe(true);
    expect(err.correctable).toBe(true);
    expect(err.name).toBe("ToolExecutionError");
  });

  it("should default retryable and correctable to false", () => {
    const err = new ToolExecutionError("internal", "bash_exec", "Unknown error");

    expect(err.retryable).toBe(false);
    expect(err.correctable).toBe(false);
    expect(err.originalError).toBeUndefined();
  });

  it("should be an instance of Error", () => {
    const err = new ToolExecutionError("internal", "bash_exec", "test");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ToolExecutionError);
  });
});

describe("RETRY_STRATEGY_MATRIX", () => {
  it("should have entries for all ToolErrorKind values", () => {
    const allKinds: ToolErrorKind[] = [
      "validation",
      "permission_denied",
      "not_found",
      "timeout",
      "transient",
      "tool_not_found",
      "aborted",
      "internal",
      "rate_limited",
      "output_too_large",
    ];

    for (const kind of allKinds) {
      expect(RETRY_STRATEGY_MATRIX[kind]).toBeDefined();
      expect(typeof RETRY_STRATEGY_MATRIX[kind].retryable).toBe("boolean");
      expect(typeof RETRY_STRATEGY_MATRIX[kind].correctable).toBe("boolean");
      expect(typeof RETRY_STRATEGY_MATRIX[kind].maxAttempts).toBe("number");
      expect(typeof RETRY_STRATEGY_MATRIX[kind].baseDelayMs).toBe("number");
    }
  });

  it("should mark transient as retryable with exponential backoff", () => {
    const strategy = RETRY_STRATEGY_MATRIX.transient;
    expect(strategy.retryable).toBe(true);
    expect(strategy.correctable).toBe(false);
    expect(strategy.maxAttempts).toBe(3);
    expect(strategy.backoff).toBe("exponential");
  });

  it("should mark not_found as correctable", () => {
    const strategy = RETRY_STRATEGY_MATRIX.not_found;
    expect(strategy.retryable).toBe(true);
    expect(strategy.correctable).toBe(true);
    expect(strategy.maxAttempts).toBe(1);
    expect(strategy.backoff).toBe("immediate");
  });

  it("should mark permission_denied as non-retryable", () => {
    const strategy = RETRY_STRATEGY_MATRIX.permission_denied;
    expect(strategy.retryable).toBe(false);
    expect(strategy.correctable).toBe(false);
    expect(strategy.maxAttempts).toBe(0);
  });

  it("should mark aborted as non-retryable", () => {
    const strategy = RETRY_STRATEGY_MATRIX.aborted;
    expect(strategy.retryable).toBe(false);
    expect(strategy.correctable).toBe(false);
    expect(strategy.maxAttempts).toBe(0);
  });
});

describe("classifyError", () => {
  describe("AbortError classification", () => {
    it("should classify AbortError by name", () => {
      const err = new Error("The operation was aborted");
      err.name = "AbortError";
      const classified = classifyError(err, "file_read");

      expect(classified.kind).toBe("aborted");
      expect(classified.retryable).toBe(false);
      expect(classified.correctable).toBe(false);
      expect(classified.toolName).toBe("file_read");
    });

    it("should classify AbortError by code ABORT_ERR", () => {
      const err = new Error("aborted") as Error & { code: string };
      err.code = "ABORT_ERR";
      const classified = classifyError(err, "web_fetch");

      expect(classified.kind).toBe("aborted");
    });
  });

  describe("Permission denied classification", () => {
    it("should classify EACCES errors", () => {
      const err = new Error("EACCES: permission denied, open '/etc/shadow'") as Error & {
        code: string;
      };
      err.code = "EACCES";
      const classified = classifyError(err, "file_write");

      expect(classified.kind).toBe("permission_denied");
      expect(classified.retryable).toBe(false);
      expect(classified.correctable).toBe(false);
    });

    it("should classify permission denied in message", () => {
      const classified = classifyError(new Error("Permission denied for /root"), "file_read");
      expect(classified.kind).toBe("permission_denied");
    });
  });

  describe("Not found classification", () => {
    it("should classify ENOENT errors", () => {
      const err = new Error("ENOENT: no such file or directory, open 'index.ts'") as Error & {
        code: string;
      };
      err.code = "ENOENT";
      const classified = classifyError(err, "file_read");

      expect(classified.kind).toBe("not_found");
      expect(classified.retryable).toBe(true);
      expect(classified.correctable).toBe(true);
    });

    it("should classify 'not found' in message", () => {
      const classified = classifyError(new Error("Resource not found"), "web_fetch");
      expect(classified.kind).toBe("not_found");
    });
  });

  describe("Transient error classification", () => {
    const transientCodes = ["ETIMEDOUT", "ECONNRESET", "EPIPE", "EAI_AGAIN", "ENOTFOUND"];

    for (const code of transientCodes) {
      it(`should classify ${code} as transient`, () => {
        const err = new Error(`connect ${code}`) as Error & { code: string };
        err.code = code;
        const classified = classifyError(err, "web_search");

        expect(classified.kind).toBe("transient");
        expect(classified.retryable).toBe(true);
        expect(classified.correctable).toBe(false);
      });
    }

    it("should classify ECONNRESET in message as transient", () => {
      const classified = classifyError(new Error("socket hang up ECONNRESET"), "web_fetch");
      expect(classified.kind).toBe("transient");
    });
  });

  describe("Rate limited classification", () => {
    it("should classify rate limit errors", () => {
      const classified = classifyError(new Error("Rate limit exceeded"), "web_search");
      expect(classified.kind).toBe("rate_limited");
      expect(classified.retryable).toBe(true);
    });

    it("should classify 429 status", () => {
      const classified = classifyError(new Error("HTTP 429 Too Many Requests"), "web_fetch");
      expect(classified.kind).toBe("rate_limited");
    });
  });

  describe("Validation error classification", () => {
    it("should classify parse errors", () => {
      const classified = classifyError(new Error("Parse error: unexpected token"), "bash_exec");
      expect(classified.kind).toBe("validation");
      expect(classified.correctable).toBe(true);
    });

    it("should classify invalid JSON", () => {
      const classified = classifyError(new Error("Invalid JSON in argument"), "file_edit");
      expect(classified.kind).toBe("validation");
    });

    it("should classify Zod validation errors", () => {
      const classified = classifyError(
        new Error("Zod validation failed: expected string"),
        "file_read",
      );
      expect(classified.kind).toBe("validation");
    });
  });

  describe("Timeout classification", () => {
    it("should classify timeout errors", () => {
      const classified = classifyError(new Error("Operation timed out"), "bash_exec");
      expect(classified.kind).toBe("timeout");
      expect(classified.retryable).toBe(true);
    });

    it("should classify 'timeout' keyword", () => {
      const classified = classifyError(new Error("Request timeout after 30000ms"), "web_fetch");
      expect(classified.kind).toBe("timeout");
    });
  });

  describe("Internal error classification", () => {
    it("should classify unknown errors as internal", () => {
      const classified = classifyError(new Error("Something unexpected happened"), "file_read");
      expect(classified.kind).toBe("internal");
      expect(classified.retryable).toBe(false);
      expect(classified.correctable).toBe(false);
    });

    it("should handle non-Error objects", () => {
      const classified = classifyError("string error", "bash_exec");
      expect(classified.kind).toBe("internal");
      expect(classified.originalError).toBe("string error");
    });

    it("should handle null/undefined", () => {
      const classified = classifyError(null, "file_read");
      expect(classified.kind).toBe("internal");
    });
  });

  describe("Already classified errors", () => {
    it("should return ToolExecutionError as-is", () => {
      const existing = new ToolExecutionError(
        "rate_limited",
        "web_search",
        "Rate limited",
        undefined,
        true,
        false,
      );
      const result = classifyError(existing, "web_search");
      expect(result).toBe(existing);
    });
  });

  describe("Classification priority", () => {
    it("should prioritize AbortError over timeout message", () => {
      const err = new Error("The operation timed out");
      err.name = "AbortError";
      const classified = classifyError(err, "bash_exec");
      expect(classified.kind).toBe("aborted");
    });

    it("should prioritize EACCES code over not found message", () => {
      const err = new Error("not found") as Error & { code: string };
      err.code = "EACCES";
      const classified = classifyError(err, "file_read");
      expect(classified.kind).toBe("permission_denied");
    });
  });
});

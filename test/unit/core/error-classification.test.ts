import { describe, it, expect } from "vitest";
import { classifyLLMError, waitWithAbort } from "../../../src/core/error-classification.js";

describe("classifyLLMError", () => {
  it("should classify non-Error as permanent", () => {
    expect(classifyLLMError("string error")).toBe("permanent");
    expect(classifyLLMError(42)).toBe("permanent");
    expect(classifyLLMError(null)).toBe("permanent");
  });

  it("should classify request too large as permanent", () => {
    expect(classifyLLMError(new Error("request too large"))).toBe("permanent");
    expect(classifyLLMError(new Error("too many tokens"))).toBe("permanent");
  });

  it("should classify auth errors", () => {
    expect(classifyLLMError(new Error("401 Unauthorized"))).toBe("auth");
    expect(classifyLLMError(new Error("403 Forbidden"))).toBe("auth");
    expect(classifyLLMError(new Error("unauthorized access"))).toBe("auth");
    expect(classifyLLMError(new Error("forbidden resource"))).toBe("auth");
    expect(classifyLLMError(new Error("invalid api key"))).toBe("auth");
    expect(classifyLLMError(new Error("invalid_api_key"))).toBe("auth");
  });

  it("should classify rate limit / overload", () => {
    expect(classifyLLMError(new Error("429 Too Many Requests"))).toBe("overload");
    expect(classifyLLMError(new Error("rate limit exceeded"))).toBe("overload");
    expect(classifyLLMError(new Error("503 Service Unavailable"))).toBe("overload");
    expect(classifyLLMError(new Error("server overload"))).toBe("overload");
    expect(classifyLLMError(new Error("at capacity"))).toBe("overload");
  });

  it("should classify transient network errors", () => {
    expect(classifyLLMError(new Error("ETIMEDOUT"))).toBe("transient");
    expect(classifyLLMError(new Error("ECONNRESET"))).toBe("transient");
    expect(classifyLLMError(new Error("ECONNREFUSED"))).toBe("transient");
    expect(classifyLLMError(new Error("500 Internal Server Error"))).toBe("transient");
    expect(classifyLLMError(new Error("502 Bad Gateway"))).toBe("transient");
    expect(classifyLLMError(new Error("504 Gateway Timeout"))).toBe("transient");
    expect(classifyLLMError(new Error("network error"))).toBe("transient");
  });

  it("should classify unknown errors as permanent", () => {
    expect(classifyLLMError(new Error("something completely unknown"))).toBe("permanent");
  });
});

describe("waitWithAbort", () => {
  it("should resolve after delay", async () => {
    const start = Date.now();
    await waitWithAbort(50);
    expect(Date.now() - start).toBeGreaterThanOrEqual(40);
  });

  it("should reject immediately if already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(waitWithAbort(1000, controller.signal)).rejects.toThrow("Aborted");
  });

  it("should reject when signal fires during wait", async () => {
    const controller = new AbortController();
    const promise = waitWithAbort(5000, controller.signal);
    setTimeout(() => controller.abort(), 10);
    await expect(promise).rejects.toThrow("Aborted");
  });
});

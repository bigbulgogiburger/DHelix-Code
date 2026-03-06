import { describe, it, expect } from "vitest";
import {
  BaseError,
  ConfigError,
  LLMError,
  ToolError,
  PermissionError,
  AuthError,
  ConversationError,
  isBaseError,
} from "../../../src/utils/error.js";

describe("BaseError", () => {
  it("should create error with code and context", () => {
    const error = new BaseError("test message", "TEST_CODE", { key: "value" });

    expect(error.message).toBe("test message");
    expect(error.code).toBe("TEST_CODE");
    expect(error.context).toEqual({ key: "value" });
    expect(error.name).toBe("BaseError");
  });

  it("should freeze context", () => {
    const error = new BaseError("test", "CODE", { key: "value" });
    expect(Object.isFrozen(error.context)).toBe(true);
  });

  it("should create new error with additional context", () => {
    const error = new BaseError("test", "CODE", { a: 1 });
    const extended = error.withContext({ b: 2 });

    expect(extended.context).toEqual({ a: 1, b: 2 });
    expect(error.context).toEqual({ a: 1 });
  });
});

describe("Error subclasses", () => {
  it("ConfigError should have correct code", () => {
    const error = new ConfigError("bad config");
    expect(error.code).toBe("CONFIG_ERROR");
    expect(error.name).toBe("ConfigError");
  });

  it("LLMError should have correct code", () => {
    const error = new LLMError("llm failed");
    expect(error.code).toBe("LLM_ERROR");
  });

  it("ToolError should have correct code", () => {
    const error = new ToolError("tool failed");
    expect(error.code).toBe("TOOL_ERROR");
  });

  it("PermissionError should have correct code", () => {
    const error = new PermissionError("denied");
    expect(error.code).toBe("PERMISSION_ERROR");
  });

  it("AuthError should have correct code", () => {
    const error = new AuthError("unauthorized");
    expect(error.code).toBe("AUTH_ERROR");
  });

  it("ConversationError should have correct code", () => {
    const error = new ConversationError("bad state");
    expect(error.code).toBe("CONVERSATION_ERROR");
  });
});

describe("isBaseError", () => {
  it("should return true for BaseError instances", () => {
    expect(isBaseError(new BaseError("test", "CODE"))).toBe(true);
    expect(isBaseError(new ConfigError("test"))).toBe(true);
  });

  it("should return false for regular errors", () => {
    expect(isBaseError(new Error("test"))).toBe(false);
    expect(isBaseError("string")).toBe(false);
    expect(isBaseError(null)).toBe(false);
  });
});

/**
 * Base error class for all dbcode errors.
 * Provides structured error information with error codes and context.
 */
export class BaseError extends Error {
  readonly code: string;
  readonly context: Readonly<Record<string, unknown>>;

  constructor(message: string, code: string, context: Record<string, unknown> = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.context = Object.freeze({ ...context });
  }

  /** Create a new error with additional context */
  withContext(extra: Record<string, unknown>): BaseError {
    return new BaseError(this.message, this.code, { ...this.context, ...extra });
  }
}

/** Configuration loading or validation error */
export class ConfigError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "CONFIG_ERROR", context);
  }
}

/** LLM client communication error */
export class LLMError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "LLM_ERROR", context);
  }
}

/** Tool execution error */
export class ToolError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "TOOL_ERROR", context);
  }
}

/** Permission denied error */
export class PermissionError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "PERMISSION_ERROR", context);
  }
}

/** Authentication error */
export class AuthError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "AUTH_ERROR", context);
  }
}

/** Conversation state error */
export class ConversationError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "CONVERSATION_ERROR", context);
  }
}

/** Type guard for BaseError */
export function isBaseError(error: unknown): error is BaseError {
  return error instanceof BaseError;
}

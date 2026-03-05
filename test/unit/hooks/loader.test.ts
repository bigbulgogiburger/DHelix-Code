import { describe, it, expect } from "vitest";
import { parseHookConfig } from "../../../src/hooks/loader.js";

describe("parseHookConfig", () => {
  it("should return empty config for null/undefined", () => {
    expect(parseHookConfig(null)).toEqual({});
    expect(parseHookConfig(undefined)).toEqual({});
  });

  it("should throw for non-object input", () => {
    expect(() => parseHookConfig("string")).toThrow("Hook config must be an object");
    expect(() => parseHookConfig([])).toThrow("Hook config must be an object");
  });

  it("should throw for unknown event names", () => {
    expect(() =>
      parseHookConfig({
        UnknownEvent: [{ hooks: [{ type: "command", command: "echo" }] }],
      }),
    ).toThrow("Unknown hook event");
  });

  it("should parse valid command hook config", () => {
    const config = parseHookConfig({
      PreToolUse: [
        {
          matcher: "file_edit",
          hooks: [{ type: "command", command: "prettier --write $FILE_PATH" }],
        },
      ],
    });

    expect(config.PreToolUse).toHaveLength(1);
    expect(config.PreToolUse![0].matcher).toBe("file_edit");
    expect(config.PreToolUse![0].hooks).toHaveLength(1);
    expect(config.PreToolUse![0].hooks[0].type).toBe("command");
  });

  it("should parse valid http hook config", () => {
    const config = parseHookConfig({
      Stop: [
        {
          hooks: [
            {
              type: "http",
              url: "https://example.com/webhook",
              headers: { Authorization: "Bearer token" },
            },
          ],
        },
      ],
    });

    expect(config.Stop).toHaveLength(1);
    const handler = config.Stop![0].hooks[0];
    expect(handler.type).toBe("http");
  });

  it("should parse multiple events", () => {
    const config = parseHookConfig({
      PreToolUse: [{ hooks: [{ type: "command", command: "echo pre" }] }],
      PostToolUse: [{ hooks: [{ type: "command", command: "echo post" }] }],
      Stop: [{ hooks: [{ type: "command", command: "echo stop" }] }],
    });

    expect(Object.keys(config)).toHaveLength(3);
  });

  it("should accept optional fields on handlers", () => {
    const config = parseHookConfig({
      PreToolUse: [
        {
          hooks: [
            {
              type: "command",
              command: "echo test",
              timeoutMs: 5000,
              blocking: true,
            },
          ],
        },
      ],
    });

    const handler = config.PreToolUse![0].hooks[0];
    expect(handler.type).toBe("command");
  });
});

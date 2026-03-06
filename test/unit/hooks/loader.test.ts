import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { parseHookConfig, loadHookConfig } from "../../../src/hooks/loader.js";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";

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

  it("should parse prompt hook handler", () => {
    const config = parseHookConfig({
      PreToolUse: [
        {
          hooks: [{ type: "prompt", prompt: "Are you sure?" }],
        },
      ],
    });
    expect(config.PreToolUse![0].hooks[0].type).toBe("prompt");
  });

  it("should parse agent hook handler", () => {
    const config = parseHookConfig({
      PreToolUse: [
        {
          hooks: [{ type: "agent", prompt: "Check security" }],
        },
      ],
    });
    expect(config.PreToolUse![0].hooks[0].type).toBe("agent");
  });

  it("should throw for invalid handler schema", () => {
    expect(() =>
      parseHookConfig({
        PreToolUse: [{ hooks: [{ type: "command" }] }],
      }),
    ).toThrow();
  });
});

const loaderTmpDir = join(process.cwd(), "test", "tmp", "hook-loader");

describe("loadHookConfig", () => {
  beforeEach(async () => {
    await mkdir(loaderTmpDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(loaderTmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it("should return empty config when settings.json does not exist", async () => {
    const config = await loadHookConfig(loaderTmpDir);
    expect(config).toEqual({});
  });

  it("should return empty config when no hooks key in settings", async () => {
    await writeFile(
      join(loaderTmpDir, "settings.json"),
      JSON.stringify({ theme: "dark" }),
      "utf-8",
    );
    const config = await loadHookConfig(loaderTmpDir);
    expect(config).toEqual({});
  });

  it("should load hooks from settings.json", async () => {
    const settings = {
      hooks: {
        PreToolUse: [
          {
            matcher: "file_edit",
            hooks: [{ type: "command", command: "echo test" }],
          },
        ],
      },
    };
    await writeFile(join(loaderTmpDir, "settings.json"), JSON.stringify(settings), "utf-8");

    const config = await loadHookConfig(loaderTmpDir);
    expect(config.PreToolUse).toHaveLength(1);
  });

  it("should throw HookLoadError for invalid hook event names", async () => {
    const settings = {
      hooks: {
        InvalidEvent: [{ hooks: [{ type: "command", command: "echo" }] }],
      },
    };
    await writeFile(join(loaderTmpDir, "settings.json"), JSON.stringify(settings), "utf-8");

    await expect(loadHookConfig(loaderTmpDir)).rejects.toThrow("Unknown hook event");
  });

  it("should throw HookLoadError for invalid JSON in settings file", async () => {
    await writeFile(join(loaderTmpDir, "settings.json"), "not valid json {{{", "utf-8");

    await expect(loadHookConfig(loaderTmpDir)).rejects.toThrow("Failed to load hook configuration");
  });
});

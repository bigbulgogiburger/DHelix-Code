import { vi, describe, it, expect, beforeEach } from "vitest";

// --- Hoisted mocks ---
const { mockSpawn, mockReadFile } = vi.hoisted(() => ({
  mockSpawn: vi.fn(),
  mockReadFile: vi.fn(),
}));

const {
  mockCreateProtocolConnection,
  mockSendRequest,
  mockSendNotification,
  mockListen,
  mockDispose,
} = vi.hoisted(() => ({
  mockCreateProtocolConnection: vi.fn(),
  mockSendRequest: vi.fn(),
  mockSendNotification: vi.fn(),
  mockListen: vi.fn(),
  mockDispose: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  spawn: (...args: unknown[]) => mockSpawn(...args),
}));

vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  return {
    ...actual,
    readFile: mockReadFile,
  };
});

vi.mock("vscode-languageserver-protocol/node", () => ({
  createProtocolConnection: (...args: unknown[]) => mockCreateProtocolConnection(...args),
  StreamMessageReader: vi.fn(),
  StreamMessageWriter: vi.fn(),
}));

vi.mock("vscode-languageserver-protocol", () => ({
  InitializeRequest: { type: { method: "initialize" } },
  InitializedNotification: { type: "initialized" },
  DidOpenTextDocumentNotification: { type: "textDocument/didOpen" },
  DidCloseTextDocumentNotification: { type: "textDocument/didClose" },
  DefinitionRequest: { type: { method: "textDocument/definition" } },
  ReferencesRequest: { type: { method: "textDocument/references" } },
  HoverRequest: { type: { method: "textDocument/hover" } },
  RenameRequest: { type: { method: "textDocument/rename" } },
  ShutdownRequest: { type: { method: "shutdown" } },
  ExitNotification: { type: "exit" },
}));

import { LSPServerConnection } from "../../../src/lsp/server-connection.js";
import { Readable, Writable } from "node:stream";

function createMockProcess() {
  return {
    stdout: new Readable({ read() {} }),
    stdin: new Writable({
      write(_c: unknown, _e: unknown, cb: () => void) {
        cb();
      },
    }),
    stderr: new Readable({ read() {} }),
    kill: vi.fn(),
    on: vi.fn(),
    removeAllListeners: vi.fn(),
    pid: 12345,
    exitCode: null,
  };
}

describe("LSPServerConnection", () => {
  let connection: LSPServerConnection;

  beforeEach(() => {
    vi.clearAllMocks();

    const mockProcess = createMockProcess();
    mockSpawn.mockReturnValue(mockProcess);

    mockCreateProtocolConnection.mockReturnValue({
      sendRequest: mockSendRequest,
      sendNotification: mockSendNotification,
      listen: mockListen,
      dispose: mockDispose,
    });

    mockSendRequest.mockResolvedValue({});
    mockReadFile.mockResolvedValue("const x = 1;\n");

    // Constructor: (command, args, projectRoot, language)
    connection = new LSPServerConnection(
      "typescript-language-server",
      ["--stdio"],
      "/project",
      "typescript",
    );
  });

  describe("start", () => {
    it("should spawn a process and initialize LSP connection", async () => {
      await connection.start();

      expect(mockSpawn).toHaveBeenCalledWith(
        "typescript-language-server",
        ["--stdio"],
        expect.objectContaining({ cwd: "/project" }),
      );
      expect(mockListen).toHaveBeenCalled();
      // InitializeRequest is sent via sendRequest
      expect(mockSendRequest).toHaveBeenCalled();
      // isAlive is a getter, not a method
      expect(connection.isAlive).toBe(true);
    });

    it("should throw when spawn fails (no stdout)", async () => {
      mockSpawn.mockReturnValue({
        stdout: null,
        stdin: new Writable({
          write(_c: unknown, _e: unknown, cb: () => void) {
            cb();
          },
        }),
        stderr: null,
        kill: vi.fn(),
        on: vi.fn(),
        exitCode: null,
      });

      await expect(connection.start()).rejects.toThrow(/Failed to spawn/);
    });

    it("should throw when spawn fails (no stdin)", async () => {
      mockSpawn.mockReturnValue({
        stdout: new Readable({ read() {} }),
        stdin: null,
        stderr: null,
        kill: vi.fn(),
        on: vi.fn(),
        exitCode: null,
      });

      await expect(connection.start()).rejects.toThrow(/Failed to spawn/);
    });
  });

  describe("openDocument", () => {
    it("should send didOpen notification with file content", async () => {
      await connection.start();
      mockReadFile.mockResolvedValue("export function hello() {}");

      await connection.openDocument("/project/src/app.ts");

      expect(mockSendNotification).toHaveBeenCalledWith(
        "textDocument/didOpen",
        expect.objectContaining({
          textDocument: expect.objectContaining({
            uri: "file:///project/src/app.ts",
            // openDocument uses this.language (set in constructor), not file extension
            languageId: "typescript",
            version: 1,
            text: "export function hello() {}",
          }),
        }),
      );
    });

    it("should skip already-open documents", async () => {
      await connection.start();

      await connection.openDocument("/project/src/app.ts");
      mockSendNotification.mockClear();

      await connection.openDocument("/project/src/app.ts");
      // didOpen should NOT be sent again
      expect(mockSendNotification).not.toHaveBeenCalledWith(
        "textDocument/didOpen",
        expect.anything(),
      );
    });

    it("should use constructor language for all files", async () => {
      // The openDocument method uses this.language from constructor, not file extension
      await connection.start();
      mockReadFile.mockResolvedValue("package main");

      await connection.openDocument("/project/main.go");

      // Language is always "typescript" since that's what we passed to constructor
      expect(mockSendNotification).toHaveBeenCalledWith(
        "textDocument/didOpen",
        expect.objectContaining({
          textDocument: expect.objectContaining({
            languageId: "typescript",
          }),
        }),
      );
    });
  });

  describe("closeDocument", () => {
    it("should send didClose notification", async () => {
      await connection.start();
      await connection.openDocument("/project/src/app.ts");
      mockSendNotification.mockClear();

      await connection.closeDocument("/project/src/app.ts");

      expect(mockSendNotification).toHaveBeenCalledWith(
        "textDocument/didClose",
        expect.objectContaining({
          textDocument: { uri: "file:///project/src/app.ts" },
        }),
      );
    });

    it("should skip close for documents that are not open", async () => {
      await connection.start();

      await connection.closeDocument("/project/src/not-opened.ts");
      expect(mockSendNotification).not.toHaveBeenCalledWith(
        "textDocument/didClose",
        expect.anything(),
      );
    });
  });

  describe("gotoDefinition", () => {
    it("should send definition request and return raw locations", async () => {
      await connection.start();
      // gotoDefinition returns raw Location[] | LocationLink[]
      mockSendRequest.mockResolvedValue([
        {
          uri: "file:///project/src/utils.ts",
          range: { start: { line: 9, character: 4 }, end: { line: 9, character: 20 } },
        },
      ]);

      const result = await connection.gotoDefinition("/project/src/app.ts", 5, 10);

      expect(result).toHaveLength(1);
      // Raw LSP Location is returned as-is
      expect(result[0]).toEqual(
        expect.objectContaining({
          uri: "file:///project/src/utils.ts",
          range: expect.objectContaining({
            start: { line: 9, character: 4 },
          }),
        }),
      );
    });

    it("should return empty array when no definition found", async () => {
      await connection.start();
      mockSendRequest.mockResolvedValue(null);

      const result = await connection.gotoDefinition("/project/src/app.ts", 1, 1);
      expect(result).toEqual([]);
    });
  });

  describe("findReferences", () => {
    it("should send references request with includeDeclaration", async () => {
      await connection.start();
      mockSendRequest.mockResolvedValue([
        {
          uri: "file:///project/src/a.ts",
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
        },
        {
          uri: "file:///project/src/b.ts",
          range: { start: { line: 4, character: 2 }, end: { line: 4, character: 7 } },
        },
      ]);

      const result = await connection.findReferences("/project/src/a.ts", 1, 1, true);

      expect(result).toHaveLength(2);
      // sendRequest is called for references (after initialize call)
      expect(mockSendRequest).toHaveBeenCalledWith(
        "textDocument/references",
        expect.objectContaining({
          context: { includeDeclaration: true },
        }),
      );
    });
  });

  describe("getHover", () => {
    it("should return hover result with string contents", async () => {
      await connection.start();
      mockSendRequest.mockResolvedValue({
        contents: "function hello(): void",
      });

      const result = await connection.getHover("/project/src/app.ts", 3, 5);

      // Returns raw Hover object, not a converted type
      expect(result).toBeDefined();
      expect(result!.contents).toBe("function hello(): void");
    });

    it("should return hover result with MarkupContent", async () => {
      await connection.start();
      mockSendRequest.mockResolvedValue({
        contents: { kind: "markdown", value: "```ts\nconst x: number\n```" },
      });

      const result = await connection.getHover("/project/src/app.ts", 1, 1);

      expect(result).toBeDefined();
      expect((result!.contents as { value: string }).value).toBe("```ts\nconst x: number\n```");
    });

    it("should return null when hover returns null", async () => {
      await connection.start();
      mockSendRequest.mockResolvedValue(null);

      const result = await connection.getHover("/project/src/app.ts", 1, 1);
      expect(result).toBeNull();
    });
  });

  describe("rename", () => {
    it("should return workspace edit from rename", async () => {
      await connection.start();
      mockSendRequest.mockResolvedValue({
        changes: {
          "file:///project/src/app.ts": [
            {
              range: { start: { line: 0, character: 9 }, end: { line: 0, character: 14 } },
              newText: "newName",
            },
          ],
          "file:///project/src/index.ts": [
            {
              range: { start: { line: 2, character: 0 }, end: { line: 2, character: 5 } },
              newText: "newName",
            },
          ],
        },
      });

      const result = await connection.rename("/project/src/app.ts", 1, 10, "newName");

      // Returns raw WorkspaceEdit
      expect(result).toBeDefined();
      expect(result!.changes).toBeDefined();
      expect(Object.keys(result!.changes!)).toHaveLength(2);
    });

    it("should return null when rename returns no changes", async () => {
      await connection.start();
      mockSendRequest.mockResolvedValue(null);

      const result = await connection.rename("/project/src/app.ts", 1, 1, "newName");
      expect(result).toBeNull();
    });
  });

  describe("shutdown", () => {
    it("should send shutdown and exit notifications", async () => {
      await connection.start();
      await connection.shutdown();

      // shutdown uses ShutdownRequest.type which is { method: "shutdown" }
      expect(mockSendRequest).toHaveBeenCalledWith(expect.objectContaining({ method: "shutdown" }));
      // exit uses ExitNotification.type
      expect(mockSendNotification).toHaveBeenCalledWith("exit");
      // isAlive is a getter
      expect(connection.isAlive).toBe(false);
    });

    it("should handle shutdown gracefully when connection is null", async () => {
      // No start() called
      await expect(connection.shutdown()).resolves.not.toThrow();
    });
  });

  describe("isAlive", () => {
    it("should return false before start", () => {
      // isAlive is a getter
      expect(connection.isAlive).toBe(false);
    });

    it("should return true after start", async () => {
      await connection.start();
      expect(connection.isAlive).toBe(true);
    });

    it("should return false after shutdown", async () => {
      await connection.start();
      await connection.shutdown();
      expect(connection.isAlive).toBe(false);
    });
  });
});

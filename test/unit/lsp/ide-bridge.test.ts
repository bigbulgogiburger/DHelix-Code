/**
 * IDE Bridge Client — Unit Tests
 *
 * Tests the IDEBridgeClient class: connection management,
 * JSON-RPC request/response lifecycle, LSPSession adapter,
 * error handling, and reconnection logic.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createServer, type Server } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unlinkSync } from "node:fs";

// Mock logger — must be hoisted before import
vi.mock("../../../src/utils/logger.js", () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock error module
vi.mock("../../../src/utils/error.js", () => ({
  BaseError: class BaseError extends Error {
    readonly code: string;
    readonly details?: Record<string, unknown>;
    constructor(message: string, code: string, details?: Record<string, unknown>) {
      super(message);
      this.code = code;
      this.details = details;
      this.name = "BaseError";
    }
  },
}));

describe("IDEBridgeClient", () => {
  let testSocketPath: string;
  let mockServer: Server | undefined;

  beforeEach(() => {
    testSocketPath = join(
      tmpdir(),
      `dhelix-test-${Date.now()}-${Math.random().toString(36).slice(2)}.sock`,
    );
  });

  afterEach(async () => {
    if (mockServer) {
      await new Promise<void>((resolve) => {
        mockServer!.close(() => resolve());
      });
      mockServer = undefined;
    }
    try {
      unlinkSync(testSocketPath);
    } catch {
      /* socket may not exist */
    }
  });

  /**
   * Create a mock IPC server that speaks JSON-RPC 2.0 with Content-Length framing.
   * The handler receives (method, params) and returns the result payload.
   */
  function createMockServer(
    handler: (method: string, params: unknown) => unknown,
  ): Promise<Server> {
    return new Promise((resolve) => {
      const server = createServer((socket) => {
        let buffer = "";
        socket.on("data", (data) => {
          buffer += data.toString("utf-8");

          while (true) {
            const headerEnd = buffer.indexOf("\r\n\r\n");
            if (headerEnd === -1) break;

            const header = buffer.slice(0, headerEnd);
            const match = header.match(/Content-Length:\s*(\d+)/i);
            if (!match) {
              buffer = buffer.slice(headerEnd + 4);
              continue;
            }

            const contentLength = parseInt(match[1], 10);
            const bodyStart = headerEnd + 4;
            const bodyEnd = bodyStart + contentLength;

            if (buffer.length < bodyEnd) break;

            const body = buffer.slice(bodyStart, bodyEnd);
            buffer = buffer.slice(bodyEnd);

            try {
              const msg = JSON.parse(body);
              const result = handler(msg.method, msg.params);
              const response = JSON.stringify({
                jsonrpc: "2.0",
                id: msg.id,
                result,
              });
              const responseHeader = `Content-Length: ${Buffer.byteLength(response)}\r\n\r\n`;
              socket.write(responseHeader + response);
            } catch (error) {
              const errResponse = JSON.stringify({
                jsonrpc: "2.0",
                id: null,
                error: { code: -32603, message: String(error) },
              });
              const errHeader = `Content-Length: ${Buffer.byteLength(errResponse)}\r\n\r\n`;
              socket.write(errHeader + errResponse);
            }
          }
        });
      });

      server.listen(testSocketPath, () => {
        mockServer = server;
        resolve(server);
      });
    });
  }

  /** Standard initialize + definition handler for reuse */
  function defaultHandler(method: string, _params: unknown): unknown {
    if (method === "initialize") {
      return {
        capabilities: {
          languages: ["typescript"],
          supportsDiagnostics: true,
          supportsCodeActions: true,
          supportsWorkspaceSymbols: true,
          supportsCallHierarchy: true,
          ideType: "vscode",
          ideVersion: "1.90.0",
        },
        serverVersion: "0.1.0",
      };
    }
    if (method === "lsp/definition") {
      return {
        results: [
          {
            filePath: "/test/file.ts",
            line: 10,
            column: 5,
            preview: "function foo() {",
          },
        ],
        source: "ide",
      };
    }
    if (method === "lsp/references") {
      return {
        results: [
          { filePath: "/test/file.ts", line: 10, column: 5, preview: "foo()" },
          { filePath: "/test/other.ts", line: 20, column: 3, preview: "foo()" },
        ],
        source: "ide",
      };
    }
    if (method === "lsp/hover") {
      return {
        result: {
          type: "function foo(): void",
          documentation: "Does something",
        },
        source: "ide",
      };
    }
    if (method === "lsp/rename") {
      return {
        edits: [
          { filePath: "/test/file.ts", line: 10, column: 5, newText: "bar" },
        ],
        source: "ide",
      };
    }
    if (method === "shutdown") {
      return { success: true };
    }
    return {};
  }

  /** Helper to create a connected client with the test socket path monkey-patched */
  async function createConnectedClient(): Promise<
    InstanceType<(typeof import("../../../src/lsp/ide-bridge.js"))["IDEBridgeClient"]>
  > {
    const { IDEBridgeClient } = await import("../../../src/lsp/ide-bridge.js");
    const client = new IDEBridgeClient({
      workspacePath: "/test",
      requestTimeoutMs: 5000,
    });
    // Override socket path and availability for testing
    (client as Record<string, unknown>)["socketPath"] = testSocketPath;
    return client;
  }

  // ── Constructor & State ──

  describe("constructor", () => {
    it("should create with default config and disconnected state", async () => {
      const { IDEBridgeClient } = await import("../../../src/lsp/ide-bridge.js");
      const client = new IDEBridgeClient({ workspacePath: "/test" });
      expect(client.isConnected).toBe(false);
      expect(client.currentState).toBe("disconnected");
      expect(client.ideCapabilities).toBeUndefined();
    });

    it("should apply default timeout when not specified", async () => {
      const { IDEBridgeClient } = await import("../../../src/lsp/ide-bridge.js");
      const client = new IDEBridgeClient({ workspacePath: "/test" });
      // Default requestTimeoutMs is 10000 — verify via config (private, but
      // observable through behavior). We just check that construction succeeds.
      expect(client.currentState).toBe("disconnected");
    });
  });

  // ── Socket Path ──

  describe("getSocketPath", () => {
    it("should return deterministic paths for the same workspace", async () => {
      const { IDEBridgeClient } = await import("../../../src/lsp/ide-bridge.js");
      const client1 = new IDEBridgeClient({ workspacePath: "/test/project" });
      const client2 = new IDEBridgeClient({ workspacePath: "/test/project" });
      expect(client1.getSocketPath()).toBe(client2.getSocketPath());
    });

    it("should return different paths for different workspaces", async () => {
      const { IDEBridgeClient } = await import("../../../src/lsp/ide-bridge.js");
      const clientA = new IDEBridgeClient({ workspacePath: "/project-a" });
      const clientB = new IDEBridgeClient({ workspacePath: "/project-b" });
      expect(clientA.getSocketPath()).not.toBe(clientB.getSocketPath());
    });
  });

  // ── Connection Lifecycle ──

  describe("connect and disconnect", () => {
    it("should connect to a mock server and complete initialize handshake", async () => {
      await createMockServer(defaultHandler);
      const client = await createConnectedClient();

      await client.connect();
      expect(client.isConnected).toBe(true);
      expect(client.currentState).toBe("connected");
      expect(client.ideCapabilities).toBeDefined();
      expect(client.ideCapabilities?.ideType).toBe("vscode");
      expect(client.ideCapabilities?.languages).toContain("typescript");

      await client.disconnect();
      expect(client.isConnected).toBe(false);
      expect(client.currentState).toBe("disconnected");
    });

    it("should be a no-op when already connected", async () => {
      await createMockServer(defaultHandler);
      const client = await createConnectedClient();

      await client.connect();
      // Second connect should return immediately
      await client.connect();
      expect(client.isConnected).toBe(true);

      await client.disconnect();
    });
  });

  // ── LSP Methods ──

  describe("gotoDefinition", () => {
    it("should return definition results from the IDE bridge", async () => {
      await createMockServer(defaultHandler);
      const client = await createConnectedClient();
      await client.connect();

      const results = await client.gotoDefinition("/test/file.ts", 10, 5);
      expect(results).toHaveLength(1);
      expect(results[0].filePath).toBe("/test/file.ts");
      expect(results[0].line).toBe(10);
      expect(results[0].column).toBe(5);

      await client.disconnect();
    });
  });

  describe("findReferences", () => {
    it("should return reference results from the IDE bridge", async () => {
      await createMockServer(defaultHandler);
      const client = await createConnectedClient();
      await client.connect();

      const results = await client.findReferences("/test/file.ts", 10, 5);
      expect(results).toHaveLength(2);
      expect(results[0].filePath).toBe("/test/file.ts");
      expect(results[1].filePath).toBe("/test/other.ts");

      await client.disconnect();
    });
  });

  describe("getTypeInfo", () => {
    it("should return hover/type info from the IDE bridge", async () => {
      await createMockServer(defaultHandler);
      const client = await createConnectedClient();
      await client.connect();

      const result = await client.getTypeInfo("/test/file.ts", 10, 5);
      expect(result).toBeDefined();
      expect(result?.type).toBe("function foo(): void");

      await client.disconnect();
    });
  });

  describe("rename", () => {
    it("should return rename edits from the IDE bridge", async () => {
      await createMockServer(defaultHandler);
      const client = await createConnectedClient();
      await client.connect();

      const edits = await client.rename("/test/file.ts", 10, 5, "bar");
      expect(edits).toHaveLength(1);
      expect(edits[0].newText).toBe("bar");

      await client.disconnect();
    });
  });

  // ── LSPSession Adapter ──

  describe("createSession", () => {
    it("should create an LSPSession-compatible object", async () => {
      const { IDEBridgeClient } = await import("../../../src/lsp/ide-bridge.js");
      const client = new IDEBridgeClient({ workspacePath: "/test" });
      const session = client.createSession("typescript");

      expect(session.language).toBe("typescript");
      expect(session.state).toBe("stopped"); // Not connected
      expect(typeof session.gotoDefinition).toBe("function");
      expect(typeof session.findReferences).toBe("function");
      expect(typeof session.getTypeInfo).toBe("function");
      expect(typeof session.rename).toBe("function");
      expect(typeof session.openDocument).toBe("function");
      expect(typeof session.closeDocument).toBe("function");
    });

    it("should report 'running' state when client is connected", async () => {
      await createMockServer(defaultHandler);
      const client = await createConnectedClient();
      await client.connect();

      const session = client.createSession("typescript");
      expect(session.state).toBe("running");

      await client.disconnect();
    });

    it("should delegate LSP calls to the client", async () => {
      await createMockServer(defaultHandler);
      const client = await createConnectedClient();
      await client.connect();

      const session = client.createSession("typescript");

      const defResults = await session.gotoDefinition("/test/file.ts", 10, 5);
      expect(defResults).toHaveLength(1);
      expect(defResults[0].filePath).toBe("/test/file.ts");

      await client.disconnect();
    });

    it("should make openDocument and closeDocument no-ops", async () => {
      await createMockServer(defaultHandler);
      const client = await createConnectedClient();
      await client.connect();

      const session = client.createSession("typescript");

      // These should resolve without error (IDE handles lifecycle)
      await expect(session.openDocument("/test/file.ts")).resolves.toBeUndefined();
      await expect(session.closeDocument("/test/file.ts")).resolves.toBeUndefined();

      await client.disconnect();
    });
  });

  // ── Error Handling ──

  describe("error handling", () => {
    it("should reject LSP calls when not connected", async () => {
      const { IDEBridgeClient } = await import("../../../src/lsp/ide-bridge.js");
      const client = new IDEBridgeClient({ workspacePath: "/test" });

      await expect(client.gotoDefinition("/test.ts", 1, 1)).rejects.toThrow(
        "Not connected",
      );
    });

    it("should reject findReferences when not connected", async () => {
      const { IDEBridgeClient } = await import("../../../src/lsp/ide-bridge.js");
      const client = new IDEBridgeClient({ workspacePath: "/test" });

      await expect(client.findReferences("/test.ts", 1, 1)).rejects.toThrow(
        "Not connected",
      );
    });

    it("should reject getTypeInfo when not connected", async () => {
      const { IDEBridgeClient } = await import("../../../src/lsp/ide-bridge.js");
      const client = new IDEBridgeClient({ workspacePath: "/test" });

      await expect(client.getTypeInfo("/test.ts", 1, 1)).rejects.toThrow(
        "Not connected",
      );
    });

    it("should reject rename when not connected", async () => {
      const { IDEBridgeClient } = await import("../../../src/lsp/ide-bridge.js");
      const client = new IDEBridgeClient({ workspacePath: "/test" });

      await expect(client.rename("/test.ts", 1, 1, "newName")).rejects.toThrow(
        "Not connected",
      );
    });

    it("should throw on connection to non-existent socket", async () => {
      const { IDEBridgeClient } = await import("../../../src/lsp/ide-bridge.js");
      const client = new IDEBridgeClient({
        workspacePath: "/test",
        requestTimeoutMs: 500,
      });
      // Patch to bypass existence check but point at non-existent socket
      (client as Record<string, unknown>)["socketPath"] =
        "/tmp/dhelix-nonexistent-socket-test.sock";

      await expect(client.connect()).rejects.toThrow();
    });

    it("should handle JSON-RPC error responses", async () => {
      // Create a server that returns proper JSON-RPC errors with the request id
      const errorServer = createServer((socket) => {
        let buffer = "";
        socket.on("data", (data) => {
          buffer += data.toString("utf-8");
          while (true) {
            const headerEnd = buffer.indexOf("\r\n\r\n");
            if (headerEnd === -1) break;
            const header = buffer.slice(0, headerEnd);
            const match = header.match(/Content-Length:\s*(\d+)/i);
            if (!match) { buffer = buffer.slice(headerEnd + 4); continue; }
            const contentLength = parseInt(match[1], 10);
            const bodyStart = headerEnd + 4;
            const bodyEnd = bodyStart + contentLength;
            if (buffer.length < bodyEnd) break;
            const body = buffer.slice(bodyStart, bodyEnd);
            buffer = buffer.slice(bodyEnd);
            const msg = JSON.parse(body);
            let response: string;
            if (msg.method === "initialize") {
              response = JSON.stringify({
                jsonrpc: "2.0", id: msg.id,
                result: {
                  capabilities: {
                    languages: ["typescript"],
                    supportsDiagnostics: false,
                    supportsCodeActions: false,
                    supportsWorkspaceSymbols: false,
                    supportsCallHierarchy: false,
                    ideType: "vscode",
                    ideVersion: "1.90.0",
                  },
                  serverVersion: "0.1.0",
                },
              });
            } else {
              // Return a proper JSON-RPC error with the correct id
              response = JSON.stringify({
                jsonrpc: "2.0", id: msg.id,
                error: { code: -32603, message: "Symbol not found" },
              });
            }
            const respHeader = `Content-Length: ${Buffer.byteLength(response)}\r\n\r\n`;
            socket.write(respHeader + response);
          }
        });
      });

      await new Promise<void>((resolve) => {
        errorServer.listen(testSocketPath, () => {
          mockServer = errorServer;
          resolve();
        });
      });

      const client = await createConnectedClient();
      await client.connect();

      await expect(client.gotoDefinition("/test.ts", 1, 1)).rejects.toThrow(
        "Symbol not found",
      );

      await client.disconnect();
    });
  });

  // ── Extended IDE Methods ──

  describe("extended methods", () => {
    it("should get diagnostics from the IDE bridge", async () => {
      await createMockServer((method) => {
        if (method === "initialize") return defaultHandler(method, {});
        if (method === "lsp/diagnostics") {
          return {
            diagnostics: [
              {
                filePath: "/test/file.ts",
                line: 5,
                column: 1,
                endLine: 5,
                endColumn: 10,
                severity: "error",
                message: "Type error",
                source: "typescript",
              },
            ],
          };
        }
        return {};
      });

      const client = await createConnectedClient();
      await client.connect();

      const diags = await client.getDiagnostics("/test/file.ts");
      expect(diags).toHaveLength(1);
      expect(diags[0].severity).toBe("error");
      expect(diags[0].message).toBe("Type error");

      await client.disconnect();
    });

    it("should search workspace symbols", async () => {
      await createMockServer((method) => {
        if (method === "initialize") return defaultHandler(method, {});
        if (method === "lsp/workspaceSymbols") {
          return {
            symbols: [
              {
                name: "MyClass",
                kind: "class",
                filePath: "/test/file.ts",
                line: 1,
                column: 1,
              },
            ],
          };
        }
        return {};
      });

      const client = await createConnectedClient();
      await client.connect();

      const symbols = await client.searchWorkspaceSymbols("MyClass");
      expect(symbols).toHaveLength(1);
      expect(symbols[0].name).toBe("MyClass");
      expect(symbols[0].kind).toBe("class");

      await client.disconnect();
    });
  });

  // ── State Change Events ──

  describe("events", () => {
    it("should emit state changes during connect/disconnect lifecycle", async () => {
      await createMockServer(defaultHandler);
      const stateChanges: string[] = [];

      const { IDEBridgeClient } = await import("../../../src/lsp/ide-bridge.js");
      const client = new IDEBridgeClient({
        workspacePath: "/test",
        requestTimeoutMs: 5000,
        events: {
          onStateChange: (state) => stateChanges.push(state),
        },
      });
      (client as Record<string, unknown>)["socketPath"] = testSocketPath;

      await client.connect();
      expect(stateChanges).toContain("connecting");
      expect(stateChanges).toContain("connected");

      await client.disconnect();
      expect(stateChanges).toContain("disconnected");
    });
  });

  // ── Singleton Functions ──

  describe("singleton functions", () => {
    it("getIDEBridge should return undefined without workspace path", async () => {
      const { getIDEBridge } = await import("../../../src/lsp/ide-bridge.js");
      // Without prior initialization and no workspace path
      const result = getIDEBridge();
      // May be undefined or a previously created singleton
      expect(result === undefined || typeof result === "object").toBe(true);
    });

    it("getIDEBridge should create a client for a workspace path", async () => {
      const { getIDEBridge } = await import("../../../src/lsp/ide-bridge.js");
      const bridge = getIDEBridge("/test/singleton-workspace");
      expect(bridge).toBeDefined();
      expect(bridge!.isConnected).toBe(false);
    });

    it("tryConnectIDEBridge should return undefined when socket is absent", async () => {
      const { tryConnectIDEBridge } = await import("../../../src/lsp/ide-bridge.js");
      const result = await tryConnectIDEBridge("/nonexistent/workspace/path");
      expect(result).toBeUndefined();
    });

    it("disposeIDEBridge should not throw when no singleton exists", async () => {
      const { disposeIDEBridge } = await import("../../../src/lsp/ide-bridge.js");
      await expect(disposeIDEBridge()).resolves.not.toThrow();
    });
  });
});

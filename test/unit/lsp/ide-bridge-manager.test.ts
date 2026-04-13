/**
 * IDE Bridge Manager — Unit Tests
 *
 * Tests the smart session acquisition logic: extension-to-language mapping,
 * IDE bridge vs LSP manager fallback, and resource disposal.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock logger — hoisted before all imports
vi.mock("../../../src/utils/logger.js", () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  }),
}));

describe("ide-bridge-manager", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Extension-to-Language Mapping ──

  describe("getExtToLangMap", () => {
    it("should map TypeScript extensions correctly", async () => {
      const { getExtToLangMap } = await import("../../../src/lsp/ide-bridge-manager.js");
      const map = getExtToLangMap();

      expect(map[".ts"]).toBe("typescript");
      expect(map[".tsx"]).toBe("typescript");
      expect(map[".js"]).toBe("typescript");
      expect(map[".jsx"]).toBe("typescript");
      expect(map[".mts"]).toBe("typescript");
      expect(map[".cts"]).toBe("typescript");
    });

    it("should map Python extensions correctly", async () => {
      const { getExtToLangMap } = await import("../../../src/lsp/ide-bridge-manager.js");
      const map = getExtToLangMap();

      expect(map[".py"]).toBe("python");
      expect(map[".pyi"]).toBe("python");
    });

    it("should map Go, Rust, and Java extensions correctly", async () => {
      const { getExtToLangMap } = await import("../../../src/lsp/ide-bridge-manager.js");
      const map = getExtToLangMap();

      expect(map[".go"]).toBe("go");
      expect(map[".rs"]).toBe("rust");
      expect(map[".java"]).toBe("java");
    });

    it("should include all common extensions", async () => {
      const { getExtToLangMap } = await import("../../../src/lsp/ide-bridge-manager.js");
      const map = getExtToLangMap();
      const expected = [
        ".ts",
        ".tsx",
        ".js",
        ".jsx",
        ".mts",
        ".cts",
        ".py",
        ".pyi",
        ".go",
        ".rs",
        ".java",
      ];
      for (const ext of expected) {
        expect(map[ext]).toBeDefined();
      }
    });

    it("should not include unsupported extensions", async () => {
      const { getExtToLangMap } = await import("../../../src/lsp/ide-bridge-manager.js");
      const map = getExtToLangMap();

      expect(map[".txt"]).toBeUndefined();
      expect(map[".md"]).toBeUndefined();
      expect(map[".css"]).toBeUndefined();
      expect(map[".html"]).toBeUndefined();
    });
  });

  // ── acquireSmartSession ──

  describe("acquireSmartSession", () => {
    it("should return undefined for unsupported file extensions", async () => {
      // Mock dependencies to ensure we test the ext check path
      vi.doMock("../../../src/lsp/ide-bridge.js", () => ({
        tryConnectIDEBridge: vi.fn(),
      }));
      vi.doMock("../../../src/lsp/manager.js", () => ({
        getLSPManager: vi.fn(),
      }));

      const { acquireSmartSession } = await import("../../../src/lsp/ide-bridge-manager.js");
      const result = await acquireSmartSession("/test/file.txt", "/test");
      expect(result).toBeUndefined();
    });

    it("should return undefined for unknown extensions", async () => {
      vi.doMock("../../../src/lsp/ide-bridge.js", () => ({
        tryConnectIDEBridge: vi.fn(),
      }));
      vi.doMock("../../../src/lsp/manager.js", () => ({
        getLSPManager: vi.fn(),
      }));

      const { acquireSmartSession } = await import("../../../src/lsp/ide-bridge-manager.js");
      const result = await acquireSmartSession("/test/file.xyz", "/test");
      expect(result).toBeUndefined();
    });

    it("should return undefined for files without extensions", async () => {
      vi.doMock("../../../src/lsp/ide-bridge.js", () => ({
        tryConnectIDEBridge: vi.fn(),
      }));
      vi.doMock("../../../src/lsp/manager.js", () => ({
        getLSPManager: vi.fn(),
      }));

      const { acquireSmartSession } = await import("../../../src/lsp/ide-bridge-manager.js");
      const result = await acquireSmartSession("/test/Makefile", "/test");
      expect(result).toBeUndefined();
    });

    it("should return IDE bridge session when bridge is connected", async () => {
      const mockSession = {
        language: "typescript" as const,
        state: "running" as const,
        gotoDefinition: vi.fn(),
        findReferences: vi.fn(),
        getTypeInfo: vi.fn(),
        rename: vi.fn(),
        openDocument: vi.fn(),
        closeDocument: vi.fn(),
      };

      vi.doMock("../../../src/lsp/ide-bridge.js", () => ({
        tryConnectIDEBridge: vi.fn().mockResolvedValue({
          isConnected: true,
          createSession: () => mockSession,
        }),
      }));
      vi.doMock("../../../src/lsp/manager.js", () => ({
        getLSPManager: vi.fn(),
      }));

      const { acquireSmartSession } = await import("../../../src/lsp/ide-bridge-manager.js");
      const result = await acquireSmartSession("/test/file.ts", "/test");

      expect(result).toBeDefined();
      expect(result!.source).toBe("ide");
      expect(result!.session).toBe(mockSession);
    });

    it("should fall back to LSP manager when IDE bridge is unavailable", async () => {
      const mockSession = {
        language: "typescript" as const,
        state: "running" as const,
        gotoDefinition: vi.fn(),
        findReferences: vi.fn(),
        getTypeInfo: vi.fn(),
        rename: vi.fn(),
        openDocument: vi.fn(),
        closeDocument: vi.fn(),
      };

      vi.doMock("../../../src/lsp/ide-bridge.js", () => ({
        tryConnectIDEBridge: vi.fn().mockResolvedValue(undefined),
      }));
      vi.doMock("../../../src/lsp/manager.js", () => ({
        getLSPManager: vi.fn().mockReturnValue({
          detectAvailableServers: vi.fn().mockResolvedValue(["typescript"]),
          acquire: vi.fn().mockResolvedValue(mockSession),
        }),
      }));

      const { acquireSmartSession } = await import("../../../src/lsp/ide-bridge-manager.js");
      const result = await acquireSmartSession("/test/file.ts", "/test");

      expect(result).toBeDefined();
      expect(result!.source).toBe("lsp");
      expect(result!.session).toBe(mockSession);
    });

    it("should return undefined when both IDE bridge and LSP manager are unavailable", async () => {
      vi.doMock("../../../src/lsp/ide-bridge.js", () => ({
        tryConnectIDEBridge: vi.fn().mockResolvedValue(undefined),
      }));
      vi.doMock("../../../src/lsp/manager.js", () => ({
        getLSPManager: vi.fn().mockReturnValue({
          detectAvailableServers: vi.fn().mockResolvedValue([]),
        }),
      }));

      const { acquireSmartSession } = await import("../../../src/lsp/ide-bridge-manager.js");
      const result = await acquireSmartSession("/test/file.ts", "/test");

      expect(result).toBeUndefined();
    });

    it("should handle IDE bridge connection errors gracefully", async () => {
      vi.doMock("../../../src/lsp/ide-bridge.js", () => ({
        tryConnectIDEBridge: vi.fn().mockRejectedValue(new Error("Connection refused")),
      }));
      vi.doMock("../../../src/lsp/manager.js", () => ({
        getLSPManager: vi.fn().mockReturnValue({
          detectAvailableServers: vi.fn().mockResolvedValue([]),
        }),
      }));

      const { acquireSmartSession } = await import("../../../src/lsp/ide-bridge-manager.js");
      // Should not throw, just fall through to LSP manager
      const result = await acquireSmartSession("/test/file.ts", "/test");
      expect(result).toBeUndefined();
    });

    it("should handle LSP manager errors gracefully", async () => {
      vi.doMock("../../../src/lsp/ide-bridge.js", () => ({
        tryConnectIDEBridge: vi.fn().mockResolvedValue(undefined),
      }));
      vi.doMock("../../../src/lsp/manager.js", () => ({
        getLSPManager: vi.fn().mockReturnValue({
          detectAvailableServers: vi.fn().mockRejectedValue(new Error("Server crash")),
        }),
      }));

      const { acquireSmartSession } = await import("../../../src/lsp/ide-bridge-manager.js");
      const result = await acquireSmartSession("/test/file.ts", "/test");
      expect(result).toBeUndefined();
    });

    it("should try IDE bridge before LSP manager (priority order)", async () => {
      const callOrder: string[] = [];

      const mockSession = {
        language: "typescript" as const,
        state: "running" as const,
        gotoDefinition: vi.fn(),
        findReferences: vi.fn(),
        getTypeInfo: vi.fn(),
        rename: vi.fn(),
        openDocument: vi.fn(),
        closeDocument: vi.fn(),
      };

      vi.doMock("../../../src/lsp/ide-bridge.js", () => ({
        tryConnectIDEBridge: vi.fn().mockImplementation(async () => {
          callOrder.push("ide-bridge");
          return {
            isConnected: true,
            createSession: () => mockSession,
          };
        }),
      }));
      vi.doMock("../../../src/lsp/manager.js", () => ({
        getLSPManager: vi.fn().mockImplementation(() => {
          callOrder.push("lsp-manager");
          return {
            detectAvailableServers: vi.fn().mockResolvedValue(["typescript"]),
            acquire: vi.fn().mockResolvedValue(mockSession),
          };
        }),
      }));

      const { acquireSmartSession } = await import("../../../src/lsp/ide-bridge-manager.js");
      await acquireSmartSession("/test/file.ts", "/test");

      // IDE bridge should be tried first
      expect(callOrder[0]).toBe("ide-bridge");
      // LSP manager should NOT be called since IDE bridge succeeded
      expect(callOrder).not.toContain("lsp-manager");
    });

    it("should skip LSP manager when IDE bridge succeeds", async () => {
      const lspManagerCalled = vi.fn();
      const mockSession = {
        language: "python" as const,
        state: "running" as const,
        gotoDefinition: vi.fn(),
        findReferences: vi.fn(),
        getTypeInfo: vi.fn(),
        rename: vi.fn(),
        openDocument: vi.fn(),
        closeDocument: vi.fn(),
      };

      vi.doMock("../../../src/lsp/ide-bridge.js", () => ({
        tryConnectIDEBridge: vi.fn().mockResolvedValue({
          isConnected: true,
          createSession: () => mockSession,
        }),
      }));
      vi.doMock("../../../src/lsp/manager.js", () => ({
        getLSPManager: lspManagerCalled.mockReturnValue({
          detectAvailableServers: vi.fn().mockResolvedValue([]),
        }),
      }));

      const { acquireSmartSession } = await import("../../../src/lsp/ide-bridge-manager.js");
      const result = await acquireSmartSession("/test/file.py", "/test");

      expect(result).toBeDefined();
      expect(result!.source).toBe("ide");
      expect(lspManagerCalled).not.toHaveBeenCalled();
    });

    it("should detect language for .tsx files and acquire session", async () => {
      const mockSession = {
        language: "typescript" as const,
        state: "running" as const,
        gotoDefinition: vi.fn(),
        findReferences: vi.fn(),
        getTypeInfo: vi.fn(),
        rename: vi.fn(),
        openDocument: vi.fn(),
        closeDocument: vi.fn(),
      };

      vi.doMock("../../../src/lsp/ide-bridge.js", () => ({
        tryConnectIDEBridge: vi.fn().mockResolvedValue({
          isConnected: true,
          createSession: () => mockSession,
        }),
      }));
      vi.doMock("../../../src/lsp/manager.js", () => ({
        getLSPManager: vi.fn(),
      }));

      const { acquireSmartSession } = await import("../../../src/lsp/ide-bridge-manager.js");
      const result = await acquireSmartSession("/test/App.tsx", "/test");

      expect(result).toBeDefined();
      expect(result!.source).toBe("ide");
    });
  });

  // ── isIDEBridgeAvailable ──

  describe("isIDEBridgeAvailable", () => {
    it("should return false when bridge is not available", async () => {
      vi.doMock("../../../src/lsp/ide-bridge.js", () => ({
        getIDEBridge: vi.fn().mockReturnValue({
          isSocketAvailable: () => false,
        }),
      }));

      const { isIDEBridgeAvailable } = await import("../../../src/lsp/ide-bridge-manager.js");
      const result = await isIDEBridgeAvailable("/test/workspace");
      expect(result).toBe(false);
    });

    it("should return true when bridge socket exists", async () => {
      vi.doMock("../../../src/lsp/ide-bridge.js", () => ({
        getIDEBridge: vi.fn().mockReturnValue({
          isSocketAvailable: () => true,
        }),
      }));

      const { isIDEBridgeAvailable } = await import("../../../src/lsp/ide-bridge-manager.js");
      const result = await isIDEBridgeAvailable("/test/workspace");
      expect(result).toBe(true);
    });

    it("should return false when import fails", async () => {
      vi.doMock("../../../src/lsp/ide-bridge.js", () => {
        throw new Error("Module not found");
      });

      const { isIDEBridgeAvailable } = await import("../../../src/lsp/ide-bridge-manager.js");
      const result = await isIDEBridgeAvailable("/test/workspace");
      expect(result).toBe(false);
    });

    it("should return false when getIDEBridge returns undefined", async () => {
      vi.doMock("../../../src/lsp/ide-bridge.js", () => ({
        getIDEBridge: vi.fn().mockReturnValue(undefined),
      }));

      const { isIDEBridgeAvailable } = await import("../../../src/lsp/ide-bridge-manager.js");
      const result = await isIDEBridgeAvailable("/test/workspace");
      expect(result).toBe(false);
    });
  });

  // ── disposeAllLSP ──

  describe("disposeAllLSP", () => {
    it("should dispose both IDE bridge and LSP manager", async () => {
      const disposeCalls: string[] = [];

      vi.doMock("../../../src/lsp/ide-bridge.js", () => ({
        disposeIDEBridge: vi.fn().mockImplementation(async () => {
          disposeCalls.push("ide-bridge");
        }),
      }));
      vi.doMock("../../../src/lsp/manager.js", () => ({
        disposeLSPManager: vi.fn().mockImplementation(async () => {
          disposeCalls.push("lsp-manager");
        }),
      }));

      const { disposeAllLSP } = await import("../../../src/lsp/ide-bridge-manager.js");
      await disposeAllLSP();

      expect(disposeCalls).toContain("ide-bridge");
      expect(disposeCalls).toContain("lsp-manager");
    });

    it("should not throw if IDE bridge disposal fails", async () => {
      vi.doMock("../../../src/lsp/ide-bridge.js", () => ({
        disposeIDEBridge: vi.fn().mockRejectedValue(new Error("Bridge disposal error")),
      }));
      vi.doMock("../../../src/lsp/manager.js", () => ({
        disposeLSPManager: vi.fn().mockResolvedValue(undefined),
      }));

      const { disposeAllLSP } = await import("../../../src/lsp/ide-bridge-manager.js");
      await expect(disposeAllLSP()).resolves.not.toThrow();
    });

    it("should not throw if LSP manager disposal fails", async () => {
      vi.doMock("../../../src/lsp/ide-bridge.js", () => ({
        disposeIDEBridge: vi.fn().mockResolvedValue(undefined),
      }));
      vi.doMock("../../../src/lsp/manager.js", () => ({
        disposeLSPManager: vi.fn().mockRejectedValue(new Error("Manager disposal error")),
      }));

      const { disposeAllLSP } = await import("../../../src/lsp/ide-bridge-manager.js");
      await expect(disposeAllLSP()).resolves.not.toThrow();
    });

    it("should not throw if both disposals fail", async () => {
      vi.doMock("../../../src/lsp/ide-bridge.js", () => ({
        disposeIDEBridge: vi.fn().mockRejectedValue(new Error("Bridge error")),
      }));
      vi.doMock("../../../src/lsp/manager.js", () => ({
        disposeLSPManager: vi.fn().mockRejectedValue(new Error("Manager error")),
      }));

      const { disposeAllLSP } = await import("../../../src/lsp/ide-bridge-manager.js");
      await expect(disposeAllLSP()).resolves.not.toThrow();
    });
  });
});

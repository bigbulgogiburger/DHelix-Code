/**
 * IDE Bridge Manager — Unified LSP session acquisition
 *
 * Provides the "smart session" that prefers IDE bridge when available,
 * falling back to self-managed LSP servers seamlessly.
 *
 * Priority order:
 * 1. IDE Bridge (VS Code extension) — fastest and most accurate
 * 2. Self-managed LSP servers (Tier 2) — standalone language servers
 * 3. Returns undefined — tools should fall back to tree-sitter/grep (Tier 1)
 *
 * @example
 * ```typescript
 * import { acquireSmartSession } from "../../lsp/ide-bridge-manager.js";
 * const result = await acquireSmartSession(filePath, cwd);
 * if (result) {
 *   const { session, source } = result;
 *   // session is either from IDE or from LSP Manager — tools don't need to know
 * }
 * ```
 */

import { extname } from "node:path";

import { getLogger } from "../utils/logger.js";
import type { LSPLanguageId, LSPSession } from "./types.js";

// ── File Extension Mapping ──

/** File extension to LSP language mapping */
const EXT_TO_LANG: Readonly<Record<string, LSPLanguageId>> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "typescript",
  ".jsx": "typescript",
  ".mts": "typescript",
  ".cts": "typescript",
  ".py": "python",
  ".pyi": "python",
  ".go": "go",
  ".rs": "rust",
  ".java": "java",
};

// ── Types ──

/** Result of session acquisition with source info */
export interface SmartSessionResult {
  readonly session: LSPSession;
  readonly source: "ide" | "lsp";
}

// ── Smart Session Acquisition ──

/**
 * Acquire an LSP session using the best available provider.
 *
 * Priority:
 * 1. IDE Bridge (VS Code extension) — if socket exists and connects
 * 2. Self-managed LSP server (Tier 2) — if server is installed
 * 3. Returns undefined — tools should fall back to tree-sitter/grep
 *
 * @param filePath - File to get LSP session for
 * @param cwd - Working directory (project root)
 * @returns SmartSessionResult with session and source, or undefined
 */
export async function acquireSmartSession(
  filePath: string,
  cwd: string,
): Promise<SmartSessionResult | undefined> {
  const log = getLogger();
  const ext = extname(filePath);
  const lang = EXT_TO_LANG[ext];

  if (!lang) {
    log.debug({ ext }, "IDE Bridge Manager: unsupported file extension");
    return undefined;
  }

  // 1. Try IDE Bridge first (fastest, most accurate)
  const ideResult = await tryIDEBridge(lang, cwd, log);
  if (ideResult) {
    return ideResult;
  }

  // 2. Fall back to self-managed LSP server
  const lspResult = await tryLSPManager(lang, cwd, log);
  if (lspResult) {
    return lspResult;
  }

  // 3. No LSP available — caller should fall back to tree-sitter/grep
  log.debug({ lang, filePath }, "IDE Bridge Manager: no LSP session available");
  return undefined;
}

// ── Internal Helpers ──

/**
 * Attempt to acquire a session from the IDE Bridge.
 */
async function tryIDEBridge(
  lang: LSPLanguageId,
  cwd: string,
  log: ReturnType<typeof getLogger>,
): Promise<SmartSessionResult | undefined> {
  try {
    const { tryConnectIDEBridge } = await import("./ide-bridge.js");
    const bridge = await tryConnectIDEBridge(cwd);

    if (bridge?.isConnected) {
      const session = bridge.createSession(lang);
      log.debug({ lang, source: "ide" }, "IDE Bridge Manager: using IDE session");
      return { session, source: "ide" };
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    log.debug({ error: message }, "IDE Bridge Manager: IDE bridge unavailable");
  }
  return undefined;
}

/**
 * Attempt to acquire a session from the self-managed LSP server.
 */
async function tryLSPManager(
  lang: LSPLanguageId,
  cwd: string,
  log: ReturnType<typeof getLogger>,
): Promise<SmartSessionResult | undefined> {
  try {
    const { getLSPManager } = await import("./manager.js");
    const manager = getLSPManager();
    const available = await manager.detectAvailableServers(cwd);

    if (available.includes(lang)) {
      const session = await manager.acquire(lang, cwd);
      log.debug({ lang, source: "lsp" }, "IDE Bridge Manager: using LSP session");
      return { session, source: "lsp" };
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    log.debug({ error: message }, "IDE Bridge Manager: LSP server unavailable");
  }
  return undefined;
}

// ── Status Check ──

/**
 * Check if IDE bridge is available for the given workspace.
 * Quick check without actually connecting — useful for status display.
 *
 * Uses dynamic import to avoid circular dependencies and does not
 * create the singleton client if it doesn't already exist.
 */
export async function isIDEBridgeAvailable(
  workspacePath: string,
): Promise<boolean> {
  try {
    const { getIDEBridge } = await import("./ide-bridge.js");
    const bridge = getIDEBridge(workspacePath);
    return bridge?.isSocketAvailable() ?? false;
  } catch {
    return false;
  }
}

// ── Utility ──

/**
 * Get the file extension to language mapping (for tool metadata).
 */
export function getExtToLangMap(): Readonly<Record<string, LSPLanguageId>> {
  return EXT_TO_LANG;
}

// ── Disposal ──

/**
 * Dispose all LSP resources (both IDE bridge and self-managed servers).
 * Call this on session end.
 */
export async function disposeAllLSP(): Promise<void> {
  const log = getLogger();

  const results = await Promise.allSettled([
    import("./ide-bridge.js").then((m) => m.disposeIDEBridge()),
    import("./manager.js").then((m) => m.disposeLSPManager()),
  ]);

  for (const result of results) {
    if (result.status === "rejected") {
      log.warn({ error: String(result.reason) }, "LSP disposal error");
    }
  }

  log.info("All LSP resources disposed");
}

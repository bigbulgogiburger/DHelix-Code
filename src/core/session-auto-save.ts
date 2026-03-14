/**
 * Session Auto-Save — periodically updates session metadata to ensure
 * lastUsedAt stays current even if the process exits unexpectedly.
 *
 * The SessionManager already persists messages on every appendMessage() call,
 * so this module focuses on keeping metadata fresh as a heartbeat signal.
 */
import type { SessionManager } from "./session-manager.js";

/** Default auto-save interval: 30 seconds */
const DEFAULT_INTERVAL_MS = 30_000;

export interface AutoSaveHandle {
  /** Stop the auto-save timer */
  readonly stop: () => void;
}

/**
 * Set up periodic session metadata refresh.
 *
 * The timer is unref'd so it does not prevent Node.js from exiting naturally.
 * Errors during save are silently swallowed to avoid crashing the application.
 */
export function setupAutoSave(
  sessionManager: SessionManager,
  sessionId: string,
  intervalMs: number = DEFAULT_INTERVAL_MS,
): AutoSaveHandle {
  const timer = setInterval(() => {
    sessionManager
      .getMetadata(sessionId)
      .then(async (meta) => {
        // Touch the session by renaming to same name — updates lastUsedAt
        await sessionManager.renameSession(sessionId, meta.name);
      })
      .catch(() => {
        // Auto-save failures are non-fatal — silently ignore
      });
  }, intervalMs);

  // Don't prevent process exit
  timer.unref();

  return {
    stop: () => clearInterval(timer),
  };
}

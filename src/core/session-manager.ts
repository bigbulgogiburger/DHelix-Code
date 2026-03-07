import { mkdir, readFile, writeFile, readdir, stat, rename } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { type ChatMessage } from "../llm/provider.js";
import { SESSIONS_DIR } from "../constants.js";
import { BaseError } from "../utils/error.js";

/** Default lock acquisition timeout (ms) */
const LOCK_TIMEOUT_MS = 5000;

/** Retry interval for lock acquisition (ms) */
const LOCK_RETRY_MS = 50;

/** Stale lock threshold — if a lock is older than this, it is considered stale (ms) */
const STALE_LOCK_MS = 30_000;

/**
 * Write file content atomically using write-to-temp + rename.
 * rename() is atomic on the same filesystem on both macOS and Windows.
 */
export async function atomicWrite(filePath: string, content: string): Promise<void> {
  const tmpPath = `${filePath}.tmp.${process.pid}.${Date.now()}`;
  try {
    await writeFile(tmpPath, content, "utf-8");
    await rename(tmpPath, filePath);
  } catch (err) {
    // Clean up temp file on failure
    try {
      const { unlink } = await import("node:fs/promises");
      await unlink(tmpPath);
    } catch {
      // Ignore cleanup errors
    }
    throw err;
  }
}

/**
 * Execute a function while holding a directory-based file lock.
 * Uses mkdir() which is atomic on all platforms.
 * Includes stale lock detection for crash recovery.
 */
export async function withFileLock<T>(
  lockDir: string,
  fn: () => Promise<T>,
  timeoutMs: number = LOCK_TIMEOUT_MS,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  const pidFile = join(lockDir, "pid");

  while (true) {
    try {
      await mkdir(lockDir, { recursive: false });
      // Write PID for stale lock detection
      try {
        await writeFile(pidFile, `${process.pid}\n${Date.now()}`, "utf-8");
      } catch {
        // Non-critical — lock is still held
      }
      try {
        return await fn();
      } finally {
        try {
          const { rm } = await import("node:fs/promises");
          await rm(lockDir, { recursive: true, force: true });
        } catch {
          // Ignore cleanup errors
        }
      }
    } catch (err: unknown) {
      const error = err as NodeJS.ErrnoException;
      if (error.code !== "EEXIST") {
        throw err;
      }

      // Check for stale lock
      try {
        const pidContent = await readFile(pidFile, "utf-8");
        const [, timestampStr] = pidContent.split("\n");
        const lockTime = parseInt(timestampStr, 10);
        if (!isNaN(lockTime) && Date.now() - lockTime > STALE_LOCK_MS) {
          // Stale lock — remove and retry immediately
          try {
            const { rm } = await import("node:fs/promises");
            await rm(lockDir, { recursive: true, force: true });
          } catch {
            // Another process may have cleaned it up
          }
          continue;
        }
      } catch {
        // Can't read PID file — check directory age via stat
        try {
          const lockStat = await stat(lockDir);
          if (Date.now() - lockStat.mtimeMs > STALE_LOCK_MS) {
            try {
              const { rm } = await import("node:fs/promises");
              await rm(lockDir, { recursive: true, force: true });
            } catch {
              // Another process may have cleaned it up
            }
            continue;
          }
        } catch {
          // Lock dir gone — retry
          continue;
        }
      }

      if (Date.now() > deadline) {
        throw new SessionError("Lock acquisition timeout", { lockDir, timeoutMs });
      }
      await new Promise((r) => setTimeout(r, LOCK_RETRY_MS));
    }
  }
}

/** Session management error */
export class SessionError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "SESSION_ERROR", context);
  }
}

/** Session metadata stored in metadata.json */
export interface SessionMetadata {
  readonly id: string;
  readonly name: string;
  readonly createdAt: string;
  readonly lastUsedAt: string;
  readonly workingDirectory: string;
  readonly model: string;
  readonly messageCount: number;
}

/** Session index entry (lightweight reference in index.json) */
export interface SessionIndexEntry {
  readonly id: string;
  readonly name: string;
  readonly createdAt: string;
  readonly lastUsedAt: string;
  readonly messageCount: number;
}

/** JSONL line representing a single message */
interface JsonlMessage {
  readonly role: string;
  readonly content: string;
  readonly timestamp: string;
  readonly toolCallId?: string;
  readonly toolCalls?: readonly { id: string; name: string; arguments: string }[];
}

/**
 * Generate an auto-name for a session from the first user message.
 * Truncates to 50 characters.
 */
function generateSessionName(firstUserMessage: string): string {
  const cleaned = firstUserMessage.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
  if (cleaned.length <= 50) {
    return cleaned;
  }
  return cleaned.slice(0, 47) + "...";
}

/**
 * Session manager — handles save/restore of conversation sessions in JSONL format.
 *
 * Directory structure:
 * ```
 * ~/.dbcode/sessions/
 * ├── index.json               # Session list
 * ├── {session-id}/
 * │   ├── transcript.jsonl     # Messages (one per line)
 * │   └── metadata.json        # Session metadata
 * ```
 */
export class SessionManager {
  private readonly sessionsDir: string;

  constructor(sessionsDir?: string) {
    this.sessionsDir = sessionsDir ?? SESSIONS_DIR;
  }

  /** Ensure the sessions directory exists */
  private async ensureDir(): Promise<void> {
    await mkdir(this.sessionsDir, { recursive: true });
  }

  /** Get the lock directory for a session */
  private sessionLockDir(sessionId: string): string {
    return join(this.sessionDir(sessionId), ".lock");
  }

  /** Get the lock directory for the index file */
  private indexLockDir(): string {
    return join(this.sessionsDir, ".index.lock");
  }

  /** Get the directory path for a session */
  private sessionDir(sessionId: string): string {
    return join(this.sessionsDir, sessionId);
  }

  /** Get the transcript file path for a session */
  private transcriptPath(sessionId: string): string {
    return join(this.sessionDir(sessionId), "transcript.jsonl");
  }

  /** Get the metadata file path for a session */
  private metadataPath(sessionId: string): string {
    return join(this.sessionDir(sessionId), "metadata.json");
  }

  /** Get the index file path */
  private indexPath(): string {
    return join(this.sessionsDir, "index.json");
  }

  /**
   * Create a new session. Returns the session ID.
   */
  async createSession(options: {
    readonly workingDirectory: string;
    readonly model: string;
    readonly name?: string;
  }): Promise<string> {
    await this.ensureDir();
    const id = randomUUID();
    const now = new Date().toISOString();

    const metadata: SessionMetadata = {
      id,
      name: options.name ?? "New session",
      createdAt: now,
      lastUsedAt: now,
      workingDirectory: options.workingDirectory,
      model: options.model,
      messageCount: 0,
    };

    const dir = this.sessionDir(id);
    await mkdir(dir, { recursive: true });
    await atomicWrite(this.metadataPath(id), JSON.stringify(metadata, null, 2));
    await writeFile(this.transcriptPath(id), "", "utf-8");

    await this.updateIndex(id, metadata);

    return id;
  }

  /**
   * Append a message to the session transcript (JSONL format).
   * Also updates session metadata (lastUsedAt, messageCount).
   */
  async appendMessage(sessionId: string, message: ChatMessage): Promise<void> {
    const jsonlLine: JsonlMessage = {
      role: message.role,
      content: message.content,
      timestamp: new Date().toISOString(),
      toolCallId: message.toolCallId,
      toolCalls: message.toolCalls,
    };

    const line = JSON.stringify(jsonlLine) + "\n";

    await withFileLock(this.sessionLockDir(sessionId), async () => {
      const transcriptFile = this.transcriptPath(sessionId);
      const existing = await this.safeReadFile(transcriptFile);
      await atomicWrite(transcriptFile, existing + line);

      await this.updateMetadataUnsafe(sessionId, (meta) => ({
        ...meta,
        lastUsedAt: new Date().toISOString(),
        messageCount: meta.messageCount + 1,
      }));
    });
  }

  /**
   * Append multiple messages at once (batch write).
   */
  async appendMessages(sessionId: string, messages: readonly ChatMessage[]): Promise<void> {
    if (messages.length === 0) return;

    const lines = messages.map((message) => {
      const jsonlLine: JsonlMessage = {
        role: message.role,
        content: message.content,
        timestamp: new Date().toISOString(),
        toolCallId: message.toolCallId,
        toolCalls: message.toolCalls,
      };
      return JSON.stringify(jsonlLine);
    });

    await withFileLock(this.sessionLockDir(sessionId), async () => {
      const transcriptFile = this.transcriptPath(sessionId);
      const existing = await this.safeReadFile(transcriptFile);
      await atomicWrite(transcriptFile, existing + lines.join("\n") + "\n");

      await this.updateMetadataUnsafe(sessionId, (meta) => ({
        ...meta,
        lastUsedAt: new Date().toISOString(),
        messageCount: meta.messageCount + messages.length,
      }));
    });
  }

  /**
   * Load all messages from a session transcript.
   */
  async loadMessages(sessionId: string): Promise<readonly ChatMessage[]> {
    const transcriptFile = this.transcriptPath(sessionId);
    const content = await this.safeReadFile(transcriptFile);

    if (!content.trim()) {
      return [];
    }

    const messages: ChatMessage[] = [];
    const lines = content.trim().split("\n");

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line) as JsonlMessage;
        const msg: ChatMessage = {
          role: parsed.role as ChatMessage["role"],
          content: parsed.content,
          toolCallId: parsed.toolCallId,
          toolCalls: parsed.toolCalls,
        };
        messages.push(msg);
      } catch {
        throw new SessionError("Failed to parse session transcript line", {
          sessionId,
          line,
        });
      }
    }

    return messages;
  }

  /**
   * Get metadata for a session.
   */
  async getMetadata(sessionId: string): Promise<SessionMetadata> {
    const metaFile = this.metadataPath(sessionId);
    try {
      const content = await readFile(metaFile, "utf-8");
      return JSON.parse(content) as SessionMetadata;
    } catch {
      throw new SessionError("Session not found", { sessionId });
    }
  }

  /**
   * List all sessions, sorted by lastUsedAt (most recent first).
   */
  async listSessions(): Promise<readonly SessionIndexEntry[]> {
    const indexFile = this.indexPath();
    try {
      const content = await readFile(indexFile, "utf-8");
      const entries = JSON.parse(content) as SessionIndexEntry[];
      return [...entries].sort(
        (a, b) => new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime(),
      );
    } catch {
      return [];
    }
  }

  /**
   * Get the most recent session ID, or null if none exists.
   */
  async getMostRecentSessionId(): Promise<string | null> {
    const sessions = await this.listSessions();
    return sessions.length > 0 ? sessions[0].id : null;
  }

  /**
   * Rename a session.
   */
  async renameSession(sessionId: string, name: string): Promise<void> {
    await withFileLock(this.sessionLockDir(sessionId), async () => {
      await this.updateMetadataUnsafe(sessionId, (meta) => ({
        ...meta,
        name,
      }));
    });
  }

  /**
   * Auto-name a session from the first user message.
   */
  async autoNameSession(sessionId: string, firstUserMessage: string): Promise<void> {
    const name = generateSessionName(firstUserMessage);
    await this.renameSession(sessionId, name);
  }

  /**
   * Fork a session — creates a new session with a copy of the transcript up to now.
   * Returns the new session ID.
   */
  async forkSession(
    sourceSessionId: string,
    options?: { readonly name?: string },
  ): Promise<string> {
    const sourceMeta = await this.getMetadata(sourceSessionId);
    const sourceTranscript = await this.safeReadFile(this.transcriptPath(sourceSessionId));

    const id = randomUUID();
    const now = new Date().toISOString();
    const name = options?.name ?? `Fork of ${sourceMeta.name}`;

    const metadata: SessionMetadata = {
      id,
      name,
      createdAt: now,
      lastUsedAt: now,
      workingDirectory: sourceMeta.workingDirectory,
      model: sourceMeta.model,
      messageCount: sourceMeta.messageCount,
    };

    const dir = this.sessionDir(id);
    await mkdir(dir, { recursive: true });
    await atomicWrite(this.metadataPath(id), JSON.stringify(metadata, null, 2));
    await atomicWrite(this.transcriptPath(id), sourceTranscript);
    await this.updateIndex(id, metadata);

    return id;
  }

  /**
   * Delete a session and its files.
   */
  async deleteSession(sessionId: string): Promise<void> {
    const dir = this.sessionDir(sessionId);

    // Remove files in session directory
    try {
      const files = await readdir(dir);
      for (const file of files) {
        const filePath = join(dir, file);
        const fileStat = await stat(filePath);
        if (fileStat.isFile()) {
          await writeFile(filePath, "", "utf-8"); // Clear before remove
        }
      }
      // Use rm with recursive to remove the directory
      const { rm } = await import("node:fs/promises");
      await rm(dir, { recursive: true, force: true });
    } catch {
      throw new SessionError("Failed to delete session", { sessionId });
    }

    // Remove from index
    await this.removeFromIndex(sessionId);
  }

  /** Read a file safely (returns empty string if not found) */
  private async safeReadFile(filePath: string): Promise<string> {
    try {
      return await readFile(filePath, "utf-8");
    } catch {
      return "";
    }
  }

  /**
   * Update session metadata using an updater function (without acquiring session lock).
   * Must be called from within a session lock context.
   */
  private async updateMetadataUnsafe(
    sessionId: string,
    updater: (meta: SessionMetadata) => SessionMetadata,
  ): Promise<void> {
    const meta = await this.getMetadata(sessionId);
    const updated = updater(meta);
    await atomicWrite(this.metadataPath(sessionId), JSON.stringify(updated, null, 2));
    await this.updateIndex(sessionId, updated);
  }

  /** Update the session index with an entry (acquires index lock) */
  private async updateIndex(sessionId: string, metadata: SessionMetadata): Promise<void> {
    await withFileLock(this.indexLockDir(), async () => {
      const entries = await this.loadIndex();
      const entry: SessionIndexEntry = {
        id: sessionId,
        name: metadata.name,
        createdAt: metadata.createdAt,
        lastUsedAt: metadata.lastUsedAt,
        messageCount: metadata.messageCount,
      };

      const existingIdx = entries.findIndex((e) => e.id === sessionId);
      const updated =
        existingIdx >= 0
          ? entries.map((e, i) => (i === existingIdx ? entry : e))
          : [...entries, entry];

      await atomicWrite(this.indexPath(), JSON.stringify(updated, null, 2));
    });
  }

  /** Remove a session from the index (acquires index lock) */
  private async removeFromIndex(sessionId: string): Promise<void> {
    await withFileLock(this.indexLockDir(), async () => {
      const entries = await this.loadIndex();
      const filtered = entries.filter((e) => e.id !== sessionId);
      await atomicWrite(this.indexPath(), JSON.stringify(filtered, null, 2));
    });
  }

  /** Load the session index */
  private async loadIndex(): Promise<SessionIndexEntry[]> {
    try {
      const content = await readFile(this.indexPath(), "utf-8");
      return JSON.parse(content) as SessionIndexEntry[];
    } catch {
      return [];
    }
  }
}

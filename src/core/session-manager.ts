import { mkdir, readFile, writeFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { type ChatMessage } from "../llm/provider.js";
import { SESSIONS_DIR } from "../constants.js";
import { BaseError } from "../utils/error.js";

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
    await writeFile(this.metadataPath(id), JSON.stringify(metadata, null, 2), "utf-8");
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
    const transcriptFile = this.transcriptPath(sessionId);

    // Append to transcript
    const existing = await this.safeReadFile(transcriptFile);
    await writeFile(transcriptFile, existing + line, "utf-8");

    // Update metadata
    await this.updateMetadata(sessionId, (meta) => ({
      ...meta,
      lastUsedAt: new Date().toISOString(),
      messageCount: meta.messageCount + 1,
    }));
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

    const transcriptFile = this.transcriptPath(sessionId);
    const existing = await this.safeReadFile(transcriptFile);
    await writeFile(transcriptFile, existing + lines.join("\n") + "\n", "utf-8");

    await this.updateMetadata(sessionId, (meta) => ({
      ...meta,
      lastUsedAt: new Date().toISOString(),
      messageCount: meta.messageCount + messages.length,
    }));
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
    await this.updateMetadata(sessionId, (meta) => ({
      ...meta,
      name,
    }));
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
    await writeFile(this.metadataPath(id), JSON.stringify(metadata, null, 2), "utf-8");
    await writeFile(this.transcriptPath(id), sourceTranscript, "utf-8");
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

  /** Update session metadata using an updater function */
  private async updateMetadata(
    sessionId: string,
    updater: (meta: SessionMetadata) => SessionMetadata,
  ): Promise<void> {
    const meta = await this.getMetadata(sessionId);
    const updated = updater(meta);
    await writeFile(this.metadataPath(sessionId), JSON.stringify(updated, null, 2), "utf-8");
    await this.updateIndex(sessionId, updated);
  }

  /** Update the session index with an entry */
  private async updateIndex(sessionId: string, metadata: SessionMetadata): Promise<void> {
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

    await writeFile(this.indexPath(), JSON.stringify(updated, null, 2), "utf-8");
  }

  /** Remove a session from the index */
  private async removeFromIndex(sessionId: string): Promise<void> {
    const entries = await this.loadIndex();
    const filtered = entries.filter((e) => e.id !== sessionId);
    await writeFile(this.indexPath(), JSON.stringify(filtered, null, 2), "utf-8");
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

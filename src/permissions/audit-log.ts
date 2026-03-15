import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";

export interface AuditEntry {
  readonly timestamp: string;
  readonly sessionId: string;
  readonly toolName: string;
  readonly decision: "approved" | "denied" | "auto-approved";
  readonly reason?: string;
}

/**
 * Append-only JSONL audit log for permission decisions.
 *
 * Each entry is written as a single JSON line to the log file,
 * ensuring atomicity and easy parsing. The file is created
 * automatically if it doesn't exist.
 *
 * Default log path: ~/.dbcode/audit.jsonl
 */
export class AuditLogger {
  private readonly logPath: string;
  private initialized: boolean = false;

  constructor(logPath: string) {
    this.logPath = logPath;
  }

  /**
   * Ensure the log directory exists.
   * Called lazily on first write to avoid unnecessary fs operations.
   */
  private async ensureDirectory(): Promise<void> {
    if (!this.initialized) {
      await mkdir(dirname(this.logPath), { recursive: true });
      this.initialized = true;
    }
  }

  /**
   * Append a single audit entry to the JSONL log file.
   *
   * Each entry is serialized as a single JSON line followed by a newline.
   * The write is atomic at the OS level for lines under the pipe buffer size.
   */
  async log(entry: AuditEntry): Promise<void> {
    await this.ensureDirectory();

    const line = JSON.stringify(entry) + "\n";
    await appendFile(this.logPath, line, { encoding: "utf-8" });
  }

  /**
   * Read the most recent audit entries from the log file.
   *
   * @param count - Maximum number of entries to return (default: 50).
   *   Returns the last N entries in chronological order.
   * @returns Array of parsed audit entries, or empty array if log doesn't exist.
   */
  async getRecentEntries(count: number = 50): Promise<readonly AuditEntry[]> {
    try {
      const content = await readFile(this.logPath, { encoding: "utf-8" });
      const lines = content
        .split("\n")
        .filter((line) => line.trim().length > 0);

      const entries: AuditEntry[] = [];
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line) as AuditEntry;
          entries.push(parsed);
        } catch {
          // Skip malformed lines — defensive against corrupted log
        }
      }

      // Return the last `count` entries in chronological order
      if (entries.length > count) {
        return entries.slice(-count);
      }

      return entries;
    } catch {
      // File doesn't exist or can't be read — return empty
      return [];
    }
  }
}

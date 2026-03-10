import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { z } from "zod";
import { BaseError } from "../utils/error.js";

/**
 * Error thrown when persistent permission store operations fail.
 */
export class PersistentStoreError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "PERSISTENT_STORE_ERROR", context);
  }
}

/**
 * Schema for the permissions section inside settings.json.
 */
const settingsPermissionsSchema = z.object({
  allow: z.array(z.string()).default([]),
  deny: z.array(z.string()).default([]),
});

/**
 * Schema for the minimal settings.json shape we care about.
 * We preserve all other fields when writing back.
 */
const settingsFileSchema = z
  .object({
    permissions: settingsPermissionsSchema.default({}),
  })
  .passthrough();

/** Persistent permission rule type */
export type PersistentRuleKind = "allow" | "deny";

/** Persistent permission rules */
export interface PersistentPermissionRules {
  readonly allow: readonly string[];
  readonly deny: readonly string[];
}

/**
 * Persistent permission store — reads and writes permission rules
 * from ~/.dbcode/settings.json.
 */
export class PersistentPermissionStore {
  private readonly settingsPath: string;

  constructor(settingsPath: string) {
    this.settingsPath = settingsPath;
  }

  /**
   * Load persistent permission rules from settings.json.
   * Returns empty arrays if the file doesn't exist or has no permissions section.
   */
  async loadRules(): Promise<PersistentPermissionRules> {
    const raw = await this.readSettingsFile();
    const parsed = settingsFileSchema.safeParse(raw);
    if (!parsed.success) {
      return { allow: [], deny: [] };
    }
    return {
      allow: Object.freeze([...parsed.data.permissions.allow]),
      deny: Object.freeze([...parsed.data.permissions.deny]),
    };
  }

  /**
   * Add an allow rule pattern. Deduplicates.
   */
  async addAllowRule(pattern: string): Promise<void> {
    await this.addRule("allow", pattern);
  }

  /**
   * Add a deny rule pattern. Deduplicates.
   */
  async addDenyRule(pattern: string): Promise<void> {
    await this.addRule("deny", pattern);
  }

  /**
   * Remove a rule pattern from either allow or deny lists.
   * Returns true if the rule was found and removed.
   */
  async removeRule(pattern: string): Promise<boolean> {
    const settings = await this.readSettingsFile();
    const parsed = settingsFileSchema.safeParse(settings);
    if (!parsed.success) {
      return false;
    }

    const allow = parsed.data.permissions.allow.filter((r: string) => r !== pattern);
    const deny = parsed.data.permissions.deny.filter((r: string) => r !== pattern);

    const removedFromAllow =
      allow.length !== parsed.data.permissions.allow.length;
    const removedFromDeny =
      deny.length !== parsed.data.permissions.deny.length;

    if (!removedFromAllow && !removedFromDeny) {
      return false;
    }

    await this.writeSettingsFile({
      ...parsed.data,
      permissions: { allow, deny },
    });
    return true;
  }

  /**
   * Get all rules from both allow and deny lists.
   */
  async getAllRules(): Promise<PersistentPermissionRules> {
    return this.loadRules();
  }

  /** Internal: add a rule to the specified list */
  private async addRule(kind: PersistentRuleKind, pattern: string): Promise<void> {
    const settings = await this.readSettingsFile();
    const parsed = settingsFileSchema.safeParse(settings);

    const current = parsed.success
      ? parsed.data
      : { permissions: { allow: [], deny: [] } };

    const list = [...current.permissions[kind]];
    if (!list.includes(pattern)) {
      list.push(pattern);
    }

    const updatedPermissions = {
      ...current.permissions,
      [kind]: list,
    };

    await this.writeSettingsFile({
      ...current,
      permissions: updatedPermissions,
    });
  }

  /** Read settings.json, returning an empty object if not found or invalid JSON */
  private async readSettingsFile(): Promise<unknown> {
    try {
      const content = await readFile(this.settingsPath, "utf-8");
      return JSON.parse(content) as unknown;
    } catch (error: unknown) {
      if (isNodeError(error) && error.code === "ENOENT") {
        return {};
      }
      if (error instanceof SyntaxError) {
        return {};
      }
      throw new PersistentStoreError("Failed to read settings file", {
        path: this.settingsPath,
        cause: String(error),
      });
    }
  }

  /** Write settings back to disk, preserving unknown fields */
  private async writeSettingsFile(data: Record<string, unknown>): Promise<void> {
    try {
      await mkdir(dirname(this.settingsPath), { recursive: true });
      const content = JSON.stringify(data, null, 2) + "\n";
      await writeFile(this.settingsPath, content, "utf-8");
    } catch (error: unknown) {
      throw new PersistentStoreError("Failed to write settings file", {
        path: this.settingsPath,
        cause: String(error),
      });
    }
  }
}

/** Type guard for Node.js error with code property */
function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

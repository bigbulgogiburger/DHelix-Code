import { readFile, writeFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { joinPath, dirName } from "../utils/path.js";
import { PROJECT_CONFIG_DIR } from "../constants.js";
import { parseRuleString, formatRuleString, matchToolArgs } from "./wildcard.js";

/** A persistent permission rule loaded from settings.json */
export interface PersistentPermissionRule {
  readonly tool: string;
  readonly pattern?: string;
  readonly type: "allow" | "deny";
  readonly scope: "project" | "user";
}

/** Permissions section shape inside settings.json */
interface PermissionsConfig {
  readonly allow: readonly string[];
  readonly deny: readonly string[];
}

/**
 * Resolve the settings.json path for a given scope.
 *   - project → {projectDir}/.dbcode/settings.json
 *   - user   → ~/.dbcode/settings.json
 */
function settingsPath(scope: "project" | "user", projectDir: string): string {
  if (scope === "user") {
    return joinPath(homedir(), `.dbcode`, "settings.json");
  }
  return joinPath(projectDir, PROJECT_CONFIG_DIR, "settings.json");
}

/**
 * Safely read and parse a JSON settings file.
 * Returns an empty object if the file does not exist or is unparseable.
 */
async function readSettingsFile(filePath: string): Promise<Record<string, unknown>> {
  try {
    const raw = await readFile(filePath, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

/**
 * Write a settings object to disk, creating parent directories as needed.
 * Deep merges into the existing file so other settings.json properties are preserved.
 */
async function writeSettingsFile(filePath: string, update: Record<string, unknown>): Promise<void> {
  const existing = await readSettingsFile(filePath);
  const merged = { ...existing, ...update };

  await mkdir(dirName(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(merged, null, 2) + "\n", "utf-8");
}

/**
 * Extract the permissions section from a raw settings object.
 */
function extractPermissions(settings: Record<string, unknown>): PermissionsConfig {
  const perms = settings["permissions"];
  if (perms === null || typeof perms !== "object" || Array.isArray(perms)) {
    return { allow: [], deny: [] };
  }

  const obj = perms as Record<string, unknown>;

  const allow = Array.isArray(obj["allow"])
    ? (obj["allow"] as unknown[]).filter((v): v is string => typeof v === "string")
    : [];

  const deny = Array.isArray(obj["deny"])
    ? (obj["deny"] as unknown[]).filter((v): v is string => typeof v === "string")
    : [];

  return { allow, deny };
}

/**
 * Convert raw rule strings from a settings file into structured rules.
 */
function parseRules(
  ruleStrings: readonly string[],
  type: "allow" | "deny",
  scope: "project" | "user",
): readonly PersistentPermissionRule[] {
  return ruleStrings.map((raw) => {
    const { tool, pattern } = parseRuleString(raw);
    return Object.freeze({ tool, pattern, type, scope });
  });
}

/**
 * Persistent permission store — reads and writes permission rules
 * to settings.json files at project and user scope.
 *
 * Settings.json format:
 * ```json
 * {
 *   "permissions": {
 *     "allow": ["file_read", "Bash(npm *)"],
 *     "deny": ["Bash(rm -rf *)"]
 *   }
 * }
 * ```
 *
 * Priority: deny rules ALWAYS take precedence over allow rules.
 * Project-scope rules override user-scope rules for the same tool+pattern.
 */
export interface PersistentPermissionStore {
  /** Load rules from both project and user settings */
  loadRules(): Promise<readonly PersistentPermissionRule[]>;

  /** Add a new rule */
  addRule(rule: Omit<PersistentPermissionRule, "scope">, scope: "project" | "user"): Promise<void>;

  /** Remove a rule */
  removeRule(tool: string, pattern?: string, scope?: "project" | "user"): Promise<void>;

  /** Get all rules for a specific tool */
  getRulesForTool(tool: string): Promise<readonly PersistentPermissionRule[]>;

  /**
   * Check if an action is allowed/denied by persistent rules.
   * Returns 'allow' | 'deny' | 'none' (no matching rule).
   */
  checkPermission(tool: string, args?: Record<string, unknown>): Promise<"allow" | "deny" | "none">;

  /** Clear all rules for a scope */
  clearRules(scope: "project" | "user"): Promise<void>;
}

/**
 * Create a persistent permission store for the given project directory.
 */
export function createPersistentPermissionStore(projectDir: string): PersistentPermissionStore {
  /**
   * Load rules from a single settings file.
   */
  async function loadFromScope(
    scope: "project" | "user",
  ): Promise<readonly PersistentPermissionRule[]> {
    const filePath = settingsPath(scope, projectDir);
    const settings = await readSettingsFile(filePath);
    const perms = extractPermissions(settings);

    return [...parseRules(perms.allow, "allow", scope), ...parseRules(perms.deny, "deny", scope)];
  }

  /**
   * Build a deduplication key for a rule (used for project-overrides-user merging).
   */
  function ruleKey(rule: PersistentPermissionRule): string {
    return formatRuleString(rule.tool, rule.pattern) + ":" + rule.type;
  }

  /**
   * Load and merge rules from both scopes.
   * Project rules override user rules for the same tool+pattern+type.
   */
  async function loadRules(): Promise<readonly PersistentPermissionRule[]> {
    const [userRules, projectRules] = await Promise.all([
      loadFromScope("user"),
      loadFromScope("project"),
    ]);

    // Project rules take precedence: build a set of project rule keys
    const projectKeys = new Set(projectRules.map(ruleKey));

    // Keep user rules that don't conflict with project rules
    const filteredUserRules = userRules.filter((r) => !projectKeys.has(ruleKey(r)));

    return Object.freeze([...projectRules, ...filteredUserRules]);
  }

  /**
   * Append a rule string to a scope's settings.json.
   */
  async function addRule(
    rule: Omit<PersistentPermissionRule, "scope">,
    scope: "project" | "user",
  ): Promise<void> {
    const filePath = settingsPath(scope, projectDir);
    const settings = await readSettingsFile(filePath);
    const perms = extractPermissions(settings);
    const ruleStr = formatRuleString(rule.tool, rule.pattern);

    const listKey = rule.type === "allow" ? "allow" : "deny";
    const currentList = [...perms[listKey]];

    // Avoid duplicates
    if (!currentList.includes(ruleStr)) {
      currentList.push(ruleStr);
    }

    const updatedPermissions: PermissionsConfig = {
      ...perms,
      [listKey]: currentList,
    };

    await writeSettingsFile(filePath, {
      ...settings,
      permissions: updatedPermissions,
    });
  }

  /**
   * Remove matching rule(s) from settings.json.
   * If scope is undefined, removes from both scopes.
   */
  async function removeRule(
    tool: string,
    pattern?: string,
    scope?: "project" | "user",
  ): Promise<void> {
    const scopes: ReadonlyArray<"project" | "user"> =
      scope !== undefined ? [scope] : ["project", "user"];

    const ruleStr = formatRuleString(tool, pattern);

    await Promise.all(
      scopes.map(async (s) => {
        const filePath = settingsPath(s, projectDir);
        const settings = await readSettingsFile(filePath);
        const perms = extractPermissions(settings);

        const updatedPermissions: PermissionsConfig = {
          allow: perms.allow.filter((r) => r !== ruleStr),
          deny: perms.deny.filter((r) => r !== ruleStr),
        };

        await writeSettingsFile(filePath, {
          ...settings,
          permissions: updatedPermissions,
        });
      }),
    );
  }

  /**
   * Get all rules that apply to a specific tool.
   */
  async function getRulesForTool(tool: string): Promise<readonly PersistentPermissionRule[]> {
    const allRules = await loadRules();
    return allRules.filter((r) => r.tool === tool);
  }

  /**
   * Check whether an action is allowed, denied, or has no matching rule.
   * Deny rules always take precedence over allow rules.
   */
  async function checkPermission(
    tool: string,
    args?: Record<string, unknown>,
  ): Promise<"allow" | "deny" | "none"> {
    const allRules = await loadRules();

    // Separate deny and allow rules for this tool
    const toolRules = allRules.filter((r) => r.tool === tool);

    if (toolRules.length === 0) {
      return "none";
    }

    // Check deny rules first (deny always wins)
    const denyRules = toolRules.filter((r) => r.type === "deny");
    for (const rule of denyRules) {
      if (rule.pattern === undefined) {
        return "deny";
      }
      if (matchToolArgs(tool, rule.pattern, args)) {
        return "deny";
      }
    }

    // Check allow rules
    const allowRules = toolRules.filter((r) => r.type === "allow");
    for (const rule of allowRules) {
      if (rule.pattern === undefined) {
        return "allow";
      }
      if (matchToolArgs(tool, rule.pattern, args)) {
        return "allow";
      }
    }

    return "none";
  }

  /**
   * Clear all permission rules for a given scope.
   */
  async function clearRules(scope: "project" | "user"): Promise<void> {
    const filePath = settingsPath(scope, projectDir);
    const settings = await readSettingsFile(filePath);

    await writeSettingsFile(filePath, {
      ...settings,
      permissions: { allow: [], deny: [] },
    });
  }

  return Object.freeze({
    loadRules,
    addRule,
    removeRule,
    getRulesForTool,
    checkPermission,
    clearRules,
  });
}

import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { type MCPServerConfig } from "./types.js";
import { BaseError } from "../utils/error.js";

/**
 * Error thrown for managed MCP config operations.
 */
export class MCPManagedConfigError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "MCP_MANAGED_CONFIG_ERROR", context);
  }
}

/** Zod schema for a single managed server entry */
const managedServerSchema = z.object({
  transport: z.enum(["stdio", "http", "sse"]).default("stdio"),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  url: z.string().optional(),
  env: z.record(z.string()).optional(),
  // Admin policy overrides
  allowedTools: z.array(z.string()).optional(),
  blockedTools: z.array(z.string()).optional(),
  // Force settings that users cannot override
  enforceAllowlist: z.boolean().optional(),
  readOnly: z.boolean().optional(),
  maxOutputTokens: z.number().optional(),
});

/** Zod schema for the entire managed config file */
const managedConfigSchema = z.object({
  mcpServers: z.record(managedServerSchema).default({}),
  policies: z
    .object({
      allowUserServers: z.boolean().default(true),
      requireApproval: z.boolean().default(false),
      maxServers: z.number().default(20),
      blockedTransports: z.array(z.enum(["stdio", "http", "sse"])).default([]),
    })
    .default({}),
});

/** Configuration for a single managed MCP server */
export type ManagedServerConfig = z.infer<typeof managedServerSchema>;

/** Full managed config file structure */
export type ManagedConfig = z.infer<typeof managedConfigSchema>;

/** Global admin policies extracted from managed config */
export type ManagedPolicies = ManagedConfig["policies"];

/** Result of validating a user-provided server config against managed policies */
export interface ManagedConfigValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

/** Default path for managed MCP config */
const DEFAULT_MANAGED_CONFIG_PATH = join(homedir(), ".dbcode", "managed-mcp.json");

/**
 * Handles admin-level MCP server configuration that takes priority over
 * user/project configs for security-sensitive settings.
 *
 * Config file: `~/.dbcode/managed-mcp.json`
 *
 * When no managed config file exists, all policies default to permissive
 * (no restrictions on user configs).
 */
export class MCPManagedConfig {
  private config: ManagedConfig | null = null;
  private readonly configPath: string;

  constructor(configPath?: string) {
    this.configPath = configPath ?? DEFAULT_MANAGED_CONFIG_PATH;
  }

  /**
   * Load managed config from disk. Returns default permissive config
   * when the file does not exist. Throws on invalid JSON or schema violations.
   */
  async load(): Promise<ManagedConfig> {
    let raw: string;
    try {
      raw = await readFile(this.configPath, "utf-8");
    } catch {
      // File doesn't exist — return default permissive config
      const defaultConfig = managedConfigSchema.parse({});
      this.config = defaultConfig;
      return defaultConfig;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new MCPManagedConfigError("Failed to parse managed MCP config as JSON", {
        path: this.configPath,
        cause: error instanceof Error ? error.message : String(error),
      });
    }

    try {
      const validated = managedConfigSchema.parse(parsed);
      this.config = validated;
      return validated;
    } catch (error) {
      throw new MCPManagedConfigError("Managed MCP config failed schema validation", {
        path: this.configPath,
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Check if managed config file exists on disk.
   */
  async exists(): Promise<boolean> {
    try {
      await readFile(this.configPath, "utf-8");
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get managed server configs. Must call `load()` first.
   */
  getManagedServers(): ReadonlyMap<string, ManagedServerConfig> {
    const servers = this.getLoadedConfig().mcpServers;
    return new Map(Object.entries(servers));
  }

  /**
   * Get global admin policies. Must call `load()` first.
   */
  getPolicies(): ManagedPolicies {
    return this.getLoadedConfig().policies;
  }

  /**
   * Merge managed config with user/project configs.
   *
   * Priority rules:
   * - `readOnly` servers: user config is completely ignored for that server
   * - `enforceAllowlist`: user cannot add tools beyond managed allowedTools
   * - Managed policy fields (allowedTools, blockedTools) override user fields
   * - User-only servers: kept only if `policies.allowUserServers` is true
   * - Managed-only servers: always included
   */
  mergeWithUserConfigs(
    userConfigs: Record<string, MCPServerConfig>,
  ): Record<string, MCPServerConfig> {
    const loaded = this.getLoadedConfig();
    const managedServers = loaded.mcpServers;
    const policies = loaded.policies;
    const result: Record<string, MCPServerConfig> = {};

    // Add all managed servers first
    for (const [name, managed] of Object.entries(managedServers)) {
      const userConfig = userConfigs[name];

      if (managed.readOnly || !userConfig) {
        // readOnly: ignore user config entirely; managed-only: use managed config as-is
        result[name] = this.managedToServerConfig(name, managed);
      } else {
        // Merge: user provides connection details, managed provides policy overrides
        result[name] = this.mergeServerConfig(name, userConfig, managed);
      }
    }

    // Add user-only servers if policy allows
    if (policies.allowUserServers) {
      for (const [name, userConfig] of Object.entries(userConfigs)) {
        if (!(name in managedServers)) {
          result[name] = { ...userConfig };
        }
      }
    }

    return result;
  }

  /**
   * Validate a user-provided server config against managed policies.
   */
  validateServerConfig(name: string, config: MCPServerConfig): ManagedConfigValidationResult {
    const loaded = this.getLoadedConfig();
    const policies = loaded.policies;
    const managedServer = loaded.mcpServers[name];
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if user servers are allowed
    if (!policies.allowUserServers && !managedServer) {
      errors.push("Policy does not allow user-defined servers");
    }

    // Check transport against blockedTransports
    if (policies.blockedTransports.includes(config.transport)) {
      errors.push(`Transport "${config.transport}" is blocked by admin policy`);
    }

    // Check if managed server is readOnly
    if (managedServer?.readOnly) {
      errors.push(`Server "${name}" is managed as read-only and cannot be modified`);
    }

    // Check requireApproval
    if (policies.requireApproval && !managedServer) {
      warnings.push("New servers require admin approval before use");
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Check if a user is allowed to add a new server given current count.
   */
  canAddServer(currentServerCount: number): boolean {
    const policies = this.getLoadedConfig().policies;

    if (!policies.allowUserServers) {
      return false;
    }

    return currentServerCount < policies.maxServers;
  }

  /**
   * Check if a transport type is allowed by admin policy.
   */
  isTransportAllowed(transport: "stdio" | "http" | "sse"): boolean {
    const policies = this.getLoadedConfig().policies;
    return !policies.blockedTransports.includes(transport);
  }

  /**
   * Get effective tool filter for a server by merging managed + user filters.
   *
   * - If managed has `enforceAllowlist`, managed allowlist wins exclusively
   * - Otherwise, allowlist = intersection of managed + user (if both present)
   * - Denylist = union of managed + user denylists
   */
  getEffectiveToolFilter(
    serverName: string,
    userAllowlist?: readonly string[],
    userDenylist?: readonly string[],
  ): { readonly allowlist?: readonly string[]; readonly denylist?: readonly string[] } {
    const managed = this.getLoadedConfig().mcpServers[serverName];

    if (!managed) {
      // No managed config for this server — user filters pass through
      return {
        allowlist: userAllowlist ? [...userAllowlist] : undefined,
        denylist: userDenylist ? [...userDenylist] : undefined,
      };
    }

    // Compute allowlist
    const allowlist = this.computeAllowlist(managed, userAllowlist);

    // Compute denylist: union of managed + user
    const denylist = this.computeDenylist(managed, userDenylist);

    return { allowlist, denylist };
  }

  /**
   * Ensure config has been loaded before accessing it.
   */
  private getLoadedConfig(): ManagedConfig {
    if (!this.config) {
      throw new MCPManagedConfigError("Managed config not loaded. Call load() first.");
    }
    return this.config;
  }

  /**
   * Convert a managed server entry to an MCPServerConfig.
   */
  private managedToServerConfig(name: string, managed: ManagedServerConfig): MCPServerConfig {
    return {
      name,
      transport: managed.transport,
      command: managed.command,
      args: managed.args ? [...managed.args] : undefined,
      url: managed.url,
      env: managed.env ? { ...managed.env } : undefined,
    };
  }

  /**
   * Merge a user config with managed policy overrides.
   * User provides connection details; managed provides policy fields.
   */
  private mergeServerConfig(
    name: string,
    userConfig: MCPServerConfig,
    _managed: ManagedServerConfig,
  ): MCPServerConfig {
    return {
      name,
      transport: userConfig.transport,
      command: userConfig.command,
      args: userConfig.args ? [...userConfig.args] : undefined,
      url: userConfig.url,
      env: userConfig.env ? { ...userConfig.env } : undefined,
      scope: userConfig.scope,
    };
  }

  /**
   * Compute the effective allowlist given managed config and user allowlist.
   */
  private computeAllowlist(
    managed: ManagedServerConfig,
    userAllowlist?: readonly string[],
  ): readonly string[] | undefined {
    const managedAllowlist = managed.allowedTools;

    if (managed.enforceAllowlist && managedAllowlist) {
      // Managed enforces its allowlist — user additions are rejected
      return [...managedAllowlist];
    }

    if (managedAllowlist && userAllowlist) {
      // Intersection: only tools in both lists
      const managedSet = new Set(managedAllowlist);
      return userAllowlist.filter((tool) => managedSet.has(tool));
    }

    if (managedAllowlist) {
      return [...managedAllowlist];
    }

    if (userAllowlist) {
      return [...userAllowlist];
    }

    return undefined;
  }

  /**
   * Compute the effective denylist as union of managed + user denylists.
   */
  private computeDenylist(
    managed: ManagedServerConfig,
    userDenylist?: readonly string[],
  ): readonly string[] | undefined {
    const managedDenylist = managed.blockedTools;

    if (managedDenylist && userDenylist) {
      const combined = new Set([...managedDenylist, ...userDenylist]);
      return [...combined];
    }

    if (managedDenylist) {
      return [...managedDenylist];
    }

    if (userDenylist) {
      return [...userDenylist];
    }

    return undefined;
  }
}

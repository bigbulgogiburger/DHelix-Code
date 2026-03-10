import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { CONFIG_DIR } from "../constants.js";
import { type PermissionMode } from "../permissions/types.js";
import { getModeDescription } from "../permissions/modes.js";
import { type SlashCommand, type CommandResult, type CommandContext } from "./registry.js";

/** Path to the global settings file */
const SETTINGS_PATH = join(CONFIG_DIR, "settings.json");

/** Shape of the permissions section in settings.json */
interface PermissionsSettings {
  readonly allow: readonly string[];
  readonly deny: readonly string[];
}

/**
 * Read the full settings.json, returning a mutable object.
 * Returns an empty object if the file does not exist.
 */
async function readSettings(): Promise<Record<string, unknown>> {
  try {
    const content = await readFile(SETTINGS_PATH, "utf-8");
    return JSON.parse(content) as Record<string, unknown>;
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return {};
    }
    throw new Error(`Failed to read settings: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Write settings back to disk, ensuring the directory exists.
 */
async function writeSettings(settings: Record<string, unknown>): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2) + "\n", "utf-8");
}

/**
 * Extract the permissions section from settings, with defaults.
 */
function getPermissionsFromSettings(settings: Record<string, unknown>): PermissionsSettings {
  const perms = settings.permissions as Record<string, unknown> | undefined;
  return {
    allow: Array.isArray(perms?.allow) ? (perms.allow as string[]) : [],
    deny: Array.isArray(perms?.deny) ? (perms.deny as string[]) : [],
  };
}

/**
 * Validate a permission pattern.
 *
 * Valid formats:
 *   - `tool_name` — matches a tool by name (e.g., `file_read`, `bash_exec`)
 *   - `ToolName(arg_pattern)` — matches a tool with an argument glob (e.g., `Bash(npm *)`)
 *
 * Returns null if valid, or an error message if invalid.
 */
export function validatePattern(pattern: string): string | null {
  const trimmed = pattern.trim();
  if (trimmed.length === 0) {
    return "Pattern cannot be empty";
  }

  // Check for balanced parentheses
  const parenMatch = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\((.+)\)$/);
  if (parenMatch) {
    const [, toolName, argPattern] = parenMatch;
    if (!toolName || toolName.length === 0) {
      return "Tool name cannot be empty in pattern";
    }
    if (!argPattern || argPattern.length === 0) {
      return "Argument pattern cannot be empty inside parentheses";
    }
    return null;
  }

  // Simple tool name pattern (may include glob chars)
  if (/^[A-Za-z_*?][A-Za-z0-9_*?]*$/.test(trimmed)) {
    return null;
  }

  // Has unbalanced or misplaced parentheses
  if (trimmed.includes("(") || trimmed.includes(")")) {
    return `Invalid pattern: unbalanced parentheses in "${trimmed}"`;
  }

  return `Invalid pattern: "${trimmed}". Use "tool_name" or "ToolName(arg_pattern)"`;
}

/**
 * Format the display for `/permissions` (no args) — show current state.
 */
function formatPermissionStatus(
  mode: PermissionMode,
  perms: PermissionsSettings,
): string {
  const lines: string[] = [];

  lines.push("Permission Status");
  lines.push("─".repeat(40));
  lines.push("");
  lines.push(`  Mode: ${mode}`);
  lines.push(`  ${getModeDescription(mode)}`);
  lines.push("");

  // Allow rules
  lines.push("  Persistent Allow Rules:");
  if (perms.allow.length === 0) {
    lines.push("    (none)");
  } else {
    for (const rule of perms.allow) {
      lines.push(`    + ${rule}`);
    }
  }
  lines.push("");

  // Deny rules
  lines.push("  Persistent Deny Rules:");
  if (perms.deny.length === 0) {
    lines.push("    (none)");
  } else {
    for (const rule of perms.deny) {
      lines.push(`    - ${rule}`);
    }
  }
  lines.push("");

  lines.push("Usage:");
  lines.push("  /permissions allow <pattern>   — Add an allow rule");
  lines.push("  /permissions deny <pattern>    — Add a deny rule");
  lines.push("  /permissions remove <pattern>  — Remove a rule");
  lines.push("  /permissions reset             — Clear all rules");

  return lines.join("\n");
}

/**
 * Handle `/permissions allow <pattern>`.
 */
async function handleAllow(pattern: string): Promise<CommandResult> {
  const validationError = validatePattern(pattern);
  if (validationError) {
    return { output: `Invalid pattern: ${validationError}`, success: false };
  }

  const settings = await readSettings();
  const perms = getPermissionsFromSettings(settings);

  // Check for duplicates
  if (perms.allow.includes(pattern)) {
    return { output: `Allow rule already exists: ${pattern}`, success: true };
  }

  const updatedAllow = [...perms.allow, pattern];
  settings.permissions = {
    ...(settings.permissions as Record<string, unknown> | undefined),
    allow: updatedAllow,
    deny: [...perms.deny],
  };

  await writeSettings(settings);
  return { output: `Added allow rule: ${pattern}`, success: true };
}

/**
 * Handle `/permissions deny <pattern>`.
 */
async function handleDeny(pattern: string): Promise<CommandResult> {
  const validationError = validatePattern(pattern);
  if (validationError) {
    return { output: `Invalid pattern: ${validationError}`, success: false };
  }

  const settings = await readSettings();
  const perms = getPermissionsFromSettings(settings);

  // Check for duplicates
  if (perms.deny.includes(pattern)) {
    return { output: `Deny rule already exists: ${pattern}`, success: true };
  }

  const updatedDeny = [...perms.deny, pattern];
  settings.permissions = {
    ...(settings.permissions as Record<string, unknown> | undefined),
    allow: [...perms.allow],
    deny: updatedDeny,
  };

  await writeSettings(settings);
  return { output: `Added deny rule: ${pattern}`, success: true };
}

/**
 * Handle `/permissions remove <pattern>`.
 */
async function handleRemove(pattern: string): Promise<CommandResult> {
  const trimmed = pattern.trim();
  if (trimmed.length === 0) {
    return { output: "Please specify a pattern to remove.", success: false };
  }

  const settings = await readSettings();
  const perms = getPermissionsFromSettings(settings);

  const inAllow = perms.allow.includes(trimmed);
  const inDeny = perms.deny.includes(trimmed);

  if (!inAllow && !inDeny) {
    return { output: `Rule not found: ${trimmed}`, success: false };
  }

  const updatedAllow = perms.allow.filter((r) => r !== trimmed);
  const updatedDeny = perms.deny.filter((r) => r !== trimmed);

  settings.permissions = {
    ...(settings.permissions as Record<string, unknown> | undefined),
    allow: updatedAllow,
    deny: updatedDeny,
  };

  await writeSettings(settings);

  const source = inAllow && inDeny ? "allow and deny" : inAllow ? "allow" : "deny";
  return { output: `Removed rule from ${source}: ${trimmed}`, success: true };
}

/**
 * Handle `/permissions reset`.
 */
async function handleReset(): Promise<CommandResult> {
  const settings = await readSettings();
  const perms = getPermissionsFromSettings(settings);

  const totalRules = perms.allow.length + perms.deny.length;
  if (totalRules === 0) {
    return { output: "No persistent rules to clear.", success: true };
  }

  settings.permissions = {
    ...(settings.permissions as Record<string, unknown> | undefined),
    allow: [],
    deny: [],
  };

  await writeSettings(settings);
  return {
    output: `Cleared ${totalRules} persistent permission rule${totalRules !== 1 ? "s" : ""}.`,
    success: true,
  };
}

/**
 * /permissions — Manage persistent permission rules.
 *
 * Subcommands:
 *   /permissions                  — Show current permission state
 *   /permissions allow <pattern>  — Add a persistent allow rule
 *   /permissions deny <pattern>   — Add a persistent deny rule
 *   /permissions remove <pattern> — Remove a rule from allow or deny
 *   /permissions reset            — Clear all persistent rules
 */
export const permissionsCommand: SlashCommand = {
  name: "permissions",
  description: "View and manage persistent permission rules",
  usage: "/permissions [allow|deny|remove|reset] [pattern]",

  async execute(args: string, _context: CommandContext): Promise<CommandResult> {
    const trimmed = args.trim();
    const spaceIdx = trimmed.indexOf(" ");
    const subcommand = spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx);
    const subArgs = spaceIdx === -1 ? "" : trimmed.slice(spaceIdx + 1).trim();

    // No args: show current status
    if (!subcommand) {
      const settings = await readSettings();
      const perms = getPermissionsFromSettings(settings);
      const mode = (settings.permissionMode as PermissionMode | undefined) ?? "default";
      return {
        output: formatPermissionStatus(mode, perms),
        success: true,
      };
    }

    switch (subcommand) {
      case "allow":
        if (!subArgs) {
          return { output: "Usage: /permissions allow <pattern>", success: false };
        }
        return handleAllow(subArgs);

      case "deny":
        if (!subArgs) {
          return { output: "Usage: /permissions deny <pattern>", success: false };
        }
        return handleDeny(subArgs);

      case "remove":
        if (!subArgs) {
          return { output: "Usage: /permissions remove <pattern>", success: false };
        }
        return handleRemove(subArgs);

      case "reset":
        return handleReset();

      default:
        return {
          output: `Unknown subcommand: ${subcommand}\n\nUsage: /permissions [allow|deny|remove|reset] [pattern]`,
          success: false,
        };
    }
  },
};

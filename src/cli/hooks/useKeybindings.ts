import { useInput } from "ink";
import { useCallback, useMemo } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

/** Keybinding definition */
export interface Keybinding {
  readonly key: string;
  readonly ctrl?: boolean;
  readonly meta?: boolean;
  readonly shift?: boolean;
  readonly action?: string;
  readonly handler: () => void;
}

/** Serializable keybinding config (from JSON file) */
export interface KeybindingConfig {
  readonly key: string;
  readonly ctrl?: boolean;
  readonly meta?: boolean;
  readonly shift?: boolean;
  /** Action name to map to a handler */
  readonly action: string;
}

/** File format for ~/.dbcode/keybindings.json */
export interface KeybindingsFile {
  readonly bindings: Record<string, string>;
}

/** Default action-to-key mapping */
export const DEFAULT_BINDINGS: Readonly<Record<string, string>> = {
  escape: "cancel",
  "ctrl+j": "newline",
  "shift+tab": "cycle-mode",
  "ctrl+o": "toggle-verbose",
  "ctrl+d": "exit",
  "alt+t": "toggle-thinking",
  "alt+v": "toggle-voice",
} as const;

/** Human-readable descriptions for each action */
export const ACTION_DESCRIPTIONS: Readonly<Record<string, string>> = {
  cancel: "Cancel current operation / dismiss completion",
  newline: "Insert newline in multi-line input",
  "cycle-mode": "Cycle through permission modes",
  "toggle-verbose": "Toggle verbose mode (show/hide full tool outputs)",
  exit: "Exit the application",
  "toggle-thinking": "Toggle extended thinking on/off",
  "toggle-voice": "Start/stop voice recording (push-to-talk)",
} as const;

/**
 * Parse a key combo string like "ctrl+o", "alt+t", "escape", "shift+tab"
 * into a structured object.
 */
export function parseKeyCombo(combo: string): {
  readonly key: string;
  readonly ctrl: boolean;
  readonly meta: boolean;
  readonly shift: boolean;
} {
  const parts = combo.toLowerCase().split("+");
  let ctrl = false;
  let meta = false;
  let shift = false;
  let key = "";

  for (const part of parts) {
    switch (part) {
      case "ctrl":
        ctrl = true;
        break;
      case "alt":
      case "meta":
      case "option":
        meta = true;
        break;
      case "shift":
        shift = true;
        break;
      default:
        key = part;
        break;
    }
  }

  return { key, ctrl, meta, shift };
}

/**
 * Format a key combo back to a display string.
 */
export function formatKeyCombo(combo: {
  readonly key: string;
  readonly ctrl?: boolean;
  readonly meta?: boolean;
  readonly shift?: boolean;
}): string {
  const parts: string[] = [];
  if (combo.ctrl) parts.push("Ctrl");
  if (combo.meta) parts.push("Alt");
  if (combo.shift) parts.push("Shift");
  // Capitalize single-char keys, keep multi-char keys as-is
  const displayKey =
    combo.key.length === 1
      ? combo.key.toUpperCase()
      : combo.key.charAt(0).toUpperCase() + combo.key.slice(1);
  parts.push(displayKey);
  return parts.join("+");
}

/**
 * Load keybinding configuration from ~/.dbcode/keybindings.json.
 * Supports both formats:
 *   - { "bindings": { "escape": "cancel", ... } }
 *   - [ { "key": "escape", "action": "cancel" }, ... ]  (legacy)
 *
 * Returns a record of key combo → action name.
 */
export function loadKeybindingConfig(): Readonly<Record<string, string>> {
  const configPath = join(homedir(), ".dbcode", "keybindings.json");
  try {
    const content = readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(content) as unknown;

    // New format: { bindings: { ... } }
    if (parsed && typeof parsed === "object" && "bindings" in parsed) {
      const file = parsed as KeybindingsFile;
      if (typeof file.bindings === "object" && file.bindings !== null) {
        return file.bindings;
      }
    }

    // Legacy format: array of KeybindingConfig
    if (Array.isArray(parsed)) {
      const result: Record<string, string> = {};
      for (const item of parsed as KeybindingConfig[]) {
        const combo = [
          item.ctrl ? "ctrl" : "",
          item.meta ? "alt" : "",
          item.shift ? "shift" : "",
          item.key,
        ]
          .filter(Boolean)
          .join("+");
        result[combo] = item.action;
      }
      return result;
    }

    return {};
  } catch {
    return {};
  }
}

/**
 * Get the effective bindings by merging defaults with user config.
 * User config overrides defaults when both map to the same action.
 */
export function getEffectiveBindings(
  userConfig: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> {
  // Start with defaults
  const effective: Record<string, string> = { ...DEFAULT_BINDINGS };

  // If user remaps an action to a different key, remove the default key
  const userActions = new Set(Object.values(userConfig));
  for (const [key, action] of Object.entries(effective)) {
    if (userActions.has(action)) {
      delete effective[key];
    }
  }

  // Apply user overrides
  for (const [key, action] of Object.entries(userConfig)) {
    effective[key] = action;
  }

  return effective;
}

/**
 * Build Keybinding[] from a key→action map and action→handler map.
 */
export function buildKeybindings(
  bindings: Readonly<Record<string, string>>,
  actionHandlers: Readonly<Record<string, () => void>>,
): readonly Keybinding[] {
  const result: Keybinding[] = [];
  for (const [combo, action] of Object.entries(bindings)) {
    const handler = actionHandlers[action];
    if (!handler) continue;

    const parsed = parseKeyCombo(combo);
    result.push({
      key: parsed.key,
      ctrl: parsed.ctrl || undefined,
      meta: parsed.meta || undefined,
      shift: parsed.shift || undefined,
      action,
      handler,
    });
  }
  return result;
}

/**
 * Merge user-configured keybindings with default bindings.
 * User configs override defaults for the same action.
 * @deprecated Use buildKeybindings + getEffectiveBindings instead.
 */
export function mergeKeybindings(
  defaults: readonly Keybinding[],
  configs: readonly KeybindingConfig[],
  actionHandlers: Readonly<Record<string, () => void>>,
): readonly Keybinding[] {
  // Start with defaults
  const merged = new Map<string, Keybinding>();
  for (const binding of defaults) {
    const id = `${binding.ctrl ? "ctrl+" : ""}${binding.meta ? "meta+" : ""}${binding.key}`;
    merged.set(id, binding);
  }

  // Apply user overrides
  for (const config of configs) {
    const handler = actionHandlers[config.action];
    if (!handler) continue;

    const id = `${config.ctrl ? "ctrl+" : ""}${config.meta ? "meta+" : ""}${config.key}`;
    merged.set(id, {
      key: config.key,
      ctrl: config.ctrl,
      meta: config.meta,
      shift: config.shift,
      handler,
    });
  }

  return [...merged.values()];
}

/** Hook for registering custom keybindings with configurable key mappings */
export function useKeybindings(bindings: readonly Keybinding[], isActive = true) {
  const stableBindings = useMemo(() => [...bindings], [bindings]);

  const handleInput = useCallback(
    (
      input: string,
      key: { ctrl: boolean; meta: boolean; shift: boolean; escape: boolean; tab: boolean },
    ) => {
      for (const binding of stableBindings) {
        const ctrlMatch = binding.ctrl ? key.ctrl : !key.ctrl;
        const metaMatch = binding.meta ? key.meta : !key.meta;

        // Handle special keys
        if (binding.key === "escape" && key.escape && ctrlMatch && metaMatch) {
          binding.handler();
          return;
        }
        if (binding.key === "tab" && key.tab) {
          // For shift+tab, check shift modifier
          const shiftMatch = binding.shift ? key.shift : !key.shift;
          if (ctrlMatch && metaMatch && shiftMatch) {
            binding.handler();
            return;
          }
          continue;
        }

        if (input === binding.key && ctrlMatch && metaMatch) {
          binding.handler();
          return;
        }
      }
    },
    [stableBindings],
  );

  useInput(handleInput, { isActive });
}

/** Path to the keybindings config file */
export const KEYBINDINGS_CONFIG_PATH = join(homedir(), ".dbcode", "keybindings.json");

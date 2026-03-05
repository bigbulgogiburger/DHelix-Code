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

/**
 * Load keybinding configuration from .dbcode/keybindings.json.
 * Returns empty array if file doesn't exist or is invalid.
 */
export function loadKeybindingConfig(): readonly KeybindingConfig[] {
  const configPath = join(homedir(), ".dbcode", "keybindings.json");
  try {
    const content = readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(content) as KeybindingConfig[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Merge user-configured keybindings with default bindings.
 * User configs override defaults for the same action.
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
    (input: string, key: { ctrl: boolean; meta: boolean; shift: boolean }) => {
      for (const binding of stableBindings) {
        const ctrlMatch = binding.ctrl ? key.ctrl : !key.ctrl;
        const metaMatch = binding.meta ? key.meta : !key.meta;
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

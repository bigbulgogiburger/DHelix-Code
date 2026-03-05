import { useInput } from "ink";
import { useCallback } from "react";

/** Keybinding definition */
interface Keybinding {
  readonly key: string;
  readonly ctrl?: boolean;
  readonly meta?: boolean;
  readonly handler: () => void;
}

/** Hook for registering custom keybindings */
export function useKeybindings(bindings: readonly Keybinding[], isActive = true) {
  const handleInput = useCallback(
    (input: string, key: { ctrl: boolean; meta: boolean }) => {
      for (const binding of bindings) {
        const ctrlMatch = binding.ctrl ? key.ctrl : !key.ctrl;
        const metaMatch = binding.meta ? key.meta : !key.meta;
        if (input === binding.key && ctrlMatch && metaMatch) {
          binding.handler();
          return;
        }
      }
    },
    [bindings],
  );

  useInput(handleInput, { isActive });
}

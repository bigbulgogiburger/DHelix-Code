/**
 * DEC Mode 2026 — Synchronized Output for terminal rendering.
 *
 * When supported by the terminal (Ghostty, iTerm2 3.5+, WezTerm, kitty,
 * recent VSCode terminal, tmux 3.4+), this wraps write operations in
 * begin/end markers that tell the terminal to buffer all output and
 * display it atomically. This eliminates flickering caused by partial
 * screen updates.
 *
 * Terminals that don't support this mode simply ignore the escape sequences.
 */

// DEC Private Mode 2026 escape sequences
const BEGIN_SYNCHRONIZED = "\x1b[?2026h";
const END_SYNCHRONIZED = "\x1b[?2026l";

let syncOutputEnabled = true;

/** Disable synchronized output (for terminals known to not support it) */
export function disableSynchronizedOutput(): void {
  syncOutputEnabled = false;
}

/** Enable synchronized output */
export function enableSynchronizedOutput(): void {
  syncOutputEnabled = true;
}

/**
 * Wrap a stdout write function with synchronized output markers.
 * The wrapped function sends BEGIN before writing and END after.
 */
export function withSynchronizedOutput(fn: () => void): void {
  if (!syncOutputEnabled) {
    fn();
    return;
  }

  process.stdout.write(BEGIN_SYNCHRONIZED);
  try {
    fn();
  } finally {
    process.stdout.write(END_SYNCHRONIZED);
  }
}

/**
 * Patch Ink's stdout to automatically wrap renders in synchronized output.
 * Call this once before Ink's render() to enable atomic frame display.
 *
 * This monkey-patches process.stdout.write to detect Ink's render cycles
 * (which start with cursor movement escape sequences) and wrap them.
 */
export function patchInkRendering(): void {
  if (!syncOutputEnabled) return;

  const originalWrite = process.stdout.write.bind(process.stdout);
  let inRenderCycle = false;

  // Ink's render cycle starts with cursor save/move sequences
  // We detect this and wrap the entire cycle
  const CSI_CURSOR_UP = "\x1b[";
  const SAVE_CURSOR = "\x1b7";

  process.stdout.write = function patchedWrite(
    chunk: string | Uint8Array,
    encodingOrCallback?: BufferEncoding | ((err?: Error | null) => void),
    callback?: (err?: Error | null) => void,
  ): boolean {
    const str = typeof chunk === "string" ? chunk : "";

    // Detect start of Ink render cycle (cursor movement)
    if (
      !inRenderCycle &&
      str.length > 2 &&
      (str.startsWith(CSI_CURSOR_UP) || str.startsWith(SAVE_CURSOR))
    ) {
      inRenderCycle = true;
      originalWrite(BEGIN_SYNCHRONIZED);
      const result = originalWrite(chunk, encodingOrCallback as BufferEncoding, callback);
      // Schedule end of sync on next microtask (after Ink finishes writing)
      queueMicrotask(() => {
        if (inRenderCycle) {
          inRenderCycle = false;
          originalWrite(END_SYNCHRONIZED);
        }
      });
      return result;
    }

    return originalWrite(chunk, encodingOrCallback as BufferEncoding, callback);
  } as typeof process.stdout.write;
}

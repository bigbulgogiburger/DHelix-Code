/**
 * `/plasmid edit <id>` — open `body.md` in `$EDITOR`.
 *
 * Editor resolution order:
 *   1. `deps.editorCommand` (explicit injection)
 *   2. `process.env.EDITOR`
 *   3. `vim`
 *   4. `nano`
 *
 * Privacy guard (best-effort, I-7): if the plasmid is `privacy: local-only`
 * and the currently active LLM provider looks cloud-hosted, the edit is
 * refused. The guard is deliberately conservative; users who hit a false
 * positive can switch provider or use `/plasmid show --body --force`
 * for a read-only path.
 */
import { spawn } from "node:child_process";

import type { CommandContext, CommandResult } from "../registry.js";
import type { LoadedPlasmid } from "../../plasmids/types.js";
import type { CommandDeps } from "./deps.js";

const DEFAULT_EDITORS: readonly string[] = ["vim", "nano"];

export async function editSubcommand(
  args: readonly string[],
  context: CommandContext,
  deps: CommandDeps,
): Promise<CommandResult> {
  if (args.length === 0) {
    return {
      output: "Missing argument: <id>. Usage: /plasmid edit <id>",
      success: false,
    };
  }
  if (args.length > 1 || args[0]?.startsWith("--")) {
    return {
      output: "Invalid arguments. Usage: /plasmid edit <id>",
      success: false,
    };
  }
  const id = args[0] as string;

  const { loaded } = await deps.loadPlasmids({
    workingDirectory: context.workingDirectory,
    registryPath: deps.registryPath,
    sharedRegistryPath: deps.sharedRegistryPath,
    draftsPath: deps.draftsPath,
    scopes: deps.scopes,
  });

  const target = loaded.find((p) => p.metadata.id === id);
  if (!target) {
    return { output: `Plasmid not found: ${id}`, success: false };
  }

  if (shouldRefuseCloud(target, deps)) {
    return {
      output: [
        `Refusing to edit: '${id}' is privacy: local-only and the active LLM provider appears to be cloud-hosted.`,
        "Switch to a local provider (e.g. Ollama / LM Studio) before editing this plasmid.",
      ].join("\n"),
      success: false,
    };
  }

  const editor = resolveEditor(deps.editorCommand);
  const ctxSignal = (context as { readonly abortSignal?: AbortSignal }).abortSignal;
  const code = await runEditor(editor, target.sourcePath, ctxSignal);
  if (code !== 0) {
    return {
      output: `Editor exited with code ${code}.`,
      success: false,
    };
  }

  return {
    output: `Edited ${target.sourcePath} (editor: ${editor}).`,
    success: true,
  };
}

function shouldRefuseCloud(p: LoadedPlasmid, deps: CommandDeps): boolean {
  if (p.metadata.privacy !== "local-only") return false;
  const url = deps.getActiveProviderBaseUrl?.();
  if (!url) return false;
  try {
    const parsed = new URL(url);
    const h = parsed.hostname.toLowerCase();
    if (h === "localhost" || h === "::1" || h.endsWith(".local")) return false;
    if (/^127\./.test(h)) return false;
    if (/^10\./.test(h) || /^192\.168\./.test(h)) return false;
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return false;
    return true;
  } catch {
    return false;
  }
}

function resolveEditor(injected?: string): string {
  if (injected && injected.trim() !== "") return injected;
  const env = process.env.EDITOR;
  if (env && env.trim() !== "") return env;
  return DEFAULT_EDITORS[0] as string;
}

/**
 * Run the editor against the supplied path. Inherits stdio so the
 * editor's TUI works; the process returns when the editor exits.
 *
 * `signal` is forwarded to `spawn` so `/plasmid edit` respects
 * `CommandContext.abortSignal` if the session is cancelled.
 */
async function runEditor(
  editor: string,
  path: string,
  signal?: AbortSignal,
): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const child = spawn(editor, [path], {
      stdio: "inherit",
      signal,
    });
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 0));
  });
}


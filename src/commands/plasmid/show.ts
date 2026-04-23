/**
 * `/plasmid show <id>` — print metadata + eval-case count.
 *
 * Flags
 * - `--body`  include the last 40 lines of `body.md` below the metadata.
 * - `--force` bypass the cloud-provider guard for `privacy: local-only`.
 *
 * Privacy guard (best-effort, I-7): if `privacy: local-only` and the
 * currently active LLM provider looks cloud-hosted (e.g. `api.openai.com`),
 * printing the body is refused unless the user passes `--force`.
 */
import type { CommandContext, CommandResult } from "../registry.js";
import type { LoadedPlasmid } from "../../plasmids/types.js";
import type { CommandDeps } from "./deps.js";

const BODY_TAIL_LINES = 40;

export async function showSubcommand(
  args: readonly string[],
  context: CommandContext,
  deps: CommandDeps,
): Promise<CommandResult> {
  const parsed = parseArgs(args);
  if ("error" in parsed) return { output: parsed.error, success: false };

  const { loaded } = await deps.loadPlasmids({
    workingDirectory: context.workingDirectory,
    registryPath: deps.registryPath,
    sharedRegistryPath: deps.sharedRegistryPath,
    draftsPath: deps.draftsPath,
    scopes: deps.scopes,
  });

  const target = loaded.find((p) => p.metadata.id === parsed.id);
  if (!target) {
    return {
      output: `Plasmid not found: ${parsed.id}`,
      success: false,
    };
  }

  const activation = await deps.activationStore.read();
  const isActive = activation.activePlasmidIds.includes(target.metadata.id);
  const lines = formatMetadata(target, isActive);

  if (parsed.includeBody) {
    const cloudBlocked = shouldBlockCloudBody(target, deps);
    if (cloudBlocked && !parsed.force) {
      lines.push("", "(body hidden — privacy: local-only + active provider appears to be cloud.)");
      lines.push("Re-run with --force to override (emits an audit warning).");
      return { output: lines.join("\n"), success: true };
    }
    if (cloudBlocked && parsed.force) {
      lines.push("", "[warn] local-only body shown over cloud provider (forced).");
    }
    lines.push("", "---", tailLines(target.body, BODY_TAIL_LINES));
  }

  return { output: lines.join("\n"), success: true };
}

interface ParsedArgs {
  readonly id: string;
  readonly includeBody: boolean;
  readonly force: boolean;
}

function parseArgs(args: readonly string[]): ParsedArgs | { error: string } {
  let id: string | undefined;
  let includeBody = false;
  let force = false;

  for (const tok of args) {
    if (tok === "--body") {
      includeBody = true;
      continue;
    }
    if (tok === "--force") {
      force = true;
      continue;
    }
    if (tok.startsWith("--")) {
      return { error: `Unknown flag: ${tok}. Usage: /plasmid show <id> [--body] [--force]` };
    }
    if (id === undefined) {
      id = tok;
      continue;
    }
    return { error: "Only one plasmid id may be passed to /plasmid show." };
  }
  if (id === undefined) {
    return { error: "Missing argument: <id>. Usage: /plasmid show <id> [--body] [--force]" };
  }
  return { id, includeBody, force };
}

function formatMetadata(p: LoadedPlasmid, active: boolean): string[] {
  const m = p.metadata;
  const out: string[] = [
    `id:          ${m.id}`,
    `name:        ${m.name}`,
    `description: ${m.description}`,
    `version:     ${m.version}`,
    `tier:        ${m.tier}`,
    `scope:       ${p.scopeOrigin}`,
    `privacy:     ${m.privacy}`,
    `active:      ${active ? "yes" : "no"}`,
    `eval cases:  ${p.evalCases.length}`,
  ];
  if (m.author) out.push(`author:      ${m.author}`);
  if (m.extends) out.push(`extends:     ${m.extends}`);
  if (m.requires && m.requires.length > 0) out.push(`requires:    ${m.requires.join(", ")}`);
  if (m.conflicts && m.conflicts.length > 0) out.push(`conflicts:   ${m.conflicts.join(", ")}`);
  if (m.tags && m.tags.length > 0) out.push(`tags:        ${m.tags.join(", ")}`);
  if (m.foundational) out.push(`foundational: true`);
  return out;
}

function shouldBlockCloudBody(p: LoadedPlasmid, deps: CommandDeps): boolean {
  if (p.metadata.privacy !== "local-only") return false;
  const url = deps.getActiveProviderBaseUrl?.();
  if (!url) return false;
  return isCloudLikeUrl(url);
}

/**
 * Best-effort cloud-detection heuristic — the I-7 guard is deliberately
 * over-conservative. Any hostname that is not `localhost`, a loopback IP,
 * or a `.local` mDNS name is treated as potentially cloud.
 */
function isCloudLikeUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host === "::1" || host.endsWith(".local")) return false;
  if (/^127\./.test(host)) return false;
  if (/^10\./.test(host) || /^192\.168\./.test(host)) return false;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return false;
  return true;
}

function tailLines(text: string, n: number): string {
  const lines = text.split(/\r?\n/);
  return lines.slice(Math.max(0, lines.length - n)).join("\n");
}

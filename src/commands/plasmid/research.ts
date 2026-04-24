/**
 * Phase 5 — `/plasmid --research "<intent>"` subcommand wiring.
 *
 * Glues Team 1's `runResearchMode` to the real `web_search` + `web_fetch`
 * tools and persists the resulting draft via `DraftsStore`. Honours
 * `--dry-run` (return body in `output`, do not persist) and `--from-file`
 * (load existing plasmid as `currentDraft`).
 *
 * Owned by Team 2 — Phase 5 GAL-1 dev-guide §3.
 *
 * Argument shape (dispatcher accepts both forms):
 *
 *   /plasmid --research "<intent>"   [--dry-run] [--from-file <path>]
 *                                    [--template <name>] [--locale ko|en]
 *                                    [--force-network]
 *   /plasmid research "<intent>"     ... (same flags)
 *
 * Privacy gate (matrix from dev-guide §3):
 *   - active provider tier === "local" AND no `--force-network` →
 *     `PLASMID_RESEARCH_PRIVACY_BLOCKED`
 *   - `--from-file` plasmid metadata says `privacy: local-only` →
 *     `PLASMID_RESEARCH_PRIVACY_BLOCKED`
 *   - WebSearch returns 0 hits → warn, fall back to template body (success)
 *   - All WebFetches fail / runResearch throws PLASMID_RESEARCH_NETWORK_ERROR →
 *     return `success: false` with that code
 */

import { readFile } from "node:fs/promises";

import type { CommandContext, CommandResult } from "../registry.js";
import type { CommandDeps, ResearchInput } from "./deps.js";
import { DraftsStore } from "../../plasmids/drafts.js";
import { parseYamlMetadata, splitFrontmatter } from "../../plasmids/frontmatter.js";
import { PlasmidError } from "../../plasmids/errors.js";
import type { PlasmidId, PlasmidMetadata } from "../../plasmids/types.js";

interface ParsedArgs {
  readonly intent: string;
  readonly dryRun: boolean;
  readonly fromFile?: string;
  readonly template?: string;
  readonly locale?: "ko" | "en";
  readonly forceNetwork: boolean;
}

type ParseResult = ParsedArgs | { readonly error: string };

const USAGE = [
  "Usage: /plasmid --research \"<intent>\" [flags]",
  "       /plasmid research \"<intent>\" [flags]",
  "",
  "Flags:",
  "  --dry-run             render draft, do NOT persist",
  "  --from-file <path>    seed currentDraft from an existing plasmid file",
  "  --template <name>     starter template id (e.g. foundational-security)",
  "  --locale <ko|en>      synthesis locale (defaults to ko)",
  "  --force-network       allow research even on a local-only provider",
].join("\n");

export async function researchSubcommand(
  rest: readonly string[],
  context: CommandContext,
  deps: CommandDeps,
): Promise<CommandResult> {
  const parsed = parseArgs(rest);
  if ("error" in parsed) {
    return { output: `${parsed.error}\n\n${USAGE}`, success: false };
  }

  // ── 1. Privacy gate (provider-level) ─────────────────────────────────────
  const tier = deps.getActiveProviderPrivacyTier?.() ?? "unknown";
  if (tier === "local" && !parsed.forceNetwork) {
    return privacyBlockedResult(
      "Active LLM provider is local-only; research requires network egress. " +
        "Re-run with --force-network to opt in (audited).",
    );
  }

  // ── 2. Privacy gate (plasmid-level via --from-file) ──────────────────────
  let currentDraft: Partial<PlasmidMetadata> | undefined;
  if (parsed.fromFile) {
    const loaded = await loadCurrentDraft(parsed.fromFile, context.workingDirectory);
    if ("error" in loaded) {
      return { output: loaded.error, success: false };
    }
    currentDraft = loaded.metadata;
    if (currentDraft.privacy === "local-only") {
      return privacyBlockedResult(
        `Plasmid '${currentDraft.id ?? parsed.fromFile}' has privacy: local-only. ` +
          "Research mode is disabled for local-only plasmids regardless of --force-network.",
      );
    }
  }

  // ── 3. Resolve research adapter (DI seam — Team 1 may not have landed) ──
  const runResearch = deps.runResearch;
  if (!runResearch) {
    return {
      output:
        "Research mode is not wired in this build. Team 1's `runResearchMode` " +
        "is required; the orchestrator must inject it via deps.runResearch.",
      success: false,
    };
  }
  if (!deps.webSearch || !deps.webFetch) {
    return {
      output:
        "Research mode requires deps.webSearch + deps.webFetch adapters. " +
        "The production factory wires both; tests must stub them.",
      success: false,
    };
  }

  // ── 4. Run research orchestrator ─────────────────────────────────────────
  const controller = new AbortController();
  const input: ResearchInput = {
    intent: parsed.intent,
    currentDraft,
    locale: parsed.locale,
  };
  let result: Awaited<ReturnType<typeof runResearch>>;
  try {
    result = await runResearch(
      input,
      {
        webSearch: deps.webSearch,
        webFetch: deps.webFetch,
        allowNetwork: tier !== "local" || parsed.forceNetwork,
        now: deps.now,
      },
      controller.signal,
    );
  } catch (err) {
    if (err instanceof PlasmidError) {
      const code = err.code;
      if (code === "PLASMID_RESEARCH_PRIVACY_BLOCKED") {
        return privacyBlockedResult(err.message);
      }
      return {
        output: `[${code}] ${err.message}`,
        success: false,
      };
    }
    return {
      output: `Research failed: ${err instanceof Error ? err.message : String(err)}`,
      success: false,
    };
  }

  // ── 5. --dry-run: emit body, do NOT persist ──────────────────────────────
  const renderedBody = renderMarkdown(parsed, result, currentDraft);
  if (parsed.dryRun) {
    return {
      output: [renderedBody, "", "(dry-run: draft NOT persisted)"].join("\n"),
      success: true,
    };
  }

  // ── 6. Persist draft via DraftsStore ─────────────────────────────────────
  const draftId = (result.metadataPatch.id ?? currentDraft?.id ?? deriveDraftId(parsed.intent)) as PlasmidId;
  const draftsStore = new DraftsStore({
    workingDirectory: context.workingDirectory,
    draftsPath: deps.draftsPath ?? ".dhelix/plasmids/.drafts",
  });

  let savedPath: string;
  try {
    savedPath = await draftsStore.save(draftId, renderedBody, controller.signal);
  } catch (err) {
    return {
      output: `Failed to persist draft: ${err instanceof Error ? err.message : String(err)}`,
      success: false,
    };
  }

  return {
    output: formatSuccessOutput(parsed, draftId, savedPath, result),
    success: true,
  };
}

// ─── argument parsing ──────────────────────────────────────────────────────

function parseArgs(args: readonly string[]): ParseResult {
  const intentParts: string[] = [];
  let dryRun = false;
  let fromFile: string | undefined;
  let template: string | undefined;
  let locale: "ko" | "en" | undefined;
  let forceNetwork = false;

  // Drop a leading "--research" sentinel emitted by the dispatcher when the
  // user wrote `/plasmid --research ...` (vs. the `research` keyword form).
  const tokens = args[0] === "--research" ? args.slice(1) : args;

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i] ?? "";
    if (tok === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (tok === "--force-network") {
      forceNetwork = true;
      continue;
    }
    if (tok === "--from-file") {
      const next = tokens[i + 1];
      if (next === undefined || next.startsWith("--")) {
        return { error: "--from-file requires a path argument." };
      }
      fromFile = next;
      i += 1;
      continue;
    }
    if (tok === "--template") {
      const next = tokens[i + 1];
      if (next === undefined || next.startsWith("--")) {
        return { error: "--template requires a name argument." };
      }
      template = next;
      i += 1;
      continue;
    }
    if (tok === "--locale") {
      const next = tokens[i + 1];
      if (next !== "ko" && next !== "en") {
        return { error: "--locale must be 'ko' or 'en'." };
      }
      locale = next;
      i += 1;
      continue;
    }
    if (tok.startsWith("--")) {
      return { error: `Unknown flag: ${tok}` };
    }
    intentParts.push(tok);
  }

  const intentRaw = intentParts.join(" ").trim();
  // Strip surrounding quotes if the user passed `"intent"` verbatim.
  const intent = intentRaw.replace(/^"(.*)"$/u, "$1").trim();
  if (intent.length === 0) {
    return { error: "Missing intent. Provide a natural-language research topic." };
  }
  return { intent, dryRun, fromFile, template, locale, forceNetwork };
}

// ─── --from-file loader ────────────────────────────────────────────────────

interface LoadedDraft {
  readonly metadata: Partial<PlasmidMetadata>;
}

async function loadCurrentDraft(
  fromFile: string,
  workingDirectory: string,
): Promise<LoadedDraft | { readonly error: string }> {
  const absolute = fromFile.startsWith("/")
    ? fromFile
    : `${workingDirectory.replace(/\/$/u, "")}/${fromFile}`;
  let raw: string;
  try {
    raw = await readFile(absolute, "utf8");
  } catch (err) {
    return { error: `--from-file: cannot read '${fromFile}': ${err instanceof Error ? err.message : String(err)}` };
  }
  let frontmatter: Record<string, unknown>;
  try {
    const split = splitFrontmatter(raw);
    frontmatter = parseYamlMetadata(split.rawMetadata);
  } catch (err) {
    return { error: `--from-file: '${fromFile}' frontmatter parse failed: ${err instanceof Error ? err.message : String(err)}` };
  }
  // Best-effort lift of the fields the research orchestrator + privacy gate
  // care about. We deliberately avoid running `plasmidMetadataSchema.parse()`
  // here — the schema is `.strict().superRefine(...)` so it both rejects
  // unknown keys AND requires every mandatory field, neither of which suits
  // a "draft seed". The orchestrator (Team 1) re-validates the merged result.
  // Using a mutable scratch type — `Partial<PlasmidMetadata>` is fully
  // readonly which blocks property assignment. We freeze structurally on
  // return by widening to `Partial<PlasmidMetadata>`.
  const lifted: { -readonly [K in keyof PlasmidMetadata]?: PlasmidMetadata[K] } = {};
  if (typeof frontmatter.id === "string") {
    lifted.id = frontmatter.id as PlasmidId;
  }
  if (typeof frontmatter.name === "string") lifted.name = frontmatter.name;
  if (typeof frontmatter.description === "string") lifted.description = frontmatter.description;
  if (
    frontmatter.tier === "L1" ||
    frontmatter.tier === "L2" ||
    frontmatter.tier === "L3" ||
    frontmatter.tier === "L4"
  ) {
    lifted.tier = frontmatter.tier;
  }
  if (
    frontmatter.scope === "local" ||
    frontmatter.scope === "shared" ||
    frontmatter.scope === "ephemeral" ||
    frontmatter.scope === "team"
  ) {
    lifted.scope = frontmatter.scope;
  }
  if (
    frontmatter.privacy === "local-only" ||
    frontmatter.privacy === "cloud-ok" ||
    frontmatter.privacy === "no-network"
  ) {
    lifted.privacy = frontmatter.privacy;
  }
  if (frontmatter.foundational === true) lifted.foundational = true;
  return { metadata: lifted };
}

// ─── output rendering ──────────────────────────────────────────────────────

function privacyBlockedResult(message: string): CommandResult {
  return {
    output: `[PLASMID_RESEARCH_PRIVACY_BLOCKED] ${message}`,
    success: false,
  };
}

/**
 * Compose the markdown the draft store will persist. We include a minimal
 * frontmatter block (driven by the metadata patch + currentDraft) followed
 * by the synthesised body. Subsequent `/plasmid edit` will let the user
 * tighten the frontmatter; this is intentionally a starting point, not a
 * publish-ready file.
 */
function renderMarkdown(
  args: ParsedArgs,
  result: Awaited<ReturnType<NonNullable<CommandDeps["runResearch"]>>>,
  currentDraft: Partial<PlasmidMetadata> | undefined,
): string {
  const fm: string[] = ["---"];
  const merged: Partial<PlasmidMetadata> = { ...currentDraft, ...result.metadataPatch };
  if (merged.id) fm.push(`id: ${merged.id}`);
  if (merged.name) fm.push(`name: ${merged.name}`);
  if (merged.description) fm.push(`description: ${merged.description}`);
  if (merged.tier) fm.push(`tier: ${merged.tier}`);
  if (merged.scope) fm.push(`scope: ${merged.scope}`);
  if (merged.privacy) fm.push(`privacy: ${merged.privacy}`);
  if (args.template) fm.push(`template: ${args.template}`);
  if (result.sources) {
    fm.push("source:");
    fm.push(`  engine: ${result.sources.engine}`);
    fm.push(`  query: ${quoteYamlString(result.sources.query)}`);
    fm.push(`  researchedAt: ${result.sources.researchedAt}`);
    fm.push("  references:");
    for (const ref of result.sources.references) {
      fm.push(`    - url: ${ref.url}`);
      fm.push(`      title: ${quoteYamlString(ref.title)}`);
      fm.push(`      fetchedAt: ${ref.fetchedAt}`);
      if (ref.contentSha256) fm.push(`      contentSha256: ${ref.contentSha256}`);
      if (ref.snippet) fm.push(`      snippet: ${quoteYamlString(ref.snippet)}`);
    }
  }
  fm.push("---", "");
  fm.push(result.synthesizedDraft);
  return fm.join("\n");
}

function quoteYamlString(value: string): string {
  // Conservative single-quote wrap; escape internal single quotes per YAML 1.2.
  return `'${value.replace(/'/gu, "''")}'`;
}

function deriveDraftId(intent: string): string {
  return (
    "research-" +
    intent
      .toLowerCase()
      .replace(/[^a-z0-9]+/gu, "-")
      .replace(/^-+|-+$/gu, "")
      .slice(0, 32)
  );
}

function formatSuccessOutput(
  args: ParsedArgs,
  draftId: PlasmidId,
  savedPath: string,
  result: Awaited<ReturnType<NonNullable<CommandDeps["runResearch"]>>>,
): string {
  const lines: string[] = [
    `Draft saved: ${draftId}`,
    `  path:     ${savedPath}`,
    `  query:    ${result.sources.query}`,
    `  refs:     ${result.sources.references.length}`,
  ];
  for (let i = 0; i < result.sources.references.length; i++) {
    const ref = result.sources.references[i];
    if (!ref) continue;
    lines.push(`    [${i + 1}] ${ref.title} — ${ref.url}`);
  }
  if (result.warnings.length > 0) {
    lines.push("", "warnings:");
    for (const w of result.warnings) lines.push(`  - ${w}`);
  }
  if (args.template) lines.push("", `template: ${args.template}`);
  lines.push("", "Next: /plasmid edit " + draftId + "  → tune frontmatter & body before activation.");
  return lines.join("\n");
}

/**
 * Phase 5 — `/plasmid challenge <id>` subcommand (P-1.10 §3, dev-guide §5).
 *
 * 3-option ceremony for foundational plasmids:
 *   override  — single-shot skip on next /recombination
 *   amend     — open $EDITOR; record before/after hashes
 *   revoke    — archive plasmid, mark dependents per flag
 *
 * Non-interactive surface (matches Phase-3 `/cure`); validation order is
 * fail-fast and every rejection returns a structured `CommandResult` with
 * `success: false`, the `PlasmidErrorCode` and a human-readable hint.
 *
 * Owned by Team 4 — Phase 5 GAL-1.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rename } from "node:fs/promises";
import { isAbsolute, join } from "node:path";

import type { CommandContext, CommandResult } from "../registry.js";
import type {
  ChallengeAction,
  ChallengeLogEntry,
  ChallengeableBy,
  LoadedPlasmid,
  PlasmidId,
} from "../../plasmids/types.js";
import { OVERRIDE_PENDING_PATH, PLASMIDS_ARCHIVE_DIR } from "../../plasmids/types.js";
import { asPlasmidId } from "../../plasmids/activation.js";
import type { CommandDeps } from "./deps.js";

// ─── Default-fill for `challengeable` (mirrors loader semantics) ───────────
const DEFAULT_CHALLENGEABLE: ChallengeableBy = {
  "require-justification": true,
  "min-justification-length": 50,
  "audit-log": true,
  "require-cooldown": "24h",
  "require-team-consensus": false,
  "min-approvers": 1,
};

const DEPENDENT_MODES = ["keep", "orphan", "revoke"] as const;
type DependentMode = (typeof DEPENDENT_MODES)[number];

const ACTIONS: readonly ChallengeAction[] = ["override", "amend", "revoke"];

function usage(): string {
  return [
    "Usage: /plasmid challenge <id> [--action <override|amend|revoke>]",
    "                              [--rationale \"<text>\"]",
    "                              [--dependents <keep|orphan|revoke>]",
    "                              [--confirm \"REVOKE <id>\"]",
    "                              [--yes]",
    "",
    "Without --action, prints a preview + ceremony requirements (read-only).",
  ].join("\n");
}

interface ParsedFlags {
  readonly action?: ChallengeAction;
  readonly rationale?: string;
  readonly dependents?: DependentMode;
  readonly confirm?: string;
  readonly yes: boolean;
}

type ParseResult =
  | { readonly id: PlasmidId; readonly flags: ParsedFlags }
  | { readonly error: string };

function parseArgs(args: readonly string[]): ParseResult {
  if (args.length === 0) {
    return { error: "Missing argument: <id>.\n" + usage() };
  }
  const head = args[0];
  if (head === undefined || head.startsWith("--")) {
    return { error: "Missing argument: <id>.\n" + usage() };
  }
  const id = asPlasmidId(head);

  let action: ChallengeAction | undefined;
  let rationale: string | undefined;
  let dependents: DependentMode | undefined;
  let confirm: string | undefined;
  let yes = false;

  for (let i = 1; i < args.length; i++) {
    const token = args[i];
    if (token === undefined) continue;

    if (token === "--yes" || token === "-y") {
      yes = true;
      continue;
    }

    if (token === "--action") {
      const value = args[++i];
      if (value === undefined) return { error: "--action requires a value" };
      if (!isAction(value)) {
        return {
          error: `Invalid --action '${value}'. Expected one of: ${ACTIONS.join(", ")}.`,
        };
      }
      action = value;
      continue;
    }
    const actionEq = matchEq(token, "--action=");
    if (actionEq !== undefined) {
      if (!isAction(actionEq)) {
        return {
          error: `Invalid --action '${actionEq}'. Expected one of: ${ACTIONS.join(", ")}.`,
        };
      }
      action = actionEq;
      continue;
    }

    if (token === "--rationale") {
      const value = args[++i];
      if (value === undefined) return { error: "--rationale requires a value" };
      rationale = value;
      continue;
    }
    const rationaleEq = matchEq(token, "--rationale=");
    if (rationaleEq !== undefined) {
      rationale = rationaleEq;
      continue;
    }

    if (token === "--dependents") {
      const value = args[++i];
      if (value === undefined) return { error: "--dependents requires a value" };
      if (!isDependentMode(value)) {
        return {
          error:
            `Invalid --dependents '${value}'. Expected one of: ${DEPENDENT_MODES.join(", ")}.`,
        };
      }
      dependents = value;
      continue;
    }
    const depEq = matchEq(token, "--dependents=");
    if (depEq !== undefined) {
      if (!isDependentMode(depEq)) {
        return {
          error:
            `Invalid --dependents '${depEq}'. Expected one of: ${DEPENDENT_MODES.join(", ")}.`,
        };
      }
      dependents = depEq;
      continue;
    }

    if (token === "--confirm") {
      // `--confirm` consumes the rest of this position as a single string. To
      // keep argv-style splitting predictable, accept either a quoted single
      // token (`--confirm "REVOKE foo"` → split into 2 tokens by tokenize)
      // OR `--confirm REVOKE foo`. We greedily eat the next two tokens iff
      // the first equals "REVOKE".
      const next = args[++i];
      if (next === undefined) return { error: "--confirm requires a value" };
      if (next === "REVOKE") {
        const idTok = args[++i];
        if (idTok === undefined) return { error: "--confirm REVOKE requires an id" };
        confirm = `REVOKE ${idTok}`;
      } else {
        confirm = next;
      }
      continue;
    }
    const confirmEq = matchEq(token, "--confirm=");
    if (confirmEq !== undefined) {
      confirm = confirmEq;
      continue;
    }

    return { error: `Unknown flag: '${token}'.\n${usage()}` };
  }

  return {
    id,
    flags: {
      ...(action !== undefined ? { action } : {}),
      ...(rationale !== undefined ? { rationale } : {}),
      ...(dependents !== undefined ? { dependents } : {}),
      ...(confirm !== undefined ? { confirm } : {}),
      yes,
    },
  };
}

function matchEq(token: string, prefix: string): string | undefined {
  if (!token.startsWith(prefix)) return undefined;
  return token.slice(prefix.length);
}

function isAction(s: string): s is ChallengeAction {
  return (ACTIONS as readonly string[]).includes(s);
}

function isDependentMode(s: string): s is DependentMode {
  return (DEPENDENT_MODES as readonly string[]).includes(s);
}

/** Effective `challengeable` block (loader default-fill mirror). */
function effectiveChallengeable(p: LoadedPlasmid): ChallengeableBy {
  return p.metadata.challengeable ?? DEFAULT_CHALLENGEABLE;
}

/**
 * Resolve dependents of `id` as the union (intersection of metadata refs):
 *   `requires`, `extends`, `conflicts` — any other plasmid that mentions
 *   `id` in any of those lists is considered a dependent (P-1.10 §3.4).
 */
function findDependents(
  id: PlasmidId,
  loaded: readonly LoadedPlasmid[],
): readonly PlasmidId[] {
  const out: PlasmidId[] = [];
  for (const p of loaded) {
    if (p.metadata.id === id) continue;
    const refs = new Set<PlasmidId>([
      ...(p.metadata.requires ?? []),
      ...(p.metadata.conflicts ?? []),
      ...(p.metadata.extends ? [p.metadata.extends] : []),
    ]);
    if (refs.has(id)) out.push(p.metadata.id);
  }
  return out;
}

function isoStamp(now: Date): string {
  return now.toISOString();
}

/** Filesystem-safe ISO marker (no colons). */
function isoStampSafe(now: Date): string {
  return now.toISOString().replace(/:/g, "-").replace(/\.\d+Z$/, "Z");
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function abs(workingDirectory: string, p: string): string {
  return isAbsolute(p) ? p : join(workingDirectory, p);
}

// ─── Action handlers ───────────────────────────────────────────────────────

interface CommonContext {
  readonly target: LoadedPlasmid;
  readonly rationale: string;
  readonly now: Date;
  readonly deps: CommandDeps;
  readonly context: CommandContext;
}

async function doOverride(c: CommonContext): Promise<CommandResult> {
  if (!c.deps.overridesPending || !c.deps.appendChallenge) {
    return missingGovernance("override");
  }
  const queued = await c.deps.overridesPending.enqueue(
    c.target.metadata.id,
    c.rationale,
    c.context.workingDirectory,
  );
  const entry: ChallengeLogEntry = {
    timestamp: isoStamp(c.now),
    plasmidId: c.target.metadata.id,
    action: "override",
    rationale: c.rationale,
  };
  await c.deps.appendChallenge(entry, c.context.workingDirectory);

  const path = c.deps.overridesPending.path(c.context.workingDirectory);
  return {
    output: [
      `Override queued for '${c.target.metadata.id}'.`,
      `  queued-at:  ${queued.queuedAt}`,
      `  rationale:  sha256:${queued.rationaleSha256.slice(0, 16)}…`,
      `  pending:    ${path}`,
      "",
      "The next /recombination run will skip this plasmid (consumed exactly once).",
    ].join("\n"),
    success: true,
  };
}

async function doAmend(c: CommonContext): Promise<CommandResult> {
  if (!c.deps.appendChallenge) {
    return missingGovernance("amend");
  }
  const previousHash = c.target.bodyFingerprint as string;

  // Open editor against body.md; on close re-read body and append the entry
  // with both hashes. We deliberately do NOT validate the edit — the user
  // is responsible; `/recombination` will re-run validators.
  const editor = resolveEditor(c.deps.editorCommand);
  const ctxSignal = (c.context as { readonly abortSignal?: AbortSignal }).abortSignal;
  const code = await runEditor(editor, c.target.sourcePath, ctxSignal);
  if (code !== 0) {
    return {
      output:
        `Editor exited with code ${code} — amend aborted, no log entry written.`,
      success: false,
    };
  }

  const newBody = await readFile(c.target.sourcePath, { encoding: "utf8" });
  const newHash = sha256Hex(stripTrailingNewline(newBody));

  const entry: ChallengeLogEntry = {
    timestamp: isoStamp(c.now),
    plasmidId: c.target.metadata.id,
    action: "amend",
    rationale: c.rationale,
    previousHash,
    newHash,
  };
  await c.deps.appendChallenge(entry, c.context.workingDirectory);

  return {
    output: [
      `Amended '${c.target.metadata.id}'.`,
      `  previousHash: ${previousHash.slice(0, 16)}…`,
      `  newHash:      ${newHash.slice(0, 16)}…`,
      `  editor:       ${editor}`,
      "",
      "Run /recombination to re-validate plasmids that consume this one.",
    ].join("\n"),
    success: true,
  };
}

async function doRevoke(
  c: CommonContext,
  loaded: readonly LoadedPlasmid[],
  dependentsMode: DependentMode,
  confirm: string | undefined,
): Promise<CommandResult> {
  if (!c.deps.appendChallenge) {
    return missingGovernance("revoke");
  }
  const id = c.target.metadata.id;
  const expected = `REVOKE ${id}`;
  if (confirm !== expected) {
    return {
      output: [
        `[PLASMID_CHALLENGE_NOT_FOUNDATIONAL precondition met] revoke requires explicit confirmation.`,
        `Type --confirm "${expected}" verbatim to proceed.`,
      ].join("\n"),
      success: false,
    };
  }

  const dependents = findDependents(id, loaded);

  // Atomic move (rename) — same FS guarantees atomicity.
  const archiveDir = abs(c.context.workingDirectory, PLASMIDS_ARCHIVE_DIR);
  await mkdir(archiveDir, { recursive: true });
  const stamp = isoStampSafe(c.now);
  const targetPath = join(archiveDir, `${id}-${stamp}.md`);
  await rename(c.target.sourcePath, targetPath);

  // Best-effort: also try to move the metadata.yaml (I-1) if it exists in
  // a separate file. The rename is wrapped so missing metadata doesn't
  // abort the revoke (loader allows single-file plasmids too).
  if (
    c.target.metadataPath &&
    c.target.metadataPath !== c.target.sourcePath
  ) {
    try {
      const metaTarget = join(archiveDir, `${id}-${stamp}.metadata.yaml`);
      await rename(c.target.metadataPath, metaTarget);
    } catch {
      // ignore — metadata file may not exist or already be archived
    }
  }

  const entry: ChallengeLogEntry = {
    timestamp: isoStamp(c.now),
    plasmidId: id,
    action: "revoke",
    rationale: c.rationale,
    dependentsAction:
      dependentsMode === "keep"
        ? "kept"
        : dependentsMode === "orphan"
          ? "orphaned"
          : "revoked",
  };
  await c.deps.appendChallenge(entry, c.context.workingDirectory);

  // Keep activation state in sync — silently no-op when not active. Without
  // this the next /recombination would still consider the (now-archived) id
  // active. For dependents=revoke we cascade the deactivation; orphan/keep
  // intentionally leaves them so the user can audit.
  const idsToDeactivate: PlasmidId[] = [id];
  if (dependentsMode === "revoke") idsToDeactivate.push(...dependents);
  await c.deps.activationStore.deactivate(idsToDeactivate);

  const lines = [
    `Revoked '${id}'.`,
    `  archived:   ${targetPath}`,
    `  dependents: ${dependents.length} (action: ${dependentsMode})`,
  ];
  if (dependents.length > 0) {
    for (const dep of dependents) {
      lines.push(`    - ${dep}`);
    }
  }
  if (dependentsMode === "orphan") {
    lines.push("");
    lines.push("Next /recombination will flag orphaned dependents for resolution.");
  }
  return { output: lines.join("\n"), success: true };
}

// ─── Helpers (editor + governance error message) ───────────────────────────

function missingGovernance(action: string): CommandResult {
  return {
    output: [
      `Cannot ${action}: governance subsystem not wired (Team 3 placeholder).`,
      `Inject 'appendChallenge' / 'overridesPending' / 'checkCooldown' via CommandDeps.`,
    ].join("\n"),
    success: false,
  };
}

function resolveEditor(injected?: string): string {
  if (injected && injected.trim() !== "") return injected;
  const env = process.env.EDITOR;
  if (env && env.trim() !== "") return env;
  return "vim";
}

async function runEditor(
  editor: string,
  path: string,
  signal?: AbortSignal,
): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const child = spawn(editor, [path], { stdio: "inherit", signal });
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 0));
  });
}

function stripTrailingNewline(text: string): string {
  return text.endsWith("\n") ? text.slice(0, -1) : text;
}

// ─── Preview rendering ─────────────────────────────────────────────────────

function renderPreview(
  target: LoadedPlasmid,
  rules: ChallengeableBy,
  dependents: readonly PlasmidId[],
  override_pending_path: string,
): string {
  const lines = [
    `Foundational plasmid: ${target.metadata.id} (tier: ${target.metadata.tier})`,
    `  description: ${target.metadata.description}`,
    `  version:     ${target.metadata.version}`,
    `  scope:       ${target.metadata.scope}`,
    `  privacy:     ${target.metadata.privacy}`,
    "",
    "Ceremony requirements:",
    `  - rationale  ≥ ${rules["min-justification-length"]} chars (verbatim)`,
    `  - cooldown:    ${rules["require-cooldown"]} (amend/revoke; override exempt)`,
    `  - audit-log:   ${rules["audit-log"] ? "yes" : "no"} → .dhelix/governance/challenges.log`,
    "",
    `Dependents (${dependents.length}):`,
    ...dependents.map((d) => `  - ${d}`),
    "",
    "Actions:",
    `  /plasmid challenge ${target.metadata.id} --action override --rationale "<...>"`,
    `  /plasmid challenge ${target.metadata.id} --action amend    --rationale "<...>"`,
    `  /plasmid challenge ${target.metadata.id} --action revoke   --rationale "<...>" --dependents <keep|orphan|revoke> --confirm "REVOKE ${target.metadata.id}"`,
    "",
    `Override queue path: ${override_pending_path}`,
  ];
  return lines.join("\n");
}

// ─── Public entry point ────────────────────────────────────────────────────

export async function challengeSubcommand(
  rest: readonly string[],
  context: CommandContext,
  deps: CommandDeps,
): Promise<CommandResult> {
  const parsed = parseArgs(rest);
  if ("error" in parsed) {
    return { output: parsed.error, success: false };
  }
  const { id, flags } = parsed;

  const { loaded } = await deps.loadPlasmids({
    workingDirectory: context.workingDirectory,
    registryPath: deps.registryPath,
    sharedRegistryPath: deps.sharedRegistryPath,
    draftsPath: deps.draftsPath,
    scopes: deps.scopes,
  });

  // Gate 1 — plasmid exists and is loaded
  const target = loaded.find((p) => p.metadata.id === id);
  if (!target) {
    return {
      output: `[PLASMID_NOT_FOUND] Plasmid not found: ${id}`,
      success: false,
    };
  }

  // Gate 2 — plasmid is foundational
  if (target.metadata.foundational !== true) {
    return {
      output: [
        `[PLASMID_CHALLENGE_NOT_FOUNDATIONAL] '${id}' is not a foundational plasmid.`,
        `The challenge ceremony only applies to foundational plasmids.`,
        `Use /plasmid edit ${id} or /plasmid deactivate ${id} for non-foundational changes.`,
      ].join("\n"),
      success: false,
    };
  }

  const rules = effectiveChallengeable(target);
  const dependents = findDependents(id, loaded);
  const overridePath =
    deps.overridesPending?.path(context.workingDirectory) ??
    abs(context.workingDirectory, OVERRIDE_PENDING_PATH);

  // Preview path — no --action means show ceremony + dependents
  if (flags.action === undefined) {
    return {
      output: renderPreview(target, rules, dependents, overridePath),
      success: true,
    };
  }

  // Gate 3 — action is one of {override, amend, revoke}. Already enforced
  // by parseArgs (`--action` validates against ACTIONS), so this is a
  // type-narrow assertion at runtime.
  const action = flags.action;

  // Gate 4 — rationale length ≥ effective min-justification-length
  const minLen = rules["min-justification-length"];
  const rationale = (flags.rationale ?? "").trim();
  if (rationale.length < minLen) {
    return {
      output: [
        `[PLASMID_CHALLENGE_JUSTIFICATION_TOO_SHORT] rationale must be ≥ ${minLen} chars (got ${rationale.length}).`,
        `Pass --rationale "<text>" with at least ${minLen} characters.`,
      ].join("\n"),
      success: false,
    };
  }

  // Gate 5 — cooldown for amend/revoke
  if (action !== "override") {
    if (!deps.checkCooldown || !deps.readChallengesLog) {
      return missingGovernance(action);
    }
    const log = await deps.readChallengesLog(context.workingDirectory);
    const decision = deps.checkCooldown({
      plasmidId: id,
      action,
      cooldown: rules["require-cooldown"],
      log,
      ...(deps.now ? { now: deps.now() } : {}),
    });
    if (!decision.ok) {
      const remainingHours = (decision.remainingMs / 3_600_000).toFixed(1);
      return {
        output: [
          `[PLASMID_CHALLENGE_COOLDOWN] '${id}' is cooling down — wait ~${remainingHours}h.`,
          `  cooldown:    ${rules["require-cooldown"]}`,
          `  next allowed: ${decision.waitUntil.toISOString()}`,
        ].join("\n"),
        success: false,
      };
    }
  }

  // Gate 6 + 7 — revoke requires --confirm verbatim AND dependents flag.
  // Dispatch
  const now = deps.now ? deps.now() : new Date();
  const common: CommonContext = {
    target,
    rationale,
    now,
    deps,
    context,
  };

  switch (action) {
    case "override":
      return doOverride(common);
    case "amend":
      return doAmend(common);
    case "revoke": {
      if (flags.dependents === undefined) {
        return {
          output: [
            `[PLASMID_CHALLENGE_NOT_FOUNDATIONAL precondition met] revoke requires --dependents.`,
            `Specify --dependents <keep|orphan|revoke>.`,
          ].join("\n"),
          success: false,
        };
      }
      return doRevoke(common, loaded, flags.dependents, flags.confirm);
    }
  }
}

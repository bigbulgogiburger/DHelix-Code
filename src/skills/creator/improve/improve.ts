/**
 * improveSkill — iteration rewriter for dhelix skills (Phase 3 deliverable P3.2)
 *
 * Given a skill's feedback.json + the latest iteration's grader output, call an
 * injectable LLM rewriter to produce a revised SKILL.md and write it as a
 * candidate (NOT overwriting the active SKILL.md). The caller runs /skill-eval
 * on the candidate before accepting.
 *
 * Disk layout produced:
 * ```
 * <skillDir>/workspace/iteration-<N+1>/skill-md-candidate.md
 * <skillDir>/workspace/history.json  ← appended with the new version
 * ```
 *
 * Dependency rule: this module lives at src/skills/** and must never import from
 * src/cli/. LLM access is wrapped behind `ImproveDeps.rewriteSkill` to keep the
 * boundary testable and layer-safe.
 *
 * @see src/skills/creator/evals/workspace.ts — appendHistory / getIterationDir
 * @see src/skills/creator/evals/grader.ts — LLM client pattern (reused for prod deps)
 * @see src/skills/manifest.ts — validateManifest ensures the rewriter kept the frontmatter
 */

import { createHash } from "node:crypto";
import * as defaultFs from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { LLM_DEFAULTS } from "../../../constants.js";
import { createLLMClientForModel } from "../../../llm/client-factory.js";
import type { ChatMessage, LLMProvider } from "../../../llm/provider.js";
import { validateManifest } from "../../manifest.js";
import type { HistoryEntry } from "../evals/types.js";
import {
  appendHistory,
  getIterationDir,
  readRunGrading,
} from "../evals/workspace.js";

// ---------------------------------------------------------------------------
// Public API — interfaces
// ---------------------------------------------------------------------------

/** One feedback note about a specific case, collected outside the harness. */
export interface Feedback {
  readonly caseId?: string;
  readonly note: string;
  readonly kind?: "add" | "clarify" | "remove" | "general";
}

/** The improvement rewriter LLM-like dep. Inject stubs in tests. */
export interface ImproveDeps {
  readonly rewriteSkill: (args: {
    readonly currentSkillMd: string;
    readonly feedback: readonly Feedback[];
    readonly failingExpectations?: readonly string[];
    readonly signal?: AbortSignal;
  }) => Promise<string>;
}

/** Result of a successful improvement iteration. */
export interface ImproveResult {
  readonly previousIteration: number;
  readonly newIteration: number;
  readonly historyEntry: HistoryEntry;
  readonly newSkillMdPath: string;
  readonly diffSummary: string;
}

/** Optional knobs for the improve call. */
export interface ImproveOptions {
  readonly signal?: AbortSignal;
  readonly fs?: typeof import("node:fs/promises");
  readonly now?: () => Date;
}

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

/** Known error codes surfaced by `improveSkill`. */
export type ImproveErrorCode =
  | "MISSING_SKILL"
  | "MISSING_FRONTMATTER"
  | "MANIFEST_INVALID"
  | "REWRITER_EMPTY"
  | "FEEDBACK_INVALID"
  | "ABORTED";

/** Domain error thrown by `improveSkill`. */
export class ImproveError extends Error {
  public readonly code: ImproveErrorCode;
  public readonly details: Readonly<Record<string, unknown>>;

  constructor(
    code: ImproveErrorCode,
    message: string,
    details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = "ImproveError";
    this.code = code;
    this.details = details;
  }
}

// ---------------------------------------------------------------------------
// Zod — feedback.json schema
// ---------------------------------------------------------------------------

const feedbackEntrySchema = z.object({
  caseId: z.string().min(1).optional(),
  note: z.string().min(1),
  kind: z.enum(["add", "clarify", "remove", "general"]).optional(),
});

const feedbackFileSchema = z.object({
  entries: z.array(feedbackEntrySchema).default([]),
});

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * Produce iteration-N+1 based on feedback.json + prior graders.
 *
 * Does NOT overwrite `<skillDir>/SKILL.md` — the caller runs /skill-eval on the
 * candidate first and explicitly accepts it.
 */
export async function improveSkill(
  args: {
    readonly skillDir: string;
    readonly skillName: string;
    readonly baselineIteration: number;
  },
  deps: ImproveDeps,
  opts: ImproveOptions = {},
): Promise<ImproveResult> {
  const fs = opts.fs ?? defaultFs;
  const now = opts.now ?? (() => new Date());
  const signal = opts.signal;

  if (signal?.aborted) {
    throw new ImproveError("ABORTED", "aborted before improveSkill started");
  }

  // 1. Load SKILL.md body ---------------------------------------------------
  const skillMdPath = join(args.skillDir, "SKILL.md");
  let currentSkillMd: string;
  try {
    currentSkillMd = await fs.readFile(skillMdPath, "utf8");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new ImproveError(
      "MISSING_SKILL",
      `SKILL.md not found at ${skillMdPath}: ${msg}. Run /create-skill first or pass the correct skill name.`,
      { skillMdPath },
    );
  }

  // 2. Load feedback.json (optional) ---------------------------------------
  const feedbackPath = join(args.skillDir, "workspace", "feedback.json");
  const feedback = await loadFeedback(feedbackPath, fs);

  // 3. Collect failing expectations from the baseline iteration -------------
  const failingExpectations = await collectFailingExpectations(
    args.skillDir,
    args.baselineIteration,
    // Try to discover case IDs from on-disk iteration dir. If we fail, we
    // still call the rewriter with an empty list.
    await listCaseIds(args.skillDir, args.baselineIteration, fs),
  );

  // 4. Call the rewriter ---------------------------------------------------
  if (signal?.aborted) {
    throw new ImproveError("ABORTED", "aborted before rewriter call");
  }
  const revisedRaw = await deps.rewriteSkill({
    currentSkillMd,
    feedback,
    failingExpectations,
    signal,
  });

  const revised = revisedRaw.trim();
  if (revised.length === 0) {
    throw new ImproveError(
      "REWRITER_EMPTY",
      "rewriter returned an empty revision",
    );
  }

  // 5. Validate frontmatter + manifest --------------------------------------
  const frontmatter = extractFrontmatter(revised);
  if (!frontmatter) {
    throw new ImproveError(
      "MISSING_FRONTMATTER",
      "revised SKILL.md did not contain a YAML frontmatter block (expected leading `---` delimited section)",
    );
  }
  const parsedYaml = parseSimpleYaml(frontmatter);
  const validation = validateManifest(parsedYaml);
  if (!validation.valid) {
    throw new ImproveError(
      "MANIFEST_INVALID",
      `revised SKILL.md frontmatter failed manifest validation: ${validation.errors.join("; ")}`,
      { errors: validation.errors },
    );
  }

  // 6. Write candidate ------------------------------------------------------
  const newIteration = args.baselineIteration + 1;
  const iterDir = getIterationDir(args.skillDir, newIteration);
  await fs.mkdir(iterDir, { recursive: true });
  const newSkillMdPath = join(iterDir, "skill-md-candidate.md");
  await fs.writeFile(newSkillMdPath, revised, "utf8");

  // 7. Append history -------------------------------------------------------
  const priorRate = await readPriorPassRate(args.skillDir, args.baselineIteration, fs);
  const historyEntry: HistoryEntry = {
    version: newIteration,
    parent_version: args.baselineIteration,
    description: `improvement of ${args.skillName} (iteration ${String(newIteration)})`,
    skill_md_hash: shortHash(revised),
    expectation_pass_rate: priorRate,
    grading_result: "tie",
    created_at: now().toISOString(),
  };
  await appendHistory(args.skillDir, historyEntry, { fs });

  // 8. Compose human-readable diff summary ---------------------------------
  const diffSummary = buildDiffSummary({
    feedback,
    failingExpectations,
    previousLines: currentSkillMd.split("\n").length,
    newLines: revised.split("\n").length,
  });

  return {
    previousIteration: args.baselineIteration,
    newIteration,
    historyEntry,
    newSkillMdPath,
    diffSummary,
  };
}

// ---------------------------------------------------------------------------
// Production deps
// ---------------------------------------------------------------------------

const DEFAULT_REWRITER_MODEL = "claude-sonnet-4-5-20250929";
const DEFAULT_REWRITER_MAX_TOKENS = 8192;
const DEFAULT_REWRITER_TEMPERATURE = 0.2;

const REWRITER_SYSTEM_PROMPT = [
  "You refine dhelix skills.",
  "Preserve the YAML frontmatter block (`---` delimited) at the top of SKILL.md.",
  "Update the description and body to address the feedback and failing expectations.",
  "Keep the body under 500 lines. Return the FULL revised SKILL.md (frontmatter + body) and nothing else.",
].join("\n");

/**
 * Build a production `ImproveDeps` by wrapping `createLLMClientForModel`.
 *
 * Mirrors the grader's wiring pattern. Callers who need a fully-custom rewriter
 * can skip this and supply their own `ImproveDeps`.
 */
export function createProductionImproveDeps(opts: {
  readonly model?: string;
} = {}): ImproveDeps {
  const model = opts.model ?? DEFAULT_REWRITER_MODEL;
  const apiKey =
    process.env.ANTHROPIC_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.LOCAL_API_KEY ||
    process.env.DHELIX_API_KEY ||
    "";

  const provider: LLMProvider = createLLMClientForModel({
    model,
    baseURL: LLM_DEFAULTS.baseUrl,
    apiKey,
    timeout: 120_000,
  });

  return {
    rewriteSkill: async ({ currentSkillMd, feedback, failingExpectations, signal }) => {
      if (signal?.aborted) {
        throw new ImproveError("ABORTED", "aborted before rewriter LLM call");
      }
      const messages: readonly ChatMessage[] = [
        { role: "system", content: REWRITER_SYSTEM_PROMPT },
        {
          role: "user",
          content: buildRewriterUserPrompt({
            currentSkillMd,
            feedback,
            failingExpectations: failingExpectations ?? [],
          }),
        },
      ];
      const response = await provider.chat({
        model,
        messages,
        temperature: DEFAULT_REWRITER_TEMPERATURE,
        maxTokens: DEFAULT_REWRITER_MAX_TOKENS,
        signal,
      });
      return response.content;
    },
  };
}

function buildRewriterUserPrompt(args: {
  readonly currentSkillMd: string;
  readonly feedback: readonly Feedback[];
  readonly failingExpectations: readonly string[];
}): string {
  const feedbackLines =
    args.feedback.length === 0
      ? "(none)"
      : args.feedback
          .map((f) => {
            const prefix = f.caseId ? `[${f.caseId}] ` : "";
            const kind = f.kind ? ` (${f.kind})` : "";
            return `- ${prefix}${f.note}${kind}`;
          })
          .join("\n");
  const failingLines =
    args.failingExpectations.length === 0
      ? "(none)"
      : args.failingExpectations.map((e) => `- ${e}`).join("\n");
  return [
    "# Current SKILL.md",
    "```markdown",
    args.currentSkillMd,
    "```",
    "",
    "# Feedback",
    feedbackLines,
    "",
    "# Failing expectations from latest evals iteration",
    failingLines,
    "",
    "Return the revised SKILL.md now.",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Helpers — feedback / expectations / history
// ---------------------------------------------------------------------------

type FsLike = typeof import("node:fs/promises");

async function loadFeedback(
  path: string,
  fs: FsLike,
): Promise<readonly Feedback[]> {
  let raw: string;
  try {
    raw = await fs.readFile(path, "utf8");
  } catch {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new ImproveError(
      "FEEDBACK_INVALID",
      `feedback.json is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
      { path },
    );
  }
  const result = feedbackFileSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    throw new ImproveError(
      "FEEDBACK_INVALID",
      `feedback.json failed schema validation: ${issues}`,
      { path },
    );
  }
  return result.data.entries.map((e) => ({
    ...(e.caseId !== undefined ? { caseId: e.caseId } : {}),
    note: e.note,
    ...(e.kind !== undefined ? { kind: e.kind } : {}),
  }));
}

/**
 * Enumerate `eval-*` case directories inside iteration-N so we know which
 * cases to look up graders for. Failure is non-fatal — we return [].
 */
async function listCaseIds(
  skillDir: string,
  iteration: number,
  fs: FsLike,
): Promise<readonly string[]> {
  const iterDir = getIterationDir(skillDir, iteration);
  let entries: readonly string[] = [];
  try {
    entries = await fs.readdir(iterDir);
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const name of entries) {
    const m = /^eval-(.+)$/.exec(name);
    if (m && m[1]) out.push(m[1]);
  }
  return out;
}

async function collectFailingExpectations(
  skillDir: string,
  iteration: number,
  caseIds: readonly string[],
): Promise<readonly string[]> {
  if (caseIds.length === 0) return [];
  const seen = new Set<string>();
  for (const caseId of caseIds) {
    const grading = await readRunGrading(skillDir, iteration, caseId, "with_skill");
    if (!grading) continue;
    for (const exp of grading.expectations) {
      if (!exp.passed) seen.add(exp.text);
    }
  }
  return [...seen];
}

async function readPriorPassRate(
  skillDir: string,
  iteration: number,
  fs: FsLike,
): Promise<number> {
  const historyPath = join(skillDir, "workspace", "history.json");
  try {
    const raw = await fs.readFile(historyPath, "utf8");
    const parsed = JSON.parse(raw) as {
      readonly entries?: ReadonlyArray<{
        readonly version: number;
        readonly expectation_pass_rate?: number;
      }>;
    };
    const entry = parsed.entries?.find((e) => e.version === iteration);
    if (entry && typeof entry.expectation_pass_rate === "number") {
      return entry.expectation_pass_rate;
    }
  } catch {
    // fall through
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Frontmatter parsing
// ---------------------------------------------------------------------------

/** Extract YAML-like frontmatter content between leading `---` delimiters. */
function extractFrontmatter(skillMd: string): string | undefined {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(skillMd);
  if (!match || !match[1]) return undefined;
  return match[1];
}

/**
 * Parse a very small subset of YAML sufficient for dhelix frontmatter:
 * - `key: value` lines (string values)
 * - Quoted values `key: "value"` or `key: 'value'`
 *
 * This avoids pulling in a YAML dependency. Lines we don't understand are
 * skipped. Production skills use richer YAML — in that case the rewriter prompt
 * should still keep the frontmatter intact, and `validateManifest` will catch
 * structural issues via Zod.
 */
function parseSimpleYaml(src: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const lines = src.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf(":");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (key.length === 0) continue;
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (value.length === 0) continue;
    out[key] = value;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Misc helpers
// ---------------------------------------------------------------------------

function shortHash(body: string): string {
  return createHash("sha256").update(body).digest("hex").slice(0, 12);
}

function buildDiffSummary(args: {
  readonly feedback: readonly Feedback[];
  readonly failingExpectations: readonly string[];
  readonly previousLines: number;
  readonly newLines: number;
}): string {
  const parts: string[] = [];
  parts.push(
    `lines: ${String(args.previousLines)} → ${String(args.newLines)} (${args.newLines >= args.previousLines ? "+" : ""}${String(args.newLines - args.previousLines)})`,
  );
  parts.push(`feedback notes applied: ${String(args.feedback.length)}`);
  parts.push(
    `failing expectations addressed: ${String(args.failingExpectations.length)}`,
  );
  return parts.join("\n");
}

/**
 * Stage-5 static wiring validator — P-1.3 v0.2 (14 checks).
 *
 * Phase 2 MVP implements the 8 checks that can be computed without deep
 * filesystem traversal: reference completeness for generator-declared
 * `requiredTools`, YAML frontmatter schema sanity, marker duplication
 * inside `ReorgPlan`, path scoping under `.dhelix/`, template origin
 * drift, and default-trust auto-application.
 *
 * The remaining checks (cyclic-dependency, trigger-conflict,
 * permission-mismatch, ...) are emitted only when trivially detectable
 * by the current information set; otherwise they are skipped with a
 * TODO comment for Phase 3+.
 *
 * Layer: Core. Depends on `./types.js` only (pure function).
 */
import type {
  GeneratedArtifact,
  ReorgPlan,
  WiringCheckId,
  WiringFinding,
  WiringReport,
  WiringSeverity,
} from "./types.js";

/**
 * Per-check severity map — mirrors P-1.3 §2. Findings we emit take their
 * severity from this table unless the check itself demands a downgrade.
 */
const SEVERITY: Readonly<Record<WiringCheckId, WiringSeverity>> = {
  WIRING_REFERENCE_MISSING_TOOL: "ERROR",
  WIRING_REFERENCE_MISSING_SKILL: "ERROR",
  WIRING_REFERENCE_MISSING_AGENT: "ERROR",
  WIRING_PERMISSION_MISMATCH: "ERROR",
  WIRING_TRUST_DOWNGRADE_REQUIRED: "ERROR",
  WIRING_CYCLIC_DEPENDENCY: "ERROR",
  WIRING_TRIGGER_CONFLICT: "WARN",
  WIRING_SYNTAX_INVALID: "ERROR",
  WIRING_MARKER_UNTERMINATED: "ERROR",
  WIRING_MARKER_DUPLICATE: "ERROR",
  WIRING_FRONTMATTER_SCHEMA: "ERROR",
  WIRING_PATH_OUT_OF_SCOPE: "ERROR",
  WIRING_TEMPLATE_DRIFT: "WARN",
  WIRING_DEFAULT_TRUST_APPLIED: "INFO",
};

/** Approximate registry of well-known built-in tools used for Phase 2. */
const KNOWN_TOOL_PREFIXES: readonly string[] = [
  "read",
  "write",
  "edit",
  "bash",
  "grep",
  "glob",
  "ls",
  "task",
  "plan",
  "thinking",
  "todo",
  "notebook",
  "webfetch",
  "websearch",
  "memory",
];

/**
 * Run the Phase-2 MVP check set.
 *
 * The validator is pure w.r.t. the supplied artifacts + plan. We do not
 * hit the filesystem — that is the job of the Phase 3 `runtime-validator`
 * which can afford to parse every written file. Keeping the Stage-5
 * hot-path lightweight lets us run it before persistence in dry-run too.
 */
export async function validateWiring(
  artifacts: readonly GeneratedArtifact[],
  reorgPlan: ReorgPlan,
  workingDirectory: string,
  signal?: AbortSignal,
): Promise<WiringReport> {
  if (signal?.aborted) {
    throw new Error("validateWiring: aborted");
  }
  // Keep `workingDirectory` in the signature for Phase 3 filesystem probes.
  void workingDirectory;

  const findings: WiringFinding[] = [];
  const emit = (
    checkId: WiringCheckId,
    partial: Omit<WiringFinding, "checkId" | "severity">,
  ): void => {
    findings.push({
      checkId,
      severity: SEVERITY[checkId],
      ...partial,
    });
  };

  // ── 1. Reference integrity — tool references ─────────────────────────────
  for (const art of artifacts) {
    if (art.requiredTools === undefined) continue;
    for (const tool of art.requiredTools) {
      if (!looksLikeKnownTool(tool)) {
        emit("WIRING_REFERENCE_MISSING_TOOL", {
          artifactPath: art.targetPath,
          sourcePlasmid: art.sourcePlasmid,
          message: `Artifact references unknown tool '${tool}'.`,
          remediation: `Register '${tool}' or drop the reference from requiredTools.`,
        });
      }
    }
  }

  // ── 2. Syntax / frontmatter sanity ────────────────────────────────────────
  for (const art of artifacts) {
    if (!looksLikeMarkdown(art.targetPath)) continue;
    const problem = inspectFrontmatter(art.contents);
    if (problem === "missing") {
      emit("WIRING_FRONTMATTER_SCHEMA", {
        artifactPath: art.targetPath,
        sourcePlasmid: art.sourcePlasmid,
        message: "Markdown artifact is missing required YAML frontmatter.",
        remediation: "Add a --- frontmatter block with at least `name` and `description`.",
      });
    } else if (problem === "unterminated") {
      emit("WIRING_SYNTAX_INVALID", {
        artifactPath: art.targetPath,
        sourcePlasmid: art.sourcePlasmid,
        message: "YAML frontmatter opens with `---` but never closes.",
      });
    }
  }

  // ── 3. Marker duplication / unterminated (ReorgPlan) ─────────────────────
  const markerCount = new Map<string, number>();
  for (const op of reorgPlan.ops) {
    markerCount.set(op.markerId, (markerCount.get(op.markerId) ?? 0) + 1);
  }
  for (const [markerId, n] of markerCount) {
    if (n > 1) {
      emit("WIRING_MARKER_DUPLICATE", {
        message: `Marker '${markerId}' appears ${n} times in the reorg plan.`,
        remediation: "Merge the duplicated ops or rename one of the markers.",
      });
    }
  }
  for (const op of reorgPlan.ops) {
    if (op.kind === "update" && op.body.trim() === "") {
      emit("WIRING_MARKER_UNTERMINATED", {
        message: `Update op for marker '${op.markerId}' has empty body.`,
        remediation: "Provide the replacement body or convert to a 'remove' op.",
      });
    }
  }

  // ── 4. Path scoping (every artifact MUST live inside .dhelix/) ───────────
  for (const art of artifacts) {
    if (!isUnderDhelix(art.targetPath)) {
      emit("WIRING_PATH_OUT_OF_SCOPE", {
        artifactPath: art.targetPath,
        sourcePlasmid: art.sourcePlasmid,
        message: `Artifact target path '${art.targetPath}' is outside .dhelix/.`,
        remediation: "Artifacts must live under .dhelix/{agents,skills,commands,hooks,rules}.",
      });
    }
  }

  // ── 5. Template drift (Phase-2 heuristic) ────────────────────────────────
  //  Warn when an artifact claims the `project` layer yet has no template
  //  id. Phase 3 will hash the template body and compare against the
  //  registry snapshot for real drift detection.
  for (const art of artifacts) {
    if (art.templateLayer === "project" && art.templateId.trim() === "") {
      emit("WIRING_TEMPLATE_DRIFT", {
        artifactPath: art.targetPath,
        sourcePlasmid: art.sourcePlasmid,
        message: "Project-layer artifact has no templateId.",
      });
    }
  }

  // ── 6. Default trust applied (INFO only) ──────────────────────────────────
  for (const art of artifacts) {
    if (art.trustLevel === undefined && art.kind === "hook") {
      emit("WIRING_DEFAULT_TRUST_APPLIED", {
        artifactPath: art.targetPath,
        sourcePlasmid: art.sourcePlasmid,
        message: `Hook artifact '${art.targetPath}' has no trustLevel; default T0 applied.`,
      });
    }
  }

  // ── 7. Trivial cycle detection — self-extending plasmid ──────────────────
  for (const op of reorgPlan.ops) {
    if (
      op.locationAfter !== undefined &&
      op.locationAfter === op.markerId
    ) {
      emit("WIRING_CYCLIC_DEPENDENCY", {
        message: `Reorg op for '${op.markerId}' declares itself as anchor.`,
      });
    }
  }

  // TODO (Phase 3): WIRING_REFERENCE_MISSING_SKILL / MISSING_AGENT — require
  // filesystem scan of existing `.dhelix/skills/` + `.dhelix/agents/`.
  // TODO (Phase 3): WIRING_PERMISSION_MISMATCH / TRUST_DOWNGRADE_REQUIRED —
  // needs PermissionDB integration.
  // TODO (Phase 3): WIRING_TRIGGER_CONFLICT — needs hook manifest parse.

  const errorCount = findings.filter((f) => f.severity === "ERROR").length;
  const warnCount = findings.filter((f) => f.severity === "WARN").length;
  const infoCount = findings.filter((f) => f.severity === "INFO").length;

  return {
    findings,
    errorCount,
    warnCount,
    infoCount,
    passed: errorCount === 0,
  };
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function looksLikeKnownTool(tool: string): boolean {
  const normalized = tool.trim().toLowerCase();
  if (normalized === "") return false;
  // Allow any tool that starts with a known prefix or uses `namespace:name`.
  if (normalized.includes(":")) return true;
  return KNOWN_TOOL_PREFIXES.some((p) => normalized.startsWith(p));
}

function looksLikeMarkdown(path: string): boolean {
  return path.toLowerCase().endsWith(".md");
}

type FrontmatterProblem = "ok" | "missing" | "unterminated";

function inspectFrontmatter(contents: string): FrontmatterProblem {
  const trimmed = contents.trimStart();
  if (!trimmed.startsWith("---")) return "missing";
  const afterOpen = trimmed.slice(3);
  // The frontmatter MUST be followed by a newline and a terminating `---`.
  if (!/^\r?\n/.test(afterOpen)) return "unterminated";
  const terminator = afterOpen.indexOf("\n---");
  if (terminator === -1) return "unterminated";
  return "ok";
}

function isUnderDhelix(path: string): boolean {
  // The generator emits absolute paths; accept any path that contains the
  // `.dhelix/` segment. On Windows backslashes get normalized earlier.
  return path.includes(".dhelix/") || path.includes(".dhelix\\");
}

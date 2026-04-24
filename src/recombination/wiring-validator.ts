/**
 * Stage-5 static wiring validator — P-1.3 v0.3 (Phase 4 extends Phase 2 MVP).
 *
 * Phase 2 MVP implements 8 checks that can be computed without deep
 * filesystem traversal: reference completeness for generator-declared
 * `requiredTools`, YAML frontmatter schema sanity, marker duplication
 * inside `ReorgPlan`, path scoping under `.dhelix/`, template origin
 * drift, and default-trust auto-application.
 *
 * Phase 4 (Team 3) adds two full passes:
 *   - **Permission Alignment** — cross-check `requiredTools` against
 *     `TOOL_MIN_TRUST` + optional plasmid-tier ceiling via
 *     `PLASMID_TIER_TRUST_CEILING`.
 *   - **Cyclical Dependency** — build a directed graph over the current
 *     artifact set (agents/skills/commands/hooks/rules) using a tolerant
 *     flat-YAML reader for frontmatter arrays + in-body `@agent-<name>`
 *     mentions, then run Tarjan's SCC (iterative) to detect cycles.
 *     Dangling refs inside the same run emit
 *     `WIRING_REFERENCE_MISSING_SKILL` / `_AGENT`.
 *
 * Layer: Core. Depends on `./types.js` + `../plasmids/types.js` only
 * (pure function — no filesystem I/O).
 */
import type { PlasmidId, PlasmidTier } from "../plasmids/types.js";
import type {
  ArtifactTrustLevel,
  GeneratedArtifact,
  IntentKind,
  ReorgPlan,
  WiringCheckId,
  WiringFinding,
  WiringReport,
  WiringSeverity,
} from "./types.js";
import {
  PLASMID_TIER_TRUST_CEILING,
  TOOL_MIN_TRUST,
  TRUST_ORDER,
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

/** Default trust level assumed when a generator omits `trustLevel`. */
const DEFAULT_ARTIFACT_TRUST: ArtifactTrustLevel = "T0";

/**
 * Context carried across Phase 4+ passes. Phase 2 callers omit this entire
 * argument; Phase 4 executor (Team 5) supplies `plasmidTiers` for the
 * trust-downgrade cross-check.
 */
export interface WiringValidatorContext {
  readonly plasmidTiers?: ReadonlyMap<PlasmidId, PlasmidTier>;
}

/**
 * Run the full check set (Phase 2 MVP + Phase 4 passes).
 *
 * The validator is pure w.r.t. the supplied artifacts + plan. We do not
 * hit the filesystem — runtime filesystem probes live in Phase 5's
 * `runtime-validator`. Keeping the Stage-5 hot-path lightweight lets us
 * run it before persistence in dry-run too.
 *
 * @param artifacts       Generated artifacts about to be written.
 * @param reorgPlan       ReorgPlan returned by Stage 2d.
 * @param workingDirectory Reserved for Phase 5 filesystem probes.
 * @param signal          Abort signal; checked at entry.
 * @param context         Phase 4 tier context; defaults to `{}`.
 */
export async function validateWiring(
  artifacts: readonly GeneratedArtifact[],
  reorgPlan: ReorgPlan,
  workingDirectory: string,
  signal?: AbortSignal,
  context: WiringValidatorContext = {},
): Promise<WiringReport> {
  if (signal?.aborted) {
    throw new Error("validateWiring: aborted");
  }
  // Keep `workingDirectory` in the signature for Phase 5 filesystem probes.
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
  //  id. Phase 5 will hash the template body and compare against the
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

  // ── 8. Permission alignment (Phase 4 — Team 3) ───────────────────────────
  for (const art of artifacts) {
    const artTrust: ArtifactTrustLevel = art.trustLevel ?? DEFAULT_ARTIFACT_TRUST;
    const artTrustIdx = trustIndex(artTrust);
    for (const tool of art.requiredTools ?? []) {
      const normalized = tool.trim().toLowerCase();
      const minTrust = TOOL_MIN_TRUST[normalized];
      if (minTrust === undefined) continue; // reference-check handles unknowns.
      if (trustIndex(minTrust) > artTrustIdx) {
        emit("WIRING_PERMISSION_MISMATCH", {
          artifactPath: art.targetPath,
          sourcePlasmid: art.sourcePlasmid,
          message:
            `Tool '${normalized}' requires min trust ${minTrust} but artifact ` +
            `declares ${artTrust}.`,
          remediation: `Raise artifact trustLevel to ${minTrust} or drop the tool.`,
        });
      }
    }
    // Tier cross-check — only runs when executor supplied plasmidTiers.
    const tier = context.plasmidTiers?.get(art.sourcePlasmid);
    if (tier !== undefined) {
      const ceiling = PLASMID_TIER_TRUST_CEILING[tier];
      if (trustIndex(artTrust) > trustIndex(ceiling)) {
        emit("WIRING_TRUST_DOWNGRADE_REQUIRED", {
          artifactPath: art.targetPath,
          sourcePlasmid: art.sourcePlasmid,
          message:
            `Plasmid tier ${tier} caps artifact trust at ${ceiling}, but ` +
            `artifact declares ${artTrust}.`,
          remediation: `Downgrade trustLevel to ${ceiling} or promote the plasmid tier.`,
        });
      }
    }
  }

  // ── 9. Cyclical dependency (Phase 4 — Team 3, Tarjan SCC) ────────────────
  const graph = buildDependencyGraph(artifacts);
  // Dangling refs first — they're referenced from within the same run.
  for (const edge of graph.edges) {
    if (graph.nodes.has(edge.to)) continue;
    const [targetKind] = splitNodeId(edge.to);
    if (targetKind === "skill") {
      emit("WIRING_REFERENCE_MISSING_SKILL", {
        artifactPath: edge.fromPath,
        sourcePlasmid: edge.fromPlasmid,
        message: `Artifact '${edge.from}' references missing skill '${edge.to}'.`,
        remediation: `Generate skill '${edge.to}' or remove the reference.`,
      });
    } else if (targetKind === "agent") {
      emit("WIRING_REFERENCE_MISSING_AGENT", {
        artifactPath: edge.fromPath,
        sourcePlasmid: edge.fromPlasmid,
        message: `Artifact '${edge.from}' references missing agent '${edge.to}'.`,
        remediation: `Generate agent '${edge.to}' or remove the reference.`,
      });
    }
    // Missing hooks fall through — hook refs are advisory for Phase 4.
  }
  // Tarjan SCC over the intra-run graph only.
  const components = tarjanSCC(graph);
  for (const component of components) {
    if (component.length < 2) continue; // self-loops handled upstream.
    emit("WIRING_CYCLIC_DEPENDENCY", {
      message: `Cycle detected: ${renderCycle(component)}`,
      remediation: "Break the cycle by removing one of the references.",
    });
  }

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

function trustIndex(level: ArtifactTrustLevel): number {
  return TRUST_ORDER.indexOf(level);
}

// ─── dependency graph construction ───────────────────────────────────────────

interface GraphEdge {
  readonly from: string;
  readonly to: string;
  readonly fromPath: string;
  readonly fromPlasmid: PlasmidId;
}

interface DependencyGraph {
  readonly nodes: ReadonlyMap<string, IntentKind>;
  readonly edges: readonly GraphEdge[];
  readonly adjacency: ReadonlyMap<string, readonly string[]>;
}

/**
 * Build a directed dependency graph across the current artifact set.
 *
 * Node id format: `${kind}:${kebabName}` — kebab-name derivation:
 *   - agent / rule / command / harness → basename without extension.
 *   - skill → parent directory name (path ends with `.dhelix/skills/<name>/SKILL.md`).
 *   - hook  → `<Event>/<name>` — path ends with `.dhelix/hooks/<Event>/<name>.sh|md`.
 *
 * Edge rules (MVP per PRD §8.1):
 *   - agent   → `skills:` frontmatter → `skill:<name>`
 *   - skill   → frontmatter `requires:` + body `@agent-<name>` mentions.
 *   - command → `triggers:` → `hook:<name>`; `skills:` → `skill:<name>`.
 *   - hook / harness → no outgoing edges in Phase 4.
 */
function buildDependencyGraph(
  artifacts: readonly GeneratedArtifact[],
): DependencyGraph {
  const nodes = new Map<string, IntentKind>();
  const edges: GraphEdge[] = [];

  for (const art of artifacts) {
    const nodeId = nodeIdFor(art);
    if (nodeId === undefined) continue;
    nodes.set(nodeId, art.kind);
  }

  for (const art of artifacts) {
    const fromId = nodeIdFor(art);
    if (fromId === undefined) continue;
    const fm = parseFrontmatterForChecks(art.contents);
    const outgoing = collectOutgoing(art, fm);
    for (const to of outgoing) {
      edges.push({
        from: fromId,
        to,
        fromPath: art.targetPath,
        fromPlasmid: art.sourcePlasmid,
      });
    }
  }

  // Adjacency — filtered to edges whose target is actually a known node.
  const adjacency = new Map<string, string[]>();
  for (const id of nodes.keys()) adjacency.set(id, []);
  for (const edge of edges) {
    if (!nodes.has(edge.to)) continue;
    adjacency.get(edge.from)?.push(edge.to);
  }

  return { nodes, edges, adjacency };
}

function nodeIdFor(art: GeneratedArtifact): string | undefined {
  const name = kebabNameFor(art);
  if (name === undefined) return undefined;
  return `${art.kind}:${name}`;
}

function kebabNameFor(art: GeneratedArtifact): string | undefined {
  // Normalize separators; the generator may emit posix or windows paths.
  const normalized = art.targetPath.replace(/\\/g, "/");
  const segments = normalized.split("/").filter((s) => s.length > 0);
  if (segments.length === 0) return undefined;

  if (art.kind === "skill") {
    // `.dhelix/skills/<name>/SKILL.md` — the directory immediately above
    // the file is the skill name.
    if (segments.length < 2) return undefined;
    return segments[segments.length - 2];
  }

  if (art.kind === "hook") {
    // `.dhelix/hooks/<Event>/<name>.sh` or `<name>.md`.
    if (segments.length < 2) return undefined;
    const event = segments[segments.length - 2];
    const base = stripExtension(segments[segments.length - 1]);
    if (event === undefined || base === undefined) return undefined;
    return `${event}/${base}`;
  }

  // agent / rule / command / harness — basename without extension.
  const last = segments[segments.length - 1];
  if (last === undefined) return undefined;
  return stripExtension(last);
}

function stripExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot <= 0) return filename;
  return filename.slice(0, dot);
}

function collectOutgoing(
  art: GeneratedArtifact,
  frontmatter: Record<string, readonly string[]>,
): readonly string[] {
  const out: string[] = [];
  const push = (kind: IntentKind, name: string): void => {
    const trimmed = name.trim();
    if (trimmed === "") return;
    out.push(`${kind}:${trimmed}`);
  };

  const skills = frontmatter["skills"] ?? [];
  const requires = frontmatter["requires"] ?? [];
  const triggers = frontmatter["triggers"] ?? [];
  const agents = frontmatter["agents"] ?? [];

  if (art.kind === "agent") {
    for (const s of skills) push("skill", s);
    for (const a of agents) push("agent", a);
  } else if (art.kind === "skill") {
    for (const r of requires) push("skill", r);
    // Body scan: `@agent-<kebab>` mentions — the first non-word char or
    // whitespace terminates the name. Capture unique mentions only.
    const seen = new Set<string>();
    const bodyRegex = /@agent-([a-z0-9][a-z0-9-]*)/gi;
    let match: RegExpExecArray | null;
    while ((match = bodyRegex.exec(art.contents)) !== null) {
      const name = match[1]?.toLowerCase();
      if (name !== undefined && !seen.has(name)) {
        seen.add(name);
        push("agent", name);
      }
    }
  } else if (art.kind === "command") {
    for (const t of triggers) push("hook", t);
    for (const s of skills) push("skill", s);
  }
  // hook / rule / harness — no outgoing edges in Phase 4 MVP.

  return out;
}

/**
 * Tolerant flat-YAML reader — extracts only the array-valued keys we care
 * about (`skills`, `agents`, `triggers`, `requires`). Supports both the
 * inline form (`key: [a, b, c]`) and the block form:
 *
 * ```yaml
 * skills:
 *   - skill-a
 *   - skill-b
 * ```
 *
 * All other keys are ignored. Missing / malformed frontmatter yields an
 * empty record. No third-party YAML import — keeps the validator pure.
 */
export function parseFrontmatterForChecks(
  contents: string,
): Record<string, readonly string[]> {
  const result: Record<string, readonly string[]> = {};
  const trimmed = contents.trimStart();
  if (!trimmed.startsWith("---")) return result;
  const afterOpen = trimmed.slice(3);
  if (!/^\r?\n/.test(afterOpen)) return result;
  const terminatorIdx = afterOpen.indexOf("\n---");
  if (terminatorIdx === -1) return result;
  const body = afterOpen.slice(0, terminatorIdx);
  const lines = body.split(/\r?\n/);

  const targetKeys = new Set(["skills", "agents", "triggers", "requires"]);
  let i = 0;
  while (i < lines.length) {
    const raw = lines[i] ?? "";
    const line = raw.replace(/\s+$/u, "");
    const stripped = line.trim();
    if (stripped === "" || stripped.startsWith("#")) {
      i += 1;
      continue;
    }
    const colonIdx = stripped.indexOf(":");
    if (colonIdx === -1) {
      i += 1;
      continue;
    }
    const key = stripped.slice(0, colonIdx).trim();
    const rest = stripped.slice(colonIdx + 1).trim();
    if (!targetKeys.has(key)) {
      i += 1;
      continue;
    }
    if (rest.startsWith("[") && rest.endsWith("]")) {
      result[key] = parseInlineArray(rest);
      i += 1;
      continue;
    }
    if (rest === "") {
      // Block form — consume indented `- item` lines.
      const items: string[] = [];
      let j = i + 1;
      while (j < lines.length) {
        const next = lines[j] ?? "";
        const nextStripped = next.trim();
        if (nextStripped === "") {
          j += 1;
          continue;
        }
        if (!next.startsWith(" ") && !next.startsWith("\t")) break;
        if (!nextStripped.startsWith("-")) break;
        const item = nextStripped.slice(1).trim();
        items.push(unquote(item));
        j += 1;
      }
      result[key] = items;
      i = j;
      continue;
    }
    // Non-array scalar — ignore.
    i += 1;
  }
  return result;
}

function parseInlineArray(raw: string): readonly string[] {
  const inner = raw.slice(1, -1).trim();
  if (inner === "") return [];
  return inner
    .split(",")
    .map((item) => unquote(item.trim()))
    .filter((item) => item.length > 0);
}

function unquote(raw: string): string {
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    return raw.slice(1, -1);
  }
  return raw;
}

// ─── Tarjan SCC (iterative) ──────────────────────────────────────────────────

interface TarjanState {
  readonly index: Map<string, number>;
  readonly lowlink: Map<string, number>;
  readonly onStack: Set<string>;
  readonly stack: string[];
  counter: number;
  readonly components: string[][];
}

/**
 * Iterative Tarjan's SCC — avoids the recursion ceiling on larger artifact
 * sets. Returns components in reverse topological order; single-node
 * components represent acyclic nodes and are filtered by callers.
 */
function tarjanSCC(graph: DependencyGraph): readonly (readonly string[])[] {
  const state: TarjanState = {
    index: new Map<string, number>(),
    lowlink: new Map<string, number>(),
    onStack: new Set<string>(),
    stack: [],
    counter: 0,
    components: [],
  };

  for (const node of graph.nodes.keys()) {
    if (!state.index.has(node)) {
      strongConnectIterative(node, graph, state);
    }
  }

  return state.components;
}

interface Frame {
  readonly node: string;
  readonly neighbors: readonly string[];
  nextIdx: number;
}

function strongConnectIterative(
  start: string,
  graph: DependencyGraph,
  state: TarjanState,
): void {
  const callStack: Frame[] = [];
  enterNode(start, graph, state, callStack);

  while (callStack.length > 0) {
    const frame = callStack[callStack.length - 1];
    if (frame === undefined) break;
    if (frame.nextIdx < frame.neighbors.length) {
      const neighbor = frame.neighbors[frame.nextIdx];
      frame.nextIdx += 1;
      if (neighbor === undefined) continue;
      if (!state.index.has(neighbor)) {
        enterNode(neighbor, graph, state, callStack);
      } else if (state.onStack.has(neighbor)) {
        const cur = state.lowlink.get(frame.node) ?? 0;
        const neighborIdx = state.index.get(neighbor) ?? 0;
        state.lowlink.set(frame.node, Math.min(cur, neighborIdx));
      }
    } else {
      // All neighbors explored — check root.
      const nodeIdx = state.index.get(frame.node) ?? 0;
      const nodeLow = state.lowlink.get(frame.node) ?? 0;
      if (nodeLow === nodeIdx) {
        const component: string[] = [];
        for (;;) {
          const popped = state.stack.pop();
          if (popped === undefined) break;
          state.onStack.delete(popped);
          component.push(popped);
          if (popped === frame.node) break;
        }
        state.components.push(component);
      }
      callStack.pop();
      if (callStack.length > 0) {
        const parent = callStack[callStack.length - 1];
        if (parent !== undefined) {
          const parentLow = state.lowlink.get(parent.node) ?? 0;
          const childLow = state.lowlink.get(frame.node) ?? 0;
          state.lowlink.set(parent.node, Math.min(parentLow, childLow));
        }
      }
    }
  }
}

function enterNode(
  node: string,
  graph: DependencyGraph,
  state: TarjanState,
  callStack: Frame[],
): void {
  state.index.set(node, state.counter);
  state.lowlink.set(node, state.counter);
  state.counter += 1;
  state.stack.push(node);
  state.onStack.add(node);
  const neighbors = graph.adjacency.get(node) ?? [];
  callStack.push({ node, neighbors, nextIdx: 0 });
}

function splitNodeId(nodeId: string): readonly [IntentKind | "unknown", string] {
  const colon = nodeId.indexOf(":");
  if (colon === -1) return ["unknown", nodeId];
  const kind = nodeId.slice(0, colon) as IntentKind;
  const name = nodeId.slice(colon + 1);
  return [kind, name];
}

function renderCycle(component: readonly string[]): string {
  // Tarjan pops components in reverse discovery order; reverse so the
  // displayed cycle reads forward, then repeat the first node at the end
  // to make the loop obvious ("A → B → A").
  if (component.length === 0) return "";
  const ordered = [...component].reverse();
  const first = ordered[0];
  if (first === undefined) return "";
  return [...ordered, first].join(" → ");
}

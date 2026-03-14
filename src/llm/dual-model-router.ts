import type { LLMProvider } from "./provider.js";

/** Configuration for the dual-model architect/editor pattern */
export interface DualModelConfig {
  readonly architectModel: string;
  readonly editorModel: string;
  readonly routingStrategy: "auto" | "plan-execute" | "manual";
}

/** Phase of task execution in the dual-model pattern */
export type TaskPhase = "plan" | "execute" | "review";

/**
 * Dual-model router — implements the Architect/Editor pattern.
 *
 * Uses a high-capability model (architect) for planning and review,
 * and a lower-cost model (editor) for code generation/execution.
 * This improves quality while reducing costs.
 */
export class DualModelRouter {
  private currentPhase: TaskPhase = "execute";

  constructor(
    private readonly config: DualModelConfig,
    private readonly architectClient: LLMProvider,
    private readonly editorClient: LLMProvider,
  ) {}

  /** Set the current task phase */
  setPhase(phase: TaskPhase): void {
    this.currentPhase = phase;
  }

  /** Get the current task phase */
  getPhase(): TaskPhase {
    return this.currentPhase;
  }

  /** Get the routing configuration */
  getConfig(): DualModelConfig {
    return this.config;
  }

  /**
   * Get the appropriate client, model, and role for the given phase.
   * Uses the current phase if none is specified.
   *
   * Routing rules:
   * - "plan" and "review" phases → architect model (high-capability)
   * - "execute" phase → editor model (cost-effective)
   */
  getClientForPhase(phase?: TaskPhase): {
    readonly client: LLMProvider;
    readonly model: string;
    readonly role: "architect" | "editor";
  } {
    const p = phase ?? this.currentPhase;
    const isArchitect = p === "plan" || p === "review";
    return isArchitect
      ? { client: this.architectClient, model: this.config.architectModel, role: "architect" }
      : { client: this.editorClient, model: this.config.editorModel, role: "editor" };
  }
}

/** Keywords that indicate a planning/analysis phase */
const PLAN_KEYWORDS = [
  "plan",
  "설계",
  "분석",
  "리뷰",
  "review",
  "architecture",
  "design",
  "analyze",
  "analyse",
  "strategy",
  "approach",
  "proposal",
  "RFC",
] as const;

/**
 * Detect the task phase from conversation messages.
 *
 * Scans the last user message for planning-related keywords.
 * Returns "plan" if planning keywords are found, "execute" otherwise.
 */
export function detectPhase(
  messages: readonly { readonly role: string; readonly content: string }[],
): TaskPhase {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser) return "execute";

  const content = typeof lastUser.content === "string" ? lastUser.content.toLowerCase() : "";
  return PLAN_KEYWORDS.some((k) => content.includes(k)) ? "plan" : "execute";
}

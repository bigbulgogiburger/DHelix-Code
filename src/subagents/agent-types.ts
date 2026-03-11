/**
 * Expanded agent type definitions.
 *
 * Each entry describes a logical agent role: the tools it may access,
 * its iteration budget, and any extra system-prompt text injected when
 * the agent is spawned.
 */

/** Configuration for a single agent type */
export interface AgentTypeConfig {
  readonly type: string;
  readonly description: string;
  readonly defaultMaxIterations: number;
  readonly allowedTools: readonly string[];
  /** Additional instructions appended to the subagent system prompt. */
  readonly systemPromptAdditions: string;
}

/** Read-only tool set shared by several investigative agent types */
const READ_ONLY_TOOLS = ["file_read", "glob_search", "grep_search", "list_dir"] as const;

/** All built-in tool names (used by unrestricted agents) */
const ALL_TOOLS = [
  "file_read",
  "file_write",
  "file_edit",
  "bash_exec",
  "glob_search",
  "grep_search",
  "list_dir",
  "web_fetch",
  "web_search",
  "notebook_edit",
  "mkdir",
  "ask_user",
  "agent",
  "todo_write",
] as const;

/**
 * Registry of built-in agent types.
 *
 * Keys are the canonical type name (lowercase, kebab-case).
 * When spawning a subagent you can reference a key here to get sensible
 * defaults for tools, iterations, and system-prompt additions.
 */
export const AGENT_TYPES: ReadonlyMap<string, AgentTypeConfig> = new Map<string, AgentTypeConfig>([
  [
    "explore",
    {
      type: "explore",
      description:
        "Read-only codebase exploration. Investigates project structure, traces dependencies, and answers factual questions about the code.",
      defaultMaxIterations: 15,
      allowedTools: [...READ_ONLY_TOOLS],
      systemPromptAdditions: [
        "You are an explore agent. Your job is to investigate the codebase and answer questions.",
        "You have READ-ONLY access. Do NOT attempt to modify any files.",
        "Be thorough: check multiple locations and naming conventions before concluding.",
      ].join("\n"),
    },
  ],
  [
    "plan",
    {
      type: "plan",
      description:
        "Implementation planning with dependency analysis. Reads the codebase to produce structured plans, risk assessments, and phased breakdowns.",
      defaultMaxIterations: 10,
      allowedTools: [...READ_ONLY_TOOLS],
      systemPromptAdditions: [
        "You are a planning agent. Produce a clear, phased implementation plan.",
        "Identify dependencies, risks, and testing requirements for each phase.",
        "You have READ-ONLY access — do not modify files.",
      ].join("\n"),
    },
  ],
  [
    "general",
    {
      type: "general",
      description:
        "General-purpose agent with full tool access. Suitable for delegated tasks that require both reading and writing.",
      defaultMaxIterations: 25,
      allowedTools: [...ALL_TOOLS],
      systemPromptAdditions: [
        "You are a general-purpose subagent. Complete the assigned task thoroughly.",
        "Prefer minimal, targeted changes. Verify your work before finishing.",
      ].join("\n"),
    },
  ],
  [
    "code-reviewer",
    {
      type: "code-reviewer",
      description:
        "Code review agent. Reads the codebase and produces structured review feedback with severity levels (CRITICAL / HIGH / MEDIUM / LOW).",
      defaultMaxIterations: 15,
      allowedTools: [...READ_ONLY_TOOLS],
      systemPromptAdditions: [
        "You are a code-review agent. Analyze the code for correctness, style, performance, and security.",
        "Classify each finding as CRITICAL, HIGH, MEDIUM, or LOW.",
        "You have READ-ONLY access — do not modify files.",
      ].join("\n"),
    },
  ],
  [
    "test-runner",
    {
      type: "test-runner",
      description:
        "Test execution agent. Runs tests via bash, reads results, and reports failures with root-cause analysis.",
      defaultMaxIterations: 20,
      allowedTools: [...READ_ONLY_TOOLS, "bash_exec"],
      systemPromptAdditions: [
        "You are a test-runner agent. Execute tests and analyze the results.",
        "If tests fail, investigate root causes by reading relevant source and test files.",
        "Summarize: total tests, passed, failed, and a brief root-cause for each failure.",
      ].join("\n"),
    },
  ],
  [
    "security-auditor",
    {
      type: "security-auditor",
      description:
        "Security audit agent. Scans the codebase for vulnerabilities, secret leaks, and insecure patterns.",
      defaultMaxIterations: 15,
      allowedTools: [...READ_ONLY_TOOLS],
      systemPromptAdditions: [
        "You are a security-auditor agent. Scan for vulnerabilities and insecure patterns.",
        "Check for: hardcoded secrets, injection risks, insecure dependencies, improper auth, and data exposure.",
        "Classify each finding by severity (CRITICAL / HIGH / MEDIUM / LOW) and provide remediation guidance.",
        "You have READ-ONLY access — do not modify files.",
      ].join("\n"),
    },
  ],
  [
    "refactorer",
    {
      type: "refactorer",
      description:
        "Refactoring agent with full tool access. Performs targeted code improvements: dead code removal, naming, extraction, deduplication.",
      defaultMaxIterations: 25,
      allowedTools: [...ALL_TOOLS],
      systemPromptAdditions: [
        "You are a refactoring agent. Improve code quality without changing external behavior.",
        "Focus on: dead code removal, naming clarity, function extraction, and deduplication.",
        "Make small, incremental changes. Verify the build or tests still pass after each change.",
      ].join("\n"),
    },
  ],
]);

/**
 * Look up an agent type configuration by name.
 * Returns `undefined` if the type is not registered.
 */
export function getAgentTypeConfig(type: string): AgentTypeConfig | undefined {
  return AGENT_TYPES.get(type);
}

/**
 * List all registered agent type names.
 */
export function listAgentTypes(): readonly string[] {
  return [...AGENT_TYPES.keys()];
}

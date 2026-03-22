"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface DocPage {
  slug: string;
  label: string;
}

/**
 * Ordered list of all doc pages for sequential navigation.
 * Primary ordering follows docs/page.tsx listing (Layer 1 -> 2 -> 3 -> 4 -> Commands),
 * with additional pages appended per layer in alphabetical order.
 */
const docOrder: DocPage[] = [
  // ── Layer 1: CLI (docs/page.tsx listing) ──
  { slug: "use-agent-loop", label: "useAgentLoop" },
  { slug: "activity-feed", label: "ActivityFeed" },
  { slug: "agent-status", label: "AgentStatus" },
  { slug: "turn-block", label: "TurnBlock" },
  { slug: "error-banner", label: "ErrorBanner" },
  { slug: "use-voice", label: "useVoice" },
  { slug: "use-input", label: "useInput" },
  { slug: "use-keybindings", label: "useKeybindings" },
  { slug: "use-permission-prompt", label: "usePermissionPrompt" },
  { slug: "use-streaming", label: "useStreaming" },
  { slug: "rendering-engine", label: "Rendering Engine" },
  // CLI (additional)
  { slug: "app-entry", label: "App Entry" },
  { slug: "headless-mode", label: "Headless Mode" },
  { slug: "permission-prompt", label: "Permission Prompt" },
  { slug: "read-group-block", label: "ReadGroupBlock" },
  { slug: "select-list", label: "SelectList" },
  { slug: "setup-wizard", label: "Setup Wizard" },
  { slug: "slash-command-menu", label: "Slash Command Menu" },
  { slug: "status-bar", label: "StatusBar" },
  { slug: "streaming-message", label: "StreamingMessage" },
  { slug: "task-list-view", label: "TaskListView" },
  { slug: "task-view-panel", label: "TaskViewPanel" },
  { slug: "teammate-status", label: "TeammateStatus" },
  { slug: "thinking-block", label: "ThinkingBlock" },
  { slug: "tool-call-block", label: "ToolCallBlock" },
  { slug: "user-input", label: "UserInput" },

  // ── Layer 2: Core (docs/page.tsx listing) ──
  { slug: "agent-loop", label: "Agent Loop" },
  { slug: "context-manager", label: "Context Manager" },
  { slug: "circuit-breaker", label: "Circuit Breaker" },
  { slug: "recovery-executor", label: "Recovery Executor" },
  { slug: "system-prompt-builder", label: "System Prompt Builder" },
  { slug: "checkpoint-manager", label: "Checkpoint Manager" },
  { slug: "observation-masking", label: "Observation Masking" },
  // Core (additional)
  { slug: "activity-collector", label: "Activity Collector" },
  { slug: "adaptive-context", label: "Adaptive Context" },
  { slug: "auto-memory", label: "Auto Memory" },
  { slug: "conversation-manager", label: "Conversation Manager" },
  { slug: "recovery-strategy", label: "Recovery Strategy" },
  { slug: "session-manager", label: "Session Manager" },
  { slug: "system-prompt-cache", label: "System Prompt Cache" },
  { slug: "task-manager", label: "Task Manager" },
  { slug: "tone-profiles", label: "Tone Profiles" },

  // ── Layer 3: Infrastructure (docs/page.tsx listing) ──
  { slug: "token-counter", label: "Token Counter" },
  { slug: "model-capabilities", label: "Model Capabilities" },
  { slug: "secret-scanner", label: "Secret Scanner" },
  { slug: "llm-client", label: "LLM Client" },
  { slug: "dual-model-router", label: "Dual-Model Router" },
  { slug: "tool-registry", label: "Tool Registry" },
  { slug: "tool-executor", label: "Tool Executor" },
  { slug: "adaptive-schema", label: "Adaptive Schema" },
  { slug: "tool-call-corrector", label: "Tool Call Corrector" },
  { slug: "tool-retry", label: "Tool Retry" },
  { slug: "lazy-tool-loader", label: "Lazy Tool Loader" },
  { slug: "permission-manager", label: "Permission Manager" },
  { slug: "permission-session-store", label: "Permission Session Store" },
  { slug: "permission-persistent-store", label: "Permission Persistent Store" },
  { slug: "permission-audit-log", label: "Permission Audit Log" },
  { slug: "mcp-manager", label: "MCP Manager" },
  { slug: "mcp-managed-config", label: "MCP Managed Config" },
  { slug: "mcp-output-limiter", label: "MCP Output Limiter" },
  { slug: "mcp-serve", label: "MCP Serve" },
  { slug: "mcp-manager-connector", label: "MCP Manager Connector" },
  { slug: "mcp-oauth", label: "MCP OAuth" },
  { slug: "mcp-transport-base", label: "MCP Transport Base" },
  { slug: "mcp-transport-stdio", label: "MCP Transport Stdio" },
  { slug: "mcp-transport-sse", label: "MCP Transport SSE" },
  { slug: "mcp-transport-http", label: "MCP Transport HTTP" },
  { slug: "mcp-prompts", label: "MCP Prompts" },
  { slug: "tool-file-read", label: "Tool: File Read" },
  { slug: "tool-file-edit", label: "Tool: File Edit" },
  { slug: "tool-grep-search", label: "Tool: Grep Search" },
  { slug: "tool-glob-search", label: "Tool: Glob Search" },
  { slug: "tool-bash-exec", label: "Tool: Bash Exec" },
  // Infrastructure (additional)
  { slug: "agent-hooks", label: "Agent Hooks" },
  { slug: "agent-memory-sub", label: "Agent Memory Sub" },
  { slug: "anthropic-provider", label: "Anthropic Provider" },
  { slug: "command-filter", label: "Command Filter" },
  { slug: "cost-tracker", label: "Cost Tracker" },
  { slug: "definition-loader", label: "Definition Loader" },
  { slug: "entropy-scanner", label: "Entropy Scanner" },
  { slug: "injection-detector", label: "Injection Detector" },
  { slug: "llm-provider", label: "LLM Provider" },
  { slug: "llm-streaming", label: "LLM Streaming" },
  { slug: "mcp-client", label: "MCP Client" },
  { slug: "mcp-scope-manager", label: "MCP Scope Manager" },
  { slug: "mcp-tool-bridge", label: "MCP Tool Bridge" },
  { slug: "mcp-tool-filter", label: "MCP Tool Filter" },
  { slug: "mcp-tool-search", label: "MCP Tool Search" },
  { slug: "model-router", label: "Model Router" },
  { slug: "native-function-calling", label: "Native Function Calling" },
  { slug: "path-filter", label: "Path Filter" },
  { slug: "permission-modes", label: "Permission Modes" },
  { slug: "permission-patterns", label: "Permission Patterns" },
  { slug: "permission-rules", label: "Permission Rules" },
  { slug: "permission-wildcard", label: "Permission Wildcard" },
  { slug: "responses-client", label: "Responses Client" },
  { slug: "shared-state", label: "Shared State" },
  { slug: "structured-output", label: "Structured Output" },
  { slug: "subagent-spawner", label: "Subagent Spawner" },
  { slug: "subagent-task-list", label: "Subagent Task List" },
  { slug: "team-manager", label: "Team Manager" },
  { slug: "text-parsing-strategy", label: "Text Parsing Strategy" },
  { slug: "tool-agent", label: "Tool: Agent" },
  { slug: "tool-ask-user", label: "Tool: Ask User" },
  { slug: "tool-call-strategy", label: "Tool Call Strategy" },
  { slug: "tool-notebook-edit", label: "Tool: Notebook Edit" },
  { slug: "tool-web-fetch", label: "Tool: Web Fetch" },
  { slug: "tool-web-search", label: "Tool: Web Search" },
  { slug: "two-stage-tool-call", label: "Two-Stage Tool Call" },

  // ── Layer 4: Leaf (docs/page.tsx listing) ──
  { slug: "config-loader", label: "Config Loader" },
  { slug: "skill-manager", label: "Skill Manager" },
  { slug: "instruction-loader", label: "Instruction Loader" },
  { slug: "utils-notifications", label: "Utils: Notifications" },
  // Leaf (additional)
  { slug: "config-defaults", label: "Config Defaults" },
  { slug: "config-schema", label: "Config Schema" },
  { slug: "constants", label: "Constants" },
  { slug: "hook-loader", label: "Hook Loader" },
  { slug: "hook-runner", label: "Hook Runner" },
  { slug: "instruction-parser", label: "Instruction Parser" },
  { slug: "instruction-path-matcher", label: "Instruction Path Matcher" },
  { slug: "memory-loader", label: "Memory Loader" },
  { slug: "memory-manager", label: "Memory Manager" },
  { slug: "memory-writer", label: "Memory Writer" },
  { slug: "mention-parser", label: "Mention Parser" },
  { slug: "mention-resolver", label: "Mention Resolver" },
  { slug: "repo-map", label: "Repo Map" },
  { slug: "resource-resolver", label: "Resource Resolver" },
  { slug: "sandbox-bubblewrap", label: "Sandbox: Bubblewrap" },
  { slug: "sandbox-linux", label: "Sandbox: Linux" },
  { slug: "sandbox-network-policy", label: "Sandbox: Network Policy" },
  { slug: "sandbox-network-proxy", label: "Sandbox: Network Proxy" },
  { slug: "sandbox-seatbelt", label: "Sandbox: Seatbelt" },
  { slug: "skill-command-bridge", label: "Skill Command Bridge" },
  { slug: "skill-executor", label: "Skill Executor" },
  { slug: "skill-loader", label: "Skill Loader" },
  { slug: "telemetry-events", label: "Telemetry Events" },
  { slug: "telemetry-metrics", label: "Telemetry Metrics" },
  { slug: "token-manager-auth", label: "Token Manager Auth" },
  { slug: "token-store", label: "Token Store" },
  { slug: "utils-error", label: "Utils: Error" },
  { slug: "utils-events", label: "Utils: Events" },
  { slug: "utils-logger", label: "Utils: Logger" },
  { slug: "utils-path", label: "Utils: Path" },
  { slug: "utils-platform", label: "Utils: Platform" },
  { slug: "voice-recorder", label: "Voice Recorder" },
  { slug: "voice-transcriber", label: "Voice Transcriber" },

  // ── Slash Commands (docs/page.tsx listing) ──
  { slug: "cmd-diff", label: "/diff" },
  { slug: "cmd-context", label: "/context" },
  { slug: "cmd-rewind", label: "/rewind" },
  { slug: "cmd-dual-model", label: "/dual-model" },
  { slug: "cmd-update", label: "/update" },
  { slug: "cmd-commit", label: "/commit" },
  { slug: "cmd-review", label: "/review" },
  { slug: "cmd-resume", label: "/resume" },
  { slug: "cmd-stats", label: "/stats" },
  { slug: "cmd-registry", label: "Command Registry" },
  // Commands (additional)
  { slug: "cmd-agents", label: "/agents" },
  { slug: "cmd-analytics", label: "/analytics" },
  { slug: "cmd-bug", label: "/bug" },
  { slug: "cmd-copy", label: "/copy" },
  { slug: "cmd-cost", label: "/cost" },
  { slug: "cmd-doctor", label: "/doctor" },
  { slug: "cmd-export", label: "/export" },
  { slug: "cmd-init", label: "/init" },
  { slug: "cmd-mcp", label: "/mcp" },
  { slug: "cmd-memory", label: "/memory" },
  { slug: "cmd-model", label: "/model" },
  { slug: "cmd-permissions", label: "/permissions" },
  { slug: "cmd-team", label: "/team" },
  { slug: "cmd-undo", label: "/undo" },
];

export function PrevNextNav() {
  const pathname = usePathname();
  const currentSlug = pathname.replace("/docs/", "");
  const currentIndex = docOrder.findIndex((d) => d.slug === currentSlug);

  if (currentIndex === -1) return null;

  const prev = currentIndex > 0 ? docOrder[currentIndex - 1] : null;
  const next = currentIndex < docOrder.length - 1 ? docOrder[currentIndex + 1] : null;

  return (
    <nav
      className="flex justify-between items-center"
      style={{
        marginTop: "64px",
        paddingTop: "24px",
        borderTop: "1px solid var(--border)",
      }}
      aria-label="문서 이전/다음 탐색"
    >
      {prev ? (
        <Link
          href={`/docs/${prev.slug}`}
          className="group flex items-center gap-3 text-sm transition-colors"
          style={{
            color: "var(--text-muted)",
            textDecoration: "none",
            padding: "12px 16px",
            borderRadius: "8px",
            border: "1px solid var(--border)",
            maxWidth: "45%",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--accent)";
            e.currentTarget.style.color = "var(--accent)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border)";
            e.currentTarget.style.color = "var(--text-muted)";
          }}
        >
          <span
            className="transition-transform group-hover:-translate-x-1"
            style={{ fontSize: "18px", flexShrink: 0 }}
          >
            ←
          </span>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: "11px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "2px",
                opacity: 0.7,
              }}
            >
              이전
            </div>
            <div
              style={{
                fontWeight: 600,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {prev.label}
            </div>
          </div>
        </Link>
      ) : (
        <div />
      )}
      {next ? (
        <Link
          href={`/docs/${next.slug}`}
          className="group flex items-center gap-3 text-sm transition-colors"
          style={{
            color: "var(--text-muted)",
            textDecoration: "none",
            padding: "12px 16px",
            borderRadius: "8px",
            border: "1px solid var(--border)",
            textAlign: "right",
            maxWidth: "45%",
            marginLeft: "auto",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--accent)";
            e.currentTarget.style.color = "var(--accent)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border)";
            e.currentTarget.style.color = "var(--text-muted)";
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: "11px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "2px",
                opacity: 0.7,
              }}
            >
              다음
            </div>
            <div
              style={{
                fontWeight: 600,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {next.label}
            </div>
          </div>
          <span
            className="transition-transform group-hover:translate-x-1"
            style={{ fontSize: "18px", flexShrink: 0 }}
          >
            →
          </span>
        </Link>
      ) : (
        <div />
      )}
    </nav>
  );
}

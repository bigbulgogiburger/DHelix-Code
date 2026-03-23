"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface ModuleItem {
  slug: string;
  label: string;
}

interface SubGroup {
  id: string;
  title: string;
  items: ModuleItem[];
}

interface LayerGroup {
  id: string;
  title: string;
  icon: string;
  /** Flat modules (no sub-groups) — used by Layer 2 and Slash Commands */
  modules?: ModuleItem[];
  /** Sub-groups — used by Layer 1, 3, 4 */
  subGroups?: SubGroup[];
}

// ─── Layer 1: CLI ───────────────────────────────────────────────────────────
const layer1: LayerGroup = {
  id: "layer-1",
  title: "Layer 1: CLI",
  icon: "🖥️",
  subGroups: [
    {
      id: "l1-components",
      title: "Components",
      items: [
        { slug: "app-entry", label: "app-entry" },
        { slug: "agent-status", label: "AgentStatus" },
        { slug: "error-banner", label: "ErrorBanner" },
        { slug: "logo-component", label: "LogoComponent" },
        { slug: "permission-prompt", label: "PermissionPrompt" },
        { slug: "read-group-block", label: "ReadGroupBlock" },
        { slug: "select-list", label: "SelectList" },
        { slug: "slash-command-menu", label: "SlashCommandMenu" },
        { slug: "status-bar", label: "StatusBar" },
        { slug: "streaming-message", label: "StreamingMessage" },
        { slug: "task-list-view", label: "TaskListView" },
        { slug: "task-view-panel", label: "TaskViewPanel" },
        { slug: "teammate-status", label: "TeammateStatus" },
        { slug: "thinking-block", label: "ThinkingBlock" },
        { slug: "tool-call-block", label: "ToolCallBlock" },
        { slug: "turn-block", label: "TurnBlock" },
        { slug: "user-input", label: "UserInput" },
        { slug: "headless-mode", label: "HeadlessMode" },
        { slug: "setup-wizard", label: "SetupWizard" },
      ],
    },
    {
      id: "l1-hooks",
      title: "Hooks",
      items: [
        { slug: "use-agent-loop", label: "useAgentLoop" },
        { slug: "use-input", label: "useInput" },
        { slug: "use-keybindings", label: "useKeybindings" },
        { slug: "use-permission-prompt", label: "usePermissionPrompt" },
        { slug: "use-streaming", label: "useStreaming" },
        { slug: "use-voice", label: "useVoice" },
      ],
    },
    {
      id: "l1-renderer",
      title: "Renderer",
      items: [{ slug: "rendering-engine", label: "rendering-engine" }],
    },
    {
      id: "l1-activity",
      title: "Activity",
      items: [{ slug: "activity-feed", label: "ActivityFeed" }],
    },
  ],
};

// ─── Layer 2: Core (flat) ────────────────────────────────────────────────────
const layer2: LayerGroup = {
  id: "layer-2",
  title: "Layer 2: Core",
  icon: "⚙️",
  modules: [
    { slug: "agent-loop", label: "agent-loop" },
    { slug: "context-manager", label: "context-manager" },
    { slug: "circuit-breaker", label: "circuit-breaker" },
    { slug: "recovery-executor", label: "recovery-executor" },
    { slug: "recovery-strategy", label: "recovery-strategy" },
    { slug: "system-prompt-builder", label: "system-prompt-builder" },
    { slug: "system-prompt-cache", label: "system-prompt-cache" },
    { slug: "checkpoint-manager", label: "checkpoint-manager" },
    { slug: "observation-masking", label: "observation-masking" },
    { slug: "activity-collector", label: "activity-collector" },
    { slug: "adaptive-context", label: "adaptive-context" },
    { slug: "auto-memory", label: "auto-memory" },
    { slug: "code-review-agent", label: "code-review-agent" },
    { slug: "conversation-manager", label: "conversation-manager" },
    { slug: "memory-storage", label: "memory-storage" },
    { slug: "message-types", label: "message-types" },
    { slug: "session-manager", label: "session-manager" },
    { slug: "task-manager", label: "task-manager" },
    { slug: "tone-profiles", label: "tone-profiles" },
    { slug: "update-checker", label: "update-checker" },
  ],
};

// ─── Layer 3: Infrastructure ─────────────────────────────────────────────────
const layer3: LayerGroup = {
  id: "layer-3",
  title: "Layer 3: Infrastructure",
  icon: "🔧",
  subGroups: [
    {
      id: "l3-llm",
      title: "LLM",
      items: [
        { slug: "llm-client", label: "llm-client" },
        { slug: "llm-provider", label: "llm-provider" },
        { slug: "llm-streaming", label: "llm-streaming" },
        { slug: "anthropic-provider", label: "anthropic-provider" },
        { slug: "responses-client", label: "responses-client" },
        { slug: "model-capabilities", label: "model-capabilities" },
        { slug: "model-router", label: "model-router" },
        { slug: "dual-model-router", label: "dual-model-router" },
        { slug: "cost-tracker", label: "cost-tracker" },
        { slug: "token-counter", label: "token-counter" },
        { slug: "tool-call-strategy", label: "tool-call-strategy" },
        { slug: "native-function-calling", label: "native-function-calling" },
        { slug: "text-parsing-strategy", label: "text-parsing-strategy" },
        { slug: "two-stage-tool-call", label: "two-stage-tool-call" },
        { slug: "structured-output", label: "structured-output" },
      ],
    },
    {
      id: "l3-tools",
      title: "Tools",
      items: [
        { slug: "tool-registry", label: "tool-registry" },
        { slug: "tool-executor", label: "tool-executor" },
        { slug: "adaptive-schema", label: "adaptive-schema" },
        { slug: "tool-call-corrector", label: "tool-call-corrector" },
        { slug: "tool-retry", label: "tool-retry" },
        { slug: "lazy-tool-loader", label: "lazy-tool-loader" },
        { slug: "import-hint", label: "import-hint" },
        { slug: "tool-file-read", label: "tool-file-read" },
        { slug: "tool-file-edit", label: "tool-file-edit" },
        { slug: "tool-grep-search", label: "tool-grep-search" },
        { slug: "tool-glob-search", label: "tool-glob-search" },
        { slug: "tool-bash-exec", label: "tool-bash-exec" },
        { slug: "tool-bash-output", label: "tool-bash-output" },
        { slug: "tool-kill-shell", label: "tool-kill-shell" },
        { slug: "tool-list-dir", label: "tool-list-dir" },
        { slug: "tool-web-search", label: "tool-web-search" },
        { slug: "tool-web-fetch", label: "tool-web-fetch" },
        { slug: "tool-agent", label: "tool-agent" },
        { slug: "tool-ask-user", label: "tool-ask-user" },
        { slug: "tool-notebook-edit", label: "tool-notebook-edit" },
        { slug: "tool-todo-write", label: "tool-todo-write" },
      ],
    },
    {
      id: "l3-permissions",
      title: "Permissions",
      items: [
        { slug: "permission-manager", label: "permission-manager" },
        { slug: "permission-modes", label: "permission-modes" },
        { slug: "permission-rules", label: "permission-rules" },
        { slug: "permission-patterns", label: "permission-patterns" },
        { slug: "permission-wildcard", label: "permission-wildcard" },
        { slug: "permission-session-store", label: "permission-session-store" },
        {
          slug: "permission-persistent-store",
          label: "permission-persistent-store",
        },
        { slug: "permission-audit-log", label: "permission-audit-log" },
        { slug: "permission-prompt", label: "permission-prompt" },
      ],
    },
    {
      id: "l3-mcp",
      title: "MCP",
      items: [
        { slug: "mcp-manager", label: "mcp-manager" },
        { slug: "mcp-client", label: "mcp-client" },
        { slug: "mcp-scope-manager", label: "mcp-scope-manager" },
        { slug: "mcp-tool-bridge", label: "mcp-tool-bridge" },
        { slug: "mcp-tool-filter", label: "mcp-tool-filter" },
        { slug: "mcp-tool-search", label: "mcp-tool-search" },
        { slug: "mcp-managed-config", label: "mcp-managed-config" },
        { slug: "mcp-output-limiter", label: "mcp-output-limiter" },
        { slug: "mcp-serve", label: "mcp-serve" },
        { slug: "mcp-manager-connector", label: "mcp-manager-connector" },
        { slug: "mcp-oauth", label: "mcp-oauth" },
        { slug: "mcp-prompts", label: "mcp-prompts" },
        { slug: "mcp-transport-base", label: "mcp-transport-base" },
        { slug: "mcp-transport-stdio", label: "mcp-transport-stdio" },
        { slug: "mcp-transport-sse", label: "mcp-transport-sse" },
        { slug: "mcp-transport-http", label: "mcp-transport-http" },
      ],
    },
    {
      id: "l3-guardrails",
      title: "Guardrails",
      items: [
        { slug: "injection-detector", label: "injection-detector" },
        { slug: "entropy-scanner", label: "entropy-scanner" },
        { slug: "secret-scanner", label: "secret-scanner" },
        { slug: "command-filter", label: "command-filter" },
        { slug: "path-filter", label: "path-filter" },
      ],
    },
    {
      id: "l3-subagents",
      title: "Subagents",
      items: [
        { slug: "subagent-spawner", label: "subagent-spawner" },
        { slug: "team-manager", label: "team-manager" },
        { slug: "subagent-task-list", label: "subagent-task-list" },
        { slug: "shared-state", label: "shared-state" },
        { slug: "definition-loader", label: "definition-loader" },
        { slug: "agent-hooks", label: "agent-hooks" },
        { slug: "agent-memory-sub", label: "agent-memory-sub" },
        { slug: "agent-skills-loader", label: "agent-skills-loader" },
      ],
    },
  ],
};

// ─── Layer 4: Leaf ───────────────────────────────────────────────────────────
const layer4: LayerGroup = {
  id: "layer-4",
  title: "Layer 4: Leaf",
  icon: "🍃",
  subGroups: [
    {
      id: "l4-config",
      title: "Config",
      items: [
        { slug: "config-loader", label: "config-loader" },
        { slug: "config-defaults", label: "config-defaults" },
        { slug: "config-schema", label: "config-schema" },
      ],
    },
    {
      id: "l4-skills",
      title: "Skills",
      items: [
        { slug: "skill-manager", label: "skill-manager" },
        { slug: "skill-loader", label: "skill-loader" },
        { slug: "skill-executor", label: "skill-executor" },
        { slug: "skill-command-bridge", label: "skill-command-bridge" },
      ],
    },
    {
      id: "l4-instructions",
      title: "Instructions",
      items: [
        { slug: "instruction-loader", label: "instruction-loader" },
        { slug: "instruction-parser", label: "instruction-parser" },
        { slug: "instruction-path-matcher", label: "instruction-path-matcher" },
      ],
    },
    {
      id: "l4-memory",
      title: "Memory",
      items: [
        { slug: "memory-manager", label: "memory-manager" },
        { slug: "memory-writer", label: "memory-writer" },
        { slug: "memory-loader", label: "memory-loader" },
        { slug: "memory-paths", label: "memory-paths" },
      ],
    },
    {
      id: "l4-hooks",
      title: "Hooks",
      items: [
        { slug: "hook-runner", label: "hook-runner" },
        { slug: "hook-loader", label: "hook-loader" },
        { slug: "hook-auto-lint", label: "hook-auto-lint" },
        { slug: "hook-team-events", label: "hook-team-events" },
      ],
    },
    {
      id: "l4-utils",
      title: "Utils",
      items: [
        { slug: "utils-error", label: "utils-error" },
        { slug: "utils-events", label: "utils-events" },
        { slug: "utils-logger", label: "utils-logger" },
        { slug: "utils-path", label: "utils-path" },
        { slug: "utils-platform", label: "utils-platform" },
        { slug: "utils-notifications", label: "utils-notifications" },
      ],
    },
    {
      id: "l4-auth",
      title: "Auth",
      items: [
        { slug: "token-manager-auth", label: "token-manager-auth" },
        { slug: "token-store", label: "token-store" },
      ],
    },
    {
      id: "l4-voice",
      title: "Voice",
      items: [
        { slug: "voice-recorder", label: "voice-recorder" },
        { slug: "voice-transcriber", label: "voice-transcriber" },
      ],
    },
    {
      id: "l4-sandbox",
      title: "Sandbox",
      items: [
        { slug: "sandbox-linux", label: "sandbox-linux" },
        { slug: "sandbox-bubblewrap", label: "sandbox-bubblewrap" },
        { slug: "sandbox-seatbelt", label: "sandbox-seatbelt" },
        { slug: "sandbox-network-policy", label: "sandbox-network-policy" },
        { slug: "sandbox-network-proxy", label: "sandbox-network-proxy" },
        {
          slug: "sandbox-sandboxed-network",
          label: "sandbox-sandboxed-network",
        },
      ],
    },
    {
      id: "l4-mentions",
      title: "Mentions",
      items: [
        { slug: "mention-parser", label: "mention-parser" },
        { slug: "mention-resolver", label: "mention-resolver" },
        { slug: "resource-resolver", label: "resource-resolver" },
      ],
    },
    {
      id: "l4-telemetry",
      title: "Telemetry",
      items: [
        { slug: "telemetry-events", label: "telemetry-events" },
        { slug: "telemetry-metrics", label: "telemetry-metrics" },
        { slug: "telemetry-otel", label: "telemetry-otel" },
        { slug: "telemetry-config", label: "telemetry-config" },
      ],
    },
    {
      id: "l4-indexing",
      title: "Indexing",
      items: [{ slug: "repo-map", label: "repo-map" }],
    },
    {
      id: "l4-other",
      title: "Other",
      items: [{ slug: "constants", label: "constants" }],
    },
  ],
};

// ─── Slash Commands (flat) ───────────────────────────────────────────────────
const layerCommands: LayerGroup = {
  id: "commands",
  title: "Slash Commands",
  icon: "⌨️",
  modules: [
    { slug: "cmd-init", label: "/init" },
    { slug: "cmd-commit", label: "/commit" },
    { slug: "cmd-review", label: "/review" },
    { slug: "cmd-diff", label: "/diff" },
    { slug: "cmd-context", label: "/context" },
    { slug: "cmd-model", label: "/model" },
    { slug: "cmd-dual-model", label: "/dual-model" },
    { slug: "cmd-effort", label: "/effort" },
    { slug: "cmd-agents", label: "/agents" },
    { slug: "cmd-team", label: "/team" },
    { slug: "cmd-memory", label: "/memory" },
    { slug: "cmd-mcp", label: "/mcp" },
    { slug: "cmd-permissions", label: "/permissions" },
    { slug: "cmd-export", label: "/export" },
    { slug: "cmd-analytics", label: "/analytics" },
    { slug: "cmd-stats", label: "/stats" },
    { slug: "cmd-doctor", label: "/doctor" },
    { slug: "cmd-update", label: "/update" },
    { slug: "cmd-resume", label: "/resume" },
    { slug: "cmd-rewind", label: "/rewind" },
    { slug: "cmd-undo", label: "/undo" },
    { slug: "cmd-bug", label: "/bug" },
    { slug: "cmd-copy", label: "/copy" },
    { slug: "cmd-cost", label: "/cost" },
    { slug: "cmd-registry", label: "/registry" },
  ],
};

const layers: LayerGroup[] = [layer1, layer2, layer3, layer4, layerCommands];

// ─── Chevron SVG ─────────────────────────────────────────────────────────────
function Chevron({ collapsed }: { readonly collapsed: boolean }) {
  return (
    <svg
      className="flex-shrink-0 transition-transform duration-200"
      style={{
        width: "12px",
        height: "12px",
        transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)",
        color: "#94a3b8",
      }}
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="2 4 6 8 10 4" />
    </svg>
  );
}

// ─── SubGroup component ───────────────────────────────────────────────────────
function SidebarSubGroup({
  group,
  pathname,
  isGroupCollapsed,
  onToggle,
}: {
  readonly group: SubGroup;
  readonly pathname: string;
  readonly isGroupCollapsed: boolean;
  readonly onToggle: () => void;
}) {
  return (
    <div className="mb-1">
      <button
        onClick={onToggle}
        aria-expanded={!isGroupCollapsed}
        aria-label={`토글: ${group.title}`}
        className="w-full flex items-center gap-1.5 cursor-pointer bg-transparent border-none outline-none"
        style={{
          textAlign: "left",
          paddingLeft: "16px",
          paddingRight: "8px",
          paddingTop: "4px",
          paddingBottom: "4px",
        }}
      >
        <Chevron collapsed={isGroupCollapsed} />
        <span
          style={{
            fontSize: "11px",
            fontWeight: 600,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: "#64748b",
          }}
        >
          {group.title}
        </span>
        <span
          style={{
            fontSize: "10px",
            fontWeight: 500,
            color: "#94a3b8",
            backgroundColor: "rgba(148,163,184,0.12)",
            borderRadius: "9999px",
            padding: "0 6px",
            lineHeight: "16px",
            marginLeft: "auto",
            flexShrink: 0,
          }}
        >
          {group.items.length}
        </span>
      </button>

      {!isGroupCollapsed && (
        <ul className="list-none" style={{ margin: 0, padding: 0 }}>
          {group.items.map((item) => {
            const href = `/docs/${item.slug}`;
            const isActive = pathname === href;
            return (
              <li key={item.slug}>
                <Link
                  href={href}
                  className={`text-sm block transition-colors duration-150 ${
                    isActive
                      ? "bg-indigo-50 font-semibold border-l-4 border-indigo-500"
                      : "hover:bg-gray-100 text-gray-700 border-l-4 border-transparent"
                  }`}
                  style={{
                    paddingLeft: "32px",
                    paddingRight: "12px",
                    paddingTop: "5px",
                    paddingBottom: "5px",
                    color: isActive ? "#4338ca" : undefined,
                    textDecoration: "none",
                    display: "block",
                  }}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─── Main Sidebar ─────────────────────────────────────────────────────────────
export function Sidebar() {
  const pathname = usePathname();

  // collapsed state for both layers and sub-groups
  const [layerCollapsed, setLayerCollapsed] = useState<Record<string, boolean>>({});
  const [groupCollapsed, setGroupCollapsed] = useState<Record<string, boolean>>({});

  const toggleLayer = (layerId: string) => {
    setLayerCollapsed((prev) => ({ ...prev, [layerId]: !prev[layerId] }));
  };

  const toggleGroup = (groupId: string) => {
    setGroupCollapsed((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  // Only show on /docs routes
  if (!pathname.startsWith("/docs")) {
    return null;
  }

  return (
    <aside className="sidebar" role="navigation" aria-label="문서 네비게이션">
      {layers.map((layer, idx) => {
        const isLayerCollapsed = layerCollapsed[layer.id] ?? false;

        return (
          <div key={layer.id} className={idx < layers.length - 1 ? "mb-6" : ""}>
            {/* Layer header */}
            <button
              onClick={() => toggleLayer(layer.id)}
              aria-expanded={!isLayerCollapsed}
              aria-label={`토글: ${layer.title}`}
              className="w-full flex items-center gap-1.5 px-4 mb-2 cursor-pointer bg-transparent border-none outline-none"
              style={{ textAlign: "left" }}
            >
              <Chevron collapsed={isLayerCollapsed} />
              <span className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
                {layer.icon} {layer.title}
              </span>
            </button>

            {/* Layer content */}
            {!isLayerCollapsed && (
              <div
                style={{
                  overflow: "hidden",
                  transition: "max-height 0.2s ease",
                }}
              >
                {/* Flat modules (Layer 2, Commands) */}
                {layer.modules && (
                  <ul className="list-none" style={{ margin: 0, padding: 0 }}>
                    {layer.modules.map((mod) => {
                      const href = `/docs/${mod.slug}`;
                      const isActive = pathname === href;
                      return (
                        <li key={mod.slug}>
                          <Link
                            href={href}
                            className={`text-sm block transition-colors duration-150 ${
                              isActive
                                ? "bg-indigo-50 font-semibold border-l-4 border-indigo-500"
                                : "hover:bg-gray-100 text-gray-700 border-l-4 border-transparent"
                            }`}
                            style={{
                              paddingLeft: "24px",
                              paddingRight: "12px",
                              paddingTop: "5px",
                              paddingBottom: "5px",
                              color: isActive ? "#4338ca" : undefined,
                              textDecoration: "none",
                              display: "block",
                            }}
                          >
                            {mod.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {/* Sub-groups (Layer 1, 3, 4) */}
                {layer.subGroups &&
                  layer.subGroups.map((group) => {
                    const isGroupCollapsed = groupCollapsed[group.id] ?? false;
                    return (
                      <SidebarSubGroup
                        key={group.id}
                        group={group}
                        pathname={pathname}
                        isGroupCollapsed={isGroupCollapsed}
                        onToggle={() => toggleGroup(group.id)}
                      />
                    );
                  })}
              </div>
            )}
          </div>
        );
      })}
    </aside>
  );
}

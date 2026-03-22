"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface ModuleItem {
  slug: string;
  label: string;
  status: "ready" | "planned";
}

interface LayerGroup {
  id: string;
  title: string;
  icon: string;
  modules: ModuleItem[];
}

const layers: LayerGroup[] = [
  {
    id: "layer-1",
    title: "Layer 1: CLI",
    icon: "🖥️",
    modules: [
      { slug: "use-agent-loop", label: "useAgentLoop", status: "ready" },
      { slug: "activity-feed", label: "ActivityFeed", status: "ready" },
    ],
  },
  {
    id: "layer-2",
    title: "Layer 2: Core",
    icon: "⚙️",
    modules: [
      { slug: "agent-loop", label: "agent-loop.ts", status: "ready" },
      { slug: "context-manager", label: "context-manager.ts", status: "ready" },
      { slug: "circuit-breaker", label: "circuit-breaker.ts", status: "ready" },
      { slug: "recovery-executor", label: "recovery-executor.ts", status: "ready" },
      { slug: "system-prompt-builder", label: "system-prompt-builder", status: "ready" },
      { slug: "checkpoint-manager", label: "checkpoint-manager", status: "ready" },
      { slug: "observation-masking", label: "observation-masking", status: "ready" },
    ],
  },
  {
    id: "layer-3",
    title: "Layer 3: Infrastructure",
    icon: "🔧",
    modules: [
      { slug: "token-counter", label: "token-counter", status: "ready" },
      { slug: "model-capabilities", label: "model-capabilities", status: "ready" },
      { slug: "secret-scanner", label: "secret-scanner", status: "ready" },
      { slug: "llm-client", label: "llm-client", status: "ready" },
      { slug: "dual-model-router", label: "dual-model-router", status: "ready" },
      { slug: "tool-registry", label: "tool-registry", status: "ready" },
      { slug: "tool-executor", label: "tool-executor", status: "ready" },
      { slug: "permission-manager", label: "permission-manager", status: "ready" },
      { slug: "mcp-manager", label: "mcp-manager", status: "ready" },
    ],
  },
  {
    id: "layer-4",
    title: "Layer 4: Leaf",
    icon: "🍃",
    modules: [
      { slug: "config-loader", label: "config-loader", status: "ready" },
      { slug: "skill-manager", label: "skill-manager", status: "ready" },
      { slug: "instruction-loader", label: "instruction-loader", status: "ready" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggleLayer = (layerId: string) => {
    setCollapsed((prev) => ({ ...prev, [layerId]: !prev[layerId] }));
  };

  // 사이드바는 /docs 경로에서만 표시
  if (!pathname.startsWith("/docs")) {
    return null;
  }

  return (
    <aside className="sidebar" role="navigation" aria-label="문서 네비게이션">
      {layers.map((layer, idx) => {
        const isCollapsed = collapsed[layer.id] ?? false;

        return (
          <div key={layer.id} className={idx < layers.length - 1 ? "mb-6" : ""}>
            {/* Layer 헤더 */}
            <button
              onClick={() => toggleLayer(layer.id)}
              aria-expanded={!isCollapsed}
              aria-label={`토글: ${layer.title}`}
              className="w-full flex items-center gap-1.5 px-4 mb-2 cursor-pointer bg-transparent border-none outline-none"
              style={{ textAlign: "left" }}
            >
              <svg
                className="flex-shrink-0 transition-transform duration-200"
                style={{
                  width: "12px",
                  height: "12px",
                  transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
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
              <span className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
                {layer.icon} {layer.title}
              </span>
            </button>

            {/* 모듈 목록 */}
            {!isCollapsed && (
              <ul className="list-none">
                {layer.modules.map((mod) => {
                  const href = `/docs/${mod.slug}`;
                  const isActive = pathname === href;
                  const isPlanned = mod.status === "planned";

                  if (isPlanned) {
                    return (
                      <li key={mod.slug}>
                        <span
                          className="text-sm py-1.5 px-4 block text-gray-400"
                          style={{ paddingLeft: "28px" }}
                        >
                          {mod.label}
                          <span className="ml-1 text-xs">(예정)</span>
                        </span>
                      </li>
                    );
                  }

                  return (
                    <li key={mod.slug}>
                      <Link
                        href={href}
                        className={`text-sm py-1.5 px-4 block transition-colors duration-150 ${
                          isActive
                            ? "bg-indigo-50 font-semibold border-l-4 border-indigo-500"
                            : "hover:bg-gray-100 text-gray-700 border-l-4 border-transparent"
                        }`}
                        style={{
                          paddingLeft: "24px",
                          color: isActive ? "#4338ca" : undefined,
                          textDecoration: "none",
                        }}
                      >
                        {mod.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </aside>
  );
}

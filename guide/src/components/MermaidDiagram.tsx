"use client";

import { useEffect, useRef, useState } from "react";

interface MermaidDiagramProps {
  chart: string;
  title?: string;
  titleColor?: "blue" | "purple" | "green" | "orange" | "pink" | "cyan" | "red";
}

const titleColorMap: Record<string, string> = {
  blue: "bg-blue-500",
  purple: "bg-purple-500",
  green: "bg-emerald-500",
  orange: "bg-amber-500",
  pink: "bg-pink-500",
  cyan: "bg-cyan-500",
  red: "bg-red-500",
};

export function MermaidDiagram({ chart, title, titleColor = "blue" }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function render() {
      const mermaid = (await import("mermaid")).default;
      mermaid.initialize({
        startOnLoad: false,
        theme: "base",
        themeVariables: {
          background: "#ffffff",
          primaryColor: "#eef2ff",
          primaryTextColor: "#1e293b",
          primaryBorderColor: "#a5b4fc",
          lineColor: "#94a3b8",
          secondaryColor: "#f1f5f9",
          secondaryTextColor: "#334155",
          secondaryBorderColor: "#cbd5e1",
          tertiaryColor: "#f8fafc",
          tertiaryTextColor: "#475569",
          tertiaryBorderColor: "#e2e8f0",
          noteBkgColor: "#fefce8",
          noteTextColor: "#713f12",
          noteBorderColor: "#fde68a",
          edgeLabelBackground: "#ffffff",
          clusterBkg: "#f8fafc",
          clusterBorder: "#e2e8f0",
          fontFamily: "Pretendard Variable, system-ui, sans-serif",
          fontSize: "13px",
        },
        flowchart: { curve: "basis", padding: 14, htmlLabels: true },
        sequence: { mirrorActors: false, messageMargin: 30, boxMargin: 8 },
      });

      if (containerRef.current && !cancelled) {
        const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`;
        try {
          const { svg } = await mermaid.render(id, chart);
          if (containerRef.current && !cancelled) {
            containerRef.current.innerHTML = svg;
            setRendered(true);
          }
        } catch {
          if (containerRef.current && !cancelled) {
            containerRef.current.innerHTML = `<pre style="color:#ef4444;font-size:12px;">Diagram render error</pre>`;
            setRendered(true);
          }
        }
      }
    }
    render();
    return () => {
      cancelled = true;
    };
  }, [chart]);

  return (
    <div
      role="img"
      aria-label={title || "다이어그램"}
      className="bg-white border border-[#e2e8f0] rounded-lg p-6 sm:p-8 mb-8 overflow-x-auto"
      style={{ padding: "24px", marginBottom: "32px", minHeight: "200px" }}
    >
      {title && (
        <div className="flex items-center gap-2 mb-5">
          <span className={`w-1 h-5 rounded-sm ${titleColorMap[titleColor]}`} />
          <span className="text-sm font-semibold text-gray-700">{title}</span>
        </div>
      )}
      {!rendered && (
        <div
          className="rounded-md animate-pulse"
          style={{
            backgroundColor: "#e2e8f0",
            height: "160px",
            width: "100%",
          }}
        />
      )}
      <div
        ref={containerRef}
        className="flex justify-center transition-opacity duration-500"
        style={{ opacity: rendered ? 1 : 0, display: rendered ? undefined : "none" }}
      />
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

interface MermaidDiagramProps {
  chart: string;
  title?: string;
  titleColor?: "blue" | "purple" | "green" | "orange" | "pink" | "cyan" | "red";
}

const titleColorMap: Record<string, string> = {
  blue: "from-[#3b82f6] to-[#06b6d4]",
  purple: "from-[#8b5cf6] to-[#ec4899]",
  green: "from-[#10b981] to-[#06b6d4]",
  orange: "from-[#f59e0b] to-[#ef4444]",
  pink: "from-[#ec4899] to-[#8b5cf6]",
  cyan: "from-[#06b6d4] to-[#3b82f6]",
  red: "from-[#ef4444] to-[#f59e0b]",
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
        theme: "dark",
        themeVariables: {
          darkMode: true,
          background: "#1a2035",
          primaryColor: "#3b82f6",
          primaryTextColor: "#f1f5f9",
          primaryBorderColor: "#3b82f6",
          lineColor: "#64748b",
          secondaryColor: "#8b5cf6",
          tertiaryColor: "#1e3a2a",
          fontFamily: "Pretendard Variable, system-ui, sans-serif",
          fontSize: "12px",
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
          }
        }
      }
    }
    render();
    return () => { cancelled = true; };
  }, [chart]);

  return (
    <div className="bg-bg-card border border-border rounded-2xl p-6 sm:p-9 mb-8 overflow-x-auto">
      {title && (
        <div className="flex items-center gap-2 mb-5 text-[15px] font-bold">
          <span className={`w-1 h-[18px] rounded-sm bg-gradient-to-b ${titleColorMap[titleColor]}`} />
          {title}
        </div>
      )}
      <div
        ref={containerRef}
        className="flex justify-center transition-opacity duration-500"
        style={{ opacity: rendered ? 1 : 0.3 }}
      />
    </div>
  );
}

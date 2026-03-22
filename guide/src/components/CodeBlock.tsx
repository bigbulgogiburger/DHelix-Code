"use client";

import { useState, useCallback } from "react";

interface CodeBlockProps {
  children: React.ReactNode;
  language?: string;
}

export function CodeBlock({ children, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    const text =
      typeof children === "string"
        ? children
        : extractTextFromNode(children);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may not be available in all contexts
    }
  }, [children]);

  return (
    <div
      className="relative bg-[#1e293b] border border-[#334155] rounded-lg p-5 my-6 overflow-x-auto font-mono text-sm leading-relaxed text-[#e2e8f0]"
      style={{ padding: "20px", margin: "24px 0" }}
    >
      {language && (
        <span className="absolute top-3 left-4 text-[10px] text-gray-400 uppercase tracking-wider select-none">
          {language}
        </span>
      )}
      <button
        onClick={handleCopy}
        className="absolute top-3 right-3 text-xs text-gray-400 hover:text-gray-200 transition-colors duration-150 bg-transparent border border-gray-600 hover:border-gray-400 rounded px-2 py-0.5 cursor-pointer select-none"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
      <pre className={language ? "mt-4" : ""}>{children}</pre>
    </div>
  );
}

function extractTextFromNode(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractTextFromNode).join("");
  if (typeof node === "object" && "props" in node) {
    const props = (node as React.ReactElement).props as Record<string, unknown>;
    return extractTextFromNode(props.children as React.ReactNode);
  }
  return "";
}

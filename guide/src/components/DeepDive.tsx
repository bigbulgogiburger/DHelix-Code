"use client";

import { useState } from "react";

interface DeepDiveProps {
  title: string;
  children: React.ReactNode;
}

export function DeepDive({ title, children }: DeepDiveProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="my-4 border border-[rgba(6,182,212,0.2)] rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-[rgba(6,182,212,0.04)] transition-colors"
      >
        <span className="text-base">🔬</span>
        <span className="text-sm font-bold text-accent-cyan flex-1">Deep Dive: {title}</span>
        <span
          className={`text-text-muted text-xs transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        >
          ▼
        </span>
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1 text-[13px] text-text-secondary leading-relaxed border-t border-[rgba(6,182,212,0.1)] bg-[rgba(6,182,212,0.02)]">
          {children}
        </div>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface DeepDiveProps {
  title: string;
  children: React.ReactNode;
}

export function DeepDive({ title, children }: DeepDiveProps) {
  const [open, setOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [maxHeight, setMaxHeight] = useState(0);

  const updateMaxHeight = useCallback(() => {
    if (contentRef.current) {
      setMaxHeight(contentRef.current.scrollHeight);
    }
  }, []);

  useEffect(() => {
    if (open) {
      updateMaxHeight();
    }
  }, [open, updateMaxHeight]);

  // Update maxHeight when content might change (e.g. images loading, dynamic content)
  useEffect(() => {
    if (!open || !contentRef.current) return;

    const observer = new ResizeObserver(() => {
      updateMaxHeight();
    });
    observer.observe(contentRef.current);

    return () => observer.disconnect();
  }, [open, updateMaxHeight]);

  return (
    <div
      className="my-5 border border-[#e2e8f0] rounded-lg overflow-hidden"
      style={{ margin: "20px 0" }}
    >
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
        style={{ padding: "16px 20px" }}
        aria-expanded={open}
      >
        <span className="text-base">🔬</span>
        <span className="text-sm font-semibold text-indigo-600 flex-1">Deep Dive: {title}</span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div
        ref={contentRef}
        className="transition-all duration-300 ease-in-out overflow-hidden"
        style={{ maxHeight: open ? `${maxHeight}px` : "0px", opacity: open ? 1 : 0 }}
      >
        <div
          className="px-5 pb-5 pt-3 text-sm text-gray-600 leading-relaxed border-t border-[#e2e8f0] bg-gray-50"
          style={{ padding: "12px 20px 20px" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const deepDiveItems = [
  { href: "/#agent-loop", label: "Agent Loop" },
  { href: "/#context", label: "Context" },
  { href: "/#llm", label: "LLM" },
  { href: "/#tools", label: "Tools" },
  { href: "/#permissions", label: "Permissions" },
  { href: "/#mcp", label: "MCP" },
  { href: "/#recovery", label: "Recovery" },
  { href: "/#config", label: "Config" },
  { href: "/#subagent", label: "Subagent" },
];

export function Navigation() {
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState("");
  const pathname = usePathname();
  const isDocs = pathname.startsWith("/docs");

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 10);
      if (!isDocs) {
        const sections = document.querySelectorAll("section[id]");
        let current = "";
        sections.forEach((section) => {
          const top = (section as HTMLElement).offsetTop - 100;
          if (window.scrollY >= top) current = section.getAttribute("id") || "";
        });
        setActive(current);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isDocs]);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 bg-[rgba(10,14,26,0.88)] backdrop-blur-[20px] border-b border-border transition-shadow ${
        scrolled ? "shadow-[0_4px_30px_rgba(0,0,0,0.3)]" : ""
      }`}
    >
      <div className="max-w-[1400px] mx-auto px-4 sm:px-8 flex items-center justify-between h-16">
        {/* Logo */}
        <Link href="/" className="text-xl font-extrabold tracking-tight hover:opacity-80 transition-opacity">
          <span className="bg-gradient-to-r from-accent-purple to-accent-pink bg-clip-text text-transparent">
            dbcode
          </span>{" "}
          Guide
        </Link>

        {/* Main Tabs */}
        <div className="hidden md:flex items-center gap-1">
          {/* Deep Dive Tab */}
          <Link
            href="/"
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              !isDocs
                ? "text-text-primary bg-[rgba(139,92,246,0.15)] border border-[rgba(139,92,246,0.3)]"
                : "text-text-secondary hover:text-text-primary hover:bg-[rgba(139,92,246,0.08)]"
            }`}
          >
            Deep Dive
          </Link>

          {/* Source Reference Tab */}
          <Link
            href="/docs"
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              isDocs
                ? "text-text-primary bg-[rgba(6,182,212,0.15)] border border-[rgba(6,182,212,0.3)]"
                : "text-text-secondary hover:text-text-primary hover:bg-[rgba(6,182,212,0.08)]"
            }`}
          >
            Source Reference
          </Link>

          {/* Divider */}
          {!isDocs && (
            <>
              <div className="w-px h-5 bg-border mx-2" />
              {/* Deep Dive sub-nav */}
              <div className="flex gap-0.5">
                {deepDiveItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      active === item.href.replace("/#", "")
                        ? "text-text-primary bg-[rgba(139,92,246,0.12)]"
                        : "text-text-muted hover:text-text-secondary hover:bg-[rgba(139,92,246,0.06)]"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

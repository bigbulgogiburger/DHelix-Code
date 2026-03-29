"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function Navigation() {
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const isDocs = pathname.startsWith("/docs");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 bg-white border-b border-border transition-shadow ${
        scrolled ? "shadow-sm" : ""
      }`}
      style={{ height: "var(--nav-height)" }}
    >
      <div
        className="center-wide flex items-center justify-between"
        style={{ height: "var(--nav-height)" }}
      >
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-0 text-xl tracking-tight no-underline hover:no-underline"
        >
          <span className="font-bold text-indigo-600">dhelix</span>
          <span className="font-normal text-text-muted" style={{ marginLeft: "6px" }}>
            Guide
          </span>
        </Link>

        {/* Center: Tabs */}
        <div className="flex items-center" style={{ gap: "20px" }}>
          <Link
            href="/"
            className={`relative px-4 py-4 text-base font-medium transition-colors no-underline hover:no-underline ${
              !isDocs
                ? "text-indigo-600 border-b-2 border-indigo-600"
                : "text-text-muted hover:text-text-secondary border-b-2 border-transparent"
            }`}
            style={{ marginBottom: "-1px" }}
          >
            Deep Dive
          </Link>
          <Link
            href="/docs"
            className={`relative px-4 py-4 text-base font-medium transition-colors no-underline hover:no-underline ${
              isDocs
                ? "text-indigo-600 border-b-2 border-indigo-600"
                : "text-text-muted hover:text-text-secondary border-b-2 border-transparent"
            }`}
            style={{ marginBottom: "-1px" }}
          >
            Source Reference
          </Link>
        </div>

        {/* Right: placeholder for future dark mode toggle / GitHub link */}
        <div className="hidden md:flex items-center gap-3">
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-text-muted hover:text-text-secondary transition-colors no-underline"
            aria-label="GitHub"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
          </a>
        </div>

        {/* Mobile: hamburger (toggles sidebar on mobile) */}
        <button
          className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg text-text-muted hover:text-text-secondary hover:bg-bg-secondary transition-colors"
          aria-label="메뉴 열기"
          onClick={() => {
            // Dispatch a custom event that sidebar components can listen to
            window.dispatchEvent(new CustomEvent("toggle-mobile-sidebar"));
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      </div>
    </nav>
  );
}

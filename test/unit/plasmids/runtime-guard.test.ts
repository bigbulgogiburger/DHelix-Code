/**
 * Unit tests — `src/plasmids/runtime-guard.ts`.
 *
 * Layer A (pure function) verification for I-8 hermeticity:
 *   - `isPathBlocked` must recognize plasmid paths under every syntactic
 *     form (relative, absolute, traversal, URL-encoded, backslash,
 *     case-variant).
 *   - `extractPathsFromToolCall` must enumerate path-bearing arguments
 *     across all 15 built-in tools listed in the mission scope.
 */

import { describe, expect, it } from "vitest";
import {
  extractPathsFromToolCall,
  isPathBlocked,
  RUNTIME_BLOCKED_PATTERNS,
} from "../../../src/plasmids/runtime-guard.js";

const CWD = "/abs/project";

describe("RUNTIME_BLOCKED_PATTERNS", () => {
  it("contains at least the drafts + root + reserved-filename patterns", () => {
    expect(RUNTIME_BLOCKED_PATTERNS.length).toBeGreaterThanOrEqual(3);
  });
});

describe("isPathBlocked — positive cases", () => {
  it("blocks relative `.dhelix/plasmids/foo/body.md`", () => {
    const m = isPathBlocked(".dhelix/plasmids/foo/body.md", CWD);
    expect(m).not.toBeNull();
    expect(m?.path).toContain(".dhelix/plasmids/foo/body.md".toLowerCase());
  });

  it("blocks absolute plasmid path", () => {
    const m = isPathBlocked("/abs/project/.dhelix/plasmids/foo.md", CWD);
    expect(m).not.toBeNull();
  });

  it("blocks traversal paths that resolve into .dhelix/plasmids", () => {
    const m = isPathBlocked("../project/.dhelix/plasmids/foo.md", "/abs/project/sub");
    expect(m).not.toBeNull();
  });

  it("blocks URL-encoded plasmid paths (%2F, %2E)", () => {
    const m = isPathBlocked("%2Edhelix%2Fplasmids%2Ffoo%2Fbody.md", CWD);
    // %2E decodes to `.`, %2F decodes to `/`
    expect(m).not.toBeNull();
  });

  it("blocks drafts subdirectory", () => {
    const m = isPathBlocked(".dhelix/plasmids/.drafts/foo.md", CWD);
    expect(m).not.toBeNull();
  });

  it("blocks paths with Windows-style backslashes", () => {
    const m = isPathBlocked(".dhelix\\plasmids\\foo\\body.md", CWD);
    expect(m).not.toBeNull();
  });

  it("is case-insensitive (macOS/NTFS safety)", () => {
    const m1 = isPathBlocked(".DHelix/Plasmids/Foo.md", CWD);
    const m2 = isPathBlocked(".DHELIX/PLASMIDS/foo/BODY.MD", CWD);
    expect(m1).not.toBeNull();
    expect(m2).not.toBeNull();
  });

  it("blocks reserved filenames under a plasmid directory", () => {
    expect(isPathBlocked(".dhelix/plasmids/foo/metadata.yaml", CWD)).not.toBeNull();
    expect(isPathBlocked(".dhelix/plasmids/foo/metadata.yml", CWD)).not.toBeNull();
    expect(isPathBlocked(".dhelix/plasmids/foo/body.md", CWD)).not.toBeNull();
  });

  it("blocks the bare `.dhelix/plasmids` directory itself", () => {
    expect(isPathBlocked(".dhelix/plasmids", CWD)).not.toBeNull();
    expect(isPathBlocked(".dhelix/plasmids/", CWD)).not.toBeNull();
  });

  it("blocks file:// scheme plasmid paths", () => {
    expect(isPathBlocked("file:///abs/project/.dhelix/plasmids/foo.md", CWD)).not.toBeNull();
  });

  it("blocks `.dhelix/recombination/**` (Phase-3 I-8 defense-in-depth)", () => {
    // Transcripts, refs (which leak plasmid ids), objects store, audit.log,
    // validation-history.jsonl, validation-overrides.jsonl all live under
    // `.dhelix/recombination/` and must be invisible to the runtime agent.
    expect(isPathBlocked(".dhelix/recombination/transcripts/foo.json", CWD)).not.toBeNull();
    expect(isPathBlocked(".dhelix/recombination/refs/plasmids/sec-gate", CWD)).not.toBeNull();
    expect(isPathBlocked(".dhelix/recombination/validation-overrides.jsonl", CWD)).not.toBeNull();
    expect(isPathBlocked(".dhelix/recombination/validation-history.jsonl", CWD)).not.toBeNull();
    expect(isPathBlocked(".dhelix/recombination/audit.log", CWD)).not.toBeNull();
    expect(isPathBlocked(".dhelix/recombination", CWD)).not.toBeNull();
    expect(isPathBlocked(".DHELIX/RECOMBINATION/transcripts/x.json", CWD)).not.toBeNull();
  });
});

describe("isPathBlocked — negative cases (must NOT block)", () => {
  it("allows unrelated source paths", () => {
    expect(isPathBlocked("src/index.ts", CWD)).toBeNull();
    expect(isPathBlocked("/abs/project/src/utils/path.ts", CWD)).toBeNull();
  });

  it("allows non-plasmid .dhelix subpaths", () => {
    expect(isPathBlocked(".dhelix/skills/foo.md", CWD)).toBeNull();
    expect(isPathBlocked(".dhelix/prompt-sections/generated/base.md", CWD)).toBeNull();
  });

  it("does not block `metadata.yaml` in arbitrary locations (only under .dhelix/plasmids)", () => {
    expect(isPathBlocked("src/metadata.yaml", CWD)).toBeNull();
    expect(isPathBlocked("docs/config/metadata.yml", CWD)).toBeNull();
  });

  it("rejects prefix-confusion (`.dhelix/plasmidsmeta/...`)", () => {
    // `.dhelix/plasmidsmeta/` shares a prefix but is NOT under plasmids.
    expect(isPathBlocked(".dhelix/plasmidsmeta/foo.md", CWD)).toBeNull();
  });

  it("returns null for empty or non-string-like inputs", () => {
    expect(isPathBlocked("", CWD)).toBeNull();
  });
});

describe("extractPathsFromToolCall — path-based tools", () => {
  it("extracts `path` from file_read", () => {
    const r = extractPathsFromToolCall(
      { name: "file_read", arguments: { path: "src/a.ts" } },
      CWD,
    );
    expect(r.map((e) => e.value)).toEqual(["src/a.ts"]);
    expect(r[0].argKey).toBe("path");
  });

  it("extracts `path` from file_write / file_edit", () => {
    for (const name of ["file_write", "file_edit"]) {
      const r = extractPathsFromToolCall(
        { name, arguments: { path: "x.txt", content: "hi" } },
        CWD,
      );
      expect(r.some((e) => e.value === "x.txt" && e.argKey === "path")).toBe(true);
    }
  });

  it("extracts `pattern` from glob_search", () => {
    const r = extractPathsFromToolCall(
      { name: "glob_search", arguments: { pattern: ".dhelix/plasmids/**" } },
      CWD,
    );
    expect(r.some((e) => e.value === ".dhelix/plasmids/**")).toBe(true);
  });

  it("extracts `path` from grep_search (the target directory)", () => {
    const r = extractPathsFromToolCall(
      { name: "grep_search", arguments: { pattern: "foo", path: ".dhelix/plasmids/" } },
      CWD,
    );
    expect(r.some((e) => e.value === ".dhelix/plasmids/")).toBe(true);
  });

  it("extracts `path` from list_dir", () => {
    const r = extractPathsFromToolCall(
      { name: "list_dir", arguments: { path: ".dhelix/plasmids" } },
      CWD,
    );
    expect(r.some((e) => e.value === ".dhelix/plasmids")).toBe(true);
  });

  it("extracts each entry of `paths[]` for batch_file_ops (generic + operations[])", () => {
    const r = extractPathsFromToolCall(
      {
        name: "batch_file_ops",
        arguments: {
          operations: [
            { op: "read", path: ".dhelix/plasmids/a.md" },
            { op: "read", path: "src/b.ts" },
          ],
        },
      },
      CWD,
    );
    const vals = r.map((e) => e.value);
    expect(vals).toContain(".dhelix/plasmids/a.md");
    expect(vals).toContain("src/b.ts");
  });

  it("extracts `path` / `from` / `to` from safe_rename and apply_patch", () => {
    const r1 = extractPathsFromToolCall(
      { name: "safe_rename", arguments: { from: "a.ts", to: "b.ts" } },
      CWD,
    );
    expect(r1.map((e) => e.value).sort()).toEqual(["a.ts", "b.ts"]);

    const r2 = extractPathsFromToolCall(
      { name: "apply_patch", arguments: { path: "src/a.ts" } },
      CWD,
    );
    expect(r2.map((e) => e.value)).toContain("src/a.ts");
  });

  it("extracts `path` from mkdir", () => {
    const r = extractPathsFromToolCall(
      { name: "mkdir", arguments: { path: ".dhelix/plasmids/new" } },
      CWD,
    );
    expect(r.some((e) => e.value === ".dhelix/plasmids/new")).toBe(true);
  });

  it("tolerates tools without path args (returns [])", () => {
    expect(
      extractPathsFromToolCall({ name: "find_references", arguments: { symbol: "foo" } }, CWD),
    ).toEqual([]);
    expect(
      extractPathsFromToolCall({ name: "symbol_search", arguments: { query: "bar" } }, CWD),
    ).toEqual([]);
    expect(extractPathsFromToolCall({ name: "unknown_tool", arguments: {} }, CWD)).toEqual([]);
  });

  it("still extracts `path`/`file` from find_references / find_dependencies / code_outline when present", () => {
    const r = extractPathsFromToolCall(
      { name: "code_outline", arguments: { path: "src/a.ts" } },
      CWD,
    );
    expect(r.some((e) => e.value === "src/a.ts")).toBe(true);
  });
});

describe("extractPathsFromToolCall — bash_exec command parsing", () => {
  it("extracts path tokens from `cat path`", () => {
    const r = extractPathsFromToolCall(
      { name: "bash_exec", arguments: { command: "cat .dhelix/plasmids/foo/body.md" } },
      CWD,
    );
    expect(r.some((e) => e.value === ".dhelix/plasmids/foo/body.md")).toBe(true);
    // argKey should identify the utility.
    expect(r[0].argKey.startsWith("command#cat")).toBe(true);
  });

  it("extracts path from `rg 'secret' .dhelix/plasmids`", () => {
    const r = extractPathsFromToolCall(
      { name: "bash_exec", arguments: { command: "rg 'secret' .dhelix/plasmids" } },
      CWD,
    );
    expect(r.some((e) => e.value === ".dhelix/plasmids")).toBe(true);
  });

  it("extracts path from `ls .dhelix/plasmids/`", () => {
    const r = extractPathsFromToolCall(
      { name: "bash_exec", arguments: { command: "ls .dhelix/plasmids/" } },
      CWD,
    );
    expect(r.some((e) => e.value === ".dhelix/plasmids/")).toBe(true);
  });

  it("extracts RHS of VAR=path assignment", () => {
    const r = extractPathsFromToolCall(
      {
        name: "bash_exec",
        arguments: { command: "FILE=.dhelix/plasmids/x cat $FILE" },
      },
      CWD,
    );
    expect(r.some((e) => e.value === ".dhelix/plasmids/x")).toBe(true);
  });

  it("still surfaces plasmid substring even if quoting glues it to pipeline", () => {
    const r = extractPathsFromToolCall(
      {
        name: "bash_exec",
        arguments: { command: `echo "data" | cat ".dhelix/plasmids/y.md"` },
      },
      CWD,
    );
    const values = r.map((e) => e.value);
    expect(values.some((v) => v.includes(".dhelix/plasmids/y.md"))).toBe(true);
  });

  it("ignores flags", () => {
    const r = extractPathsFromToolCall(
      { name: "bash_exec", arguments: { command: "ls -la" } },
      CWD,
    );
    expect(r.every((e) => e.value !== "-la")).toBe(true);
  });

  it("returns empty for missing/non-string command", () => {
    expect(
      extractPathsFromToolCall({ name: "bash_exec", arguments: {} }, CWD),
    ).toEqual([]);
  });
});

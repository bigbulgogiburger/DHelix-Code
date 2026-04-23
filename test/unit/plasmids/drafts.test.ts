import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { DraftsStore } from "../../../src/plasmids/drafts.js";
import type { PlasmidId } from "../../../src/plasmids/types.js";

const ID = (s: string) => s as PlasmidId;

describe("DraftsStore", () => {
  let workingDirectory: string;
  let store: DraftsStore;

  beforeEach(async () => {
    workingDirectory = await mkdtemp(join(tmpdir(), "dhelix-drafts-"));
    store = new DraftsStore({
      workingDirectory,
      draftsPath: ".dhelix/plasmids/.drafts",
    });
  });

  afterEach(async () => {
    await rm(workingDirectory, { recursive: true, force: true });
  });

  describe("save", () => {
    it("creates the directory lazily and writes the draft atomically", async () => {
      const path = await store.save(ID("owasp-gate"), "# body\n");
      expect(path.endsWith("owasp-gate.md")).toBe(true);

      const content = await readFile(path, "utf8");
      expect(content).toBe("# body\n");
    });

    it("overwrites an existing draft", async () => {
      await store.save(ID("owasp-gate"), "first");
      await store.save(ID("owasp-gate"), "second");
      const content = await store.load(ID("owasp-gate"));
      expect(content).toBe("second");
    });

    it("rejects traversal in the id", async () => {
      await expect(store.save(ID("../evil"), "x")).rejects.toThrow(/invalid plasmid id/i);
    });

    it("honors an absolute draftsPath", async () => {
      const absolute = join(workingDirectory, "custom-drafts");
      const absStore = new DraftsStore({
        workingDirectory: "/ignored",
        draftsPath: absolute,
      });
      const p = await absStore.save(ID("alpha"), "hi");
      expect(p.startsWith(absolute.replace(/\\/g, "/"))).toBe(true);
    });

    it("cleans up temp file and throws when aborted before rename", async () => {
      const controller = new AbortController();
      controller.abort(new Error("user cancelled"));
      await expect(
        store.save(ID("aborted"), "partial", controller.signal),
      ).rejects.toThrow();

      // No final file should exist.
      const listed = await store.list();
      expect(listed).not.toContain(ID("aborted"));

      // No orphan temp file lingering.
      const entries = await readdir(store.directory).catch(() => [] as string[]);
      expect(entries.filter((e) => e.includes(".tmp-"))).toEqual([]);
    });
  });

  describe("load", () => {
    it("returns null on missing draft", async () => {
      const content = await store.load(ID("missing"));
      expect(content).toBeNull();
    });

    it("roundtrips utf-8 content", async () => {
      await store.save(ID("한글-ok") as PlasmidId, "한글 내용 ✓\n");
      // We use a safe ascii id for the actual key per brand rules;
      // ensure content can be unicode.
      await store.save(ID("ko-plasmid"), "한글 내용 ✓\n");
      const content = await store.load(ID("ko-plasmid"));
      expect(content).toBe("한글 내용 ✓\n");
    });
  });

  describe("list", () => {
    it("returns [] when the directory does not exist", async () => {
      const fresh = new DraftsStore({
        workingDirectory,
        draftsPath: "never-created",
      });
      expect(await fresh.list()).toEqual([]);
    });

    it("returns only .md drafts, sorted, excluding temp files", async () => {
      await store.save(ID("zeta"), "z");
      await store.save(ID("alpha"), "a");
      // Manually drop a stray temp file & non-md entry.
      await writeFile(join(store.directory, "beta.md.tmp-abc123"), "half");
      await writeFile(join(store.directory, "notes.txt"), "ignore me");

      const ids = await store.list();
      expect(ids).toEqual([ID("alpha"), ID("zeta")]);
    });
  });

  describe("delete", () => {
    it("returns true when the draft existed", async () => {
      await store.save(ID("goner"), "x");
      expect(await store.delete(ID("goner"))).toBe(true);
      expect(await store.load(ID("goner"))).toBeNull();
    });

    it("returns false when the draft is missing", async () => {
      expect(await store.delete(ID("never-was"))).toBe(false);
    });
  });

  describe("AbortSignal", () => {
    it("throws synchronously if signal is already aborted at save", async () => {
      const c = new AbortController();
      c.abort();
      await expect(store.save(ID("x"), "y", c.signal)).rejects.toThrow();
    });

    it("throws if aborted during load", async () => {
      const c = new AbortController();
      c.abort();
      await expect(store.load(ID("x"), c.signal)).rejects.toThrow();
    });

    it("throws if aborted during list", async () => {
      const c = new AbortController();
      c.abort();
      await expect(store.list(c.signal)).rejects.toThrow();
    });
  });
});

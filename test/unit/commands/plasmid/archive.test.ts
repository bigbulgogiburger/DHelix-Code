/**
 * `/plasmid archive <id>` — Phase 5 Team 5.
 *
 * Coverage:
 *   - non-foundational plasmid: file moves to `.dhelix/plasmids/archive/`
 *   - foundational plasmid: rejected with the `/plasmid challenge --action revoke` hint
 *   - unknown id: graceful not-found
 *   - missing arg / extra arg validation
 *   - flag-like token rejected
 */
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { archiveSubcommand } from "../../../../src/commands/plasmid/archive.js";
import { PLASMIDS_ARCHIVE_DIR } from "../../../../src/plasmids/types.js";
import type { PlasmidId } from "../../../../src/plasmids/types.js";
import { fakeDeps, makeContext, makeLoaded, makeMetadata } from "./_fixtures.js";

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

describe("/plasmid archive", () => {
  let cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    for (const fn of cleanups) await fn();
    cleanups = [];
  });

  it("rejects when no id is supplied", async () => {
    const fx = await fakeDeps();
    cleanups.push(fx.cleanup);
    const r = await archiveSubcommand([], makeContext(fx.workingDirectory), fx.deps);
    expect(r.success).toBe(false);
    expect(r.output).toContain("Missing argument");
  });

  it("rejects flag-like tokens", async () => {
    const fx = await fakeDeps();
    cleanups.push(fx.cleanup);
    const r = await archiveSubcommand(
      ["--force"],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(r.success).toBe(false);
    expect(r.output).toContain("Unknown flag");
  });

  it("rejects more than one positional id", async () => {
    const fx = await fakeDeps();
    cleanups.push(fx.cleanup);
    const r = await archiveSubcommand(
      ["alpha", "beta"],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(r.success).toBe(false);
    expect(r.output).toContain("Only one plasmid id");
  });

  it("returns not-found for an unknown id", async () => {
    const fx = await fakeDeps();
    cleanups.push(fx.cleanup);
    const r = await archiveSubcommand(
      ["ghost"],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(r.success).toBe(false);
    expect(r.output).toContain("Plasmid not found");
  });

  it("moves a non-foundational plasmid to the archive directory", async () => {
    // Stage a real source file inside the workdir so the rename has a target.
    const fx = await fakeDeps({ loaded: [] });
    cleanups.push(fx.cleanup);

    const srcDir = join(fx.workingDirectory, ".dhelix/plasmids/alpha");
    await mkdir(srcDir, { recursive: true });
    const sourcePath = join(srcDir, "body.md");
    await writeFile(sourcePath, "# alpha body\n", "utf-8");

    // Wire the loader to return a LoadedPlasmid pointing at the real file.
    const loaded = makeLoaded(
      makeMetadata({ id: "alpha" as PlasmidId, foundational: false }),
      { sourcePath },
    );
    const deps = { ...fx.deps, loadPlasmids: async () => ({ loaded: [loaded], failed: [] }) };

    const r = await archiveSubcommand(
      ["alpha"],
      makeContext(fx.workingDirectory),
      deps,
    );
    expect(r.success).toBe(true);
    expect(r.output).toContain("Archived plasmid 'alpha'");

    // Source is gone, destination exists under the archive dir.
    expect(await fileExists(sourcePath)).toBe(false);
    const archiveDir = join(fx.workingDirectory, PLASMIDS_ARCHIVE_DIR);
    const entries = await readdir(archiveDir);
    expect(entries.length).toBe(1);
    const archived = entries[0]!;
    expect(archived.startsWith("alpha-")).toBe(true);
    expect(archived.endsWith(".md")).toBe(true);
  });

  it("refuses a foundational plasmid and cites the revoke hint", async () => {
    const fx = await fakeDeps({
      loaded: [
        makeLoaded(
          makeMetadata({
            id: "core-values" as PlasmidId,
            foundational: true,
            tier: "L4",
          }),
        ),
      ],
    });
    cleanups.push(fx.cleanup);

    const r = await archiveSubcommand(
      ["core-values"],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(r.success).toBe(false);
    expect(r.output).toContain("foundational");
    // MUST cite the challenge --action revoke path verbatim.
    expect(r.output).toContain("/plasmid challenge");
    expect(r.output).toContain("--action revoke");
  });
});

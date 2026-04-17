/**
 * Tests for src/skills/creator/packaging/install.ts
 *
 * Uses hand-crafted POSIX ustar tar buffers (mirroring F1's `buildTarArchive`
 * layout in package.ts) to exercise happy paths and malicious archives.
 */

import { createHash } from "node:crypto";
import { mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  InstallError,
  evaluateInstallPolicy,
  installSkill,
} from "../../../../../src/skills/creator/packaging/install.js";
import type { DskillManifest } from "../../../../../src/skills/creator/packaging/package.js";

// ---------------------------------------------------------------------------
// Test tar builder — byte-compatible with F1's buildUstarHeader
// ---------------------------------------------------------------------------

interface TestEntry {
  readonly name: string;
  readonly bytes: Buffer;
  readonly typeflag?: "0" | "1" | "2" | "5"; // regular / hardlink / symlink / dir
}

function buildUstarHeader(
  name: string,
  size: number,
  mtimeSec: number,
  typeflag: string,
): Buffer {
  const header = Buffer.alloc(512);

  let nameField = name;
  let prefixField = "";
  if (Buffer.byteLength(nameField, "utf8") > 100) {
    const slashIdx = name.lastIndexOf("/", 155);
    if (slashIdx > 0 && Buffer.byteLength(name.slice(slashIdx + 1), "utf8") <= 100) {
      prefixField = name.slice(0, slashIdx);
      nameField = name.slice(slashIdx + 1);
    }
  }
  header.write(nameField, 0, 100, "utf8");
  header.write("0000644\0", 100, 8, "ascii");
  header.write("0000000\0", 108, 8, "ascii");
  header.write("0000000\0", 116, 8, "ascii");
  header.write(size.toString(8).padStart(11, "0") + "\0", 124, 12, "ascii");
  header.write(mtimeSec.toString(8).padStart(11, "0") + "\0", 136, 12, "ascii");
  header.write("        ", 148, 8, "ascii");
  header.write(typeflag, 156, 1, "ascii");
  header.write("ustar\0", 257, 6, "ascii");
  header.write("00", 263, 2, "ascii");
  header.write("0000000\0", 329, 8, "ascii");
  header.write("0000000\0", 337, 8, "ascii");
  if (prefixField) header.write(prefixField, 345, 155, "utf8");

  let sum = 0;
  for (let i = 0; i < 512; i += 1) sum += header[i] ?? 0;
  header.write(sum.toString(8).padStart(6, "0") + "\0 ", 148, 8, "ascii");
  return header;
}

function buildTar(entries: readonly TestEntry[]): Buffer {
  const mtimeSec = 1700000000;
  const chunks: Buffer[] = [];
  for (const e of entries) {
    const size = e.typeflag === "5" ? 0 : e.bytes.length;
    chunks.push(buildUstarHeader(e.name, size, mtimeSec, e.typeflag ?? "0"));
    if (size > 0) {
      chunks.push(e.bytes);
      const pad = size % 512;
      if (pad !== 0) chunks.push(Buffer.alloc(512 - pad, 0));
    }
  }
  chunks.push(Buffer.alloc(1024, 0));
  return Buffer.concat(chunks);
}

/** Compute sha256 the same way F1's packager does. */
function computeSha256(
  entries: readonly { readonly relPath: string; readonly bytes: Buffer }[],
): string {
  const sorted = [...entries].sort((a, b) => a.relPath.localeCompare(b.relPath));
  const hash = createHash("sha256");
  const zero = new Uint8Array([0]);
  for (const e of sorted) {
    hash.update(e.relPath);
    hash.update(zero);
    hash.update(e.bytes);
    hash.update(zero);
  }
  return hash.digest("hex");
}

/** Build a valid .dskill archive buffer with a minimal SKILL.md + README. */
function buildValidDskill(args: {
  readonly name?: string;
  readonly tools?: readonly string[];
  readonly mutateBytes?: boolean;
} = {}): { buf: Buffer; manifest: DskillManifest } {
  const name = args.name ?? "demo-skill";
  const skillMd = Buffer.from(
    `---\nname: ${name}\ndescription: demo\n---\n\n# Demo\n`,
    "utf8",
  );
  const readme = Buffer.from(`# ${name}\n\nDemo.\n`, "utf8");
  const rawEntries = [
    { relPath: "SKILL.md", bytes: skillMd },
    { relPath: "README.md", bytes: readme },
  ];
  const sha256 = computeSha256(rawEntries);
  const manifest: DskillManifest = {
    name,
    version: "0.1.0",
    description: "demo",
    trustLevel: "project",
    sha256,
    createdAt: "2026-04-17T00:00:00.000Z",
    files: ["manifest.json", "README.md", "SKILL.md"],
    ...(args.tools ? { tools: args.tools } : {}),
  } as DskillManifest;
  const manifestBytes = Buffer.from(JSON.stringify(manifest, null, 2), "utf8");

  const finalEntries: TestEntry[] = [
    { name: "manifest.json", bytes: manifestBytes },
    { name: "SKILL.md", bytes: args.mutateBytes ? Buffer.from("tampered", "utf8") : skillMd },
    { name: "README.md", bytes: readme },
  ];
  return { buf: buildTar(finalEntries), manifest };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("installSkill", () => {
  let workDir: string;
  let destDir: string;
  let archivePath: string;

  beforeEach(async () => {
    workDir = await mkdtemp(join(tmpdir(), "install-test-"));
    destDir = join(workDir, "skills");
    archivePath = join(workDir, "demo.dskill");
  });

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  it("happy path: extracts and verifies a valid archive", async () => {
    const { buf } = buildValidDskill();
    await writeFile(archivePath, buf);

    const result = await installSkill({
      archivePath,
      destDir,
      trustLevel: "project",
    });

    expect(result.verified).toBe(true);
    expect(result.manifest.name).toBe("demo-skill");
    expect(result.filesExtracted).toContain("SKILL.md");
    expect(result.filesExtracted).toContain("README.md");
    const body = await readFile(join(result.skillDir, "SKILL.md"), "utf8");
    expect(body).toContain("# Demo");
  });

  it("ARCHIVE_NOT_FOUND when path does not exist", async () => {
    await expect(
      installSkill({ archivePath: join(workDir, "missing.dskill"), destDir }),
    ).rejects.toMatchObject({ code: "ARCHIVE_NOT_FOUND" });
  });

  it("TAR_SLIP_REJECTED when archive contains ../evil.sh", async () => {
    const evil: TestEntry = {
      name: "../evil.sh",
      bytes: Buffer.from("#!/bin/sh\n", "utf8"),
    };
    const manifestBytes = Buffer.from(
      JSON.stringify({ name: "x", sha256: "a" }),
      "utf8",
    );
    const buf = buildTar([{ name: "manifest.json", bytes: manifestBytes }, evil]);
    await writeFile(archivePath, buf);

    await expect(installSkill({ archivePath, destDir })).rejects.toMatchObject({
      code: "TAR_SLIP_REJECTED",
    });
  });

  it("SYMLINK_REJECTED when archive contains a symlink entry", async () => {
    const sym: TestEntry = {
      name: "link.txt",
      bytes: Buffer.alloc(0),
      typeflag: "2",
    };
    const manifestBytes = Buffer.from(
      JSON.stringify({ name: "x", sha256: "a" }),
      "utf8",
    );
    const buf = buildTar([{ name: "manifest.json", bytes: manifestBytes }, sym]);
    await writeFile(archivePath, buf);

    await expect(installSkill({ archivePath, destDir })).rejects.toMatchObject({
      code: "SYMLINK_REJECTED",
    });
  });

  it("also rejects hardlink entries", async () => {
    const hard: TestEntry = {
      name: "link.txt",
      bytes: Buffer.alloc(0),
      typeflag: "1",
    };
    const manifestBytes = Buffer.from(
      JSON.stringify({ name: "x", sha256: "a" }),
      "utf8",
    );
    const buf = buildTar([{ name: "manifest.json", bytes: manifestBytes }, hard]);
    await writeFile(archivePath, buf);

    await expect(installSkill({ archivePath, destDir })).rejects.toMatchObject({
      code: "SYMLINK_REJECTED",
    });
  });

  it("INTEGRITY_MISMATCH when file content is mutated post-package", async () => {
    const { buf } = buildValidDskill({ mutateBytes: true });
    await writeFile(archivePath, buf);

    await expect(
      installSkill({ archivePath, destDir, trustLevel: "project" }),
    ).rejects.toMatchObject({ code: "INTEGRITY_MISMATCH" });
  });

  it("NAME_COLLISION when dest dir exists without --force", async () => {
    const { buf } = buildValidDskill();
    await writeFile(archivePath, buf);
    await installSkill({ archivePath, destDir, trustLevel: "project" });

    await expect(
      installSkill({ archivePath, destDir, trustLevel: "project" }),
    ).rejects.toMatchObject({ code: "NAME_COLLISION" });
  });

  it("--force overwrites an existing skill", async () => {
    const { buf } = buildValidDskill();
    await writeFile(archivePath, buf);
    const first = await installSkill({ archivePath, destDir, trustLevel: "project" });
    // Write a marker file that should disappear after force-reinstall.
    await writeFile(join(first.skillDir, "stale.txt"), "old");

    const second = await installSkill({
      archivePath,
      destDir,
      trustLevel: "project",
      force: true,
    });
    expect(second.verified).toBe(true);
    const entries = await readdir(second.skillDir);
    expect(entries).not.toContain("stale.txt");
  });

  it("POLICY_VIOLATION when untrusted skill requests exec tool", async () => {
    const { buf } = buildValidDskill({ tools: ["execute_bash"] });
    await writeFile(archivePath, buf);

    await expect(
      installSkill({
        archivePath,
        destDir,
        trustLevel: "untrusted",
      }),
    ).rejects.toMatchObject({ code: "POLICY_VIOLATION" });
  });

  it("aborts mid-install when signal is already aborted", async () => {
    const { buf } = buildValidDskill();
    await writeFile(archivePath, buf);
    const controller = new AbortController();
    controller.abort();

    await expect(
      installSkill({
        archivePath,
        destDir,
        trustLevel: "project",
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ code: "ABORTED" });
  });

  it("verify:false skips integrity check and installs tampered archive", async () => {
    const { buf } = buildValidDskill({ mutateBytes: true });
    await writeFile(archivePath, buf);

    const result = await installSkill({
      archivePath,
      destDir,
      trustLevel: "project",
      verify: false,
    });
    expect(result.verified).toBe(false);
    expect(await stat(result.skillDir)).toBeDefined();
  });
});

describe("installSkill — corruption & edge cases", () => {
  let workDir: string;
  let destDir: string;
  let archivePath: string;

  beforeEach(async () => {
    workDir = await mkdtemp(join(tmpdir(), "install-edge-"));
    destDir = join(workDir, "skills");
    archivePath = join(workDir, "e.dskill");
  });

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  it("ARCHIVE_CORRUPT when manifest.json is missing", async () => {
    const buf = buildTar([
      { name: "SKILL.md", bytes: Buffer.from("---\nname: x\n---\n", "utf8") },
    ]);
    await writeFile(archivePath, buf);
    await expect(installSkill({ archivePath, destDir })).rejects.toMatchObject({
      code: "ARCHIVE_CORRUPT",
    });
  });

  it("ARCHIVE_CORRUPT when manifest.json is invalid JSON", async () => {
    const buf = buildTar([
      { name: "manifest.json", bytes: Buffer.from("{not json", "utf8") },
    ]);
    await writeFile(archivePath, buf);
    await expect(installSkill({ archivePath, destDir })).rejects.toMatchObject({
      code: "ARCHIVE_CORRUPT",
    });
  });

  it("ARCHIVE_CORRUPT when manifest has no name field", async () => {
    const buf = buildTar([
      { name: "manifest.json", bytes: Buffer.from('{"sha256":"x"}', "utf8") },
    ]);
    await writeFile(archivePath, buf);
    await expect(installSkill({ archivePath, destDir })).rejects.toMatchObject({
      code: "ARCHIVE_CORRUPT",
    });
  });

  it("INTEGRITY_MISMATCH when manifest.sha256 is absent but verify=true", async () => {
    const buf = buildTar([
      {
        name: "manifest.json",
        bytes: Buffer.from('{"name":"demo"}', "utf8"),
      },
      { name: "SKILL.md", bytes: Buffer.from("---\nname: demo\n---\n", "utf8") },
    ]);
    await writeFile(archivePath, buf);
    await expect(installSkill({ archivePath, destDir })).rejects.toMatchObject({
      code: "INTEGRITY_MISMATCH",
    });
  });

  it("rejects entries with absolute paths", async () => {
    const manifestBytes = Buffer.from('{"name":"x","sha256":"a"}', "utf8");
    const bad: TestEntry = {
      name: "/etc/passwd",
      bytes: Buffer.from("root:x:0:0", "utf8"),
    };
    const buf = buildTar([{ name: "manifest.json", bytes: manifestBytes }, bad]);
    await writeFile(archivePath, buf);
    await expect(installSkill({ archivePath, destDir })).rejects.toMatchObject({
      code: "TAR_SLIP_REJECTED",
    });
  });

  it("accepts archives containing directory entries", async () => {
    const { buf, manifest } = buildValidDskill();
    // rebuild with an extra dir entry at the start
    const withDir = Buffer.concat([
      buildTar([{ name: "subdir/", bytes: Buffer.alloc(0), typeflag: "5" }]).subarray(0, 512),
      buf,
    ]);
    await writeFile(archivePath, withDir);
    const result = await installSkill({
      archivePath,
      destDir,
      trustLevel: "project",
    });
    expect(result.manifest.name).toBe(manifest.name);
  });

  it("rejects unsupported tar typeflags as ARCHIVE_CORRUPT", async () => {
    const manifestBytes = Buffer.from('{"name":"x","sha256":"a"}', "utf8");
    const weird: TestEntry = {
      name: "weird.chr",
      bytes: Buffer.alloc(0),
      // character device typeflag '3' — not supported
      typeflag: "1" as "1",
    };
    // Use a fresh typeflag '3' by hand-writing
    const header = buildUstarHeader("weird.chr", 0, 0, "3");
    const eof = Buffer.alloc(1024, 0);
    const manHeader = buildUstarHeader("manifest.json", manifestBytes.length, 0, "0");
    const pad = 512 - (manifestBytes.length % 512);
    const buf = Buffer.concat([
      manHeader,
      manifestBytes,
      Buffer.alloc(pad === 512 ? 0 : pad, 0),
      header,
      eof,
    ]);
    void weird;
    await writeFile(archivePath, buf);
    await expect(installSkill({ archivePath, destDir })).rejects.toMatchObject({
      code: "ARCHIVE_CORRUPT",
    });
  });
});

describe("evaluateInstallPolicy", () => {
  const baseManifest: DskillManifest = {
    name: "x",
    version: "0.1.0",
    description: "y",
    trustLevel: "project",
    sha256: "a",
    createdAt: "2026-04-17T00:00:00.000Z",
    files: [],
  };

  it("project trust level is unrestricted", () => {
    const violations = evaluateInstallPolicy({
      manifest: {
        ...baseManifest,
        ...{ tools: ["execute_bash", "anything"] },
      } as DskillManifest,
      trustLevel: "project",
      availableTools: [],
    });
    expect(violations).toHaveLength(0);
  });

  it("untrusted denies exec-class tools", () => {
    const violations = evaluateInstallPolicy({
      manifest: { ...baseManifest, ...{ tools: ["write_file"] } } as DskillManifest,
      trustLevel: "untrusted",
      availableTools: ["write_file"],
    });
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]).toContain("write_file");
  });

  it("community rejects tools missing from available registry", () => {
    const violations = evaluateInstallPolicy({
      manifest: { ...baseManifest, ...{ tools: ["nonexistent_tool"] } } as DskillManifest,
      trustLevel: "community",
      availableTools: ["read_file"],
    });
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("nonexistent_tool");
  });

  it("community allows tools that exist", () => {
    const violations = evaluateInstallPolicy({
      manifest: { ...baseManifest, ...{ tools: ["read_file"] } } as DskillManifest,
      trustLevel: "community",
      availableTools: ["read_file", "write_file"],
    });
    expect(violations).toHaveLength(0);
  });
});

describe("installSkill — fs injection paths", () => {
  let workDir: string;
  let destDir: string;
  let archivePath: string;

  beforeEach(async () => {
    workDir = await mkdtemp(join(tmpdir(), "install-fs-"));
    destDir = join(workDir, "skills");
    archivePath = join(workDir, "f.dskill");
  });

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  it("wraps AbortError from staging into code=ABORTED", async () => {
    const { buf } = buildValidDskill();
    await writeFile(archivePath, buf);

    const realFs = await import("node:fs/promises");
    let callCount = 0;
    const fsStub = new Proxy(realFs, {
      get(target, prop, recv) {
        if (prop === "writeFile") {
          return async (...args: unknown[]) => {
            callCount += 1;
            if (callCount === 1) {
              const err = new Error("aborted");
              (err as { name: string }).name = "AbortError";
              throw err;
            }
            return (target.writeFile as (...a: unknown[]) => Promise<void>)(...args);
          };
        }
        return Reflect.get(target, prop, recv);
      },
    }) as typeof realFs;

    await expect(
      installSkill({
        archivePath,
        destDir,
        trustLevel: "project",
        fs: fsStub,
      }),
    ).rejects.toMatchObject({ code: "ABORTED" });
  });

  it("falls back to recursive copy on EXDEV rename failure", async () => {
    const { buf } = buildValidDskill({ name: "xdev-skill" });
    await writeFile(archivePath, buf);

    const realFs = await import("node:fs/promises");
    const fsStub = new Proxy(realFs, {
      get(target, prop, recv) {
        if (prop === "rename") {
          return async () => {
            const err = new Error("cross-device");
            (err as { code: string }).code = "EXDEV";
            throw err;
          };
        }
        return Reflect.get(target, prop, recv);
      },
    }) as typeof realFs;

    const result = await installSkill({
      archivePath,
      destDir,
      trustLevel: "project",
      fs: fsStub,
    });
    expect(result.verified).toBe(true);
    const body = await readFile(join(result.skillDir, "SKILL.md"), "utf8");
    expect(body).toContain("# Demo");
  });
});

describe("InstallError", () => {
  it("carries code and message", () => {
    const err = new InstallError("ARCHIVE_NOT_FOUND", "missing");
    expect(err.code).toBe("ARCHIVE_NOT_FOUND");
    expect(err.message).toBe("missing");
    expect(err.name).toBe("InstallError");
    expect(err).toBeInstanceOf(Error);
  });
});

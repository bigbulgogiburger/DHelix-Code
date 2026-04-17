/**
 * .dskill packager — bundles a dhelix skill directory into a portable archive
 *
 * 책임:
 * - 스킬 디렉토리(`<cwd>/.dhelix/skills/<name>/`)를 스캔하여 정규화된 파일 목록 수집
 * - SKILL.md 프론트매터 파싱 + validateManifest 로 검증
 * - manifest.json 을 최상위에 포함 (installer 가 우선 읽을 수 있도록)
 * - 결정론적(sorted) sha256 해시를 계산하여 integrity 검증 제공
 * - POSIX ustar 형식의 tar 아카이브 생성 (gzip 압축 없음 — v1 plain tar)
 *
 * 제외:
 * - workspace/ (eval 결과물, 휘발성)
 * - .git/, node_modules/
 * - .DS_Store, Thumbs.db 등 hidden OS 아티팩트
 *
 * 이 모듈은 `src/cli/` 를 import 하지 않음 (layer violation 금지).
 */

import { createHash } from "node:crypto";
import * as defaultFsPromises from "node:fs/promises";
import { basename, join, posix, relative, sep } from "node:path";
import { validateManifest, type SkillManifest } from "../../manifest.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * .dskill 아카이브 내 manifest.json 형태 — SKILL.md 프론트매터의 denormalized view
 *
 * installer 는 이 파일을 먼저 읽어 integrity (sha256) 와 메타데이터를 확인한다.
 */
export interface DskillManifest {
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly trustLevel: "built-in" | "project" | "community" | "untrusted";
  /** 전체 sha256 hex (64자). 파일 목록 + 내용 기반 결정론적 해시. */
  readonly sha256: string;
  readonly createdAt: string;
  /** 아카이브 내 상대 경로 목록 (정렬됨) */
  readonly files: readonly string[];
}

/** packageSkill 호출 옵션 */
export interface PackageOptions {
  readonly skillDir: string;
  readonly outputDir: string;
  readonly version?: string;
  readonly trustLevel?: DskillManifest["trustLevel"];
  readonly fs?: typeof defaultFsPromises;
  readonly signal?: AbortSignal;
}

/** packageSkill 반환값 */
export interface PackageResult {
  readonly outputPath: string;
  readonly sha256: string;
  readonly manifest: DskillManifest;
  readonly fileCount: number;
  readonly bytes: number;
}

/** 패키징 에러 코드 */
export type PackageErrorCode =
  | "SKILL_NOT_FOUND"
  | "INVALID_MANIFEST"
  | "IO_ERROR"
  | "ABORTED";

/** 패키징 전용 에러 클래스 — 코드별 분기 가능 */
export class PackageError extends Error {
  readonly code: PackageErrorCode;
  constructor(code: PackageErrorCode, message: string) {
    super(message);
    this.name = "PackageError";
    this.code = code;
  }
}

/** readSkillFromDir 반환값 */
export interface SkillDirContents {
  readonly skillMd: string;
  readonly manifest: SkillManifest;
  readonly files: readonly string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_VERSION = "0.1.0";
const DEFAULT_TRUST_LEVEL: DskillManifest["trustLevel"] = "project";

/** 아카이브에서 제외할 디렉토리 이름 (최상위 기준) */
const EXCLUDED_TOP_DIRS: ReadonlySet<string> = new Set([
  "workspace",
  "node_modules",
  ".git",
]);

/** 아카이브에서 제외할 파일 이름 (basename 기준) */
const EXCLUDED_FILENAMES: ReadonlySet<string> = new Set([
  ".DS_Store",
  "Thumbs.db",
]);

/** 아카이브에 포함 허용되는 최상위 경로 prefix (SKILL.md 외) */
const ALLOWED_TOP_DIRS: ReadonlySet<string> = new Set([
  "evals",
  "references",
  "assets",
]);

// ---------------------------------------------------------------------------
// Utility — abort handling
// ---------------------------------------------------------------------------

/** AbortSignal 을 확인하여 aborted 이면 PackageError("ABORTED") 를 던짐 */
function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new PackageError("ABORTED", "Packaging aborted by caller");
  }
}

// ---------------------------------------------------------------------------
// Utility — frontmatter parsing (minimal YAML subset, mirrors loader.ts)
// ---------------------------------------------------------------------------

/**
 * SKILL.md 의 `---`...`---` 프론트매터 블록을 파싱하여 키-값 객체를 반환
 *
 * 지원: `key: value`, `key: [a, b]`, boolean/number/null. kebab-case → camelCase.
 * 프론트매터가 없거나 malformed 면 null 을 반환 (호출자가 INVALID_MANIFEST 로 분기).
 */
function parseFrontmatterBlock(content: string): Record<string, unknown> | null {
  const lines = content.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") return null;
  const endIdx = lines.indexOf("---", 1);
  if (endIdx === -1) return null;

  const result: Record<string, unknown> = {};
  for (const line of lines.slice(1, endIdx)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) continue;
    const key = trimmed.slice(0, colonIdx).trim();
    const rawValue = trimmed.slice(colonIdx + 1).trim();
    const camelKey = key.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    result[camelKey] = parseScalar(rawValue);
  }
  return result;
}

/** 스칼라 값 파서 — 문자열/숫자/불리언/배열 */
function parseScalar(raw: string): unknown {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw === "null" || raw === "~") return null;
  if (raw === "") return "";
  if (raw.startsWith("[") && raw.endsWith("]")) {
    const inner = raw.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(",").map((item) => {
      const t = item.trim();
      if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
        return t.slice(1, -1);
      }
      return parseScalar(t);
    });
  }
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1);
  }
  return raw;
}

// ---------------------------------------------------------------------------
// Directory walk
// ---------------------------------------------------------------------------

/**
 * 스킬 디렉토리를 재귀적으로 순회하여 아카이브에 포함될 상대 경로 목록을 반환
 *
 * 규칙:
 * - 최상위는 SKILL.md, README.md, 그리고 ALLOWED_TOP_DIRS 안의 파일만 포함
 * - EXCLUDED_TOP_DIRS 및 EXCLUDED_FILENAMES 는 제외
 * - 경로는 POSIX 스타일(`/`)로 정규화
 * - 결과는 정렬되어 결정론적 해시를 보장
 */
async function walkSkillDir(
  root: string,
  fs: typeof defaultFsPromises,
  signal: AbortSignal | undefined,
): Promise<readonly string[]> {
  const collected: string[] = [];

  async function walk(absDir: string, relDir: string): Promise<void> {
    throwIfAborted(signal);
    const entries = await fs.readdir(absDir, { withFileTypes: true });
    for (const entry of entries) {
      const absPath = join(absDir, entry.name);
      const relPath = relDir === "" ? entry.name : posix.join(relDir, entry.name);

      if (entry.isDirectory()) {
        // 최상위 디렉토리만 필터링 — 하위 구조는 그대로 포함
        if (relDir === "") {
          if (EXCLUDED_TOP_DIRS.has(entry.name)) continue;
          if (!ALLOWED_TOP_DIRS.has(entry.name)) continue;
        }
        await walk(absPath, relPath);
        continue;
      }

      if (!entry.isFile()) continue;
      if (EXCLUDED_FILENAMES.has(entry.name)) continue;

      // 최상위 파일은 SKILL.md / README.md / manifest.json 만 허용 (manifest.json 은 덮어쓰기됨)
      if (relDir === "") {
        const allowedTopFiles = new Set(["SKILL.md", "README.md"]);
        if (!allowedTopFiles.has(entry.name)) continue;
      }

      collected.push(relPath);
    }
  }

  await walk(root, "");
  return [...collected].sort();
}

// ---------------------------------------------------------------------------
// Hashing
// ---------------------------------------------------------------------------

/**
 * 파일 목록과 각 파일의 바이트를 결정론적으로 해시
 *
 * 입력 스트림: `<rel-path>\0<bytes>\0` 의 정렬된 연결
 * 출력: SHA-256 hex (64자)
 */
function computeSha256(entries: readonly { readonly relPath: string; readonly bytes: Buffer }[]): string {
  const hash = createHash("sha256");
  const sorted = [...entries].sort((a, b) => a.relPath.localeCompare(b.relPath));
  for (const e of sorted) {
    hash.update(e.relPath);
    hash.update(new Uint8Array([0]));
    hash.update(e.bytes);
    hash.update(new Uint8Array([0]));
  }
  return hash.digest("hex");
}

// ---------------------------------------------------------------------------
// POSIX ustar tar writer (no gzip)
// ---------------------------------------------------------------------------

/**
 * 단일 tar 엔트리의 512-byte 헤더를 생성
 *
 * POSIX ustar 형식: 이름(100) + 모드(8) + uid(8) + gid(8) + size(12) + mtime(12)
 * + checksum(8) + typeflag(1) + linkname(100) + magic(6) + version(2)
 * + uname(32) + gname(32) + devmajor(8) + devminor(8) + prefix(155) + pad(12)
 */
function buildUstarHeader(name: string, size: number, mtimeSec: number): Buffer {
  const header = Buffer.alloc(512);

  // name (100 bytes) — ustar 는 100자 제한, 그 이상은 prefix 사용
  let nameField = name;
  let prefixField = "";
  if (Buffer.byteLength(nameField, "utf8") > 100) {
    // 최종 `/` 기준으로 분할 — prefix 155, name 100
    const slashIdx = name.lastIndexOf("/", 155);
    if (slashIdx > 0 && Buffer.byteLength(name.slice(slashIdx + 1), "utf8") <= 100) {
      prefixField = name.slice(0, slashIdx);
      nameField = name.slice(slashIdx + 1);
    }
  }
  header.write(nameField, 0, 100, "utf8");

  // mode, uid, gid — octal null-terminated, 항상 0644 / 0 / 0
  header.write("0000644\0", 100, 8, "ascii");
  header.write("0000000\0", 108, 8, "ascii");
  header.write("0000000\0", 116, 8, "ascii");

  // size — 11 octal digits + NUL
  header.write(size.toString(8).padStart(11, "0") + "\0", 124, 12, "ascii");

  // mtime — 11 octal digits + NUL
  header.write(mtimeSec.toString(8).padStart(11, "0") + "\0", 136, 12, "ascii");

  // checksum placeholder — 8 spaces
  header.write("        ", 148, 8, "ascii");

  // typeflag — "0" for regular file
  header.write("0", 156, 1, "ascii");

  // linkname (100) — empty
  // magic "ustar\0", version "00"
  header.write("ustar\0", 257, 6, "ascii");
  header.write("00", 263, 2, "ascii");

  // uname / gname — empty strings (NUL-padded)
  header.write("", 265, 32, "ascii");
  header.write("", 297, 32, "ascii");

  // devmajor / devminor — 0
  header.write("0000000\0", 329, 8, "ascii");
  header.write("0000000\0", 337, 8, "ascii");

  // prefix (155)
  if (prefixField) {
    header.write(prefixField, 345, 155, "utf8");
  }

  // compute checksum — unsigned sum of all bytes (with spaces in checksum field)
  let sum = 0;
  for (let i = 0; i < 512; i += 1) sum += header[i] ?? 0;
  header.write(sum.toString(8).padStart(6, "0") + "\0 ", 148, 8, "ascii");

  return header;
}

/**
 * 여러 엔트리를 단일 tar Buffer 로 직렬화
 *
 * 각 엔트리: 헤더(512) + 내용(512 배수로 zero-pad) + 마지막 1024-byte zero 블록
 */
function buildTarArchive(
  entries: readonly { readonly relPath: string; readonly bytes: Buffer }[],
  mtimeSec: number,
): Buffer {
  const chunks: Buffer[] = [];
  for (const entry of entries) {
    chunks.push(buildUstarHeader(entry.relPath, entry.bytes.length, mtimeSec));
    chunks.push(entry.bytes);
    const remainder = entry.bytes.length % 512;
    if (remainder !== 0) {
      chunks.push(Buffer.alloc(512 - remainder, 0));
    }
  }
  // Two 512-byte zero blocks mark EOF
  chunks.push(Buffer.alloc(1024, 0));
  return Buffer.concat(chunks);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * 스킬 디렉토리에서 SKILL.md 를 읽고 프론트매터를 검증한 뒤, 아카이브 대상 파일 목록을 반환
 *
 * 이는 packageSkill 의 내부 헬퍼이면서 F2(installer) 가 "install from dir" 경로에
 * 재사용할 수 있도록 공개된 API 다.
 *
 * @throws PackageError("SKILL_NOT_FOUND") — skillDir 가 없거나 SKILL.md 부재
 * @throws PackageError("INVALID_MANIFEST") — 프론트매터 파싱/검증 실패
 * @throws PackageError("IO_ERROR") — 그 외 파일 시스템 오류
 */
export async function readSkillFromDir(
  skillDir: string,
  fs: typeof defaultFsPromises = defaultFsPromises,
): Promise<SkillDirContents> {
  // 1. skillDir 존재 확인
  try {
    const stat = await fs.stat(skillDir);
    if (!stat.isDirectory()) {
      throw new PackageError("SKILL_NOT_FOUND", `Not a directory: ${skillDir}`);
    }
  } catch (err) {
    if (err instanceof PackageError) throw err;
    throw new PackageError(
      "SKILL_NOT_FOUND",
      `Skill directory not found: ${skillDir}`,
    );
  }

  // 2. SKILL.md 로드
  const skillMdPath = join(skillDir, "SKILL.md");
  let skillMd: string;
  try {
    skillMd = await fs.readFile(skillMdPath, "utf8");
  } catch {
    throw new PackageError(
      "SKILL_NOT_FOUND",
      `SKILL.md missing at ${skillMdPath}`,
    );
  }

  // 3. frontmatter 파싱 + 검증
  const raw = parseFrontmatterBlock(skillMd);
  if (!raw) {
    throw new PackageError(
      "INVALID_MANIFEST",
      `SKILL.md at ${skillMdPath} has missing or malformed YAML frontmatter`,
    );
  }
  const validation = validateManifest(raw);
  if (!validation.valid) {
    throw new PackageError(
      "INVALID_MANIFEST",
      `SKILL.md frontmatter failed validation: ${validation.errors.join("; ")}`,
    );
  }

  // 4. 파일 목록 수집
  let files: readonly string[];
  try {
    files = await walkSkillDir(skillDir, fs, undefined);
  } catch (err) {
    if (err instanceof PackageError) throw err;
    throw new PackageError(
      "IO_ERROR",
      `Failed to walk skill directory: ${(err as Error).message}`,
    );
  }

  return { skillMd, manifest: validation.manifest, files };
}

/**
 * 스킬 디렉토리를 .dskill (POSIX ustar tar) 아카이브로 패키징한다.
 *
 * 아카이브 내 파일 순서:
 *   1. manifest.json  — 최상위, installer 가 먼저 읽음
 *   2. SKILL.md
 *   3. README.md  — 없으면 자동 생성
 *   4. evals/**, references/**, assets/**  — 정렬된 순서
 *
 * @throws PackageError — SKILL_NOT_FOUND | INVALID_MANIFEST | IO_ERROR | ABORTED
 */
export async function packageSkill(opts: PackageOptions): Promise<PackageResult> {
  const fs = opts.fs ?? defaultFsPromises;
  const { signal } = opts;
  throwIfAborted(signal);

  // 1. 소스 스킬 읽기 + 검증
  const { manifest, files } = await readSkillFromDir(opts.skillDir, fs);
  throwIfAborted(signal);

  const version = opts.version ?? DEFAULT_VERSION;
  const trustLevel = opts.trustLevel ?? DEFAULT_TRUST_LEVEL;
  const name = manifest.name;
  const description = manifest.description;

  // 2. 원본 파일들의 바이트를 읽어 엔트리 목록 구성
  const rawEntries: { readonly relPath: string; readonly bytes: Buffer }[] = [];
  for (const relPath of files) {
    throwIfAborted(signal);
    // relPath 는 POSIX, 실제 디스크에서는 플랫폼 separator 사용
    const absPath = join(opts.skillDir, ...relPath.split("/"));
    try {
      const bytes = await fs.readFile(absPath);
      rawEntries.push({ relPath, bytes });
    } catch (err) {
      throw new PackageError(
        "IO_ERROR",
        `Failed to read ${absPath}: ${(err as Error).message}`,
      );
    }
  }

  // 3. README.md 가 없으면 자동 생성하여 엔트리에 추가
  const hasReadme = rawEntries.some((e) => e.relPath === "README.md");
  if (!hasReadme) {
    const generated = `# ${name}\n\n${description}\n\nGenerated by dhelix skill-package.\n`;
    rawEntries.push({ relPath: "README.md", bytes: Buffer.from(generated, "utf8") });
  }

  // 4. 아카이브 내 상대 경로 목록 (sha256 기반, manifest.json 은 아직 제외)
  const archiveFilePaths = [...rawEntries.map((e) => e.relPath)].sort();

  // 5. sha256 계산 — 정렬된 (relPath, bytes) 연결 기반
  const sha256 = computeSha256(rawEntries);

  // 6. manifest.json 생성 (denormalized) — files 에 자기 자신 포함
  const createdAt = new Date().toISOString();
  const archiveManifest: DskillManifest = {
    name,
    version,
    description,
    trustLevel,
    sha256,
    createdAt,
    files: ["manifest.json", ...archiveFilePaths],
  };

  const manifestBytes = Buffer.from(JSON.stringify(archiveManifest, null, 2), "utf8");

  // 7. 최종 아카이브 엔트리 — manifest.json 이 FIRST
  const finalEntries = [
    { relPath: "manifest.json", bytes: manifestBytes },
    // SKILL.md 를 두번째로 명시적으로 배치
    ...rawEntries.filter((e) => e.relPath === "SKILL.md"),
    // 나머지는 정렬된 순서
    ...rawEntries
      .filter((e) => e.relPath !== "SKILL.md")
      .sort((a, b) => a.relPath.localeCompare(b.relPath)),
  ];

  // 8. tar Buffer 생성
  const mtimeSec = Math.floor(Date.now() / 1000);
  const tarBuffer = buildTarArchive(finalEntries, mtimeSec);

  // 9. 출력 디렉토리 준비 + 쓰기
  const outputName = `${name}-${version}.dskill`;
  const outputPath = join(opts.outputDir, outputName);
  try {
    await fs.mkdir(opts.outputDir, { recursive: true });
    await fs.writeFile(outputPath, tarBuffer);
  } catch (err) {
    throw new PackageError(
      "IO_ERROR",
      `Failed to write archive to ${outputPath}: ${(err as Error).message}`,
    );
  }

  return {
    outputPath,
    sha256,
    manifest: archiveManifest,
    fileCount: finalEntries.length,
    bytes: tarBuffer.length,
  };
}

// ---------------------------------------------------------------------------
// Internal exports for tests (not part of public API, but stable within module)
// ---------------------------------------------------------------------------

/** @internal — for path normalization assertions in tests */
export function __relativePosix(from: string, to: string): string {
  return relative(from, to).split(sep).join("/");
}

/** @internal — exposes basename for symmetry in tests */
export function __basename(p: string): string {
  return basename(p);
}

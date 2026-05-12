/**
 * Phase 6 Track A — S2: 사용자 영역 보호 (I-9) E2E.
 *
 * recombination + cure 사이클이 *사용자가 직접 작성한 파일* 을 절대 건드리지
 * 않음을 sha256 단위로 검증한다. cure-flow.test.ts의 marker reverse reorg
 * 테스트가 단위 차원이라면, 이 테스트는 실제 슬래시 명령 + LOCAL LLM round-trip
 * 통과 후에도 invariant 가 유지됨을 보는 E2E 검증이다.
 *
 * Invariants (PRD §6.4 + Recent recombination-pipeline.md I-9):
 *   - workdir 의 임의 user 파일은 recombination 이후에도 byte-for-byte 동일
 *   - workdir 의 임의 user 파일은 cure 이후에도 byte-for-byte 동일
 *   - plasmid 본체 (metadata.yaml + body.md) 도 두 단계 모두에서 동일 (I-1)
 */
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createDriverSession,
  type DriverSession,
} from "../../scripts/dogfood-driver.js";

const HAS_LOCAL = !!process.env.LOCAL_API_KEY && !!process.env.LOCAL_API_BASE_URL;
const PLASMID_ID = "s2-userland-protect";

const FIXTURE_BODY = `# Code style — concise comments

When writing code, prefer concise inline comments over verbose paragraphs.
Examples:
- \`// FIFO queue\` (good)
- \`// This is a first-in-first-out queue used to process items in order\` (too verbose)
`;

function metadataYaml(id: string): string {
  return [
    `id: ${id}`,
    `name: Concise comments (S2 fixture)`,
    `description: Phase 6 S2 fixture - userland (I-9) protection invariant.`,
    `version: 0.1.0`,
    `tier: L2`,
    `created: 2026-05-04T00:00:00Z`,
    `updated: 2026-05-04T00:00:00Z`,
  ].join("\n");
}

async function sha256(p: string): Promise<string> {
  const buf = await readFile(p);
  return createHash("sha256").update(buf).digest("hex");
}

describe.skipIf(!HAS_LOCAL)("Phase 6 S2 — Userland (I-9) protection (LOCAL)", () => {
  let workdir: string;
  let session: DriverSession;
  let userFile1: string;
  let userFile2: string;
  let plasmidMeta: string;
  let plasmidBody: string;

  // 단계별 hash — beforeAll 시점의 baseline
  let baseUserFile1: string;
  let baseUserFile2: string;
  let basePlasmidMeta: string;
  let basePlasmidBody: string;

  beforeAll(async () => {
    workdir = await mkdtemp(join(tmpdir(), "dhelix-s2-userland-"));

    // plasmid fixture
    const plasmidDir = join(workdir, ".dhelix", "plasmids", PLASMID_ID);
    await mkdir(plasmidDir, { recursive: true });
    plasmidMeta = join(plasmidDir, "metadata.yaml");
    plasmidBody = join(plasmidDir, "body.md");
    await writeFile(plasmidMeta, metadataYaml(PLASMID_ID), "utf8");
    await writeFile(plasmidBody, FIXTURE_BODY, "utf8");

    // 사용자 자유 파일 — recombination/cure가 절대 건드리지 말아야 할 영역
    userFile1 = join(workdir, "USER-NOTES.md");
    userFile2 = join(workdir, ".dhelix", "USER-DATA.md");
    await writeFile(
      userFile1,
      "# User notes\n\nMy free-form thoughts. Keep my words.\n",
      "utf8",
    );
    await writeFile(
      userFile2,
      "# User data inside .dhelix/\n\nDigital handwriting that must not be erased.\n",
      "utf8",
    );

    baseUserFile1 = await sha256(userFile1);
    baseUserFile2 = await sha256(userFile2);
    basePlasmidMeta = await sha256(plasmidMeta);
    basePlasmidBody = await sha256(plasmidBody);

    session = await createDriverSession({ workingDirectory: workdir });
  }, 60_000);

  afterAll(async () => {
    await session?.destroy().catch(() => {});
    if (workdir) {
      await rm(workdir, { recursive: true, force: true }).catch(() => {});
    }
  });

  it("activates the plasmid", async () => {
    const r = await session.send(`/plasmid activate ${PLASMID_ID}`);
    expect(r.success).toBe(true);
  });

  it("after /recombination — user files + plasmid body unchanged", async () => {
    const r = await session.send("/recombination");
    expect(r.success).toBe(true);

    expect(await sha256(userFile1)).toBe(baseUserFile1);
    expect(await sha256(userFile2)).toBe(baseUserFile2);
    expect(await sha256(plasmidMeta)).toBe(basePlasmidMeta);
    expect(await sha256(plasmidBody)).toBe(basePlasmidBody);
  }, 480_000);

  it("after /cure — user files + plasmid body STILL unchanged (I-9 + I-1)", async () => {
    const r = await session.send("/cure");
    expect(r.success).toBe(true);

    expect(await sha256(userFile1)).toBe(baseUserFile1);
    expect(await sha256(userFile2)).toBe(baseUserFile2);
    expect(await sha256(plasmidMeta)).toBe(basePlasmidMeta);
    expect(await sha256(plasmidBody)).toBe(basePlasmidBody);
  }, 180_000);
});

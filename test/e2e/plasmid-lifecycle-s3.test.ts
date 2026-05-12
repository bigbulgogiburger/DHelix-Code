/**
 * Phase 6 Track A — S3: Foundational + `/plasmid challenge` E2E.
 *
 * Foundational plasmid 의 governance ceremony 가 슬래시 dispatch 를 통해 정상
 * 동작하는지 검증한다. amend 는 $EDITOR 의존이라 헤드리스 친화가 아니므로
 * override (one-shot, cooldown 미적용) 와 archive 거부에 집중한다.
 *
 * Invariants (PRD §22.4 + plasmid-governance.md):
 *   - foundational plasmid 는 `/plasmid archive` 로 archive 불가 (refused)
 *   - `/plasmid challenge <id> --action override --rationale ... --yes` 는
 *     overrides.pending.json 에 항목을 enqueue 한다
 *   - 같은 plasmid 에 대한 두 번째 override 도 cooldown 미적용으로 통과
 */
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createDriverSession,
  type DriverSession,
} from "../../scripts/dogfood-driver.js";
import { OVERRIDE_PENDING_PATH } from "../../src/plasmids/types.js";

const HAS_LOCAL = !!process.env.LOCAL_API_KEY && !!process.env.LOCAL_API_BASE_URL;
const PLASMID_ID = "s3-foundational-anti-deception";

const FIXTURE_BODY = `# Anti-deception (S3 fixture)

Never knowingly produce false claims. When uncertain, say so.
This rule is foundational and must not be silently softened.
`;

function foundationalYaml(id: string): string {
  return [
    `id: ${id}`,
    `name: Anti-deception (S3 fixture)`,
    `description: Phase 6 S3 foundational fixture - challenge ceremony invariants.`,
    `version: 0.1.0`,
    `tier: L4`,
    `foundational: true`,
    `created: 2026-05-04T00:00:00Z`,
    `updated: 2026-05-04T00:00:00Z`,
    `challengeable:`,
    `  require-justification: true`,
    `  min-justification-length: 50`,
    `  audit-log: true`,
    `  require-cooldown: 24h`,
    `  require-team-consensus: false`,
    `  min-approvers: 1`,
  ].join("\n");
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

describe.skipIf(!HAS_LOCAL)("Phase 6 S3 — Foundational + challenge (LOCAL)", () => {
  let workdir: string;
  let session: DriverSession;

  beforeAll(async () => {
    workdir = await mkdtemp(join(tmpdir(), "dhelix-s3-foundational-"));
    const plasmidDir = join(workdir, ".dhelix", "plasmids", PLASMID_ID);
    await mkdir(plasmidDir, { recursive: true });
    await writeFile(
      join(plasmidDir, "metadata.yaml"),
      foundationalYaml(PLASMID_ID),
      "utf8",
    );
    await writeFile(join(plasmidDir, "body.md"), FIXTURE_BODY, "utf8");
    session = await createDriverSession({ workingDirectory: workdir });
  }, 60_000);

  afterAll(async () => {
    await session?.destroy().catch(() => {});
    if (workdir) {
      await rm(workdir, { recursive: true, force: true }).catch(() => {});
    }
  });

  it("/plasmid list — foundational fixture recognized", async () => {
    const r = await session.send("/plasmid list");
    expect(r.success).toBe(true);
    expect(r.output).toContain(PLASMID_ID);
  });

  it("/plasmid archive — foundational refused", async () => {
    const r = await session.send(`/plasmid archive ${PLASMID_ID}`);
    expect(r.success).toBe(false);
    expect(r.output.toLowerCase()).toMatch(/foundational|refus/);
  });

  it("/plasmid challenge override — first call enqueues override", async () => {
    // dispatcher 가 quoting 미지원 (registry.ts split(/\s+/)) — 공백 없이 단일 토큰.
    const rationale =
      "Justification_long_enough_to_satisfy_min_justification_length_of_at_least_50_chars_for_testing_E2E";
    const r = await session.send(
      `/plasmid challenge ${PLASMID_ID} --action override --rationale ${rationale} --yes`,
    );
    expect(r.success).toBe(true);
    expect(r.output.toLowerCase()).toMatch(/override\s+queued|queued.*override/);

    const overridePath = join(workdir, OVERRIDE_PENDING_PATH);
    expect(await fileExists(overridePath)).toBe(true);
    const content = await readFile(overridePath, "utf8");
    expect(content).toContain(PLASMID_ID);
  });

  it("/plasmid challenge override — second call also passes (override is one-shot, cooldown N/A)", async () => {
    const rationale =
      "Second_rationale_long_enough_to_satisfy_min_justification_length_50_for_E2E_testing_purposes";
    const r = await session.send(
      `/plasmid challenge ${PLASMID_ID} --action override --rationale ${rationale} --yes`,
    );
    expect(r.success).toBe(true);
  });
});

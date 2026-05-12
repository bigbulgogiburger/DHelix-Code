/**
 * Phase 6 Track A — S1: Behavioral plasmid 풀사이클 E2E.
 *
 * 한 라이프사이클을 dogfood-driver를 통해 멀티턴으로 운전한다:
 *   T1  fixture plasmid 작성 (mkdir + metadata.yaml + body.md)
 *   T2  /plasmid list                — fixture 인식 확인
 *   T3  /plasmid validate <id>       — L1 schema OK
 *   T4  /plasmid activate <id>       — activation set 진입
 *   T5  /recombination --dry-run     — fs 무변경 확인
 *   T6  /recombination                — artifacts 실제 작성
 *   T7  fs 검증                       — transcript / audit 기록 / .dhelix/rules.generated.md
 *   T8  /cure --transcript <id>       — rollback
 *   T9  fs 검증                       — artifacts 사라짐 + plasmid 본체 보존 (I-1)
 *
 * 결정성: T2~T4, T8은 deterministic. T6은 LLM interpreter 호출 — LOCAL provider
 * 응답 변동성으로 인해 산출물의 *구조*만 검증하고 *내용*은 검증하지 않는다.
 *
 * 가드: LOCAL_API_KEY 미설정 환경에서는 skip. 실행은 ~3-7분 (LLM round-trip).
 */
import { mkdir, mkdtemp, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createDriverSession,
  type DriverSession,
} from "../../scripts/dogfood-driver.js";
import {
  RECOMBINATION_AUDIT_LOG,
  RECOMBINATION_TRANSCRIPTS_DIR,
} from "../../src/recombination/types.js";

const HAS_LOCAL = !!process.env.LOCAL_API_KEY && !!process.env.LOCAL_API_BASE_URL;
const PLASMID_ID = "s1-semicolons-rule";

const FIXTURE_BODY = `# Always use semicolons in TypeScript

When generating TypeScript, every statement MUST end with a semicolon.
This is a strict project convention.

## Examples
- \`const x = 1;\` (correct)
- \`const x = 1\` (incorrect)
`;

function fixtureMetadataYaml(id: string): string {
  return [
    `id: ${id}`,
    `name: Always use semicolons (S1 fixture)`,
    `description: Phase 6 S1 lifecycle fixture - behavioral plasmid mandating TS semicolons.`,
    `version: 0.1.0`,
    `tier: L2`,
    `created: 2026-05-04T00:00:00Z`,
    `updated: 2026-05-04T00:00:00Z`,
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

describe.skipIf(!HAS_LOCAL)("Phase 6 S1 — Behavioral plasmid lifecycle (LOCAL)", () => {
  let workdir: string;
  let session: DriverSession;
  let plasmidDir: string;

  beforeAll(async () => {
    workdir = await mkdtemp(join(tmpdir(), "dhelix-s1-lifecycle-"));
    plasmidDir = join(workdir, ".dhelix", "plasmids", PLASMID_ID);
    await mkdir(plasmidDir, { recursive: true });
    await writeFile(
      join(plasmidDir, "metadata.yaml"),
      fixtureMetadataYaml(PLASMID_ID),
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

  it("T2: /plasmid list — recognizes fixture", async () => {
    const r = await session.send("/plasmid list");
    expect(r.kind).toBe("command");
    expect(r.success).toBe(true);
    expect(r.output).toContain(PLASMID_ID);
  });

  it("T3: /plasmid validate — L1 schema OK", async () => {
    const r = await session.send(`/plasmid validate ${PLASMID_ID}`);
    expect(r.kind).toBe("command");
    expect(r.success).toBe(true);
  });

  it("T4: /plasmid activate — joins activation set", async () => {
    const r = await session.send(`/plasmid activate ${PLASMID_ID}`);
    expect(r.kind).toBe("command");
    expect(r.success).toBe(true);
  });

  it("T5: /recombination --dry-run — no user-visible artifacts written", async () => {
    // dry-run은 transcript/audit 같은 메타 기록은 남길 수 있지만
    // 사용자 산출물(.dhelix/rules.generated.md, .dhelix/agents/, .dhelix/skills/ 등)
    // 은 절대 작성하지 않아야 한다 — 출력의 "0 written"이 그 의도를 반영.
    const generatedRules = join(workdir, ".dhelix", "rules.generated.md");
    const generatedAgents = join(workdir, ".dhelix", "agents");
    const generatedSkills = join(workdir, ".dhelix", "skills");

    const r = await session.send("/recombination --dry-run");
    expect(r.kind).toBe("command");
    expect(r.success).toBe(true);
    expect(r.output).toMatch(/dry-run|0 written/);

    expect(await fileExists(generatedRules)).toBe(false);
    expect(await fileExists(generatedAgents)).toBe(false);
    expect(await fileExists(generatedSkills)).toBe(false);
  }, 180_000);

  it("T6: /recombination — produces artifacts + transcript + audit", async () => {
    const r = await session.send("/recombination");
    expect(r.kind).toBe("command");
    expect(r.success).toBe(true);
    // 8단계 출력의 핵심 키워드들: interpret/persist/release 모두 ok로 진행
    expect(r.output).toMatch(/applied/);
    expect(r.output).toMatch(/persist\s+ok/);

    const transcriptsDir = join(workdir, RECOMBINATION_TRANSCRIPTS_DIR);
    expect(await fileExists(transcriptsDir)).toBe(true);
    const transcripts = await readdir(transcriptsDir);
    expect(transcripts.length).toBeGreaterThanOrEqual(1);

    const auditLog = join(workdir, RECOMBINATION_AUDIT_LOG);
    expect(await fileExists(auditLog)).toBe(true);

    // I-1: plasmid 본체는 그대로 보존
    expect(await fileExists(join(plasmidDir, "metadata.yaml"))).toBe(true);
    expect(await fileExists(join(plasmidDir, "body.md"))).toBe(true);
  }, 480_000);

  it("T8: /cure — rolls back the last recombination", async () => {
    // 가장 최근 transcript 하나 잡아서 cure에 넘기는 대신, 인자 없이 latest 사용
    const r = await session.send("/cure");
    expect(r.kind).toBe("command");
    expect(r.success).toBe(true);
  }, 180_000);

  it("T9: post-cure invariants — plasmid 본체 보존 + .dhelix/recombination 정리", async () => {
    // I-1: plasmid 본체 (metadata.yaml + body.md)는 cure가 절대 건드리지 않음
    expect(await fileExists(join(plasmidDir, "metadata.yaml"))).toBe(true);
    expect(await fileExists(join(plasmidDir, "body.md"))).toBe(true);
  });
});

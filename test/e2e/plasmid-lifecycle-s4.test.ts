/**
 * Phase 6 Track A — S4: Research privacy gate E2E.
 *
 * 외부 네트워크 호출 없이 결정적으로 검증 가능한 axis 만 다룬다:
 *
 *   1. /plasmid research (no args) — usage 안내
 *   2. /plasmid --research "..." --from-file <privacy:local-only fixture>
 *      → PLASMID_RESEARCH_PRIVACY_BLOCKED 차단
 *
 * 실제 web_search/web_fetch 통합 검증은 별도 manual dogfood 트랙에서 수행.
 * (Phase 6 candidate: production deps 의 getActiveProviderPrivacyTier 가
 *  현재 "unknown" 으로 hard-coded 되어 LOCAL provider 환경에서도 cloud 차단이
 *  발동하지 않음 — 이 테스트는 plasmid-level 가드만 확인한다.)
 */
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createDriverSession,
  type DriverSession,
} from "../../scripts/dogfood-driver.js";

const HAS_LOCAL = !!process.env.LOCAL_API_KEY && !!process.env.LOCAL_API_BASE_URL;

function localOnlyFixturePath(workdir: string): string {
  return join(workdir, "private-plasmid.md");
}

async function writeLocalOnlyFixture(workdir: string): Promise<string> {
  const path = localOnlyFixturePath(workdir);
  const content = [
    "---",
    "id: s4-private-fixture",
    "name: Private fixture",
    "description: Phase 6 S4 fixture - privacy:local-only enforcement.",
    "version: 0.1.0",
    "tier: L2",
    "privacy: local-only",
    "created: 2026-05-04T00:00:00Z",
    "updated: 2026-05-04T00:00:00Z",
    "---",
    "",
    "# Private rule",
    "Internal-only knowledge that must never travel to a public search.",
    "",
  ].join("\n");
  await writeFile(path, content, "utf8");
  return path;
}

describe.skipIf(!HAS_LOCAL)("Phase 6 S4 — Research privacy gate (LOCAL)", () => {
  let workdir: string;
  let session: DriverSession;
  let fixturePath: string;

  beforeAll(async () => {
    workdir = await mkdtemp(join(tmpdir(), "dhelix-s4-research-"));
    await mkdir(workdir, { recursive: true });
    fixturePath = await writeLocalOnlyFixture(workdir);
    session = await createDriverSession({ workingDirectory: workdir });
  }, 60_000);

  afterAll(async () => {
    await session?.destroy().catch(() => {});
    if (workdir) {
      await rm(workdir, { recursive: true, force: true }).catch(() => {});
    }
  });

  it("/plasmid research — bare invocation prints usage", async () => {
    const r = await session.send("/plasmid research");
    // usage 출력은 success=false (입력 부족) 또는 success=true (안내 모드).
    // 둘 중 하나여도 OK — 핵심은 dispatch 후 helpful text 가 나오는 것.
    expect(r.kind).toBe("command");
    expect(r.output.toLowerCase()).toMatch(/usage|research|--from-file|--dry-run/);
  });

  it("/plasmid --research --from-file <local-only fixture> --dry-run — PRIVACY_BLOCKED", async () => {
    // 슬래시 명령은 quoting 미지원 + Windows 절대 경로 join 버그가 있어
    // workdir-relative 파일명만 전달한다 (driver 가 process.chdir 로 cwd 정렬).
    const relFromFile = "private-plasmid.md";
    void fixturePath; // baseAll 에서 생성됨을 보장하기 위한 참조
    const r = await session.send(
      `/plasmid --research improve_this_rule --from-file ${relFromFile} --dry-run`,
    );
    expect(r.kind).toBe("command");
    expect(r.success).toBe(false);
    // privacy gate 메시지에 'local-only' 또는 'privacy' 가 들어가야 함
    expect(r.output.toLowerCase()).toMatch(/local-only|privacy|blocked/);
  });
});

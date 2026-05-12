/**
 * Phase 6 — driver smoke test.
 *
 * dogfood-driver.ts가 LOCAL provider로 부트스트랩되고,
 * `/plasmid` (no-args usage), `/plasmid list` 두 명령을 정상 dispatch하는지 확인.
 *
 * LOCAL_API_KEY 미설정 환경에서는 skip.
 */
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createDriverSession,
  type DriverSession,
} from "../../scripts/dogfood-driver.js";

const HAS_LOCAL = !!process.env.LOCAL_API_KEY && !!process.env.LOCAL_API_BASE_URL;

describe.skipIf(!HAS_LOCAL)("driver smoke (LOCAL)", () => {
  let workdir: string;
  let session: DriverSession;

  beforeAll(async () => {
    workdir = await mkdtemp(join(tmpdir(), "dhelix-driver-smoke-"));
    session = await createDriverSession({ workingDirectory: workdir });
  }, 60_000);

  afterAll(async () => {
    await session?.destroy();
    if (workdir) {
      await rm(workdir, { recursive: true, force: true });
    }
  });

  it("dispatches /plasmid (no args) — usage", async () => {
    const r = await session.send("/plasmid");
    expect(r.kind).toBe("command");
    // /plasmid 단독 호출은 usage 출력 — 텍스트가 비어있지 않아야 함
    expect(r.output.length).toBeGreaterThan(0);
  });

  it("dispatches /plasmid list — empty workspace", async () => {
    const r = await session.send("/plasmid list");
    expect(r.kind).toBe("command");
    expect(r.success).toBe(true);
    // .dhelix/plasmids/ 없으면 빈 목록 메시지가 나와야 함
    expect(r.output.length).toBeGreaterThan(0);
  });
});

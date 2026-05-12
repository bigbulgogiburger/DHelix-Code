/**
 * Plasmid Health Data Source — fs 기반 기본 구현 (Phase 6 GAL-1)
 *
 * `.dhelix/plasmids/`, `.dhelix/recombination/transcripts/`,
 * `.dhelix/governance/` 를 read-only 로 스캔하여 dashboard 가 노출할
 * 헬스 스냅샷을 만든다. 부재한 디렉토리/파일은 graceful 하게 빈 값으로
 * 처리하여 Phase 5 미만 환경에서도 endpoint 가 안전하게 동작한다.
 *
 * 운영 의미:
 *   - dashboard 가 단일 polling 엔드포인트로 plasmid 시스템을 관측 가능
 *   - I-8 hermeticity 위반 없음: 본 모듈은 metadata.yaml + governance ledger
 *     만 읽으며 body.md 본문은 절대 읽지 않는다 (telemetry-safe)
 *
 * @module dashboard/plasmid-health-source
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

import { ActivationStore } from "../plasmids/activation.js";
import { loadPlasmids } from "../plasmids/loader.js";
import { OVERRIDE_PENDING_PATH } from "../plasmids/types.js";
import {
  RECOMBINATION_TRANSCRIPTS_DIR,
} from "../recombination/types.js";

const CHALLENGES_LOG_PATH = ".dhelix/governance/challenges.log";
import type {
  DashboardPlasmidHealth,
  PlasmidHealthDataSource,
} from "./types.js";

const DEFAULT_REGISTRY_PATH = ".dhelix/plasmids";

/**
 * fs 스캔 기반 기본 PlasmidHealthDataSource 를 생성한다.
 *
 * @param workingDirectory - dhelix 프로젝트 루트
 * @param registryPath - plasmid 디렉토리 path (기본 `.dhelix/plasmids`)
 */
export function createFsPlasmidHealthDataSource(
  workingDirectory: string,
  registryPath: string = DEFAULT_REGISTRY_PATH,
): PlasmidHealthDataSource {
  return {
    async getHealth(): Promise<DashboardPlasmidHealth> {
      const [counts, lastRecombination, transcriptsCount, governance] =
        await Promise.all([
          collectCounts(workingDirectory, registryPath),
          findLastRecombination(workingDirectory),
          countTranscripts(workingDirectory),
          collectGovernance(workingDirectory),
        ]);
      return { counts, lastRecombination, transcriptsCount, governance };
    },
  };
}

async function collectCounts(
  workingDirectory: string,
  registryPath: string,
): Promise<DashboardPlasmidHealth["counts"]> {
  const result = await loadPlasmids({ workingDirectory, registryPath }).catch(
    () => null,
  );

  const totalPlasmids = result?.loaded.length ?? 0;
  const foundationalIds: string[] = [];
  const byTier: Record<string, number> = {};

  for (const p of result?.loaded ?? []) {
    if (p.metadata.foundational === true) foundationalIds.push(p.metadata.id);
    const tier = p.metadata.tier;
    byTier[tier] = (byTier[tier] ?? 0) + 1;
  }

  const activation = await new ActivationStore({
    workingDirectory,
    registryPath,
  })
    .read()
    .catch(() => ({ activePlasmidIds: [], updatedAt: "" }));

  return {
    totalPlasmids,
    activePlasmidIds: [...activation.activePlasmidIds],
    foundationalIds,
    byTier,
  };
}

async function findLastRecombination(
  workingDirectory: string,
): Promise<DashboardPlasmidHealth["lastRecombination"]> {
  const dir = join(workingDirectory, RECOMBINATION_TRANSCRIPTS_DIR);
  let entries: readonly string[];
  try {
    entries = await readdir(dir);
  } catch {
    return null;
  }
  // transcript 파일명은 `<isoStamp>-<hash>` 패턴이라 lex-sort = 시간 sort
  const sorted = [...entries].filter((e) => e.length > 0).sort();
  const last = sorted[sorted.length - 1];
  if (!last) return null;

  // ISO 부분 추출 (파일명이 .json 등 확장자를 가질 수 있음)
  const id = last.replace(/\.[^./]+$/, "");
  // ISO 부분만 timestamp 로
  const timestampMatch = id.match(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z/);
  const timestamp = timestampMatch
    ? timestampMatch[0].replace(
        /^(\d{4}-\d{2}-\d{2}T)(\d{2})-(\d{2})-(\d{2})Z$/,
        "$1$2:$3:$4Z",
      )
    : id;

  return { transcriptId: id, timestamp };
}

async function countTranscripts(workingDirectory: string): Promise<number> {
  const dir = join(workingDirectory, RECOMBINATION_TRANSCRIPTS_DIR);
  try {
    const entries = await readdir(dir);
    return entries.length;
  } catch {
    return 0;
  }
}

async function collectGovernance(
  workingDirectory: string,
): Promise<DashboardPlasmidHealth["governance"]> {
  const overridePath = join(workingDirectory, OVERRIDE_PENDING_PATH);
  let pendingOverridePlasmidIds: string[] = [];
  try {
    const raw = await readFile(overridePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    pendingOverridePlasmidIds = extractPendingPlasmidIds(parsed);
  } catch {
    // 파일 없음 / 파싱 실패 → 빈 목록 (graceful)
  }

  const challengesPath = join(workingDirectory, CHALLENGES_LOG_PATH);
  let lastChallengeAt: string | null = null;
  try {
    await stat(challengesPath);
    const raw = await readFile(challengesPath, "utf8");
    const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const lastLine = lines[lines.length - 1];
    if (lastLine) {
      try {
        const entry = JSON.parse(lastLine) as { timestamp?: string };
        lastChallengeAt = typeof entry.timestamp === "string"
          ? entry.timestamp
          : null;
      } catch {
        // not JSON line — skip
      }
    }
  } catch {
    // 파일 없음
  }

  return {
    pendingOverrideCount: pendingOverridePlasmidIds.length,
    pendingOverridePlasmidIds,
    lastChallengeAt,
  };
}

/**
 * pending overrides 파일 구조는 `{ pending: [{ plasmidId, queuedAt, ... }] }`
 * 또는 항목 배열 — 둘 다 graceful 하게 처리.
 */
function extractPendingPlasmidIds(parsed: unknown): string[] {
  const out: string[] = [];
  const items: unknown =
    Array.isArray(parsed)
      ? parsed
      : (parsed as { pending?: unknown })?.pending ?? [];
  if (!Array.isArray(items)) return out;
  for (const item of items) {
    if (typeof item === "object" && item !== null) {
      const id = (item as { plasmidId?: unknown }).plasmidId;
      if (typeof id === "string") out.push(id);
    }
  }
  return out;
}

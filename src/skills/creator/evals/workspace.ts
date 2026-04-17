/**
 * Eval workspace 레이아웃 관리자 — `<skill>/workspace/iteration-N/...` 디렉토리 생성·탐색
 *
 * 계획서 §12.5 참조. 각 iteration 은 불변이며, history.json 이 진행 추적.
 *
 * 디렉토리 규약:
 * ```
 * <skillDir>/
 * ├── workspace/
 * │   ├── history.json
 * │   └── iteration-<N>/
 * │       ├── benchmark.json
 * │       └── eval-<case-id>/
 * │           ├── with-skill/
 * │           │   ├── output.md
 * │           │   ├── transcript.json
 * │           │   ├── metrics.json
 * │           │   ├── timing.json
 * │           │   └── grading.json
 * │           └── baseline/
 * │               └── ... (동일)
 * ```
 */

import { join } from "node:path";
import * as defaultFs from "node:fs/promises";
import {
  type Benchmark,
  benchmarkSchema,
  type Grading,
  gradingSchema,
  type History,
  historySchema,
  type Metrics,
  metricsSchema,
  type RawRunResult,
  type Timing,
  timingSchema,
} from "./types.js";

/** 주입 가능한 fs — 테스트에서 mocking 용 */
export interface WorkspaceDeps {
  readonly fs?: typeof defaultFs;
}

/**
 * 스킬 디렉토리 경로로부터 workspace 루트 경로를 계산
 */
export function getWorkspaceRoot(skillDir: string): string {
  return join(skillDir, "workspace");
}

/**
 * N 번째 iteration 디렉토리 경로를 계산 (I/O 없음)
 */
export function getIterationDir(skillDir: string, iteration: number): string {
  return join(getWorkspaceRoot(skillDir), `iteration-${String(iteration)}`);
}

/**
 * 특정 case 의 run 디렉토리 경로를 계산 (I/O 없음)
 */
export function getRunDir(
  skillDir: string,
  iteration: number,
  caseId: string,
  configName: string,
): string {
  return join(getIterationDir(skillDir, iteration), `eval-${caseId}`, configName);
}

/**
 * workspace 에서 다음 iteration 번호를 결정
 *
 * workspace 가 없거나 iteration-* 디렉토리가 없으면 0 반환.
 * 있으면 최대 N+1 반환.
 *
 * @param skillDir - 스킬 루트 디렉토리
 * @param deps - fs 주입 (테스트용)
 * @returns 다음 iteration 번호
 */
export async function nextIterationNumber(
  skillDir: string,
  deps?: WorkspaceDeps,
): Promise<number> {
  const fs = deps?.fs ?? defaultFs;
  const root = getWorkspaceRoot(skillDir);

  let entries: readonly string[] = [];
  try {
    entries = await fs.readdir(root);
  } catch {
    return 0;
  }

  let maxN = -1;
  for (const name of entries) {
    const m = /^iteration-(\d+)$/.exec(name);
    if (m && m[1] !== undefined) {
      const n = Number(m[1]);
      if (!Number.isNaN(n) && n > maxN) maxN = n;
    }
  }
  return maxN + 1;
}

/**
 * 새 iteration 디렉토리 + 그 하위 eval-<caseId>/<config> 디렉토리를 모두 생성
 *
 * @param skillDir - 스킬 루트
 * @param iteration - 번호 (보통 nextIterationNumber 결과)
 * @param caseIds - 생성할 case 디렉토리 목록
 * @param configs - 각 case 하위에 만들 config 이름 목록 (예: ["with-skill","baseline"])
 * @param deps - fs 주입
 * @returns 생성된 iteration 디렉토리 절대 경로
 */
export async function createIteration(
  skillDir: string,
  iteration: number,
  caseIds: readonly string[],
  configs: readonly string[],
  deps?: WorkspaceDeps,
): Promise<string> {
  const fs = deps?.fs ?? defaultFs;
  const iterDir = getIterationDir(skillDir, iteration);
  await fs.mkdir(iterDir, { recursive: true });

  for (const caseId of caseIds) {
    for (const cfg of configs) {
      await fs.mkdir(join(iterDir, `eval-${caseId}`, cfg), { recursive: true });
    }
  }
  return iterDir;
}

/**
 * 단일 run 의 결과물을 디스크에 저장 (output, transcript, metrics, timing, grading)
 *
 * 순서가 깨지지 않도록 개별 await 로 순차 기록.
 */
export async function persistRunResult(
  skillDir: string,
  iteration: number,
  result: RawRunResult,
  deps?: WorkspaceDeps,
): Promise<string> {
  const fs = deps?.fs ?? defaultFs;
  const dir = getRunDir(skillDir, iteration, result.caseId, result.configName);
  await fs.mkdir(dir, { recursive: true });

  await fs.writeFile(join(dir, "output.md"), result.output, "utf8");
  await fs.writeFile(join(dir, "transcript.json"), result.transcript, "utf8");
  await fs.writeFile(
    join(dir, "metrics.json"),
    JSON.stringify(result.metrics, null, 2),
    "utf8",
  );
  await fs.writeFile(
    join(dir, "timing.json"),
    JSON.stringify(result.timing, null, 2),
    "utf8",
  );
  if (result.grading) {
    await fs.writeFile(
      join(dir, "grading.json"),
      JSON.stringify(result.grading, null, 2),
      "utf8",
    );
  }
  return dir;
}

/**
 * 특정 run 의 grading.json 을 로드
 */
export async function readRunGrading(
  skillDir: string,
  iteration: number,
  caseId: string,
  configName: string,
  deps?: WorkspaceDeps,
): Promise<Grading | null> {
  const fs = deps?.fs ?? defaultFs;
  const path = join(getRunDir(skillDir, iteration, caseId, configName), "grading.json");
  try {
    const raw = await fs.readFile(path, "utf8");
    return gradingSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * 특정 run 의 metrics.json 을 로드
 */
export async function readRunMetrics(
  skillDir: string,
  iteration: number,
  caseId: string,
  configName: string,
  deps?: WorkspaceDeps,
): Promise<Metrics | null> {
  const fs = deps?.fs ?? defaultFs;
  const path = join(getRunDir(skillDir, iteration, caseId, configName), "metrics.json");
  try {
    const raw = await fs.readFile(path, "utf8");
    return metricsSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * 특정 run 의 timing.json 을 로드
 */
export async function readRunTiming(
  skillDir: string,
  iteration: number,
  caseId: string,
  configName: string,
  deps?: WorkspaceDeps,
): Promise<Timing | null> {
  const fs = deps?.fs ?? defaultFs;
  const path = join(getRunDir(skillDir, iteration, caseId, configName), "timing.json");
  try {
    const raw = await fs.readFile(path, "utf8");
    return timingSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * iteration 의 benchmark.json 을 저장
 */
export async function writeBenchmark(
  skillDir: string,
  benchmark: Benchmark,
  deps?: WorkspaceDeps,
): Promise<string> {
  const fs = deps?.fs ?? defaultFs;
  const dir = getIterationDir(skillDir, benchmark.iteration);
  await fs.mkdir(dir, { recursive: true });
  const path = join(dir, "benchmark.json");
  await fs.writeFile(path, JSON.stringify(benchmark, null, 2), "utf8");
  return path;
}

/**
 * iteration 의 benchmark.json 을 로드
 */
export async function readBenchmark(
  skillDir: string,
  iteration: number,
  deps?: WorkspaceDeps,
): Promise<Benchmark | null> {
  const fs = deps?.fs ?? defaultFs;
  const path = join(getIterationDir(skillDir, iteration), "benchmark.json");
  try {
    const raw = await fs.readFile(path, "utf8");
    return benchmarkSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * workspace 루트의 history.json 을 append 모드로 업데이트
 *
 * 파일이 없으면 entries=[entry] 로 새로 만든다.
 * 같은 version 이 이미 있으면 대체.
 */
export async function appendHistory(
  skillDir: string,
  entry: History["entries"][number],
  deps?: WorkspaceDeps,
): Promise<string> {
  const fs = deps?.fs ?? defaultFs;
  const root = getWorkspaceRoot(skillDir);
  await fs.mkdir(root, { recursive: true });
  const path = join(root, "history.json");

  let existing: History = { skill_name: entry.description, entries: [] };
  try {
    const raw = await fs.readFile(path, "utf8");
    existing = historySchema.parse(JSON.parse(raw));
  } catch {
    // no existing history — start fresh
  }

  // 같은 version 교체 또는 append. Zod 추론 타입이 mutable 이므로 readonly 표기를 피한다.
  const withoutDup = existing.entries.filter((e) => e.version !== entry.version);
  const entries = [...withoutDup, entry].sort((a, b) => a.version - b.version);

  const updated: History = {
    skill_name: existing.skill_name,
    entries,
  };
  await fs.writeFile(path, JSON.stringify(updated, null, 2), "utf8");
  return path;
}

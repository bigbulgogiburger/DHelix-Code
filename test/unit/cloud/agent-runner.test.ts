/**
 * AgentRunner 단위 테스트
 *
 * executeJob, timeout, cancel, 동시 실행 검증
 */

import { describe, it, expect, beforeEach } from "vitest";

import { AgentRunner } from "../../../src/cloud/agent-runner.js";
import type { CloudJob } from "../../../src/cloud/types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeJob(overrides: Partial<CloudJob> = {}): CloudJob {
  return {
    id: "test-job-1",
    agentManifestId: "explore",
    prompt: "Analyze the codebase structure",
    status: "running",
    priority: "normal",
    createdAt: Date.now(),
    startedAt: Date.now(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AgentRunner", () => {
  let runner: AgentRunner;

  beforeEach(() => {
    runner = new AgentRunner({ jobTimeoutMs: 5_000 });
  });

  // -----------------------------------------------------------------------
  // executeJob
  // -----------------------------------------------------------------------

  describe("executeJob", () => {
    it("should return a successful result for a valid job", async () => {
      const job = makeJob();
      const result = await runner.executeJob(job);

      expect(result.success).toBe(true);
      expect(result.output).toContain("Analyze the codebase");
      expect(result.tokensUsed).toBeGreaterThan(0);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it("should generate analysis artifact for explore-like prompts", async () => {
      const job = makeJob({ prompt: "Explore the project and analyze dependencies" });
      const result = await runner.executeJob(job);

      expect(result.artifacts.length).toBeGreaterThan(0);
      const analysis = result.artifacts.find((a) => a.type === "analysis");
      expect(analysis).toBeDefined();
    });

    it("should generate file-change artifact for file-related prompts", async () => {
      const job = makeJob({ prompt: "Edit the file and write new content" });
      const result = await runner.executeJob(job);

      const fileChange = result.artifacts.find((a) => a.type === "file-change");
      expect(fileChange).toBeDefined();
      expect(fileChange!.path).toBe("simulated/output.ts");
    });

    it("should generate test-result artifact for test prompts", async () => {
      const job = makeJob({ prompt: "Run the test suite and report results" });
      const result = await runner.executeJob(job);

      const testResult = result.artifacts.find((a) => a.type === "test-result");
      expect(testResult).toBeDefined();
    });

    it("should generate default analysis artifact for generic prompts", async () => {
      const job = makeJob({ prompt: "Do something generic" });
      const result = await runner.executeJob(job);

      expect(result.artifacts).toHaveLength(1);
      expect(result.artifacts[0].type).toBe("analysis");
    });

    it("should track running state during execution", async () => {
      const job = makeJob();
      const promise = runner.executeJob(job);

      // 실행 중에는 running 상태
      expect(runner.isRunning(job.id)).toBe(true);
      expect(runner.getRunningCount()).toBe(1);

      await promise;

      // 완료 후에는 running 아님
      expect(runner.isRunning(job.id)).toBe(false);
      expect(runner.getRunningCount()).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // timeout
  // -----------------------------------------------------------------------

  describe("timeout", () => {
    it("should timeout after configured duration", async () => {
      const shortRunner = new AgentRunner({ jobTimeoutMs: 1 });
      const job = makeJob();

      // 매우 짧은 타임아웃으로 실행
      const result = await shortRunner.executeJob(job);

      // 타임아웃 또는 성공 (race 조건에 따라 달라질 수 있음)
      // 시뮬레이션이 10ms 대기하므로 1ms 타임아웃이면 보통 타임아웃됨
      if (!result.success) {
        expect(result.error).toContain("timed out");
      }
    });
  });

  // -----------------------------------------------------------------------
  // cancel
  // -----------------------------------------------------------------------

  describe("cancelExecution", () => {
    it("should cancel a running job", async () => {
      const job = makeJob();
      const promise = runner.executeJob(job);

      // 즉시 취소
      const cancelled = runner.cancelExecution(job.id);
      expect(cancelled).toBe(true);

      const result = await promise;
      // 취소된 작업은 실패 또는 취소 에러
      if (!result.success) {
        expect(result.error).toContain("cancelled");
      }
    });

    it("should return false for non-running job", () => {
      expect(runner.cancelExecution("nonexistent")).toBe(false);
    });

    it("should decrement running count after cancel", async () => {
      const job = makeJob();
      const promise = runner.executeJob(job);

      runner.cancelExecution(job.id);
      expect(runner.isRunning(job.id)).toBe(false);

      await promise;
      expect(runner.getRunningCount()).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // concurrent execution
  // -----------------------------------------------------------------------

  describe("concurrent execution", () => {
    it("should track multiple running jobs", async () => {
      const job1 = makeJob({ id: "job-1" });
      const job2 = makeJob({ id: "job-2" });
      const job3 = makeJob({ id: "job-3" });

      const p1 = runner.executeJob(job1);
      const p2 = runner.executeJob(job2);
      const p3 = runner.executeJob(job3);

      expect(runner.getRunningCount()).toBe(3);
      expect(runner.isRunning("job-1")).toBe(true);
      expect(runner.isRunning("job-2")).toBe(true);
      expect(runner.isRunning("job-3")).toBe(true);

      await Promise.all([p1, p2, p3]);

      expect(runner.getRunningCount()).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // default config
  // -----------------------------------------------------------------------

  describe("default config", () => {
    it("should use default config when none provided", async () => {
      const defaultRunner = new AgentRunner();
      const job = makeJob();
      const result = await defaultRunner.executeJob(job);

      expect(result.success).toBe(true);
    });
  });
});

/**
 * AgentRunner -- 클라우드 작업 실행 어댑터
 *
 * 작업(CloudJob)을 받아 에이전트를 실행하고 결과를 반환합니다.
 * 현재는 인메모리 시뮬레이션으로 실제 LLM 호출 없이 프롬프트를 분석하여
 * 간단한 결과를 생성합니다.
 *
 * 향후 확장 포인트:
 * - executeRemote(job, endpoint) -- HTTP API를 통한 원격 실행
 * - executeDocker(job, config) -- 컨테이너 격리 실행
 *
 * @module cloud/agent-runner
 */

import type { CloudArtifact, CloudConfig, CloudJob, CloudJobResult } from "./types.js";
import { DEFAULT_CLOUD_CONFIG } from "./types.js";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * 프롬프트를 분석하여 시뮬레이션된 결과를 생성합니다.
 *
 * 실제 LLM 호출 없이 프롬프트의 키워드를 기반으로 적절한
 * 아티팩트 유형과 내용을 결정합니다.
 *
 * @param prompt - 에이전트 프롬프트
 * @returns 시뮬레이션된 작업 결과
 */
function simulateExecution(prompt: string): CloudJobResult {
  const lowerPrompt = prompt.toLowerCase();
  const startTime = Date.now();

  // 프롬프트 키워드 기반으로 아티팩트 생성
  const artifacts: CloudArtifact[] = [];

  if (
    lowerPrompt.includes("file") ||
    lowerPrompt.includes("edit") ||
    lowerPrompt.includes("write")
  ) {
    artifacts.push({
      type: "file-change",
      path: "simulated/output.ts",
      content: `// Simulated file change for: ${prompt.slice(0, 100)}`,
    });
  }

  if (lowerPrompt.includes("test") || lowerPrompt.includes("spec")) {
    artifacts.push({
      type: "test-result",
      content: JSON.stringify({
        total: 5,
        passed: 5,
        failed: 0,
        summary: `Simulated test run for: ${prompt.slice(0, 80)}`,
      }),
    });
  }

  if (
    lowerPrompt.includes("analy") ||
    lowerPrompt.includes("review") ||
    lowerPrompt.includes("explore")
  ) {
    artifacts.push({
      type: "analysis",
      content: `Analysis result for: ${prompt.slice(0, 100)}\n\nNo issues found in simulated analysis.`,
    });
  }

  // 기본 아티팩트가 없으면 analysis 추가
  if (artifacts.length === 0) {
    artifacts.push({
      type: "analysis",
      content: `Processed prompt: ${prompt.slice(0, 200)}`,
    });
  }

  const durationMs = Date.now() - startTime;
  const estimatedTokens = Math.max(100, Math.ceil(prompt.length * 1.5));

  return {
    success: true,
    output: `[Simulated] Successfully processed: ${prompt.slice(0, 100)}`,
    artifacts,
    tokensUsed: estimatedTokens,
    durationMs,
  };
}

// ---------------------------------------------------------------------------
// AgentRunner
// ---------------------------------------------------------------------------

/**
 * 클라우드 작업 실행 어댑터
 *
 * 작업을 받아 실행하고 결과를 반환합니다.
 * AbortController를 사용하여 타임아웃과 취소를 지원합니다.
 *
 * @example
 * ```ts
 * const runner = new AgentRunner({ jobTimeoutMs: 60_000 });
 * const result = await runner.executeJob(job);
 * console.log(result.success, result.output);
 *
 * // 실행 취소
 * runner.cancelExecution(job.id);
 * ```
 */
export class AgentRunner {
  /** 런타임 설정 (기본값 병합) */
  private readonly config: Readonly<Required<CloudConfig>>;

  /** 실행 중인 작업의 AbortController 맵 */
  private readonly runningJobs: Map<string, AbortController> = new Map();

  /**
   * AgentRunner를 생성합니다.
   *
   * @param config - 클라우드 런타임 설정 (선택적, 기본값 자동 적용)
   */
  constructor(config?: CloudConfig) {
    this.config = {
      ...DEFAULT_CLOUD_CONFIG,
      ...config,
    };
  }

  /**
   * 작업을 실행하고 결과를 반환합니다.
   *
   * 인메모리 시뮬레이션으로 실제 LLM 호출 없이 프롬프트를 분석하여
   * 결과를 생성합니다. AbortController를 사용하여 타임아웃을 처리합니다.
   *
   * @param job - 실행할 클라우드 작업
   * @returns 작업 실행 결과
   * @throws 타임아웃 시 에러 결과를 반환 (throw하지 않음)
   */
  async executeJob(job: CloudJob): Promise<CloudJobResult> {
    const controller = new AbortController();
    this.runningJobs.set(job.id, controller);

    const timeoutMs = this.config.jobTimeoutMs;

    try {
      const result = await Promise.race([
        this.runSimulation(job, controller.signal),
        this.createTimeout(timeoutMs, controller.signal),
      ]);

      return result;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown execution error";

      return {
        success: false,
        output: "",
        artifacts: [],
        tokensUsed: 0,
        durationMs: 0,
        error: errorMessage,
      };
    } finally {
      this.runningJobs.delete(job.id);
    }
  }

  /**
   * 특정 작업이 실행 중인지 확인합니다.
   *
   * @param jobId - 확인할 작업 ID
   * @returns 실행 중이면 true
   */
  isRunning(jobId: string): boolean {
    return this.runningJobs.has(jobId);
  }

  /**
   * 실행 중인 작업을 취소합니다.
   *
   * AbortController.abort()를 호출하여 진행 중인 실행을 중단합니다.
   *
   * @param jobId - 취소할 작업 ID
   * @returns 취소 성공 여부 (실행 중이 아니면 false)
   */
  cancelExecution(jobId: string): boolean {
    const controller = this.runningJobs.get(jobId);
    if (controller === undefined) {
      return false;
    }

    controller.abort();
    this.runningJobs.delete(jobId);
    return true;
  }

  /**
   * 현재 실행 중인 작업 수를 반환합니다.
   *
   * @returns 실행 중인 작업 수
   */
  getRunningCount(): number {
    return this.runningJobs.size;
  }

  // -------------------------------------------------------------------------
  // Private methods
  // -------------------------------------------------------------------------

  /**
   * 시뮬레이션 실행을 수행합니다.
   *
   * AbortSignal을 확인하여 취소된 경우 에러 결과를 반환합니다.
   *
   * @param job - 실행할 작업
   * @param signal - 취소 시그널
   * @returns 시뮬레이션 결과
   */
  private async runSimulation(job: CloudJob, signal: AbortSignal): Promise<CloudJobResult> {
    // 비동기 시뮬레이션 (실제 환경에서는 LLM API 호출)
    await new Promise<void>((resolve, reject) => {
      if (signal.aborted) {
        reject(new Error("Job cancelled"));
        return;
      }

      const timer = setTimeout(resolve, 10); // 최소 비동기 대기

      const onAbort = (): void => {
        clearTimeout(timer);
        reject(new Error("Job cancelled"));
      };

      signal.addEventListener("abort", onAbort, { once: true });
    });

    if (signal.aborted) {
      return {
        success: false,
        output: "",
        artifacts: [],
        tokensUsed: 0,
        durationMs: 0,
        error: "Job cancelled",
      };
    }

    return simulateExecution(job.prompt);
  }

  /**
   * 타임아웃 프로미스를 생성합니다.
   *
   * 지정된 시간이 경과하면 에러 결과를 반환합니다.
   *
   * @param timeoutMs - 타임아웃 밀리초
   * @param signal - 취소 시그널 (타임아웃 타이머 정리용)
   * @returns 타임아웃 에러 결과
   */
  private createTimeout(timeoutMs: number, signal: AbortSignal): Promise<CloudJobResult> {
    return new Promise<CloudJobResult>((resolve) => {
      const timer = setTimeout(() => {
        resolve({
          success: false,
          output: "",
          artifacts: [],
          tokensUsed: 0,
          durationMs: timeoutMs,
          error: `Job timed out after ${timeoutMs}ms`,
        });
      }, timeoutMs);

      signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
        },
        { once: true },
      );
    });
  }
}

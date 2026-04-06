/**
 * CompactContext Stage — 선제적 컴팩션 체크 및 실행
 *
 * LLM 호출 전에 컨텍스트 사용량이 임계치에 근접하면 미리 압축합니다.
 * AsyncCompactionEngine을 통해 비동기 백그라운드 compaction을 우선 시도하고,
 * 결과가 없으면 기존 동기 compaction으로 폴백합니다.
 *
 * prepare()의 자동 컴팩션(83.5%)과 별도로, 70%에서 proactive compaction을
 * 시작하고, 80%에서 선제적 동기 compaction을 실행하여
 * LLM 호출 실패나 품질 저하를 사전에 방지합니다.
 *
 * @module core/runtime/stages/compact-context
 */

import { type RuntimeStage, type RuntimeContext } from "../types.js";
import { AGENT_LOOP } from "../../../constants.js";

const trace = (tag: string, msg: string) => {
  if (process.env.DHELIX_VERBOSE) process.stderr.write(`[${tag}] ${msg}\n`);
};

/**
 * CompactContext stage를 생성합니다.
 *
 * 3단계 compaction 전략:
 * 1. 먼저 AsyncCompactionEngine의 pending 결과 확인 (이전 proactive 결과)
 * 2. 결과 없으면 usage 기반으로 새 compaction 요청:
 *    - 70% 이상: proactive async compaction (비차단)
 *    - 80% 이상: 기존 동기 compaction (즉시 실행)
 * 3. 이중 컴팩션 방지: 최근 2회 반복 이내에 컴팩션이 발생했으면 건너뜁니다.
 *
 * @returns CompactContext stage 인스턴스
 */
export function createCompactContextStage(): RuntimeStage {
  return {
    name: "compact-context",

    async execute(ctx: RuntimeContext): Promise<void> {
      // Step 1: AsyncCompactionEngine의 pending 결과 확인
      const asyncResult = ctx.contextManager.getAsyncCompactionResult();
      if (asyncResult) {
        trace(
          "compact-context",
          "Applying async compaction result from previous iteration",
        );
        ctx.managedMessages = [...asyncResult];
        ctx.lastCompactionIteration = ctx.iteration;
        trace(
          "compact-context",
          `Async compaction applied — usage now ${(ctx.contextManager.getUsage(ctx.managedMessages).usageRatio * 100).toFixed(1)}%`,
        );
        return;
      }

      // Step 2: 이중 컴팩션 방지 + threshold 기반 compaction
      if (ctx.iteration - ctx.lastCompactionIteration > 2) {
        const preemptiveUsage = ctx.contextManager.getUsage(ctx.managedMessages);

        // 80% 이상: 기존 동기 compaction (즉시 실행)
        if (preemptiveUsage.usageRatio >= AGENT_LOOP.preemptiveCompactionThreshold) {
          trace(
            "compact-context",
            `Preemptive compaction triggered at ${(preemptiveUsage.usageRatio * 100).toFixed(1)}% usage`,
          );
          ctx.events.emit("context:pre-compact", { compactionNumber: 0 });
          const { messages: compacted } = await ctx.contextManager.compact(ctx.managedMessages);
          ctx.managedMessages = [...compacted];
          ctx.lastCompactionIteration = ctx.iteration;
          trace(
            "compact-context",
            `Preemptive compaction complete — usage now ${(ctx.contextManager.getUsage(ctx.managedMessages).usageRatio * 100).toFixed(1)}%`,
          );
          return;
        }

        // 70% 이상: proactive async compaction 요청 (비차단)
        const asyncEngine = ctx.contextManager.getAsyncCompactionEngine();
        if (
          preemptiveUsage.usageRatio >= asyncEngine.getProactiveThreshold() &&
          !ctx.contextManager.getAsyncCompactionResult()
        ) {
          trace(
            "compact-context",
            `Proactive async compaction requested at ${(preemptiveUsage.usageRatio * 100).toFixed(1)}% usage`,
          );
          // 비차단: requestAsyncCompaction은 proactive이므로 background에서 실행
          await ctx.contextManager.requestAsyncCompaction(ctx.managedMessages);
        }
      }
    },
  };
}

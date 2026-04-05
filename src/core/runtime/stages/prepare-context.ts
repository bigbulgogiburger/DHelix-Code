/**
 * PrepareContext Stage — Observation masking 및 context manager prepare 실행
 *
 * agent-loop의 첫 번째 단계로, 메시지에 observation masking을 적용하고
 * context manager를 통해 토큰 예산 관리를 준비합니다.
 *
 * @module core/runtime/stages/prepare-context
 */

import { type RuntimeStage, type RuntimeContext } from "../types.js";
import { applyObservationMasking } from "../../observation-masking.js";
import { detectPhase } from "../../../llm/dual-model-router.js";

/**
 * PrepareContext stage를 생성합니다.
 *
 * 1. Dual-model routing: 메시지 히스토리 기반으로 architect/editor phase 감지
 * 2. Observation masking: 이전 observation의 상세 내용을 마스킹하여 토큰 절약
 * 3. Context manager prepare: 토큰 예산에 맞게 메시지를 관리
 *
 * @returns PrepareContext stage 인스턴스
 */
export function createPrepareContextStage(): RuntimeStage {
  return {
    name: "prepare-context",

    async execute(ctx: RuntimeContext): Promise<void> {
      // Dual-model routing: detect phase and select client/model
      if (ctx.dualModelRouter) {
        const phase = detectPhase(ctx.messages);
        ctx.dualModelRouter.setPhase(phase);
        const routing = ctx.dualModelRouter.getClientForPhase(phase);
        ctx.activeClient = routing.client;
        ctx.activeModel = routing.model;
      }

      // Apply observation masking to reduce token usage
      const maskedMessages = applyObservationMasking(ctx.messages, { keepRecentN: 5 });

      // Apply context compaction if messages exceed token budget
      ctx.managedMessages = [...(await ctx.contextManager.prepare(maskedMessages))];
    },
  };
}

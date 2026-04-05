/**
 * PreflightPolicy Stage — 권한 검사 및 보안 가드레일 적용
 *
 * 도구 실행 전에 권한을 확인하고, 입력 가드레일을 적용합니다.
 * 거부된 도구 호출은 에러 결과로 변환됩니다.
 *
 * @module core/runtime/stages/preflight-policy
 */

import { type RuntimeStage, type RuntimeContext } from "../types.js";
import { type ExtractedToolCall, type ToolCallResult } from "../../../tools/types.js";
import { applyInputGuardrails } from "../../../guardrails/index.js";

/** 같은 도구가 N회 거절되면 LLM에 사용 중단 메시지를 주입하는 임계치 */
const MAX_DENIALS_BEFORE_STOP = 2;

/**
 * PreflightPolicy stage를 생성합니다.
 *
 * 각 도구 호출에 대해:
 * 1. 권한 확인 (사용자 승인 요청)
 * 2. 입력 가드레일 적용 (보안 정책 위반 검사)
 *
 * 실행 가능한 호출만 ctx.extractedCalls에 남기고,
 * 거부/차단된 결과는 ctx.toolResults에 미리 추가합니다.
 *
 * @returns PreflightPolicy stage 인스턴스
 */
export function createPreflightPolicyStage(): RuntimeStage {
  return {
    name: "preflight-policy",

    async execute(ctx: RuntimeContext): Promise<void> {
      if (ctx.extractedCalls.length === 0) return;

      const executableCalls: ExtractedToolCall[] = [];
      const preflightResults: ToolCallResult[] = [];

      for (const call of ctx.extractedCalls) {
        ctx.events.emit("tool:start", { name: call.name, id: call.id, args: call.arguments });

        // Check permission
        if (ctx.config.checkPermission) {
          const permission = await ctx.config.checkPermission(call);
          if (!permission.allowed) {
            const denialCount = (ctx.permissionDenialCounts.get(call.name) ?? 0) + 1;
            ctx.permissionDenialCounts.set(call.name, denialCount);

            const denialMessage =
              denialCount >= MAX_DENIALS_BEFORE_STOP
                ? `Permission denied: ${permission.reason ?? "User rejected"}. ` +
                  `This tool has been denied ${denialCount} times. ` +
                  `STOP trying to use "${call.name}". ` +
                  `Inform the user what you were trying to do and ask for guidance.`
                : `Permission denied: ${permission.reason ?? "User rejected"}`;

            const denied: ToolCallResult = {
              id: call.id,
              name: call.name,
              output: denialMessage,
              isError: true,
            };
            preflightResults.push(denied);
            ctx.events.emit("tool:complete", {
              name: call.name,
              id: call.id,
              isError: true,
              output: denialMessage,
            });
            continue;
          }
        }

        // Apply input guardrails
        if (ctx.config.enableGuardrails !== false) {
          const guardrailCheck = applyInputGuardrails(
            call.name,
            call.arguments as Record<string, unknown>,
            ctx.config.workingDirectory,
          );
          if (guardrailCheck.severity === "block") {
            const blocked: ToolCallResult = {
              id: call.id,
              name: call.name,
              output: `Blocked by guardrail: ${guardrailCheck.reason ?? "Security policy violation"}`,
              isError: true,
            };
            preflightResults.push(blocked);
            ctx.events.emit("tool:complete", {
              name: call.name,
              id: call.id,
              isError: true,
              output: `Blocked: ${guardrailCheck.reason}`,
            });
            continue;
          }
          if (guardrailCheck.severity === "warn") {
            ctx.events.emit("llm:error", {
              error: new Error(`Guardrail warning: ${guardrailCheck.reason}`),
            });
          }
        }

        executableCalls.push(call);
      }

      // Store preflight results and update extractedCalls to only executable ones
      ctx.toolResults = preflightResults;
      ctx.extractedCalls = executableCalls;
    },
  };
}

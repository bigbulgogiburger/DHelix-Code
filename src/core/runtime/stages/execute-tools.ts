/**
 * ExecuteTools Stage — 도구 그룹화, ToolPipeline 실행, 체크포인트, 결과 수집
 *
 * 승인된 도구 호출을 ToolPipeline을 통해 실행합니다.
 * 파일 수정 도구 실행 전에는 자동으로 체크포인트를 생성합니다.
 * agent-loop.ts와 동일한 ToolPipeline 경로를 사용하여 테스트 호환성을 보장합니다.
 *
 * @module core/runtime/stages/execute-tools
 */

import { type RuntimeStage, type RuntimeContext } from "../types.js";
import { type ToolCallResult, type ToolContext } from "../../../tools/types.js";
import { ToolPipeline } from "../../../tools/pipeline.js";
import { applyOutputGuardrails } from "../../../guardrails/index.js";
import { groupToolCalls, FILE_WRITE_TOOLS, extractFilePath } from "../../tool-call-utils.js";
import { getModelCapabilities } from "../../../llm/model-capabilities.js";
import { TOOL_TIMEOUTS } from "../../../constants.js";
import { getPlatform } from "../../../utils/platform.js";

const trace = (tag: string, msg: string) => {
  if (process.env.DHELIX_VERBOSE) process.stderr.write(`[${tag}] ${msg}\n`);
};

/**
 * ExecuteTools stage를 생성합니다.
 *
 * 1. 파일 수정 전 자동 체크포인트 생성
 * 2. ToolPipeline을 통해 도구 호출 실행 (스케줄링, 재시도, 후처리 포함)
 * 3. 출력 가드레일 적용
 * 4. preflight에서 거부된 결과와 합산
 *
 * @returns ExecuteTools stage 인스턴스
 */
export function createExecuteToolsStage(): RuntimeStage {
  return {
    name: "execute-tools",

    async execute(ctx: RuntimeContext): Promise<void> {
      if (ctx.extractedCalls.length === 0) return;

      const { config, events, activeClient, activeModel } = ctx;
      const groups = groupToolCalls(ctx.extractedCalls);
      const results: ToolCallResult[] = [...ctx.toolResults]; // Include preflight results

      events.emit("agent:tools-executing", {
        toolNames: groups.flat().map((tc) => tc.name),
        count: groups.flat().length,
      });

      trace(
        "execute-tools",
        `Executing ${groups.flat().length} tool calls: [${groups
          .flat()
          .map((tc) => tc.name)
          .join(", ")}]`,
      );

      // 4-stage ToolPipeline for structured tool execution
      const toolPipeline = new ToolPipeline(config.toolRegistry);

      for (const group of groups) {
        // Auto-checkpoint before file-modifying tools
        if (config.checkpointManager) {
          const fileModifyingCalls = group.filter((c) => FILE_WRITE_TOOLS.has(c.name));
          if (fileModifyingCalls.length > 0) {
            const trackedFiles = fileModifyingCalls
              .map((c) => extractFilePath(c))
              .filter((p): p is string => p !== undefined);

            if (trackedFiles.length > 0) {
              try {
                const workDir = config.workingDirectory ?? process.cwd();
                const toolNames = fileModifyingCalls.map((c) => c.name).join(", ");
                const cp = await config.checkpointManager.createCheckpoint({
                  sessionId: config.sessionId ?? "unknown",
                  description: `Before ${toolNames}: ${trackedFiles.map((f) => f.split("/").pop()).join(", ")}`,
                  messageIndex: ctx.messages.length,
                  workingDirectory: workDir,
                  trackedFiles,
                });
                events.emit("checkpoint:created", {
                  checkpointId: cp.id,
                  description: cp.description,
                  fileCount: cp.files.length,
                });
              } catch {
                // Checkpoint failure should not block tool execution
              }
            }
          }
        }

        // Execute approved calls through the 4-stage ToolPipeline
        const pipelineContext = {
          workingDirectory: config.workingDirectory ?? process.cwd(),
          abortSignal: config.signal ?? new AbortController().signal,
          timeoutMs: TOOL_TIMEOUTS.default,
          platform: getPlatform(),
          events: events,
          activeClient: activeClient,
          activeModel: activeModel,
          capabilityTier: getModelCapabilities(activeModel).capabilityTier,
          checkPermission: config.checkPermission,
          checkpointManager: config.checkpointManager,
          sessionId: config.sessionId,
          thinking: config.thinking,
        } satisfies ToolContext;

        const pipelineResult = await toolPipeline.execute(group, pipelineContext, {
          // Skip pipeline preflight — preflight-policy stage already handled permission + guardrails
          preflightChecks: [],
          enableGuardrails: false,
          postprocess: {
            maxOutputLength: ctx.maxToolResultChars,
          },
        });

        // Collect pipeline execution results and apply output guardrails
        for (const result of pipelineResult.results) {
          let finalResult = result;

          // Apply output guardrails (pipeline does not handle output guardrails)
          if (config.enableGuardrails !== false) {
            const outputCheck = applyOutputGuardrails(finalResult.output);
            if (outputCheck.modified) {
              finalResult = { ...finalResult, output: outputCheck.modified };
            }
          }

          results.push(finalResult);
          events.emit("tool:complete", {
            name: finalResult.name,
            id: finalResult.id,
            isError: finalResult.isError,
            output: finalResult.output,
            metadata: finalResult.metadata,
          });
        }
      }

      events.emit("agent:tools-done", {
        count: results.length,
        nextAction: "llm-call",
      });

      ctx.toolResults = results;
    },
  };
}

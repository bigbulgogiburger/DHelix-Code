/**
 * ExecuteTools Stage — 도구 그룹화, 병렬 실행, 체크포인트, 결과 수집
 *
 * 승인된 도구 호출을 병렬 그룹으로 분류하고 실행합니다.
 * 파일 수정 도구 실행 전에는 자동으로 체크포인트를 생성합니다.
 *
 * @module core/runtime/stages/execute-tools
 */

import { type RuntimeStage, type RuntimeContext } from "../types.js";
import { type ExtractedToolCall, type ToolCallResult } from "../../../tools/types.js";
import { executeToolCall } from "../../../tools/executor.js";
import { applyOutputGuardrails } from "../../../guardrails/index.js";
import { groupToolCalls } from "../../agent-loop.js";
import { getModelCapabilities } from "../../../llm/model-capabilities.js";

/** 파일에 쓰는 도구들 */
const FILE_WRITE_TOOLS = new Set(["file_write", "file_edit"]);

/**
 * 도구 호출의 인자에서 파일 경로를 추출합니다.
 *
 * @param call - 도구 호출 정보
 * @returns 파일 경로 문자열, 없으면 undefined
 */
function extractFilePath(call: ExtractedToolCall): string | undefined {
  const args = call.arguments as Record<string, unknown>;
  if (typeof args["file_path"] === "string") return args["file_path"];
  if (typeof args["path"] === "string") return args["path"];
  if (typeof args["filePath"] === "string") return args["filePath"];
  return undefined;
}

const trace = (tag: string, msg: string) => {
  if (process.env.DHELIX_VERBOSE) process.stderr.write(`[${tag}] ${msg}\n`);
};

/**
 * ExecuteTools stage를 생성합니다.
 *
 * 1. 도구 호출을 병렬 그룹으로 분류
 * 2. 파일 수정 전 자동 체크포인트 생성
 * 3. 그룹 내 병렬 실행, 그룹 간 순차 실행
 * 4. 출력 가드레일 적용
 * 5. preflight에서 거부된 결과와 합산
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

        // Execute all calls in the group in parallel
        const settled = await Promise.allSettled(
          group.map(async (call) => {
            let result = await executeToolCall(config.toolRegistry, call, {
              workingDirectory: config.workingDirectory ?? process.cwd(),
              signal: config.signal,
              events: events,
              activeClient: activeClient,
              activeModel: activeModel,
              capabilityTier: getModelCapabilities(activeModel).capabilityTier,
              checkPermission: config.checkPermission,
              checkpointManager: config.checkpointManager,
              sessionId: config.sessionId,
              thinking: config.thinking,
            });

            // Apply output guardrails
            if (config.enableGuardrails !== false) {
              const outputCheck = applyOutputGuardrails(result.output);
              if (outputCheck.modified) {
                result = { ...result, output: outputCheck.modified };
              }
            }

            return result;
          }),
        );

        // Collect results preserving original order
        for (let i = 0; i < group.length; i++) {
          const call = group[i];
          const settledResult = settled[i];
          if (settledResult.status === "fulfilled") {
            const result = settledResult.value;
            results.push(result);
            events.emit("tool:complete", {
              name: call.name,
              id: call.id,
              isError: result.isError,
              output: result.output,
              metadata: result.metadata,
            });
          } else {
            const errorMessage =
              settledResult.reason instanceof Error
                ? settledResult.reason.message
                : String(settledResult.reason);
            const errorResult: ToolCallResult = {
              id: call.id,
              name: call.name,
              output: `Tool execution failed: ${errorMessage}`,
              isError: true,
            };
            results.push(errorResult);
            events.emit("tool:complete", {
              name: call.name,
              id: call.id,
              isError: true,
              output: errorResult.output,
            });
          }
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

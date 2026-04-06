/**
 * ResolveTools Stage — 도구 정의 해석 및 요청 준비
 *
 * Hot tools와 deferred tools를 해석하고,
 * ToolCallStrategy를 사용하여 LLM 요청을 준비합니다.
 *
 * @module core/runtime/stages/resolve-tools
 */

import { type RuntimeStage, type RuntimeContext } from "../types.js";
import { type ToolDefinitionForLLM } from "../../../tools/types.js";
import { type ChatMessage } from "../../../llm/provider.js";
import { type ToolRegistry } from "../../../tools/registry.js";

/**
 * 메시지 히스토리에서 지연 로드(deferred) 도구 스키마를 해석합니다.
 *
 * @param messages - 전체 메시지 히스토리
 * @param registry - 도구 레지스트리
 * @returns 해석된 도구 정의 배열
 */
function resolveDeferredFromHistory(
  messages: readonly ChatMessage[],
  registry: ToolRegistry,
): readonly ToolDefinitionForLLM[] {
  const resolved = new Map<string, ToolDefinitionForLLM>();
  let assistantsSeen = 0;

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== "assistant" || !msg.toolCalls) continue;

    assistantsSeen++;

    for (const tc of msg.toolCalls) {
      if (tc.name.startsWith("mcp__") && !resolved.has(tc.name)) {
        const def = registry.resolveDeferredTool(tc.name);
        if (def) resolved.set(tc.name, def);
      }
    }

    if (assistantsSeen >= 3) break;
  }

  return [...resolved.values()];
}

/**
 * ResolveTools stage를 생성합니다.
 *
 * Deferred mode에서는 hot tools + 최근 사용된 deferred tools만 포함,
 * 일반 mode에서는 전체 도구 정의를 포함합니다.
 *
 * @returns ResolveTools stage 인스턴스
 */
export function createResolveToolsStage(): RuntimeStage {
  return {
    name: "resolve-tools",

    async execute(ctx: RuntimeContext): Promise<void> {
      let toolDefs: readonly ToolDefinitionForLLM[];
      if (ctx.toolRegistry.isDeferredMode) {
        const hotDefs = ctx.toolRegistry.getHotDefinitionsForLLM();
        const resolvedDeferred = resolveDeferredFromHistory(ctx.managedMessages, ctx.toolRegistry);
        toolDefs = [...hotDefs, ...resolvedDeferred];
      } else {
        toolDefs = ctx.toolRegistry.getDefinitionsForLLM();
      }

      ctx.toolDefs = toolDefs;
      const prepared = ctx.strategy.prepareRequest(ctx.managedMessages, toolDefs);
      ctx.preparedMessages = prepared.messages;
      ctx.preparedTools = prepared.tools ?? [];
    },
  };
}

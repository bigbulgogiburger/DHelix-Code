/**
 * ToolRegistry 팩토리 — 빌트인 도구 + 에이전트 도구를 자동 등록
 *
 * @module bootstrap/tool-registry-factory
 */

import { type LLMProvider } from "../llm/provider.js";
import { type ToolCallStrategy } from "../llm/tool-call-strategy.js";
import { type ToolRegistry } from "../tools/registry.js";

export interface ToolRegistryFactoryOptions {
  readonly client: LLMProvider;
  readonly model: string;
  readonly strategy: ToolCallStrategy;
  readonly locale?: string;
  readonly tone?: string;
  readonly isHeadless: boolean;
}

/**
 * ToolRegistry를 생성하고 모든 빌트인 도구를 등록합니다.
 *
 * - builtinTools 배럴에서 25개 도구를 일괄 등록
 * - createAgentTool로 서브에이전트 도구를 런타임 의존성과 함께 등록
 */
export async function createToolRegistry(opts: ToolRegistryFactoryOptions): Promise<ToolRegistry> {
  const [{ ToolRegistry }, { builtinTools, createAgentTool }] = await Promise.all([
    import("../tools/registry.js"),
    import("../tools/builtin-tools.js"),
  ]);

  const toolRegistry = new ToolRegistry();
  toolRegistry.registerAll(builtinTools);

  toolRegistry.register(
    createAgentTool({
      client: opts.client,
      model: opts.model,
      strategy: opts.strategy,
      toolRegistry,
      locale: opts.locale,
      tone: opts.tone,
      isHeadless: opts.isHeadless,
    }),
  );

  return toolRegistry;
}

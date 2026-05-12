/**
 * Phase 6 dogfood driver — Ink UI 없이 슬래시 dispatch + 에이전트 루프를
 * 멀티턴으로 운전하는 헤드리스 하네스.
 *
 * App.tsx의 `handleSubmit` 경로를 충실히 재현한다:
 *   1. 입력이 슬래시면 `commandRegistry.execute`로 직접 dispatch
 *      (`/plasmid`, `/recombination`, `/cure` 등이 정확히 동작)
 *   2. `shouldInjectAsUserMessage` result는 그대로 agent loop에 user message로 주입
 *   3. 일반 발화는 agent loop에 user message로 주입
 *
 * 사용:
 *   const session = await createDriverSession({ workingDirectory: tmp });
 *   const t1 = await session.send("/plasmid list");
 *   const t2 = await session.send("간단한 TS add 함수 작성해줘");
 *   await session.destroy();
 */

import { createEventEmitter, type AppEventEmitter } from "../src/utils/events.js";
import { createHookAdapter } from "../src/hooks/event-emitter-adapter.js";
import { runAgentLoop, type AgentLoopResult } from "../src/core/agent-loop.js";
import { buildSystemPrompt } from "../src/core/system-prompt-builder.js";
import { loadInstructions } from "../src/instructions/loader.js";
import { MemoryManager } from "../src/memory/manager.js";
import { getModelCapabilities } from "../src/llm/model-capabilities.js";
import { createAppContext } from "../src/bootstrap/app-factory.js";
import type { AppContext, CLIOptions } from "../src/bootstrap/types.js";
import type { ChatMessage } from "../src/llm/provider.js";
import type { CommandResult } from "../src/commands/registry.js";

export type DriverTurnKind = "command" | "agent" | "command+agent";

export interface DriverTurnResult {
  readonly kind: DriverTurnKind;
  readonly output: string;
  readonly success: boolean;
  readonly iterations?: number;
  readonly toolCalls?: readonly string[];
  readonly commandResult?: CommandResult;
}

export interface DriverSendOptions {
  readonly maxIterations?: number;
}

export interface DriverSession {
  send(input: string, opts?: DriverSendOptions): Promise<DriverTurnResult>;
  messages(): readonly ChatMessage[];
  ctx(): AppContext;
  destroy(): Promise<void>;
}

export interface CreateDriverOptions {
  readonly workingDirectory?: string;
  readonly modelOverride?: string;
}

export async function createDriverSession(
  opts: CreateDriverOptions = {},
): Promise<DriverSession> {
  const cwd = opts.workingDirectory ?? process.cwd();
  const previousCwd = process.cwd();
  if (cwd !== previousCwd) {
    process.chdir(cwd);
  }

  const cliOpts: CLIOptions = {
    verbose: false,
    outputFormat: "text",
    print: "(driver)",
    ...(opts.modelOverride ? { model: opts.modelOverride } : {}),
  };

  const ctx = await createAppContext(cliOpts);

  const events: AppEventEmitter = createEventEmitter();

  const hookAdapter = createHookAdapter(events, ctx.hookRunner, {
    workingDirectory: cwd,
  });
  hookAdapter.attach();

  // Headless ask_user 자동 응답 — Ink UI가 없는 환경에서 진행을 막지 않도록
  events.on("ask_user:prompt", (data) => {
    const answer = data.choices?.length
      ? String(data.choices[0])
      : "Headless mode: proceed with the most reasonable default. Do not ask further clarifying questions.";
    events.emit("ask_user:response", { toolCallId: data.toolCallId, answer });
  });

  // SystemPrompt + 초기 메시지 (헤드리스 패턴)
  const instructions = await loadInstructions(cwd).catch(() => null);
  const memoryManager = new MemoryManager(cwd);
  const memoryResult = await memoryManager.loadMemory().catch(() => null);
  const autoMemoryContent = memoryResult?.content ?? "";

  const systemPrompt = buildSystemPrompt({
    toolRegistry: ctx.toolRegistry,
    workingDirectory: cwd,
    projectInstructions: instructions?.combined,
    autoMemoryContent: autoMemoryContent || undefined,
    isHeadless: true,
  });

  let messages: ChatMessage[] = [{ role: "system", content: systemPrompt }];

  async function runAgent(
    userInput: string,
    maxIterations?: number,
  ): Promise<{ result: AgentLoopResult; toolCalls: string[] }> {
    const local: ChatMessage[] = [...messages, { role: "user", content: userInput }];
    const toolCalls: string[] = [];
    const onStart = ({ name }: { name: string }): void => {
      toolCalls.push(name);
    };
    events.on("tool:start", onStart);

    const modelCaps = getModelCapabilities(ctx.model);
    try {
      const result = await runAgentLoop(
        {
          client: ctx.client,
          model: ctx.model,
          toolRegistry: ctx.toolRegistry,
          strategy: ctx.strategy,
          events,
          maxIterations: maxIterations ?? 30,
          workingDirectory: cwd,
          maxContextTokens: modelCaps.maxContextTokens,
          maxTokens: modelCaps.maxOutputTokens,
        },
        local,
      );
      messages = [...result.messages];
      return { result, toolCalls };
    } finally {
      events.off("tool:start", onStart);
    }
  }

  return {
    async send(input, sendOpts) {
      const trimmed = input.trim();

      if (ctx.commandRegistry.isCommand(trimmed)) {
        const cmdResult = await ctx.commandRegistry.execute(trimmed, {
          workingDirectory: cwd,
          model: ctx.model,
          emit: events.emit as unknown as (event: string, data?: unknown) => void,
          messages: messages.map((m) => ({
            role: m.role,
            content: typeof m.content === "string" ? m.content : "",
          })),
          mcpManager: ctx.mcpManager,
          commandRegistry: ctx.commandRegistry,
        });

        if (!cmdResult) {
          return { kind: "command", output: "(no command result)", success: false };
        }

        if (cmdResult.shouldInjectAsUserMessage && cmdResult.success) {
          const { result, toolCalls } = await runAgent(
            cmdResult.output,
            sendOpts?.maxIterations,
          );
          const last = result.messages[result.messages.length - 1];
          return {
            kind: "command+agent",
            output: typeof last?.content === "string" ? last.content : "",
            success: true,
            iterations: result.iterations,
            toolCalls,
            commandResult: cmdResult,
          };
        }

        return {
          kind: "command",
          output: cmdResult.output,
          success: cmdResult.success,
          commandResult: cmdResult,
        };
      }

      const { result, toolCalls } = await runAgent(input, sendOpts?.maxIterations);
      const last = result.messages[result.messages.length - 1];
      return {
        kind: "agent",
        output: typeof last?.content === "string" ? last.content : "",
        success: true,
        iterations: result.iterations,
        toolCalls,
      };
    },

    messages() {
      return messages;
    },

    ctx() {
      return ctx;
    },

    async destroy() {
      hookAdapter.detach();
      if (ctx.mcpManager) {
        await ctx.mcpManager.disconnectAll().catch(() => {});
      }
      if (ctx.mcpConnector) {
        await ctx.mcpConnector.disconnectAll().catch(() => {});
      }
      if (cwd !== previousCwd) {
        process.chdir(previousCwd);
      }
    },
  };
}

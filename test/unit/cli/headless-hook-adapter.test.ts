/**
 * DHEL-7 — 헤드리스 경로에서 HookEventAdapter의 라이프사이클 검증.
 *
 * AC: hookRunner가 주입되면 createHookAdapter() + attach()가 호출되고,
 * 세션 종료 시 detach()가 호출된다. hookRunner가 없으면 어댑터를 만들지 않는다.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

// event-emitter-adapter 모듈 자체를 모킹하여 createHookAdapter 호출을 관찰한다.
const attach = vi.fn();
const detach = vi.fn();

vi.mock("../../../src/hooks/event-emitter-adapter.js", () => ({
  createHookAdapter: vi.fn(() => ({
    attach,
    detach,
    get isAttached() {
      return false;
    },
  })),
}));

import { runHeadless } from "../../../src/cli/headless.js";
import { createHookAdapter } from "../../../src/hooks/event-emitter-adapter.js";
import { ToolRegistry } from "../../../src/tools/registry.js";
import { selectStrategy } from "../../../src/llm/tool-call-strategy.js";
import { createMockLLMProvider, mockChatCompletion } from "../../mocks/openai.js";
import type { HookRunner } from "../../../src/hooks/runner.js";

function makeMockRunner(): HookRunner {
  return {
    run: vi.fn().mockResolvedValue(undefined),
  } as unknown as HookRunner;
}

describe("Headless Mode — HookEventAdapter wiring (DHEL-7)", () => {
  let toolRegistry: ToolRegistry;

  beforeEach(() => {
    toolRegistry = new ToolRegistry();
    toolRegistry.register({
      name: "noop",
      description: "noop",
      parameterSchema: z.object({}),
      permissionLevel: "safe",
      execute: async () => ({ output: "", isError: false }),
    });
    vi.clearAllMocks();
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  it("attaches the HookEventAdapter when hookRunner is provided, and detaches on session end", async () => {
    const provider = createMockLLMProvider([mockChatCompletion("done")]);
    const runner = makeMockRunner();

    await runHeadless({
      prompt: "hello",
      client: provider,
      model: "gpt-4o",
      strategy: selectStrategy("gpt-4o"),
      toolRegistry,
      outputFormat: "text",
      sessionId: "sess-dhel7",
      hookRunner: runner,
    });

    expect(createHookAdapter).toHaveBeenCalledTimes(1);
    const [eventsArg, runnerArg, configArg] = vi.mocked(createHookAdapter).mock.calls[0]!;
    expect(eventsArg).toBeDefined();
    expect(runnerArg).toBe(runner);
    expect(configArg).toMatchObject({
      sessionId: "sess-dhel7",
      workingDirectory: expect.any(String),
    });

    expect(attach).toHaveBeenCalledTimes(1);
    expect(detach).toHaveBeenCalledTimes(1);
    // attach가 detach보다 먼저 호출되어야 한다.
    expect(attach.mock.invocationCallOrder[0]!).toBeLessThan(
      detach.mock.invocationCallOrder[0]!,
    );
  });

  it("does not create an adapter when hookRunner is absent", async () => {
    const provider = createMockLLMProvider([mockChatCompletion("done")]);

    await runHeadless({
      prompt: "hello",
      client: provider,
      model: "gpt-4o",
      strategy: selectStrategy("gpt-4o"),
      toolRegistry,
      outputFormat: "text",
    });

    expect(createHookAdapter).not.toHaveBeenCalled();
    expect(attach).not.toHaveBeenCalled();
    expect(detach).not.toHaveBeenCalled();
  });
});

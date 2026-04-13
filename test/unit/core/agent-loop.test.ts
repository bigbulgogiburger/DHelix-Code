import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  runAgentLoop,
  groupToolCalls,
  type AgentLoopConfig,
} from "../../../src/core/agent-loop.js";
import {
  type ChatMessage,
  type ChatResponse,
  type LLMProvider,
  type ChatChunk,
} from "../../../src/llm/provider.js";
import {
  type ToolCallStrategy,
  type PreparedRequest,
} from "../../../src/llm/tool-call-strategy.js";
import { type ToolRegistry } from "../../../src/tools/registry.js";
import { type ExtractedToolCall, type ToolCallResult } from "../../../src/tools/types.js";
import { type AppEventEmitter } from "../../../src/utils/events.js";
import { LLMError } from "../../../src/utils/error.js";

// Mock the ToolPipeline to avoid needing real tool definitions
const mockPipelineExecute = vi.fn().mockResolvedValue({
  results: [],
  rejectedCount: 0,
  executedCount: 0,
  totalTimeMs: 1,
});

vi.mock("../../../src/tools/pipeline.js", () => ({
  ToolPipeline: vi.fn().mockImplementation(() => ({
    execute: (...args: unknown[]) => mockPipelineExecute(...args),
  })),
}));

// Keep backward-compatible alias for tests that reference the old mock name
const mockExecuteToolCall = vi.fn();

// Mock the streaming module
vi.mock("../../../src/llm/streaming.js", () => ({
  consumeStream: vi.fn().mockResolvedValue({
    text: "streamed response",
    toolCalls: [],
    isComplete: true,
  }),
}));

// Mock token counter for deterministic tests
vi.mock("../../../src/llm/token-counter.js", () => ({
  countTokens: vi.fn((text: string) => {
    // Simple mock: 1 token per 4 chars for ASCII, 1 token per 2 chars for CJK
    let tokens = 0;
    for (const ch of text) {
      const code = ch.codePointAt(0) ?? 0;
      if (code > 0x2e80) {
        tokens += 1;
      } else {
        tokens += 0.25;
      }
    }
    return Math.ceil(tokens);
  }),
  estimateTokens: vi.fn(() => 10),
  countMessageTokens: vi.fn(() => 50),
}));

/** Create a mock LLMProvider */
function createMockClient(responses: ChatResponse[]): LLMProvider {
  let callIndex = 0;
  return {
    name: "mock",
    chat: vi.fn(async () => {
      const resp = responses[callIndex];
      if (!resp) {
        throw new Error("No more mock responses");
      }
      callIndex++;
      return resp;
    }),
    stream: vi.fn(async function* (): AsyncIterable<ChatChunk> {
      yield { type: "text-delta", text: "test" };
      yield { type: "done" };
    }),
    countTokens: vi.fn(() => 10),
  };
}

/** Create a mock client that throws errors in sequence, then optionally succeeds */
function createErrorClient(errors: Error[], successResponse?: ChatResponse): LLMProvider {
  let callIndex = 0;
  return {
    name: "mock-error",
    chat: vi.fn(async () => {
      if (callIndex < errors.length) {
        const err = errors[callIndex];
        callIndex++;
        throw err;
      }
      if (successResponse) {
        callIndex++;
        return successResponse;
      }
      throw new Error("No more mock responses");
    }),
    stream: vi.fn(async function* (): AsyncIterable<ChatChunk> {
      yield { type: "done" };
    }),
    countTokens: vi.fn(() => 10),
  };
}

/** Create a mock ToolCallStrategy that returns no tool calls */
function createMockStrategy(): ToolCallStrategy {
  return {
    name: "native",
    prepareRequest: vi.fn(
      (messages: readonly ChatMessage[]): PreparedRequest => ({
        messages,
        tools: [],
      }),
    ),
    extractToolCalls: vi.fn(() => []),
    formatToolResults: vi.fn(() => []),
  };
}

/** Create a mock ToolRegistry */
function createMockRegistry(): ToolRegistry {
  return {
    getDefinitionsForLLM: vi.fn(() => []),
    get: vi.fn(),
    require: vi.fn(),
    has: vi.fn(() => false),
    getNames: vi.fn(() => []),
    getAll: vi.fn(() => []),
    register: vi.fn(),
    registerAll: vi.fn(),
    size: 0,
  } as unknown as ToolRegistry;
}

/** Create a mock event emitter */
function createMockEmitter(): AppEventEmitter {
  return {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    all: new Map(),
  } as unknown as AppEventEmitter;
}

/** Simple non-tool-call response */
const SIMPLE_RESPONSE: ChatResponse = {
  content: "Hello!",
  toolCalls: [],
  usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
  finishReason: "stop",
};

describe("runAgentLoop", () => {
  let strategy: ToolCallStrategy;
  let registry: ToolRegistry;
  let events: AppEventEmitter;

  beforeEach(() => {
    vi.clearAllMocks();
    strategy = createMockStrategy();
    registry = createMockRegistry();
    events = createMockEmitter();
  });

  it("should complete a simple conversation with no tool calls", async () => {
    const client = createMockClient([SIMPLE_RESPONSE]);
    const config: AgentLoopConfig = {
      client,
      model: "gpt-4o",
      toolRegistry: registry,
      strategy,
      events,
    };

    const result = await runAgentLoop(config, [{ role: "user", content: "Hello" }]);

    expect(result.iterations).toBe(1);
    expect(result.aborted).toBe(false);
    expect(result.messages).toHaveLength(2); // user + assistant
    expect(result.messages[1].content).toBe("Hello!");
  });

  describe("error classification and retry behavior", () => {
    it("should NOT retry overload/rate-limit errors at agent-loop level (thrown immediately)", async () => {
      const rateLimitError = new LLMError("Rate limit exceeded. Please wait before retrying.", {
        status: 429,
        retryAfterMs: 5000,
      });

      const client = createErrorClient([rateLimitError]);
      const config: AgentLoopConfig = {
        client,
        model: "gpt-4o",
        toolRegistry: registry,
        strategy,
        events,
        maxRetries: 2,
      };

      await expect(runAgentLoop(config, [{ role: "user", content: "Hi" }])).rejects.toThrow(
        "Rate limit",
      );

      expect(client.chat).toHaveBeenCalledTimes(1);
    });

    it("should classify overload errors (429/capacity) as 'overload' and handle accordingly", async () => {
      const overloadError = new Error("API returned 429: server overloaded");

      const client = createErrorClient([overloadError, overloadError, overloadError]);
      const config: AgentLoopConfig = {
        client,
        model: "gpt-4o",
        toolRegistry: registry,
        strategy,
        events,
        maxRetries: 2,
      };

      await expect(runAgentLoop(config, [{ role: "user", content: "Hi" }])).rejects.toThrow();
    }, 15000);

    it("should retry transient errors at agent-loop level", async () => {
      const transientError = new Error("Connection timeout, request timed out");

      const client = createErrorClient([transientError], SIMPLE_RESPONSE);
      const config: AgentLoopConfig = {
        client,
        model: "gpt-4o",
        toolRegistry: registry,
        strategy,
        events,
        maxRetries: 2,
      };

      const result = await runAgentLoop(config, [{ role: "user", content: "Hi" }]);

      expect(result.iterations).toBe(1);
      expect(result.messages[result.messages.length - 1].content).toBe("Hello!");
      expect(client.chat).toHaveBeenCalledTimes(2);
    }, 15000);

    it("should retry errors with '500' in message as transient", async () => {
      const serverError = new Error("Server returned 500 internal error");

      const client = createErrorClient([serverError], SIMPLE_RESPONSE);
      const config: AgentLoopConfig = {
        client,
        model: "gpt-4o",
        toolRegistry: registry,
        strategy,
        events,
        maxRetries: 2,
      };

      const result = await runAgentLoop(config, [{ role: "user", content: "Hi" }]);

      expect(result.messages[result.messages.length - 1].content).toBe("Hello!");
      expect(client.chat).toHaveBeenCalledTimes(2);
    }, 15000);

    it("should throw permanent errors immediately without retrying", async () => {
      const permanentError = new Error("Invalid request format: missing required field");

      const client = createErrorClient([permanentError]);
      const config: AgentLoopConfig = {
        client,
        model: "gpt-4o",
        toolRegistry: registry,
        strategy,
        events,
        maxRetries: 2,
      };

      await expect(runAgentLoop(config, [{ role: "user", content: "Hi" }])).rejects.toThrow(
        "Invalid request format",
      );

      expect(client.chat).toHaveBeenCalledTimes(1);
    });

    it("should attempt recovery on 'request too large' via compact strategy", async () => {
      const tooLargeError = new Error("Request too large for model context window");
      // Recovery compacts messages and retries; provide a success response for the retry
      const successResponse: ChatResponse = {
        content: "Recovered after compaction",
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "stop",
      };

      const client = createErrorClient([tooLargeError], successResponse);
      const config: AgentLoopConfig = {
        client,
        model: "gpt-4o",
        toolRegistry: registry,
        strategy,
        events,
        maxRetries: 2,
      };

      const result = await runAgentLoop(config, [{ role: "user", content: "Hi" }]);
      // Recovery should have compacted and retried successfully
      expect(result.aborted).toBe(false);
      expect(client.chat).toHaveBeenCalledTimes(2); // 1st fails, recovery compacts, 2nd succeeds
    });

    it("should throw LLMError directly without wrapping (already classified)", async () => {
      const llmError = new LLMError("Authentication failed. Check your API key.", {
        status: 401,
      });

      const client = createErrorClient([llmError]);
      const config: AgentLoopConfig = {
        client,
        model: "gpt-4o",
        toolRegistry: registry,
        strategy,
        events,
        maxRetries: 2,
      };

      await expect(runAgentLoop(config, [{ role: "user", content: "Hi" }])).rejects.toThrow(
        "Authentication failed",
      );

      expect(client.chat).toHaveBeenCalledTimes(1);
    });

    it("should fail after exhausting transient retries", async () => {
      const transientError = new Error("Connection econnreset");

      const client = createErrorClient([transientError, transientError, transientError]);
      const config: AgentLoopConfig = {
        client,
        model: "gpt-4o",
        toolRegistry: registry,
        strategy,
        events,
        maxRetries: 2,
      };

      await expect(runAgentLoop(config, [{ role: "user", content: "Hi" }])).rejects.toThrow();

      expect(client.chat).toHaveBeenCalledTimes(3);
    }, 15000);
  });

  it("should emit agent:assistant-message event for each assistant message", async () => {
    const toolCalls: ExtractedToolCall[] = [
      { id: "tc-1", name: "file_read", arguments: { file_path: "/a.ts" } },
    ];

    const toolResponse: ChatResponse = {
      content: "Let me read that file.",
      toolCalls: [],
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      finishReason: "stop",
    };

    const client = createMockClient([toolResponse, SIMPLE_RESPONSE]);

    let extractCount = 0;
    (strategy.extractToolCalls as ReturnType<typeof vi.fn>).mockImplementation(() => {
      extractCount++;
      return extractCount === 1 ? toolCalls : [];
    });
    (strategy.formatToolResults as ReturnType<typeof vi.fn>).mockReturnValue([
      { role: "tool", content: "file contents" },
    ]);

    mockPipelineExecute.mockResolvedValue({
      results: [
        {
          id: "tc-1",
          name: "file_read",
          output: "file contents",
          isError: false,
        },
      ],
      rejectedCount: 0,
      executedCount: 1,
      totalTimeMs: 1,
    });

    const config: AgentLoopConfig = {
      client,
      model: "gpt-4o",
      toolRegistry: registry,
      strategy,
      events,
    };

    await runAgentLoop(config, [{ role: "user", content: "Read file" }]);

    // Should have emitted agent:assistant-message twice:
    // 1st: intermediate (has tool calls, isFinal=false)
    // 2nd: final (no tool calls, isFinal=true)
    const assistantMessageCalls = (events.emit as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([event]: [string]) => event === "agent:assistant-message",
    );
    expect(assistantMessageCalls).toHaveLength(2);

    // First call: intermediate message
    expect(assistantMessageCalls[0][1]).toEqual({
      content: "Let me read that file.",
      toolCalls: [{ id: "tc-1", name: "file_read" }],
      iteration: 1,
      isFinal: false,
    });

    // Second call: final message
    expect(assistantMessageCalls[1][1]).toEqual({
      content: "Hello!",
      toolCalls: [],
      iteration: 2,
      isFinal: true,
    });
  });

  describe("parallel tool execution", () => {
    it("should execute tool calls via parallel groups", async () => {
      const toolCalls: ExtractedToolCall[] = [
        { id: "tc-1", name: "file_read", arguments: { file_path: "/a.ts" } },
        { id: "tc-2", name: "file_read", arguments: { file_path: "/b.ts" } },
      ];

      // First response has tool calls, second has none
      const toolResponse: ChatResponse = {
        content: "Reading files...",
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "stop",
      };

      const client = createMockClient([toolResponse, SIMPLE_RESPONSE]);

      // Strategy returns tool calls on first invocation, none on second
      let extractCount = 0;
      (strategy.extractToolCalls as ReturnType<typeof vi.fn>).mockImplementation(() => {
        extractCount++;
        return extractCount === 1 ? toolCalls : [];
      });
      (strategy.formatToolResults as ReturnType<typeof vi.fn>).mockReturnValue([
        { role: "tool", content: "result" },
      ]);

      mockPipelineExecute.mockResolvedValue({
        results: toolCalls.map((call) => ({
          id: call.id,
          name: call.name,
          output: `output-${call.id}`,
          isError: false,
        })),
        rejectedCount: 0,
        executedCount: 2,
        totalTimeMs: 1,
      });

      const config: AgentLoopConfig = {
        client,
        model: "gpt-4o",
        toolRegistry: registry,
        strategy,
        events,
      };

      const result = await runAgentLoop(config, [{ role: "user", content: "Read files" }]);

      // Pipeline should have been called with both tool calls
      expect(mockPipelineExecute).toHaveBeenCalledTimes(1);
      expect(result.aborted).toBe(false);
    });

    it("should handle permission denial in parallel group", async () => {
      const toolCalls: ExtractedToolCall[] = [
        { id: "tc-1", name: "file_read", arguments: { file_path: "/a.ts" } },
        { id: "tc-2", name: "file_write", arguments: { file_path: "/b.ts" } },
      ];

      const toolResponse: ChatResponse = {
        content: "Working...",
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "stop",
      };

      const client = createMockClient([toolResponse, SIMPLE_RESPONSE]);

      let extractCount = 0;
      (strategy.extractToolCalls as ReturnType<typeof vi.fn>).mockImplementation(() => {
        extractCount++;
        return extractCount === 1 ? toolCalls : [];
      });
      (strategy.formatToolResults as ReturnType<typeof vi.fn>).mockReturnValue([
        { role: "tool", content: "result" },
      ]);

      // Pipeline receives only the approved call (file_read), not the denied one (file_write)
      mockPipelineExecute.mockResolvedValue({
        results: [
          {
            id: "tc-1",
            name: "file_read",
            output: "output-tc-1",
            isError: false,
          },
        ],
        rejectedCount: 0,
        executedCount: 1,
        totalTimeMs: 1,
      });

      const config: AgentLoopConfig = {
        client,
        model: "gpt-4o",
        toolRegistry: registry,
        strategy,
        events,
        checkPermission: vi.fn(async (call: ExtractedToolCall) => {
          if (call.name === "file_write") {
            return { allowed: false, reason: "User denied" };
          }
          return { allowed: true };
        }),
      };

      await runAgentLoop(config, [{ role: "user", content: "Work" }]);

      // Pipeline should have been called once with only the approved call
      expect(mockPipelineExecute).toHaveBeenCalledTimes(1);
      const pipelineCalls = mockPipelineExecute.mock.calls[0][0] as ExtractedToolCall[];
      expect(pipelineCalls).toHaveLength(1);
      expect(pipelineCalls[0].name).toBe("file_read");

      // formatToolResults should have received 2 results (1 denied + 1 executed)
      const formatCall = (strategy.formatToolResults as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as ToolCallResult[];
      expect(formatCall).toHaveLength(2);
      expect(formatCall.find((r: ToolCallResult) => r.name === "file_write")?.isError).toBe(true);
      expect(formatCall.find((r: ToolCallResult) => r.name === "file_read")?.isError).toBe(false);
    });

    it("should handle Promise.allSettled rejections gracefully", async () => {
      const toolCalls: ExtractedToolCall[] = [
        { id: "tc-1", name: "file_read", arguments: { file_path: "/a.ts" } },
        { id: "tc-2", name: "file_read", arguments: { file_path: "/b.ts" } },
      ];

      const toolResponse: ChatResponse = {
        content: "Reading...",
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "stop",
      };

      const client = createMockClient([toolResponse, SIMPLE_RESPONSE]);

      let extractCount = 0;
      (strategy.extractToolCalls as ReturnType<typeof vi.fn>).mockImplementation(() => {
        extractCount++;
        return extractCount === 1 ? toolCalls : [];
      });
      (strategy.formatToolResults as ReturnType<typeof vi.fn>).mockReturnValue([
        { role: "tool", content: "result" },
      ]);

      // Pipeline returns one success and one error (pipeline handles errors internally)
      mockPipelineExecute.mockResolvedValue({
        results: [
          { id: "tc-1", name: "file_read", output: "ok", isError: false },
          {
            id: "tc-2",
            name: "file_read",
            output: 'Tool "file_read" failed: Unexpected executor crash',
            isError: true,
          },
        ],
        rejectedCount: 0,
        executedCount: 2,
        totalTimeMs: 1,
      });

      const config: AgentLoopConfig = {
        client,
        model: "gpt-4o",
        toolRegistry: registry,
        strategy,
        events,
      };

      // Should not throw - pipeline handles errors internally
      const result = await runAgentLoop(config, [{ role: "user", content: "Read" }]);

      expect(result.aborted).toBe(false);

      // Check that the error result was captured
      const formatCall = (strategy.formatToolResults as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as ToolCallResult[];
      const errorResult = formatCall.find((r: ToolCallResult) => r.isError);
      expect(errorResult).toBeDefined();
      expect(errorResult!.output).toContain("Unexpected executor crash");
    });
  });
});

describe("groupToolCalls", () => {
  it("should return empty array for no tool calls", () => {
    expect(groupToolCalls([])).toEqual([]);
  });

  it("should return single group for one tool call", () => {
    const calls: ExtractedToolCall[] = [
      { id: "1", name: "file_read", arguments: { file_path: "/a.ts" } },
    ];
    const groups = groupToolCalls(calls);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(1);
  });

  it("should group all read-only tools together", () => {
    const calls: ExtractedToolCall[] = [
      { id: "1", name: "file_read", arguments: { file_path: "/a.ts" } },
      { id: "2", name: "glob_search", arguments: { pattern: "*.ts" } },
      { id: "3", name: "grep_search", arguments: { pattern: "foo" } },
      { id: "4", name: "file_read", arguments: { file_path: "/b.ts" } },
    ];
    const groups = groupToolCalls(calls);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(4);
  });

  it("should group bash_exec calls together", () => {
    const calls: ExtractedToolCall[] = [
      { id: "1", name: "bash_exec", arguments: { command: "ls" } },
      { id: "2", name: "bash_exec", arguments: { command: "pwd" } },
    ];
    const groups = groupToolCalls(calls);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(2);
  });

  it("should allow file_write to different paths in same group", () => {
    const calls: ExtractedToolCall[] = [
      { id: "1", name: "file_write", arguments: { file_path: "/a.ts" } },
      { id: "2", name: "file_write", arguments: { file_path: "/b.ts" } },
    ];
    const groups = groupToolCalls(calls);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(2);
  });

  it("should separate file_write to same path into different groups", () => {
    const calls: ExtractedToolCall[] = [
      { id: "1", name: "file_write", arguments: { file_path: "/a.ts" } },
      { id: "2", name: "file_write", arguments: { file_path: "/a.ts" } },
    ];
    const groups = groupToolCalls(calls);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toHaveLength(1);
    expect(groups[1]).toHaveLength(1);
  });

  it("should separate file_edit to same path into different groups", () => {
    const calls: ExtractedToolCall[] = [
      { id: "1", name: "file_edit", arguments: { file_path: "/a.ts" } },
      { id: "2", name: "file_edit", arguments: { file_path: "/a.ts" } },
    ];
    const groups = groupToolCalls(calls);
    expect(groups).toHaveLength(2);
  });

  it("should keep reads parallel with writes to different files", () => {
    const calls: ExtractedToolCall[] = [
      { id: "1", name: "file_read", arguments: { file_path: "/a.ts" } },
      { id: "2", name: "file_write", arguments: { file_path: "/b.ts" } },
      { id: "3", name: "grep_search", arguments: { pattern: "foo" } },
    ];
    const groups = groupToolCalls(calls);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(3);
  });

  it("should handle mixed scenario with conflicting writes", () => {
    const calls: ExtractedToolCall[] = [
      { id: "1", name: "file_read", arguments: { file_path: "/a.ts" } },
      { id: "2", name: "file_write", arguments: { file_path: "/b.ts" } },
      { id: "3", name: "file_edit", arguments: { file_path: "/b.ts" } }, // conflicts with id:2
      { id: "4", name: "file_read", arguments: { file_path: "/c.ts" } },
    ];
    const groups = groupToolCalls(calls);
    // Group 1: [file_read /a.ts, file_write /b.ts]
    // Group 2: [file_edit /b.ts, file_read /c.ts] (file_edit /b.ts conflicts, starts new group)
    expect(groups).toHaveLength(2);
    expect(groups[0]).toHaveLength(2);
    expect(groups[1]).toHaveLength(2);
    expect(groups[0].map((c) => c.id)).toEqual(["1", "2"]);
    expect(groups[1].map((c) => c.id)).toEqual(["3", "4"]);
  });

  it("should handle file_write without a file_path argument", () => {
    const calls: ExtractedToolCall[] = [
      { id: "1", name: "file_write", arguments: { content: "hello" } },
      { id: "2", name: "file_write", arguments: { content: "world" } },
    ];
    const groups = groupToolCalls(calls);
    // Without file_path, these fall through to the unknown tool path
    // and are grouped together
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(2);
  });

  it("should recognize 'path' argument as file path", () => {
    const calls: ExtractedToolCall[] = [
      { id: "1", name: "file_edit", arguments: { path: "/a.ts" } },
      { id: "2", name: "file_edit", arguments: { path: "/a.ts" } },
    ];
    const groups = groupToolCalls(calls);
    expect(groups).toHaveLength(2);
  });
});

describe("MCP tool failure recovery", () => {
  let strategy: ToolCallStrategy;
  let registry: ToolRegistry;
  let events: AppEventEmitter;

  beforeEach(() => {
    vi.clearAllMocks();
    strategy = createMockStrategy();
    registry = createMockRegistry();
    events = createMockEmitter();
  });

  it("should inject recovery guidance when MCP tool fails with timeout", async () => {
    // First response: LLM calls an MCP tool
    const toolCallResponse: ChatResponse = {
      content: "Let me browse the page.",
      toolCalls: [
        {
          id: "tc-mcp-1",
          name: "mcp__playwright__browser_navigate",
          arguments: { url: "https://example.com" },
        },
      ],
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      finishReason: "stop",
    };
    // Second response: LLM responds after seeing the error
    const recoveryResponse: ChatResponse = {
      content: "The MCP tool timed out. Let me try a different approach.",
      toolCalls: [],
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      finishReason: "stop",
    };

    const client = createMockClient([toolCallResponse, recoveryResponse]);

    // Mock pipeline execution to return MCP timeout error
    mockPipelineExecute.mockResolvedValueOnce({
      results: [
        {
          id: "tc-mcp-1",
          name: "mcp__playwright__browser_navigate",
          output: "MCP tool error: Request timed out: tools/call",
          isError: true,
          metadata: { serverName: "playwright", mcpErrorType: "timeout" },
        },
      ],
      rejectedCount: 0,
      executedCount: 1,
      totalTimeMs: 1,
    });

    // Strategy extracts tool calls from first response
    (strategy.extractToolCalls as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce([
        {
          id: "tc-mcp-1",
          name: "mcp__playwright__browser_navigate",
          arguments: { url: "https://example.com" },
        },
      ])
      .mockReturnValueOnce([]);

    // Strategy formats tool results as messages
    (strategy.formatToolResults as ReturnType<typeof vi.fn>).mockReturnValueOnce([
      {
        role: "tool",
        content: "MCP tool error: Request timed out: tools/call",
        tool_call_id: "tc-mcp-1",
      },
    ]);

    const config: AgentLoopConfig = {
      client,
      model: "gpt-4o",
      toolRegistry: registry,
      strategy,
      events,
    };

    const result = await runAgentLoop(config, [{ role: "user", content: "Browse example.com" }]);

    // Should complete in 2 iterations (tool call + recovery)
    expect(result.iterations).toBe(2);

    // Should have injected a system recovery guidance message
    const guidanceMessages = result.messages.filter(
      (m) =>
        m.role === "user" &&
        typeof m.content === "string" &&
        m.content.includes("[System]") &&
        m.content.includes("MCP tool(s) failed"),
    );
    expect(guidanceMessages).toHaveLength(1);
    expect(guidanceMessages[0].content).toContain("timed out");
    expect(guidanceMessages[0].content).toContain("Do NOT retry");
  });

  it("should escalate permission denial after MAX_DENIALS_BEFORE_STOP", async () => {
    // LLM keeps trying the same denied tool
    const toolCallResponse: ChatResponse = {
      content: "Let me try this tool.",
      toolCalls: [{ id: "tc-1", name: "mcp__server__dangerous_tool", arguments: {} }],
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      finishReason: "stop",
    };
    const finalResponse: ChatResponse = {
      content: "I understand, let me try something else.",
      toolCalls: [],
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      finishReason: "stop",
    };

    // 3 attempts: 2 denied + 1 final response
    const client = createMockClient([toolCallResponse, toolCallResponse, finalResponse]);

    (strategy.extractToolCalls as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce([{ id: "tc-1", name: "mcp__server__dangerous_tool", arguments: {} }])
      .mockReturnValueOnce([{ id: "tc-2", name: "mcp__server__dangerous_tool", arguments: {} }])
      .mockReturnValueOnce([]);

    (strategy.formatToolResults as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce([
        { role: "tool", content: "Permission denied: User rejected", tool_call_id: "tc-1" },
      ])
      .mockReturnValueOnce([
        {
          role: "tool",
          content: "Permission denied: User rejected. This tool has been denied 2 times.",
          tool_call_id: "tc-2",
        },
      ]);

    const config: AgentLoopConfig = {
      client,
      model: "gpt-4o",
      toolRegistry: registry,
      strategy,
      events,
      checkPermission: vi.fn(async () => ({ allowed: false, reason: "User rejected" })),
    };

    const result = await runAgentLoop(config, [{ role: "user", content: "Do something" }]);

    expect(result.iterations).toBe(3);

    // Second denial should include "STOP trying" message
    const emitCalls = (events.emit as ReturnType<typeof vi.fn>).mock.calls;
    const toolCompleteEvents = emitCalls.filter(([event]: [string]) => event === "tool:complete");
    // At least one should have the escalated denial message
    const escalated = toolCompleteEvents.find(([, data]: [string, { output: string }]) =>
      data.output.includes("STOP trying"),
    );
    expect(escalated).toBeDefined();
  });
});

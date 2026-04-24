/**
 * Unit tests for `src/recombination/llm-adapter.ts` — `createDefaultLLM`.
 *
 * We mock `OpenAICompatibleClient` so the tests do not hit the network.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDefaultLLM } from "../../../src/recombination/llm-adapter.js";

interface CapturedRequest {
  readonly model: string;
  readonly messages: readonly { readonly role: string; readonly content: string }[];
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly signal?: AbortSignal;
}

const capturedRequests: CapturedRequest[] = [];
const chatResponses: string[] = [];

vi.mock("../../../src/llm/client.js", () => {
  return {
    OpenAICompatibleClient: class {
      // Constructor accepts the config; we record it per-instance.
      constructor(public readonly config: unknown) {}
      async chat(req: CapturedRequest): Promise<{ content: string }> {
        capturedRequests.push(req);
        const next = chatResponses.shift() ?? "default-response";
        return { content: next };
      }
    },
  };
});

beforeEach(() => {
  capturedRequests.length = 0;
  chatResponses.length = 0;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createDefaultLLM", () => {
  it("forwards system + user messages and returns the model response", async () => {
    chatResponses.push("hello world");
    const llm = createDefaultLLM({
      model: "gpt-4o",
      baseURL: "https://api.openai.com/v1",
      apiKey: "key",
    });
    const out = await llm({ system: "sys", user: "usr" });
    expect(out).toBe("hello world");
    expect(capturedRequests).toHaveLength(1);
    const [call] = capturedRequests;
    expect(call!.model).toBe("gpt-4o");
    expect(call!.messages[0]!.role).toBe("system");
    expect(call!.messages[0]!.content).toBe("sys");
    expect(call!.messages[1]!.role).toBe("user");
    expect(call!.messages[1]!.content).toBe("usr");
  });

  it("omits the system message when system is empty", async () => {
    chatResponses.push("ok");
    const llm = createDefaultLLM({ model: "gpt-4o", baseURL: "https://x" });
    await llm({ system: "   ", user: "hi" });
    expect(capturedRequests[0]!.messages).toHaveLength(1);
    expect(capturedRequests[0]!.messages[0]!.role).toBe("user");
  });

  it("appends a JSON-only instruction when jsonMode is requested on a non-native-json model", async () => {
    chatResponses.push("{}");
    // A model without JSON-mode support so preferJsonMode is false.
    const llm = createDefaultLLM({
      model: "some-unknown-model-with-no-json-support",
      baseURL: "https://x",
    });
    await llm({ system: "you are a bot", user: "{}", jsonMode: true });
    const sysContent = capturedRequests[0]!.messages[0]!.content;
    expect(sysContent).toContain("valid JSON");
    expect(sysContent).toContain("Markdown code fences");
  });

  it("throws immediately when the signal is already aborted", async () => {
    const llm = createDefaultLLM({ model: "gpt-4o", baseURL: "https://x" });
    const ac = new AbortController();
    ac.abort();
    await expect(
      llm({ system: "", user: "hi", signal: ac.signal }),
    ).rejects.toThrow(/aborted/);
  });

  it("passes temperature + maxTokens through to the client when provided", async () => {
    chatResponses.push("ok");
    const llm = createDefaultLLM({ model: "gpt-4o", baseURL: "https://x" });
    await llm({ system: "s", user: "u", temperature: 0.3, maxTokens: 128 });
    expect(capturedRequests[0]!.temperature).toBe(0.3);
    expect(capturedRequests[0]!.maxTokens).toBe(128);
  });
});

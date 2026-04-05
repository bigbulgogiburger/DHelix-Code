/**
 * Chat Template 자동 감지 및 적용 단위 테스트
 *
 * detectChatTemplate(), applyTemplate(), formatPromptForModel()의
 * 정확성과 엣지 케이스를 검증합니다.
 */
import { describe, it, expect } from "vitest";
import {
  detectChatTemplate,
  applyTemplate,
  formatPromptForModel,
  CHAT_TEMPLATE_CHATML,
  CHAT_TEMPLATE_LLAMA2,
  CHAT_TEMPLATE_LLAMA3,
  CHAT_TEMPLATE_MISTRAL,
  CHAT_TEMPLATE_ALPACA,
  CHAT_TEMPLATE_PHI,
  CHAT_TEMPLATE_GEMMA,
  CHAT_TEMPLATE_DEEPSEEK,
  CHAT_TEMPLATE_GENERIC,
} from "../../../src/llm/chat-template.js";
import type { ChatMessage } from "../../../src/llm/provider.js";

// ─── detectChatTemplate() 테스트 ─────────────────────────────────────

describe("detectChatTemplate()", () => {
  describe("Llama family", () => {
    it("detects llama3 template for 'llama3'", () => {
      expect(detectChatTemplate("llama3").type).toBe("llama3");
    });

    it("detects llama3 template for 'llama3.1'", () => {
      expect(detectChatTemplate("llama3.1").type).toBe("llama3");
    });

    it("detects llama3 template for 'meta-llama-3-8b'", () => {
      expect(detectChatTemplate("meta-llama-3-8b").type).toBe("llama3");
    });

    it("detects llama2 template for 'llama2'", () => {
      expect(detectChatTemplate("llama2").type).toBe("llama2");
    });

    it("detects llama2 template for 'codellama'", () => {
      expect(detectChatTemplate("codellama").type).toBe("llama2");
    });
  });

  describe("Qwen family", () => {
    it("detects chatml for 'qwen2.5-coder-7b'", () => {
      expect(detectChatTemplate("qwen2.5-coder-7b").type).toBe("chatml");
    });

    it("detects chatml for 'qwen'", () => {
      expect(detectChatTemplate("qwen").type).toBe("chatml");
    });
  });

  describe("Mistral family", () => {
    it("detects mistral template for 'mistral-7b'", () => {
      expect(detectChatTemplate("mistral-7b").type).toBe("mistral");
    });

    it("detects mistral template for 'mixtral-8x7b'", () => {
      expect(detectChatTemplate("mixtral-8x7b").type).toBe("mistral");
    });
  });

  describe("Phi family", () => {
    it("detects phi template for 'phi-3'", () => {
      expect(detectChatTemplate("phi-3").type).toBe("phi");
    });

    it("detects phi template for 'phi2'", () => {
      expect(detectChatTemplate("phi2").type).toBe("phi");
    });
  });

  describe("Gemma family", () => {
    it("detects gemma template for 'gemma2'", () => {
      expect(detectChatTemplate("gemma2").type).toBe("gemma");
    });

    it("detects gemma template for 'gemma-7b'", () => {
      expect(detectChatTemplate("gemma-7b").type).toBe("gemma");
    });
  });

  describe("DeepSeek family", () => {
    it("detects deepseek template for 'deepseek-coder'", () => {
      expect(detectChatTemplate("deepseek-coder").type).toBe("deepseek");
    });

    it("detects deepseek template for 'deepseek-v3'", () => {
      expect(detectChatTemplate("deepseek-v3").type).toBe("deepseek");
    });
  });

  describe("Alpaca/WizardCoder family", () => {
    it("detects alpaca template for 'wizardcoder'", () => {
      expect(detectChatTemplate("wizardcoder").type).toBe("alpaca");
    });

    it("detects alpaca template for 'vicuna'", () => {
      expect(detectChatTemplate("vicuna").type).toBe("alpaca");
    });
  });

  describe("Unknown models", () => {
    it("falls back to generic (chatml) for unknown model", () => {
      expect(detectChatTemplate("unknown-model-xyz").type).toBe("generic");
    });

    it("falls back to generic for empty string", () => {
      expect(detectChatTemplate("").type).toBe("generic");
    });

    it("is case-insensitive", () => {
      expect(detectChatTemplate("LLAMA3").type).toBe("llama3");
      expect(detectChatTemplate("Qwen2").type).toBe("chatml");
    });
  });
});

// ─── ChatTemplate 상수 테스트 ────────────────────────────────────────

describe("ChatTemplate constants", () => {
  it("CHAT_TEMPLATE_CHATML has correct structure", () => {
    expect(CHAT_TEMPLATE_CHATML.type).toBe("chatml");
    expect(CHAT_TEMPLATE_CHATML.userPrefix).toContain("im_start");
    expect(CHAT_TEMPLATE_CHATML.endOfTurn).toBe("<|im_end|>");
  });

  it("CHAT_TEMPLATE_LLAMA2 has correct BOS token", () => {
    expect(CHAT_TEMPLATE_LLAMA2.type).toBe("llama2");
    expect(CHAT_TEMPLATE_LLAMA2.bos).toBe("<s>");
  });

  it("CHAT_TEMPLATE_LLAMA3 has eot_id tokens", () => {
    expect(CHAT_TEMPLATE_LLAMA3.type).toBe("llama3");
    expect(CHAT_TEMPLATE_LLAMA3.endOfTurn).toContain("eot_id");
    expect(CHAT_TEMPLATE_LLAMA3.bos).toBe("<|begin_of_text|>");
  });

  it("CHAT_TEMPLATE_MISTRAL has instruction tokens", () => {
    expect(CHAT_TEMPLATE_MISTRAL.type).toBe("mistral");
    expect(CHAT_TEMPLATE_MISTRAL.userPrefix).toBe("[INST] ");
    expect(CHAT_TEMPLATE_MISTRAL.userSuffix).toBe(" [/INST]");
  });

  it("CHAT_TEMPLATE_ALPACA has markdown headers", () => {
    expect(CHAT_TEMPLATE_ALPACA.type).toBe("alpaca");
    expect(CHAT_TEMPLATE_ALPACA.userPrefix).toContain("###");
    expect(CHAT_TEMPLATE_ALPACA.assistantPrefix).toContain("###");
  });

  it("CHAT_TEMPLATE_PHI uses pipe tokens", () => {
    expect(CHAT_TEMPLATE_PHI.type).toBe("phi");
    expect(CHAT_TEMPLATE_PHI.userPrefix).toContain("<|user|>");
    expect(CHAT_TEMPLATE_PHI.assistantPrefix).toContain("<|assistant|>");
  });

  it("CHAT_TEMPLATE_GEMMA uses turn markers", () => {
    expect(CHAT_TEMPLATE_GEMMA.type).toBe("gemma");
    expect(CHAT_TEMPLATE_GEMMA.userPrefix).toContain("start_of_turn");
    expect(CHAT_TEMPLATE_GEMMA.assistantPrefix).toContain("model");
  });

  it("CHAT_TEMPLATE_DEEPSEEK uses instruction markers", () => {
    expect(CHAT_TEMPLATE_DEEPSEEK.type).toBe("deepseek");
    expect(CHAT_TEMPLATE_DEEPSEEK.userPrefix).toContain("Instruction");
    expect(CHAT_TEMPLATE_DEEPSEEK.assistantSuffix).toContain("EOT");
  });

  it("CHAT_TEMPLATE_GENERIC is based on chatml", () => {
    expect(CHAT_TEMPLATE_GENERIC.type).toBe("generic");
    expect(CHAT_TEMPLATE_GENERIC.userPrefix).toBe(CHAT_TEMPLATE_CHATML.userPrefix);
  });
});

// ─── applyTemplate() 테스트 ──────────────────────────────────────────

describe("applyTemplate()", () => {
  const userMessage: ChatMessage = { role: "user", content: "What is TypeScript?" };
  const systemMessage: ChatMessage = { role: "system", content: "You are a coding assistant." };
  const assistantMessage: ChatMessage = { role: "assistant", content: "TypeScript is a typed superset of JavaScript." };

  describe("ChatML template", () => {
    it("wraps user message with im_start/im_end", () => {
      const result = applyTemplate([userMessage], CHAT_TEMPLATE_CHATML);
      expect(result).toContain("<|im_start|>user\n");
      expect(result).toContain("What is TypeScript?");
      expect(result).toContain("<|im_end|>");
    });

    it("includes system message before user", () => {
      const result = applyTemplate([systemMessage, userMessage], CHAT_TEMPLATE_CHATML);
      expect(result).toContain("<|im_start|>system\n");
      expect(result).toContain("You are a coding assistant.");
      const systemIdx = result.indexOf("system");
      const userIdx = result.indexOf("user");
      expect(systemIdx).toBeLessThan(userIdx);
    });

    it("includes assistant primer at end for user-last conversation", () => {
      const result = applyTemplate([systemMessage, userMessage], CHAT_TEMPLATE_CHATML);
      expect(result).toContain("<|im_start|>assistant\n");
    });

    it("does not add primer when last message is assistant", () => {
      const result = applyTemplate(
        [userMessage, assistantMessage],
        CHAT_TEMPLATE_CHATML,
      );
      // 마지막 어시스턴트 메시지 이후에는 추가 assistant 프라이밍 없음
      const assistantCount = (result.match(/im_start\|>assistant/g) ?? []).length;
      expect(assistantCount).toBe(1);
    });
  });

  describe("Llama3 template", () => {
    it("uses eot_id tokens", () => {
      const result = applyTemplate([userMessage], CHAT_TEMPLATE_LLAMA3);
      expect(result).toContain("<|begin_of_text|>");
      expect(result).toContain("<|start_header_id|>user<|end_header_id|>");
      expect(result).toContain("<|eot_id|>");
    });

    it("adds assistant primer at end", () => {
      const result = applyTemplate([userMessage], CHAT_TEMPLATE_LLAMA3);
      expect(result).toContain("<|start_header_id|>assistant<|end_header_id|>");
    });
  });

  describe("Mistral template", () => {
    it("wraps user message with [INST] tokens", () => {
      const result = applyTemplate([userMessage], CHAT_TEMPLATE_MISTRAL);
      expect(result).toContain("[INST]");
      expect(result).toContain("[/INST]");
    });

    it("prepends system content to first user message", () => {
      const result = applyTemplate([systemMessage, userMessage], CHAT_TEMPLATE_MISTRAL);
      // 시스템 메시지가 사용자 메시지 안으로 합쳐져야 함
      expect(result).toContain("You are a coding assistant.");
      expect(result).toContain("[INST]");
      // 별도의 시스템 블록이 없어야 함
      expect(result).not.toContain("<|im_start|>system");
    });
  });

  describe("Llama2 template", () => {
    it("uses BOS token and SYS block", () => {
      const result = applyTemplate([systemMessage, userMessage], CHAT_TEMPLATE_LLAMA2);
      expect(result).toContain("<s>");
      expect(result).toContain("<<SYS>>");
      expect(result).toContain("<</SYS>>");
      expect(result).toContain("[INST]");
      expect(result).toContain("[/INST]");
    });
  });

  describe("Alpaca template", () => {
    it("uses markdown headers", () => {
      const result = applyTemplate([systemMessage, userMessage], CHAT_TEMPLATE_ALPACA);
      expect(result).toContain("### System:");
      expect(result).toContain("### Instruction:");
      expect(result).toContain("### Response:");
    });
  });

  describe("Tool message handling", () => {
    it("formats tool messages as user messages", () => {
      const toolMessage: ChatMessage = {
        role: "tool",
        content: '{"result": "file contents"}',
        toolCallId: "call_1",
      };
      const result = applyTemplate(
        [userMessage, assistantMessage, toolMessage],
        CHAT_TEMPLATE_CHATML,
      );
      expect(result).toContain("[Tool Result]");
      expect(result).toContain('{"result": "file contents"}');
    });
  });

  describe("Multi-turn conversation", () => {
    it("handles multiple turns correctly", () => {
      const messages: ChatMessage[] = [
        { role: "system", content: "You are helpful." },
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there!" },
        { role: "user", content: "How are you?" },
      ];
      const result = applyTemplate(messages, CHAT_TEMPLATE_CHATML);

      // 2개의 사용자 메시지
      const userCount = (result.match(/im_start\|>user/g) ?? []).length;
      expect(userCount).toBe(2);

      // 마지막 user 이후 어시스턴트 프라이밍
      expect(result.endsWith("<|im_start|>assistant\n")).toBe(true);
    });
  });
});

// ─── formatPromptForModel() 테스트 ───────────────────────────────────

describe("formatPromptForModel()", () => {
  it("combines detectChatTemplate and applyTemplate", () => {
    const messages: ChatMessage[] = [{ role: "user", content: "Hello" }];

    const result = formatPromptForModel(messages, "llama3");
    expect(result).toContain("<|begin_of_text|>");
    expect(result).toContain("Hello");
  });

  it("uses chatml for qwen models", () => {
    const messages: ChatMessage[] = [{ role: "user", content: "Hi" }];
    const result = formatPromptForModel(messages, "qwen2.5-coder-32b");
    expect(result).toContain("<|im_start|>user");
  });

  it("returns non-empty string for any input", () => {
    const messages: ChatMessage[] = [{ role: "user", content: "test" }];
    const result = formatPromptForModel(messages, "unknown-model");
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain("test");
  });
});

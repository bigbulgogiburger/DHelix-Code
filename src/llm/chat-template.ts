/**
 * Chat Template 자동 감지 및 적용 — 로컬 모델별 프롬프트 포맷 처리
 *
 * 로컬 LLM 모델은 각자 다른 채팅 템플릿(chat template) 형식을 사용합니다.
 * OpenAI 호환 API는 자동으로 처리하지만, raw 프롬프트가 필요한 경우
 * (예: Ollama /api/generate, 직접 GGUF 로딩) 이 모듈을 사용합니다.
 *
 * 지원 템플릿:
 * - ChatML: Qwen, Mistral-Nemo, 일부 코드 모델 (im_start/im_end 태그)
 * - Llama: Llama 2/3 계열 ([INST]/[/INST] 태그)
 * - Llama3: Llama 3.x 전용 (|im_start|/|eot_id| 태그)
 * - Mistral: Mistral 7B/Mixtral ([INST]/[/INST], BOS/EOS)
 * - Alpaca: WizardCoder, Vicuna 계열 (### Instruction 형식)
 * - Phi: Microsoft Phi 계열 (<|user|>/<|assistant|> 태그)
 * - Gemma: Google Gemma 계열 (<start_of_turn>/<end_of_turn> 태그)
 * - Deepseek: DeepSeek Coder 계열 (### Instruction 형식 변형)
 * - Generic: 알 수 없는 모델 — ChatML로 폴백
 */
import type { ChatMessage } from "./provider.js";

// ─── 템플릿 유형 ─────────────────────────────────────────────────────

/** 지원하는 채팅 템플릿 유형 */
export type ChatTemplateType =
  | "chatml"
  | "llama2"
  | "llama3"
  | "mistral"
  | "alpaca"
  | "phi"
  | "gemma"
  | "deepseek"
  | "generic";

// ─── ChatTemplate 인터페이스 ─────────────────────────────────────────

/**
 * 채팅 템플릿 정의 — 로컬 모델의 프롬프트 포맷을 설명하는 구조체
 *
 * 각 필드는 메시지 역할(system/user/assistant)에 해당하는
 * 시작 토큰, 종료 토큰을 정의합니다.
 */
export interface ChatTemplate {
  /** 템플릿 유형 식별자 */
  readonly type: ChatTemplateType;
  /** 시스템 메시지 시작 토큰 */
  readonly systemPrefix: string;
  /** 시스템 메시지 종료 토큰 */
  readonly systemSuffix: string;
  /** 사용자 메시지 시작 토큰 */
  readonly userPrefix: string;
  /** 사용자 메시지 종료 토큰 */
  readonly userSuffix: string;
  /** 어시스턴트 응답 시작 토큰 */
  readonly assistantPrefix: string;
  /** 어시스턴트 응답 종료 토큰 */
  readonly assistantSuffix: string;
  /**
   * 턴 종료 토큰 — 각 대화 턴의 마지막에 삽입
   * (일부 모델은 별도의 EOS 토큰을 사용)
   */
  readonly endOfTurn: string;
  /** 전체 프롬프트 앞에 붙는 BOS(Begin Of Sequence) 토큰 */
  readonly bos: string;
}

// ─── 사전 정의 템플릿 ────────────────────────────────────────────────

/**
 * ChatML 템플릿 — Qwen, OpenHermes, 일부 Mistral 파인튜닝 모델
 *
 * 형식:
 * <|im_start|>system\n{내용}<|im_end|>\n
 * <|im_start|>user\n{내용}<|im_end|>\n
 * <|im_start|>assistant\n
 */
export const CHAT_TEMPLATE_CHATML: ChatTemplate = {
  type: "chatml",
  systemPrefix: "<|im_start|>system\n",
  systemSuffix: "<|im_end|>\n",
  userPrefix: "<|im_start|>user\n",
  userSuffix: "<|im_end|>\n",
  assistantPrefix: "<|im_start|>assistant\n",
  assistantSuffix: "<|im_end|>\n",
  endOfTurn: "<|im_end|>",
  bos: "",
};

/**
 * Llama 2 템플릿 — Llama 2, Code Llama 계열
 *
 * 형식:
 * <s>[INST] <<SYS>>\n{시스템}\n<</SYS>>\n\n{사용자} [/INST] {어시스턴트} </s>
 */
export const CHAT_TEMPLATE_LLAMA2: ChatTemplate = {
  type: "llama2",
  systemPrefix: "<<SYS>>\n",
  systemSuffix: "\n<</SYS>>\n\n",
  userPrefix: "[INST] ",
  userSuffix: " [/INST]",
  assistantPrefix: " ",
  assistantSuffix: " </s>",
  endOfTurn: "</s>",
  bos: "<s>",
};

/**
 * Llama 3 템플릿 — Llama 3.x, Meta-Llama-3 계열
 *
 * 형식:
 * <|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n{시스템}<|eot_id|>
 * <|start_header_id|>user<|end_header_id|>\n\n{사용자}<|eot_id|>
 * <|start_header_id|>assistant<|end_header_id|>\n\n
 */
export const CHAT_TEMPLATE_LLAMA3: ChatTemplate = {
  type: "llama3",
  systemPrefix: "<|start_header_id|>system<|end_header_id|>\n\n",
  systemSuffix: "<|eot_id|>\n",
  userPrefix: "<|start_header_id|>user<|end_header_id|>\n\n",
  userSuffix: "<|eot_id|>\n",
  assistantPrefix: "<|start_header_id|>assistant<|end_header_id|>\n\n",
  assistantSuffix: "<|eot_id|>\n",
  endOfTurn: "<|eot_id|>",
  bos: "<|begin_of_text|>",
};

/**
 * Mistral 템플릿 — Mistral 7B, Mixtral 계열
 *
 * 형식:
 * <s>[INST] {사용자} [/INST]{어시스턴트}</s>
 * (시스템 메시지는 첫 번째 사용자 메시지 앞에 합쳐짐)
 */
export const CHAT_TEMPLATE_MISTRAL: ChatTemplate = {
  type: "mistral",
  systemPrefix: "",
  systemSuffix: "\n\n",
  userPrefix: "[INST] ",
  userSuffix: " [/INST]",
  assistantPrefix: "",
  assistantSuffix: "</s>",
  endOfTurn: "</s>",
  bos: "<s>",
};

/**
 * Alpaca 템플릿 — WizardCoder, Vicuna, Alpaca 파인튜닝 모델
 *
 * 형식:
 * ### System:\n{시스템}\n\n### Instruction:\n{사용자}\n\n### Response:\n
 */
export const CHAT_TEMPLATE_ALPACA: ChatTemplate = {
  type: "alpaca",
  systemPrefix: "### System:\n",
  systemSuffix: "\n\n",
  userPrefix: "### Instruction:\n",
  userSuffix: "\n\n",
  assistantPrefix: "### Response:\n",
  assistantSuffix: "\n\n",
  endOfTurn: "\n\n",
  bos: "",
};

/**
 * Phi 템플릿 — Microsoft Phi-2, Phi-3 계열
 *
 * 형식:
 * <|system|>\n{시스템}<|end|>\n<|user|>\n{사용자}<|end|>\n<|assistant|>\n
 */
export const CHAT_TEMPLATE_PHI: ChatTemplate = {
  type: "phi",
  systemPrefix: "<|system|>\n",
  systemSuffix: "<|end|>\n",
  userPrefix: "<|user|>\n",
  userSuffix: "<|end|>\n",
  assistantPrefix: "<|assistant|>\n",
  assistantSuffix: "<|end|>\n",
  endOfTurn: "<|end|>",
  bos: "",
};

/**
 * Gemma 템플릿 — Google Gemma 계열
 *
 * 형식:
 * <start_of_turn>user\n{사용자}<end_of_turn>\n<start_of_turn>model\n
 */
export const CHAT_TEMPLATE_GEMMA: ChatTemplate = {
  type: "gemma",
  systemPrefix: "",
  systemSuffix: "\n",
  userPrefix: "<start_of_turn>user\n",
  userSuffix: "<end_of_turn>\n",
  assistantPrefix: "<start_of_turn>model\n",
  assistantSuffix: "<end_of_turn>\n",
  endOfTurn: "<end_of_turn>",
  bos: "<bos>",
};

/**
 * DeepSeek 템플릿 — DeepSeek Coder, DeepSeek Chat 계열
 *
 * 형식:
 * {시스템}\n### Instruction:\n{사용자}\n### Response:\n
 */
export const CHAT_TEMPLATE_DEEPSEEK: ChatTemplate = {
  type: "deepseek",
  systemPrefix: "",
  systemSuffix: "\n",
  userPrefix: "### Instruction:\n",
  userSuffix: "\n",
  assistantPrefix: "### Response:\n",
  assistantSuffix: "\n<|EOT|>\n",
  endOfTurn: "<|EOT|>",
  bos: "",
};

/**
 * Generic 템플릿 — 알 수 없는 모델에 적용되는 기본 템플릿 (ChatML 폴백)
 */
export const CHAT_TEMPLATE_GENERIC: ChatTemplate = { ...CHAT_TEMPLATE_CHATML, type: "generic" };

// ─── 모델 이름 → 템플릿 매핑 ─────────────────────────────────────────

/**
 * 모델 이름 패턴으로 적절한 채팅 템플릿을 추론하는 매핑 테이블
 *
 * 배열 순서가 중요합니다 — 더 구체적인 패턴을 먼저 배치하세요.
 */
const MODEL_TEMPLATE_PATTERNS: ReadonlyArray<[RegExp, ChatTemplate]> = [
  // Llama 3.x (llama3 앞에 배치해야 함)
  [/llama[-_]?3[._\-]?\d/i, CHAT_TEMPLATE_LLAMA3],
  [/llama[-_]?3(?!\.\d)/i, CHAT_TEMPLATE_LLAMA3],
  // Llama 2
  [/llama[-_]?2/i, CHAT_TEMPLATE_LLAMA2],
  // Code Llama — Llama2 기반
  [/codellama/i, CHAT_TEMPLATE_LLAMA2],
  // Qwen — ChatML 사용
  [/qwen/i, CHAT_TEMPLATE_CHATML],
  // DeepSeek
  [/deepseek/i, CHAT_TEMPLATE_DEEPSEEK],
  // Mistral / Mixtral
  [/mi[xs]tral/i, CHAT_TEMPLATE_MISTRAL],
  // WizardCoder, WizardLM — Alpaca 기반
  [/wizard/i, CHAT_TEMPLATE_ALPACA],
  // Vicuna, Alpaca
  [/vicuna|alpaca/i, CHAT_TEMPLATE_ALPACA],
  // Phi
  [/phi/i, CHAT_TEMPLATE_PHI],
  // Gemma
  [/gemma/i, CHAT_TEMPLATE_GEMMA],
  // OpenHermes, Hermes — ChatML
  [/hermes/i, CHAT_TEMPLATE_CHATML],
  // Neural-Chat — ChatML
  [/neural[-_]?chat/i, CHAT_TEMPLATE_CHATML],
  // Starling — ChatML 기반
  [/starling/i, CHAT_TEMPLATE_CHATML],
  // Yi — ChatML
  [/\byi\b/i, CHAT_TEMPLATE_CHATML],
  // Orca — ChatML
  [/orca/i, CHAT_TEMPLATE_CHATML],
];

// ─── 공개 API ─────────────────────────────────────────────────────────

/**
 * 모델 이름으로 적절한 채팅 템플릿을 자동 감지
 *
 * 모델 이름 패턴으로 템플릿을 추론합니다.
 * 알 수 없는 모델은 ChatML(generic) 템플릿으로 폴백합니다.
 *
 * @param modelName - 모델 이름 (예: "llama3", "qwen2.5-coder", "mistral")
 * @returns 해당 모델에 적합한 ChatTemplate
 *
 * @example
 * ```typescript
 * const template = detectChatTemplate("llama3");
 * // → CHAT_TEMPLATE_LLAMA3
 *
 * const template = detectChatTemplate("qwen2.5-coder-7b");
 * // → CHAT_TEMPLATE_CHATML
 * ```
 */
export function detectChatTemplate(modelName: string): ChatTemplate {
  const normalized = modelName.toLowerCase();

  for (const [pattern, template] of MODEL_TEMPLATE_PATTERNS) {
    if (pattern.test(normalized)) {
      return template;
    }
  }

  // 알 수 없는 모델 — ChatML로 폴백
  return CHAT_TEMPLATE_GENERIC;
}

/**
 * 채팅 메시지 배열을 지정된 템플릿에 따라 raw 프롬프트 문자열로 변환
 *
 * OpenAI 호환 API 대신 raw 프롬프트가 필요한 경우 사용합니다.
 * (예: Ollama /api/generate 엔드포인트, 직접 GGUF 모델 로딩)
 *
 * @param messages - 변환할 채팅 메시지 배열
 * @param template - 사용할 채팅 템플릿
 * @returns raw 프롬프트 문자열
 *
 * @example
 * ```typescript
 * const template = detectChatTemplate("llama3");
 * const prompt = applyTemplate([
 *   { role: "system", content: "You are a helpful assistant." },
 *   { role: "user", content: "Hello!" },
 * ], template);
 * ```
 */
export function applyTemplate(messages: readonly ChatMessage[], template: ChatTemplate): string {
  let prompt = template.bos;
  let systemContent: string | undefined;

  // 시스템 메시지를 먼저 분리
  const nonSystemMessages: ChatMessage[] = [];
  for (const msg of messages) {
    if (msg.role === "system") {
      systemContent = msg.content;
    } else {
      nonSystemMessages.push(msg);
    }
  }

  // Mistral 템플릿은 시스템 메시지를 첫 번째 사용자 메시지 앞에 합침
  if (template.type === "mistral" && systemContent !== undefined) {
    const firstUserIdx = nonSystemMessages.findIndex((m) => m.role === "user");
    if (firstUserIdx !== -1) {
      nonSystemMessages[firstUserIdx] = {
        ...nonSystemMessages[firstUserIdx],
        content: `${systemContent}\n\n${nonSystemMessages[firstUserIdx]!.content}`,
      };
    }
    systemContent = undefined;
  }

  // Llama2 템플릿은 시스템 메시지를 첫 번째 사용자 메시지 안에 합침
  if (template.type === "llama2" && systemContent !== undefined) {
    const firstUserIdx = nonSystemMessages.findIndex((m) => m.role === "user");
    if (firstUserIdx !== -1) {
      const sysBlock = `${template.systemPrefix}${systemContent}${template.systemSuffix}`;
      nonSystemMessages[firstUserIdx] = {
        ...nonSystemMessages[firstUserIdx],
        content: `${sysBlock}${nonSystemMessages[firstUserIdx]!.content}`,
      };
    }
    systemContent = undefined;
  }

  // 시스템 메시지 삽입 (Llama2/Mistral이 아닌 경우)
  if (systemContent !== undefined) {
    prompt += `${template.systemPrefix}${systemContent}${template.systemSuffix}`;
  }

  // 나머지 메시지 처리
  for (const msg of nonSystemMessages) {
    switch (msg.role) {
      case "user":
        prompt += `${template.userPrefix}${msg.content}${template.userSuffix}`;
        break;
      case "assistant":
        prompt += `${template.assistantPrefix}${msg.content}${template.assistantSuffix}`;
        break;
      case "tool":
        // 도구 응답은 사용자 메시지로 처리
        prompt += `${template.userPrefix}[Tool Result] ${msg.content}${template.userSuffix}`;
        break;
      default:
        break;
    }
  }

  // 어시스턴트 응답 프라이밍 (마지막 메시지가 user인 경우)
  const lastNonSystem = nonSystemMessages[nonSystemMessages.length - 1];
  if (lastNonSystem?.role === "user" || lastNonSystem?.role === "tool") {
    prompt += template.assistantPrefix;
  }

  return prompt;
}

/**
 * 모델 이름으로 템플릿을 감지하고 즉시 메시지에 적용하는 편의 함수
 *
 * @param messages - 변환할 채팅 메시지 배열
 * @param modelName - 모델 이름 (템플릿 자동 감지에 사용)
 * @returns raw 프롬프트 문자열
 */
export function formatPromptForModel(messages: readonly ChatMessage[], modelName: string): string {
  const template = detectChatTemplate(modelName);
  return applyTemplate(messages, template);
}

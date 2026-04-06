/**
 * AWS Bedrock 프로바이더 — Amazon Bedrock Runtime과 통신하는 클라이언트
 *
 * Amazon Bedrock Runtime API를 활용하여
 * Claude (via Bedrock), Amazon Nova 등의 모델과 통신합니다.
 *
 * 주요 기능:
 * - OpenAI 호환 Converse API (비스트리밍/스트리밍)
 * - AWS Signature V4 서명 (외부 SDK 없이 직접 구현, HMAC-SHA256 체인)
 * - 도구 호출 (function calling) 지원
 * - 자동 재시도 (일시적 에러 + Rate Limit)
 * - 스트리밍 유휴 타임아웃
 *
 * 인증:
 *   DHELIX_AWS_ACCESS_KEY_ID → AWS_ACCESS_KEY_ID
 *   DHELIX_AWS_SECRET_ACCESS_KEY → AWS_SECRET_ACCESS_KEY
 *   DHELIX_AWS_REGION → AWS_DEFAULT_REGION → us-east-1
 * Base URL: https://bedrock-runtime.{region}.amazonaws.com
 */
import type {
  ChatRequest,
  ChatResponse,
  ChatChunk,
  ChatMessage,
  ToolCallRequest,
  ToolDefinitionForLLM,
} from "../provider.js";
import type {
  UnifiedLLMProvider,
  ProviderManifest,
  ProviderHealthStatus,
  CostEstimate,
} from "./types.js";
import type { TokenUsage } from "../provider.js";
import { LLMError } from "../../utils/error.js";
import { countTokens } from "../token-counter.js";
import { createHmac, createHash } from "node:crypto";

// ─── 재시도 관련 상수 ────────────────────────────────────────────────

/** 일시적 에러(500, 502, 503)에 대한 최대 재시도 횟수 */
const MAX_RETRIES_TRANSIENT = 3;

/** Rate Limit(429) 에러에 대한 최대 재시도 횟수 */
const MAX_RETRIES_RATE_LIMIT = 5;

/** 일시적 에러 재시도 시 기본 대기 시간 (1초) */
const BASE_RETRY_DELAY_MS = 1_000;

/** Rate Limit 에러 재시도 시 기본 대기 시간 (5초) */
const BASE_RATE_LIMIT_DELAY_MS = 5_000;

/** Rate Limit 백오프 최대 대기 시간 (60초) */
const MAX_RATE_LIMIT_DELAY_MS = 60_000;

/** 스트리밍 청크 간 타임아웃 (30초) */
const STREAM_CHUNK_TIMEOUT_MS = 30_000;

// ─── 매니페스트 ──────────────────────────────────────────────────────

/**
 * AWS Bedrock 프로바이더 매니페스트
 *
 * Claude 3.5 Sonnet (via Bedrock), Amazon Nova Pro/Lite 모델의 메타데이터를 정의합니다.
 * 가격은 100만 토큰당 USD 기준입니다.
 */
export const AWS_BEDROCK_MANIFEST: ProviderManifest = {
  id: "aws-bedrock",
  displayName: "AWS Bedrock",
  authType: "iam",
  modelPatterns: [/^(bedrock-|aws-|nova-)/i],
  models: [
    {
      id: "bedrock-claude-3.5-sonnet",
      tier: "high",
      context: 200_000,
      pricing: { input: 3, output: 15 },
    },
    {
      id: "bedrock-claude-3-haiku",
      tier: "medium",
      context: 200_000,
      pricing: { input: 0.25, output: 1.25 },
    },
    {
      id: "nova-pro",
      tier: "high",
      context: 300_000,
      pricing: { input: 0.8, output: 3.2 },
    },
    {
      id: "nova-lite",
      tier: "low",
      context: 300_000,
      pricing: { input: 0.06, output: 0.24 },
    },
    {
      id: "nova-micro",
      tier: "low",
      context: 128_000,
      pricing: { input: 0.035, output: 0.14 },
    },
  ],
  features: {
    supportsCaching: false,
    supportsGrounding: false,
    supportsImageInput: true,
    supportsReasoningTrace: false,
    maxConcurrentRequests: 50,
    rateLimitStrategy: "token-bucket",
  },
};

// ─── 자격증명 조회 ───────────────────────────────────────────────────

/**
 * AWS 자격증명을 환경변수에서 조회
 *
 * 우선순위:
 *   - accessKeyId: DHELIX_AWS_ACCESS_KEY_ID → AWS_ACCESS_KEY_ID
 *   - secretAccessKey: DHELIX_AWS_SECRET_ACCESS_KEY → AWS_SECRET_ACCESS_KEY
 *   - region: DHELIX_AWS_REGION → AWS_DEFAULT_REGION → us-east-1
 *
 * @returns AWS 자격증명 객체 또는 undefined
 */
export function resolveBedrockCredentials(): {
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly region: string;
} | undefined {
  const accessKeyId =
    process.env["DHELIX_AWS_ACCESS_KEY_ID"] ?? process.env["AWS_ACCESS_KEY_ID"];
  const secretAccessKey =
    process.env["DHELIX_AWS_SECRET_ACCESS_KEY"] ?? process.env["AWS_SECRET_ACCESS_KEY"];

  if (!accessKeyId || !secretAccessKey) return undefined;

  const region =
    process.env["DHELIX_AWS_REGION"] ??
    process.env["AWS_DEFAULT_REGION"] ??
    "us-east-1";

  return { accessKeyId, secretAccessKey, region };
}

// ─── AWS Signature V4 구현 ───────────────────────────────────────────

/**
 * HMAC-SHA256 해시를 계산
 *
 * @param key - 서명 키 (Buffer 또는 string)
 * @param data - 서명할 데이터
 * @returns HMAC-SHA256 결과 Buffer
 */
function hmacSha256(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

/**
 * SHA-256 해시를 계산하여 hex 문자열로 반환
 *
 * @param data - 해시할 데이터
 * @returns SHA-256 hex 문자열
 */
function sha256Hex(data: string): string {
  return createHash("sha256").update(data, "utf8").digest("hex");
}

/**
 * AWS Signature V4 서명 헤더를 생성
 *
 * AWS SigV4 서명 절차:
 * 1. Canonical Request 생성
 * 2. String to Sign 생성
 * 3. Signing Key 파생 (HMAC 체인)
 * 4. Signature 계산
 * 5. Authorization 헤더 조합
 *
 * @param params - 서명에 필요한 파라미터
 * @returns Authorization, x-amz-date, x-amz-content-sha256 헤더
 */
function buildSigV4Headers(params: {
  readonly method: string;
  readonly url: string;
  readonly body: string;
  readonly service: string;
  readonly region: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
}): Record<string, string> {
  const { method, url, body, service, region, accessKeyId, secretAccessKey } = params;

  const parsedUrl = new URL(url);
  const now = new Date();

  // ISO 8601 형식: 20240101T000000Z
  const amzDate = now.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  // 날짜만: 20240101
  const dateStamp = amzDate.slice(0, 8);

  const payloadHash = sha256Hex(body);

  // 정렬된 헤더 목록
  const canonicalHeaders =
    `content-type:application/json\n` +
    `host:${parsedUrl.host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;

  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";

  // Canonical Request
  const canonicalRequest = [
    method,
    parsedUrl.pathname,
    parsedUrl.search.replace(/^\?/, "") || "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  // Credential Scope
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

  // String to Sign
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  // Signing Key 파생 (HMAC 체인)
  const kDate = hmacSha256(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  const kSigning = hmacSha256(kService, "aws4_request");

  // Signature
  const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");

  // Authorization 헤더
  const authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, ` +
    `Signature=${signature}`;

  return {
    "Content-Type": "application/json",
    "x-amz-date": amzDate,
    "x-amz-content-sha256": payloadHash,
    Authorization: authorization,
  };
}

// ─── 메시지 변환 ─────────────────────────────────────────────────────

/** Bedrock Converse API 메시지 형식 */
interface BedrockMessage {
  readonly role: "user" | "assistant";
  readonly content: readonly BedrockContentBlock[];
}

interface BedrockContentBlock {
  readonly text?: string;
  readonly toolUse?: {
    readonly toolUseId: string;
    readonly name: string;
    readonly input: Record<string, unknown>;
  };
  readonly toolResult?: {
    readonly toolUseId: string;
    readonly content: readonly { readonly text: string }[];
  };
}

/**
 * 내부 ChatMessage를 Bedrock Converse API 형식으로 변환
 *
 * @param messages - 내부 ChatMessage 배열
 * @returns Bedrock 메시지 배열과 시스템 프롬프트
 */
function toBedrockMessages(messages: readonly ChatMessage[]): {
  readonly system?: string;
  readonly messages: readonly BedrockMessage[];
} {
  const systemMsgs = messages.filter((m) => m.role === "system");
  const otherMsgs = messages.filter((m) => m.role !== "system");

  const system = systemMsgs.map((m) => m.content).join("\n") || undefined;

  const converted: BedrockMessage[] = [];

  for (const msg of otherMsgs) {
    if (msg.role === "user") {
      converted.push({ role: "user", content: [{ text: msg.content }] });
    } else if (msg.role === "assistant") {
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        const content: BedrockContentBlock[] = [];
        if (msg.content) {
          content.push({ text: msg.content });
        }
        for (const tc of msg.toolCalls) {
          let input: Record<string, unknown> = {};
          try {
            const parsed: unknown = JSON.parse(tc.arguments);
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
              input = parsed as Record<string, unknown>;
            }
          } catch {
            // 파싱 실패 시 빈 객체 사용
          }
          content.push({
            toolUse: { toolUseId: tc.id, name: tc.name, input },
          });
        }
        converted.push({ role: "assistant", content });
      } else {
        converted.push({
          role: "assistant",
          content: [{ text: msg.content }],
        });
      }
    } else if (msg.role === "tool") {
      converted.push({
        role: "user",
        content: [
          {
            toolResult: {
              toolUseId: msg.toolCallId ?? "",
              content: [{ text: msg.content }],
            },
          },
        ],
      });
    }
  }

  return { system, messages: converted };
}

/**
 * 내부 도구 정의를 Bedrock Converse 형식으로 변환
 *
 * @param tools - 내부 도구 정의 배열
 * @returns Bedrock 도구 설정
 */
function toBedrockTools(tools: readonly ToolDefinitionForLLM[]): {
  readonly tools: readonly {
    readonly toolSpec: {
      readonly name: string;
      readonly description: string;
      readonly inputSchema: { readonly json: Record<string, unknown> };
    };
  }[];
} {
  return {
    tools: tools.map((t) => ({
      toolSpec: {
        name: t.function.name,
        description: t.function.description ?? "",
        inputSchema: {
          json: t.function.parameters as Record<string, unknown>,
        },
      },
    })),
  };
}

// ─── Bedrock 응답 타입 ───────────────────────────────────────────────

interface BedrockConverseResponse {
  readonly output?: {
    readonly message?: {
      readonly role: string;
      readonly content?: readonly {
        readonly text?: string;
        readonly toolUse?: {
          readonly toolUseId: string;
          readonly name: string;
          readonly input?: Record<string, unknown>;
        };
      }[];
    };
  };
  readonly usage?: {
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly totalTokens: number;
  };
  readonly stopReason?: string;
}

// ─── 재시도 헬퍼 ─────────────────────────────────────────────────────

/**
 * 에러 유형에 따른 재시도 가능 여부와 지연 시간 결정
 */
function getRetryInfo(
  status: number,
  attempt: number,
): { readonly delayMs: number } | null {
  if (status === 429) {
    if (attempt >= MAX_RETRIES_RATE_LIMIT) return null;
    const delay = Math.min(
      BASE_RATE_LIMIT_DELAY_MS * Math.pow(2, attempt),
      MAX_RATE_LIMIT_DELAY_MS,
    );
    return { delayMs: delay };
  }
  if (status >= 500 && status <= 503) {
    if (attempt >= MAX_RETRIES_TRANSIENT) return null;
    const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
    return { delayMs: delay };
  }
  return null;
}

/**
 * 지정된 시간만큼 대기 (AbortSignal 지원)
 */
async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new LLMError("Request aborted"));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new LLMError("Request aborted"));
      },
      { once: true },
    );
  });
}

// ─── BedrockModelId 헬퍼 ────────────────────────────────────────────

/**
 * 내부 모델 ID를 Bedrock API 모델 ID로 변환
 *
 * - "bedrock-claude-3.5-sonnet" → "anthropic.claude-3-5-sonnet-20241022-v2:0"
 * - "bedrock-claude-3-haiku" → "anthropic.claude-3-haiku-20240307-v1:0"
 * - "nova-pro" → "amazon.nova-pro-v1:0"
 * - "nova-lite" → "amazon.nova-lite-v1:0"
 * - "nova-micro" → "amazon.nova-micro-v1:0"
 * - 기타 모든 값 → 그대로 통과 (커스텀 ARN 등)
 *
 * @param modelId - 내부 모델 ID
 * @returns Bedrock API 모델 ID
 */
function resolveBedrockModelId(modelId: string): string {
  const mapping: Record<string, string> = {
    "bedrock-claude-3.5-sonnet": "anthropic.claude-3-5-sonnet-20241022-v2:0",
    "bedrock-claude-3-haiku": "anthropic.claude-3-haiku-20240307-v1:0",
    "nova-pro": "amazon.nova-pro-v1:0",
    "nova-lite": "amazon.nova-lite-v1:0",
    "nova-micro": "amazon.nova-micro-v1:0",
  };
  return mapping[modelId] ?? modelId;
}

// ─── AwsBedrockProvider 클래스 ───────────────────────────────────────

/**
 * AWS Bedrock 프로바이더 — Converse API를 사용하는 Bedrock 클라이언트
 *
 * Amazon Bedrock Converse API를 활용하여 Claude, Nova 등의 모델과 통신합니다.
 * AWS Signature V4를 직접 구현하여 외부 AWS SDK 없이 동작합니다.
 *
 * @example
 * ```typescript
 * const provider = new AwsBedrockProvider({
 *   accessKeyId: "AKIA...",
 *   secretAccessKey: "...",
 *   region: "us-east-1",
 * });
 * const response = await provider.chat({
 *   model: "bedrock-claude-3.5-sonnet",
 *   messages: [{ role: "user", content: "Hello" }],
 * });
 * ```
 */
export class AwsBedrockProvider implements UnifiedLLMProvider {
  readonly name = "aws-bedrock";
  readonly manifest = AWS_BEDROCK_MANIFEST;

  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;
  private readonly region: string;

  constructor(options?: {
    readonly accessKeyId?: string;
    readonly secretAccessKey?: string;
    readonly region?: string;
  }) {
    const creds = resolveBedrockCredentials();
    const accessKeyId = options?.accessKeyId ?? creds?.accessKeyId;
    const secretAccessKey = options?.secretAccessKey ?? creds?.secretAccessKey;

    if (!accessKeyId || !secretAccessKey) {
      throw new LLMError(
        "AWS Bedrock credentials not found. " +
          "Set DHELIX_AWS_ACCESS_KEY_ID + DHELIX_AWS_SECRET_ACCESS_KEY " +
          "or AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY environment variables.",
      );
    }

    this.accessKeyId = accessKeyId;
    this.secretAccessKey = secretAccessKey;
    this.region = options?.region ?? creds?.region ?? "us-east-1";
  }

  /**
   * 동기식 채팅 요청 — 전체 응답을 한 번에 받음
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const bedrockModelId = resolveBedrockModelId(request.model);
    const url = `https://bedrock-runtime.${this.region}.amazonaws.com/model/${encodeURIComponent(bedrockModelId)}/converse`;

    const { system, messages } = toBedrockMessages(request.messages);
    const bodyObj: Record<string, unknown> = { messages };

    if (system) {
      bodyObj["system"] = [{ text: system }];
    }
    if (request.tools && request.tools.length > 0) {
      bodyObj["toolConfig"] = toBedrockTools(request.tools);
    }

    const inferenceConfig: Record<string, unknown> = {};
    if (request.temperature !== undefined) {
      inferenceConfig["temperature"] = request.temperature;
    }
    if (request.maxTokens !== undefined) {
      inferenceConfig["maxTokens"] = request.maxTokens;
    }
    if (Object.keys(inferenceConfig).length > 0) {
      bodyObj["inferenceConfig"] = inferenceConfig;
    }

    const bodyStr = JSON.stringify(bodyObj);
    const response = await this.fetchWithRetry(url, bodyStr, request.signal);

    const json = (await response.json()) as BedrockConverseResponse;

    const contentBlocks = json.output?.message?.content ?? [];
    let textContent = "";
    const toolCalls: ToolCallRequest[] = [];

    for (const block of contentBlocks) {
      if (block.text) {
        textContent += block.text;
      }
      if (block.toolUse) {
        toolCalls.push({
          id: block.toolUse.toolUseId,
          name: block.toolUse.name,
          arguments: JSON.stringify(block.toolUse.input ?? {}),
        });
      }
    }

    return {
      content: textContent,
      toolCalls,
      usage: {
        promptTokens: json.usage?.inputTokens ?? 0,
        completionTokens: json.usage?.outputTokens ?? 0,
        totalTokens: json.usage?.totalTokens ?? 0,
      },
      finishReason: json.stopReason ?? "stop",
    };
  }

  /**
   * 스트리밍 채팅 요청 — Converse Stream API를 통해 응답을 실시간 청크로 받음
   */
  async *stream(request: ChatRequest): AsyncIterable<ChatChunk> {
    const bedrockModelId = resolveBedrockModelId(request.model);
    const url = `https://bedrock-runtime.${this.region}.amazonaws.com/model/${encodeURIComponent(bedrockModelId)}/converse-stream`;

    const { system, messages } = toBedrockMessages(request.messages);
    const bodyObj: Record<string, unknown> = { messages };

    if (system) {
      bodyObj["system"] = [{ text: system }];
    }
    if (request.tools && request.tools.length > 0) {
      bodyObj["toolConfig"] = toBedrockTools(request.tools);
    }

    const inferenceConfig: Record<string, unknown> = {};
    if (request.temperature !== undefined) {
      inferenceConfig["temperature"] = request.temperature;
    }
    if (request.maxTokens !== undefined) {
      inferenceConfig["maxTokens"] = request.maxTokens;
    }
    if (Object.keys(inferenceConfig).length > 0) {
      bodyObj["inferenceConfig"] = inferenceConfig;
    }

    const bodyStr = JSON.stringify(bodyObj);
    const response = await this.fetchWithRetry(url, bodyStr, request.signal);

    const reader = response.body?.getReader();
    if (!reader) {
      throw new LLMError("Bedrock stream: response body is null");
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let finishReason = "stop";

    try {
      while (true) {
        const readPromise = reader.read();
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new LLMError("Bedrock stream: chunk timeout")),
            STREAM_CHUNK_TIMEOUT_MS,
          );
        });

        const { done, value } = await Promise.race([readPromise, timeoutPromise]);
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          // Bedrock 스트리밍은 JSON 이벤트 라인으로 전달됨
          if (!trimmed || trimmed.startsWith(":")) continue;

          try {
            const event = JSON.parse(trimmed) as {
              readonly contentBlockDelta?: {
                readonly delta?: {
                  readonly text?: string;
                  readonly toolUse?: {
                    readonly toolUseId?: string;
                    readonly name?: string;
                    readonly input?: string;
                  };
                };
              };
              readonly messageStop?: { readonly stopReason?: string };
              readonly metadata?: {
                readonly usage?: {
                  readonly inputTokens: number;
                  readonly outputTokens: number;
                };
              };
            };

            if (event.contentBlockDelta?.delta?.text) {
              yield {
                type: "text-delta",
                text: event.contentBlockDelta.delta.text,
              };
            }

            if (event.contentBlockDelta?.delta?.toolUse) {
              const tu = event.contentBlockDelta.delta.toolUse;
              yield {
                type: "tool-call-delta",
                toolCall: {
                  id: tu.toolUseId,
                  name: tu.name,
                  arguments: tu.input,
                },
              };
            }

            if (event.messageStop?.stopReason) {
              finishReason = event.messageStop.stopReason;
            }

            if (event.metadata?.usage) {
              totalInputTokens = event.metadata.usage.inputTokens;
              totalOutputTokens = event.metadata.usage.outputTokens;
            }
          } catch {
            // JSON 파싱 실패 시 무시
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    yield {
      type: "done",
      usage: {
        promptTokens: totalInputTokens,
        completionTokens: totalOutputTokens,
        totalTokens: totalInputTokens + totalOutputTokens,
      },
      finishReason,
    };
  }

  /**
   * 텍스트의 토큰 수를 계산
   */
  countTokens(text: string): number {
    return countTokens(text);
  }

  /**
   * 프로바이더 상태 확인 — ListFoundationModels API로 연결 가능 여부를 확인
   */
  async healthCheck(): Promise<ProviderHealthStatus> {
    const start = Date.now();
    try {
      const url = `https://bedrock.${this.region}.amazonaws.com/foundation-models`;
      const headers = buildSigV4Headers({
        method: "GET",
        url,
        body: "",
        service: "bedrock",
        region: this.region,
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
      });

      const response = await fetch(url, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        return {
          healthy: false,
          latencyMs: Date.now() - start,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      return {
        healthy: true,
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * 토큰 사용 비용을 예측
   *
   * @param tokens - 토큰 사용량
   * @param modelId - 모델 ID (선택적, 정확한 가격 계산용)
   * @returns 비용 예측 결과
   */
  estimateCost(tokens: TokenUsage, modelId?: string): CostEstimate {
    const model = modelId
      ? this.manifest.models.find((m) => modelId.startsWith(m.id))
      : undefined;
    const pricing = model?.pricing ?? this.manifest.models[0]!.pricing;

    const inputCost = (tokens.promptTokens / 1_000_000) * pricing.input;
    const outputCost = (tokens.completionTokens / 1_000_000) * pricing.output;

    return {
      inputCost,
      outputCost,
      totalCost: inputCost + outputCost,
      currency: "USD",
    };
  }

  // ─── 내부 헬퍼 ────────────────────────────────────────────────────

  /**
   * AWS SigV4 서명이 포함된 자동 재시도 fetch 래퍼
   */
  private async fetchWithRetry(
    url: string,
    body: string,
    signal?: AbortSignal,
  ): Promise<Response> {
    let attempt = 0;

    while (true) {
      const headers = buildSigV4Headers({
        method: "POST",
        url,
        body,
        service: "bedrock",
        region: this.region,
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
      });

      const response = await fetch(url, {
        method: "POST",
        headers,
        body,
        signal,
      });

      if (response.ok) return response;

      const retryInfo = getRetryInfo(response.status, attempt);
      if (!retryInfo) {
        const errorText = await response.text().catch(() => "");
        throw new LLMError(
          `Bedrock API error (HTTP ${response.status}): ${errorText}`,
        );
      }

      await sleep(retryInfo.delayMs, signal);
      attempt++;
    }
  }
}

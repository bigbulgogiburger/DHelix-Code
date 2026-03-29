/**
 * /model 명령어 핸들러 — 활성 LLM 모델 전환
 *
 * 사용자가 /model을 입력하면 사용 가능한 모델 목록을 보여주고,
 * /model <모델명>으로 세션 중간에 모델을 변경할 수 있습니다.
 *
 * 프로바이더 프로필 지원:
 *   - 🏠 Local Default: LOCAL_MODEL + LOCAL_API_BASE_URL + LOCAL_API_KEY
 *   - ☁️ OpenAI Default: OPENAI_MODEL + OPENAI_BASE_URL + OPENAI_API_KEY
 *   프로바이더 선택 시 model + baseURL + apiKey 3종 세트가 함께 전환됩니다.
 *
 * 사용 시점:
 *   - Local ↔ Cloud 전환이 필요할 때
 *   - 복잡한 작업에 고성능 모델이 필요할 때
 *   - 간단한 작업에 비용 효율적인 모델로 전환하고 싶을 때
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { type SlashCommand, type CommandResult, type CommandContext } from "./registry.js";
import { getModelCapabilities } from "../llm/model-capabilities.js";
import { CONFIG_DIR } from "../constants.js";
import { joinPath } from "../utils/path.js";

/**
 * 사용자의 모델 선택을 ~/.dhelix/config.json에 영속화합니다.
 * 다음 세션에서도 선택한 모델이 기본값으로 사용됩니다.
 */
async function persistModelChoice(model: string): Promise<void> {
  const configPath = joinPath(CONFIG_DIR, "config.json");
  try {
    await mkdir(CONFIG_DIR, { recursive: true });
    let existing: Record<string, unknown> = {};
    try {
      const content = await readFile(configPath, "utf-8");
      existing = JSON.parse(content) as Record<string, unknown>;
    } catch {
      // 파일이 없으면 빈 객체로 시작
    }
    const llm = (existing.llm ?? {}) as Record<string, unknown>;
    existing.llm = { ...llm, model };
    await writeFile(configPath, JSON.stringify(existing, null, 2) + "\n", "utf-8");
  } catch {
    // 영속화 실패는 세션에 영향을 주지 않음
  }
}

/** 프로바이더 프로필 식별자 — interactiveSelect의 value로 사용 */
const LOCAL_PROVIDER_KEY = "__provider:local__";
const OPENAI_PROVIDER_KEY = "__provider:openai__";

/**
 * 대화형 선택 목록에 표시할 잘 알려진 모델 목록
 *
 * 각 모델에 대해 라벨, 값(실제 모델 ID), 간단한 설명을 정의합니다.
 */
const STATIC_MODELS = [
  { label: "gpt-4o", value: "gpt-4o", description: "128k context" },
  { label: "gpt-4o-mini", value: "gpt-4o-mini", description: "Cost-effective" },
  { label: "claude-sonnet-4-6", value: "claude-sonnet-4-6", description: "Best coding" },
  { label: "claude-opus-4-6", value: "claude-opus-4-6", description: "Deepest reasoning" },
  {
    label: "claude-haiku-4-5-20251001",
    value: "claude-haiku-4-5-20251001",
    description: "Fast",
  },
  { label: "o3-mini", value: "o3-mini", description: "Reasoning" },
  { label: "deepseek-chat", value: "deepseek-chat", description: "Open-source" },
] as const;

/**
 * 환경변수에서 프로바이더 프로필 정보를 읽어옵니다.
 *
 * Local: LOCAL_MODEL + LOCAL_API_BASE_URL + LOCAL_API_KEY
 * OpenAI: OPENAI_MODEL + OPENAI_BASE_URL + OPENAI_API_KEY
 */
interface ProviderProfile {
  readonly model: string;
  readonly baseURL: string;
  readonly apiKey: string;
  readonly apiKeyHeader?: string;
}

function getLocalProvider(): ProviderProfile | undefined {
  const model = process.env.LOCAL_MODEL;
  const baseURL = process.env.LOCAL_API_BASE_URL;
  if (!model || !baseURL) return undefined;
  return {
    model,
    baseURL,
    apiKey: process.env.LOCAL_API_KEY ?? "no-key-required",
    apiKeyHeader: process.env.LOCAL_API_KEY_HEADER,
  };
}

function getOpenAIProvider(): ProviderProfile | undefined {
  const model = process.env.OPENAI_MODEL;
  const baseURL = process.env.OPENAI_BASE_URL;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!model || !baseURL || !apiKey) return undefined;
  return { model, baseURL, apiKey };
}

/**
 * 런타임에 .env 기반 프로바이더 프로필 + 정적 모델 목록을 반환
 *
 * 프로바이더 프로필이 설정되어 있으면 목록 상단에 🏠/☁️ 아이콘과 함께 표시합니다.
 * 프로바이더 선택 시 model + baseURL + apiKey가 함께 전환됩니다.
 */
function getKnownModels(): ReadonlyArray<{ label: string; value: string; description: string }> {
  const entries: { label: string; value: string; description: string }[] = [];
  const providerModelValues = new Set<string>();

  // 🏠 Local Default
  const local = getLocalProvider();
  if (local) {
    entries.push({
      label: `🏠 Local Default (${local.model})`,
      value: LOCAL_PROVIDER_KEY,
      description: local.baseURL.replace(/\/v1\/chat\/completions\/?$/, ""),
    });
    providerModelValues.add(local.model);
  }

  // ☁️ OpenAI Default
  const openai = getOpenAIProvider();
  if (openai) {
    entries.push({
      label: `☁️  OpenAI Default (${openai.model})`,
      value: OPENAI_PROVIDER_KEY,
      description: openai.baseURL.replace(/https?:\/\//, "").split("/")[0] ?? "",
    });
    providerModelValues.add(openai.model);
  }

  // 프로바이더가 없으면 기존 방식으로 Default 표시
  if (entries.length === 0) {
    const envModel = process.env.DHELIX_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini";
    entries.push({
      label: `Default (${envModel})`,
      value: envModel,
      description: "env 기반 기본 모델",
    });
    providerModelValues.add(envModel);
  }

  // 정적 모델 리스트 (프로바이더 모델과 중복되면 제거)
  const filtered = STATIC_MODELS.filter((m) => !providerModelValues.has(m.value));
  return [...entries, ...filtered];
}

/**
 * 프로바이더 키 선택을 처리합니다.
 * __provider:local__ 또는 __provider:openai__가 선택되면
 * newProvider를 반환하여 클라이언트를 재생성합니다.
 */
function handleProviderSelection(providerKey: string): CommandResult | undefined {
  if (providerKey === LOCAL_PROVIDER_KEY) {
    const provider = getLocalProvider();
    if (!provider) {
      return {
        output: "LOCAL_MODEL / LOCAL_API_BASE_URL 환경변수가 설정되지 않았습니다.",
        success: false,
      };
    }
    const caps = getModelCapabilities(provider.model);
    return {
      output: `🏠 Local provider로 전환: ${provider.model} (${(caps.maxContextTokens / 1000).toFixed(0)}K context)\n  ✓ Saved as default for future sessions`,
      success: true,
      newModel: provider.model,
      newProvider: provider,
    };
  }

  if (providerKey === OPENAI_PROVIDER_KEY) {
    const provider = getOpenAIProvider();
    if (!provider) {
      return {
        output: "OPENAI_MODEL / OPENAI_BASE_URL / OPENAI_API_KEY 환경변수가 설정되지 않았습니다.",
        success: false,
      };
    }
    const caps = getModelCapabilities(provider.model);
    return {
      output: `☁️  OpenAI provider로 전환: ${provider.model} (${(caps.maxContextTokens / 1000).toFixed(0)}K context)\n  ✓ Saved as default for future sessions`,
      success: true,
      newModel: provider.model,
      newProvider: provider,
    };
  }

  return undefined;
}

/**
 * /model 슬래시 명령어 정의 — 세션 중 활성 모델/프로바이더 전환
 *
 * 인자 없이 호출하면 대화형 모델 선택기를 보여주고,
 * 모델명을 인자로 전달하면 즉시 전환합니다.
 *
 * 🏠 Local Default / ☁️ OpenAI Default 선택 시 model + baseURL + apiKey가 함께 전환됩니다.
 */
export const modelCommand: SlashCommand = {
  name: "model",
  description: "Show or switch the active model",
  usage: "/model [model-name]",

  async execute(args: string, context: CommandContext): Promise<CommandResult> {
    const newModel = args.trim();

    if (!newModel) {
      // Show interactive model selector with current model highlighted info
      const caps = getModelCapabilities(context.model);
      const currentInfo = `Current: ${context.model} (${(caps.maxContextTokens / 1000).toFixed(0)}K context)`;

      return {
        output: currentInfo,
        success: true,
        interactiveSelect: {
          options: getKnownModels(),
          prompt: `Select a model (current: ${context.model}):`,
          onSelect: "/model",
        },
      };
    }

    // 프로바이더 키 선택 처리
    const providerResult = handleProviderSelection(newModel);
    if (providerResult?.success && providerResult.newModel) {
      await persistModelChoice(providerResult.newModel);
    }
    if (providerResult) return providerResult;

    // 일반 모델명 선택 — 기존 동작 (모델만 변경, baseURL/apiKey 유지)
    const caps = getModelCapabilities(newModel);
    const notes: string[] = [];
    if (!caps.supportsTools) notes.push("text-parsing fallback for tools");
    if (caps.useDeveloperRole) notes.push("developer role instead of system");
    if (!caps.supportsTemperature) notes.push("temperature not supported");

    const info = `(${(caps.maxContextTokens / 1000).toFixed(0)}K context${notes.length > 0 ? ", " + notes.join(", ") : ""})`;

    // 선택한 모델을 ~/.dhelix/config.json에 영속화 (다음 세션에서도 유지)
    await persistModelChoice(newModel);

    return {
      output: `Model switched to: ${newModel} ${info}\n  ✓ Saved as default for future sessions`,
      success: true,
      newModel,
    };
  },
};

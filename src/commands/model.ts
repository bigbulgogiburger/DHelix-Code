/**
 * /model 명령어 핸들러 — 활성 LLM 모델 전환
 *
 * 사용자가 /model을 입력하면 사용 가능한 모델 목록을 보여주고,
 * /model <모델명>으로 세션 중간에 모델을 변경할 수 있습니다.
 *
 * 모델 전환 시 해당 모델의 능력 정보(컨텍스트 크기, 도구 지원 등)도
 * 함께 표시됩니다.
 *
 * 사용 시점:
 *   - 복잡한 작업에 고성능 모델이 필요할 때
 *   - 간단한 작업에 비용 효율적인 모델로 전환하고 싶을 때
 */
import { type SlashCommand, type CommandResult, type CommandContext } from "./registry.js";
import { getModelCapabilities } from "../llm/model-capabilities.js";

/**
 * 대화형 선택 목록에 표시할 잘 알려진 모델 목록
 *
 * 각 모델에 대해 라벨, 값(실제 모델 ID), 간단한 설명을 정의합니다.
 */
const KNOWN_MODELS = [
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
 * /model 슬래시 명령어 정의 — 세션 중 활성 모델 전환
 *
 * 인자 없이 호출하면 대화형 모델 선택기를 보여주고,
 * 모델명을 인자로 전달하면 즉시 전환합니다.
 *
 * interactiveSelect를 통해 사용자가 화살표 키로 모델을 선택할 수 있습니다.
 * newModel 필드로 상위 컴포넌트에 모델 변경을 알립니다.
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
          options: KNOWN_MODELS,
          prompt: `Select a model (current: ${context.model}):`,
          onSelect: "/model",
        },
      };
    }

    const caps = getModelCapabilities(newModel);
    const notes: string[] = [];
    if (!caps.supportsTools) notes.push("text-parsing fallback for tools");
    if (caps.useDeveloperRole) notes.push("developer role instead of system");
    if (!caps.supportsTemperature) notes.push("temperature not supported");

    const info = `(${(caps.maxContextTokens / 1000).toFixed(0)}K context${notes.length > 0 ? ", " + notes.join(", ") : ""})`;

    return {
      output: `Model switched to: ${newModel} ${info}`,
      success: true,
      newModel,
    };
  },
};

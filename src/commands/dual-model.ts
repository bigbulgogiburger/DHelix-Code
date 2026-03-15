/**
 * 듀얼 모델(Architect/Editor) 라우팅 관련 명령어 핸들러 모음
 *
 * 이 파일은 세 가지 명령어를 정의합니다:
 *   /architect — 아키텍트 모델 설정 (기획/분석/리뷰용 고성능 모델)
 *   /editor   — 에디터 모델 설정 (코드 생성용 비용 효율적 모델)
 *   /dual     — 듀얼 모델 라우팅 활성화/비활성화
 *
 * 듀얼 모델 라우팅이란?
 *   작업 유형에 따라 서로 다른 LLM 모델을 자동으로 선택하는 방식입니다.
 *   - 기획/분석/리뷰 → 고성능 모델 (예: claude-opus-4-6)
 *   - 코드 생성/실행 → 비용 효율 모델 (예: gpt-4o-mini)
 *   이를 통해 품질은 유지하면서 비용을 절감할 수 있습니다.
 */
import { type SlashCommand, type CommandResult, type CommandContext } from "./registry.js";

/**
 * /architect 슬래시 명령어 정의 — 아키텍트 모델 설정 또는 조회
 *
 * 아키텍트 모델은 기획, 분석, 리뷰 단계에서 사용됩니다.
 * 일반적으로 claude-opus-4-6 같은 고성능 모델을 지정합니다.
 *
 * 인자 없이 호출하면 현재 상태를 보여주고,
 * 모델명을 인자로 전달하면 아키텍트 모델을 설정합니다.
 */
export const architectCommand: SlashCommand = {
  name: "architect",
  description: "Set or show the architect model (planning/review)",
  usage: "/architect [model-name]",

  async execute(args: string, context: CommandContext): Promise<CommandResult> {
    const model = args.trim();

    if (!model) {
      return {
        output: [
          "Architect model: used for planning, analysis, and review phases.",
          `Current main model: ${context.model}`,
          "",
          "Usage: /architect <model-name>",
          "Example: /architect claude-opus-4-6",
          "",
          "Use /dual on to enable dual-model routing after setting architect/editor models.",
        ].join("\n"),
        success: true,
      };
    }

    return {
      output: `Architect model set to: ${model}. Use /dual on to enable dual-model routing.`,
      success: true,
      newModel: undefined, // Does not change the main model
    };
  },
};

/**
 * /editor 슬래시 명령어 정의 — 에디터 모델 설정 또는 조회
 *
 * 에디터 모델은 코드 생성 및 실행 단계에서 사용됩니다.
 * 일반적으로 gpt-4o-mini나 claude-haiku 같은 비용 효율적 모델을 지정합니다.
 *
 * 인자 없이 호출하면 현재 상태를 보여주고,
 * 모델명을 인자로 전달하면 에디터 모델을 설정합니다.
 */
export const editorCommand: SlashCommand = {
  name: "editor",
  description: "Set or show the editor model (code generation)",
  usage: "/editor [model-name]",

  async execute(args: string, context: CommandContext): Promise<CommandResult> {
    const model = args.trim();

    if (!model) {
      return {
        output: [
          "Editor model: used for code generation and execution phases.",
          `Current main model: ${context.model}`,
          "",
          "Usage: /editor <model-name>",
          "Example: /editor gpt-4o-mini",
          "",
          "Use /dual on to enable dual-model routing after setting architect/editor models.",
        ].join("\n"),
        success: true,
      };
    }

    return {
      output: `Editor model set to: ${model}. Use /dual on to enable dual-model routing.`,
      success: true,
      newModel: undefined, // Does not change the main model
    };
  },
};

/**
 * /dual 슬래시 명령어 정의 — 듀얼 모델 라우팅 토글 및 상태 조회
 *
 * /dual on  → 듀얼 모델 라우팅 활성화 (기획은 아키텍트, 코드는 에디터 모델 사용)
 * /dual off → 단일 모델 모드로 전환
 * /dual     → 현재 상태 및 사용법 표시
 *
 * 활성화 시 사용자 메시지의 키워드(plan, review, design 등)를 감지하여
 * 자동으로 적절한 모델로 라우팅합니다.
 */
export const dualCommand: SlashCommand = {
  name: "dual",
  description: "Toggle dual-model (architect/editor) routing",
  usage: "/dual [on|off|status]",

  async execute(args: string, _context: CommandContext): Promise<CommandResult> {
    const arg = args.trim().toLowerCase();

    if (arg === "on") {
      return {
        output: [
          "Dual-model routing enabled.",
          "",
          "Routing strategy:",
          "  plan/review phases -> architect model (high-capability)",
          "  execute phase     -> editor model (cost-effective)",
          "",
          "Set models with /architect and /editor commands.",
          "Phase is auto-detected from your messages.",
        ].join("\n"),
        success: true,
      };
    }

    if (arg === "off") {
      return {
        output: "Dual-model routing disabled. Using single model for all phases.",
        success: true,
      };
    }

    // Default: show status
    return {
      output: [
        "Dual-model routing (Architect/Editor pattern)",
        "",
        "Commands:",
        "  /dual on         Enable dual-model routing",
        "  /dual off        Disable dual-model routing",
        "  /architect <m>   Set architect model (planning/review)",
        "  /editor <m>      Set editor model (code generation)",
        "",
        "How it works:",
        "  Planning keywords (plan, review, design, analyze) route to the architect model.",
        "  Code generation and execution route to the editor model.",
        "  This reduces cost while maintaining quality for complex tasks.",
      ].join("\n"),
      success: true,
    };
  },
};

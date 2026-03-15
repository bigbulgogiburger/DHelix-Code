/**
 * /effort 명령어 핸들러 — 추론(reasoning) 노력 수준 설정
 *
 * 사용자가 /effort를 입력하면 LLM의 응답 깊이를 조절할 수 있습니다.
 *
 * 노력 수준(effort level)이란?
 *   LLM이 응답을 생성할 때 사용할 수 있는 최대 토큰 수를 결정합니다.
 *   높은 수준일수록 더 상세하고 긴 응답이 가능하지만 비용이 증가합니다.
 *
 * 수준별 설정:
 *   - low:    maxTokens 1024 (간단한 답변)
 *   - medium: maxTokens 2048 (일반적인 답변)
 *   - high:   maxTokens 4096 (상세한 답변, 기본값)
 *   - max:    maxTokens 8192 (최대한 상세한 답변)
 *
 * 사용 시점: 간단한 질문에는 low로 비용을 아끼고,
 * 복잡한 분석에는 max로 깊은 추론을 요청할 때
 */
import { type SlashCommand, type CommandResult, type CommandContext } from "./registry.js";

/** 유효한 노력 수준 상수 배열 — "as const"로 타입 리터럴 유니온 생성 */
const EFFORT_LEVELS = ["low", "medium", "high", "max"] as const;
/** EFFORT_LEVELS 배열에서 추출한 노력 수준 타입 ("low" | "medium" | "high" | "max") */
type EffortLevel = (typeof EFFORT_LEVELS)[number];

/** 현재 노력 수준 (모듈 레벨 상태 — 세션 동안 유지됨) */
let currentEffort: EffortLevel = "high";

/**
 * 현재 노력 수준을 반환하는 getter 함수
 *
 * 다른 모듈(에이전트 루프 등)에서 현재 설정을 읽을 때 사용합니다.
 *
 * @returns 현재 노력 수준 ("low" | "medium" | "high" | "max")
 */
export function getEffortLevel(): EffortLevel {
  return currentEffort;
}

/**
 * 노력 수준을 LLM 파라미터(temperature, maxTokens)로 매핑하는 함수
 *
 * temperature란? LLM 응답의 무작위성을 제어하는 값 (0=결정적, 1=창의적)
 * maxTokens란? LLM이 한 번에 생성할 수 있는 최대 토큰 수
 *
 * @param level - 노력 수준
 * @returns temperature와 maxTokens를 포함한 설정 객체
 */
export function getEffortConfig(level: EffortLevel): {
  readonly temperature: number;
  readonly maxTokens: number;
} {
  switch (level) {
    case "low":
      return { temperature: 0.0, maxTokens: 1024 };
    case "medium":
      return { temperature: 0.0, maxTokens: 2048 };
    case "high":
      return { temperature: 0.0, maxTokens: 4096 };
    case "max":
      return { temperature: 0.0, maxTokens: 8192 };
  }
}

/**
 * /effort 슬래시 명령어 정의 — 추론 노력 수준 설정
 *
 * 인자 없이 호출하면 현재 노력 수준을 표시하고,
 * 수준을 인자로 전달하면 변경합니다.
 */
export const effortCommand: SlashCommand = {
  name: "effort",
  description: "Set reasoning effort level (low/medium/high/max)",
  usage: "/effort [low|medium|high|max]",

  async execute(args: string, _context: CommandContext): Promise<CommandResult> {
    const level = args.trim().toLowerCase();

    if (!level) {
      return {
        output: `Current effort level: ${currentEffort}`,
        success: true,
      };
    }

    if (!EFFORT_LEVELS.includes(level as EffortLevel)) {
      return {
        output: `Invalid effort level: "${level}". Use: ${EFFORT_LEVELS.join(", ")}`,
        success: false,
      };
    }

    currentEffort = level as EffortLevel;
    const config = getEffortConfig(currentEffort);

    return {
      output: `Effort level set to: ${currentEffort} (maxTokens: ${config.maxTokens})`,
      success: true,
    };
  },
};

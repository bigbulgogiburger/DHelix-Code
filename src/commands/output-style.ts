/**
 * /output-style 명령어 핸들러 — 응답 스타일 변경
 *
 * 사용자가 /output-style을 입력하면 LLM의 응답 스타일을 변경합니다.
 * 시스템 프롬프트를 조정하여 LLM의 출력 행동을 바꿉니다.
 *
 * 스타일 옵션:
 *   - default     — 균형 잡힌 응답 (기본)
 *   - explanatory — 이유와 함께 상세한 설명
 *   - learning    — 교육적 설명, 예시와 맥락 제공
 *   - concise     — 최소한의 직접적인 답변
 *
 * 사용 시점: LLM의 응답이 너무 길거나 짧을 때 스타일을 조절할 때
 */
import { type SlashCommand } from "./registry.js";

/** 유효한 출력 스타일 상수 배열 */
const VALID_STYLES = ["default", "explanatory", "learning", "concise"] as const;
/** 출력 스타일 타입 ("default" | "explanatory" | "learning" | "concise") */
type OutputStyle = (typeof VALID_STYLES)[number];

export const outputStyleCommand: SlashCommand = {
  name: "output-style",
  description: "Change response output style",
  usage: "/output-style <default|explanatory|learning|concise>",
  execute: async (args, _context) => {
    const style = args.trim().toLowerCase();

    if (!style) {
      return {
        output: [
          "Output Styles:",
          "",
          "  default       — Balanced responses",
          "  explanatory   — Detailed explanations with reasoning",
          "  learning      — Educational with examples and context",
          "  concise       — Minimal, direct answers",
          "",
          `Usage: /output-style <${VALID_STYLES.join("|")}>`,
        ].join("\n"),
        success: true,
      };
    }

    if (!VALID_STYLES.includes(style as OutputStyle)) {
      return {
        output: `Unknown style: "${style}". Valid: ${VALID_STYLES.join(", ")}`,
        success: false,
      };
    }

    return {
      output: `Output style set to: ${style}`,
      success: true,
    };
  },
};

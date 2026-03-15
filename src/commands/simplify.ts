/**
 * /simplify 명령어 핸들러 — 코드 재사용, 품질, 효율성 개선 리뷰
 *
 * 사용자가 /simplify를 입력하면 LLM에게 변경된 코드를 분석하여
 * 개선 기회를 찾도록 요청합니다.
 *
 * 분석 항목:
 *   1. 재사용(Reuse) — 기존 유틸리티/패턴으로 대체할 수 있는 코드
 *   2. 품질(Quality) — 네이밍, 구조, 가독성 개선
 *   3. 효율성(Efficiency) — 성능 최적화, 불필요한 복잡성 제거
 *
 * 사용 예시:
 *   /simplify              → 모든 변경 파일 분석
 *   /simplify src/utils.ts → 특정 파일만 분석
 *
 * 사용 시점: 코드를 더 간결하고 효율적으로 리팩토링하고 싶을 때
 */
import { type SlashCommand } from "./registry.js";

export const simplifyCommand: SlashCommand = {
  name: "simplify",
  description: "Review changed code for reuse, quality, and efficiency",
  usage: "/simplify [file path]",
  execute: async (args, _context) => {
    const target = args.trim() || "all changed files";

    const prompt = [
      "Review the following code changes for opportunities to improve:",
      "",
      "1. **Reuse**: Are there existing utilities or patterns that could replace new code?",
      "2. **Quality**: Are there naming, structure, or readability improvements?",
      "3. **Efficiency**: Are there performance optimizations or unnecessary complexity?",
      "",
      `Target: ${target}`,
      "",
      "Please analyze the changed files and suggest specific improvements.",
      "Use the available tools to read the relevant files and provide actionable suggestions.",
    ].join("\n");

    return {
      output: prompt,
      success: true,
    };
  },
};

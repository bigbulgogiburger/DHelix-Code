/**
 * /debug 명령어 핸들러 — 체계적 디버깅 워크플로우
 *
 * 사용자가 /debug <에러 설명>을 입력하면 LLM에게 구조화된 디버깅
 * 단계를 안내하는 프롬프트를 생성합니다.
 *
 * 디버깅 5단계:
 *   1. 재현(Reproduce) — 문제 발생 조건 파악
 *   2. 위치(Locate) — grep_search/file_read로 관련 코드 찾기
 *   3. 분석(Analyze) — 데이터 흐름을 추적하여 근본 원인 파악
 *   4. 수정(Fix) — 최소한의 타겟 수정 제안
 *   5. 검증(Verify) — 수정이 작동하는지 확인 방법 설명
 *
 * 사용 시점: 에러가 발생했을 때 LLM의 도움으로 체계적으로 디버깅하고 싶을 때
 */
import { type SlashCommand } from "./registry.js";

export const debugCommand: SlashCommand = {
  name: "debug",
  description: "Systematic debugging workflow",
  usage: "/debug <error description or log path>",
  execute: async (args, _context) => {
    const trimmed = args.trim();
    if (!trimmed) {
      return {
        output:
          "Usage: /debug <error description or log path>\nExample: /debug TypeError: Cannot read property 'map' of undefined",
        success: false,
      };
    }

    const prompt = [
      "Perform a systematic debugging analysis:",
      "",
      `**Problem**: ${trimmed}`,
      "",
      "Follow this debugging workflow:",
      "",
      "1. **Reproduce**: Identify the exact conditions that trigger the issue",
      "2. **Locate**: Use grep_search and file_read to find the relevant code",
      "3. **Analyze**: Trace the data flow and identify the root cause",
      "4. **Fix**: Propose a minimal, targeted fix",
      "5. **Verify**: Explain how to verify the fix works",
      "",
      "Use the available tools to investigate. Start by searching for the error pattern in the codebase.",
    ].join("\n");

    return {
      output: prompt,
      success: true,
      shouldInjectAsUserMessage: true,
    };
  },
};

/**
 * 사용자 질문 도구 — LLM이 사용자에게 직접 질문하거나 확인을 요청할 때 사용하는 도구
 *
 * LLM이 작업 중 추가 정보가 필요하거나, 중요한 결정을 사용자에게 맡기고 싶을 때
 * 이 도구를 호출하여 사용자와 대화합니다.
 *
 * 실행 흐름:
 * 1. LLM이 질문 텍스트와 선택지(선택사항)를 전달
 * 2. 도구가 "[AWAITING_USER_INPUT]" 마커와 함께 질문을 반환
 * 3. 에이전트 루프(Agent Loop)가 이 마커를 감지하여 UI에 질문을 표시
 * 4. 사용자가 응답하면 에이전트 루프가 LLM에 응답을 전달
 *
 * 참고: 실제 사용자 상호작용은 UI 레이어(Ink/React)에서 비동기적으로 처리됩니다.
 * 이 도구는 에이전트 루프가 특별히 처리하는 "특수 도구"입니다.
 */
import { z } from "zod";
import { type ToolDefinition, type ToolContext, type ToolResult } from "../types.js";

/**
 * 매개변수 스키마 정의 — Zod(런타임 데이터 검증 라이브러리)로 입력 형식을 정의
 */
const paramSchema = z.object({
  /** 사용자에게 표시할 질문 텍스트 */
  question: z.string().describe("Question to ask the user"),
  /** 선택지 목록(선택사항) — 제공하면 사용자가 선택지 중 하나를 고르게 됨 */
  choices: z
    .array(z.string())
    .optional()
    .describe("Optional list of choices for the user to pick from"),
});

/** Zod 스키마에서 TypeScript 타입을 자동 추론 — 스키마와 타입이 항상 동기화됨 */
type Params = z.infer<typeof paramSchema>;

/**
 * 도구 실행 함수 — 사용자 입력 대기 마커를 포함한 결과를 반환
 *
 * 이 함수는 실제로 사용자와 상호작용하지 않습니다.
 * 대신 "[AWAITING_USER_INPUT]" 마커를 출력에 포함시키면,
 * 에이전트 루프가 이를 감지하여 사용자 입력을 처리합니다.
 *
 * @param params - 검증된 매개변수 (질문 텍스트, 선택지)
 * @param _context - 실행 컨텍스트 (이 도구에서는 사용하지 않음)
 * @returns 사용자 입력 대기 마커가 포함된 결과
 */
async function execute(params: Params, _context: ToolContext): Promise<ToolResult> {
  // 선택지가 있으면 번호를 붙여 텍스트로 변환
  // 예: ["A", "B"] → "\nChoices: [1] A, [2] B"
  const choicesText = params.choices
    ? `\nChoices: ${params.choices.map((c, i) => `[${i + 1}] ${c}`).join(", ")}`
    : "";

  return {
    // "[AWAITING_USER_INPUT]" 마커 — 에이전트 루프가 이 텍스트를 감지하여 사용자 입력 모드로 전환
    output: `[AWAITING_USER_INPUT] ${params.question}${choicesText}`,
    isError: false,
    // metadata에 구조화된 데이터를 포함 — UI 레이어에서 질문과 선택지를 파싱 없이 바로 사용
    metadata: { question: params.question, choices: params.choices },
  };
}

/**
 * ask_user 도구 정의 — 내보내기(export)하여 도구 레지스트리에 등록
 */
export const askUserTool: ToolDefinition<Params> = {
  name: "ask_user",
  description:
    "Ask the user a question. Use this when you need clarification, want to confirm an action, or need the user to make a decision.",
  parameterSchema: paramSchema,
  /** "safe" — 사용자에게 질문하는 것은 시스템에 영향을 주지 않으므로 안전 */
  permissionLevel: "safe",
  /** 5분(300,000ms) — 사용자가 응답하는 데 시간이 걸릴 수 있으므로 긴 타임아웃 설정 */
  timeoutMs: 300_000,
  execute,
};

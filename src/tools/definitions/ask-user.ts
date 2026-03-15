/**
 * 사용자 질문 도구 — LLM이 사용자에게 직접 질문하거나 확인을 요청할 때 사용하는 도구
 *
 * 실행 흐름:
 * 1. LLM이 질문 텍스트와 선택지(선택사항)를 전달
 * 2. "ask_user:prompt" 이벤트를 발행하여 UI에 질문을 표시
 * 3. 사용자가 응답할 때까지 Promise로 대기 ("ask_user:response" 이벤트 수신)
 * 4. 사용자의 응답을 도구 결과로 반환 → LLM이 이어서 처리
 *
 * Claude Code 방식: 질문은 일반 텍스트로 표시되고,
 * 사용자가 일반 입력창에 답하면 다음 턴으로 이어감
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
 * 도구 실행 함수 — 이벤트를 통해 UI에 질문을 보내고 사용자 응답을 대기
 *
 * @param params - 검증된 매개변수 (질문 텍스트, 선택지)
 * @param context - 실행 컨텍스트 (이벤트 에미터, AbortSignal 포함)
 * @returns 사용자의 응답 텍스트가 담긴 결과
 */
async function execute(params: Params, context: ToolContext): Promise<ToolResult> {
  const { events, abortSignal } = context;

  // 이벤트 에미터가 없으면 폴백 — 헤드리스 모드 등에서 이벤트 없이 실행될 수 있음
  if (!events) {
    return {
      output: `[Question for user] ${params.question}`,
      isError: false,
      metadata: { question: params.question, choices: params.choices },
    };
  }

  // 고유한 도구 호출 ID 생성 — 질문과 응답을 매칭하는 데 사용
  const toolCallId = `ask_${Date.now()}`;

  // Promise로 사용자 응답을 대기
  const answer = await new Promise<string>((resolve) => {
    // 응답 이벤트 리스너 등록
    const onResponse = (data: { toolCallId: string; answer: string }) => {
      if (data.toolCallId === toolCallId) {
        events.off("ask_user:response", onResponse);
        resolve(data.answer);
      }
    };
    events.on("ask_user:response", onResponse);

    // AbortSignal 처리 — 사용자가 Esc로 취소할 경우
    if (abortSignal) {
      abortSignal.addEventListener("abort", () => {
        events.off("ask_user:response", onResponse);
        resolve("[User cancelled]");
      }, { once: true });
    }

    // UI에 질문 표시 요청 이벤트 발행
    events.emit("ask_user:prompt", {
      toolCallId,
      question: params.question,
      choices: params.choices,
    });
  });

  return {
    output: `User responded: ${answer}`,
    isError: false,
    metadata: { question: params.question, answer, choices: params.choices },
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

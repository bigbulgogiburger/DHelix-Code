/**
 * 네이티브 함수 호출 전략 — OpenAI 표준 tool_calls를 사용하는 도구 호출 방식
 *
 * GPT-4o, Claude, GPT-5 등 대부분의 상용 LLM 모델이 지원하는
 * 표준 function calling 메커니즘을 사용합니다.
 *
 * 작동 방식:
 * 1. 요청 시: 도구 정의를 API의 tools 파라미터로 전달
 * 2. 응답 시: 모델이 tool_calls 필드에 구조화된 JSON으로 호출 정보를 반환
 * 3. 결과 전달: "tool" 역할 메시지로 실행 결과를 다시 모델에게 전달
 *
 * 이 방식은 모델이 직접 JSON을 생성하므로 파싱 오류가 적고,
 * 도구 이름과 인자의 정확도가 높습니다.
 */
import { type ChatMessage, type ToolCallRequest, type ToolDefinitionForLLM } from "../provider.js";
import { type ToolCallStrategy, type PreparedRequest } from "../tool-call-strategy.js";
import { type ExtractedToolCall } from "../../tools/types.js";

/**
 * 네이티브 함수 호출 전략 구현
 *
 * LLMProvider의 tools 파라미터를 직접 사용하는 가장 기본적인 전략입니다.
 * 별도의 텍스트 변환 없이 API의 기본 기능을 그대로 활용합니다.
 */
export class NativeFunctionCallingStrategy implements ToolCallStrategy {
  readonly name = "native" as const;

  /**
   * 요청 준비 — 도구 정의를 그대로 전달
   *
   * 네이티브 전략에서는 메시지나 도구 정의를 변환할 필요가 없습니다.
   * API가 직접 tools 파라미터를 이해하므로 그대로 전달합니다.
   *
   * @param messages - 원본 메시지 배열
   * @param tools - 도구 정의 배열
   * @returns 변환 없이 그대로 반환
   */
  prepareRequest(
    messages: readonly ChatMessage[],
    tools: readonly ToolDefinitionForLLM[],
  ): PreparedRequest {
    return { messages, tools };
  }

  /**
   * LLM 응답에서 도구 호출을 추출
   *
   * 모델이 반환한 tool_calls 배열의 각 항목에서
   * JSON 문자열인 arguments를 파싱하여 객체로 변환합니다.
   *
   * JSON 파싱이 실패하면 빈 객체({})를 사용합니다.
   * (모델이 간혹 잘못된 JSON을 생성할 수 있으므로 방어적으로 처리)
   *
   * @param _content - 텍스트 응답 (네이티브 전략에서는 사용하지 않음)
   * @param toolCalls - 모델이 반환한 도구 호출 배열
   * @returns 파싱된 도구 호출 배열
   */
  extractToolCalls(
    _content: string,
    toolCalls: readonly ToolCallRequest[],
  ): readonly ExtractedToolCall[] {
    return toolCalls.map((tc) => {
      let args: Record<string, unknown>;
      try {
        // 도구 인자는 JSON 문자열로 전달되므로 파싱 필요
        args = JSON.parse(tc.arguments) as Record<string, unknown>;
      } catch {
        // JSON 파싱 실패 시 빈 객체로 대체하고, 상세 모드에서 경고 출력
        if (process.env.DBCODE_VERBOSE) {
          process.stderr.write(
            `[native-function-calling] Failed to parse tool arguments for "${tc.name}" (id: ${tc.id}): ${tc.arguments}\n`,
          );
        }
        args = {};
      }
      return {
        id: tc.id,
        name: tc.name,
        arguments: args,
      };
    });
  }

  /**
   * 도구 실행 결과를 "tool" 역할 메시지로 변환
   *
   * OpenAI API 규격에 따라 각 도구 결과를 별도의 "tool" 역할 메시지로 변환합니다.
   * toolCallId로 원래 도구 호출과 매칭합니다.
   *
   * 에러인 경우 "Error: " 접두사를 붙여 모델이 에러임을 인식하도록 합니다.
   *
   * @param results - 도구 실행 결과 배열
   * @returns "tool" 역할 메시지 배열
   */
  formatToolResults(
    results: readonly { id: string; output: string; isError: boolean }[],
  ): readonly ChatMessage[] {
    return results.map((result) => ({
      role: "tool" as const,
      content: result.isError ? `Error: ${result.output}` : result.output,
      toolCallId: result.id, // 원래 도구 호출 ID와 매칭
    }));
  }
}

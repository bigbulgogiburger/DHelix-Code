/**
 * 도구 호출 전략 선택기 — 모델 능력에 따라 적절한 도구 호출 방식을 선택하는 모듈
 *
 * LLM 모델마다 도구 호출(function calling) 지원 방식이 다릅니다:
 *
 * 1. **네이티브 전략 (NativeFunctionCallingStrategy)**
 *    - OpenAI의 tool_calls 필드를 사용하는 표준 방식
 *    - GPT-4o, Claude 등 대부분의 상용 모델이 지원
 *    - 구조화된 JSON으로 도구 호출 정보를 받음
 *
 * 2. **텍스트 파싱 전략 (TextParsingStrategy)**
 *    - XML 태그로 도구 호출을 텍스트에 포함하는 폴백 방식
 *    - 네이티브 function calling을 지원하지 않는 모델용 (Llama3 등)
 *    - 시스템 프롬프트에 도구 사용법을 주입하고, 응답에서 XML을 파싱
 *
 * 이 모듈은 model-capabilities의 supportsTools 플래그를 확인하여
 * 자동으로 적절한 전략을 선택합니다.
 */
import { type ChatMessage, type ToolCallRequest, type ToolDefinitionForLLM } from "./provider.js";
import { type ExtractedToolCall } from "../tools/types.js";
import { NativeFunctionCallingStrategy } from "./strategies/native-function-calling.js";
import { TextParsingStrategy } from "./strategies/text-parsing.js";
import { getModelCapabilities } from "./model-capabilities.js";
import { isResponsesOnlyModel } from "./responses-client.js";

/**
 * 도구 포함 요청 — 도구 정의가 요청에 포함된 형태
 *
 * 전략에 따라 도구 정의가 요청의 tools 필드에 들어가거나 (네이티브),
 * 시스템 메시지에 텍스트로 주입될 수 있습니다 (텍스트 파싱).
 */
export interface PreparedRequest {
  /** 도구 정의가 반영된 메시지 배열 */
  readonly messages: readonly ChatMessage[];
  /** 도구 정의 (네이티브 전략에서만 사용, 텍스트 파싱에서는 undefined) */
  readonly tools?: readonly ToolDefinitionForLLM[];
}

/**
 * 도구 호출 전략 인터페이스 — 모든 전략이 구현해야 하는 공통 계약
 *
 * 세 가지 핵심 메서드:
 * 1. prepareRequest: 요청에 도구 정의를 포함시킴
 * 2. extractToolCalls: 응답에서 도구 호출을 추출
 * 3. formatToolResults: 도구 실행 결과를 메시지로 변환
 */
export interface ToolCallStrategy {
  /** 전략 이름 */
  readonly name: "native" | "text-parsing";

  /**
   * 요청에 도구 정의를 포함시키는 전처리
   *
   * - 네이티브: tools 필드에 도구 정의를 그대로 포함
   * - 텍스트 파싱: 시스템 메시지에 도구 사용법을 텍스트로 주입
   *
   * @param messages - 원본 메시지 배열
   * @param tools - 사용 가능한 도구 정의 배열
   * @returns 도구가 포함된 요청
   */
  prepareRequest(
    messages: readonly ChatMessage[],
    tools: readonly ToolDefinitionForLLM[],
  ): PreparedRequest;

  /**
   * LLM 응답에서 도구 호출을 추출
   *
   * - 네이티브: toolCalls 배열에서 직접 추출
   * - 텍스트 파싱: 텍스트 내용에서 XML 패턴으로 파싱
   *
   * @param content - LLM의 텍스트 응답
   * @param toolCalls - LLM이 반환한 tool_calls (네이티브에서만 사용)
   * @returns 추출된 도구 호출 배열
   */
  extractToolCalls(
    content: string,
    toolCalls: readonly ToolCallRequest[],
  ): readonly ExtractedToolCall[];

  /**
   * 도구 실행 결과를 대화 메시지로 변환
   *
   * - 네이티브: "tool" 역할 메시지로 변환
   * - 텍스트 파싱: "user" 역할 메시지에 XML 형식으로 포함
   *
   * @param results - 도구 실행 결과 배열
   * @returns 대화에 추가할 메시지 배열
   */
  formatToolResults(
    results: readonly { id: string; output: string; isError: boolean }[],
  ): readonly ChatMessage[];
}

/**
 * 모델 능력에 따라 적절한 도구 호출 전략을 자동 선택
 *
 * model-capabilities의 supportsTools 플래그를 확인하여:
 * - true → NativeFunctionCallingStrategy (OpenAI 표준 방식)
 * - false → TextParsingStrategy (XML 폴백 방식)
 *
 * @param modelName - 모델 이름
 * @returns 선택된 도구 호출 전략
 */
export function selectStrategy(modelName: string): ToolCallStrategy {
  // Responses API models always use native function calling
  // (prevents strategy mismatch if supportsTools is accidentally unset)
  if (isResponsesOnlyModel(modelName)) {
    return new NativeFunctionCallingStrategy();
  }
  const caps = getModelCapabilities(modelName);
  if (caps.supportsTools) {
    return new NativeFunctionCallingStrategy();
  }
  return new TextParsingStrategy();
}

/**
 * 특정 전략을 강제로 사용 — 모델 능력과 무관하게 전략 지정
 *
 * 테스트나 디버깅 시 특정 전략을 강제하고 싶을 때 사용합니다.
 *
 * @param strategyName - 사용할 전략 이름 ("native" 또는 "text-parsing")
 * @returns 지정된 전략 인스턴스
 */
export function forceStrategy(strategyName: "native" | "text-parsing"): ToolCallStrategy {
  if (strategyName === "native") {
    return new NativeFunctionCallingStrategy();
  }
  return new TextParsingStrategy();
}

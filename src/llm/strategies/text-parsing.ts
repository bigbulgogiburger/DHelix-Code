/**
 * 텍스트 파싱 전략 — XML 형식으로 도구 호출을 추출하는 폴백 방식
 *
 * 네이티브 function calling을 지원하지 않는 모델 (예: Llama3, Phi)에서
 * 도구 호출을 사용하기 위한 폴백(fallback) 전략입니다.
 *
 * 작동 방식:
 * 1. 요청 시: 도구 사용법을 시스템 메시지에 텍스트로 주입
 * 2. 응답 시: 모델이 XML 태그로 도구 호출을 텍스트에 포함
 * 3. 파싱: 응답 텍스트에서 XML 패턴을 정규식으로 추출
 * 4. 결과 전달: "user" 역할 메시지에 XML 형식으로 결과 포함
 *
 * XML 형식 예시:
 * ```xml
 * <tool_call>
 * <name>file_read</name>
 * <arguments>{"file_path": "/path/to/file"}</arguments>
 * </tool_call>
 * ```
 *
 * JSON 파싱은 3단계 복구를 지원합니다:
 * 1. 표준 JSON.parse
 * 2. 흔한 실수 수정 후 재시도 (후행 쉼표, 작은따옴표 등)
 * 3. 정규식으로 키-값 쌍 직접 추출 (최후의 수단)
 */
import { randomUUID } from "node:crypto";
import { type ChatMessage, type ToolCallRequest, type ToolDefinitionForLLM } from "../provider.js";
import { type ToolCallStrategy, type PreparedRequest } from "../tool-call-strategy.js";
import { type ExtractedToolCall } from "../../tools/types.js";

/**
 * XML 도구 호출 패턴을 추출하는 정규식
 *
 * 매칭 형식:
 * <tool_call>
 *   <name>도구이름</name>
 *   <arguments>{"param": "value"}</arguments>
 * </tool_call>
 *
 * [\s\S]*? — 줄바꿈을 포함한 최소 매칭 (non-greedy)
 */
const TOOL_CALL_PATTERN =
  /<tool_call>\s*<name>([\s\S]*?)<\/name>\s*<arguments>([\s\S]*?)<\/arguments>\s*<\/tool_call>/g;

/**
 * 잘못된 JSON에서 키-값 쌍을 정규식으로 직접 추출 — 최후의 수단
 *
 * JSON.parse가 수정 후에도 실패할 때 사용하는 마지막 폴백입니다.
 * 정규식으로 "key": "value" 형태의 쌍을 찾아 객체로 조합합니다.
 *
 * 한계: 중첩 객체, 배열 등 복잡한 구조는 처리할 수 없습니다.
 *
 * @param raw - 잘못된 JSON 문자열
 * @returns 추출된 키-값 쌍 객체
 */
export function extractKeyValuePairs(raw: string): Record<string, unknown> {
  const pairs: Record<string, unknown> = {};
  // "key": "value" 또는 key: value 형태를 매칭
  const regex = /["']?(\w+)["']?\s*:\s*["']?([^"',}\]]+)["']?/g;
  let match;
  while ((match = regex.exec(raw)) !== null) {
    if (match[1] && match[2]) {
      pairs[match[1]] = match[2].trim();
    }
  }
  return pairs;
}

/**
 * 도구 인자 JSON을 3단계 복구로 파싱
 *
 * LLM이 생성하는 JSON은 종종 표준에 맞지 않습니다.
 * 3단계 복구 전략으로 가능한 한 파싱을 시도합니다:
 *
 * 1단계: 표준 JSON.parse 시도
 * 2단계: 흔한 실수를 수정한 후 재시도
 *   - 후행 쉼표: { "a": 1, } → { "a": 1 }
 *   - 작은따옴표: { 'a': 'b' } → { "a": "b" }
 *   - 인용 없는 키: { a: "b" } → { "a": "b" }
 *   - 리터럴 줄바꿈: 문자열 내의 실제 줄바꿈을 \n으로 변환
 * 3단계: 정규식으로 키-값 쌍 직접 추출 (최후의 수단)
 *
 * @param raw - 파싱할 JSON 문자열 (잘못된 형식일 수 있음)
 * @returns 파싱된 객체
 */
export function parseToolArguments(raw: string): Record<string, unknown> {
  // 1단계: 표준 JSON.parse 시도
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    /* 실패 시 다음 단계로 */
  }

  // 2단계: 흔한 LLM JSON 실수를 수정
  const fixed = raw
    .replace(/,\s*}/g, "}") // 객체의 후행 쉼표 제거: { "a": 1, } → { "a": 1 }
    .replace(/,\s*]/g, "]") // 배열의 후행 쉼표 제거: [1, 2, ] → [1, 2]
    .replace(/'/g, '"') // 작은따옴표를 큰따옴표로 변환
    .replace(/(\w+)\s*:/g, '"$1":') // 인용 없는 키에 따옴표 추가
    .replace(/\n/g, "\\n"); // 리터럴 줄바꿈을 이스케이프 시퀀스로 변환

  try {
    return JSON.parse(fixed) as Record<string, unknown>;
  } catch {
    /* 실패 시 다음 단계로 */
  }

  // 3단계: 정규식으로 키-값 쌍 직접 추출 (최후의 수단)
  return extractKeyValuePairs(raw);
}

/**
 * 텍스트 파싱으로 생성된 도구 호출에 고유 ID를 부여
 *
 * 네이티브 전략에서는 API가 ID를 생성하지만,
 * 텍스트 파싱에서는 직접 ID를 생성해야 합니다.
 * crypto.randomUUID를 사용하여 동시 요청에서도 충돌을 방지합니다.
 *
 * @returns "tc_text_" 접두사가 붙은 고유 ID
 */
function generateCallId(): string {
  return `tc_text_${randomUUID().slice(0, 8)}`;
}

/**
 * 도구 정의를 텍스트 지시사항으로 변환
 *
 * 네이티브 function calling을 지원하지 않는 모델에게
 * 어떤 도구를 사용할 수 있고, 어떻게 호출하는지 알려주는
 * 시스템 프롬프트 텍스트를 생성합니다.
 *
 * 생성되는 텍스트 구조:
 * 1. 사용 가능한 도구 목록 (이름, 설명, 매개변수)
 * 2. XML 형식의 도구 호출 방법 예시
 * 3. 사용 규칙 (여러 도구 동시 호출 가능, 추론을 먼저 작성 등)
 *
 * @param tools - 도구 정의 배열
 * @returns 시스템 프롬프트에 주입할 텍스트
 */
function formatToolInstructions(tools: readonly ToolDefinitionForLLM[]): string {
  const lines: string[] = [
    "You have access to the following tools. To use a tool, respond with the XML format shown below.",
    "",
    "## Available Tools",
    "",
  ];

  // 각 도구의 이름, 설명, 매개변수 스키마를 나열
  for (const tool of tools) {
    lines.push(`### ${tool.function.name}`);
    lines.push(tool.function.description);
    lines.push(`Parameters: ${JSON.stringify(tool.function.parameters, null, 2)}`);
    lines.push("");
  }

  // 도구 호출 XML 형식 예시
  lines.push("## How to use tools");
  lines.push("");
  lines.push("To call a tool, include the following XML in your response:");
  lines.push("```xml");
  lines.push("<tool_call>");
  lines.push("<name>tool_name</name>");
  lines.push('<arguments>{"param1": "value1"}</arguments>');
  lines.push("</tool_call>");
  lines.push("```");
  lines.push("");
  lines.push(
    "You can call multiple tools in a single response by including multiple <tool_call> blocks.",
  );
  // 추론/설명을 먼저 작성하고 도구 호출은 뒤에 배치하도록 안내
  lines.push("Write your reasoning and explanation BEFORE any tool calls.");

  return lines.join("\n");
}

/**
 * 텍스트 파싱 전략 구현
 *
 * 네이티브 function calling을 지원하지 않는 모델을 위한 폴백 전략입니다.
 * 도구 정의를 시스템 프롬프트에 주입하고,
 * 응답 텍스트에서 XML 형식의 도구 호출을 파싱합니다.
 */
export class TextParsingStrategy implements ToolCallStrategy {
  readonly name = "text-parsing" as const;

  /**
   * 요청 준비 — 도구 사용법을 시스템 메시지에 텍스트로 주입
   *
   * API의 tools 파라미터를 사용하지 않고,
   * 도구 사용법을 시스템 메시지에 자연어+XML 예시로 주입합니다.
   *
   * 도구 지시사항은 기존 시스템 메시지들 바로 뒤에 삽입됩니다.
   * tools 파라미터는 반환하지 않습니다 (프롬프트에 이미 포함됨).
   *
   * @param messages - 원본 메시지 배열
   * @param tools - 사용 가능한 도구 정의 배열
   * @returns 도구 지시사항이 주입된 메시지 (tools 필드 없음)
   */
  prepareRequest(
    messages: readonly ChatMessage[],
    tools: readonly ToolDefinitionForLLM[],
  ): PreparedRequest {
    if (tools.length === 0) {
      return { messages };
    }

    // 도구 사용법을 설명하는 시스템 메시지 생성
    const toolInstructions = formatToolInstructions(tools);
    const toolSystemMessage: ChatMessage = {
      role: "system",
      content: toolInstructions,
    };

    // 기존 시스템 메시지 바로 뒤에 삽입 (다른 역할의 메시지 앞에)
    const firstNonSystemIdx = messages.findIndex((m) => m.role !== "system");
    const insertIdx = firstNonSystemIdx === -1 ? messages.length : firstNonSystemIdx;

    const preparedMessages: ChatMessage[] = [
      ...messages.slice(0, insertIdx), // 기존 시스템 메시지들
      toolSystemMessage, // 도구 지시사항 시스템 메시지
      ...messages.slice(insertIdx), // 나머지 메시지들
    ];

    // tools 파라미터를 포함하지 않음 — 프롬프트에 이미 포함됨
    return { messages: preparedMessages };
  }

  /**
   * 응답 텍스트에서 XML 형식의 도구 호출을 추출
   *
   * 정규식으로 <tool_call>...</tool_call> 패턴을 찾아서
   * 도구 이름과 인자를 추출합니다.
   *
   * 네이티브 전략의 toolCalls 인자는 사용하지 않습니다 (_toolCalls).
   *
   * @param content - LLM의 텍스트 응답
   * @param _toolCalls - 사용하지 않음 (텍스트 파싱에서는 텍스트에서 직접 추출)
   * @returns 추출된 도구 호출 배열
   */
  extractToolCalls(
    content: string,
    _toolCalls: readonly ToolCallRequest[],
  ): readonly ExtractedToolCall[] {
    const calls: ExtractedToolCall[] = [];
    // 전역 플래그(g)로 여러 도구 호출을 순차적으로 매칭
    const regex = new RegExp(TOOL_CALL_PATTERN.source, "g");
    let match: RegExpExecArray | null;

    while ((match = regex.exec(content)) !== null) {
      const name = match[1].trim(); // 도구 이름
      const argsStr = match[2].trim(); // 도구 인자 (JSON 문자열)

      // 3단계 복구를 통한 안전한 JSON 파싱
      const args = parseToolArguments(argsStr);

      calls.push({
        id: generateCallId(), // 고유 ID 생성 (API가 제공하지 않으므로)
        name,
        arguments: args,
      });
    }

    return calls;
  }

  /**
   * 도구 실행 결과를 "user" 역할 메시지로 변환
   *
   * 이 모델은 "tool" 역할을 이해하지 못하므로,
   * 결과를 "user" 역할 메시지에 XML 형식으로 포함합니다.
   *
   * XML 형식:
   * ```xml
   * <tool_result id="tc_text_abc12345" status="SUCCESS">
   * 실행 결과 내용
   * </tool_result>
   * ```
   *
   * @param results - 도구 실행 결과 배열
   * @returns "user" 역할 메시지 배열 (하나의 메시지에 모든 결과 포함)
   */
  formatToolResults(
    results: readonly { id: string; output: string; isError: boolean }[],
  ): readonly ChatMessage[] {
    if (results.length === 0) return [];

    // 각 결과를 XML 형식으로 변환
    const parts = results.map((result) => {
      const status = result.isError ? "ERROR" : "SUCCESS";
      return `<tool_result id="${result.id}" status="${status}">\n${result.output}\n</tool_result>`;
    });

    // 모든 결과를 하나의 user 메시지로 합침
    return [
      {
        role: "user",
        content: `Tool execution results:\n\n${parts.join("\n\n")}`,
      },
    ];
  }

  /**
   * 어시스턴트 텍스트에서 도구 호출 XML을 제거
   *
   * 사용자에게 보여줄 때 XML 태그를 제거하고
   * 순수한 추론/설명 텍스트만 남깁니다.
   *
   * @param content - XML이 포함된 원본 텍스트
   * @returns XML이 제거된 순수 텍스트
   */
  static stripToolCalls(content: string): string {
    return content.replace(TOOL_CALL_PATTERN, "").trim();
  }
}

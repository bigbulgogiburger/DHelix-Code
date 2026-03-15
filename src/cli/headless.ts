/**
 * headless.ts — UI 없이 실행하는 헤드리스(Headless) 모드
 *
 * `dbcode -p "질문"` 처럼 -p 플래그로 실행할 때 사용됩니다.
 * Ink UI를 띄우지 않고, 프롬프트를 에이전트 루프에 직접 전달하여
 * 결과를 stdout으로 출력합니다. 스크립트나 파이프라인에서 활용하기 좋습니다.
 *
 * 출력 형식:
 * - "text": 일반 텍스트 (기본값)
 * - "json": 구조화된 JSON
 * - "stream-json": NDJSON (줄 단위 JSON 스트리밍)
 */
import { type LLMProvider, type ChatMessage } from "../llm/provider.js";
import { type ToolCallStrategy } from "../llm/tool-call-strategy.js";
import { type ToolRegistry } from "../tools/registry.js";
import { runAgentLoop } from "../core/agent-loop.js";
import { buildSystemPrompt } from "../core/system-prompt-builder.js";
import { loadInstructions } from "../instructions/loader.js";
import { createEventEmitter } from "../utils/events.js";
import { getModelCapabilities } from "../llm/model-capabilities.js";
import { MemoryManager } from "../memory/manager.js";

/** 헤드리스 모드의 출력 형식 — text(기본), json(구조화), stream-json(스트리밍) */
export type HeadlessOutputFormat = "text" | "json" | "stream-json";

/**
 * 헤드리스 실행에 필요한 옵션
 *
 * @param prompt - 사용자가 입력한 프롬프트 문자열
 * @param client - LLM API와 통신하는 프로바이더
 * @param model - 사용할 모델명
 * @param strategy - 도구 호출 전략
 * @param toolRegistry - 사용 가능한 도구 레지스트리
 * @param outputFormat - 출력 형식 (text, json, stream-json)
 * @param workingDirectory - 작업 디렉토리 경로
 * @param maxIterations - 에이전트 루프 최대 반복 횟수
 */
export interface HeadlessOptions {
  /** 사용자 프롬프트 */
  readonly prompt: string;
  /** LLM 프로바이더 */
  readonly client: LLMProvider;
  /** 모델명 */
  readonly model: string;
  /** 도구 호출 전략 */
  readonly strategy: ToolCallStrategy;
  /** 도구 레지스트리 */
  readonly toolRegistry: ToolRegistry;
  /** 출력 형식 */
  readonly outputFormat: HeadlessOutputFormat;
  /** 작업 디렉토리 */
  readonly workingDirectory?: string;
  /** 최대 에이전트 반복 횟수 */
  readonly maxIterations?: number;
}

/** JSON 형식 출력의 구조체 — result, model, iterations, aborted 필드를 포함 */
interface HeadlessJsonOutput {
  readonly result: string;
  readonly model: string;
  readonly iterations: number;
  readonly aborted: boolean;
}

/**
 * 헤드리스 모드로 dbcode를 실행합니다 (대화형 UI 없이).
 *
 * `-p` 플래그로 스크립팅 및 파이프 출력에 사용됩니다.
 * 시스템 프롬프트를 구성하고, 에이전트 루프를 실행한 뒤,
 * 결과를 stdout에 직접 출력하고 종료합니다.
 *
 * 동작 흐름:
 * 1. 프로젝트 지침(DBCODE.md 등)과 자동 메모리를 로드
 * 2. 시스템 프롬프트를 빌드하고 사용자 메시지와 함께 에이전트 루프 실행
 * 3. 마지막 어시스턴트 응답을 outputFormat에 맞게 stdout에 출력
 */
export async function runHeadless(options: HeadlessOptions): Promise<void> {
  const {
    prompt,
    client,
    model,
    strategy,
    toolRegistry,
    outputFormat,
    workingDirectory,
    maxIterations,
  } = options;

  const events = createEventEmitter();
  const cwd = workingDirectory ?? process.cwd();
  const instructions = await loadInstructions(cwd).catch(() => null);

  // 현재 프로젝트의 자동 메모리(이전 대화에서 저장한 기억)를 로드
  const memoryManager = new MemoryManager(cwd);
  const memoryResult = await memoryManager.loadMemory().catch(() => null);
  const autoMemoryContent = memoryResult?.content ?? "";

  const systemPrompt = buildSystemPrompt({
    toolRegistry,
    workingDirectory,
    projectInstructions: instructions?.combined,
    autoMemoryContent: autoMemoryContent || undefined,
  });

  const initialMessages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: prompt },
  ];

  // 헤드리스 모드에서는 사용자 입력을 받을 수 없으므로 ask_user에 자동 응답
  events.on("ask_user:prompt", (data) => {
    const answer = data.choices?.length
      ? String(data.choices[0])
      : "[No interactive input available in headless mode]";

    events.emit("ask_user:response", {
      toolCallId: data.toolCallId,
      answer,
    });

    // 선택한 출력 형식에 맞게 질문과 자동 응답을 표시
    switch (outputFormat) {
      case "text":
        process.stdout.write(`[Question] ${data.question}\n[Auto-answer] ${answer}\n`);
        break;
      case "json":
        // json 모드는 최종 결과만 출력하므로 여기서는 stderr에 로그
        process.stderr.write(`[headless] ask_user auto-answered: ${answer}\n`);
        break;
      case "stream-json":
        process.stdout.write(
          JSON.stringify({
            type: "ask_user",
            question: data.question,
            choices: data.choices,
            autoAnswer: answer,
          }) + "\n",
        );
        break;
    }
  });

  // stream-json 형식일 때: 이벤트를 NDJSON(줄 단위 JSON) 줄로 실시간 출력
  if (outputFormat === "stream-json") {
    events.on("llm:text-delta", ({ text }) => {
      process.stdout.write(JSON.stringify({ type: "text-delta", text }) + "\n");
    });
    events.on("tool:start", ({ name, id }) => {
      process.stdout.write(JSON.stringify({ type: "tool-start", name, id }) + "\n");
    });
    events.on("tool:complete", ({ name, id, isError }) => {
      process.stdout.write(JSON.stringify({ type: "tool-complete", name, id, isError }) + "\n");
    });
  }

  const modelCaps = getModelCapabilities(model);
  const result = await runAgentLoop(
    {
      client,
      model,
      toolRegistry,
      strategy,
      events,
      maxIterations,
      workingDirectory,
      maxContextTokens: modelCaps.maxContextTokens,
    },
    initialMessages,
  );

  // 에이전트 루프 결과에서 마지막 어시스턴트 응답을 추출
  const lastAssistant = [...result.messages].reverse().find((m) => m.role === "assistant");
  const responseText = lastAssistant?.content ?? "";

  switch (outputFormat) {
    case "text":
      process.stdout.write(responseText + "\n");
      break;
    case "json": {
      const output: HeadlessJsonOutput = {
        result: responseText,
        model,
        iterations: result.iterations,
        aborted: result.aborted,
      };
      process.stdout.write(JSON.stringify(output, null, 2) + "\n");
      break;
    }
    case "stream-json":
      // Final result event
      process.stdout.write(
        JSON.stringify({
          type: "result",
          text: responseText,
          iterations: result.iterations,
          aborted: result.aborted,
        }) + "\n",
      );
      break;
  }
}

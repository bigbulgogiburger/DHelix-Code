/**
 * headless.ts — UI 없이 실행하는 헤드리스(Headless) 모드
 *
 * `dhelix -p "질문"` 처럼 -p 플래그로 실행할 때 사용됩니다.
 * Ink UI를 띄우지 않고, 프롬프트를 에이전트 루프에 직접 전달하여
 * 결과를 stdout으로 출력합니다. 스크립트나 파이프라인에서 활용하기 좋습니다.
 *
 * 출력 형식:
 * - "text": 일반 텍스트 (기본값)
 * - "json": 구조화된 JSON
 * - "stream-json": NDJSON (줄 단위 JSON 스트리밍)
 *
 * 안정성 기능 (HeadlessGuard):
 * - 에러 발생 시 stderr 출력 + exit(1) (silent exit 0 방지)
 * - 빈 응답 감지 시 자동 재시도 (최대 2회)
 * - ask_user 호출에 더 명확한 지시문 반환
 * - 부분 결과가 있으면 출력 후 종료
 */
import { type LLMProvider, type ChatMessage } from "../llm/provider.js";
import { type ToolCallStrategy } from "../llm/tool-call-strategy.js";
import { type ToolRegistry } from "../tools/registry.js";
import { runAgentLoop, type AgentLoopResult } from "../core/agent-loop.js";
import { buildSystemPrompt } from "../core/system-prompt-builder.js";
import { loadInstructions } from "../instructions/loader.js";
import { createEventEmitter } from "../utils/events.js";
import { createHookAdapter } from "../hooks/event-emitter-adapter.js";
import { type HookRunner } from "../hooks/runner.js";
import { getModelCapabilities } from "../llm/model-capabilities.js";
import { MemoryManager } from "../memory/manager.js";
import { type SessionManager } from "../core/session-manager.js";

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
  /** 현재 세션 ID (JSON 출력에 포함) */
  readonly sessionId?: string;
  /** 세션 재개 시 이전 대화 기록 (resume/continue 모드에서 주입) */
  readonly priorMessages?: readonly ChatMessage[];
  /** 세션 매니저 — 대화 결과를 세션에 저장하여 이후 resume 시 컨텍스트 유지 */
  readonly sessionManager?: SessionManager;
  /** Hook event adapter를 attach하기 위한 공유 HookRunner (없으면 훅 비활성) */
  readonly hookRunner?: HookRunner;
}

/** JSON 형식 출력의 구조체 — result, model, iterations, aborted, sessionId 필드를 포함 */
interface HeadlessJsonOutput {
  readonly result: string;
  readonly model: string;
  readonly iterations: number;
  readonly aborted: boolean;
  readonly sessionId?: string;
  readonly totalCost?: number;
  readonly error?: string;
}

/** 빈 응답 자동 재시도 최대 횟수 */
const MAX_EMPTY_RESPONSE_RETRIES = 2;

/**
 * 헤드리스 모드로 dhelix를 실행합니다 (대화형 UI 없이).
 *
 * `-p` 플래그로 스크립팅 및 파이프 출력에 사용됩니다.
 * 시스템 프롬프트를 구성하고, 에이전트 루프를 실행한 뒤,
 * 결과를 stdout에 직접 출력하고 종료합니다.
 *
 * 동작 흐름:
 * 1. 프로젝트 지침(DHELIX.md 등)과 자동 메모리를 로드
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
    sessionId,
    priorMessages,
    sessionManager,
    hookRunner,
  } = options;

  const events = createEventEmitter();
  const cwd = workingDirectory ?? process.cwd();

  // Wire Hook Event Adapter — AppEventEmitter 이벤트를 HookRunner로 중계한다.
  // Ink 경로(useAgentLoop.ts)와 대칭이며, 헤드리스는 try/finally로 detach를 보장한다.
  const hookAdapter = hookRunner
    ? createHookAdapter(events, hookRunner, {
        sessionId,
        workingDirectory: cwd,
      })
    : undefined;
  hookAdapter?.attach();

  try {
    await runHeadlessSession({
      prompt,
      client,
      model,
      strategy,
      toolRegistry,
      outputFormat,
      workingDirectory,
      maxIterations,
      sessionId,
      priorMessages,
      sessionManager,
      cwd,
      events,
    });
  } finally {
    hookAdapter?.detach();
  }
}

/**
 * 헤드리스 세션 본문 — 어댑터 라이프사이클 바깥에서 실제 에이전트 루프를 실행.
 * runHeadless에서 try/finally로 감싸 HookEventAdapter의 detach를 보장한다.
 */
interface HeadlessSessionOptions
  extends Omit<HeadlessOptions, "hookRunner"> {
  readonly cwd: string;
  readonly events: ReturnType<typeof createEventEmitter>;
}

async function runHeadlessSession(options: HeadlessSessionOptions): Promise<void> {
  const {
    prompt,
    client,
    model,
    strategy,
    toolRegistry,
    outputFormat,
    workingDirectory,
    maxIterations,
    sessionId,
    priorMessages,
    sessionManager,
    cwd,
    events,
  } = options;

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
    isHeadless: true,
  });

  // 세션 재개 시: 이전 대화 기록을 포함하여 컨텍스트 연속성 유지
  // priorMessages가 있으면 시스템 프롬프트 + 이전 기록 + 현재 프롬프트 순서로 구성
  const initialMessages: ChatMessage[] = priorMessages && priorMessages.length > 0
    ? [
        { role: "system", content: systemPrompt },
        ...priorMessages.filter((m) => m.role !== "system"),
        { role: "user", content: prompt },
      ]
    : [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ];

  // 헤드리스 모드에서는 사용자 입력을 받을 수 없으므로 ask_user에 자동 응답
  // HeadlessGuard: 더 명확한 지시문으로 LLM이 진행하도록 유도
  events.on("ask_user:prompt", (data) => {
    const answer = data.choices?.length
      ? String(data.choices[0])
      : "Headless mode: proceed with the most reasonable default. Do not ask further clarifying questions. Complete the task with your best judgment.";

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

  // HeadlessGuard: 에러 처리 강화 — silent exit 0 방지 + 부분 결과 출력
  let result: AgentLoopResult | undefined;
  let lastError: unknown;

  try {
    result = await runAgentLoop(
      {
        client,
        model,
        toolRegistry,
        strategy,
        events,
        maxIterations,
        workingDirectory,
        maxContextTokens: modelCaps.maxContextTokens,
        maxTokens: modelCaps.maxOutputTokens,
      },
      initialMessages,
    );
  } catch (error) {
    lastError = error;
    process.stderr.write(
      `[headless] Agent loop error: ${error instanceof Error ? error.message : String(error)}\n`,
    );
  }

  // HeadlessGuard: 빈 응답 감지 시 자동 재시도 (최대 MAX_EMPTY_RESPONSE_RETRIES 회)
  if (result) {
    let responseText = extractLastAssistantContent(result);

    if (responseText.trim() === "" && !result.aborted) {
      for (let retry = 0; retry < MAX_EMPTY_RESPONSE_RETRIES; retry++) {
        process.stderr.write(
          `[headless] Empty response detected, retrying (${retry + 1}/${MAX_EMPTY_RESPONSE_RETRIES})...\n`,
        );

        // 이전 결과의 메시지를 이어받아서 재시도 프롬프트 추가
        const retryMessages: ChatMessage[] = [
          ...result.messages,
          {
            role: "user",
            content:
              "[System] Your previous response was empty. Please complete the requested task. " +
              "Provide a substantive response.",
          },
        ];

        try {
          result = await runAgentLoop(
            {
              client,
              model,
              toolRegistry,
              strategy,
              events,
              maxIterations,
              workingDirectory,
              maxContextTokens: modelCaps.maxContextTokens,
              maxTokens: modelCaps.maxOutputTokens,
            },
            retryMessages,
          );
          responseText = extractLastAssistantContent(result);
          if (responseText.trim() !== "") break;
        } catch (error) {
          lastError = error;
          process.stderr.write(
            `[headless] Retry ${retry + 1} failed: ${error instanceof Error ? error.message : String(error)}\n`,
          );
          break;
        }
      }
    }
  }

  // 세션에 새 메시지 저장 — 다음 resume/continue 시 컨텍스트 연속성 보장
  if (result && sessionId && sessionManager) {
    // priorMessages에 없는 새 메시지만 추출하여 저장
    const priorCount = priorMessages ? priorMessages.filter((m) => m.role !== "system").length : 0;
    const allNonSystem = result.messages.filter((m) => m.role !== "system");
    const newMessages = allNonSystem.slice(priorCount);
    if (newMessages.length > 0) {
      sessionManager.appendMessages(sessionId, newMessages).catch((err: unknown) => {
        process.stderr.write(
          `[headless] Failed to save session messages: ${err instanceof Error ? err.message : String(err)}\n`,
        );
      });
    }
  }

  // HeadlessGuard: 결과 출력 (에러 발생 시에도 부분 결과가 있으면 출력)
  if (result) {
    emitHeadlessOutput(result, model, outputFormat, sessionId);
  } else {
    // 에이전트 루프 자체가 실패한 경우 — 에러 정보와 함께 종료
    const errorMsg =
      lastError instanceof Error ? lastError.message : String(lastError ?? "Unknown error");
    emitHeadlessErrorOutput(errorMsg, model, outputFormat);
    process.exitCode = 1;
  }
}

/**
 * 에이전트 루프 결과에서 마지막 어시스턴트 응답 텍스트를 추출합니다.
 */
function extractLastAssistantContent(result: AgentLoopResult): string {
  const lastAssistant = [...result.messages].reverse().find((m) => m.role === "assistant");
  return lastAssistant?.content ?? "";
}

/**
 * 정상 결과를 outputFormat에 맞게 stdout에 출력합니다.
 */
function emitHeadlessOutput(
  result: AgentLoopResult,
  model: string,
  outputFormat: HeadlessOutputFormat,
  sessionId?: string,
): void {
  const responseText = extractLastAssistantContent(result);

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
        ...(sessionId !== undefined && { sessionId }),
      };
      process.stdout.write(JSON.stringify(output, null, 2) + "\n");
      break;
    }
    case "stream-json":
      process.stdout.write(
        JSON.stringify({
          type: "result",
          text: responseText,
          iterations: result.iterations,
          aborted: result.aborted,
          ...(sessionId !== undefined && { sessionId }),
        }) + "\n",
      );
      break;
  }
}

/**
 * HeadlessGuard: 에러 발생 시 outputFormat에 맞게 에러 정보를 출력합니다.
 * silent exit 0을 방지하고, 에러 정보를 항상 출력하여 문제를 진단할 수 있게 합니다.
 */
function emitHeadlessErrorOutput(
  errorMessage: string,
  model: string,
  outputFormat: HeadlessOutputFormat,
): void {
  switch (outputFormat) {
    case "text":
      process.stderr.write(`[headless] Fatal error: ${errorMessage}\n`);
      break;
    case "json": {
      const output: HeadlessJsonOutput = {
        result: "",
        model,
        iterations: 0,
        aborted: true,
        error: errorMessage,
      };
      process.stdout.write(JSON.stringify(output, null, 2) + "\n");
      break;
    }
    case "stream-json":
      process.stdout.write(
        JSON.stringify({
          type: "error",
          error: errorMessage,
        }) + "\n",
      );
      break;
  }
}

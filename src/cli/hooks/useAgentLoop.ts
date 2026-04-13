/**
 * useAgentLoop.ts — 에이전트 루프를 관리하는 핵심 React 훅
 *
 * 사용자 입력을 받아 LLM에 전달하고, 도구 호출을 처리하고,
 * 결과를 대화 히스토리에 저장하는 전체 에이전트 사이클을 관리합니다.
 *
 * 이 훅이 담당하는 역할:
 * - 대화 히스토리 관리 (useConversation)
 * - LLM 스트리밍 텍스트 버퍼링 (useTextBuffering)
 * - 시스템 프롬프트 빌드 (프로젝트 지침, 스킬, 메모리, 레포맵 포함)
 * - 에이전트 루프 실행 및 결과 처리
 * - 활동(Activity) 추적 및 UI 상태 동기화
 * - 토큰 사용량 및 비용 추적
 * - 슬래시 명령 처리 위임
 * - 메시지 큐잉 (에이전트 실행 중 추가 입력 대기)
 * - AbortController를 통한 취소 지원 (Escape)
 * - MCP 도구 검색 연동
 *
 * 상태 흐름:
 * 사용자 입력 → handleSubmit → (슬래시 명령?) → processMessage
 *   → buildSystemPrompt → runAgentLoop → 결과 저장 → UI 업데이트
 */
import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useConversation } from "./useConversation.js";
import { useTextBuffering } from "./useTextBuffering.js";
import { type LLMProvider, type ChatMessage } from "../../llm/provider.js";
import { createLLMClientForModel } from "../../llm/client-factory.js";
import { type ToolCallStrategy, selectStrategy } from "../../llm/tool-call-strategy.js";
import { type ToolRegistry } from "../../tools/registry.js";
import { type PermissionResult, runAgentLoop } from "../../core/agent-loop.js";
import { type ContextManager } from "../../core/context-manager.js";
import { type HookRunner } from "../../hooks/runner.js";
import { type SessionManager } from "../../core/session-manager.js";
import { CheckpointManager } from "../../core/checkpoint-manager.js";
import { type SkillManager } from "../../skills/manager.js";
import { type CommandRegistry, type InteractiveSelect } from "../../commands/registry.js";
import { type ExtractedToolCall } from "../../tools/types.js";
import { type MCPManagerConnector } from "../../mcp/manager-connector.js";
import { SESSIONS_DIR } from "../../constants.js";
import { join } from "node:path";
import { buildSystemPrompt } from "../../core/system-prompt-builder.js";
import { loadInstructions } from "../../instructions/loader.js";
import { getModelCapabilities } from "../../llm/model-capabilities.js";
import { calculateThinkingBudget } from "../../llm/thinking-budget.js";
import { createEventEmitter } from "../../utils/events.js";
import { createHookAdapter } from "../../hooks/event-emitter-adapter.js";
import { ActivityCollector, type TurnActivity } from "../../core/activity.js";
import { MemoryManager } from "../../memory/manager.js";
import { metrics, COUNTERS } from "../../telemetry/metrics.js";
import { spawnSubagent, type SubagentType } from "../../subagents/spawner.js";

/**
 * useAgentLoop 훅의 옵션 인터페이스
 * App.tsx에서 필요한 의존성을 모두 전달받습니다.
 */
export interface UseAgentLoopOptions {
  readonly client: LLMProvider;
  readonly model: string;
  readonly toolRegistry: ToolRegistry;
  readonly strategy: ToolCallStrategy;
  readonly commandRegistry?: CommandRegistry;
  readonly contextManager?: ContextManager;
  readonly hookRunner?: HookRunner;
  readonly sessionManager?: SessionManager;
  readonly skillManager?: SkillManager;
  readonly sessionId?: string;
  readonly checkPermission: (call: ExtractedToolCall) => Promise<PermissionResult>;
  readonly initialLocale?: string;
  readonly initialTone?: string;
  readonly mcpConnector?: MCPManagerConnector;
  readonly mcpManager?: import("../../mcp/manager.js").MCPManager;
  readonly thinkingEnabled?: boolean;
}

/**
 * 에이전트 루프 관리 훅 — 사용자 입력부터 LLM 응답까지의 전체 사이클을 담당
 *
 * 반환값:
 * - isProcessing: 에이전트가 현재 처리 중인지 여부
 * - streamingText: LLM이 스트리밍 중인 텍스트
 * - completedTurns: 완료된 대화 턴 목록
 * - currentTurn/liveTurn: 현재 진행 중인 턴 데이터
 * - handleSubmit: 사용자 입력 처리 함수
 * - error/commandOutput: 에러 및 명령 출력
 * - tokenCount/inputTokens/outputTokens/totalCost: 토큰 및 비용 추적
 * - activeModel: 현재 사용 중인 모델명
 * - events: 이벤트 이미터
 * - messageQueueRef: 대기 중인 메시지 큐
 * - interactiveSelect: 대화형 선택 UI 데이터
 */
export function useAgentLoop({
  client,
  model: initialModel,
  toolRegistry,
  strategy: _initialStrategy,
  commandRegistry,
  contextManager,
  hookRunner,
  sessionManager,
  skillManager,
  sessionId,
  checkPermission,
  initialLocale = "ko",
  initialTone = "normal",
  mcpConnector,
  mcpManager,
  thinkingEnabled = false,
}: UseAgentLoopOptions) {
  const {
    conversation,
    addUserMessage,
    addAssistantMessage,
    addToolResults,
    reset: clearConversation,
  } = useConversation("main");

  const [isProcessing, setIsProcessing] = useState(false);
  // LLM이 최종 응답(도구 호출 없이 끝나는 응답)을 스트리밍 중인지 여부
  // true이면 AgentStatus 스피너를 숨기고 스트리밍 텍스트를 표시한다
  const [isStreamingFinal, setIsStreamingFinal] = useState(false);
  const [agentPhase, setAgentPhase] = useState<
    "idle" | "llm-thinking" | "llm-streaming" | "tools-running" | "tools-done"
  >("idle");
  const {
    text: streamingText,
    appendText,
    flush: flushText,
    reset: resetText,
  } = useTextBuffering(100);
  const [error, setError] = useState<string | null>(null);
  const [tokenCount, setTokenCount] = useState(0);
  const [commandOutput, setCommandOutput] = useState<string | null>(null);
  const [activeModel, setActiveModel] = useState(initialModel);
  // Strategy must be recalculated when activeModel changes (e.g., via /model command)
  // to prevent strategy/model mismatch (GPT strategy used with Claude model)
  const activeStrategy = useMemo(() => selectStrategy(activeModel), [activeModel]);
  const [interactiveSelect, setInteractiveSelect] = useState<InteractiveSelect | null>(null);

  // Track whether session has been auto-named (first user message triggers naming)
  const sessionNamedRef = useRef(false);

  // 프로바이더 전환 지원 — client를 ref로 관리하여 /model에서 동적 교체 가능
  // useRef는 초기값만 사용하므로, 부모가 client prop을 변경하면 동기화 필요
  const clientRef = useRef<LLMProvider>(client);
  useEffect(() => {
    clientRef.current = client;
  }, [client]);

  // ask_user 도구가 사용자에게 질문을 보냈을 때의 대기 상태
  const [pendingAskUser, setPendingAskUser] = useState<{
    readonly toolCallId: string;
    readonly question: string;
    readonly choices?: readonly string[];
  } | null>(null);

  // 재시도 대기 중일 때 카운트다운 정보 — RetryCountdown 컴포넌트에 전달
  const [retryInfo, setRetryInfo] = useState<{
    readonly delayMs: number;
    readonly reason: string;
    readonly attempt: number;
    readonly maxRetries: number;
  } | null>(null);

  // Tone and locale state (wired through to buildSystemPrompt)
  const [currentTone, setCurrentTone] = useState(initialTone);
  const [currentLocale] = useState(initialLocale);

  // Token usage and cost tracking
  const [inputTokens, setInputTokens] = useState(0);
  const [outputTokens, setOutputTokens] = useState(0);
  const [totalCost, setTotalCost] = useState(0);
  const prevUsageRef = useRef({ prompt: 0, completion: 0 });

  // Streaming output tracking for long-running tools (e.g., bash_exec)
  const streamingOutputsRef = useRef<Map<string, string>>(new Map());

  // Accumulated thinking content for Extended Thinking (streamed via llm:thinking-delta)
  const thinkingContentRef = useRef<string>("");

  // AbortController for cancelling the agent loop (P0-3)
  const abortControllerRef = useRef<AbortController | null>(null);

  // Track whether MCP tool search has been wired up (P0-6)
  const mcpReadyRef = useRef(false);

  // Activity tracking
  const activityRef = useRef(new ActivityCollector());
  const [completedTurns, setCompletedTurns] = useState<readonly TurnActivity[]>([]);
  const [currentTurn, setCurrentTurn] = useState<TurnActivity | null>(null);

  // Project instructions
  const [projectInstructions, setProjectInstructions] = useState<string | undefined>(undefined);

  // Auto-memory content
  const [autoMemoryContent, setAutoMemoryContent] = useState<string | undefined>(undefined);

  // Repo map content (built async on mount)
  const [repoMapContent, setRepoMapContent] = useState<string | undefined>(undefined);

  useEffect(() => {
    loadInstructions(process.cwd())
      .then((result) => {
        if (result.combined) {
          setProjectInstructions(result.combined);
        }
      })
      .catch(() => {});

    // Load auto-memory for the current project
    const memoryManager = new MemoryManager(process.cwd());
    memoryManager
      .loadMemory()
      .then((result) => {
        if (result.content) {
          setAutoMemoryContent(result.content);
        }
      })
      .catch(() => {});

    // Build repo map asynchronously (non-blocking, optional feature)
    import("../../indexing/repo-map.js")
      .then(async ({ buildRepoMap, renderRepoMap }) => {
        const map = await buildRepoMap(process.cwd());
        if (map.totalFiles > 0) {
          const rendered = renderRepoMap(map);
          setRepoMapContent(rendered);
        }
      })
      .catch(() => {
        // Repo map is optional — silently ignore errors
      });
  }, []);

  // Wire MCP tool search into the tool registry
  useEffect(() => {
    if (mcpConnector) {
      toolRegistry.setToolSearch(mcpConnector.getToolSearch());
      mcpReadyRef.current = true;
    }
  }, [mcpConnector, toolRegistry]);

  // Message queue
  const messageQueueRef = useRef<string[]>([]);

  const events = useMemo(() => createEventEmitter(), []);

  // Checkpoint manager for auto-checkpointing file mutations
  const checkpointManager = useMemo(
    () => (sessionId ? new CheckpointManager(join(SESSIONS_DIR, sessionId)) : undefined),
    [sessionId],
  );

  /** Sync current turn snapshot from ActivityCollector to React state */
  const syncCurrentTurn = useCallback(() => {
    setCurrentTurn(activityRef.current.getCurrentTurn());
  }, []);

  // Wire up event listeners for activity tracking + text buffering
  useEffect(() => {
    const onToolStart = ({
      name,
      id,
      args,
    }: {
      name: string;
      id: string;
      args?: Record<string, unknown>;
    }) => {
      activityRef.current.addEntry("tool-start", { name, id, args, startTime: Date.now() });
      syncCurrentTurn();
    };
    const onToolComplete = ({
      id,
      name,
      isError,
      output,
      metadata,
    }: {
      name: string;
      id: string;
      isError: boolean;
      output?: string;
      metadata?: Readonly<Record<string, unknown>>;
    }) => {
      streamingOutputsRef.current.delete(id);
      activityRef.current.addEntry("tool-complete", { name, id, isError, output, metadata });
      syncCurrentTurn();
    };
    const onToolOutputDelta = ({ id, chunk }: { id: string; name: string; chunk: string }) => {
      const current = streamingOutputsRef.current.get(id) ?? "";
      streamingOutputsRef.current.set(id, current + chunk);
      syncCurrentTurn();
    };
    const onThinkingDelta = ({ text }: { text: string }) => {
      thinkingContentRef.current += text;
      activityRef.current.addEntry("thinking", {
        content: thinkingContentRef.current,
        isStreaming: true,
        isComplete: false,
      });
      syncCurrentTurn();
    };
    const onTextDelta = ({ text }: { text: string }) => {
      appendText(text);
      setAgentPhase("llm-streaming");
    };
    const onAssistantMessage = ({
      content,
      toolCalls,
      iteration,
      isFinal,
    }: {
      content: string;
      toolCalls: readonly { readonly id: string; readonly name: string }[];
      iteration: number;
      isFinal: boolean;
    }) => {
      // Flush accumulated thinking content as a completed entry
      if (thinkingContentRef.current) {
        activityRef.current.addEntry("thinking", {
          content: thinkingContentRef.current,
          isStreaming: false,
          isComplete: true,
        });
        thinkingContentRef.current = "";
        syncCurrentTurn();
      }

      // 최종 응답이면 스피너를 숨기고 스트리밍 텍스트를 표시한다
      // isFinal = true: 도구 호출 없이 끝나는 최종 응답
      // isFinal = false: 이후 도구 호출이 따라오는 중간 응답
      setIsStreamingFinal(isFinal);
      if (isFinal) {
        setAgentPhase("idle");
      }

      // Only track intermediate messages (those followed by tool calls).
      // The final message is already handled after runAgentLoop returns.
      if (!isFinal && content) {
        activityRef.current.addEntry("assistant-intermediate", {
          content,
          toolCalls: toolCalls.map((tc) => ({ id: tc.id, name: tc.name })),
          iteration,
          isComplete: true,
        });
        syncCurrentTurn();
      }
    };

    // ask_user 도구가 사용자에게 질문을 보낼 때 UI에 표시
    const onAskUserPrompt = (data: {
      toolCallId: string;
      question: string;
      choices?: readonly string[];
    }) => {
      setPendingAskUser(data);
    };

    // 재시도 대기 시작 시 카운트다운 정보를 설정
    const onAgentRetry = (data: {
      delayMs: number;
      reason: string;
      attempt: number;
      maxRetries: number;
    }) => {
      setRetryInfo(data);
    };

    // LLM 호출 시작 시 재시도 카운트다운을 해제 (다음 반복 시작)
    const onLlmStart = () => {
      setRetryInfo(null);
      setAgentPhase("llm-thinking");
      setIsStreamingFinal(false);
    };

    const onToolsExecuting = () => {
      setAgentPhase("tools-running");
    };
    const onToolsDone = () => {
      setAgentPhase("tools-done");
    };

    events.on("tool:start", onToolStart);
    events.on("tool:complete", onToolComplete);
    events.on("tool:output-delta", onToolOutputDelta);
    events.on("llm:thinking-delta", onThinkingDelta);
    events.on("llm:text-delta", onTextDelta);
    events.on("agent:assistant-message", onAssistantMessage);
    events.on("ask_user:prompt", onAskUserPrompt);
    events.on("agent:retry", onAgentRetry);
    events.on("llm:start", onLlmStart);
    events.on("agent:tools-executing", onToolsExecuting);
    events.on("agent:tools-done", onToolsDone);
    return () => {
      events.off("tool:start", onToolStart);
      events.off("tool:complete", onToolComplete);
      events.off("tool:output-delta", onToolOutputDelta);
      events.off("llm:thinking-delta", onThinkingDelta);
      events.off("llm:text-delta", onTextDelta);
      events.off("agent:assistant-message", onAssistantMessage);
      events.off("ask_user:prompt", onAskUserPrompt);
      events.off("agent:retry", onAgentRetry);
      events.off("llm:start", onLlmStart);
      events.off("agent:tools-executing", onToolsExecuting);
      events.off("agent:tools-done", onToolsDone);
    };
  }, [events, appendText, syncCurrentTurn]);

  // Wire up Hook Event Adapter — connects AppEventEmitter to HookRunner
  useEffect(() => {
    if (!hookRunner) return;

    const adapter = createHookAdapter(events, hookRunner, {
      sessionId,
      workingDirectory: process.cwd(),
    });
    adapter.attach();

    return () => {
      adapter.detach();
    };
  }, [events, hookRunner, sessionId]);

  // P0-3: Wire up input:abort event to abort the current agent loop
  useEffect(() => {
    const handleAbort = () => {
      abortControllerRef.current?.abort();
    };
    events.on("input:abort", handleAbort);
    return () => {
      events.off("input:abort", handleAbort);
    };
  }, [events]);

  // Wire up usage tracking: listen for agent:usage-update events
  useEffect(() => {
    const handleUsageUpdate = (data: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      iteration: number;
    }) => {
      const deltaPrompt = data.promptTokens - prevUsageRef.current.prompt;
      const deltaCompletion = data.completionTokens - prevUsageRef.current.completion;
      prevUsageRef.current = { prompt: data.promptTokens, completion: data.completionTokens };

      setInputTokens(data.promptTokens);
      setOutputTokens(data.completionTokens);

      metrics.increment(COUNTERS.tokensUsed, deltaPrompt, { type: "input", model: activeModel });
      metrics.increment(COUNTERS.tokensUsed, deltaCompletion, {
        type: "output",
        model: activeModel,
      });

      const caps = getModelCapabilities(activeModel);
      const pricing = caps.pricing;
      const deltaCost =
        (deltaPrompt / 1_000_000) * pricing.inputPerMillion +
        (deltaCompletion / 1_000_000) * pricing.outputPerMillion;
      setTotalCost((prev) => prev + deltaCost);
      metrics.increment(COUNTERS.tokenCost, deltaCost, { model: activeModel });
    };

    events.on("agent:usage-update", handleUsageUpdate);
    return () => {
      events.off("agent:usage-update", handleUsageUpdate);
    };
  }, [events, activeModel]);

  /** Process a single user message through the agent loop */
  const processMessage = useCallback(
    async (input: string) => {
      addUserMessage(input);
      setIsProcessing(true);
      resetText();
      setError(null);
      setCommandOutput(null);
      thinkingContentRef.current = "";

      // P0-3: Create a new AbortController for this agent loop run
      const controller = new AbortController();
      abortControllerRef.current = controller;

      // P0-6: Ensure MCP tool search is wired up before processing
      // The useEffect that normally does this is async and may not have fired yet
      if (mcpConnector && !mcpReadyRef.current) {
        toolRegistry.setToolSearch(mcpConnector.getToolSearch());
        mcpReadyRef.current = true;
      }

      // Start a new turn
      activityRef.current.startTurn();
      activityRef.current.addEntry("user-message", { content: input });
      syncCurrentTurn();

      // Run UserPromptSubmit hooks
      if (hookRunner) {
        const hookResult = await hookRunner.run("UserPromptSubmit", {
          event: "UserPromptSubmit",
          sessionId,
          workingDirectory: process.cwd(),
          data: { input },
        });
        if (hookResult.blocked) {
          setError(`Blocked by hook: ${hookResult.blockReason ?? "Unknown reason"}`);
          setIsProcessing(false);
          setIsStreamingFinal(false);
          setAgentPhase("idle");
          return;
        }
      }

      const modelCaps = getModelCapabilities(activeModel);
      const systemPrompt = buildSystemPrompt({
        toolRegistry,
        workingDirectory: process.cwd(),
        projectInstructions,
        skillsPromptSection: skillManager?.buildPromptSection() ?? undefined,
        autoMemoryContent,
        repoMapContent,
        locale: currentLocale,
        tone: currentTone,
        capabilityTier: modelCaps.capabilityTier,
      });

      let finalSystemPrompt = systemPrompt;
      if (mcpConnector) {
        const mcpSections = mcpConnector.generateSystemPromptSections();
        if (mcpSections.deferredTools) {
          finalSystemPrompt += "\n\n" + mcpSections.deferredTools;
        }
      }

      let messages: ChatMessage[] = [
        { role: "system", content: finalSystemPrompt },
        ...conversation.toMessagesForLLM().map((m) => ({
          role: m.role as ChatMessage["role"],
          content: m.content,
          toolCallId: m.tool_call_id,
          toolCalls: m.tool_calls ? [...m.tool_calls] : undefined,
        })),
        { role: "user" as const, content: input },
      ];

      if (contextManager) {
        messages = [...(await contextManager.prepare(messages))];
      }

      try {
        const initialMessageCount = messages.length;

        // Calculate thinking config if enabled and model supports it
        const contextUsagePercent = contextManager
          ? contextManager.getUsage(messages).usageRatio * 100
          : 0;
        const thinkingConfig =
          thinkingEnabled && modelCaps.supportsThinking
            ? {
                type: "enabled" as const,
                budget_tokens: calculateThinkingBudget(modelCaps, contextUsagePercent),
              }
            : undefined;

        // Apply effort level to maxTokens — /effort command adjusts reasoning depth
        // "low" = 1024, "medium" = 2048, "high" = 4096 (default), "max" = 8192
        // Cap at model's maxOutputTokens to avoid API errors
        const { getEffortLevel, getEffortConfig } = await import("../../commands/effort.js");
        const effortConfig = getEffortConfig(getEffortLevel());
        const effectiveMaxTokens = Math.min(effortConfig.maxTokens, modelCaps.maxOutputTokens);

        const result = await runAgentLoop(
          {
            client: clientRef.current,
            model: activeModel,
            toolRegistry,
            strategy: activeStrategy,
            events,
            useStreaming: true,
            maxContextTokens: modelCaps.maxContextTokens,
            maxTokens: effectiveMaxTokens,
            checkPermission,
            checkpointManager,
            sessionId,
            thinking: thinkingConfig,
            signal: controller.signal,
          },
          messages,
        );

        flushText();

        // Extract only messages generated by the agent loop (after initial messages)
        const newMessages = result.messages.slice(initialMessageCount);

        // Add the final assistant text as an activity entry
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage && lastMessage.role === "assistant") {
          activityRef.current.addEntry("assistant-text", {
            content: lastMessage.content,
            isComplete: true,
          });
        }

        // Save ALL new messages to conversation, preserving proper
        // assistant(toolCalls) → tool results ordering.
        // This ensures the next turn has a valid message history.
        let i = 0;
        while (i < newMessages.length) {
          const msg = newMessages[i];
          if (msg.role === "assistant") {
            addAssistantMessage(msg.content, msg.toolCalls ?? []);
            setTokenCount((prev) => prev + clientRef.current.countTokens(msg.content));
            i++;

            // Collect subsequent tool messages belonging to this assistant
            const toolResults: { id: string; output: string; isError: boolean }[] = [];
            while (i < newMessages.length && newMessages[i].role === "tool") {
              const toolMsg = newMessages[i];
              toolResults.push({
                id: toolMsg.toolCallId ?? "",
                output: toolMsg.content,
                isError: toolMsg.content.startsWith("Error:"),
              });
              i++;
            }
            if (toolResults.length > 0) {
              addToolResults(toolResults);
            }
          } else {
            i++;
          }
        }

        // Persist to session
        if (sessionManager && sessionId) {
          const sessionMessages: ChatMessage[] = [{ role: "user", content: input }];
          for (const msg of newMessages) {
            if (msg.role === "assistant" || msg.role === "tool") {
              sessionMessages.push({
                role: msg.role as ChatMessage["role"],
                content: msg.content,
                toolCallId: msg.toolCallId,
                toolCalls: msg.toolCalls,
              });
            }
          }
          sessionManager.appendMessages(sessionId, sessionMessages).catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : String(err);
            process.stderr.write(`[session-save] Failed to persist messages: ${msg}\n`);
          });

          // Auto-name session from first user message (so /resume shows meaningful names)
          if (!sessionNamedRef.current) {
            sessionNamedRef.current = true;
            sessionManager.autoNameSession(sessionId, input).catch(() => {});
          }
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        const errorCause =
          err && typeof err === "object" && "context" in err
            ? (err as { context: Record<string, unknown> }).context.cause
            : undefined;
        setError(errorCause ? `${errorMsg}: ${errorCause}` : errorMsg);
      } finally {
        // P0-3: Clear abort controller reference after loop completes
        abortControllerRef.current = null;

        if (hookRunner) {
          await hookRunner.run("Stop", {
            event: "Stop",
            sessionId,
            workingDirectory: process.cwd(),
          });
        }

        setIsProcessing(false);
        setIsStreamingFinal(false);
        setAgentPhase("idle");
        setRetryInfo(null);
        resetText();

        activityRef.current.completeTurn();
        setCompletedTurns(activityRef.current.getCompletedTurns());
        setCurrentTurn(null);

        const nextMessage = messageQueueRef.current.shift();
        if (nextMessage) {
          void processMessage(nextMessage);
        }
      }
    },
    [
      conversation,
      addUserMessage,
      addAssistantMessage,
      addToolResults,
      clientRef,
      activeModel,
      toolRegistry,
      activeStrategy,
      contextManager,
      hookRunner,
      sessionManager,
      skillManager,
      sessionId,
      events,
      projectInstructions,
      autoMemoryContent,
      repoMapContent,
      currentTone,
      currentLocale,
      flushText,
      resetText,
      syncCurrentTurn,
      checkPermission,
      checkpointManager,
      mcpConnector,
      thinkingEnabled,
    ],
  );

  // Wire up skill:fork event — spawn a subagent when a fork skill is executed
  useEffect(() => {
    const handleSkillFork = (data: {
      readonly prompt: string;
      readonly model?: string;
      readonly agentType?: SubagentType;
      readonly allowedTools?: readonly string[];
    }) => {
      const subagentModel = data.model ?? activeModel;
      const subagentStrategy = selectStrategy(subagentModel);

      void spawnSubagent({
        type: data.agentType ?? "general",
        prompt: data.prompt,
        client: clientRef.current,
        model: subagentModel,
        strategy: subagentStrategy,
        toolRegistry,
        workingDirectory: process.cwd(),
        allowedTools: data.allowedTools,
        parentEvents: events,
        signal: abortControllerRef.current?.signal,
        checkPermission,
        sessionId,
        locale: currentLocale,
        tone: currentTone,
        projectInstructions,
        autoMemoryContent,
        repoMapContent,
      })
        .then((result) => {
          if (result.response) {
            void processMessage(`[Subagent (${result.type}) completed]\n\n${result.response}`);
          }
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          setError(`Subagent fork failed: ${msg}`);
        });
    };

    events.on("skill:fork", handleSkillFork);
    return () => {
      events.off("skill:fork", handleSkillFork);
    };
  }, [
    events,
    activeModel,
    toolRegistry,
    checkPermission,
    sessionId,
    currentLocale,
    currentTone,
    projectInstructions,
    autoMemoryContent,
    repoMapContent,
    processMessage,
  ]);

  const handleSubmit = useCallback(
    async (input: string) => {
      // Handle slash commands
      if (commandRegistry && commandRegistry.isCommand(input)) {
        const result = await commandRegistry.execute(input, {
          workingDirectory: process.cwd(),
          sessionId,
          model: activeModel,
          emit: events.emit as (event: string, data?: unknown) => void,
          messages: conversation.messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          mcpManager,
        });

        if (result) {
          // Skill commands with shouldInjectAsUserMessage bypass display
          // and send the expanded prompt through the agent loop
          if (result.shouldInjectAsUserMessage && result.success) {
            // Apply skill model override if specified
            if (result.modelOverride) {
              if (result.newProvider) {
                clientRef.current = createLLMClientForModel(result.newProvider);
              }
              setActiveModel(result.modelOverride);
            }
            void processMessage(result.output);
            return;
          }

          if (result.interactiveSelect) {
            setInteractiveSelect(result.interactiveSelect);
            return;
          }

          setCommandOutput(result.output);

          if (result.shouldClear) {
            clearConversation();
          }
          if (result.newProvider) {
            // 프로바이더 전환: model + baseURL + apiKey 3종 세트 교체
            clientRef.current = createLLMClientForModel(result.newProvider);
            setActiveModel(result.newProvider.model);
          } else if (result.newModel) {
            setActiveModel(result.newModel);
          }
          if (result.newTone) {
            setCurrentTone(result.newTone);
          }
          if (result.newPermissionMode) {
            events.emit("permission:mode-change", { mode: result.newPermissionMode });
          }
          if (result.voiceEnabled !== undefined) {
            events.emit("voice:toggle", { enabled: result.voiceEnabled });
          }
          if (result.refreshInstructions) {
            loadInstructions(process.cwd())
              .then((instrResult) => {
                if (instrResult.combined) {
                  setProjectInstructions(instrResult.combined);
                }
              })
              .catch(() => {});
          }
          if (result.shouldCompact && contextManager) {
            try {
              const messagesToCompact = conversation.messages.map((m) => ({
                role: m.role,
                content: m.content,
              }));
              const compacted = await contextManager.manualCompact(
                messagesToCompact as import("../../llm/provider.js").ChatMessage[],
                result.compactFocusTopic,
              );
              setCommandOutput(
                `Compacted: ${compacted.result.originalTokens} → ${compacted.result.compactedTokens} tokens (${compacted.result.removedMessages} messages removed)`,
              );
            } catch (err) {
              setCommandOutput(
                `Compaction failed: ${err instanceof Error ? err.message : String(err)}`,
              );
            }
          }
        }
        return;
      }

      // If processing, queue the message
      if (isProcessing) {
        messageQueueRef.current.push(input);
        return;
      }

      void processMessage(input);
    },
    [
      commandRegistry,
      sessionId,
      activeModel,
      events,
      conversation.messages,
      isProcessing,
      processMessage,
      clearConversation,
      contextManager,
      mcpManager,
    ],
  );

  // Build current turn snapshot including live streaming text
  const liveTurn = useMemo((): TurnActivity | null => {
    if (!currentTurn) return null;
    if (streamingText) {
      return {
        ...currentTurn,
        entries: [
          ...currentTurn.entries,
          {
            type: "assistant-text" as const,
            timestamp: new Date(),
            data: { content: streamingText, isComplete: false },
          },
        ],
      };
    }
    return currentTurn;
  }, [currentTurn, streamingText]);

  return {
    isProcessing,
    streamingText,
    isStreamingFinal,
    agentPhase,
    completedTurns,
    currentTurn,
    liveTurn,
    handleSubmit,
    error,
    commandOutput,
    tokenCount,
    activeModel,
    events,
    messageQueueRef,
    inputTokens,
    outputTokens,
    totalCost,
    interactiveSelect,
    setInteractiveSelect,
    retryInfo,
    pendingAskUser,
    setPendingAskUser,
    streamingOutputs: streamingOutputsRef,
  } as const;
}

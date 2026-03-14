import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useConversation } from "./useConversation.js";
import { useTextBuffering } from "./useTextBuffering.js";
import { type LLMProvider, type ChatMessage } from "../../llm/provider.js";
import { type ToolCallStrategy } from "../../llm/tool-call-strategy.js";
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
import { ActivityCollector, type TurnActivity } from "../../core/activity.js";
import { MemoryManager } from "../../memory/manager.js";
import { metrics, COUNTERS } from "../../telemetry/metrics.js";

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
  readonly thinkingEnabled?: boolean;
}

export function useAgentLoop({
  client,
  model: initialModel,
  toolRegistry,
  strategy,
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
  const [interactiveSelect, setInteractiveSelect] = useState<InteractiveSelect | null>(null);

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

  // Activity tracking
  const activityRef = useRef(new ActivityCollector());
  const [completedTurns, setCompletedTurns] = useState<readonly TurnActivity[]>([]);
  const [currentTurn, setCurrentTurn] = useState<TurnActivity | null>(null);

  // Project instructions
  const [projectInstructions, setProjectInstructions] = useState<string | undefined>(undefined);

  // Auto-memory content
  const [autoMemoryContent, setAutoMemoryContent] = useState<string | undefined>(undefined);

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
  }, []);

  // Wire MCP tool search into the tool registry
  useEffect(() => {
    if (mcpConnector) {
      toolRegistry.setToolSearch(mcpConnector.getToolSearch());
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
    const onTextDelta = ({ text }: { text: string }) => {
      appendText(text);
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

    events.on("tool:start", onToolStart);
    events.on("tool:complete", onToolComplete);
    events.on("tool:output-delta", onToolOutputDelta);
    events.on("llm:text-delta", onTextDelta);
    events.on("agent:assistant-message", onAssistantMessage);
    return () => {
      events.off("tool:start", onToolStart);
      events.off("tool:complete", onToolComplete);
      events.off("tool:output-delta", onToolOutputDelta);
      events.off("llm:text-delta", onTextDelta);
      events.off("agent:assistant-message", onAssistantMessage);
    };
  }, [events, appendText, syncCurrentTurn]);

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
        const thinkingConfig = thinkingEnabled && modelCaps.supportsThinking
          ? { type: "enabled" as const, budget_tokens: calculateThinkingBudget(modelCaps) }
          : undefined;

        const result = await runAgentLoop(
          {
            client,
            model: activeModel,
            toolRegistry,
            strategy,
            events,
            useStreaming: true,
            maxContextTokens: modelCaps.maxContextTokens,
            checkPermission,
            checkpointManager,
            sessionId,
            thinking: thinkingConfig,
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
            setTokenCount((prev) => prev + client.countTokens(msg.content));
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
          void sessionManager.appendMessages(sessionId, sessionMessages);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        const errorCause =
          err && typeof err === "object" && "context" in err
            ? (err as { context: Record<string, unknown> }).context.cause
            : undefined;
        setError(errorCause ? `${errorMsg}: ${errorCause}` : errorMsg);
      } finally {
        if (hookRunner) {
          await hookRunner.run("Stop", {
            event: "Stop",
            sessionId,
            workingDirectory: process.cwd(),
          });
        }

        setIsProcessing(false);
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
      client,
      activeModel,
      toolRegistry,
      strategy,
      contextManager,
      hookRunner,
      sessionManager,
      skillManager,
      sessionId,
      events,
      projectInstructions,
      autoMemoryContent,
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
        });

        if (result) {
          // Skill commands with shouldInjectAsUserMessage bypass display
          // and send the expanded prompt through the agent loop
          if (result.shouldInjectAsUserMessage && result.success) {
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
          if (result.newModel) {
            setActiveModel(result.newModel);
          }
          if (result.newTone) {
            setCurrentTone(result.newTone);
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
    streamingOutputs: streamingOutputsRef,
  } as const;
}

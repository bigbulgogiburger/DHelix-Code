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
import { type CommandRegistry } from "../../commands/registry.js";
import { type ExtractedToolCall } from "../../tools/types.js";
import { buildSystemPrompt } from "../../core/system-prompt-builder.js";
import { loadInstructions } from "../../instructions/loader.js";
import { getModelCapabilities } from "../../llm/model-capabilities.js";
import { createEventEmitter } from "../../utils/events.js";
import { ActivityCollector, type TurnActivity } from "../../core/activity.js";

export interface UseAgentLoopOptions {
  readonly client: LLMProvider;
  readonly model: string;
  readonly toolRegistry: ToolRegistry;
  readonly strategy: ToolCallStrategy;
  readonly commandRegistry?: CommandRegistry;
  readonly contextManager?: ContextManager;
  readonly hookRunner?: HookRunner;
  readonly sessionManager?: SessionManager;
  readonly sessionId?: string;
  readonly checkPermission: (call: ExtractedToolCall) => Promise<PermissionResult>;
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
  sessionId,
  checkPermission,
}: UseAgentLoopOptions) {
  const {
    conversation,
    addUserMessage,
    addAssistantMessage,
    addToolResults,
    reset: clearConversation,
  } = useConversation("main");

  const [isProcessing, setIsProcessing] = useState(false);
  const { text: streamingText, appendText, flush: flushText, reset: resetText } = useTextBuffering(100);
  const [error, setError] = useState<string | null>(null);
  const [tokenCount, setTokenCount] = useState(0);
  const [commandOutput, setCommandOutput] = useState<string | null>(null);
  const [activeModel, setActiveModel] = useState(initialModel);

  // Activity tracking
  const activityRef = useRef(new ActivityCollector());
  const [completedTurns, setCompletedTurns] = useState<readonly TurnActivity[]>([]);
  const [currentTurn, setCurrentTurn] = useState<TurnActivity | null>(null);

  // Project instructions
  const [projectInstructions, setProjectInstructions] = useState<string | undefined>(undefined);

  useEffect(() => {
    loadInstructions(process.cwd())
      .then((result) => {
        if (result.combined) {
          setProjectInstructions(result.combined);
        }
      })
      .catch(() => {});
  }, []);

  // Message queue
  const messageQueueRef = useRef<string[]>([]);

  const events = useMemo(() => createEventEmitter(), []);

  /** Sync current turn snapshot from ActivityCollector to React state */
  const syncCurrentTurn = useCallback(() => {
    setCurrentTurn(activityRef.current.getCurrentTurn());
  }, []);

  // Wire up event listeners for activity tracking + text buffering
  useEffect(() => {
    const onToolStart = ({ name, id, args }: { name: string; id: string; args?: Record<string, unknown> }) => {
      activityRef.current.addEntry("tool-start", { name, id, args, startTime: Date.now() });
      syncCurrentTurn();
    };
    const onToolComplete = ({ id, name, isError, output }: { name: string; id: string; isError: boolean; output?: string }) => {
      activityRef.current.addEntry("tool-complete", { name, id, isError, output });
      syncCurrentTurn();
    };
    const onTextDelta = ({ text }: { text: string }) => {
      appendText(text);
    };

    events.on("tool:start", onToolStart);
    events.on("tool:complete", onToolComplete);
    events.on("llm:text-delta", onTextDelta);
    return () => {
      events.off("tool:start", onToolStart);
      events.off("tool:complete", onToolComplete);
      events.off("llm:text-delta", onTextDelta);
    };
  }, [events, appendText, syncCurrentTurn]);

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

      const systemPrompt = buildSystemPrompt({
        toolRegistry,
        workingDirectory: process.cwd(),
        projectInstructions,
      });

      let messages: ChatMessage[] = [
        { role: "system", content: systemPrompt },
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
        const modelCaps = getModelCapabilities(activeModel);
        const initialMessageCount = messages.length;

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
          const sessionMessages: ChatMessage[] = [
            { role: "user", content: input },
          ];
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
      sessionId,
      events,
      projectInstructions,
      flushText,
      resetText,
      syncCurrentTurn,
      checkPermission,
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
          setCommandOutput(result.output);

          if (result.shouldClear) {
            clearConversation();
          }
          if (result.newModel) {
            setActiveModel(result.newModel);
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
          { type: "assistant-text" as const, timestamp: new Date(), data: { content: streamingText, isComplete: false } },
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
  } as const;
}

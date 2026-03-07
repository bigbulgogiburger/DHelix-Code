import { Box, Text } from "ink";
import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { UserInput } from "./components/UserInput.js";
import { Spinner } from "./components/Spinner.js";
import { StatusBar } from "./components/StatusBar.js";
import { Logo } from "./components/Logo.js";
import { ErrorBanner } from "./components/ErrorBanner.js";
import { PermissionPrompt } from "./components/PermissionPrompt.js";
import { SlashCommandMenu } from "./components/SlashCommandMenu.js";
import { ActivityFeed } from "./components/ActivityFeed.js";
import { useConversation } from "./hooks/useConversation.js";
import { useTextBuffering } from "./hooks/useTextBuffering.js";
import { useKeybindings, type Keybinding } from "./hooks/useKeybindings.js";
import { TaskListView } from "./components/TaskListView.js";
import { type LLMProvider, type ChatMessage } from "../llm/provider.js";
import { buildSystemPrompt } from "../core/system-prompt-builder.js";
import { loadInstructions } from "../instructions/loader.js";
import { runAgentLoop, type PermissionResult } from "../core/agent-loop.js";
import { type ToolRegistry } from "../tools/registry.js";
import { type ToolCallStrategy } from "../llm/tool-call-strategy.js";
import { type PermissionManager } from "../permissions/manager.js";
import { type ExtractedToolCall } from "../tools/types.js";
import { type CommandRegistry } from "../commands/registry.js";
import { type ContextManager } from "../core/context-manager.js";
import { getModelCapabilities } from "../llm/model-capabilities.js";
import { type HookRunner } from "../hooks/runner.js";
import { type Task } from "../core/task-manager.js";
import { type SessionManager } from "../core/session-manager.js";
import { createEventEmitter } from "../utils/events.js";
import { ActivityCollector, type TurnActivity } from "../core/activity.js";

interface AppProps {
  readonly client: LLMProvider;
  readonly model: string;
  readonly toolRegistry: ToolRegistry;
  readonly strategy: ToolCallStrategy;
  readonly permissionManager: PermissionManager;
  readonly commandRegistry?: CommandRegistry;
  readonly contextManager?: ContextManager;
  readonly hookRunner?: HookRunner;
  readonly sessionManager?: SessionManager;
  readonly tasks?: readonly Task[];
  readonly sessionId?: string;
  readonly showStatusBar?: boolean;
}

/** Pending permission request */
interface PendingPermission {
  readonly call: ExtractedToolCall;
  readonly resolve: (result: PermissionResult) => void;
}

/** Root application component */
export function App({
  client,
  model: initialModel,
  toolRegistry,
  strategy,
  permissionManager,
  commandRegistry,
  contextManager,
  hookRunner,
  sessionManager,
  tasks,
  sessionId,
  showStatusBar = true,
}: AppProps) {
  const {
    conversation,
    addUserMessage,
    addAssistantMessage,
    addToolResults,
    reset: clearConversation,
  } = useConversation("main");
  const [isProcessing, setIsProcessing] = useState(false);
  const { text: streamingText, appendText, flush: flushText, reset: resetText } = useTextBuffering(50);
  const [error, setError] = useState<string | null>(null);
  const [tokenCount, setTokenCount] = useState(0);
  const [pendingPermission, setPendingPermission] = useState<PendingPermission | null>(null);
  const [commandOutput, setCommandOutput] = useState<string | null>(null);
  const [activeModel, setActiveModel] = useState(initialModel);

  // Activity tracking — collects turn-by-turn events for the ActivityFeed
  const activityRef = useRef(new ActivityCollector());
  const [completedTurns, setCompletedTurns] = useState<readonly TurnActivity[]>([]);
  const [currentTurn, setCurrentTurn] = useState<TurnActivity | null>(null);

  // Project instructions loaded from DBCODE.md and .dbcode/rules/
  const [projectInstructions, setProjectInstructions] = useState<string | undefined>(undefined);

  // Load instructions on mount
  useEffect(() => {
    loadInstructions(process.cwd())
      .then((result) => {
        if (result.combined) {
          setProjectInstructions(result.combined);
        }
      })
      .catch(() => {
        // Silently ignore — instructions are optional
      });
  }, []);

  // Message queue — allows typing while LLM is responding (FIFO)
  const messageQueueRef = useRef<string[]>([]);

  const events = useMemo(() => createEventEmitter(), []);

  // Track current input value for slash command menu
  const [inputValue, setInputValue] = useState("");
  const slashMenuVisible = !isProcessing && !pendingPermission && inputValue.startsWith("/") && !inputValue.includes(" ");

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

  // Register keybindings
  const keybindings = useMemo<Keybinding[]>(
    () => [
      {
        key: "c",
        ctrl: true,
        handler: () => {
          if (isProcessing) {
            events.emit("input:abort", undefined);
          }
        },
      },
    ],
    [isProcessing, events],
  );
  useKeybindings(keybindings, !pendingPermission);

  /** Process a single user message through the agent loop */
  const processMessage = useCallback(
    async (input: string) => {
      addUserMessage(input);
      setIsProcessing(true);
      resetText();
      setError(null);
      setCommandOutput(null);

      // Start a new turn and record the user message
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
        })),
        { role: "user" as const, content: input },
      ];

      // Apply context management if available
      if (contextManager) {
        messages = [...(await contextManager.prepare(messages))];
      }

      try {
        const modelCaps = getModelCapabilities(activeModel);
        const result = await runAgentLoop(
          {
            client,
            model: activeModel,
            toolRegistry,
            strategy,
            events,
            useStreaming: true,
            maxContextTokens: modelCaps.maxContextTokens,
            checkPermission: async (call) => {
              const tool = toolRegistry.get(call.name);
              if (!tool) {
                return { allowed: false, reason: "Unknown tool" };
              }

              const check = permissionManager.check(
                call.name,
                tool.permissionLevel,
                call.arguments,
              );
              if (check.allowed) {
                return { allowed: true };
              }

              if (check.requiresPrompt) {
                return new Promise<PermissionResult>((resolve) => {
                  setPendingPermission({ call, resolve });
                });
              }

              return { allowed: false, reason: check.reason ?? "Denied by mode" };
            },
          },
          messages,
        );

        // Flush remaining buffered text
        flushText();

        // Record assistant text in activity feed
        const lastMessage = result.messages[result.messages.length - 1];
        if (lastMessage && lastMessage.role === "assistant") {
          activityRef.current.addEntry("assistant-text", {
            content: lastMessage.content,
            isComplete: true,
          });

          // Store in conversation WITH tool calls preserved
          addAssistantMessage(lastMessage.content, lastMessage.toolCalls ?? []);
          setTokenCount((prev) => prev + client.countTokens(lastMessage.content));

          // Also store tool result messages in conversation
          const toolMessages = result.messages.filter((m) => m.role === "tool");
          if (toolMessages.length > 0) {
            addToolResults(
              toolMessages.map((m) => ({
                id: m.toolCallId ?? "",
                output: m.content,
                isError: m.content.startsWith("Error:"),
              })),
            );
          }
        }

        // Persist full message history to session (including tool calls)
        if (sessionManager && sessionId) {
          const sessionMessages: ChatMessage[] = [
            { role: "user", content: input },
          ];
          // Include all assistant and tool messages from the agent loop
          for (const msg of result.messages) {
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
        // Run Stop hooks
        if (hookRunner) {
          await hookRunner.run("Stop", {
            event: "Stop",
            sessionId,
            workingDirectory: process.cwd(),
          });
        }

        setIsProcessing(false);
        resetText();

        // Complete the current turn and update feed
        activityRef.current.completeTurn();
        setCompletedTurns(activityRef.current.getCompletedTurns());
        setCurrentTurn(null);

        // Process queued messages
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
      permissionManager,
      contextManager,
      hookRunner,
      sessionManager,
      sessionId,
      events,
      projectInstructions,
      flushText,
      resetText,
      syncCurrentTurn,
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

  const handlePermissionResponse = useCallback(
    (response: "yes" | "no" | "always") => {
      if (!pendingPermission) return;
      const { call, resolve } = pendingPermission;
      setPendingPermission(null);

      if (response === "yes") {
        permissionManager.approve(call.name, call.arguments);
        resolve({ allowed: true });
      } else if (response === "always") {
        permissionManager.approveAll(call.name);
        resolve({ allowed: true });
      } else {
        resolve({ allowed: false, reason: "User denied" });
      }
    },
    [pendingPermission, permissionManager],
  );

  // Build current turn snapshot including live streaming text
  const liveTurn = useMemo((): TurnActivity | null => {
    if (!currentTurn) return null;
    // Append live streaming text as a transient entry
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

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Logo modelName={activeModel} />
      </Box>

      <ActivityFeed completedTurns={completedTurns} currentTurn={liveTurn} />

      {isProcessing && !streamingText && !currentTurn?.entries.some((e) => e.type === "tool-start") ? (
        <Box marginY={1}>
          <Spinner label="Thinking..." />
        </Box>
      ) : null}

      {pendingPermission ? (
        <PermissionPrompt
          toolName={pendingPermission.call.name}
          description={`Arguments: ${JSON.stringify(pendingPermission.call.arguments)}`}
          onResponse={handlePermissionResponse}
        />
      ) : null}

      {commandOutput ? (
        <Box marginY={1}>
          <Text>{commandOutput}</Text>
        </Box>
      ) : null}

      {error ? <ErrorBanner message={error} /> : null}

      {tasks && tasks.length > 0 ? <TaskListView tasks={tasks} title="Tasks" /> : null}

      <Box marginTop={1}>
        <UserInput
          onSubmit={handleSubmit}
          onChange={setInputValue}
          slashMenuVisible={slashMenuVisible}
        />
      </Box>

      {slashMenuVisible && commandRegistry ? (
        <SlashCommandMenu
          commands={commandRegistry.getAll()}
          prefix={inputValue}
          visible={slashMenuVisible}
          onSelect={(name) => {
            setInputValue("");
            void handleSubmit("/" + name);
          }}
          onClose={() => setInputValue("")}
        />
      ) : null}

      {messageQueueRef.current.length > 0 ? (
        <Box>
          <Text color="gray">({messageQueueRef.current.length} message(s) queued)</Text>
        </Box>
      ) : null}

      {showStatusBar ? (
        <StatusBar
          model={activeModel}
          modelName={activeModel}
          tokenCount={tokenCount}
          maxTokens={getModelCapabilities(activeModel).maxContextTokens}
          isStreaming={isProcessing}
        />
      ) : null}
    </Box>
  );
}

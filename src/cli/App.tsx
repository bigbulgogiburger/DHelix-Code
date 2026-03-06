import { Box, Text } from "ink";
import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { MessageList } from "./components/MessageList.js";
import { StreamingMessage } from "./components/StreamingMessage.js";
import { UserInput } from "./components/UserInput.js";
import { Spinner } from "./components/Spinner.js";
import { StatusBar } from "./components/StatusBar.js";
import { Logo } from "./components/Logo.js";
import { ErrorBanner } from "./components/ErrorBanner.js";
import { ToolCallBlock } from "./components/ToolCallBlock.js";
import { PermissionPrompt } from "./components/PermissionPrompt.js";
import { useConversation } from "./hooks/useConversation.js";
import { useKeybindings, type Keybinding } from "./hooks/useKeybindings.js";
import { TaskListView } from "./components/TaskListView.js";
import { type LLMProvider, type ChatMessage } from "../llm/provider.js";
import { buildSystemPrompt } from "../core/system-prompt-builder.js";
import { loadInstructions } from "../instructions/loader.js";
import { runAgentLoop, type PermissionResult } from "../core/agent-loop.js";
import { type AnyMessage, MessageRole } from "../core/message-types.js";
import { type ToolRegistry } from "../tools/registry.js";
import { type ToolCallStrategy } from "../llm/tool-call-strategy.js";
import { type PermissionManager } from "../permissions/manager.js";
import { type ExtractedToolCall } from "../tools/types.js";
import { type CommandRegistry } from "../commands/registry.js";
import { type ContextManager } from "../core/context-manager.js";
import { type HookRunner } from "../hooks/runner.js";
import { type Task } from "../core/task-manager.js";
import { type SessionManager } from "../core/session-manager.js";
import { createEventEmitter } from "../utils/events.js";
import { VERSION } from "../constants.js";

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

/** Active tool call display state */
interface ToolCallDisplay {
  readonly id: string;
  readonly name: string;
  readonly status: "running" | "complete" | "error" | "denied";
  readonly output?: string;
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
    reset: clearConversation,
  } = useConversation("main");
  const [isProcessing, setIsProcessing] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [tokenCount, setTokenCount] = useState(0);
  const [toolCalls, setToolCalls] = useState<readonly ToolCallDisplay[]>([]);
  const [pendingPermission, setPendingPermission] = useState<PendingPermission | null>(null);
  const [commandOutput, setCommandOutput] = useState<string | null>(null);
  const [activeModel, setActiveModel] = useState(initialModel);

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

  // Wire up event listeners for live tool call display
  useEffect(() => {
    const onToolStart = ({ name, id }: { name: string; id: string }) => {
      setToolCalls((prev) => [...prev, { id, name, status: "running" }]);
    };
    const onToolComplete = ({ id, isError }: { name: string; id: string; isError: boolean }) => {
      setToolCalls((prev) =>
        prev.map((tc) => (tc.id === id ? { ...tc, status: isError ? "error" : "complete" } : tc)),
      );
    };

    const onTextDelta = ({ text }: { text: string }) => {
      setStreamingText((prev) => prev + text);
    };

    events.on("tool:start", onToolStart);
    events.on("tool:complete", onToolComplete);
    events.on("llm:text-delta", onTextDelta);
    return () => {
      events.off("tool:start", onToolStart);
      events.off("tool:complete", onToolComplete);
      events.off("llm:text-delta", onTextDelta);
    };
  }, [events]);

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
      setStreamingText("");
      setError(null);
      setToolCalls([]);
      setCommandOutput(null);

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
        messages = [...contextManager.prepare(messages)];
      }

      try {
        const result = await runAgentLoop(
          {
            client,
            model: activeModel,
            toolRegistry,
            strategy,
            events,
            useStreaming: true,
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

        // Extract the final assistant message
        const lastMessage = result.messages[result.messages.length - 1];
        if (lastMessage && lastMessage.role === "assistant") {
          addAssistantMessage(lastMessage.content);
          setTokenCount((prev) => prev + client.countTokens(lastMessage.content));
        }

        // Persist to session
        if (sessionManager && sessionId) {
          void sessionManager.appendMessages(sessionId, [
            { role: "user", content: input },
            ...(lastMessage && lastMessage.role === "assistant"
              ? [{ role: "assistant" as const, content: lastMessage.content }]
              : []),
          ]);
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
        setStreamingText("");

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

  // Filter completed messages (exclude system)
  const completedMessages = conversation.messages.filter(
    (msg): msg is AnyMessage => msg.role !== MessageRole.System,
  );

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Logo />
        <Box flexDirection="column" justifyContent="center" marginLeft={2}>
          <Text color="cyan" bold>
            dbcode
          </Text>
          <Text color="gray">
            v{VERSION} ({activeModel})
          </Text>
        </Box>
      </Box>

      <MessageList messages={completedMessages} />

      {toolCalls.map((tc) => (
        <ToolCallBlock key={tc.id} name={tc.name} status={tc.status} output={tc.output} />
      ))}

      {isProcessing ? (
        <Box flexDirection="column" marginY={1}>
          {streamingText ? <StreamingMessage text={streamingText} isComplete={false} /> : null}
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
        <UserInput onSubmit={handleSubmit} isDisabled={false} />
      </Box>

      {messageQueueRef.current.length > 0 ? (
        <Box>
          <Text color="gray">({messageQueueRef.current.length} message(s) queued)</Text>
        </Box>
      ) : null}

      {showStatusBar ? (
        <StatusBar
          model={activeModel}
          tokenCount={tokenCount}
          maxTokens={128_000}
          isStreaming={isProcessing}
        />
      ) : null}
    </Box>
  );
}

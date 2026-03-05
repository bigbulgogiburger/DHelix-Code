import { Box, Text } from "ink";
import { useState, useCallback, useMemo } from "react";
import { MessageList } from "./components/MessageList.js";
import { StreamingMessage } from "./components/StreamingMessage.js";
import { UserInput } from "./components/UserInput.js";
import { Spinner } from "./components/Spinner.js";
import { StatusBar } from "./components/StatusBar.js";
import { ErrorBanner } from "./components/ErrorBanner.js";
import { ToolCallBlock } from "./components/ToolCallBlock.js";
import { PermissionPrompt } from "./components/PermissionPrompt.js";
import { useConversation } from "./hooks/useConversation.js";
import { type LLMProvider, type ChatMessage } from "../llm/provider.js";
import { buildSystemPrompt } from "../core/system-prompt-builder.js";
import { runAgentLoop, type PermissionResult } from "../core/agent-loop.js";
import { type AnyMessage, MessageRole } from "../core/message-types.js";
import { type ToolRegistry } from "../tools/registry.js";
import { type ToolCallStrategy } from "../llm/tool-call-strategy.js";
import { type PermissionManager } from "../permissions/manager.js";
import { type ExtractedToolCall } from "../tools/types.js";
import { createEventEmitter } from "../utils/events.js";

interface AppProps {
  readonly client: LLMProvider;
  readonly model: string;
  readonly toolRegistry: ToolRegistry;
  readonly strategy: ToolCallStrategy;
  readonly permissionManager: PermissionManager;
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
  model,
  toolRegistry,
  strategy,
  permissionManager,
  showStatusBar = true,
}: AppProps) {
  const { conversation, addUserMessage, addAssistantMessage } = useConversation("main");
  const [isProcessing, setIsProcessing] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [tokenCount, setTokenCount] = useState(0);
  const [toolCalls, setToolCalls] = useState<readonly ToolCallDisplay[]>([]);
  const [pendingPermission, setPendingPermission] = useState<PendingPermission | null>(null);

  const events = useMemo(() => createEventEmitter(), []);

  const handleSubmit = useCallback(
    async (input: string) => {
      addUserMessage(input);
      setIsProcessing(true);
      setStreamingText("");
      setError(null);
      setToolCalls([]);

      const systemPrompt = buildSystemPrompt({
        toolRegistry,
      });

      const messages: ChatMessage[] = [
        { role: "system", content: systemPrompt },
        ...conversation.toMessagesForLLM().map((m) => ({
          role: m.role as ChatMessage["role"],
          content: m.content,
        })),
        { role: "user" as const, content: input },
      ];

      try {
        const result = await runAgentLoop(
          {
            client,
            model,
            toolRegistry,
            strategy,
            events,
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
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsProcessing(false);
        setStreamingText("");
      }
    },
    [
      conversation,
      addUserMessage,
      addAssistantMessage,
      client,
      model,
      toolRegistry,
      strategy,
      permissionManager,
      events,
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
        <Text color="cyan" bold>
          dbcode
        </Text>
        <Text color="gray"> v0.1.0 </Text>
        <Text color="gray">({model})</Text>
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

      {error ? <ErrorBanner message={error} /> : null}

      <Box marginTop={1}>
        <UserInput onSubmit={handleSubmit} isDisabled={isProcessing} />
      </Box>

      {showStatusBar ? (
        <StatusBar
          model={model}
          tokenCount={tokenCount}
          maxTokens={128_000}
          isStreaming={isProcessing}
        />
      ) : null}
    </Box>
  );
}

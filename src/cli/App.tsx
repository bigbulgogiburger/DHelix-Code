import { Box, Text } from "ink";
import { useState, useCallback } from "react";
import { MessageList } from "./components/MessageList.js";
import { StreamingMessage } from "./components/StreamingMessage.js";
import { UserInput } from "./components/UserInput.js";
import { Spinner } from "./components/Spinner.js";
import { StatusBar } from "./components/StatusBar.js";
import { ErrorBanner } from "./components/ErrorBanner.js";
import { useConversation } from "./hooks/useConversation.js";
import { useStreaming } from "./hooks/useStreaming.js";
import { type LLMProvider, type ChatMessage } from "../llm/provider.js";
import { buildSystemPrompt } from "../core/system-prompt-builder.js";
import { type AnyMessage, MessageRole } from "../core/message-types.js";

interface AppProps {
  readonly client: LLMProvider;
  readonly model: string;
  readonly showStatusBar?: boolean;
}

/** Root application component */
export function App({ client, model, showStatusBar = true }: AppProps) {
  const { conversation, addUserMessage, addAssistantMessage } = useConversation("main");
  const { streamingText, isStreaming, error, sendMessage } = useStreaming({
    client,
    model,
  });
  const [tokenCount, setTokenCount] = useState(0);

  const handleSubmit = useCallback(
    async (input: string) => {
      addUserMessage(input);

      const systemPrompt = buildSystemPrompt();
      const messages: ChatMessage[] = [
        { role: "system", content: systemPrompt },
        ...conversation.toMessagesForLLM().map((m) => ({
          role: m.role as ChatMessage["role"],
          content: m.content,
        })),
        { role: "user" as const, content: input },
      ];

      const result = await sendMessage(messages);
      if (result.text) {
        addAssistantMessage(result.text);
        setTokenCount((prev) => prev + client.countTokens(result.text));
      }
    },
    [conversation, addUserMessage, addAssistantMessage, sendMessage, client],
  );

  // Filter completed messages (exclude current streaming)
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

      {isStreaming ? (
        <Box flexDirection="column" marginY={1}>
          <StreamingMessage text={streamingText} isComplete={false} />
          <Spinner label="Thinking..." />
        </Box>
      ) : null}

      {error ? <ErrorBanner message={error} /> : null}

      <Box marginTop={1}>
        <UserInput onSubmit={handleSubmit} isDisabled={isStreaming} />
      </Box>

      {showStatusBar ? (
        <StatusBar
          model={model}
          tokenCount={tokenCount}
          maxTokens={128_000}
          isStreaming={isStreaming}
        />
      ) : null}
    </Box>
  );
}

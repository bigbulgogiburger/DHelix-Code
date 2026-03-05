import { Box, Text, Static } from "ink";
import { type AnyMessage, MessageRole } from "../../core/message-types.js";
import { renderMarkdown } from "../renderer/markdown.js";

interface MessageListProps {
  readonly messages: readonly AnyMessage[];
  readonly enableMarkdown?: boolean;
}

/** Display completed conversation messages */
export function MessageList({ messages, enableMarkdown = true }: MessageListProps) {
  return (
    <Static items={messages.map((msg, i) => ({ ...msg, key: `msg-${i}` }))}>
      {(msg) => (
        <Box key={msg.key} flexDirection="column" marginBottom={1}>
          <MessageItem message={msg} enableMarkdown={enableMarkdown} />
        </Box>
      )}
    </Static>
  );
}

interface MessageItemProps {
  readonly message: AnyMessage;
  readonly enableMarkdown: boolean;
}

function MessageItem({ message, enableMarkdown }: MessageItemProps) {
  const roleColor = getRoleColor(message.role);

  const content =
    enableMarkdown && message.role === MessageRole.Assistant
      ? renderMarkdown(message.content)
      : message.content;

  return (
    <>
      <Text color={roleColor} bold>
        {message.role}:{" "}
      </Text>
      <Text>{content}</Text>
    </>
  );
}

function getRoleColor(role: string): string {
  switch (role) {
    case MessageRole.User:
      return "blue";
    case MessageRole.Assistant:
      return "green";
    case MessageRole.System:
      return "gray";
    case MessageRole.Tool:
      return "yellow";
    default:
      return "white";
  }
}

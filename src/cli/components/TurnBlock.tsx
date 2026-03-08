import { Box, Text } from "ink";
import React from "react";
import { type TurnActivity, type ActivityEntry } from "../../core/activity.js";
import { ToolCallBlock } from "./ToolCallBlock.js";
import { StreamingMessage } from "./StreamingMessage.js";

interface TurnBlockProps {
  readonly turn: TurnActivity;
  readonly isLive?: boolean;
}

function getToolStatus(entry: ActivityEntry): "running" | "complete" | "error" | "denied" {
  switch (entry.type) {
    case "tool-start":
      return "running";
    case "tool-complete":
      return entry.data.isError ? "error" : "complete";
    case "tool-denied":
      return "denied";
    default:
      return "complete";
  }
}

function findStartTime(entries: readonly ActivityEntry[], toolId: string | undefined): number | undefined {
  if (!toolId) return undefined;
  const startEntry = entries.find(
    (e) => e.type === "tool-start" && e.data.id === toolId,
  );
  return typeof startEntry?.data.startTime === "number" ? startEntry.data.startTime : undefined;
}

function renderEntry(entry: ActivityEntry, index: number, isLive: boolean, allEntries: readonly ActivityEntry[]): React.ReactNode {
  switch (entry.type) {
    case "user-message":
      return (
        <Box key={`entry-${index}`} marginBottom={0}>
          <Text color="green" bold>
            {">"}{" "}
          </Text>
          <Text>{String(entry.data.content ?? "")}</Text>
        </Box>
      );

    case "assistant-text":
      return (
        <StreamingMessage
          key={`entry-${index}`}
          text={String(entry.data.content ?? "")}
          isComplete={!isLive || entry.data.isComplete === true}
        />
      );

    case "assistant-intermediate":
      return (
        <StreamingMessage
          key={`entry-${index}`}
          text={String(entry.data.content ?? "")}
          isComplete={true}
        />
      );

    case "tool-start":
    case "tool-complete":
    case "tool-denied": {
      const toolId = typeof entry.data.id === "string" ? entry.data.id : undefined;
      const startTime = entry.type === "tool-start"
        ? (typeof entry.data.startTime === "number" ? entry.data.startTime : undefined)
        : findStartTime(allEntries, toolId);
      return (
        <ToolCallBlock
          key={`entry-${index}`}
          name={String(entry.data.name ?? "")}
          status={getToolStatus(entry)}
          args={entry.data.args as Record<string, unknown> | undefined}
          output={typeof entry.data.output === "string" ? entry.data.output : undefined}
          startTime={startTime}
        />
      );
    }

    case "error":
      return (
        <Box key={`entry-${index}`} marginLeft={2}>
          <Text color="red">{String(entry.data.message ?? "Unknown error")}</Text>
        </Box>
      );

    default:
      return null;
  }
}

/** Renders a single turn: user message + assistant responses + tool calls */
export const TurnBlock = React.memo(function TurnBlock({ turn, isLive = false }: TurnBlockProps) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      {turn.entries.map((entry, i) => renderEntry(entry, i, isLive, turn.entries))}
    </Box>
  );
});

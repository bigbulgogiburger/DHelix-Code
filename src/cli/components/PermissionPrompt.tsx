import { Box, Text, useInput } from "ink";
import { useState } from "react";

interface PermissionPromptProps {
  readonly toolName: string;
  readonly description: string;
  readonly onResponse: (response: "yes" | "no" | "always") => void;
}

/** Permission confirmation prompt [y/n/a] */
export function PermissionPrompt({ toolName, description, onResponse }: PermissionPromptProps) {
  const [answered, setAnswered] = useState(false);

  useInput(
    (input) => {
      if (answered) return;
      const key = input.toLowerCase();
      if (key === "y") {
        setAnswered(true);
        onResponse("yes");
      } else if (key === "n") {
        setAnswered(true);
        onResponse("no");
      } else if (key === "a") {
        setAnswered(true);
        onResponse("always");
      }
    },
    { isActive: !answered },
  );

  if (answered) {
    return null;
  }

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="yellow" paddingX={1}>
      <Text color="yellow" bold>
        Permission required
      </Text>
      <Box marginTop={0}>
        <Text>
          Tool: <Text bold>{toolName}</Text>
        </Text>
      </Box>
      <Text color="gray">{description}</Text>
      <Box marginTop={0}>
        <Text>
          Allow? [<Text color="green">y</Text>]es / [<Text color="red">n</Text>]o / [
          <Text color="cyan">a</Text>]lways
        </Text>
      </Box>
    </Box>
  );
}

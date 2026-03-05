import { Box, Text } from "ink";

interface ErrorBannerProps {
  readonly message: string;
  readonly details?: string;
}

/** Non-blocking error banner displayed in the terminal */
export function ErrorBanner({ message, details }: ErrorBannerProps) {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="red" paddingX={1}>
      <Text color="red" bold>
        Error: {message}
      </Text>
      {details ? (
        <Text color="gray" dimColor>
          {details}
        </Text>
      ) : null}
    </Box>
  );
}

import { Box, Text } from "ink";

interface VoiceIndicatorProps {
  readonly isRecording: boolean;
  readonly isTranscribing: boolean;
  readonly lastTranscription?: string;
}

/**
 * Visual indicator for voice recording and transcription state.
 * Shows red when recording, yellow when transcribing, dim for last result.
 */
export function VoiceIndicator({
  isRecording,
  isTranscribing,
  lastTranscription,
}: VoiceIndicatorProps) {
  if (!isRecording && !isTranscribing && !lastTranscription) return null;

  return (
    <Box flexDirection="column" marginTop={1}>
      {isRecording && (
        <Text color="red" bold>
          {"● Recording... (press SPACE to stop)"}
        </Text>
      )}
      {isTranscribing && <Text color="yellow">{"◌ Transcribing..."}</Text>}
      {lastTranscription && !isRecording && !isTranscribing && (
        <Text dimColor>Last: {lastTranscription.slice(0, 80)}</Text>
      )}
    </Box>
  );
}

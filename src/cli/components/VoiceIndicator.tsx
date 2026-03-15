/**
 * VoiceIndicator.tsx — 음성 녹음 및 변환 상태를 시각적으로 표시하는 컴포넌트
 *
 * 음성 입력 기능(/voice로 활성화)의 현재 상태를 표시합니다:
 * - 녹음 중: 빨간색 "● Recording..." (SPACE로 중지)
 * - 변환 중: 노란색 "◌ Transcribing..." (Whisper API 처리 중)
 * - 마지막 결과: 회색으로 최근 변환된 텍스트 표시
 *
 * 모든 상태가 비활성이면 렌더링하지 않습니다 (null 반환).
 */
import { Box, Text } from "ink";

/**
 * @param isRecording - 마이크 녹음 중 여부
 * @param isTranscribing - Whisper API로 텍스트 변환 중 여부
 * @param lastTranscription - 마지막으로 변환된 텍스트 (80자까지 표시)
 */
interface VoiceIndicatorProps {
  readonly isRecording: boolean;
  readonly isTranscribing: boolean;
  readonly lastTranscription?: string;
}

/**
 * 음성 상태 인디케이터 — 녹음/변환/결과 상태에 따라 다른 색상과 아이콘 표시
 * 녹음 중=빨간 ●, 변환 중=노란 ◌, 결과=회색 Last: ...
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

/**
 * StatusBar.tsx — 화면 하단에 표시되는 상태 바 컴포넌트
 *
 * 현재 사용 중인 모델, 컨텍스트 사용률, 세션 비용, 권한 모드,
 * 상세 모드, 확장 사고 상태 등을 한 줄로 보여줍니다.
 * 컨텍스트 사용률이 80%를 넘으면 빨간색 경고가 표시됩니다.
 *
 * 구조: [모델명 | 버전] --- [사용량 바 | 비용 | 모드 태그들] [streaming.../ready]
 */
import React, { useMemo } from "react";
import { Box, Text } from "ink";
import { VERSION } from "../../constants.js";
import { getModelCapabilities } from "../../llm/model-capabilities.js";

/**
 * StatusBar 컴포넌트의 Props
 *
 * @param model - 현재 사용 중인 모델 ID
 * @param tokenCount - 누적 토큰 수
 * @param maxTokens - 모델의 최대 컨텍스트 토큰 수
 * @param isStreaming - LLM 응답 스트리밍 중 여부
 * @param effortLevel - 노력 수준 (선택적)
 * @param sessionName - 세션 이름 (선택적)
 * @param modelName - 표시할 모델 이름 (model과 다를 수 있음)
 * @param inputTokens - 입력 토큰 수 (비용 계산용)
 * @param outputTokens - 출력 토큰 수 (비용 계산용)
 * @param permissionMode - 현재 권한 모드 레이블
 * @param verboseMode - 상세 모드 활성화 여부
 * @param thinkingEnabled - 확장 사고 활성화 여부
 */
interface StatusBarProps {
  readonly model: string;
  readonly tokenCount: number;
  readonly maxTokens: number;
  readonly isStreaming: boolean;
  readonly agentPhase?: "idle" | "llm-thinking" | "llm-streaming" | "tools-running" | "tools-done";
  readonly effortLevel?: string;
  readonly sessionName?: string;
  readonly modelName?: string;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly permissionMode?: string;
  readonly verboseMode?: boolean;
  readonly thinkingEnabled?: boolean;
  /** MCP 연결 상태 메시지 (일시적으로 표시됨) */
  readonly mcpStatus?: string;
  /** Names of currently executing tools */
  readonly activeToolNames?: readonly string[];
}

/** 토큰 수와 모델 가격 정보로 세션 비용을 계산 — model-capabilities가 단일 진실 공급원(SSOT) */
function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const caps = getModelCapabilities(model);
  const pricing = caps.pricing;
  return (
    (inputTokens / 1_000_000) * pricing.inputPerMillion +
    (outputTokens / 1_000_000) * pricing.outputPerMillion
  );
}

/** 비용을 달러 문자열로 포맷 — $0.01 미만이면 소수점 4자리까지 표시 */
function formatCost(cost: number): string {
  if (cost === 0) return "";
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

/** 시각적 사용량 바를 생성 — [#####----------] 형태, 채워진 부분과 빈 부분을 비율로 계산 */
function usageBar(ratio: number, width = 15): string {
  const filled = Math.round(ratio * width);
  const empty = width - filled;
  return "[" + "#".repeat(filled) + "-".repeat(empty) + "]";
}

/**
 * 상태 바 컴포넌트 — 모델, 토큰 사용량, 컨텍스트 %, 비용, 모드 태그들을 표시
 * 컨텍스트 80% 초과 시 테두리가 빨간색으로 변하고 경고 메시지가 표시됨
 */
export const StatusBar = React.memo(function StatusBar({
  model,
  tokenCount,
  maxTokens,
  isStreaming,
  agentPhase,
  effortLevel,
  sessionName,
  modelName,
  inputTokens = 0,
  outputTokens = 0,
  permissionMode,
  verboseMode,
  thinkingEnabled,
  mcpStatus,
  activeToolNames,
}: StatusBarProps) {
  const usage = maxTokens > 0 ? Math.round((tokenCount / maxTokens) * 100) : 0;
  const ratio = maxTokens > 0 ? tokenCount / maxTokens : 0;

  const usageColor = useMemo(() => (usage > 80 ? "red" : usage > 60 ? "yellow" : "green"), [usage]);

  const cost = useMemo(
    () => calculateCost(model, inputTokens, outputTokens),
    [model, inputTokens, outputTokens],
  );
  const costStr = formatCost(cost);

  const displayName = modelName ?? model;

  const contextWarning = usage > 80;

  return (
    <Box
      borderStyle="single"
      borderColor={contextWarning ? "red" : "#0097A7"}
      paddingX={1}
      justifyContent="space-between"
    >
      <Box gap={1}>
        <Text color="cyan">{displayName}</Text>
        <Text color="gray">v{VERSION}</Text>
        {sessionName ? <Text color="gray">({sessionName})</Text> : null}
      </Box>
      <Box gap={1}>
        <Text color={usageColor}>
          {usageBar(ratio)} {usage}%
        </Text>
        {contextWarning && (
          <Text color="red" bold>
            {"!! Context " + usage + "%"}
          </Text>
        )}
        {costStr.length > 0 && <Text color="cyan">{costStr}</Text>}
        {effortLevel ? <Text color="#00BCD4">[{effortLevel}]</Text> : null}
        {permissionMode ? <Text color="#0097A7">[{permissionMode}]</Text> : null}
        {verboseMode ? <Text color="yellow">[Verbose]</Text> : null}
        {thinkingEnabled ? <Text color="cyan">[Thinking]</Text> : null}
      </Box>
      <Box gap={1}>
        {mcpStatus ? <Text color="cyan">{mcpStatus}</Text> : null}
        {(() => {
          if (agentPhase === "llm-thinking") return <Text color="yellow">{"🧠 thinking..."}</Text>;
          if (agentPhase === "llm-streaming") return <Text color="yellow">{"✍️ writing..."}</Text>;
          if (agentPhase === "tools-running")
            return <Text color="cyan">{"⚙️ executing tools..."}</Text>;
          if (agentPhase === "tools-done")
            return <Text color="cyan">{"📋 reviewing results..."}</Text>;
          if (isStreaming) return <Text color="yellow">{"✍️ writing..."}</Text>;
          return <Text color="green">{"● ready"}</Text>;
        })()}
        {activeToolNames && activeToolNames.length > 0 && (
          <Text dimColor>({activeToolNames.join(", ")})</Text>
        )}
        {!isStreaming && !agentPhase && <Text dimColor> · / for commands</Text>}
      </Box>
    </Box>
  );
});

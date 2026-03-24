/**
 * App.tsx — dbcode CLI 애플리케이션의 최상위(Root) 컴포넌트
 *
 * Ink(터미널에서 React를 사용할 수 있게 해주는 라이브러리)를 기반으로
 * 전체 CLI UI를 구성합니다. 사용자 입력, 에이전트 상태, 권한 관리,
 * 슬래시 명령 메뉴, 음성 입력, 키보드 단축키 등을 총괄합니다.
 *
 * 이 파일은 CLI 레이어(Layer 1)의 진입점으로, 모든 하위 컴포넌트와
 * 훅(hook)을 조합하여 하나의 통합 인터페이스를 제공합니다.
 */
import { Box, Text } from "ink";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { UserInput } from "./components/UserInput.js";
import { AgentStatus } from "./components/AgentStatus.js";
import { SelectList } from "./components/SelectList.js";
import { StatusBar } from "./components/StatusBar.js";
// 로고는 Ink 렌더링 전에 stdout에 직접 출력됩니다 (src/index.ts 참조)
import { ErrorBanner } from "./components/ErrorBanner.js";
import { PermissionPrompt } from "./components/PermissionPrompt.js";
import { SlashCommandMenu } from "./components/SlashCommandMenu.js";
import { ActivityFeed } from "./components/ActivityFeed.js";
import { TaskListView } from "./components/TaskListView.js";
import { useAgentLoop } from "./hooks/useAgentLoop.js";
import { usePermissionPrompt } from "./hooks/usePermissionPrompt.js";
import {
  useKeybindings,
  loadKeybindingConfig,
  getEffectiveBindings,
  buildKeybindings,
} from "./hooks/useKeybindings.js";
import { type LLMProvider } from "../llm/provider.js";
import { type ToolCallStrategy } from "../llm/tool-call-strategy.js";
import { type ToolRegistry } from "../tools/registry.js";
import { type PermissionManager } from "../permissions/manager.js";
import { type CommandRegistry } from "../commands/registry.js";
import { type ContextManager } from "../core/context-manager.js";
import { type HookRunner } from "../hooks/runner.js";
import { type Task } from "../core/task-manager.js";
import { type SessionManager } from "../core/session-manager.js";
import { type SkillManager } from "../skills/manager.js";
import { type MCPManagerConnector } from "../mcp/manager-connector.js";
import { type PermissionMode } from "../permissions/types.js";
import { getModelCapabilities } from "../llm/model-capabilities.js";
import { VoiceIndicator } from "./components/VoiceIndicator.js";
import { RetryCountdown } from "./components/RetryCountdown.js";
import { ErrorBoundary } from "./components/ErrorBoundary.js";
import { useVoice } from "./hooks/useVoice.js";

/**
 * 권한 모드 순환 순서 — Shift+Tab으로 순환하는 권한 모드 목록
 * default → acceptEdits → plan → dontAsk → bypassPermissions → default...
 */
const PERMISSION_MODE_CYCLE: readonly PermissionMode[] = [
  "default",
  "acceptEdits",
  "plan",
  "dontAsk",
  "bypassPermissions",
] as const;

/** 상태 바에 표시할 권한 모드의 짧은 레이블 (사용자가 현재 모드를 빠르게 확인할 수 있도록) */
const MODE_LABELS: Readonly<Record<PermissionMode, string>> = {
  default: "Default",
  acceptEdits: "Accept Edits",
  plan: "Plan",
  dontAsk: "Don't Ask",
  bypassPermissions: "Bypass",
};

/**
 * App 컴포넌트의 Props 인터페이스
 *
 * @param client - LLM API와 통신하는 프로바이더 (OpenAI, Anthropic 등)
 * @param model - 사용할 LLM 모델명 (예: "gpt-4o", "claude-sonnet-4-5-20250514")
 * @param toolRegistry - 사용 가능한 도구(file_read, bash_exec 등)를 관리하는 레지스트리
 * @param strategy - 도구 호출 전략 (순차/병렬 등)
 * @param permissionManager - 도구 실행 권한을 관리하는 매니저
 * @param commandRegistry - 슬래시 명령(/model, /compact 등)을 관리하는 레지스트리
 * @param contextManager - LLM에 보낼 컨텍스트(대화 히스토리)를 관리
 * @param hookRunner - 사용자 정의 훅(UserPromptSubmit, Stop 등)을 실행
 * @param sessionManager - 대화 세션의 저장/복원을 관리
 * @param skillManager - 스킬(재사용 가능한 프롬프트 템플릿)을 관리
 * @param tasks - 표시할 작업 목록 (TaskListView에 전달)
 * @param sessionId - 현재 세션의 고유 ID
 * @param showStatusBar - 하단 상태 바 표시 여부 (기본값: true)
 * @param initialLocale - 초기 언어 설정 (기본값: "ko")
 * @param initialTone - 초기 어조 설정 (기본값: "normal")
 * @param mcpConnector - MCP(Model Context Protocol) 서버 연결 커넥터
 */
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
  readonly skillManager?: SkillManager;
  readonly tasks?: readonly Task[];
  readonly sessionId?: string;
  readonly showStatusBar?: boolean;
  readonly initialLocale?: string;
  readonly initialTone?: string;
  readonly mcpConnector?: MCPManagerConnector;
  readonly mcpManager?: import("../mcp/manager.js").MCPManager;
}

/**
 * 루트 애플리케이션 컴포넌트
 *
 * Ink를 사용하여 터미널에 React 컴포넌트 트리를 렌더링합니다.
 * ErrorBoundary로 감싸서 렌더링 에러를 포착하고,
 * 내부에서 에이전트 루프, 권한 프롬프트, 음성 입력, 키바인딩 등을
 * 조합하여 전체 CLI 인터페이스를 구성합니다.
 */
export function App({
  client,
  model,
  toolRegistry,
  strategy,
  permissionManager,
  commandRegistry,
  contextManager,
  hookRunner,
  sessionManager,
  skillManager,
  tasks,
  sessionId,
  showStatusBar = true,
  initialLocale = "ko",
  initialTone = "normal",
  mcpConnector,
  mcpManager,
}: AppProps) {
  const { pendingPermission, handlePermissionResponse, checkPermission } = usePermissionPrompt(
    permissionManager,
    toolRegistry,
  );

  // 확장 사고(Extended Thinking) 토글 상태 — useAgentLoop에 전달하기 위해 여기서 선언
  const [thinkingEnabled, setThinkingEnabled] = useState(false);

  // MCP 연결 상태 — StatusBar에 일시적으로 표시 (3초 후 자동 제거)
  const [mcpStatus, setMcpStatus] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (!mcpManager) return;
    setMcpStatus("MCP 연결 중...");
    mcpManager
      .connectAll()
      .then((result) => {
        if (result.connected.length > 0) {
          setMcpStatus(`MCP: ${result.connected.join(", ")} ✓`);
        }
        for (const f of result.failed) {
          setMcpStatus(`MCP: ${f.name} ✗`);
        }
        // 3초 후 상태 메시지 제거
        setTimeout(() => setMcpStatus(undefined), 3000);
      })
      .catch(() => {
        setMcpStatus("MCP 연결 실패");
        setTimeout(() => setMcpStatus(undefined), 3000);
      });
  }, [mcpManager]);

  const {
    isProcessing,
    isStreamingFinal,
    agentPhase,
    completedTurns,
    liveTurn,
    handleSubmit,
    error,
    commandOutput,
    tokenCount,
    activeModel,
    events,
    messageQueueRef,
    inputTokens,
    outputTokens,
    retryInfo,
    interactiveSelect,
    setInteractiveSelect,
    pendingAskUser,
    setPendingAskUser,
  } = useAgentLoop({
    client,
    model,
    toolRegistry,
    strategy,
    commandRegistry,
    contextManager,
    hookRunner,
    sessionManager,
    skillManager,
    sessionId,
    checkPermission,
    initialLocale,
    initialTone,
    mcpConnector,
    mcpManager,
    thinkingEnabled,
  });

  // 음성 입력 — 마이크 녹음 → Whisper API로 텍스트 변환 → 에이전트에게 전달
  const {
    isRecording,
    isTranscribing,
    lastTranscription,
    voiceEnabled,
    setVoiceEnabled,
    toggleRecording,
  } = useVoice({
    onTranscription: (text) => {
      void handleSubmit(text);
    },
  });

  // 사용자 입력 제출 핸들러 — ask_user 대기 중이면 응답으로 전달, 아니면 일반 처리
  const onUserSubmit = useCallback(
    (input: string) => {
      if (pendingAskUser && !pendingAskUser.choices?.length) {
        events.emit("ask_user:response", {
          toolCallId: pendingAskUser.toolCallId,
          answer: input,
        });
        setPendingAskUser(null);
        return;
      }
      void handleSubmit(input);
    },
    [pendingAskUser, events, handleSubmit, setPendingAskUser],
  );

  // /voice 명령에서 발생하는 voice:toggle 이벤트를 감지하여 음성 기능 활성화/비활성화
  useEffect(() => {
    const handleVoiceToggle = ({ enabled }: { enabled: boolean }) => {
      setVoiceEnabled(enabled);
    };
    events.on("voice:toggle", handleVoiceToggle);
    return () => {
      events.off("voice:toggle", handleVoiceToggle);
    };
  }, [events, setVoiceEnabled]);

  // /plan 명령에서 발생하는 permission:mode-change 이벤트를 감지하여 권한 모드 변경
  useEffect(() => {
    const handleModeChange = ({ mode }: { mode: string }) => {
      const validMode = mode as PermissionMode;
      permissionManager.setMode(validMode);
      setPermissionMode(validMode);
    };
    events.on("permission:mode-change", handleModeChange);
    return () => {
      events.off("permission:mode-change", handleModeChange);
    };
  }, [events, permissionManager]);

  // 슬래시 명령 메뉴 표시를 위해 현재 입력값을 추적
  const [inputValue, setInputValue] = useState("");
  // 슬래시 메뉴가 보일 조건: 에이전트가 처리 중이 아니고, 권한 프롬프트가 없고,
  // 입력이 "/"로 시작하면서 공백이 없을 때 (아직 명령어 이름만 입력 중일 때)
  const slashMenuVisible =
    !isProcessing && !pendingPermission && inputValue.startsWith("/") && !inputValue.includes(" ");

  // 상세 모드(Verbose mode) — Ctrl+O로 토글, 도구 실행 결과를 확장해서 보여줌
  const [verboseMode, setVerboseMode] = useState(false);

  // 권한 모드 상태 — permissionManager의 상태를 미러링하여 UI를 구동
  const [permissionMode, setPermissionMode] = useState<PermissionMode>(permissionManager.getMode());

  // 단축키 피드백용 알림 배너 (2초 후 자동 사라짐)
  const [notification, setNotification] = useState<string | null>(null);
  const notificationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showNotification = useCallback((message: string) => {
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
    }
    setNotification(message);
    notificationTimeoutRef.current = setTimeout(() => {
      setNotification(null);
      notificationTimeoutRef.current = null;
    }, 2000);
  }, []);

  useEffect(() => {
    return () => {
      if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current);
    };
  }, []);

  // Ctrl+C 더블 탭 감지 — 첫 번째 Ctrl+C는 에이전트 취소, 두 번째(1.5초 이내)는 종료
  const ctrlCTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ctrlCPressedRef = useRef(false);

  const handleCtrlC = useCallback(() => {
    if (ctrlCPressedRef.current) {
      // 두 번째 Ctrl+C — 즉시 종료
      process.exit(0);
    }

    if (isProcessing) {
      // 에이전트 실행 중이면 취소
      events.emit("input:abort", undefined);
      showNotification("Cancelled — press Ctrl+C again to exit");
    } else {
      // 유휴 상태에서는 안내만 표시
      showNotification("Press Ctrl+C again to exit");
    }

    ctrlCPressedRef.current = true;
    if (ctrlCTimerRef.current) {
      clearTimeout(ctrlCTimerRef.current);
    }
    ctrlCTimerRef.current = setTimeout(() => {
      ctrlCPressedRef.current = false;
      ctrlCTimerRef.current = null;
    }, 1500);
  }, [isProcessing, events, showNotification]);

  // Ctrl+C 타이머 정리
  useEffect(() => {
    return () => {
      if (ctrlCTimerRef.current) clearTimeout(ctrlCTimerRef.current);
    };
  }, []);

  // 키바인딩에 연결할 액션 핸들러 — 각 단축키가 실행할 동작을 정의
  const actionHandlers = useMemo(
    () => ({
      cancel: () => {
        if (isProcessing) {
          events.emit("input:abort", undefined);
          showNotification("Cancelled current operation");
        }
      },
      // newline is handled directly in UserInput via Ctrl+J
      newline: () => {},
      "cycle-mode": () => {
        const currentIndex = PERMISSION_MODE_CYCLE.indexOf(permissionMode);
        const nextIndex = (currentIndex + 1) % PERMISSION_MODE_CYCLE.length;
        const nextMode = PERMISSION_MODE_CYCLE[nextIndex];
        permissionManager.setMode(nextMode);
        setPermissionMode(nextMode);
        showNotification(`Permission mode: ${MODE_LABELS[nextMode]}`);
      },
      "toggle-verbose": () => {
        setVerboseMode((prev) => {
          const next = !prev;
          showNotification(`Verbose mode: ${next ? "ON" : "OFF"}`);
          return next;
        });
      },
      exit: () => {
        process.exit(0);
      },
      "toggle-thinking": () => {
        const caps = getModelCapabilities(activeModel);
        if (!caps.supportsThinking) {
          showNotification("This model does not support extended thinking");
          return;
        }
        setThinkingEnabled((prev) => {
          const next = !prev;
          showNotification(`Extended thinking: ${next ? "ON" : "OFF"}`);
          return next;
        });
      },
      "toggle-voice": () => {
        if (voiceEnabled) {
          toggleRecording();
        }
      },
    }),
    [
      isProcessing,
      events,
      permissionMode,
      permissionManager,
      showNotification,
      voiceEnabled,
      toggleRecording,
      activeModel,
    ],
  );

  // 사용자 설정 파일(~/.dbcode/keybindings.json)과 기본값을 병합하여 키바인딩 구성
  const keybindings = useMemo(() => {
    const userConfig = loadKeybindingConfig();
    const effective = getEffectiveBindings(userConfig);
    return buildKeybindings(effective, actionHandlers);
  }, [actionHandlers]);

  useKeybindings(keybindings, !pendingPermission);

  return (
    <ErrorBoundary>
      <Box flexDirection="column" padding={1}>
        <ActivityFeed
          completedTurns={completedTurns}
          currentTurn={liveTurn}
          isExpanded={verboseMode}
        />

        {isProcessing && !isStreamingFinal ? (
          <Box marginY={1}>
            <AgentStatus tokenCount={tokenCount} />
          </Box>
        ) : null}

        {retryInfo ? (
          <Box marginY={1}>
            <RetryCountdown
              seconds={Math.ceil(retryInfo.delayMs / 1000)}
              label={`${retryInfo.reason} (${retryInfo.attempt}/${retryInfo.maxRetries})`}
            />
          </Box>
        ) : null}

        {pendingPermission ? (
          <PermissionPrompt
            toolName={pendingPermission.call.name}
            description={`Arguments: ${JSON.stringify(pendingPermission.call.arguments)}`}
            onResponse={handlePermissionResponse}
          />
        ) : null}

        {interactiveSelect ? (
          <SelectList
            prompt={interactiveSelect.prompt}
            options={interactiveSelect.options}
            onSelect={(value) => {
              setInteractiveSelect(null);
              void handleSubmit(`${interactiveSelect.onSelect} ${value}`);
            }}
            onCancel={() => setInteractiveSelect(null)}
          />
        ) : null}

        {pendingAskUser ? (
          pendingAskUser.choices && pendingAskUser.choices.length > 0 ? (
            <SelectList
              prompt={pendingAskUser.question}
              options={pendingAskUser.choices.map((c) => ({ label: String(c), value: String(c) }))}
              onSelect={(value) => {
                events.emit("ask_user:response", {
                  toolCallId: pendingAskUser.toolCallId,
                  answer: value,
                });
                setPendingAskUser(null);
              }}
              onCancel={() => {
                events.emit("ask_user:response", {
                  toolCallId: pendingAskUser.toolCallId,
                  answer: "[User cancelled]",
                });
                setPendingAskUser(null);
              }}
            />
          ) : (
            <Box marginY={1}>
              <Text color="cyan">{"? "}</Text>
              <Text bold>{pendingAskUser.question}</Text>
            </Box>
          )
        ) : null}

        {commandOutput ? (
          <Box marginY={1}>
            <Text>{commandOutput}</Text>
          </Box>
        ) : null}

        {voiceEnabled ? (
          <VoiceIndicator
            isRecording={isRecording}
            isTranscribing={isTranscribing}
            lastTranscription={lastTranscription}
          />
        ) : null}

        {error ? <ErrorBanner message={error} /> : null}

        {notification ? (
          <Box marginY={0}>
            <Text color="yellow">{notification}</Text>
          </Box>
        ) : null}

        {tasks && tasks.length > 0 ? <TaskListView tasks={tasks} title="Tasks" /> : null}

        <Box marginTop={1}>
          <UserInput
            onSubmit={onUserSubmit}
            onChange={setInputValue}
            slashMenuVisible={slashMenuVisible}
            onCtrlC={handleCtrlC}
          />
        </Box>

        {slashMenuVisible && commandRegistry ? (
          <SlashCommandMenu
            commands={commandRegistry.getAll()}
            prefix={inputValue}
            visible={slashMenuVisible}
            onSelect={(name) => {
              setInputValue("");
              void handleSubmit("/" + name);
            }}
            onClose={() => setInputValue("")}
          />
        ) : null}

        {messageQueueRef.current.length > 0 ? (
          <Box>
            <Text color="gray">({messageQueueRef.current.length} message(s) queued)</Text>
          </Box>
        ) : null}

        {showStatusBar ? (
          <StatusBar
            model={activeModel}
            modelName={activeModel}
            tokenCount={tokenCount}
            maxTokens={getModelCapabilities(activeModel).maxContextTokens}
            isStreaming={isProcessing}
            agentPhase={agentPhase}
            inputTokens={inputTokens}
            outputTokens={outputTokens}
            permissionMode={MODE_LABELS[permissionMode]}
            verboseMode={verboseMode}
            thinkingEnabled={thinkingEnabled}
            mcpStatus={mcpStatus}
          />
        ) : null}
      </Box>
    </ErrorBoundary>
  );
}

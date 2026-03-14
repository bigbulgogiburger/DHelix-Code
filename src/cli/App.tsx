import { Box, Text } from "ink";
import { useState, useMemo, useCallback, useEffect } from "react";
import { UserInput } from "./components/UserInput.js";
import { AgentStatus } from "./components/AgentStatus.js";
import { SelectList } from "./components/SelectList.js";
import { StatusBar } from "./components/StatusBar.js";
// Logo is now printed to stdout before Ink render (see src/index.ts)
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
import { useVoice } from "./hooks/useVoice.js";

/** Permission mode cycle order */
const PERMISSION_MODE_CYCLE: readonly PermissionMode[] = [
  "default",
  "acceptEdits",
  "plan",
  "dontAsk",
  "bypassPermissions",
] as const;

/** Short labels for permission modes shown in status area */
const MODE_LABELS: Readonly<Record<PermissionMode, string>> = {
  default: "Default",
  acceptEdits: "Accept Edits",
  plan: "Plan",
  dontAsk: "Don't Ask",
  bypassPermissions: "Bypass",
};

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
}

/** Root application component */
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
}: AppProps) {
  const { pendingPermission, handlePermissionResponse, checkPermission } = usePermissionPrompt(
    permissionManager,
    toolRegistry,
  );

  const {
    isProcessing,
    streamingText,
    completedTurns,
    currentTurn,
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
    interactiveSelect,
    setInteractiveSelect,
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
  });

  // Voice input
  const { isRecording, isTranscribing, lastTranscription, voiceEnabled, setVoiceEnabled, toggleRecording } = useVoice({
    onTranscription: (text) => {
      void handleSubmit(text);
    },
  });

  // Wire voice toggle events from /voice command
  useEffect(() => {
    const handleVoiceToggle = ({ enabled }: { enabled: boolean }) => {
      setVoiceEnabled(enabled);
    };
    events.on("voice:toggle", handleVoiceToggle);
    return () => {
      events.off("voice:toggle", handleVoiceToggle);
    };
  }, [events, setVoiceEnabled]);

  // Track current input value for slash command menu
  const [inputValue, setInputValue] = useState("");
  const slashMenuVisible =
    !isProcessing && !pendingPermission && inputValue.startsWith("/") && !inputValue.includes(" ");

  // Verbose mode toggle state
  const [verboseMode, setVerboseMode] = useState(false);

  // Extended thinking toggle state
  const [thinkingEnabled, setThinkingEnabled] = useState(false);

  // Permission mode state (mirrors permissionManager but drives UI)
  const [permissionMode, setPermissionMode] = useState<PermissionMode>(permissionManager.getMode());

  // Notification banner for shortcut feedback
  const [notification, setNotification] = useState<string | null>(null);

  const showNotification = useCallback((message: string) => {
    setNotification(message);
    setTimeout(() => setNotification(null), 2000);
  }, []);

  // Action handlers for keybindings
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
    [isProcessing, events, permissionMode, permissionManager, showNotification, voiceEnabled, toggleRecording],
  );

  // Build keybindings from config + defaults
  const keybindings = useMemo(() => {
    const userConfig = loadKeybindingConfig();
    const effective = getEffectiveBindings(userConfig);
    return buildKeybindings(effective, actionHandlers);
  }, [actionHandlers]);

  useKeybindings(keybindings, !pendingPermission);

  return (
    <Box flexDirection="column" padding={1}>
      <ActivityFeed
        completedTurns={completedTurns}
        currentTurn={liveTurn}
        isExpanded={verboseMode}
      />

      {isProcessing &&
      !streamingText &&
      !currentTurn?.entries.some((e) => e.type === "tool-start") ? (
        <Box marginY={1}>
          <AgentStatus tokenCount={tokenCount} />
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
          onSubmit={handleSubmit}
          onChange={setInputValue}
          slashMenuVisible={slashMenuVisible}
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
          inputTokens={inputTokens}
          outputTokens={outputTokens}
          permissionMode={MODE_LABELS[permissionMode]}
          verboseMode={verboseMode}
          thinkingEnabled={thinkingEnabled}
        />
      ) : null}
    </Box>
  );
}

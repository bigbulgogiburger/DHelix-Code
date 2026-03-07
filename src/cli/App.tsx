import { Box, Text } from "ink";
import { useState, useMemo } from "react";
import { UserInput } from "./components/UserInput.js";
import { Spinner } from "./components/Spinner.js";
import { StatusBar } from "./components/StatusBar.js";
import { Logo } from "./components/Logo.js";
import { ErrorBanner } from "./components/ErrorBanner.js";
import { PermissionPrompt } from "./components/PermissionPrompt.js";
import { SlashCommandMenu } from "./components/SlashCommandMenu.js";
import { ActivityFeed } from "./components/ActivityFeed.js";
import { TaskListView } from "./components/TaskListView.js";
import { useAgentLoop } from "./hooks/useAgentLoop.js";
import { usePermissionPrompt } from "./hooks/usePermissionPrompt.js";
import { useKeybindings, type Keybinding } from "./hooks/useKeybindings.js";
import { type LLMProvider } from "../llm/provider.js";
import { type ToolCallStrategy } from "../llm/tool-call-strategy.js";
import { type ToolRegistry } from "../tools/registry.js";
import { type PermissionManager } from "../permissions/manager.js";
import { type CommandRegistry } from "../commands/registry.js";
import { type ContextManager } from "../core/context-manager.js";
import { type HookRunner } from "../hooks/runner.js";
import { type Task } from "../core/task-manager.js";
import { type SessionManager } from "../core/session-manager.js";
import { getModelCapabilities } from "../llm/model-capabilities.js";

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
  readonly tasks?: readonly Task[];
  readonly sessionId?: string;
  readonly showStatusBar?: boolean;
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
  tasks,
  sessionId,
  showStatusBar = true,
}: AppProps) {
  const { pendingPermission, handlePermissionResponse, checkPermission } =
    usePermissionPrompt(permissionManager, toolRegistry);

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
  } = useAgentLoop({
    client,
    model,
    toolRegistry,
    strategy,
    commandRegistry,
    contextManager,
    hookRunner,
    sessionManager,
    sessionId,
    checkPermission,
  });

  // Track current input value for slash command menu
  const [inputValue, setInputValue] = useState("");
  const slashMenuVisible = !isProcessing && !pendingPermission && inputValue.startsWith("/") && !inputValue.includes(" ");

  // Register keybindings
  const keybindings = useMemo<Keybinding[]>(
    () => [
      {
        key: "c",
        ctrl: true,
        handler: () => {
          if (isProcessing) {
            events.emit("input:abort", undefined);
          }
        },
      },
    ],
    [isProcessing, events],
  );
  useKeybindings(keybindings, !pendingPermission);

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Logo modelName={activeModel} />
      </Box>

      <ActivityFeed completedTurns={completedTurns} currentTurn={liveTurn} />

      {isProcessing && !streamingText && !currentTurn?.entries.some((e) => e.type === "tool-start") ? (
        <Box marginY={1}>
          <Spinner label="Thinking..." />
        </Box>
      ) : null}

      {pendingPermission ? (
        <PermissionPrompt
          toolName={pendingPermission.call.name}
          description={`Arguments: ${JSON.stringify(pendingPermission.call.arguments)}`}
          onResponse={handlePermissionResponse}
        />
      ) : null}

      {commandOutput ? (
        <Box marginY={1}>
          <Text>{commandOutput}</Text>
        </Box>
      ) : null}

      {error ? <ErrorBanner message={error} /> : null}

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
        />
      ) : null}
    </Box>
  );
}

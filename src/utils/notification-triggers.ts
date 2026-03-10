import { type AppEventEmitter } from "./events.js";
import { sendNotification } from "./notifications.js";
import { DEFAULT_NOTIFICATION_CONFIG, type NotificationConfig } from "./notification-config.js";

/** Options for configuring notification triggers */
export interface NotificationTriggerOptions {
  /** Minimum duration in milliseconds before a completion notification is sent */
  readonly minDurationMs?: number;
  /** Whether notifications are enabled */
  readonly enabled?: boolean;
  /** Whether to play a sound with notifications */
  readonly sound?: boolean;
}

/**
 * Set up notification triggers for long-running operations.
 *
 * Sends a desktop notification when:
 * - Agent loop completes after running for longer than the configured minimum duration
 * - An LLM error occurs that may require user attention
 *
 * Notifications are fire-and-forget and never block the main event loop.
 *
 * @returns A cleanup function that removes all event listeners
 */
export function setupNotificationTriggers(
  events: AppEventEmitter,
  options?: NotificationTriggerOptions,
): () => void {
  const config: NotificationConfig = {
    enabled: options?.enabled ?? DEFAULT_NOTIFICATION_CONFIG.enabled,
    minDurationSeconds:
      options?.minDurationMs !== undefined
        ? options.minDurationMs / 1000
        : DEFAULT_NOTIFICATION_CONFIG.minDurationSeconds,
    sound: options?.sound ?? DEFAULT_NOTIFICATION_CONFIG.sound,
  };

  if (!config.enabled) {
    return () => {
      /* no-op cleanup when disabled */
    };
  }

  const minDurationMs = config.minDurationSeconds * 1000;
  let agentStartTime: number | null = null;

  /** Track when the agent loop starts its first iteration */
  const onAgentIteration = ({ iteration }: { iteration: number }): void => {
    if (iteration === 1) {
      agentStartTime = Date.now();
    }
  };

  /** Notify when the agent loop produces its final message after a long run */
  const onAssistantMessage = ({
    isFinal,
  }: {
    readonly content: string;
    readonly toolCalls: readonly { readonly id: string; readonly name: string }[];
    readonly iteration: number;
    readonly isFinal: boolean;
  }): void => {
    if (!isFinal || agentStartTime === null) {
      return;
    }

    const elapsed = Date.now() - agentStartTime;
    agentStartTime = null;

    if (elapsed >= minDurationMs) {
      const seconds = Math.round(elapsed / 1000);
      // Fire-and-forget — never await in the event handler
      void sendNotification({
        title: "dbcode",
        message: `Task completed in ${seconds}s`,
        sound: config.sound,
      });
    }
  };

  /** Notify on LLM errors that may need user attention */
  const onLLMError = ({ error }: { error: Error }): void => {
    // Fire-and-forget
    void sendNotification({
      title: "dbcode — Error",
      message: error.message.slice(0, 200),
      sound: config.sound,
    });
    agentStartTime = null;
  };

  events.on("agent:iteration", onAgentIteration);
  events.on("agent:assistant-message", onAssistantMessage);
  events.on("llm:error", onLLMError);

  /** Cleanup function to remove all listeners */
  return () => {
    events.off("agent:iteration", onAgentIteration);
    events.off("agent:assistant-message", onAssistantMessage);
    events.off("llm:error", onLLMError);
    agentStartTime = null;
  };
}

/** Configuration for desktop notifications */
export interface NotificationConfig {
  /** Whether desktop notifications are enabled */
  readonly enabled: boolean;
  /** Minimum task duration (in seconds) before a notification is sent */
  readonly minDurationSeconds: number;
  /** Whether to play a sound with the notification */
  readonly sound: boolean;
}

/** Default notification configuration */
export const DEFAULT_NOTIFICATION_CONFIG: NotificationConfig = {
  enabled: true,
  minDurationSeconds: 30,
  sound: false,
};

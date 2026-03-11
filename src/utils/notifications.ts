import { execFile } from "node:child_process";
import { getPlatform } from "./platform.js";

/** Options for sending a desktop notification */
export interface NotificationOptions {
  readonly title: string;
  readonly message: string;
  readonly sound?: boolean;
  /** Icon path (optional) */
  readonly icon?: string;
}

/**
 * Escape a string for use in AppleScript string literals.
 * Backslashes and double quotes must be escaped.
 */
function escapeAppleScript(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Escape a string for use in PowerShell single-quoted strings.
 * Single quotes are doubled inside single-quoted strings.
 */
function escapePowerShell(str: string): string {
  return str.replace(/'/g, "''");
}

/**
 * Execute a command as a promise. Resolves to true on success, false on failure.
 * Never throws — failures are silently swallowed.
 */
function execCommand(
  command: string,
  args: readonly string[],
  timeoutMs: number = 5000,
): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const child = execFile(command, args as string[], { timeout: timeoutMs }, (error) => {
        resolve(error === null);
      });
      // Ensure the child process doesn't keep the event loop alive
      child.unref();
    } catch {
      resolve(false);
    }
  });
}

/**
 * Send a desktop notification using macOS osascript.
 */
async function sendMacOSNotification(options: NotificationOptions): Promise<boolean> {
  const title = escapeAppleScript(options.title);
  const message = escapeAppleScript(options.message);

  let script = `display notification "${message}" with title "${title}"`;
  if (options.sound) {
    script += ' sound name "default"';
  }

  return execCommand("osascript", ["-e", script]);
}

/**
 * Send a desktop notification using Linux notify-send.
 */
async function sendLinuxNotification(options: NotificationOptions): Promise<boolean> {
  const args: string[] = [options.title, options.message];

  if (options.icon) {
    args.unshift("--icon", options.icon);
  }

  return execCommand("notify-send", args);
}

/**
 * Send a desktop notification using Windows PowerShell toast notifications.
 */
async function sendWindowsNotification(options: NotificationOptions): Promise<boolean> {
  const title = escapePowerShell(options.title);
  const message = escapePowerShell(options.message);

  const script = [
    "Add-Type -AssemblyName System.Windows.Forms",
    "$notify = New-Object System.Windows.Forms.NotifyIcon",
    "$notify.Icon = [System.Drawing.SystemIcons]::Information",
    "$notify.Visible = $true",
    `$notify.BalloonTipTitle = '${title}'`,
    `$notify.BalloonTipText = '${message}'`,
    "$notify.ShowBalloonTip(5000)",
    "Start-Sleep -Milliseconds 100",
    "$notify.Dispose()",
  ].join("; ");

  return execCommand("powershell", ["-NoProfile", "-NonInteractive", "-Command", script], 10000);
}

/**
 * Send a desktop notification.
 *
 * Uses platform-specific tools:
 * - macOS: osascript (built-in)
 * - Linux: notify-send (libnotify)
 * - Windows: PowerShell toast notifications
 *
 * Fails silently if notification tools are not available.
 */
export async function sendNotification(options: NotificationOptions): Promise<boolean> {
  try {
    const platform = getPlatform();

    switch (platform) {
      case "darwin":
        return await sendMacOSNotification(options);
      case "linux":
        return await sendLinuxNotification(options);
      case "win32":
        return await sendWindowsNotification(options);
      default:
        return false;
    }
  } catch {
    // Never let notification errors propagate
    return false;
  }
}

/**
 * Check if desktop notifications are available on this platform.
 *
 * Tests availability by running a lightweight platform-specific check:
 * - macOS: osascript is always available
 * - Linux: checks if notify-send exists via which
 * - Windows: PowerShell is always available on modern Windows
 */
export async function isNotificationAvailable(): Promise<boolean> {
  try {
    const platform = getPlatform();

    switch (platform) {
      case "darwin":
        // osascript is always available on macOS
        return await execCommand("osascript", ["-e", "return"]);
      case "linux":
        return await execCommand("which", ["notify-send"]);
      case "win32":
        // PowerShell is always available on modern Windows
        return await execCommand("powershell", [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          "exit 0",
        ]);
      default:
        return false;
    }
  } catch {
    return false;
  }
}

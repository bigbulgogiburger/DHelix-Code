/**
 * 데스크톱 알림 유틸리티 — 크로스 플랫폼(macOS/Linux/Windows) 데스크톱 알림 전송
 *
 * 각 OS에 맞는 네이티브 도구를 사용하여 알림을 보냅니다:
 * - macOS: osascript (AppleScript를 실행하는 내장 명령어)
 * - Linux: notify-send (libnotify 패키지)
 * - Windows: PowerShell의 BalloonTip (토스트 알림)
 *
 * 알림 도구가 없어도 에러를 발생시키지 않습니다 (조용히 실패).
 * 장시간 작업 완료나 에러 발생을 사용자에게 알릴 때 사용합니다.
 *
 * @example
 * await sendNotification({ title: "dhelix", message: "작업 완료!", sound: true });
 *
 * @example
 * const available = await isNotificationAvailable();
 * if (available) { ... }
 */

import { execFile } from "node:child_process";
import { getPlatform } from "./platform.js";

/** 데스크톱 알림 전송 시 사용하는 옵션 */
export interface NotificationOptions {
  /** 알림 제목 */
  readonly title: string;
  /** 알림 본문 메시지 */
  readonly message: string;
  /** 알림과 함께 사운드를 재생할지 여부 (선택적) */
  readonly sound?: boolean;
  /** 아이콘 경로 (선택적, Linux에서 활용) */
  readonly icon?: string;
}

/**
 * AppleScript 문자열 리터럴에서 특수 문자를 이스케이프(escape)합니다.
 * 백슬래시(\)와 쌍따옴표(")를 이스케이프해야 AppleScript가 올바르게 실행됩니다.
 *
 * @param str - 이스케이프할 문자열
 * @returns 이스케이프된 문자열
 */
function escapeAppleScript(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * PowerShell 홑따옴표 문자열에서 특수 문자를 이스케이프합니다.
 * PowerShell에서 홑따옴표 내부의 홑따옴표는 두 번 연속으로 적어야 합니다.
 *
 * @param str - 이스케이프할 문자열
 * @returns 이스케이프된 문자열
 */
function escapePowerShell(str: string): string {
  return str.replace(/'/g, "''");
}

/**
 * 외부 명령을 실행하고 성공 여부를 Promise로 반환합니다.
 * 절대 예외를 던지지(throw) 않으며, 실패 시 false를 반환합니다.
 *
 * @param command - 실행할 명령어 (예: "osascript", "notify-send")
 * @param args - 명령어 인수 배열
 * @param timeoutMs - 타임아웃 (밀리초, 기본값 5000ms = 5초)
 * @returns 성공 시 true, 실패 시 false
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
      // unref(): 이 자식 프로세스가 Node.js 이벤트 루프를 유지하지 않도록 설정
      // (알림 전송이 앱 종료를 막지 않게 하기 위함)
      child.unref();
    } catch {
      resolve(false);
    }
  });
}

/**
 * macOS에서 osascript를 사용하여 데스크톱 알림을 전송합니다.
 * AppleScript의 "display notification" 명령을 실행합니다.
 *
 * @param options - 알림 옵션 (제목, 메시지, 사운드)
 * @returns 전송 성공 시 true
 */
async function sendMacOSNotification(options: NotificationOptions): Promise<boolean> {
  const title = escapeAppleScript(options.title);
  const message = escapeAppleScript(options.message);

  // AppleScript 명령어 구성
  let script = `display notification "${message}" with title "${title}"`;
  if (options.sound) {
    script += ' sound name "default"'; // 시스템 기본 사운드 재생
  }

  return execCommand("osascript", ["-e", script]);
}

/**
 * Linux에서 notify-send를 사용하여 데스크톱 알림을 전송합니다.
 * libnotify 패키지가 설치되어 있어야 합니다.
 *
 * @param options - 알림 옵션 (제목, 메시지, 아이콘)
 * @returns 전송 성공 시 true
 */
async function sendLinuxNotification(options: NotificationOptions): Promise<boolean> {
  const args: string[] = [options.title, options.message];

  // 아이콘이 지정된 경우 --icon 옵션을 맨 앞에 추가
  if (options.icon) {
    args.unshift("--icon", options.icon);
  }

  return execCommand("notify-send", args);
}

/**
 * Windows에서 PowerShell을 사용하여 토스트(BalloonTip) 알림을 전송합니다.
 * System.Windows.Forms의 NotifyIcon을 이용합니다.
 *
 * @param options - 알림 옵션 (제목, 메시지)
 * @returns 전송 성공 시 true
 */
async function sendWindowsNotification(options: NotificationOptions): Promise<boolean> {
  const title = escapePowerShell(options.title);
  const message = escapePowerShell(options.message);

  // PowerShell 스크립트: NotifyIcon을 생성하고 BalloonTip을 표시한 후 정리
  const script = [
    "Add-Type -AssemblyName System.Windows.Forms",
    "$notify = New-Object System.Windows.Forms.NotifyIcon",
    "$notify.Icon = [System.Drawing.SystemIcons]::Information",
    "$notify.Visible = $true",
    `$notify.BalloonTipTitle = '${title}'`,
    `$notify.BalloonTipText = '${message}'`,
    "$notify.ShowBalloonTip(5000)", // 5초간 표시
    "Start-Sleep -Milliseconds 100", // 표시 시간 확보
    "$notify.Dispose()", // 리소스 해제
  ].join("; ");

  // Windows PowerShell은 타임아웃을 10초로 설정 (GUI 렌더링 시간 고려)
  return execCommand("powershell", ["-NoProfile", "-NonInteractive", "-Command", script], 10000);
}

/**
 * 데스크톱 알림을 전송합니다.
 *
 * 현재 OS를 감지하여 적절한 네이티브 도구를 사용합니다:
 * - macOS: osascript (내장)
 * - Linux: notify-send (libnotify)
 * - Windows: PowerShell 토스트 알림
 *
 * 알림 도구가 없거나 에러가 발생해도 예외를 던지지 않습니다 (조용히 실패).
 *
 * @param options - 알림 옵션 (제목, 메시지, 사운드 등)
 * @returns 전송 성공 시 true, 실패 시 false
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
    // 알림 에러는 절대 상위로 전파하지 않음 — 알림 실패가 앱을 멈추면 안 됨
    return false;
  }
}

/**
 * 현재 플랫폼에서 데스크톱 알림을 사용할 수 있는지 확인합니다.
 *
 * 각 OS별로 간단한 명령을 실행하여 도구 사용 가능 여부를 테스트합니다:
 * - macOS: osascript가 항상 설치되어 있으므로 간단한 return 명령 실행
 * - Linux: which 명령으로 notify-send 존재 여부 확인
 * - Windows: PowerShell이 실행 가능한지 확인
 *
 * @returns 알림 사용 가능 시 true, 불가능 시 false
 */
export async function isNotificationAvailable(): Promise<boolean> {
  try {
    const platform = getPlatform();

    switch (platform) {
      case "darwin":
        // macOS에서는 osascript가 항상 사용 가능
        return await execCommand("osascript", ["-e", "return"]);
      case "linux":
        // notify-send가 시스템 PATH에 있는지 확인
        return await execCommand("which", ["notify-send"]);
      case "win32":
        // 최신 Windows에서는 PowerShell이 항상 사용 가능
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

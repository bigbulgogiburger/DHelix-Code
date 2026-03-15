/**
 * 데스크톱 알림 설정 — 장시간 작업 완료 시 사용자에게 알려주는 기능의 설정값 정의
 *
 * 에이전트가 오래 걸리는 작업(예: 코드 생성, 빌드)을 마쳤을 때
 * OS 수준의 데스크톱 알림(macOS 알림 센터, Linux notify-send 등)을 보낼지 결정합니다.
 *
 * @example
 * // 기본값: 30초 이상 걸린 작업이 완료되면 알림 전송 (소리 없음)
 * const config: NotificationConfig = DEFAULT_NOTIFICATION_CONFIG;
 */

/** 데스크톱 알림 설정 인터페이스 */
export interface NotificationConfig {
  /** 데스크톱 알림 활성화 여부 (true면 알림 전송) */
  readonly enabled: boolean;
  /** 알림을 보내기 위한 최소 작업 시간 (초 단위) — 이 시간보다 짧게 걸린 작업은 알림하지 않음 */
  readonly minDurationSeconds: number;
  /** 알림과 함께 사운드(소리)를 재생할지 여부 */
  readonly sound: boolean;
}

/**
 * 기본 알림 설정값.
 * - enabled: true (알림 켜짐)
 * - minDurationSeconds: 30 (30초 이상 걸린 작업만 알림)
 * - sound: false (소리 없음)
 */
export const DEFAULT_NOTIFICATION_CONFIG: NotificationConfig = {
  enabled: true,
  minDurationSeconds: 30,
  sound: false,
};

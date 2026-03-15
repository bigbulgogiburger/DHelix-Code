/**
 * 세션 자동 저장(Auto-Save) 모듈
 *
 * 세션 메타데이터를 주기적으로 업데이트하여
 * lastUsedAt(마지막 사용 시각)이 항상 최신 상태를 유지하도록 합니다.
 *
 * 주니어 개발자를 위한 설명:
 * - SessionManager가 메시지를 추가할 때마다 저장하지만, 사용자가 아무것도 입력하지 않는 동안에는
 *   "이 세션이 아직 활성 상태"라는 정보가 업데이트되지 않습니다
 * - 이 모듈은 30초마다 "하트비트(heartbeat)"처럼 메타데이터를 갱신합니다
 * - 프로세스가 예기치 않게 종료되더라도 마지막 활성 시각이 최대한 정확하게 유지됩니다
 * - timer.unref()로 이 타이머가 Node.js 프로세스 종료를 방해하지 않도록 합니다
 */
import type { SessionManager } from "./session-manager.js";

/** 기본 자동 저장 간격: 30초 (밀리초 단위) */
const DEFAULT_INTERVAL_MS = 30_000;

/**
 * 자동 저장 핸들 인터페이스
 * stop() 메서드로 자동 저장을 중지할 수 있습니다.
 */
export interface AutoSaveHandle {
  /** 자동 저장 타이머를 중지합니다 */
  readonly stop: () => void;
}

/**
 * 주기적 세션 메타데이터 갱신을 설정합니다.
 *
 * setInterval로 지정된 간격마다 세션의 lastUsedAt을 갱신합니다.
 * 타이머는 unref() 처리되어 Node.js 프로세스의 자연스러운 종료를 방해하지 않습니다.
 * 저장 중 에러가 발생해도 앱이 크래시하지 않도록 조용히 무시합니다.
 *
 * @param sessionManager - 세션 관리자 인스턴스
 * @param sessionId - 갱신할 세션의 ID
 * @param intervalMs - 갱신 간격 (밀리초, 기본값: 30초)
 * @returns 자동 저장을 중지할 수 있는 핸들 객체
 */
export function setupAutoSave(
  sessionManager: SessionManager,
  sessionId: string,
  intervalMs: number = DEFAULT_INTERVAL_MS,
): AutoSaveHandle {
  const timer = setInterval(() => {
    sessionManager
      .getMetadata(sessionId)
      .then(async (meta) => {
        // 같은 이름으로 "이름 변경"을 하면 lastUsedAt이 자동으로 갱신됨
        // 별도의 "touch" 메서드가 없어서 이 방식을 사용합니다
        await sessionManager.renameSession(sessionId, meta.name);
      })
      .catch(() => {
        // 자동 저장 실패는 치명적이지 않으므로 조용히 무시
        // 예: 파일 잠금 경합, 디스크 일시적 오류 등
      });
  }, intervalMs);

  // unref(): 이 타이머만 남아있을 때 Node.js가 자동 종료되도록 허용
  // unref()가 없으면 사용자가 Ctrl+D로 종료해도 타이머 때문에 프로세스가 살아있게 됨
  timer.unref();

  return {
    stop: () => clearInterval(timer),
  };
}

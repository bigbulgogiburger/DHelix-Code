/**
 * synchronized-output.ts — 터미널 렌더링을 위한 동기화 출력 (DEC Mode 2026)
 *
 * 터미널이 지원하는 경우 (Ghostty, iTerm2 3.5+, WezTerm, kitty,
 * 최신 VSCode 터미널, tmux 3.4+), 출력을 begin/end 마커로 감싸서
 * 터미널이 모든 출력을 버퍼링한 후 한꺼번에 표시하게 합니다.
 * 이렇게 하면 부분적인 화면 업데이트로 인한 깜빡임이 제거됩니다.
 *
 * 이 모드를 지원하지 않는 터미널은 이스케이프 시퀀스를 무시합니다.
 *
 * 기능:
 * - withSynchronizedOutput(fn): 함수 실행을 동기화 마커로 감싸기
 * - patchInkRendering(): Ink의 stdout.write를 패치하여 자동 동기화
 * - enableSynchronizedOutput() / disableSynchronizedOutput(): 기능 토글
 */

// DEC Private Mode 2026 이스케이프 시퀀스
// h = 시작(hold), l = 끝(let go) — 터미널에 버퍼링 시작/종료를 알림
const BEGIN_SYNCHRONIZED = "\x1b[?2026h";
const END_SYNCHRONIZED = "\x1b[?2026l";

let syncOutputEnabled = true;

/** 동기화 출력 비활성화 — 지원하지 않는 것으로 알려진 터미널에서 사용 */
export function disableSynchronizedOutput(): void {
  syncOutputEnabled = false;
}

/** 동기화 출력 활성화 */
export function enableSynchronizedOutput(): void {
  syncOutputEnabled = true;
}

/**
 * stdout 쓰기 함수를 동기화 출력 마커로 감쌉니다.
 * 함수 실행 전에 BEGIN을 보내고, 실행 후(에러가 나도) END를 보냅니다.
 * syncOutputEnabled가 false이면 마커 없이 직접 실행합니다.
 */
export function withSynchronizedOutput(fn: () => void): void {
  if (!syncOutputEnabled) {
    fn();
    return;
  }

  process.stdout.write(BEGIN_SYNCHRONIZED);
  try {
    fn();
  } finally {
    process.stdout.write(END_SYNCHRONIZED);
  }
}

/**
 * Ink의 stdout을 패치하여 렌더링을 자동으로 동기화 출력으로 감쌉니다.
 * Ink의 render() 전에 한 번만 호출하세요.
 *
 * 동작 원리:
 * process.stdout.write를 몽키패치하여 Ink의 렌더 사이클을 감지합니다.
 * Ink의 렌더 사이클은 커서 이동 이스케이프 시퀀스(\x1b[...)로 시작하므로,
 * 이를 감지하면 BEGIN_SYNCHRONIZED를 먼저 보내고,
 * 다음 마이크로태스크에서 END_SYNCHRONIZED를 보냅니다.
 * 이로써 Ink의 전체 프레임이 원자적으로 표시됩니다.
 */
export function patchInkRendering(): void {
  if (!syncOutputEnabled) return;

  const originalWrite = process.stdout.write.bind(process.stdout);
  let inRenderCycle = false;

  // Ink's render cycle starts with cursor save/move sequences
  // We detect this and wrap the entire cycle
  const CSI_CURSOR_UP = "\x1b[";
  const SAVE_CURSOR = "\x1b7";

  process.stdout.write = function patchedWrite(
    chunk: string | Uint8Array,
    encodingOrCallback?: BufferEncoding | ((err?: Error | null) => void),
    callback?: (err?: Error | null) => void,
  ): boolean {
    const str = typeof chunk === "string" ? chunk : "";

    // Detect start of Ink render cycle (cursor movement)
    if (
      !inRenderCycle &&
      str.length > 2 &&
      (str.startsWith(CSI_CURSOR_UP) || str.startsWith(SAVE_CURSOR))
    ) {
      inRenderCycle = true;
      originalWrite(BEGIN_SYNCHRONIZED);
      const result = originalWrite(chunk, encodingOrCallback as BufferEncoding, callback);
      // Schedule end of sync on next microtask (after Ink finishes writing)
      queueMicrotask(() => {
        if (inRenderCycle) {
          inRenderCycle = false;
          originalWrite(END_SYNCHRONIZED);
        }
      });
      return result;
    }

    return originalWrite(chunk, encodingOrCallback as BufferEncoding, callback);
  } as typeof process.stdout.write;
}

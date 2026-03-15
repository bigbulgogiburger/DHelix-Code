/**
 * 마이크 녹음기 — SoX(Sound eXchange)를 사용한 오디오 녹음
 *
 * 시스템의 기본 마이크에서 PCM 오디오를 캡처하여 WAV 형식의 Buffer로 반환합니다.
 * SoX 명령줄 도구를 자식 프로세스(child process)로 실행하여 녹음합니다.
 *
 * 녹음 설정:
 * - 샘플 레이트(sample rate): 16000 Hz (Whisper API 권장)
 * - 채널: 1 (모노)
 * - 비트 깊이: 16비트
 * - 인코딩: signed-integer (PCM)
 * - 형식: WAV
 *
 * @example
 * // SoX 설치 확인
 * const installed = await checkSoxInstalled();
 *
 * // 녹음 시작
 * const recorder = createRecorder({ sampleRate: 16000, channels: 1 });
 *
 * // 녹음 중... (사용자가 말하는 동안 대기)
 *
 * // 정상 종료: SIGTERM으로 SoX를 종료하고 오디오 버퍼 반환
 * const audioBuffer = await recorder.stop();
 *
 * // 또는 취소: SIGKILL로 즉시 종료
 * recorder.cancel();
 */

import { spawn, type ChildProcess } from "node:child_process";

/** 녹음기 생성 옵션 */
export interface RecorderOptions {
  /** 샘플 레이트 (Hz, 기본값: 16000 — Whisper 권장값) */
  readonly sampleRate?: number;
  /** 오디오 채널 수 (기본값: 1 — 모노) */
  readonly channels?: number;
  /** SoX 실행 파일 경로 (기본값: "sox" — PATH에서 찾음) */
  readonly soxPath?: string;
}

/** 녹음기 핸들 — 녹음 제어 인터페이스 */
export interface RecorderHandle {
  /** 녹음을 정상 종료(SIGTERM)하고 오디오 버퍼를 반환합니다 */
  readonly stop: () => Promise<Buffer>;
  /** 녹음을 즉시 취소(SIGKILL)합니다. 오디오 데이터는 버려집니다 */
  readonly cancel: () => void;
  /** 현재 녹음 중인지 여부 */
  readonly isRecording: boolean;
}

/**
 * SoX를 사용하여 마이크 녹음기를 생성합니다.
 *
 * SoX 프로세스를 시작하여 기본 오디오 입력(-d)에서 WAV 형식으로 캡처합니다.
 * stdout으로 출력되는 오디오 데이터를 Buffer 청크(chunk)로 수집합니다.
 *
 * @param options - 녹음 설정 (선택적)
 * @returns 녹음기 핸들 (stop/cancel/isRecording)
 *
 * @example
 * const recorder = createRecorder();
 * // 사용자가 말하는 동안 대기...
 * const audio = await recorder.stop();
 * // audio: WAV 형식의 Buffer
 */
export function createRecorder(options: RecorderOptions = {}): RecorderHandle {
  const { sampleRate = 16000, channels = 1, soxPath = "sox" } = options;

  // 오디오 데이터 청크를 저장할 배열
  const chunks: Buffer[] = [];
  // 녹음 상태 플래그
  let recording = true;
  // stop() 호출 시 사용되는 Promise resolve 콜백
  let resolveStop: ((buf: Buffer) => void) | null = null;

  /**
   * SoX 프로세스 시작
   * 인수 설명:
   * - "-d": 기본 오디오 입력 장치(마이크)에서 캡처
   * - "-t wav": 출력 형식을 WAV로 지정
   * - "-r 16000": 샘플 레이트 16000 Hz
   * - "-c 1": 모노(1채널)
   * - "-b 16": 16비트 깊이
   * - "-e signed-integer": PCM 인코딩
   * - "-": 파일 대신 stdout으로 출력
   */
  const proc: ChildProcess = spawn(
    soxPath,
    [
      "-d",       // 기본 입력 장치
      "-t",       // 출력 형식 지정
      "wav",
      "-r",       // 샘플 레이트
      String(sampleRate),
      "-c",       // 채널 수
      String(channels),
      "-b",       // 비트 깊이
      "16",
      "-e",       // 인코딩 방식
      "signed-integer",
      "-",        // stdout으로 출력
    ],
    { stdio: ["pipe", "pipe", "pipe"] },
  );

  // stdout에서 오디오 데이터 청크를 수집
  proc.stdout?.on("data", (chunk: Buffer) => {
    chunks.push(chunk);
  });

  // SoX 프로세스가 종료되면 수집된 청크를 하나의 Buffer로 합침
  proc.on("close", () => {
    recording = false;
    const buffer = Buffer.concat(chunks);
    resolveStop?.(buffer);
  });

  // SoX 프로세스 에러 시에도 수집된 데이터를 반환
  proc.on("error", () => {
    recording = false;
    resolveStop?.(Buffer.concat(chunks));
  });

  return {
    /** 현재 녹음 중인지 여부를 반환하는 getter */
    get isRecording() {
      return recording;
    },
    /**
     * 녹음을 정상 종료합니다.
     * SIGTERM 시그널을 보내 SoX가 WAV 헤더를 올바르게 마무리하도록 합니다.
     * 프로세스 종료 후 수집된 오디오 데이터를 Buffer로 반환합니다.
     */
    stop: () =>
      new Promise<Buffer>((resolve) => {
        resolveStop = resolve;
        proc.kill("SIGTERM"); // 우아한 종료 — WAV 헤더 마무리
      }),
    /**
     * 녹음을 즉시 취소합니다.
     * SIGKILL 시그널로 SoX를 강제 종료합니다.
     * 오디오 데이터는 사용할 수 없을 수 있습니다.
     */
    cancel: () => {
      recording = false;
      proc.kill("SIGKILL"); // 강제 종료
    },
  };
}

/**
 * SoX가 시스템에 설치되어 있고 사용 가능한지 확인합니다.
 *
 * @param soxPath - SoX 실행 파일 경로 (기본값: "sox")
 * @returns SoX가 사용 가능하면 true
 *
 * @example
 * if (await checkSoxInstalled()) {
 *   console.log("SoX가 설치되어 있습니다. 음성 입력을 사용할 수 있습니다.");
 * } else {
 *   console.log("SoX를 설치하세요: brew install sox (macOS)");
 * }
 */
export async function checkSoxInstalled(soxPath = "sox"): Promise<boolean> {
  try {
    const proc = spawn(soxPath, ["--version"], { stdio: "pipe" });
    return new Promise<boolean>((resolve) => {
      proc.on("close", (code) => resolve(code === 0));
      proc.on("error", () => resolve(false));
    });
  } catch {
    return false;
  }
}

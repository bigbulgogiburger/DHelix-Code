/**
 * 로거 유틸리티 — pino 기반 구조화된 로깅(structured logging) 시스템
 *
 * pino는 Node.js에서 가장 빠른 JSON 로거 중 하나입니다.
 * 이 모듈은 민감 정보(API 키, 토큰 등) 자동 마스킹(redaction)과
 * 파일 기반 로깅을 제공합니다.
 *
 * 로그 레벨은 DHELIX_LOG_LEVEL 환경 변수로 제어합니다:
 * - "trace" < "debug" < "info" < "warn" < "error" < "fatal"
 * - 기본값: "info"
 *
 * 로그 파일은 constants.js의 LOG_FILE 경로에 JSON 형식으로 기록됩니다.
 *
 * @example
 * import { getLogger } from "./logger.js";
 * const log = getLogger();
 * log.info({ userId: "abc" }, "사용자 로그인 성공");
 * log.error({ apiKey: "sk-..." }, "API 호출 실패");
 * // 출력에서 apiKey는 "[REDACTED]"로 마스킹됨
 */

import pino from "pino";
import { LOG_FILE } from "../constants.js";

/**
 * 앱 로거를 생성합니다.
 *
 * 주요 기능:
 * - 민감 정보 자동 마스킹 (apiKey, token, secret, password 등)
 * - 파일로 로그 출력 (JSON 형식)
 * - ISO 8601 형식의 타임스탬프
 *
 * @param options - 로거 생성 옵션 (선택적)
 * @param options.level - 로그 레벨 (기본값: DHELIX_LOG_LEVEL 환경 변수 또는 "info")
 * @param options.file - 로그 파일 경로 (기본값: LOG_FILE 상수)
 * @returns pino Logger 인스턴스
 */
export function createLogger(options?: { level?: string; file?: string }): pino.Logger {
  const level = options?.level ?? (process.env.DHELIX_LOG_LEVEL || "info");
  const file = options?.file ?? LOG_FILE;

  return pino({
    level,
    // redact: 로그에 출력될 때 민감 정보를 "[REDACTED]"로 자동 치환
    // paths에 지정된 키 경로와 매칭되는 값이 마스킹됩니다
    redact: {
      paths: [
        "apiKey",
        "*.apiKey",
        "headers.authorization",
        "*.headers.authorization",
        "*.token",
        "*.secret",
        "*.password",
        "token",
        "secret",
        "password",
        "authorization",
        "*.authorization",
        "*.api_key",
        "api_key",
        "*.accessToken",
        "accessToken",
      ],
      censor: "[REDACTED]", // 마스킹 시 사용할 대체 문자열
    },
    // transport: 로그를 파일로 출력 (stdout 대신 파일에 기록)
    transport: {
      target: "pino/file",
      options: { destination: file, mkdir: true }, // mkdir: 디렉토리가 없으면 자동 생성
    },
    // formatters: 로그 출력 형식 커스터마이징
    formatters: {
      // level: 숫자 대신 문자열 레벨명(info, error 등)을 사용
      level(label) {
        return { level: label };
      },
    },
    // ISO 8601 형식의 타임스탬프 (예: "2024-01-15T10:30:00.000Z")
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}

/** 기본 로거 인스턴스 (싱글톤 패턴으로 한 번만 생성) */
let defaultLogger: pino.Logger | undefined;

/**
 * 기본(default) 로거를 가져오거나, 없으면 새로 생성합니다.
 * 싱글톤 패턴(singleton pattern)으로 앱 전체에서 하나의 로거를 공유합니다.
 *
 * @returns 기본 pino Logger 인스턴스
 *
 * @example
 * const log = getLogger();
 * log.info("서버 시작됨");
 * log.warn({ latencyMs: 5000 }, "느린 응답 감지");
 */
export function getLogger(): pino.Logger {
  if (!defaultLogger) {
    defaultLogger = createLogger();
  }
  return defaultLogger;
}

/**
 * 커스텀 로거를 기본 로거로 설정합니다.
 * 주로 테스트에서 모킹(mocking)된 로거를 주입할 때 사용합니다.
 *
 * @param logger - 기본 로거로 사용할 pino Logger 인스턴스
 */
export function setLogger(logger: pino.Logger): void {
  defaultLogger = logger;
}

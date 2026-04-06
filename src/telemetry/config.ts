/**
 * 텔레메트리 설정 — 환경 변수를 통한 텔레메트리 구성 관리
 *
 * 텔레메트리(원격 측정)의 활성화, OTLP 엔드포인트, Prometheus 포트,
 * 내보내기 간격 등을 환경 변수로 설정할 수 있습니다.
 *
 * 기본적으로 텔레메트리는 비활성 상태입니다 (프라이버시 보호).
 * 활성화하려면 DHELIX_TELEMETRY=true 또는 DHELIX_TELEMETRY_ENABLED=true를 설정하세요.
 *
 * 지원하는 환경 변수:
 * - DHELIX_TELEMETRY=true (간편 활성화)
 * - DHELIX_TELEMETRY_ENABLED=true|false
 * - DHELIX_TELEMETRY_OTLP_ENDPOINT=http://localhost:4318
 * - DHELIX_TELEMETRY_PROMETHEUS_PORT=9464
 * - DHELIX_TELEMETRY_EXPORT_INTERVAL_MS=60000
 * - DHELIX_TELEMETRY_SERVICE_NAME=dhelix
 * - DHELIX_TELEMETRY_SERVICE_VERSION=0.1.0
 * - OTEL_EXPORTER_OTLP_ENDPOINT (표준 OTel 환경 변수, 폴백)
 * - OTEL_SERVICE_NAME (표준 OTel 환경 변수, 폴백)
 *
 * @example
 * // 환경 변수 설정 후 설정 로드
 * process.env.DHELIX_TELEMETRY = "true";
 * process.env.DHELIX_TELEMETRY_OTLP_ENDPOINT = "http://localhost:4318";
 * const config = loadTelemetryConfig();
 * // config.enabled → true
 * // config.otlpEndpoint → "http://localhost:4318"
 */

import { z } from "zod";

/**
 * Zod 스키마: 텔레메트리 설정 유효성 검사.
 *
 * 각 필드의 기본값이 설정되어 있어, 환경 변수가 없는 필드는 기본값을 사용합니다.
 */
export const telemetryConfigSchema = z.object({
  /** 텔레메트리 활성화 여부 (기본값: false — 프라이버시를 위해 비활성) */
  enabled: z.boolean().default(false),
  /** OTLP 엔드포인트 URL (메트릭/로그 전송 대상) */
  otlpEndpoint: z.string().url().optional(),
  /** Prometheus 메트릭 노출 포트 (선택적) */
  prometheusPort: z.number().int().positive().optional(),
  /** 내보내기 간격 (밀리초, 기본값: 60000 = 1분) */
  exportIntervalMs: z.number().int().positive().default(60_000),
  /** 텔레메트리 식별용 서비스 이름 (기본값: "dhelix") */
  serviceName: z.string().default("dhelix"),
  /** 서비스 버전 (기본값: "0.1.0") */
  serviceVersion: z.string().default("0.1.0"),
  /** OTel 리소스에 추가할 커스텀 속성(attributes) */
  resourceAttributes: z.record(z.string()).default({}),
});

/** Zod 스키마에서 추론된 텔레메트리 설정 타입 */
export type TelemetryConfig = z.infer<typeof telemetryConfigSchema>;

/** 텔레메트리 환경 변수 접두사 */
const ENV_PREFIX = "DHELIX_TELEMETRY_";

/**
 * 환경 변수에서 텔레메트리 설정을 로드합니다.
 *
 * 환경 변수 매핑:
 * - DHELIX_TELEMETRY=true → enabled: true (간편 활성화)
 * - DHELIX_TELEMETRY_ENABLED=true → enabled: true
 * - DHELIX_TELEMETRY_OTLP_ENDPOINT → otlpEndpoint
 * - DHELIX_TELEMETRY_PROMETHEUS_PORT → prometheusPort
 * - DHELIX_TELEMETRY_EXPORT_INTERVAL_MS → exportIntervalMs
 * - DHELIX_TELEMETRY_SERVICE_NAME → serviceName
 * - DHELIX_TELEMETRY_SERVICE_VERSION → serviceVersion
 * - OTEL_EXPORTER_OTLP_ENDPOINT → otlpEndpoint (표준 OTel 폴백)
 * - OTEL_SERVICE_NAME → serviceName (표준 OTel 폴백)
 *
 * @returns 파싱된 텔레메트리 설정 (Zod 스키마 기본값 적용)
 */
export function loadTelemetryConfig(): TelemetryConfig {
  const env = process.env;

  // 환경 변수에서 원시 값 추출
  const raw = {
    // DHELIX_TELEMETRY=true 또는 DHELIX_TELEMETRY_ENABLED=true 중 하나로 활성화
    enabled: env[`${ENV_PREFIX}ENABLED`] === "true" || env.DHELIX_TELEMETRY === "true",
    // OTLP 엔드포인트: 전용 변수 → 표준 OTel 변수 순으로 폴백
    otlpEndpoint: env[`${ENV_PREFIX}OTLP_ENDPOINT`] ?? env.OTEL_EXPORTER_OTLP_ENDPOINT ?? undefined,
    prometheusPort: env[`${ENV_PREFIX}PROMETHEUS_PORT`]
      ? Number(env[`${ENV_PREFIX}PROMETHEUS_PORT`])
      : undefined,
    exportIntervalMs: env[`${ENV_PREFIX}EXPORT_INTERVAL_MS`]
      ? Number(env[`${ENV_PREFIX}EXPORT_INTERVAL_MS`])
      : undefined,
    // 서비스 이름: 전용 변수 → 표준 OTel 변수 순으로 폴백
    serviceName: env[`${ENV_PREFIX}SERVICE_NAME`] ?? env.OTEL_SERVICE_NAME ?? undefined,
    serviceVersion: env[`${ENV_PREFIX}SERVICE_VERSION`] ?? undefined,
  };

  // undefined 값을 제거하여 Zod 기본값이 적용되도록 함
  const cleaned = Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== undefined));

  // Zod 스키마로 파싱 + 유효성 검사 + 기본값 적용
  return telemetryConfigSchema.parse(cleaned);
}

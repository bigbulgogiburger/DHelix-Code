/**
 * SIEM Audit Log Exporter — 감사 로그를 SIEM 시스템 호환 형식으로 내보내기
 *
 * 보안 정보 및 이벤트 관리(SIEM) 시스템과 통합하기 위한 로그 내보내기 모듈입니다.
 * 세 가지 업계 표준 포맷을 지원합니다:
 * - JSON Lines: 단순하고 범용적인 구조화 로그
 * - CEF (Common Event Format): ArcSight 등의 SIEM 시스템 표준
 * - LEEF (Log Event Extended Format): IBM QRadar 전용 포맷
 *
 * 기능:
 * - 파일 자동 로테이션 (크기 기반)
 * - 필드 필터링 (includeFields 옵션)
 * - 비동기 파일 쓰기
 *
 * @example
 * const exporter = new SiemExporter({ format: "cef", outputPath: "/var/log/dhelix.cef" });
 * const formatted = exporter.exportEvent(auditEntry);
 * await exporter.writeToFile(formatted);
 */

import { appendFile, stat, rename, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { AuditEntry } from "./audit-log.js";

/** SIEM 지원 포맷 */
export type SiemFormat = "json-lines" | "cef" | "leef";

/** 재내보내기를 위한 AuditEntry 타입 별칭 */
export type { AuditEntry };

/**
 * SiemExporter 설정
 *
 * @property format - 출력 포맷 ("json-lines" | "cef" | "leef")
 * @property outputPath - 파일 출력 경로 (미설정 시 파일 쓰기 비활성화)
 * @property maxFileSize - 로테이션 트리거 파일 크기 (바이트, 기본값: 10MB)
 * @property includeFields - 포함할 필드 목록 (미설정 시 전체 필드)
 */
export interface SiemExportConfig {
  readonly format: SiemFormat;
  readonly outputPath?: string;
  readonly maxFileSize?: number;
  readonly includeFields?: readonly string[];
}

/** 기본 최대 파일 크기: 10MB */
const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024;

/** CEF 버전 */
const CEF_VERSION = "0";

/** CEF 디바이스 벤더 */
const CEF_VENDOR = "DhelixCode";

/** CEF 디바이스 제품명 */
const CEF_PRODUCT = "DhelixCode";

/** CEF 디바이스 버전 */
const CEF_DEVICE_VERSION = "1.0";

/** LEEF 버전 */
const LEEF_VERSION = "1.0";

/** LEEF 벤더 */
const LEEF_VENDOR = "DhelixCode";

/** LEEF 제품명 */
const LEEF_PRODUCT = "DhelixCode";

/** LEEF 제품 버전 */
const LEEF_PRODUCT_VERSION = "1.0";

/**
 * CEF 확장 필드 값에서 특수 문자를 이스케이프합니다.
 * CEF 스펙에 따라 `=`, `\`, 개행 문자를 이스케이프합니다.
 *
 * @param value - 이스케이프할 값
 * @returns 이스케이프된 문자열
 */
function escapeCefExtension(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/=/g, "\\=").replace(/\r?\n/g, "\\n");
}

/**
 * CEF 헤더 필드에서 파이프(|) 문자와 백슬래시를 이스케이프합니다.
 *
 * @param value - 이스케이프할 값
 * @returns 이스케이프된 문자열
 */
function escapeCefHeader(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\|/g, "\\|");
}

/**
 * LEEF 속성 값에서 탭 문자와 개행을 이스케이프합니다.
 *
 * @param value - 이스케이프할 값
 * @returns 이스케이프된 문자열
 */
function escapeLeefValue(value: string): string {
  return value.replace(/\t/g, "\\t").replace(/\r?\n/g, "\\n");
}

/**
 * 결정(decision) 문자열을 CEF 심각도(severity) 숫자로 변환합니다.
 *
 * - approved: 2 (낮음)
 * - auto-approved: 1 (매우 낮음)
 * - denied: 8 (높음)
 *
 * @param decision - 감사 결정 문자열
 * @returns CEF 심각도 (0-10)
 */
function decisionToSeverity(decision: string): number {
  switch (decision) {
    case "approved":
      return 2;
    case "auto-approved":
      return 1;
    case "denied":
      return 8;
    default:
      return 5;
  }
}

/**
 * SIEM 호환 형식으로 감사 로그를 내보내는 클래스.
 *
 * @example
 * const exporter = new SiemExporter({ format: "cef", outputPath: "/var/log/dhelix.cef" });
 * const formatted = exporter.exportEvent(entry);
 * await exporter.writeToFile(formatted);
 */
export class SiemExporter {
  private readonly config: SiemExportConfig;
  private dirInitialized: boolean = false;

  /**
   * @param config - SIEM 내보내기 설정
   */
  constructor(config: SiemExportConfig) {
    this.config = config;
  }

  /**
   * AuditEntry를 설정된 포맷의 문자열로 변환합니다.
   *
   * @param event - 감사 로그 항목
   * @returns 포맷된 문자열 (개행 포함)
   */
  exportEvent(event: AuditEntry): string {
    const filtered = this.applyFieldFilter(event);

    switch (this.config.format) {
      case "json-lines":
        return this.formatAsJsonLines(filtered);
      case "cef":
        return this.formatAsCef(filtered);
      case "leef":
        return this.formatAsLeef(filtered);
      default: {
        const _exhaustive: never = this.config.format;
        void _exhaustive;
        return this.formatAsJsonLines(filtered);
      }
    }
  }

  /**
   * includeFields 설정에 따라 이벤트 필드를 필터링합니다.
   * includeFields가 설정되지 않으면 원본 이벤트를 그대로 반환합니다.
   *
   * @param event - 원본 감사 로그 항목
   * @returns 필터링된 감사 로그 항목
   */
  private applyFieldFilter(event: AuditEntry): AuditEntry {
    const { includeFields } = this.config;
    if (!includeFields || includeFields.length === 0) {
      return event;
    }

    const filtered: Record<string, unknown> = {};
    for (const field of includeFields) {
      if (field in event) {
        filtered[field] = (event as unknown as Record<string, unknown>)[field];
      }
    }

    return filtered as unknown as AuditEntry;
  }

  /**
   * JSON Lines 포맷으로 변환합니다.
   *
   * 각 이벤트를 단일 JSON 객체로 직렬화하고 개행 문자를 추가합니다.
   *
   * @param event - 감사 로그 항목
   * @returns JSON Lines 형식 문자열
   */
  formatAsJsonLines(event: AuditEntry): string {
    return JSON.stringify(event) + "\n";
  }

  /**
   * CEF (Common Event Format) 포맷으로 변환합니다.
   *
   * CEF 형식: `CEF:Version|DeviceVendor|DeviceProduct|DeviceVersion|SignatureID|Name|Severity|Extension`
   *
   * @see https://www.microfocus.com/documentation/arcsight/arcsight-smartconnectors/pdfdoc/common-event-format-v25/common-event-format-v25.pdf
   * @param event - 감사 로그 항목
   * @returns CEF 형식 문자열
   */
  formatAsCef(event: AuditEntry): string {
    const severity = decisionToSeverity(event.decision ?? "");
    const signatureId = `dhelix-${event.decision ?? "unknown"}`;
    const name = `Tool ${event.decision ?? "unknown"}: ${event.toolName ?? ""}`;

    const headerParts = [
      `CEF:${CEF_VERSION}`,
      escapeCefHeader(CEF_VENDOR),
      escapeCefHeader(CEF_PRODUCT),
      escapeCefHeader(CEF_DEVICE_VERSION),
      escapeCefHeader(signatureId),
      escapeCefHeader(name),
      String(severity),
    ];

    const extensions: string[] = [];

    if (event.timestamp) {
      extensions.push(`rt=${escapeCefExtension(event.timestamp)}`);
    }
    if (event.sessionId) {
      extensions.push(`suser=${escapeCefExtension(event.sessionId)}`);
    }
    if (event.toolName) {
      extensions.push(`act=${escapeCefExtension(event.toolName)}`);
    }
    if (event.decision) {
      extensions.push(`outcome=${escapeCefExtension(event.decision)}`);
    }
    if (event.reason) {
      extensions.push(`msg=${escapeCefExtension(event.reason)}`);
    }

    return headerParts.join("|") + "|" + extensions.join(" ") + "\n";
  }

  /**
   * LEEF (Log Event Extended Format) 포맷으로 변환합니다.
   *
   * LEEF 형식: `LEEF:Version|Vendor|Product|Version|EventID|\tattribute=value...`
   *
   * @see https://www.ibm.com/docs/en/dsm?topic=leef-overview
   * @param event - 감사 로그 항목
   * @returns LEEF 형식 문자열
   */
  formatAsLeef(event: AuditEntry): string {
    const eventId = `dhelix-${event.decision ?? "unknown"}`;

    const header = [
      `LEEF:${LEEF_VERSION}`,
      escapeLeefValue(LEEF_VENDOR),
      escapeLeefValue(LEEF_PRODUCT),
      escapeLeefValue(LEEF_PRODUCT_VERSION),
      escapeLeefValue(eventId),
    ].join("|");

    const attributes: string[] = [];

    if (event.timestamp) {
      attributes.push(`devTime=${escapeLeefValue(event.timestamp)}`);
    }
    if (event.sessionId) {
      attributes.push(`usrName=${escapeLeefValue(event.sessionId)}`);
    }
    if (event.toolName) {
      attributes.push(`action=${escapeLeefValue(event.toolName)}`);
    }
    if (event.decision) {
      attributes.push(`outcome=${escapeLeefValue(event.decision)}`);
    }
    if (event.reason) {
      attributes.push(`reason=${escapeLeefValue(event.reason)}`);
    }

    return header + "\t" + attributes.join("\t") + "\n";
  }

  /**
   * 포맷된 로그 문자열을 파일에 추가합니다.
   * 파일 크기가 maxFileSize를 초과하면 로테이션을 수행합니다.
   * outputPath가 설정되지 않은 경우 아무 작업도 수행하지 않습니다.
   *
   * @param formatted - 파일에 쓸 포맷된 로그 문자열
   */
  async writeToFile(formatted: string): Promise<void> {
    const { outputPath } = this.config;
    if (!outputPath) return;

    await this.ensureDirectory(outputPath);
    await this.rotateIfNeeded();
    await appendFile(outputPath, formatted, { encoding: "utf-8" });
  }

  /**
   * 출력 파일이 maxFileSize를 초과한 경우 로테이션을 수행합니다.
   * 기존 파일을 `.timestamp.bak` 접미사를 붙여 이름을 바꿉니다.
   * outputPath가 설정되지 않은 경우 아무 작업도 수행하지 않습니다.
   */
  async rotateIfNeeded(): Promise<void> {
    const { outputPath, maxFileSize = DEFAULT_MAX_FILE_SIZE } = this.config;
    if (!outputPath) return;

    try {
      const fileStat = await stat(outputPath);
      if (fileStat.size >= maxFileSize) {
        const timestamp = Date.now();
        const rotatedPath = `${outputPath}.${timestamp}.bak`;
        await rename(outputPath, rotatedPath);
      }
    } catch {
      // 파일이 없으면 로테이션 불필요 — 무시
    }
  }

  /**
   * 출력 파일의 부모 디렉토리가 존재하는지 확인하고 없으면 생성합니다.
   * 지연 초기화 패턴을 사용하여 최초 쓰기 시 한 번만 실행합니다.
   *
   * @param filePath - 파일 경로
   */
  private async ensureDirectory(filePath: string): Promise<void> {
    if (!this.dirInitialized) {
      await mkdir(dirname(filePath), { recursive: true });
      this.dirInitialized = true;
    }
  }
}

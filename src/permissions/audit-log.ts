/**
 * 감사 로그(Audit Log) — 권한 결정 이력을 기록하는 모듈
 *
 * 감사 로그란 "누가, 언제, 무엇을, 왜" 했는지를 기록하는 보안 추적 시스템입니다.
 * 보안 사고 발생 시 어떤 도구가 승인/거부되었는지 추적할 수 있습니다.
 *
 * 기록 형식: JSONL (JSON Lines)
 * - 각 줄이 하나의 독립적인 JSON 객체
 * - 한 줄씩 추가(append)하므로 파일이 손상되더라도 다른 줄에 영향 없음
 * - 파싱이 간단하고 스트리밍 처리에 적합
 *
 * 기본 로그 파일 경로: ~/.dbcode/audit.jsonl
 *
 * 예시:
 * ```jsonl
 * {"timestamp":"2024-01-15T10:30:00.000Z","sessionId":"abc123","toolName":"Bash","decision":"approved","reason":"Session approved"}
 * {"timestamp":"2024-01-15T10:30:05.000Z","sessionId":"abc123","toolName":"file_write","decision":"denied","reason":"Persistent deny rule"}
 * ```
 */

import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";

/**
 * 감사 로그 항목 인터페이스
 *
 * @property timestamp - ISO 8601 형식의 타임스탬프 (예: "2024-01-15T10:30:00.000Z")
 * @property sessionId - 현재 세션의 고유 ID (같은 세션의 로그를 그룹핑)
 * @property toolName - 권한 검사 대상 도구 이름
 * @property decision - 권한 결정:
 *   - "approved": 사용자가 수동으로 승인
 *   - "denied": 거부됨
 *   - "auto-approved": 규칙/모드에 의해 자동 승인
 * @property reason - 결정의 이유 (선택적)
 */
export interface AuditEntry {
  readonly timestamp: string;
  readonly sessionId: string;
  readonly toolName: string;
  readonly decision: "approved" | "denied" | "auto-approved";
  readonly reason?: string;
}

/**
 * JSONL 형식의 추가 전용(append-only) 감사 로거 클래스
 *
 * 한 번 기록된 로그는 수정하거나 삭제할 수 없는 추가 전용 방식입니다.
 * 이는 감사 로그의 무결성(integrity)을 보장합니다 —
 * 공격자가 흔적을 지우려 해도 기존 로그는 보존됩니다.
 */
export class AuditLogger {
  /** 로그 파일의 절대 경로 */
  private readonly logPath: string;

  /** 로그 디렉토리가 생성되었는지 추적 (지연 초기화용) */
  private initialized: boolean = false;

  /**
   * @param logPath - 감사 로그 파일의 절대 경로 (예: ~/.dbcode/audit.jsonl)
   */
  constructor(logPath: string) {
    this.logPath = logPath;
  }

  /**
   * 로그 디렉토리가 존재하는지 확인하고, 없으면 생성합니다.
   *
   * 지연 초기화(lazy initialization) 패턴을 사용합니다:
   * - 생성자에서는 디렉토리를 확인하지 않음 (불필요한 I/O 방지)
   * - 첫 번째 기록 시점에 한 번만 디렉토리 생성 확인
   * - 이후 호출에서는 건너뜀 (initialized 플래그)
   */
  private async ensureDirectory(): Promise<void> {
    if (!this.initialized) {
      // recursive: true → 중간 경로의 디렉토리도 자동 생성
      await mkdir(dirname(this.logPath), { recursive: true });
      this.initialized = true;
    }
  }

  /**
   * 감사 로그 항목을 JSONL 파일에 추가합니다.
   *
   * 각 항목은 단일 JSON 줄로 직렬화되어 파일 끝에 추가됩니다.
   * 운영체제의 파이프 버퍼 크기(보통 4KB) 미만의 쓰기는
   * 원자적(atomic)으로 수행되어 동시 쓰기 시에도 줄이 깨지지 않습니다.
   *
   * @param entry - 기록할 감사 로그 항목
   */
  async log(entry: AuditEntry): Promise<void> {
    await this.ensureDirectory();

    // JSON 직렬화 + 줄바꿈 추가 (JSONL 형식)
    const line = JSON.stringify(entry) + "\n";
    await appendFile(this.logPath, line, { encoding: "utf-8" });
  }

  /**
   * 가장 최근의 감사 로그 항목들을 읽어옵니다.
   *
   * 파일 전체를 읽은 후 마지막 N개 항목을 반환합니다.
   * 손상된 줄(JSON 파싱 실패)은 건너뛰어 방어적으로 처리합니다.
   *
   * @param count - 반환할 최대 항목 수 (기본값: 50)
   * @returns 시간순으로 정렬된 감사 로그 항목 배열
   *   로그 파일이 없으면 빈 배열을 반환합니다.
   */
  async getRecentEntries(count: number = 50): Promise<readonly AuditEntry[]> {
    try {
      const content = await readFile(this.logPath, { encoding: "utf-8" });

      // 줄바꿈으로 분리하고 빈 줄 제거
      const lines = content
        .split("\n")
        .filter((line) => line.trim().length > 0);

      const entries: AuditEntry[] = [];
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line) as AuditEntry;
          entries.push(parsed);
        } catch {
          // 손상된 줄은 건너뜀 — 로그 파일 일부가 깨져도 나머지는 정상 처리
        }
      }

      // 마지막 `count`개 항목만 반환 (시간순 유지)
      if (entries.length > count) {
        return entries.slice(-count);
      }

      return entries;
    } catch {
      // 파일이 존재하지 않거나 읽기 실패 — 빈 배열 반환
      return [];
    }
  }
}

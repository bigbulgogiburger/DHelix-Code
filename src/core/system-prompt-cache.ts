/**
 * 시스템 프롬프트 캐시(System Prompt Cache) 모듈
 *
 * 빌드된 시스템 프롬프트를 캐싱하여 매 에이전트 루프 반복마다
 * 불필요하게 다시 생성하는 것을 방지합니다.
 *
 * 주니어 개발자를 위한 설명:
 * - 시스템 프롬프트 빌드는 파일 읽기, git 명령 실행 등 비용이 드는 작업입니다
 * - 설정 파일이 변경되지 않았다면 같은 프롬프트를 재사용하는 것이 효율적입니다
 * - 이 캐시는 "파일 수정 시각(mtime)"을 기반으로 무효화(invalidation)됩니다
 * - 설정 파일이 수정되면 자동으로 프롬프트를 다시 빌드합니다
 */
import { stat } from "node:fs/promises";
import { createHash } from "node:crypto";

/**
 * 시스템 프롬프트 캐시 클래스
 *
 * 단순한 키-값 캐시로, 키가 일치하면 캐시된 프롬프트를 반환합니다.
 * 키는 설정 파일들의 수정 시각(mtime) 해시로 생성되므로,
 * 파일이 변경되면 키가 달라져 자동으로 캐시가 무효화됩니다.
 */
export class SystemPromptCache {
  /** 캐시된 프롬프트 문자열 */
  private cached: string | null = null;
  /** 현재 캐시 키 */
  private cacheKey: string | null = null;

  /**
   * 캐시에서 프롬프트를 가져옵니다.
   * 키가 일치하면 캐시된 프롬프트를 반환하고, 아니면 null을 반환합니다 (캐시 미스).
   *
   * @param key - 확인할 캐시 키
   * @returns 캐시된 프롬프트 문자열, 또는 캐시 미스 시 null
   */
  get(key: string): string | null {
    if (this.cacheKey === key && this.cached !== null) {
      return this.cached;
    }
    return null;
  }

  /**
   * 프롬프트를 캐시에 저장합니다.
   *
   * @param key - 캐시 키 (파일 mtime 해시)
   * @param prompt - 저장할 시스템 프롬프트 문자열
   */
  set(key: string, prompt: string): void {
    this.cacheKey = key;
    this.cached = prompt;
  }

  /**
   * 캐시를 무효화(초기화)합니다.
   * 저장된 프롬프트와 키를 모두 삭제합니다.
   */
  invalidate(): void {
    this.cached = null;
    this.cacheKey = null;
  }

  /**
   * 설정 파일들의 수정 시각(mtime)으로부터 캐시 키를 생성합니다.
   *
   * 모든 파일 경로와 그 수정 시각을 결합한 뒤 SHA-256 해시를 생성합니다.
   * 파일이 존재하지 않으면 mtime을 "0"으로 처리하여,
   * 파일 삭제도 캐시 무효화를 유발합니다.
   *
   * @param instructionFiles - 캐시 키 생성에 사용할 설정 파일 경로 목록
   * @returns 16자리 해시 문자열 (캐시 키)
   */
  static async buildKey(instructionFiles: readonly string[]): Promise<string> {
    const parts: string[] = [];

    for (const filePath of instructionFiles) {
      try {
        const fileStat = await stat(filePath);
        // 파일 경로와 수정 시각을 "경로:시각" 형태로 기록
        parts.push(`${filePath}:${fileStat.mtimeMs}`);
      } catch {
        // 파일이 없거나 접근 불가 → 센티넬 값 "0"을 사용
        // 이렇게 하면 파일이 삭제되어도 캐시 키가 변경됨
        parts.push(`${filePath}:0`);
      }
    }

    // SHA-256 해시를 생성하고 앞 16자만 사용 (충분히 고유함)
    const hash = createHash("sha256");
    hash.update(parts.join("\n"));
    return hash.digest("hex").slice(0, 16);
  }
}

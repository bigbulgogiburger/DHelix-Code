/**
 * 토큰 카운터 — 텍스트의 토큰 수를 정확하게 또는 빠르게 추정하는 모듈
 *
 * LLM은 텍스트를 "토큰" 단위로 처리합니다. 토큰은 단어, 단어의 일부,
 * 또는 특수 문자일 수 있습니다. (예: "Hello, world!" → ["Hello", ",", " world", "!"])
 *
 * 토큰 수를 정확히 아는 것은 중요합니다:
 * - 컨텍스트 윈도우 한도 관리 (예: 128K 토큰 초과 방지)
 * - API 비용 계산 (토큰당 과금)
 * - 최적의 프롬프트 크기 결정
 *
 * 이 모듈은 두 가지 방법을 제공합니다:
 * 1. countTokens(): tiktoken 라이브러리를 사용한 정확한 계산 (LRU 캐시 포함)
 * 2. estimateTokens(): 문자 수 기반 빠른 추정 (~10% 오차, 스트리밍 시 사용)
 */
import { getEncoding } from "js-tiktoken";

/**
 * tiktoken 인코더 인스턴스 — 지연 초기화(lazy initialization)
 * 처음 사용할 때만 생성하여 불필요한 초기화 비용을 방지합니다.
 */
let encoder: ReturnType<typeof getEncoding> | undefined;

/**
 * tiktoken 인코더 인스턴스를 가져오거나 생성
 *
 * o200k_base 인코딩을 사용합니다 (GPT-4o, GPT-5 등 최신 OpenAI 모델 기준).
 * 싱글톤 패턴으로 한 번만 생성됩니다.
 *
 * @returns tiktoken 인코더 인스턴스
 */
function getEncoder(): ReturnType<typeof getEncoding> {
  if (!encoder) {
    encoder = getEncoding("o200k_base");
  }
  return encoder;
}

/**
 * 문자열의 간단한 해시 계산 — LRU 캐시 키로 사용
 *
 * FNV-1a 해시 알고리즘의 변형을 사용합니다.
 * FNV-1a는 빠르고 충돌이 적은 비암호화 해시 알고리즘입니다.
 *
 * 전체 텍스트를 캐시 키로 사용하면 메모리가 낭비되므로,
 * 짧은 해시 값으로 변환하여 캐시 효율을 높입니다.
 *
 * @param str - 해시할 문자열
 * @returns 36진수 해시 문자열
 */
function hashString(str: string): string {
  let hash = 0x811c9dc5;  // FNV-1a 초기값 (offset basis)
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);    // XOR로 문자 코드를 섞음
    hash = (hash * 0x01000193) >>> 0;  // FNV prime으로 곱셈 (32비트 unsigned 유지)
  }
  return hash.toString(36);  // 36진수로 변환하여 짧은 문자열 생성
}

/** LRU 캐시 통계 — 캐시 효율을 모니터링하기 위한 정보 */
export interface TokenCacheStats {
  /** 캐시 적중 횟수 — 캐시에서 바로 결과를 찾은 횟수 */
  readonly hits: number;
  /** 캐시 미적중 횟수 — 캐시에 없어서 실제 계산을 수행한 횟수 */
  readonly misses: number;
  /** 적중률 (hits / (hits + misses)) — 1에 가까울수록 캐시가 효과적 */
  readonly hitRate: number;
  /** 현재 캐시에 저장된 항목 수 */
  readonly size: number;
}

/**
 * Map 기반 LRU(Least Recently Used) 캐시
 *
 * LRU 캐시는 가장 오래 사용되지 않은 항목을 우선적으로 제거합니다.
 * JavaScript Map의 삽입 순서 보장 특성을 활용하여 구현합니다:
 * - 항목에 접근할 때: 삭제 후 재삽입하여 "최근 사용됨"으로 이동
 * - 용량 초과 시: Map의 첫 번째 항목(가장 오래된)을 제거
 *
 * 같은 텍스트에 대해 반복적으로 토큰 수를 계산하는 경우
 * (예: 컨텍스트 관리에서 동일 메시지의 토큰 수 반복 조회)
 * 캐시를 통해 불필요한 재계산을 방지합니다.
 */
export class TokenCountCache {
  private readonly cache = new Map<string, number>();
  /** 최대 캐시 크기 */
  private readonly maxSize: number;
  /** 캐시 적중 횟수 */
  private hits = 0;
  /** 캐시 미적중 횟수 */
  private misses = 0;

  /**
   * @param maxSize - 최대 캐시 항목 수 (기본값: 100)
   */
  constructor(maxSize = 100) {
    this.maxSize = maxSize;
  }

  /**
   * 캐시에서 토큰 수를 조회
   *
   * 항목이 있으면 삭제 후 재삽입하여 "최근 사용됨"으로 이동합니다.
   * 이것이 LRU 캐시의 핵심 메커니즘입니다.
   *
   * @param key - 해시된 텍스트 키
   * @returns 토큰 수 (캐시에 없으면 undefined)
   */
  get(key: string): number | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      this.hits++;
      // Map에서 삭제 후 재삽입하여 삽입 순서를 갱신 (= 최근 사용됨 표시)
      this.cache.delete(key);
      this.cache.set(key, value);
      return value;
    }
    this.misses++;
    return undefined;
  }

  /**
   * 캐시에 토큰 수를 저장
   *
   * 캐시가 가득 차면 가장 오래된 항목(Map의 첫 번째 키)을 제거합니다.
   *
   * @param key - 해시된 텍스트 키
   * @param count - 저장할 토큰 수
   */
  set(key: string, count: number): void {
    // 이미 존재하는 키면 삭제 후 재삽입 (삽입 순서 갱신)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // 용량 초과 — Map의 첫 번째 키(가장 오래된 항목)를 제거
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, count);
  }

  /**
   * 캐시 적중/미적중 통계 반환
   *
   * @returns 캐시 통계 객체
   */
  getStats(): TokenCacheStats {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
      size: this.cache.size,
    };
  }

  /**
   * 캐시를 완전히 초기화 — 모든 항목 삭제 및 통계 리셋
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }
}

/**
 * 싱글톤 토큰 캐시 인스턴스 — 최대 500개 항목 저장
 * 애플리케이션 전체에서 하나의 캐시를 공유합니다.
 */
const tokenCache = new TokenCountCache(500);

/**
 * tiktoken을 사용하여 텍스트의 토큰 수를 정확하게 계산
 *
 * LRU 캐시를 사용하여 동일한 텍스트에 대한 반복 계산을 방지합니다.
 * 같은 텍스트가 반복적으로 조회되는 경우 (예: 컨텍스트 관리)
 * 캐시 덕분에 첫 번째 계산 이후에는 즉시 결과를 반환합니다.
 *
 * @param text - 토큰 수를 계산할 텍스트
 * @returns 정확한 토큰 수
 */
export function countTokens(text: string): number {
  // 텍스트를 해시하여 캐시 키 생성
  const key = hashString(text);
  const cached = tokenCache.get(key);
  if (cached !== undefined) {
    return cached;  // 캐시 적중 — 즉시 반환
  }

  // 캐시 미적중 — tiktoken으로 실제 계산
  const enc = getEncoder();
  const count = enc.encode(text).length;  // 텍스트를 토큰 배열로 인코딩 후 길이 반환
  tokenCache.set(key, count);             // 결과를 캐시에 저장
  return count;
}

/**
 * 토큰 캐시 통계를 반환 — 진단(diagnostics) 용도
 *
 * @returns 캐시 적중/미적중 통계
 */
export function getTokenCacheStats(): TokenCacheStats {
  return tokenCache.getStats();
}

/**
 * 토큰 캐시를 초기화 — 테스트에서 격리를 위해 사용
 */
export function resetTokenCache(): void {
  tokenCache.clear();
}

/**
 * 문자 수 기반 빠른 토큰 수 추정 (~10% 오차)
 *
 * tiktoken보다 훨씬 빠르므로, 정확도보다 속도가 중요한 상황에서 사용합니다.
 * 예: 스트리밍 중 실시간 토큰 카운트 표시
 *
 * 추정 규칙:
 * - 영어/ASCII: 약 4글자 = 1토큰 (예: "Hello" → ~1.25토큰)
 * - 한국어/CJK: 약 2글자 = 1토큰 (예: "안녕" → ~1토큰)
 * - 혼합 텍스트: 두 규칙의 가중 평균
 *
 * @param text - 토큰 수를 추정할 텍스트
 * @returns 추정 토큰 수
 */
export function estimateTokens(text: string): number {
  let asciiChars = 0;    // ASCII 문자 수 (영어, 숫자, 기호 등)
  let wideChars = 0;     // 넓은 문자 수 (한글, 한자, 일본어 등)

  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    // 유니코드 0x2E80 이상은 CJK 관련 문자 (한글, 한자, 히라가나 등)
    if (code > 0x2e80) {
      wideChars++;
    } else {
      asciiChars++;
    }
  }

  // ASCII는 4글자당 1토큰, CJK는 2글자당 1토큰으로 추정
  return Math.ceil(asciiChars / 4 + wideChars / 2);
}

/**
 * 채팅 메시지 배열의 총 토큰 수를 계산
 *
 * 각 메시지에는 역할(role)/포맷팅에 의한 약 4토큰의 오버헤드가 있고,
 * 마지막에 어시스턴트 프라이밍(priming)을 위한 2토큰이 추가됩니다.
 *
 * 이 오버헤드는 OpenAI의 내부 포맷팅 방식에 기반한 추정치입니다.
 *
 * @param messages - 토큰 수를 계산할 메시지 배열
 * @returns 총 토큰 수 (오버헤드 포함)
 */
export function countMessageTokens(messages: readonly { role: string; content: string }[]): number {
  let total = 0;
  for (const msg of messages) {
    // 각 메시지의 역할/포맷팅 오버헤드 (~4토큰)
    total += 4;
    total += countTokens(msg.content);
  }
  // 마지막 어시스턴트 프라이밍 토큰 (모델이 응답을 시작하기 위한 준비)
  total += 2;
  return total;
}

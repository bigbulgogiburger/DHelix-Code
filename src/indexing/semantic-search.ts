/**
 * Semantic Code Search — 벡터 임베딩 기반 인메모리 코드 검색
 *
 * 외부 벡터 DB나 ML 모델 없이 TF-IDF 스타일 텍스트 벡터화와
 * 코사인 유사도를 사용하여 의미론적 코드 검색을 구현합니다.
 *
 * 주요 특징:
 * - 순수 인메모리 벡터 스토어 (외부 의존성 없음)
 * - 정규화 벡터 + 코사인 유사도 기반 검색
 * - 파일별/언어별/종류별 통계
 * - 완전 타입 안전 (no `any`)
 *
 * @example
 * import { SemanticSearchEngine, simpleTextToVector } from "./semantic-search.js";
 * const engine = new SemanticSearchEngine({ dimensions: 128 });
 * const vector = simpleTextToVector("function loadConfig", 128);
 * engine.addEmbedding({ filePath: "src/config.ts", symbolName: "loadConfig",
 *   content: "function loadConfig(): Config { ... }",
 *   vector, metadata: { language: "typescript", kind: "function", lineStart: 10 } });
 * const results = engine.search(simpleTextToVector("load configuration", 128));
 */

import { getLogger } from "../utils/logger.js";

const log = getLogger();

// ─── 공개 인터페이스 ────────────────────────────────────────────────────────

/**
 * 코드 심볼 하나의 임베딩 데이터
 *
 * 파일 경로, 심볼 이름, 원본 콘텐츠, 정규화된 벡터,
 * 언어/종류/시작 줄 메타데이터를 포함합니다.
 */
export interface CodeEmbedding {
  /** 심볼이 정의된 파일의 절대 경로 */
  readonly filePath: string;
  /** 심볼 이름 (예: "loadConfig", "UserService") */
  readonly symbolName: string;
  /** 심볼의 원본 소스 코드 텍스트 */
  readonly content: string;
  /** 정규화된 임베딩 벡터 (L2 norm = 1) */
  readonly vector: readonly number[];
  /** 심볼 메타데이터 */
  readonly metadata: {
    /** 프로그래밍 언어 이름 (예: "typescript", "python") */
    readonly language: string;
    /** 심볼 종류 (예: "function", "class", "interface") */
    readonly kind: string;
    /** 심볼 시작 줄 번호 (1부터 시작) */
    readonly lineStart: number;
  };
}

/**
 * 시맨틱 검색 결과 항목 하나
 *
 * 파일 경로, 심볼 이름, 코사인 유사도 점수, 원본 콘텐츠와 메타데이터를 포함합니다.
 */
export interface SearchResult {
  /** 심볼이 정의된 파일의 절대 경로 */
  readonly filePath: string;
  /** 심볼 이름 */
  readonly symbolName: string;
  /** 코사인 유사도 점수 (0.0–1.0, 높을수록 유사) */
  readonly score: number;
  /** 심볼의 원본 소스 코드 텍스트 */
  readonly content: string;
  /** 심볼 메타데이터 */
  readonly metadata: CodeEmbedding["metadata"];
}

/**
 * SemanticSearchEngine 생성 옵션
 */
export interface SemanticSearchConfig {
  /**
   * 임베딩 벡터 차원 수
   * @default 128
   */
  readonly dimensions?: number;
  /**
   * 검색 결과 최대 개수
   * @default 10
   */
  readonly maxResults?: number;
  /**
   * 반환할 최소 코사인 유사도 점수
   * @default 0.3
   */
  readonly minScore?: number;
}

// ─── 유틸리티 함수 ───────────────────────────────────────────────────────────

/**
 * 두 벡터 사이의 코사인 유사도를 계산합니다.
 *
 * cosine_similarity(a, b) = (a · b) / (|a| × |b|)
 * 두 벡터가 모두 정규화(L2 norm = 1)된 경우 단순 내적과 동일합니다.
 *
 * @param a - 첫 번째 벡터 (길이 > 0)
 * @param b - 두 번째 벡터 (a와 동일한 길이)
 * @returns 코사인 유사도 (-1.0 ~ 1.0); 영벡터가 입력되면 0 반환
 * @example
 * cosineSimilarity([1, 0], [1, 0]); // 1.0 (동일)
 * cosineSimilarity([1, 0], [0, 1]); // 0.0 (직교)
 * cosineSimilarity([1, 0], [-1, 0]); // -1.0 (반대)
 */
export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  if (a.length !== b.length) {
    log.warn({ aLen: a.length, bLen: b.length }, "cosineSimilarity: 벡터 길이 불일치");
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;

  return dot / denom;
}

/**
 * 벡터를 L2 정규화합니다 (norm = 1).
 *
 * 영벡터(모든 원소가 0)인 경우 그대로 반환합니다.
 *
 * @param v - 정규화할 숫자 배열
 * @returns 새로운 정규화된 배열
 * @example
 * normalizeVector([3, 4]); // [0.6, 0.8]
 * normalizeVector([0, 0]); // [0, 0]
 */
export function normalizeVector(v: readonly number[]): number[] {
  let norm = 0;
  for (const x of v) {
    norm += x * x;
  }
  norm = Math.sqrt(norm);
  if (norm === 0) return Array.from(v);
  return v.map((x) => x / norm);
}

/**
 * 텍스트를 TF-IDF 스타일 벡터로 변환합니다 (외부 ML 모델 없음).
 *
 * 알고리즘:
 * 1. 텍스트를 소문자 변환 후 영숫자 토큰으로 분리
 * 2. 각 토큰을 해시하여 [0, dimensions) 범위의 인덱스로 매핑
 * 3. 해당 차원을 빈도수(TF) 만큼 누적
 * 4. 결과 벡터를 L2 정규화하여 반환
 *
 * 동일한 입력에 대해 항상 동일한 벡터를 반환합니다(결정론적).
 *
 * @param text - 벡터로 변환할 텍스트
 * @param dimensions - 출력 벡터 차원 수 (기본: 128)
 * @returns 정규화된 숫자 배열 (길이 = dimensions)
 * @example
 * const v1 = simpleTextToVector("function load config", 128);
 * const v2 = simpleTextToVector("function load config", 128);
 * // v1 deepEqual v2  (결정론적)
 */
export function simpleTextToVector(text: string, dimensions = 128): number[] {
  const vector = new Array<number>(dimensions).fill(0);
  if (!text || dimensions <= 0) return vector;

  // 토큰화: 소문자 변환 후 영숫자 단어 추출
  const tokens = text.toLowerCase().match(/[a-z0-9]+/g);
  if (!tokens || tokens.length === 0) return vector;

  for (const token of tokens) {
    // djb2 해시 — 단순하고 분포가 균일함
    let hash = 5381;
    for (let i = 0; i < token.length; i++) {
      // hash * 33 + charCode
      hash = ((hash << 5) + hash + token.charCodeAt(i)) >>> 0;
    }
    const idx = hash % dimensions;
    vector[idx] = (vector[idx] ?? 0) + 1;
  }

  return normalizeVector(vector);
}

// ─── 엔진 클래스 ─────────────────────────────────────────────────────────────

/**
 * 인메모리 벡터 기반 시맨틱 코드 검색 엔진
 *
 * CodeEmbedding 항목을 메모리에 저장하고, 쿼리 벡터와의 코사인 유사도를
 * 기반으로 유사한 코드 심볼을 검색합니다.
 *
 * - 외부 DB/ML 모델 없음 — 순수 인메모리
 * - 파일 단위 일괄 삭제 지원
 * - 언어/종류별 통계 제공
 *
 * @example
 * const engine = new SemanticSearchEngine({ dimensions: 128, minScore: 0.3 });
 * engine.addEmbedding({ ... });
 * const results = engine.search(queryVector, { maxResults: 5 });
 */
export class SemanticSearchEngine {
  /** 저장된 임베딩 목록 */
  private readonly embeddings: CodeEmbedding[] = [];

  /** 기본 벡터 차원 수 */
  private readonly dimensions: number;

  /** 기본 최대 결과 수 */
  private readonly defaultMaxResults: number;

  /** 기본 최소 유사도 점수 */
  private readonly defaultMinScore: number;

  /**
   * @param config - 검색 엔진 설정 (선택적)
   */
  constructor(config?: SemanticSearchConfig) {
    this.dimensions = config?.dimensions ?? 128;
    this.defaultMaxResults = config?.maxResults ?? 10;
    this.defaultMinScore = config?.minScore ?? 0.3;

    log.debug(
      {
        dimensions: this.dimensions,
        maxResults: this.defaultMaxResults,
        minScore: this.defaultMinScore,
      },
      "SemanticSearchEngine 초기화",
    );
  }

  // ─── 데이터 관리 ──────────────────────────────────────────────────────

  /**
   * 임베딩을 엔진에 추가합니다.
   *
   * 벡터 차원이 엔진 설정과 다르면 경고를 출력하고 그대로 저장합니다.
   *
   * @param embedding - 추가할 CodeEmbedding 객체
   */
  addEmbedding(embedding: CodeEmbedding): void {
    if (embedding.vector.length !== this.dimensions) {
      log.warn(
        {
          expected: this.dimensions,
          actual: embedding.vector.length,
          symbol: embedding.symbolName,
        },
        "addEmbedding: 벡터 차원 불일치",
      );
    }
    this.embeddings.push(embedding);
    log.debug({ filePath: embedding.filePath, symbol: embedding.symbolName }, "임베딩 추가");
  }

  /**
   * 특정 파일에 속한 모든 임베딩을 제거합니다.
   *
   * 파일이 수정되거나 삭제될 때 인덱스를 갱신하는 데 사용합니다.
   *
   * @param filePath - 제거할 파일의 절대 경로
   * @returns 제거된 임베딩 개수
   */
  removeByFile(filePath: string): number {
    const before = this.embeddings.length;
    let writeIdx = 0;
    for (let i = 0; i < this.embeddings.length; i++) {
      if (this.embeddings[i]!.filePath !== filePath) {
        this.embeddings[writeIdx++] = this.embeddings[i]!;
      }
    }
    this.embeddings.length = writeIdx;
    const removed = before - writeIdx;
    log.debug({ filePath, removed }, "임베딩 파일 단위 제거");
    return removed;
  }

  /**
   * 저장된 모든 임베딩을 제거합니다.
   */
  clear(): void {
    this.embeddings.length = 0;
    log.debug("SemanticSearchEngine 전체 초기화");
  }

  // ─── 검색 ────────────────────────────────────────────────────────────

  /**
   * 쿼리 벡터와 코사인 유사도가 높은 임베딩을 검색합니다.
   *
   * 1. 모든 저장된 임베딩과 쿼리 벡터의 코사인 유사도를 계산
   * 2. minScore 미만 결과 필터링
   * 3. score 내림차순 정렬
   * 4. 상위 maxResults 반환
   *
   * @param queryVector - 검색 쿼리 벡터 (simpleTextToVector() 등으로 생성)
   * @param config - 검색 옵션 (기본값: 생성자 설정 사용)
   * @returns score 내림차순 정렬된 SearchResult 배열
   * @example
   * const qv = simpleTextToVector("parse config file", 128);
   * const results = engine.search(qv, { maxResults: 5, minScore: 0.4 });
   */
  search(queryVector: readonly number[], config?: SemanticSearchConfig): readonly SearchResult[] {
    const maxResults = config?.maxResults ?? this.defaultMaxResults;
    const minScore = config?.minScore ?? this.defaultMinScore;

    if (this.embeddings.length === 0) return [];

    const scored: Array<{ readonly score: number; readonly idx: number }> = [];

    for (let i = 0; i < this.embeddings.length; i++) {
      const emb = this.embeddings[i]!;
      const score = cosineSimilarity(queryVector, emb.vector);
      if (score >= minScore) {
        scored.push({ score, idx: i });
      }
    }

    // score 내림차순 정렬
    scored.sort((a, b) => b.score - a.score);

    const top = scored.slice(0, maxResults);

    return top.map(({ score, idx }) => {
      const emb = this.embeddings[idx]!;
      return {
        filePath: emb.filePath,
        symbolName: emb.symbolName,
        score,
        content: emb.content,
        metadata: emb.metadata,
      };
    });
  }

  // ─── 통계 ────────────────────────────────────────────────────────────

  /**
   * 현재 엔진에 저장된 임베딩 통계를 반환합니다.
   *
   * @returns 총 임베딩 수, 언어별 분포, 심볼 종류별 분포
   * @example
   * const stats = engine.getStats();
   * // { totalEmbeddings: 42, byLanguage: { typescript: 30, python: 12 }, byKind: { function: 20, class: 10, ... } }
   */
  getStats(): {
    readonly totalEmbeddings: number;
    readonly byLanguage: Readonly<Record<string, number>>;
    readonly byKind: Readonly<Record<string, number>>;
  } {
    const byLanguage: Record<string, number> = {};
    const byKind: Record<string, number> = {};

    for (const emb of this.embeddings) {
      const lang = emb.metadata.language;
      const kind = emb.metadata.kind;
      byLanguage[lang] = (byLanguage[lang] ?? 0) + 1;
      byKind[kind] = (byKind[kind] ?? 0) + 1;
    }

    return {
      totalEmbeddings: this.embeddings.length,
      byLanguage,
      byKind,
    };
  }
}

/**
 * SemanticSearchEngine unit tests
 *
 * Tests cosineSimilarity, normalizeVector, simpleTextToVector utility functions,
 * and the SemanticSearchEngine class (addEmbedding, removeByFile, search, getStats, clear).
 *
 * No external ML models or vector DBs — all purely in-memory computation.
 */

import { describe, it, expect, beforeEach } from "vitest";

import {
  cosineSimilarity,
  normalizeVector,
  simpleTextToVector,
  SemanticSearchEngine,
} from "../../../src/indexing/semantic-search.js";

import type { CodeEmbedding, SearchResult } from "../../../src/indexing/semantic-search.js";

// ─── 헬퍼 ──────────────────────────────────────────────────────────────────

function makeEmbedding(
  overrides: Partial<CodeEmbedding> & { vector: readonly number[] },
): CodeEmbedding {
  return {
    filePath: "/project/src/foo.ts",
    symbolName: "foo",
    content: "function foo() {}",
    metadata: { language: "typescript", kind: "function", lineStart: 1 },
    ...overrides,
  };
}

// ─── cosineSimilarity ──────────────────────────────────────────────────────

describe("cosineSimilarity", () => {
  it("동일 벡터는 1을 반환한다", () => {
    const v = [1, 2, 3];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1.0, 6);
  });

  it("정규화된 동일 벡터는 1을 반환한다", () => {
    const v = normalizeVector([3, 4, 0]);
    expect(cosineSimilarity(v, v)).toBeCloseTo(1.0, 6);
  });

  it("직교 벡터는 0을 반환한다", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0.0, 6);
  });

  it("반대 방향 벡터는 -1을 반환한다", () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1.0, 6);
  });

  it("영벡터가 입력되면 0을 반환한다", () => {
    expect(cosineSimilarity([0, 0], [1, 2])).toBe(0);
    expect(cosineSimilarity([1, 2], [0, 0])).toBe(0);
    expect(cosineSimilarity([0, 0], [0, 0])).toBe(0);
  });

  it("길이가 다른 벡터는 0을 반환한다", () => {
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
  });

  it("빈 벡터는 0을 반환한다", () => {
    expect(cosineSimilarity([], [])).toBe(0);
  });

  it("부분적으로 비슷한 벡터는 0과 1 사이 값을 반환한다", () => {
    const a = normalizeVector([1, 1, 0]);
    const b = normalizeVector([1, 0, 0]);
    const sim = cosineSimilarity(a, b);
    expect(sim).toBeGreaterThan(0);
    expect(sim).toBeLessThan(1);
  });
});

// ─── normalizeVector ───────────────────────────────────────────────────────

describe("normalizeVector", () => {
  it("단위 벡터는 변환 후에도 norm이 1이다", () => {
    const v = normalizeVector([3, 4]);
    const norm = Math.sqrt(v[0]! ** 2 + v[1]! ** 2);
    expect(norm).toBeCloseTo(1.0, 6);
  });

  it("[3, 4] → [0.6, 0.8]", () => {
    const v = normalizeVector([3, 4]);
    expect(v[0]).toBeCloseTo(0.6, 6);
    expect(v[1]).toBeCloseTo(0.8, 6);
  });

  it("영벡터는 그대로 반환된다", () => {
    expect(normalizeVector([0, 0, 0])).toEqual([0, 0, 0]);
  });

  it("원본 배열을 변경하지 않는다 (immutable)", () => {
    const original = [3, 4];
    normalizeVector(original);
    expect(original).toEqual([3, 4]);
  });

  it("1D 벡터 정규화", () => {
    const v = normalizeVector([5]);
    expect(v[0]).toBeCloseTo(1.0, 6);
  });
});

// ─── simpleTextToVector ────────────────────────────────────────────────────

describe("simpleTextToVector", () => {
  it("같은 입력에 대해 항상 동일한 벡터를 반환한다 (결정론적)", () => {
    const text = "function loadConfig(): Config";
    const v1 = simpleTextToVector(text, 128);
    const v2 = simpleTextToVector(text, 128);
    expect(v1).toEqual(v2);
  });

  it("다른 입력에 대해 다른 벡터를 반환한다", () => {
    const v1 = simpleTextToVector("function loadConfig", 128);
    const v2 = simpleTextToVector("class UserService", 128);
    expect(v1).not.toEqual(v2);
  });

  it("반환 벡터 길이가 dimensions와 일치한다", () => {
    expect(simpleTextToVector("hello world", 64)).toHaveLength(64);
    expect(simpleTextToVector("hello world", 256)).toHaveLength(256);
    expect(simpleTextToVector("hello world", 128)).toHaveLength(128);
  });

  it("반환 벡터는 정규화되어 있다 (norm ≈ 1)", () => {
    const v = simpleTextToVector("async function fetchUser(id: string)", 128);
    const norm = Math.sqrt(v.reduce((acc, x) => acc + x * x, 0));
    expect(norm).toBeCloseTo(1.0, 5);
  });

  it("빈 텍스트는 영벡터를 반환한다", () => {
    const v = simpleTextToVector("", 128);
    expect(v).toHaveLength(128);
    expect(v.every((x) => x === 0)).toBe(true);
  });

  it("dimensions가 0이면 빈 배열을 반환한다", () => {
    expect(simpleTextToVector("hello", 0)).toHaveLength(0);
  });

  it("유사한 텍스트는 높은 코사인 유사도를 갖는다", () => {
    const v1 = simpleTextToVector("load configuration file", 128);
    const v2 = simpleTextToVector("load config file", 128);
    const vUnrelated = simpleTextToVector("render html template", 128);

    const simSimilar = cosineSimilarity(v1, v2);
    const simUnrelated = cosineSimilarity(v1, vUnrelated);

    expect(simSimilar).toBeGreaterThan(simUnrelated);
  });

  it("숫자와 영문 혼합 텍스트 처리", () => {
    const v = simpleTextToVector("http2 server timeout 30s config", 128);
    expect(v).toHaveLength(128);
    const norm = Math.sqrt(v.reduce((acc, x) => acc + x * x, 0));
    expect(norm).toBeCloseTo(1.0, 5);
  });
});

// ─── SemanticSearchEngine ──────────────────────────────────────────────────

describe("SemanticSearchEngine", () => {
  let engine: SemanticSearchEngine;

  beforeEach(() => {
    engine = new SemanticSearchEngine({ dimensions: 128, maxResults: 10, minScore: 0.3 });
  });

  // ── addEmbedding / getStats ──────────────────────────────────────────

  describe("addEmbedding + getStats", () => {
    it("임베딩 추가 후 totalEmbeddings가 증가한다", () => {
      const v = simpleTextToVector("function foo", 128);
      engine.addEmbedding(makeEmbedding({ vector: v }));
      expect(engine.getStats().totalEmbeddings).toBe(1);
    });

    it("언어별/종류별 통계가 정확하다", () => {
      engine.addEmbedding(
        makeEmbedding({
          vector: simpleTextToVector("class UserService", 128),
          metadata: { language: "typescript", kind: "class", lineStart: 1 },
          symbolName: "UserService",
        }),
      );
      engine.addEmbedding(
        makeEmbedding({
          vector: simpleTextToVector("function loadConfig", 128),
          filePath: "/project/src/config.ts",
          metadata: { language: "typescript", kind: "function", lineStart: 5 },
          symbolName: "loadConfig",
        }),
      );
      engine.addEmbedding(
        makeEmbedding({
          vector: simpleTextToVector("class DataModel", 128),
          filePath: "/project/src/model.py",
          metadata: { language: "python", kind: "class", lineStart: 10 },
          symbolName: "DataModel",
        }),
      );

      const stats = engine.getStats();
      expect(stats.totalEmbeddings).toBe(3);
      expect(stats.byLanguage["typescript"]).toBe(2);
      expect(stats.byLanguage["python"]).toBe(1);
      expect(stats.byKind["class"]).toBe(2);
      expect(stats.byKind["function"]).toBe(1);
    });

    it("빈 엔진의 통계는 0이다", () => {
      const stats = engine.getStats();
      expect(stats.totalEmbeddings).toBe(0);
      expect(Object.keys(stats.byLanguage)).toHaveLength(0);
      expect(Object.keys(stats.byKind)).toHaveLength(0);
    });
  });

  // ── removeByFile ─────────────────────────────────────────────────────

  describe("removeByFile", () => {
    it("특정 파일의 임베딩을 삭제하고 개수를 반환한다", () => {
      const fileA = "/project/src/a.ts";
      const fileB = "/project/src/b.ts";

      engine.addEmbedding(
        makeEmbedding({
          filePath: fileA,
          vector: simpleTextToVector("function aFoo", 128),
          symbolName: "aFoo",
        }),
      );
      engine.addEmbedding(
        makeEmbedding({
          filePath: fileA,
          vector: simpleTextToVector("function aBar", 128),
          symbolName: "aBar",
        }),
      );
      engine.addEmbedding(
        makeEmbedding({
          filePath: fileB,
          vector: simpleTextToVector("function bFoo", 128),
          symbolName: "bFoo",
        }),
      );

      const removed = engine.removeByFile(fileA);
      expect(removed).toBe(2);
      expect(engine.getStats().totalEmbeddings).toBe(1);
    });

    it("존재하지 않는 파일은 0을 반환한다", () => {
      engine.addEmbedding(makeEmbedding({ vector: simpleTextToVector("function foo", 128) }));
      expect(engine.removeByFile("/non/existent/file.ts")).toBe(0);
      expect(engine.getStats().totalEmbeddings).toBe(1);
    });

    it("삭제 후 해당 파일의 임베딩이 검색되지 않는다", () => {
      const file = "/project/src/removed.ts";
      const v = simpleTextToVector("function removedFn", 128);
      engine.addEmbedding(makeEmbedding({ filePath: file, vector: v, symbolName: "removedFn" }));
      engine.removeByFile(file);
      const results = engine.search(v, { minScore: 0 });
      expect(results.find((r) => r.filePath === file)).toBeUndefined();
    });
  });

  // ── clear ─────────────────────────────────────────────────────────────

  describe("clear", () => {
    it("clear 후 totalEmbeddings가 0이다", () => {
      engine.addEmbedding(makeEmbedding({ vector: simpleTextToVector("fn a", 128) }));
      engine.addEmbedding(makeEmbedding({ vector: simpleTextToVector("fn b", 128) }));
      engine.clear();
      expect(engine.getStats().totalEmbeddings).toBe(0);
    });

    it("clear 후 검색 결과가 빈 배열이다", () => {
      engine.addEmbedding(makeEmbedding({ vector: simpleTextToVector("function foo", 128) }));
      engine.clear();
      const results = engine.search(simpleTextToVector("function foo", 128));
      expect(results).toHaveLength(0);
    });
  });

  // ── search ────────────────────────────────────────────────────────────

  describe("search", () => {
    it("빈 엔진에서 검색하면 빈 배열을 반환한다", () => {
      const results = engine.search(simpleTextToVector("any query", 128));
      expect(results).toHaveLength(0);
    });

    it("유사한 코드가 상위에 노출된다", () => {
      // 로드 설정 관련 심볼
      engine.addEmbedding(
        makeEmbedding({
          symbolName: "loadConfig",
          content: "function loadConfig(): Config { return parseFile('config.json'); }",
          vector: simpleTextToVector("function loadConfig parse config file json", 128),
          filePath: "/project/src/config.ts",
          metadata: { language: "typescript", kind: "function", lineStart: 1 },
        }),
      );
      // 무관한 심볼
      engine.addEmbedding(
        makeEmbedding({
          symbolName: "renderHtml",
          content: "function renderHtml(template: string): string { return template; }",
          vector: simpleTextToVector("function renderHtml template string html", 128),
          filePath: "/project/src/renderer.ts",
          metadata: { language: "typescript", kind: "function", lineStart: 1 },
        }),
      );

      const query = simpleTextToVector("load configuration settings from file", 128);
      const results = engine.search(query, { minScore: 0 });

      expect(results.length).toBeGreaterThan(0);
      // loadConfig가 renderHtml보다 높은 순위
      const loadIdx = results.findIndex((r) => r.symbolName === "loadConfig");
      const renderIdx = results.findIndex((r) => r.symbolName === "renderHtml");
      expect(loadIdx).toBeLessThan(renderIdx);
    });

    it("minScore 미만 결과는 반환되지 않는다", () => {
      const v = normalizeVector([1, 0, 0, 0]);
      // 직교 벡터 — 유사도 0
      const orthogonal = normalizeVector([0, 1, 0, 0]);

      // 4차원 엔진으로 재생성
      const eng4 = new SemanticSearchEngine({ dimensions: 4, minScore: 0.5 });
      eng4.addEmbedding(makeEmbedding({ vector: orthogonal, symbolName: "orthSym" }));

      const results = eng4.search(v, { minScore: 0.5 });
      expect(results).toHaveLength(0);
    });

    it("score 내림차순 정렬되어 반환된다", () => {
      // 4차원 공간에서 다양한 각도의 벡터 삽입
      const eng4 = new SemanticSearchEngine({ dimensions: 4, minScore: 0 });
      const query = normalizeVector([1, 1, 0, 0]);

      eng4.addEmbedding(
        makeEmbedding({ symbolName: "low", vector: normalizeVector([0, 0, 1, 1]) }),
      );
      eng4.addEmbedding(
        makeEmbedding({ symbolName: "high", vector: normalizeVector([1, 1, 0, 0]) }),
      );
      eng4.addEmbedding(
        makeEmbedding({ symbolName: "mid", vector: normalizeVector([1, 0, 0, 0]) }),
      );

      const results = eng4.search(query, { minScore: 0 });
      expect(results[0]!.symbolName).toBe("high");
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1]!.score).toBeGreaterThanOrEqual(results[i]!.score);
      }
    });

    it("maxResults 이상의 결과는 반환되지 않는다", () => {
      const eng = new SemanticSearchEngine({ dimensions: 128, maxResults: 3, minScore: 0 });
      for (let i = 0; i < 10; i++) {
        eng.addEmbedding(
          makeEmbedding({
            symbolName: `sym${i}`,
            vector: simpleTextToVector(`function sym${i} body`, 128),
          }),
        );
      }
      const results = eng.search(simpleTextToVector("function body", 128), {
        maxResults: 3,
        minScore: 0,
      });
      expect(results.length).toBeLessThanOrEqual(3);
    });

    it("검색 결과에 SearchResult 필드가 모두 포함된다", () => {
      const v = simpleTextToVector("class MyClass", 128);
      engine.addEmbedding(
        makeEmbedding({
          filePath: "/project/src/my.ts",
          symbolName: "MyClass",
          content: "class MyClass {}",
          vector: v,
          metadata: { language: "typescript", kind: "class", lineStart: 5 },
        }),
      );

      const results = engine.search(v, { minScore: 0 });
      expect(results).toHaveLength(1);

      const r = results[0] as SearchResult;
      expect(r.filePath).toBe("/project/src/my.ts");
      expect(r.symbolName).toBe("MyClass");
      expect(typeof r.score).toBe("number");
      expect(r.content).toBe("class MyClass {}");
      expect(r.metadata.language).toBe("typescript");
      expect(r.metadata.kind).toBe("class");
      expect(r.metadata.lineStart).toBe(5);
    });

    it("search() 옵션이 없으면 생성자 기본값을 사용한다", () => {
      const eng = new SemanticSearchEngine({ dimensions: 4, maxResults: 2, minScore: 0.9 });
      // 유사도 1인 벡터 3개
      const v = normalizeVector([1, 0, 0, 0]);
      for (let i = 0; i < 3; i++) {
        eng.addEmbedding(makeEmbedding({ symbolName: `sym${i}`, vector: v }));
      }
      // maxResults=2이므로 최대 2개 반환
      const results = eng.search(v);
      expect(results.length).toBeLessThanOrEqual(2);
    });
  });
});

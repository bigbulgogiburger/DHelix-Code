/**
 * IncrementalIndexer unit tests
 *
 * Tests for:
 * - needsReindex: new file, modified file, same hash
 * - processChanges: created, modified, deleted, mixed
 * - batch size limit (maxBatchSize)
 * - invalidate / invalidateAll
 * - getStats
 * - computeFileHash
 * - matchesPattern: include/exclude patterns
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";

import {
  IncrementalIndexer,
  computeFileHash,
  matchesPattern,
} from "../../../src/indexing/incremental-indexer.js";
import type {
  FileChangeEvent,
  IncrementalIndexerConfig,
} from "../../../src/indexing/incremental-indexer.js";

// ── Helpers ──────────────────────────────────────────────────────────────

/** 임시 디렉토리 내에 파일을 생성하고 절대 경로를 반환합니다 */
async function createTempFile(dir: string, name: string, content: string): Promise<string> {
  const filePath = join(dir, name);
  await writeFile(filePath, content, "utf-8");
  return filePath;
}

function makeEvent(path: string, type: FileChangeEvent["type"] = "created"): FileChangeEvent {
  return { path, type, timestamp: Date.now() };
}

// ── Test Suite ───────────────────────────────────────────────────────────

describe("computeFileHash", () => {
  it("동일한 내용은 항상 동일한 해시를 반환한다", () => {
    const h1 = computeFileHash("hello world");
    const h2 = computeFileHash("hello world");
    expect(h1).toBe(h2);
  });

  it("빈 문자열도 해시를 반환한다", () => {
    const h = computeFileHash("");
    expect(h).toMatch(/^[a-f0-9]{64}$/);
  });

  it("내용이 다르면 다른 해시를 반환한다", () => {
    const h1 = computeFileHash("foo");
    const h2 = computeFileHash("bar");
    expect(h1).not.toBe(h2);
  });

  it("반환값은 64자 소문자 16진수 문자열이다 (SHA-256)", () => {
    const h = computeFileHash("test content");
    expect(h).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("matchesPattern", () => {
  describe("포함 패턴 매칭", () => {
    it("*.ts 패턴이 .ts 파일과 매칭된다", () => {
      expect(matchesPattern("src/foo.ts", ["**/*.ts"], [])).toBe(true);
    });

    it("*.py 패턴이 .py 파일과 매칭된다", () => {
      expect(matchesPattern("lib/utils.py", ["**/*.py"], [])).toBe(true);
    });

    it("매칭되는 패턴이 없으면 false를 반환한다", () => {
      expect(matchesPattern("src/foo.ts", ["**/*.py"], [])).toBe(false);
    });

    it("다중 패턴 중 하나라도 매칭되면 true를 반환한다", () => {
      expect(matchesPattern("src/foo.ts", ["**/*.py", "**/*.ts"], [])).toBe(true);
    });

    it("절대 경로도 패턴과 매칭된다", () => {
      expect(matchesPattern("/project/src/foo.ts", ["**/*.ts"], [])).toBe(true);
    });
  });

  describe("제외 패턴 매칭", () => {
    it("node_modules 경로는 제외된다", () => {
      expect(matchesPattern("node_modules/lib/index.ts", ["**/*.ts"], ["node_modules"])).toBe(
        false,
      );
    });

    it("dist 디렉토리 내 파일은 제외된다", () => {
      expect(matchesPattern("dist/bundle.js", ["**/*.js"], ["dist"])).toBe(false);
    });

    it("중첩된 node_modules도 제외된다", () => {
      expect(
        matchesPattern("packages/foo/node_modules/bar/index.ts", ["**/*.ts"], ["node_modules"]),
      ).toBe(false);
    });

    it("제외 패턴과 무관한 파일은 포함된다", () => {
      expect(matchesPattern("src/utils.ts", ["**/*.ts"], ["node_modules", "dist"])).toBe(true);
    });

    it(".git 디렉토리는 제외된다", () => {
      expect(matchesPattern(".git/hooks/pre-commit", ["**/*.ts"], [".git"])).toBe(false);
    });
  });
});

describe("IncrementalIndexer", () => {
  let tmpDir: string;
  let indexer: IncrementalIndexer;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "incremental-indexer-test-"));
    indexer = new IncrementalIndexer({
      watchPatterns: ["**/*.ts", "**/*.js", "**/*.py"],
      ignorePatterns: ["node_modules", "dist"],
    });
  });

  afterEach(async () => {
    indexer.dispose();
    await rm(tmpDir, { recursive: true, force: true });
  });

  // ─── needsReindex ─────────────────────────────────────────────────

  describe("needsReindex", () => {
    it("새 파일(인덱스에 없는 파일)은 true를 반환한다", () => {
      expect(indexer.needsReindex("/project/src/new.ts", "abc123")).toBe(true);
    });

    it("해시가 다른 파일은 true를 반환한다", async () => {
      const filePath = await createTempFile(tmpDir, "changed.ts", "export const a = 1;");
      const hash = computeFileHash("export const a = 1;");

      await indexer.processChanges([makeEvent(filePath, "created")]);

      // 다른 해시로 확인
      expect(indexer.needsReindex(filePath, "different-hash")).toBe(true);
      // 동일 해시로 확인
      expect(indexer.needsReindex(filePath, hash)).toBe(false);
    });

    it("해시가 동일한 파일은 false를 반환한다", async () => {
      const content = "export const x = 42;";
      const filePath = await createTempFile(tmpDir, "same.ts", content);
      const hash = computeFileHash(content);

      await indexer.processChanges([makeEvent(filePath, "created")]);

      expect(indexer.needsReindex(filePath, hash)).toBe(false);
    });
  });

  // ─── processChanges: created ──────────────────────────────────────

  describe("processChanges — created", () => {
    it("새 파일을 인덱싱하여 indexed 카운트를 증가시킨다", async () => {
      const filePath = await createTempFile(tmpDir, "foo.ts", "export function foo() {}");

      const result = await indexer.processChanges([makeEvent(filePath, "created")]);

      expect(result.indexed).toBe(1);
      expect(result.removed).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it("인덱스에 파일 항목이 추가된다", async () => {
      const filePath = await createTempFile(tmpDir, "bar.ts", "interface IFoo { x: number }");

      await indexer.processChanges([makeEvent(filePath, "created")]);

      const entry = indexer.getIndex().get(filePath);
      expect(entry).toBeDefined();
      expect(entry?.filePath).toBe(filePath);
      expect(entry?.language).toBe("typescript");
      expect(entry?.contentHash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("언어가 올바르게 감지된다 — .py 파일", async () => {
      const filePath = await createTempFile(tmpDir, "main.py", "def hello(): pass");

      await indexer.processChanges([makeEvent(filePath, "created")]);

      const entry = indexer.getIndex().get(filePath);
      expect(entry?.language).toBe("python");
    });

    it("존재하지 않는 파일은 errors에 기록된다", async () => {
      const result = await indexer.processChanges([
        makeEvent("/nonexistent/path/file.ts", "created"),
      ]);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.filePath).toBe("/nonexistent/path/file.ts");
      expect(result.indexed).toBe(0);
    });
  });

  // ─── processChanges: modified ─────────────────────────────────────

  describe("processChanges — modified", () => {
    it("내용이 변경된 파일은 재인덱싱된다", async () => {
      const filePath = await createTempFile(tmpDir, "mod.ts", "const a = 1;");
      await indexer.processChanges([makeEvent(filePath, "created")]);

      // 내용 수정
      await writeFile(filePath, "const a = 2;", "utf-8");
      const result = await indexer.processChanges([makeEvent(filePath, "modified")]);

      expect(result.indexed).toBe(1);
      expect(result.skipped).toBe(0);
    });

    it("내용이 동일하면 스킵된다", async () => {
      const content = "export const unchanged = true;";
      const filePath = await createTempFile(tmpDir, "unchanged.ts", content);
      await indexer.processChanges([makeEvent(filePath, "created")]);

      // 내용 변경 없이 modified 이벤트
      const result = await indexer.processChanges([makeEvent(filePath, "modified")]);

      expect(result.skipped).toBe(1);
      expect(result.indexed).toBe(0);
    });
  });

  // ─── processChanges: deleted ──────────────────────────────────────

  describe("processChanges — deleted", () => {
    it("삭제된 파일이 인덱스에서 제거된다", async () => {
      const filePath = await createTempFile(tmpDir, "del.ts", "const x = 1;");
      await indexer.processChanges([makeEvent(filePath, "created")]);
      expect(indexer.getIndex().has(filePath)).toBe(true);

      const result = await indexer.processChanges([makeEvent(filePath, "deleted")]);

      expect(result.removed).toBe(1);
      expect(indexer.getIndex().has(filePath)).toBe(false);
    });

    it("인덱스에 없는 파일의 deleted 이벤트는 removed 카운트를 늘리지 않는다", async () => {
      const result = await indexer.processChanges([
        makeEvent("/some/file/not/in/index.ts", "deleted"),
      ]);

      expect(result.removed).toBe(0);
    });
  });

  // ─── processChanges: 혼합 이벤트 ─────────────────────────────────

  describe("processChanges — 혼합 이벤트", () => {
    it("created/modified/deleted가 혼합된 배치를 올바르게 처리한다", async () => {
      const newFile = await createTempFile(tmpDir, "new.ts", "export const a = 1;");
      const modFile = await createTempFile(tmpDir, "mod.ts", "export const b = 2;");
      const delFile = await createTempFile(tmpDir, "del.ts", "export const c = 3;");

      // 초기 인덱싱
      await indexer.processChanges([makeEvent(modFile, "created"), makeEvent(delFile, "created")]);

      // 내용 변경
      await writeFile(modFile, "export const b = 999;", "utf-8");

      // 혼합 이벤트 처리
      const result = await indexer.processChanges([
        makeEvent(newFile, "created"),
        makeEvent(modFile, "modified"),
        makeEvent(delFile, "deleted"),
      ]);

      expect(result.indexed).toBe(2); // newFile + modFile
      expect(result.removed).toBe(1); // delFile
      expect(result.skipped).toBe(0);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ─── 배치 크기 제한 ────────────────────────────────────────────────

  describe("배치 크기 제한 (maxBatchSize)", () => {
    it("maxBatchSize 초과분은 처리하지 않는다", async () => {
      const smallIndexer = new IncrementalIndexer({
        watchPatterns: ["**/*.ts"],
        ignorePatterns: [],
        maxBatchSize: 3,
      });

      try {
        // 5개 파일 생성
        const files: string[] = [];
        for (let i = 0; i < 5; i++) {
          const fp = await createTempFile(tmpDir, `batch${i}.ts`, `const x${i} = ${i};`);
          files.push(fp);
        }

        const events = files.map((f) => makeEvent(f, "created"));
        const result = await smallIndexer.processChanges(events);

        // maxBatchSize=3이므로 3개만 처리됨
        expect(result.indexed).toBe(3);
        expect(smallIndexer.getIndex().size).toBe(3);
      } finally {
        smallIndexer.dispose();
      }
    });

    it("maxBatchSize가 이벤트 수보다 크면 모두 처리된다", async () => {
      const bigIndexer = new IncrementalIndexer({
        watchPatterns: ["**/*.ts"],
        ignorePatterns: [],
        maxBatchSize: 100,
      });

      try {
        const files: string[] = [];
        for (let i = 0; i < 5; i++) {
          const fp = await createTempFile(tmpDir, `all${i}.ts`, `const v${i} = ${i};`);
          files.push(fp);
        }

        const events = files.map((f) => makeEvent(f, "created"));
        const result = await bigIndexer.processChanges(events);

        expect(result.indexed).toBe(5);
      } finally {
        bigIndexer.dispose();
      }
    });
  });

  // ─── invalidate / invalidateAll ───────────────────────────────────

  describe("invalidate", () => {
    it("특정 파일의 인덱스를 제거한다", async () => {
      const filePath = await createTempFile(tmpDir, "inv.ts", "const y = 10;");
      await indexer.processChanges([makeEvent(filePath, "created")]);
      expect(indexer.getIndex().has(filePath)).toBe(true);

      indexer.invalidate(filePath);

      expect(indexer.getIndex().has(filePath)).toBe(false);
    });

    it("인덱스에 없는 파일을 invalidate해도 오류가 발생하지 않는다", () => {
      expect(() => indexer.invalidate("/nonexistent.ts")).not.toThrow();
    });

    it("invalidate 후 processChanges 호출 시 재인덱싱된다", async () => {
      const content = "const z = 5;";
      const filePath = await createTempFile(tmpDir, "reinv.ts", content);

      await indexer.processChanges([makeEvent(filePath, "created")]);
      indexer.invalidate(filePath);

      const result = await indexer.processChanges([makeEvent(filePath, "modified")]);
      expect(result.indexed).toBe(1);
    });
  });

  describe("invalidateAll", () => {
    it("모든 인덱스 항목을 제거한다", async () => {
      const f1 = await createTempFile(tmpDir, "ia1.ts", "const a = 1;");
      const f2 = await createTempFile(tmpDir, "ia2.ts", "const b = 2;");
      await indexer.processChanges([makeEvent(f1, "created"), makeEvent(f2, "created")]);

      expect(indexer.getIndex().size).toBe(2);

      indexer.invalidateAll();

      expect(indexer.getIndex().size).toBe(0);
    });

    it("invalidateAll 후 getStats의 totalFiles는 0이다", async () => {
      const filePath = await createTempFile(tmpDir, "clear.ts", "const c = 3;");
      await indexer.processChanges([makeEvent(filePath, "created")]);
      indexer.invalidateAll();

      const stats = indexer.getStats();
      expect(stats.totalFiles).toBe(0);
      expect(stats.totalSymbols).toBe(0);
    });
  });

  // ─── getStats ─────────────────────────────────────────────────────

  describe("getStats", () => {
    it("초기 상태에서는 모든 카운트가 0이다", () => {
      const freshIndexer = new IncrementalIndexer();
      try {
        const stats = freshIndexer.getStats();
        expect(stats.totalFiles).toBe(0);
        expect(stats.totalSymbols).toBe(0);
        expect(stats.lastFullIndexAt).toBe(0);
        expect(stats.incrementalUpdates).toBe(0);
      } finally {
        freshIndexer.dispose();
      }
    });

    it("processChanges 호출 후 incrementalUpdates가 증가한다", async () => {
      const filePath = await createTempFile(tmpDir, "stat.ts", "function hello() {}");

      await indexer.processChanges([makeEvent(filePath, "created")]);
      const stats1 = indexer.getStats();
      expect(stats1.incrementalUpdates).toBe(1);

      await indexer.processChanges([makeEvent(filePath, "modified")]);
      const stats2 = indexer.getStats();
      expect(stats2.incrementalUpdates).toBe(2);
    });

    it("totalFiles와 totalSymbols가 올바르게 집계된다", async () => {
      const f1 = await createTempFile(
        tmpDir,
        "s1.ts",
        "export function a() {}\nexport function b() {}",
      );
      const f2 = await createTempFile(tmpDir, "s2.ts", "export class MyClass {}");

      await indexer.processChanges([makeEvent(f1, "created"), makeEvent(f2, "created")]);

      const stats = indexer.getStats();
      expect(stats.totalFiles).toBe(2);
      expect(stats.totalSymbols).toBeGreaterThan(0);
    });
  });

  // ─── dispose ──────────────────────────────────────────────────────

  describe("dispose", () => {
    it("dispose 후 processChanges 호출 시 오류가 발생한다", async () => {
      const localIndexer = new IncrementalIndexer();
      localIndexer.dispose();

      await expect(
        localIndexer.processChanges([makeEvent("/some/file.ts", "created")]),
      ).rejects.toThrow("IncrementalIndexer is already disposed");
    });

    it("dispose 후 invalidate 호출 시 오류가 발생한다", () => {
      const localIndexer = new IncrementalIndexer();
      localIndexer.dispose();

      expect(() => localIndexer.invalidate("/some/file.ts")).toThrow(
        "IncrementalIndexer is already disposed",
      );
    });

    it("dispose를 중복 호출해도 오류가 발생하지 않는다", () => {
      const localIndexer = new IncrementalIndexer();
      localIndexer.dispose();
      expect(() => localIndexer.dispose()).not.toThrow();
    });
  });

  // ─── 기본 설정 값 ─────────────────────────────────────────────────

  describe("기본 설정 값", () => {
    it("config 없이 생성 시 debounceMs 기본값은 500이다", () => {
      const defaultIndexer = new IncrementalIndexer();
      try {
        expect(defaultIndexer.getDebounceMs()).toBe(500);
      } finally {
        defaultIndexer.dispose();
      }
    });

    it("커스텀 debounceMs가 올바르게 설정된다", () => {
      const customIndexer = new IncrementalIndexer({ debounceMs: 200 });
      try {
        expect(customIndexer.getDebounceMs()).toBe(200);
      } finally {
        customIndexer.dispose();
      }
    });
  });

  // ─── 패턴 필터링 통합 ─────────────────────────────────────────────

  describe("패턴 필터링 통합", () => {
    it("watchPatterns에 없는 확장자 파일은 무시된다", async () => {
      const restrictedIndexer = new IncrementalIndexer({
        watchPatterns: ["**/*.ts"],
        ignorePatterns: [],
      });

      try {
        const jsFile = await createTempFile(tmpDir, "script.js", "const x = 1;");
        const result = await restrictedIndexer.processChanges([makeEvent(jsFile, "created")]);

        expect(result.indexed).toBe(0);
        expect(restrictedIndexer.getIndex().size).toBe(0);
      } finally {
        restrictedIndexer.dispose();
      }
    });

    it("ignorePatterns에 매칭되는 파일은 무시된다", async () => {
      // dist 디렉토리 생성
      const distDir = join(tmpDir, "dist");
      await mkdir(distDir, { recursive: true });
      const distFile = await createTempFile(distDir, "bundle.ts", "const x = 1;");

      const result = await indexer.processChanges([makeEvent(distFile, "created")]);

      expect(result.indexed).toBe(0);
    });
  });
});

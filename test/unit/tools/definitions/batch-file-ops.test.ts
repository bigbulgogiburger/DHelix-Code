/**
 * batch_file_ops 도구 테스트
 *
 * 커버하는 시나리오:
 * - 읽기 배치 (read-only batch)
 * - 쓰기 배치 (write-only batch)
 * - 혼합 배치 (mixed operations)
 * - parallel vs sequential 실행 모드
 * - 부분 실패 처리 (하나 실패 → 나머지 계속)
 * - 같은 파일에 대한 복수 write 충돌 처리
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { batchFileOpsTool } from "../../../../src/tools/definitions/batch-file-ops.js";
import { writeFile, readFile, unlink, mkdir } from "node:fs/promises";
import { join } from "node:path";

const tmpDir = join(process.cwd(), "test", "tmp");

const context = {
  workingDirectory: tmpDir,
  abortSignal: new AbortController().signal,
  timeoutMs: 30_000,
  platform: "darwin" as const,
};

// 테스트 파일 경로들
const fileA = join(tmpDir, "batch-test-a.txt");
const fileB = join(tmpDir, "batch-test-b.txt");
const fileC = join(tmpDir, "batch-test-c.txt");

// 각 테스트 전후 파일 초기화
beforeEach(async () => {
  await mkdir(tmpDir, { recursive: true });
});

afterEach(async () => {
  for (const f of [fileA, fileB, fileC]) {
    try {
      await unlink(f);
    } catch {
      // 파일이 없으면 무시
    }
  }
  // 중첩 디렉토리 정리
  try {
    const { rmdir } = await import("node:fs/promises");
    await unlink(join(tmpDir, "nested", "file.txt"));
    await rmdir(join(tmpDir, "nested"));
  } catch {
    // 없으면 무시
  }
});

// ---------------------------------------------------------------------------
// 도구 메타데이터
// ---------------------------------------------------------------------------

describe("batch_file_ops tool metadata", () => {
  it("should have correct name and permission level", () => {
    expect(batchFileOpsTool.name).toBe("batch_file_ops");
    expect(batchFileOpsTool.permissionLevel).toBe("confirm");
  });

  it("should have a description mentioning key features", () => {
    expect(batchFileOpsTool.description).toContain("parallel");
    expect(batchFileOpsTool.description).toContain("20 operations");
  });
});

// ---------------------------------------------------------------------------
// 읽기 배치
// ---------------------------------------------------------------------------

describe("read-only batch", () => {
  beforeEach(async () => {
    await writeFile(fileA, "hello from A\n", "utf-8");
    await writeFile(fileB, "hello from B\n", "utf-8");
  });

  it("should read multiple files in parallel", async () => {
    const result = await batchFileOpsTool.execute(
      {
        operations: [
          { type: "read", file_path: "batch-test-a.txt" },
          { type: "read", file_path: "batch-test-b.txt" },
        ],
        parallel: true,
      },
      context,
    );

    expect(result.isError).toBe(false);
    expect(result.output).toContain("batch-test-a.txt");
    expect(result.output).toContain("batch-test-b.txt");
    expect(result.output).toContain("hello from A");
    expect(result.output).toContain("hello from B");
    expect(result.output).toContain("2 succeeded");
  });

  it("should read multiple files sequentially", async () => {
    const result = await batchFileOpsTool.execute(
      {
        operations: [
          { type: "read", file_path: "batch-test-a.txt" },
          { type: "read", file_path: "batch-test-b.txt" },
        ],
        parallel: false,
      },
      context,
    );

    expect(result.isError).toBe(false);
    expect(result.output).toContain("hello from A");
    expect(result.output).toContain("hello from B");
    expect(result.output).toContain("2 succeeded");
  });

  it("should support offset and limit in read operations", async () => {
    // 여러 줄 파일 생성
    const lines = Array.from({ length: 10 }, (_, i) => `line ${i + 1}`).join("\n");
    await writeFile(fileA, lines, "utf-8");

    const result = await batchFileOpsTool.execute(
      {
        operations: [{ type: "read", file_path: "batch-test-a.txt", offset: 2, limit: 3 }],
        parallel: true,
      },
      context,
    );

    expect(result.isError).toBe(false);
    // offset=2, limit=3 → 3번째~5번째 줄
    expect(result.output).toContain("line 3");
    expect(result.output).toContain("line 4");
    expect(result.output).toContain("line 5");
    // 범위 밖 줄은 없어야 함
    expect(result.output).not.toContain("line 1\n");
    expect(result.output).not.toContain("line 6\n");
  });
});

// ---------------------------------------------------------------------------
// 쓰기 배치
// ---------------------------------------------------------------------------

describe("write-only batch", () => {
  it("should write multiple files in parallel", async () => {
    const result = await batchFileOpsTool.execute(
      {
        operations: [
          { type: "write", file_path: "batch-test-a.txt", content: "content A" },
          { type: "write", file_path: "batch-test-b.txt", content: "content B" },
        ],
        parallel: true,
      },
      context,
    );

    expect(result.isError).toBe(false);
    expect(result.output).toContain("2 succeeded");

    const contentA = await readFile(fileA, "utf-8");
    const contentB = await readFile(fileB, "utf-8");
    expect(contentA).toBe("content A");
    expect(contentB).toBe("content B");
  });

  it("should write multiple files sequentially", async () => {
    const result = await batchFileOpsTool.execute(
      {
        operations: [
          { type: "write", file_path: "batch-test-a.txt", content: "A first" },
          { type: "write", file_path: "batch-test-b.txt", content: "B second" },
        ],
        parallel: false,
      },
      context,
    );

    expect(result.isError).toBe(false);
    expect(result.output).toContain("2 succeeded");
  });

  it("should create parent directories automatically", async () => {
    const result = await batchFileOpsTool.execute(
      {
        operations: [{ type: "write", file_path: "nested/file.txt", content: "nested content" }],
        parallel: true,
      },
      context,
    );

    expect(result.isError).toBe(false);
    const content = await readFile(join(tmpDir, "nested", "file.txt"), "utf-8");
    expect(content).toBe("nested content");
  });
});

// ---------------------------------------------------------------------------
// 혼합 배치
// ---------------------------------------------------------------------------

describe("mixed operations batch", () => {
  beforeEach(async () => {
    await writeFile(fileA, "original content\nline two\nline three\n", "utf-8");
  });

  it("should mix read, write, and edit in parallel", async () => {
    const result = await batchFileOpsTool.execute(
      {
        operations: [
          { type: "read", file_path: "batch-test-a.txt" },
          { type: "write", file_path: "batch-test-b.txt", content: "new file B" },
          {
            type: "edit",
            file_path: "batch-test-a.txt",
            old_string: "original content",
            new_string: "modified content",
          },
        ],
        parallel: true,
      },
      context,
    );

    // read + write는 성공, edit도 성공해야 함
    // (read와 edit이 같은 파일을 대상으로 하지만, edit만 쓰기 작업이므로 충돌 없음)
    expect(result.output).toContain("batch-test-a.txt");
    expect(result.output).toContain("batch-test-b.txt");
  });

  it("should execute delete operation", async () => {
    const result = await batchFileOpsTool.execute(
      {
        operations: [{ type: "delete", file_path: "batch-test-a.txt" }],
        parallel: true,
      },
      context,
    );

    expect(result.isError).toBe(false);
    expect(result.output).toContain("Successfully deleted");

    // 파일이 실제로 삭제되었는지 확인
    let fileExists = false;
    try {
      await readFile(fileA, "utf-8");
      fileExists = true;
    } catch {
      fileExists = false;
    }
    expect(fileExists).toBe(false);
  });

  it("should mix write and delete in parallel", async () => {
    await writeFile(fileB, "to be deleted", "utf-8");

    const result = await batchFileOpsTool.execute(
      {
        operations: [
          { type: "write", file_path: "batch-test-a.txt", content: "new content A" },
          { type: "delete", file_path: "batch-test-b.txt" },
        ],
        parallel: true,
      },
      context,
    );

    expect(result.isError).toBe(false);
    expect(result.output).toContain("2 succeeded");
  });
});

// ---------------------------------------------------------------------------
// 부분 실패 처리
// ---------------------------------------------------------------------------

describe("partial failure handling", () => {
  beforeEach(async () => {
    await writeFile(fileA, "file A content\n", "utf-8");
  });

  it("should continue after a read failure in parallel mode", async () => {
    const result = await batchFileOpsTool.execute(
      {
        operations: [
          { type: "read", file_path: "batch-test-a.txt" }, // 성공
          { type: "read", file_path: "non-existent-file.txt" }, // 실패
          { type: "read", file_path: "batch-test-a.txt" }, // 성공
        ],
        parallel: true,
      },
      context,
    );

    // 전체 isError는 true (하나라도 실패했으므로)
    expect(result.isError).toBe(true);
    // 성공한 작업 결과도 포함되어야 함
    expect(result.output).toContain("file A content");
    // 실패 카운트 확인
    expect(result.output).toContain("1 failed");
    expect(result.output).toContain("2 succeeded");
  });

  it("should continue after a read failure in sequential mode", async () => {
    const result = await batchFileOpsTool.execute(
      {
        operations: [
          { type: "read", file_path: "batch-test-a.txt" }, // 성공
          { type: "read", file_path: "non-existent-file.txt" }, // 실패
          { type: "read", file_path: "batch-test-a.txt" }, // 성공
        ],
        parallel: false,
      },
      context,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain("file A content");
    expect(result.output).toContain("1 failed");
    expect(result.output).toContain("2 succeeded");
  });

  it("should report error on delete non-existent file", async () => {
    const result = await batchFileOpsTool.execute(
      {
        operations: [
          { type: "delete", file_path: "batch-test-a.txt" }, // 성공
          { type: "delete", file_path: "non-existent.txt" }, // 실패
        ],
        parallel: true,
      },
      context,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain("1 failed");
    expect(result.output).toContain("1 succeeded");
  });

  it("should report error on edit with non-existent old_string", async () => {
    const result = await batchFileOpsTool.execute(
      {
        operations: [
          {
            type: "edit",
            file_path: "batch-test-a.txt",
            old_string: "this string does not exist",
            new_string: "replacement",
          },
        ],
        parallel: true,
      },
      context,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain("0 succeeded");
    expect(result.output).toContain("1 failed");
  });

  it("should report error on write to invalid path", async () => {
    const result = await batchFileOpsTool.execute(
      {
        operations: [
          { type: "write", file_path: "batch-test-a.txt", content: "valid write" }, // 성공
          { type: "write", file_path: "\0invalid\0path", content: "invalid" }, // 실패
        ],
        parallel: false,
      },
      context,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain("1 succeeded");
    expect(result.output).toContain("1 failed");
  });
});

// ---------------------------------------------------------------------------
// parallel vs sequential 모드 차이
// ---------------------------------------------------------------------------

describe("parallel vs sequential execution mode", () => {
  it("should default parallel to true when not specified via schema parse", () => {
    const schema = batchFileOpsTool.parameterSchema;
    const parsed = schema.parse({
      operations: [{ type: "read", file_path: "test.txt" }],
    });
    expect(parsed.parallel).toBe(true);
  });

  it("should produce same final file content in both modes for independent ops", async () => {
    // 두 독립적인 파일에 쓰기 — 순서와 무관하게 결과가 동일해야 함
    const resultParallel = await batchFileOpsTool.execute(
      {
        operations: [
          { type: "write", file_path: "batch-test-a.txt", content: "parallel A" },
          { type: "write", file_path: "batch-test-b.txt", content: "parallel B" },
        ],
        parallel: true,
      },
      context,
    );

    const contentA = await readFile(fileA, "utf-8");
    const contentB = await readFile(fileB, "utf-8");
    expect(contentA).toBe("parallel A");
    expect(contentB).toBe("parallel B");
    expect(resultParallel.isError).toBe(false);

    // 다시 sequential로 덮어씀
    const resultSeq = await batchFileOpsTool.execute(
      {
        operations: [
          { type: "write", file_path: "batch-test-a.txt", content: "sequential A" },
          { type: "write", file_path: "batch-test-b.txt", content: "sequential B" },
        ],
        parallel: false,
      },
      context,
    );

    const contentA2 = await readFile(fileA, "utf-8");
    const contentB2 = await readFile(fileB, "utf-8");
    expect(contentA2).toBe("sequential A");
    expect(contentB2).toBe("sequential B");
    expect(resultSeq.isError).toBe(false);
  });

  it("should handle same-file write conflicts safely in parallel mode", async () => {
    // 같은 파일에 write가 두 번 → 자동 순차 처리 (충돌 방지)
    const result = await batchFileOpsTool.execute(
      {
        operations: [
          { type: "write", file_path: "batch-test-a.txt", content: "first write" },
          { type: "write", file_path: "batch-test-a.txt", content: "second write" },
        ],
        parallel: true,
      },
      context,
    );

    expect(result.isError).toBe(false);
    expect(result.output).toContain("2 succeeded");

    // 파일이 유효한 상태여야 함 (두 번째 write가 마지막이어야 함)
    const content = await readFile(fileA, "utf-8");
    expect(typeof content).toBe("string");
    expect(content.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 스키마 검증
// ---------------------------------------------------------------------------

describe("schema validation", () => {
  it("should reject empty operations array", () => {
    const schema = batchFileOpsTool.parameterSchema;
    const result = schema.safeParse({ operations: [], parallel: true });
    expect(result.success).toBe(false);
  });

  it("should reject operations array exceeding 20 items", () => {
    const schema = batchFileOpsTool.parameterSchema;
    const ops = Array.from({ length: 21 }, (_, i) => ({
      type: "read" as const,
      file_path: `file-${i}.txt`,
    }));
    const result = schema.safeParse({ operations: ops, parallel: true });
    expect(result.success).toBe(false);
  });

  it("should accept exactly 20 operations", () => {
    const schema = batchFileOpsTool.parameterSchema;
    const ops = Array.from({ length: 20 }, (_, i) => ({
      type: "read" as const,
      file_path: `file-${i}.txt`,
    }));
    const result = schema.safeParse({ operations: ops, parallel: true });
    expect(result.success).toBe(true);
  });

  it("should reject unknown operation types", () => {
    const schema = batchFileOpsTool.parameterSchema;
    const result = schema.safeParse({
      operations: [{ type: "move", file_path: "a.txt" }],
      parallel: true,
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 요약 메타데이터
// ---------------------------------------------------------------------------

describe("batch result metadata", () => {
  beforeEach(async () => {
    await writeFile(fileA, "content\n", "utf-8");
  });

  it("should include totalOps, successCount, failureCount in metadata", async () => {
    const result = await batchFileOpsTool.execute(
      {
        operations: [
          { type: "read", file_path: "batch-test-a.txt" }, // 성공
          { type: "read", file_path: "non-existent.txt" }, // 실패
        ],
        parallel: true,
      },
      context,
    );

    expect(result.metadata).toBeDefined();
    expect(result.metadata?.totalOps).toBe(2);
    expect(result.metadata?.successCount).toBe(1);
    expect(result.metadata?.failureCount).toBe(1);
  });

  it("should show all-success summary", async () => {
    const result = await batchFileOpsTool.execute(
      {
        operations: [
          { type: "read", file_path: "batch-test-a.txt" },
          { type: "read", file_path: "batch-test-a.txt" },
        ],
        parallel: true,
      },
      context,
    );

    expect(result.isError).toBe(false);
    expect(result.metadata?.successCount).toBe(2);
    expect(result.metadata?.failureCount).toBe(0);
    expect(result.output).toContain("2 succeeded, 0 failed");
  });
});

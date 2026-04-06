/**
 * apply_patch 도구 단위 테스트
 *
 * 커버리지:
 * - 단일 파일 패치 적용
 * - 다중 파일 패치 적용
 * - dry_run 모드 (파일 미변경 검증)
 * - 잘못된 diff 형식 에러 처리
 * - fuzz_factor 적용 (컨텍스트 라인 불일치 허용)
 * - 새 파일 생성 패치 (/dev/null 원본)
 * - 헝크 매칭 실패 에러
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { applyPatchTool } from "../../../../src/tools/definitions/apply-patch.js";
import { writeFile, readFile, unlink, mkdir } from "node:fs/promises";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// 테스트 픽스처 설정
// ---------------------------------------------------------------------------

const tmpDir = join(process.cwd(), "test", "tmp", "apply-patch");

const makeContext = () => ({
  workingDirectory: tmpDir,
  abortSignal: new AbortController().signal,
  timeoutMs: 30_000,
  platform: process.platform as "darwin" | "linux" | "win32",
});

beforeEach(async () => {
  await mkdir(tmpDir, { recursive: true });
});

afterEach(async () => {
  // 테스트 후 임시 파일 정리
  const { rm } = await import("node:fs/promises");
  await rm(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// 헬퍼: 파일 내용 읽기
// ---------------------------------------------------------------------------

async function readTmp(name: string): Promise<string> {
  return readFile(join(tmpDir, name), "utf-8");
}

async function writeTmp(name: string, content: string): Promise<void> {
  await writeFile(join(tmpDir, name), content, "utf-8");
}

// ---------------------------------------------------------------------------
// 도구 메타데이터
// ---------------------------------------------------------------------------

describe("apply_patch tool metadata", () => {
  it("should have correct name", () => {
    expect(applyPatchTool.name).toBe("apply_patch");
  });

  it("should require confirm permission level", () => {
    expect(applyPatchTool.permissionLevel).toBe("confirm");
  });

  it("should have a description", () => {
    expect(typeof applyPatchTool.description).toBe("string");
    expect(applyPatchTool.description.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 단일 파일 패치 적용
// ---------------------------------------------------------------------------

describe("single file patch", () => {
  it("should apply a simple hunk to a single file", async () => {
    await writeTmp("hello.txt", "line one\nline two\nline three\n");

    const patch = [
      "--- a/hello.txt",
      "+++ b/hello.txt",
      "@@ -1,3 +1,3 @@",
      " line one",
      "-line two",
      "+LINE TWO",
      " line three",
    ].join("\n");

    const result = await applyPatchTool.execute(
      { patch, dry_run: false, fuzz_factor: 0 },
      makeContext(),
    );

    expect(result.isError).toBe(false);
    expect(result.output).toContain("1 file");

    const updated = await readTmp("hello.txt");
    expect(updated).toBe("line one\nLINE TWO\nline three\n");
  });

  it("should add lines via patch", async () => {
    await writeTmp("add.txt", "first\nlast\n");

    const patch = [
      "--- a/add.txt",
      "+++ b/add.txt",
      "@@ -1,2 +1,3 @@",
      " first",
      "+middle",
      " last",
    ].join("\n");

    const result = await applyPatchTool.execute(
      { patch, dry_run: false, fuzz_factor: 0 },
      makeContext(),
    );

    expect(result.isError).toBe(false);
    const updated = await readTmp("add.txt");
    expect(updated).toBe("first\nmiddle\nlast\n");
  });

  it("should remove lines via patch", async () => {
    await writeTmp("remove.txt", "keep\nremove-me\nkeep\n");

    const patch = [
      "--- a/remove.txt",
      "+++ b/remove.txt",
      "@@ -1,3 +1,2 @@",
      " keep",
      "-remove-me",
      " keep",
    ].join("\n");

    const result = await applyPatchTool.execute(
      { patch, dry_run: false, fuzz_factor: 0 },
      makeContext(),
    );

    expect(result.isError).toBe(false);
    const updated = await readTmp("remove.txt");
    expect(updated).toBe("keep\nkeep\n");
  });

  it("should include linesAdded and linesRemoved in metadata", async () => {
    await writeTmp("meta.txt", "a\nb\nc\n");

    const patch = [
      "--- a/meta.txt",
      "+++ b/meta.txt",
      "@@ -1,3 +1,3 @@",
      " a",
      "-b",
      "+B",
      " c",
    ].join("\n");

    const result = await applyPatchTool.execute(
      { patch, dry_run: false, fuzz_factor: 0 },
      makeContext(),
    );

    expect(result.isError).toBe(false);
    expect(result.metadata).toBeDefined();
    const changes = result.metadata?.changes as Array<{ linesAdded: number; linesRemoved: number }>;
    expect(changes[0].linesAdded).toBe(1);
    expect(changes[0].linesRemoved).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 다중 파일 패치
// ---------------------------------------------------------------------------

describe("multi-file patch", () => {
  it("should apply patch to multiple files in one call", async () => {
    await writeTmp("file-a.txt", "alpha\nbeta\n");
    await writeTmp("file-b.txt", "one\ntwo\n");

    const patch = [
      "--- a/file-a.txt",
      "+++ b/file-a.txt",
      "@@ -1,2 +1,2 @@",
      "-alpha",
      "+ALPHA",
      " beta",
      "--- a/file-b.txt",
      "+++ b/file-b.txt",
      "@@ -1,2 +1,2 @@",
      " one",
      "-two",
      "+TWO",
    ].join("\n");

    const result = await applyPatchTool.execute(
      { patch, dry_run: false, fuzz_factor: 0 },
      makeContext(),
    );

    expect(result.isError).toBe(false);
    expect(result.output).toContain("2 file");

    expect(await readTmp("file-a.txt")).toBe("ALPHA\nbeta\n");
    expect(await readTmp("file-b.txt")).toBe("one\nTWO\n");
  });

  it("should report filesChanged count in metadata", async () => {
    await writeTmp("x.txt", "x\n");
    await writeTmp("y.txt", "y\n");

    const patch = [
      "--- a/x.txt",
      "+++ b/x.txt",
      "@@ -1 +1 @@",
      "-x",
      "+X",
      "--- a/y.txt",
      "+++ b/y.txt",
      "@@ -1 +1 @@",
      "-y",
      "+Y",
    ].join("\n");

    const result = await applyPatchTool.execute(
      { patch, dry_run: false, fuzz_factor: 0 },
      makeContext(),
    );

    expect(result.isError).toBe(false);
    expect(result.metadata?.filesChanged).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// dry_run 모드
// ---------------------------------------------------------------------------

describe("dry_run mode", () => {
  it("should not modify files when dry_run is true", async () => {
    const original = "untouched\n";
    await writeTmp("dry.txt", original);

    const patch = [
      "--- a/dry.txt",
      "+++ b/dry.txt",
      "@@ -1 +1 @@",
      "-untouched",
      "+modified",
    ].join("\n");

    const result = await applyPatchTool.execute(
      { patch, dry_run: true, fuzz_factor: 0 },
      makeContext(),
    );

    expect(result.isError).toBe(false);
    expect(result.output).toContain("dry-run");

    // 실제 파일은 변경되지 않아야 함
    const stillOriginal = await readTmp("dry.txt");
    expect(stillOriginal).toBe(original);
  });

  it("should include dryRun flag in metadata", async () => {
    await writeTmp("dry2.txt", "abc\n");

    const patch = [
      "--- a/dry2.txt",
      "+++ b/dry2.txt",
      "@@ -1 +1 @@",
      "-abc",
      "+ABC",
    ].join("\n");

    const result = await applyPatchTool.execute(
      { patch, dry_run: true, fuzz_factor: 0 },
      makeContext(),
    );

    expect(result.isError).toBe(false);
    expect(result.metadata?.dryRun).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 잘못된 diff 형식 에러 처리
// ---------------------------------------------------------------------------

describe("invalid diff format error handling", () => {
  it("should error on completely invalid patch string", async () => {
    const result = await applyPatchTool.execute(
      { patch: "this is not a diff", dry_run: false, fuzz_factor: 0 },
      makeContext(),
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain("parse");
  });

  it("should error on patch missing +++ header", async () => {
    const patch = ["--- a/foo.txt", "@@ -1 +1 @@", "-old", "+new"].join("\n");

    const result = await applyPatchTool.execute(
      { patch, dry_run: false, fuzz_factor: 0 },
      makeContext(),
    );

    expect(result.isError).toBe(true);
  });

  it("should error on invalid hunk header format", async () => {
    const patch = [
      "--- a/foo.txt",
      "+++ b/foo.txt",
      "@@ invalid hunk header @@",
      "-old",
      "+new",
    ].join("\n");

    const result = await applyPatchTool.execute(
      { patch, dry_run: false, fuzz_factor: 0 },
      makeContext(),
    );

    expect(result.isError).toBe(true);
  });

  it("should error when target file does not exist (not a new-file patch)", async () => {
    const patch = [
      "--- a/nonexistent.txt",
      "+++ b/nonexistent.txt",
      "@@ -1 +1 @@",
      "-old",
      "+new",
    ].join("\n");

    const result = await applyPatchTool.execute(
      { patch, dry_run: false, fuzz_factor: 0 },
      makeContext(),
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain("nonexistent.txt");
  });

  it("should error when context does not match file content", async () => {
    await writeTmp("mismatch.txt", "completely different content\n");

    const patch = [
      "--- a/mismatch.txt",
      "+++ b/mismatch.txt",
      "@@ -1 +1 @@",
      "-expected context line",
      "+new line",
    ].join("\n");

    const result = await applyPatchTool.execute(
      { patch, dry_run: false, fuzz_factor: 0 },
      makeContext(),
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain("Failed");
  });
});

// ---------------------------------------------------------------------------
// fuzz_factor 적용
// ---------------------------------------------------------------------------

describe("fuzz_factor", () => {
  it("should apply patch when context lines mismatch within fuzz_factor", async () => {
    // 파일의 컨텍스트 라인이 패치의 컨텍스트와 다소 다름
    // 실제 파일: "context A\ntarget\ncontext B\n"
    // 패치 컨텍스트: "context X\ntarget\ncontext Y\n"
    await writeTmp("fuzz.txt", "context A\ntarget line\ncontext B\n");

    const patch = [
      "--- a/fuzz.txt",
      "+++ b/fuzz.txt",
      "@@ -1,3 +1,3 @@",
      " context X",   // 실제: "context A" — 1 mismatch
      "-target line",
      "+TARGET LINE",
      " context Y",   // 실제: "context B" — 1 mismatch
    ].join("\n");

    // fuzz_factor=0 이면 실패
    const failResult = await applyPatchTool.execute(
      { patch, dry_run: false, fuzz_factor: 0 },
      makeContext(),
    );
    expect(failResult.isError).toBe(true);

    // 파일을 원상 복구
    await writeTmp("fuzz.txt", "context A\ntarget line\ncontext B\n");

    // fuzz_factor=2 이면 성공 (2개 불일치 허용)
    const successResult = await applyPatchTool.execute(
      { patch, dry_run: false, fuzz_factor: 2 },
      makeContext(),
    );
    expect(successResult.isError).toBe(false);
    const updated = await readTmp("fuzz.txt");
    expect(updated).toBe("context A\nTARGET LINE\ncontext B\n");
  });

  it("should fail even with fuzz_factor when deletion lines do not match", async () => {
    await writeTmp("fuzz-del.txt", "actual content\n");

    const patch = [
      "--- a/fuzz-del.txt",
      "+++ b/fuzz-del.txt",
      "@@ -1 +1 @@",
      "-wrong content",   // 실제 삭제 대상과 다름
      "+new content",
    ].join("\n");

    // 삭제 라인은 fuzz로 허용되지 않음
    const result = await applyPatchTool.execute(
      { patch, dry_run: false, fuzz_factor: 3 },
      makeContext(),
    );
    expect(result.isError).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 새 파일 생성 패치 (/dev/null 원본)
// ---------------------------------------------------------------------------

describe("new file creation via patch", () => {
  it("should create a new file when original is /dev/null", async () => {
    const patch = [
      "--- /dev/null",
      "+++ b/brand-new.txt",
      "@@ -0,0 +1,2 @@",
      "+first line",
      "+second line",
    ].join("\n");

    const result = await applyPatchTool.execute(
      { patch, dry_run: false, fuzz_factor: 0 },
      makeContext(),
    );

    expect(result.isError).toBe(false);
    const content = await readTmp("brand-new.txt");
    expect(content).toContain("first line");
    expect(content).toContain("second line");
  });
});

// ---------------------------------------------------------------------------
// git diff 형식 호환성 (diff --git 헤더 포함)
// ---------------------------------------------------------------------------

describe("git diff format compatibility", () => {
  it("should handle diff --git header prefix", async () => {
    await writeTmp("git-compat.txt", "foo\nbar\n");

    const patch = [
      "diff --git a/git-compat.txt b/git-compat.txt",
      "index abc123..def456 100644",
      "--- a/git-compat.txt",
      "+++ b/git-compat.txt",
      "@@ -1,2 +1,2 @@",
      "-foo",
      "+FOO",
      " bar",
    ].join("\n");

    const result = await applyPatchTool.execute(
      { patch, dry_run: false, fuzz_factor: 0 },
      makeContext(),
    );

    expect(result.isError).toBe(false);
    const updated = await readTmp("git-compat.txt");
    expect(updated).toBe("FOO\nbar\n");
  });
});

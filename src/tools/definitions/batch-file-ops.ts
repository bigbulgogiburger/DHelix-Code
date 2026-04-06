/**
 * 배치 파일 작업 도구 — 여러 파일 작업을 하나의 도구 호출로 처리하는 도구
 *
 * 10개 파일을 동시에 읽으려면 LLM이 file_read를 10번 호출해야 하는 문제를 해결합니다.
 * 각 호출이 개별 LLM turn을 소비하여 레이턴시가 증가하는 대신,
 * 이 도구를 사용하면 단일 호출로 최대 20개의 파일 작업을 처리할 수 있습니다.
 *
 * 지원 작업 타입:
 * - read: 파일 내용 읽기 (offset/limit으로 부분 읽기 가능)
 * - write: 파일 생성 또는 덮어쓰기
 * - edit: 파일 내 특정 문자열 교체
 * - delete: 파일 삭제
 *
 * 실행 모드:
 * - parallel=true (기본값): Promise.allSettled로 병렬 실행
 *   단, 같은 파일에 대한 write/edit/delete는 자동으로 순차 실행 (데이터 일관성 보장)
 * - parallel=false: 순차 실행 (작업 순서가 중요할 때 사용)
 *
 * 오류 처리:
 * - 하나의 작업이 실패해도 나머지 작업은 계속 실행 (Promise.allSettled 방식)
 * - 각 작업의 성공/실패 결과를 개별적으로 반환
 *
 * 권한 수준: "confirm" — write/edit/delete 작업이 포함되므로 사용자 확인이 필요합니다.
 */
import { z } from "zod";
import { readFile, writeFile, unlink, mkdir, stat } from "node:fs/promises";
import { dirname } from "node:path";
import { type ToolDefinition, type ToolContext, type ToolResult } from "../types.js";
import { resolvePath, normalizePath } from "../../utils/path.js";

// ---------------------------------------------------------------------------
// 작업(Operation) 스키마 정의
// ---------------------------------------------------------------------------

/**
 * read 작업 스키마 — 파일 내용을 읽습니다
 * offset/limit으로 대용량 파일의 특정 범위만 읽을 수 있습니다.
 */
const readOpSchema = z.object({
  type: z.literal("read"),
  /** 읽을 파일 경로 (절대 경로 또는 작업 디렉토리 기준 상대 경로) */
  file_path: z.string().describe("File path to read"),
  /** 시작 줄 번호 (0-based, 선택사항) */
  offset: z.number().int().min(0).optional().describe("Line number to start reading from (0-based)"),
  /** 읽을 최대 줄 수 (선택사항) */
  limit: z.number().int().min(1).optional().describe("Maximum number of lines to read"),
});

/**
 * write 작업 스키마 — 파일을 생성하거나 전체 내용을 덮어씁니다
 * 부모 디렉토리가 없으면 자동으로 생성합니다.
 */
const writeOpSchema = z.object({
  type: z.literal("write"),
  /** 쓸 파일 경로 */
  file_path: z.string().describe("File path to write to"),
  /** 파일에 쓸 전체 내용 */
  content: z.string().describe("Content to write to the file"),
});

/**
 * edit 작업 스키마 — 파일 내 특정 문자열을 찾아 교체합니다
 * old_string은 파일 내에서 고유해야 합니다 (여러 곳에 존재하면 에러).
 */
const editOpSchema = z.object({
  type: z.literal("edit"),
  /** 편집할 파일 경로 */
  file_path: z.string().describe("File path to edit"),
  /** 찾을 문자열 (공백과 들여쓰기를 포함하여 정확히 일치해야 함) */
  old_string: z.string().describe("Exact string to find and replace"),
  /** 교체할 문자열 */
  new_string: z.string().describe("Replacement string"),
});

/**
 * delete 작업 스키마 — 파일을 삭제합니다
 */
const deleteOpSchema = z.object({
  type: z.literal("delete"),
  /** 삭제할 파일 경로 */
  file_path: z.string().describe("File path to delete"),
});

/**
 * 단일 작업의 타입 (discriminatedUnion으로 4가지 타입을 구별)
 */
const operationSchema = z.discriminatedUnion("type", [
  readOpSchema,
  writeOpSchema,
  editOpSchema,
  deleteOpSchema,
]);

/**
 * batch_file_ops 매개변수 스키마
 */
const paramSchema = z.object({
  /**
   * 실행할 파일 작업 목록 (1-20개)
   * 각 작업은 type 필드로 구별되는 discriminatedUnion입니다.
   */
  operations: z
    .array(operationSchema)
    .min(1, "At least 1 operation is required")
    .max(20, "Maximum 20 operations allowed per batch"),
  /**
   * 병렬 실행 여부 (기본값: true)
   * true: Promise.allSettled로 병렬 실행 (같은 파일 write는 자동 순차)
   * false: 순차 실행 (작업 순서가 중요할 때 사용)
   */
  parallel: z.boolean().default(true).describe("Run operations in parallel (default: true)"),
});

type Params = z.infer<typeof paramSchema>;
type Operation = z.infer<typeof operationSchema>;

// ---------------------------------------------------------------------------
// 개별 작업 실행 함수
// ---------------------------------------------------------------------------

/** 기본 줄 수 제한 */
const DEFAULT_LINE_LIMIT = 2000;
/** 한 줄의 최대 길이 */
const MAX_LINE_LENGTH = 2000;

/** 긴 줄을 최대 길이로 잘라냄 */
function truncateLine(line: string): string {
  return line.length > MAX_LINE_LENGTH ? line.substring(0, MAX_LINE_LENGTH) + "... (truncated)" : line;
}

/**
 * read 작업 실행 — 파일을 읽어 줄 번호와 함께 반환합니다
 */
async function executeRead(
  op: z.infer<typeof readOpSchema>,
  workingDirectory: string,
): Promise<ToolResult> {
  const filePath = resolvePath(workingDirectory, op.file_path);
  try {
    const fileStat = await stat(filePath);
    if (fileStat.size === 0) {
      return {
        output: "[Empty file]",
        isError: false,
        metadata: { path: normalizePath(filePath), totalLines: 0 },
      };
    }

    const content = await readFile(filePath, "utf-8");
    const lines = content.split("\n");
    const offset = op.offset ?? 0;
    const limit = op.limit ?? Math.min(lines.length, DEFAULT_LINE_LIMIT);
    const sliced = lines.slice(offset, offset + limit);

    const numbered = sliced
      .map((line, i) => `${String(offset + i + 1).padStart(6)} | ${truncateLine(line)}`)
      .join("\n");

    const truncatedNotice =
      !op.offset && !op.limit && lines.length > DEFAULT_LINE_LIMIT
        ? `\n\n[File truncated: showing ${DEFAULT_LINE_LIMIT} of ${lines.length} lines. Use offset/limit to read more.]`
        : "";

    return {
      output: numbered + truncatedNotice,
      isError: false,
      metadata: {
        path: normalizePath(filePath),
        totalLines: lines.length,
        readFrom: offset,
        readTo: Math.min(offset + limit, lines.length),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { output: `Failed to read file: ${message}`, isError: true };
  }
}

/**
 * write 작업 실행 — 파일을 생성하거나 전체 내용을 덮어씁니다
 */
async function executeWrite(
  op: z.infer<typeof writeOpSchema>,
  workingDirectory: string,
): Promise<ToolResult> {
  const filePath = resolvePath(workingDirectory, op.file_path);
  try {
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, op.content, "utf-8");
    const lineCount = op.content.split("\n").length;
    return {
      output: `Successfully wrote ${lineCount} lines to ${normalizePath(op.file_path)}`,
      isError: false,
      metadata: { path: normalizePath(filePath), lineCount },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { output: `Failed to write file: ${message}`, isError: true };
  }
}

/**
 * edit 작업 실행 — 파일 내 특정 문자열을 찾아 교체합니다
 * old_string은 파일 내에서 고유해야 합니다.
 */
async function executeEdit(
  op: z.infer<typeof editOpSchema>,
  workingDirectory: string,
): Promise<ToolResult> {
  const filePath = resolvePath(workingDirectory, op.file_path);
  try {
    const content = await readFile(filePath, "utf-8");

    const firstIdx = content.indexOf(op.old_string);
    if (firstIdx === -1) {
      return {
        output: `String not found in ${normalizePath(op.file_path)}. Make sure old_string matches exactly (including whitespace and indentation).`,
        isError: true,
      };
    }

    // 고유성 확인 — 2개 이상 존재하면 에러
    const secondIdx = content.indexOf(op.old_string, firstIdx + 1);
    if (secondIdx !== -1) {
      let occurrences = 2;
      let searchFrom = secondIdx + 1;
      while ((searchFrom = content.indexOf(op.old_string, searchFrom)) !== -1) {
        occurrences++;
        searchFrom++;
      }
      return {
        output: `Found ${occurrences} occurrences of old_string in ${normalizePath(op.file_path)}. Provide more context to make it unique.`,
        isError: true,
      };
    }

    const updated = content.replace(op.old_string, op.new_string);
    await writeFile(filePath, updated, "utf-8");

    return {
      output: `Successfully edited ${normalizePath(op.file_path)}`,
      isError: false,
      metadata: { path: normalizePath(filePath) },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { output: `Failed to edit file: ${message}`, isError: true };
  }
}

/**
 * delete 작업 실행 — 파일을 삭제합니다
 */
async function executeDelete(
  op: z.infer<typeof deleteOpSchema>,
  workingDirectory: string,
): Promise<ToolResult> {
  const filePath = resolvePath(workingDirectory, op.file_path);
  try {
    await unlink(filePath);
    return {
      output: `Successfully deleted ${normalizePath(op.file_path)}`,
      isError: false,
      metadata: { path: normalizePath(filePath) },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { output: `Failed to delete file: ${message}`, isError: true };
  }
}

/**
 * 단일 작업을 실행하는 디스패처 함수
 *
 * @param op - 실행할 작업 (discriminatedUnion으로 타입이 결정됨)
 * @param workingDirectory - 상대 경로 해석의 기준이 되는 작업 디렉토리
 * @returns 작업 실행 결과
 */
async function executeOperation(op: Operation, workingDirectory: string): Promise<ToolResult> {
  switch (op.type) {
    case "read":
      return executeRead(op, workingDirectory);
    case "write":
      return executeWrite(op, workingDirectory);
    case "edit":
      return executeEdit(op, workingDirectory);
    case "delete":
      return executeDelete(op, workingDirectory);
  }
}

// ---------------------------------------------------------------------------
// 동시성 제어: 같은 파일 write/edit/delete는 순차 실행
// ---------------------------------------------------------------------------

/**
 * 파일 충돌 감지: 같은 파일에 대한 write/edit/delete 작업이 복수 개인지 확인합니다.
 *
 * @param ops - 작업 목록
 * @param workingDirectory - 작업 디렉토리
 * @returns 충돌 파일 경로 Set (절대 경로, 복수 번 등장하는 파일만)
 */
function getConflictingPaths(ops: Operation[], workingDirectory: string): Set<string> {
  const pathCount = new Map<string, number>();
  for (const op of ops) {
    if (op.type === "write" || op.type === "edit" || op.type === "delete") {
      const absPath = resolvePath(workingDirectory, op.file_path);
      pathCount.set(absPath, (pathCount.get(absPath) ?? 0) + 1);
    }
  }
  const conflicts = new Set<string>();
  for (const [path, count] of pathCount) {
    if (count > 1) conflicts.add(path);
  }
  return conflicts;
}

// ---------------------------------------------------------------------------
// 배치 실행 결과 포맷
// ---------------------------------------------------------------------------

/**
 * 배치 결과를 사람이 읽기 좋은 형식으로 포맷합니다.
 *
 * 각 작업의 결과를 번호와 함께 출력하고, 요약 통계를 맨 아래에 추가합니다.
 *
 * @param ops - 원래 작업 목록 (파일 경로 참조용)
 * @param results - 각 작업의 ToolResult
 * @returns 포맷된 배치 결과 ToolResult
 */
function formatBatchResults(ops: Operation[], results: ToolResult[]): ToolResult {
  const lines: string[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < results.length; i++) {
    const op = ops[i];
    const result = results[i];
    const label = `[${i + 1}/${ops.length}] ${op.type.toUpperCase()} ${op.file_path}`;

    if (result.isError) {
      failureCount++;
      lines.push(`${label}: ERROR`);
      lines.push(`  ${result.output}`);
    } else {
      successCount++;
      lines.push(`${label}: OK`);
      // read 작업은 내용을 인라인으로 포함
      if (op.type === "read") {
        lines.push(result.output);
      } else {
        lines.push(`  ${result.output}`);
      }
    }
  }

  // 요약 통계
  lines.push("");
  lines.push(`Summary: ${successCount} succeeded, ${failureCount} failed (${ops.length} total)`);

  // 하나라도 실패하면 isError=true로 표시하여 LLM이 실패를 인지하도록 함
  const hasError = failureCount > 0;

  return {
    output: lines.join("\n"),
    isError: hasError,
    metadata: {
      totalOps: ops.length,
      successCount,
      failureCount,
    },
  };
}

// ---------------------------------------------------------------------------
// 병렬 / 순차 실행 전략
// ---------------------------------------------------------------------------

/**
 * 병렬 실행 전략 — Promise.allSettled로 동시에 실행합니다.
 *
 * 같은 파일에 write/edit/delete 작업이 복수 개 있으면,
 * 해당 파일과 관련된 모든 작업을 순차 그룹으로 분리하여 충돌을 방지합니다.
 *
 * 구체적으로:
 * - 충돌 없는 작업들: 모두 병렬로 실행
 * - 충돌 파일을 포함하는 작업들: 순차적으로 실행 (배치 내 순서 유지)
 *
 * @param ops - 작업 목록
 * @param workingDirectory - 작업 디렉토리
 * @returns 각 작업의 ToolResult (ops와 같은 순서)
 */
async function executeParallel(ops: Operation[], workingDirectory: string): Promise<ToolResult[]> {
  const conflictPaths = getConflictingPaths(ops, workingDirectory);

  // 충돌 파일이 없으면 모두 병렬 실행
  if (conflictPaths.size === 0) {
    const settled = await Promise.allSettled(
      ops.map((op) => executeOperation(op, workingDirectory)),
    );
    return settled.map((r) =>
      r.status === "fulfilled"
        ? r.value
        : { output: `Operation failed: ${String(r.reason)}`, isError: true },
    );
  }

  // 충돌 파일이 있으면:
  // - 충돌 없는 작업 → 병렬
  // - 충돌 파일 포함 작업 → 순차 (배치 순서 유지)
  // 결과 배열에 원래 인덱스 순서를 보존하기 위해 indexed 처리
  const results: ToolResult[] = new Array<ToolResult>(ops.length);

  const parallelGroup: Array<{ idx: number; op: Operation }> = [];
  const sequentialGroup: Array<{ idx: number; op: Operation }> = [];

  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    const absPath = resolvePath(workingDirectory, op.file_path);
    if (conflictPaths.has(absPath)) {
      sequentialGroup.push({ idx: i, op });
    } else {
      parallelGroup.push({ idx: i, op });
    }
  }

  // 병렬 그룹 실행
  const parallelSettled = await Promise.allSettled(
    parallelGroup.map(({ op }) => executeOperation(op, workingDirectory)),
  );
  for (let i = 0; i < parallelGroup.length; i++) {
    const { idx } = parallelGroup[i];
    const r = parallelSettled[i];
    results[idx] =
      r.status === "fulfilled"
        ? r.value
        : { output: `Operation failed: ${String(r.reason)}`, isError: true };
  }

  // 순차 그룹 실행 (충돌 파일은 순서 보장)
  for (const { idx, op } of sequentialGroup) {
    try {
      results[idx] = await executeOperation(op, workingDirectory);
    } catch (error) {
      results[idx] = { output: `Operation failed: ${String(error)}`, isError: true };
    }
  }

  return results;
}

/**
 * 순차 실행 전략 — 작업을 하나씩 순서대로 실행합니다.
 *
 * 하나의 작업이 실패해도 나머지 작업은 계속 실행됩니다.
 *
 * @param ops - 작업 목록
 * @param workingDirectory - 작업 디렉토리
 * @returns 각 작업의 ToolResult (ops와 같은 순서)
 */
async function executeSequential(ops: Operation[], workingDirectory: string): Promise<ToolResult[]> {
  const results: ToolResult[] = [];
  for (const op of ops) {
    try {
      const result = await executeOperation(op, workingDirectory);
      results.push(result);
    } catch (error) {
      results.push({ output: `Operation failed: ${String(error)}`, isError: true });
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// 도구 실행 진입점
// ---------------------------------------------------------------------------

/**
 * batch_file_ops 실행 함수 — parallel 플래그에 따라 실행 전략을 선택합니다.
 *
 * @param params - 검증된 매개변수 (operations, parallel)
 * @param context - 실행 컨텍스트 (작업 디렉토리 등)
 * @returns 모든 작업의 결과를 포함하는 배치 결과
 */
async function execute(params: Params, context: ToolContext): Promise<ToolResult> {
  const { operations, parallel } = params;
  const { workingDirectory } = context;

  const results = parallel
    ? await executeParallel(operations, workingDirectory)
    : await executeSequential(operations, workingDirectory);

  return formatBatchResults(operations, results);
}

// ---------------------------------------------------------------------------
// 도구 정의 내보내기
// ---------------------------------------------------------------------------

/**
 * batch_file_ops 도구 정의 — 내보내기하여 도구 레지스트리에 등록
 *
 * 여러 파일 작업(read/write/edit/delete)을 하나의 도구 호출로 배치 처리합니다.
 * 병렬 실행(기본값)으로 레이턴시를 크게 줄일 수 있습니다.
 */
export const batchFileOpsTool: ToolDefinition<Params> = {
  name: "batch_file_ops",
  description:
    "Execute multiple file operations (read/write/edit/delete) in a single call. " +
    "Operations run in parallel by default (parallel=true). Use parallel=false when order matters. " +
    "Maximum 20 operations per batch. Each operation returns its own result. " +
    "A single failure does NOT abort the remaining operations.",
  parameterSchema: paramSchema,
  /** "confirm" — write/edit/delete 작업이 포함되므로 사용자 확인 필요 */
  permissionLevel: "confirm",
  /** 120초 타임아웃 — 20개의 작업을 병렬로 실행하므로 충분한 시간 확보 */
  timeoutMs: 120_000,
  execute,
};

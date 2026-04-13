/**
 * Scheduler Stage — 도구 호출을 실행 그룹으로 분류하는 스케줄러
 *
 * 도구 호출의 특성에 따라 병렬/순차 실행 그룹으로 분류합니다:
 * - file_read, glob_search, grep_search 등 읽기 전용 도구 → 병렬 가능
 * - 같은 파일을 대상으로 하는 file_write/file_edit → 순차 실행
 * - bash_exec → 독립 실행
 * - LSP 도구 → 서버별 순차 그룹
 *
 * @module tools/pipeline/scheduler
 */

import { type ExtractedToolCall } from "../types.js";

/**
 * 도구 호출 그룹 — 동시에 실행할 수 있는 호출의 묶음
 */
export interface ToolCallGroup {
  /** 이 그룹에 포함된 도구 호출 목록 */
  readonly calls: readonly ExtractedToolCall[];
  /** 이 그룹의 실행 방식 */
  readonly mode: "parallel" | "sequential";
  /** 그룹핑 사유 (디버깅/로깅용) */
  readonly reason: string;
}

/**
 * 스케줄링 결과 — 그룹 목록과 전체 실행 방식
 */
export interface ScheduleResult {
  /** 실행 그룹 목록 (그룹 간은 순차, 그룹 내는 mode에 따라) */
  readonly groups: readonly ToolCallGroup[];
  /** 전체 실행 방식 요약 */
  readonly order: "parallel" | "sequential" | "mixed";
}

/** 항상 병렬 실행 가능한 읽기 전용 도구 */
const ALWAYS_PARALLEL_TOOLS = new Set([
  "file_read",
  "glob_search",
  "grep_search",
  "list_dir",
  "symbol_search",
  "code_outline",
  "find_dependencies",
  "web_search",
  "web_fetch",
]);

/** 파일 쓰기 도구 — 같은 파일 대상이면 순차 실행 필요 */
const FILE_WRITE_TOOLS = new Set(["file_write", "file_edit"]);

/** LSP 도구 — 서버별 순차 실행 */
const LSP_TOOLS = new Set(["goto_definition", "find_references", "get_type_info", "safe_rename"]);

/**
 * 도구 호출의 인수에서 파일 경로를 추출합니다.
 *
 * @param call - 도구 호출 정보
 * @returns 파일 경로 문자열, 없으면 undefined
 */
function extractFilePath(call: ExtractedToolCall): string | undefined {
  const args = call.arguments as Record<string, unknown>;
  if (typeof args["file_path"] === "string") return args["file_path"];
  if (typeof args["path"] === "string") return args["path"];
  if (typeof args["filePath"] === "string") return args["filePath"];
  return undefined;
}

/**
 * 도구 호출 목록을 실행 그룹으로 분류합니다.
 *
 * 그룹화 규칙:
 * 1. 읽기 전용 도구(file_read 등)는 항상 병렬 그룹에 포함
 * 2. 같은 파일 경로를 대상으로 하는 쓰기 도구는 순차 실행
 * 3. bash_exec는 독립 실행 (다른 도구와 병렬 가능)
 * 4. LSP 도구는 서버별 순차 그룹
 *
 * @param calls - 스케줄링할 도구 호출 목록
 * @returns 스케줄링 결과
 */
export function scheduleCalls(calls: readonly ExtractedToolCall[]): ScheduleResult {
  if (calls.length === 0) {
    return { groups: [], order: "parallel" };
  }

  if (calls.length === 1) {
    return {
      groups: [{ calls, mode: "parallel", reason: "single call" }],
      order: "parallel",
    };
  }

  const groups: ToolCallGroup[] = [];
  let currentParallelCalls: ExtractedToolCall[] = [];
  const pendingWritePaths = new Set<string>();

  /**
   * 현재 병렬 그룹을 완료하고 새 그룹을 시작합니다.
   */
  const flushParallel = (): void => {
    if (currentParallelCalls.length > 0) {
      groups.push({
        calls: [...currentParallelCalls],
        mode: "parallel",
        reason: "parallel-safe tools",
      });
      currentParallelCalls = [];
      pendingWritePaths.clear();
    }
  };

  for (const call of calls) {
    const isReadOnly = ALWAYS_PARALLEL_TOOLS.has(call.name);
    const isFileWrite = FILE_WRITE_TOOLS.has(call.name);
    const isLsp = LSP_TOOLS.has(call.name);
    const filePath = extractFilePath(call);

    if (isReadOnly) {
      // 읽기 전용 도구는 항상 현재 병렬 그룹에 추가
      currentParallelCalls.push(call);
    } else if (isFileWrite && filePath) {
      // 같은 파일 쓰기가 이미 대기 중이면 그룹을 분리
      if (pendingWritePaths.has(filePath)) {
        flushParallel();
      }
      pendingWritePaths.add(filePath);
      currentParallelCalls.push(call);
    } else if (isLsp) {
      // LSP 도구는 순차 그룹으로 분리
      flushParallel();
      groups.push({
        calls: [call],
        mode: "sequential",
        reason: `LSP tool: ${call.name}`,
      });
    } else {
      // bash_exec 등 기타 도구 — 현재 그룹에 추가
      currentParallelCalls.push(call);
    }
  }

  // 남은 병렬 호출 플러시
  flushParallel();

  // 전체 실행 방식 결정
  const order: ScheduleResult["order"] =
    groups.length <= 1
      ? "parallel"
      : groups.every((g) => g.mode === "parallel")
        ? "mixed"
        : groups.every((g) => g.mode === "sequential")
          ? "sequential"
          : "mixed";

  return { groups, order };
}

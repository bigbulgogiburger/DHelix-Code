/**
 * 도구 호출 유틸리티 — 검증, 그룹화, 파일 경로 추출
 *
 * agent-loop.ts와 런타임 파이프라인 stage에서 공유되는 함수들을 모아놓은 모듈입니다.
 * 순환 의존성을 방지하기 위해 agent-loop에서 분리되었습니다.
 *
 * @module core/tool-call-utils
 */

import { type ExtractedToolCall } from "../tools/types.js";
import { type AppEventEmitter } from "../utils/events.js";

/** 항상 병렬 실행이 안전한 도구들 (읽기 전용, 부수 효과 없음) */
const ALWAYS_PARALLEL_TOOLS = new Set(["glob_search", "grep_search", "file_read"]);

/** 파일에 쓰는 도구들 — 같은 파일 경로에 대한 충돌 감지가 필요함 */
export const FILE_WRITE_TOOLS = new Set(["file_write", "file_edit"]);

/**
 * 도구 호출의 인자에서 파일 경로를 추출합니다.
 * 다양한 파라미터명(file_path, path, filePath)을 시도합니다.
 *
 * @param call - 도구 호출 정보
 * @returns 파일 경로 문자열, 없으면 undefined
 */
export function extractFilePath(call: ExtractedToolCall): string | undefined {
  const args = call.arguments as Record<string, unknown>;
  // Common parameter names for file paths
  if (typeof args["file_path"] === "string") return args["file_path"];
  if (typeof args["path"] === "string") return args["path"];
  if (typeof args["filePath"] === "string") return args["filePath"];
  return undefined;
}

/**
 * 도구 호출의 인자가 올바르게 구성되었는지 검증합니다.
 *
 * 스트리밍 모드에서는 도구 호출 인자가 JSON 청크 단위로 점진적으로 조립됩니다.
 * 스트림이 중간에 끊기면 인자가 불완전한 JSON이 될 수 있습니다.
 * 이 함수는 인자가 유효한 객체인지 확인하여 실행 가능 여부를 판단합니다.
 *
 * @param call - 검증할 도구 호출
 * @returns true면 실행 가능, false면 무효한 호출
 */
function isValidToolCall(call: ExtractedToolCall): boolean {
  // Tool calls with no required parameters are always valid
  // (the arguments object may legitimately be empty)
  const args = call.arguments;
  if (args === null || args === undefined) return false;
  if (typeof args !== "object") return false;

  // Re-serialize to verify round-trip integrity
  try {
    JSON.stringify(args);
    return true;
  } catch {
    return false;
  }
}

/**
 * 유효하지 않은/불완전한 인자를 가진 도구 호출을 필터링합니다.
 * 제거된 도구 호출에 대해 경고 이벤트를 발생시켜 사용자에게 알립니다.
 *
 * @param calls - 필터링할 도구 호출 목록
 * @param events - 경고 이벤트를 발생시킬 이벤트 이미터
 * @returns 유효한 도구 호출만 포함된 배열
 */
export function filterValidToolCalls(
  calls: readonly ExtractedToolCall[],
  events: AppEventEmitter,
): readonly ExtractedToolCall[] {
  const valid: ExtractedToolCall[] = [];

  for (const call of calls) {
    if (isValidToolCall(call)) {
      valid.push(call);
    } else {
      events.emit("llm:error", {
        error: new Error(
          `Dropped incomplete tool call "${call.name}" (id: ${call.id}): arguments failed validation`,
        ),
      });
    }
  }

  return valid;
}

/**
 * 도구 호출을 병렬 실행 그룹으로 분류합니다.
 *
 * 규칙:
 * 1. file_read, glob_search, grep_search는 항상 병렬 실행 가능 (읽기 전용)
 * 2. 같은 파일 경로를 대상으로 하는 file_write/file_edit는 순차 실행 필수
 * 3. bash_exec 호출은 서로 독립적이므로 병렬 실행 가능
 * 4. 의존성이 불명확하면 안전을 위해 같은 그룹에 포함
 *
 * 반환값: 그룹 내 호출은 동시(병렬) 실행, 그룹 간은 순차 실행
 *
 * @param toolCalls - 그룹화할 도구 호출 배열
 * @returns 도구 호출의 2차원 배열 (각 내부 배열 = 병렬 실행 그룹)
 */
export function groupToolCalls(toolCalls: readonly ExtractedToolCall[]): ExtractedToolCall[][] {
  if (toolCalls.length <= 1) {
    return toolCalls.length === 0 ? [] : [[...toolCalls]];
  }

  const groups: ExtractedToolCall[][] = [];
  // Track which file paths have pending writes in the current group
  let currentGroup: ExtractedToolCall[] = [];
  let currentGroupWritePaths = new Set<string>();

  for (const call of toolCalls) {
    const isAlwaysParallel = ALWAYS_PARALLEL_TOOLS.has(call.name);
    const isFileWrite = FILE_WRITE_TOOLS.has(call.name);
    const isBash = call.name === "bash_exec";
    const filePath = extractFilePath(call);

    if (isAlwaysParallel) {
      // Read-only tools can always go into the current group
      currentGroup.push(call);
    } else if (isFileWrite && filePath) {
      // File writes conflict if they target the same path
      if (currentGroupWritePaths.has(filePath)) {
        // Conflict: flush current group, start new one
        groups.push(currentGroup);
        currentGroup = [call];
        currentGroupWritePaths = new Set([filePath]);
      } else {
        currentGroup.push(call);
        currentGroupWritePaths.add(filePath);
      }
    } else if (isBash) {
      // bash_exec calls are parallelizable with each other
      currentGroup.push(call);
    } else {
      // Unknown tool: can go parallel but not with file writes to same path
      // Since we can't determine dependencies, add to current group
      // (safe because unknown tools are independent of each other)
      currentGroup.push(call);
    }
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}

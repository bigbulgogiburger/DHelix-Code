/**
 * 파일 편집 도구 — 파일 내 특정 문자열을 찾아 교체하는 도구
 *
 * 전체 파일을 덮어쓰는 file_write와 달리,
 * 정확한 문자열 매칭으로 특정 부분만 안전하게 수정합니다.
 *
 * 안전 장치:
 * - old_string이 파일 내에서 고유해야 합니다 (여러 곳에 존재하면 에러)
 * - replace_all: true를 설정하면 모든 발생 위치를 한 번에 교체 가능
 * - 항상 먼저 file_read로 파일 내용을 확인한 후 사용해야 합니다
 *
 * 편집 후 변경된 위치 주변의 컨텍스트 라인(+-3줄)도 metadata에 포함하여
 * UI에서 diff 미리보기를 보여줄 수 있습니다.
 *
 * 권한 수준: "confirm" — 파일을 변경하므로 사용자 확인이 필요합니다.
 */
import { z } from "zod";
import { readFile, writeFile } from "node:fs/promises";
import { type ToolDefinition, type ToolContext, type ToolResult } from "../types.js";
import { resolvePath, normalizePath } from "../../utils/path.js";

/**
 * 매개변수 스키마 — 편집 대상 파일, 검색 문자열, 교체 문자열을 정의
 */
const paramSchema = z.object({
  /** 편집할 파일 경로 */
  path: z.string().describe("File path to edit"),
  /** 찾을 문자열 — 공백과 들여쓰기를 포함하여 정확히 일치해야 함 */
  old_string: z.string().describe("Exact string to find and replace (must be unique in the file)"),
  /** 교체할 문자열 — old_string을 이 문자열로 바꿈 */
  new_string: z.string().describe("Replacement string"),
  /** 모든 발생 위치를 교체할지 여부 (기본값: false — 고유 문자열만 교체) */
  replace_all: z.boolean().default(false).describe("Replace all occurrences"),
});

type Params = z.infer<typeof paramSchema>;

/**
 * 파일 편집 실행 함수
 *
 * 실행 흐름:
 * 1. 파일을 읽어 전체 내용을 메모리에 로드
 * 2. old_string이 파일에 존재하는지 확인 (없으면 에러)
 * 3. replace_all이 false인 경우, old_string이 파일에서 고유한지 확인 (2개 이상이면 에러)
 * 4. 문자열 교체 수행
 * 5. 변경된 내용을 파일에 쓰기
 * 6. 변경 위치 주변 +-3줄의 컨텍스트를 metadata에 포함
 *
 * @param params - 검증된 매개변수
 * @param context - 실행 컨텍스트
 * @returns 편집 결과 (줄 번호, 추가/삭제 줄 수, 컨텍스트 포함)
 */
async function execute(params: Params, context: ToolContext): Promise<ToolResult> {
  const filePath = resolvePath(context.workingDirectory, params.path);

  try {
    const content = await readFile(filePath, "utf-8");

    // old_string이 파일에 존재하는지 확인
    const firstIdx = content.indexOf(params.old_string);
    if (firstIdx === -1) {
      return {
        output: `String not found in ${normalizePath(params.path)}. Make sure the old_string matches exactly (including whitespace and indentation).`,
        isError: true,
      };
    }

    // replace_all이 false이면 고유성 확인 — 2개 이상 존재하면 에러
    if (!params.replace_all) {
      const secondIdx = content.indexOf(params.old_string, firstIdx + 1);
      if (secondIdx !== -1) {
        // 총 발생 횟수를 세어 에러 메시지에 포함
        let occurrences = 2;
        let searchFrom = secondIdx + 1;
        while ((searchFrom = content.indexOf(params.old_string, searchFrom)) !== -1) {
          occurrences++;
          searchFrom++;
        }
        return {
          output: `Found ${occurrences} occurrences of old_string in ${normalizePath(params.path)}. Provide more context to make it unique, or set replace_all to true.`,
          isError: true,
        };
      }
    }

    // 변경 통계 계산 — UI에서 diff 정보를 보여줄 때 사용
    // 줄 번호: 첫 번째 발생 위치 앞의 줄바꿈 개수 + 1
    const lineNumber = content.slice(0, firstIdx).split("\n").length;
    const oldLines = params.old_string.split("\n").length;
    const newLines = params.new_string.split("\n").length;
    const linesRemoved = oldLines;
    const linesAdded = newLines;

    // 문자열 교체 수행
    // replace_all: split→join 방식으로 모든 발생 위치 교체
    // 단일 교체: String.replace()는 첫 번째 일치만 교체
    const updated = params.replace_all
      ? content.split(params.old_string).join(params.new_string)
      : content.replace(params.old_string, params.new_string);

    await writeFile(filePath, updated, "utf-8");

    // 변경 위치 주변 +-3줄의 컨텍스트 추출 — diff 미리보기용
    const updatedLines = updated.split("\n");
    const contextBefore = 3; // 변경 위치 앞 3줄
    const contextAfter = 3; // 변경 위치 뒤 3줄
    const startLine = Math.max(0, lineNumber - 1 - contextBefore); // 0-based 인덱스
    const endLine = Math.min(updatedLines.length, lineNumber - 1 + linesAdded + contextAfter);
    const contextLines = updatedLines.slice(startLine, endLine);

    return {
      output: `Successfully edited ${normalizePath(params.path)}`,
      isError: false,
      metadata: {
        path: normalizePath(filePath),
        lineNumber, // 변경이 시작된 줄 번호 (1-based)
        linesAdded, // 추가된 줄 수
        linesRemoved, // 삭제된 줄 수
        contextLines, // 변경 위치 주변 코드
        contextStartLine: startLine + 1, // 컨텍스트 시작 줄 번호 (1-based)
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { output: `Failed to edit file: ${message}`, isError: true };
  }
}

/**
 * file_edit 도구 정의 — 내보내기하여 도구 레지스트리에 등록
 */
export const fileEditTool: ToolDefinition<Params> = {
  name: "file_edit",
  description:
    "Edit a file by replacing an exact string match. The old_string must be unique in the file unless replace_all is set. Always read the file first to get the exact content.",
  parameterSchema: paramSchema,
  permissionLevel: "confirm",
  timeoutMs: 30_000,
  execute,
};

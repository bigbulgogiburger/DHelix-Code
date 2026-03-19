/**
 * 파일 쓰기 도구 — 지정된 경로에 파일을 생성하거나 덮어쓰는 도구
 *
 * 파일이 이미 존재하면 전체 내용을 덮어씁니다.
 * 부모 디렉토리가 없으면 자동으로 생성합니다 (recursive: true).
 *
 * 주의: 기존 파일을 수정할 때는 file_edit 도구를 사용하는 것이 더 안전합니다.
 * file_write는 전체 파일을 덮어쓰므로, 먼저 file_read로 기존 내용을 확인해야 합니다.
 *
 * 권한 수준: "confirm" — 파일 시스템을 변경하므로 사용자 확인이 필요합니다.
 */
import { z } from "zod";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { type ToolDefinition, type ToolContext, type ToolResult } from "../types.js";
import { resolvePath, normalizePath } from "../../utils/path.js";
import { buildImportHint } from "../import-hint.js";

/**
 * 매개변수 스키마 — 파일 경로와 쓸 내용을 정의
 */
const paramSchema = z.object({
  /** 파일 경로 — 절대 경로 또는 작업 디렉토리 기준 상대 경로 */
  path: z.string().describe("File path to write to"),
  /** 파일에 쓸 내용 — 전체 파일 내용을 이 문자열로 대체 */
  content: z.string().describe("Content to write to the file"),
});

type Params = z.infer<typeof paramSchema>;

/**
 * 파일 쓰기 실행 함수
 *
 * @param params - 검증된 매개변수 (경로, 내용)
 * @param context - 실행 컨텍스트 (작업 디렉토리 등)
 * @returns 쓰기 결과 (성공 시 줄 수 포함, 실패 시 에러 메시지)
 */
async function execute(params: Params, context: ToolContext): Promise<ToolResult> {
  // 상대 경로를 절대 경로로 변환 (작업 디렉토리 기준)
  const filePath = resolvePath(context.workingDirectory, params.path);

  try {
    // 부모 디렉토리가 없으면 자동 생성 (recursive: true → 중간 디렉토리도 모두 생성)
    await mkdir(dirname(filePath), { recursive: true });
    // 파일 쓰기 — UTF-8 인코딩으로 저장
    await writeFile(filePath, params.content, "utf-8");

    // 줄 수 계산하여 사용자에게 피드백 제공
    const lineCount = params.content.split("\n").length;
    // Import hint — 수정된 파일을 import하는 다른 파일 목록 제공
    const hint = await buildImportHint(filePath, context.workingDirectory);
    return {
      output: `Successfully wrote ${lineCount} lines to ${normalizePath(params.path)}${hint}`,
      isError: false,
      metadata: { path: normalizePath(filePath), lineCount },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { output: `Failed to write file: ${message}`, isError: true };
  }
}

/**
 * file_write 도구 정의 — 내보내기하여 도구 레지스트리에 등록
 */
export const fileWriteTool: ToolDefinition<Params> = {
  name: "file_write",
  description:
    "Create or overwrite a file with the given content. Creates parent directories if needed. You should read the file first if it already exists.",
  parameterSchema: paramSchema,
  /** "confirm" — 파일 시스템 변경이므로 사용자 확인 필요 */
  permissionLevel: "confirm",
  /** 30초 타임아웃 */
  timeoutMs: 30_000,
  execute,
};

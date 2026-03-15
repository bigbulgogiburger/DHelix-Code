/**
 * 디렉토리 생성 도구 — 지정된 경로에 디렉토리를 생성하는 도구
 *
 * recursive: true 옵션으로 중간 디렉토리도 자동으로 생성합니다.
 * 예: "/a/b/c/d" 경로에서 /a/b가 없으면 /a/b, /a/b/c, /a/b/c/d를 모두 생성합니다.
 *
 * 이미 존재하는 디렉토리를 다시 생성해도 에러가 발생하지 않습니다.
 *
 * 권한 수준: "confirm" — 파일 시스템을 변경하므로 사용자 확인이 필요합니다.
 */
import { z } from "zod";
import { mkdir } from "node:fs/promises";
import { type ToolDefinition, type ToolContext, type ToolResult } from "../types.js";
import { resolvePath, normalizePath } from "../../utils/path.js";

/**
 * 매개변수 스키마 — 생성할 디렉토리 경로를 정의
 */
const paramSchema = z.object({
  /** 생성할 디렉토리의 절대 경로 */
  path: z.string().describe("Absolute path of the directory to create"),
});

type Params = z.infer<typeof paramSchema>;

/**
 * 디렉토리 생성 실행 함수
 *
 * @param params - 검증된 매개변수 (디렉토리 경로)
 * @param context - 실행 컨텍스트 (작업 디렉토리 등)
 * @returns 생성 결과 (성공/실패)
 */
async function execute(params: Params, context: ToolContext): Promise<ToolResult> {
  // 상대 경로를 절대 경로로 변환
  const dirPath = resolvePath(context.workingDirectory, params.path);

  try {
    // recursive: true — 중간 디렉토리가 없으면 자동으로 생성
    await mkdir(dirPath, { recursive: true });

    return {
      output: `Successfully created directory ${normalizePath(params.path)}`,
      isError: false,
      metadata: { path: normalizePath(dirPath) },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { output: `Failed to create directory: ${message}`, isError: true };
  }
}

/**
 * mkdir 도구 정의 — 내보내기하여 도구 레지스트리에 등록
 */
export const mkdirTool: ToolDefinition<Params> = {
  name: "mkdir",
  description: "Create a directory and all necessary parent directories",
  parameterSchema: paramSchema,
  permissionLevel: "confirm",
  timeoutMs: 30_000,
  execute,
};

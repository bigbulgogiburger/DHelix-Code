/**
 * Jupyter Notebook 편집 도구 — .ipynb 파일의 셀을 추가, 교체, 삭제하는 도구
 *
 * Jupyter Notebook은 JSON 형식의 .ipynb 파일로, 코드 셀과 마크다운 셀로 구성됩니다.
 * 이 도구는 노트북의 개별 셀 단위로 편집 작업을 수행합니다.
 *
 * 지원하는 작업:
 * - add: 새 셀을 특정 위치에 삽입 (기본값: 맨 끝에 추가)
 * - replace: 기존 셀을 새 내용으로 교체
 * - delete: 특정 셀을 삭제
 *
 * 편집 후 노트북을 JSON 형식으로 다시 저장합니다.
 *
 * 권한 수준: "confirm" — 파일을 변경하므로 사용자 확인이 필요합니다.
 */
import { z } from "zod";
import { readFile, writeFile } from "node:fs/promises";
import { type ToolDefinition, type ToolContext, type ToolResult } from "../types.js";
import { resolvePath } from "../../utils/path.js";

/**
 * 매개변수 스키마 — 노트북 경로, 작업 종류, 셀 인덱스, 셀 타입, 소스 내용을 정의
 */
const paramSchema = z.object({
  /** 편집할 .ipynb 노트북 파일 경로 */
  path: z.string().describe("Path to the .ipynb notebook file"),
  /** 수행할 작업: "add"(추가), "replace"(교체), "delete"(삭제) */
  action: z.enum(["add", "replace", "delete"]).describe("Action to perform on the notebook cell"),
  /**
   * 셀 인덱스 (0-based, 선택사항):
   * - add: 삽입 위치 (미지정 시 맨 끝에 추가)
   * - replace/delete: 대상 셀 인덱스 (필수)
   */
  cellIndex: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe(
      "Cell index (0-based). For 'add': insertion position (default: end). For 'replace'/'delete': required.",
    ),
  /**
   * 셀 타입 (기본값: "code"):
   * - "code": 실행 가능한 코드 셀
   * - "markdown": 마크다운 텍스트 셀
   */
  cellType: z
    .enum(["code", "markdown"])
    .optional()
    .default("code")
    .describe("Type of cell (default: 'code')"),
  /** 셀 내용 — add와 replace 작업에서 필수 */
  source: z
    .string()
    .optional()
    .describe("Cell source content. Required for 'add' and 'replace' actions."),
});

type Params = z.infer<typeof paramSchema>;

/**
 * Jupyter Notebook의 셀 인터페이스 — .ipynb JSON 구조의 한 셀
 */
interface NotebookCell {
  /** 셀 타입: "code", "markdown", "raw" */
  cell_type: string;
  /**
   * 셀 소스 — 줄별 문자열 배열
   * Jupyter 형식에서 source는 각 줄을 배열 원소로 저장합니다.
   * 마지막 줄을 제외한 모든 줄에 "\n"을 붙입니다.
   */
  source: string[];
  /** 셀 메타데이터 */
  metadata: Record<string, unknown>;
  /** 코드 셀의 출력 (코드 셀에만 존재) */
  outputs?: unknown[];
  /** 실행 카운트 (코드 셀에만 존재, 미실행 시 null) */
  execution_count?: number | null;
}

/**
 * Jupyter Notebook 전체 인터페이스 — .ipynb 파일의 최상위 구조
 */
interface Notebook {
  /** 모든 셀의 배열 */
  cells: NotebookCell[];
  /** 노트북 메타데이터 (커널, 언어 정보 등) */
  metadata: Record<string, unknown>;
  /** Notebook 형식 메이저 버전 (보통 4) */
  nbformat: number;
  /** Notebook 형식 마이너 버전 */
  nbformat_minor: number;
}

/**
 * 새로운 Notebook 셀을 생성
 *
 * 소스 텍스트를 Jupyter 형식에 맞게 줄별 배열로 변환합니다.
 * 코드 셀인 경우 빈 outputs 배열과 null 실행 카운트를 추가합니다.
 *
 * @param cellType - 셀 타입 ("code" 또는 "markdown")
 * @param source - 셀 내용 텍스트
 * @returns Jupyter 형식의 셀 객체
 */
function createCell(cellType: string, source: string): NotebookCell {
  // 소스 텍스트를 줄별 배열로 분할
  // Jupyter 형식: 마지막 줄을 제외한 모든 줄에 "\n"을 붙임
  const sourceLines = source
    .split("\n")
    .map((line, i, arr) => (i < arr.length - 1 ? `${line}\n` : line));

  const cell: NotebookCell = {
    cell_type: cellType,
    source: sourceLines,
    metadata: {},
  };

  // 코드 셀에는 outputs(출력)와 execution_count(실행 횟수) 필드 추가
  if (cellType === "code") {
    cell.outputs = [];
    cell.execution_count = null; // null = 아직 실행하지 않음
  }

  return cell;
}

/**
 * Notebook 편집 실행 함수
 *
 * 실행 흐름:
 * 1. .ipynb 파일을 읽고 JSON으로 파싱
 * 2. cells 배열이 있는지 유효성 확인
 * 3. action에 따라 셀 추가/교체/삭제
 * 4. 수정된 노트북을 JSON으로 직렬화하여 파일에 저장
 *
 * @param params - 검증된 매개변수
 * @param context - 실행 컨텍스트
 * @returns 편집 결과
 */
async function execute(params: Params, context: ToolContext): Promise<ToolResult> {
  const filePath = resolvePath(context.workingDirectory, params.path);

  try {
    const raw = await readFile(filePath, "utf-8");
    const notebook: Notebook = JSON.parse(raw);

    // 유효성 확인 — cells 배열이 없으면 유효한 노트북 파일이 아님
    if (!Array.isArray(notebook.cells)) {
      return {
        output: "Invalid notebook format: missing 'cells' array",
        isError: true,
      };
    }

    const totalCells = notebook.cells.length;

    switch (params.action) {
      // --- 셀 추가 ---
      case "add": {
        if (params.source === undefined) {
          return { output: "'source' is required for 'add' action", isError: true };
        }
        const cell = createCell(params.cellType, params.source);
        // cellIndex 미지정 시 맨 끝에 추가
        const insertAt = params.cellIndex ?? totalCells;

        // 범위 확인 — 0부터 totalCells(맨 끝)까지 허용
        if (insertAt < 0 || insertAt > totalCells) {
          return {
            output: `cellIndex ${insertAt} out of range [0, ${totalCells}]`,
            isError: true,
          };
        }

        // splice로 특정 위치에 삽입 (기존 셀은 뒤로 밀림)
        notebook.cells.splice(insertAt, 0, cell);
        break;
      }

      // --- 셀 교체 ---
      case "replace": {
        if (params.cellIndex === undefined) {
          return { output: "'cellIndex' is required for 'replace' action", isError: true };
        }
        if (params.source === undefined) {
          return { output: "'source' is required for 'replace' action", isError: true };
        }
        // 범위 확인 — 0부터 totalCells-1까지 허용
        if (params.cellIndex < 0 || params.cellIndex >= totalCells) {
          return {
            output: `cellIndex ${params.cellIndex} out of range [0, ${totalCells - 1}]`,
            isError: true,
          };
        }

        const cell = createCell(params.cellType, params.source);
        // 기존 셀을 새 셀로 교체
        notebook.cells[params.cellIndex] = cell;
        break;
      }

      // --- 셀 삭제 ---
      case "delete": {
        if (params.cellIndex === undefined) {
          return { output: "'cellIndex' is required for 'delete' action", isError: true };
        }
        if (params.cellIndex < 0 || params.cellIndex >= totalCells) {
          return {
            output: `cellIndex ${params.cellIndex} out of range [0, ${totalCells - 1}]`,
            isError: true,
          };
        }

        // splice로 해당 인덱스의 셀 1개를 제거
        notebook.cells.splice(params.cellIndex, 1);
        break;
      }
    }

    // 수정된 노트북을 JSON으로 직렬화하여 저장
    // indent: 1 — 읽기 쉬운 형식으로 저장 + 끝에 줄바꿈 추가
    await writeFile(filePath, JSON.stringify(notebook, null, 1) + "\n", "utf-8");

    // 작업별 성공 메시지 생성
    const actionDescriptions: Record<string, string> = {
      add: `Added ${params.cellType} cell at index ${params.cellIndex ?? totalCells}`,
      replace: `Replaced cell at index ${params.cellIndex} with ${params.cellType} cell`,
      delete: `Deleted cell at index ${params.cellIndex}`,
    };

    return {
      output: `${actionDescriptions[params.action]}. Notebook now has ${notebook.cells.length} cells.`,
      isError: false,
      metadata: {
        path: filePath,
        action: params.action,
        cellIndex: params.cellIndex,
        totalCells: notebook.cells.length,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // JSON 파싱 에러와 기타 에러를 구분
    if (message.includes("JSON")) {
      return { output: `Failed to parse notebook: ${message}`, isError: true };
    }
    return { output: `Notebook edit failed: ${message}`, isError: true };
  }
}

/**
 * notebook_edit 도구 정의 — 내보내기하여 도구 레지스트리에 등록
 */
export const notebookEditTool: ToolDefinition<Params> = {
  name: "notebook_edit",
  description:
    "Edit Jupyter notebook (.ipynb) cells. Supports adding, replacing, and deleting cells. The notebook must already exist.",
  parameterSchema: paramSchema,
  permissionLevel: "confirm",
  timeoutMs: 30_000,
  execute,
};

/**
 * 파일 읽기 도구 — 다양한 형식의 파일을 읽어 텍스트로 반환하는 도구
 *
 * 지원하는 파일 형식:
 * - 텍스트 파일: 줄 번호를 붙여서 반환 (offset/limit으로 부분 읽기 가능)
 * - 이미지 (PNG, JPG, GIF, WebP, SVG): Base64로 인코딩하여 반환 + 크기 정보
 * - PDF: 텍스트를 추출하여 반환 (페이지 범위 지정 가능)
 * - Jupyter Notebook (.ipynb): 셀별로 코드와 출력을 포맷팅하여 반환
 *
 * 주요 기능:
 * - 줄 번호 표시: "     1 | const x = 1;" 형식으로 줄 번호를 앞에 붙임
 * - 부분 읽기: offset과 limit으로 특정 범위만 읽기 (대용량 파일 처리)
 * - 자동 잘림: 기본 2000줄 이상은 자동으로 잘라냄 (LLM 컨텍스트 보호)
 * - 긴 줄 잘림: 한 줄이 2000자를 초과하면 잘라냄
 * - 이미지 크기 파싱: PNG, JPEG, GIF, WebP의 헤더에서 가로/세로 크기를 추출
 *
 * 권한 수준: "safe" — 파일 시스템을 읽기만 하므로 안전합니다.
 */
import { z } from "zod";
import { readFile, stat } from "node:fs/promises";
import { basename, extname } from "node:path";
import { type ToolDefinition, type ToolContext, type ToolResult } from "../types.js";
import { normalizePath, resolvePath } from "../../utils/path.js";

/**
 * 지원하는 이미지 확장자 목록
 * Set을 사용하여 O(1) 시간에 확인할 수 있습니다.
 */
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"]);

/**
 * 파일 확장자 → MIME 타입 매핑
 * 이미지를 Base64로 인코딩할 때 올바른 MIME 타입을 지정하는 데 사용합니다.
 */
const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

/** 기본 줄 수 제한 — 이보다 많은 줄은 offset/limit 없이 읽으면 자동으로 잘림 */
const DEFAULT_LINE_LIMIT = 2000;
/** 한 줄의 최대 길이 — 이보다 긴 줄은 잘라냄 (미니파이된 파일 등) */
const MAX_LINE_LENGTH = 2000;
/** PDF 1회 요청 시 최대 페이지 수 */
const MAX_PDF_PAGES_PER_REQUEST = 20;
/** 이 페이지 수 이상의 PDF는 pages 매개변수를 필수로 요구 */
const PDF_PAGES_REQUIRE_PARAM = 10;

/**
 * 파일 확장자로 파일 형식을 판별
 *
 * @param filePath - 파일 경로
 * @returns 파일 형식 ("image" | "pdf" | "jupyter" | "text")
 */
function getFileType(filePath: string): "image" | "pdf" | "jupyter" | "text" {
  const ext = extname(filePath).toLowerCase();
  if (IMAGE_EXTENSIONS.has(ext)) return "image";
  if (ext === ".pdf") return "pdf";
  if (ext === ".ipynb") return "jupyter";
  return "text";
}

/**
 * PNG 파일의 가로/세로 크기를 바이너리 헤더에서 파싱
 *
 * PNG 파일 형식:
 * - 바이트 0-7: PNG 매직 넘버 (0x89, 0x50(P), ...)
 * - 바이트 16-19: 가로 크기 (big-endian 32비트 정수)
 * - 바이트 20-23: 세로 크기 (big-endian 32비트 정수)
 *
 * @param buffer - PNG 파일의 바이너리 데이터
 * @returns 가로/세로 크기, 또는 undefined (파싱 실패 시)
 */
function parsePngDimensions(buffer: Buffer): { width: number; height: number } | undefined {
  if (buffer.length >= 24 && buffer[0] === 0x89 && buffer[1] === 0x50) {
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
    };
  }
  return undefined;
}

/**
 * JPEG 파일의 가로/세로 크기를 바이너리 헤더에서 파싱
 *
 * JPEG 파일 형식:
 * - 바이트 0-1: SOI(Start of Image) 마커 (0xFF, 0xD8)
 * - SOF0(0xFFC0) 또는 SOF2(0xFFC2) 마커를 찾아 크기를 추출
 * - SOF 마커 내에서: offset+5 = 세로, offset+7 = 가로 (big-endian 16비트)
 *
 * @param buffer - JPEG 파일의 바이너리 데이터
 * @returns 가로/세로 크기, 또는 undefined
 */
function parseJpegDimensions(buffer: Buffer): { width: number; height: number } | undefined {
  // SOI 마커 확인
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return undefined;
  let offset = 2;
  // 마커를 순차적으로 스캔하여 SOF0/SOF2를 찾음
  while (offset < buffer.length - 8) {
    if (buffer[offset] !== 0xff) break;
    const marker = buffer[offset + 1];
    // SOF0(0xC0) 또는 SOF2(0xC2): 프레임 시작 마커에 크기 정보가 있음
    if (marker === 0xc0 || marker === 0xc2) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }
    // 다음 마커로 이동 (현재 세그먼트 크기만큼 건너뜀)
    const segLen = buffer.readUInt16BE(offset + 2);
    offset += 2 + segLen;
  }
  return undefined;
}

/**
 * GIF 파일의 가로/세로 크기를 바이너리 헤더에서 파싱
 *
 * GIF 파일 형식:
 * - 바이트 0-2: "GIF" 매직 넘버 (0x47, 0x49, 0x46)
 * - 바이트 6-7: 가로 크기 (little-endian 16비트)
 * - 바이트 8-9: 세로 크기 (little-endian 16비트)
 *
 * @param buffer - GIF 파일의 바이너리 데이터
 * @returns 가로/세로 크기, 또는 undefined
 */
function parseGifDimensions(buffer: Buffer): { width: number; height: number } | undefined {
  if (buffer.length >= 10 && buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    return {
      width: buffer.readUInt16LE(6),
      height: buffer.readUInt16LE(8),
    };
  }
  return undefined;
}

/**
 * WebP 파일의 가로/세로 크기를 바이너리 헤더에서 파싱
 *
 * WebP 파일 형식:
 * - 바이트 0-3: "RIFF" 헤더
 * - 바이트 8-11: "WEBP" 식별자
 * - VP8 (손실 압축): 바이트 26-27 = 가로, 28-29 = 세로 (little-endian, 14비트 마스크)
 * - VP8L (무손실 압축): 바이트 21-24의 비트 필드에서 크기 추출
 *
 * @param buffer - WebP 파일의 바이너리 데이터
 * @returns 가로/세로 크기, 또는 undefined
 */
function parseWebPDimensions(buffer: Buffer): { width: number; height: number } | undefined {
  if (buffer.length < 30) return undefined;
  const riff = buffer.toString("ascii", 0, 4);
  const webp = buffer.toString("ascii", 8, 12);
  if (riff !== "RIFF" || webp !== "WEBP") return undefined;

  const chunkType = buffer.toString("ascii", 12, 16);
  if (chunkType === "VP8 " && buffer.length >= 30) {
    // 손실 압축 VP8: 하위 14비트가 크기 (나머지는 내부 플래그)
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    };
  }
  if (chunkType === "VP8L" && buffer.length >= 25) {
    // 무손실 압축 VP8L: 32비트 값에서 비트 필드로 크기 추출
    const bits = buffer.readUInt32LE(21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }
  return undefined;
}

/**
 * 파일 확장자에 따라 적절한 크기 파싱 함수를 호출
 *
 * @param buffer - 이미지 파일의 바이너리 데이터
 * @param ext - 파일 확장자 (예: ".png")
 * @returns 가로/세로 크기, 또는 undefined
 */
function getImageDimensions(
  buffer: Buffer,
  ext: string,
): { width: number; height: number } | undefined {
  switch (ext) {
    case ".png":
      return parsePngDimensions(buffer);
    case ".jpg":
    case ".jpeg":
      return parseJpegDimensions(buffer);
    case ".gif":
      return parseGifDimensions(buffer);
    case ".webp":
      return parseWebPDimensions(buffer);
    default:
      return undefined;
  }
}

/**
 * 페이지 범위 문자열을 페이지 번호 배열로 파싱
 *
 * 지원 형식:
 * - 단일 페이지: "3" → [3]
 * - 범위: "1-5" → [1, 2, 3, 4, 5]
 * - 혼합: "1-3, 5, 7-9" → [1, 2, 3, 5, 7, 8, 9]
 *
 * @param pages - 페이지 범위 문자열
 * @param totalPages - PDF의 전체 페이지 수 (범위 초과 방지)
 * @returns 페이지 번호 배열
 * @throws {Error} 잘못된 형식이거나 최대 페이지 수를 초과한 경우
 */
function parsePageRange(pages: string, totalPages: number): number[] {
  const parts = pages.split(",").map((s) => s.trim());
  const result: number[] = [];

  for (const part of parts) {
    const rangeParts = part.split("-").map((s) => s.trim());
    if (rangeParts.length === 2) {
      // 범위 형식: "1-5"
      const start = parseInt(rangeParts[0], 10);
      const end = parseInt(rangeParts[1], 10);
      if (isNaN(start) || isNaN(end) || start < 1 || end < start) {
        throw new Error(`Invalid page range: "${part}"`);
      }
      for (let i = start; i <= Math.min(end, totalPages); i++) {
        result.push(i);
      }
    } else if (rangeParts.length === 1) {
      // 단일 페이지: "3"
      const page = parseInt(rangeParts[0], 10);
      if (isNaN(page) || page < 1) {
        throw new Error(`Invalid page number: "${part}"`);
      }
      if (page <= totalPages) {
        result.push(page);
      }
    } else {
      throw new Error(`Invalid page range format: "${part}"`);
    }
  }

  // 최대 페이지 수 제한 확인
  if (result.length > MAX_PDF_PAGES_PER_REQUEST) {
    throw new Error(
      `Requested ${result.length} pages exceeds maximum of ${MAX_PDF_PAGES_PER_REQUEST} pages per request`,
    );
  }

  return result;
}

/**
 * 긴 줄을 최대 길이로 잘라냄
 *
 * 미니파이(minify)된 파일이나 긴 데이터 줄이 LLM 컨텍스트를 과도하게 차지하는 것을 방지합니다.
 *
 * @param line - 원본 줄 텍스트
 * @returns 잘라낸 줄 (최대 2000자 + "... (truncated)" 표시)
 */
function truncateLine(line: string): string {
  if (line.length > MAX_LINE_LENGTH) {
    return line.substring(0, MAX_LINE_LENGTH) + "... (truncated)";
  }
  return line;
}

/**
 * 이미지 파일 처리 — 바이너리를 Base64로 인코딩하고 크기 정보를 추출
 *
 * @param filePath - 이미지 파일의 절대 경로
 * @returns 이미지 정보 (Base64 데이터는 metadata에 포함)
 */
async function handleImage(filePath: string): Promise<ToolResult> {
  const buffer = await readFile(filePath);
  // 바이너리 데이터를 Base64 문자열로 인코딩 — LLM 멀티모달 입력에 사용
  const base64Data = buffer.toString("base64");
  const ext = extname(filePath).toLowerCase();
  const mediaType = MIME_TYPES[ext] ?? "application/octet-stream";
  // 파일 헤더에서 이미지 크기를 파싱 (외부 라이브러리 없이 직접 파싱)
  const dimensions = getImageDimensions(buffer, ext);
  const dimStr = dimensions ? `, ${dimensions.width}x${dimensions.height}` : "";

  return {
    output: `[Image: ${basename(filePath)}, ${buffer.length} bytes${dimStr}]`,
    isError: false,
    metadata: {
      type: "image",
      media_type: mediaType,
      data: base64Data,
      path: normalizePath(filePath),
    },
  };
}

/**
 * PDF 파일 처리 — 텍스트를 추출하여 페이지별로 반환
 *
 * pdf-parse 라이브러리를 동적 import로 로드합니다 (사용 시에만 로드하여 시작 시간 절약).
 *
 * @param filePath - PDF 파일의 절대 경로
 * @param pages - 페이지 범위 문자열 (선택사항)
 * @returns 추출된 텍스트 (페이지별 구분)
 */
async function handlePdf(filePath: string, pages?: string): Promise<ToolResult> {
  // 동적 import — PDF 처리가 필요할 때만 라이브러리를 로드
  const { PDFParse } = await import("pdf-parse");
  const buffer = await readFile(filePath);

  const pdf = new PDFParse({ data: new Uint8Array(buffer) });
  const info = await pdf.getInfo();
  const totalPages = info.total;

  // 페이지가 10페이지를 초과하는데 pages 매개변수가 없으면 에러
  // 대용량 PDF 전체를 읽으면 LLM 컨텍스트를 초과할 수 있기 때문
  if (totalPages > PDF_PAGES_REQUIRE_PARAM && !pages) {
    await pdf.destroy();
    return {
      output: `PDF has ${totalPages} pages (exceeds ${PDF_PAGES_REQUIRE_PARAM}). Please specify a page range with the "pages" parameter (e.g., "1-5", "3", "10-20"). Maximum ${MAX_PDF_PAGES_PER_REQUEST} pages per request.`,
      isError: true,
    };
  }

  // 읽을 페이지 번호 배열 결정
  let pageNumbers: number[];
  if (pages) {
    try {
      pageNumbers = parsePageRange(pages, totalPages);
    } catch (error) {
      await pdf.destroy();
      const message = error instanceof Error ? error.message : String(error);
      return { output: `Invalid pages parameter: ${message}`, isError: true };
    }
  } else {
    // pages 미지정 + 10페이지 이하 → 전체 페이지 읽기
    pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  // PDF에서 텍스트 추출
  const textResult = await pdf.getText({ partial: pageNumbers, pageJoiner: "" });
  await pdf.destroy();

  // 페이지별로 구분선과 함께 텍스트 결합
  const output = textResult.pages
    .map((page) => `--- Page ${page.num} ---\n${page.text.trim()}`)
    .join("\n\n");

  return {
    output,
    isError: false,
    metadata: {
      path: normalizePath(filePath),
      totalPages,
      pagesRead: pageNumbers,
    },
  };
}

// --- Jupyter Notebook 관련 타입 정의 ---

/**
 * Jupyter Notebook의 셀(Cell) 인터페이스
 */
interface JupyterCell {
  /** 셀 유형: "code"(코드), "markdown"(마크다운), "raw"(원시 텍스트) */
  cell_type: string;
  /** 셀의 소스 코드/텍스트 — 단일 문자열 또는 줄별 문자열 배열 */
  source: string | string[];
  /** 코드 셀의 실행 출력 (선택사항) */
  outputs?: JupyterOutput[];
}

/**
 * Jupyter Notebook의 출력(Output) 인터페이스
 */
interface JupyterOutput {
  /** 출력 유형: "execute_result", "stream", "display_data" 등 */
  output_type: string;
  /** 텍스트 출력 (stream 타입) */
  text?: string | string[];
  /** 다양한 MIME 타입별 출력 데이터 */
  data?: Record<string, string | string[]>;
}

/**
 * Jupyter Notebook 전체 구조 인터페이스
 */
interface JupyterNotebook {
  /** 셀 배열 */
  cells: JupyterCell[];
  /** 노트북 메타데이터 (커널 정보, 언어 정보 등) */
  metadata?: {
    kernelspec?: {
      language?: string;
    };
    language_info?: {
      name?: string;
    };
  };
}

/**
 * 셀 소스를 단일 문자열로 변환
 *
 * Jupyter에서 source는 단일 문자열이거나 줄별 문자열 배열일 수 있습니다.
 *
 * @param source - 셀 소스 (문자열 또는 배열)
 * @returns 단일 문자열
 */
function getCellSource(source: string | string[]): string {
  return Array.isArray(source) ? source.join("") : source;
}

/**
 * 출력 객체에서 텍스트를 추출
 *
 * 우선순위: text 필드 > data["text/plain"] 필드
 *
 * @param output - Jupyter 출력 객체
 * @returns 추출된 텍스트 (없으면 빈 문자열)
 */
function getOutputText(output: JupyterOutput): string {
  if (output.text) {
    return getCellSource(output.text);
  }
  if (output.data) {
    if (output.data["text/plain"]) {
      return getCellSource(output.data["text/plain"]);
    }
  }
  return "";
}

/**
 * Jupyter Notebook 파일 처리 — 셀별로 코드와 출력을 포맷팅
 *
 * 출력 형식:
 * - 마크다운 셀: 원본 텍스트 그대로
 * - 코드 셀: ```python ... ``` 코드 블록 + 출력(있는 경우)
 * - 셀 사이: "---" 구분선
 *
 * @param filePath - .ipynb 파일의 절대 경로
 * @returns 포맷팅된 노트북 내용
 */
async function handleJupyter(filePath: string): Promise<ToolResult> {
  const content = await readFile(filePath, "utf-8");
  const notebook: JupyterNotebook = JSON.parse(content);

  // 프로그래밍 언어 판별 — 코드 블록의 언어 태그에 사용
  const language =
    notebook.metadata?.kernelspec?.language ?? notebook.metadata?.language_info?.name ?? "python";

  const cellOutputs: string[] = [];

  for (const cell of notebook.cells) {
    const source = getCellSource(cell.source);

    if (cell.cell_type === "markdown") {
      // 마크다운 셀 — 원본 텍스트 그대로 출력
      cellOutputs.push(source);
    } else if (cell.cell_type === "code") {
      // 코드 셀 — 언어 태그가 있는 코드 블록으로 감싸기
      cellOutputs.push(`\`\`\`${language}\n${source}\n\`\`\``);

      // 코드 실행 결과가 있으면 "Output:" 섹션으로 추가
      if (cell.outputs && cell.outputs.length > 0) {
        const outputTexts = cell.outputs.map(getOutputText).filter((t) => t.length > 0);
        if (outputTexts.length > 0) {
          cellOutputs.push("Output:\n" + outputTexts.join("\n"));
        }
      }
    } else {
      // raw 또는 기타 셀 타입 — 원본 텍스트 그대로 출력
      cellOutputs.push(source);
    }
  }

  // 셀 사이를 "---" 구분선으로 연결
  const output = cellOutputs.join("\n---\n");

  return {
    output,
    isError: false,
    metadata: {
      path: normalizePath(filePath),
      cellCount: notebook.cells.length,
      language,
    },
  };
}

/**
 * 매개변수 스키마 — 파일 경로, 오프셋, 제한, PDF 페이지 범위를 정의
 */
const paramSchema = z.object({
  /** 읽을 파일의 절대 또는 상대 경로 */
  path: z.string().describe("Absolute or relative file path to read"),
  /** 시작 줄 번호(0-based, 선택사항) — 이 줄부터 읽기 시작 */
  offset: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("Line number to start reading from (0-based)"),
  /** 최대 읽기 줄 수(선택사항) — 이 줄 수만큼만 읽음 */
  limit: z.number().int().min(1).optional().describe("Maximum number of lines to read"),
  /** PDF 페이지 범위(선택사항) — 예: "1-5", "3", "10-20" */
  pages: z.string().optional().describe("Page range for PDF (e.g. '1-5', '3', '10-20')"),
});

type Params = z.infer<typeof paramSchema>;

/**
 * 파일 읽기 실행 함수 — 파일 형식에 따라 적절한 핸들러를 호출
 *
 * @param params - 검증된 매개변수 (경로, 오프셋, 제한, 페이지)
 * @param context - 실행 컨텍스트 (작업 디렉토리 등)
 * @returns 파일 내용 (형식에 따라 다르게 포맷팅)
 */
async function execute(params: Params, context: ToolContext): Promise<ToolResult> {
  const filePath = resolvePath(context.workingDirectory, params.path);
  const fileType = getFileType(filePath);

  try {
    // 파일 형식별 분기 처리
    if (fileType === "image") {
      return await handleImage(filePath);
    }

    if (fileType === "pdf") {
      return await handlePdf(filePath, params.pages);
    }

    if (fileType === "jupyter") {
      return await handleJupyter(filePath);
    }

    // 텍스트 파일 처리
    const fileStat = await stat(filePath);
    // 빈 파일 처리
    if (fileStat.size === 0) {
      return {
        output: "[Empty file]",
        isError: false,
        metadata: { path: normalizePath(filePath), totalLines: 0 },
      };
    }

    const content = await readFile(filePath, "utf-8");
    const lines = content.split("\n");
    // offset 기본값: 0 (파일 시작), limit 기본값: 파일 전체 또는 2000줄 중 작은 값
    const offset = params.offset ?? 0;
    const limit = params.limit ?? Math.min(lines.length, DEFAULT_LINE_LIMIT);
    // 지정된 범위의 줄만 추출
    const sliced = lines.slice(offset, offset + limit);

    // 줄 번호를 앞에 붙여 포맷팅 — "     1 | const x = 1;" 형식
    // padStart(6)으로 최대 999,999줄까지 깔끔하게 정렬
    const numbered = sliced
      .map((line, i) => `${String(offset + i + 1).padStart(6)} | ${truncateLine(line)}`)
      .join("\n");

    // offset/limit을 지정하지 않았는데 2000줄을 초과하면 잘림 안내 표시
    const truncatedNotice =
      !params.offset && !params.limit && lines.length > DEFAULT_LINE_LIMIT
        ? `\n\n[File truncated: showing ${DEFAULT_LINE_LIMIT} of ${lines.length} lines. Use offset/limit to read more.]`
        : "";

    return {
      output: numbered + truncatedNotice,
      isError: false,
      metadata: {
        path: normalizePath(filePath),
        totalLines: lines.length,   // 전체 줄 수
        readFrom: offset,           // 읽기 시작 줄 (0-based)
        readTo: Math.min(offset + limit, lines.length), // 읽기 끝 줄
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { output: `Failed to read file: ${message}`, isError: true };
  }
}

/**
 * file_read 도구 정의 — 내보내기하여 도구 레지스트리에 등록
 */
export const fileReadTool: ToolDefinition<Params> = {
  name: "file_read",
  description:
    "Read a file's contents with line numbers. Supports offset and limit for partial reads. " +
    "Supports images (PNG, JPG, GIF, WebP, SVG), PDFs (text extraction with page ranges), " +
    "and Jupyter notebooks (.ipynb). Use this before modifying files.",
  parameterSchema: paramSchema,
  permissionLevel: "safe",
  timeoutMs: 30_000,
  execute,
};

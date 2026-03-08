import { z } from "zod";
import { readFile, stat } from "node:fs/promises";
import { basename, extname } from "node:path";
import { type ToolDefinition, type ToolContext, type ToolResult } from "../types.js";
import { normalizePath, resolvePath } from "../../utils/path.js";

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"]);

const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

const DEFAULT_LINE_LIMIT = 2000;
const MAX_LINE_LENGTH = 2000;
const MAX_PDF_PAGES_PER_REQUEST = 20;
const PDF_PAGES_REQUIRE_PARAM = 10;

function getFileType(filePath: string): "image" | "pdf" | "jupyter" | "text" {
  const ext = extname(filePath).toLowerCase();
  if (IMAGE_EXTENSIONS.has(ext)) return "image";
  if (ext === ".pdf") return "pdf";
  if (ext === ".ipynb") return "jupyter";
  return "text";
}

function parsePngDimensions(buffer: Buffer): { width: number; height: number } | undefined {
  // PNG: bytes 16-19 = width, 20-23 = height (big-endian)
  if (buffer.length >= 24 && buffer[0] === 0x89 && buffer[1] === 0x50) {
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
    };
  }
  return undefined;
}

function parseJpegDimensions(buffer: Buffer): { width: number; height: number } | undefined {
  // JPEG: scan for SOF0 (0xFFC0) or SOF2 (0xFFC2) marker
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return undefined;
  let offset = 2;
  while (offset < buffer.length - 8) {
    if (buffer[offset] !== 0xff) break;
    const marker = buffer[offset + 1];
    if (marker === 0xc0 || marker === 0xc2) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }
    const segLen = buffer.readUInt16BE(offset + 2);
    offset += 2 + segLen;
  }
  return undefined;
}

function parseGifDimensions(buffer: Buffer): { width: number; height: number } | undefined {
  // GIF: bytes 6-7 = width, 8-9 = height (little-endian)
  if (buffer.length >= 10 && buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    return {
      width: buffer.readUInt16LE(6),
      height: buffer.readUInt16LE(8),
    };
  }
  return undefined;
}

function parseWebPDimensions(buffer: Buffer): { width: number; height: number } | undefined {
  // WebP: RIFF header, then VP8 chunk
  if (buffer.length < 30) return undefined;
  const riff = buffer.toString("ascii", 0, 4);
  const webp = buffer.toString("ascii", 8, 12);
  if (riff !== "RIFF" || webp !== "WEBP") return undefined;

  const chunkType = buffer.toString("ascii", 12, 16);
  if (chunkType === "VP8 " && buffer.length >= 30) {
    // Lossy VP8: width at 26, height at 28 (little-endian, masked)
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    };
  }
  if (chunkType === "VP8L" && buffer.length >= 25) {
    // Lossless VP8L
    const bits = buffer.readUInt32LE(21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }
  return undefined;
}

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

function parsePageRange(pages: string, totalPages: number): number[] {
  const parts = pages.split(",").map((s) => s.trim());
  const result: number[] = [];

  for (const part of parts) {
    const rangeParts = part.split("-").map((s) => s.trim());
    if (rangeParts.length === 2) {
      const start = parseInt(rangeParts[0], 10);
      const end = parseInt(rangeParts[1], 10);
      if (isNaN(start) || isNaN(end) || start < 1 || end < start) {
        throw new Error(`Invalid page range: "${part}"`);
      }
      for (let i = start; i <= Math.min(end, totalPages); i++) {
        result.push(i);
      }
    } else if (rangeParts.length === 1) {
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

  if (result.length > MAX_PDF_PAGES_PER_REQUEST) {
    throw new Error(
      `Requested ${result.length} pages exceeds maximum of ${MAX_PDF_PAGES_PER_REQUEST} pages per request`,
    );
  }

  return result;
}

function truncateLine(line: string): string {
  if (line.length > MAX_LINE_LENGTH) {
    return line.substring(0, MAX_LINE_LENGTH) + "... (truncated)";
  }
  return line;
}

async function handleImage(filePath: string): Promise<ToolResult> {
  const buffer = await readFile(filePath);
  const base64Data = buffer.toString("base64");
  const ext = extname(filePath).toLowerCase();
  const mediaType = MIME_TYPES[ext] ?? "application/octet-stream";
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

async function handlePdf(filePath: string, pages?: string): Promise<ToolResult> {
  const { PDFParse } = await import("pdf-parse");
  const buffer = await readFile(filePath);

  const pdf = new PDFParse({ data: new Uint8Array(buffer) });
  const info = await pdf.getInfo();
  const totalPages = info.total;

  if (totalPages > PDF_PAGES_REQUIRE_PARAM && !pages) {
    await pdf.destroy();
    return {
      output: `PDF has ${totalPages} pages (exceeds ${PDF_PAGES_REQUIRE_PARAM}). Please specify a page range with the "pages" parameter (e.g., "1-5", "3", "10-20"). Maximum ${MAX_PDF_PAGES_PER_REQUEST} pages per request.`,
      isError: true,
    };
  }

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
    pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const textResult = await pdf.getText({ partial: pageNumbers, pageJoiner: "" });
  await pdf.destroy();

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

interface JupyterCell {
  cell_type: string;
  source: string | string[];
  outputs?: JupyterOutput[];
}

interface JupyterOutput {
  output_type: string;
  text?: string | string[];
  data?: Record<string, string | string[]>;
}

interface JupyterNotebook {
  cells: JupyterCell[];
  metadata?: {
    kernelspec?: {
      language?: string;
    };
    language_info?: {
      name?: string;
    };
  };
}

function getCellSource(source: string | string[]): string {
  return Array.isArray(source) ? source.join("") : source;
}

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

async function handleJupyter(filePath: string): Promise<ToolResult> {
  const content = await readFile(filePath, "utf-8");
  const notebook: JupyterNotebook = JSON.parse(content);

  const language =
    notebook.metadata?.kernelspec?.language ??
    notebook.metadata?.language_info?.name ??
    "python";

  const cellOutputs: string[] = [];

  for (const cell of notebook.cells) {
    const source = getCellSource(cell.source);

    if (cell.cell_type === "markdown") {
      cellOutputs.push(source);
    } else if (cell.cell_type === "code") {
      cellOutputs.push(`\`\`\`${language}\n${source}\n\`\`\``);

      if (cell.outputs && cell.outputs.length > 0) {
        const outputTexts = cell.outputs
          .map(getOutputText)
          .filter((t) => t.length > 0);
        if (outputTexts.length > 0) {
          cellOutputs.push("Output:\n" + outputTexts.join("\n"));
        }
      }
    } else {
      // raw or other cell types
      cellOutputs.push(source);
    }
  }

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

const paramSchema = z.object({
  path: z.string().describe("Absolute or relative file path to read"),
  offset: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("Line number to start reading from (0-based)"),
  limit: z.number().int().min(1).optional().describe("Maximum number of lines to read"),
  pages: z
    .string()
    .optional()
    .describe("Page range for PDF (e.g. '1-5', '3', '10-20')"),
});

type Params = z.infer<typeof paramSchema>;

async function execute(params: Params, context: ToolContext): Promise<ToolResult> {
  const filePath = resolvePath(context.workingDirectory, params.path);
  const fileType = getFileType(filePath);

  try {
    if (fileType === "image") {
      return await handleImage(filePath);
    }

    if (fileType === "pdf") {
      return await handlePdf(filePath, params.pages);
    }

    if (fileType === "jupyter") {
      return await handleJupyter(filePath);
    }

    // Text file handling
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
    const offset = params.offset ?? 0;
    const limit = params.limit ?? Math.min(lines.length, DEFAULT_LINE_LIMIT);
    const sliced = lines.slice(offset, offset + limit);

    const numbered = sliced
      .map((line, i) => `${String(offset + i + 1).padStart(6)} | ${truncateLine(line)}`)
      .join("\n");

    const truncatedNotice =
      !params.offset && !params.limit && lines.length > DEFAULT_LINE_LIMIT
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

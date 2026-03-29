/**
 * 타입 정보 조회 도구 — 심볼의 타입 시그니처와 문서를 조회하는 LSP 기반 도구
 *
 * LSP(Language Server Protocol)를 활용하여 변수, 함수, 매개변수 등의
 * 정확한 타입 정보와 JSDoc/docstring을 반환합니다.
 * 코드를 이해하거나 타입 호환성을 확인할 때 유용합니다.
 *
 * 분석 엔진:
 * 1. 기본: LSP 서버를 통한 hover 정보 조회 (정확도 100%)
 * 2. 폴백: code_outline을 통한 기본 타입 추출 (LSP 미설치 시)
 *
 * 권한 수준: "safe" — 읽기 전용 조회이므로 안전합니다.
 */
import { z } from "zod";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { type ToolDefinition, type ToolContext, type ToolResult } from "../types.js";
import { resolvePath } from "../../utils/path.js";

/**
 * 파일 확장자 → LSP 언어 ID 매핑
 */
const EXT_TO_LANG: Readonly<Record<string, string>> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "typescript",
  ".jsx": "typescript",
  ".py": "python",
  ".go": "go",
  ".rs": "rust",
  ".java": "java",
};

/**
 * 매개변수 스키마 — 타입 정보를 조회할 위치
 */
const paramSchema = z.object({
  /** 심볼이 있는 파일의 절대 경로 */
  file_path: z.string().describe("심볼이 있는 파일의 절대 경로"),
  /** 줄 번호 */
  line: z.number().describe("줄 번호"),
  /** 열 번호 */
  column: z.number().describe("열 번호"),
});

type Params = z.infer<typeof paramSchema>;

/**
 * LSP 세션을 획득하는 헬퍼
 */
async function acquireSession(
  filePath: string,
  cwd: string,
): Promise<
  | {
      getTypeInfo(
        filePath: string,
        line: number,
        column: number,
      ): Promise<{ type: string; documentation?: string; signature?: string } | undefined>;
    }
  | undefined
> {
  try {
    const { LSPManager } = await import("../../lsp/manager.js");
    const ext = extname(filePath);
    const lang = EXT_TO_LANG[ext];
    if (!lang) return undefined;

    const manager = new LSPManager();
    const available = await manager.detectAvailableServers(cwd);
    if (!available.includes(lang as never)) return undefined;

    return await manager.acquire(lang as never, cwd);
  } catch {
    return undefined;
  }
}

/**
 * 파일에서 특정 줄의 심볼 이름을 추출
 */
async function extractSymbolAtPosition(
  filePath: string,
  line: number,
  column: number,
): Promise<string | undefined> {
  try {
    const content = await readFile(filePath, "utf-8");
    const lines = content.split("\n");
    const lineText = lines[line - 1];
    if (!lineText) return undefined;

    const col = column - 1;
    let start = col;
    let end = col;
    while (start > 0 && /\w/.test(lineText[start - 1])) start--;
    while (end < lineText.length && /\w/.test(lineText[end])) end++;

    const word = lineText.slice(start, end);
    return word || undefined;
  } catch {
    return undefined;
  }
}

/**
 * 폴백: 파일에서 해당 줄 주변의 타입 힌트를 추출
 *
 * 정규식으로 타입 어노테이션, JSDoc, 함수 시그니처 등을 감지합니다.
 */
async function fallbackTypeExtraction(
  filePath: string,
  line: number,
  column: number,
): Promise<string> {
  try {
    const content = await readFile(filePath, "utf-8");
    const lines = content.split("\n");
    const lineText = lines[line - 1];
    if (!lineText) return "Could not read line content.";

    const symbolName = await extractSymbolAtPosition(filePath, line, column);

    const parts: string[] = [];
    parts.push(`Position: ${line}:${column}`);
    if (symbolName) parts.push(`Symbol: ${symbolName}`);
    parts.push(`Line content: ${lineText.trim()}`);

    // JSDoc 주석 탐색 (바로 윗줄들)
    const docLines: string[] = [];
    for (let i = line - 2; i >= Math.max(0, line - 20); i--) {
      const l = lines[i].trim();
      if (l.startsWith("*") || l.startsWith("/**") || l.startsWith("*/")) {
        docLines.unshift(l);
        if (l.startsWith("/**")) break;
      } else if (l === "") {
        continue;
      } else {
        break;
      }
    }

    if (docLines.length > 0) {
      parts.push("");
      parts.push("Documentation:");
      parts.push(docLines.join("\n"));
    }

    // TypeScript 타입 어노테이션 추출 시도
    const typeAnnotation = lineText.match(/:\s*([A-Z]\w+(?:<[^>]+>)?(?:\[\])?)/);
    if (typeAnnotation) {
      parts.push("");
      parts.push(`Inferred type annotation: ${typeAnnotation[1]}`);
    }

    parts.push("");
    parts.push("Note: LSP is not available. Type info is approximate (regex-based).");

    return parts.join("\n");
  } catch {
    return "Could not extract type information (file read failed).";
  }
}

/**
 * 프로젝트 루트 기준 상대 경로로 변환
 */
function toRelative(filePath: string, cwd: string): string {
  if (filePath.startsWith(cwd)) {
    const rel = filePath.slice(cwd.length);
    return rel.startsWith("/") ? rel.slice(1) : rel;
  }
  return filePath;
}

/**
 * get_type_info 실행 함수
 *
 * 실행 흐름:
 * 1. LSP 세션 획득 시도
 * 2. LSP로 타입 정보 조회
 * 3. LSP 실패 시 정규식 폴백
 * 4. 결과 포맷팅
 */
async function execute(params: Params, context: ToolContext): Promise<ToolResult> {
  const startTime = Date.now();
  const filePath = resolvePath(context.workingDirectory, params.file_path);

  try {
    const session = await acquireSession(filePath, context.workingDirectory);

    if (session) {
      const info = await session.getTypeInfo(filePath, params.line, params.column);

      if (!info) {
        const elapsed = Date.now() - startTime;
        return {
          output: `No type information available at ${toRelative(filePath, context.workingDirectory)}:${params.line}:${params.column}`,
          isError: false,
          metadata: {
            toolName: "get_type_info",
            duration: `${elapsed}ms`,
            backend: "lsp",
          },
        };
      }

      const lines: string[] = [];
      lines.push(`Type information at ${toRelative(filePath, context.workingDirectory)}:${params.line}:${params.column}\n`);

      if (info.signature) {
        lines.push(`Signature: ${info.signature}`);
      }

      lines.push(`Type: ${info.type}`);

      if (info.documentation) {
        lines.push("");
        lines.push("Documentation:");
        lines.push(info.documentation);
      }

      const elapsed = Date.now() - startTime;
      return {
        output: lines.join("\n"),
        isError: false,
        metadata: {
          toolName: "get_type_info",
          type: info.type,
          duration: `${elapsed}ms`,
          backend: "lsp",
        },
      };
    }

    // LSP 불가 → 정규식 폴백
    const fallbackOutput = await fallbackTypeExtraction(filePath, params.line, params.column);
    const elapsed = Date.now() - startTime;
    return {
      output: fallbackOutput,
      isError: false,
      metadata: {
        toolName: "get_type_info",
        duration: `${elapsed}ms`,
        backend: "regex-fallback",
      },
    };
  } catch (error) {
    const elapsed = Date.now() - startTime;
    const message = error instanceof Error ? error.message : String(error);
    return {
      output: `get_type_info failed: ${message}`,
      isError: true,
      metadata: {
        toolName: "get_type_info",
        duration: `${elapsed}ms`,
      },
    };
  }
}

/**
 * get_type_info 도구 정의
 */
export const getTypeInfoTool: ToolDefinition<Params> = {
  name: "get_type_info",
  description:
    "심볼의 타입 시그니처와 문서를 조회합니다 (LSP 기반). " +
    "변수의 타입, 함수의 매개변수/반환 타입, JSDoc 문서를 반환합니다. " +
    "사용 시점: " +
    "- 변수의 정확한 타입을 확인할 때 " +
    "- 함수 시그니처를 확인할 때 " +
    "- 타입 호환성을 검증할 때 " +
    "code_outline을 사용해야 할 때: " +
    "- 파일 전체의 구조를 파악할 때",
  parameterSchema: paramSchema,
  permissionLevel: "safe",
  timeoutMs: 30_000,
  execute,
};

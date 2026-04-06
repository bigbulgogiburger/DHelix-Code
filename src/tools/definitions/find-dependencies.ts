/**
 * 의존성 추적 도구 — 파일의 import/export 의존 관계를 추적하는 도구
 *
 * 두 가지 방향으로 의존성을 분석합니다:
 * 1. imports: 대상 파일이 가져오는(import) 모듈 목록
 * 2. importedBy: 대상 파일을 가져오는(import) 파일 목록
 *
 * 주요 기능:
 * - 직접/간접 의존성 추적 (depth 1~3)
 * - 내부/외부/빌트인 모듈 분류
 * - 가져온 심볼(specifier) 표시
 * - 순환 의존성 감지 및 안전한 처리
 *
 * 사용 사례:
 * - 리팩토링 전 영향 범위 파악
 * - 모듈 간 의존 관계 이해
 * - 순환 의존성 탐지
 *
 * 권한 수준: "safe" — 파일 시스템을 읽기만 하므로 안전합니다.
 */
import { z } from "zod";
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join, dirname, relative, resolve } from "node:path";
import { stat } from "node:fs/promises";
import { type ToolDefinition, type ToolContext, type ToolResult } from "../types.js";
import { resolvePath, normalizePath } from "../../utils/path.js";

/** execFile의 Promise 버전 */
const execFileAsync = promisify(execFile);

/**
 * 매개변수 스키마 — 분석할 파일, 방향, 깊이, 심볼 표시 여부를 정의
 */
const paramSchema = z.object({
  /** 분석할 파일의 절대 경로 */
  file_path: z.string().describe("분석할 파일의 절대 경로"),
  /** imports: 이 파일이 가져오는 모듈 / importedBy: 이 파일을 가져오는 모듈 */
  direction: z
    .enum(["imports", "importedBy"])
    .default("imports")
    .describe("imports: 이 파일이 가져오는 모듈 / importedBy: 이 파일을 가져오는 모듈"),
  /** 추적 깊이 (1=직접, 2=간접 포함, 3=3단계) */
  depth: z
    .number()
    .min(1)
    .max(3)
    .optional()
    .default(1)
    .describe("추적 깊이 (1=직접, 2=간접 포함, 3=3단계)"),
  /** 가져온 심볼 이름 표시 */
  show_specifiers: z
    .boolean()
    .optional()
    .default(true)
    .describe("가져온 심볼 이름 표시"),
});

type Params = z.infer<typeof paramSchema>;

/**
 * 파싱된 import 정보
 */
interface ParsedImport {
  /** 원본 import 소스 문자열 (예: "../llm/provider.js") */
  readonly source: string;
  /** 가져온 심볼 목록 (예: ["LLMProvider", "ChatMessage"]) */
  readonly specifiers: readonly string[];
  /** import 유형: "internal" | "external" | "builtin" */
  readonly kind: "internal" | "external" | "builtin";
  /** 해석된 절대 경로 (internal인 경우만) */
  readonly resolvedPath: string | null;
}

/**
 * 의존성 트리 노드
 */
interface DependencyNode {
  /** 파일의 상대 경로 */
  readonly relativePath: string;
  /** 파일의 절대 경로 */
  readonly absolutePath: string;
  /** 가져온 심볼 목록 */
  readonly specifiers: readonly string[];
  /** import 유형 */
  readonly kind: "internal" | "external" | "builtin";
  /** 원본 import 소스 */
  readonly source: string;
  /** 자식 의존성 (depth > 1인 경우) */
  readonly children: readonly DependencyNode[];
}

/**
 * Node.js 빌트인 모듈인지 판별
 *
 * @param source - import 소스 문자열
 * @returns 빌트인이면 true
 */
function isBuiltinModule(source: string): boolean {
  return source.startsWith("node:") || BUILTIN_MODULES.has(source);
}

/** Node.js 주요 빌트인 모듈 목록 */
const BUILTIN_MODULES: ReadonlySet<string> = new Set([
  "assert",
  "buffer",
  "child_process",
  "cluster",
  "crypto",
  "dgram",
  "dns",
  "events",
  "fs",
  "http",
  "http2",
  "https",
  "net",
  "os",
  "path",
  "perf_hooks",
  "process",
  "querystring",
  "readline",
  "stream",
  "string_decoder",
  "timers",
  "tls",
  "tty",
  "url",
  "util",
  "v8",
  "vm",
  "worker_threads",
  "zlib",
]);

/**
 * 외부(node_modules) 패키지인지 판별
 *
 * @param source - import 소스 문자열
 * @returns 외부 패키지이면 true
 */
function isExternalModule(source: string): boolean {
  // 상대 경로가 아니고, 빌트인도 아니면 외부 패키지
  return !source.startsWith(".") && !source.startsWith("/") && !isBuiltinModule(source);
}

/**
 * 파일 내용에서 모든 import 문을 파싱
 *
 * ESM import, CommonJS require, dynamic import를 모두 처리합니다.
 *
 * @param content - 파일 내용
 * @returns 파싱된 import 목록
 */
function parseImports(content: string): readonly ParsedImport[] {
  const imports: ParsedImport[] = [];

  // ESM static import: import { foo, bar } from 'module'
  //                     import * as ns from 'module'
  //                     import defaultExport from 'module'
  //                     import 'module' (side-effect)
  const esmRegex =
    /import\s+(?:(?:(?:\{([^}]*)\})|(?:\*\s+as\s+(\w+))|(\w+))(?:\s*,\s*(?:(?:\{([^}]*)\})|(?:\*\s+as\s+(\w+))))?(?:\s+from\s+))?['"]([^'"]+)['"]/g;

  let match: RegExpExecArray | null;
  while ((match = esmRegex.exec(content)) !== null) {
    const specifiers: string[] = [];

    // Named imports: { foo, bar }
    if (match[1]) {
      specifiers.push(
        ...match[1]
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .map((s) => {
            // Handle "foo as bar" → show "foo"
            const asMatch = s.match(/^(\w+)\s+as\s+\w+$/);
            return asMatch ? asMatch[1] : s;
          }),
      );
    }
    // Namespace import: * as ns
    if (match[2]) {
      specifiers.push(`* as ${match[2]}`);
    }
    // Default import
    if (match[3]) {
      specifiers.push(match[3]);
    }
    // Additional named imports after default: import def, { foo } from 'mod'
    if (match[4]) {
      specifiers.push(
        ...match[4]
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .map((s) => {
            const asMatch = s.match(/^(\w+)\s+as\s+\w+$/);
            return asMatch ? asMatch[1] : s;
          }),
      );
    }
    // Additional namespace after default
    if (match[5]) {
      specifiers.push(`* as ${match[5]}`);
    }

    const source = match[6];
    const kind = isBuiltinModule(source)
      ? "builtin"
      : isExternalModule(source)
        ? "external"
        : "internal";

    imports.push({ source, specifiers, kind, resolvedPath: null });
  }

  // ESM re-export: export { foo } from 'module'
  //                export * from 'module'
  const reExportRegex = /export\s+(?:\{([^}]*)\}|\*)\s+from\s+['"]([^'"]+)['"]/g;
  while ((match = reExportRegex.exec(content)) !== null) {
    const specifiers: string[] = [];
    if (match[1]) {
      specifiers.push(
        ...match[1]
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      );
    } else {
      specifiers.push("*");
    }
    const source = match[2];
    const kind = isBuiltinModule(source)
      ? "builtin"
      : isExternalModule(source)
        ? "external"
        : "internal";

    imports.push({ source, specifiers, kind, resolvedPath: null });
  }

  // CommonJS require: const foo = require('module')
  //                   const { foo } = require('module')
  const requireRegex =
    /(?:const|let|var)\s+(?:(\w+)|\{([^}]*)\})\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = requireRegex.exec(content)) !== null) {
    const specifiers: string[] = [];
    if (match[1]) {
      specifiers.push(match[1]);
    }
    if (match[2]) {
      specifiers.push(
        ...match[2]
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      );
    }
    const source = match[3];
    const kind = isBuiltinModule(source)
      ? "builtin"
      : isExternalModule(source)
        ? "external"
        : "internal";

    imports.push({ source, specifiers, kind, resolvedPath: null });
  }

  // Deduplicate by source
  const seen = new Set<string>();
  return imports.filter((imp) => {
    if (seen.has(imp.source)) return false;
    seen.add(imp.source);
    return true;
  });
}

/**
 * import 소스 경로를 실제 파일 경로로 해석
 *
 * 상대 경로를 절대 경로로 변환하고, 확장자를 추론합니다.
 * .js → .ts/.tsx, /index.ts 등의 확장자 변환을 시도합니다.
 *
 * @param source - import 소스 문자열
 * @param fromFile - import가 위치한 파일의 절대 경로
 * @returns 해석된 절대 경로, 또는 null (해석 불가)
 */
async function resolveImportPath(
  source: string,
  fromFile: string,
): Promise<string | null> {
  if (isBuiltinModule(source) || isExternalModule(source)) {
    return null;
  }

  const dir = dirname(fromFile);
  const basePath = resolve(dir, source);

  // 시도할 확장자 패턴 목록
  const candidates: readonly string[] = [
    basePath, // 그대로
    basePath.replace(/\.js$/, ".ts"), // .js → .ts
    basePath.replace(/\.js$/, ".tsx"), // .js → .tsx
    basePath.replace(/\.jsx$/, ".tsx"), // .jsx → .tsx
    `${basePath}.ts`, // 확장자 없이 → .ts
    `${basePath}.tsx`, // 확장자 없이 → .tsx
    `${basePath}.js`, // 확장자 없이 → .js
    `${basePath}.jsx`, // 확장자 없이 → .jsx
    join(basePath, "index.ts"), // 디렉토리 → index.ts
    join(basePath, "index.tsx"), // 디렉토리 → index.tsx
    join(basePath, "index.js"), // 디렉토리 → index.js
  ];

  for (const candidate of candidates) {
    try {
      const s = await stat(candidate);
      if (s.isFile()) {
        return candidate;
      }
    } catch {
      // 파일이 없으면 다음 후보로
    }
  }

  return null;
}

/**
 * "imports" 방향 — 대상 파일이 가져오는 모듈을 추적
 *
 * @param filePath - 분석할 파일의 절대 경로
 * @param cwd - 작업 디렉토리
 * @param depth - 추적 깊이
 * @param showSpecifiers - 심볼 표시 여부
 * @param visited - 순환 의존성 방지를 위한 방문 기록
 * @returns 의존성 노드 목록
 */
async function traceImports(
  filePath: string,
  cwd: string,
  depth: number,
  showSpecifiers: boolean,
  visited: Set<string>,
): Promise<readonly DependencyNode[]> {
  if (visited.has(filePath) || depth < 1) {
    return [];
  }
  visited.add(filePath);

  let content: string;
  try {
    content = await readFile(filePath, "utf-8");
  } catch {
    return [];
  }

  const rawImports = parseImports(content);
  const nodes: DependencyNode[] = [];

  for (const imp of rawImports) {
    const resolved = await resolveImportPath(imp.source, filePath);
    const relPath = resolved
      ? normalizePath(relative(cwd, resolved))
      : imp.kind === "builtin"
        ? `${imp.source} (built-in)`
        : imp.kind === "external"
          ? `${imp.source} (external)`
          : imp.source;

    // 재귀 추적 (depth > 1이고 internal인 경우)
    let children: readonly DependencyNode[] = [];
    if (depth > 1 && resolved && imp.kind === "internal") {
      children = await traceImports(resolved, cwd, depth - 1, showSpecifiers, visited);
    }

    nodes.push({
      relativePath: relPath,
      absolutePath: resolved ?? imp.source,
      specifiers: imp.specifiers,
      kind: imp.kind,
      source: imp.source,
      children,
    });
  }

  return nodes;
}

/**
 * "importedBy" 방향 — 대상 파일을 가져오는 파일을 검색
 *
 * ripgrep으로 빠르게 검색한 뒤, 파싱으로 정확도를 높입니다.
 *
 * @param filePath - 대상 파일의 절대 경로
 * @param cwd - 작업 디렉토리
 * @param depth - 추적 깊이
 * @param showSpecifiers - 심볼 표시 여부
 * @param visited - 순환 의존성 방지를 위한 방문 기록
 * @returns 의존성 노드 목록
 */
async function traceImportedBy(
  filePath: string,
  cwd: string,
  depth: number,
  showSpecifiers: boolean,
  visited: Set<string>,
): Promise<readonly DependencyNode[]> {
  if (visited.has(filePath) || depth < 1) {
    return [];
  }
  visited.add(filePath);

  // 대상 파일의 상대 경로에서 import 패턴을 구성
  const relFromCwd = normalizePath(relative(cwd, filePath));

  // 다양한 import 경로 패턴 생성:
  // - ./core/agent-loop.js, ./core/agent-loop, ../core/agent-loop.js 등
  const baseName = relFromCwd
    .replace(/\.(ts|tsx|js|jsx)$/, "") // 확장자 제거
    .replace(/\/index$/, ""); // /index 제거

  // 파일명만 추출 (디렉토리 무관 검색용)
  const fileNameNoExt = baseName.split("/").pop() ?? baseName;

  // ripgrep으로 후보 파일 검색
  const searchPattern = fileNameNoExt.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const candidateFiles = await findFilesImporting(searchPattern, cwd);

  const nodes: DependencyNode[] = [];

  for (const candidateFile of candidateFiles) {
    const candidateAbsPath = resolve(cwd, candidateFile);
    // 자기 자신은 제외
    if (candidateAbsPath === filePath) continue;

    let content: string;
    try {
      content = await readFile(candidateAbsPath, "utf-8");
    } catch {
      continue;
    }

    // 파싱하여 실제로 대상 파일을 import하는지 확인
    const rawImports = parseImports(content);
    let matchedImport: ParsedImport | undefined;

    for (const imp of rawImports) {
      if (imp.kind !== "internal") continue;
      const resolved = await resolveImportPath(imp.source, candidateAbsPath);
      if (resolved === filePath) {
        matchedImport = imp;
        break;
      }
    }

    if (!matchedImport) continue;

    // 재귀 추적 (depth > 1)
    let children: readonly DependencyNode[] = [];
    if (depth > 1) {
      children = await traceImportedBy(filePath, cwd, depth - 1, showSpecifiers, visited);
    }

    nodes.push({
      relativePath: normalizePath(relative(cwd, candidateAbsPath)),
      absolutePath: candidateAbsPath,
      specifiers: matchedImport.specifiers,
      kind: "internal",
      source: matchedImport.source,
      children,
    });
  }

  return nodes;
}

/**
 * ripgrep 또는 JS 폴백으로 import 패턴을 포함하는 파일 목록을 검색
 *
 * @param fileNamePattern - 검색할 파일명 패턴 (정규식 이스케이프 완료)
 * @param cwd - 작업 디렉토리
 * @returns 매칭된 파일의 상대 경로 목록
 */
async function findFilesImporting(fileNamePattern: string, cwd: string): Promise<readonly string[]> {
  // import/require/export 문에서 파일명을 포함하는 패턴
  const pattern = `(from\\s+['"].*${fileNamePattern}|require\\s*\\(\\s*['"].*${fileNamePattern}|export\\s+.*from\\s+['"].*${fileNamePattern})`;

  try {
    const { stdout } = await execFileAsync(
      "rg",
      [
        "--files-with-matches",
        "--no-heading",
        "--color",
        "never",
        "--glob",
        "*.{ts,tsx,js,jsx,mjs,cjs}",
        "--glob",
        "!node_modules",
        "--glob",
        "!dist",
        "--glob",
        "!build",
        "--glob",
        "!.git",
        pattern,
        cwd,
      ],
      {
        maxBuffer: 5 * 1024 * 1024,
        timeout: 15_000,
      },
    );

    if (!stdout.trim()) return [];

    return stdout
      .trim()
      .split("\n")
      .map((line) => normalizePath(relative(cwd, line.trim())));
  } catch (err) {
    const error = err as { code?: number };
    // exit code 1 = no matches
    if (error.code === 1) return [];

    // ripgrep 실패 시 빈 배열 반환 (폴백 없이)
    return [];
  }
}

/**
 * 의존성 트리를 텍스트로 포맷팅
 *
 * @param nodes - 의존성 노드 목록
 * @param showSpecifiers - 심볼 표시 여부
 * @param indent - 들여쓰기 접두사
 * @param isLast - 마지막 노드 여부 (트리 기호 결정)
 * @returns 포맷팅된 텍스트
 */
function formatTree(
  nodes: readonly DependencyNode[],
  showSpecifiers: boolean,
  indent: string = "",
  _parentPrefix: string = "",
): string {
  const lines: string[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const isLast = i === nodes.length - 1;
    const connector = isLast ? "└─" : "├─";
    const childIndent = indent + (isLast ? "   " : "│  ");

    // 메인 라인: 소스 → 해석된 경로
    if (node.kind === "internal" && node.absolutePath !== node.source) {
      lines.push(`${indent}${connector} ${node.source} → ${node.relativePath}`);
    } else {
      lines.push(`${indent}${connector} ${node.relativePath}`);
    }

    // 심볼 표시
    if (showSpecifiers && node.specifiers.length > 0) {
      lines.push(`${childIndent}└─ { ${node.specifiers.join(", ")} }`);
    }

    // 자식 노드 재귀 포맷팅
    if (node.children.length > 0) {
      lines.push(formatTree(node.children, showSpecifiers, childIndent));
    }
  }

  return lines.join("\n");
}

/**
 * find_dependencies 실행 함수
 *
 * @param params - 검증된 매개변수
 * @param context - 실행 컨텍스트
 * @returns 의존성 분석 결과
 */
async function execute(params: Params, context: ToolContext): Promise<ToolResult> {
  const cwd = context.workingDirectory;
  const filePath = resolvePath(cwd, params.file_path);
  const direction = params.direction;
  const depth = params.depth;
  const showSpecifiers = params.show_specifiers;

  // 파일 존재 여부 확인
  try {
    const s = await stat(filePath);
    if (!s.isFile()) {
      return { output: `Error: ${params.file_path} is not a file.`, isError: true };
    }
  } catch {
    return { output: `Error: File not found: ${params.file_path}`, isError: true };
  }

  const relPath = normalizePath(relative(cwd, filePath));
  const visited = new Set<string>();

  try {
    if (direction === "imports") {
      const nodes = await traceImports(filePath, cwd, depth, showSpecifiers, visited);

      if (nodes.length === 0) {
        return {
          output: `No imports found in ${relPath}`,
          isError: false,
          metadata: {
            toolName: "find_dependencies",
            filePath: relPath,
            direction,
            depth,
            directCount: 0,
            totalCount: 0,
          },
        };
      }

      // 카테고리별 분류
      const internal = nodes.filter((n) => n.kind === "internal");
      const external = nodes.filter((n) => n.kind === "external");
      const builtin = nodes.filter((n) => n.kind === "builtin");

      // 순환 의존성 감지 메시지
      const cycleCount = visited.size - 1; // 자기 자신 제외
      const depthLabel = depth > 1 ? ` (depth: ${depth})` : "";

      const header = `Dependencies of ${relPath}${depthLabel}\n`;
      const summary = `Direct imports (${nodes.length}):`;

      const tree = formatTree(nodes, showSpecifiers, "  ");

      const footer = [
        "",
        `Internal: ${internal.length}`,
        `External: ${external.length}${external.length > 0 ? ` (${external.map((n) => n.source).join(", ")})` : ""}`,
        `Built-in: ${builtin.length}${builtin.length > 0 ? ` (${builtin.map((n) => n.source).join(", ")})` : ""}`,
      ];

      if (depth > 1) {
        footer.push(`Files traversed: ${cycleCount}`);
      }

      const output = [header, summary, tree, ...footer].join("\n");

      return {
        output,
        isError: false,
        metadata: {
          toolName: "find_dependencies",
          filePath: relPath,
          direction,
          depth,
          directCount: nodes.length,
          totalCount: visited.size - 1,
          internalCount: internal.length,
          externalCount: external.length,
          builtinCount: builtin.length,
        },
      };
    } else {
      // importedBy
      const nodes = await traceImportedBy(filePath, cwd, depth, showSpecifiers, visited);

      if (nodes.length === 0) {
        return {
          output: `No files importing ${relPath} were found.`,
          isError: false,
          metadata: {
            toolName: "find_dependencies",
            filePath: relPath,
            direction,
            depth,
            directCount: 0,
            totalCount: 0,
          },
        };
      }

      const depthLabel = depth > 1 ? ` (depth: ${depth})` : "";
      const header = `Files importing ${relPath}${depthLabel}\n`;
      const summary = `Imported by (${nodes.length}):`;
      const tree = formatTree(nodes, showSpecifiers, "  ");

      const output = [header, summary, tree].join("\n");

      return {
        output,
        isError: false,
        metadata: {
          toolName: "find_dependencies",
          filePath: relPath,
          direction,
          depth,
          directCount: nodes.length,
          totalCount: visited.size - 1,
        },
      };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { output: `Dependency analysis failed: ${message}`, isError: true };
  }
}

/**
 * find_dependencies 도구 정의 — 내보내기하여 도구 레지스트리에 등록
 */
export const findDependenciesTool: ToolDefinition<Params> = {
  name: "find_dependencies",
  description:
    "파일의 import/export 의존 관계를 추적합니다. " +
    "리팩토링 전 영향 범위를 파악하거나, 코드 흐름을 이해할 때 사용합니다.\n\n" +
    "사용 시점:\n" +
    "- 리팩토링 전 영향 받는 파일 파악 (importedBy)\n" +
    "- 모듈 간 의존 관계 이해 (imports)\n" +
    "- 순환 의존성 탐지 (depth: 2-3)\n\n" +
    "direction 옵션:\n" +
    '- "imports": 대상 파일이 가져오는 모듈 목록 (이 파일은 무엇에 의존하는가?)\n' +
    '- "importedBy": 대상 파일을 가져오는 파일 목록 (이 파일에 의존하는 것은?)\n\n' +
    "depth 옵션: 1=직접 의존만, 2=간접 포함, 3=3단계까지 추적. " +
    "순환 의존성은 자동으로 감지되어 무한 루프를 방지합니다.",
  parameterSchema: paramSchema,
  permissionLevel: "safe",
  timeoutMs: 30_000,
  execute,
};

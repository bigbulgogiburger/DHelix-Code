/**
 * 디렉토리 목록 도구 — 디렉토리 내용을 트리 형식으로 표시하는 도구
 *
 * Unix의 `tree` 명령어와 유사하게, 디렉토리 구조를 시각적인 트리 형태로 출력합니다.
 * 디렉토리가 먼저 표시되고, 그 다음 파일이 알파벳순으로 정렬됩니다.
 *
 * 주요 기능:
 * - 재귀적 하위 디렉토리 탐색 (최대 깊이 제한 가능)
 * - .git, node_modules 등 불필요한 디렉토리 자동 제외
 * - 트리 형태의 시각적 출력 (├──, └── 등 연결선 사용)
 *
 * 권한 수준: "safe" — 파일 시스템을 읽기만 하므로 안전합니다.
 */
import { z } from "zod";
import { readdir } from "node:fs/promises";
import { type ToolDefinition, type ToolContext, type ToolResult } from "../types.js";
import { resolvePath, joinPath } from "../../utils/path.js";

/**
 * 무시할 디렉토리 목록 — 일반적으로 사용자에게 보여줄 필요 없는 디렉토리들
 *
 * 이 디렉토리들은 빌드 산출물, 패키지 매니저 캐시, IDE 설정 등으로
 * 코드 구조를 파악하는 데 방해가 되므로 기본적으로 제외합니다.
 */
const IGNORED_DIRS = new Set([
  ".git",           // Git 저장소 내부 데이터
  "node_modules",   // npm/yarn 패키지 (수만 개의 파일)
  ".next",          // Next.js 빌드 결과물
  ".nuxt",          // Nuxt.js 빌드 결과물
  "__pycache__",    // Python 바이트코드 캐시
  ".pytest_cache",  // pytest 테스트 캐시
  ".venv",          // Python 가상 환경
  "venv",           // Python 가상 환경 (대체 이름)
  ".tox",           // tox 테스트 자동화 도구 캐시
  "dist",           // 빌드 배포 디렉토리
  "build",          // 빌드 결과물 디렉토리
  ".gradle",        // Gradle 빌드 캐시
  ".idea",          // JetBrains IDE 설정
  ".vscode",        // VS Code 설정
  ".DS_Store",      // macOS 파인더 메타데이터 (파일이지만 이름으로 필터링)
]);

/**
 * 매개변수 스키마 — 디렉토리 경로, 재귀 여부, 최대 깊이를 정의
 */
const paramSchema = z.object({
  /** 목록을 표시할 디렉토리 경로 */
  path: z.string().describe("Directory path to list"),
  /** 재귀적으로 하위 디렉토리도 표시할지 여부 (기본값: false) */
  recursive: z
    .boolean()
    .optional()
    .default(false)
    .describe("Whether to list recursively (default: false)"),
  /** 재귀 탐색 시 최대 깊이 (기본값: 3, 최대: 10) — 너무 깊으면 출력이 과도하게 커짐 */
  maxDepth: z
    .number()
    .int()
    .min(1)
    .max(10)
    .optional()
    .default(3)
    .describe("Maximum depth for recursive listing (default: 3)"),
});

type Params = z.infer<typeof paramSchema>;

/**
 * 트리 항목 — 디렉토리 구조의 각 노드를 나타내는 인터페이스
 */
interface TreeEntry {
  /** 파일 또는 디렉토리 이름 */
  readonly name: string;
  /** 디렉토리인지 여부 */
  readonly isDirectory: boolean;
  /** 하위 항목 (디렉토리이고 재귀 탐색 시에만 존재) */
  readonly children?: readonly TreeEntry[];
}

/**
 * 디렉토리 구조를 재귀적으로 탐색하여 트리 데이터 구조를 생성
 *
 * 각 디렉토리에서:
 * 1. IGNORED_DIRS에 있는 항목을 필터링
 * 2. 디렉토리를 먼저, 파일을 나중에 정렬 (같은 종류 내에서는 알파벳순)
 * 3. 재귀 옵션이 활성화되고 현재 깊이가 최대 깊이 미만이면 하위 디렉토리도 탐색
 *
 * @param dirPath - 탐색할 디렉토리의 절대 경로
 * @param recursive - 재귀 탐색 여부
 * @param maxDepth - 최대 탐색 깊이
 * @param currentDepth - 현재 탐색 깊이 (0부터 시작)
 * @returns 트리 항목 배열
 */
async function buildTree(
  dirPath: string,
  recursive: boolean,
  maxDepth: number,
  currentDepth: number,
): Promise<readonly TreeEntry[]> {
  // withFileTypes: true — Dirent 객체를 반환하여 추가 stat 호출 없이 파일/디렉토리 구분
  const entries = await readdir(dirPath, { withFileTypes: true });

  // 무시 목록 필터링 + 정렬 (디렉토리 먼저, 알파벳순)
  const sorted = entries
    .filter((e) => !IGNORED_DIRS.has(e.name))
    .sort((a, b) => {
      // 디렉토리와 파일이 섞여있으면 디렉토리를 먼저 배치
      if (a.isDirectory() !== b.isDirectory()) {
        return a.isDirectory() ? -1 : 1;
      }
      // 같은 종류 내에서는 알파벳 순서로 정렬
      return a.name.localeCompare(b.name);
    });

  const result: TreeEntry[] = [];

  for (const entry of sorted) {
    const isDir = entry.isDirectory();
    let children: readonly TreeEntry[] | undefined;

    // 디렉토리이고, 재귀 모드이고, 최대 깊이에 도달하지 않았으면 하위 탐색
    if (isDir && recursive && currentDepth < maxDepth) {
      try {
        children = await buildTree(
          joinPath(dirPath, entry.name),
          recursive,
          maxDepth,
          currentDepth + 1,
        );
      } catch {
        // 권한 부족 등으로 하위 디렉토리를 읽을 수 없으면 children을 undefined로 남김
        children = undefined;
      }
    }

    result.push({
      name: entry.name,
      isDirectory: isDir,
      children,
    });
  }

  return result;
}

/**
 * 트리 데이터 구조를 시각적인 트리 형태의 텍스트로 변환
 *
 * 출력 예시:
 * ├── src/
 * │   ├── index.ts
 * │   └── utils/
 * │       └── path.ts
 * └── package.json
 *
 * 연결선 규칙:
 * - 마지막 항목: "└── " (L자 모양)
 * - 그 외 항목: "├── " (T자 모양)
 * - 하위 항목의 접두사: 부모가 마지막이면 "    ", 아니면 "│   "
 *
 * @param entries - 트리 항목 배열
 * @param prefix - 현재 들여쓰기 접두사 (재귀 호출에서 누적)
 * @returns 트리 형태의 텍스트
 */
function formatTree(entries: readonly TreeEntry[], prefix: string = ""): string {
  const lines: string[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const isLast = i === entries.length - 1;
    // 마지막 항목은 └── , 나머지는 ├──
    const connector = isLast ? "└── " : "├── ";
    // 디렉토리 이름 뒤에 / 추가하여 디렉토리임을 표시
    const displayName = entry.isDirectory ? `${entry.name}/` : entry.name;

    lines.push(`${prefix}${connector}${displayName}`);

    // 하위 항목이 있으면 재귀적으로 포맷팅
    if (entry.children && entry.children.length > 0) {
      // 부모가 마지막 항목이면 빈 공간("    "), 아니면 세로선("│   ")
      const childPrefix = prefix + (isLast ? "    " : "│   ");
      lines.push(formatTree(entry.children, childPrefix));
    }
  }

  return lines.join("\n");
}

/**
 * 디렉토리 목록 실행 함수
 *
 * @param params - 검증된 매개변수 (경로, 재귀 여부, 최대 깊이)
 * @param context - 실행 컨텍스트 (작업 디렉토리 등)
 * @returns 트리 형태의 디렉토리 목록
 */
async function execute(params: Params, context: ToolContext): Promise<ToolResult> {
  const dirPath = resolvePath(context.workingDirectory, params.path);

  try {
    // 1단계: 디렉토리 구조를 데이터로 수집
    const tree = await buildTree(dirPath, params.recursive, params.maxDepth, 0);
    // 2단계: 데이터를 시각적 트리 텍스트로 변환
    const output = formatTree(tree);

    return {
      output: output || "(empty directory)",
      isError: false,
      metadata: {
        path: dirPath,
        recursive: params.recursive,
        maxDepth: params.maxDepth,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      output: `Failed to list directory: ${message}`,
      isError: true,
    };
  }
}

/**
 * list_dir 도구 정의 — 내보내기하여 도구 레지스트리에 등록
 */
export const listDirTool: ToolDefinition<Params> = {
  name: "list_dir",
  description:
    "List directory contents in a tree format. Directories are sorted first, then files alphabetically. Common directories like .git and node_modules are excluded by default.",
  parameterSchema: paramSchema,
  permissionLevel: "safe",
  timeoutMs: 30_000,
  execute,
};

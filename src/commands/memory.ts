/**
 * /memory 명령어 핸들러 — 프로젝트 메모리 파일 관리
 *
 * 메모리(memory)란? dhelix가 세션 간에 기억해야 할 정보를 저장하는
 * 마크다운 파일 시스템입니다. .dhelix/memory/ 디렉토리에 저장됩니다.
 *
 * 메모리의 용도:
 *   - 프로젝트별 규칙이나 패턴 기록
 *   - 이전 세션에서 발견한 사항 보존
 *   - 자주 참조하는 정보를 영구 저장
 *
 * 주요 서브커맨드:
 *   /memory                     — 모든 메모리 파일 목록 (크기, 줄 수 포함)
 *   /memory view <이름>         — 특정 메모리 파일 내용 조회
 *   /memory edit <이름> <내용>  — 메모리 파일 생성 또는 수정
 *   /memory delete <이름>       — 메모리 파일 삭제
 *   /memory status              — 자동 메모리 상태 (프로젝트/전역)
 *   /memory topics              — 토픽 파일 목록 (MEMORY.md 제외)
 *   /memory search <쿼리>       — 모든 메모리 파일에서 텍스트 검색
 *
 * 하위 호환성:
 *   /memory <이름>              → view와 동일
 *   /memory <이름> <내용>       → edit와 동일
 */
import { readdir, readFile, writeFile, mkdir, stat, unlink } from "node:fs/promises";
import { join } from "node:path";
import {
  MEMORY_MAIN_FILE,
  MEMORY_MAX_MAIN_LINES,
  getProjectMemoryDir,
  getGlobalMemoryDir,
} from "../constants.js";
import { type SlashCommand } from "./registry.js";

/**
 * 단일 메모리 파일의 메타데이터 인터페이스
 *
 * @property name - 파일명 (예: "architecture.md")
 * @property sizeBytes - 파일 크기 (바이트)
 * @property lineCount - 파일의 줄 수
 */
interface MemoryFileInfo {
  readonly name: string;
  readonly sizeBytes: number;
  readonly lineCount: number;
}

/**
 * 파일명이 .md 확장자로 끝나도록 보장하는 헬퍼 함수
 *
 * 사용자가 확장자 없이 이름만 입력해도 .md를 자동 추가합니다.
 *
 * @param name - 원본 파일명
 * @returns .md 확장자가 포함된 파일명
 */
function ensureMdExtension(name: string): string {
  return name.endsWith(".md") ? name : `${name}.md`;
}

/**
 * 메모리 파일 목록을 크기 및 줄 수 메타데이터와 함께 조회하는 함수
 *
 * @param memoryDir - 메모리 디렉토리 경로
 * @returns 파일 정보 배열 (이름, 크기, 줄 수)
 */
async function listMemoryFilesDetailed(memoryDir: string): Promise<readonly MemoryFileInfo[]> {
  try {
    const entries = await readdir(memoryDir);
    const mdFiles = entries.filter((e) => e.endsWith(".md")).sort();

    const infos = await Promise.all(
      mdFiles.map(async (name) => {
        const filePath = join(memoryDir, name);
        try {
          const [fileStat, content] = await Promise.all([
            stat(filePath),
            readFile(filePath, "utf-8"),
          ]);
          return {
            name,
            sizeBytes: fileStat.size,
            lineCount: content.split("\n").length,
          };
        } catch {
          return { name, sizeBytes: 0, lineCount: 0 };
        }
      }),
    );

    return infos;
  } catch {
    return [];
  }
}

/**
 * 메모리 파일 이름만 조회하는 함수 (하위 호환용 헬퍼)
 *
 * @param memoryDir - 메모리 디렉토리 경로
 * @returns .md 파일명 배열 (정렬됨)
 */
async function listMemoryFiles(memoryDir: string): Promise<readonly string[]> {
  try {
    const entries = await readdir(memoryDir);
    return entries.filter((e) => e.endsWith(".md")).sort();
  } catch {
    return [];
  }
}

/**
 * 이름으로 특정 메모리 파일을 읽는 함수
 *
 * @param memoryDir - 메모리 디렉토리 경로
 * @param name - 파일명 (.md 확장자 자동 추가)
 * @returns 파일 내용 (없으면 null)
 */
async function readMemoryFile(memoryDir: string, name: string): Promise<string | null> {
  const fileName = ensureMdExtension(name);
  const filePath = join(memoryDir, fileName);
  try {
    return await readFile(filePath, "utf-8");
  } catch {
    return null;
  }
}

/**
 * 메모리 파일에 내용을 기록하는 함수 (필요 시 디렉토리 자동 생성)
 *
 * @param memoryDir - 메모리 디렉토리 경로
 * @param name - 파일명 (.md 확장자 자동 추가)
 * @param content - 기록할 내용
 */
async function writeMemoryFile(memoryDir: string, name: string, content: string): Promise<void> {
  const fileName = ensureMdExtension(name);
  await mkdir(memoryDir, { recursive: true });
  await writeFile(join(memoryDir, fileName), content, "utf-8");
}

/**
 * 이름으로 메모리 파일을 삭제하는 함수
 *
 * @param memoryDir - 메모리 디렉토리 경로
 * @param name - 삭제할 파일명
 * @returns 삭제 성공 여부 (파일이 없으면 false)
 */
async function deleteMemoryFile(memoryDir: string, name: string): Promise<boolean> {
  const fileName = ensureMdExtension(name);
  const filePath = join(memoryDir, fileName);
  try {
    await unlink(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 모든 메모리 파일에서 쿼리 문자열을 검색하는 함수 (대소문자 무시)
 *
 * 각 파일의 모든 줄을 검사하여 쿼리와 일치하는 줄을 수집합니다.
 *
 * @param memoryDir - 메모리 디렉토리 경로
 * @param query - 검색할 문자열
 * @returns 파일별 일치하는 줄 배열
 */
async function searchMemoryFiles(
  memoryDir: string,
  query: string,
): Promise<readonly { readonly file: string; readonly matches: readonly string[] }[]> {
  const files = await listMemoryFiles(memoryDir);
  const lowerQuery = query.toLowerCase();
  const results: { readonly file: string; readonly matches: readonly string[] }[] = [];

  for (const file of files) {
    const content = await readMemoryFile(memoryDir, file);
    if (content === null) continue;

    const matchingLines = content
      .split("\n")
      .filter((line) => line.toLowerCase().includes(lowerQuery));

    if (matchingLines.length > 0) {
      results.push({ file, matches: matchingLines });
    }
  }

  return results;
}

/**
 * 바이트 수를 사람이 읽기 쉬운 형식으로 변환하는 함수
 *
 * @param bytes - 바이트 수
 * @returns 포맷된 문자열 (예: "512B", "1.5KB", "2.3MB")
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * /memory (인자 없음) 핸들러 — 모든 메모리 파일 목록을 상세 정보와 함께 표시
 *
 * 파일이 없으면 사용법 안내를 보여줍니다.
 *
 * @param memoryDir - 메모리 디렉토리 경로
 * @returns 파일 목록 텍스트와 성공 여부
 */
async function handleList(
  memoryDir: string,
): Promise<{ readonly output: string; readonly success: boolean }> {
  const files = await listMemoryFilesDetailed(memoryDir);

  if (files.length === 0) {
    return {
      output: [
        "No memory files found.",
        "",
        `Memory directory: ${memoryDir}`,
        "",
        "Usage:",
        "  /memory                      — List all memory files",
        "  /memory view <name>          — View a specific memory file",
        "  /memory edit <name> <content> — Create or update a memory file",
        "  /memory delete <name>        — Delete a memory file",
        "  /memory status               — Show auto-memory status",
        "  /memory topics               — List topic files",
        "  /memory search <query>       — Search across all memory files",
      ].join("\n"),
      success: true,
    };
  }

  const lines = [
    `Memory files (${memoryDir}):`,
    "",
    ...files.map(
      (f) =>
        `  ${f.name.padEnd(30)} ${String(f.lineCount).padStart(4)} lines  ${formatBytes(f.sizeBytes).padStart(8)}`,
    ),
    "",
    `Total: ${files.length} file(s)`,
    "",
    "Usage: /memory view <name> to view a file",
  ];

  return { output: lines.join("\n"), success: true };
}

/**
 * /memory view <name> 핸들러 — 특정 메모리 파일 내용 표시
 *
 * @param memoryDir - 메모리 디렉토리 경로
 * @param name - 조회할 파일명
 * @returns 파일 내용 텍스트와 성공 여부
 */
async function handleView(
  memoryDir: string,
  name: string,
): Promise<{ readonly output: string; readonly success: boolean }> {
  if (!name) {
    return {
      output: "Usage: /memory view <name>\n\nSpecify the name of the memory file to view.",
      success: false,
    };
  }

  const content = await readMemoryFile(memoryDir, name);
  if (content === null) {
    const fileName = ensureMdExtension(name);
    return {
      output: `Memory file not found: ${fileName}\n\nUse /memory edit ${name} <content> to create it.`,
      success: false,
    };
  }

  const fileName = ensureMdExtension(name);
  return {
    output: `--- ${fileName} ---\n\n${content}`,
    success: true,
  };
}

/**
 * /memory edit <name> <content> 핸들러 — 메모리 파일 생성 또는 수정
 *
 * @param memoryDir - 메모리 디렉토리 경로
 * @param nameAndContent - "파일명 내용" 형태의 문자열
 * @returns 작업 결과 텍스트와 성공 여부
 */
async function handleEdit(
  memoryDir: string,
  nameAndContent: string,
): Promise<{ readonly output: string; readonly success: boolean }> {
  if (!nameAndContent) {
    return {
      output: "Usage: /memory edit <name> <content>\n\nSpecify the file name and content to write.",
      success: false,
    };
  }

  const spaceIdx = nameAndContent.indexOf(" ");
  if (spaceIdx === -1) {
    return {
      output:
        "Usage: /memory edit <name> <content>\n\nMissing content. Provide both a name and content.",
      success: false,
    };
  }

  const name = nameAndContent.slice(0, spaceIdx);
  const content = nameAndContent.slice(spaceIdx + 1).trim();

  if (!content) {
    return {
      output: "Usage: /memory edit <name> <content>\n\nContent cannot be empty.",
      success: false,
    };
  }

  await writeMemoryFile(memoryDir, name, content);
  const fileName = ensureMdExtension(name);
  return {
    output: `Memory file written: ${fileName}`,
    success: true,
  };
}

/**
 * /memory delete <name> 핸들러 — 메모리 파일 삭제
 *
 * @param memoryDir - 메모리 디렉토리 경로
 * @param name - 삭제할 파일명
 * @returns 삭제 결과 텍스트와 성공 여부
 */
async function handleDelete(
  memoryDir: string,
  name: string,
): Promise<{ readonly output: string; readonly success: boolean }> {
  if (!name) {
    return {
      output: "Usage: /memory delete <name>\n\nSpecify the name of the memory file to delete.",
      success: false,
    };
  }

  const fileName = ensureMdExtension(name);
  const deleted = await deleteMemoryFile(memoryDir, name);

  if (!deleted) {
    return {
      output: `Memory file not found: ${fileName}`,
      success: false,
    };
  }

  return {
    output: `Memory file deleted: ${fileName}`,
    success: true,
  };
}

/**
 * /memory status 핸들러 — 자동 메모리 상태 표시
 *
 * 프로젝트 메모리와 전역 메모리의 디렉토리, 파일 수, 총 줄 수,
 * 메인 파일(MEMORY.md) 존재 여부 등을 보여줍니다.
 *
 * @param projectMemoryDir - 프로젝트 메모리 디렉토리 경로
 * @param globalMemoryDir - 전역 메모리 디렉토리 경로
 * @returns 상태 텍스트와 성공 여부
 */
async function handleStatus(
  projectMemoryDir: string,
  globalMemoryDir: string,
): Promise<{ readonly output: string; readonly success: boolean }> {
  const [projectFiles, globalFiles] = await Promise.all([
    listMemoryFilesDetailed(projectMemoryDir),
    listMemoryFilesDetailed(globalMemoryDir),
  ]);

  const mainFileExists = projectFiles.some((f) => f.name === MEMORY_MAIN_FILE);
  const globalMainExists = globalFiles.some((f) => f.name === MEMORY_MAIN_FILE);

  const projectTotalLines = projectFiles.reduce((sum, f) => sum + f.lineCount, 0);
  const globalTotalLines = globalFiles.reduce((sum, f) => sum + f.lineCount, 0);

  const mainFileInfo = projectFiles.find((f) => f.name === MEMORY_MAIN_FILE);
  const mainLineStatus = mainFileInfo
    ? `${mainFileInfo.lineCount}/${MEMORY_MAX_MAIN_LINES} lines`
    : "not created";

  const lines = [
    "Auto-Memory Status",
    "==================",
    "",
    "Project Memory:",
    `  Directory:   ${projectMemoryDir}`,
    `  Main file:   ${mainFileExists ? "exists" : "not found"} (${mainLineStatus})`,
    `  Files:       ${projectFiles.length}`,
    `  Total lines: ${projectTotalLines}`,
    "",
    "Global Memory:",
    `  Directory:   ${globalMemoryDir}`,
    `  Main file:   ${globalMainExists ? "exists" : "not found"}`,
    `  Files:       ${globalFiles.length}`,
    `  Total lines: ${globalTotalLines}`,
  ];

  return { output: lines.join("\n"), success: true };
}

/**
 * /memory topics 핸들러 — 토픽 파일 목록 (MEMORY.md 제외)
 *
 * 메인 메모리 파일(MEMORY.md)을 제외한 개별 토픽 파일들만 보여줍니다.
 *
 * @param memoryDir - 메모리 디렉토리 경로
 * @returns 토픽 파일 목록 텍스트와 성공 여부
 */
async function handleTopics(
  memoryDir: string,
): Promise<{ readonly output: string; readonly success: boolean }> {
  const files = await listMemoryFilesDetailed(memoryDir);
  const topicFiles = files.filter((f) => f.name !== MEMORY_MAIN_FILE);

  if (topicFiles.length === 0) {
    return {
      output: [
        "No topic memory files found.",
        "",
        `Only the main file (${MEMORY_MAIN_FILE}) exists, or no memory files at all.`,
        "",
        "Use /memory edit <topic-name> <content> to create a topic file.",
      ].join("\n"),
      success: true,
    };
  }

  const lines = [
    `Topic memory files (${memoryDir}):`,
    "",
    ...topicFiles.map(
      (f) =>
        `  ${f.name.padEnd(30)} ${String(f.lineCount).padStart(4)} lines  ${formatBytes(f.sizeBytes).padStart(8)}`,
    ),
    "",
    `Total: ${topicFiles.length} topic file(s)`,
  ];

  return { output: lines.join("\n"), success: true };
}

/**
 * /memory search <query> 핸들러 — 메모리 파일 전체 텍스트 검색
 *
 * @param memoryDir - 메모리 디렉토리 경로
 * @param query - 검색할 문자열
 * @returns 검색 결과 텍스트와 성공 여부
 */
async function handleSearch(
  memoryDir: string,
  query: string,
): Promise<{ readonly output: string; readonly success: boolean }> {
  if (!query) {
    return {
      output:
        "Usage: /memory search <query>\n\nSpecify a search term to find across all memory files.",
      success: false,
    };
  }

  const results = await searchMemoryFiles(memoryDir, query);

  if (results.length === 0) {
    return {
      output: `No matches found for "${query}" in memory files.`,
      success: true,
    };
  }

  const totalMatches = results.reduce((sum, r) => sum + r.matches.length, 0);
  const lines = [
    `Search results for "${query}" (${totalMatches} match(es) in ${results.length} file(s)):`,
    "",
  ];

  for (const result of results) {
    lines.push(`--- ${result.file} (${result.matches.length} match(es)) ---`);
    for (const match of result.matches) {
      lines.push(`  ${match.trim()}`);
    }
    lines.push("");
  }

  return { output: lines.join("\n"), success: true };
}

/**
 * /memory 슬래시 명령어 정의 — 프로젝트 메모리 파일 관리
 *
 * 서브커맨드 라우팅:
 *   인자 없음 → 파일 목록
 *   view/edit/delete/status/topics/search → 해당 핸들러
 *   그 외 → 하위 호환 모드 (파일명으로 읽기 또는 쓰기)
 */
export const memoryCommand: SlashCommand = {
  name: "memory",
  description: "View, edit, and manage project memory files (.dhelix/memory/)",
  usage: "/memory [view|edit|delete|status|topics|search] [name] [content]",

  async execute(args, context) {
    const trimmed = args.trim();
    const projectMemoryDir = getProjectMemoryDir(context.workingDirectory);
    const globalMemoryDir = getGlobalMemoryDir();

    // No args: list memory files with details
    if (!trimmed) {
      return handleList(projectMemoryDir);
    }

    // Parse subcommand
    const spaceIdx = trimmed.indexOf(" ");
    const firstWord = spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx);
    const rest = spaceIdx === -1 ? "" : trimmed.slice(spaceIdx + 1).trim();

    // Route subcommands
    switch (firstWord) {
      case "view":
        return handleView(projectMemoryDir, rest);

      case "edit":
        return handleEdit(projectMemoryDir, rest);

      case "delete":
        return handleDelete(projectMemoryDir, rest);

      case "status":
        return handleStatus(projectMemoryDir, globalMemoryDir);

      case "topics":
        return handleTopics(projectMemoryDir);

      case "search":
        return handleSearch(projectMemoryDir, rest);

      default: {
        // Backward compatibility: /memory <name> or /memory <name> <content>
        const name = firstWord;
        const content = rest;

        if (content) {
          // /memory <name> <content> — write
          await writeMemoryFile(projectMemoryDir, name, content);
          const fileName = ensureMdExtension(name);
          return {
            output: `Memory file written: ${fileName}`,
            success: true,
          };
        }

        // /memory <name> — read
        const fileContent = await readMemoryFile(projectMemoryDir, name);
        if (fileContent === null) {
          const fileName = ensureMdExtension(name);
          return {
            output: `Memory file not found: ${fileName}\n\nUse /memory edit ${name} <content> to create it.`,
            success: false,
          };
        }

        const fileName = ensureMdExtension(name);
        return {
          output: `--- ${fileName} ---\n\n${fileContent}`,
          success: true,
        };
      }
    }
  },
};

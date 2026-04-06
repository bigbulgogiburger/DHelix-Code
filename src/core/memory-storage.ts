/**
 * 메모리 스토리지(Memory Storage) 모듈
 *
 * 프로젝트별/전역 메모리 파일의 읽기, 쓰기, 관리를 담당합니다.
 * 메모리 파일은 마크다운(.md) 형식으로 저장되며,
 * 에이전트가 세션 간에 유용한 정보를 기억하는 데 사용됩니다.
 *
 * 주니어 개발자를 위한 설명:
 * - 이 모듈은 AI 어시스턴트의 "장기 기억 저장소" 입니다
 * - 프로젝트 메모리: 해당 프로젝트에서만 사용되는 정보 ({프로젝트}/.dhelix/memory/)
 * - 전역 메모리: 모든 프로젝트에서 공유되는 정보 (~/.dhelix/memory/)
 * - 주제별 파일: 아키텍처, 디버깅, 패턴 등 주제별로 분리 저장 가능
 * - 파일이 너무 길어지지 않도록 줄 수 제한(maxMainLines, maxTopicLines)을 적용합니다
 */
import { readdir, readFile, writeFile, mkdir, stat, unlink } from "node:fs/promises";
import { homedir } from "node:os";
import { joinPath, normalizePath } from "../utils/path.js";
import { APP_NAME } from "../constants.js";
import { BaseError } from "../utils/error.js";

/**
 * 메모리 파일 저장 위치와 제한값 설정
 *
 * @property projectDir - 프로젝트 루트 디렉토리 경로
 * @property globalDir - 전역 메모리 디렉토리 경로 (~/.dhelix/memory/)
 * @property maxMainLines - 메인 MEMORY.md의 최대 줄 수 (기본 200줄)
 * @property maxTopicLines - 주제별 파일의 최대 줄 수 (기본 500줄)
 */
export interface MemoryConfig {
  readonly projectDir: string;
  readonly globalDir: string;
  readonly maxMainLines: number;
  readonly maxTopicLines: number;
}

/**
 * 디스크에 저장된 단일 메모리 파일의 메타데이터
 *
 * @property name - 파일 이름 (예: "MEMORY.md", "debugging.md")
 * @property path - 파일의 전체 경로
 * @property sizeBytes - 파일 크기 (바이트)
 * @property modifiedAt - 마지막 수정 시각
 * @property lineCount - 파일의 총 줄 수
 */
export interface MemoryFileInfo {
  readonly name: string;
  readonly path: string;
  readonly sizeBytes: number;
  readonly modifiedAt: Date;
  readonly lineCount: number;
}

/**
 * 메모리 스토리지 관련 에러 클래스
 */
export class MemoryStorageError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "MEMORY_STORAGE_ERROR", context);
  }
}

/** 프로젝트 메모리 디렉토리의 상대 경로 (.dhelix/memory/) */
const PROJECT_MEMORY_DIR = `.${APP_NAME}/memory`;

/** 메인 메모리 파일 이름 */
const MAIN_MEMORY_FILE = "MEMORY.md";

/**
 * 프로젝트 디렉토리에 대한 기본 메모리 경로 설정을 생성합니다.
 *
 * 프로젝트 메모리: {projectDir}/.dhelix/memory/
 * 전역 메모리: ~/.dhelix/memory/
 *
 * @param projectDir - 프로젝트 루트 디렉토리 경로
 * @returns 메모리 설정 객체
 */
export function getMemoryPaths(projectDir: string): MemoryConfig {
  return {
    projectDir: normalizePath(projectDir),
    globalDir: joinPath(homedir(), `.${APP_NAME}`, "memory"),
    maxMainLines: 200,
    maxTopicLines: 500,
  };
}

/**
 * 메인 MEMORY.md 파일을 읽습니다.
 * maxMainLines까지만 읽어 과도하게 긴 내용이 시스템 프롬프트에 포함되는 것을 방지합니다.
 *
 * @param config - 메모리 설정
 * @returns 파일 내용 문자열 (없으면 빈 문자열)
 */
export async function readMainMemory(config: MemoryConfig): Promise<string> {
  const filePath = joinPath(config.projectDir, PROJECT_MEMORY_DIR, MAIN_MEMORY_FILE);
  const content = await readFileSafe(filePath);
  if (!content) {
    return "";
  }
  return truncateLines(content, config.maxMainLines);
}

/**
 * 주제별 메모리 파일을 읽습니다.
 * 예: readTopicMemory(config, "debugging") → .dhelix/memory/debugging.md를 읽음
 *
 * @param config - 메모리 설정
 * @param topic - 주제 이름 (예: "debugging", "patterns")
 * @returns 파일 내용, 파일이 없으면 null
 */
export async function readTopicMemory(config: MemoryConfig, topic: string): Promise<string | null> {
  const fileName = ensureMarkdownExtension(topic);
  const filePath = joinPath(config.projectDir, PROJECT_MEMORY_DIR, fileName);
  const content = await readFileSafe(filePath);
  if (content === null) {
    return null;
  }
  return truncateLines(content, config.maxTopicLines);
}

/**
 * 전역 MEMORY.md 파일을 읽습니다.
 * 모든 프로젝트에서 공유되는 크로스 프로젝트 패턴을 저장합니다.
 *
 * @param config - 메모리 설정
 * @returns 파일 내용 문자열 (없으면 빈 문자열)
 */
export async function readGlobalMemory(config: MemoryConfig): Promise<string> {
  const filePath = joinPath(config.globalDir, MAIN_MEMORY_FILE);
  const content = await readFileSafe(filePath);
  if (!content) {
    return "";
  }
  return truncateLines(content, config.maxMainLines);
}

/**
 * 메인 MEMORY.md 파일에 내용을 씁니다.
 * 메모리 디렉토리가 없으면 자동으로 생성합니다.
 *
 * @param config - 메모리 설정
 * @param content - 저장할 내용
 */
export async function writeMainMemory(config: MemoryConfig, content: string): Promise<void> {
  const dir = joinPath(config.projectDir, PROJECT_MEMORY_DIR);
  await ensureDirectory(dir);
  const filePath = joinPath(dir, MAIN_MEMORY_FILE);
  await writeFileSafe(filePath, content);
}

/**
 * 주제별 메모리 파일에 내용을 씁니다.
 * 메모리 디렉토리가 없으면 자동으로 생성합니다.
 *
 * @param config - 메모리 설정
 * @param topic - 주제 이름 (예: "debugging")
 * @param content - 저장할 내용
 */
export async function writeTopicMemory(
  config: MemoryConfig,
  topic: string,
  content: string,
): Promise<void> {
  const fileName = ensureMarkdownExtension(topic);
  const dir = joinPath(config.projectDir, PROJECT_MEMORY_DIR);
  await ensureDirectory(dir);
  const filePath = joinPath(dir, fileName);
  await writeFileSafe(filePath, content);
}

/**
 * 전역 MEMORY.md 파일에 내용을 씁니다.
 * 전역 메모리 디렉토리가 없으면 자동으로 생성합니다.
 *
 * @param config - 메모리 설정
 * @param content - 저장할 내용
 */
export async function writeGlobalMemory(config: MemoryConfig, content: string): Promise<void> {
  await ensureDirectory(config.globalDir);
  const filePath = joinPath(config.globalDir, MAIN_MEMORY_FILE);
  await writeFileSafe(filePath, content);
}

/**
 * 프로젝트 메모리 디렉토리의 모든 .md 파일 목록을 반환합니다.
 * 이름 순으로 정렬됩니다.
 *
 * @param config - 메모리 설정
 * @returns 메모리 파일 정보 배열 (디렉토리가 없으면 빈 배열)
 */
export async function listMemoryFiles(config: MemoryConfig): Promise<readonly MemoryFileInfo[]> {
  const dir = joinPath(config.projectDir, PROJECT_MEMORY_DIR);
  try {
    const entries = await readdir(dir);
    // .md 확장자 파일만 필터링
    const mdFiles = entries.filter((entry) => entry.endsWith(".md"));

    // 각 파일의 메타데이터를 병렬로 조회 (Promise.all로 효율적으로 처리)
    const fileInfos = await Promise.all(
      mdFiles.map(async (name) => {
        const filePath = joinPath(dir, name);
        return buildFileInfo(name, filePath);
      }),
    );

    return fileInfos
      .filter((info): info is MemoryFileInfo => info !== null)
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error: unknown) {
    // 디렉토리가 없으면 빈 배열 반환
    if (isFileNotFoundError(error)) {
      return [];
    }
    throw new MemoryStorageError("Failed to list memory files", {
      dir,
      cause: String(error),
    });
  }
}

/**
 * 메모리 파일을 삭제합니다.
 *
 * @param config - 메모리 설정
 * @param filename - 삭제할 파일 이름
 * @throws MemoryStorageError - 파일이 존재하지 않는 경우
 */
export async function deleteMemoryFile(config: MemoryConfig, filename: string): Promise<void> {
  const fileName = ensureMarkdownExtension(filename);
  const filePath = joinPath(config.projectDir, PROJECT_MEMORY_DIR, fileName);
  try {
    await unlink(filePath);
  } catch (error: unknown) {
    if (isFileNotFoundError(error)) {
      throw new MemoryStorageError(`Memory file not found: ${fileName}`, {
        filePath,
      });
    }
    throw new MemoryStorageError(`Failed to delete memory file: ${fileName}`, {
      filePath,
      cause: String(error),
    });
  }
}

// ---------------------------------------------------------------------------
// 내부 헬퍼 함수들
// ---------------------------------------------------------------------------

/**
 * 파일을 안전하게 읽습니다. 파일이 없으면 null을 반환합니다.
 * (예외를 던지지 않고 null로 처리하여 호출부 코드를 간결하게 만듦)
 */
async function readFileSafe(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf-8");
  } catch (error: unknown) {
    if (isFileNotFoundError(error)) {
      return null;
    }
    throw new MemoryStorageError(`Failed to read memory file: ${filePath}`, {
      filePath,
      cause: String(error),
    });
  }
}

/**
 * 파일을 안전하게 씁니다. 기존 내용을 덮어씁니다.
 */
async function writeFileSafe(filePath: string, content: string): Promise<void> {
  try {
    await writeFile(filePath, content, "utf-8");
  } catch (error: unknown) {
    throw new MemoryStorageError(`Failed to write memory file: ${filePath}`, {
      filePath,
      cause: String(error),
    });
  }
}

/**
 * 디렉토리가 존재하도록 보장합니다.
 * 이미 있으면 아무것도 하지 않고, 없으면 재귀적으로 생성합니다.
 */
async function ensureDirectory(dir: string): Promise<void> {
  try {
    await mkdir(dir, { recursive: true });
  } catch (error: unknown) {
    throw new MemoryStorageError(`Failed to create memory directory: ${dir}`, {
      dir,
      cause: String(error),
    });
  }
}

/**
 * 파일의 메타데이터(크기, 수정일, 줄 수)를 조회합니다.
 * 실패하면 null을 반환합니다.
 */
async function buildFileInfo(name: string, filePath: string): Promise<MemoryFileInfo | null> {
  try {
    // stat()과 readFile()을 병렬로 실행하여 성능 최적화
    const [fileStat, content] = await Promise.all([stat(filePath), readFile(filePath, "utf-8")]);
    const lineCount = content.split("\n").length;

    return {
      name,
      path: normalizePath(filePath),
      sizeBytes: fileStat.size,
      modifiedAt: fileStat.mtime,
      lineCount,
    };
  } catch {
    return null;
  }
}

/**
 * 텍스트 내용을 최대 줄 수로 잘라냅니다.
 * 지정된 줄 수를 초과하면 초과분을 제거합니다.
 */
function truncateLines(content: string, maxLines: number): string {
  const lines = content.split("\n");
  if (lines.length <= maxLines) {
    return content;
  }
  return lines.slice(0, maxLines).join("\n");
}

/**
 * 파일 이름에 .md 확장자가 없으면 추가합니다.
 * 예: "debugging" → "debugging.md", "MEMORY.md" → "MEMORY.md"
 */
function ensureMarkdownExtension(name: string): string {
  return name.endsWith(".md") ? name : `${name}.md`;
}

/**
 * 에러가 ENOENT(파일 없음) 에러인지 판별하는 타입 가드
 *
 * Node.js 파일 시스템 에러는 code 프로퍼티에 에러 코드를 포함합니다.
 * ENOENT = "Error NO ENTry" = 파일이나 디렉토리가 존재하지 않음
 */
function isFileNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "ENOENT"
  );
}

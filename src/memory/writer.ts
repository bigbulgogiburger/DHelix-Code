/**
 * 메모리 라이터 — 프로젝트 메모리를 디스크에 안전하게 기록하는 모듈
 *
 * 주요 기능:
 * - appendMemory: 새 항목 추가 (중복 제거 + 자동 overflow)
 * - saveMemory: MEMORY.md 전체 덮어쓰기
 * - writeTopicFile: 토픽 파일 쓰기
 * - clearMemory: 모든 메모리 삭제
 *
 * 안전 장치:
 * - 원자적(atomic) 파일 쓰기: 임시 파일에 먼저 쓰고 rename → 부분 쓰기 방지
 * - 중복 감지: 같은 내용이 이미 메모리에 있으면 건너뜀
 * - 자동 overflow: MEMORY.md가 maxLines를 초과하면 오래된 섹션을 토픽 파일로 분리
 */

import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname } from "node:path";
import { BaseError } from "../utils/error.js";
import { getMemoryDir, getMemoryFilePath, getTopicFilePath } from "./paths.js";
import { normalizeTopicFileName } from "./loader.js";
import type { MemoryEntry } from "./types.js";

/**
 * 메모리 쓰기 에러 — 파일 쓰기 중 발생한 오류
 */
export class MemoryWriteError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "MEMORY_WRITE_ERROR", context);
  }
}

/** MEMORY.md의 기본 최대 줄 수 — 초과 시 overflow 트리거 */
const DEFAULT_MAX_MEMORY_LINES = 200;

/**
 * MEMORY.md에 새 항목을 추가 (중복 제거 + 자동 overflow 지원)
 *
 * 처리 흐름:
 * 1. 메모리 디렉토리 존재 확인/생성
 * 2. 기존 MEMORY.md 읽기
 * 3. 중복 검사 — 같은 내용이 있으면 건너뜀
 * 4. 해당 토픽 섹션(## 제목)에 항목 추가
 * 5. 줄 수가 maxLines 초과 시 overflow 처리 (오래된 섹션을 토픽 파일로 분리)
 * 6. 원자적 파일 쓰기
 *
 * @param projectRoot - 프로젝트 루트 경로
 * @param entry - 추가할 메모리 항목 (토픽 + 내용)
 * @param maxLines - MEMORY.md 최대 줄 수 (초과 시 overflow)
 * @returns written: 실제 기록 여부, overflowed: overflow 발생 여부
 */
export async function appendMemory(
  projectRoot: string,
  entry: MemoryEntry,
  maxLines: number = DEFAULT_MAX_MEMORY_LINES,
): Promise<{ readonly written: boolean; readonly overflowed: boolean }> {
  const memoryDir = getMemoryDir(projectRoot);
  const memoryFilePath = getMemoryFilePath(projectRoot);

  // 메모리 디렉토리가 없으면 생성 (recursive: 중간 디렉토리도 생성)
  await ensureDir(memoryDir);

  // 기존 MEMORY.md 내용 읽기 (없으면 빈 문자열)
  const existingContent = await readFileSafe(memoryFilePath);

  // 중복 검사: 같은 내용이 이미 존재하면 건너뜀
  if (isDuplicate(existingContent, entry.content)) {
    return { written: false, overflowed: false };
  }

  // 마크다운 리스트 항목 형식으로 포맷팅
  const entryBlock = formatEntryBlock(entry);

  // 해당 토픽의 ## 섹션에 항목 추가 (섹션이 없으면 생성)
  const updatedContent = appendToSection(existingContent, entry.topic, entryBlock);

  // 줄 수 확인 — maxLines 초과 시 overflow 처리
  const lines = updatedContent.split("\n");
  let overflowed = false;

  if (lines.length > maxLines) {
    // 오래된 섹션을 토픽 파일로 분리하고 MEMORY.md 축소
    await handleOverflow(projectRoot, updatedContent, maxLines);
    overflowed = true;
  } else {
    // 줄 수가 충분하면 그대로 원자적 쓰기
    await atomicWrite(memoryFilePath, updatedContent);
  }

  return { written: true, overflowed };
}

/**
 * MEMORY.md 전체 내용을 덮어쓰기
 *
 * 대량 업데이트나 메모리 재구성 시 사용합니다.
 *
 * @param projectRoot - 프로젝트 루트 경로
 * @param content - 저장할 전체 내용
 */
export async function saveMemory(projectRoot: string, content: string): Promise<void> {
  const memoryDir = getMemoryDir(projectRoot);
  const memoryFilePath = getMemoryFilePath(projectRoot);

  await ensureDir(memoryDir);
  await atomicWrite(memoryFilePath, content);
}

/**
 * 토픽 파일에 내용 쓰기
 *
 * @param projectRoot - 프로젝트 루트 경로
 * @param topic - 토픽 이름 (파일명으로 정규화됨)
 * @param content - 저장할 내용
 * @returns 정규화된 파일명 (예: "debugging.md")
 */
export async function writeTopicFile(
  projectRoot: string,
  topic: string,
  content: string,
): Promise<string> {
  const memoryDir = getMemoryDir(projectRoot);
  const topicFileName = normalizeTopicFileName(topic);
  const topicFilePath = getTopicFilePath(projectRoot, topicFileName);

  await ensureDir(memoryDir);
  await atomicWrite(topicFilePath, content);

  return topicFileName;
}

/**
 * 프로젝트의 모든 메모리 삭제 (MEMORY.md 비우기 + 토픽 파일 삭제)
 *
 * 주의: 이 작업은 되돌릴 수 없습니다.
 *
 * @param projectRoot - 프로젝트 루트 경로
 */
export async function clearMemory(projectRoot: string): Promise<void> {
  const memoryDir = getMemoryDir(projectRoot);
  const memoryFilePath = getMemoryFilePath(projectRoot);

  if (!existsSync(memoryDir)) {
    return; // 메모리 디렉토리가 없으면 이미 깨끗한 상태
  }

  // MEMORY.md를 빈 내용으로 덮어쓰기
  if (existsSync(memoryFilePath)) {
    await atomicWrite(memoryFilePath, "");
  }

  // 토픽 파일 삭제 (MEMORY.md는 유지)
  const { readdir, unlink } = await import("node:fs/promises");
  try {
    const entries = await readdir(memoryDir);
    const topicFiles = entries.filter((e) => e.endsWith(".md") && e !== "MEMORY.md");
    // 병렬로 삭제 (개별 실패는 무시)
    await Promise.all(topicFiles.map((f) => unlink(`${memoryDir}/${f}`).catch(() => undefined)));
  } catch {
    // 정리 에러는 무시 — 최선의 노력(best-effort) 삭제
  }
}

/**
 * 기존 메모리에 같은 내용이 이미 있는지 확인 (중복 감지)
 *
 * 대소문자를 무시하고 부분 문자열 포함 여부로 판단합니다.
 *
 * @param existingContent - 기존 MEMORY.md 내용
 * @param newContent - 추가하려는 새 내용
 * @returns 중복이면 true
 */
function isDuplicate(existingContent: string, newContent: string): boolean {
  if (!existingContent.trim()) return false;

  const normalizedNew = newContent.trim().toLowerCase();
  if (!normalizedNew) return false;

  // 대소문자 무시하여 기존 내용에 새 내용이 포함되어 있는지 확인
  const normalizedExisting = existingContent.toLowerCase();
  return normalizedExisting.includes(normalizedNew);
}

/**
 * 메모리 항목을 마크다운 리스트 형식으로 포맷팅
 *
 * @param entry - 포맷팅할 메모리 항목
 * @returns "- 내용" 형식의 문자열
 */
function formatEntryBlock(entry: MemoryEntry): string {
  return `- ${entry.content.trim()}`;
}

/**
 * MEMORY.md의 해당 토픽 섹션(## 제목)에 항목을 추가
 *
 * 섹션이 이미 있으면 해당 섹션 끝에 항목을 추가합니다.
 * 섹션이 없으면 파일 끝에 새 섹션을 생성합니다.
 * 파일이 비어있으면 # Project Memory 헤더와 함께 생성합니다.
 *
 * @param existingContent - 기존 MEMORY.md 내용
 * @param topic - 토픽 이름 (## 섹션 제목으로 사용)
 * @param entryBlock - 추가할 포맷팅된 항목
 * @returns 항목이 추가된 전체 내용
 */
function appendToSection(existingContent: string, topic: string, entryBlock: string): string {
  const sectionHeader = `## ${capitalize(topic)}`;

  // 파일이 비어있으면 헤더와 함께 새로 생성
  if (!existingContent.trim()) {
    return `# Project Memory\n\n${sectionHeader}\n\n${entryBlock}\n`;
  }

  // 해당 섹션이 이미 존재하는지 확인
  const sectionRegex = new RegExp(`^## ${escapeRegex(capitalize(topic))}$`, "m");
  if (sectionRegex.test(existingContent)) {
    // 섹션을 찾아 그 끝(다음 ##나 파일 끝 직전)에 항목 추가
    const lines = existingContent.split("\n");
    const result: string[] = [];
    let inTargetSection = false;
    let appended = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line === sectionHeader) {
        inTargetSection = true;
        result.push(line);
        continue;
      }

      // 대상 섹션 내에서 다음 ## 헤더를 만나면, 그 앞에 항목 삽입
      if (inTargetSection && line.startsWith("## ") && !appended) {
        result.push(entryBlock);
        result.push("");
        appended = true;
        inTargetSection = false;
      }

      result.push(line);
    }

    // 파일 끝까지 대상 섹션이 계속된 경우 — 마지막에 추가
    if (!appended) {
      const lastLine = result[result.length - 1];
      if (lastLine !== undefined && lastLine.trim() !== "") {
        result.push(entryBlock);
      } else {
        result.push(entryBlock);
      }
    }

    return result.join("\n");
  }

  // 섹션이 존재하지 않으면 파일 끝에 새 섹션 추가
  const trimmed = existingContent.trimEnd();
  return `${trimmed}\n\n${sectionHeader}\n\n${entryBlock}\n`;
}

/**
 * MEMORY.md가 maxLines를 초과할 때 overflow 처리
 *
 * 오래된 섹션(앞쪽)을 개별 토픽 파일로 분리하고,
 * MEMORY.md에는 토픽 파일 링크와 최근 섹션만 남깁니다.
 *
 * 전략:
 * - 최근 2개 섹션은 MEMORY.md에 유지
 * - 나머지 섹션은 토픽 파일로 이동
 * - MEMORY.md에 "Archived Topics" 섹션으로 링크 추가
 *
 * @param projectRoot - 프로젝트 루트 경로
 * @param content - overflow된 전체 내용
 * @param maxLines - 목표 최대 줄 수
 */
async function handleOverflow(
  projectRoot: string,
  content: string,
  maxLines: number,
): Promise<void> {
  const memoryFilePath = getMemoryFilePath(projectRoot);
  const lines = content.split("\n");

  // 내용을 ## 섹션 단위로 분리
  const sections = parseSections(content);

  // 섹션이 1개 이하면 분리할 수 없으므로 단순 잘라내기
  if (sections.length <= 1) {
    const truncated = lines.slice(0, maxLines).join("\n") + "\n";
    await atomicWrite(memoryFilePath, truncated);
    return;
  }

  // 최근 2개 섹션은 유지, 나머지는 토픽 파일로 분리
  const keepCount = Math.min(2, sections.length);
  const overflowSections = sections.slice(0, sections.length - keepCount); // 이동할 오래된 섹션
  const keepSections = sections.slice(sections.length - keepCount); // MEMORY.md에 유지할 최근 섹션

  // 오래된 섹션을 토픽 파일로 저장
  const topicLinks: string[] = [];
  for (const section of overflowSections) {
    const topicFileName = await writeTopicFile(projectRoot, section.name, section.content);
    topicLinks.push(`- [${section.name}](./${topicFileName})`);
  }

  // MEMORY.md 재구성: 아카이브 링크 + 최근 섹션
  const parts: string[] = ["# Project Memory\n"];

  if (topicLinks.length > 0) {
    parts.push("## Archived Topics\n");
    parts.push(topicLinks.join("\n"));
    parts.push("");
  }

  for (const section of keepSections) {
    parts.push(section.content);
  }

  const newContent = parts.join("\n").trimEnd() + "\n";
  await atomicWrite(memoryFilePath, newContent);
}

/**
 * MEMORY.md 내용을 ## 섹션 단위로 분리
 *
 * @param content - MEMORY.md 전체 내용
 * @returns 섹션 이름과 내용의 배열
 */
function parseSections(
  content: string,
): readonly { readonly name: string; readonly content: string }[] {
  const lines = content.split("\n");
  const sections: { readonly name: string; readonly content: string }[] = [];
  let currentName = "";
  let currentLines: string[] = [];

  for (const line of lines) {
    // ## 로 시작하는 줄이 섹션 헤더
    const match = /^## (.+)$/.exec(line);
    if (match) {
      // 이전 섹션이 있으면 저장
      if (currentName) {
        sections.push({ name: currentName, content: currentLines.join("\n").trimEnd() });
      }
      currentName = match[1];
      currentLines = [line];
    } else if (currentName) {
      currentLines.push(line);
    }
  }

  // 마지막 섹션 저장
  if (currentName) {
    sections.push({ name: currentName, content: currentLines.join("\n").trimEnd() });
  }

  return sections;
}

/**
 * 문자열의 첫 글자를 대문자로 변환
 *
 * @param s - 변환할 문자열
 * @returns 첫 글자가 대문자인 문자열
 */
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * 정규식 특수 문자를 이스케이프
 *
 * 사용자 입력(토픽 이름 등)을 정규식에 안전하게 삽입하기 위해 사용합니다.
 *
 * @param s - 이스케이프할 문자열
 * @returns 특수 문자가 이스케이프된 문자열
 */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 파일을 안전하게 읽기 — 파일이 없으면 빈 문자열 반환
 *
 * @param filePath - 읽을 파일 경로
 * @returns 파일 내용 또는 빈 문자열
 */
async function readFileSafe(filePath: string): Promise<string> {
  if (!existsSync(filePath)) return "";
  try {
    return await readFile(filePath, "utf-8");
  } catch {
    return "";
  }
}

/**
 * 디렉토리 존재를 보장 — 없으면 중간 디렉토리까지 모두 생성
 *
 * @param dirPath - 보장할 디렉토리 경로
 */
async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

/**
 * 원자적(atomic) 파일 쓰기 — 임시 파일에 먼저 쓰고 rename으로 교체
 *
 * 이 방식을 사용하는 이유:
 * - 쓰기 중 프로세스가 죽어도 기존 파일이 손상되지 않음
 * - rename은 같은 파일시스템에서 원자적 작업이므로 부분 쓰기 없음
 *
 * 흐름: 내용 → {파일}.tmp.{타임스탬프} → rename → {파일}
 *
 * @param filePath - 최종 파일 경로
 * @param content - 쓸 내용
 * @throws MemoryWriteError - 쓰기 또는 rename 실패 시
 */
async function atomicWrite(filePath: string, content: string): Promise<void> {
  const dir = dirname(filePath);
  // 타임스탬프를 포함한 임시 파일명으로 충돌 방지
  const tmpPath = `${filePath}.tmp.${Date.now()}`;

  try {
    await mkdir(dir, { recursive: true });
    // 1단계: 임시 파일에 내용 쓰기
    await writeFile(tmpPath, content, "utf-8");
    // 2단계: 원자적 rename으로 최종 파일로 교체
    await rename(tmpPath, filePath);
  } catch (error: unknown) {
    // 실패 시 임시 파일 정리 (최선의 노력)
    try {
      const { unlink } = await import("node:fs/promises");
      await unlink(tmpPath);
    } catch {
      // 정리 실패는 무시
    }
    throw new MemoryWriteError("Failed to write memory file atomically", {
      filePath,
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}

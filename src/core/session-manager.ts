/**
 * 세션 관리자(Session Manager) 모듈
 *
 * 대화 세션의 생성, 저장, 복원, 삭제 등 전체 라이프사이클을 관리합니다.
 * 세션 데이터는 JSONL(JSON Lines) 형식으로 저장되며,
 * 파일 잠금(lock)으로 동시 접근 안전성을 보장합니다.
 *
 * 주니어 개발자를 위한 설명:
 * - 세션이란? 사용자와 AI 간의 하나의 대화를 의미합니다
 * - 세션을 저장하면 나중에 이어서 대화할 수 있습니다
 * - JSONL 형식: 한 줄에 하나의 JSON 객체, 로그처럼 추가(append)하기 좋은 형식
 * - 파일 잠금: 동시에 두 프로세스가 같은 파일을 수정하지 못하게 방지
 * - 원자적 쓰기(atomic write): 임시 파일에 쓴 뒤 이름을 바꿔서 데이터 손실 방지
 *
 * 디렉토리 구조:
 * ```
 * ~/.dhelix/sessions/
 * ├── index.json               # 전체 세션 목록 (경량 인덱스)
 * ├── {session-id}/
 * │   ├── transcript.jsonl     # 메시지 기록 (한 줄 = 한 메시지)
 * │   └── metadata.json        # 세션 메타데이터
 * ```
 */
import { mkdir, readFile, writeFile, readdir, stat, rename } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { type ChatMessage } from "../llm/provider.js";
import { SESSIONS_DIR } from "../constants.js";
import { BaseError } from "../utils/error.js";

/** 기본 파일 잠금 획득 타임아웃 (밀리초) */
const LOCK_TIMEOUT_MS = 5000;

/** 잠금 획득 재시도 간격 (밀리초) */
const LOCK_RETRY_MS = 50;

/**
 * 오래된(stale) 잠금 판정 기준 시간 (밀리초)
 * 이 시간보다 오래된 잠금은 이전 프로세스가 비정상 종료한 것으로 간주하고 제거합니다.
 */
const STALE_LOCK_MS = 30_000;

/**
 * 파일 내용을 원자적(atomic)으로 씁니다.
 *
 * "원자적 쓰기"란?
 * 1. 임시 파일에 내용을 먼저 씁니다
 * 2. rename()으로 임시 파일을 목적 파일로 교체합니다
 * rename()은 OS 수준에서 원자적이므로, 쓰기 도중 크래시가 나도 파일이 깨지지 않습니다.
 *
 * @param filePath - 최종 파일 경로
 * @param content - 쓸 내용
 */
export async function atomicWrite(filePath: string, content: string): Promise<void> {
  // 고유한 임시 파일 이름 생성 (PID + 타임스탬프로 충돌 방지)
  const tmpPath = `${filePath}.tmp.${process.pid}.${Date.now()}`;
  try {
    await writeFile(tmpPath, content, "utf-8");
    await rename(tmpPath, filePath); // 원자적 교체
  } catch (err) {
    // 실패 시 임시 파일 정리
    try {
      const { unlink } = await import("node:fs/promises");
      await unlink(tmpPath);
    } catch {
      // 정리 실패는 무시
    }
    throw err;
  }
}

/**
 * 디렉토리 기반 파일 잠금을 사용하여 함수를 실행합니다.
 *
 * mkdir()의 원자성을 이용한 잠금 메커니즘:
 * - mkdir()은 디렉토리가 이미 존재하면 EEXIST 에러를 반환합니다
 * - 이 특성을 이용해 "잠금 디렉토리 생성 = 잠금 획득"으로 사용합니다
 * - 크래시 복구: PID와 타임스탬프를 기록하여 오래된 잠금을 감지하고 제거합니다
 *
 * @param lockDir - 잠금으로 사용할 디렉토리 경로
 * @param fn - 잠금을 보유한 상태에서 실행할 함수
 * @param timeoutMs - 잠금 획득 타임아웃 (밀리초)
 * @returns 함수 fn의 반환값
 * @throws SessionError - 타임아웃 내에 잠금을 획득하지 못한 경우
 */
export async function withFileLock<T>(
  lockDir: string,
  fn: () => Promise<T>,
  timeoutMs: number = LOCK_TIMEOUT_MS,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  const pidFile = join(lockDir, "pid");

  while (true) {
    try {
      // 잠금 디렉토리 생성 시도 (recursive: false → 이미 있으면 EEXIST)
      await mkdir(lockDir, { recursive: false });
      // 잠금 획득 성공 → PID 파일에 프로세스 정보 기록 (오래된 잠금 감지용)
      try {
        await writeFile(pidFile, `${process.pid}\n${Date.now()}`, "utf-8");
      } catch {
        // PID 기록 실패는 치명적이지 않음 — 잠금은 이미 획득됨
      }
      try {
        return await fn(); // 잠금 보유 상태에서 함수 실행
      } finally {
        // 함수 완료 후 잠금 해제 (디렉토리 삭제)
        try {
          const { rm } = await import("node:fs/promises");
          await rm(lockDir, { recursive: true, force: true });
        } catch {
          // 해제 실패는 무시 (다음 잠금 시 오래된 잠금으로 처리됨)
        }
      }
    } catch (err: unknown) {
      const error = err as NodeJS.ErrnoException;
      // EEXIST가 아닌 에러는 재시도 없이 즉시 전파
      if (error.code !== "EEXIST") {
        throw err;
      }

      // 다른 프로세스가 잠금을 보유 중 → 오래된 잠금인지 확인
      try {
        const pidContent = await readFile(pidFile, "utf-8");
        const [, timestampStr] = pidContent.split("\n");
        const lockTime = parseInt(timestampStr, 10);
        // STALE_LOCK_MS(30초)보다 오래된 잠금은 비정상 종료로 간주하고 제거
        if (!isNaN(lockTime) && Date.now() - lockTime > STALE_LOCK_MS) {
          try {
            const { rm } = await import("node:fs/promises");
            await rm(lockDir, { recursive: true, force: true });
          } catch {
            // 다른 프로세스가 이미 정리했을 수 있음
          }
          continue; // 즉시 재시도
        }
      } catch {
        // PID 파일을 읽을 수 없음 → 디렉토리 수정 시각으로 판단
        try {
          const lockStat = await stat(lockDir);
          if (Date.now() - lockStat.mtimeMs > STALE_LOCK_MS) {
            try {
              const { rm } = await import("node:fs/promises");
              await rm(lockDir, { recursive: true, force: true });
            } catch {
              // 다른 프로세스가 이미 정리했을 수 있음
            }
            continue;
          }
        } catch {
          // 잠금 디렉토리가 사라짐 → 재시도
          continue;
        }
      }

      // 타임아웃 확인
      if (Date.now() > deadline) {
        throw new SessionError("Lock acquisition timeout", { lockDir, timeoutMs });
      }
      // 짧은 대기 후 재시도
      await new Promise((r) => setTimeout(r, LOCK_RETRY_MS));
    }
  }
}

/**
 * 세션 관리 관련 에러 클래스
 */
export class SessionError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "SESSION_ERROR", context);
  }
}

/**
 * 세션 메타데이터 (metadata.json에 저장되는 정보)
 *
 * @property id - 세션 고유 식별자 (UUID)
 * @property name - 세션 이름 (자동 또는 수동 설정)
 * @property createdAt - 생성 시각 (ISO 8601)
 * @property lastUsedAt - 마지막 사용 시각 (ISO 8601)
 * @property workingDirectory - 이 세션이 시작된 작업 디렉토리
 * @property model - 사용된 LLM 모델명
 * @property messageCount - 총 메시지 수
 */
export interface SessionMetadata {
  readonly id: string;
  readonly name: string;
  readonly createdAt: string;
  readonly lastUsedAt: string;
  readonly workingDirectory: string;
  readonly model: string;
  readonly messageCount: number;
}

/**
 * 세션 인덱스 항목 (index.json에 저장되는 경량 참조)
 * 전체 메타데이터의 핵심 정보만 담고 있어 목록 조회 시 빠르게 로드할 수 있습니다.
 */
export interface SessionIndexEntry {
  readonly id: string;
  readonly name: string;
  readonly createdAt: string;
  readonly lastUsedAt: string;
  readonly messageCount: number;
}

/**
 * JSONL 파일의 한 줄을 나타내는 메시지 구조
 * 각 메시지는 한 줄의 JSON으로 저장됩니다.
 */
interface JsonlMessage {
  readonly role: string;
  readonly content: string;
  readonly timestamp: string;
  readonly toolCallId?: string;
  readonly toolCalls?: readonly { id: string; name: string; arguments: string }[];
}

/**
 * 첫 번째 사용자 메시지로부터 세션 이름을 자동 생성합니다.
 * 줄바꿈과 연속 공백을 정리하고 50자로 잘라냅니다.
 *
 * @param firstUserMessage - 첫 번째 사용자 메시지 텍스트
 * @returns 50자 이내의 세션 이름
 */
function generateSessionName(firstUserMessage: string): string {
  const cleaned = firstUserMessage.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
  if (cleaned.length <= 50) {
    return cleaned;
  }
  return cleaned.slice(0, 47) + "...";
}

/**
 * 세션 관리자 — 대화 세션의 전체 라이프사이클을 관리합니다.
 *
 * 주요 기능:
 * - 세션 생성/삭제/이름 변경
 * - 메시지 추가(append) 및 로드
 * - 세션 목록 조회 (최근 사용 순)
 * - 세션 포크(fork) — 기존 대화를 복제하여 분기
 * - 파일 잠금으로 동시 접근 안전성 보장
 */
export class SessionManager {
  /** 세션 데이터가 저장되는 루트 디렉토리 */
  private readonly sessionsDir: string;

  /**
   * @param sessionsDir - 세션 저장 디렉토리 (기본값: ~/.dhelix/sessions/)
   */
  constructor(sessionsDir?: string) {
    this.sessionsDir = sessionsDir ?? SESSIONS_DIR;
  }

  /** 세션 저장 디렉토리가 존재하도록 보장합니다 */
  private async ensureDir(): Promise<void> {
    await mkdir(this.sessionsDir, { recursive: true });
  }

  /** 특정 세션의 잠금 디렉토리 경로 */
  private sessionLockDir(sessionId: string): string {
    return join(this.sessionDir(sessionId), ".lock");
  }

  /** 인덱스 파일의 잠금 디렉토리 경로 */
  private indexLockDir(): string {
    return join(this.sessionsDir, ".index.lock");
  }

  /** 특정 세션의 디렉토리 경로 */
  private sessionDir(sessionId: string): string {
    return join(this.sessionsDir, sessionId);
  }

  /** 특정 세션의 대화 기록(transcript) 파일 경로 */
  private transcriptPath(sessionId: string): string {
    return join(this.sessionDir(sessionId), "transcript.jsonl");
  }

  /** 특정 세션의 메타데이터 파일 경로 */
  private metadataPath(sessionId: string): string {
    return join(this.sessionDir(sessionId), "metadata.json");
  }

  /** 세션 인덱스 파일 경로 */
  private indexPath(): string {
    return join(this.sessionsDir, "index.json");
  }

  /**
   * 새 세션을 생성합니다.
   *
   * 세션 디렉토리, 빈 대화 기록 파일, 메타데이터 파일을 생성하고
   * 인덱스에 등록합니다.
   *
   * @param options - 세션 생성 옵션 (작업 디렉토리, 모델, 이름)
   * @returns 생성된 세션의 UUID
   */
  async createSession(options: {
    readonly workingDirectory: string;
    readonly model: string;
    readonly name?: string;
  }): Promise<string> {
    await this.ensureDir();
    const id = randomUUID();
    const now = new Date().toISOString();

    const metadata: SessionMetadata = {
      id,
      name: options.name ?? "New session",
      createdAt: now,
      lastUsedAt: now,
      workingDirectory: options.workingDirectory,
      model: options.model,
      messageCount: 0,
    };

    const dir = this.sessionDir(id);
    await mkdir(dir, { recursive: true });
    // 메타데이터는 원자적으로 쓰기 (크래시 시 데이터 보호)
    await atomicWrite(this.metadataPath(id), JSON.stringify(metadata, null, 2));
    // 빈 대화 기록 파일 생성
    await writeFile(this.transcriptPath(id), "", "utf-8");

    // 인덱스에 새 세션 등록
    await this.updateIndex(id, metadata);

    return id;
  }

  /**
   * 세션 대화 기록에 메시지를 하나 추가합니다.
   * JSONL 형식으로 한 줄을 추가하고, 메타데이터(lastUsedAt, messageCount)를 업데이트합니다.
   *
   * 파일 잠금을 사용하여 동시 쓰기를 방지합니다.
   *
   * @param sessionId - 대상 세션 ID
   * @param message - 추가할 메시지
   */
  async appendMessage(sessionId: string, message: ChatMessage): Promise<void> {
    const jsonlLine: JsonlMessage = {
      role: message.role,
      content: message.content,
      timestamp: new Date().toISOString(),
      toolCallId: message.toolCallId,
      toolCalls: message.toolCalls,
    };

    const line = JSON.stringify(jsonlLine) + "\n";

    // 파일 잠금 내에서 읽기-수정-쓰기 수행 (경쟁 조건 방지)
    await withFileLock(this.sessionLockDir(sessionId), async () => {
      const transcriptFile = this.transcriptPath(sessionId);
      const existing = await this.safeReadFile(transcriptFile);
      await atomicWrite(transcriptFile, existing + line);

      // 메타데이터 업데이트: 사용 시각 갱신 + 메시지 수 증가
      await this.updateMetadataUnsafe(sessionId, (meta) => ({
        ...meta,
        lastUsedAt: new Date().toISOString(),
        messageCount: meta.messageCount + 1,
      }));
    });
  }

  /**
   * 여러 메시지를 한번에 추가합니다 (배치 쓰기).
   * 개별 추가보다 효율적입니다 (잠금 1회, 디스크 쓰기 1회).
   *
   * @param sessionId - 대상 세션 ID
   * @param messages - 추가할 메시지 배열
   */
  async appendMessages(sessionId: string, messages: readonly ChatMessage[]): Promise<void> {
    if (messages.length === 0) return;

    const lines = messages.map((message) => {
      const jsonlLine: JsonlMessage = {
        role: message.role,
        content: message.content,
        timestamp: new Date().toISOString(),
        toolCallId: message.toolCallId,
        toolCalls: message.toolCalls,
      };
      return JSON.stringify(jsonlLine);
    });

    await withFileLock(this.sessionLockDir(sessionId), async () => {
      const transcriptFile = this.transcriptPath(sessionId);
      const existing = await this.safeReadFile(transcriptFile);
      await atomicWrite(transcriptFile, existing + lines.join("\n") + "\n");

      await this.updateMetadataUnsafe(sessionId, (meta) => ({
        ...meta,
        lastUsedAt: new Date().toISOString(),
        messageCount: meta.messageCount + messages.length,
      }));
    });
  }

  /**
   * 세션의 전체 대화 기록을 로드합니다.
   * JSONL 파일의 각 줄을 파싱하여 ChatMessage 배열로 변환합니다.
   *
   * @param sessionId - 로드할 세션 ID
   * @returns 메시지 배열
   * @throws SessionError - 대화 기록 파싱 실패 시
   */
  async loadMessages(sessionId: string): Promise<readonly ChatMessage[]> {
    const transcriptFile = this.transcriptPath(sessionId);
    const content = await this.safeReadFile(transcriptFile);

    if (!content.trim()) {
      return [];
    }

    const messages: ChatMessage[] = [];
    const lines = content.trim().split("\n");

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line) as JsonlMessage;
        const msg: ChatMessage = {
          role: parsed.role as ChatMessage["role"],
          content: parsed.content,
          toolCallId: parsed.toolCallId,
          toolCalls: parsed.toolCalls,
        };
        messages.push(msg);
      } catch {
        throw new SessionError("Failed to parse session transcript line", {
          sessionId,
          line,
        });
      }
    }

    return messages;
  }

  /**
   * 세션 메타데이터를 조회합니다.
   *
   * @param sessionId - 조회할 세션 ID
   * @returns 세션 메타데이터
   * @throws SessionError - 세션을 찾을 수 없는 경우
   */
  async getMetadata(sessionId: string): Promise<SessionMetadata> {
    const metaFile = this.metadataPath(sessionId);
    try {
      const content = await readFile(metaFile, "utf-8");
      return JSON.parse(content) as SessionMetadata;
    } catch {
      throw new SessionError("Session not found", { sessionId });
    }
  }

  /**
   * 모든 세션 목록을 조회합니다.
   * lastUsedAt 기준 내림차순(최근 사용 순)으로 정렬됩니다.
   *
   * @returns 세션 인덱스 항목 배열
   */
  async listSessions(): Promise<readonly SessionIndexEntry[]> {
    const indexFile = this.indexPath();
    try {
      const content = await readFile(indexFile, "utf-8");
      const entries = JSON.parse(content) as SessionIndexEntry[];
      return [...entries].sort(
        (a, b) => new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime(),
      );
    } catch {
      // 인덱스 파일이 없으면 빈 배열 반환
      return [];
    }
  }

  /**
   * 가장 최근에 사용한 세션의 ID를 반환합니다.
   *
   * @returns 최근 세션 ID, 세션이 없으면 null
   */
  async getMostRecentSessionId(): Promise<string | null> {
    const sessions = await this.listSessions();
    return sessions.length > 0 ? sessions[0].id : null;
  }

  /**
   * 세션 이름을 변경합니다.
   *
   * @param sessionId - 대상 세션 ID
   * @param name - 새 이름
   */
  async renameSession(sessionId: string, name: string): Promise<void> {
    await withFileLock(this.sessionLockDir(sessionId), async () => {
      await this.updateMetadataUnsafe(sessionId, (meta) => ({
        ...meta,
        name,
      }));
    });
  }

  /**
   * 첫 번째 사용자 메시지로부터 세션 이름을 자동 설정합니다.
   *
   * @param sessionId - 대상 세션 ID
   * @param firstUserMessage - 첫 번째 사용자 메시지 텍스트
   */
  async autoNameSession(sessionId: string, firstUserMessage: string): Promise<void> {
    const name = generateSessionName(firstUserMessage);
    await this.renameSession(sessionId, name);
  }

  /**
   * 세션을 포크(fork)합니다 — 기존 대화를 복제하여 새 세션을 만듭니다.
   *
   * "포크"란? 현재까지의 대화를 그대로 복사한 새 세션을 만드는 것입니다.
   * 원본 세션은 그대로 유지되고, 분기된 새 세션에서 다른 방향으로 대화를 이어갈 수 있습니다.
   *
   * @param sourceSessionId - 원본 세션 ID
   * @param options - 포크 옵션 (새 세션 이름 등)
   * @returns 새로 생성된 세션의 ID
   */
  async forkSession(
    sourceSessionId: string,
    options?: { readonly name?: string },
  ): Promise<string> {
    const sourceMeta = await this.getMetadata(sourceSessionId);
    const sourceTranscript = await this.safeReadFile(this.transcriptPath(sourceSessionId));

    const id = randomUUID();
    const now = new Date().toISOString();
    const name = options?.name ?? `Fork of ${sourceMeta.name}`;

    const metadata: SessionMetadata = {
      id,
      name,
      createdAt: now,
      lastUsedAt: now,
      workingDirectory: sourceMeta.workingDirectory,
      model: sourceMeta.model,
      messageCount: sourceMeta.messageCount,
    };

    const dir = this.sessionDir(id);
    await mkdir(dir, { recursive: true });
    await atomicWrite(this.metadataPath(id), JSON.stringify(metadata, null, 2));
    // 원본 대화 기록을 그대로 복사
    await atomicWrite(this.transcriptPath(id), sourceTranscript);
    await this.updateIndex(id, metadata);

    return id;
  }

  /**
   * 세션을 삭제합니다.
   * 세션 디렉토리와 모든 파일을 삭제하고 인덱스에서 제거합니다.
   *
   * @param sessionId - 삭제할 세션 ID
   * @throws SessionError - 삭제 실패 시
   */
  async deleteSession(sessionId: string): Promise<void> {
    const dir = this.sessionDir(sessionId);

    // 세션 디렉토리 내 파일들을 먼저 정리한 뒤 디렉토리 삭제
    try {
      const files = await readdir(dir);
      for (const file of files) {
        const filePath = join(dir, file);
        const fileStat = await stat(filePath);
        if (fileStat.isFile()) {
          await writeFile(filePath, "", "utf-8"); // 내용 삭제 후
        }
      }
      // 디렉토리 재귀 삭제
      const { rm } = await import("node:fs/promises");
      await rm(dir, { recursive: true, force: true });
    } catch {
      throw new SessionError("Failed to delete session", { sessionId });
    }

    // 인덱스에서 해당 세션 항목 제거
    await this.removeFromIndex(sessionId);
  }

  /**
   * 파일을 안전하게 읽습니다 (없으면 빈 문자열 반환).
   */
  private async safeReadFile(filePath: string): Promise<string> {
    try {
      return await readFile(filePath, "utf-8");
    } catch {
      return "";
    }
  }

  /**
   * 세션 잠금 없이 메타데이터를 업데이트합니다.
   * 반드시 세션 잠금 컨텍스트 내에서 호출해야 합니다.
   *
   * @param sessionId - 대상 세션 ID
   * @param updater - 기존 메타데이터를 받아 새 메타데이터를 반환하는 함수
   */
  private async updateMetadataUnsafe(
    sessionId: string,
    updater: (meta: SessionMetadata) => SessionMetadata,
  ): Promise<void> {
    const meta = await this.getMetadata(sessionId);
    const updated = updater(meta);
    await atomicWrite(this.metadataPath(sessionId), JSON.stringify(updated, null, 2));
    await this.updateIndex(sessionId, updated);
  }

  /**
   * 세션 인덱스를 업데이트합니다 (인덱스 잠금 획득).
   * 이미 존재하는 항목이면 갱신하고, 새 항목이면 추가합니다.
   */
  private async updateIndex(sessionId: string, metadata: SessionMetadata): Promise<void> {
    await withFileLock(this.indexLockDir(), async () => {
      const entries = await this.loadIndex();
      const entry: SessionIndexEntry = {
        id: sessionId,
        name: metadata.name,
        createdAt: metadata.createdAt,
        lastUsedAt: metadata.lastUsedAt,
        messageCount: metadata.messageCount,
      };

      const existingIdx = entries.findIndex((e) => e.id === sessionId);
      const updated =
        existingIdx >= 0
          ? entries.map((e, i) => (i === existingIdx ? entry : e))
          : [...entries, entry];

      await atomicWrite(this.indexPath(), JSON.stringify(updated, null, 2));
    });
  }

  /**
   * 인덱스에서 세션 항목을 제거합니다 (인덱스 잠금 획득).
   */
  private async removeFromIndex(sessionId: string): Promise<void> {
    await withFileLock(this.indexLockDir(), async () => {
      const entries = await this.loadIndex();
      const filtered = entries.filter((e) => e.id !== sessionId);
      await atomicWrite(this.indexPath(), JSON.stringify(filtered, null, 2));
    });
  }

  /**
   * 세션 인덱스 파일을 로드합니다 (파일 없으면 빈 배열).
   */
  private async loadIndex(): Promise<SessionIndexEntry[]> {
    try {
      const content = await readFile(this.indexPath(), "utf-8");
      return JSON.parse(content) as SessionIndexEntry[];
    } catch {
      return [];
    }
  }
}

/**
 * Session Fork / Branch / Merge 모듈
 *
 * 세션을 특정 시점에서 분기(fork)하고, 다른 접근 방식을 시도한 뒤,
 * 결과를 부모 세션에 병합(merge)하는 기능을 제공합니다.
 *
 * 주요 기능:
 * - Fork: 부모 세션의 메시지를 분기 시점까지 복사하여 새 세션 생성
 * - Merge: fork 세션의 메시지를 부모에 병합 (adopt-all / cherry-pick / summary-only)
 * - Checkpoint: 세션 상태를 스냅샷하고 나중에 복원
 * - Compare: 여러 fork의 메시지/결과를 비교 요약
 *
 * 저장 구조:
 * ```
 * ~/.dhelix/sessions/{parentId}/forks.json       # fork 메타데이터
 * ~/.dhelix/sessions/{sessionId}/checkpoints/     # checkpoint 스냅샷
 * ```
 *
 * @module session-fork
 */
import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { type ChatMessage } from "../llm/provider.js";
import { SessionManager, SessionError } from "./session-manager.js";

// ─── Interfaces ──────────────────────────────────────────────────────────────

/**
 * Fork 생성 옵션
 */
export interface ForkOptions {
  /** 분기할 부모 세션 ID */
  readonly parentSessionId: string;
  /** 분기 시점 메시지 인덱스 (기본: 마지막 메시지) */
  readonly fromMessageIndex?: number;
  /** fork에 대한 설명 (라벨) */
  readonly description: string;
  /** 부모의 도구 실행 결과를 복사할지 (기본 true) */
  readonly inheritToolResults?: boolean;
}

/**
 * Fork 상태 — fork 세션의 라이프사이클 단계
 */
export type ForkStatus = "active" | "merged" | "abandoned";

/**
 * Fork 메타데이터 — forks.json에 저장되는 fork 정보
 */
export interface SessionFork {
  /** Fork 고유 식별자 (UUID) */
  readonly id: string;
  /** 분기 원본 세션 ID */
  readonly parentSessionId: string;
  /** 분기 시점 메시지 인덱스 */
  readonly parentMessageIndex: number;
  /** Fork 설명 (라벨) */
  readonly description: string;
  /** 생성 시각 (epoch ms) */
  readonly createdAt: number;
  /** 현재 상태 */
  readonly status: ForkStatus;
  /** Fork 세션의 메시지 수 */
  readonly messageCount: number;
}

/**
 * 병합 전략
 * - adopt-all: fork의 분기 이후 모든 메시지를 부모에 추가
 * - cherry-pick: 선택된 메시지만 부모에 추가 (messageIndices 필요)
 * - summary-only: fork 요약 텍스트만 부모에 추가
 */
export type MergeStrategy = "adopt-all" | "cherry-pick" | "summary-only";

/**
 * 병합 결과
 */
export interface MergeResult {
  /** 병합 성공 여부 */
  readonly success: boolean;
  /** 병합된 메시지 수 */
  readonly mergedMessages: number;
  /** 사용된 병합 전략 */
  readonly strategy: MergeStrategy;
  /** 충돌 사항 (있는 경우) */
  readonly conflicts?: readonly string[];
}

/**
 * 병합 옵션 — cherry-pick 전략 시 메시지 인덱스 지정
 */
export interface MergeOptions {
  /** cherry-pick 시 선택할 메시지 인덱스 배열 */
  readonly messageIndices?: readonly number[];
  /** summary-only 시 사용할 요약 텍스트 (미지정 시 자동 생성) */
  readonly summaryText?: string;
}

/**
 * Fork 비교 결과
 */
export interface ForkComparison {
  /** 비교 대상 fork ID 목록 */
  readonly forkIds: readonly string[];
  /** 각 fork의 메시지 수 */
  readonly messageCounts: Record<string, number>;
  /** 각 fork의 설명 */
  readonly descriptions: Record<string, string>;
  /** 각 fork의 마지막 메시지 요약 (최대 100자) */
  readonly lastMessages: Record<string, string>;
}

/**
 * Checkpoint 요약 정보
 */
export interface CheckpointSummary {
  /** Checkpoint 고유 식별자 */
  readonly id: string;
  /** 대상 세션 ID */
  readonly sessionId: string;
  /** 라벨 (선택) */
  readonly label: string | undefined;
  /** Checkpoint 시점의 메시지 수 */
  readonly messageCount: number;
  /** 생성 시각 (epoch ms) */
  readonly timestamp: number;
}

/**
 * 복원된 세션 정보
 */
export interface RestoredSession {
  /** 복원에 사용된 Checkpoint ID */
  readonly checkpointId: string;
  /** 새로 생성된 세션 ID */
  readonly sessionId: string;
  /** 복원된 메시지 수 */
  readonly messageCount: number;
}

// ─── Internal storage types ──────────────────────────────────────────────────

/**
 * forks.json에 저장되는 데이터 구조
 */
interface ForksFileData {
  readonly forks: readonly SessionFork[];
}

/**
 * checkpoint JSON에 저장되는 데이터 구조
 */
interface CheckpointData {
  readonly id: string;
  readonly sessionId: string;
  readonly label: string | undefined;
  readonly messages: readonly ChatMessage[];
  readonly timestamp: number;
}

// ─── SessionForkManager ──────────────────────────────────────────────────────

/**
 * 세션 분기(Fork) 관리자
 *
 * 세션을 특정 시점에서 분기하고, 병합하고, 비교하는 기능을 제공합니다.
 * Fork 메타데이터는 부모 세션 디렉토리의 forks.json에 저장되며,
 * fork 세션 자체는 기존 SessionManager를 통해 별도 세션으로 생성됩니다.
 *
 * @example
 * ```typescript
 * const sessionManager = new SessionManager();
 * const forkManager = new SessionForkManager(sessionManager, "/path/to/sessions");
 *
 * // Fork 생성
 * const fork = await forkManager.createFork({
 *   parentSessionId: "abc-123",
 *   description: "Try alternative approach",
 * });
 *
 * // Fork 병합
 * const result = await forkManager.merge(fork.id, "adopt-all");
 * ```
 */
export class SessionForkManager {
  private readonly sessionManager: SessionManager;
  private readonly sessionsDir: string;

  /**
   * @param sessionManager - 세션 생성/메시지 관리에 사용할 SessionManager 인스턴스
   * @param sessionsDir - 세션 데이터 저장 루트 디렉토리
   */
  constructor(sessionManager: SessionManager, sessionsDir: string) {
    this.sessionManager = sessionManager;
    this.sessionsDir = sessionsDir;
  }

  /**
   * 부모 세션에서 fork를 생성합니다.
   *
   * 부모 세션의 메시지를 분기 시점(fromMessageIndex)까지 복사하여
   * 새 세션을 만듭니다. inheritToolResults가 false면 tool role 메시지를 제외합니다.
   *
   * @param options - Fork 생성 옵션
   * @returns 생성된 SessionFork 메타데이터
   * @throws SessionError - 부모 세션이 존재하지 않거나, fromMessageIndex가 범위를 벗어난 경우
   */
  async createFork(options: ForkOptions): Promise<SessionFork> {
    const { parentSessionId, description, inheritToolResults = true } = options;

    // 부모 세션의 메시지 로드
    const parentMessages = await this.sessionManager.loadMessages(parentSessionId);
    if (parentMessages.length === 0 && options.fromMessageIndex !== undefined) {
      throw new SessionError("Cannot fork empty session with specific message index", {
        parentSessionId,
      });
    }

    const fromIndex = options.fromMessageIndex ?? parentMessages.length;
    if (fromIndex < 0 || fromIndex > parentMessages.length) {
      throw new SessionError("fromMessageIndex out of range", {
        parentSessionId,
        fromMessageIndex: fromIndex,
        totalMessages: parentMessages.length,
      });
    }

    // 분기 시점까지의 메시지 슬라이스
    let messagesToCopy = parentMessages.slice(0, fromIndex);

    // inheritToolResults가 false면 tool 메시지 제외
    if (!inheritToolResults) {
      messagesToCopy = messagesToCopy.filter((m) => m.role !== "tool");
    }

    // 부모 세션의 메타데이터에서 모델/작업 디렉토리 가져오기
    const parentMeta = await this.sessionManager.getMetadata(parentSessionId);

    // 새 세션 생성
    const forkSessionId = await this.sessionManager.createSession({
      workingDirectory: parentMeta.workingDirectory,
      model: parentMeta.model,
      name: `Fork: ${description}`,
    });

    // 메시지 복사
    if (messagesToCopy.length > 0) {
      await this.sessionManager.appendMessages(forkSessionId, messagesToCopy);
    }

    // Fork 메타데이터 생성
    const fork: SessionFork = {
      id: forkSessionId,
      parentSessionId,
      parentMessageIndex: fromIndex,
      description,
      createdAt: Date.now(),
      status: "active",
      messageCount: messagesToCopy.length,
    };

    // forks.json에 저장
    await this.saveForkMetadata(parentSessionId, fork);

    return fork;
  }

  /**
   * 부모 세션의 모든 fork 목록을 조회합니다.
   *
   * @param parentSessionId - 부모 세션 ID
   * @returns Fork 메타데이터 배열 (생성 시간 순)
   */
  async listForks(parentSessionId: string): Promise<readonly SessionFork[]> {
    const data = await this.loadForksFile(parentSessionId);
    return data.forks;
  }

  /**
   * 특정 fork를 조회합니다.
   *
   * @param forkId - Fork 세션 ID
   * @returns Fork 메타데이터 또는 undefined
   */
  async getFork(forkId: string): Promise<SessionFork | undefined> {
    // forkId로 모든 세션의 forks.json을 탐색 (fork의 parentSessionId를 모르므로)
    const sessionDirs = await this.listSessionDirs();
    for (const dirName of sessionDirs) {
      const data = await this.loadForksFile(dirName);
      const found = data.forks.find((f) => f.id === forkId);
      if (found) {
        return found;
      }
    }
    return undefined;
  }

  /**
   * Fork를 부모 세션에 병합합니다.
   *
   * 전략별 동작:
   * - adopt-all: fork의 분기 이후 모든 메시지를 부모에 추가
   * - cherry-pick: mergeOptions.messageIndices에 지정된 메시지만 추가
   * - summary-only: fork 요약 텍스트를 시스템 메시지로 부모에 추가
   *
   * @param forkId - 병합할 Fork 세션 ID
   * @param strategy - 병합 전략
   * @param mergeOptions - 추가 옵션 (cherry-pick 인덱스, 요약 텍스트 등)
   * @returns 병합 결과
   * @throws SessionError - fork를 찾을 수 없거나, 이미 병합/폐기된 경우
   */
  async merge(
    forkId: string,
    strategy: MergeStrategy,
    mergeOptions?: MergeOptions,
  ): Promise<MergeResult> {
    const fork = await this.getFork(forkId);
    if (!fork) {
      throw new SessionError("Fork not found", { forkId });
    }
    if (fork.status !== "active") {
      throw new SessionError("Fork is not active", { forkId, status: fork.status });
    }

    const forkMessages = await this.sessionManager.loadMessages(forkId);
    // 분기 이후 추가된 메시지만 대상
    const newMessages = forkMessages.slice(fork.parentMessageIndex);

    let mergedMessages: readonly ChatMessage[];
    const conflicts: string[] = [];

    switch (strategy) {
      case "adopt-all": {
        mergedMessages = newMessages;
        break;
      }
      case "cherry-pick": {
        const indices = mergeOptions?.messageIndices ?? [];
        if (indices.length === 0) {
          conflicts.push("No message indices provided for cherry-pick");
          mergedMessages = [];
        } else {
          mergedMessages = indices
            .filter((i) => i >= 0 && i < newMessages.length)
            .map((i) => newMessages[i]);
          const invalidIndices = indices.filter((i) => i < 0 || i >= newMessages.length);
          if (invalidIndices.length > 0) {
            conflicts.push(`Invalid indices: ${invalidIndices.join(", ")}`);
          }
        }
        break;
      }
      case "summary-only": {
        const summaryText =
          mergeOptions?.summaryText ?? this.generateForkSummary(fork, newMessages);
        mergedMessages = [
          {
            role: "system" as const,
            content: `[Fork merged: ${fork.description}] ${summaryText}`,
          },
        ];
        break;
      }
    }

    // 부모 세션에 메시지 추가
    if (mergedMessages.length > 0) {
      await this.sessionManager.appendMessages(fork.parentSessionId, mergedMessages);
    }

    // Fork 상태를 merged로 업데이트
    await this.updateForkStatus(fork.parentSessionId, forkId, "merged");

    return {
      success: true,
      mergedMessages: mergedMessages.length,
      strategy,
      conflicts: conflicts.length > 0 ? conflicts : undefined,
    };
  }

  /**
   * Fork를 폐기합니다.
   * 상태를 "abandoned"로 변경합니다. 세션 데이터는 보존됩니다.
   *
   * @param forkId - 폐기할 Fork 세션 ID
   * @throws SessionError - fork를 찾을 수 없는 경우
   */
  async abandon(forkId: string): Promise<void> {
    const fork = await this.getFork(forkId);
    if (!fork) {
      throw new SessionError("Fork not found", { forkId });
    }
    await this.updateForkStatus(fork.parentSessionId, forkId, "abandoned");
  }

  /**
   * 여러 fork를 비교합니다.
   * 각 fork의 메시지 수, 설명, 마지막 메시지 요약을 반환합니다.
   *
   * @param forkIds - 비교할 Fork ID 배열
   * @returns Fork 비교 결과
   */
  async compareForks(forkIds: readonly string[]): Promise<ForkComparison> {
    const messageCounts: Record<string, number> = {};
    const descriptions: Record<string, string> = {};
    const lastMessages: Record<string, string> = {};

    for (const forkId of forkIds) {
      const fork = await this.getFork(forkId);
      if (!fork) {
        descriptions[forkId] = "(not found)";
        messageCounts[forkId] = 0;
        lastMessages[forkId] = "";
        continue;
      }

      descriptions[forkId] = fork.description;

      const messages = await this.sessionManager.loadMessages(forkId);
      messageCounts[forkId] = messages.length;

      const lastMsg = messages[messages.length - 1];
      if (lastMsg) {
        const content = typeof lastMsg.content === "string" ? lastMsg.content : "";
        lastMessages[forkId] = content.length > 100 ? content.slice(0, 97) + "..." : content;
      } else {
        lastMessages[forkId] = "";
      }
    }

    return { forkIds, messageCounts, descriptions, lastMessages };
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  /**
   * Fork 메시지로부터 간단한 요약을 생성합니다 (summary-only 전략용).
   */
  private generateForkSummary(fork: SessionFork, newMessages: readonly ChatMessage[]): string {
    const userMsgs = newMessages.filter((m) => m.role === "user").length;
    const assistantMsgs = newMessages.filter((m) => m.role === "assistant").length;
    const toolMsgs = newMessages.filter((m) => m.role === "tool").length;
    return (
      `Fork "${fork.description}" contained ${newMessages.length} messages ` +
      `(${userMsgs} user, ${assistantMsgs} assistant, ${toolMsgs} tool).`
    );
  }

  /**
   * 부모 세션의 forks.json을 로드합니다.
   */
  private async loadForksFile(parentSessionId: string): Promise<ForksFileData> {
    const filePath = this.forksFilePath(parentSessionId);
    try {
      const content = await readFile(filePath, "utf-8");
      return JSON.parse(content) as ForksFileData;
    } catch {
      return { forks: [] };
    }
  }

  /**
   * Fork 메타데이터를 forks.json에 저장합니다.
   */
  private async saveForkMetadata(parentSessionId: string, fork: SessionFork): Promise<void> {
    const data = await this.loadForksFile(parentSessionId);
    const updatedForks = [...data.forks, fork];
    const filePath = this.forksFilePath(parentSessionId);
    const dir = join(this.sessionsDir, parentSessionId);
    await mkdir(dir, { recursive: true });
    await writeFile(filePath, JSON.stringify({ forks: updatedForks }, null, 2), "utf-8");
  }

  /**
   * Fork의 상태를 업데이트합니다.
   */
  private async updateForkStatus(
    parentSessionId: string,
    forkId: string,
    status: ForkStatus,
  ): Promise<void> {
    const data = await this.loadForksFile(parentSessionId);
    const updatedForks = data.forks.map((f) => (f.id === forkId ? { ...f, status } : f));
    const filePath = this.forksFilePath(parentSessionId);
    await writeFile(filePath, JSON.stringify({ forks: updatedForks }, null, 2), "utf-8");
  }

  /**
   * forks.json 파일 경로를 반환합니다.
   */
  private forksFilePath(parentSessionId: string): string {
    return join(this.sessionsDir, parentSessionId, "forks.json");
  }

  /**
   * 세션 디렉토리 목록을 반환합니다 (getFork 탐색용).
   */
  private async listSessionDirs(): Promise<readonly string[]> {
    try {
      const entries = await readdir(this.sessionsDir, { withFileTypes: true });
      return entries.filter((e) => e.isDirectory() && !e.name.startsWith(".")).map((e) => e.name);
    } catch {
      return [];
    }
  }
}

// ─── CheckpointManager ──────────────────────────────────────────────────────

/**
 * 세션 Checkpoint 관리자
 *
 * 세션의 현재 상태를 스냅샷으로 저장하고, 나중에 복원할 수 있습니다.
 * Checkpoint 데이터는 세션 디렉토리 내 checkpoints/ 폴더에 저장됩니다.
 *
 * @example
 * ```typescript
 * const checkpointManager = new CheckpointManager(sessionManager, "/path/to/sessions");
 *
 * // Checkpoint 생성
 * const cpId = await checkpointManager.createCheckpoint("session-123", "Before refactor");
 *
 * // Checkpoint 복원 (새 세션 생성)
 * const restored = await checkpointManager.restoreCheckpoint(cpId);
 * ```
 */
export class CheckpointManager {
  private readonly sessionManager: SessionManager;
  private readonly sessionsDir: string;

  /**
   * @param sessionManager - 세션 메시지 로드/생성에 사용할 SessionManager 인스턴스
   * @param sessionsDir - 세션 데이터 저장 루트 디렉토리
   */
  constructor(sessionManager: SessionManager, sessionsDir: string) {
    this.sessionManager = sessionManager;
    this.sessionsDir = sessionsDir;
  }

  /**
   * 세션의 현재 상태를 Checkpoint로 저장합니다.
   *
   * @param sessionId - 대상 세션 ID
   * @param label - Checkpoint 라벨 (선택)
   * @returns 생성된 Checkpoint ID
   */
  async createCheckpoint(sessionId: string, label?: string): Promise<string> {
    const messages = await this.sessionManager.loadMessages(sessionId);
    const id = randomUUID();
    const now = Date.now();

    const data: CheckpointData = {
      id,
      sessionId,
      label,
      messages: [...messages],
      timestamp: now,
    };

    const dir = this.checkpointsDir(sessionId);
    await mkdir(dir, { recursive: true });
    const filePath = join(dir, `${id}.json`);
    await writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");

    return id;
  }

  /**
   * 세션의 모든 Checkpoint 목록을 조회합니다.
   *
   * @param sessionId - 대상 세션 ID
   * @returns Checkpoint 요약 배열 (생성 시간 순)
   */
  async listCheckpoints(sessionId: string): Promise<readonly CheckpointSummary[]> {
    const dir = this.checkpointsDir(sessionId);
    let files: string[];
    try {
      files = await readdir(dir);
    } catch {
      return [];
    }

    const summaries: CheckpointSummary[] = [];
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      try {
        const content = await readFile(join(dir, file), "utf-8");
        const data = JSON.parse(content) as CheckpointData;
        summaries.push({
          id: data.id,
          sessionId: data.sessionId,
          label: data.label,
          messageCount: data.messages.length,
          timestamp: data.timestamp,
        });
      } catch {
        // 손상된 checkpoint 파일은 무시
      }
    }

    return summaries.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Checkpoint를 복원하여 새 세션을 생성합니다.
   *
   * 원본 세션은 변경되지 않으며, checkpoint 시점의 메시지로 새 세션이 만들어집니다.
   *
   * @param checkpointId - 복원할 Checkpoint ID
   * @returns 복원된 세션 정보
   * @throws SessionError - checkpoint를 찾을 수 없는 경우
   */
  async restoreCheckpoint(checkpointId: string): Promise<RestoredSession> {
    const data = await this.findCheckpointData(checkpointId);
    if (!data) {
      throw new SessionError("Checkpoint not found", { checkpointId });
    }

    // 원본 세션의 메타데이터로 새 세션 생성
    const parentMeta = await this.sessionManager.getMetadata(data.sessionId);
    const newSessionId = await this.sessionManager.createSession({
      workingDirectory: parentMeta.workingDirectory,
      model: parentMeta.model,
      name: `Restored: ${data.label ?? checkpointId.slice(0, 8)}`,
    });

    // Checkpoint의 메시지를 새 세션에 복사
    if (data.messages.length > 0) {
      await this.sessionManager.appendMessages(newSessionId, data.messages);
    }

    return {
      checkpointId,
      sessionId: newSessionId,
      messageCount: data.messages.length,
    };
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  /**
   * checkpoints 디렉토리 경로를 반환합니다.
   */
  private checkpointsDir(sessionId: string): string {
    return join(this.sessionsDir, sessionId, "checkpoints");
  }

  /**
   * checkpointId로 checkpoint 데이터를 찾습니다.
   * 모든 세션의 checkpoints 디렉토리를 탐색합니다.
   */
  private async findCheckpointData(checkpointId: string): Promise<CheckpointData | undefined> {
    let sessionDirs: string[];
    try {
      const entries = await readdir(this.sessionsDir, { withFileTypes: true });
      sessionDirs = entries
        .filter((e) => e.isDirectory() && !e.name.startsWith("."))
        .map((e) => e.name);
    } catch {
      return undefined;
    }

    for (const dirName of sessionDirs) {
      const filePath = join(this.checkpointsDir(dirName), `${checkpointId}.json`);
      try {
        const content = await readFile(filePath, "utf-8");
        return JSON.parse(content) as CheckpointData;
      } catch {
        // 이 세션에는 해당 checkpoint 없음
      }
    }

    return undefined;
  }
}

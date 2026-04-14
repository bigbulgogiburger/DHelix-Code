/**
 * LSP 매니저 — 언어 서버의 수명주기를 관리
 *
 * 핵심 원칙: "필요할 때만 켜고, 안 쓰면 끈다"
 * - 첫 요청 시 자동으로 LSP 서버 시작
 * - 5분 비활성 시 자동 종료 (메모리 회수)
 * - 언어별 서버 풀 관리 (최대 3개)
 * - 서버 크래시 시 자동 재시작 (최대 3회)
 */

import type {
  LSPLanguageId,
  LSPSession,
  LSPManagerConfig,
  DefinitionResult,
  ReferenceResult,
  TypeInfoResult,
  RenameEdit,
  LSPServerInstance,
  LSPServerState,
} from "./types.js";
import { LSPServerConnection } from "./server-connection.js";
import {
  getServerConfig,
  detectAvailableServers as detectServers,
  isServerInstalled,
} from "./language-detector.js";
import { getLogger } from "../utils/logger.js";
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { BaseError } from "../utils/error.js";
import { resolve } from "node:path";

const DEFAULT_IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5분
const DEFAULT_MAX_SERVERS = 3;
const DEFAULT_STARTUP_TIMEOUT_MS = 30_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
const MAX_RESTART_ATTEMPTS = 3;

/**
 * LSP 서버를 사용할 수 없을 때 발생하는 에러
 */
export class LSPNotAvailableError extends BaseError {
  constructor(language: string, reason: string) {
    super(`LSP 서버를 사용할 수 없습니다: ${language} — ${reason}`, "LSP_NOT_AVAILABLE", {
      language,
      reason,
    });
  }
}

/**
 * 관리 중인 LSP 서버의 내부 상태를 추적하는 인터페이스
 */
interface ManagedServer {
  readonly connection: LSPServerConnection;
  readonly language: LSPLanguageId;
  readonly projectDir: string;
  state: LSPServerState;
  idleTimer: ReturnType<typeof setTimeout> | undefined;
  lastUsedAt: number;
  restartCount: number;
  /** 현재 열려있는 문서 URI 집합 — 중복 open 방지 */
  readonly openDocuments: Set<string>;
}

/**
 * LSP 서버 풀 매니저
 *
 * 언어별·프로젝트별 LSP 서버를 자동으로 시작/종료하며,
 * idle 타이머로 미사용 서버를 정리합니다.
 *
 * @example
 * ```typescript
 * const manager = new LSPManager({ idleTimeoutMs: 300_000 });
 * const session = await manager.acquire("typescript", "/my/project");
 * const defs = await session.gotoDefinition("src/index.ts", 10, 5);
 * await manager.dispose();
 * ```
 */
export class LSPManager {
  private readonly servers: Map<string, ManagedServer> = new Map();
  private readonly config: Readonly<Required<LSPManagerConfig>>;
  private disposed = false;

  constructor(config?: LSPManagerConfig) {
    this.config = Object.freeze({
      idleTimeoutMs: config?.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS,
      maxServers: config?.maxServers ?? DEFAULT_MAX_SERVERS,
      startupTimeoutMs: config?.startupTimeoutMs ?? DEFAULT_STARTUP_TIMEOUT_MS,
      requestTimeoutMs: config?.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS,
    });
  }

  /**
   * 프로젝트에서 사용 가능한 LSP 서버를 감지합니다.
   *
   * @param projectDir - 프로젝트 루트 디렉토리 경로
   * @returns 사용 가능한 언어 ID 목록
   */
  async detectAvailableServers(projectDir: string): Promise<readonly LSPLanguageId[]> {
    this.ensureNotDisposed();
    return detectServers(projectDir);
  }

  /**
   * LSP 세션을 획득합니다 — 서버가 없으면 자동 시작, idle 타이머 리셋
   *
   * @param language - 대상 언어 ID
   * @param projectDir - 프로젝트 루트 디렉토리
   * @returns LSP 세션 래퍼 (DHelix 타입으로 변환된 결과 제공)
   * @throws {LSPNotAvailableError} 서버 커맨드가 설치되지 않았거나 시작 실패 시
   */
  async acquire(language: LSPLanguageId, projectDir: string): Promise<LSPSession> {
    this.ensureNotDisposed();

    const key = this.serverKey(language, projectDir);
    let managed = this.servers.get(key);

    // 기존 서버가 살아있으면 재사용
    if (managed && managed.connection.isAlive) {
      managed.lastUsedAt = Date.now();
      this.resetIdleTimer(key);
      return this.createSession(managed);
    }

    // 기존 서버가 죽었으면 재시작 시도
    if (managed && !managed.connection.isAlive) {
      if (managed.restartCount >= MAX_RESTART_ATTEMPTS) {
        await this.shutdownServer(key);
        throw new LSPNotAvailableError(
          language,
          `최대 재시작 횟수(${MAX_RESTART_ATTEMPTS}회) 초과`,
        );
      }
      this.clearIdleTimer(key);
      await this.shutdownServer(key);
      // fall through to start new server, carry restart count
    }

    // 최대 서버 수 확인 — 초과 시 가장 오래된 서버 정리
    await this.evictIfNeeded();

    const restartCount = managed?.restartCount ?? 0;
    managed = await this.startServer(language, projectDir, restartCount);
    this.servers.set(key, managed);
    this.resetIdleTimer(key);

    return this.createSession(managed);
  }

  /**
   * 모든 관리 중인 서버의 상태를 조회합니다.
   *
   * @returns 서버 인스턴스 정보 목록 (읽기 전용)
   */
  getServerStatus(): readonly LSPServerInstance[] {
    return [...this.servers.entries()].map(([_key, managed]) => ({
      language: managed.language,
      state: managed.state,
      pid: undefined,
      startedAt: managed.lastUsedAt,
      lastUsedAt: managed.lastUsedAt,
    }));
  }

  /**
   * 유휴 서버를 정리합니다 — idle 타이머와 별개로 수동 정리용
   */
  async cleanup(): Promise<void> {
    this.ensureNotDisposed();
    const log = getLogger();
    const now = Date.now();
    const shutdownPromises: Array<Promise<void>> = [];

    for (const [key, managed] of this.servers) {
      const idleMs = now - managed.lastUsedAt;
      if (idleMs >= this.config.idleTimeoutMs) {
        log.info(
          { language: managed.language, projectDir: managed.projectDir, idleMs },
          "유휴 LSP 서버 정리",
        );
        this.clearIdleTimer(key);
        shutdownPromises.push(this.shutdownServer(key));
      }
    }

    await Promise.allSettled(shutdownPromises);
  }

  /**
   * 전체 종료 — 모든 서버를 정리하고 타이머를 해제합니다.
   * dispose() 후에는 어떤 메서드도 호출할 수 없습니다.
   */
  async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }
    this.disposed = true;

    const log = getLogger();
    log.info("LSP 매니저 종료 시작");

    // 모든 타이머 해제
    for (const [key] of this.servers) {
      this.clearIdleTimer(key);
    }

    // 모든 서버 종료
    const shutdownPromises = [...this.servers.keys()].map((key) => this.shutdownServer(key));
    await Promise.allSettled(shutdownPromises);

    this.servers.clear();
    log.info("LSP 매니저 종료 완료");
  }

  /**
   * 서버 키 생성: "typescript:/path/to/project"
   *
   * @param language - 언어 ID
   * @param projectDir - 프로젝트 루트
   * @returns 고유 서버 키
   */
  private serverKey(language: LSPLanguageId, projectDir: string): string {
    return `${language}:${resolve(projectDir)}`;
  }

  /**
   * 새 LSP 서버를 시작합니다.
   *
   * @param language - 대상 언어
   * @param projectDir - 프로젝트 루트
   * @param restartCount - 이전 재시작 횟수 (이어받기)
   * @returns 관리 서버 객체
   * @throws {LSPNotAvailableError} 서버 설정을 찾을 수 없거나 시작 실패 시
   */
  private async startServer(
    language: LSPLanguageId,
    projectDir: string,
    restartCount: number = 0,
  ): Promise<ManagedServer> {
    const log = getLogger();
    const serverConfig = getServerConfig(language);

    if (!serverConfig) {
      throw new LSPNotAvailableError(language, "지원되지 않는 언어");
    }

    const installed = await isServerInstalled(serverConfig.language);
    if (!installed) {
      throw new LSPNotAvailableError(
        language,
        `서버 커맨드(${serverConfig.command})가 설치되지 않았습니다`,
      );
    }

    log.info({ language, projectDir, command: serverConfig.command }, "LSP 서버 시작");

    const connection = new LSPServerConnection(
      serverConfig.command,
      serverConfig.args,
      resolve(projectDir),
      language,
    );

    const managed: ManagedServer = {
      connection,
      language,
      projectDir: resolve(projectDir),
      state: "starting",
      idleTimer: undefined,
      lastUsedAt: Date.now(),
      restartCount: restartCount + 1,
      openDocuments: new Set(),
    };

    // startup timeout 적용
    try {
      await Promise.race([
        connection.start(),
        this.createTimeout(
          this.config.startupTimeoutMs,
          `LSP 서버 시작 타임아웃 (${this.config.startupTimeoutMs}ms)`,
        ),
      ]);
      managed.state = "running";
      log.info({ language, projectDir }, "LSP 서버 시작 완료");
    } catch (error) {
      managed.state = "error";
      const message = error instanceof Error ? error.message : String(error);
      log.error({ language, projectDir, error: message }, "LSP 서버 시작 실패");
      throw new LSPNotAvailableError(language, `시작 실패: ${message}`);
    }

    return managed;
  }

  /**
   * idle 타이머를 리셋합니다 — 기존 타이머를 취소하고 새로 설정
   *
   * @param key - 서버 키
   */
  private resetIdleTimer(key: string): void {
    this.clearIdleTimer(key);

    const managed = this.servers.get(key);
    if (!managed) {
      return;
    }

    managed.idleTimer = setTimeout(() => {
      const log = getLogger();
      log.info({ key, language: managed.language }, "idle 타임아웃 — LSP 서버 종료");
      void this.shutdownServer(key);
    }, this.config.idleTimeoutMs);

    // Node.js 프로세스 종료를 막지 않도록 타이머 해제
    if (
      managed.idleTimer &&
      typeof managed.idleTimer === "object" &&
      "unref" in managed.idleTimer
    ) {
      managed.idleTimer.unref();
    }
  }

  /**
   * idle 타이머를 취소합니다.
   *
   * @param key - 서버 키
   */
  private clearIdleTimer(key: string): void {
    const managed = this.servers.get(key);
    if (managed?.idleTimer) {
      clearTimeout(managed.idleTimer);
      managed.idleTimer = undefined;
    }
  }

  /**
   * 서버를 안전하게 종료합니다.
   *
   * @param key - 서버 키
   */
  private async shutdownServer(key: string): Promise<void> {
    const managed = this.servers.get(key);
    if (!managed) {
      return;
    }

    const log = getLogger();
    managed.state = "stopping";

    try {
      await Promise.race([
        managed.connection.shutdown(),
        this.createTimeout(5000, "LSP 서버 종료 타임아웃"),
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.warn({ key, error: message }, "LSP 서버 종료 중 오류 (무시)");
    }

    managed.state = "stopped";
    managed.openDocuments.clear();
    this.servers.delete(key);
  }

  /**
   * 최대 서버 수를 초과하면 가장 오래된 서버를 종료합니다.
   */
  private async evictIfNeeded(): Promise<void> {
    if (this.servers.size < this.config.maxServers) {
      return;
    }

    // 가장 오래 사용하지 않은 서버를 찾아 종료
    let oldestKey: string | undefined;
    let oldestTime = Infinity;

    for (const [key, managed] of this.servers) {
      if (managed.lastUsedAt < oldestTime) {
        oldestTime = managed.lastUsedAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      const log = getLogger();
      log.info({ key: oldestKey }, "최대 서버 수 초과 — 가장 오래된 서버 종료");
      this.clearIdleTimer(oldestKey);
      await this.shutdownServer(oldestKey);
    }
  }

  /**
   * LSPSession 래퍼를 생성합니다 — LSP 프로토콜 타입을 DHelix 타입으로 변환
   *
   * @param managed - 관리 서버 객체
   * @returns LSPSession 인터페이스 구현
   */
  private createSession(managed: ManagedServer): LSPSession {
    const { connection, language } = managed;
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- needed for closures in returned session
    const manager = this;
    const key = this.serverKey(managed.language, managed.projectDir);

    return {
      language,
      get state(): LSPServerState {
        return managed.state;
      },

      async gotoDefinition(
        filePath: string,
        line: number,
        col: number,
      ): Promise<DefinitionResult[]> {
        manager.touchServer(key);
        await manager.ensureDocumentOpen(managed, filePath);

        const locations = await manager.withTimeout(connection.gotoDefinition(filePath, line, col));

        return manager.convertToDefinitionResults(
          manager.normalizeLocations(locations as ReadonlyArray<Record<string, unknown>>),
        );
      },

      async findReferences(
        filePath: string,
        line: number,
        col: number,
        includeDeclaration?: boolean,
      ): Promise<ReferenceResult[]> {
        manager.touchServer(key);
        await manager.ensureDocumentOpen(managed, filePath);

        const locations = await manager.withTimeout(
          connection.findReferences(filePath, line, col, includeDeclaration),
        );

        return manager.convertToReferenceResults(
          manager.normalizeLocations(locations as ReadonlyArray<Record<string, unknown>>),
        );
      },

      async getTypeInfo(
        filePath: string,
        line: number,
        col: number,
      ): Promise<TypeInfoResult | undefined> {
        manager.touchServer(key);
        await manager.ensureDocumentOpen(managed, filePath);

        const hover = await manager.withTimeout(connection.getHover(filePath, line, col));

        if (!hover) {
          return undefined;
        }

        return manager.convertHoverToTypeInfo(
          hover as {
            contents:
              | string
              | { kind?: string; value: string }
              | ReadonlyArray<string | { kind?: string; value: string }>;
          },
        );
      },

      async rename(
        filePath: string,
        line: number,
        col: number,
        newName: string,
      ): Promise<RenameEdit[]> {
        manager.touchServer(key);
        await manager.ensureDocumentOpen(managed, filePath);

        const edit = await manager.withTimeout(connection.rename(filePath, line, col, newName));

        if (!edit) {
          return [];
        }

        return manager.convertWorkspaceEditToRenameEdits(
          edit as { changes?: Record<string, ReadonlyArray<{ range: LSPRange; newText: string }>> },
        );
      },

      async openDocument(filePath: string): Promise<void> {
        manager.touchServer(key);
        await manager.ensureDocumentOpen(managed, filePath);
      },

      async closeDocument(filePath: string): Promise<void> {
        manager.touchServer(key);
        const uri = pathToFileURL(resolve(filePath)).toString();
        if (managed.openDocuments.has(uri)) {
          await connection.closeDocument(filePath);
          managed.openDocuments.delete(uri);
        }
      },
    };
  }

  /**
   * 문서가 아직 열리지 않았으면 열어줍니다.
   *
   * @param managed - 관리 서버
   * @param filePath - 파일 경로
   */
  private async ensureDocumentOpen(managed: ManagedServer, filePath: string): Promise<void> {
    const uri = pathToFileURL(resolve(filePath)).toString();
    if (!managed.openDocuments.has(uri)) {
      await managed.connection.openDocument(filePath);
      managed.openDocuments.add(uri);
    }
  }

  /**
   * 서버 사용 시각을 갱신하고 idle 타이머를 리셋합니다.
   *
   * @param key - 서버 키
   */
  private touchServer(key: string): void {
    const managed = this.servers.get(key);
    if (managed) {
      managed.lastUsedAt = Date.now();
      this.resetIdleTimer(key);
    }
  }

  /**
   * 요청에 타임아웃을 적용합니다.
   *
   * @param promise - 원본 요청 프로미스
   * @returns 타임아웃이 적용된 결과
   */
  private async withTimeout<T>(promise: Promise<T>): Promise<T> {
    return Promise.race([
      promise,
      this.createTimeout(
        this.config.requestTimeoutMs,
        `LSP 요청 타임아웃 (${this.config.requestTimeoutMs}ms)`,
      ) as Promise<never>,
    ]);
  }

  /**
   * 타임아웃 프로미스를 생성합니다.
   *
   * @param ms - 타임아웃 밀리초
   * @param message - 타임아웃 시 에러 메시지
   */
  private createTimeout(ms: number, message: string): Promise<never> {
    return new Promise<never>((_resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(message));
      }, ms);
      // 프로세스 종료를 방해하지 않도록
      if (timer && typeof timer === "object" && "unref" in timer) {
        timer.unref();
      }
    });
  }

  /**
   * dispose 상태를 확인합니다.
   *
   * @throws {Error} 이미 dispose된 경우
   */
  private ensureNotDisposed(): void {
    if (this.disposed) {
      throw new Error("LSPManager가 이미 종료되었습니다");
    }
  }

  // ── LSP 타입 정규화 ──────────────────────────────────────────

  /**
   * LSP Location | LocationLink 배열을 { uri, range } 형태로 정규화합니다.
   * LocationLink의 경우 targetUri/targetRange를 사용합니다.
   *
   * @param locations - LSP 응답 (Location[] 또는 LocationLink[])
   * @returns 정규화된 { uri, range } 배열
   */
  private normalizeLocations(
    locations: ReadonlyArray<Record<string, unknown>>,
  ): ReadonlyArray<{ uri: string; range: LSPRange }> {
    return locations.map((loc) => {
      // LocationLink: { targetUri, targetRange, ... }
      if ("targetUri" in loc && "targetRange" in loc) {
        return {
          uri: loc.targetUri as string,
          range: loc.targetRange as LSPRange,
        };
      }
      // Location: { uri, range }
      return {
        uri: loc.uri as string,
        range: loc.range as LSPRange,
      };
    });
  }

  // ── LSP 타입 → DHelix 타입 변환 ──────────────────────────────

  /**
   * LSP Location/LocationLink → DefinitionResult[] 변환
   *
   * @param locations - LSP 응답의 Location 또는 LocationLink 배열
   * @returns DHelix DefinitionResult 배열
   */
  private async convertToDefinitionResults(
    locations: ReadonlyArray<{ uri: string; range: LSPRange }>,
  ): Promise<DefinitionResult[]> {
    const results: DefinitionResult[] = [];

    for (const loc of locations) {
      const filePath = this.uriToPath(loc.uri);
      const line = loc.range.start.line + 1; // LSP 0-based → DHelix 1-based
      const column = loc.range.start.character + 1; // LSP 0-based → DHelix 1-based
      const preview = await this.readPreviewLine(filePath, loc.range.start.line);

      results.push({
        filePath,
        line,
        column,
        preview,
      });
    }

    return results;
  }

  /**
   * LSP Location[] → ReferenceResult[] 변환
   *
   * @param locations - LSP 응답의 Location 배열
   * @returns DHelix ReferenceResult 배열
   */
  private async convertToReferenceResults(
    locations: ReadonlyArray<{ uri: string; range: LSPRange }>,
  ): Promise<ReferenceResult[]> {
    const results: ReferenceResult[] = [];

    for (const loc of locations) {
      const filePath = this.uriToPath(loc.uri);
      const line = loc.range.start.line + 1; // LSP 0-based → DHelix 1-based
      const column = loc.range.start.character + 1; // LSP 0-based → DHelix 1-based
      const context = await this.readPreviewLine(filePath, loc.range.start.line);

      results.push({
        filePath,
        line,
        column,
        context,
        isDefinition: false,
      });
    }

    return results;
  }

  /**
   * LSP Hover → TypeInfoResult 변환
   *
   * @param hover - LSP Hover 응답
   * @returns DHelix TypeInfoResult
   */
  private convertHoverToTypeInfo(hover: {
    contents:
      | string
      | { kind?: string; value: string }
      | ReadonlyArray<string | { kind?: string; value: string }>;
  }): TypeInfoResult {
    let typeString = "";

    const { contents } = hover;
    if (typeof contents === "string") {
      typeString = contents;
    } else if (Array.isArray(contents)) {
      typeString = contents.map((c) => (typeof c === "string" ? c : c.value)).join("\n");
    } else if (typeof contents === "object" && "value" in contents) {
      typeString = contents.value;
    }

    return { type: typeString };
  }

  /**
   * LSP WorkspaceEdit → RenameEdit[] 변환
   *
   * @param edit - LSP WorkspaceEdit 응답
   * @returns DHelix RenameEdit 배열 (파일별·위치별 평탄화)
   */
  private convertWorkspaceEditToRenameEdits(edit: {
    changes?: Record<string, ReadonlyArray<{ range: LSPRange; newText: string }>>;
  }): RenameEdit[] {
    const results: RenameEdit[] = [];

    if (!edit.changes) {
      return results;
    }

    for (const [uri, textEdits] of Object.entries(edit.changes)) {
      const filePath = this.uriToPath(uri);
      results.push({
        filePath,
        edits: textEdits.map((textEdit) => ({
          startLine: textEdit.range.start.line + 1, // LSP 0-based → 1-based
          startColumn: textEdit.range.start.character + 1,
          endLine: textEdit.range.end.line + 1,
          endColumn: textEdit.range.end.character + 1,
          newText: textEdit.newText,
        })),
      });
    }

    return results;
  }

  /**
   * file:// URI를 파일 시스템 경로로 변환합니다.
   *
   * @param uri - file:// URI
   * @returns 로컬 파일 경로
   */
  private uriToPath(uri: string): string {
    try {
      return fileURLToPath(uri);
    } catch {
      // URI가 이미 경로인 경우 그대로 반환
      return uri;
    }
  }

  /**
   * 파일에서 특정 행의 텍스트를 읽어 미리보기로 반환합니다.
   *
   * @param filePath - 파일 경로
   * @param line - 0-based 행 번호
   * @returns 해당 행의 텍스트 (트리밍), 실패 시 빈 문자열
   */
  private async readPreviewLine(filePath: string, line: number): Promise<string> {
    try {
      const content = await readFile(filePath, "utf-8");
      const lines = content.split("\n");
      return lines[line]?.trim() ?? "";
    } catch {
      return "";
    }
  }
}

/**
 * LSP Range 타입 — Location/WorkspaceEdit 변환 시 사용
 * (전체 LSP 타입 의존을 피하기 위한 최소 정의)
 */
interface LSPRange {
  readonly start: { readonly line: number; readonly character: number };
  readonly end: { readonly line: number; readonly character: number };
}

// ── 싱글턴 인스턴스 ──────────────────────────────────────────────

/** 모듈 레벨 싱글턴 — 모든 도구가 동일한 LSPManager를 공유 */
let singletonManager: LSPManager | undefined;

/**
 * LSPManager 싱글턴을 반환합니다.
 * 여러 도구가 동시에 호출되어도 동일한 서버 풀을 공유합니다.
 */
export function getLSPManager(): LSPManager {
  if (!singletonManager) {
    singletonManager = new LSPManager();
  }
  return singletonManager;
}

/**
 * 싱글턴 LSPManager를 종료하고 초기화합니다.
 * 세션 종료 시 또는 테스트에서 사용합니다.
 */
export async function disposeLSPManager(): Promise<void> {
  if (singletonManager) {
    await singletonManager.dispose();
    singletonManager = undefined;
  }
}

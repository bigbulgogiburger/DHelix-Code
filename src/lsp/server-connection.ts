/**
 * LSP 서버 연결 래퍼 — JSON-RPC 통신과 LSP 프로토콜 핸들링
 * vscode-languageserver-protocol을 사용하여 stdio 기반 LSP 서버와 통신합니다.
 */

import { spawn, type ChildProcess } from "node:child_process";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import {
  createProtocolConnection,
  type ProtocolConnection,
} from "vscode-languageserver-protocol/node";
import {
  InitializeRequest,
  InitializedNotification,
  ShutdownRequest,
  ExitNotification,
  DidOpenTextDocumentNotification,
  DidCloseTextDocumentNotification,
  DefinitionRequest,
  ReferencesRequest,
  HoverRequest,
  RenameRequest,
  type InitializeResult,
  type Location,
  type LocationLink,
  type Hover,
  type WorkspaceEdit,
} from "vscode-languageserver-protocol";
import { StreamMessageReader, StreamMessageWriter } from "vscode-languageserver-protocol/node";

/** 요청 타임아웃 (ms) */
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * LSP 서버와의 JSON-RPC 연결을 관리하는 래퍼 클래스.
 * 프로세스 스포닝, 초기화 핸드셰이크, 문서 라이프사이클, 요청 전송을 처리합니다.
 */
export class LSPServerConnection {
  private process: ChildProcess | undefined;
  private connection: ProtocolConnection | undefined;
  private initialized = false;
  private readonly openDocuments: Set<string> = new Set();
  private readonly language: string;
  private capabilities: InitializeResult | undefined;

  constructor(
    private readonly command: string,
    private readonly args: readonly string[],
    private readonly projectRoot: string,
    language: string,
  ) {
    this.language = language;
  }

  /** 서버 프로세스 시작 + LSP 초기화 핸드셰이크 */
  async start(): Promise<void> {
    if (this.initialized) return;

    this.process = spawn(this.command, [...this.args], {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: this.projectRoot,
    });

    if (!this.process.stdout || !this.process.stdin) {
      throw new Error(`Failed to spawn LSP server: ${this.command} ${this.args.join(" ")}`);
    }

    this.process.on("exit", () => {
      this.initialized = false;
      this.openDocuments.clear();
    });

    this.process.on("error", () => {
      this.initialized = false;
    });

    const reader = new StreamMessageReader(this.process.stdout);
    const writer = new StreamMessageWriter(this.process.stdin);
    this.connection = createProtocolConnection(reader, writer);
    this.connection.listen();

    const rootUri = pathToFileURL(this.projectRoot).toString();

    this.capabilities = await this.connection.sendRequest(InitializeRequest.type, {
      processId: process.pid,
      rootUri,
      workspaceFolders: [{ uri: rootUri, name: "workspace" }],
      capabilities: {
        textDocument: {
          definition: { dynamicRegistration: false },
          references: { dynamicRegistration: false },
          hover: {
            contentFormat: ["plaintext", "markdown"],
            dynamicRegistration: false,
          },
          rename: {
            prepareSupport: false,
            dynamicRegistration: false,
          },
          synchronization: {
            didSave: false,
            willSave: false,
            dynamicRegistration: false,
          },
        },
        workspace: {
          workspaceFolders: true,
        },
      },
    });

    await this.connection.sendNotification(InitializedNotification.type, {});
    this.initialized = true;
  }

  /** 문서 열기 (LSP didOpen) — 이미 열려있으면 스킵 */
  async openDocument(filePath: string): Promise<void> {
    const uri = pathToFileURL(filePath).toString();
    if (this.openDocuments.has(uri)) return;

    const content = await readFile(filePath, "utf-8");
    await this.ensureConnection().sendNotification(DidOpenTextDocumentNotification.type, {
      textDocument: {
        uri,
        languageId: this.language,
        version: 1,
        text: content,
      },
    });
    this.openDocuments.add(uri);
  }

  /** 문서 닫기 */
  async closeDocument(filePath: string): Promise<void> {
    const uri = pathToFileURL(filePath).toString();
    if (!this.openDocuments.has(uri)) return;

    await this.ensureConnection().sendNotification(DidCloseTextDocumentNotification.type, {
      textDocument: { uri },
    });
    this.openDocuments.delete(uri);
  }

  /** textDocument/definition — 1-based 좌표를 받아 결과를 반환 */
  async gotoDefinition(
    filePath: string,
    line: number,
    column: number,
  ): Promise<Location[] | LocationLink[]> {
    try {
      await this.openDocument(filePath);
      const result = await this.sendRequest(DefinitionRequest.type, {
        textDocument: { uri: pathToFileURL(filePath).toString() },
        position: { line: line - 1, character: column - 1 },
      });
      if (!result) return [];
      return Array.isArray(result) ? (result as Location[] | LocationLink[]) : [result as Location];
    } catch {
      return [];
    }
  }

  /** textDocument/references — 1-based 좌표를 받아 참조 목록을 반환 */
  async findReferences(
    filePath: string,
    line: number,
    column: number,
    includeDeclaration = true,
  ): Promise<Location[]> {
    try {
      await this.openDocument(filePath);
      const result = await this.sendRequest(ReferencesRequest.type, {
        textDocument: { uri: pathToFileURL(filePath).toString() },
        position: { line: line - 1, character: column - 1 },
        context: { includeDeclaration },
      });
      return (result as Location[] | null) ?? [];
    } catch {
      return [];
    }
  }

  /** textDocument/hover — 1-based 좌표의 호버 정보를 반환 */
  async getHover(filePath: string, line: number, column: number): Promise<Hover | null> {
    try {
      await this.openDocument(filePath);
      const result = await this.sendRequest(HoverRequest.type, {
        textDocument: { uri: pathToFileURL(filePath).toString() },
        position: { line: line - 1, character: column - 1 },
      });
      return (result as Hover | null) ?? null;
    } catch {
      return null;
    }
  }

  /** textDocument/rename — 1-based 좌표의 심볼을 새 이름으로 변경 */
  async rename(
    filePath: string,
    line: number,
    column: number,
    newName: string,
  ): Promise<WorkspaceEdit | null> {
    try {
      await this.openDocument(filePath);
      const result = await this.sendRequest(RenameRequest.type, {
        textDocument: { uri: pathToFileURL(filePath).toString() },
        position: { line: line - 1, character: column - 1 },
        newName,
      });
      return (result as WorkspaceEdit | null) ?? null;
    } catch {
      return null;
    }
  }

  /** 서버 정상 종료 (shutdown -> exit) */
  async shutdown(): Promise<void> {
    if (!this.connection || !this.initialized) return;

    try {
      // 열린 문서 모두 닫기
      for (const uri of this.openDocuments) {
        await this.connection.sendNotification(DidCloseTextDocumentNotification.type, {
          textDocument: { uri },
        });
      }
      this.openDocuments.clear();

      // LSP 종료 시퀀스
      await this.connection.sendRequest(ShutdownRequest.type);
      await this.connection.sendNotification(ExitNotification.type);
    } catch {
      // 종료 중 에러는 무시
    } finally {
      this.connection.dispose();
      this.process?.removeAllListeners();
      this.process?.kill();
      this.initialized = false;
      this.connection = undefined;
      this.process = undefined;
    }
  }

  /** 서버가 살아있는지 확인 */
  get isAlive(): boolean {
    return this.initialized && this.process?.exitCode === null;
  }

  /** 서버 capabilities 조회 */
  get serverCapabilities(): InitializeResult | undefined {
    return this.capabilities;
  }

  /** 연결이 활성 상태인지 확인하고 반환 */
  private ensureConnection(): ProtocolConnection {
    if (!this.connection || !this.initialized) {
      throw new Error("LSP server not initialized");
    }
    return this.connection;
  }

  /** 타임아웃 포함 요청 전송 헬퍼 */
  private async sendRequest(type: { method: string }, params: unknown): Promise<unknown> {
    const conn = this.ensureConnection();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const result = await Promise.race([
        conn.sendRequest(type.method, params),
        new Promise<never>((_resolve, reject) => {
          controller.signal.addEventListener("abort", () => {
            reject(new Error(`LSP request ${type.method} timed out`));
          });
        }),
      ]);
      return result;
    } finally {
      clearTimeout(timeout);
    }
  }
}

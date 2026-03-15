/**
 * Stdio 트랜스포트 — 자식 프로세스의 stdin/stdout을 통한 JSON-RPC 통신 모듈
 *
 * 가장 일반적인 MCP 트랜스포트 방식입니다.
 * 자식 프로세스(child process)를 spawn(생성)하고,
 * stdin(표준 입력)으로 JSON-RPC 메시지를 보내고,
 * stdout(표준 출력)에서 JSON-RPC 메시지를 줄 단위로 읽습니다.
 *
 * 통신 흐름:
 * ```
 * dbcode (부모 프로세스)      MCP 서버 (자식 프로세스)
 *        │                           │
 *        │──── stdin ────────────────→│  JSON-RPC 요청/알림
 *        │                           │
 *        │←──── stdout ──────────────│  JSON-RPC 응답/알림
 *        │                           │
 *        │     stderr (디버그 출력)    │
 * ```
 *
 * 각 메시지는 한 줄의 JSON 문자열이며, 줄바꿈(\n)으로 구분됩니다.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { createInterface, type Interface as ReadlineInterface } from "node:readline";
import { BaseError } from "../../utils/error.js";
import { type MCPServerConfig, type JsonRpcMessage } from "../types.js";
import { type MCPTransportLayer } from "./base.js";

/**
 * Stdio 트랜스포트 에러 클래스
 */
export class StdioTransportError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "STDIO_TRANSPORT_ERROR", context);
  }
}

/**
 * Stdio 트랜스포트 구현체
 *
 * 자식 프로세스를 시작하고, readline 인터페이스로 stdout을 줄 단위로 읽으며,
 * stdin에 JSON-RPC 메시지를 줄 단위로 씁니다.
 */
export class StdioTransport implements MCPTransportLayer {
  /** 자식 프로세스 인스턴스 */
  private process: ChildProcess | null = null;
  /** stdout을 줄 단위로 읽기 위한 readline 인터페이스 */
  private readline: ReadlineInterface | null = null;
  /** 수신 메시지 핸들러 */
  private messageHandler: ((message: JsonRpcMessage) => void) | null = null;
  /** 에러 핸들러 */
  private errorHandler: ((error: Error) => void) | null = null;
  /** 연결 종료 핸들러 */
  private closeHandler: (() => void) | null = null;

  /**
   * @param config - MCP 서버 설정 (command와 args 필요)
   */
  constructor(private readonly config: MCPServerConfig) {}

  /**
   * 자식 프로세스를 시작하고 통신 채널을 설정합니다.
   *
   * 1. 설정의 command와 args로 자식 프로세스 spawn
   * 2. stdout에 readline 인터페이스 연결 (줄 단위 읽기)
   * 3. 프로세스 종료/에러 이벤트 핸들러 등록
   *
   * stdio: ["pipe", "pipe", "pipe"]는 stdin, stdout, stderr 모두
   * 부모 프로세스에서 접근 가능하도록 파이프로 연결합니다.
   *
   * @throws StdioTransportError command가 설정에 없거나 프로세스 생성 실패 시
   */
  async connect(): Promise<void> {
    if (!this.config.command) {
      throw new StdioTransportError("stdio transport requires a command", {
        server: this.config.name,
      });
    }

    // 환경 변수 처리: ${VAR} 패턴을 실제 값으로 치환
    const env = this.config.env ? this.resolveEnvVars(this.config.env) : undefined;

    // 자식 프로세스 시작
    this.process = spawn(this.config.command, [...(this.config.args ?? [])], {
      stdio: ["pipe", "pipe", "pipe"],
      // 부모 프로세스의 환경 변수에 서버 설정 환경 변수를 병합
      env: { ...process.env, ...env },
    });

    // stdin/stdout이 제대로 연결되었는지 확인
    if (!this.process.stdout || !this.process.stdin) {
      throw new StdioTransportError("Failed to attach to child process stdio");
    }

    // stdout을 줄 단위로 읽기 위한 readline 인터페이스 생성
    this.readline = createInterface({ input: this.process.stdout });
    // 한 줄이 완성될 때마다 handleLine 호출
    this.readline.on("line", (line) => this.handleLine(line));

    // 자식 프로세스 종료 이벤트 처리
    this.process.on("exit", (code) => {
      this.errorHandler?.(new StdioTransportError(`Server exited with code ${code}`));
      this.closeHandler?.();
    });

    // 자식 프로세스 에러 이벤트 처리 (프로세스 시작 실패 등)
    this.process.on("error", (error) => {
      this.errorHandler?.(new StdioTransportError(`Server process error: ${error.message}`));
    });
  }

  /**
   * 자식 프로세스를 종료하고 리소스를 정리합니다.
   *
   * readline 인터페이스를 닫고, 프로세스를 kill합니다.
   */
  async disconnect(): Promise<void> {
    this.readline?.close();
    this.readline = null;

    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }

  /**
   * JSON-RPC 요청을 자식 프로세스의 stdin으로 전송합니다.
   *
   * 요청 객체를 JSON 문자열로 직렬화하고 줄바꿈을 추가하여 전송합니다.
   *
   * @param id - 요청 ID
   * @param method - 호출할 메서드
   * @param params - 메서드 매개변수
   */
  sendRequest(id: string | number, method: string, params: Record<string, unknown>): void {
    const request = {
      jsonrpc: "2.0" as const,
      id,
      method,
      params,
    };
    this.writeLine(JSON.stringify(request));
  }

  /**
   * JSON-RPC 알림을 자식 프로세스의 stdin으로 전송합니다.
   *
   * @param method - 알림 메서드 이름
   * @param params - 알림 매개변수
   */
  sendNotification(method: string, params: Record<string, unknown>): void {
    const notification = {
      jsonrpc: "2.0" as const,
      method,
      params,
    };
    this.writeLine(JSON.stringify(notification));
  }

  /**
   * 수신 메시지 핸들러를 등록합니다.
   *
   * @param handler - stdout에서 수신한 JSON-RPC 메시지를 처리할 콜백
   */
  onMessage(handler: (message: JsonRpcMessage) => void): void {
    this.messageHandler = handler;
  }

  /**
   * 에러 핸들러를 등록합니다.
   *
   * @param handler - 에러 발생 시 호출할 콜백
   */
  onError(handler: (error: Error) => void): void {
    this.errorHandler = handler;
  }

  /**
   * 연결 종료 핸들러를 등록합니다.
   *
   * @param handler - 프로세스가 종료될 때 호출할 콜백
   */
  onClose(handler: () => void): void {
    this.closeHandler = handler;
  }

  /**
   * 자식 프로세스의 stdin에 한 줄을 씁니다.
   *
   * 줄 끝에 줄바꿈 문자(\n)를 추가합니다.
   * (JSON-RPC over stdio에서 줄바꿈이 메시지 구분자 역할)
   *
   * @param line - 쓸 문자열 (JSON 직렬화된 메시지)
   * @throws StdioTransportError stdin이 쓰기 가능 상태가 아닐 때
   */
  private writeLine(line: string): void {
    if (!this.process?.stdin?.writable) {
      throw new StdioTransportError("Server stdin not writable");
    }
    this.process.stdin.write(line + "\n");
  }

  /**
   * stdout에서 읽은 한 줄을 JSON-RPC 메시지로 파싱합니다.
   *
   * 빈 줄이나 JSON으로 파싱할 수 없는 줄은 무시합니다.
   * (서버가 디버그 메시지 등 비-JSON 출력을 stderr 대신 stdout에 보낼 수 있음)
   *
   * @param line - stdout에서 읽은 한 줄
   */
  private handleLine(line: string): void {
    const trimmed = line.trim();
    if (!trimmed) return;

    try {
      const message = JSON.parse(trimmed) as JsonRpcMessage;
      this.messageHandler?.(message);
    } catch {
      // JSON으로 파싱할 수 없는 줄은 무시 (서버의 디버그 출력일 수 있음)
    }
  }

  /**
   * 환경 변수 값에서 ${VAR} 및 ${VAR:-default} 패턴을 실제 값으로 치환합니다.
   *
   * 변수 치환 패턴:
   * - ${VAR}: 환경 변수 VAR의 값으로 대체 (없으면 빈 문자열)
   * - ${VAR:-default}: 환경 변수 VAR의 값, 없으면 "default" 사용
   *
   * @example
   * // 입력: { API_KEY: "${OPENAI_KEY:-sk-test}" }
   * // OPENAI_KEY가 설정되어 있으면 → { API_KEY: "실제값" }
   * // OPENAI_KEY가 없으면 → { API_KEY: "sk-test" }
   *
   * @param env - 원본 환경 변수 맵
   * @returns 치환된 환경 변수 맵
   */
  private resolveEnvVars(env: Readonly<Record<string, string>>): Record<string, string> {
    const resolved: Record<string, string> = {};

    for (const [key, value] of Object.entries(env)) {
      resolved[key] = value.replace(
        /\$\{(\w+)(?::-([^}]*))?\}/g,
        (_, varName: string, defaultVal?: string) => {
          return process.env[varName] ?? defaultVal ?? "";
        },
      );
    }

    return resolved;
  }
}

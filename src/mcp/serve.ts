/**
 * MCP 서버 — dbcode의 내부 도구를 MCP 프로토콜로 외부에 노출하는 모듈
 *
 * 이 모듈은 dbcode 자체를 MCP 서버로 동작시킵니다.
 * 즉, 다른 MCP 클라이언트(Claude Code, 다른 AI 에이전트 등)가
 * dbcode에 연결하여 dbcode의 도구를 사용할 수 있게 합니다.
 *
 * 통신 방식:
 * - stdin/stdout을 통한 JSON-RPC 2.0 프로토콜
 * - 각 JSON-RPC 메시지는 줄바꿈(\n)으로 구분
 *
 * 지원하는 MCP 메서드:
 * - initialize: 핸드셰이크 (프로토콜 버전, 기능 교환)
 * - tools/list: 사용 가능한 도구 목록 조회
 * - tools/call: 도구 실행
 * - ping: 서버 상태 확인
 *
 * 보안 정책:
 * - 기본적으로 "safe" 권한 레벨의 도구만 노출
 * - exposedTools 설정으로 노출할 도구를 명시적으로 지정 가능
 */
import { createInterface, type Interface as ReadlineInterface } from "node:readline";
import { z } from "zod";
import { type ToolRegistry } from "../tools/registry.js";
import { type ToolResult, type ToolContext } from "../tools/types.js";
import { zodSchemaToJsonSchema } from "../tools/validation.js";
import { BaseError } from "../utils/error.js";
import {
  type JsonRpcRequest,
  type JsonRpcError,
  type MCPToolDefinition,
  type MCPServerCapabilities,
  type MCPToolCallResult,
} from "./types.js";
import { VERSION } from "../constants.js";

/**
 * MCP 서버 에러 클래스
 */
export class MCPServerError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "MCP_SERVER_ERROR", context);
  }
}

/**
 * JSON-RPC 표준 에러 코드 (MCP 스펙 준수)
 *
 * JSON-RPC 2.0에서 정의된 에러 코드입니다.
 * 음수 값은 프로토콜 수준 에러를 나타냅니다.
 */
export const JSON_RPC_ERRORS = {
  /** -32700: 잘못된 JSON 형식 */
  PARSE_ERROR: -32700,
  /** -32600: 유효하지 않은 JSON-RPC 요청 */
  INVALID_REQUEST: -32600,
  /** -32601: 존재하지 않는 메서드 */
  METHOD_NOT_FOUND: -32601,
  /** -32602: 잘못된 매개변수 */
  INVALID_PARAMS: -32602,
  /** -32603: 서버 내부 에러 */
  INTERNAL_ERROR: -32603,
} as const;

/** 도구 실행 기본 타임아웃 (30초) */
const DEFAULT_TOOL_TIMEOUT_MS = 30_000;

/** MCP 프로토콜 버전 */
const PROTOCOL_VERSION = "2024-11-05";

/**
 * MCP 서버 설정
 */
export interface MCPServeConfig {
  /** 서버 이름 (기본: "dbcode") */
  readonly name?: string;
  /** 서버 버전 (기본: 상수에서 가져옴) */
  readonly version?: string;
  /** 노출할 도구가 등록된 레지스트리 */
  readonly toolRegistry: ToolRegistry;
  /** 노출할 도구 이름 화이트리스트 (기본: 모든 safe 도구) */
  readonly exposedTools?: readonly string[];
  /** 도구 실행 시 작업 디렉토리 */
  readonly workingDirectory?: string;
  /** stdin 스트림 오버라이드 (테스트용) */
  readonly stdin?: NodeJS.ReadableStream;
  /** stdout 스트림 오버라이드 (테스트용) */
  readonly stdout?: NodeJS.WritableStream;
}

/**
 * JSON-RPC 성공 응답 형태
 */
interface JsonRpcSuccessResponse {
  readonly jsonrpc: "2.0";
  readonly id: string | number;
  readonly result: unknown;
}

/**
 * 서버가 전송하는 응답 타입 (성공 또는 에러)
 */
type ServerResponse = JsonRpcSuccessResponse | JsonRpcError;

/**
 * JSON-RPC 성공 응답을 생성합니다 (불변 객체).
 *
 * @param id - 원래 요청의 ID
 * @param result - 응답 결과
 * @returns 성공 응답 객체
 */
function createSuccessResponse(id: string | number, result: unknown): JsonRpcSuccessResponse {
  return { jsonrpc: "2.0", id, result };
}

/**
 * JSON-RPC 에러 응답을 생성합니다 (불변 객체).
 *
 * @param id - 원래 요청의 ID (파싱 에러 시 null)
 * @param code - JSON-RPC 에러 코드
 * @param message - 에러 메시지
 * @param data - 추가 에러 데이터 (선택)
 * @returns 에러 응답 객체
 */
function createErrorResponse(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcError {
  return {
    jsonrpc: "2.0",
    id,
    error: { code, message, ...(data !== undefined ? { data } : {}) },
  };
}

/**
 * MCP 서버 — dbcode의 내부 도구를 MCP 도구로 노출합니다.
 *
 * 다른 MCP 클라이언트(Claude Code, AI 에이전트 등)가 이 서버에 연결하여
 * dbcode의 도구를 사용할 수 있습니다.
 *
 * 사용 방법:
 * ```typescript
 * const server = new MCPServer({
 *   toolRegistry: myRegistry,
 *   exposedTools: ["Read", "Grep", "Glob"],
 * });
 * await server.start(); // stdin에서 JSON-RPC 메시지 수신 시작
 * ```
 */
export class MCPServer {
  /** 서버 이름 */
  private readonly serverName: string;
  /** 서버 버전 */
  private readonly serverVersion: string;
  /** 도구 레지스트리 */
  private readonly toolRegistry: ToolRegistry;
  /** 노출할 도구 이름 집합 */
  private readonly exposedToolNames: ReadonlySet<string>;
  /** 도구 실행 시 작업 디렉토리 */
  private readonly workingDirectory: string;
  /** stdin 스트림 */
  private readonly stdinStream: NodeJS.ReadableStream;
  /** stdout 스트림 */
  private readonly stdoutStream: NodeJS.WritableStream;
  /** 초기화 핸드셰이크 완료 여부 */
  private initialized = false;
  /** 서버 실행 중 여부 */
  private running = false;
  /** stdin 줄 읽기 인터페이스 */
  private readline: ReadlineInterface | null = null;

  constructor(config: MCPServeConfig) {
    this.serverName = config.name ?? "dbcode";
    this.serverVersion = config.version ?? VERSION;
    this.toolRegistry = config.toolRegistry;
    this.workingDirectory = config.workingDirectory ?? process.cwd();
    this.stdinStream = config.stdin ?? process.stdin;
    this.stdoutStream = config.stdout ?? process.stdout;
    // 노출할 도구 집합 결정 (화이트리스트 또는 safe 도구 전체)
    this.exposedToolNames = buildExposedToolSet(config);
  }

  /**
   * stdin에서 JSON-RPC 메시지 수신을 시작합니다.
   *
   * readline 인터페이스로 stdin을 줄 단위로 읽고,
   * 각 줄을 JSON-RPC 메시지로 처리합니다.
   */
  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;

    // stdin을 줄 단위로 읽기 위한 인터페이스 생성
    this.readline = createInterface({
      input: this.stdinStream,
      terminal: false,
    });

    // 각 줄이 도착할 때마다 처리
    this.readline.on("line", (line: string) => {
      void this.processLine(line);
    });

    // stdin이 닫히면 서버 중지
    this.readline.on("close", () => {
      this.running = false;
    });
  }

  /**
   * 서버를 중지합니다.
   *
   * readline을 닫고 상태를 초기화합니다.
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    this.running = false;
    this.initialized = false;

    if (this.readline) {
      this.readline.close();
      this.readline = null;
    }
  }

  /**
   * 서버가 현재 실행 중인지 확인합니다.
   *
   * @returns true면 실행 중
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * 초기화 핸드셰이크가 완료되었는지 확인합니다.
   *
   * 클라이언트가 "initialize" 메서드를 호출해야 핸드셰이크가 완료됩니다.
   *
   * @returns true면 초기화 완료
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * 단일 JSON-RPC 메시지를 처리합니다.
   *
   * stdin/stdout 연결 없이 직접 테스트할 수 있도록 공개 메서드로 제공됩니다.
   *
   * @param message - JSON-RPC 메시지 문자열
   * @returns 응답 JSON 문자열 (알림인 경우 null)
   */
  async handleMessage(message: string): Promise<string | null> {
    // JSON 파싱 및 JSON-RPC 형식 검증
    const parsed = parseJsonRpcMessage(message);

    if (!parsed.ok) {
      const response = createErrorResponse(null, parsed.error.code, parsed.error.message);
      return JSON.stringify(response);
    }

    const request = parsed.value;

    // 알림(id 없음)은 처리 후 null 반환 (응답 불필요)
    if (request.id === undefined) {
      this.handleNotification(request.method, request.params);
      return null;
    }

    // 요청(id 있음)은 처리 후 응답 반환
    const response = await this.handleRequest(request as JsonRpcRequest);
    return JSON.stringify(response);
  }

  /**
   * 노출된 도구 이름 집합을 반환합니다.
   *
   * @returns 노출된 도구 이름의 ReadonlySet
   */
  getExposedToolNames(): ReadonlySet<string> {
    return this.exposedToolNames;
  }

  // ---------------------------------------------------------------------------
  // Private 메서드
  // ---------------------------------------------------------------------------

  /**
   * stdin에서 읽은 한 줄을 처리합니다.
   *
   * 빈 줄은 무시하고, 유효한 줄은 handleMessage로 전달합니다.
   * 응답이 있으면 stdout으로 전송합니다.
   *
   * @param line - stdin에서 읽은 한 줄
   */
  private async processLine(line: string): Promise<void> {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      return;
    }

    const responseJson = await this.handleMessage(trimmed);
    if (responseJson !== null) {
      this.sendRaw(responseJson);
    }
  }

  /**
   * JSON-RPC 요청을 적절한 핸들러로 라우팅합니다.
   *
   * 라우팅 규칙:
   * - "initialize": 항상 허용 (핸드셰이크)
   * - 그 외: 초기화가 완료된 후에만 허용
   *
   * @param request - 파싱된 JSON-RPC 요청
   * @returns 서버 응답
   */
  private async handleRequest(request: JsonRpcRequest): Promise<ServerResponse> {
    const { id, method } = request;

    // initialize는 항상 허용
    if (method === "initialize") {
      return this.handleInitialize(id, request.params);
    }

    // 초기화 전에는 다른 메서드를 거부
    if (!this.initialized) {
      return createErrorResponse(
        id,
        JSON_RPC_ERRORS.INVALID_REQUEST,
        "Server not initialized. Send 'initialize' first.",
      );
    }

    // 메서드별 라우팅
    switch (method) {
      case "tools/list":
        return this.handleToolsList(id, request.params);
      case "tools/call":
        return this.handleToolsCall(id, request.params);
      case "ping":
        return createSuccessResponse(id, {});
      default:
        return createErrorResponse(
          id,
          JSON_RPC_ERRORS.METHOD_NOT_FOUND,
          `Method not found: ${method}`,
        );
    }
  }

  /**
   * initialize 핸드셰이크를 처리합니다.
   *
   * 클라이언트에 서버 정보와 기능을 알려줍니다:
   * - 프로토콜 버전
   * - 서버 이름/버전
   * - 지원하는 기능 (tools: listChanged 미지원)
   *
   * @param id - 요청 ID
   * @param _params - 요청 매개변수 (현재 미사용)
   * @returns 초기화 응답
   */
  private handleInitialize(
    id: string | number,
    _params?: Readonly<Record<string, unknown>>,
  ): ServerResponse {
    this.initialized = true;

    const capabilities: MCPServerCapabilities = {
      tools: { listChanged: false },
    };

    return createSuccessResponse(id, {
      protocolVersion: PROTOCOL_VERSION,
      capabilities,
      serverInfo: {
        name: this.serverName,
        version: this.serverVersion,
      },
    });
  }

  /**
   * tools/list 요청을 처리합니다 — 노출된 모든 도구의 목록을 반환합니다.
   *
   * 도구 정의를 dbcode 내부 형식에서 MCP 형식으로 변환합니다.
   * 커서 기반 페이지네이션을 지원하지만, 현재는 모든 도구를 한 번에 반환합니다.
   *
   * @param id - 요청 ID
   * @param params - 요청 매개변수 (cursor 등)
   * @returns 도구 목록 응답
   */
  private handleToolsList(
    id: string | number,
    params?: Readonly<Record<string, unknown>>,
  ): ServerResponse {
    // 레지스트리에서 노출 대상 도구만 필터링
    const allTools = this.toolRegistry.getAll();
    const exposedTools = allTools.filter((t) => this.exposedToolNames.has(t.name));

    // dbcode 도구 정의 → MCP 도구 정의 변환
    const mcpTools: readonly MCPToolDefinition[] = exposedTools.map((tool) =>
      convertToolDefToMCP(tool),
    );

    // 커서 기반 페이지네이션: 커서가 제공되면 빈 목록 반환 (모든 도구를 첫 페이지에 반환했으므로)
    const cursor = params?.cursor as string | undefined;
    if (cursor) {
      return createSuccessResponse(id, { tools: [] });
    }

    return createSuccessResponse(id, { tools: mcpTools });
  }

  /**
   * tools/call 요청을 처리합니다 — 도구를 실행하고 결과를 반환합니다.
   *
   * 실행 흐름:
   * 1. 매개변수 유효성 검사 (이름 필수)
   * 2. 도구 존재 및 노출 여부 확인
   * 3. Zod 스키마로 인자 유효성 검사
   * 4. AbortController로 타임아웃 제어하며 도구 실행
   * 5. 결과를 MCP 형식으로 변환하여 반환
   *
   * @param id - 요청 ID
   * @param params - 요청 매개변수 (name, arguments)
   * @returns 도구 실행 결과 응답
   */
  private async handleToolsCall(
    id: string | number,
    params?: Readonly<Record<string, unknown>>,
  ): Promise<ServerResponse> {
    // name 매개변수 필수 검증
    if (!params || typeof params.name !== "string") {
      return createErrorResponse(
        id,
        JSON_RPC_ERRORS.INVALID_PARAMS,
        "Missing required parameter: name",
      );
    }

    const toolName = params.name;
    const toolArgs = (params.arguments ?? {}) as Record<string, unknown>;

    // 도구 존재 확인
    const toolDef = this.toolRegistry.get(toolName);
    if (!toolDef) {
      return createErrorResponse(id, JSON_RPC_ERRORS.INVALID_PARAMS, `Tool not found: ${toolName}`);
    }

    // 도구 노출 여부 확인
    if (!this.exposedToolNames.has(toolName)) {
      return createErrorResponse(
        id,
        JSON_RPC_ERRORS.INVALID_PARAMS,
        `Tool not exposed: ${toolName}`,
      );
    }

    // Zod 스키마로 인자 유효성 검사
    const parseResult = toolDef.parameterSchema.safeParse(toolArgs);
    if (!parseResult.success) {
      const issues = parseResult.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ");
      return createErrorResponse(
        id,
        JSON_RPC_ERRORS.INVALID_PARAMS,
        `Invalid tool arguments: ${issues}`,
      );
    }

    // 도구 실행
    try {
      // AbortController: 타임아웃 시 도구 실행을 취소할 수 있게 해줌
      const abortController = new AbortController();
      const timeout = toolDef.timeoutMs ?? DEFAULT_TOOL_TIMEOUT_MS;

      // 도구 실행 컨텍스트 생성
      const context: ToolContext = {
        workingDirectory: this.workingDirectory,
        abortSignal: abortController.signal,
        timeoutMs: timeout,
        platform: process.platform as "win32" | "darwin" | "linux",
      };

      // 타임아웃 타이머 설정
      const timer = setTimeout(() => abortController.abort(), timeout);
      let result: ToolResult;
      try {
        result = await toolDef.execute(parseResult.data, context);
      } finally {
        clearTimeout(timer);
      }

      // 결과를 MCP 형식으로 변환
      const mcpResult: MCPToolCallResult = {
        content: [{ type: "text", text: result.output }],
        isError: result.isError,
      };

      return createSuccessResponse(id, mcpResult);
    } catch (error) {
      // 실행 중 에러 발생 시 에러 결과 반환 (에러 응답이 아닌 성공 응답 + isError: true)
      const errorMessage = error instanceof Error ? error.message : String(error);
      const mcpResult: MCPToolCallResult = {
        content: [{ type: "text", text: `Error: ${errorMessage}` }],
        isError: true,
      };
      return createSuccessResponse(id, mcpResult);
    }
  }

  /**
   * 알림(Notification)을 처리합니다 (응답 불필요).
   *
   * 현재 처리하는 알림:
   * - notifications/initialized: 클라이언트가 초기화를 확인
   * - 그 외: MCP 스펙에 따라 조용히 무시
   *
   * @param method - 알림 메서드 이름
   * @param _params - 알림 매개변수 (현재 미사용)
   */
  private handleNotification(method: string, _params?: Readonly<Record<string, unknown>>): void {
    if (method === "notifications/initialized") {
      // 클라이언트가 초기화 완료를 확인 — 추가 작업 없음
    }
    // 다른 알림은 MCP 스펙에 따라 조용히 무시
  }

  /**
   * JSON 문자열을 stdout으로 전송합니다 (줄바꿈 구분).
   *
   * @param json - 전송할 JSON 문자열
   */
  private sendRaw(json: string): void {
    this.stdoutStream.write(`${json}\n`);
  }
}

// ---------------------------------------------------------------------------
// 순수 헬퍼 함수들
// ---------------------------------------------------------------------------

/**
 * 노출할 도구 이름 집합을 생성합니다.
 *
 * 결정 로직:
 * 1. exposedTools가 지정되면 → 해당 화이트리스트 사용
 * 2. 지정되지 않으면 → "safe" 권한 레벨의 도구만 노출
 *
 * @param config - MCP 서버 설정
 * @returns 노출할 도구 이름의 Set
 */
function buildExposedToolSet(config: MCPServeConfig): ReadonlySet<string> {
  if (config.exposedTools) {
    return new Set(config.exposedTools);
  }

  // 기본: safe 권한 레벨의 도구만 노출
  const allTools = config.toolRegistry.getAll();
  const safeTools = allTools.filter((t) => t.permissionLevel === "safe");
  return new Set(safeTools.map((t) => t.name));
}

/**
 * dbcode 내부 도구 정의를 MCP 도구 형식으로 변환합니다.
 *
 * Zod 스키마를 JSON Schema로 변환하여 MCP 클라이언트가
 * 도구의 입력 형식을 이해할 수 있게 합니다.
 *
 * @param tool - dbcode 내부 도구 정의
 * @returns MCP 도구 정의
 */
function convertToolDefToMCP(tool: {
  readonly name: string;
  readonly description: string;
  readonly parameterSchema: z.ZodSchema;
}): MCPToolDefinition {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: zodSchemaToJsonSchema(tool.parameterSchema),
  };
}

/**
 * 파싱 성공한 JSON-RPC 메시지
 */
interface ParsedMessageOk {
  readonly ok: true;
  readonly value: {
    readonly method: string;
    readonly id?: string | number;
    readonly params?: Readonly<Record<string, unknown>>;
  };
}

/**
 * 파싱 실패한 JSON-RPC 메시지
 */
interface ParsedMessageErr {
  readonly ok: false;
  readonly error: { readonly code: number; readonly message: string };
}

/**
 * JSON-RPC 메시지 파싱 결과 (성공 또는 실패)
 *
 * Result 패턴: 성공/실패를 하나의 타입으로 표현합니다.
 * 예외(throw)를 사용하지 않고 명시적으로 에러를 처리합니다.
 */
type ParsedMessage = ParsedMessageOk | ParsedMessageErr;

/**
 * JSON 문자열을 JSON-RPC 메시지로 파싱합니다.
 *
 * 검증 단계:
 * 1. JSON 파싱 가능한지 확인
 * 2. 객체 타입인지 확인
 * 3. jsonrpc 필드가 "2.0"인지 확인
 * 4. method 필드가 문자열인지 확인
 *
 * @param raw - 파싱할 JSON 문자열
 * @returns 파싱 결과 (성공 시 메시지 객체, 실패 시 에러 정보)
 */
function parseJsonRpcMessage(raw: string): ParsedMessage {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      error: { code: JSON_RPC_ERRORS.PARSE_ERROR, message: "Parse error: invalid JSON" },
    };
  }

  if (typeof parsed !== "object" || parsed === null) {
    return {
      ok: false,
      error: { code: JSON_RPC_ERRORS.INVALID_REQUEST, message: "Invalid request: expected object" },
    };
  }

  const obj = parsed as Record<string, unknown>;

  // JSON-RPC 2.0 프로토콜 버전 확인
  if (obj.jsonrpc !== "2.0") {
    return {
      ok: false,
      error: {
        code: JSON_RPC_ERRORS.INVALID_REQUEST,
        message: "Invalid request: jsonrpc must be '2.0'",
      },
    };
  }

  // method 필드 필수 확인
  if (typeof obj.method !== "string") {
    return {
      ok: false,
      error: {
        code: JSON_RPC_ERRORS.INVALID_REQUEST,
        message: "Invalid request: method must be a string",
      },
    };
  }

  return {
    ok: true,
    value: {
      method: obj.method,
      id: obj.id as string | number | undefined,
      params: obj.params as Readonly<Record<string, unknown>> | undefined,
    },
  };
}

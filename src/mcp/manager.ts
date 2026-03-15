/**
 * MCP 매니저 — MCP 서버의 전체 수명주기를 관리하는 모듈
 *
 * 이 모듈은 MCP 서버 설정 로딩, 연결 관리, 도구 등록을 담당합니다.
 * 여러 MCP 서버를 동시에 관리할 수 있으며, 스코프(local/project/user) 기반
 * 설정 우선순위를 지원합니다.
 *
 * 주요 역할:
 * 1. 설정 파일(mcp.json)에서 MCP 서버 설정을 로딩
 * 2. MCPClient를 사용하여 각 서버에 연결
 * 3. MCPToolBridge를 통해 서버의 도구를 dbcode 도구 레지스트리에 등록
 * 4. 연결 해제 및 정리
 */
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { MCPClient } from "./client.js";
import { MCPScopeManager } from "./scope-manager.js";
import { MCPToolBridge } from "./tool-bridge.js";
import { type MCPServerConfig } from "./types.js";
import { type ToolRegistry } from "../tools/registry.js";
import { BaseError } from "../utils/error.js";

/**
 * MCP 매니저 에러 클래스
 *
 * MCP 매니저에서 발생하는 에러를 나타냅니다.
 * 설정 파싱 실패, 연결 오류 등의 상황에서 사용됩니다.
 */
export class MCPManagerError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "MCP_MANAGER_ERROR", context);
  }
}

/** 기본 설정 파일 경로: ~/.dbcode/mcp.json */
const DEFAULT_CONFIG_PATH = join(homedir(), ".dbcode", "mcp.json");

/**
 * MCP 매니저 설정 인터페이스
 */
export interface MCPManagerConfig {
  /** 설정 파일 경로 (기본값: ~/.dbcode/mcp.json) */
  readonly configPath?: string;
  /** 작업 디렉토리 — 스코프 기반 설정 해석에 사용 */
  readonly workingDirectory?: string;
  /** 도구를 등록할 레지스트리 */
  readonly toolRegistry: ToolRegistry;
}

/**
 * 전체 서버 연결 결과
 *
 * connectAll() 메서드의 반환값으로,
 * 성공/실패한 서버 목록을 분리하여 제공합니다.
 */
export interface ConnectAllResult {
  /** 성공적으로 연결된 서버 이름 목록 */
  readonly connected: string[];
  /** 연결 실패한 서버 목록 (이름 + 에러 메시지) */
  readonly failed: Array<{ readonly name: string; readonly error: string }>;
}

/**
 * MCP 서버 수명주기 매니저
 *
 * 설정 로딩, 연결 관리, 도구 브리지를 통합하여
 * MCP 서버의 전체 수명주기를 관리합니다.
 *
 * 사용 흐름:
 * 1. new MCPManager(config) — 매니저 생성
 * 2. connectAll() — 설정 파일의 모든 서버에 연결
 * 3. getRegisteredTools() — 등록된 도구 조회
 * 4. disconnectAll() — 모든 연결 해제
 */
export class MCPManager {
  /** 서버 이름 → MCPClient 인스턴스 맵 */
  private readonly clients = new Map<string, MCPClient>();
  /** MCP 도구를 dbcode 레지스트리에 브리지하는 컴포넌트 */
  private readonly bridge: MCPToolBridge;
  /** 설정 파일 경로 */
  private readonly configPath: string;
  /** 스코프 기반 설정 관리자 (작업 디렉토리가 있을 때만 활성화) */
  private readonly scopeManager: MCPScopeManager | null;

  constructor(config: MCPManagerConfig) {
    this.configPath = config.configPath ?? DEFAULT_CONFIG_PATH;
    this.bridge = new MCPToolBridge(config.toolRegistry);
    // 작업 디렉토리가 제공되면 스코프 매니저 활성화 (local > project > user 우선순위)
    this.scopeManager = config.workingDirectory
      ? new MCPScopeManager(config.workingDirectory)
      : null;
  }

  /**
   * 설정 파일에서 MCP 서버 설정을 로드합니다.
   *
   * 설정 파일(mcp.json)을 읽고 파싱하여 서버별 설정 객체를 반환합니다.
   * 파일이 존재하지 않으면 빈 객체를 반환합니다 (에러가 아님).
   *
   * @returns 서버 이름 → MCPServerConfig 맵
   * @throws MCPManagerError 파일 파싱 실패 시
   */
  async loadConfig(): Promise<Record<string, MCPServerConfig>> {
    let raw: string;
    try {
      raw = await readFile(this.configPath, "utf-8");
    } catch {
      // 파일이 없으면 에러가 아님 — 서버가 설정되지 않은 것
      return {};
    }

    try {
      // JSON 파싱 후 mcpServers 필드에서 서버 설정 추출
      const parsed = JSON.parse(raw) as { mcpServers?: Record<string, unknown> };
      const servers = parsed.mcpServers ?? {};
      const result: Record<string, MCPServerConfig> = {};

      // 각 서버 설정을 MCPServerConfig 형태로 변환
      for (const [name, value] of Object.entries(servers)) {
        const cfg = value as Record<string, unknown>;
        result[name] = {
          name,
          transport: (cfg.transport as MCPServerConfig["transport"]) ?? "stdio",
          command: cfg.command as string | undefined,
          args: cfg.args as string[] | undefined,
          url: cfg.url as string | undefined,
          env: cfg.env as Record<string, string> | undefined,
          scope: cfg.scope as MCPServerConfig["scope"],
        };
      }

      return result;
    } catch (error) {
      throw new MCPManagerError("Failed to parse MCP config file", {
        path: this.configPath,
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * 스코프 기반 설정 파일에서 MCP 서버 설정을 로드합니다.
   *
   * 스코프 우선순위: local > project > user
   * (같은 이름의 서버가 여러 스코프에 있으면 local이 우선)
   *
   * 작업 디렉토리가 설정되지 않은 경우 레거시 loadConfig()로 폴백합니다.
   *
   * @returns 서버 이름 → MCPServerConfig 맵
   */
  async loadScopedConfigs(): Promise<Record<string, MCPServerConfig>> {
    if (!this.scopeManager) {
      return this.loadConfig();
    }

    const scopedConfigs = await this.scopeManager.loadAllConfigs();
    const result: Record<string, MCPServerConfig> = {};
    for (const [name, config] of scopedConfigs) {
      result[name] = config;
    }
    return result;
  }

  /**
   * 설정된 모든 MCP 서버에 병렬로 연결하고 도구를 등록합니다.
   *
   * Promise.allSettled를 사용하여 일부 서버 연결이 실패해도
   * 나머지 서버는 정상적으로 연결됩니다.
   *
   * @returns 연결 결과 (성공/실패 서버 목록)
   */
  async connectAll(): Promise<ConnectAllResult> {
    // 스코프 기반 설정 로드
    const serverConfigs = await this.loadScopedConfigs();
    const entries = Object.entries(serverConfigs);

    if (entries.length === 0) {
      return { connected: [], failed: [] };
    }

    // 모든 서버에 병렬로 연결 시도
    const results = await Promise.allSettled(
      entries.map(async ([name, config]) => {
        await this.connectServer(name, config);
        return name;
      }),
    );

    // 결과를 성공/실패로 분류
    const connected: string[] = [];
    const failed: Array<{ name: string; error: string }> = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === "fulfilled") {
        connected.push(result.value);
      } else {
        failed.push({
          name: entries[i][0],
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        });
      }
    }

    return { connected, failed };
  }

  /**
   * 특정 MCP 서버에 연결하고 도구를 레지스트리에 등록합니다.
   *
   * 이미 연결된 서버가 있으면 기존 연결을 끊고 재연결합니다.
   *
   * @param name - 서버 이름
   * @param config - 서버 연결 설정
   * @returns 등록된 도구 이름 목록
   */
  async connectServer(name: string, config: MCPServerConfig): Promise<readonly string[]> {
    // 기존 연결이 있으면 먼저 해제 (재연결 시나리오)
    const existing = this.clients.get(name);
    if (existing) {
      await existing.disconnect();
    }

    // 새 클라이언트 생성 및 연결
    const client = new MCPClient(config);
    await client.connect();
    this.clients.set(name, client);

    // 서버의 도구를 발견하고 dbcode 레지스트리에 등록
    const toolNames = await this.bridge.registerTools(client, name);
    return toolNames;
  }

  /**
   * 모든 연결된 MCP 서버의 연결을 해제합니다.
   *
   * Promise.allSettled를 사용하여 일부 서버 해제가 실패해도
   * 나머지 서버는 정상적으로 해제됩니다.
   */
  async disconnectAll(): Promise<void> {
    const disconnects = [...this.clients.values()].map((client) => client.disconnect());
    await Promise.allSettled(disconnects);
    this.clients.clear();
  }

  /**
   * 서버별 등록된 도구 이름 맵을 반환합니다.
   *
   * @returns 서버 이름 → 도구 이름 배열 맵
   */
  getRegisteredTools(): ReadonlyMap<string, readonly string[]> {
    const result = new Map<string, readonly string[]>();
    for (const name of this.clients.keys()) {
      result.set(name, this.bridge.getServerTools(name));
    }
    return result;
  }

  /**
   * 현재 연결된 모든 서버의 이름 목록을 반환합니다.
   *
   * @returns 연결된 서버 이름 배열
   */
  getConnectedServers(): readonly string[] {
    return [...this.clients.keys()];
  }
}

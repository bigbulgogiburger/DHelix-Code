/**
 * MCP 매니저 커넥터 — 6개의 MCP 서브 모듈을 통합 관리하는 오케스트레이터
 *
 * MCPManager가 서버 연결을 담당한다면, MCPManagerConnector는
 * 연결된 서버에 대한 부가 기능들을 초기화하고 조율합니다.
 *
 * 통합 관리하는 6개 서브 모듈:
 * 1. MCPResourceManager  — 리소스 검색 및 캐싱 (@server:uri 멘션 해석)
 * 2. MCPPromptManager    — 프롬프트 검색 및 슬래시 명령 생성
 * 3. MCPToolSearch       — 지연 로딩(deferred) 도구 검색
 * 4. MCPOAuthManager     — OAuth 2.0 토큰 관리
 * 5. MCPToolFilter       — 도구 허용/차단 목록 필터링
 * 6. MCPOutputLimiter    — 도구 출력 길이 제한 (토큰 절약)
 *
 * 각 서브 모듈은 독립적으로 활성화/비활성화할 수 있으며,
 * 서버 연결 시 자동으로 초기화됩니다.
 */
import { type MCPClient } from "./client.js";
import { MCPResourceManager } from "./resources.js";
import { MCPPromptManager, type PromptCapableClient } from "./prompts.js";
import { MCPToolSearch, type ToolSearchableClient } from "./tool-search.js";
import { MCPOAuthManager } from "./oauth.js";
import { MCPToolFilter } from "./tool-filter.js";
import { MCPOutputLimiter, type OutputLimitConfig } from "./output-limiter.js";
import { type MCPServerConfig, type MCPToolDefinition } from "./types.js";
import { BaseError } from "../utils/error.js";

/**
 * MCP 매니저 커넥터 에러 클래스
 */
export class MCPManagerConnectorError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "MCP_MANAGER_CONNECTOR_ERROR", context);
  }
}

/**
 * MCP 매니저 커넥터 설정
 *
 * 각 서브 모듈의 활성화 여부와 세부 설정을 지정합니다.
 * 기본값은 모두 활성화(true)입니다.
 */
export interface MCPConnectorConfig {
  /** 리소스 관리 활성화 (기본: true) */
  readonly enableResources?: boolean;
  /** 프롬프트 관리 활성화 (기본: true) */
  readonly enablePrompts?: boolean;
  /** 도구 검색(지연 로딩) 활성화 (기본: true) */
  readonly enableToolSearch?: boolean;
  /** OAuth 관리 활성화 (기본: true) */
  readonly enableOAuth?: boolean;
  /** 도구 필터 활성화 (기본: true) */
  readonly enableToolFilter?: boolean;
  /** 출력 제한 활성화 (기본: true) */
  readonly enableOutputLimiter?: boolean;
  /** 도구 수가 이 임계값을 초과하면 지연 로딩으로 전환 (기본: 50) */
  readonly toolSearchThreshold?: number;
  /** 출력 제한 세부 설정 */
  readonly outputLimiterConfig?: Partial<OutputLimitConfig>;
}

/**
 * 단일 MCP 서버 연결 결과
 *
 * 각 서버에 대해 발견된 리소스, 프롬프트, 도구의 수와
 * OAuth 필요 여부, 필터링된 도구 수 등을 보고합니다.
 */
export interface MCPServerConnectionResult {
  /** 서버 이름 */
  readonly serverName: string;
  /** 발견된 리소스 수 */
  readonly resourceCount: number;
  /** 발견된 프롬프트 수 */
  readonly promptCount: number;
  /** 사용 가능한 도구 수 (필터링 후) */
  readonly toolCount: number;
  /** 지연 로딩으로 전환된 도구 수 */
  readonly deferredToolCount: number;
  /** OAuth 인증 필요 여부 */
  readonly oauthRequired: boolean;
  /** 필터에 의해 제외된 도구 수 */
  readonly filteredToolCount: number;
}

/**
 * 전체 서버 연결 결과 (모든 서버의 집계)
 */
export interface MCPConnectorResult {
  /** 각 서버의 연결 결과 배열 */
  readonly servers: readonly MCPServerConnectionResult[];
  /** 전체 리소스 수 합계 */
  readonly totalResources: number;
  /** 전체 프롬프트 수 합계 */
  readonly totalPrompts: number;
  /** 전체 도구 수 합계 */
  readonly totalTools: number;
  /** 전체 지연 로딩 도구 수 합계 */
  readonly totalDeferredTools: number;
  /** 연결 실패한 서버 목록 */
  readonly errors: readonly { readonly serverName: string; readonly error: string }[];
}

/**
 * MCP 상태에서 생성되는 시스템 프롬프트 섹션들
 *
 * LLM에 MCP 서버 정보를 주입하기 위한 텍스트 섹션입니다.
 */
export interface MCPSystemPromptSections {
  /** 연결된 MCP 서버 목록 */
  readonly mcpServers: string;
  /** 지연 로딩 도구 목록 (이름만) */
  readonly deferredTools: string;
  /** 사용 가능한 리소스 힌트 */
  readonly resourceHints: string;
  /** 사용 가능한 프롬프트 명령어 목록 */
  readonly promptCommands: string;
}

/**
 * 커넥터 통계 정보
 *
 * 리소스 캐시, 출력 제한, 도구 검색 등의 운영 통계를 제공합니다.
 */
export interface MCPConnectorStats {
  /** 리소스 캐시 통계 (히트, 미스, 크기) */
  readonly resourceCacheStats: {
    readonly hits: number;
    readonly misses: number;
    readonly size: number;
  };
  /** 출력 제한 통계 (잘린 횟수, 절약된 토큰) */
  readonly outputLimiterStats: {
    readonly truncatedCalls: number;
    readonly totalTokensSaved: number;
  };
  /** 도구 검색 토큰 사용량 추정치 */
  readonly toolSearchTokenEstimate: number;
  /** 연결된 서버 수 */
  readonly connectedServers: number;
}

/** 기본 설정값 */
const DEFAULT_CONFIG = {
  enableResources: true,
  enablePrompts: true,
  enableToolSearch: true,
  enableOAuth: true,
  enableToolFilter: true,
  enableOutputLimiter: true,
  toolSearchThreshold: 50,
} as const;

/**
 * 6개의 MCP 서브 모듈을 통합하여 서버 수명주기를 관리하는 오케스트레이터
 *
 * MCPManager.connectAll()로 서버에 연결한 후,
 * 이 커넥터로 리소스/프롬프트/도구 검색 등의 부가 기능을 초기화합니다.
 */
export class MCPManagerConnector {
  /** 리소스 관리자 — 리소스 검색, 읽기, 캐싱 담당 */
  private readonly resourceManager: MCPResourceManager;
  /** 프롬프트 관리자 — 프롬프트 검색, 실행, 슬래시 명령 생성 담당 */
  private readonly promptManager: MCPPromptManager;
  /** 도구 검색 — 지연 로딩 도구의 이름/설명 저장 및 검색 담당 */
  private readonly toolSearch: MCPToolSearch;
  /** OAuth 관리자 — 토큰 발급, 갱신, 저장 담당 */
  private readonly oauthManager: MCPOAuthManager;
  /** 도구 필터 — 허용/차단 목록 기반 도구 필터링 담당 */
  private readonly toolFilter: MCPToolFilter;
  /** 출력 제한기 — 도구 출력을 지능적으로 잘라 토큰 절약 */
  private readonly outputLimiter: MCPOutputLimiter;
  /** 리소스 모듈 활성화 여부 */
  private readonly enableResources: boolean;
  /** 프롬프트 모듈 활성화 여부 */
  private readonly enablePrompts: boolean;
  /** 도구 검색 모듈 활성화 여부 */
  private readonly enableToolSearch: boolean;
  /** OAuth 모듈 활성화 여부 */
  private readonly enableOAuth: boolean;
  /** 도구 필터 모듈 활성화 여부 */
  private readonly enableToolFilter: boolean;
  /** 출력 제한 모듈 활성화 여부 */
  private readonly enableOutputLimiter: boolean;
  /** 지연 로딩 전환 기준 도구 수 */
  private readonly toolSearchThreshold: number;
  /** 연결된 서버 이름 집합 */
  private readonly connectedServerNames = new Set<string>();

  /**
   * @param config - 서브 모듈 활성화 및 세부 설정 (모두 선택)
   */
  constructor(config?: MCPConnectorConfig) {
    this.enableResources = config?.enableResources ?? DEFAULT_CONFIG.enableResources;
    this.enablePrompts = config?.enablePrompts ?? DEFAULT_CONFIG.enablePrompts;
    this.enableToolSearch = config?.enableToolSearch ?? DEFAULT_CONFIG.enableToolSearch;
    this.enableOAuth = config?.enableOAuth ?? DEFAULT_CONFIG.enableOAuth;
    this.enableToolFilter = config?.enableToolFilter ?? DEFAULT_CONFIG.enableToolFilter;
    this.enableOutputLimiter = config?.enableOutputLimiter ?? DEFAULT_CONFIG.enableOutputLimiter;
    this.toolSearchThreshold = config?.toolSearchThreshold ?? DEFAULT_CONFIG.toolSearchThreshold;

    // 각 서브 모듈 인스턴스 생성
    this.resourceManager = new MCPResourceManager();
    this.promptManager = new MCPPromptManager();
    this.toolSearch = new MCPToolSearch();
    this.oauthManager = new MCPOAuthManager();
    this.toolFilter = new MCPToolFilter();
    this.outputLimiter = new MCPOutputLimiter(config?.outputLimiterConfig);
  }

  /**
   * MCPClient가 연결된 후 단일 서버의 모든 서브 모듈을 초기화합니다.
   *
   * 초기화 순서 (6단계):
   * 1. OAuth — 저장된 토큰 로드
   * 2. 도구 검색 + 필터 적용
   * 3. 도구 수가 임계값 초과 시 지연 로딩 등록
   * 4. 리소스 검색
   * 5. 프롬프트 검색
   * 6. 출력 제한기 서버별 설정
   *
   * 리소스/프롬프트 검색 실패는 치명적이지 않으므로 무시합니다.
   *
   * @param client - 연결된 MCP 클라이언트
   * @param serverName - 서버 이름
   * @param _serverConfig - 서버 설정 (현재 미사용, 향후 확장용)
   * @returns 연결 결과 (리소스/프롬프트/도구 수 등)
   */
  async connectServer(
    client: MCPClient,
    serverName: string,
    _serverConfig: MCPServerConfig,
  ): Promise<MCPServerConnectionResult> {
    // 1단계: OAuth — 저장된 토큰이 있는지 확인
    let oauthRequired = false;
    if (this.enableOAuth) {
      try {
        const token = await this.oauthManager.loadToken(serverName);
        oauthRequired = token !== null;
      } catch {
        // OAuth가 이 서버에 설정되지 않음 — 건너뜀
      }
    }

    // 2단계: 도구 목록 조회 및 필터 적용
    let tools: readonly MCPToolDefinition[] = [];
    let filteredToolCount = 0;
    try {
      tools = await client.listTools();
    } catch (error) {
      throw new MCPManagerConnectorError("Failed to list tools", {
        serverName,
        cause: error instanceof Error ? error.message : String(error),
      });
    }

    // 허용/차단 목록 필터 적용
    if (this.enableToolFilter) {
      const originalCount = tools.length;
      tools = this.toolFilter.filterTools(serverName, tools);
      filteredToolCount = originalCount - tools.length;
    }

    // 3단계: 도구 수가 임계값을 초과하면 지연 로딩으로 전환
    // (이름과 설명만 저장하고, 전체 스키마는 검색 시에만 로딩)
    let deferredToolCount = 0;
    if (this.enableToolSearch && tools.length > this.toolSearchThreshold) {
      // MCPClient를 ToolSearchableClient 어댑터로 래핑
      const toolSearchClient: ToolSearchableClient = {
        listTools: () => Promise.resolve(tools),
      };
      const deferred = await this.toolSearch.registerDeferredTools(toolSearchClient, serverName);
      deferredToolCount = deferred.length;
    }

    // 4단계: 리소스 검색 (실패해도 치명적이지 않음)
    let resourceCount = 0;
    if (this.enableResources) {
      try {
        const resources = await this.resourceManager.discoverResources(client, serverName);
        resourceCount = resources.length;
      } catch {
        // 리소스 검색 실패는 치명적이지 않음 — 무시
      }
    }

    // 5단계: 프롬프트 검색 (클라이언트가 프롬프트를 지원하는 경우만)
    let promptCount = 0;
    if (this.enablePrompts && isPromptCapable(client)) {
      try {
        const prompts = await this.promptManager.discoverPrompts(client, serverName);
        promptCount = prompts.length;
      } catch {
        // 프롬프트 검색 실패는 치명적이지 않음 — 무시
      }
    }

    // 6단계: 출력 제한기 서버별 설정
    if (this.enableOutputLimiter) {
      this.outputLimiter.setServerLimit(serverName, {});
    }

    this.connectedServerNames.add(serverName);

    return {
      serverName,
      resourceCount,
      promptCount,
      toolCount: tools.length,
      deferredToolCount,
      oauthRequired,
      filteredToolCount,
    };
  }

  /**
   * 모든 연결된 서버에 대해 서브 모듈을 초기화합니다.
   *
   * MCPManager.connectAll()이 완료된 후 호출합니다.
   * 부분 실패를 허용하며, 실패한 서버는 errors 배열에 기록됩니다.
   *
   * @param clients - 서버 이름 → MCPClient 맵
   * @param configs - 서버 이름 → MCPServerConfig 맵
   * @returns 전체 연결 결과 (성공/실패/합계)
   */
  async connectAllServers(
    clients: ReadonlyMap<string, MCPClient>,
    configs: Record<string, MCPServerConfig>,
  ): Promise<MCPConnectorResult> {
    const results: MCPServerConnectionResult[] = [];
    const errors: { readonly serverName: string; readonly error: string }[] = [];

    const entries = [...clients.entries()];
    // 모든 서버를 병렬로 처리 (부분 실패 허용)
    const settled = await Promise.allSettled(
      entries.map(async ([serverName, client]) => {
        const config = configs[serverName];
        if (!config) {
          throw new MCPManagerConnectorError("Missing server configuration", { serverName });
        }
        return this.connectServer(client, serverName, config);
      }),
    );

    // 결과를 성공/실패로 분류
    for (let i = 0; i < settled.length; i++) {
      const result = settled[i];
      if (result.status === "fulfilled") {
        results.push(result.value);
      } else {
        errors.push({
          serverName: entries[i][0],
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        });
      }
    }

    return {
      servers: results,
      totalResources: results.reduce((sum, r) => sum + r.resourceCount, 0),
      totalPrompts: results.reduce((sum, r) => sum + r.promptCount, 0),
      totalTools: results.reduce((sum, r) => sum + r.toolCount, 0),
      totalDeferredTools: results.reduce((sum, r) => sum + r.deferredToolCount, 0),
      errors,
    };
  }

  /**
   * 모든 서브 모듈의 상태를 정리합니다.
   *
   * 캐시, 검색 인덱스, 필터 등을 모두 초기화합니다.
   */
  async disconnectAll(): Promise<void> {
    this.resourceManager.clearCache();
    this.promptManager.clear();
    this.toolSearch.clear();
    this.toolFilter.clear();
    this.connectedServerNames.clear();
  }

  /**
   * 리소스 관리자를 반환합니다.
   * @mention 구문 해석에 사용됩니다.
   *
   * @returns MCPResourceManager 인스턴스
   */
  getResourceManager(): MCPResourceManager {
    return this.resourceManager;
  }

  /**
   * 프롬프트 관리자를 반환합니다.
   * 슬래시 명령 생성에 사용됩니다.
   *
   * @returns MCPPromptManager 인스턴스
   */
  getPromptManager(): MCPPromptManager {
    return this.promptManager;
  }

  /**
   * 도구 검색 모듈을 반환합니다.
   * 지연 로딩된 도구의 스키마 해석에 사용됩니다.
   *
   * @returns MCPToolSearch 인스턴스
   */
  getToolSearch(): MCPToolSearch {
    return this.toolSearch;
  }

  /**
   * OAuth 관리자를 반환합니다.
   * 토큰 발급/갱신/저장에 사용됩니다.
   *
   * @returns MCPOAuthManager 인스턴스
   */
  getOAuthManager(): MCPOAuthManager {
    return this.oauthManager;
  }

  /**
   * 도구 필터를 반환합니다.
   * 허용/차단 목록 설정에 사용됩니다.
   *
   * @returns MCPToolFilter 인스턴스
   */
  getToolFilter(): MCPToolFilter {
    return this.toolFilter;
  }

  /**
   * 출력 제한기를 반환합니다.
   * 잘림 설정 변경에 사용됩니다.
   *
   * @returns MCPOutputLimiter 인스턴스
   */
  getOutputLimiter(): MCPOutputLimiter {
    return this.outputLimiter;
  }

  /**
   * MCP 도구 실행 결과의 출력을 제한합니다.
   *
   * 출력이 설정된 토큰/문자 제한을 초과하면 지능적으로 잘라냅니다.
   * 출력 제한이 비활성화되어 있으면 원본 그대로 반환합니다.
   *
   * @param content - 도구 실행 결과 문자열
   * @param serverName - 서버별 설정을 적용하기 위한 서버 이름 (선택)
   * @returns 제한된 (또는 원본) 출력 문자열
   */
  limitToolOutput(content: string, serverName?: string): string {
    if (!this.enableOutputLimiter) {
      return content;
    }
    const result = this.outputLimiter.limitOutput(content, serverName);
    return result.content;
  }

  /**
   * MCP 상태를 기반으로 시스템 프롬프트 섹션을 생성합니다.
   *
   * LLM에 MCP 서버 정보, 지연 도구 목록, 프롬프트 명령어 등을
   * 주입하기 위한 텍스트를 생성합니다.
   *
   * @returns 시스템 프롬프트 섹션 객체
   */
  generateSystemPromptSections(): MCPSystemPromptSections {
    return {
      mcpServers: this.buildMcpServersSection(),
      deferredTools: this.buildDeferredToolsSection(),
      resourceHints: "",
      promptCommands: this.buildPromptCommandsSection(),
    };
  }

  /**
   * 커넥터의 운영 통계를 반환합니다.
   *
   * 리소스 캐시 히트율, 출력 제한 효과, 도구 검색 토큰 사용량 등
   * 운영 모니터링에 유용한 정보를 제공합니다.
   *
   * @returns 통계 정보 객체
   */
  getStats(): MCPConnectorStats {
    const cacheStats = this.resourceManager.getCacheStats();
    const limiterStats = this.outputLimiter.getStats();

    return {
      resourceCacheStats: {
        hits: cacheStats.hits,
        misses: cacheStats.misses,
        size: cacheStats.size,
      },
      outputLimiterStats: {
        truncatedCalls: limiterStats.truncatedCalls,
        totalTokensSaved: limiterStats.totalTokensSaved,
      },
      toolSearchTokenEstimate: this.toolSearch.estimateTokens(),
      connectedServers: this.connectedServerNames.size,
    };
  }

  /**
   * 연결된 MCP 서버 목록을 텍스트로 생성합니다 (시스템 프롬프트용).
   *
   * @returns 서버 목록 문자열 (없으면 빈 문자열)
   */
  private buildMcpServersSection(): string {
    if (this.connectedServerNames.size === 0) {
      return "";
    }

    const lines: string[] = [];
    for (const serverName of this.connectedServerNames) {
      lines.push(`Server: ${serverName}`);
    }
    return lines.join("\n");
  }

  /**
   * 지연 로딩 도구 요약을 생성합니다 (시스템 프롬프트용).
   *
   * @returns 지연 도구 요약 문자열
   */
  private buildDeferredToolsSection(): string {
    return this.toolSearch.generateDeferredToolsSummary();
  }

  /**
   * 사용 가능한 프롬프트 명령어 목록을 생성합니다 (시스템 프롬프트용).
   *
   * 각 프롬프트는 "/mcp__서버명__프롬프트명" 형태의 슬래시 명령으로 표시됩니다.
   *
   * @returns 프롬프트 명령어 목록 문자열
   */
  private buildPromptCommandsSection(): string {
    const allPrompts = this.promptManager.getAllPrompts();
    if (allPrompts.size === 0) {
      return "";
    }

    const lines: string[] = ["Available MCP prompts:"];
    for (const [namespacedName, stored] of allPrompts) {
      const desc = stored.prompt.description ? ` — ${stored.prompt.description}` : "";
      lines.push(`  /${namespacedName}${desc}`);
    }
    return lines.join("\n");
  }
}

/**
 * MCPClient가 프롬프트 기능을 지원하는지 확인하는 타입 가드
 *
 * 타입 가드(Type Guard)란: 런타임에 객체의 타입을 좁혀주는 함수입니다.
 * 이 함수가 true를 반환하면 TypeScript가 client를 PromptCapableClient로 인식합니다.
 *
 * @param client - 확인할 클라이언트 객체
 * @returns true면 프롬프트 기능(listPrompts, getPrompt 메서드)을 지원
 */
function isPromptCapable(client: unknown): client is PromptCapableClient {
  return (
    typeof client === "object" &&
    client !== null &&
    "listPrompts" in client &&
    "getPrompt" in client &&
    typeof (client as Record<string, unknown>).listPrompts === "function" &&
    typeof (client as Record<string, unknown>).getPrompt === "function"
  );
}

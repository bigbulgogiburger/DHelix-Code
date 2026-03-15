/**
 * MCP 도구 필터 — 서버별 도구 허용/차단 목록 관리 모듈
 *
 * MCP 서버가 제공하는 도구 중 일부만 에이전트에 노출하거나,
 * 특정 도구를 차단해야 할 때 사용합니다.
 *
 * 필터 규칙:
 * 1. allowlist만 설정 → 목록에 있는 도구만 통과
 * 2. denylist만 설정 → 목록에 있는 도구만 차단
 * 3. 둘 다 설정 → allowlist 먼저 적용, 그 다음 denylist 적용
 * 4. 둘 다 미설정 → 모든 도구 통과
 *
 * 설정 소스:
 * - MCP 서버 설정 파일의 allowedTools / blockedTools 필드
 * - 관리자(managed) 설정에서의 강제 필터
 */
import { BaseError } from "../utils/error.js";
import { type MCPToolDefinition } from "./types.js";

/**
 * 도구 필터 에러 클래스
 */
export class MCPToolFilterError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "MCP_TOOL_FILTER_ERROR", context);
  }
}

/**
 * 서버별 도구 필터 설정
 *
 * allowlist와 denylist에 같은 도구 이름이 있으면 에러가 발생합니다.
 */
export interface MCPToolFilterConfig {
  /** 허용할 도구 이름 목록 (이 목록에 있는 도구만 통과) */
  readonly allowlist?: readonly string[];
  /** 차단할 도구 이름 목록 (이 목록에 있는 도구는 제외) */
  readonly denylist?: readonly string[];
}

/**
 * 서버별 허용/차단 목록으로 MCP 도구를 필터링합니다.
 *
 * 적용 순서:
 * 1. allowlist가 있으면 → 목록에 있는 도구만 유지
 * 2. denylist가 있으면 → 목록에 있는 도구 제거
 * 3. 둘 다 있으면 → allowlist 먼저, 그 다음 denylist
 * 4. 둘 다 없으면 → 전체 통과
 */
export class MCPToolFilter {
  /** 서버별 필터 설정 맵 */
  private readonly filters = new Map<string, MCPToolFilterConfig>();

  /**
   * 서버의 필터 설정을 등록합니다.
   *
   * allowlist와 denylist에 중복 항목이 있으면 에러를 던집니다.
   *
   * @param serverName - 서버 이름
   * @param config - 필터 설정 (allowlist, denylist)
   * @throws MCPToolFilterError allowlist와 denylist에 중복 항목이 있을 때
   */
  setFilter(serverName: string, config: MCPToolFilterConfig): void {
    this.validateConfig(serverName, config);
    this.filters.set(serverName, config);
  }

  /**
   * 서버의 필터 설정을 조회합니다.
   *
   * @param serverName - 서버 이름
   * @returns 필터 설정 또는 undefined (필터 미설정 시)
   */
  getFilter(serverName: string): MCPToolFilterConfig | undefined {
    return this.filters.get(serverName);
  }

  /**
   * 도구 목록에 필터를 적용합니다.
   *
   * 원본 배열을 변경하지 않고 새 배열을 반환합니다 (불변성 유지).
   *
   * @param serverName - 서버 이름
   * @param tools - 필터링할 도구 목록
   * @returns 필터 적용 후 통과한 도구 목록
   */
  filterTools(
    serverName: string,
    tools: readonly MCPToolDefinition[],
  ): readonly MCPToolDefinition[] {
    const config = this.filters.get(serverName);
    if (!config) {
      // 필터가 없으면 전체 통과
      return tools;
    }

    let filtered = [...tools];

    // 1단계: allowlist 적용 (있으면 목록에 있는 도구만 유지)
    if (config.allowlist && config.allowlist.length > 0) {
      const allowSet = new Set(config.allowlist);
      filtered = filtered.filter((tool) => allowSet.has(tool.name));
    }

    // 2단계: denylist 적용 (있으면 목록에 있는 도구 제거)
    if (config.denylist && config.denylist.length > 0) {
      const denySet = new Set(config.denylist);
      filtered = filtered.filter((tool) => !denySet.has(tool.name));
    }

    return filtered;
  }

  /**
   * 특정 도구가 서버에서 허용되는지 확인합니다.
   *
   * @param serverName - 서버 이름
   * @param toolName - 도구 이름
   * @returns true면 허용됨
   */
  isToolAllowed(serverName: string, toolName: string): boolean {
    const config = this.filters.get(serverName);
    if (!config) {
      // 필터가 없으면 모두 허용
      return true;
    }

    // allowlist에 없으면 거부
    if (config.allowlist && config.allowlist.length > 0) {
      if (!config.allowlist.includes(toolName)) {
        return false;
      }
    }

    // denylist에 있으면 거부
    if (config.denylist && config.denylist.length > 0) {
      if (config.denylist.includes(toolName)) {
        return false;
      }
    }

    return true;
  }

  /**
   * 서버의 필터 설정을 제거합니다.
   *
   * @param serverName - 서버 이름
   */
  removeFilter(serverName: string): void {
    this.filters.delete(serverName);
  }

  /**
   * 모든 필터 설정을 제거합니다.
   */
  clear(): void {
    this.filters.clear();
  }

  /**
   * MCP 서버 설정에서 필터를 일괄 로드합니다.
   *
   * 설정 파일의 서버 항목에서 allowedTools, blockedTools 필드를
   * 읽어 필터로 등록합니다.
   *
   * @param config - 서버 이름 → 필터 설정 맵
   *
   * @example
   * loadFromConfig({
   *   "my-server": {
   *     allowedTools: ["read", "write"],
   *     blockedTools: ["delete"]
   *   }
   * });
   */
  loadFromConfig(
    config: Readonly<
      Record<string, { allowedTools?: readonly string[]; blockedTools?: readonly string[] }>
    >,
  ): void {
    for (const [serverName, serverConfig] of Object.entries(config)) {
      const filterConfig: MCPToolFilterConfig = {
        ...(serverConfig.allowedTools ? { allowlist: [...serverConfig.allowedTools] } : {}),
        ...(serverConfig.blockedTools ? { denylist: [...serverConfig.blockedTools] } : {}),
      };

      // 필터할 내용이 있을 때만 등록
      if (filterConfig.allowlist || filterConfig.denylist) {
        this.setFilter(serverName, filterConfig);
      }
    }
  }

  /**
   * 필터 설정의 유효성을 검사합니다.
   *
   * allowlist와 denylist에 동일한 도구 이름이 있으면 에러를 던집니다.
   * (허용하면서 동시에 차단하는 것은 모순이므로)
   *
   * @param serverName - 서버 이름 (에러 메시지용)
   * @param config - 검사할 필터 설정
   * @throws MCPToolFilterError 중복 항목 발견 시
   */
  private validateConfig(serverName: string, config: MCPToolFilterConfig): void {
    if (config.allowlist && config.denylist) {
      // 두 목록의 교집합 확인
      const overlap = config.allowlist.filter((name) => config.denylist!.includes(name));
      if (overlap.length > 0) {
        throw new MCPToolFilterError(
          `Tool names appear in both allowlist and denylist for server "${serverName}"`,
          { serverName, overlapping: overlap },
        );
      }
    }
  }
}

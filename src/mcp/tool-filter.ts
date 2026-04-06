/**
 * MCP 도구 필터 — 서버별 도구 허용/차단 목록 관리 모듈 (Glob 패턴 지원)
 *
 * MCP 서버가 제공하는 도구 중 일부만 에이전트에 노출하거나,
 * 특정 도구를 차단해야 할 때 사용합니다.
 *
 * 패턴 문법:
 * - `github_*`      → "github_"로 시작하는 모든 도구 이름 매칭
 * - `*_delete_*`    → "delete"가 포함된 모든 도구 이름 매칭
 * - `exact_name`    → 정확히 일치하는 도구 이름만 매칭
 * - `*`             → 모든 도구 이름 매칭
 *
 * 필터 평가 순서 (Deny-first):
 * 1. denylist에 매칭 → 차단 (즉시 반환)
 * 2. allowlist가 있고 매칭 안 됨 → 차단
 * 3. allowlist가 없음 → 허용
 * 4. allowlist에 매칭 → 허용
 *
 * 설정 소스:
 * - MCP 서버 설정 파일의 allowedTools / blockedTools 필드
 * - 관리자(managed) 설정에서의 강제 필터
 */
import { BaseError } from "../utils/error.js";
import { type MCPToolDefinition } from "./types.js";

/**
 * Glob 패턴을 RegExp로 변환합니다.
 *
 * 지원 문법:
 * - `*` → 0개 이상의 임의 문자 (`[^]*` 에 대응)
 * - 그 외 모든 문자는 RegExp 특수문자로 해석되지 않도록 이스케이프 처리
 *
 * 외부 라이브러리(minimatch 등)를 사용하지 않고 직접 구현합니다.
 *
 * @param pattern - 변환할 glob 패턴 문자열
 * @returns 전체 문자열 매칭 RegExp (`^...$`)
 *
 * @example
 * globToRegExp("github_*")   // /^github_[^]*$/
 * globToRegExp("*_delete_*") // /^[^]*_delete_[^]*$/
 * globToRegExp("exact_name") // /^exact_name$/
 */
function globToRegExp(pattern: string): RegExp {
  // 각 문자를 순서대로 처리하여 RegExp 패턴 문자열을 생성
  const regexSource = pattern
    .split("")
    .map((char) => {
      if (char === "*") {
        // `*` → 0개 이상의 임의 문자 (줄바꿈 포함)
        return "[^]*";
      }
      // RegExp 특수문자를 리터럴로 이스케이프
      return char.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    })
    .join("");

  return new RegExp(`^${regexSource}$`);
}

/**
 * 도구 이름이 주어진 패턴 목록 중 하나 이상에 매칭되는지 확인합니다.
 *
 * 패턴에 `*` 와일드카드가 포함되어 있으면 glob 매칭을,
 * 그렇지 않으면 단순 문자열 동일성 비교(exact match)를 수행합니다.
 * Exact match를 먼저 확인하는 short-circuit 최적화가 적용됩니다.
 *
 * @param toolName - 검사할 도구 이름
 * @param patterns - 매칭할 패턴 목록 (glob 또는 exact 이름)
 * @returns 하나 이상의 패턴에 매칭되면 true
 */
function matchesAnyPattern(toolName: string, patterns: readonly string[]): boolean {
  for (const pattern of patterns) {
    if (!pattern.includes("*")) {
      // 와일드카드 없음 → 빠른 exact match
      if (toolName === pattern) return true;
    } else {
      // 와일드카드 있음 → glob → RegExp 변환 후 매칭
      if (globToRegExp(pattern).test(toolName)) return true;
    }
  }
  return false;
}

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
 * 패턴에는 exact match 문자열 또는 `*` 와일드카드를 포함한 glob 패턴을 사용합니다.
 * allowlist와 denylist에 같은 패턴 문자열이 있으면 에러가 발생합니다.
 *
 * @example
 * { allowlist: ["github_*"], denylist: ["*_delete_*"] }
 */
export interface MCPToolFilterConfig {
  /** 허용할 도구 이름 또는 glob 패턴 목록 (이 목록에 매칭되는 도구만 통과) */
  readonly allowlist?: readonly string[];
  /** 차단할 도구 이름 또는 glob 패턴 목록 (이 목록에 매칭되는 도구는 제외) */
  readonly denylist?: readonly string[];
}

/**
 * 서버별 허용/차단 목록으로 MCP 도구를 필터링합니다 (Glob 패턴 지원).
 *
 * 평가 순서 (Deny-first):
 * 1. denylist 패턴에 매칭 → 차단 (즉시)
 * 2. allowlist가 있고 매칭 안 됨 → 차단
 * 3. allowlist가 없음 → 허용
 * 4. allowlist에 매칭 → 허용
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
   * 평가 순서 (Deny-first):
   * 1. denylist 패턴에 매칭 → 차단
   * 2. allowlist가 있고 매칭 안 됨 → 차단
   * 3. 그 외 → 허용
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

    return tools.filter((tool) => this.evaluateTool(tool.name, config));
  }

  /**
   * 특정 도구가 서버에서 허용되는지 확인합니다.
   *
   * Glob 패턴 및 exact match 모두 지원합니다.
   * 평가 순서는 deny-first입니다 (filterTools와 동일).
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

    return this.evaluateTool(toolName, config);
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
   * 단일 도구 이름을 필터 설정에 따라 평가합니다 (Deny-first 순서).
   *
   * 평가 흐름:
   * 1. denylist 패턴에 매칭 → false (차단)
   * 2. allowlist가 있고 매칭 안 됨 → false (차단)
   * 3. 그 외 → true (허용)
   *
   * @param toolName - 평가할 도구 이름
   * @param config - 적용할 필터 설정
   * @returns true면 허용됨
   */
  private evaluateTool(toolName: string, config: MCPToolFilterConfig): boolean {
    // 1단계: denylist 먼저 확인 (Deny-first)
    if (config.denylist && config.denylist.length > 0) {
      if (matchesAnyPattern(toolName, config.denylist)) {
        return false;
      }
    }

    // 2단계: allowlist 확인 (있을 때만)
    if (config.allowlist && config.allowlist.length > 0) {
      return matchesAnyPattern(toolName, config.allowlist);
    }

    // allowlist 미설정 → 허용
    return true;
  }

  /**
   * 필터 설정의 유효성을 검사합니다.
   *
   * allowlist와 denylist에 동일한 패턴(exact 또는 glob)이 있으면 에러를 던집니다.
   * 글로벌 패턴(`*`)이 양쪽에 있는 경우도 충돌로 간주합니다.
   * (허용하면서 동시에 차단하는 것은 모순이므로)
   *
   * @param serverName - 서버 이름 (에러 메시지용)
   * @param config - 검사할 필터 설정
   * @throws MCPToolFilterError 중복 항목 발견 시
   */
  private validateConfig(serverName: string, config: MCPToolFilterConfig): void {
    if (config.allowlist && config.denylist) {
      // 두 목록에 동일한 패턴 문자열이 있는지 확인
      const overlap = config.allowlist.filter((pattern) => config.denylist!.includes(pattern));
      if (overlap.length > 0) {
        throw new MCPToolFilterError(
          `Tool patterns appear in both allowlist and denylist for server "${serverName}"`,
          { serverName, overlapping: overlap },
        );
      }
    }
  }
}

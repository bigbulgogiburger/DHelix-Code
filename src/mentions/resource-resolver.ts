/**
 * MCP 리소스 리졸버 — @server:resource 멘션의 MCP 리소스 해석 및 자동완성
 *
 * MCPResourceManager와 @멘션 시스템을 통합하여,
 * 사용자가 @server:resource 형식으로 MCP 리소스를 참조하면
 * 해당 리소스의 콘텐츠를 가져와 컨텍스트에 주입합니다.
 *
 * 주요 기능:
 * - 멘션 파싱: @server:protocol://path 형식의 멘션 추출
 * - 리소스 해석: MCP 클라이언트를 통해 리소스 콘텐츠 조회
 * - 자동완성: "@"나 "@server:" 입력 시 서버/리소스 제안
 * - 캐싱: 서버별 리소스 목록을 캐시하여 반복 조회 최소화
 * - 토큰 추정: 주입할 콘텐츠의 토큰 수를 추정 (1 토큰 ≈ 4 문자)
 *
 * @example
 * const resolver = new MCPResourceResolver({ resourceManager, clients });
 *
 * // 멘션이 포함된 텍스트에서 리소스 해석
 * const result = await resolver.resolveAll("@postgres:sql://users/schema을 보여줘");
 * console.log(result.contextXml); // "<mcp-resources>...</mcp-resources>"
 *
 * // 자동완성 제안
 * const suggestions = await resolver.getSuggestions("@post");
 * // → [{ display: "@postgres:", insert: "@postgres:", ... }]
 */

import { type MCPResourceManager, type ResourceMention } from "../mcp/resources.js";
import { type MCPClient } from "../mcp/client.js";
import { type MCPResource } from "../mcp/types.js";
import { BaseError } from "../utils/error.js";

/** 리소스 해석 에러 */
export class ResourceResolverError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "RESOURCE_RESOLVER_ERROR", context);
  }
}

/** 해석된 리소스 — 컨텍스트 주입 준비 완료 */
export interface ResolvedResourceContext {
  /** MCP 서버 이름 */
  readonly serverName: string;
  /** 리소스 URI */
  readonly resourceUri: string;
  /** 리소스 콘텐츠 (잘림 처리 가능) */
  readonly content: string;
  /** 콘텐츠 MIME 타입 (선택적) */
  readonly mimeType?: string;
  /** 최대 길이 초과로 잘렸는지 여부 */
  readonly truncated: boolean;
  /** 원본 콘텐츠 길이 (잘리기 전) */
  readonly originalLength: number;
}

/** @server:resource 멘션의 자동완성 제안 */
export interface ResourceSuggestion {
  /** 사용자에게 표시할 텍스트 (예: "@postgres:sql://users") */
  readonly display: string;
  /** 입력에 삽입할 텍스트 */
  readonly insert: string;
  /** 리소스 설명 */
  readonly description: string;
  /** MCP 서버 이름 */
  readonly serverName: string;
  /** 리소스 URI */
  readonly uri: string;
}

/** 모든 리소스 멘션 해석의 최종 결과 */
export interface ResourceResolutionResult {
  /** 성공적으로 해석된 리소스 목록 */
  readonly resolvedResources: readonly ResolvedResourceContext[];
  /** 해석에 실패한 리소스 목록 (멘션 + 에러 정보) */
  readonly failedResources: readonly { readonly mention: string; readonly error: string }[];
  /** 해석된 리소스를 XML 형태로 조합한 컨텍스트 문자열 */
  readonly contextXml: string;
  /** 멘션이 제거/치환된 원본 텍스트 */
  readonly strippedText: string;
  /** 컨텍스트 XML의 추정 토큰 수 (1 토큰 ≈ 4 문자) */
  readonly totalTokensEstimate: number;
}

/** MCPResourceResolver 생성 설정 */
export interface ResourceResolverConfig {
  /** MCP 리소스 매니저 인스턴스 */
  readonly resourceManager: MCPResourceManager;
  /** 서버이름 → MCP 클라이언트 매핑 */
  readonly clients: Map<string, MCPClient>;
  /** 리소스당 최대 콘텐츠 길이 (문자 수, 선택적) */
  readonly maxContentLength?: number;
}

/** 리소스당 기본 최대 콘텐츠 길이 (50,000자) */
const DEFAULT_MAX_CONTENT_LENGTH = 50_000;

/**
 * 텍스트에서 @server:resource 멘션을 치환하기 위한 정규식 패턴.
 * @서버이름:프로토콜://경로 또는 @서버이름:이름 형식과 매칭됩니다.
 */
const RESOURCE_MENTION_REPLACE_PATTERN = /@(\w[\w-]*):([\w+.-]+:\/\/[^\s]+|[\w./:_-]+)/g;

/**
 * MCPResourceManager와 @멘션 시스템을 통합하는 리졸버.
 *
 * 사용자 입력의 @server:resource 멘션을 해석하고,
 * 리소스 콘텐츠를 가져와 XML 형식의 컨텍스트로 포맷합니다.
 *
 * @example
 * const resolver = new MCPResourceResolver({
 *   resourceManager,
 *   clients: new Map([["postgres", pgClient]]),
 * });
 *
 * // 전체 해석
 * const result = await resolver.resolveAll("@postgres:sql://users를 보여줘");
 *
 * // 자동완성
 * const suggestions = await resolver.getSuggestions("@post");
 */
export class MCPResourceResolver {
  private readonly resourceManager: MCPResourceManager;
  /** 서버 이름 → MCP 클라이언트 매핑 (변경 가능 — updateClients로 업데이트) */
  private clients: Map<string, MCPClient>;
  /** 서버별 리소스 제안 캐시 */
  private readonly resourceCache: Map<string, readonly ResourceSuggestion[]>;
  /** 리소스당 최대 콘텐츠 길이 */
  private readonly maxContentLength: number;

  constructor(config: ResourceResolverConfig) {
    this.resourceManager = config.resourceManager;
    this.clients = new Map(config.clients);
    this.resourceCache = new Map();
    this.maxContentLength = config.maxContentLength ?? DEFAULT_MAX_CONTENT_LENGTH;
  }

  /**
   * 텍스트에서 @server:resource 멘션을 파싱합니다.
   * MCPResourceManager.parseResourceMentions()에 위임합니다.
   *
   * @param text - 파싱할 입력 텍스트
   * @returns 파싱된 리소스 멘션 배열
   */
  parseMentions(text: string): readonly ResourceMention[] {
    return this.resourceManager.parseResourceMentions(text);
  }

  /**
   * 텍스트의 모든 리소스 멘션을 해석하고, 포맷된 컨텍스트를 반환합니다.
   *
   * 실행 과정:
   * 1. 텍스트에서 멘션 파싱
   * 2. 각 멘션의 서버에 대한 MCP 클라이언트 확인
   * 3. 리소스 콘텐츠를 병렬(Promise.allSettled)로 가져옴
   * 4. 최대 길이 초과 시 잘라냄(truncate)
   * 5. XML 컨텍스트와 토큰 추정치 생성
   *
   * @param text - 멘션이 포함된 입력 텍스트
   * @returns 해석 결과 (리소스, 실패 목록, XML, 치환된 텍스트, 토큰 추정)
   */
  async resolveAll(text: string): Promise<ResourceResolutionResult> {
    const mentions = this.parseMentions(text);

    // 멘션이 없으면 빈 결과 반환
    if (mentions.length === 0) {
      return {
        resolvedResources: [],
        failedResources: [],
        contextXml: "",
        strippedText: text,
        totalTokensEstimate: 0,
      };
    }

    const resolvedResources: ResolvedResourceContext[] = [];
    const failedResources: { readonly mention: string; readonly error: string }[] = [];

    // Promise.allSettled: 일부 실패해도 나머지 결과를 유지
    const results = await Promise.allSettled(
      mentions.map(async (mention) => {
        // 해당 서버의 MCP 클라이언트 확인
        const client = this.clients.get(mention.serverName);
        if (!client) {
          throw new ResourceResolverError(`Server "${mention.serverName}" is not connected`, {
            serverName: mention.serverName,
          });
        }

        // 리소스 콘텐츠 가져오기
        const content = await this.resourceManager.readResource(
          client,
          mention.serverName,
          mention.uri,
        );

        return { mention, content };
      }),
    );

    // 결과 처리
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const mention = mentions[i];

      if (result.status === "fulfilled") {
        const { content } = result.value;
        const originalLength = content.length;
        // 최대 길이 초과 시 잘라냄
        const truncated = originalLength > this.maxContentLength;
        const finalContent = truncated
          ? content.slice(0, this.maxContentLength) + "\n[truncated]"
          : content;

        resolvedResources.push({
          serverName: mention.serverName,
          resourceUri: mention.uri,
          content: finalContent,
          truncated,
          originalLength,
        });
      } else {
        // 실패한 멘션 기록
        const error =
          result.reason instanceof Error ? result.reason.message : String(result.reason);
        failedResources.push({
          mention: `@${mention.serverName}:${mention.uri}`,
          error,
        });
      }
    }

    // XML 컨텍스트 구성
    const contextXml = this.buildContextXml(resolvedResources);
    // 원본 텍스트에서 멘션을 요약 플레이스홀더로 치환
    const strippedText = this.stripMentions(text);
    // 토큰 수 추정
    const totalTokensEstimate = this.estimateTokens(contextXml);

    return {
      resolvedResources,
      failedResources,
      contextXml,
      strippedText,
      totalTokensEstimate,
    };
  }

  /**
   * 부분 입력(@, @server:, @server:partial)에 대한 자동완성 제안을 반환합니다.
   *
   * 동작:
   * - "@" 뒤에 콜론이 없으면 → 서버 이름 제안
   * - "@server:" → 해당 서버의 모든 리소스 제안
   * - "@server:partial" → partial에 매칭되는 리소스만 필터링
   *
   * @param partial - 자동완성할 부분 입력 문자열
   * @returns 자동완성 제안 배열
   */
  async getSuggestions(partial: string): Promise<readonly ResourceSuggestion[]> {
    const atIndex = partial.lastIndexOf("@");
    if (atIndex === -1) return [];

    const afterAt = partial.slice(atIndex + 1);

    // 콜론이 아직 없으면 서버 이름 제안
    const colonIndex = afterAt.indexOf(":");
    if (colonIndex === -1) {
      return this.getServerSuggestions(afterAt);
    }

    // 콜론 이후 — 서버 이름과 리소스 접두사 분리
    const serverName = afterAt.slice(0, colonIndex);
    const resourcePrefix = afterAt.slice(colonIndex + 1);

    // 서버의 리소스 목록 가져오기 (캐시 또는 새로 조회)
    const resources = await this.getOrRefreshServerResources(serverName);

    // 접두사가 없으면 모든 리소스 반환
    if (resourcePrefix.length === 0) {
      return resources;
    }

    // 접두사로 필터링 (대소문자 무시)
    return resources.filter(
      (r) =>
        r.uri.toLowerCase().includes(resourcePrefix.toLowerCase()) ||
        r.display.toLowerCase().includes(resourcePrefix.toLowerCase()),
    );
  }

  /**
   * 모든 연결된 서버의 리소스 카탈로그를 새로고침합니다.
   * 캐시를 비우고 각 서버에서 리소스 목록을 다시 조회합니다.
   */
  async refreshCatalog(): Promise<void> {
    this.resourceCache.clear();

    const refreshPromises = [...this.clients.entries()].map(async ([serverName, client]) => {
      try {
        const resources = await this.resourceManager.discoverResources(client, serverName);
        const suggestions = this.buildSuggestionsFromResources(serverName, resources);
        this.resourceCache.set(serverName, suggestions);
      } catch {
        // 실패 시 빈 목록으로 캐시 — 다음 조회 시 재시도
        this.resourceCache.set(serverName, []);
      }
    });

    await Promise.allSettled(refreshPromises);
  }

  /**
   * 텍스트에 리소스 멘션이 포함되어 있는지 확인합니다.
   *
   * @param text - 확인할 텍스트
   * @returns 멘션이 있으면 true
   */
  hasMentions(text: string): boolean {
    return this.parseMentions(text).length > 0;
  }

  /**
   * 텍스트에서 리소스 멘션을 요약 플레이스홀더로 치환합니다.
   * 예: "@server:protocol://path" → "[resource: server/protocol://path]"
   *
   * @param text - 멘션이 포함된 텍스트
   * @returns 멘션이 치환된 텍스트
   */
  stripMentions(text: string): string {
    return text.replace(
      RESOURCE_MENTION_REPLACE_PATTERN,
      (_match, serverName: string, uri: string) => `[resource: ${serverName}/${uri}]`,
    );
  }

  /**
   * 서버 연결 상태가 변경될 때 클라이언트 매핑을 업데이트합니다.
   * 연결이 해제된 서버의 캐시도 함께 제거합니다.
   *
   * @param clients - 새로운 서버이름 → MCP 클라이언트 매핑
   */
  updateClients(clients: Map<string, MCPClient>): void {
    this.clients = new Map(clients);

    // 연결 해제된 서버의 캐시 제거
    for (const cachedServer of this.resourceCache.keys()) {
      if (!this.clients.has(cachedServer)) {
        this.resourceCache.delete(cachedServer);
      }
    }
  }

  /**
   * 현재 연결된 서버 이름 목록을 반환합니다.
   * @returns 서버 이름 배열
   */
  getAvailableServers(): readonly string[] {
    return [...this.clients.keys()];
  }

  /**
   * 특정 서버의 캐시된 리소스 제안을 반환합니다.
   *
   * @param serverName - 서버 이름
   * @returns 리소스 제안 배열 (캐시가 없으면 빈 배열)
   */
  getServerResources(serverName: string): readonly ResourceSuggestion[] {
    return this.resourceCache.get(serverName) ?? [];
  }

  /**
   * 해석된 리소스들을 시스템 프롬프트 주입용 XML 문자열로 포맷합니다.
   *
   * @param resources - 해석된 리소스 배열
   * @returns XML 형식 컨텍스트 문자열 (빈 배열이면 빈 문자열)
   */
  private buildContextXml(resources: readonly ResolvedResourceContext[]): string {
    if (resources.length === 0) return "";

    const parts = resources.map(
      (r) =>
        `<resource server="${r.serverName}" uri="${r.resourceUri}">\n${r.content}\n</resource>`,
    );

    return `<mcp-resources>\n${parts.join("\n\n")}\n</mcp-resources>`;
  }

  /**
   * 텍스트 길이에서 토큰 수를 추정합니다.
   * 근사값: 1 토큰 ≈ 4 문자 (영어 기준, 한국어는 더 많을 수 있음)
   *
   * @param text - 토큰 수를 추정할 텍스트
   * @returns 추정 토큰 수
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * 접두사로 시작하는 서버 이름 제안을 생성합니다.
   *
   * @param prefix - 서버 이름 접두사 (빈 문자열이면 모든 서버)
   * @returns 서버 이름 제안 배열
   */
  private getServerSuggestions(prefix: string): readonly ResourceSuggestion[] {
    const servers = this.getAvailableServers();
    const filtered =
      prefix.length === 0
        ? servers
        : servers.filter((s) => s.toLowerCase().startsWith(prefix.toLowerCase()));

    return filtered.map((serverName) => ({
      display: `@${serverName}:`,
      insert: `@${serverName}:`,
      description: `MCP server: ${serverName}`,
      serverName,
      uri: "",
    }));
  }

  /**
   * 서버의 리소스 목록을 캐시에서 가져오거나, 없으면 서버에서 조회합니다.
   *
   * @param serverName - 서버 이름
   * @returns 리소스 제안 배열
   */
  private async getOrRefreshServerResources(
    serverName: string,
  ): Promise<readonly ResourceSuggestion[]> {
    // 캐시에 있으면 바로 반환
    const cached = this.resourceCache.get(serverName);
    if (cached) return cached;

    // 서버의 MCP 클라이언트 확인
    const client = this.clients.get(serverName);
    if (!client) return [];

    try {
      // 서버에서 리소스 목록 조회 + 캐시
      const resources = await this.resourceManager.discoverResources(client, serverName);
      const suggestions = this.buildSuggestionsFromResources(serverName, resources);
      this.resourceCache.set(serverName, suggestions);
      return suggestions;
    } catch {
      return [];
    }
  }

  /**
   * MCPResource 배열을 ResourceSuggestion 배열로 변환합니다.
   *
   * @param serverName - 서버 이름
   * @param resources - MCP 리소스 배열
   * @returns 자동완성 제안 배열
   */
  private buildSuggestionsFromResources(
    serverName: string,
    resources: readonly MCPResource[],
  ): readonly ResourceSuggestion[] {
    return resources.map((resource) => ({
      display: `@${serverName}:${resource.uri}`,
      insert: `@${serverName}:${resource.uri}`,
      description: resource.description ?? resource.name,
      serverName,
      uri: resource.uri,
    }));
  }
}

// 편의를 위한 재내보내기(re-export)
export type { ResourceMention } from "../mcp/resources.js";

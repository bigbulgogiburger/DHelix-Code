/**
 * MCP 리소스 매니저 — MCP 서버의 리소스를 발견, 읽기, 캐싱하는 모듈
 *
 * MCP 리소스는 서버가 제공하는 외부 데이터(파일, DB 레코드, API 데이터 등)입니다.
 * 사용자는 @서버이름:리소스URI 구문으로 리소스를 참조할 수 있습니다.
 *
 * @mention 구문 예시:
 * - @myserver:file:///home/user/data.txt
 * - @db:postgres://localhost/mydb
 * - @server:my-resource-name
 *
 * 리소스 캐싱:
 * - TTL(Time-To-Live) 기반 캐시로 동일 리소스의 반복 읽기를 최적화
 * - 기본 TTL: 5분 (300,000ms)
 * - 캐시 히트/미스 통계 추적
 */
import { BaseError } from "../utils/error.js";
import { type MCPClient } from "./client.js";
import { type MCPResource } from "./types.js";

/**
 * MCP 리소스 매니저 에러 클래스
 */
export class MCPResourceError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "MCP_RESOURCE_ERROR", context);
  }
}

/**
 * @server:uri 구문에서 해석된 리소스
 *
 * 서버에서 리소스 메타데이터와 실제 콘텐츠를 읽어온 결과입니다.
 */
export interface ResolvedResource {
  /** 리소스를 제공한 서버 이름 */
  readonly serverName: string;
  /** 리소스 URI */
  readonly uri: string;
  /** 리소스 메타데이터 (이름, 설명, MIME 타입 등) */
  readonly resource: MCPResource;
  /** 리소스의 실제 콘텐츠 (텍스트) */
  readonly content: string;
}

/**
 * 사용자 텍스트에서 추출한 리소스 멘션
 *
 * @server:uri 패턴에서 파싱한 서버 이름과 URI입니다.
 */
export interface ResourceMention {
  /** 서버 이름 */
  readonly serverName: string;
  /** 리소스 URI */
  readonly uri: string;
}

/**
 * 캐시된 리소스 항목
 *
 * TTL(Time-To-Live) 기반 캐시 만료를 위해 타임스탬프를 포함합니다.
 */
interface CachedResource {
  /** 캐시된 콘텐츠 */
  readonly content: string;
  /** 캐시된 시각 (Unix 타임스탬프, ms) */
  readonly timestamp: number;
}

/**
 * 캐시 통계
 */
export interface CacheStats {
  /** 캐시에 저장된 항목 수 */
  readonly size: number;
  /** 캐시 히트 횟수 (캐시에서 찾은 횟수) */
  readonly hits: number;
  /** 캐시 미스 횟수 (캐시에 없어서 서버에서 읽은 횟수) */
  readonly misses: number;
}

/**
 * 리소스 멘션 패턴 정규식: @server:protocol://path 또는 @server:name
 *
 * 매칭 예시:
 * - @myserver:file:///home/user/data.txt → server="myserver", uri="file:///home/user/data.txt"
 * - @db:postgres://localhost/mydb → server="db", uri="postgres://localhost/mydb"
 * - @server:my-resource-name → server="server", uri="my-resource-name"
 * - @my-server:docs/api/reference → server="my-server", uri="docs/api/reference"
 */
const RESOURCE_MENTION_PATTERN = /@(\w[\w-]*):([\w+.-]+:\/\/[^\s]+|[\w./:_-]+)/g;

/**
 * MCP 리소스 검색, 읽기, 캐싱을 관리합니다.
 *
 * 사용자 입력에서 @server:resource-uri 멘션을 파싱하고,
 * 해당 리소스의 콘텐츠를 가져와 대화 컨텍스트에 주입합니다.
 */
export class MCPResourceManager {
  /** 리소스 콘텐츠 캐시 (키: "server::uri") */
  private readonly cache = new Map<string, CachedResource>();
  /** 캐시 TTL (밀리초) */
  private readonly ttlMs: number;
  /** 캐시 히트 카운터 */
  private cacheHits = 0;
  /** 캐시 미스 카운터 */
  private cacheMisses = 0;

  /**
   * @param ttlMs - 캐시 TTL (기본: 5분 = 300,000ms)
   */
  constructor(ttlMs: number = 5 * 60 * 1000) {
    this.ttlMs = ttlMs;
  }

  /**
   * 텍스트에서 @server:resource 멘션을 파싱합니다.
   *
   * 동일한 서버:URI 조합의 중복 멘션은 제거됩니다.
   *
   * @param text - 멘션을 검색할 텍스트
   * @returns 파싱된 멘션 배열 (중복 제거됨)
   */
  parseResourceMentions(text: string): readonly ResourceMention[] {
    const mentions: ResourceMention[] = [];
    const seen = new Set<string>();

    // 정규식에 global 플래그가 있으므로 lastIndex를 리셋하기 위해 새 인스턴스 생성
    const pattern = new RegExp(RESOURCE_MENTION_PATTERN.source, "g");
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
      const serverName = match[1];
      const uri = match[2];
      const key = `${serverName}:${uri}`;

      // 동일한 멘션 중복 제거
      if (!seen.has(key)) {
        seen.add(key);
        mentions.push({ serverName, uri });
      }
    }

    return mentions;
  }

  /**
   * 연결된 MCP 클라이언트에서 모든 리소스를 발견합니다.
   *
   * 클라이언트의 listResources 메서드에 위임합니다.
   *
   * @param client - MCP 클라이언트
   * @param serverName - 서버 이름 (에러 메시지용)
   * @returns 발견된 리소스 배열
   * @throws MCPResourceError 리소스 검색 실패 시
   */
  async discoverResources(client: MCPClient, serverName: string): Promise<readonly MCPResource[]> {
    try {
      return await client.listResources();
    } catch (error) {
      throw new MCPResourceError(`Failed to discover resources from server "${serverName}"`, {
        serverName,
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * 서버에서 리소스를 읽어 반환합니다 (캐시 지원).
   *
   * 캐시 동작:
   * 1. 캐시에 유효한 항목이 있으면 → 캐시 히트, 캐시된 값 반환
   * 2. 캐시에 없거나 만료되었으면 → 캐시 미스, 서버에서 읽고 캐시에 저장
   *
   * @param client - MCP 클라이언트
   * @param serverName - 서버 이름
   * @param uri - 리소스 URI
   * @returns 리소스 콘텐츠 (텍스트)
   * @throws MCPResourceError 리소스 읽기 실패 시
   */
  async readResource(client: MCPClient, serverName: string, uri: string): Promise<string> {
    const cacheKey = this.buildCacheKey(serverName, uri);
    const cached = this.cache.get(cacheKey);

    // 캐시 히트: 유효한 캐시 항목이 있으면 반환
    if (cached && !this.isExpired(cached)) {
      this.cacheHits += 1;
      return cached.content;
    }

    // 캐시 미스: 서버에서 읽기
    this.cacheMisses += 1;

    try {
      const content = await client.readResource(uri);
      // 읽은 내용을 캐시에 저장
      this.cache.set(cacheKey, {
        content,
        timestamp: Date.now(),
      });
      return content;
    } catch (error) {
      throw new MCPResourceError(`Failed to read resource "${uri}" from server "${serverName}"`, {
        serverName,
        uri,
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * 텍스트 내의 모든 @server:resource 멘션을 해석하여 콘텐츠를 반환합니다.
   *
   * 처리 흐름:
   * 1. 텍스트에서 멘션 파싱
   * 2. 각 멘션에 대해 서버 조회 → 리소스 검색 → 콘텐츠 읽기
   * 3. 알 수 없는 서버나 읽기 실패는 에러로 수집하되, 다른 멘션 해석을 차단하지 않음
   *
   * 모든 멘션은 동시에(concurrently) 해석됩니다.
   *
   * @param text - 멘션을 포함한 텍스트
   * @param clients - 서버 이름 → MCPClient 맵
   * @returns 해석된 리소스 배열 (실패한 멘션은 제외)
   */
  async resolveResourceMentions(
    text: string,
    clients: ReadonlyMap<string, MCPClient>,
  ): Promise<readonly ResolvedResource[]> {
    const mentions = this.parseResourceMentions(text);

    if (mentions.length === 0) {
      return [];
    }

    const results: ResolvedResource[] = [];

    // 모든 멘션을 동시에 해석 (부분 실패 허용)
    const resolutions = await Promise.allSettled(
      mentions.map(async (mention) => {
        // 서버 존재 확인
        const client = clients.get(mention.serverName);

        if (!client) {
          throw new MCPResourceError(`Unknown MCP server "${mention.serverName}"`, {
            serverName: mention.serverName,
            uri: mention.uri,
          });
        }

        // 리소스 메타데이터 검색 (URI 또는 이름으로 매칭)
        const resources = await this.discoverResources(client, mention.serverName);

        const resource = resources.find((r) => r.uri === mention.uri || r.name === mention.uri);

        if (!resource) {
          throw new MCPResourceError(
            `Resource "${mention.uri}" not found on server "${mention.serverName}"`,
            { serverName: mention.serverName, uri: mention.uri },
          );
        }

        // 리소스 콘텐츠 읽기
        const content = await this.readResource(client, mention.serverName, resource.uri);

        return {
          serverName: mention.serverName,
          uri: resource.uri,
          resource,
          content,
        } as const;
      }),
    );

    // 성공한 해석만 결과에 포함 (실패한 것은 조용히 건너뜀)
    for (const resolution of resolutions) {
      if (resolution.status === "fulfilled") {
        results.push(resolution.value);
      }
      // 실패한 해석은 조용히 건너뜀 — 호출자가 멘션을 별도로 파싱하여
      // 어떤 것이 실패했는지 확인할 수 있음
    }

    return results;
  }

  /**
   * 해석된 리소스들을 대화 컨텍스트에 주입할 형태로 포맷합니다.
   *
   * 각 리소스는 XML 스타일 태그로 감싸져 서버, URI, 설명, MIME 타입
   * 메타데이터가 속성으로 포함됩니다.
   *
   * 출력 예시:
   * ```xml
   * <resource server="myserver" uri="file:///data.txt" mimeType="text/plain">
   * 파일 내용...
   * </resource>
   * ```
   *
   * @param resources - 포맷할 리소스 배열
   * @returns 포맷된 문자열 (리소스가 없으면 빈 문자열)
   */
  formatResourcesForContext(resources: readonly ResolvedResource[]): string {
    if (resources.length === 0) {
      return "";
    }

    const sections = resources.map((r) => {
      const description = r.resource.description
        ? ` description="${this.escapeXmlAttr(r.resource.description)}"`
        : "";
      const mimeType = r.resource.mimeType
        ? ` mimeType="${this.escapeXmlAttr(r.resource.mimeType)}"`
        : "";

      return [
        `<resource server="${this.escapeXmlAttr(r.serverName)}" uri="${this.escapeXmlAttr(r.uri)}"${description}${mimeType}>`,
        r.content,
        "</resource>",
      ].join("\n");
    });

    return sections.join("\n\n");
  }

  /**
   * 만료된 캐시 항목을 제거합니다.
   *
   * 주기적으로 호출하여 메모리를 절약할 수 있습니다.
   */
  clearExpiredCache(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp >= this.ttlMs) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
  }

  /**
   * 모든 캐시를 초기화합니다 (히트/미스 카운터 포함).
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  /**
   * 캐시 통계를 반환합니다.
   *
   * @returns 캐시 크기, 히트 수, 미스 수
   */
  getCacheStats(): CacheStats {
    return {
      size: this.cache.size,
      hits: this.cacheHits,
      misses: this.cacheMisses,
    };
  }

  /**
   * 서버 이름과 URI로 복합 캐시 키를 생성합니다.
   *
   * @param serverName - 서버 이름
   * @param uri - 리소스 URI
   * @returns "serverName::uri" 형태의 캐시 키
   */
  private buildCacheKey(serverName: string, uri: string): string {
    return `${serverName}::${uri}`;
  }

  /**
   * 캐시 항목이 만료되었는지 확인합니다.
   *
   * @param entry - 확인할 캐시 항목
   * @returns true면 만료됨
   */
  private isExpired(entry: CachedResource): boolean {
    return Date.now() - entry.timestamp >= this.ttlMs;
  }

  /**
   * XML 속성 값에서 특수 문자를 이스케이프합니다.
   *
   * &, ", <, > 문자를 XML 엔티티로 변환합니다.
   * XSS(교차 사이트 스크립팅) 방지에도 도움이 됩니다.
   *
   * @param value - 이스케이프할 문자열
   * @returns 이스케이프된 문자열
   */
  private escapeXmlAttr(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
}

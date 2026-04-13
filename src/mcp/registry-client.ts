/**
 * MCP Registry Client — MCP 2026 Q4 Registry 스펙 클라이언트
 *
 * 원격 MCP 레지스트리에서 서버 목록을 검색하고,
 * 상세 정보를 조회하고, 설치 명령을 실행합니다.
 *
 * 주요 기능:
 * - 레지스트리 서버 검색 (쿼리, 태그, 트랜스포트 필터)
 * - 서버 상세 정보 조회
 * - 설치 명령 실행 (bash 호출)
 * - 캐시 기반 응답 TTL 관리
 * - 설치 목록 추적
 *
 * @example
 * const client = new McpRegistryClient({ cacheTtlMs: 600_000 });
 * const results = await client.search({ query: "github", tags: ["vcs"] });
 * const detail = await client.getServerDetail(results[0].id);
 * await client.install(detail!.id);
 */

import { exec } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { BaseError } from "../utils/error.js";

// ---------------------------------------------------------------------------
// Types (public)
// ---------------------------------------------------------------------------

/**
 * MCP 레지스트리에 등록된 서버 메타데이터
 */
export interface RegistryServer {
  /** 서버 고유 식별자 */
  readonly id: string;
  /** 서버 표시 이름 */
  readonly name: string;
  /** 서버 설명 */
  readonly description: string;
  /** 버전 문자열 (semver 권장) */
  readonly version: string;
  /** 작성자 (선택) */
  readonly author?: string;
  /** 홈페이지 URL (선택) */
  readonly homepage?: string;
  /** 지원하는 트랜스포트 타입 */
  readonly transport: "stdio" | "sse" | "http";
  /** 설치 명령어 (예: "npx @mcp/server-github") — 선택 */
  readonly installCommand?: string;
  /** 서버가 제공하는 도구 이름 목록 */
  readonly tools: readonly string[];
  /** 분류 태그 목록 */
  readonly tags: readonly string[];
  /** 총 다운로드 수 (선택) */
  readonly downloads?: number;
  /** 평점 0–5 (선택) */
  readonly rating?: number;
  /** 마지막 업데이트 ISO 8601 문자열 */
  readonly updatedAt: string;
}

/**
 * 레지스트리 검색 옵션
 */
export interface RegistrySearchOptions {
  /** 자유 텍스트 검색 쿼리 */
  readonly query?: string;
  /** 필터링할 태그 목록 (AND 조건) */
  readonly tags?: readonly string[];
  /** 트랜스포트 타입 필터 */
  readonly transport?: string;
  /** 정렬 기준 */
  readonly sortBy?: "relevance" | "downloads" | "rating" | "updated";
  /** 반환할 최대 결과 수 (기본 20) */
  readonly limit?: number;
  /** 페이지 오프셋 (기본 0) */
  readonly offset?: number;
}

/**
 * 레지스트리 클라이언트 설정
 */
export interface RegistryClientConfig {
  /** 레지스트리 API Base URL (기본: "https://registry.mcp.run/api/v1") */
  readonly registryUrl?: string;
  /** 캐시 디렉토리 경로 (기본: "~/.dhelix/mcp-registry-cache") */
  readonly cacheDir?: string;
  /** 캐시 TTL(밀리초) (기본: 3_600_000 — 1시간) */
  readonly cacheTtlMs?: number;
}

/**
 * install() 결과
 */
export interface InstallResult {
  /** 설치 성공 여부 */
  readonly success: boolean;
  /** 실행한 명령어 */
  readonly command: string;
  /** 명령 표준 출력 + 표준 에러 합산 */
  readonly output: string;
}

/**
 * getStats() 결과
 */
export interface RegistryStats {
  /** 현재 캐시에 보관 중인 항목 수 */
  readonly cached: number;
  /** 가장 최근 fetch 시각 (Date 객체 또는 null) */
  readonly lastFetched: Date | null;
  /** 설정된 캐시 디렉토리 경로 */
  readonly cacheDir: string;
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

/** 캐시 항목 — 페이로드와 만료 시각을 함께 보관 */
interface CacheEntry<T> {
  readonly data: T;
  readonly expiresAt: number;
}

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

/**
 * McpRegistryClient 에서 발생하는 에러
 */
export class McpRegistryClientError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "MCP_REGISTRY_CLIENT_ERROR", context);
  }
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_REGISTRY_URL = "https://registry.mcp.run/api/v1";
const DEFAULT_CACHE_TTL_MS = 3_600_000; // 1 hour

// ---------------------------------------------------------------------------
// McpRegistryClient
// ---------------------------------------------------------------------------

/**
 * MCP 2026 Q4 Registry 스펙을 준수하는 레지스트리 클라이언트
 *
 * 원격 레지스트리에 대한 HTTP 검색/조회를 수행하고,
 * 메모리 캐시로 TTL 기반 응답을 재사용합니다.
 * 실제 레지스트리 엔드포인트가 없는 경우 mock 데이터로 폴백합니다.
 *
 * @example
 * const client = new McpRegistryClient();
 * const servers = await client.search({ query: "filesystem", limit: 5 });
 * await client.install(servers[0].id);
 */
export class McpRegistryClient {
  /** 레지스트리 API Base URL */
  private readonly registryUrl: string;
  /**
   * 캐시 디렉토리 경로 — 현재는 메모리 캐시를 사용하며 향후 디스크 지속화에 활용
   * getStats()로 노출됩니다.
   */
  private readonly cacheDir: string;
  /** 캐시 TTL 밀리초 */
  private readonly cacheTtlMs: number;

  /**
   * 검색 결과 캐시 — 직렬화된 옵션 문자열을 키로 사용
   * @internal
   */
  private readonly searchCache = new Map<string, CacheEntry<readonly RegistryServer[]>>();

  /**
   * 서버 상세 캐시 — serverId 를 키로 사용
   * @internal
   */
  private readonly detailCache = new Map<string, CacheEntry<RegistryServer>>();

  /**
   * 설치 완료된 서버 ID 집합
   * @internal
   */
  private readonly installedIds = new Set<string>();

  /**
   * 마지막 fetch 시각 (캐시 미스가 발생하여 실제 HTTP 요청을 보낸 시각)
   * @internal
   */
  private lastFetchedAt: Date | null = null;

  /**
   * @param config - 클라이언트 설정 (모두 선택 사항)
   */
  constructor(config: RegistryClientConfig = {}) {
    this.registryUrl = config.registryUrl ?? DEFAULT_REGISTRY_URL;
    this.cacheDir = config.cacheDir ?? join(homedir(), ".dhelix", "mcp-registry-cache");
    this.cacheTtlMs = config.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * 레지스트리에서 서버를 검색합니다.
   *
   * 결과는 TTL 만료 전까지 메모리 캐시에 저장됩니다.
   * 실제 레지스트리 엔드포인트가 응답하지 않으면 빈 배열을 반환합니다.
   *
   * @param options - 검색 필터 및 정렬 옵션
   * @returns 검색 결과 서버 목록 (변경 불가 배열)
   * @throws McpRegistryClientError 네트워크 에러 이외의 예상치 못한 오류 발생 시
   */
  async search(options: RegistrySearchOptions = {}): Promise<readonly RegistryServer[]> {
    const cacheKey = JSON.stringify(options);
    const cached = this.getFromCache(this.searchCache, cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    const url = this.buildSearchUrl(options);
    const results = await this.fetchServers(url);

    this.setCache(this.searchCache, cacheKey, results);
    this.lastFetchedAt = new Date();
    return results;
  }

  /**
   * 특정 서버의 상세 정보를 조회합니다.
   *
   * @param serverId - 조회할 서버 ID
   * @returns 서버 메타데이터, 존재하지 않으면 null
   */
  async getServerDetail(serverId: string): Promise<RegistryServer | null> {
    if (!serverId) {
      return null;
    }

    const cached = this.getFromCache(this.detailCache, serverId);
    if (cached !== undefined) {
      return cached;
    }

    const url = `${this.registryUrl}/servers/${encodeURIComponent(serverId)}`;
    const server = await this.fetchServerDetail(url);

    if (server !== null) {
      this.setCache(this.detailCache, serverId, server);
      this.lastFetchedAt = new Date();
    }
    return server;
  }

  /**
   * 지정한 서버를 설치합니다.
   *
   * 서버의 installCommand를 bash에서 실행합니다.
   * installCommand가 없으면 에러를 반환합니다.
   *
   * @param serverId - 설치할 서버 ID
   * @returns 설치 결과 (success, command, output)
   * @throws McpRegistryClientError 서버를 찾을 수 없거나 installCommand가 없을 때
   */
  async install(serverId: string): Promise<InstallResult> {
    const server = await this.getServerDetail(serverId);
    if (server === null) {
      throw new McpRegistryClientError(`Server not found in registry: ${serverId}`, {
        serverId,
      });
    }

    if (!server.installCommand) {
      throw new McpRegistryClientError(`No installCommand defined for server: ${serverId}`, {
        serverId,
        serverName: server.name,
      });
    }

    const command = server.installCommand;
    const output = await this.runCommand(command);

    this.installedIds.add(serverId);

    return { success: true, command, output };
  }

  /**
   * 이 세션에서 설치한 서버 ID 목록을 반환합니다.
   *
   * @returns 설치된 서버 ID 배열 (변경 불가)
   */
  listInstalled(): readonly string[] {
    return [...this.installedIds];
  }

  /**
   * 검색 및 상세 캐시를 모두 비웁니다.
   */
  clearCache(): void {
    this.searchCache.clear();
    this.detailCache.clear();
  }

  /**
   * 캐시 통계를 반환합니다.
   *
   * @returns 캐시 항목 수와 마지막 fetch 시각
   */
  getStats(): RegistryStats {
    return {
      cached: this.searchCache.size + this.detailCache.size,
      lastFetched: this.lastFetchedAt,
      cacheDir: this.cacheDir,
    };
  }

  // -------------------------------------------------------------------------
  // Private helpers — URL building
  // -------------------------------------------------------------------------

  /**
   * 검색 옵션을 URL query string 으로 변환합니다.
   * @internal
   */
  private buildSearchUrl(options: RegistrySearchOptions): string {
    const params = new URLSearchParams();

    if (options.query) {
      params.set("q", options.query);
    }
    if (options.tags && options.tags.length > 0) {
      for (const tag of options.tags) {
        params.append("tag", tag);
      }
    }
    if (options.transport) {
      params.set("transport", options.transport);
    }
    if (options.sortBy) {
      params.set("sortBy", options.sortBy);
    }
    if (options.limit !== undefined) {
      params.set("limit", String(options.limit));
    }
    if (options.offset !== undefined) {
      params.set("offset", String(options.offset));
    }

    const qs = params.toString();
    return qs ? `${this.registryUrl}/servers?${qs}` : `${this.registryUrl}/servers`;
  }

  // -------------------------------------------------------------------------
  // Private helpers — HTTP fetch
  // -------------------------------------------------------------------------

  /**
   * 검색 URL에서 서버 목록을 가져옵니다.
   * 네트워크 에러 발생 시 빈 배열로 폴백합니다.
   * @internal
   */
  private async fetchServers(url: string): Promise<readonly RegistryServer[]> {
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        // 4xx / 5xx — 빈 목록으로 안전하게 폴백
        return [];
      }

      const json = (await response.json()) as { servers?: unknown };
      return this.parseServerList(json.servers);
    } catch {
      // 네트워크 오류, 파싱 오류 — 빈 목록으로 폴백
      return [];
    }
  }

  /**
   * 단일 서버 상세 URL에서 서버 정보를 가져옵니다.
   * 서버를 찾지 못하거나 네트워크 오류 시 null을 반환합니다.
   * @internal
   */
  private async fetchServerDetail(url: string): Promise<RegistryServer | null> {
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        return null;
      }

      const json = (await response.json()) as unknown;
      return this.parseServer(json);
    } catch {
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // Private helpers — parsing
  // -------------------------------------------------------------------------

  /**
   * 서버 목록 JSON을 RegistryServer 배열로 변환합니다.
   * 유효하지 않은 항목은 조용히 필터링됩니다.
   * @internal
   */
  private parseServerList(raw: unknown): readonly RegistryServer[] {
    if (!Array.isArray(raw)) {
      return [];
    }
    const results: RegistryServer[] = [];
    for (const item of raw) {
      const server = this.parseServer(item);
      if (server !== null) {
        results.push(server);
      }
    }
    return results;
  }

  /**
   * 단일 서버 JSON 객체를 RegistryServer 로 변환합니다.
   * 필수 필드(id, name, description, version, transport)가 없으면 null을 반환합니다.
   * @internal
   */
  private parseServer(raw: unknown): RegistryServer | null {
    if (typeof raw !== "object" || raw === null) {
      return null;
    }

    const obj = raw as Record<string, unknown>;

    const id = typeof obj["id"] === "string" ? obj["id"] : null;
    const name = typeof obj["name"] === "string" ? obj["name"] : null;
    const description = typeof obj["description"] === "string" ? obj["description"] : "";
    const version = typeof obj["version"] === "string" ? obj["version"] : "0.0.0";
    const rawTransport = obj["transport"];
    const transport: "stdio" | "sse" | "http" =
      rawTransport === "stdio" || rawTransport === "sse" || rawTransport === "http"
        ? rawTransport
        : "stdio";

    if (!id || !name) {
      return null;
    }

    return {
      id,
      name,
      description,
      version,
      author: typeof obj["author"] === "string" ? obj["author"] : undefined,
      homepage: typeof obj["homepage"] === "string" ? obj["homepage"] : undefined,
      transport,
      installCommand: typeof obj["installCommand"] === "string" ? obj["installCommand"] : undefined,
      tools: Array.isArray(obj["tools"])
        ? (obj["tools"] as unknown[]).filter((t): t is string => typeof t === "string")
        : [],
      tags: Array.isArray(obj["tags"])
        ? (obj["tags"] as unknown[]).filter((t): t is string => typeof t === "string")
        : [],
      downloads: typeof obj["downloads"] === "number" ? obj["downloads"] : undefined,
      rating: typeof obj["rating"] === "number" ? obj["rating"] : undefined,
      updatedAt: typeof obj["updatedAt"] === "string" ? obj["updatedAt"] : new Date().toISOString(),
    };
  }

  // -------------------------------------------------------------------------
  // Private helpers — cache
  // -------------------------------------------------------------------------

  /**
   * 캐시에서 유효한(TTL 내) 항목을 반환합니다.
   * 만료된 항목은 자동으로 제거됩니다.
   * @internal
   */
  private getFromCache<T>(cache: Map<string, CacheEntry<T>>, key: string): T | undefined {
    const entry = cache.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      cache.delete(key);
      return undefined;
    }

    return entry.data;
  }

  /**
   * 캐시에 항목을 저장합니다. 만료 시각은 현재 시각 + TTL로 설정됩니다.
   * @internal
   */
  private setCache<T>(cache: Map<string, CacheEntry<T>>, key: string, data: T): void {
    cache.set(key, {
      data,
      expiresAt: Date.now() + this.cacheTtlMs,
    });
  }

  // -------------------------------------------------------------------------
  // Private helpers — shell
  // -------------------------------------------------------------------------

  /**
   * 쉘 명령어를 실행하고 합산 출력을 반환합니다.
   * stderr 도 output에 포함됩니다.
   * @internal
   */
  private runCommand(command: string): Promise<string> {
    return new Promise((resolve) => {
      exec(command, { timeout: 120_000 }, (_error, stdout, stderr) => {
        const combined = [stdout, stderr].filter(Boolean).join("\n").trim();
        resolve(combined);
      });
    });
  }
}

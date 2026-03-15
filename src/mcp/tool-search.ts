/**
 * MCP 도구 검색 — 지연 로딩(deferred) 도구를 관리하고 검색하는 모듈
 *
 * MCP 서버가 많은 도구를 제공할 때, 모든 도구의 스키마를 LLM 컨텍스트에
 * 한꺼번에 로딩하면 토큰이 낭비됩니다.
 *
 * 이 모듈은 "지연 로딩(deferred loading)" 패턴을 구현합니다:
 * 1. 초기에는 도구 이름과 설명만 저장 (토큰 절약)
 * 2. LLM이 도구가 필요하다고 판단하면 → 전체 스키마를 검색(resolve)
 * 3. 전체 스키마를 LLM 컨텍스트에 주입
 *
 * 검색 방식:
 * - "select:Name1,Name2" → 정확한 이름 매칭
 * - 자유 텍스트 → 이름/설명 기반 관련도 점수로 퍼지 매칭
 *
 * 관련도 점수(0~1):
 * - 정확한 이름 매칭: 1.0
 * - 이름에 쿼리 포함: 0.7
 * - 설명에 쿼리 포함: 0.4
 * - 단어 겹침: 최대 0.3 보너스
 */
import { BaseError } from "../utils/error.js";
import { type MCPToolDefinition } from "./types.js";

/**
 * MCP 도구 검색 에러 클래스
 */
export class MCPToolSearchError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "MCP_TOOL_SEARCH_ERROR", context);
  }
}

/**
 * 지연 로딩(deferred) 도구 항목
 *
 * 이름과 설명만 저장하고, 전체 스키마는 별도로 캐시합니다.
 * 이렇게 하면 시스템 프롬프트에 이름 목록만 포함하여 토큰을 절약합니다.
 */
export interface DeferredTool {
  /** 도구의 원래 이름 (서버 측) */
  readonly name: string;
  /** 네임스페이싱된 이름: mcp__서버이름__도구이름 */
  readonly namespacedName: string;
  /** 도구 설명 */
  readonly description: string;
  /** 도구를 제공하는 서버 이름 */
  readonly serverName: string;
}

/**
 * 도구 검색 결과
 *
 * 전체 도구 정의와 관련도 점수를 포함합니다.
 */
export interface ToolSearchResult {
  /** 전체 MCP 도구 정의 (스키마 포함) */
  readonly tool: MCPToolDefinition;
  /** 서버 이름 */
  readonly serverName: string;
  /** 네임스페이싱된 도구 이름 */
  readonly namespacedName: string;
  /** 관련도 점수 (0~1) — 1에 가까울수록 관련성이 높음 */
  readonly score: number;
}

/**
 * 도구 목록 조회 기능을 가진 클라이언트 인터페이스
 *
 * MCPClient의 전체 기능 중 도구 목록 조회만 필요하므로 별도 인터페이스로 분리합니다.
 */
export interface ToolSearchableClient {
  /** 도구 목록 조회 */
  listTools(): Promise<readonly MCPToolDefinition[]>;
}

/** 기본 최대 검색 결과 수 */
const DEFAULT_MAX_RESULTS = 5;

/** 토큰 추정 비율 — 약 4문자 = 1토큰 */
const CHARS_PER_TOKEN = 4;

/**
 * 쿼리와 도구 이름/설명 간의 관련도 점수를 계산합니다.
 *
 * 점수 계산 전략:
 * - 정확한 이름 매칭: 1.0 (최고 점수)
 * - 이름에 쿼리 포함: 0.7
 * - 설명에 쿼리 포함: 0.4
 * - 단어 겹침: 겹치는 단어 비율 × 0.3 보너스
 *
 * 모든 비교는 대소문자를 무시(lowercase)합니다.
 *
 * @param query - 검색 쿼리
 * @param name - 도구 이름
 * @param description - 도구 설명
 * @returns 0~1 사이의 관련도 점수
 */
function computeRelevanceScore(query: string, name: string, description: string): number {
  const normalizedQuery = query.toLowerCase().trim();
  const normalizedName = name.toLowerCase();
  const normalizedDescription = description.toLowerCase();

  if (normalizedQuery.length === 0) {
    return 0;
  }

  // 정확한 이름 매칭 → 최고 점수
  if (normalizedName === normalizedQuery) {
    return 1.0;
  }

  let score = 0;

  // 이름에 쿼리가 포함되면 0.7
  if (normalizedName.includes(normalizedQuery)) {
    score = Math.max(score, 0.7);
  }

  // 설명에 쿼리가 포함되면 0.4
  if (normalizedDescription.includes(normalizedQuery)) {
    score = Math.max(score, 0.4);
  }

  // 단어 겹침 점수 계산
  // 쿼리를 단어로 분리하고, 도구 이름+설명의 단어와 겹치는 비율 계산
  const queryWords = normalizedQuery.split(/[\s_-]+/).filter(Boolean);
  const nameWords = normalizedName.split(/[\s_-]+/).filter(Boolean);
  const descWords = normalizedDescription.split(/[\s_-]+/).filter(Boolean);
  const targetWords = [...nameWords, ...descWords];

  if (queryWords.length > 0) {
    // 쿼리 단어 중 타겟에 존재하는 단어의 비율
    const matchedWords = queryWords.filter((qw) =>
      targetWords.some((tw) => tw.includes(qw) || qw.includes(tw)),
    );
    const wordOverlapRatio = matchedWords.length / queryWords.length;
    const wordBonus = wordOverlapRatio * 0.3;
    score = Math.max(score, score + wordBonus);
  }

  // 점수를 [0, 1] 범위로 제한
  return Math.min(1.0, score);
}

/**
 * MCP 도구 검색 — 대규모 MCP 도구 세트를 위한 지연 로딩 관리자
 *
 * MCP 서버가 많은 도구를 노출할 때, 모든 스키마를 LLM 컨텍스트에
 * 로딩하면 토큰이 낭비됩니다. MCPToolSearch는 이름과 설명만 초기 저장하고,
 * 검색/해석(resolve) 메서드로 전체 스키마를 필요할 때 로딩합니다.
 */
export class MCPToolSearch {
  /** 지연 로딩 도구 맵 (이름+설명만 저장) */
  private readonly deferredTools = new Map<string, DeferredTool>();
  /** 전체 도구 정의 캐시 (스키마 포함) */
  private readonly fullToolCache = new Map<
    string,
    { readonly tool: MCPToolDefinition; readonly serverName: string }
  >();

  /**
   * 서버의 도구를 지연 로딩(deferred) 형태로 등록합니다.
   *
   * 이름과 설명만 deferredTools에 저장하고,
   * 전체 스키마는 fullToolCache에 캐시하여 검색 시 반환합니다.
   *
   * @param client - 도구 목록을 조회할 클라이언트
   * @param serverName - 서버 이름
   * @returns 등록된 지연 도구 배열
   */
  async registerDeferredTools(
    client: ToolSearchableClient,
    serverName: string,
  ): Promise<readonly DeferredTool[]> {
    const tools = await client.listTools();
    const registered: DeferredTool[] = [];

    for (const tool of tools) {
      // 네임스페이싱: mcp__서버이름__도구이름
      const namespacedName = `mcp__${serverName}__${tool.name}`;

      // 이름과 설명만 저장 (토큰 절약)
      const deferred: DeferredTool = {
        name: tool.name,
        namespacedName,
        description: tool.description,
        serverName,
      };

      this.deferredTools.set(namespacedName, deferred);
      // 전체 스키마는 별도 캐시에 저장 (검색 시 반환용)
      this.fullToolCache.set(namespacedName, {
        tool,
        serverName,
      });

      registered.push(deferred);
    }

    return registered;
  }

  /**
   * 쿼리 문자열로 도구를 검색합니다.
   *
   * 두 가지 쿼리 형식 지원:
   * 1. "select:Name1,Name2" → 정확한 이름 매칭 (resolveByNames에 위임)
   * 2. 자유 텍스트 → 이름/설명 기반 관련도 점수로 퍼지 매칭
   *
   * 결과는 관련도 점수 내림차순으로 정렬됩니다.
   *
   * @param query - 검색 쿼리
   * @param maxResults - 최대 결과 수 (기본: 5)
   * @returns 검색 결과 배열 (점수 내림차순)
   */
  search(query: string, maxResults: number = DEFAULT_MAX_RESULTS): readonly ToolSearchResult[] {
    const trimmed = query.trim();

    if (trimmed.length === 0) {
      return [];
    }

    // "select:Name1,Name2" 구문 처리 → 정확한 이름 매칭
    if (trimmed.startsWith("select:")) {
      const namesStr = trimmed.slice("select:".length);
      const names = namesStr
        .split(",")
        .map((n) => n.trim())
        .filter(Boolean);
      return this.resolveByNames(names);
    }

    // 자유 텍스트 검색: 모든 도구에 대해 관련도 점수 계산
    const results: ToolSearchResult[] = [];

    for (const [namespacedName, deferred] of this.deferredTools) {
      const score = computeRelevanceScore(trimmed, deferred.name, deferred.description);

      // 점수가 0보다 크면 (관련성 있으면) 결과에 포함
      if (score > 0) {
        const cached = this.fullToolCache.get(namespacedName);
        if (cached) {
          results.push({
            tool: cached.tool,
            serverName: cached.serverName,
            namespacedName,
            score,
          });
        }
      }
    }

    // 점수 내림차순 정렬, 동점이면 이름 알파벳순 (안정 정렬)
    const sorted = [...results].sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.namespacedName.localeCompare(b.namespacedName);
    });

    return sorted.slice(0, maxResults);
  }

  /**
   * 네임스페이싱된 이름으로 특정 도구의 전체 정의를 조회합니다.
   *
   * @param namespacedName - "mcp__서버이름__도구이름" 형태의 이름
   * @returns 도구 검색 결과 또는 undefined
   */
  getToolDefinition(namespacedName: string): ToolSearchResult | undefined {
    const cached = this.fullToolCache.get(namespacedName);
    if (!cached) {
      return undefined;
    }

    return {
      tool: cached.tool,
      serverName: cached.serverName,
      namespacedName,
      score: 1.0,
    };
  }

  /**
   * 정확한 이름 매칭으로 도구 정의를 조회합니다.
   *
   * 일반 도구 이름과 네임스페이싱된 이름 모두 지원합니다.
   * 알 수 없는 이름은 조용히 건너뜁니다.
   *
   * @param names - 검색할 도구 이름 배열 (일반 이름 또는 네임스페이싱된 이름)
   * @returns 매칭된 도구 정의 배열
   */
  resolveByNames(names: readonly string[]): readonly ToolSearchResult[] {
    const results: ToolSearchResult[] = [];

    for (const name of names) {
      const trimmedName = name.trim();
      if (trimmedName.length === 0) {
        continue;
      }

      // 1. 네임스페이싱된 이름으로 직접 조회 시도
      const directMatch = this.fullToolCache.get(trimmedName);
      if (directMatch) {
        results.push({
          tool: directMatch.tool,
          serverName: directMatch.serverName,
          namespacedName: trimmedName,
          score: 1.0,
        });
        continue;
      }

      // 2. 일반 도구 이름으로 모든 서버에서 검색
      for (const [namespacedName, deferred] of this.deferredTools) {
        if (deferred.name === trimmedName) {
          const cached = this.fullToolCache.get(namespacedName);
          if (cached) {
            results.push({
              tool: cached.tool,
              serverName: cached.serverName,
              namespacedName,
              score: 1.0,
            });
          }
        }
      }
    }

    return results;
  }

  /**
   * 시스템 프롬프트에 주입할 지연 도구 요약을 생성합니다.
   *
   * XML 태그로 감싼 도구 이름 목록을 생성합니다.
   * LLM은 이 목록을 보고 어떤 도구가 사용 가능한지 판단하고,
   * 필요한 도구의 전체 스키마를 ToolSearch로 요청합니다.
   *
   * @returns 마크다운 형식의 도구 요약 (도구가 없으면 빈 문자열)
   */
  generateDeferredToolsSummary(): string {
    if (this.deferredTools.size === 0) {
      return "";
    }

    const lines: string[] = ["<available-deferred-tools>"];

    // 서버별로 그룹화하여 가독성 향상
    const byServer = new Map<string, DeferredTool[]>();
    for (const deferred of this.deferredTools.values()) {
      const existing = byServer.get(deferred.serverName) ?? [];
      byServer.set(deferred.serverName, [...existing, deferred]);
    }

    for (const [, tools] of byServer) {
      for (const tool of tools) {
        lines.push(tool.namespacedName);
      }
    }

    lines.push("</available-deferred-tools>");

    return lines.join("\n");
  }

  /**
   * 지연 도구 요약의 토큰 사용량을 추정합니다.
   *
   * 시스템 프롬프트에 주입할 때 토큰 예산을 계획하는 데 사용합니다.
   * (4문자 = 1토큰 근사치)
   *
   * @returns 추정 토큰 수
   */
  estimateTokens(): number {
    const summary = this.generateDeferredToolsSummary();
    return Math.ceil(summary.length / CHARS_PER_TOKEN);
  }

  /**
   * 지연 로딩된 도구의 총 수를 반환합니다.
   *
   * @returns 도구 수
   */
  get size(): number {
    return this.deferredTools.size;
  }

  /**
   * 특정 도구가 지연 로딩 세트에 존재하는지 확인합니다.
   *
   * @param namespacedName - 확인할 네임스페이싱된 도구 이름
   * @returns true면 존재
   */
  has(namespacedName: string): boolean {
    return this.deferredTools.has(namespacedName);
  }

  /**
   * 모든 지연 도구와 캐시된 스키마를 제거합니다.
   */
  clear(): void {
    this.deferredTools.clear();
    this.fullToolCache.clear();
  }
}

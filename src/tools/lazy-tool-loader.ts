/**
 * 지연 도구 로더 — 모델 성능 등급에 따라 도구 스키마를 필요할 때만 로드하는 모듈
 *
 * 도구가 수십~수백 개 있을 때 모든 도구의 전체 스키마를 LLM에 보내면
 * 토큰 비용이 크게 증가하고, 모델의 주의(attention)가 분산됩니다.
 *
 * 이 모듈은 성능 등급에 따라 전략적으로 스키마를 관리합니다:
 * - HIGH: 모든 도구에 전체 스키마 즉시 제공 (고성능 모델은 처리 가능)
 * - MEDIUM: 우선순위 도구에만 전체 스키마, 나머지는 이름+한줄 설명만
 * - LOW: 모든 도구에 이름만 제공, 전체 스키마는 요청 시 로드
 *
 * 이를 통해 저성능/중간성능 모델에서 토큰 비용을 절약하면서도
 * 필요한 도구를 사용할 수 있게 합니다.
 */
import type { CapabilityTier } from "../llm/model-capabilities.js";

/**
 * 도구 요약 정보 — 전체 스키마 없이 이름과 간단한 설명만 포함
 *
 * schemaLoaded가 false이면, LLM이 이 도구를 사용하려면
 * loadFullSchema()로 전체 스키마를 먼저 로드해야 합니다.
 */
export interface ToolSummary {
  /** 도구 이름 */
  readonly name: string;
  /** 한 줄 요약 설명 (첫 번째 마침표 또는 줄바꿈까지) */
  readonly shortDescription: string;
  /** 전체 스키마가 이미 로드되었는지 여부 */
  readonly schemaLoaded: boolean;
}

/**
 * 도구의 전체 스키마 — 지연 로딩 시 반환되는 완전한 도구 정의
 */
export interface ToolSchema {
  /** 도구 이름 */
  readonly name: string;
  /** 전체 설명 */
  readonly description: string;
  /** JSON Schema 형식의 매개변수 정의 */
  readonly parameters: Record<string, unknown>;
}

/**
 * 내부 도구 항목 — 도구의 전체 메타데이터를 저장하는 내부 인터페이스
 */
interface ToolEntry {
  /** 도구 이름 */
  readonly name: string;
  /** 전체 설명 */
  readonly description: string;
  /** JSON Schema 형식의 매개변수 정의 */
  readonly parameters: Record<string, unknown>;
}

/**
 * MEDIUM 등급에서 전체 스키마를 즉시 로드하는 도구의 최대 개수
 *
 * MEDIUM 등급에서는 우선순위 도구 + 이 제한까지의 도구에 전체 스키마를 제공합니다.
 * 이 제한을 초과하는 도구는 이름+설명만 제공됩니다.
 */
const MEDIUM_TIER_HOT_LIMIT = 10;

/**
 * 우선순위 도구(Priority Tools) — 성능 등급에 관계없이 항상 전체 스키마가 로드되는 도구
 *
 * 이 도구들은 코딩 작업에서 가장 빈번하게 사용되는 핵심 도구이므로,
 * 어떤 성능 등급의 모델이든 항상 전체 스키마를 제공합니다.
 */
const PRIORITY_TOOLS: ReadonlySet<string> = new Set([
  "file_read",
  "file_write",
  "file_edit",
  "bash_exec",
  "grep_search",
  "glob_search",
]);

/**
 * 전체 설명에서 한 줄 요약을 추출
 *
 * 첫 번째 마침표(.) 또는 첫 번째 줄바꿈(\n) 중 먼저 나오는 지점까지를 잘라냅니다.
 * 이를 통해 LLM에게 최소한의 정보로 도구의 용도를 전달합니다.
 *
 * @param description - 전체 도구 설명
 * @returns 한 줄 요약 텍스트
 */
function extractShortDescription(description: string): string {
  const firstPeriod = description.indexOf(".");
  const firstNewline = description.indexOf("\n");

  // 마침표와 줄바꿈 중 먼저 나오는 지점을 끝으로 설정
  let end = description.length;
  if (firstPeriod !== -1) {
    end = firstPeriod + 1; // 마침표를 포함
  }
  if (firstNewline !== -1 && firstNewline < end) {
    end = firstNewline; // 줄바꿈이 더 먼저 나오면 줄바꿈까지
  }

  return description.slice(0, end).trim();
}

/**
 * 지연 도구 로더 클래스 — 모델 성능 등급에 따라 도구 스키마 로딩을 최적화
 *
 * 전체 흐름:
 * 1. 모든 도구를 registerTool/registerAll로 등록 (전체 스키마 저장)
 * 2. getToolSummaries(tier)로 등급에 맞는 요약 정보 생성
 * 3. LLM이 특정 도구를 사용하려면 loadFullSchema(name)으로 전체 스키마 로드
 */
export class LazyToolLoader {
  /** 등록된 모든 도구의 전체 메타데이터 (이름 → 도구 항목 Map) */
  private readonly tools = new Map<string, ToolEntry>();
  /** 전체 스키마가 이미 로드된 도구 이름 집합 (Set) */
  private readonly loadedSchemas = new Set<string>();

  /**
   * 도구를 전체 스키마와 함께 등록
   *
   * @param name - 도구 이름
   * @param description - 도구 설명
   * @param parameters - JSON Schema 형식의 매개변수 정의
   */
  registerTool(name: string, description: string, parameters: Record<string, unknown>): void {
    this.tools.set(name, { name, description, parameters });
  }

  /**
   * 여러 도구를 한 번에 등록
   *
   * @param tools - 도구 항목 배열
   */
  registerAll(tools: readonly ToolEntry[]): void {
    for (const tool of tools) {
      this.tools.set(tool.name, tool);
    }
  }

  /**
   * 성능 등급에 맞는 도구 요약 정보 목록 생성
   *
   * 각 등급별 동작:
   *
   * HIGH — 모든 도구를 "스키마 로드됨"으로 표시
   *   고성능 모델은 많은 도구 스키마를 한 번에 처리할 수 있으므로
   *   모든 도구의 전체 스키마를 즉시 제공합니다.
   *
   * MEDIUM — 우선순위 도구와 상위 N개 도구만 "스키마 로드됨"으로 표시
   *   나머지 도구는 이름+설명만 제공하여 토큰을 절약합니다.
   *   LLM이 필요하면 loadFullSchema()로 개별 로드할 수 있습니다.
   *
   * LOW — 모든 도구를 이름만으로 표시 (스키마 없음)
   *   저성능 모델의 컨텍스트 윈도우(context window)를 최대한 절약합니다.
   *
   * @param tier - 모델 성능 등급
   * @returns 도구 요약 정보 배열
   */
  getToolSummaries(tier: CapabilityTier): readonly ToolSummary[] {
    const entries = [...this.tools.values()];
    const summaries: ToolSummary[] = [];

    switch (tier) {
      // HIGH: 모든 도구에 전체 스키마 로드 표시
      case "high":
        for (const entry of entries) {
          this.loadedSchemas.add(entry.name);
          summaries.push({
            name: entry.name,
            shortDescription: extractShortDescription(entry.description),
            schemaLoaded: true,
          });
        }
        break;

      // MEDIUM: 우선순위 도구 + 상위 N개 도구만 전체 스키마 로드
      case "medium":
        for (const entry of entries) {
          // 우선순위 도구(file_read 등)인지 확인
          const isPriority = PRIORITY_TOOLS.has(entry.name);
          // 이미 스키마가 로드된 도구 수가 제한 이내인지 확인
          const isWithinHotLimit =
            summaries.filter((s) => s.schemaLoaded).length < MEDIUM_TIER_HOT_LIMIT;

          if (isPriority || isWithinHotLimit) {
            // 우선순위이거나 제한 이내이면 전체 스키마 로드
            this.loadedSchemas.add(entry.name);
            summaries.push({
              name: entry.name,
              shortDescription: extractShortDescription(entry.description),
              schemaLoaded: true,
            });
          } else {
            // 제한 초과 — 이름+설명만 제공
            summaries.push({
              name: entry.name,
              shortDescription: extractShortDescription(entry.description),
              schemaLoaded: false,
            });
          }
        }
        break;

      // LOW: 모든 도구에 이름만 제공 (스키마 없음)
      case "low":
        for (const entry of entries) {
          summaries.push({
            name: entry.name,
            shortDescription: entry.name, // 설명 대신 이름만 사용
            schemaLoaded: false,
          });
        }
        break;
    }

    return summaries;
  }

  /**
   * 특정 도구의 전체 스키마를 온디맨드(on-demand)로 로드
   *
   * LLM이 특정 도구를 사용하겠다고 결정하면, 이 메서드로 전체 스키마를 가져옵니다.
   * 내부적으로 로드된 도구를 추적하여 isSchemaLoaded()로 확인할 수 있습니다.
   *
   * @param toolName - 로드할 도구의 이름
   * @returns 도구의 전체 스키마, 또는 null (등록되지 않은 도구인 경우)
   */
  loadFullSchema(toolName: string): ToolSchema | null {
    const entry = this.tools.get(toolName);
    if (!entry) {
      return null;
    }

    // 로드된 도구 집합에 추가
    this.loadedSchemas.add(toolName);
    return {
      name: entry.name,
      description: entry.description,
      parameters: entry.parameters,
    };
  }

  /**
   * 특정 도구의 전체 스키마가 이미 로드되었는지 확인
   *
   * @param toolName - 확인할 도구 이름
   * @returns 스키마가 로드되었으면 true
   */
  isSchemaLoaded(toolName: string): boolean {
    return this.loadedSchemas.has(toolName);
  }

  /**
   * 등록된 도구의 총 개수
   */
  get size(): number {
    return this.tools.size;
  }

  /**
   * 전체 스키마가 로드된 도구의 개수
   */
  get loadedCount(): number {
    return this.loadedSchemas.size;
  }
}

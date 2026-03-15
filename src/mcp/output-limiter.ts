/**
 * MCP 출력 제한기 — MCP 도구 결과의 지능적 출력 잘림(truncation) 모듈
 *
 * MCP 도구가 반환하는 출력이 너무 길면 LLM 컨텍스트 윈도우를 과도하게 소비합니다.
 * 이 모듈은 출력을 지능적으로 잘라 토큰을 절약합니다.
 *
 * 세 가지 잘림 전략:
 * 1. head: 콘텐츠 앞부분을 유지하고 뒷부분을 잘라냄
 * 2. tail: 콘텐츠 뒷부분을 유지하고 앞부분을 잘라냄
 * 3. smart: 콘텐츠 형식(JSON, Markdown, 텍스트)을 감지하여 구조를 보존하며 잘라냄
 *
 * "smart" 전략의 형식별 처리:
 * - JSON: 최상위 키를 보존하고, 들어가는 키 수 제한
 * - Markdown: 헤딩(#) 기준으로 섹션을 보존
 * - 일반 텍스트: 단락(빈 줄) 경계에서 잘라냄
 *
 * 서버별 개별 설정이 가능하며, 사용 통계를 추적합니다.
 */
import { BaseError } from "../utils/error.js";

/**
 * MCP 출력 제한기 에러 클래스
 */
export class MCPOutputLimiterError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "MCP_OUTPUT_LIMITER_ERROR", context);
  }
}

/**
 * 출력 제한 설정
 *
 * 토큰 제한과 문자 제한 중 더 작은 값이 적용됩니다.
 */
export interface OutputLimitConfig {
  /** 최대 토큰 수 (기본: 10,000) — 대략 1토큰 = 4자 */
  readonly maxTokens: number;
  /** 최대 문자 수 (기본: 40,000) — 토큰 계산이 불가능할 때 대체 기준 */
  readonly maxCharacters: number;
  /** 잘림 전략: "head"(앞부분 유지), "tail"(뒷부분 유지), "smart"(구조 보존) */
  readonly strategy: "head" | "tail" | "smart";
  /** 잘린 콘텐츠에 대한 요약 메시지 포함 여부 */
  readonly includeSummary: boolean;
}

/**
 * 출력 제한 결과
 *
 * 잘림이 적용된 콘텐츠와 함께 원본/결과 토큰 수 등의 메타데이터를 포함합니다.
 */
export interface LimitedOutput {
  /** 제한된 (또는 원본 그대로인) 콘텐츠 */
  readonly content: string;
  /** 잘림이 적용되었는지 여부 */
  readonly wasTruncated: boolean;
  /** 원본 콘텐츠의 추정 토큰 수 */
  readonly originalTokens: number;
  /** 결과 콘텐츠의 추정 토큰 수 */
  readonly resultTokens: number;
  /** 원본 콘텐츠의 문자 수 */
  readonly originalCharacters: number;
  /** 잘림 안내 메시지 (잘렸을 때만 존재) */
  readonly truncationMessage?: string;
}

/**
 * 사용 통계
 *
 * 출력 제한기의 전체 사용 현황을 추적합니다.
 */
export interface OutputLimiterStats {
  /** 총 호출 횟수 */
  readonly totalCalls: number;
  /** 잘림이 발생한 횟수 */
  readonly truncatedCalls: number;
  /** 잘림으로 절약된 총 토큰 수 */
  readonly totalTokensSaved: number;
  /** 원본 콘텐츠의 평균 토큰 수 */
  readonly averageOriginalTokens: number;
}

/**
 * 내부 통계 누적기 (변경 가능)
 *
 * 불변 StatsAccumulator와 달리, 내부적으로 값을 누적합니다.
 */
interface StatsAccumulator {
  totalCalls: number;
  truncatedCalls: number;
  totalTokensSaved: number;
  totalOriginalTokens: number;
}

/** 기본 설정값 */
const DEFAULT_CONFIG: OutputLimitConfig = {
  maxTokens: 10_000,
  maxCharacters: 40_000,
  strategy: "smart",
  includeSummary: true,
};

/**
 * 토큰 추정 비율 — 약 4문자 = 1토큰
 *
 * 이것은 대략적인 추정치이며, 실제 토큰 수는
 * 사용하는 토크나이저에 따라 다를 수 있습니다.
 */
const CHARS_PER_TOKEN = 4;

/**
 * 콘텐츠가 JSON처럼 보이는지 감지합니다.
 *
 * 앞부분 공백을 제거한 후 '{' 또는 '['로 시작하면 JSON으로 간주합니다.
 *
 * @param content - 검사할 콘텐츠 문자열
 * @returns true면 JSON 형태
 */
function looksLikeJson(content: string): boolean {
  const trimmed = content.trimStart();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}

/**
 * 콘텐츠가 Markdown처럼 보이는지 감지합니다.
 *
 * 처음 20줄 내에 Markdown 패턴이 있는지 확인합니다:
 * - 헤딩 마커 (# ~ ######)
 * - 수평선 (*** 또는 ---)
 * - 코드 블록 (```)
 *
 * @param content - 검사할 콘텐츠 문자열
 * @returns true면 Markdown 형태
 */
function looksLikeMarkdown(content: string): boolean {
  const lines = content.split("\n").slice(0, 20);
  return lines.some(
    (line) =>
      /^#{1,6}\s/.test(line) ||
      /^\*{3,}$/.test(line.trim()) ||
      /^-{3,}$/.test(line.trim()) ||
      /^```/.test(line.trim()),
  );
}

/**
 * MCP 출력 제한기 — 설정 가능하고 지능적인 출력 잘림을 제공합니다.
 *
 * 주요 기능:
 * - 서버별 개별 설정 지원
 * - 콘텐츠 형식(JSON/Markdown/텍스트) 자동 감지
 * - 구조를 보존하는 스마트 잘림
 * - 사용 통계 추적 (절약된 토큰 등)
 */
export class MCPOutputLimiter {
  /** 전역 기본 설정 */
  private readonly config: OutputLimitConfig;
  /** 서버별 설정 맵 (읽기 전용 뷰) */
  private readonly serverConfigs: ReadonlyMap<string, OutputLimitConfig>;
  /** 서버별 설정 맵 (변경 가능한 내부 맵) */
  private readonly mutableServerConfigs = new Map<string, OutputLimitConfig>();
  /** 사용 통계 누적기 */
  private stats: StatsAccumulator = {
    totalCalls: 0,
    truncatedCalls: 0,
    totalTokensSaved: 0,
    totalOriginalTokens: 0,
  };

  /**
   * @param config - 전역 설정 오버라이드 (선택)
   */
  constructor(config?: Partial<OutputLimitConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.serverConfigs = this.mutableServerConfigs;
  }

  /**
   * 서버별 출력 제한 설정을 지정합니다.
   *
   * 전역 설정을 기반으로 서버별 오버라이드를 적용합니다.
   *
   * @param serverName - 서버 이름
   * @param config - 오버라이드할 설정 (부분)
   */
  setServerLimit(serverName: string, config: Partial<OutputLimitConfig>): void {
    const effective = { ...this.config, ...config };
    this.mutableServerConfigs.set(serverName, effective);
  }

  /**
   * 서버에 적용되는 유효 설정을 반환합니다.
   *
   * 서버별 설정이 있으면 해당 설정을, 없으면 전역 설정을 반환합니다.
   *
   * @param serverName - 서버 이름
   * @returns 유효한 설정
   */
  getEffectiveConfig(serverName: string): OutputLimitConfig {
    return this.serverConfigs.get(serverName) ?? this.config;
  }

  /**
   * 문자열의 토큰 수를 추정합니다.
   *
   * 4문자 = 1토큰 비율로 대략적으로 계산합니다.
   * (실제 토크나이저와 차이가 있을 수 있으나, 빠른 근사치로 충분)
   *
   * @param text - 토큰 수를 추정할 문자열
   * @returns 추정 토큰 수
   */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / CHARS_PER_TOKEN);
  }

  /**
   * 출력 콘텐츠에 제한을 적용합니다.
   *
   * 콘텐츠가 토큰/문자 제한 내에 있으면 원본 그대로 반환합니다.
   * 제한을 초과하면 설정된 전략(head/tail/smart)에 따라 잘라냅니다.
   *
   * @param content - 제한할 출력 콘텐츠
   * @param serverName - 서버별 설정을 적용할 서버 이름 (선택)
   * @returns 제한된 출력과 메타데이터
   */
  limitOutput(content: string, serverName?: string): LimitedOutput {
    const effectiveConfig = serverName ? this.getEffectiveConfig(serverName) : this.config;

    const originalTokens = this.estimateTokens(content);
    const originalCharacters = content.length;

    // 통계 업데이트 (불변 패턴으로 spread 사용)
    this.stats = {
      ...this.stats,
      totalCalls: this.stats.totalCalls + 1,
      totalOriginalTokens: this.stats.totalOriginalTokens + originalTokens,
    };

    // 제한 내에 있으면 원본 그대로 반환
    if (
      originalTokens <= effectiveConfig.maxTokens &&
      originalCharacters <= effectiveConfig.maxCharacters
    ) {
      return {
        content,
        wasTruncated: false,
        originalTokens,
        resultTokens: originalTokens,
        originalCharacters,
      };
    }

    // 토큰 제한에서 문자 제한 계산 (더 작은 값 적용)
    const maxCharsFromTokens = effectiveConfig.maxTokens * CHARS_PER_TOKEN;
    const maxChars = Math.min(maxCharsFromTokens, effectiveConfig.maxCharacters);

    // 설정된 전략에 따라 잘림 적용
    let truncatedContent: string;
    let truncationMessage: string | undefined;

    switch (effectiveConfig.strategy) {
      case "smart": {
        // 스마트 잘림: 콘텐츠 형식을 감지하여 구조 보존
        const result = this.smartTruncate(content, maxChars);
        truncatedContent = result.truncated;
        truncationMessage = effectiveConfig.includeSummary ? result.summary : undefined;
        break;
      }
      case "tail": {
        // 뒷부분 유지 잘림
        truncatedContent = this.tailTruncate(content, maxChars);
        truncationMessage = effectiveConfig.includeSummary
          ? `[Truncated: kept last ${this.estimateTokens(truncatedContent)} of ${originalTokens} tokens]`
          : undefined;
        break;
      }
      case "head":
      default: {
        // 앞부분 유지 잘림 (기본)
        truncatedContent = this.headTruncate(content, maxChars);
        truncationMessage = effectiveConfig.includeSummary
          ? `[Truncated: kept first ${this.estimateTokens(truncatedContent)} of ${originalTokens} tokens]`
          : undefined;
        break;
      }
    }

    // 잘림 안내 메시지를 콘텐츠 끝에 추가
    const finalContent = truncationMessage
      ? `${truncatedContent}\n\n${truncationMessage}`
      : truncatedContent;

    const resultTokens = this.estimateTokens(finalContent);
    const tokensSaved = originalTokens - resultTokens;

    // 잘림 통계 업데이트
    this.stats = {
      ...this.stats,
      truncatedCalls: this.stats.truncatedCalls + 1,
      totalTokensSaved: this.stats.totalTokensSaved + tokensSaved,
    };

    return {
      content: finalContent,
      wasTruncated: true,
      originalTokens,
      resultTokens,
      originalCharacters,
      truncationMessage,
    };
  }

  /**
   * 스마트 잘림: 콘텐츠 형식을 감지하고 구조를 보존하며 잘라냅니다.
   *
   * 감지 순서:
   * 1. JSON → 최상위 키/배열 요소 기준으로 잘림
   * 2. Markdown → 헤딩(#) 기준으로 섹션 단위 잘림
   * 3. 일반 텍스트 → 단락(빈 줄) 경계에서 잘림
   *
   * @param content - 잘라낼 콘텐츠
   * @param maxChars - 최대 문자 수
   * @returns 잘린 콘텐츠와 요약 메시지
   */
  smartTruncate(
    content: string,
    maxChars: number,
  ): { readonly truncated: string; readonly summary: string } {
    if (content.length <= maxChars) {
      return { truncated: content, summary: "" };
    }

    const originalTokens = this.estimateTokens(content);

    // JSON 형태면 JSON 전용 잘림 적용
    if (looksLikeJson(content)) {
      return this.smartTruncateJson(content, maxChars, originalTokens);
    }

    // Markdown 형태면 Markdown 전용 잘림 적용
    if (looksLikeMarkdown(content)) {
      return this.smartTruncateMarkdown(content, maxChars, originalTokens);
    }

    // 기본: 일반 텍스트 잘림
    return this.smartTruncatePlainText(content, maxChars, originalTokens);
  }

  /**
   * Head 잘림: 콘텐츠 앞부분을 유지합니다.
   *
   * @param content - 원본 콘텐츠
   * @param maxChars - 최대 문자 수
   * @returns 잘린 콘텐츠
   */
  headTruncate(content: string, maxChars: number): string {
    if (content.length <= maxChars) {
      return content;
    }
    return content.slice(0, maxChars);
  }

  /**
   * Tail 잘림: 콘텐츠 뒷부분을 유지합니다.
   *
   * @param content - 원본 콘텐츠
   * @param maxChars - 최대 문자 수
   * @returns 잘린 콘텐츠
   */
  tailTruncate(content: string, maxChars: number): string {
    if (content.length <= maxChars) {
      return content;
    }
    return content.slice(-maxChars);
  }

  /**
   * 사용 통계의 불변 스냅샷을 반환합니다.
   *
   * @returns 통계 정보 (총 호출 수, 잘림 횟수, 절약된 토큰 등)
   */
  getStats(): OutputLimiterStats {
    const averageOriginalTokens =
      this.stats.totalCalls > 0
        ? Math.round(this.stats.totalOriginalTokens / this.stats.totalCalls)
        : 0;

    return {
      totalCalls: this.stats.totalCalls,
      truncatedCalls: this.stats.truncatedCalls,
      totalTokensSaved: this.stats.totalTokensSaved,
      averageOriginalTokens,
    };
  }

  /**
   * 모든 통계를 초기화합니다.
   */
  resetStats(): void {
    this.stats = {
      totalCalls: 0,
      truncatedCalls: 0,
      totalTokensSaved: 0,
      totalOriginalTokens: 0,
    };
  }

  /**
   * JSON 콘텐츠의 스마트 잘림
   *
   * 객체(Object)인 경우:
   * - 최상위 키를 하나씩 추가하면서 제한을 초과하면 중단
   * - 초과하는 키는 "[truncated]" 플레이스홀더로 대체
   *
   * 배열(Array)인 경우:
   * - 요소를 하나씩 추가하면서 제한을 초과하면 중단
   *
   * @param content - JSON 문자열
   * @param maxChars - 최대 문자 수
   * @param originalTokens - 원본 토큰 수
   * @returns 잘린 JSON과 요약 메시지
   */
  private smartTruncateJson(
    content: string,
    maxChars: number,
    originalTokens: number,
  ): { readonly truncated: string; readonly summary: string } {
    try {
      const parsed = JSON.parse(content) as unknown;

      // 객체인 경우: 키 단위로 잘림
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        const obj = parsed as Record<string, unknown>;
        const keys = Object.keys(obj);
        const result: Record<string, unknown> = {};
        let currentJson = "{}";

        for (const key of keys) {
          // 현재 키를 추가한 후의 크기 확인
          const candidate = { ...result, [key]: obj[key] };
          const candidateJson = JSON.stringify(candidate, null, 2);

          if (candidateJson.length > maxChars) {
            // 초과 시 해당 키를 "[truncated]" 플레이스홀더로 대체
            const placeholder = { ...result, [key]: "[truncated]" };
            const placeholderJson = JSON.stringify(placeholder, null, 2);
            if (placeholderJson.length <= maxChars) {
              currentJson = placeholderJson;
            }
            break;
          }

          result[key] = obj[key];
          currentJson = candidateJson;
        }

        const keptKeys = Object.keys(result).length;
        const resultTokens = this.estimateTokens(currentJson);
        const summary = `[Truncated: ${originalTokens} tokens -> ${resultTokens} tokens. Kept ${keptKeys}/${keys.length} top-level keys.]`;
        return { truncated: currentJson, summary };
      }

      // 배열인 경우: 요소 단위로 잘림
      if (Array.isArray(parsed)) {
        const result: unknown[] = [];
        let currentJson = "[]";

        for (const item of parsed) {
          const candidate = [...result, item];
          const candidateJson = JSON.stringify(candidate, null, 2);

          if (candidateJson.length > maxChars) {
            break;
          }

          result.push(item);
          currentJson = candidateJson;
        }

        const resultTokens = this.estimateTokens(currentJson);
        const summary = `[Truncated: ${originalTokens} tokens -> ${resultTokens} tokens. Kept ${result.length}/${parsed.length} array items.]`;
        return { truncated: currentJson, summary };
      }
    } catch {
      // JSON처럼 보이지만 실제로 유효한 JSON이 아닌 경우 → 일반 텍스트로 처리
    }

    return this.smartTruncatePlainText(content, maxChars, originalTokens);
  }

  /**
   * Markdown 콘텐츠의 스마트 잘림
   *
   * 헤딩(# ~ ######) 기준으로 섹션을 분리하고,
   * 제한을 초과하지 않는 범위에서 최대한 많은 섹션을 유지합니다.
   *
   * @param content - Markdown 문자열
   * @param maxChars - 최대 문자 수
   * @param originalTokens - 원본 토큰 수
   * @returns 잘린 Markdown과 요약 메시지
   */
  private smartTruncateMarkdown(
    content: string,
    maxChars: number,
    originalTokens: number,
  ): { readonly truncated: string; readonly summary: string } {
    // 헤딩 시작 위치를 기준으로 섹션 분리
    const sections = content.split(/(?=^#{1,6}\s)/m);
    const result: string[] = [];
    let currentLength = 0;
    let keptSections = 0;

    for (const section of sections) {
      // 제한을 초과하면 중단 (단, 최소 1개 섹션은 유지)
      if (currentLength + section.length > maxChars && result.length > 0) {
        break;
      }
      result.push(section);
      currentLength += section.length;
      keptSections++;
    }

    const truncated = result.join("");
    const resultTokens = this.estimateTokens(truncated);
    const summary = `[Truncated: ${originalTokens} tokens -> ${resultTokens} tokens. Kept ${keptSections}/${sections.length} sections.]`;
    return { truncated, summary };
  }

  /**
   * 일반 텍스트 콘텐츠의 스마트 잘림
   *
   * 단락 경계(빈 줄)에서 잘라내어, 문장이 중간에 끊기지 않도록 합니다.
   *
   * @param content - 텍스트 문자열
   * @param maxChars - 최대 문자 수
   * @param originalTokens - 원본 토큰 수
   * @returns 잘린 텍스트와 요약 메시지
   */
  private smartTruncatePlainText(
    content: string,
    maxChars: number,
    originalTokens: number,
  ): { readonly truncated: string; readonly summary: string } {
    // 빈 줄(\n\n)로 단락 분리
    const paragraphs = content.split(/\n\n+/);
    const result: string[] = [];
    let currentLength = 0;

    for (const paragraph of paragraphs) {
      // 단락 사이 구분자(\n\n)의 길이도 계산에 포함
      const addedLength = result.length > 0 ? paragraph.length + 2 : paragraph.length;

      if (currentLength + addedLength > maxChars && result.length > 0) {
        break;
      }

      result.push(paragraph);
      currentLength += addedLength;
    }

    const truncated = result.join("\n\n");
    const totalLines = content.split("\n").length;
    const keptLines = truncated.split("\n").length;
    const resultTokens = this.estimateTokens(truncated);
    const summary = `[Truncated: ${originalTokens} tokens -> ${resultTokens} tokens. Kept ${keptLines}/${totalLines} lines.]`;
    return { truncated, summary };
  }
}

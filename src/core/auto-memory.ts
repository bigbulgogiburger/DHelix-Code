/**
 * 자동 메모리(Auto Memory) 수집 모듈
 *
 * 에이전트 루프의 각 턴(turn)을 분석하여 기억할 만한 정보를 자동으로 감지하고 수집합니다.
 * 수집된 정보는 MEMORY.md 또는 주제별 파일에 저장되어 세션 간에 유지됩니다.
 *
 * 주니어 개발자를 위한 설명:
 * - 이 모듈은 AI의 "자동 학습 노트" 시스템입니다
 * - 대화 중 나온 아키텍처 결정, 디버깅 해결법, 사용자 선호 등을 자동으로 감지합니다
 * - 키워드 패턴 매칭으로 "기억할 만한" 내용을 찾고, 신뢰도 점수를 매깁니다
 * - 중복 체크를 하여 같은 내용이 반복 저장되는 것을 방지합니다
 * - 세션당 최대 항목 수 제한이 있어 메모리 파일이 무한히 커지지 않습니다
 */
import {
  type MemoryConfig,
  readMainMemory,
  readTopicMemory,
  readGlobalMemory,
  writeMainMemory,
  writeTopicMemory,
} from "./memory-storage.js";
import { BaseError } from "../utils/error.js";
import { getLogger } from "../utils/logger.js";

// ---------------------------------------------------------------------------
// 타입 정의
// ---------------------------------------------------------------------------

/**
 * 자동 감지되는 메모리의 카테고리(분류)
 *
 * - "architecture": 아키텍처 결정, 설계 패턴
 * - "patterns": 코딩 패턴, 모범 사례
 * - "debugging": 디버깅 해결법, 버그 원인
 * - "preferences": 사용자 선호, 컨벤션
 * - "infrastructure": 빌드, 배포, CI/CD 관련
 * - "conventions": 네이밍 규칙, 코드 스타일
 * - "dependencies": 패키지 의존성, 버전 관련
 * - "files": 자주 사용되는 파일 경로
 */
export type MemoryCategory =
  | "architecture"
  | "patterns"
  | "debugging"
  | "preferences"
  | "infrastructure"
  | "conventions"
  | "dependencies"
  | "files";

/**
 * 자동 감지된 단일 메모리 항목
 *
 * @property category - 메모리 카테고리
 * @property content - 기억할 내용 텍스트
 * @property confidence - 이 정보가 기억할 만한 정도 (0.0 ~ 1.0, 높을수록 확실)
 * @property source - 이 정보가 감지된 출처 (예: "assistant-response", "user-message")
 */
export interface AutoMemoryEntry {
  readonly category: MemoryCategory;
  readonly content: string;
  readonly confidence: number;
  readonly source: string;
}

/**
 * 자동 메모리 수집기의 설정
 *
 * @property enabled - 자동 메모리 기능 활성화 여부
 * @property minConfidence - 저장하기 위한 최소 신뢰도 (이 값 이상이어야 수집)
 * @property maxEntriesPerSession - 세션당 최대 수집 항목 수 (무한 증가 방지)
 * @property deduplication - 중복 체크 활성화 여부
 */
export interface AutoMemoryConfig {
  readonly enabled: boolean;
  readonly minConfidence: number;
  readonly maxEntriesPerSession: number;
  readonly deduplication: boolean;
}

/**
 * 완료된 에이전트 루프 턴의 컨텍스트 정보
 * 분석에 필요한 모든 정보를 담고 있습니다.
 *
 * @property userMessage - 사용자가 입력한 메시지
 * @property assistantResponse - AI의 응답 텍스트
 * @property toolCalls - 이 턴에서 실행된 도구 호출 정보 목록
 * @property filesAccessed - 접근된 파일 경로 목록
 * @property errorsEncountered - 발생한 에러 메시지 목록
 */
export interface TurnContext {
  readonly userMessage: string;
  readonly assistantResponse: string;
  readonly toolCalls: readonly ToolCallInfo[];
  readonly filesAccessed: readonly string[];
  readonly errorsEncountered: readonly string[];
}

/**
 * 턴 내 단일 도구 호출에 대한 정보
 *
 * @property name - 도구 이름
 * @property args - 도구에 전달된 인자
 * @property result - 도구 실행 결과
 * @property success - 실행 성공 여부
 */
export interface ToolCallInfo {
  readonly name: string;
  readonly args: Record<string, unknown>;
  readonly result: string;
  readonly success: boolean;
}

/**
 * 자동 메모리 관련 에러 클래스
 */
export class AutoMemoryError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "AUTO_MEMORY_ERROR", context);
  }
}

// ---------------------------------------------------------------------------
// 상수
// ---------------------------------------------------------------------------

/** 기본 자동 메모리 설정 */
const DEFAULT_CONFIG: AutoMemoryConfig = {
  enabled: true,
  minConfidence: 0.7, // 70% 이상 신뢰도만 수집
  maxEntriesPerSession: 20, // 세션당 최대 20개
  deduplication: true, // 중복 체크 활성화
};

/**
 * 카테고리 → 주제 파일 이름 매핑
 * 각 카테고리의 메모리가 어떤 파일에 저장될지 결정합니다.
 */
const CATEGORY_TOPIC_MAP: Readonly<Record<MemoryCategory, string>> = {
  architecture: "architecture",
  patterns: "patterns",
  debugging: "debugging",
  preferences: "preferences",
  infrastructure: "infrastructure",
  conventions: "conventions",
  dependencies: "dependencies",
  files: "files",
};

/** MEMORY.md에 저장할 수 있는 최대 줄 수 (초과하면 주제별 파일로 분산) */
const MAIN_MEMORY_MAX_LINES = 200;

// ---------------------------------------------------------------------------
// 패턴 감지 규칙
// ---------------------------------------------------------------------------

/**
 * 패턴 감지 규칙 인터페이스
 * 각 규칙은 특정 카테고리의 기억할 만한 내용을 감지합니다.
 *
 * @property category - 이 규칙이 감지하는 메모리 카테고리
 * @property patterns - 매칭할 정규표현식 배열
 * @property baseConfidence - 기본 신뢰도 점수
 * @property extractor - 매칭된 텍스트에서 관련 내용을 추출하는 함수
 */
interface PatternRule {
  readonly category: MemoryCategory;
  readonly patterns: readonly RegExp[];
  readonly baseConfidence: number;
  readonly extractor: (match: RegExp, text: string) => string | null;
}

/**
 * 기억할 만한 내용을 감지하기 위한 패턴 규칙 목록을 생성합니다.
 *
 * 각 규칙은 다음을 포함합니다:
 * - 키워드 패턴: 어떤 텍스트가 해당 카테고리에 해당하는지 판별
 * - 기본 신뢰도: 패턴이 매칭되었을 때의 초기 신뢰도 점수
 * - 추출기: 전체 텍스트에서 관련 문장만 잘라내는 함수
 */
function buildPatternRules(): readonly PatternRule[] {
  return [
    {
      // 아키텍처 관련: "architecture decision", "decided to use", "separation of concerns" 등
      category: "architecture",
      patterns: [
        /(?:architecture|architectural)\s+(?:decision|pattern|design)/i,
        /design\s+decision/i,
        /(?:decided|choosing|chose)\s+to\s+use/i,
        /(?:class|interface|module)\s+(?:structure|hierarchy|diagram)/i,
        /layer(?:ed|ing)?\s+architecture/i,
        /separation\s+of\s+concerns/i,
        /dependency\s+(?:injection|inversion)/i,
      ],
      baseConfidence: 0.8,
      extractor: (pattern, text) => extractSentenceAround(pattern, text),
    },
    {
      // 디버깅 관련: "fixed by", "root cause", "workaround", "the issue was" 등
      category: "debugging",
      patterns: [
        /(?:fixed|resolved)\s+by/i,
        /root\s+cause(?:\s+was)?/i,
        /workaround(?:\s+for)?/i,
        /the\s+(?:issue|bug|problem)\s+was/i,
        /(?:solution|fix):\s+/i,
        /error\s+was\s+caused\s+by/i,
        /turns?\s+out\s+(?:that\s+)?the/i,
      ],
      baseConfidence: 0.85,
      extractor: (pattern, text) => extractSentenceAround(pattern, text),
    },
    {
      // 사용자 선호: "always use", "prefer to use", "don't use" 등
      category: "preferences",
      patterns: [
        /always\s+use/i,
        /(?:prefer|recommended)\s+(?:to\s+use|using)/i,
        /(?:don't|do\s+not|never)\s+use/i,
        /(?:instead\s+of|rather\s+than)\s+using/i,
        /(?:we|I)\s+(?:always|usually|prefer\s+to)/i,
      ],
      baseConfidence: 0.75,
      extractor: (pattern, text) => extractSentenceAround(pattern, text),
    },
    {
      // 코딩 컨벤션: "naming convention", "code style", "camelCase" 등
      category: "conventions",
      patterns: [
        /naming\s+convention/i,
        /(?:code|coding)\s+style/i,
        /(?:format|formatting)\s+(?:rule|standard|convention)/i,
        /(?:prefix|suffix)\s+(?:with|using)/i,
        /(?:camelCase|PascalCase|snake_case|kebab-case)/i,
      ],
      baseConfidence: 0.75,
      extractor: (pattern, text) => extractSentenceAround(pattern, text),
    },
    {
      // 인프라 관련: "build command", "CI config", "environment variable" 등
      category: "infrastructure",
      patterns: [
        /(?:build|deploy)\s+(?:command|script|step)/i,
        /(?:ci|cd|pipeline)\s+(?:config|setup|step)/i,
        /environment\s+variable/i,
        /(?:docker|kubernetes|k8s)\s+(?:config|setup)/i,
        /(?:npm|pnpm|yarn)\s+(?:run|script)/i,
      ],
      baseConfidence: 0.7,
      extractor: (pattern, text) => extractSentenceAround(pattern, text),
    },
    {
      // 의존성 관련: "requires version", "upgraded from", "incompatible with" 등
      category: "dependencies",
      patterns: [
        /(?:requires?|depends?\s+on)\s+(?:version|package)/i,
        /(?:upgraded?|downgraded?|migrated?)\s+(?:from|to)/i,
        /(?:incompatible|breaking\s+change)\s+(?:with|in)/i,
        /peer\s+dependency/i,
      ],
      baseConfidence: 0.7,
      extractor: (pattern, text) => extractSentenceAround(pattern, text),
    },
    {
      // 코딩 패턴: "pattern for", "best practice", "common pattern" 등
      category: "patterns",
      patterns: [
        /(?:pattern|approach)\s+(?:for|to|that)/i,
        /(?:best\s+practice|recommended\s+approach)/i,
        /(?:this|the)\s+(?:pattern|technique)\s+(?:works?|is)/i,
        /(?:common|recurring)\s+pattern/i,
      ],
      baseConfidence: 0.7,
      extractor: (pattern, text) => extractSentenceAround(pattern, text),
    },
  ];
}

// ---------------------------------------------------------------------------
// AutoMemoryCollector 클래스
// ---------------------------------------------------------------------------

/**
 * 자동 메모리 수집기
 *
 * 에이전트 루프의 각 턴을 분석하여 기억할 만한 패턴을 감지합니다.
 * 감지된 항목은 pending 큐에 쌓이고, flush()를 호출하면 디스크에 저장됩니다.
 *
 * 분석 대상:
 * - AI 응답에서 아키텍처 결정, 디버깅 해결법 등의 키워드 패턴
 * - 사용자 메시지에서 선호/교정 내용
 * - 자주 접근되는 파일 (3회 이상 접근 시 "핵심 파일"로 기록)
 * - 해결된 에러 패턴 (에러 발생 → 해결 지표가 있는 경우)
 */
export class AutoMemoryCollector {
  /** 메모리 파일 저장 설정 */
  private readonly storage: MemoryConfig;
  /** 자동 메모리 동작 설정 */
  private readonly config: AutoMemoryConfig;
  /** 아직 디스크에 저장되지 않은 대기 중인 항목들 */
  private readonly pending: AutoMemoryEntry[] = [];
  /** 패턴 감지 규칙 목록 */
  private readonly patternRules: readonly PatternRule[];
  /** 파일별 접근 횟수 추적 (자주 접근하는 파일 감지용) */
  private readonly fileAccessCounts: Map<string, number> = new Map();
  /** 이 세션에서 수집된 총 항목 수 (상한선 체크용) */
  private totalEntriesThisSession = 0;

  /**
   * @param storage - 메모리 파일 저장 설정
   * @param config - 자동 메모리 동작 설정 (부분적으로 제공 가능, 나머지는 기본값 사용)
   */
  constructor(storage: MemoryConfig, config?: Partial<AutoMemoryConfig>) {
    this.storage = storage;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.patternRules = buildPatternRules();
  }

  /**
   * 완료된 턴을 분석하여 기억할 만한 내용을 감지합니다.
   *
   * 다음 4가지 분석을 수행합니다:
   * 1. AI 응답에서 키워드 패턴 매칭 (아키텍처, 디버깅 등)
   * 2. 사용자 메시지에서 선호/교정 내용 감지
   * 3. 자주 접근되는 파일 추적 (3회 이상)
   * 4. 해결된 에러 패턴 감지
   *
   * 주의: 이 메서드는 내용을 수집만 하고 디스크에 저장하지 않습니다.
   * 실제 저장은 flush()를 호출해야 합니다.
   *
   * @param turn - 분석할 턴의 컨텍스트 정보
   * @returns 이번 턴에서 감지된 메모리 항목 목록 (minConfidence 이상만 포함)
   */
  analyzeForMemories(turn: TurnContext): readonly AutoMemoryEntry[] {
    // 기능이 비활성화되어 있으면 아무것도 하지 않음
    if (!this.config.enabled) {
      return [];
    }

    // 세션당 최대 항목 수에 도달했으면 더 이상 수집하지 않음
    if (this.totalEntriesThisSession >= this.config.maxEntriesPerSession) {
      return [];
    }

    const entries: AutoMemoryEntry[] = [];

    // 1. AI 응답에서 패턴 감지
    const responseEntries = this.detectPatterns(turn.assistantResponse, "assistant-response");
    entries.push(...responseEntries);

    // 2. 사용자 메시지에서 선호/교정 감지
    const userEntries = this.detectPatterns(turn.userMessage, "user-message");
    entries.push(...userEntries);

    // 3. 자주 접근되는 파일 추적
    const fileEntries = this.detectFrequentFiles(turn.filesAccessed);
    entries.push(...fileEntries);

    // 4. 해결된 에러 패턴 감지
    const errorEntries = this.detectResolvedErrors(turn);
    entries.push(...errorEntries);

    // 세션 상한선 적용: 남은 예산만큼만 수집
    const remainingBudget = this.config.maxEntriesPerSession - this.totalEntriesThisSession;
    const accepted = entries.slice(0, remainingBudget);

    for (const entry of accepted) {
      this.pending.push(entry);
    }
    this.totalEntriesThisSession += accepted.length;

    return accepted;
  }

  /**
   * 항목의 내용이 이미 기존 메모리 파일에 저장되어 있는지 확인합니다.
   *
   * 대소문자 무시, 공백 정규화를 적용한 부분 문자열 매칭으로 중복을 판별합니다.
   * 메인 메모리, 해당 카테고리의 주제 파일, 그리고 현재 pending 큐를 모두 확인합니다.
   *
   * @param entry - 중복 여부를 확인할 항목
   * @returns 이미 저장되어 있으면 true
   */
  async isDuplicate(entry: AutoMemoryEntry): Promise<boolean> {
    // 중복 체크가 비활성화되어 있으면 항상 false
    if (!this.config.deduplication) {
      return false;
    }

    const normalized = normalizeForComparison(entry.content);

    // 메인 MEMORY.md에서 중복 확인
    const mainContent = await readMainMemory(this.storage);
    if (mainContent && containsNormalized(mainContent, normalized)) {
      return true;
    }

    // 해당 카테고리의 주제 파일에서 중복 확인
    const topicName = CATEGORY_TOPIC_MAP[entry.category];
    const topicContent = await readTopicMemory(this.storage, topicName);
    if (topicContent && containsNormalized(topicContent, normalized)) {
      return true;
    }

    // pending 큐에서 중복 확인 (아직 저장되지 않은 항목 간 중복)
    return this.pending.some(
      (p) => p !== entry && normalizeForComparison(p.content) === normalized,
    );
  }

  /**
   * 대기 중인 모든 항목을 디스크에 저장합니다.
   *
   * 저장 로직:
   * 1. 중복 제거: 이미 저장된 내용과 같은 항목 제거
   * 2. 메인 파일 우선: MEMORY.md에 줄 수 여유가 있으면 메인에 저장
   * 3. 오버플로우: 메인 파일이 꽉 차면 주제별 파일에 분산 저장
   *
   * @returns 성공적으로 저장된 항목 수
   */
  async flush(): Promise<number> {
    if (this.pending.length === 0) {
      return 0;
    }

    const logger = getLogger();
    let savedCount = 0;

    // 중복 제거: 이미 저장된 항목 필터링
    const toWrite: AutoMemoryEntry[] = [];
    for (const entry of this.pending) {
      try {
        const duplicate = await this.isDuplicate(entry);
        if (!duplicate) {
          toWrite.push(entry);
        }
      } catch (error: unknown) {
        logger.warn({ error: String(error) }, "Failed to check duplicate, skipping entry");
      }
    }

    if (toWrite.length === 0) {
      this.pending.length = 0;
      return 0;
    }

    // 현재 메인 메모리의 줄 수 확인
    const mainContent = await readMainMemory(this.storage);
    const mainLineCount = mainContent ? mainContent.split("\n").length : 0;

    // 메인 파일에 넣을 항목과 주제 파일로 보낼 항목을 분류
    const forMain: AutoMemoryEntry[] = [];
    const forTopics: AutoMemoryEntry[] = [];
    let projectedLines = mainLineCount;

    for (const entry of toWrite) {
      const entryLines = formatEntryForStorage(entry).split("\n").length;
      // 메인 파일에 여유가 있으면 메인에 저장
      if (projectedLines + entryLines + 1 <= MAIN_MEMORY_MAX_LINES) {
        forMain.push(entry);
        projectedLines += entryLines + 1;
      } else {
        // 여유가 없으면 주제 파일로 분산
        forTopics.push(entry);
      }
    }

    // 메인 MEMORY.md에 저장
    if (forMain.length > 0) {
      const newSections = forMain.map(formatEntryForStorage);
      const separator = mainContent ? "\n\n" : "";
      const updatedContent = mainContent + separator + newSections.join("\n\n");
      try {
        await writeMainMemory(this.storage, updatedContent);
        savedCount += forMain.length;
      } catch (error: unknown) {
        logger.error({ error: String(error) }, "Failed to write main memory");
      }
    }

    // 주제별 파일에 오버플로우 항목 저장
    const topicGroups = groupByCategory(forTopics);
    for (const [category, entries] of topicGroups) {
      const topicName = CATEGORY_TOPIC_MAP[category];
      try {
        const existingContent = (await readTopicMemory(this.storage, topicName)) ?? "";
        const newSections = entries.map(formatEntryForStorage);
        const separator = existingContent ? "\n\n" : "";
        const updatedContent = existingContent + separator + newSections.join("\n\n");
        await writeTopicMemory(this.storage, topicName, updatedContent);
        savedCount += entries.length;
      } catch (error: unknown) {
        logger.error({ error: String(error), topic: topicName }, "Failed to write topic memory");
      }
    }

    // pending 큐 비우기
    this.pending.length = 0;
    return savedCount;
  }

  /**
   * 아직 저장되지 않은 대기 중인 항목들을 반환합니다.
   *
   * @returns pending 항목의 읽기 전용 복사본
   */
  getPending(): readonly AutoMemoryEntry[] {
    return [...this.pending];
  }

  /**
   * 시스템 프롬프트에 삽입할 메모리 섹션을 구성합니다.
   *
   * 다음 순서로 메모리를 로드합니다:
   * 1. 프로젝트 메인 MEMORY.md (최대 200줄)
   * 2. 전역 메모리 (크로스 프로젝트 공유)
   * 3. 존재하는 주제별 파일들
   *
   * @returns 마크다운 형식의 메모리 프롬프트 섹션 (없으면 빈 문자열)
   */
  async buildMemoryPrompt(): Promise<string> {
    const sections: string[] = [];

    // 프로젝트 메인 메모리 로드
    const mainContent = await readMainMemory(this.storage);
    if (mainContent) {
      sections.push(`## MEMORY.md\n\n${mainContent}`);
    }

    // 전역 메모리 로드
    const globalContent = await readGlobalMemory(this.storage);
    if (globalContent) {
      sections.push(`## Global Memory\n\n${globalContent}`);
    }

    // 주제별 파일 로드
    for (const topicName of Object.values(CATEGORY_TOPIC_MAP)) {
      try {
        const topicContent = await readTopicMemory(this.storage, topicName);
        if (topicContent) {
          const displayName = topicName.charAt(0).toUpperCase() + topicName.slice(1);
          sections.push(`## Topic: ${displayName}\n\n${topicContent}`);
        }
      } catch {
        // 로드 실패한 주제 파일은 건너뜀
      }
    }

    if (sections.length === 0) {
      return "";
    }

    return `# Auto-Memory (Project)\n\n${sections.join("\n\n")}`;
  }

  /**
   * 대기 중인 모든 항목을 저장하지 않고 삭제합니다.
   */
  clearPending(): void {
    this.pending.length = 0;
  }

  // -----------------------------------------------------------------------
  // 내부 감지 메서드들
  // -----------------------------------------------------------------------

  /**
   * 텍스트에서 기억할 만한 패턴을 감지합니다.
   * 키워드 규칙과 매칭하여 신뢰도가 임계값 이상인 항목만 반환합니다.
   *
   * @param text - 분석할 텍스트
   * @param source - 텍스트 출처 (로깅/추적용)
   * @returns 감지된 메모리 항목 목록
   */
  private detectPatterns(text: string, source: string): AutoMemoryEntry[] {
    if (!text || text.trim().length === 0) {
      return [];
    }

    const entries: AutoMemoryEntry[] = [];
    const seen = new Set<string>(); // 같은 텍스트 중복 방지

    for (const rule of this.patternRules) {
      for (const pattern of rule.patterns) {
        if (pattern.test(text)) {
          const extracted = rule.extractor(pattern, text);
          if (extracted && !seen.has(extracted)) {
            seen.add(extracted);
            // 기본 신뢰도에 내용 품질 보정을 적용
            const confidence = computeConfidence(rule.baseConfidence, extracted);
            if (confidence >= this.config.minConfidence) {
              entries.push({
                category: rule.category,
                content: extracted,
                confidence,
                source,
              });
            }
          }
        }
      }
    }

    return entries;
  }

  /**
   * 파일 접근 빈도를 추적하여 핵심 파일을 감지합니다.
   * 3회 이상 접근된 파일은 "핵심 파일"로 기록됩니다.
   *
   * @param filesAccessed - 이번 턴에서 접근된 파일 경로 목록
   * @returns 핵심 파일에 대한 메모리 항목 목록
   */
  private detectFrequentFiles(filesAccessed: readonly string[]): AutoMemoryEntry[] {
    const entries: AutoMemoryEntry[] = [];

    for (const filePath of filesAccessed) {
      const currentCount = (this.fileAccessCounts.get(filePath) ?? 0) + 1;
      this.fileAccessCounts.set(filePath, currentCount);

      // 3회 접근 시점에 한 번만 기록 (4회, 5회 등에서는 중복 기록하지 않음)
      if (currentCount === 3) {
        entries.push({
          category: "files",
          content: `Key file: ${filePath} (accessed frequently during this session)`,
          confidence: 0.75,
          source: "file-access-tracking",
        });
      }
    }

    return entries;
  }

  /**
   * 에러가 발생했다가 같은 턴에서 해결된 패턴을 감지합니다.
   *
   * AI 응답에 해결 지표("fixed", "resolved", "solution" 등)가 포함되어 있으면
   * 해당 에러를 "해결된 에러"로 기록합니다.
   *
   * @param turn - 분석할 턴 컨텍스트
   * @returns 해결된 에러에 대한 메모리 항목 목록
   */
  private detectResolvedErrors(turn: TurnContext): AutoMemoryEntry[] {
    // 에러가 없었으면 감지할 것이 없음
    if (turn.errorsEncountered.length === 0) {
      return [];
    }

    const entries: AutoMemoryEntry[] = [];
    const responseLC = turn.assistantResponse.toLowerCase();

    // 해결을 나타내는 키워드들
    const resolutionIndicators = [
      "fixed",
      "resolved",
      "solution",
      "the issue was",
      "the problem was",
      "root cause",
      "workaround",
    ];

    // AI 응답에 해결 지표가 있는지 확인
    const hasResolution = resolutionIndicators.some((indicator) => responseLC.includes(indicator));

    if (hasResolution) {
      for (const error of turn.errorsEncountered) {
        const trimmedError = error.trim();
        if (trimmedError.length > 0) {
          entries.push({
            category: "debugging",
            content: `Error resolved: "${truncateString(trimmedError, 200)}" - See assistant response for solution.`,
            confidence: 0.85,
            source: "error-resolution",
          });
        }
      }
    }

    return entries;
  }
}

// ---------------------------------------------------------------------------
// 순수 헬퍼 함수들 (부수 효과 없는 유틸리티)
// ---------------------------------------------------------------------------

/**
 * 정규표현식 매치 주변의 문장을 추출합니다.
 * 매치 위치에서 앞뒤로 문장 경계(마침표, 줄바꿈 등)까지 확장합니다.
 *
 * @param pattern - 매칭할 정규표현식
 * @param text - 검색 대상 텍스트
 * @returns 추출된 문장 (최대 500자), 매칭 실패 시 null
 */
function extractSentenceAround(pattern: RegExp, text: string): string | null {
  const match = pattern.exec(text);
  if (!match || match.index === undefined) {
    return null;
  }

  // 매치 위치에서 뒤로 가며 문장 시작 지점 찾기
  const beforeMatch = text.slice(0, match.index);
  const afterMatch = text.slice(match.index + match[0].length);

  const sentenceStartChars = ["\n", ".", "!", "?"];
  let sentenceStart = 0;
  for (let i = beforeMatch.length - 1; i >= 0; i--) {
    if (sentenceStartChars.includes(beforeMatch[i]!)) {
      sentenceStart = i + 1;
      break;
    }
  }

  // 매치 위치에서 앞으로 가며 문장 끝 지점 찾기
  const sentenceEndMatch = /[.!?\n]/.exec(afterMatch);
  const sentenceEnd = sentenceEndMatch
    ? match.index + match[0].length + sentenceEndMatch.index + 1
    : Math.min(text.length, match.index + match[0].length + 200);

  const sentence = text.slice(sentenceStart, sentenceEnd).trim();
  return sentence.length > 0 ? truncateString(sentence, 500) : null;
}

/**
 * 기본 신뢰도에 콘텐츠 품질 신호를 반영하여 최종 신뢰도를 계산합니다.
 *
 * 보정 규칙:
 * - 100자 이상의 긴 내용: +0.05 (더 자세한 내용은 더 유용할 가능성 높음)
 * - 20자 미만의 짧은 내용: -0.15 (너무 짧으면 노이즈일 수 있음)
 * - 코드 관련 토큰 포함 시: +0.05 (백틱 코드, function/class 등)
 *
 * @param baseConfidence - 패턴 규칙의 기본 신뢰도
 * @param content - 추출된 내용 텍스트
 * @returns 보정된 최종 신뢰도 (0.0 ~ 1.0, 소수점 2자리)
 */
function computeConfidence(baseConfidence: number, content: string): number {
  let confidence = baseConfidence;

  // 길고 상세한 내용은 더 유용할 가능성이 높음
  if (content.length > 100) {
    confidence = Math.min(1, confidence + 0.05);
  }

  // 너무 짧은 내용은 노이즈(잡음)일 수 있음
  if (content.length < 20) {
    confidence = Math.max(0, confidence - 0.15);
  }

  // 코드 관련 토큰이 있으면 개발 맥락에서 더 유용함
  if (/`[^`]+`/.test(content) || /\b(?:function|class|interface|const|let|var)\b/.test(content)) {
    confidence = Math.min(1, confidence + 0.05);
  }

  // 소수점 2자리로 반올림하여 부동소수점 오차 방지
  return Math.round(confidence * 100) / 100;
}

/**
 * 텍스트를 중복 비교용으로 정규화합니다.
 * 소문자 변환, 공백 통합, 마크다운 헤더 제거를 수행합니다.
 */
function normalizeForComparison(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ") // 연속 공백을 하나로 통합
    .replace(/^#+\s*/gm, "") // 마크다운 헤더(##) 제거
    .trim();
}

/**
 * 정규화된 검색어가 대상 텍스트에 포함되어 있는지 확인합니다.
 */
function containsNormalized(haystack: string, normalizedNeedle: string): boolean {
  const normalizedHaystack = normalizeForComparison(haystack);
  return normalizedHaystack.includes(normalizedNeedle);
}

/**
 * AutoMemoryEntry를 .md 파일에 저장할 형식으로 포매팅합니다.
 * "### 카테고리 (날짜)\n\n내용" 형태의 마크다운 섹션을 생성합니다.
 */
function formatEntryForStorage(entry: AutoMemoryEntry): string {
  const timestamp = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const categoryLabel = entry.category.charAt(0).toUpperCase() + entry.category.slice(1);
  return `### ${categoryLabel} (${timestamp})\n\n${entry.content}`;
}

/**
 * 항목들을 카테고리별로 그룹화합니다.
 *
 * @param entries - 그룹화할 항목 배열
 * @returns 카테고리 → 항목 배열의 Map
 */
function groupByCategory(
  entries: readonly AutoMemoryEntry[],
): Map<MemoryCategory, AutoMemoryEntry[]> {
  const groups = new Map<MemoryCategory, AutoMemoryEntry[]>();
  for (const entry of entries) {
    const existing = groups.get(entry.category);
    if (existing) {
      existing.push(entry);
    } else {
      groups.set(entry.category, [entry]);
    }
  }
  return groups;
}

/**
 * 문자열을 최대 길이로 잘라냅니다. 잘린 경우 "..."을 붙입니다.
 */
function truncateString(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength - 3) + "...";
}

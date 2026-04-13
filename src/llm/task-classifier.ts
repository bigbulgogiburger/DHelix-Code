/**
 * 태스크 분류기 — 사용자 메시지와 컨텍스트를 분석하여 작업 단계(plan/execute/review)를 자동 분류
 *
 * 규칙 기반 + 휴리스틱 방식으로 메시지 내용, 대화 히스토리, 도구 호출 패턴,
 * 세션 상태 등을 종합적으로 분석하여 현재 작업이 어느 단계에 해당하는지 판단합니다.
 *
 * 분류 결과에는 신뢰도(confidence) 점수가 포함되며,
 * DualModelRouter가 이를 활용해 적절한 모델(Architect/Editor)을 선택합니다.
 *
 * @module task-classifier
 */
import type { ChatMessage } from "./provider.js";
import type { TaskPhase } from "./dual-model-router.js";

/**
 * 분류에 사용되는 컨텍스트 정보
 *
 * 현재 메시지뿐 아니라 최근 대화 히스토리, 도구 호출 상태,
 * 세션 진행 상태, 파일 변경 수 등을 포함하여 정확한 분류를 돕습니다.
 */
export interface ClassificationContext {
  /** 현재 사용자 메시지 텍스트 */
  readonly currentMessage: string;
  /** 최근 대화 히스토리 (최대 5개) — 이전 턴의 흐름을 파악하는 데 사용 */
  readonly recentHistory: readonly ChatMessage[];
  /** 대기 중인 도구 호출 이름 목록 — 직전에 어떤 도구가 실행되었는지 확인 */
  readonly pendingToolCalls: readonly string[];
  /** 세션 진행 단계 — 대화 초반/중반/후반에 따라 분류 가중치가 달라짐 */
  readonly sessionPhase: "initial" | "mid" | "late";
  /** 이 세션에서 수정된 파일 수 — 많은 파일이 변경되면 리뷰가 필요할 수 있음 */
  readonly fileChangesCount: number;
}

/**
 * 분류 결과 — 단계, 신뢰도, 근거, 추천 모델을 포함
 */
export interface TaskClassification {
  /** 분류된 작업 단계 */
  readonly phase: TaskPhase;
  /** 신뢰도 점수 (0.0 ~ 1.0) — 높을수록 분류가 확실함 */
  readonly confidence: number;
  /** 분류 근거 설명 — 디버깅 및 로깅 목적 */
  readonly reasoning: string;
  /** 추천 모델 역할 ("architect" 또는 "editor") */
  readonly suggestedModel: "architect" | "editor";
}

/**
 * 내부 신호(signal) — 분류 규칙이 발견한 개별 힌트
 *
 * 여러 신호가 수집된 후 가장 높은 가중치의 신호를 기준으로 최종 분류가 결정됩니다.
 */
interface ClassificationSignal {
  readonly phase: TaskPhase;
  readonly weight: number;
  readonly reason: string;
}

/** plan 단계를 나타내는 한글 키워드 */
const PLAN_KEYWORDS_KO = ["계획", "설계", "분석", "리뷰", "아키텍처", "전략", "제안"] as const;

/** plan 단계를 나타내는 영문 키워드 */
const PLAN_KEYWORDS_EN = [
  "plan",
  "design",
  "analyze",
  "analyse",
  "review",
  "architecture",
  "strategy",
  "approach",
  "proposal",
  "rfc",
] as const;

/** execute 단계를 나타내는 한글 키워드 */
const EXECUTE_KEYWORDS_KO = ["구현", "코드", "작성", "수정", "만들어", "추가", "생성"] as const;

/** execute 단계를 나타내는 영문 키워드 */
const EXECUTE_KEYWORDS_EN = [
  "implement",
  "code",
  "write",
  "fix",
  "create",
  "build",
  "add",
  "modify",
] as const;

/** review 단계를 나타내는 한글 키워드 */
const REVIEW_KEYWORDS_KO = ["확인", "검토", "테스트", "점검", "검증"] as const;

/** review 단계를 나타내는 영문 키워드 */
const REVIEW_KEYWORDS_EN = ["check", "verify", "test", "validate", "inspect", "audit"] as const;

/** 이전 plan 결과 후 실행 전환을 나타내는 키워드 */
const PROCEED_KEYWORDS = [
  "진행해줘",
  "진행",
  "시작해줘",
  "go ahead",
  "proceed",
  "start",
  "do it",
] as const;

/** 파일 쓰기/편집 관련 도구 이름 — execute 단계 신호 */
const FILE_MUTATION_TOOLS = ["file_write", "file_edit", "bash_exec"] as const;

/**
 * 태스크 분류기 — 규칙 기반 + 휴리스틱으로 작업 단계를 자동 분류
 *
 * 분류 우선순위:
 * 1. 첫 메시지 (히스토리 없음) → plan (0.8)
 * 2. 이전 plan + "진행해줘" → execute (0.9)
 * 3. 키워드 매칭 (plan/execute/review)
 * 4. 도구 호출 패턴
 * 5. 파일 변경 수 기반 review 힌트
 *
 * @example
 * ```typescript
 * const classifier = new TaskClassifier();
 * const result = classifier.classify({
 *   currentMessage: "이 모듈을 리팩토링할 계획을 세워줘",
 *   recentHistory: [],
 *   pendingToolCalls: [],
 *   sessionPhase: "initial",
 *   fileChangesCount: 0,
 * });
 * // result.phase === "plan", result.confidence === 0.8
 * ```
 */
export class TaskClassifier {
  /**
   * 컨텍스트를 분석하여 현재 작업 단계를 분류
   *
   * 여러 분류 규칙을 순서대로 적용하고, 발견된 신호(signal) 중
   * 가장 높은 가중치를 가진 신호를 기준으로 최종 분류를 결정합니다.
   *
   * @param context - 분류에 사용할 컨텍스트 정보
   * @returns 분류 결과 (단계, 신뢰도, 근거, 추천 모델)
   */
  classify(context: ClassificationContext): TaskClassification {
    const signals: ClassificationSignal[] = [];
    const messageLower = context.currentMessage.toLowerCase();

    // Rule 1: 첫 메시지 (히스토리가 비어 있음) → plan
    if (context.recentHistory.length === 0) {
      signals.push({ phase: "plan", weight: 0.8, reason: "first message with no history" });
    }

    // Rule 2: 이전 plan 결과 + "진행해줘" 패턴 → execute
    if (this.hasPreviousPlanResult(context.recentHistory)) {
      if (PROCEED_KEYWORDS.some((k) => messageLower.includes(k))) {
        signals.push({ phase: "execute", weight: 0.9, reason: "proceed after previous plan" });
      }
    }

    // Rule 3: 키워드 매칭 — plan
    if (this.matchesAnyKeyword(messageLower, [...PLAN_KEYWORDS_KO, ...PLAN_KEYWORDS_EN])) {
      signals.push({ phase: "plan", weight: 0.7, reason: "plan keyword detected" });
    }

    // Rule 4: 키워드 매칭 — execute
    if (this.matchesAnyKeyword(messageLower, [...EXECUTE_KEYWORDS_KO, ...EXECUTE_KEYWORDS_EN])) {
      signals.push({ phase: "execute", weight: 0.6, reason: "execute keyword detected" });
    }

    // Rule 5: 키워드 매칭 — review
    if (this.matchesAnyKeyword(messageLower, [...REVIEW_KEYWORDS_KO, ...REVIEW_KEYWORDS_EN])) {
      signals.push({ phase: "review", weight: 0.6, reason: "review keyword detected" });
    }

    // Rule 6: 파일 변경 도구 호출 직후 → execute
    if (this.hasFileMutationTools(context.pendingToolCalls)) {
      signals.push({ phase: "execute", weight: 0.7, reason: "file mutation tool call detected" });
    }

    // Rule 7: 10+ 파일 변경 후 → review (낮은 가중치, 다른 신호보다 후순위)
    if (context.fileChangesCount >= 10) {
      signals.push({ phase: "review", weight: 0.5, reason: "10+ file changes suggest review" });
    }

    // 신호가 없으면 기본값 execute (가장 흔한 작업)
    if (signals.length === 0) {
      return {
        phase: "execute",
        confidence: 0.4,
        reasoning: "no classification signals found, defaulting to execute",
        suggestedModel: "architect",
      };
    }

    // 가장 높은 가중치의 신호를 선택
    const bestSignal = this.selectBestSignal(signals);

    // 추천 모델: plan/review → architect, execute → editor
    const suggestedModel: "architect" | "editor" =
      bestSignal.phase === "execute" ? "editor" : "architect";

    return {
      phase: bestSignal.phase,
      confidence: bestSignal.weight,
      reasoning: bestSignal.reason,
      suggestedModel,
    };
  }

  /**
   * 최근 히스토리에서 이전 plan 결과가 있는지 확인
   *
   * assistant 메시지 중 plan 관련 키워드가 포함된 메시지가 있으면
   * 이전에 계획 수립이 이루어진 것으로 판단합니다.
   */
  private hasPreviousPlanResult(history: readonly ChatMessage[]): boolean {
    const planIndicators = ["계획", "plan", "설계", "design", "단계", "step", "phase"];
    return history.some(
      (msg) =>
        msg.role === "assistant" &&
        planIndicators.some((k) => msg.content.toLowerCase().includes(k)),
    );
  }

  /**
   * 메시지가 주어진 키워드 목록 중 하나와 일치하는지 확인
   */
  private matchesAnyKeyword(messageLower: string, keywords: readonly string[]): boolean {
    return keywords.some((k) => messageLower.includes(k));
  }

  /**
   * 대기 중인 도구 호출에 파일 변경 도구가 포함되어 있는지 확인
   */
  private hasFileMutationTools(toolCalls: readonly string[]): boolean {
    return toolCalls.some((tc) => FILE_MUTATION_TOOLS.some((ft) => tc.includes(ft)));
  }

  /**
   * 수집된 신호 중 가장 높은 가중치를 가진 신호를 선택
   *
   * 동일한 가중치가 여러 개이면 먼저 발견된 신호를 우선합니다.
   */
  private selectBestSignal(signals: readonly ClassificationSignal[]): ClassificationSignal {
    let best = signals[0]!;
    for (const signal of signals) {
      if (signal.weight > best.weight) {
        best = signal;
      }
    }
    return best;
  }
}

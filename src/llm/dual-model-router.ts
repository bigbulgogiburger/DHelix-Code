/**
 * 듀얼 모델 라우터 — Architect/Editor 패턴으로 두 모델을 역할 분담하는 모듈
 *
 * 하나의 작업을 두 모델이 역할을 나눠서 처리하는 패턴입니다:
 * - Architect(설계자): 높은 능력의 모델 — 계획 수립, 코드 리뷰에 사용
 * - Editor(편집자): 비용 효율적인 모델 — 코드 생성, 실행에 사용
 *
 * 이 패턴의 장점:
 * - 품질 향상: 중요한 결정(설계, 리뷰)은 고성능 모델이 담당
 * - 비용 절감: 반복적인 작업(코드 생성)은 저렴한 모델이 담당
 *
 * 예시 구성:
 * - Architect: Claude Opus (계획, 리뷰)
 * - Editor: Claude Sonnet (코드 작성, 실행)
 */
import type { LLMProvider } from "./provider.js";
import { TaskClassifier, type ClassificationContext, type TaskClassification } from "./task-classifier.js";

// Re-export TaskClassifier types for convenience
export type { ClassificationContext, TaskClassification };

/** 듀얼 모델 설정 — Architect/Editor 모델 이름과 라우팅 전략 */
export interface DualModelConfig {
  /** 설계자(Architect) 모델 이름 — 계획 수립, 코드 리뷰에 사용되는 고성능 모델 */
  readonly architectModel: string;
  /** 편집자(Editor) 모델 이름 — 코드 생성, 실행에 사용되는 비용 효율적 모델 */
  readonly editorModel: string;
  /**
   * 라우팅 전략
   * - "auto": 메시지 내용을 분석하여 자동으로 모델 선택
   * - "plan-execute": 계획→실행 순서로 명시적 단계 분리
   * - "manual": 외부에서 단계를 직접 지정
   */
  readonly routingStrategy: "auto" | "plan-execute" | "manual";
}

/**
 * 작업 실행 단계 — 현재 작업이 어느 단계인지 표시
 *
 * - "plan": 계획 수립 단계 → Architect 모델 사용
 * - "execute": 실행 단계 → Editor 모델 사용
 * - "review": 리뷰 단계 → Architect 모델 사용
 */
export type TaskPhase = "plan" | "execute" | "review";

/**
 * 듀얼 모델 라우터 — 작업 단계에 따라 적절한 모델을 선택
 *
 * 사용 예시:
 * ```typescript
 * const router = new DualModelRouter(config, architectClient, editorClient);
 *
 * // 계획 단계 — Architect 모델 사용
 * router.setPhase("plan");
 * const { client, model } = router.getClientForPhase();
 * // → architectClient, "claude-opus-4-20250514"
 *
 * // 실행 단계 — Editor 모델 사용
 * router.setPhase("execute");
 * const { client, model } = router.getClientForPhase();
 * // → editorClient, "claude-sonnet-4-20250514"
 * ```
 */
export class DualModelRouter {
  /** 현재 작업 단계 — 기본값은 "execute" (가장 빈번한 단계) */
  private currentPhase: TaskPhase = "execute";

  /** 태스크 분류기 — "auto" 전략에서 메시지를 분석하여 단계를 자동 결정 */
  private readonly classifier: TaskClassifier;

  /** 마지막 분류 결과 — 디버깅 및 로깅 목적으로 보관 */
  private lastClassification: TaskClassification | undefined;

  /**
   * @param config - 듀얼 모델 설정 (모델 이름, 라우팅 전략)
   * @param architectClient - 설계자 모델의 LLM 클라이언트
   * @param editorClient - 편집자 모델의 LLM 클라이언트
   */
  constructor(
    private readonly config: DualModelConfig,
    private readonly architectClient: LLMProvider,
    private readonly editorClient: LLMProvider,
  ) {
    this.classifier = new TaskClassifier();
  }

  /**
   * 현재 작업 단계를 변경
   *
   * @param phase - 새 작업 단계 ("plan", "execute", "review")
   */
  setPhase(phase: TaskPhase): void {
    this.currentPhase = phase;
  }

  /**
   * 현재 작업 단계를 반환
   *
   * @returns 현재 작업 단계
   */
  getPhase(): TaskPhase {
    return this.currentPhase;
  }

  /**
   * 듀얼 모델 설정을 반환
   *
   * @returns 현재 설정 객체
   */
  getConfig(): DualModelConfig {
    return this.config;
  }

  /**
   * 지정된 단계에 적합한 클라이언트, 모델, 역할을 반환
   *
   * 라우팅 규칙:
   * - "plan" 또는 "review" 단계 → Architect 모델 (고성능, 깊은 추론)
   * - "execute" 단계 → Editor 모델 (비용 효율적, 빠른 응답)
   *
   * @param phase - 조회할 단계 (생략하면 현재 단계 사용)
   * @returns 클라이언트, 모델 이름, 역할 정보
   */
  getClientForPhase(phase?: TaskPhase): {
    readonly client: LLMProvider;
    readonly model: string;
    readonly role: "architect" | "editor";
  } {
    const p = phase ?? this.currentPhase;
    // plan과 review는 설계/분석 작업이므로 Architect 모델 사용
    const isArchitect = p === "plan" || p === "review";
    return isArchitect
      ? { client: this.architectClient, model: this.config.architectModel, role: "architect" }
      : { client: this.editorClient, model: this.config.editorModel, role: "editor" };
  }

  /**
   * 컨텍스트를 분석하여 적절한 모델을 자동 선택 (routingStrategy: "auto"용)
   *
   * TaskClassifier를 사용하여 메시지와 컨텍스트를 분석하고,
   * 분류된 단계에 따라 Architect 또는 Editor 모델을 반환합니다.
   *
   * confidence >= 0.6이면 분류된 단계의 모델을, < 0.6이면 Architect 모델을 사용합니다.
   * (낮은 신뢰도일 때 Architect를 사용하는 이유: 비용보다 품질이 중요한 안전한 선택)
   *
   * @param context - 분류에 사용할 컨텍스트 정보
   * @returns 선택된 클라이언트, 모델 이름, 역할, 분류 결과
   */
  selectModel(context: ClassificationContext): {
    readonly client: LLMProvider;
    readonly model: string;
    readonly role: "architect" | "editor";
    readonly classification: TaskClassification;
  } {
    const classification = this.classifier.classify(context);
    this.lastClassification = classification;

    // confidence가 낮으면 Architect 모델로 안전하게 폴백
    if (classification.confidence < 0.6) {
      this.currentPhase = classification.phase;
      return {
        client: this.architectClient,
        model: this.config.architectModel,
        role: "architect",
        classification,
      };
    }

    // 분류된 단계로 업데이트하고 해당 단계의 모델 반환
    this.currentPhase = classification.phase;
    const { client, model, role } = this.getClientForPhase(classification.phase);
    return { client, model, role, classification };
  }

  /**
   * 마지막 분류 결과를 반환 — 디버깅 및 로깅 목적
   *
   * @returns 마지막 TaskClassification 또는 undefined (아직 분류 없음)
   */
  getLastClassification(): TaskClassification | undefined {
    return this.lastClassification;
  }
}

/**
 * 대화 메시지에서 작업 단계를 자동 감지 — TaskClassifier를 사용한 개선 버전
 *
 * 기존 단순 키워드 매칭 대신 TaskClassifier를 활용하여
 * 메시지 내용, 대화 히스토리, 세션 상태를 종합적으로 분석합니다.
 *
 * 이 함수는 routingStrategy가 "auto"일 때 사용됩니다.
 * 하위 호환성을 위해 기존 시그니처를 유지합니다.
 *
 * @param messages - 대화 메시지 배열
 * @returns 감지된 작업 단계 ("plan", "execute", 또는 "review")
 */
export function detectPhase(
  messages: readonly { readonly role: string; readonly content: string }[],
): TaskPhase {
  // 마지막 사용자 메시지를 찾음 (배열을 뒤에서부터 검색)
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser) return "execute"; // 사용자 메시지가 없으면 기본값 execute

  const content = typeof lastUser.content === "string" ? lastUser.content : "";

  // TaskClassifier를 사용하여 분류
  const classifier = new TaskClassifier();
  const recentHistory = messages
    .slice(-5)
    .map((m) => ({ role: m.role as "user" | "assistant" | "system" | "tool", content: m.content }));

  const context: ClassificationContext = {
    currentMessage: content,
    recentHistory,
    pendingToolCalls: [],
    sessionPhase: messages.length <= 2 ? "initial" : messages.length <= 10 ? "mid" : "late",
    fileChangesCount: 0,
  };

  const result = classifier.classify(context);
  return result.phase;
}

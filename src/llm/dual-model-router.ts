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

  /**
   * @param config - 듀얼 모델 설정 (모델 이름, 라우팅 전략)
   * @param architectClient - 설계자 모델의 LLM 클라이언트
   * @param editorClient - 편집자 모델의 LLM 클라이언트
   */
  constructor(
    private readonly config: DualModelConfig,
    private readonly architectClient: LLMProvider,
    private readonly editorClient: LLMProvider,
  ) {}

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
}

/**
 * 계획/분석 단계를 나타내는 키워드 목록
 *
 * 사용자 메시지에 이 키워드가 포함되면 "plan" 단계로 판단합니다.
 * 한국어와 영어 키워드를 모두 포함합니다.
 */
const PLAN_KEYWORDS = [
  "plan", // 계획
  "설계", // 설계 (한국어)
  "분석", // 분석 (한국어)
  "리뷰", // 리뷰 (한국어)
  "review", // 코드 리뷰
  "architecture", // 아키텍처 설계
  "design", // 설계
  "analyze", // 분석
  "analyse", // 분석 (영국식)
  "strategy", // 전략
  "approach", // 접근 방식
  "proposal", // 제안
  "RFC", // Request for Comments — 기술 제안서
] as const;

/**
 * 대화 메시지에서 작업 단계를 자동 감지
 *
 * 마지막 사용자 메시지에 계획/분석 관련 키워드가 포함되어 있으면
 * "plan" 단계로, 그렇지 않으면 "execute" 단계로 판단합니다.
 *
 * 이 함수는 routingStrategy가 "auto"일 때 사용됩니다.
 *
 * @param messages - 대화 메시지 배열
 * @returns 감지된 작업 단계 ("plan" 또는 "execute")
 */
export function detectPhase(
  messages: readonly { readonly role: string; readonly content: string }[],
): TaskPhase {
  // 마지막 사용자 메시지를 찾음 (배열을 뒤에서부터 검색)
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser) return "execute"; // 사용자 메시지가 없으면 기본값 execute

  const content = typeof lastUser.content === "string" ? lastUser.content.toLowerCase() : "";
  // 키워드가 하나라도 포함되면 plan, 아니면 execute
  return PLAN_KEYWORDS.some((k) => content.includes(k)) ? "plan" : "execute";
}

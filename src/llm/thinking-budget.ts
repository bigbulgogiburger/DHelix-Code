/**
 * 사고 예산 계산기 — Extended Thinking의 토큰 예산을 동적으로 결정하는 모듈
 *
 * Extended Thinking(확장 사고)은 Claude 모델이 답변하기 전에
 * 내부적으로 깊이 생각하는 기능입니다.
 *
 * 사고 예산(thinking budget)은 사고에 할당할 최대 토큰 수를 의미합니다.
 * 예산이 클수록 더 깊이 생각하지만:
 * - 응답 시간이 길어짐
 * - 비용이 증가함
 * - 컨텍스트 윈도우 여유 공간이 줄어듦
 *
 * 이 모듈은 모델 특성과 현재 컨텍스트 사용률을 고려하여
 * 적절한 사고 예산을 계산합니다.
 */
import { type ModelCapabilities } from "./model-capabilities.js";

/**
 * 모델 능력과 컨텍스트 사용률을 기반으로 사고 예산을 계산
 *
 * 계산 로직:
 * 1. 모델이 사고를 지원하지 않으면 → 0 반환
 * 2. 모델에 기본 사고 예산이 설정되어 있으면 → 해당 값 사용
 *    (단, 컨텍스트 사용률이 70%를 넘으면 예산을 절반으로 줄임)
 * 3. 기본값이 없으면 → 최대 컨텍스트의 5%를 자동 계산 (상한 16384)
 *
 * 컨텍스트 사용률 70% 이상에서 예산을 줄이는 이유:
 * - 컨텍스트 윈도우가 가득 차면 사고에 할당할 여유 토큰이 부족해짐
 * - 남은 공간을 실제 응답 생성에 우선 배분해야 함
 *
 * 최소 예산은 1024 토큰 — 너무 적으면 의미 있는 사고가 불가능
 *
 * @param caps - 모델의 능력 정보
 * @param contextUsagePercent - 현재 컨텍스트 사용률 (0~100, 기본값: 0)
 * @returns 사고 예산 (토큰 수), 사고 미지원 모델은 0
 */
export function calculateThinkingBudget(
  caps: ModelCapabilities,
  contextUsagePercent: number = 0,
): number {
  // 사고를 지원하지 않는 모델은 예산 0
  if (!caps.supportsThinking) return 0;

  // 모델별 기본 사고 예산이 있는 경우
  if (caps.defaultThinkingBudget > 0) {
    // 컨텍스트 사용률이 70%를 초과하면 예산을 절반으로 축소
    // 남은 컨텍스트 공간을 응답 생성에 우선 배분
    if (contextUsagePercent > 70) {
      return Math.max(1024, Math.floor(caps.defaultThinkingBudget * 0.5));
    }
    return caps.defaultThinkingBudget;
  }

  // 기본값 없음 → 자동 계산: 최대 컨텍스트의 5%, 상한 16384
  const base = Math.min(Math.floor(caps.maxContextTokens * 0.05), 16384);
  // 컨텍스트 사용률이 높으면 스케일 팩터 0.5 적용 (예산 절반)
  const scaleFactor = contextUsagePercent > 70 ? 0.5 : 1.0;
  // 최소 1024 토큰 보장
  return Math.max(1024, Math.floor(base * scaleFactor));
}

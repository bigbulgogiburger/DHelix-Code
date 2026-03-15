/**
 * 가드레일 타입 정의 — 보안 검사 결과와 규칙의 공통 인터페이스
 *
 * 가드레일(Guardrail)이란 AI가 위험한 작업을 수행하지 못하도록
 * 보호하는 안전장치입니다. 이 파일은 모든 가드레일 모듈이
 * 공유하는 타입을 정의합니다.
 */

/**
 * 가드레일 검사 결과 인터페이스
 *
 * 모든 보안 검사 함수(명령어 필터, 경로 필터, 인젝션 탐지 등)가
 * 이 형태의 결과를 반환합니다.
 *
 * @property passed - 검사를 통과했는지 여부 (false면 작업이 차단됨)
 * @property modified - 출력이 수정된 경우 수정된 텍스트 (예: 비밀 정보가 [REDACTED]로 대체됨)
 * @property reason - 검사 실패 또는 경고의 이유를 설명하는 메시지
 * @property severity - 심각도 수준:
 *   - "block": 즉시 차단 (위험한 작업)
 *   - "warn": 경고만 표시 (주의가 필요한 작업)
 *   - "info": 정보 제공용 (정상 통과)
 */
export interface GuardrailResult {
  readonly passed: boolean;
  readonly modified?: string;
  readonly reason?: string;
  readonly severity: "block" | "warn" | "info";
}

/**
 * 가드레일 규칙 인터페이스
 *
 * 개별 보안 검사 규칙을 정의합니다. 각 규칙은 이름, 설명,
 * 심각도, 그리고 입력 텍스트를 검사하는 test 함수를 가집니다.
 *
 * @property name - 규칙의 고유 이름 (예: "fork_bomb", "sql_drop")
 * @property description - 규칙이 탐지하는 위협에 대한 설명
 * @property severity - 규칙이 매칭되었을 때의 심각도 수준
 * @property test - 입력 문자열을 검사하여 위협 여부를 반환하는 함수
 */
export interface GuardrailRule {
  readonly name: string;
  readonly description: string;
  readonly severity: "block" | "warn" | "info";
  readonly test: (input: string) => boolean;
}

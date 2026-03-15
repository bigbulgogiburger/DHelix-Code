/**
 * 출력 제한기 — LLM에 전달되는 도구 출력의 크기를 제한하는 모듈
 *
 * LLM의 컨텍스트 윈도우(한 번에 처리할 수 있는 텍스트의 양)는
 * 제한되어 있습니다. 매우 큰 출력(예: 로그 파일, 대용량 JSON)을
 * 그대로 전달하면 토큰이 낭비되고 성능이 저하됩니다.
 *
 * 이 모듈은 출력이 기준치(기본 50,000자)를 초과하면 앞부분 60%와
 * 뒷부분 40%만 유지하고 중간을 생략합니다. 앞부분에 더 많은 비중을
 * 두는 이유는 보통 출력의 시작 부분에 중요한 정보(헤더, 에러 메시지 등)가
 * 위치하기 때문입니다.
 */

// 출력 최대 문자 수 기본값 (50,000자 ≈ 약 12,500 토큰)
const DEFAULT_MAX_CHARS = 50000;

/**
 * 출력 제한 결과 인터페이스
 *
 * @property limited - 출력이 잘렸는지 여부
 * @property result - 최종 출력 텍스트 (잘린 경우 생략 표시가 포함됨)
 */
export interface OutputLimitResult {
  readonly limited: boolean;
  readonly result: string;
}

/**
 * 출력 텍스트의 크기를 제한합니다.
 *
 * 출력이 maxChars 이하이면 그대로 반환합니다.
 * 초과하면 앞부분(60%)과 뒷부분(40%)만 남기고 중간에
 * "[N characters omitted]" 표시를 삽입합니다.
 *
 * @param output - 원본 출력 텍스트
 * @param maxChars - 허용할 최대 문자 수 (기본값: 50,000)
 * @returns 제한 여부와 최종 텍스트를 포함한 결과 객체
 *
 * @example
 * ```ts
 * const result = limitOutput(longText, 10000);
 * if (result.limited) {
 *   console.log("출력이 잘렸습니다");
 * }
 * ```
 */
export function limitOutput(
  output: string,
  maxChars: number = DEFAULT_MAX_CHARS,
): OutputLimitResult {
  // 출력이 제한 내에 있으면 그대로 반환
  if (output.length <= maxChars) {
    return { limited: false, result: output };
  }

  // 앞부분: 전체 허용 크기의 60% (중요한 정보가 보통 앞에 위치)
  const headSize = Math.floor(maxChars * 0.6);
  // 뒷부분: 전체 허용 크기의 40% (최근 출력/결과가 뒤에 위치)
  const tailSize = Math.floor(maxChars * 0.4);
  // 생략되는 문자 수 계산
  const omitted = output.length - headSize - tailSize;

  const head = output.slice(0, headSize);
  const tail = output.slice(output.length - tailSize);

  return {
    limited: true,
    result: `${head}\n\n... [${omitted} characters omitted] ...\n\n${tail}`,
  };
}

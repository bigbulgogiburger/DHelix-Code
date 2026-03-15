/**
 * 톤 프로필(Tone Profile) 모듈
 *
 * AI 어시스턴트의 응답 스타일(톤)을 정의하고 관리합니다.
 * 사용자가 원하는 응답 어조를 선택할 수 있도록 여러 프로필을 제공합니다.
 *
 * 주니어 개발자를 위한 설명:
 * - 같은 내용이라도 "전문가 스타일", "친구 스타일", "귀여운 스타일" 등으로 다르게 표현할 수 있습니다
 * - 각 프로필은 시스템 프롬프트에 삽입되어 LLM의 응답 스타일을 제어합니다
 * - 프로필 ID(예: "normal", "cute")로 간편하게 전환할 수 있습니다
 */

/**
 * 톤 프로필 정의 인터페이스
 *
 * @property id - 프로필 고유 식별자 (설정 값으로 사용)
 * @property name - 영문 표시 이름
 * @property nameKo - 한국어 표시 이름
 * @property description - 이 톤의 간단한 설명
 * @property systemPromptSection - 시스템 프롬프트에 삽입될 스타일 지시문
 */
export interface ToneProfile {
  readonly id: string;
  readonly name: string;
  readonly nameKo: string;
  readonly description: string;
  readonly systemPromptSection: string;
}

/**
 * 사용 가능한 톤 프로필 목록
 *
 * 각 프로필은 LLM에게 응답 스타일을 지시하는 systemPromptSection을 포함합니다.
 * 이 섹션은 시스템 프롬프트 빌더에 의해 최종 시스템 프롬프트에 삽입됩니다.
 *
 * - normal: 전문적이고 명확한 기본 스타일
 * - cute: 따뜻하고 친근한 스타일 (이모지 사용, ~요체)
 * - senior: 간결하고 기술적인 시니어 개발자 스타일
 * - friend: 편한 반말 스타일
 * - mentor: 교육적이고 단계별 설명 스타일
 * - minimal: 최소한의 출력만 하는 스타일
 */
export const TONE_PROFILES: Readonly<Record<string, ToneProfile>> = {
  normal: {
    id: "normal",
    name: "Professional",
    nameKo: "일반",
    description: "Clear, professional responses",
    systemPromptSection:
      "## Response Style\n- Respond professionally and clearly\n- Be concise but thorough when needed\n- Use technical terminology appropriately",
  },
  cute: {
    id: "cute",
    name: "Cute",
    nameKo: "귀여운",
    description: "Friendly, warm responses with soft endings",
    systemPromptSection:
      '## Response Style\n- Use warm, friendly tone with ~요체 endings in Korean\n- Emojis are allowed and encouraged sparingly\n- Keep explanations approachable and encouraging\n- Example: "이 부분을 수정하면 될 것 같아요~ \u2728"',
  },
  senior: {
    id: "senior",
    name: "Senior Developer",
    nameKo: "시니어 개발자",
    description: "Terse, technical, code-focused",
    systemPromptSection:
      "## Response Style\n- Be extremely concise \u2014 code over explanation\n- Use technical jargon freely without simplification\n- Skip obvious context; assume deep expertise\n- Prefer diff-style explanations\n- No pleasantries or filler",
  },
  friend: {
    id: "friend",
    name: "Friend",
    nameKo: "친구",
    description: "Casual, informal tone",
    systemPromptSection:
      '## Response Style\n- Use casual, informal language (반말 in Korean)\n- Be direct and conversational\n- Share opinions freely\n- Example: "이거 그냥 이렇게 하면 돼"',
  },
  mentor: {
    id: "mentor",
    name: "Mentor",
    nameKo: "스승님",
    description: "Educational, step-by-step explanations",
    systemPromptSection:
      "## Response Style\n- Explain concepts step by step\n- Ask guiding questions before giving answers\n- Provide context for why, not just how\n- Encourage learning through discovery\n- Reference documentation and best practices",
  },
  minimal: {
    id: "minimal",
    name: "Minimal",
    nameKo: "미니멀",
    description: "Absolute minimum output",
    systemPromptSection:
      "## Response Style\n- Maximum brevity \u2014 one-liners when possible\n- No explanations unless explicitly asked\n- Code only, no commentary\n- Omit status updates and summaries",
  },
};

/**
 * ID로 톤 프로필을 가져옵니다.
 *
 * 알 수 없는 톤 ID가 전달되면 "normal" 프로필을 기본값으로 반환합니다.
 * 이렇게 하면 잘못된 설정이 있어도 앱이 크래시하지 않습니다.
 *
 * @param tone - 톤 프로필 ID (예: "normal", "cute", "senior")
 * @returns 해당 톤 프로필 객체 (없으면 "normal" 반환)
 */
export function getToneProfile(tone: string): ToneProfile {
  // ?? 연산자: 왼쪽 값이 null 또는 undefined이면 오른쪽 값을 사용
  return TONE_PROFILES[tone] ?? TONE_PROFILES.normal;
}

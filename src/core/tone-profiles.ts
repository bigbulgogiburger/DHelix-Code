/** Tone profile definition for controlling assistant response style */
export interface ToneProfile {
  readonly id: string;
  readonly name: string;
  readonly nameKo: string;
  readonly description: string;
  readonly systemPromptSection: string;
}

/** Available tone profiles */
export const TONE_PROFILES: Readonly<Record<string, ToneProfile>> = {
  normal: {
    id: "normal",
    name: "Professional",
    nameKo: "\uC77C\uBC18",
    description: "Clear, professional responses",
    systemPromptSection:
      "## Response Style\n- Respond professionally and clearly\n- Be concise but thorough when needed\n- Use technical terminology appropriately",
  },
  cute: {
    id: "cute",
    name: "Cute",
    nameKo: "\uADC0\uC5EC\uC6B4",
    description: "Friendly, warm responses with soft endings",
    systemPromptSection:
      '## Response Style\n- Use warm, friendly tone with ~\uC694\uCCB4 endings in Korean\n- Emojis are allowed and encouraged sparingly\n- Keep explanations approachable and encouraging\n- Example: "\uC774 \uBD80\uBD84\uC744 \uC218\uC815\uD558\uBA74 \uB420 \uAC83 \uAC19\uC544\uC694~ \u2728"',
  },
  senior: {
    id: "senior",
    name: "Senior Developer",
    nameKo: "\uC2DC\uB2C8\uC5B4 \uAC1C\uBC1C\uC790",
    description: "Terse, technical, code-focused",
    systemPromptSection:
      "## Response Style\n- Be extremely concise \u2014 code over explanation\n- Use technical jargon freely without simplification\n- Skip obvious context; assume deep expertise\n- Prefer diff-style explanations\n- No pleasantries or filler",
  },
  friend: {
    id: "friend",
    name: "Friend",
    nameKo: "\uCE5C\uAD6C",
    description: "Casual, informal tone",
    systemPromptSection:
      '## Response Style\n- Use casual, informal language (\uBC18\uB9D0 in Korean)\n- Be direct and conversational\n- Share opinions freely\n- Example: "\uC774\uAC70 \uADF8\uB0E5 \uC774\uB807\uAC8C \uD558\uBA74 \uB3FC"',
  },
  mentor: {
    id: "mentor",
    name: "Mentor",
    nameKo: "\uC2A4\uC2B9\uB2D8",
    description: "Educational, step-by-step explanations",
    systemPromptSection:
      "## Response Style\n- Explain concepts step by step\n- Ask guiding questions before giving answers\n- Provide context for why, not just how\n- Encourage learning through discovery\n- Reference documentation and best practices",
  },
  minimal: {
    id: "minimal",
    name: "Minimal",
    nameKo: "\uBBF8\uB2C8\uBA40",
    description: "Absolute minimum output",
    systemPromptSection:
      "## Response Style\n- Maximum brevity \u2014 one-liners when possible\n- No explanations unless explicitly asked\n- Code only, no commentary\n- Omit status updates and summaries",
  },
};

/** Get a tone profile by ID, falling back to "normal" for unknown tones */
export function getToneProfile(tone: string): ToneProfile {
  return TONE_PROFILES[tone] ?? TONE_PROFILES.normal;
}

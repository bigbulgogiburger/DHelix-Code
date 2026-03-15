/**
 * /tone 명령어 핸들러 — 응답 톤(어조) 설정
 *
 * 사용자가 /tone을 입력하면 LLM의 응답 어조를 변경합니다.
 *
 * 사용 가능한 톤:
 *   - normal  — 기본 전문적인 톤
 *   - cute    — 귀여운 말투
 *   - senior  — 시니어 개발자 톤
 *   - friend  — 친구처럼 편한 톤
 *   - mentor  — 멘토처럼 교육적인 톤
 *   - minimal — 최소한의 간결한 톤
 *
 * refreshInstructions로 시스템 프롬프트를 다시 로드하여
 * 톤 변경이 즉시 적용됩니다.
 *
 * 사용 시점: LLM과의 대화 스타일을 바꾸고 싶을 때
 */
import { TONE_PROFILES } from "../core/tone-profiles.js";
import { type SlashCommand } from "./registry.js";

export const toneCommand: SlashCommand = {
  name: "tone",
  description: "Set response tone/style",
  usage: "/tone [normal|cute|senior|friend|mentor|minimal]",
  execute: async (args, _context) => {
    const tone = args.trim().toLowerCase();

    if (!tone) {
      const list = Object.values(TONE_PROFILES)
        .map((p) => `  ${p.id.padEnd(10)} ${p.nameKo} \u2014 ${p.description}`)
        .join("\n");
      return {
        output: `Available tones:\n${list}\n\nUsage: /tone <name>`,
        success: true,
      };
    }

    const profile = TONE_PROFILES[tone];
    if (!profile) {
      const valid = Object.keys(TONE_PROFILES).join(", ");
      return {
        output: `Unknown tone: "${tone}". Valid: ${valid}`,
        success: false,
      };
    }

    return {
      output: `Tone set to: ${profile.nameKo} (${profile.name})`,
      success: true,
      refreshInstructions: true,
      newTone: tone,
    };
  },
};

import { TONE_PROFILES } from "../core/tone-profiles.js";
import { type SlashCommand } from "./registry.js";

/** /tone command — set response tone/style */
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

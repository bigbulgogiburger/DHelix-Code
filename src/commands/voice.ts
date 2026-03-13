import { checkSoxInstalled } from "../voice/recorder.js";
import type { SlashCommand } from "./registry.js";

/**
 * /voice -- Toggle voice input mode (push-to-talk).
 * Requires SoX for recording and OPENAI_API_KEY for Whisper transcription.
 */
export const voiceCommand: SlashCommand = {
  name: "voice",
  description: "Toggle voice input mode (push-to-talk)",
  usage: "/voice [on|off]",
  execute: async (args, _context) => {
    const toggle = args.trim().toLowerCase();

    if (toggle === "off") {
      return { output: "Voice input disabled.", success: true };
    }

    const soxInstalled = await checkSoxInstalled();
    if (!soxInstalled) {
      return {
        output: [
          "Voice input requires SoX to be installed.",
          "",
          "Install:",
          "  macOS:   brew install sox",
          "  Ubuntu:  sudo apt install sox",
          "  Windows: choco install sox",
        ].join("\n"),
        success: false,
      };
    }

    if (!process.env.OPENAI_API_KEY) {
      return {
        output: "Voice transcription requires OPENAI_API_KEY for Whisper API.",
        success: false,
      };
    }

    return {
      output: "Voice input enabled. Press SPACE to start/stop recording.",
      success: true,
    };
  },
};

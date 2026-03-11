import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { CONFIG_DIR, APP_NAME } from "../constants.js";

/** Available model presets */
const MODEL_PRESETS = [
  {
    name: "GPT-5-mini (추천 — 저렴하고 고성능)",
    model: "gpt-5-mini",
    baseUrl: "https://api.openai.com/v1",
  },
  { name: "GPT-4.1", model: "gpt-4.1", baseUrl: "https://api.openai.com/v1" },
  { name: "GPT-4.1-nano (가장 저렴)", model: "gpt-4.1-nano", baseUrl: "https://api.openai.com/v1" },
  { name: "GPT-4o", model: "gpt-4o", baseUrl: "https://api.openai.com/v1" },
  { name: "GPT-4o-mini", model: "gpt-4o-mini", baseUrl: "https://api.openai.com/v1" },
] as const;

/** User config file path */
const CONFIG_PATH = join(CONFIG_DIR, "config.json");

/** Saved configuration */
interface SetupConfig {
  readonly llm: {
    readonly model: string;
    readonly baseUrl: string;
    readonly apiKey?: string;
  };
}

/**
 * Check if the setup wizard needs to run.
 * Returns true if there's no API key configured via env or config file.
 */
export async function needsSetup(): Promise<boolean> {
  // If env vars provide an API key, no setup needed
  if (process.env.OPENAI_API_KEY || process.env.DBCODE_API_KEY) {
    return false;
  }

  // Check if config file exists with an API key
  try {
    await access(CONFIG_PATH);
    const raw = await readFile(CONFIG_PATH, "utf-8");
    const config = JSON.parse(raw) as { llm?: { apiKey?: string } };
    if (config.llm?.apiKey) {
      return false;
    }
  } catch {
    // Config doesn't exist — needs setup
  }

  return true;
}

/**
 * Run the interactive setup wizard.
 * Prompts for model choice and API key, saves to ~/.dbcode/config.json.
 */
export async function runSetupWizard(): Promise<SetupConfig> {
  const rl = createInterface({ input: stdin, output: stdout });

  try {
    stdout.write(`\n  Welcome to ${APP_NAME}! Let's get you set up.\n\n`);

    // Model selection
    stdout.write("  Choose a model:\n");
    for (let i = 0; i < MODEL_PRESETS.length; i++) {
      stdout.write(`    ${i + 1}. ${MODEL_PRESETS[i].name}\n`);
    }
    stdout.write(`    ${MODEL_PRESETS.length + 1}. Custom (enter model name + base URL)\n\n`);

    const choiceStr = await rl.question(`  Select [1-${MODEL_PRESETS.length + 1}]: `);
    const choice = parseInt(choiceStr, 10);

    let model: string;
    let baseUrl: string;

    if (choice >= 1 && choice <= MODEL_PRESETS.length) {
      const preset = MODEL_PRESETS[choice - 1];
      model = preset.model;
      baseUrl = preset.baseUrl;
      stdout.write(`  Selected: ${preset.name}\n\n`);
    } else {
      model = (await rl.question("  Model name: ")).trim() || "gpt-5-mini";
      baseUrl = (await rl.question("  API base URL: ")).trim() || "https://api.openai.com/v1";
      stdout.write("\n");
    }

    // API key
    stdout.write("  Authentication:\n");
    stdout.write("    1. Enter API key now\n");
    stdout.write("    2. Use OPENAI_API_KEY environment variable (set it later)\n\n");

    const authChoice = await rl.question("  Select [1-2]: ");

    let apiKey: string | undefined;
    if (authChoice.trim() === "1") {
      apiKey = (await rl.question("  API key: ")).trim();
      if (!apiKey) {
        stdout.write("  No key entered. You can set OPENAI_API_KEY env var later.\n");
      }
    } else {
      stdout.write("  OK. Set OPENAI_API_KEY before running dbcode.\n");
    }

    const config: SetupConfig = {
      llm: {
        model,
        baseUrl,
        ...(apiKey ? { apiKey } : {}),
      },
    };

    // Save config
    await mkdir(CONFIG_DIR, { recursive: true });

    // Merge with existing config if present
    let existing: Record<string, unknown> = {};
    try {
      const raw = await readFile(CONFIG_PATH, "utf-8");
      existing = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      // No existing config
    }

    const merged = { ...existing, llm: { ...((existing.llm as object) ?? {}), ...config.llm } };
    await writeFile(CONFIG_PATH, JSON.stringify(merged, null, 2) + "\n", "utf-8");

    stdout.write(`\n  Config saved to ${CONFIG_PATH}\n`);
    stdout.write(`  Run \`${APP_NAME}\` to start coding!\n\n`);

    return config;
  } finally {
    rl.close();
  }
}

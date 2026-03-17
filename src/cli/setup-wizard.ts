/**
 * setup-wizard.ts — 초기 설정 마법사
 *
 * dbcode를 처음 실행할 때 API 키와 모델을 설정하는 대화형 마법사입니다.
 * 환경변수(OPENAI_API_KEY)나 설정 파일(~/.dbcode/config.json)에
 * API 키가 없으면 자동으로 실행됩니다.
 *
 * 설정 흐름:
 * 1. 모델 선택 (프리셋 또는 커스텀)
 * 2. API 키 입력 (직접 입력 또는 환경변수 사용)
 * 3. ~/.dbcode/config.json에 설정 저장
 */
import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { CONFIG_DIR, APP_NAME, DEFAULT_MODEL } from "../constants.js";

/** 미리 정의된 모델 프리셋 목록 — 사용자가 번호로 선택할 수 있음 */
const MODEL_PRESETS = [
  { name: `Default (env: ${DEFAULT_MODEL})`, model: "", baseUrl: "" },
  // OpenAI
  { name: "GPT-4o-mini (저렴)", model: "gpt-4o-mini", baseUrl: "https://api.openai.com/v1" },
  { name: "GPT-4o", model: "gpt-4o", baseUrl: "https://api.openai.com/v1" },
  // Anthropic
  {
    name: "Claude Sonnet 4.5",
    model: "claude-sonnet-4-5-20250514",
    baseUrl: "https://api.anthropic.com/v1",
  },
  {
    name: "Claude Haiku 3.5",
    model: "claude-3-5-haiku-20241022",
    baseUrl: "https://api.anthropic.com/v1",
  },
  // Local (Ollama)
  { name: "Ollama (로컬 모델)", model: "qwen3:8b", baseUrl: "http://localhost:11434/v1" },
] as const;

/** 사용자 설정 파일 경로 (~/.dbcode/config.json) */
const CONFIG_PATH = join(CONFIG_DIR, "config.json");

/** 설정 마법사에서 저장하는 구성 데이터 */
interface SetupConfig {
  readonly llm: {
    readonly model?: string;
    readonly baseUrl?: string;
    readonly apiKey?: string;
  };
}

/**
 * 설정 마법사 실행이 필요한지 확인합니다.
 *
 * 다음 조건 중 하나라도 만족하면 false(설정 불필요):
 * - OPENAI_API_KEY 또는 DBCODE_API_KEY 환경변수가 설정되어 있음
 * - ~/.dbcode/config.json에 apiKey가 저장되어 있음
 *
 * 모두 해당하지 않으면 true(설정 필요)를 반환합니다.
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
 * 대화형 설정 마법사를 실행합니다.
 *
 * 터미널에서 readline 인터페이스를 통해 사용자에게 모델과 API 키를 묻고,
 * 결과를 ~/.dbcode/config.json에 저장합니다.
 * 기존 설정 파일이 있으면 병합(merge)하여 기존 값을 보존합니다.
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
      model = (await rl.question(`  Model name [${DEFAULT_MODEL}]: `)).trim() || DEFAULT_MODEL;
      baseUrl =
        (await rl.question("  API base URL [https://api.openai.com/v1]: ")).trim() ||
        "https://api.openai.com/v1";
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
        ...(model ? { model } : {}),
        ...(baseUrl ? { baseUrl } : {}),
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

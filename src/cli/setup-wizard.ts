/**
 * setup-wizard.ts — 초기 설정 마법사
 *
 * dhelix를 처음 실행할 때 API 키와 모델을 설정하는 대화형 마법사입니다.
 * 다음 조건 중 하나라도 충족되면 마법사를 건너뜁니다:
 * - LOCAL_API_BASE_URL 또는 LOCAL_API_KEY 환경변수 설정됨 (로컬 LLM)
 * - OPENAI_API_KEY, DHELIX_API_KEY, ANTHROPIC_API_KEY 환경변수 설정됨
 * - ~/.dhelix/config.json에 apiKey 또는 baseUrl이 저장되어 있음
 */
import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { CONFIG_DIR, APP_NAME, DEFAULT_MODEL } from "../constants.js";

/** 미리 정의된 모델 프리셋 목록 */
const CLOUD_PRESETS = [
  { name: "GPT-4o-mini (저렴)", model: "gpt-4o-mini", baseUrl: "https://api.openai.com/v1" },
  { name: "GPT-4o", model: "gpt-4o", baseUrl: "https://api.openai.com/v1" },
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
] as const;

const LOCAL_PRESETS = [
  { name: "Ollama (localhost:11434)", model: "qwen3:8b", baseUrl: "http://localhost:11434/v1" },
  {
    name: "LM Studio (localhost:1234)",
    model: "local-model",
    baseUrl: "http://localhost:1234/v1",
  },
  { name: "Custom endpoint (URL 직접 입력)", model: "", baseUrl: "" },
] as const;

/** 사용자 설정 파일 경로 (~/.dhelix/config.json) */
const CONFIG_PATH = join(CONFIG_DIR, "config.json");

/** 설정 마법사에서 저장하는 구성 데이터 */
interface SetupConfig {
  readonly llm: {
    readonly model?: string;
    readonly baseUrl?: string;
    readonly apiKey?: string;
    readonly apiKeyHeader?: string;
  };
}

/**
 * 현재 환경에서 감지된 LOCAL LLM 설정을 반환합니다.
 * LOCAL_API_BASE_URL 또는 LOCAL_API_KEY가 있으면 로컬 설정으로 간주합니다.
 */
function detectLocalConfig(): {
  baseUrl?: string;
  model?: string;
  apiKey?: string;
  apiKeyHeader?: string;
} | null {
  const baseUrl = process.env.LOCAL_API_BASE_URL;
  const model = process.env.LOCAL_MODEL;
  const apiKey = process.env.LOCAL_API_KEY;
  const apiKeyHeader = process.env.LOCAL_API_KEY_HEADER;

  if (baseUrl || apiKey) {
    return { baseUrl, model, apiKey, apiKeyHeader };
  }
  return null;
}

/**
 * 설정 마법사 실행이 필요한지 확인합니다.
 */
export async function needsSetup(): Promise<boolean> {
  // 로컬 LLM 환경변수로 설정된 경우
  if (process.env.LOCAL_API_BASE_URL || process.env.LOCAL_API_KEY) {
    return false;
  }

  // 클라우드 API 키가 있는 경우
  if (
    process.env.OPENAI_API_KEY ||
    process.env.DHELIX_API_KEY ||
    process.env.ANTHROPIC_API_KEY
  ) {
    return false;
  }

  // config.json에 apiKey 또는 baseUrl이 저장된 경우
  try {
    await access(CONFIG_PATH);
    const raw = await readFile(CONFIG_PATH, "utf-8");
    const config = JSON.parse(raw) as { llm?: { apiKey?: string; baseUrl?: string } };
    if (config.llm?.apiKey || config.llm?.baseUrl) {
      return false;
    }
  } catch {
    // 파일 없음 — 설정 필요
  }

  return true;
}

/**
 * 대화형 설정 마법사를 실행합니다.
 */
export async function runSetupWizard(): Promise<SetupConfig> {
  const rl = createInterface({ input: stdin, output: stdout });

  try {
    stdout.write(`\n  Welcome to ${APP_NAME}! Let's get you set up.\n\n`);

    // ── 현재 LOCAL 설정 감지 및 표시 ──────────────────────────────
    const localDetected = detectLocalConfig();
    if (localDetected) {
      stdout.write(`  ✓ Local LLM detected from environment:\n`);
      if (localDetected.baseUrl)
        stdout.write(`      BASE URL   : ${localDetected.baseUrl}\n`);
      if (localDetected.model)
        stdout.write(`      MODEL      : ${localDetected.model}\n`);
      if (localDetected.apiKeyHeader)
        stdout.write(`      AUTH HEADER: ${localDetected.apiKeyHeader}\n`);
      if (localDetected.apiKey)
        stdout.write(`      API KEY    : ${localDetected.apiKey.slice(0, 6)}...(set)\n`);
      stdout.write(`\n  Use these settings? [Y/n]: `);

      const confirm = (await rl.question("")).trim().toLowerCase();
      if (confirm !== "n") {
        const config: SetupConfig = {
          llm: {
            ...(localDetected.model ? { model: localDetected.model } : {}),
            ...(localDetected.baseUrl ? { baseUrl: localDetected.baseUrl } : {}),
            ...(localDetected.apiKey ? { apiKey: localDetected.apiKey } : {}),
            ...(localDetected.apiKeyHeader
              ? { apiKeyHeader: localDetected.apiKeyHeader }
              : {}),
          },
        };
        await saveConfig(config);
        return config;
      }
      stdout.write("\n");
    }

    // ── 제공자 선택 ────────────────────────────────────────────────
    stdout.write("  Provider:\n");
    stdout.write("    1. Cloud (OpenAI / Anthropic)\n");
    stdout.write("    2. Local LLM (Ollama / LM Studio / Custom)\n\n");

    const providerChoice = (await rl.question("  Select [1-2]: ")).trim();
    const isLocal = providerChoice === "2";
    stdout.write("\n");

    let model = "";
    let baseUrl = "";
    let apiKey: string | undefined;
    let apiKeyHeader: string | undefined;

    if (isLocal) {
      // ── 로컬 LLM 플로우 ────────────────────────────────────────
      stdout.write("  Local LLM:\n");
      for (let i = 0; i < LOCAL_PRESETS.length; i++) {
        stdout.write(`    ${i + 1}. ${LOCAL_PRESETS[i].name}\n`);
      }
      stdout.write("\n");

      const localChoice = parseInt((await rl.question(`  Select [1-${LOCAL_PRESETS.length}]: `)).trim(), 10);
      stdout.write("\n");

      if (localChoice >= 1 && localChoice < LOCAL_PRESETS.length) {
        const preset = LOCAL_PRESETS[localChoice - 1];
        model = preset.model;
        baseUrl = preset.baseUrl;
        stdout.write(`  Using: ${preset.baseUrl}\n\n`);
      } else {
        // Custom endpoint
        baseUrl = (await rl.question("  Base URL (예: https://models.example.com/v1): ")).trim();
        model = (await rl.question(`  Model name: `)).trim();
        stdout.write("\n");
      }

      // 인증 방식
      stdout.write("  Authentication:\n");
      stdout.write("    1. No auth (로컬 서버, 키 없음)\n");
      stdout.write("    2. API key — Authorization: Bearer <key>\n");
      stdout.write("    3. Custom header — 예: model-api-key: <key>\n\n");

      const authChoice = (await rl.question("  Select [1-3]: ")).trim();
      stdout.write("\n");

      if (authChoice === "2") {
        apiKey = (await rl.question("  API key: ")).trim() || undefined;
      } else if (authChoice === "3") {
        apiKeyHeader = (await rl.question("  Header name (예: model-api-key): ")).trim() || undefined;
        apiKey = (await rl.question("  API key value: ")).trim() || undefined;
      }
      // authChoice === "1" → no key needed
    } else {
      // ── 클라우드 플로우 ────────────────────────────────────────
      stdout.write("  Model:\n");
      for (let i = 0; i < CLOUD_PRESETS.length; i++) {
        stdout.write(`    ${i + 1}. ${CLOUD_PRESETS[i].name}\n`);
      }
      stdout.write(`    ${CLOUD_PRESETS.length + 1}. Custom (직접 입력)\n\n`);

      const modelChoice = parseInt((await rl.question(`  Select [1-${CLOUD_PRESETS.length + 1}]: `)).trim(), 10);
      stdout.write("\n");

      if (modelChoice >= 1 && modelChoice <= CLOUD_PRESETS.length) {
        const preset = CLOUD_PRESETS[modelChoice - 1];
        model = preset.model;
        baseUrl = preset.baseUrl;
      } else {
        model = (await rl.question(`  Model name [${DEFAULT_MODEL}]: `)).trim() || DEFAULT_MODEL;
        baseUrl =
          (await rl.question("  Base URL [https://api.openai.com/v1]: ")).trim() ||
          "https://api.openai.com/v1";
        stdout.write("\n");
      }

      // API key
      stdout.write("  Authentication:\n");
      stdout.write("    1. Enter API key now\n");
      stdout.write("    2. Set env var later (OPENAI_API_KEY / ANTHROPIC_API_KEY)\n\n");

      const authChoice = (await rl.question("  Select [1-2]: ")).trim();
      stdout.write("\n");

      if (authChoice === "1") {
        apiKey = (await rl.question("  API key: ")).trim() || undefined;
        if (!apiKey) {
          stdout.write("  No key entered. Set OPENAI_API_KEY or ANTHROPIC_API_KEY before running.\n\n");
        }
      } else {
        stdout.write("  OK. Set the appropriate env var before running dhelix.\n\n");
      }
    }

    const config: SetupConfig = {
      llm: {
        ...(model ? { model } : {}),
        ...(baseUrl ? { baseUrl } : {}),
        ...(apiKey ? { apiKey } : {}),
        ...(apiKeyHeader ? { apiKeyHeader } : {}),
      },
    };

    await saveConfig(config);
    return config;
  } finally {
    rl.close();
  }
}

async function saveConfig(config: SetupConfig): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });

  let existing: Record<string, unknown> = {};
  try {
    const raw = await readFile(CONFIG_PATH, "utf-8");
    existing = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    // 기존 파일 없음
  }

  const merged = { ...existing, llm: { ...((existing.llm as object) ?? {}), ...config.llm } };
  await writeFile(CONFIG_PATH, JSON.stringify(merged, null, 2) + "\n", "utf-8");

  stdout.write(`  Config saved to ${CONFIG_PATH}\n`);
  stdout.write(`  Run \`${APP_NAME}\` to start coding!\n\n`);
}

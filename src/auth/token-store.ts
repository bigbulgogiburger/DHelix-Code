import { readFile, writeFile, mkdir } from "node:fs/promises";
import { type TokenConfig, type ResolvedToken } from "./types.js";
import { joinPath } from "../utils/path.js";
import { CONFIG_DIR } from "../constants.js";
import { AuthError } from "../utils/error.js";

const TOKEN_FILE = joinPath(CONFIG_DIR, "credentials.json");

/**
 * Load token from environment variables.
 * Checks: DBCODE_API_KEY, OPENAI_API_KEY
 */
function loadFromEnv(): TokenConfig | undefined {
  const apiKey = process.env.DBCODE_API_KEY || process.env.OPENAI_API_KEY;
  if (apiKey) {
    return { method: "bearer", token: apiKey };
  }
  return undefined;
}

/**
 * Load token from credentials file (~/.dbcode/credentials.json).
 */
async function loadFromFile(): Promise<TokenConfig | undefined> {
  try {
    const content = await readFile(TOKEN_FILE, "utf-8");
    const data = JSON.parse(content) as Record<string, unknown>;
    if (typeof data.token === "string" && data.token.length > 0) {
      return {
        method: (data.method as TokenConfig["method"]) ?? "bearer",
        token: data.token,
        headerName: typeof data.headerName === "string" ? data.headerName : undefined,
      };
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Resolve API token from available sources (priority: env > file).
 */
export async function resolveToken(): Promise<ResolvedToken | undefined> {
  // Priority 1: Environment variable
  const envToken = loadFromEnv();
  if (envToken) {
    return { config: envToken, source: "environment" };
  }

  // Priority 2: Credentials file
  const fileToken = await loadFromFile();
  if (fileToken) {
    return { config: fileToken, source: "file" };
  }

  return undefined;
}

/**
 * Save token to credentials file.
 */
export async function saveToken(config: TokenConfig): Promise<void> {
  try {
    await mkdir(CONFIG_DIR, { recursive: true });
    const data = JSON.stringify(
      {
        method: config.method,
        token: config.token,
        headerName: config.headerName,
      },
      null,
      2,
    );
    await writeFile(TOKEN_FILE, data, { mode: 0o600 });
  } catch (error) {
    throw new AuthError("Failed to save token", {
      path: TOKEN_FILE,
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}

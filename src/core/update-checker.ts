import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { APP_NAME } from "../constants.js";

/**
 * Information about an available update.
 */
export interface UpdateInfo {
  readonly current: string;
  readonly latest: string;
  readonly updateCommand: string;
}

/** Interval between update checks (7 days in ms) */
const CHECK_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

/** Path to the update check state file */
function getStateFilePath(): string {
  return join(homedir(), `.${APP_NAME}`, "update-check.json");
}

/** Persisted state for update checks */
interface UpdateCheckState {
  readonly lastCheckTimestamp: number;
  readonly latestVersion: string | null;
}

/**
 * Read the persisted update check state.
 * Returns null if the state file doesn't exist or is corrupted.
 */
async function readState(): Promise<UpdateCheckState | null> {
  try {
    const raw = await readFile(getStateFilePath(), "utf-8");
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "lastCheckTimestamp" in parsed &&
      typeof (parsed as Record<string, unknown>).lastCheckTimestamp === "number"
    ) {
      return parsed as UpdateCheckState;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Persist the update check state to disk.
 */
async function writeState(state: UpdateCheckState): Promise<void> {
  const filePath = getStateFilePath();
  const dir = join(homedir(), `.${APP_NAME}`);
  await mkdir(dir, { recursive: true });
  await writeFile(filePath, JSON.stringify(state, null, 2), "utf-8");
}

/**
 * Fetch the latest version from the npm registry.
 * Non-blocking with a short timeout to avoid impacting startup.
 */
async function fetchLatestVersion(): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);

    const response = await fetch(
      `https://registry.npmjs.org/${APP_NAME}/latest`,
      { signal: controller.signal },
    );
    clearTimeout(timeout);

    if (!response.ok) return null;

    const data: unknown = await response.json();
    if (
      typeof data === "object" &&
      data !== null &&
      "version" in data &&
      typeof (data as Record<string, unknown>).version === "string"
    ) {
      return (data as Record<string, unknown>).version as string;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Compare two semver version strings.
 * Returns true if `latest` is newer than `current`.
 */
export function isNewerVersion(current: string, latest: string): boolean {
  const parseSemver = (v: string): readonly number[] =>
    v
      .replace(/^v/, "")
      .split(".")
      .map((s) => parseInt(s, 10) || 0);

  const currentParts = parseSemver(current);
  const latestParts = parseSemver(latest);

  for (let i = 0; i < 3; i++) {
    const c = currentParts[i] ?? 0;
    const l = latestParts[i] ?? 0;
    if (l > c) return true;
    if (l < c) return false;
  }
  return false;
}

/**
 * Check for available updates on npm.
 *
 * Performs a weekly background check (non-blocking, stores last check timestamp).
 * Returns UpdateInfo if a newer version is available, null otherwise.
 *
 * @param currentVersion - The currently installed version (e.g., "0.1.0")
 */
export async function checkForUpdates(
  currentVersion: string,
): Promise<UpdateInfo | null> {
  // Check if we recently checked
  const state = await readState();
  const now = Date.now();

  if (state && now - state.lastCheckTimestamp < CHECK_INTERVAL_MS) {
    // Use cached result if available
    if (
      state.latestVersion &&
      isNewerVersion(currentVersion, state.latestVersion)
    ) {
      return {
        current: currentVersion,
        latest: state.latestVersion,
        updateCommand: `npm install -g ${APP_NAME}@latest`,
      };
    }
    return null;
  }

  // Perform fresh check
  const latest = await fetchLatestVersion();

  // Persist the check result
  await writeState({
    lastCheckTimestamp: now,
    latestVersion: latest,
  }).catch(() => {
    // Non-critical — ignore write failures
  });

  if (!latest) return null;

  if (isNewerVersion(currentVersion, latest)) {
    return {
      current: currentVersion,
      latest,
      updateCommand: `npm install -g ${APP_NAME}@latest`,
    };
  }

  return null;
}

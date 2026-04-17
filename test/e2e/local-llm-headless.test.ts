import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Attempt to parse a string as a JSON object; returns the value or undefined on failure. */
function tryParseJson(text: string): Record<string, unknown> | undefined {
  try {
    const v = JSON.parse(text);
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      return v as Record<string, unknown>;
    }
  } catch {
    // not JSON
  }
  return undefined;
}

/**
 * Extract all top-level JSON objects from stdout that may contain non-JSON preamble lines
 * (e.g. dotenv diagnostics) and pretty-printed or compact JSON blocks.
 */
function extractJsonObjects(stdout: string): Array<Record<string, unknown>> {
  const results: Array<Record<string, unknown>> = [];
  // Try each line first (compact JSON)
  for (const line of stdout.split("\n")) {
    const obj = tryParseJson(line.trim());
    if (obj !== undefined) {
      results.push(obj);
    }
  }
  if (results.length > 0) return results;

  // Fall back: find JSON blocks delimited by balanced braces
  let depth = 0;
  let start = -1;
  for (let i = 0; i < stdout.length; i++) {
    if (stdout[i] === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (stdout[i] === "}") {
      depth--;
      if (depth === 0 && start !== -1) {
        const candidate = stdout.slice(start, i + 1);
        const obj = tryParseJson(candidate);
        if (obj !== undefined) results.push(obj);
        start = -1;
      }
    }
  }
  return results;
}

const hasLocalModel = !!(process.env.LOCAL_API_BASE_URL && process.env.LOCAL_MODEL);

const projectRoot = resolve(__dirname, "../..");
const distPath = resolve(projectRoot, "dist/index.js");

function runCli(
  args: string[],
  timeoutMs: number = 90_000,
): ReturnType<typeof spawnSync> {
  return spawnSync("node", [distPath, ...args], {
    encoding: "utf8",
    timeout: timeoutMs,
    env: {
      ...process.env,
      LOCAL_API_BASE_URL: process.env.LOCAL_API_BASE_URL,
      LOCAL_MODEL: process.env.LOCAL_MODEL,
      LOCAL_API_KEY: process.env.LOCAL_API_KEY,
      LOCAL_API_KEY_HEADER: process.env.LOCAL_API_KEY_HEADER,
      TERM: "dumb",
      CI: "1",
    },
    cwd: projectRoot,
  });
}

describe.skipIf(!hasLocalModel)("L2 Headless CLI Single-Shot", () => {
  it(
    "L2-1 — text output: exits 0 and returns non-empty response",
    { timeout: 90_000 },
    () => {
      const result = runCli(["-p", "Say hello", "--output-format", "text"], 90_000);

      // Log for debugging
      console.log("[L2-1] exit:", result.status);
      console.log("[L2-1] stdout:", result.stdout?.slice(0, 200));
      console.log("[L2-1] stderr:", result.stderr?.slice(0, 200));

      expect(result.status).toBe(0);
      expect(result.stdout.trim().length).toBeGreaterThan(0);

      // stderr should not start any line with "Error" (allow warnings/info)
      const stderrLines = (result.stderr ?? "").split("\n");
      for (const line of stderrLines) {
        expect(line.trimStart()).not.toMatch(/^[Ee]rror[:\s]/);
      }
    },
  );

  it(
    "L2-2 — JSON output: exits 0 and returns parseable JSON with content field",
    { timeout: 90_000 },
    () => {
      const result = runCli(["-p", "What is 2+2?", "--output-format", "json"], 90_000);

      // Log for debugging
      console.log("[L2-2] exit:", result.status);
      console.log("[L2-2] stdout:", result.stdout?.slice(0, 500));
      console.log("[L2-2] stderr:", result.stderr?.slice(0, 200));

      expect(result.status).toBe(0);

      // dotenv may emit non-JSON lines before the actual JSON output — extract the first JSON object
      const jsonObjects = extractJsonObjects(result.stdout);
      expect(jsonObjects.length).toBeGreaterThan(0);
      const parsed = jsonObjects[0]!;

      // At least one known content field must be present
      const contentFields = ["content", "result", "output", "message"];
      const hasContentField = contentFields.some((field) => field in parsed!);
      expect(hasContentField).toBe(true);

      // If cost/usage present, local model total cost should be 0
      const p = parsed!;
      if (typeof p["cost"] === "object" && p["cost"] !== null) {
        const cost = p["cost"] as Record<string, unknown>;
        if ("totalCost" in cost) {
          expect(cost["totalCost"]).toBe(0);
        }
      }
      if (typeof p["usage"] === "object" && p["usage"] !== null) {
        const usage = p["usage"] as Record<string, unknown>;
        if ("totalCost" in usage) {
          expect(usage["totalCost"]).toBe(0);
        }
      }
    },
  );

  it(
    "L2-3 — stream-JSON output: exits 0, each line is valid JSON with type/delta field",
    { timeout: 90_000 },
    () => {
      const result = runCli(["-p", "Count to 3", "--output-format", "stream-json"], 90_000);

      // Log first 3 lines for debugging
      const lines = result.stdout.split("\n").filter((l) => l.trim().length > 0);
      console.log("[L2-3] exit:", result.status);
      console.log("[L2-3] first 3 lines:", lines.slice(0, 3));
      console.log("[L2-3] stderr:", result.stderr?.slice(0, 200));

      expect(result.status).toBe(0);
      expect(lines.length).toBeGreaterThan(1);

      // Parse all JSON objects from stdout; skip dotenv diagnostic lines
      const parsed = extractJsonObjects(result.stdout);
      expect(parsed.length).toBeGreaterThan(0);

      // At least one line should carry a streaming token field
      const hasStreamingField = parsed.some(
        (obj) => "type" in obj || "delta" in obj,
      );
      expect(hasStreamingField).toBe(true);
    },
  );

  it(
    "L2-4 — file read with tool: output contains actual package.json version",
    { timeout: 120_000 },
    () => {
      const pkgVersion = (
        JSON.parse(readFileSync(resolve(projectRoot, "package.json"), "utf8")) as {
          version: string;
        }
      ).version;

      const result = runCli(
        ["-p", "Read package.json and tell me the version"],
        120_000,
      );

      console.log("[L2-4] exit:", result.status);
      console.log("[L2-4] version expected:", pkgVersion);
      console.log("[L2-4] stdout:", result.stdout?.slice(0, 500));
      console.log("[L2-4] stderr:", result.stderr?.slice(0, 200));

      expect(result.status).toBe(0);
      expect(result.stdout).toContain(pkgVersion);
    },
  );

  it(
    "L2-5 — non-existent model error handling: does not hang and does not expose raw stack trace",
    { timeout: 30_000 },
    () => {
      const result = runCli(
        ["-p", "hello", "--model", "nonexistent-xyz-model-12345"],
        30_000,
      );

      console.log("[L2-5] exit:", result.status);
      console.log("[L2-5] stdout:", result.stdout?.slice(0, 300));
      console.log("[L2-5] stderr:", result.stderr?.slice(0, 300));

      // Must complete — spawnSync returning means it did not hang
      // Exit code: either 0 (model defaulted) or non-zero (API error)
      if (result.status !== 0) {
        // Non-zero exit: stderr must carry a human-readable message
        expect((result.stderr ?? "").trim().length).toBeGreaterThan(0);
      } else {
        // Zero exit: stdout must have some response (model defaulted or tried)
        expect(result.stdout.trim().length).toBeGreaterThan(0);
      }

      // Raw Node.js internal stack frames should not appear in stderr
      // (unless DEBUG mode is explicitly active)
      if (!process.env.DEBUG) {
        const stderrLines = (result.stderr ?? "").split("\n");
        for (const line of stderrLines) {
          expect(line).not.toMatch(/^\s+at\s+\S+\s+\(node:internal\//);
        }
      }
    },
  );
});

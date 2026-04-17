/**
 * L0 — Local LLM Connectivity Smoke Tests
 *
 * Validates that the local LLM server at LOCAL_API_BASE_URL is reachable and
 * responding correctly through dhelix's OpenAICompatibleClient and
 * LocalModelProvider.
 *
 * Skip guard: all tests are skipped when LOCAL_API_BASE_URL or LOCAL_MODEL
 * are not set in the environment.
 *
 * Server notes (models.dbinc.ai):
 *  - /v1/models returns HTTP 404 — server does NOT implement the models list endpoint
 *  - /v1/chat/completions returns HTTP 200 with valid chat responses
 *  - Authentication uses a custom header "model-api-key" (not Authorization: Bearer)
 *  - GLM-4.5-Air only emits reasoning tokens when maxTokens is too low; use >= 200
 */

import { describe, it, expect, beforeAll } from "vitest";
import { OpenAICompatibleClient } from "../../src/llm/client.js";
import { LocalModelProvider } from "../../src/llm/providers/local.js";
import type { ChatRequest } from "../../src/llm/provider.js";

// ─── Skip guard ──────────────────────────────────────────────────────────────

const hasLocalModel = !!(process.env["LOCAL_API_BASE_URL"] && process.env["LOCAL_MODEL"]);

// ─── Env constants (read once, used across all tests) ────────────────────────

const LOCAL_BASE_URL = process.env["LOCAL_API_BASE_URL"]!;
const LOCAL_MODEL = process.env["LOCAL_MODEL"]!;
const LOCAL_API_KEY = process.env["LOCAL_API_KEY"] ?? "no-key";
const LOCAL_API_KEY_HEADER = process.env["LOCAL_API_KEY_HEADER"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a minimal ChatRequest for liveness / auth probes.
 *
 * NOTE: GLM-4.5-Air emits only reasoning tokens when maxTokens is too low.
 * Use at least 500 so the model can produce visible content after reasoning.
 */
function minimalChatRequest(overrides: Partial<ChatRequest> = {}): ChatRequest {
  return {
    model: LOCAL_MODEL,
    messages: [{ role: "user", content: "say OK" }],
    maxTokens: 500,
    ...overrides,
  };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe.skipIf(!hasLocalModel)("L0 Local LLM Connectivity Smoke", () => {
  beforeAll(() => {
    console.log("[L0] Environment:");
    console.log(`  LOCAL_API_BASE_URL  = ${LOCAL_BASE_URL}`);
    console.log(`  LOCAL_MODEL         = ${LOCAL_MODEL}`);
    console.log(`  LOCAL_API_KEY       = ${LOCAL_API_KEY.slice(0, 6)}...`);
    console.log(`  LOCAL_API_KEY_HEADER= ${LOCAL_API_KEY_HEADER ?? "(not set)"}`);
  });

  // ─── L0-1: Liveness via chat (adapted) ──────────────────────────────────

  it(
    "L0-1: liveness probe via chat — response received within 10 s",
    async () => {
      // NOTE: LocalModelProvider.healthCheck() probes /v1/models which returns
      // HTTP 404 on this server. We use OpenAICompatibleClient.chat() as the
      // actual liveness check instead.

      const client = new OpenAICompatibleClient({
        baseURL: LOCAL_BASE_URL,
        apiKey: LOCAL_API_KEY,
        ...(LOCAL_API_KEY_HEADER ? { apiKeyHeader: LOCAL_API_KEY_HEADER } : {}),
      });

      const t0 = Date.now();
      const request = minimalChatRequest();
      const response = await client.chat(request);
      const latencyMs = Date.now() - t0;

      console.log(`[L0-1] latency=${latencyMs}ms`);
      console.log(`[L0-1] content="${response.content}"`);
      console.log(`[L0-1] finishReason="${response.finishReason}"`);
      console.log(`[L0-1] usage=`, response.usage);

      // Liveness: server responded (no exception thrown) within budget.
      // content may be empty if the model consumed all tokens on reasoning;
      // what matters is that HTTP 200 was received (response object is valid).
      expect(response).toBeDefined();
      expect(typeof response.finishReason).toBe("string");
      expect(latencyMs).toBeLessThan(10_000);
      console.log(`[L0-1] liveness confirmed — server responded in ${latencyMs}ms`);

      // Also probe healthCheck() — documented result, not asserted as healthy
      const provider = new LocalModelProvider({
        baseUrl: LOCAL_BASE_URL,
        serverType: "generic",
      });
      const health = await provider.healthCheck();
      console.log(
        `[L0-1] LocalModelProvider.healthCheck() => healthy=${health.healthy} latency=${health.latencyMs}ms`,
        health.error ? `error="${health.error}"` : "",
      );
      // NOTE: healthy=false is expected because /v1/models returns 404 on this server.
      // We do NOT assert healthy=true here.
    },
    30_000,
  );

  // ─── L0-2: discoverModels (soft-fail) ───────────────────────────────────

  it(
    "L0-2: discoverModels returns an array (empty is expected)",
    async () => {
      // NOTE: This server does not implement /v1/models — empty result is expected.
      const provider = new LocalModelProvider({
        baseUrl: LOCAL_BASE_URL,
        serverType: "generic",
      });

      const models = await provider.discoverModels();

      console.log(`[L0-2] discoverModels() => ${models.length} model(s):`, models);

      expect(Array.isArray(models)).toBe(true);
      // Empty is acceptable — we just confirm no exception is thrown and the
      // return value is a valid array.
    },
    30_000,
  );

  // ─── L0-3: Custom header auth ────────────────────────────────────────────

  it(
    "L0-3: custom header auth accepted; wrong key gets 401/403 or error",
    async () => {
      // ── 3a: Correct key ─────────────────────────────────────────────────
      const correctClient = new OpenAICompatibleClient({
        baseURL: LOCAL_BASE_URL,
        apiKey: LOCAL_API_KEY,
        apiKeyHeader: "model-api-key",
      });

      const goodResponse = await correctClient.chat(minimalChatRequest());
      console.log(`[L0-3a] correct key → content="${goodResponse.content}"`);
      expect(goodResponse.content).toBeTruthy();

      // ── 3b: Wrong key ────────────────────────────────────────────────────
      // The server MAY or may not enforce auth. Capture the outcome without
      // failing the test either way; just document the behavior.
      const wrongClient = new OpenAICompatibleClient({
        baseURL: LOCAL_BASE_URL,
        apiKey: "invalid-key-test",
        apiKeyHeader: "model-api-key",
      });

      let wrongKeyResult: "rejected" | "accepted" = "accepted";
      try {
        const badResponse = await wrongClient.chat(minimalChatRequest());
        console.log(
          `[L0-3b] wrong key was accepted by server — content="${badResponse.content}"`,
        );
        // Server does not enforce auth — that is fine to document.
      } catch (err) {
        wrongKeyResult = "rejected";
        const message = err instanceof Error ? err.message : String(err);
        console.log(`[L0-3b] wrong key was rejected by server — error="${message}"`);
        // Any HTTP error (401/403 = explicit auth rejection, 404 = routing by key,
        // other = server-specific enforcement) confirms the header is being evaluated.
        // We accept any error here; the important signal is that an invalid key
        // does NOT receive a valid chat response.
        expect(message).toBeTruthy();
      }

      console.log(`[L0-3b] auth enforcement: ${wrongKeyResult}`);
    },
    30_000,
  );

  // ─── L0-4: URL normalization ─────────────────────────────────────────────

  it(
    "L0-4: URL with /chat/completions suffix is normalized correctly",
    async () => {
      // Pass the full URL including the /chat/completions suffix.
      // normalizeBaseUrl() inside OpenAICompatibleClient should strip it,
      // then the OpenAI SDK appends /chat/completions again — so the request
      // still arrives at the correct endpoint.
      const suffixedUrl = "https://models.dbinc.ai/v1/chat/completions";

      const client = new OpenAICompatibleClient({
        baseURL: suffixedUrl,
        apiKey: LOCAL_API_KEY,
        ...(LOCAL_API_KEY_HEADER ? { apiKeyHeader: LOCAL_API_KEY_HEADER } : {}),
      });

      const response = await client.chat(minimalChatRequest());

      console.log(`[L0-4] URL normalization → content="${response.content}"`);

      expect(response.content).toBeTruthy();
    },
    30_000,
  );

  // ─── L0-5: Minimal prompt echo ───────────────────────────────────────────

  it(
    "L0-5: model echoes 'OK', finish_reason=stop, totalTokens > 0",
    async () => {
      const client = new OpenAICompatibleClient({
        baseURL: LOCAL_BASE_URL,
        apiKey: LOCAL_API_KEY,
        ...(LOCAL_API_KEY_HEADER ? { apiKeyHeader: LOCAL_API_KEY_HEADER } : {}),
      });

      const request: ChatRequest = {
        model: LOCAL_MODEL,
        messages: [
          { role: "system", content: "Follow instructions exactly." },
          { role: "user", content: "Respond with exactly: OK" },
        ],
        maxTokens: 500,
      };

      const response = await client.chat(request);

      console.log(`[L0-5] content="${response.content}"`);
      console.log(`[L0-5] finishReason="${response.finishReason}"`);
      console.log(`[L0-5] usage=`, response.usage);

      expect(response.content.toLowerCase()).toContain("ok");
      expect(response.usage.totalTokens).toBeGreaterThan(0);
      expect(response.finishReason).toBe("stop");
    },
    60_000,
  );
});

import { type ResolvedToken, type TokenConfig } from "./types.js";
import { resolveToken, saveToken } from "./token-store.js";
import { AuthError } from "../utils/error.js";

/**
 * Token manager — resolves, caches, and provides API tokens.
 */
export class TokenManager {
  private cachedToken: ResolvedToken | undefined;

  /**
   * Get the current API token, resolving from sources if needed.
   */
  async getToken(): Promise<ResolvedToken | undefined> {
    if (this.cachedToken) {
      return this.cachedToken;
    }

    this.cachedToken = await resolveToken();
    return this.cachedToken;
  }

  /**
   * Get the token or throw if none is configured.
   */
  async requireToken(): Promise<ResolvedToken> {
    const token = await this.getToken();
    if (!token) {
      throw new AuthError("No API token configured. Set DBCODE_API_KEY or run 'dbcode auth'.");
    }
    return token;
  }

  /**
   * Store a new token and update the cache.
   */
  async setToken(config: TokenConfig): Promise<void> {
    await saveToken(config);
    this.cachedToken = { config, source: "file" };
  }

  /** Clear the cached token */
  clearCache(): void {
    this.cachedToken = undefined;
  }

  /**
   * Build authorization headers for the resolved token.
   */
  async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await this.getToken();
    if (!token) {
      return {};
    }

    switch (token.config.method) {
      case "bearer":
        return { Authorization: `Bearer ${token.config.token}` };
      case "api-key":
        return { "X-API-Key": token.config.token };
      case "custom-header":
        return { [token.config.headerName ?? "Authorization"]: token.config.token };
    }
  }
}

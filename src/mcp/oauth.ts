/**
 * OAuth 2.0 authorization code flow for MCP servers.
 * Handles token acquisition, refresh, and persistent storage.
 */
import { createServer, type Server } from "node:http";
import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { BaseError } from "../utils/error.js";

/** OAuth-specific error */
export class MCPOAuthError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "MCP_OAUTH_ERROR", context);
  }
}

/** OAuth 2.0 configuration for an MCP server */
export interface MCPOAuthConfig {
  readonly clientId: string;
  readonly clientSecret?: string;
  readonly authorizationUrl: string;
  readonly tokenUrl: string;
  readonly scopes?: readonly string[];
  readonly redirectPort?: number;
}

/** Stored OAuth token */
export interface OAuthToken {
  readonly accessToken: string;
  readonly refreshToken?: string;
  readonly expiresAt?: number;
  readonly tokenType: string;
  readonly scope?: string;
}

/** Default port for the local OAuth callback server */
const DEFAULT_REDIRECT_PORT = 8912;

/** Buffer in ms before considering a token expired (60 seconds) */
const EXPIRY_BUFFER_MS = 60_000;

/** Timeout for waiting for the OAuth callback (5 minutes) */
const CALLBACK_TIMEOUT_MS = 300_000;

/** Token storage directory */
const TOKEN_STORAGE_DIR = join(homedir(), ".dbcode", "oauth-tokens");

/**
 * Manages OAuth 2.0 authorization flows for MCP servers.
 * Tokens are cached in memory and persisted to disk.
 */
export class MCPOAuthManager {
  private readonly tokens = new Map<string, OAuthToken>();

  /**
   * Start OAuth 2.0 authorization code flow for a server.
   * Opens a local HTTP server to receive the callback, then exchanges
   * the authorization code for tokens.
   */
  async authorize(serverName: string, config: MCPOAuthConfig): Promise<OAuthToken> {
    const state = randomUUID();
    const port = config.redirectPort ?? DEFAULT_REDIRECT_PORT;
    const redirectUri = `http://localhost:${port}/callback`;

    const authUrl = this.buildAuthorizationUrl(config, state, redirectUri);

    // Log the URL for the user to open
    // eslint-disable-next-line no-console
    console.log(`\nOpen this URL to authorize MCP server "${serverName}":\n${authUrl}\n`);

    let callbackServer: Server | undefined;
    try {
      const { code, server } = await this.startCallbackServer(port, state);
      callbackServer = server;

      const token = await this.exchangeCode(code, config, redirectUri);
      this.tokens.set(serverName, token);
      await this.saveToken(serverName, token);
      return token;
    } finally {
      if (callbackServer) {
        callbackServer.close();
      }
    }
  }

  /**
   * Get a valid access token for a server.
   * Returns the cached token if valid, refreshes if expired,
   * or returns null if no token is available.
   */
  async getAccessToken(serverName: string, config: MCPOAuthConfig): Promise<string | null> {
    let token = this.tokens.get(serverName) ?? null;

    if (!token) {
      token = await this.loadToken(serverName);
      if (token) {
        this.tokens.set(serverName, token);
      }
    }

    if (!token) {
      return null;
    }

    if (this.isTokenExpired(token)) {
      if (!token.refreshToken) {
        this.tokens.delete(serverName);
        return null;
      }

      try {
        const refreshed = await this.refreshToken(serverName, config, token.refreshToken);
        return refreshed.accessToken;
      } catch {
        this.tokens.delete(serverName);
        return null;
      }
    }

    return token.accessToken;
  }

  /** Check if a token is expired (with 60-second buffer) */
  isTokenExpired(token: OAuthToken): boolean {
    if (token.expiresAt === undefined) {
      return false;
    }
    return Date.now() >= token.expiresAt - EXPIRY_BUFFER_MS;
  }

  /** Refresh an expired token using the refresh_token grant */
  async refreshToken(
    serverName: string,
    config: MCPOAuthConfig,
    refreshTokenValue: string,
  ): Promise<OAuthToken> {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshTokenValue,
      client_id: config.clientId,
    });

    if (config.clientSecret) {
      body.set("client_secret", config.clientSecret);
    }

    const response = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new MCPOAuthError("Token refresh failed", {
        serverName,
        status: response.status,
        body: text,
      });
    }

    const data = (await response.json()) as Record<string, unknown>;
    const token = this.parseTokenResponse(data, refreshTokenValue);
    this.tokens.set(serverName, token);
    await this.saveToken(serverName, token);
    return token;
  }

  /** Exchange an authorization code for tokens */
  async exchangeCode(
    code: string,
    config: MCPOAuthConfig,
    redirectUri: string,
  ): Promise<OAuthToken> {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: config.clientId,
    });

    if (config.clientSecret) {
      body.set("client_secret", config.clientSecret);
    }

    const response = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new MCPOAuthError("Token exchange failed", {
        status: response.status,
        body: text,
      });
    }

    const data = (await response.json()) as Record<string, unknown>;
    return this.parseTokenResponse(data);
  }

  /** Save a token to disk as JSON */
  async saveToken(serverName: string, token: OAuthToken): Promise<void> {
    await mkdir(TOKEN_STORAGE_DIR, { recursive: true });
    const filePath = join(TOKEN_STORAGE_DIR, `${serverName}.json`);
    await writeFile(filePath, JSON.stringify(token, null, 2), "utf-8");
  }

  /** Load a token from disk */
  async loadToken(serverName: string): Promise<OAuthToken | null> {
    const filePath = join(TOKEN_STORAGE_DIR, `${serverName}.json`);
    try {
      const raw = await readFile(filePath, "utf-8");
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (typeof parsed.accessToken !== "string" || typeof parsed.tokenType !== "string") {
        return null;
      }
      return {
        accessToken: parsed.accessToken as string,
        refreshToken: parsed.refreshToken as string | undefined,
        expiresAt: parsed.expiresAt as number | undefined,
        tokenType: parsed.tokenType as string,
        scope: parsed.scope as string | undefined,
      };
    } catch {
      return null;
    }
  }

  /** Remove a stored token from memory and disk */
  async revokeToken(serverName: string): Promise<void> {
    this.tokens.delete(serverName);
    const filePath = join(TOKEN_STORAGE_DIR, `${serverName}.json`);
    try {
      await unlink(filePath);
    } catch {
      // File may not exist — not an error
    }
  }

  /** Build the full authorization URL with query parameters */
  buildAuthorizationUrl(config: MCPOAuthConfig, state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: config.clientId,
      redirect_uri: redirectUri,
      state,
    });

    if (config.scopes && config.scopes.length > 0) {
      params.set("scope", config.scopes.join(" "));
    }

    return `${config.authorizationUrl}?${params.toString()}`;
  }

  /**
   * Start a temporary local HTTP server to receive the OAuth callback.
   * Returns a promise that resolves with the authorization code once received.
   */
  private startCallbackServer(
    port: number,
    expectedState: string,
  ): Promise<{ code: string; server: Server }> {
    return new Promise<{ code: string; server: Server }>((resolve, reject) => {
      const server = createServer((req, res) => {
        const url = new URL(req.url ?? "/", `http://localhost:${port}`);

        if (url.pathname !== "/callback") {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("Not Found");
          return;
        }

        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const error = url.searchParams.get("error");

        if (error) {
          const errorDesc = url.searchParams.get("error_description") ?? error;
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end(`<html><body><h1>Authorization Failed</h1><p>${errorDesc}</p></body></html>`);
          server.close();
          reject(
            new MCPOAuthError("Authorization denied by user", {
              error,
              errorDescription: errorDesc,
            }),
          );
          return;
        }

        if (!code || state !== expectedState) {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end(
            "<html><body><h1>Invalid Callback</h1><p>Missing code or state mismatch.</p></body></html>",
          );
          server.close();
          reject(
            new MCPOAuthError("Invalid OAuth callback: missing code or state mismatch", {
              hasCode: !!code,
              stateMatch: state === expectedState,
            }),
          );
          return;
        }

        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(
          "<html><body><h1>Authorization Successful</h1><p>You can close this window.</p></body></html>",
        );
        resolve({ code, server });
      });

      const timeout = setTimeout(() => {
        server.close();
        reject(new MCPOAuthError("OAuth callback timed out", { timeoutMs: CALLBACK_TIMEOUT_MS }));
      }, CALLBACK_TIMEOUT_MS);

      server.on("error", (err) => {
        clearTimeout(timeout);
        reject(
          new MCPOAuthError("Failed to start OAuth callback server", {
            port,
            cause: err.message,
          }),
        );
      });

      server.listen(port, () => {
        // Server is listening, clear timeout tracking is handled above
      });

      // Ensure timeout is cleared when server closes
      server.on("close", () => {
        clearTimeout(timeout);
      });
    });
  }

  /** Parse a token endpoint response into an OAuthToken */
  private parseTokenResponse(
    data: Record<string, unknown>,
    existingRefreshToken?: string,
  ): OAuthToken {
    const accessToken = data.access_token as string | undefined;
    if (!accessToken) {
      throw new MCPOAuthError("Token response missing access_token", { data });
    }

    const expiresIn = data.expires_in as number | undefined;

    return {
      accessToken,
      refreshToken: (data.refresh_token as string | undefined) ?? existingRefreshToken,
      expiresAt: expiresIn ? Date.now() + expiresIn * 1000 : undefined,
      tokenType: (data.token_type as string) ?? "Bearer",
      scope: data.scope as string | undefined,
    };
  }
}

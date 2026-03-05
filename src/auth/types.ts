/** Authentication method types */
export type AuthMethod = "bearer" | "api-key" | "custom-header";

/** Token configuration */
export interface TokenConfig {
  readonly method: AuthMethod;
  readonly token: string;
  readonly headerName?: string;
}

/** Token source — where the token was loaded from */
export type TokenSource = "environment" | "file" | "keychain" | "config";

/** Resolved token with metadata */
export interface ResolvedToken {
  readonly config: TokenConfig;
  readonly source: TokenSource;
  readonly expiresAt?: Date;
}

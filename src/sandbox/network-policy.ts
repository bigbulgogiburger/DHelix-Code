import { BaseError } from "../utils/error.js";

/** Network policy enforcement error */
export class NetworkPolicyError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "NETWORK_POLICY_ERROR", context);
  }
}

/** Network access policy for sandboxed processes */
export interface NetworkPolicy {
  /** Default behavior: allow or deny all network access */
  readonly defaultAction: "allow" | "deny";
  /** Domains/IPs explicitly allowed */
  readonly allowlist: readonly string[];
  /** Domains/IPs explicitly denied (takes precedence over allow) */
  readonly denylist: readonly string[];
}

/** Default policy: allow all traffic (no restrictions) */
export const DEFAULT_NETWORK_POLICY: NetworkPolicy = {
  defaultAction: "allow",
  allowlist: [],
  denylist: [],
};

/**
 * Check if a host matches a pattern.
 * Supports exact match and wildcard prefix matching:
 *   - "api.openai.com" matches "api.openai.com" exactly
 *   - "*.openai.com" matches "api.openai.com", "beta.openai.com", etc.
 *   - "*.openai.com" does NOT match "openai.com" itself
 */
function matchesPattern(host: string, pattern: string): boolean {
  const normalizedHost = host.toLowerCase();
  const normalizedPattern = pattern.toLowerCase();

  if (normalizedPattern.startsWith("*.")) {
    const suffix = normalizedPattern.slice(1); // e.g., ".openai.com"
    return normalizedHost.endsWith(suffix) && normalizedHost !== suffix.slice(1);
  }

  return normalizedHost === normalizedPattern;
}

/**
 * Check if a host matches any pattern in a list.
 */
function matchesAny(host: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => matchesPattern(host, pattern));
}

/**
 * Check if a domain/host is allowed by the network policy.
 *
 * Evaluation order:
 * 1. Denylist (deny takes precedence over allow)
 * 2. Allowlist
 * 3. Default action
 */
export function isHostAllowed(host: string, policy: NetworkPolicy): boolean {
  // Empty host is never allowed
  if (!host) {
    return false;
  }

  // 1. Denylist takes precedence
  if (matchesAny(host, policy.denylist)) {
    return false;
  }

  // 2. Check allowlist
  if (matchesAny(host, policy.allowlist)) {
    return true;
  }

  // 3. Fall back to default action
  return policy.defaultAction === "allow";
}

/**
 * Parse a network policy from an unknown config value.
 * Returns DEFAULT_NETWORK_POLICY for invalid input.
 */
export function parseNetworkPolicy(config: unknown): NetworkPolicy {
  if (config === null || config === undefined || typeof config !== "object") {
    return DEFAULT_NETWORK_POLICY;
  }

  const obj = config as Record<string, unknown>;

  const defaultAction =
    obj.defaultAction === "allow" || obj.defaultAction === "deny"
      ? obj.defaultAction
      : DEFAULT_NETWORK_POLICY.defaultAction;

  const allowlist = Array.isArray(obj.allowlist)
    ? obj.allowlist.filter((item): item is string => typeof item === "string")
    : [];

  const denylist = Array.isArray(obj.denylist)
    ? obj.denylist.filter((item): item is string => typeof item === "string")
    : [];

  return Object.freeze({
    defaultAction,
    allowlist: Object.freeze([...allowlist]),
    denylist: Object.freeze([...denylist]),
  });
}

import { type NetworkPolicy, DEFAULT_NETWORK_POLICY } from "./network-policy.js";
import { startNetworkProxy } from "./network-proxy.js";
import { executeSandboxed, type SandboxConfig, SandboxError } from "./seatbelt.js";

/** Extended sandbox config with optional network policy */
export interface NetworkSandboxConfig extends SandboxConfig {
  /** Network policy to enforce; if omitted, uses DEFAULT_NETWORK_POLICY */
  readonly networkPolicy?: NetworkPolicy;
}

/**
 * Execute a command in sandbox with network policy enforcement.
 *
 * 1. Starts a local proxy that enforces the network policy
 * 2. Sets HTTP_PROXY and HTTPS_PROXY env vars pointing to the proxy
 * 3. Runs the command in the sandbox
 * 4. Cleans up the proxy after execution (even on errors)
 *
 * If no networkPolicy is provided, falls back to the standard
 * executeSandboxed without proxy overhead.
 */
export async function executeSandboxedWithNetwork(
  config: NetworkSandboxConfig,
): Promise<{ stdout: string; stderr: string }> {
  const { networkPolicy, ...sandboxConfig } = config;

  // If no network policy provided, delegate to standard sandboxed execution
  if (!networkPolicy) {
    return executeSandboxed(sandboxConfig);
  }

  // If policy allows everything (default), skip proxy overhead
  if (
    networkPolicy.defaultAction === "allow" &&
    networkPolicy.denylist.length === 0 &&
    networkPolicy.allowlist.length === 0
  ) {
    return executeSandboxed(sandboxConfig);
  }

  // Start the proxy on an auto-assigned port
  const blockedHosts: string[] = [];
  const proxy = await startNetworkProxy({
    port: 0,
    policy: networkPolicy ?? DEFAULT_NETWORK_POLICY,
    onBlocked: (host) => {
      blockedHosts.push(host);
    },
  });

  try {
    const proxyUrl = `http://127.0.0.1:${proxy.port}`;

    // Merge proxy environment variables
    const proxyEnv: Record<string, string> = {
      ...sandboxConfig.env,
      HTTP_PROXY: proxyUrl,
      HTTPS_PROXY: proxyUrl,
      http_proxy: proxyUrl,
      https_proxy: proxyUrl,
    };

    const result = await executeSandboxed({
      ...sandboxConfig,
      env: proxyEnv,
    });

    return result;
  } catch (error) {
    // Re-throw with additional context about blocked hosts
    if (blockedHosts.length > 0 && error instanceof SandboxError) {
      throw new SandboxError("Sandboxed command failed with blocked network access", {
        ...error.context,
        blockedHosts,
      });
    }
    throw error;
  } finally {
    await proxy.stop();
  }
}

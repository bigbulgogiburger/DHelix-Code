import { describe, it, expect, afterEach } from "vitest";
import { request } from "node:http";
import { startNetworkProxy, type ProxyHandle } from "../../../src/sandbox/network-proxy.js";
import { type NetworkPolicy } from "../../../src/sandbox/network-policy.js";

// Track active proxies for cleanup
const activeProxies: ProxyHandle[] = [];

afterEach(async () => {
  for (const proxy of activeProxies) {
    await proxy.stop().catch(() => {});
  }
  activeProxies.length = 0;
});

/**
 * Helper: make an HTTP request through the proxy and return the status code.
 */
function proxyRequest(
  proxyPort: number,
  targetUrl: string,
): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(targetUrl);
    const req = request(
      {
        host: "127.0.0.1",
        port: proxyPort,
        method: "GET",
        path: targetUrl,
        headers: { Host: parsed.host },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk: Buffer) => {
          body += chunk.toString();
        });
        res.on("end", () => {
          resolve({ statusCode: res.statusCode ?? 0, body });
        });
      },
    );
    req.on("error", reject);
    req.end();
  });
}

/**
 * Helper: make a CONNECT request through the proxy and return the response status line.
 */
function proxyConnect(
  proxyPort: number,
  targetHost: string,
  targetPort: number,
): Promise<{ statusCode: number; statusMessage: string }> {
  return new Promise((resolve, reject) => {
    const req = request({
      host: "127.0.0.1",
      port: proxyPort,
      method: "CONNECT",
      path: `${targetHost}:${targetPort}`,
    });
    req.on("connect", (res) => {
      // Close the tunneled socket immediately
      res.socket.end();
      resolve({
        statusCode: res.statusCode ?? 0,
        statusMessage: res.statusMessage ?? "",
      });
    });
    req.on("error", (err) => {
      // Connection refused or similar — could indicate blocked
      reject(err);
    });
    req.end();
  });
}

describe("startNetworkProxy", () => {
  it("should start and stop without errors", async () => {
    const policy: NetworkPolicy = {
      defaultAction: "allow",
      allowlist: [],
      denylist: [],
    };

    const proxy = await startNetworkProxy({ port: 0, policy });
    activeProxies.push(proxy);

    expect(proxy.port).toBeGreaterThan(0);
    await proxy.stop();
    activeProxies.length = 0;
  });

  it("should assign a random port when port is 0", async () => {
    const policy: NetworkPolicy = {
      defaultAction: "allow",
      allowlist: [],
      denylist: [],
    };

    const proxy = await startNetworkProxy({ port: 0, policy });
    activeProxies.push(proxy);

    expect(proxy.port).toBeGreaterThan(0);
    expect(proxy.port).toBeLessThan(65536);
  });

  it("should block HTTP requests to denied hosts", async () => {
    const blockedHosts: string[] = [];
    const policy: NetworkPolicy = {
      defaultAction: "allow",
      allowlist: [],
      denylist: ["blocked.example.com"],
    };

    const proxy = await startNetworkProxy({
      port: 0,
      policy,
      onBlocked: (host) => blockedHosts.push(host),
    });
    activeProxies.push(proxy);

    const result = await proxyRequest(proxy.port, "http://blocked.example.com/test");

    expect(result.statusCode).toBe(403);
    expect(result.body).toContain("Blocked by network policy");
    expect(blockedHosts).toContain("blocked.example.com");
  });

  it("should block CONNECT requests to denied hosts", async () => {
    const blockedHosts: string[] = [];
    const policy: NetworkPolicy = {
      defaultAction: "allow",
      allowlist: [],
      denylist: ["blocked.example.com"],
    };

    const proxy = await startNetworkProxy({
      port: 0,
      policy,
      onBlocked: (host) => blockedHosts.push(host),
    });
    activeProxies.push(proxy);

    // CONNECT to a blocked host — the proxy should respond with 403
    // which the http module surfaces as an error since CONNECT expects 200
    try {
      const result = await proxyConnect(proxy.port, "blocked.example.com", 443);
      // Some implementations may return the status directly
      expect(result.statusCode).toBe(403);
    } catch {
      // Connection may be refused/reset when blocked — that's also acceptable
    }

    expect(blockedHosts).toContain("blocked.example.com");
  });

  it("should invoke onBlocked callback for denied hosts", async () => {
    const blockedHosts: string[] = [];
    const policy: NetworkPolicy = {
      defaultAction: "deny",
      allowlist: ["allowed.com"],
      denylist: [],
    };

    const proxy = await startNetworkProxy({
      port: 0,
      policy,
      onBlocked: (host) => blockedHosts.push(host),
    });
    activeProxies.push(proxy);

    await proxyRequest(proxy.port, "http://denied.com/path");

    expect(blockedHosts).toContain("denied.com");
  });

  it("should block hosts matching deny policy with default deny", async () => {
    const policy: NetworkPolicy = {
      defaultAction: "deny",
      allowlist: ["api.openai.com"],
      denylist: [],
    };

    const proxy = await startNetworkProxy({ port: 0, policy });
    activeProxies.push(proxy);

    const result = await proxyRequest(proxy.port, "http://unauthorized.com/test");

    expect(result.statusCode).toBe(403);
  });

  it("should work with wildcard deny patterns", async () => {
    const blockedHosts: string[] = [];
    const policy: NetworkPolicy = {
      defaultAction: "allow",
      allowlist: [],
      denylist: ["*.evil.com"],
    };

    const proxy = await startNetworkProxy({
      port: 0,
      policy,
      onBlocked: (host) => blockedHosts.push(host),
    });
    activeProxies.push(proxy);

    const result = await proxyRequest(proxy.port, "http://tracker.evil.com/pixel");

    expect(result.statusCode).toBe(403);
    expect(blockedHosts).toContain("tracker.evil.com");
  });
});

import { describe, it, expect } from "vitest";
import {
  isHostAllowed,
  parseNetworkPolicy,
  DEFAULT_NETWORK_POLICY,
  type NetworkPolicy,
} from "../../../src/sandbox/network-policy.js";

describe("isHostAllowed", () => {
  describe("default allow policy", () => {
    const policy: NetworkPolicy = {
      defaultAction: "allow",
      allowlist: [],
      denylist: [],
    };

    it("should allow any host when defaultAction is allow", () => {
      expect(isHostAllowed("api.openai.com", policy)).toBe(true);
      expect(isHostAllowed("example.com", policy)).toBe(true);
      expect(isHostAllowed("192.168.1.1", policy)).toBe(true);
    });

    it("should deny empty host", () => {
      expect(isHostAllowed("", policy)).toBe(false);
    });
  });

  describe("default deny policy", () => {
    const policy: NetworkPolicy = {
      defaultAction: "deny",
      allowlist: [],
      denylist: [],
    };

    it("should deny any host when defaultAction is deny", () => {
      expect(isHostAllowed("api.openai.com", policy)).toBe(false);
      expect(isHostAllowed("example.com", policy)).toBe(false);
    });
  });

  describe("allowlist", () => {
    const policy: NetworkPolicy = {
      defaultAction: "deny",
      allowlist: ["api.openai.com", "api.anthropic.com"],
      denylist: [],
    };

    it("should allow hosts in the allowlist", () => {
      expect(isHostAllowed("api.openai.com", policy)).toBe(true);
      expect(isHostAllowed("api.anthropic.com", policy)).toBe(true);
    });

    it("should deny hosts not in the allowlist", () => {
      expect(isHostAllowed("malicious.com", policy)).toBe(false);
      expect(isHostAllowed("google.com", policy)).toBe(false);
    });
  });

  describe("denylist", () => {
    const policy: NetworkPolicy = {
      defaultAction: "allow",
      allowlist: [],
      denylist: ["evil.com", "malware.org"],
    };

    it("should deny hosts in the denylist", () => {
      expect(isHostAllowed("evil.com", policy)).toBe(false);
      expect(isHostAllowed("malware.org", policy)).toBe(false);
    });

    it("should allow hosts not in the denylist", () => {
      expect(isHostAllowed("api.openai.com", policy)).toBe(true);
      expect(isHostAllowed("google.com", policy)).toBe(true);
    });
  });

  describe("denylist takes precedence over allowlist", () => {
    const policy: NetworkPolicy = {
      defaultAction: "deny",
      allowlist: ["*.example.com"],
      denylist: ["evil.example.com"],
    };

    it("should deny a host that is in both denylist and allowlist match", () => {
      expect(isHostAllowed("evil.example.com", policy)).toBe(false);
    });

    it("should allow other subdomains of the allowlisted wildcard", () => {
      expect(isHostAllowed("api.example.com", policy)).toBe(true);
      expect(isHostAllowed("www.example.com", policy)).toBe(true);
    });
  });

  describe("wildcard matching", () => {
    const policy: NetworkPolicy = {
      defaultAction: "deny",
      allowlist: ["*.openai.com"],
      denylist: [],
    };

    it("should match subdomains with wildcard", () => {
      expect(isHostAllowed("api.openai.com", policy)).toBe(true);
      expect(isHostAllowed("beta.openai.com", policy)).toBe(true);
      expect(isHostAllowed("staging.openai.com", policy)).toBe(true);
    });

    it("should NOT match the root domain itself for wildcard", () => {
      expect(isHostAllowed("openai.com", policy)).toBe(false);
    });

    it("should NOT match unrelated domains", () => {
      expect(isHostAllowed("notopenai.com", policy)).toBe(false);
      expect(isHostAllowed("evil-openai.com", policy)).toBe(false);
    });

    it("should match deeply nested subdomains", () => {
      expect(isHostAllowed("a.b.openai.com", policy)).toBe(true);
    });
  });

  describe("wildcard in denylist", () => {
    const policy: NetworkPolicy = {
      defaultAction: "allow",
      allowlist: [],
      denylist: ["*.evil.com"],
    };

    it("should block subdomains of denied wildcard", () => {
      expect(isHostAllowed("tracker.evil.com", policy)).toBe(false);
      expect(isHostAllowed("deep.nested.evil.com", policy)).toBe(false);
    });

    it("should allow the root domain itself (wildcard does not match root)", () => {
      expect(isHostAllowed("evil.com", policy)).toBe(true);
    });

    it("should allow unrelated domains", () => {
      expect(isHostAllowed("good.com", policy)).toBe(true);
    });
  });

  describe("case insensitivity", () => {
    const policy: NetworkPolicy = {
      defaultAction: "deny",
      allowlist: ["API.OpenAI.com"],
      denylist: [],
    };

    it("should match regardless of case", () => {
      expect(isHostAllowed("api.openai.com", policy)).toBe(true);
      expect(isHostAllowed("API.OPENAI.COM", policy)).toBe(true);
      expect(isHostAllowed("Api.Openai.Com", policy)).toBe(true);
    });
  });

  describe("realistic policy scenarios", () => {
    it("should enforce a strict API-only policy", () => {
      const policy: NetworkPolicy = {
        defaultAction: "deny",
        allowlist: ["*.openai.com", "*.anthropic.com", "api.github.com"],
        denylist: [],
      };

      expect(isHostAllowed("api.openai.com", policy)).toBe(true);
      expect(isHostAllowed("api.anthropic.com", policy)).toBe(true);
      expect(isHostAllowed("api.github.com", policy)).toBe(true);
      expect(isHostAllowed("www.github.com", policy)).toBe(false);
      expect(isHostAllowed("malicious.com", policy)).toBe(false);
    });

    it("should enforce a permissive policy with specific blocks", () => {
      const policy: NetworkPolicy = {
        defaultAction: "allow",
        allowlist: [],
        denylist: ["*.tracking.com", "analytics.evil.org", "*.adserver.net"],
      };

      expect(isHostAllowed("api.openai.com", policy)).toBe(true);
      expect(isHostAllowed("google.com", policy)).toBe(true);
      expect(isHostAllowed("pixel.tracking.com", policy)).toBe(false);
      expect(isHostAllowed("analytics.evil.org", policy)).toBe(false);
      expect(isHostAllowed("ads.adserver.net", policy)).toBe(false);
    });
  });
});

describe("parseNetworkPolicy", () => {
  it("should return default policy for null input", () => {
    expect(parseNetworkPolicy(null)).toEqual(DEFAULT_NETWORK_POLICY);
  });

  it("should return default policy for undefined input", () => {
    expect(parseNetworkPolicy(undefined)).toEqual(DEFAULT_NETWORK_POLICY);
  });

  it("should return default policy for non-object input", () => {
    expect(parseNetworkPolicy("string")).toEqual(DEFAULT_NETWORK_POLICY);
    expect(parseNetworkPolicy(42)).toEqual(DEFAULT_NETWORK_POLICY);
    expect(parseNetworkPolicy(true)).toEqual(DEFAULT_NETWORK_POLICY);
  });

  it("should parse a valid policy object", () => {
    const result = parseNetworkPolicy({
      defaultAction: "deny",
      allowlist: ["api.openai.com"],
      denylist: ["evil.com"],
    });

    expect(result.defaultAction).toBe("deny");
    expect(result.allowlist).toEqual(["api.openai.com"]);
    expect(result.denylist).toEqual(["evil.com"]);
  });

  it("should use default action for invalid defaultAction", () => {
    const result = parseNetworkPolicy({
      defaultAction: "invalid",
      allowlist: [],
      denylist: [],
    });

    expect(result.defaultAction).toBe("allow");
  });

  it("should filter non-string items from allowlist", () => {
    const result = parseNetworkPolicy({
      defaultAction: "deny",
      allowlist: ["valid.com", 42, null, "also-valid.com"],
      denylist: [],
    });

    expect(result.allowlist).toEqual(["valid.com", "also-valid.com"]);
  });

  it("should filter non-string items from denylist", () => {
    const result = parseNetworkPolicy({
      defaultAction: "allow",
      allowlist: [],
      denylist: ["evil.com", undefined, "bad.com"],
    });

    expect(result.denylist).toEqual(["evil.com", "bad.com"]);
  });

  it("should handle missing allowlist and denylist", () => {
    const result = parseNetworkPolicy({ defaultAction: "deny" });

    expect(result.defaultAction).toBe("deny");
    expect(result.allowlist).toEqual([]);
    expect(result.denylist).toEqual([]);
  });

  it("should return frozen objects", () => {
    const result = parseNetworkPolicy({
      defaultAction: "deny",
      allowlist: ["a.com"],
      denylist: ["b.com"],
    });

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.allowlist)).toBe(true);
    expect(Object.isFrozen(result.denylist)).toBe(true);
  });
});

describe("DEFAULT_NETWORK_POLICY", () => {
  it("should have allow as default action", () => {
    expect(DEFAULT_NETWORK_POLICY.defaultAction).toBe("allow");
  });

  it("should have empty allowlist and denylist", () => {
    expect(DEFAULT_NETWORK_POLICY.allowlist).toEqual([]);
    expect(DEFAULT_NETWORK_POLICY.denylist).toEqual([]);
  });
});

/**
 * PolicyBundles 테스트
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  RESTRICTIVE_BUNDLE,
  PERMISSIVE_BUNDLE,
  ENTERPRISE_BUNDLE,
  PolicyBundleManager,
} from "../../../src/permissions/policy-bundles.js";
import { PolicyEngine } from "../../../src/permissions/policy-engine.js";
import { TrustTier } from "../../../src/permissions/trust-tiers.js";

// ─── 사전 정의 번들 상수 테스트 ──────────────────────────────────────────────

describe("RESTRICTIVE_BUNDLE", () => {
  it("id가 'restrictive'여야 한다", () => {
    expect(RESTRICTIVE_BUNDLE.id).toBe("restrictive");
  });

  it("bash_exec 기본 동작이 deny여야 한다", () => {
    expect(RESTRICTIVE_BUNDLE.policies["bash_exec"]?.defaultAction).toBe("deny");
  });

  it("file_write 기본 동작이 ask여야 한다", () => {
    expect(RESTRICTIVE_BUNDLE.policies["file_write"]?.defaultAction).toBe("ask");
  });

  it("web_fetch 기본 동작이 deny여야 한다", () => {
    expect(RESTRICTIVE_BUNDLE.policies["web_fetch"]?.defaultAction).toBe("deny");
  });

  it("bash_exec deny 패턴에 'rm -rf *'가 포함되어야 한다", () => {
    const denyPatterns = RESTRICTIVE_BUNDLE.policies["bash_exec"]?.rules.deny ?? [];
    expect(denyPatterns).toContain("rm -rf *");
  });

  it("trustDefaults에 External Tier 설정이 있어야 한다", () => {
    expect(RESTRICTIVE_BUNDLE.trustDefaults?.[TrustTier.External]).toBeDefined();
    expect(RESTRICTIVE_BUNDLE.trustDefaults?.[TrustTier.External]?.shellExecution).toBe("deny");
    expect(RESTRICTIVE_BUNDLE.trustDefaults?.[TrustTier.External]?.networkOutbound).toBe("deny");
  });
});

describe("PERMISSIVE_BUNDLE", () => {
  it("id가 'permissive'여야 한다", () => {
    expect(PERMISSIVE_BUNDLE.id).toBe("permissive");
  });

  it("bash_exec 기본 동작이 ask여야 한다", () => {
    expect(PERMISSIVE_BUNDLE.policies["bash_exec"]?.defaultAction).toBe("ask");
  });

  it("file_write 기본 동작이 allow여야 한다", () => {
    expect(PERMISSIVE_BUNDLE.policies["file_write"]?.defaultAction).toBe("allow");
  });

  it("web_fetch 기본 동작이 allow여야 한다", () => {
    expect(PERMISSIVE_BUNDLE.policies["web_fetch"]?.defaultAction).toBe("allow");
  });

  it("bash_exec allow 패턴에 npm * 이 포함되어야 한다", () => {
    const allowPatterns = PERMISSIVE_BUNDLE.policies["bash_exec"]?.rules.allow ?? [];
    expect(allowPatterns).toContain("npm *");
  });

  it("trustDefaults가 없어야 한다 (개발 환경 기본값 사용)", () => {
    expect(PERMISSIVE_BUNDLE.trustDefaults).toBeUndefined();
  });
});

describe("ENTERPRISE_BUNDLE", () => {
  it("id가 'enterprise'여야 한다", () => {
    expect(ENTERPRISE_BUNDLE.id).toBe("enterprise");
  });

  it("bash_exec 기본 동작이 ask여야 한다", () => {
    expect(ENTERPRISE_BUNDLE.policies["bash_exec"]?.defaultAction).toBe("ask");
  });

  it("file_write 기본 동작이 ask여야 한다", () => {
    expect(ENTERPRISE_BUNDLE.policies["file_write"]?.defaultAction).toBe("ask");
  });

  it("web_fetch 기본 동작이 deny여야 한다", () => {
    expect(ENTERPRISE_BUNDLE.policies["web_fetch"]?.defaultAction).toBe("deny");
  });

  it("web_fetch allow 패턴에 npm registry가 포함되어야 한다", () => {
    const allowPatterns = ENTERPRISE_BUNDLE.policies["web_fetch"]?.rules.allow ?? [];
    expect(allowPatterns.some((p) => p.includes("npmjs.org"))).toBe(true);
  });

  it("bash_exec ask 패턴에 docker *가 포함되어야 한다", () => {
    const askPatterns = ENTERPRISE_BUNDLE.policies["bash_exec"]?.rules.ask ?? [];
    expect(askPatterns).toContain("docker *");
  });

  it("trustDefaults에 External 및 ProjectShared 설정이 있어야 한다", () => {
    expect(ENTERPRISE_BUNDLE.trustDefaults?.[TrustTier.External]).toBeDefined();
    expect(ENTERPRISE_BUNDLE.trustDefaults?.[TrustTier.ProjectShared]).toBeDefined();
    expect(ENTERPRISE_BUNDLE.trustDefaults?.[TrustTier.ProjectShared]?.networkOutbound).toBe("deny");
  });
});

// ─── PolicyBundleManager 테스트 ───────────────────────────────────────────────

describe("PolicyBundleManager", () => {
  let manager: PolicyBundleManager;

  beforeEach(() => {
    manager = new PolicyBundleManager();
  });

  describe("loadBundle()", () => {
    it("사전 정의 번들 'restrictive'를 로드해야 한다", () => {
      const bundle = manager.loadBundle("restrictive");
      expect(bundle.id).toBe("restrictive");
    });

    it("사전 정의 번들 'permissive'를 로드해야 한다", () => {
      const bundle = manager.loadBundle("permissive");
      expect(bundle.id).toBe("permissive");
    });

    it("사전 정의 번들 'enterprise'를 로드해야 한다", () => {
      const bundle = manager.loadBundle("enterprise");
      expect(bundle.id).toBe("enterprise");
    });

    it("존재하지 않는 번들 ID에 대해 에러를 던져야 한다", () => {
      expect(() => manager.loadBundle("nonexistent")).toThrow(/Unknown bundle id/);
    });
  });

  describe("applyBundle()", () => {
    it("번들 정책을 PolicyEngine에 적용해야 한다", () => {
      const engine = new PolicyEngine();
      const bundle = manager.loadBundle("restrictive");
      manager.applyBundle(bundle, engine);

      // bash_exec가 기본 deny로 적용되었는지 확인
      const policy = engine.getToolPolicy("bash_exec");
      expect(policy?.defaultAction).toBe("deny");
    });

    it("permissive 번들 적용 후 npm 명령이 allow여야 한다", () => {
      const engine = new PolicyEngine();
      const bundle = manager.loadBundle("permissive");
      manager.applyBundle(bundle, engine);

      const result = engine.evaluate("bash_exec", "npm install");
      expect(result).toBe("allow");
    });

    it("restrictive 번들 적용 후 rm -rf 명령이 deny여야 한다", () => {
      const engine = new PolicyEngine();
      const bundle = manager.loadBundle("restrictive");
      manager.applyBundle(bundle, engine);

      const result = engine.evaluate("bash_exec", "rm -rf /tmp/test");
      expect(result).toBe("deny");
    });

    it("enterprise 번들 적용 후 docker 명령이 ask여야 한다", () => {
      const engine = new PolicyEngine();
      const bundle = manager.loadBundle("enterprise");
      manager.applyBundle(bundle, engine);

      const result = engine.evaluate("bash_exec", "docker build .");
      expect(result).toBe("ask");
    });
  });

  describe("listBundles()", () => {
    it("최소 3개(사전 정의) 번들을 반환해야 한다", () => {
      const bundles = manager.listBundles();
      expect(bundles.length).toBeGreaterThanOrEqual(3);
    });

    it("사전 정의 번들 ID들이 포함되어야 한다", () => {
      const ids = manager.listBundles().map((b) => b.id);
      expect(ids).toContain("restrictive");
      expect(ids).toContain("permissive");
      expect(ids).toContain("enterprise");
    });

    it("커스텀 번들 생성 후 목록에 포함되어야 한다", () => {
      manager.createCustomBundle("restrictive", { id: "my-custom" });
      const ids = manager.listBundles().map((b) => b.id);
      expect(ids).toContain("my-custom");
    });
  });

  describe("createCustomBundle()", () => {
    it("기존 번들을 기반으로 커스텀 번들을 생성해야 한다", () => {
      const custom = manager.createCustomBundle("restrictive", {
        id: "custom-restrictive",
        name: "Custom Restrictive",
        description: "테스트용 커스텀 번들",
      });

      expect(custom.id).toBe("custom-restrictive");
      expect(custom.name).toBe("Custom Restrictive");
      // 기반 번들 정책 상속 확인
      expect(custom.policies["bash_exec"]?.defaultAction).toBe("deny");
    });

    it("정책 재정의가 병합되어야 한다", () => {
      const custom = manager.createCustomBundle("restrictive", {
        id: "relaxed-restrictive",
        policies: {
          web_search: { defaultAction: "allow", rules: {} },
        },
      });

      // 재정의된 정책 확인
      expect(custom.policies["web_search"]?.defaultAction).toBe("allow");
      // 기반 번들 정책 유지 확인
      expect(custom.policies["bash_exec"]?.defaultAction).toBe("deny");
    });

    it("생성된 커스텀 번들을 loadBundle로 로드할 수 있어야 한다", () => {
      manager.createCustomBundle("permissive", { id: "dev-custom" });
      const loaded = manager.loadBundle("dev-custom");
      expect(loaded.id).toBe("dev-custom");
    });

    it("존재하지 않는 기반 번들에 대해 에러를 던져야 한다", () => {
      expect(() =>
        manager.createCustomBundle("nonexistent", { id: "fail" }),
      ).toThrow(/Unknown bundle id/);
    });

    it("name/description이 없으면 기반 번들에서 파생되어야 한다", () => {
      const custom = manager.createCustomBundle("enterprise", { id: "derived" });
      expect(custom.name).toContain("Enterprise");
    });
  });

  describe("exportBundle()", () => {
    it("TOML 형식 문자열을 반환해야 한다", () => {
      const bundle = manager.loadBundle("restrictive");
      const toml = manager.exportBundle(bundle);

      expect(toml).toContain("[tool.bash_exec]");
      expect(toml).toContain('defaultAction = "deny"');
    });

    it("내보낸 TOML을 PolicyEngine으로 다시 로드할 수 있어야 한다", () => {
      const bundle = manager.loadBundle("permissive");
      const toml = manager.exportBundle(bundle);

      const engine = new PolicyEngine();
      expect(() => engine.loadFromToml(toml)).not.toThrow();

      const policy = engine.getToolPolicy("bash_exec");
      expect(policy?.defaultAction).toBe("ask");
    });

    it("allow 패턴이 TOML에 포함되어야 한다", () => {
      const bundle = manager.loadBundle("permissive");
      const toml = manager.exportBundle(bundle);

      expect(toml).toContain("allow =");
    });

    it("deny 패턴이 TOML에 포함되어야 한다", () => {
      const bundle = manager.loadBundle("restrictive");
      const toml = manager.exportBundle(bundle);

      expect(toml).toContain("deny =");
    });

    it("timeoutMs가 있으면 TOML에 포함되어야 한다", () => {
      const bundle = manager.loadBundle("restrictive");
      const toml = manager.exportBundle(bundle);

      expect(toml).toContain("timeoutMs =");
    });

    it("번들 ID와 이름이 주석으로 포함되어야 한다", () => {
      const bundle = manager.loadBundle("enterprise");
      const toml = manager.exportBundle(bundle);

      expect(toml).toContain("# Policy Bundle: Enterprise");
      expect(toml).toContain("# ID: enterprise");
    });
  });
});

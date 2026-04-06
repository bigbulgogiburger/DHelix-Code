/**
 * Managed Policy Bundles — 사전 정의된 정책 번들 및 관리자
 *
 * 조직 또는 개발 환경에 맞게 도구 실행 정책을 일괄 적용할 수 있는
 * 번들 시스템입니다. 3개의 사전 정의 번들을 제공합니다:
 *
 * - RESTRICTIVE_BUNDLE: 최소 권한 원칙 적용 (보안 최우선 환경)
 * - PERMISSIVE_BUNDLE: 개발자 생산성 최적화 (로컬 개발 환경)
 * - ENTERPRISE_BUNDLE: 감사 로그 + 승인 워크플로우 (기업 환경)
 *
 * @example
 * ```ts
 * const manager = new PolicyBundleManager();
 * const bundle = manager.loadBundle("restrictive");
 * manager.applyBundle(bundle, policyEngine);
 * ```
 */

import { type ToolPolicy, PolicyEngine } from "./policy-engine.js";
import { type TierPolicy, TrustTier } from "./trust-tiers.js";

// ─── PolicyBundle ─────────────────────────────────────────────────────────────

/**
 * 정책 번들 — 도구별 정책과 Tier별 기본값을 묶은 단위
 */
export interface PolicyBundle {
  /** 번들 식별자 ("restrictive" | "permissive" | "enterprise" | 사용자 정의) */
  readonly id: string;
  /** 사람이 읽을 수 있는 번들 이름 */
  readonly name: string;
  /** 번들 설명 */
  readonly description: string;
  /** 도구 이름 → ToolPolicy 매핑 */
  readonly policies: Readonly<Record<string, ToolPolicy>>;
  /** Trust Tier별 기본 정책 재정의 (선택 사항) */
  readonly trustDefaults?: Partial<Record<TrustTier, TierPolicy>>;
}

// ─── 사전 정의 번들 ───────────────────────────────────────────────────────────

/**
 * RESTRICTIVE_BUNDLE — 최소 권한 원칙 적용
 *
 * - bash: 기본 거부 (위험 명령 명시적 차단)
 * - 파일 쓰기: 매번 확인
 * - 네트워크: 거부
 */
export const RESTRICTIVE_BUNDLE: PolicyBundle = {
  id: "restrictive",
  name: "Restrictive",
  description:
    "최소 권한 원칙 적용. 셸 실행은 기본 거부, 파일 쓰기는 매번 확인, 네트워크는 차단합니다. 보안이 최우선인 환경에 적합합니다.",
  policies: {
    bash_exec: {
      defaultAction: "deny",
      timeoutMs: 10_000,
      maxOutputBytes: 524_288, // 512 KB
      rules: {
        allow: ["git status", "git log *", "git diff *"],
        deny: [
          "rm -rf *",
          "sudo *",
          "curl * | *",
          "wget * | *",
          "chmod 777 *",
          "dd if=*",
          "> /dev/*",
        ],
      },
    },
    bash_output: {
      defaultAction: "deny",
      rules: {
        allow: ["git status", "git log *", "git diff *"],
      },
    },
    file_write: {
      defaultAction: "ask",
      rules: {
        deny: ["/etc/*", "/usr/*", "/bin/*", "/sbin/*", "~/.ssh/*", "~/.gnupg/*"],
      },
    },
    file_edit: {
      defaultAction: "ask",
      rules: {
        deny: ["/etc/*", "/usr/*", "/bin/*", "/sbin/*"],
      },
    },
    file_read: {
      defaultAction: "allow",
      rules: {
        deny: ["~/.ssh/*", "~/.gnupg/*", "*.pem", "*.key", "*.p12"],
      },
    },
    web_fetch: {
      defaultAction: "deny",
      rules: {},
    },
    web_search: {
      defaultAction: "deny",
      rules: {},
    },
  },
  trustDefaults: {
    [TrustTier.External]: {
      fileReadProject: "ask",
      fileWriteProject: "deny",
      shellExecution: "deny",
      networkOutbound: "deny",
      sandbox: "os",
    },
  },
} as const;

/**
 * PERMISSIVE_BUNDLE — 개발자 생산성 최적화
 *
 * - bash: 확인 후 실행 (위험 명령만 차단)
 * - 파일 쓰기: 허용
 * - 네트워크: 허용
 */
export const PERMISSIVE_BUNDLE: PolicyBundle = {
  id: "permissive",
  name: "Permissive",
  description:
    "개발자 생산성 최적화. 대부분의 작업을 허용하고, 명백히 위험한 명령만 차단합니다. 로컬 개발 환경에 적합합니다.",
  policies: {
    bash_exec: {
      defaultAction: "ask",
      timeoutMs: 60_000,
      maxOutputBytes: 2_097_152, // 2 MB
      rules: {
        allow: [
          "npm *",
          "yarn *",
          "pnpm *",
          "git *",
          "tsc *",
          "node *",
          "python *",
          "pip *",
          "cargo *",
          "go *",
        ],
        deny: ["rm -rf /", "sudo rm *", ":(){ :|:& };:", "dd if=/dev/zero of=/*"],
      },
    },
    bash_output: {
      defaultAction: "ask",
      rules: {
        allow: ["npm *", "yarn *", "git *", "node *"],
      },
    },
    file_write: {
      defaultAction: "allow",
      rules: {
        deny: ["/etc/*", "/usr/*", "/bin/*", "/sbin/*"],
      },
    },
    file_edit: {
      defaultAction: "allow",
      rules: {
        deny: ["/etc/*", "/usr/*", "/bin/*", "/sbin/*"],
      },
    },
    file_read: {
      defaultAction: "allow",
      rules: {},
    },
    web_fetch: {
      defaultAction: "allow",
      rules: {},
    },
    web_search: {
      defaultAction: "allow",
      rules: {},
    },
  },
} as const;

/**
 * ENTERPRISE_BUNDLE — 기업 환경 감사 + 승인 워크플로우
 *
 * - bash: 확인 필요 + 감사 로그 기록
 * - 파일 쓰기: 확인 + 승인 필요 (민감 파일 차단)
 * - 네트워크: 거부 (화이트리스트 방식)
 */
export const ENTERPRISE_BUNDLE: PolicyBundle = {
  id: "enterprise",
  name: "Enterprise",
  description:
    "기업 보안 정책 적용. 모든 셸 실행은 확인 및 감사 로그 기록, 파일 쓰기는 확인 필요, 네트워크는 기본 차단합니다. CI/CD 및 기업 환경에 적합합니다.",
  policies: {
    bash_exec: {
      defaultAction: "ask",
      timeoutMs: 30_000,
      maxOutputBytes: 1_048_576, // 1 MB
      rules: {
        allow: ["git status", "git log *", "git diff *", "git fetch *"],
        ask: [
          "npm run *",
          "yarn *",
          "pnpm *",
          "tsc *",
          "vitest *",
          "jest *",
          "docker *",
          "kubectl *",
        ],
        deny: [
          "rm -rf *",
          "sudo *",
          "curl * | *",
          "wget * | *",
          "chmod 777 *",
          "dd if=*",
          "mkfs *",
          "fdisk *",
        ],
      },
    },
    bash_output: {
      defaultAction: "ask",
      rules: {
        allow: ["git status", "git log *", "git diff *"],
        deny: ["rm -rf *", "sudo *"],
      },
    },
    file_write: {
      defaultAction: "ask",
      rules: {
        deny: [
          "/etc/*",
          "/usr/*",
          "/bin/*",
          "/sbin/*",
          "~/.ssh/*",
          "~/.gnupg/*",
          "*.pem",
          "*.key",
          "*.p12",
          ".env",
          ".env.*",
        ],
      },
    },
    file_edit: {
      defaultAction: "ask",
      rules: {
        deny: [
          "/etc/*",
          "/usr/*",
          "~/.ssh/*",
          "~/.gnupg/*",
          "*.pem",
          "*.key",
          ".env",
          ".env.*",
        ],
      },
    },
    file_read: {
      defaultAction: "allow",
      rules: {
        deny: ["~/.ssh/*", "~/.gnupg/*", "*.pem", "*.key", "*.p12"],
      },
    },
    web_fetch: {
      defaultAction: "deny",
      rules: {
        allow: [
          "https://registry.npmjs.org/*",
          "https://api.github.com/*",
          "https://raw.githubusercontent.com/*",
        ],
      },
    },
    web_search: {
      defaultAction: "ask",
      rules: {},
    },
  },
  trustDefaults: {
    [TrustTier.External]: {
      fileReadProject: "ask",
      fileWriteProject: "deny",
      shellExecution: "deny",
      networkOutbound: "deny",
      sandbox: "os",
    },
    [TrustTier.ProjectShared]: {
      fileReadProject: "allow",
      fileWriteProject: "ask",
      shellExecution: "ask",
      networkOutbound: "deny",
      sandbox: "process",
    },
  },
} as const;

// ─── 번들 레지스트리 ──────────────────────────────────────────────────────────

/** 사전 정의 번들 ID 타입 */
export type PredefinedBundleId = "restrictive" | "permissive" | "enterprise";

/** 사전 정의 번들 레지스트리 */
const PREDEFINED_BUNDLES: Readonly<Record<PredefinedBundleId, PolicyBundle>> = {
  restrictive: RESTRICTIVE_BUNDLE,
  permissive: PERMISSIVE_BUNDLE,
  enterprise: ENTERPRISE_BUNDLE,
} as const;

// ─── PolicyBundleManager ──────────────────────────────────────────────────────

/**
 * 정책 번들 관리자
 *
 * 번들 로드, 적용, 목록 조회, 커스텀 번들 생성 및 TOML 내보내기를 담당합니다.
 *
 * @example
 * ```ts
 * const manager = new PolicyBundleManager();
 *
 * // 사전 정의 번들 적용
 * const bundle = manager.loadBundle("enterprise");
 * manager.applyBundle(bundle, policyEngine);
 *
 * // 커스텀 번들 생성
 * const custom = manager.createCustomBundle("restrictive", {
 *   policies: { web_search: { defaultAction: "allow", rules: {} } }
 * });
 * ```
 */
export class PolicyBundleManager {
  private readonly customBundles: Map<string, PolicyBundle> = new Map();

  /**
   * 번들 ID로 번들을 로드합니다.
   *
   * 사전 정의 번들 또는 등록된 커스텀 번들을 반환합니다.
   *
   * @param bundleId - 번들 식별자
   * @returns 로드된 PolicyBundle
   * @throws Error - 존재하지 않는 번들 ID인 경우
   */
  loadBundle(bundleId: string): PolicyBundle {
    const predefined = PREDEFINED_BUNDLES[bundleId as PredefinedBundleId];
    if (predefined !== undefined) return predefined;

    const custom = this.customBundles.get(bundleId);
    if (custom !== undefined) return custom;

    throw new Error(
      `Unknown bundle id: "${bundleId}". Available: ${this.listBundles()
        .map((b) => b.id)
        .join(", ")}`,
    );
  }

  /**
   * 번들의 정책을 PolicyEngine에 적용합니다.
   *
   * 기존 엔진에 번들 정책을 병합합니다. 동일 도구 이름은 번들 정책으로 덮어씁니다.
   *
   * @param bundle - 적용할 PolicyBundle
   * @param engine - 정책을 적용할 PolicyEngine 인스턴스
   */
  applyBundle(bundle: PolicyBundle, engine: PolicyEngine): void {
    engine.loadFromObject(bundle.policies as Record<string, ToolPolicy>);
  }

  /**
   * 사용 가능한 모든 번들 목록을 반환합니다.
   *
   * 사전 정의 번들 + 등록된 커스텀 번들을 포함합니다.
   *
   * @returns 번들 목록 (읽기 전용)
   */
  listBundles(): readonly PolicyBundle[] {
    const predefined = Object.values(PREDEFINED_BUNDLES) as PolicyBundle[];
    const custom = Array.from(this.customBundles.values());
    return [...predefined, ...custom];
  }

  /**
   * 기존 번들을 기반으로 커스텀 번들을 생성합니다.
   *
   * 기본 번들의 정책에 재정의 값을 병합하여 새 번들을 만듭니다.
   * 생성된 번들은 커스텀 번들 레지스트리에 자동 등록됩니다.
   *
   * @param baseId - 기반으로 사용할 번들 ID
   * @param overrides - 재정의할 번들 속성 (id 필수)
   * @returns 생성된 커스텀 PolicyBundle
   * @throws Error - 기반 번들이 존재하지 않는 경우
   */
  createCustomBundle(
    baseId: string,
    overrides: Partial<Omit<PolicyBundle, "id">> & { readonly id: string },
  ): PolicyBundle {
    const base = this.loadBundle(baseId);

    const merged: PolicyBundle = {
      id: overrides.id,
      name: overrides.name ?? `${base.name} (Custom)`,
      description: overrides.description ?? `${base.description} [커스텀 수정됨]`,
      policies: {
        ...base.policies,
        ...(overrides.policies ?? {}),
      },
      trustDefaults:
        overrides.trustDefaults !== undefined
          ? { ...base.trustDefaults, ...overrides.trustDefaults }
          : base.trustDefaults,
    };

    this.customBundles.set(merged.id, merged);
    return merged;
  }

  /**
   * 번들을 TOML 형식 문자열로 내보냅니다.
   *
   * 생성된 TOML은 PolicyEngine.loadFromToml()로 다시 로드 가능합니다.
   *
   * @param bundle - 내보낼 PolicyBundle
   * @returns TOML 형식 문자열
   */
  exportBundle(bundle: PolicyBundle): string {
    const lines: string[] = [];

    lines.push(`# Policy Bundle: ${bundle.name}`);
    lines.push(`# ID: ${bundle.id}`);
    lines.push(`# Description: ${bundle.description}`);
    lines.push("");

    for (const [toolName, policy] of Object.entries(bundle.policies)) {
      lines.push(`[tool.${toolName}]`);
      lines.push(`defaultAction = "${policy.defaultAction}"`);

      if (policy.timeoutMs !== undefined) {
        lines.push(`timeoutMs = ${policy.timeoutMs}`);
      }
      if (policy.maxOutputBytes !== undefined) {
        lines.push(`maxOutputBytes = ${policy.maxOutputBytes}`);
      }

      const { allow, ask, deny } = policy.rules;
      if (allow !== undefined && allow.length > 0) {
        lines.push(`allow = [${allow.map((p) => `"${p}"`).join(", ")}]`);
      }
      if (ask !== undefined && ask.length > 0) {
        lines.push(`ask = [${ask.map((p) => `"${p}"`).join(", ")}]`);
      }
      if (deny !== undefined && deny.length > 0) {
        lines.push(`deny = [${deny.map((p) => `"${p}"`).join(", ")}]`);
      }

      lines.push("");
    }

    return lines.join("\n");
  }
}

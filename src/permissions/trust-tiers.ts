/**
 * Trust Tier Model — 도구/스킬/MCP 서버의 신뢰 수준에 따른 권한 계층
 *
 * DHelix는 코드를 실행하는 에이전트로서, 실행 소스의 신뢰도에 따라
 * 다른 권한 정책을 적용합니다.
 *
 * Trust Tier 계층 (높은 신뢰 → 낮은 신뢰):
 * - T0 (BuiltIn)       : DHelix에 내장된 23개 핵심 도구
 * - T1 (LocallyAuthored): 사용자가 직접 작성한 스킬 (~/.dhelix/skills/)
 * - T2 (ProjectShared) : 프로젝트 팀이 공유하는 스킬 ({project}/.dhelix/)
 * - T3 (External)      : npm 패키지, 원격 MCP 서버 등 외부 소스
 *
 * 각 Tier에 대한 기본 정책은 DEFAULT_TIER_POLICIES에 정의되어 있습니다.
 * Tier가 낮을수록 더 많은 작업이 "ask" 또는 "deny"로 기본 설정됩니다.
 *
 * @example
 * ```ts
 * const tier = resolveTier("~/.dhelix/skills/my-skill.js");
 * // tier === TrustTier.LocallyAuthored
 *
 * const policy = getTierPolicy(tier);
 * // policy.shellExecution === "ask"
 * ```
 */

import { homedir } from "node:os";

/**
 * Trust Tier 열거형 — 실행 소스의 신뢰 수준
 */
export enum TrustTier {
  /** T0: DHelix 내장 23개 핵심 도구 */
  BuiltIn = "T0",
  /** T1: 사용자가 직접 작성한 로컬 스킬 (~/.dhelix/skills/) */
  LocallyAuthored = "T1",
  /** T2: 프로젝트 팀이 공유하는 스킬 ({project}/.dhelix/) */
  ProjectShared = "T2",
  /** T3: npm 패키지, 원격 MCP 서버 등 외부 소스 */
  External = "T3",
}

/**
 * Tier별 기본 정책 — 각 카테고리 작업에 대한 기본 허용 수준
 */
export interface TierPolicy {
  /** 프로젝트 내 파일 읽기 */
  readonly fileReadProject: "allow" | "ask" | "deny";
  /** 프로젝트 내 파일 쓰기 */
  readonly fileWriteProject: "allow" | "ask" | "deny";
  /** 셸 명령어 실행 */
  readonly shellExecution: "allow" | "ask" | "deny";
  /** 외부 네트워크 요청 */
  readonly networkOutbound: "allow" | "ask" | "deny";
  /**
   * 샌드박스 수준
   * - "none"    : 샌드박스 없음 (내장 도구)
   * - "process" : 프로세스 격리 (제한된 환경 변수, 경로 제한)
   * - "os"      : OS 수준 격리 (macOS Seatbelt / Linux Landlock)
   */
  readonly sandbox: "none" | "process" | "os";
}

/**
 * 각 Trust Tier의 기본 정책
 *
 * T0 (BuiltIn): 모든 프로젝트 작업 허용, 샌드박스 없음
 * T1 (LocallyAuthored): 파일 읽기/쓰기 허용, 셸/네트워크는 확인, 프로세스 격리
 * T2 (ProjectShared): 파일 읽기 허용, 파일 쓰기/셸/네트워크는 확인, 프로세스 격리
 * T3 (External): 파일 읽기만 확인, 나머지 전부 확인 또는 거부, OS 격리
 */
export const DEFAULT_TIER_POLICIES: Readonly<Record<TrustTier, TierPolicy>> = {
  [TrustTier.BuiltIn]: {
    fileReadProject: "allow",
    fileWriteProject: "allow",
    shellExecution: "allow",
    networkOutbound: "allow",
    sandbox: "none",
  },
  [TrustTier.LocallyAuthored]: {
    fileReadProject: "allow",
    fileWriteProject: "allow",
    shellExecution: "ask",
    networkOutbound: "ask",
    sandbox: "process",
  },
  [TrustTier.ProjectShared]: {
    fileReadProject: "allow",
    fileWriteProject: "ask",
    shellExecution: "ask",
    networkOutbound: "ask",
    sandbox: "process",
  },
  [TrustTier.External]: {
    fileReadProject: "ask",
    fileWriteProject: "deny",
    shellExecution: "deny",
    networkOutbound: "ask",
    sandbox: "os",
  },
} as const;

/**
 * 실행 소스 경로 또는 식별자로부터 Trust Tier를 결정합니다.
 *
 * 판별 로직:
 * 1. undefined / "builtin" → T0 (BuiltIn)
 * 2. ~/.dhelix/skills/ 경로 → T1 (LocallyAuthored)
 * 3. {project}/.dhelix/ 경로 → T2 (ProjectShared)
 * 4. "npm:" 접두사 또는 "http://" / "https://" → T3 (External)
 * 5. 그 외 알 수 없는 소스 → T3 (External, 최소 신뢰)
 *
 * @param source - 스킬 파일 경로, MCP 서버 URI, 또는 "builtin"
 * @returns 결정된 Trust Tier
 *
 * @example
 * ```ts
 * resolveTier(undefined)                          // T0 BuiltIn
 * resolveTier("builtin")                          // T0 BuiltIn
 * resolveTier("~/.dhelix/skills/my-skill.js")     // T1 LocallyAuthored
 * resolveTier("/home/user/.dhelix/skills/foo.ts") // T1 LocallyAuthored
 * resolveTier("{cwd}/.dhelix/skills/bar.js")      // T2 ProjectShared
 * resolveTier("npm:@company/dhelix-plugin")       // T3 External
 * resolveTier("https://mcp.example.com/server")   // T3 External
 * ```
 */
export function resolveTier(source: string | undefined): TrustTier {
  // T0: 명시적 builtin 또는 소스 없음
  if (source === undefined || source === "builtin") {
    return TrustTier.BuiltIn;
  }

  // ~ 경로를 절대 경로로 정규화
  const home = homedir();
  const normalized = source.startsWith("~/") ? `${home}/${source.slice(2)}` : source;

  // T3: npm 패키지 또는 원격 URL
  if (
    normalized.startsWith("npm:") ||
    normalized.startsWith("http://") ||
    normalized.startsWith("https://") ||
    normalized.startsWith("npx:")
  ) {
    return TrustTier.External;
  }

  // T1: 사용자 홈의 .dhelix/skills/ 경로
  const userSkillsDir = `${home}/.dhelix/skills`;
  const userSkillsDir2 = `${home}/.dhelix/`;
  if (normalized.startsWith(userSkillsDir) || normalized.includes("/.dhelix/skills/")) {
    // 홈 디렉토리 기준 .dhelix/skills → T1
    if (normalized.startsWith(home)) {
      return TrustTier.LocallyAuthored;
    }
  }

  // T1: 홈 디렉토리 내 .dhelix 경로
  if (normalized.startsWith(userSkillsDir2)) {
    return TrustTier.LocallyAuthored;
  }

  // T2: 프로젝트 내 .dhelix/ 경로 (홈 디렉토리가 아닌 경우)
  if (normalized.includes("/.dhelix/") || normalized.includes("\\.dhelix\\")) {
    return TrustTier.ProjectShared;
  }

  // 기본: T3 (알 수 없는 소스 → 최소 신뢰)
  return TrustTier.External;
}

/**
 * Trust Tier에 해당하는 기본 정책을 반환합니다.
 *
 * @param tier - 조회할 Trust Tier
 * @returns 해당 Tier의 기본 정책
 *
 * @example
 * ```ts
 * const policy = getTierPolicy(TrustTier.External);
 * // policy.shellExecution === "deny"
 * // policy.sandbox === "os"
 * ```
 */
export function getTierPolicy(tier: TrustTier): TierPolicy {
  return DEFAULT_TIER_POLICIES[tier];
}

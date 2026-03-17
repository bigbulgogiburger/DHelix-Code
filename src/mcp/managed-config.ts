/**
 * MCP 관리자(Managed) 설정 — 관리자 수준의 MCP 서버 정책 관리 모듈
 *
 * 기업/조직 환경에서 관리자가 MCP 서버 설정에 대한 정책을 강제할 수 있습니다.
 * 관리자 설정은 사용자/프로젝트 설정보다 우선하며,
 * 보안에 민감한 설정을 중앙에서 제어할 수 있습니다.
 *
 * 설정 파일 위치: ~/.dbcode/managed-mcp.json
 *
 * 주요 기능:
 * 1. 관리자가 MCP 서버를 사전 설정 (readOnly로 사용자 수정 방지 가능)
 * 2. 도구 허용/차단 목록 강제 (enforceAllowlist로 사용자 확장 방지)
 * 3. 글로벌 정책 설정:
 *    - allowUserServers: 사용자가 자체 서버를 추가할 수 있는지
 *    - requireApproval: 새 서버 추가 시 관리자 승인 필요 여부
 *    - maxServers: 최대 서버 수 제한
 *    - blockedTransports: 차단할 트랜스포트 타입
 *
 * 설정 파일이 없으면 모든 정책이 허용적(permissive)으로 기본 설정됩니다.
 */
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { type MCPServerConfig } from "./types.js";
import { BaseError } from "../utils/error.js";

/**
 * 관리자 MCP 설정 에러 클래스
 */
export class MCPManagedConfigError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "MCP_MANAGED_CONFIG_ERROR", context);
  }
}

/**
 * 관리자 서버 항목의 Zod 스키마
 *
 * Zod는 런타임 데이터 유효성 검사 라이브러리입니다.
 * 설정 파일의 각 서버 항목이 올바른 형식인지 검증합니다.
 */
const managedServerSchema = z.object({
  /** 트랜스포트 타입 (기본: "stdio") */
  transport: z.enum(["stdio", "http", "sse"]).default("stdio"),
  /** 실행할 명령어 (stdio용) */
  command: z.string().optional(),
  /** 명령어 인자 (stdio용) */
  args: z.array(z.string()).optional(),
  /** 서버 URL (http/sse용) */
  url: z.string().optional(),
  /** 환경 변수 */
  env: z.record(z.string()).optional(),
  // 관리자 정책 오버라이드 필드
  /** 허용할 도구 목록 — 이 목록의 도구만 사용 가능 */
  allowedTools: z.array(z.string()).optional(),
  /** 차단할 도구 목록 — 이 목록의 도구는 사용 불가 */
  blockedTools: z.array(z.string()).optional(),
  /** 허용 목록 강제 — true면 사용자가 추가 도구를 허용할 수 없음 */
  enforceAllowlist: z.boolean().optional(),
  /** 읽기 전용 — true면 사용자가 이 서버 설정을 수정할 수 없음 */
  readOnly: z.boolean().optional(),
  /** 최대 출력 토큰 수 */
  maxOutputTokens: z.number().optional(),
});

/**
 * 전체 관리자 설정 파일의 Zod 스키마
 *
 * mcpServers: 관리자가 사전 설정한 서버 목록
 * policies: 글로벌 정책 설정
 */
const managedConfigSchema = z.object({
  /** 관리자가 설정한 MCP 서버 맵 */
  mcpServers: z.record(managedServerSchema).default({}),
  /** 글로벌 정책 */
  policies: z
    .object({
      /** 사용자가 자체 서버를 추가할 수 있는지 (기본: true) */
      allowUserServers: z.boolean().default(true),
      /** 새 서버 추가 시 관리자 승인 필요 여부 (기본: false) */
      requireApproval: z.boolean().default(false),
      /** 최대 서버 수 (기본: 20) */
      maxServers: z.number().default(20),
      /** 차단할 트랜스포트 타입 목록 (기본: 빈 배열) */
      blockedTransports: z.array(z.enum(["stdio", "http", "sse"])).default([]),
    })
    .default({}),
});

/** 관리자 서버 설정 타입 (Zod 스키마에서 추론) */
export type ManagedServerConfig = z.infer<typeof managedServerSchema>;

/** 전체 관리자 설정 파일 타입 */
export type ManagedConfig = z.infer<typeof managedConfigSchema>;

/** 글로벌 관리자 정책 타입 */
export type ManagedPolicies = ManagedConfig["policies"];

/**
 * 사용자 서버 설정의 관리자 정책 검증 결과
 */
export interface ManagedConfigValidationResult {
  /** 검증 통과 여부 */
  readonly valid: boolean;
  /** 검증 실패 사유 목록 (차단 사유) */
  readonly errors: readonly string[];
  /** 경고 목록 (차단하지는 않지만 주의 필요) */
  readonly warnings: readonly string[];
}

/** 관리자 설정 파일 기본 경로 */
const DEFAULT_MANAGED_CONFIG_PATH = join(homedir(), ".dbcode", "managed-mcp.json");

/**
 * 트랜스포트 타입 결정 전의 원시 서버 설정
 */
export interface RawServerConfigInput {
  readonly command?: string;
  readonly args?: readonly string[];
  readonly url?: string;
  readonly transport?: "stdio" | "http" | "sse";
  readonly headers?: Readonly<Record<string, string>>;
}

/**
 * 서버 설정에서 트랜스포트 타입을 자동 감지합니다.
 *
 * 감지 순서:
 * 1. transport가 명시적으로 설정되어 있으면 → 해당 값 사용
 * 2. url이 있으면 → "http"
 * 3. command가 있으면 → "stdio"
 * 4. 기본값 → "stdio"
 *
 * @param config - 원시 서버 설정
 * @returns 감지된 트랜스포트 타입
 */
export function detectTransportType(config: RawServerConfigInput): "stdio" | "http" | "sse" {
  // 명시적 지정이 있으면 우선
  if (config.transport) return config.transport;

  // URL이 있으면 HTTP
  if (config.url) return "http";

  // command가 있으면 stdio
  if (config.command) return "stdio";

  // 기본 폴백
  return "stdio";
}

/**
 * 관리자 수준의 MCP 서버 설정을 처리합니다.
 *
 * 관리자 설정은 사용자/프로젝트 설정보다 우선하며,
 * 보안에 민감한 설정을 중앙에서 제어합니다.
 *
 * 설정 파일: `~/.dbcode/managed-mcp.json`
 *
 * 파일이 없으면 모든 정책이 허용적(permissive)으로 동작합니다.
 * (사용자 서버 추가 허용, 트랜스포트 제한 없음 등)
 */
export class MCPManagedConfig {
  /** 로드된 설정 (load() 호출 후 사용 가능) */
  private config: ManagedConfig | null = null;
  /** 설정 파일 경로 */
  private readonly configPath: string;

  /**
   * @param configPath - 설정 파일 경로 (기본: ~/.dbcode/managed-mcp.json)
   */
  constructor(configPath?: string) {
    this.configPath = configPath ?? DEFAULT_MANAGED_CONFIG_PATH;
  }

  /**
   * 디스크에서 관리자 설정을 로드합니다.
   *
   * 파일이 없으면 기본 허용적 설정을 반환합니다.
   * JSON 형식이 잘못되거나 스키마 검증에 실패하면 에러를 던집니다.
   *
   * @returns 로드된 관리자 설정
   * @throws MCPManagedConfigError JSON 파싱 실패 또는 스키마 검증 실패 시
   */
  async load(): Promise<ManagedConfig> {
    let raw: string;
    try {
      raw = await readFile(this.configPath, "utf-8");
    } catch {
      // 파일이 없으면 기본 허용적 설정 반환
      const defaultConfig = managedConfigSchema.parse({});
      this.config = defaultConfig;
      return defaultConfig;
    }

    // JSON 파싱
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new MCPManagedConfigError("Failed to parse managed MCP config as JSON", {
        path: this.configPath,
        cause: error instanceof Error ? error.message : String(error),
      });
    }

    // Zod 스키마 검증
    try {
      const validated = managedConfigSchema.parse(parsed);
      this.config = validated;
      return validated;
    } catch (error) {
      throw new MCPManagedConfigError("Managed MCP config failed schema validation", {
        path: this.configPath,
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * 관리자 설정 파일이 디스크에 존재하는지 확인합니다.
   *
   * @returns true면 파일 존재
   */
  async exists(): Promise<boolean> {
    try {
      await readFile(this.configPath, "utf-8");
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 관리자가 설정한 서버 목록을 반환합니다.
   *
   * load()를 먼저 호출해야 합니다.
   *
   * @returns 서버 이름 → 관리자 서버 설정 맵
   * @throws MCPManagedConfigError load()가 호출되지 않은 경우
   */
  getManagedServers(): ReadonlyMap<string, ManagedServerConfig> {
    const servers = this.getLoadedConfig().mcpServers;
    return new Map(Object.entries(servers));
  }

  /**
   * 글로벌 관리자 정책을 반환합니다.
   *
   * load()를 먼저 호출해야 합니다.
   *
   * @returns 관리자 정책 객체
   * @throws MCPManagedConfigError load()가 호출되지 않은 경우
   */
  getPolicies(): ManagedPolicies {
    return this.getLoadedConfig().policies;
  }

  /**
   * 관리자 설정과 사용자/프로젝트 설정을 병합합니다.
   *
   * 병합 우선순위 규칙:
   * - readOnly 서버: 사용자 설정 무시, 관리자 설정만 사용
   * - enforceAllowlist: 사용자가 관리자 허용 목록 이외의 도구 추가 불가
   * - 관리자 정책 필드(allowedTools, blockedTools): 사용자 필드 덮어쓰기
   * - 사용자 전용 서버: policies.allowUserServers가 true일 때만 유지
   * - 관리자 전용 서버: 항상 포함
   *
   * @param userConfigs - 사용자/프로젝트 서버 설정 맵
   * @returns 병합된 서버 설정 맵
   */
  mergeWithUserConfigs(
    userConfigs: Record<string, MCPServerConfig>,
  ): Record<string, MCPServerConfig> {
    const loaded = this.getLoadedConfig();
    const managedServers = loaded.mcpServers;
    const policies = loaded.policies;
    const result: Record<string, MCPServerConfig> = {};

    // 1. 관리자 서버를 먼저 추가
    for (const [name, managed] of Object.entries(managedServers)) {
      const userConfig = userConfigs[name];

      if (managed.readOnly || !userConfig) {
        // readOnly: 사용자 설정 무시 / 관리자 전용: 관리자 설정 그대로 사용
        result[name] = this.managedToServerConfig(name, managed);
      } else {
        // 병합: 사용자가 연결 정보 제공, 관리자가 정책 오버라이드
        result[name] = this.mergeServerConfig(name, userConfig, managed);
      }
    }

    // 2. 사용자 전용 서버 추가 (정책이 허용하는 경우만)
    if (policies.allowUserServers) {
      for (const [name, userConfig] of Object.entries(userConfigs)) {
        if (!(name in managedServers)) {
          result[name] = { ...userConfig };
        }
      }
    }

    return result;
  }

  /**
   * 사용자가 제공한 서버 설정을 관리자 정책에 따라 검증합니다.
   *
   * 검증 항목:
   * 1. 사용자 서버 추가 허용 여부 (allowUserServers)
   * 2. 트랜스포트 타입 차단 여부 (blockedTransports)
   * 3. readOnly 서버 수정 방지
   * 4. 새 서버 승인 필요 여부 (requireApproval) → 경고
   *
   * @param name - 서버 이름
   * @param config - 검증할 서버 설정
   * @returns 검증 결과 (에러, 경고 포함)
   */
  validateServerConfig(name: string, config: MCPServerConfig): ManagedConfigValidationResult {
    const loaded = this.getLoadedConfig();
    const policies = loaded.policies;
    const managedServer = loaded.mcpServers[name];
    const errors: string[] = [];
    const warnings: string[] = [];

    // 사용자 서버 추가 허용 확인
    if (!policies.allowUserServers && !managedServer) {
      errors.push("Policy does not allow user-defined servers");
    }

    // 트랜스포트 타입 차단 확인
    if (policies.blockedTransports.includes(config.transport)) {
      errors.push(`Transport "${config.transport}" is blocked by admin policy`);
    }

    // readOnly 서버 수정 방지
    if (managedServer?.readOnly) {
      errors.push(`Server "${name}" is managed as read-only and cannot be modified`);
    }

    // 새 서버 승인 필요 경고
    if (policies.requireApproval && !managedServer) {
      warnings.push("New servers require admin approval before use");
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * 현재 서버 수로 새 서버를 추가할 수 있는지 확인합니다.
   *
   * @param currentServerCount - 현재 등록된 서버 수
   * @returns true면 추가 가능
   */
  canAddServer(currentServerCount: number): boolean {
    const policies = this.getLoadedConfig().policies;

    if (!policies.allowUserServers) {
      return false;
    }

    return currentServerCount < policies.maxServers;
  }

  /**
   * 특정 트랜스포트 타입이 관리자 정책에 의해 허용되는지 확인합니다.
   *
   * @param transport - 확인할 트랜스포트 타입
   * @returns true면 허용
   */
  isTransportAllowed(transport: "stdio" | "http" | "sse"): boolean {
    const policies = this.getLoadedConfig().policies;
    return !policies.blockedTransports.includes(transport);
  }

  /**
   * 관리자 설정과 사용자 필터를 병합하여 유효 도구 필터를 계산합니다.
   *
   * 필터 병합 규칙:
   * - enforceAllowlist가 true면 → 관리자 허용 목록만 적용 (사용자 확장 불가)
   * - 둘 다 허용 목록이 있으면 → 교집합(intersection) 적용
   * - 차단 목록 → 합집합(union) 적용
   *
   * @param serverName - 서버 이름
   * @param userAllowlist - 사용자의 허용 목록 (선택)
   * @param userDenylist - 사용자의 차단 목록 (선택)
   * @returns 유효 허용/차단 목록
   */
  getEffectiveToolFilter(
    serverName: string,
    userAllowlist?: readonly string[],
    userDenylist?: readonly string[],
  ): { readonly allowlist?: readonly string[]; readonly denylist?: readonly string[] } {
    const managed = this.getLoadedConfig().mcpServers[serverName];

    if (!managed) {
      // 관리자 설정이 없으면 사용자 필터 그대로 통과
      return {
        allowlist: userAllowlist ? [...userAllowlist] : undefined,
        denylist: userDenylist ? [...userDenylist] : undefined,
      };
    }

    // 허용 목록 계산
    const allowlist = this.computeAllowlist(managed, userAllowlist);

    // 차단 목록 계산: 관리자 + 사용자 합집합
    const denylist = this.computeDenylist(managed, userDenylist);

    return { allowlist, denylist };
  }

  /**
   * load()가 호출되었는지 확인하고 로드된 설정을 반환합니다.
   *
   * @returns 로드된 설정
   * @throws MCPManagedConfigError load()가 호출되지 않은 경우
   */
  private getLoadedConfig(): ManagedConfig {
    if (!this.config) {
      throw new MCPManagedConfigError("Managed config not loaded. Call load() first.");
    }
    return this.config;
  }

  /**
   * 관리자 서버 설정을 MCPServerConfig로 변환합니다.
   *
   * @param name - 서버 이름
   * @param managed - 관리자 서버 설정
   * @returns MCPServerConfig 형태의 설정
   */
  private managedToServerConfig(name: string, managed: ManagedServerConfig): MCPServerConfig {
    return {
      name,
      transport: managed.transport,
      command: managed.command,
      args: managed.args ? [...managed.args] : undefined,
      url: managed.url,
      env: managed.env ? { ...managed.env } : undefined,
    };
  }

  /**
   * 사용자 설정과 관리자 정책을 병합합니다.
   *
   * 사용자가 연결 정보(transport, command, url 등)를 제공하고,
   * 관리자가 정책 필드(allowedTools, blockedTools 등)를 오버라이드합니다.
   *
   * @param name - 서버 이름
   * @param userConfig - 사용자 서버 설정
   * @param _managed - 관리자 서버 설정 (현재 미사용, 향후 확장용)
   * @returns 병합된 설정
   */
  private mergeServerConfig(
    name: string,
    userConfig: MCPServerConfig,
    _managed: ManagedServerConfig,
  ): MCPServerConfig {
    return {
      name,
      transport: userConfig.transport,
      command: userConfig.command,
      args: userConfig.args ? [...userConfig.args] : undefined,
      url: userConfig.url,
      env: userConfig.env ? { ...userConfig.env } : undefined,
      scope: userConfig.scope,
    };
  }

  /**
   * 유효 허용 목록을 계산합니다.
   *
   * 계산 규칙:
   * 1. enforceAllowlist=true이면 → 관리자 목록만 적용 (사용자 추가 거부)
   * 2. 관리자+사용자 둘 다 있으면 → 교집합(둘 다에 있는 도구만)
   * 3. 하나만 있으면 → 해당 목록 적용
   * 4. 둘 다 없으면 → undefined (전체 허용)
   *
   * @param managed - 관리자 서버 설정
   * @param userAllowlist - 사용자 허용 목록
   * @returns 유효 허용 목록 또는 undefined
   */
  private computeAllowlist(
    managed: ManagedServerConfig,
    userAllowlist?: readonly string[],
  ): readonly string[] | undefined {
    const managedAllowlist = managed.allowedTools;

    // enforceAllowlist: 관리자 목록을 강제 적용
    if (managed.enforceAllowlist && managedAllowlist) {
      return [...managedAllowlist];
    }

    // 둘 다 있으면 교집합
    if (managedAllowlist && userAllowlist) {
      const managedSet = new Set(managedAllowlist);
      return userAllowlist.filter((tool) => managedSet.has(tool));
    }

    if (managedAllowlist) {
      return [...managedAllowlist];
    }

    if (userAllowlist) {
      return [...userAllowlist];
    }

    return undefined;
  }

  /**
   * 유효 차단 목록을 계산합니다 (관리자 + 사용자 합집합).
   *
   * @param managed - 관리자 서버 설정
   * @param userDenylist - 사용자 차단 목록
   * @returns 유효 차단 목록 또는 undefined
   */
  private computeDenylist(
    managed: ManagedServerConfig,
    userDenylist?: readonly string[],
  ): readonly string[] | undefined {
    const managedDenylist = managed.blockedTools;

    // 둘 다 있으면 합집합 (Set으로 중복 제거)
    if (managedDenylist && userDenylist) {
      const combined = new Set([...managedDenylist, ...userDenylist]);
      return [...combined];
    }

    if (managedDenylist) {
      return [...managedDenylist];
    }

    if (userDenylist) {
      return [...userDenylist];
    }

    return undefined;
  }
}

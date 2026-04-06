/**
 * MCP 스코프 매니저 — 세 가지 범위의 MCP 설정을 관리하는 모듈
 *
 * MCP 서버 설정은 세 가지 스코프(범위)로 나뉩니다:
 * - local: .dhelix/mcp-local.json (gitignore 대상, 개발자 개인 설정)
 * - project: .dhelix/mcp.json (git에 커밋, 팀 전체 공유)
 * - user: ~/.dhelix/mcp-servers.json (사용자 글로벌 설정)
 *
 * 우선순위: local > project > user
 * → 같은 이름의 서버가 여러 스코프에 정의되어 있으면 local이 우선합니다.
 *
 * 이를 통해 팀 공용 서버는 project 스코프에,
 * 개인 개발 서버는 local 스코프에 설정할 수 있습니다.
 */
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { type MCPServerConfig, type MCPTransport } from "./types.js";

/**
 * MCP 스코프 설정 파일 형식
 *
 * 각 스코프의 JSON 파일은 이 형식을 따릅니다.
 * servers 필드 아래에 서버별 설정이 위치합니다.
 */
export interface MCPScopeConfigFile {
  readonly servers?: Readonly<Record<string, MCPScopeServerEntry>>;
}

/**
 * 스코프 설정 파일 내 서버 항목
 *
 * 서버에 연결하기 위한 기본 설정을 포함합니다.
 */
export interface MCPScopeServerEntry {
  /** 트랜스포트 타입 (기본값: "stdio") */
  readonly transport?: MCPTransport;
  /** 실행할 명령어 (stdio 트랜스포트용) */
  readonly command?: string;
  /** 명령어 인자 (stdio 트랜스포트용) */
  readonly args?: readonly string[];
  /** 서버 URL (http/sse 트랜스포트용) */
  readonly url?: string;
  /** 환경 변수 */
  readonly env?: Readonly<Record<string, string>>;
}

/**
 * 스코프 우선순위 배열 — 인덱스가 낮을수록 우선순위가 높음
 *
 * local(0) > project(1) > user(2)
 * loadAllConfigs()에서 역순으로 로딩하여 높은 우선순위가 나중에 덮어씁니다.
 */
const SCOPE_PRIORITY: readonly ("local" | "project" | "user")[] = ["local", "project", "user"];

/**
 * 세 가지 스코프의 MCP 서버 설정을 관리합니다.
 *
 * - local: `.dhelix/mcp-local.json` (gitignore 대상, 개발자 개인 설정)
 * - project: `.dhelix/mcp.json` (git에 커밋, 팀 공유)
 * - user: `~/.dhelix/mcp-servers.json` (글로벌 사용자 설정)
 *
 * 우선순위: local > project > user (같은 이름 = local이 우선).
 */
export class MCPScopeManager {
  /**
   * @param workingDirectory - 프로젝트 루트 디렉토리 (local/project 스코프 기준)
   */
  constructor(private readonly workingDirectory: string) {}

  /**
   * 모든 스코프의 설정을 로드하고 우선순위에 따라 병합합니다.
   *
   * 로딩 순서: user → project → local (역순)
   * 나중에 로딩된 설정이 같은 이름의 서버를 덮어쓰므로,
   * 결과적으로 local > project > user 우선순위가 적용됩니다.
   *
   * @returns 병합된 서버 설정 맵 (서버 이름 → MCPServerConfig)
   */
  async loadAllConfigs(): Promise<Map<string, MCPServerConfig>> {
    const merged = new Map<string, MCPServerConfig>();

    // 역순으로 로드하여 높은 우선순위가 나중에 덮어쓰도록 함
    // user(가장 낮은 우선순위) → project → local(가장 높은 우선순위)
    for (const scope of [...SCOPE_PRIORITY].reverse()) {
      const configs = await this.getConfigsForScope(scope);
      for (const config of configs) {
        merged.set(config.name, config);
      }
    }

    return merged;
  }

  /**
   * 특정 스코프의 설정만 로드합니다.
   *
   * 설정 파일이 없거나 servers 필드가 없으면 빈 배열을 반환합니다.
   *
   * @param scope - 로드할 스코프 ("local", "project", "user")
   * @returns 해당 스코프의 서버 설정 배열
   */
  async getConfigsForScope(
    scope: "local" | "project" | "user",
  ): Promise<readonly MCPServerConfig[]> {
    const filePath = this.getConfigPath(scope);
    const parsed = await this.readConfigFile(filePath);
    if (!parsed?.servers) {
      return [];
    }

    // 각 서버 항목을 MCPServerConfig 형태로 변환하고 스코프 정보 추가
    return Object.entries(parsed.servers).map(
      ([name, entry]): MCPServerConfig => ({
        name,
        transport: entry.transport ?? "stdio",
        command: entry.command,
        args: entry.args ? [...entry.args] : undefined,
        url: entry.url,
        env: entry.env ? { ...entry.env } : undefined,
        scope,
      }),
    );
  }

  /**
   * 스코프별 설정 파일 경로를 반환합니다.
   *
   * @param scope - 대상 스코프
   * @returns 설정 파일의 절대 경로
   *
   * 경로 규칙:
   * - local: {workingDirectory}/.dhelix/mcp-local.json
   * - project: {workingDirectory}/.dhelix/mcp.json
   * - user: ~/.dhelix/mcp-servers.json
   */
  getConfigPath(scope: "local" | "project" | "user"): string {
    switch (scope) {
      case "local":
        return join(this.workingDirectory, ".dhelix", "mcp-local.json");
      case "project":
        return join(this.workingDirectory, ".dhelix", "mcp.json");
      case "user":
        return join(homedir(), ".dhelix", "mcp-servers.json");
    }
  }

  /**
   * 스코프 설정 파일을 읽고 파싱합니다.
   *
   * 파일이 존재하지 않거나 JSON 파싱에 실패하면 null을 반환합니다.
   * (두 경우 모두 치명적 에러가 아님 — 해당 스코프에 설정이 없는 것으로 간주)
   *
   * @param filePath - 설정 파일 경로
   * @returns 파싱된 설정 객체 또는 null
   */
  private async readConfigFile(filePath: string): Promise<MCPScopeConfigFile | null> {
    let raw: string;
    try {
      raw = await readFile(filePath, "utf-8");
    } catch {
      // 파일이 없음 — 에러가 아님
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (typeof parsed !== "object" || parsed === null) {
        return null;
      }
      return parsed as MCPScopeConfigFile;
    } catch {
      // 잘못된 JSON — 로그 기록은 가능하지만 치명적이지 않음
      return null;
    }
  }
}

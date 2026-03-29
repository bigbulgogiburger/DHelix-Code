/**
 * /mcp 명령어 핸들러 — MCP 서버 연결 관리
 *
 * MCP(Model Context Protocol)란? LLM에게 외부 도구와 데이터 소스를
 * 제공하기 위한 표준 프로토콜입니다. 데이터베이스, API, 파일 시스템 등을
 * MCP 서버로 연결하면 LLM이 직접 해당 리소스에 접근할 수 있습니다.
 *
 * 주요 서브커맨드:
 *   /mcp list              — 설정된 MCP 서버 목록 조회 (스코프별)
 *   /mcp add <이름> <명령어> — stdio 기반 MCP 서버 추가
 *   /mcp remove <이름>     — MCP 서버 제거
 *   /mcp add -s project <이름> <명령어> — 특정 스코프에 추가
 *
 * 스코프 우선순위: local > project > user
 *   - user:    ~/.dhelix/mcp-servers.json (글로벌)
 *   - project: .dhelix/mcp.json (팀 공유, git 커밋 대상)
 *   - local:   .dhelix/mcp-local.json (개인, gitignore 대상)
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { type SlashCommand } from "./registry.js";

/** 스코프 설정 파일 형식 */
interface ScopeConfigFile {
  servers?: Record<string, ScopeServerEntry>;
}

interface ScopeServerEntry {
  transport?: string;
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
}

/**
 * 스코프별 설정 파일 경로를 반환합니다.
 */
function getConfigPath(scope: "local" | "project" | "user", workingDirectory: string): string {
  switch (scope) {
    case "local":
      return join(workingDirectory, ".dhelix", "mcp-local.json");
    case "project":
      return join(workingDirectory, ".dhelix", "mcp.json");
    case "user":
      return join(homedir(), ".dhelix", "mcp-servers.json");
  }
}

/**
 * 스코프 설정 파일을 읽습니다. 파일이 없으면 빈 객체를 반환합니다.
 */
async function readScopeConfig(filePath: string): Promise<ScopeConfigFile> {
  try {
    const raw = await readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as ScopeConfigFile;
    }
    return {};
  } catch {
    return {};
  }
}

/**
 * 스코프 설정 파일에 서버를 추가하고 저장합니다.
 */
async function addServerToConfig(
  filePath: string,
  name: string,
  entry: ScopeServerEntry,
): Promise<void> {
  const config = await readScopeConfig(filePath);
  if (!config.servers) {
    config.servers = {};
  }
  config.servers[name] = entry;
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

/**
 * 스코프 설정 파일에서 서버를 제거하고 저장합니다.
 */
async function removeServerFromConfig(filePath: string, name: string): Promise<boolean> {
  const config = await readScopeConfig(filePath);
  if (!config.servers?.[name]) {
    return false;
  }
  delete config.servers[name];
  await writeFile(filePath, JSON.stringify(config, null, 2) + "\n", "utf-8");
  return true;
}

const SCOPES = ["local", "project", "user"] as const;
type Scope = (typeof SCOPES)[number];

/**
 * 스코프 표시용 레이블
 */
function scopeLabel(scope: Scope): string {
  switch (scope) {
    case "user":
      return "user";
    case "project":
      return "project";
    case "local":
      return "local";
  }
}

/**
 * 스코프별 설명
 */
function scopeDescription(scope: Scope): string {
  switch (scope) {
    case "user":
      return `~/.dhelix/mcp-servers.json`;
    case "project":
      return `.dhelix/mcp.json`;
    case "local":
      return `.dhelix/mcp-local.json`;
  }
}

export const mcpCommand: SlashCommand = {
  name: "mcp",
  description: "Manage MCP server connections",
  usage: "/mcp <list|add|remove> [args]",
  execute: async (args, context) => {
    const parts = args.trim().split(/\s+/);
    const subcommand = parts[0]?.toLowerCase();

    switch (subcommand) {
      case "list":
        return await handleList(context.workingDirectory, context.mcpManager);

      case "add":
        return await handleAdd(parts.slice(1), context.workingDirectory);

      case "remove":
        return await handleRemove(parts.slice(1), context.workingDirectory);

      default:
        return {
          output: [
            "MCP Server Management:",
            "",
            "  /mcp list                           — List configured servers (by scope)",
            "  /mcp add <name> <command> [args...]  — Add stdio server (user scope)",
            "  /mcp add -s <scope> <name> <cmd>     — Add to specific scope",
            "  /mcp remove <name>                   — Remove server from all scopes",
            "  /mcp remove -s <scope> <name>        — Remove from specific scope",
            "",
            "Scopes (priority: local > project > user):",
            "  user     ~/.dhelix/mcp-servers.json    Global, all projects",
            "  project  .dhelix/mcp.json              Shared with team (git)",
            "  local    .dhelix/mcp-local.json        Personal (gitignored)",
          ].join("\n"),
          success: true,
        };
    }
  },
};

/**
 * /mcp list — 모든 스코프의 MCP 서버를 조회합니다.
 *
 * Claude Code 스타일로 스코프별로 그룹핑하여 표시합니다.
 * 연결 상태도 MCPManager에서 조회하여 함께 표시합니다.
 */
async function handleList(
  workingDirectory: string,
  mcpManager?: import("../mcp/manager.js").MCPManager,
): Promise<{ output: string; success: boolean }> {
  // MCPManager에서 현재 연결된 서버 이름 조회
  const connectedServers = new Set<string>(mcpManager ? mcpManager.getConnectedServers() : []);

  // MCPManager에서 서버별 등록된 도구 수 조회
  const registeredTools = mcpManager
    ? mcpManager.getRegisteredTools()
    : new Map<string, readonly string[]>();

  const lines: string[] = [];
  let totalServers = 0;
  // 이미 표시한 서버 추적 (중복 방지 — 높은 우선순위 스코프가 이김)
  const displayed = new Set<string>();

  for (const scope of SCOPES) {
    const configPath = getConfigPath(scope, workingDirectory);
    const config = await readScopeConfig(configPath);
    const servers = config.servers ?? {};
    const entries = Object.entries(servers);

    if (entries.length === 0) continue;

    lines.push(`  ${scopeLabel(scope)} (${scopeDescription(scope)})`);

    for (const [name, entry] of entries) {
      if (displayed.has(name)) {
        // 낮은 우선순위 스코프에서 같은 이름 → (overridden) 표시
        const transport = entry.transport ?? "stdio";
        const target =
          transport === "stdio"
            ? [entry.command, ...(entry.args ?? [])].join(" ")
            : (entry.url ?? "");
        lines.push(`    ${name}: ${target}`);
        lines.push(`      (overridden by higher-priority scope)`);
        totalServers++;
        continue;
      }

      displayed.add(name);
      totalServers++;

      const isConnected = connectedServers.has(name);
      const status = isConnected ? "connected" : "not connected";
      const statusIcon = isConnected ? "*" : "-";

      const transport = entry.transport ?? "stdio";
      const target =
        transport === "stdio"
          ? [entry.command, ...(entry.args ?? [])].join(" ")
          : (entry.url ?? "");

      lines.push(`    ${statusIcon} ${name}: ${target}`);

      // 도구 수 표시
      const tools = registeredTools.get(name);
      if (tools && tools.length > 0) {
        lines.push(`      ${tools.length} tools | ${status}`);
      } else {
        lines.push(`      ${status}`);
      }
    }

    lines.push("");
  }

  if (totalServers === 0) {
    return {
      output: [
        "No MCP servers configured.",
        "",
        "To add a server:",
        "  /mcp add <name> <command> [args...]",
        "",
        "Example:",
        "  /mcp add playwright npx @playwright/mcp@latest",
      ].join("\n"),
      success: true,
    };
  }

  return {
    output: lines.join("\n"),
    success: true,
  };
}

/**
 * /mcp add — MCP 서버를 설정 파일에 추가합니다.
 *
 * 기본 스코프는 user입니다.
 * -s <scope> 옵션으로 스코프를 지정할 수 있습니다.
 */
async function handleAdd(
  parts: string[],
  workingDirectory: string,
): Promise<{ output: string; success: boolean }> {
  let scope: Scope = "user";
  let remaining = parts;

  // -s <scope> 옵션 파싱
  if (remaining[0] === "-s" && remaining.length >= 2) {
    const requestedScope = remaining[1] as Scope;
    if (!SCOPES.includes(requestedScope)) {
      return {
        output: `Invalid scope: "${remaining[1]}". Must be one of: ${SCOPES.join(", ")}`,
        success: false,
      };
    }
    scope = requestedScope;
    remaining = remaining.slice(2);
  }

  const name = remaining[0];
  const commandParts = remaining.slice(1);

  if (!name || commandParts.length === 0) {
    return {
      output: [
        "Usage: /mcp add [-s <scope>] <name> <command> [args...]",
        "",
        "Examples:",
        "  /mcp add playwright npx @playwright/mcp@latest",
        "  /mcp add -s project postgres pg-mcp --port 5432",
        "  /mcp add -s local dev-db npx @dev/mcp-db",
      ].join("\n"),
      success: false,
    };
  }

  const command = commandParts[0];
  const cmdArgs = commandParts.slice(1);

  const entry: ScopeServerEntry = {
    transport: "stdio",
    command,
    ...(cmdArgs.length > 0 ? { args: cmdArgs } : {}),
  };

  const configPath = getConfigPath(scope, workingDirectory);

  try {
    await addServerToConfig(configPath, name, entry);
    return {
      output: [
        `MCP server "${name}" added to ${scopeLabel(scope)} scope.`,
        `  Config: ${configPath}`,
        `  Command: ${[command, ...cmdArgs].join(" ")}`,
        "",
        "Restart dhelix to connect to this server.",
      ].join("\n"),
      success: true,
    };
  } catch (error) {
    return {
      output: `Failed to add server: ${error instanceof Error ? error.message : String(error)}`,
      success: false,
    };
  }
}

/**
 * /mcp remove — MCP 서버를 설정 파일에서 제거합니다.
 *
 * -s <scope> 옵션이 없으면 모든 스코프에서 제거합니다.
 */
async function handleRemove(
  parts: string[],
  workingDirectory: string,
): Promise<{ output: string; success: boolean }> {
  let targetScope: Scope | null = null;
  let remaining = parts;

  // -s <scope> 옵션 파싱
  if (remaining[0] === "-s" && remaining.length >= 2) {
    const requestedScope = remaining[1] as Scope;
    if (!SCOPES.includes(requestedScope)) {
      return {
        output: `Invalid scope: "${remaining[1]}". Must be one of: ${SCOPES.join(", ")}`,
        success: false,
      };
    }
    targetScope = requestedScope;
    remaining = remaining.slice(2);
  }

  const name = remaining[0];
  if (!name) {
    return {
      output: [
        "Usage: /mcp remove [-s <scope>] <name>",
        "",
        "Examples:",
        "  /mcp remove playwright          Remove from all scopes",
        "  /mcp remove -s user playwright   Remove from user scope only",
      ].join("\n"),
      success: false,
    };
  }

  const scopesToCheck = targetScope ? [targetScope] : [...SCOPES];
  const removed: string[] = [];

  for (const scope of scopesToCheck) {
    const configPath = getConfigPath(scope, workingDirectory);
    const didRemove = await removeServerFromConfig(configPath, name);
    if (didRemove) {
      removed.push(scopeLabel(scope));
    }
  }

  if (removed.length === 0) {
    return {
      output: `MCP server "${name}" not found in ${targetScope ? `${scopeLabel(targetScope)} scope` : "any scope"}.`,
      success: false,
    };
  }

  return {
    output: [
      `MCP server "${name}" removed from: ${removed.join(", ")}`,
      "",
      "Restart dhelix for changes to take effect.",
    ].join("\n"),
    success: true,
  };
}

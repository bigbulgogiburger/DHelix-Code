/**
 * /agents 명령어 핸들러 — 에이전트 정의 관리 및 조회
 *
 * 사용자가 /agents를 입력하면 프로젝트 및 사용자 디렉토리에 등록된
 * 에이전트 정의 파일(.md)을 스캔하여 목록을 보여줍니다.
 *
 * 에이전트란 특정 역할(코드 리뷰, 보안 분석 등)을 수행하도록
 * 미리 정의된 AI 어시스턴트 프로필입니다.
 *
 * 주요 서브커맨드:
 *   /agents list       — 모든 에이전트 정의 목록 조회
 *   /agents show <name> — 특정 에이전트의 상세 정보 조회
 *   /agents types      — 내장 에이전트 타입 목록 조회
 *   /agents status     — 활성 에이전트 세션 상태 조회
 */
import { readdir, readFile, stat } from "node:fs/promises";
import { join, basename, extname } from "node:path";
import { homedir } from "node:os";
import { type SlashCommand, type CommandResult } from "./registry.js";
import { APP_NAME } from "../constants.js";
import { AGENT_TYPES, listAgentTypes } from "../subagents/agent-types.js";

/**
 * 에이전트 정의 파일에서 추출한 메타데이터 인터페이스
 *
 * 각 에이전트 .md 파일의 YAML 프론트매터(frontmatter)에서
 * 파싱된 정보를 담는 구조체입니다.
 *
 * @property name - 에이전트 이름 (프론트매터의 name 필드 또는 파일명)
 * @property description - 에이전트 설명
 * @property model - 사용할 LLM 모델 (예: "gpt-4o", "inherit"은 상위 설정 상속)
 * @property scope - 적용 범위 ("project"=프로젝트별, "user"=사용자 전역)
 * @property filePath - 에이전트 정의 파일의 절대 경로
 * @property maxTurns - 최대 대화 턴 수 제한
 * @property permissionMode - 권한 모드 ("default", "plan" 등)
 */
interface AgentFileInfo {
  readonly name: string;
  readonly description: string;
  readonly model: string;
  readonly scope: "project" | "user";
  readonly filePath: string;
  readonly maxTurns: string;
  readonly permissionMode: string;
}

/**
 * 마크다운 파일에서 YAML 스타일 프론트매터를 파싱하는 함수
 *
 * 프론트매터란? 마크다운 파일 맨 위에 `---`로 감싸진 메타데이터 영역입니다.
 * 예:
 *   ---
 *   name: code-reviewer
 *   description: 코드 리뷰 에이전트
 *   model: gpt-4o
 *   ---
 *
 * 잘못된 형식의 입력은 빈 객체({})를 반환하여 안전하게 처리합니다.
 *
 * @param content - 마크다운 파일의 전체 텍스트 내용
 * @returns key-value 쌍의 Record 객체 (예: { name: "code-reviewer", model: "gpt-4o" })
 */
function parseBasicFrontmatter(content: string): Record<string, string> {
  const lines = content.split("\n");
  if (lines[0]?.trim() !== "---") {
    return {};
  }

  const endIdx = lines.indexOf("---", 1);
  if (endIdx === -1) {
    return {};
  }

  const result: Record<string, string> = {};
  for (const line of lines.slice(1, endIdx)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) continue;

    const key = trimmed.slice(0, colonIdx).trim();
    const value = trimmed.slice(colonIdx + 1).trim();
    result[key] = value;
  }

  return result;
}

/**
 * 디렉토리를 스캔하여 .md 에이전트 정의 파일들을 찾는 함수
 *
 * 지정된 디렉토리에서 .md 확장자를 가진 파일들을 읽고,
 * 각 파일의 프론트매터에서 에이전트 메타데이터를 추출합니다.
 * 디렉토리가 없는 경우(ENOENT 에러)에도 빈 배열을 반환하여 안전하게 처리합니다.
 *
 * @param dirPath - 스캔할 디렉토리의 절대 경로
 * @param scope - 에이전트 범위 ("project"=프로젝트별, "user"=사용자 전역)
 * @returns 발견된 에이전트 정보 배열 (readonly)
 */
async function scanAgentDirectory(
  dirPath: string,
  scope: "project" | "user",
): Promise<readonly AgentFileInfo[]> {
  try {
    const entries = await readdir(dirPath);
    const mdFiles = entries.filter((f) => extname(f) === ".md");
    const agents: AgentFileInfo[] = [];

    for (const file of mdFiles) {
      const filePath = join(dirPath, file);
      try {
        const fileStat = await stat(filePath);
        if (!fileStat.isFile()) continue;

        const content = await readFile(filePath, "utf-8");
        const frontmatter = parseBasicFrontmatter(content);

        const name = frontmatter.name || basename(file, ".md");
        const description = frontmatter.description || "(no description)";
        const model = frontmatter.model || "inherit";
        const maxTurns = frontmatter["max-turns"] || frontmatter.maxTurns || "-";
        const permissionMode =
          frontmatter["permission-mode"] || frontmatter.permissionMode || "default";

        agents.push({
          name,
          description,
          model,
          scope,
          filePath,
          maxTurns,
          permissionMode,
        });
      } catch {
        // Non-fatal: skip files that fail to read or parse
      }
    }

    return agents;
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return [];
    }
    return [];
  }
}

/**
 * 에이전트 목록을 정렬된 텍스트 테이블 형태로 포맷하는 함수
 *
 * 이름, 범위, 모델, 설명을 컬럼으로 정렬하여
 * 터미널에서 보기 좋은 테이블 형태의 문자열을 생성합니다.
 *
 * @param agents - 포맷할 에이전트 정보 배열
 * @returns 테이블 형태의 문자열 (에이전트가 없으면 "(none found)" 반환)
 */
function formatAgentTable(agents: readonly AgentFileInfo[]): string {
  if (agents.length === 0) {
    return "  (none found)";
  }

  const nameWidth = Math.max(6, ...agents.map((a) => a.name.length)) + 2;
  const scopeWidth = 9;
  const modelWidth = 9;

  const header = [
    "  " + "Name".padEnd(nameWidth),
    "Scope".padEnd(scopeWidth),
    "Model".padEnd(modelWidth),
    "Description",
  ].join("");

  const separator = "  " + "-".repeat(nameWidth + scopeWidth + modelWidth + 20);

  const rows = agents.map(
    (a) =>
      "  " +
      a.name.padEnd(nameWidth) +
      a.scope.padEnd(scopeWidth) +
      a.model.padEnd(modelWidth) +
      a.description,
  );

  return [header, separator, ...rows].join("\n");
}

/**
 * /agents list 서브커맨드 — 모든 에이전트 정의 목록 표시
 *
 * 프로젝트 디렉토리(.dbcode/agents/)와 사용자 디렉토리(~/.dbcode/agents/)를
 * 동시에(Promise.all) 스캔하여 모든 에이전트를 병합된 목록으로 보여줍니다.
 *
 * @param workingDirectory - 현재 작업 디렉토리 (프로젝트 루트)
 * @returns 에이전트 목록 텍스트와 성공 여부
 */
async function handleList(workingDirectory: string): Promise<CommandResult> {
  const projectDir = join(workingDirectory, `.${APP_NAME}`, "agents");
  const userDir = join(homedir(), `.${APP_NAME}`, "agents");

  const [projectAgents, userAgents] = await Promise.all([
    scanAgentDirectory(projectDir, "project"),
    scanAgentDirectory(userDir, "user"),
  ]);

  const allAgents = [...projectAgents, ...userAgents];

  const lines = ["Agent Definitions", "=".repeat(20), ""];

  if (allAgents.length === 0) {
    lines.push("  No agent definitions found.");
    lines.push("");
    lines.push("  Create agent definitions in:");
    lines.push(`    Project: .${APP_NAME}/agents/<name>.md`);
    lines.push(`    User:    ~/.${APP_NAME}/agents/<name>.md`);
  } else {
    lines.push(formatAgentTable(allAgents));
    lines.push("");
    lines.push(`  ${allAgents.length} agent(s) found.`);
  }

  lines.push("");
  lines.push("  Use /agents show <name> for details, /agents types for built-in types.");

  return { output: lines.join("\n"), success: true };
}

/**
 * /agents show <name> 서브커맨드 — 특정 에이전트의 상세 정보 표시
 *
 * 이름으로 에이전트를 찾아 설명, 범위, 모델, 최대 턴 수, 권한 모드,
 * 파일 경로, 시스템 프롬프트 등 전체 정보를 출력합니다.
 * 에이전트를 찾지 못한 경우 유사한 이름을 제안합니다.
 *
 * @param name - 조회할 에이전트 이름
 * @param workingDirectory - 현재 작업 디렉토리
 * @returns 에이전트 상세 정보 텍스트와 성공 여부
 */
async function handleShow(
  name: string | undefined,
  workingDirectory: string,
): Promise<CommandResult> {
  if (!name) {
    return {
      output: "Usage: /agents show <name>\nProvide the agent name to inspect.",
      success: false,
    };
  }

  const projectDir = join(workingDirectory, `.${APP_NAME}`, "agents");
  const userDir = join(homedir(), `.${APP_NAME}`, "agents");

  const [projectAgents, userAgents] = await Promise.all([
    scanAgentDirectory(projectDir, "project"),
    scanAgentDirectory(userDir, "user"),
  ]);

  const allAgents = [...projectAgents, ...userAgents];
  const agent = allAgents.find((a) => a.name === name);

  if (!agent) {
    const similar = allAgents
      .filter((a) => a.name.includes(name) || name.includes(a.name))
      .map((a) => a.name);

    const lines = [`Agent "${name}" not found.`];
    if (similar.length > 0) {
      lines.push(`Did you mean: ${similar.join(", ")}?`);
    }
    if (allAgents.length > 0) {
      lines.push(`Available agents: ${allAgents.map((a) => a.name).join(", ")}`);
    } else {
      lines.push("No agent definitions found. Use /agents list for setup instructions.");
    }
    return { output: lines.join("\n"), success: false };
  }

  // Read the full file for detailed display
  let systemPrompt = "(unable to read)";
  try {
    const content = await readFile(agent.filePath, "utf-8");
    const lines = content.split("\n");
    const startIdx = lines[0]?.trim() === "---" ? lines.indexOf("---", 1) : -1;
    if (startIdx !== -1) {
      systemPrompt =
        lines
          .slice(startIdx + 1)
          .join("\n")
          .trim() || "(empty)";
    }
  } catch {
    // Keep default "(unable to read)"
  }

  const lines = [
    `Agent: ${agent.name}`,
    "=".repeat(20),
    "",
    `  Description:     ${agent.description}`,
    `  Scope:           ${agent.scope}`,
    `  Model:           ${agent.model}`,
    `  Max turns:       ${agent.maxTurns}`,
    `  Permission mode: ${agent.permissionMode}`,
    `  File:            ${agent.filePath}`,
    "",
    "System Prompt:",
    "-".repeat(20),
    systemPrompt,
  ];

  return { output: lines.join("\n"), success: true };
}

/**
 * /agents types 서브커맨드 — 내장 에이전트 타입 목록 표시
 *
 * 시스템에 미리 정의된 에이전트 타입(코드 리뷰어, 보안 분석 등)의
 * 이름, 최대 반복 횟수, 사용 가능한 도구 수, 설명을 테이블로 보여줍니다.
 *
 * @returns 내장 에이전트 타입 테이블 텍스트와 성공 여부
 */
function handleTypes(): CommandResult {
  const types = listAgentTypes();
  const typeWidth = Math.max(6, ...types.map((t) => t.length)) + 2;
  const iterWidth = 12;
  const toolsWidth = 8;

  const lines = ["Built-in Agent Types", "=".repeat(20), ""];

  const header = [
    "  " + "Type".padEnd(typeWidth),
    "Max Iters".padEnd(iterWidth),
    "Tools".padEnd(toolsWidth),
    "Description",
  ].join("");

  const separator = "  " + "-".repeat(typeWidth + iterWidth + toolsWidth + 30);

  lines.push(header);
  lines.push(separator);

  for (const typeName of types) {
    const config = AGENT_TYPES.get(typeName);
    if (!config) continue;

    lines.push(
      "  " +
        config.type.padEnd(typeWidth) +
        String(config.defaultMaxIterations).padEnd(iterWidth) +
        String(config.allowedTools.length).padEnd(toolsWidth) +
        config.description.slice(0, 80),
    );
  }

  lines.push("");
  lines.push(`  ${types.length} built-in type(s) available.`);

  return { output: lines.join("\n"), success: true };
}

/**
 * /agents status 서브커맨드 — 활성/최근 에이전트 세션 상태 표시
 *
 * 현재 실행 중이거나 최근에 완료된 에이전트 세션 정보를 보여줍니다.
 * (현재는 세션 추적 기능이 아직 연결되지 않아 안내 메시지만 표시)
 *
 * @returns 상태 텍스트와 성공 여부
 */
function handleStatus(): CommandResult {
  const lines = [
    "Agent Status",
    "=".repeat(20),
    "",
    "  No active agent sessions.",
    "",
    "  Agent session tracking will show running and recently completed agents here.",
    "  Spawn agents with the agent tool or by referencing agent definitions.",
  ];

  return { output: lines.join("\n"), success: true };
}

/**
 * /agents help 서브커맨드 — /agents 명령어 사용법 안내
 *
 * 사용 가능한 모든 서브커맨드와 에이전트 정의 파일 저장 위치를 안내합니다.
 *
 * @returns 도움말 텍스트와 성공 여부
 */
function handleHelp(): CommandResult {
  const lines = [
    "Agent Management:",
    "",
    "  /agents                        — List all agent definitions",
    "  /agents list                   — List all agent definitions",
    "  /agents show <name>            — Show details for a specific agent",
    "  /agents types                  — List built-in agent types",
    "  /agents status                 — Show active agent sessions",
    "",
    "Agent definitions are loaded from:",
    `  Project: .${APP_NAME}/agents/<name>.md`,
    `  User:    ~/.${APP_NAME}/agents/<name>.md`,
  ];

  return { output: lines.join("\n"), success: true };
}

/**
 * /agents 슬래시 명령어 정의 — 에이전트 정의 관리 및 조회
 *
 * 사용자 입력의 첫 번째 단어를 서브커맨드로 파싱하여
 * list, show, types, status 중 해당하는 핸들러로 라우팅합니다.
 * 인식할 수 없는 서브커맨드는 help를 표시합니다.
 */
export const agentsCommand: SlashCommand = {
  name: "agents",
  description: "Manage agent definitions and view available agent types",
  usage: "/agents <list|show|types|status> [args]",
  execute: async (args, context): Promise<CommandResult> => {
    const parts = args.trim().split(/\s+/);
    const subcommand = parts[0]?.toLowerCase() || "list";

    switch (subcommand) {
      case "list":
        return handleList(context.workingDirectory);
      case "show":
        return handleShow(parts[1], context.workingDirectory);
      case "types":
        return handleTypes();
      case "status":
        return handleStatus();
      default:
        return handleHelp();
    }
  },
};

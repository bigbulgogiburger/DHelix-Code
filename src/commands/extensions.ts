/**
 * /extensions 명령어 — 로드된 확장 포인트를 통합 표시
 *
 * 커맨드, 스킬, 서브에이전트, 플러그인, 도구를 한눈에 볼 수 있는
 * 통합 디스커버리 명령어입니다.
 *
 * 사용 시점: 현재 로드된 확장 포인트를 확인하고 싶을 때
 */
import { type SlashCommand, type CommandResult, type CommandContext } from "./registry.js";

/**
 * 명령어 이름을 카테고리로 분류하는 헬퍼 함수
 *
 * /extensions 표시 시 명령어를 기능 그룹별로 분류합니다.
 *
 * @param name - 명령어 이름 ("/" 접두사 제외)
 * @returns 카테고리 문자열
 */
function getCommandCategory(name: string): string {
  const categories: Record<string, string> = {
    commit: "Workflow",
    review: "Workflow",
    plan: "Workflow",
    diff: "Workflow",
    undo: "Workflow",
    rewind: "Workflow",
    simplify: "Workflow",
    clear: "Session",
    compact: "Session",
    fork: "Session",
    resume: "Session",
    export: "Session",
    rename: "Session",
    model: "Config",
    config: "Config",
    fast: "Config",
    effort: "Config",
    tone: "Config",
    voice: "Config",
    keybindings: "Config",
    "output-style": "Config",
    help: "Info",
    status: "Info",
    stats: "Info",
    cost: "Info",
    context: "Info",
    doctor: "Info",
    extensions: "Info",
    bug: "Info",
    mcp: "System",
    memory: "System",
    agents: "System",
    debug: "System",
    batch: "System",
    analytics: "System",
    update: "System",
    permissions: "System",
    init: "System",
  };
  return categories[name] ?? "Other";
}

/**
 * /extensions 슬래시 명령어 정의 — 로드된 모든 확장 포인트를 통합 표시
 *
 * 카테고리 인자를 전달하면 해당 확장 포인트만 필터링하여 표시합니다.
 * 인자 없이 실행하면 모든 카테고리를 표시합니다.
 */
export const extensionsCommand: SlashCommand = {
  name: "extensions",
  description: "Show all loaded extensions (commands, skills, subagents, tools)",
  usage: "/extensions [category]",

  async execute(args: string, context: CommandContext): Promise<CommandResult> {
    const category = args.trim().toLowerCase();
    const sections: string[] = [];

    // 헤더
    sections.push("# Extension Points\n");

    // Commands 섹션
    if (!category || category === "commands") {
      const commands = context.commandRegistry?.getAll() ?? [];
      sections.push(`## Commands (${commands.length})`);
      sections.push("Built-in slash commands. Type / to see the menu.\n");

      // 카테고리별 그룹핑
      const grouped: Record<string, string[]> = {};
      for (const cmd of commands) {
        const cat = getCommandCategory(cmd.name);
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(`  /${cmd.name} — ${cmd.description}`);
      }
      for (const [cat, cmds] of Object.entries(grouped).sort()) {
        sections.push(`**${cat}**`);
        sections.push(cmds.join("\n"));
      }
      sections.push("");
    }

    // Skills 섹션
    if (!category || category === "skills") {
      const skillCount = context.skillCount ?? 0;
      sections.push(`## Skills (${skillCount})`);
      sections.push(
        "User-defined prompt templates. Place .md files in .dhelix/skills/ or ~/.dhelix/skills/\n",
      );
      if (skillCount === 0) {
        sections.push(
          "  No skills loaded. Create a .md file with frontmatter in .dhelix/skills/ to get started.",
        );
      } else {
        sections.push(
          `  ${skillCount} skill(s) loaded. Skills with [skill] prefix in /help are invocable.`,
        );
      }
      sections.push("");
    }

    // Subagents 섹션
    if (!category || category === "subagents" || category === "agents") {
      sections.push("## Subagents");
      sections.push("Manifest-driven AI agents for specialized tasks.\n");
      sections.push(
        "  Available types: explore, plan, architect, editor, implement, test, debug, general",
      );
      sections.push("  Use /agents to manage, or the create_agent tool to spawn programmatically.");
      sections.push("");
    }

    // Tools 섹션
    if (!category || category === "tools") {
      const toolCount = context.toolCount ?? 0;
      sections.push(`## Tools (${toolCount})`);
      sections.push("Functions the LLM can call during execution.\n");
      sections.push(`  ${toolCount} tool(s) registered (built-in + MCP).`);
      sections.push("  Use /mcp to manage MCP tool servers.");
      sections.push("");
    }

    // 빠른 참조 (필터 없이 전체 표시할 때만)
    if (!category) {
      sections.push("## Quick Reference");
      sections.push("- `/extensions commands` — list all commands");
      sections.push("- `/extensions skills` — list all skills");
      sections.push("- `/extensions tools` — list all tools");
      sections.push("- `/help` — show command help");
      sections.push("- `/mcp` — manage MCP servers");
      sections.push("- `/agents` — manage subagents");
    }

    return {
      output: sections.join("\n"),
      success: true,
    };
  },
};

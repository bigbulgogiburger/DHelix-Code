import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import { join } from "node:path";
import { APP_NAME, PROJECT_CONFIG_FILE, PROJECT_CONFIG_DIR } from "../constants.js";
import { type SlashCommand } from "./registry.js";

/** Project initialization directory name */
const PROJECT_DIR = PROJECT_CONFIG_DIR;

/** Local instructions filename (should be gitignored) */
const LOCAL_INSTRUCTIONS_FILE = `${APP_NAME.toUpperCase()}.local.md`;

/** Default settings */
const DEFAULT_SETTINGS = {
  model: "gpt-4.1-mini",
  allowedTools: [
    "file_read",
    "file_write",
    "file_edit",
    "bash_exec",
    "glob_search",
    "grep_search",
  ],
};

/**
 * Detect project info from common config files and generate a DBCODE.md template.
 */
async function generateTemplate(cwd: string): Promise<string> {
  const lines: string[] = [
    `# ${APP_NAME.toUpperCase()}.md — Project Instructions`,
    "",
  ];

  // Detect package.json
  let projectName = "";
  try {
    const pkgRaw = await readFile(join(cwd, "package.json"), "utf-8");
    const pkg = JSON.parse(pkgRaw) as Record<string, unknown>;
    projectName = typeof pkg.name === "string" ? pkg.name : "";

    lines.push("## Project Overview");
    lines.push("");
    if (projectName) lines.push(`- **Name**: ${projectName}`);

    const scripts = pkg.scripts as Record<string, string> | undefined;
    if (scripts) {
      if (scripts.build) lines.push(`- **Build**: \`npm run build\` → \`${scripts.build}\``);
      if (scripts.test) lines.push(`- **Test**: \`npm test\` → \`${scripts.test}\``);
      if (scripts.lint) lines.push(`- **Lint**: \`npm run lint\` → \`${scripts.lint}\``);
    }
    lines.push("");
  } catch {
    // No package.json
  }

  // Detect tsconfig.json
  try {
    await access(join(cwd, "tsconfig.json"));
    lines.push("- **Language**: TypeScript");
    lines.push("");
  } catch {
    // Not a TS project
  }

  // Detect Cargo.toml
  try {
    await access(join(cwd, "Cargo.toml"));
    lines.push("- **Language**: Rust");
    lines.push("");
  } catch {
    // Not a Rust project
  }

  // Detect go.mod
  try {
    await access(join(cwd, "go.mod"));
    lines.push("- **Language**: Go");
    lines.push("");
  } catch {
    // Not a Go project
  }

  // Detect pyproject.toml
  try {
    await access(join(cwd, "pyproject.toml"));
    lines.push("- **Language**: Python");
    lines.push("");
  } catch {
    // Not a Python project
  }

  // If nothing was detected, add a placeholder
  if (lines.length <= 2) {
    lines.push("Add project-specific instructions here.");
    lines.push(`${APP_NAME} reads this file at the start of every session.`);
    lines.push("");
    lines.push("## Example");
    lines.push("");
    lines.push("```");
    lines.push("- Runtime: Node.js 20+");
    lines.push("- Test: vitest");
    lines.push("- Lint: eslint + prettier");
    lines.push("```");
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Append DBCODE.local.md to .gitignore if .gitignore exists and the entry is not already present.
 */
async function ensureGitignoreEntry(cwd: string): Promise<void> {
  const gitignorePath = join(cwd, ".gitignore");
  try {
    const content = await readFile(gitignorePath, "utf-8");
    // Check if already listed (exact line match)
    const lines = content.split("\n");
    if (lines.some((line) => line.trim() === LOCAL_INSTRUCTIONS_FILE)) {
      return;
    }
    const newline = content.endsWith("\n") ? "" : "\n";
    await writeFile(gitignorePath, content + newline + LOCAL_INSTRUCTIONS_FILE + "\n", "utf-8");
  } catch {
    // No .gitignore — skip
  }
}

/** Result of project initialization */
export interface InitResult {
  readonly created: boolean;
  readonly path: string;
}

/**
 * Initialize a dbcode project in the given directory.
 * Creates DBCODE.md at project root (convention) and .dbcode/ for settings and rules.
 */
export async function initProject(cwd: string): Promise<InitResult> {
  const projectPath = join(cwd, PROJECT_DIR);

  // Check if already initialized
  try {
    await access(projectPath);
    return { created: false, path: projectPath };
  } catch {
    // Directory doesn't exist — proceed
  }

  // Create .dbcode/ and .dbcode/rules/
  await mkdir(join(projectPath, "rules"), { recursive: true });

  // Add .gitkeep to rules/ so it's tracked even when empty
  await writeFile(join(projectPath, "rules", ".gitkeep"), "", "utf-8");

  // Generate project-aware template — write to project root (not .dbcode/)
  const template = await generateTemplate(cwd);
  await writeFile(join(cwd, PROJECT_CONFIG_FILE), template, "utf-8");

  await writeFile(
    join(projectPath, "settings.json"),
    JSON.stringify(DEFAULT_SETTINGS, null, 2) + "\n",
    "utf-8",
  );

  // Ensure DBCODE.local.md is in .gitignore
  await ensureGitignoreEntry(cwd);

  return { created: true, path: projectPath };
}

/** Slash command wrapper for /init */
export const initCommand: SlashCommand = {
  name: "init",
  description: "Initialize project (creates DBCODE.md and .dbcode/ directory)",
  usage: "/init",
  execute: async (_args, context) => {
    const result = await initProject(context.workingDirectory);
    if (result.created) {
      const lines = [
        `✓ 프로젝트 초기화 완료: ${result.path}`,
        "",
        "생성된 파일:",
        `  ${PROJECT_CONFIG_FILE}              — 프로젝트 지침 (AI가 매 세션 시작 시 읽음)`,
        `  ${PROJECT_DIR}/settings.json    — 모델/도구 설정`,
        `  ${PROJECT_DIR}/rules/           — 커스텀 규칙 디렉토리`,
        "",
        `${PROJECT_CONFIG_FILE}를 편집하여 프로젝트 컨벤션, 빌드/테스트 명령어, 코딩 스타일을 추가하세요.`,
      ];
      return { output: lines.join("\n"), success: true, refreshInstructions: true };
    }
    const lines = [
      `이미 초기화됨: ${result.path}`,
      "",
      `${PROJECT_CONFIG_FILE}를 편집하려면: 해당 파일을 직접 수정하세요.`,
      `초기화를 다시 하려면: ${PROJECT_DIR}/ 디렉토리를 삭제 후 /init을 실행하세요.`,
    ];
    return { output: lines.join("\n"), success: true };
  },
};

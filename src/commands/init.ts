/**
 * /init 명령어 핸들러 — 프로젝트 초기화 및 DBCODE.md 생성
 *
 * 사용자가 /init을 입력하면 현재 디렉토리의 프로젝트 구조를 분석하고,
 * LLM을 활용하여 프로젝트에 맞는 DBCODE.md(프로젝트 설정 파일)를
 * 자동 생성합니다.
 *
 * 초기화 과정:
 *   1. .dbcode/ 디렉토리 구조 생성 (settings.json, rules/ 등)
 *   2. DBCODE.md 파일 존재 여부 확인 (생성 vs 업데이트 모드 결정)
 *   3. LLM에게 코드베이스 분석 프롬프트를 주입하여 DBCODE.md 자동 생성
 *
 * DBCODE.md란? 프로젝트별 AI 어시스턴트 설정 파일로,
 * 빌드 명령어, 아키텍처 설명, 코딩 규칙 등을 담습니다.
 * Claude Code의 CLAUDE.md와 동일한 개념입니다.
 *
 * 두 가지 실행 모드:
 *   - CLI 모드 (dbcode init): LLM 없이 정적 템플릿 생성
 *   - 세션 내 모드 (/init): LLM이 코드베이스를 분석하여 풍부한 내용 생성
 */
import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import { join } from "node:path";
import { APP_NAME, PROJECT_CONFIG_FILE, PROJECT_CONFIG_DIR, DEFAULT_MODEL } from "../constants.js";
import { type SlashCommand } from "./registry.js";

/** 프로젝트 설정 디렉토리 이름 (.dbcode) */
const PROJECT_DIR = PROJECT_CONFIG_DIR;

/** 로컬 지시 파일명 — .gitignore에 추가되어 git에 커밋되지 않는 개인 설정 */
const LOCAL_INSTRUCTIONS_FILE = `${APP_NAME.toUpperCase()}.local.md`;

/** 기본 설정값 — .dbcode/settings.json에 기록되는 초기 설정 */
const DEFAULT_SETTINGS = {
  model: DEFAULT_MODEL,
  allowedTools: ["file_read", "file_write", "file_edit", "bash_exec", "glob_search", "grep_search"],
};

/**
 * 주어진 경로에 파일이 존재하는지 확인하는 헬퍼 함수
 *
 * @param filePath - 확인할 파일의 절대 경로
 * @returns 파일이 존재하면 true, 없으면 false
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * .gitignore에 DBCODE.local.md 항목을 추가하는 함수
 *
 * .gitignore가 존재하고 해당 항목이 아직 없는 경우에만 추가합니다.
 * 로컬 설정 파일이 git에 커밋되지 않도록 보호합니다.
 *
 * @param cwd - 프로젝트 루트 디렉토리
 */
async function ensureGitignoreEntry(cwd: string): Promise<void> {
  const gitignorePath = join(cwd, ".gitignore");
  try {
    const content = await readFile(gitignorePath, "utf-8");
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

/**
 * .dbcode/ 디렉토리 구조를 생성하는 함수 (없는 경우에만)
 *
 * 생성되는 구조:
 *   .dbcode/
 *     settings.json    — 모델 및 도구 설정
 *     rules/           — 커스텀 규칙 파일 디렉토리
 *       .gitkeep       — 빈 디렉토리 유지용
 *
 * @param cwd - 프로젝트 루트 디렉토리
 * @returns 새로 생성됐으면 true, 이미 존재하면 false
 */
async function ensureConfigDir(cwd: string): Promise<boolean> {
  const projectPath = join(cwd, PROJECT_DIR);
  if (await fileExists(projectPath)) {
    return false;
  }
  await mkdir(join(projectPath, "rules"), { recursive: true });
  await writeFile(join(projectPath, "rules", ".gitkeep"), "", "utf-8");
  await writeFile(
    join(projectPath, "settings.json"),
    JSON.stringify(DEFAULT_SETTINGS, null, 2) + "\n",
    "utf-8",
  );
  return true;
}

/**
 * 프로젝트 설정 파일들을 감지하여 정적 DBCODE.md 템플릿을 생성하는 함수
 *
 * package.json, tsconfig.json, Cargo.toml, go.mod, pyproject.toml 등
 * 프로젝트 설정 파일을 읽어 프로젝트 정보를 자동 감지합니다.
 *
 * CLI에서 `dbcode init` 실행 시 (에이전트 루프 외부, LLM 없이)
 * 폴백(fallback)으로 사용됩니다.
 *
 * @param cwd - 프로젝트 루트 디렉토리
 * @returns DBCODE.md 템플릿 문자열
 */
async function generateTemplate(cwd: string): Promise<string> {
  const lines: string[] = [`# ${APP_NAME.toUpperCase()}.md — Project Instructions`, ""];

  // Detect package.json
  try {
    const pkgRaw = await readFile(join(cwd, "package.json"), "utf-8");
    const pkg = JSON.parse(pkgRaw) as Record<string, unknown>;
    const projectName = typeof pkg.name === "string" ? pkg.name : "";

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
 * LLM 분석 프롬프트를 구성하는 함수 — 종합적인 DBCODE.md 생성용
 *
 * 이 프롬프트는 사용자 메시지로 주입되어 LLM이 도구(file_read, glob_search 등)를
 * 사용하여 코드베이스를 분석하고 풍부한 DBCODE.md를 생성하도록 합니다.
 * Claude Code의 /init과 동일한 방식입니다.
 *
 * @param isUpdate - true면 기존 DBCODE.md 업데이트 모드, false면 새로 생성
 * @param configDirCreated - .dbcode/ 디렉토리가 새로 생성되었는지 여부
 * @returns LLM에게 전달할 분석 프롬프트 문자열
 */
function buildAnalysisPrompt(isUpdate: boolean, configDirCreated: boolean): string {
  const contextLines: string[] = [];

  if (configDirCreated) {
    contextLines.push(
      `[/init] Created project structure:`,
      `  - ${PROJECT_DIR}/settings.json (model and tool configuration)`,
      `  - ${PROJECT_DIR}/rules/ (custom rules directory)`,
      ``,
    );
  }

  if (isUpdate) {
    contextLines.push(
      `A ${PROJECT_CONFIG_FILE} already exists. Review it and improve it based on the current codebase state.`,
      `Read the existing ${PROJECT_CONFIG_FILE} first, then analyze the codebase for anything missing or outdated.`,
      ``,
    );
  } else {
    contextLines.push(
      `Analyze this codebase and create a ${PROJECT_CONFIG_FILE} file at the project root.`,
      `This file will be read by the AI coding assistant at the start of every session.`,
      ``,
    );
  }

  const instructions = `## What to include

1. **Build/Test/Lint commands** — commonly used commands, including how to run a single test. Include package manager commands and relevant scripts.
2. **High-level architecture** — the "big picture" code structure that requires reading multiple files to understand. Focus on dependency direction, layer separation, and key abstractions.
3. **Code style conventions** — import patterns, naming conventions, error handling patterns, and project-specific rules that differ from language defaults.
4. **Key technical decisions** — framework choices, important patterns used, and constraints.

## Analysis steps

1. Read project config files (package.json, tsconfig.json, Cargo.toml, go.mod, pyproject.toml, pom.xml, build.gradle, Makefile, Gemfile, etc.)
2. Explore the top-level directory structure to understand the architecture
3. Check for README.md and incorporate important, non-obvious parts
4. Read a few key source files to understand patterns and conventions
5. Check git history for commit conventions if available

## Guidelines

- Do NOT repeat yourself or include obvious/generic instructions (e.g., "write clean code", "handle errors properly")
- Do NOT list every file or component — only document what requires reading multiple files to understand
- Do NOT make up information that isn't backed by actual project files
- Do NOT include generic development practices that any experienced developer would know
- Keep it concise — aim for under 400 lines. Prefer brevity over verbosity
- Use the project's actual directory structure, not hypothetical ones

## Required format

Start the file with:

\`\`\`
# ${APP_NAME.toUpperCase()}.md

This file provides guidance to ${APP_NAME} (AI coding assistant) when working with code in this repository.
\`\`\`

Write the result to \`${PROJECT_CONFIG_FILE}\` at the project root using file_write tool.`;

  return contextLines.join("\n") + instructions;
}

/**
 * 프로젝트 초기화 결과 인터페이스
 *
 * @property created - 새로 생성된 항목이 있으면 true
 * @property path - 프로젝트 설정 디렉토리 경로
 * @property detail - 세부 생성 정보 (DBCODE.md, .dbcode/ 각각 생성 여부)
 */
export interface InitResult {
  readonly created: boolean;
  readonly path: string;
  readonly detail?: {
    readonly dbcodeMdCreated: boolean;
    readonly configDirCreated: boolean;
  };
}

/**
 * dbcode 프로젝트를 초기화하는 함수 (CLI 폴백용)
 *
 * 프로젝트 루트에 DBCODE.md와 .dbcode/ 디렉토리를 생성합니다.
 * CLI에서 `dbcode init` 명령으로 호출됩니다 (에이전트 루프 외부).
 * 세션 내 LLM 기반 초기화는 /init 슬래시 명령어를 사용하세요.
 *
 * 두 산출물(DBCODE.md와 .dbcode/)은 독립적입니다:
 * - git clone으로 .dbcode/만 있고 DBCODE.md가 없을 수 있음
 * - DBCODE.md만 있고 .dbcode/가 없을 수도 있음
 * 각각 없는 경우에만 생성하고, 이미 있으면 건드리지 않습니다.
 *
 * @param cwd - 프로젝트 루트 디렉토리
 * @returns 초기화 결과 (생성 여부, 경로, 세부 정보)
 */
export async function initProject(cwd: string): Promise<InitResult> {
  const projectPath = join(cwd, PROJECT_DIR);
  const rootDbcodeMd = join(cwd, PROJECT_CONFIG_FILE);

  const configDirExists = await fileExists(projectPath);
  const dbcodeMdExists = await fileExists(rootDbcodeMd);

  // If both already exist, nothing to do
  if (configDirExists && dbcodeMdExists) {
    return { created: false, path: projectPath };
  }

  const detail = {
    dbcodeMdCreated: !dbcodeMdExists,
    configDirCreated: !configDirExists,
  };

  // Create .dbcode/ and .dbcode/rules/ if missing
  if (!configDirExists) {
    await ensureConfigDir(cwd);
  }

  // Create DBCODE.md at project root if missing (static template fallback)
  if (!dbcodeMdExists) {
    const template = await generateTemplate(cwd);
    await writeFile(rootDbcodeMd, template, "utf-8");
  }

  // Ensure DBCODE.local.md is in .gitignore
  await ensureGitignoreEntry(cwd);

  return { created: true, path: projectPath, detail };
}

/**
 * /init 슬래시 명령어 정의 — LLM 기반 DBCODE.md 자동 생성
 *
 * 세션 내에서 사용되며, LLM이 코드베이스를 분석하여
 * 풍부한 내용의 DBCODE.md를 생성합니다.
 *
 * shouldInjectAsUserMessage: true → 프롬프트가 사용자 메시지로 주입됨
 * refreshInstructions: true → 생성 후 프로젝트 설정을 다시 로드
 */
export const initCommand: SlashCommand = {
  name: "init",
  description: "Initialize project with AI-analyzed DBCODE.md (LLM-driven)",
  usage: "/init",
  execute: async (_args, context) => {
    const cwd = context.workingDirectory;

    // Phase 1: Create .dbcode/ directory structure (if missing)
    const configDirCreated = await ensureConfigDir(cwd);
    await ensureGitignoreEntry(cwd);

    // Phase 2: Check if DBCODE.md exists (determines create vs update mode)
    const dbcodeMdExists = await fileExists(join(cwd, PROJECT_CONFIG_FILE));

    // Phase 3: Build LLM analysis prompt and inject as user message
    const prompt = buildAnalysisPrompt(dbcodeMdExists, configDirCreated);

    return {
      output: prompt,
      success: true,
      shouldInjectAsUserMessage: true,
      refreshInstructions: true,
    };
  },
};

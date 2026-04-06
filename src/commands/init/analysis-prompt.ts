/**
 * 향상된 LLM 분석 프롬프트 빌더 — 12단계 코드베이스 분석
 *
 * 기존 5단계 분석을 12단계로 확장하여 더 정확하고 풍부한 DHELIX.md를 생성합니다.
 * Claude Code의 CLAUDE.md 품질과 동등한 수준의 프로젝트 문서를 목표로 합니다.
 *
 * 주요 개선사항:
 *   - 분석 항목: 4개 → 7개 (개발환경, CI/CD, 모노레포 추가)
 *   - 분석 단계: 5단계 → 12단계 (모노레포 감지, CI/CD, 환경변수, Docker 등)
 *   - 가이드라인 강화: 200줄 제한, 검증 가능한 지시사항, AI가 추측 불가한 정보 우선
 *   - 출력 포맷: 권장 섹션 구조 (Commands, Architecture, Code Style, Development)
 *   - 대규모 프로젝트: 서브에이전트 탐색 권장 (50+ 파일)
 *
 * @module commands/init/analysis-prompt
 */

import { APP_NAME, PROJECT_CONFIG_FILE, PROJECT_CONFIG_DIR } from "../../constants.js";

/**
 * 컨텍스트 섹션을 생성하는 헬퍼 — .dhelix/ 생성 여부와 업데이트/신규 모드에 따라 다른 메시지 구성
 *
 * @param isUpdate - true면 기존 DHELIX.md를 업데이트하는 모드
 * @param configDirCreated - .dhelix/ 디렉토리가 이번에 새로 생성되었는지 여부
 * @returns 컨텍스트 섹션 문자열 (줄바꿈으로 구분된 여러 줄)
 */
function buildContextSection(isUpdate: boolean, configDirCreated: boolean): string {
  const lines: readonly string[] = [
    ...(configDirCreated
      ? [
          `[/init] Created project structure:`,
          `  - ${PROJECT_CONFIG_DIR}/settings.json (model and tool configuration)`,
          `  - ${PROJECT_CONFIG_DIR}/rules/ (custom rules directory)`,
          ``,
        ]
      : []),
    ...(isUpdate
      ? [
          `A ${PROJECT_CONFIG_FILE} already exists. Review it and improve it based on the current codebase state.`,
          `Read the existing ${PROJECT_CONFIG_FILE} first, then analyze the codebase for anything missing or outdated.`,
          ``,
        ]
      : [
          `Analyze this codebase and create a ${PROJECT_CONFIG_FILE} file at the project root.`,
          `This file will be read by the AI coding assistant at the start of every session.`,
          ``,
        ]),
  ];

  return lines.join("\n");
}

/**
 * "What to include" 섹션을 생성하는 헬퍼 — 7가지 분석 항목 정의
 *
 * 기존 4개 항목에 개발환경, CI/CD, 모노레포 구조 3개를 추가하여
 * 실제 개발에 필요한 모든 맥락을 DHELIX.md에 포함할 수 있도록 합니다.
 *
 * @returns "What to include" 섹션 문자열
 */
function buildWhatToIncludeSection(): string {
  return `## What to include

1. **Build/Test/Lint commands** — commonly used commands, including how to run a single test. Include package manager scripts and any non-obvious invocations (e.g., \`cargo test -- --test-threads=1\`).
2. **High-level architecture** — the "big picture" code structure that requires reading multiple files to understand. Focus on dependency direction, layer separation, and key abstractions.
3. **Code style conventions** — import patterns, naming conventions, error handling patterns, and project-specific rules that differ from language defaults.
4. **Key technical decisions** — framework choices, important patterns used, and constraints (e.g., "no ORM — raw SQL only", "all state immutable").
5. **Development environment** — required environment variables (with purpose, not values), Docker/docker-compose setup, prerequisite services (database, Redis, message queue, etc.), and how to bootstrap a fresh dev environment.
6. **CI/CD workflow** — how to pass CI checks locally before pushing, required checks (lint, typecheck, test), deployment process or branch strategy if non-obvious.
7. **Monorepo structure** — if applicable: workspace layout, shared packages, inter-package dependency rules, and how to run commands for a specific package.`;
}

/**
 * 12단계 분석 절차 섹션을 생성하는 헬퍼
 *
 * 기존 5단계에서 7단계를 추가하여 모노레포 감지, CI/CD 설정, 환경변수,
 * Docker 설정, 테스트 구조, 기존 규칙 중복 방지, 진입점 의존성 추적까지 포함합니다.
 *
 * @returns 12단계 분석 절차 섹션 문자열
 */
function buildAnalysisStepsSection(): string {
  return `## Analysis steps

1. Read project config files (package.json, tsconfig.json, Cargo.toml, go.mod, pyproject.toml, pom.xml, build.gradle, Makefile, Gemfile, composer.json, mix.exs, etc.)
2. Explore the top-level directory structure to understand the architecture
3. Check README.md for non-obvious information (skip generic badges and boilerplate)
4. Read key source files to understand patterns and conventions (entry points, core modules, utilities)
5. Check git history (\`git log --oneline -20\`) for commit message conventions and recent changes
6. Detect monorepo setup — check for workspaces in package.json, nx.json, turbo.json, lerna.json, pnpm-workspace.yaml
7. Read CI/CD configs — .github/workflows/*.yml, .gitlab-ci.yml, Jenkinsfile, .circleci/config.yml, bitbucket-pipelines.yml
8. Read .env.example or .env.sample for required environment variables (document purpose, never copy values)
9. Check Dockerfile and docker-compose.yml for development environment setup and service dependencies
10. Analyze test directory structure and test runner config (vitest.config, jest.config, pytest.ini, .rspec, etc.)
11. Check existing ${PROJECT_CONFIG_DIR}/rules/ files to avoid duplicating information already captured there
12. Trace entry point to main modules to document the dependency flow (e.g., index.ts → app.ts → routes/ → controllers/ → services/)`;
}

/**
 * 가이드라인 섹션을 생성하는 헬퍼 — 강화된 품질 기준 포함
 *
 * 200줄 제한, 검증 가능한 구체성, AI가 코드에서 추측할 수 없는 정보 우선 등
 * 기존 가이드라인을 대폭 강화하여 불필요하게 긴 문서 생성을 방지합니다.
 *
 * @returns 가이드라인 섹션 문자열
 */
function buildGuidelinesSection(): string {
  return `## Guidelines

- Do NOT repeat yourself or include obvious/generic instructions (e.g., "write clean code", "handle errors properly")
- Do NOT list every file or component — only document what requires reading MULTIPLE files to understand
- Do NOT make up information that isn't backed by actual project files
- Do NOT include generic development practices that any experienced developer would know
- **Keep it under 200 lines** — if more detail is needed, create separate files in ${PROJECT_CONFIG_DIR}/rules/ (e.g., code-style.md, testing.md, security.md)
- Use the project's actual directory structure, not hypothetical ones
- **Prioritize "what the AI cannot guess from reading the code"** — build commands, required env vars, non-obvious constraints, team conventions, gotchas
- **Write instructions that are concrete enough to verify** — e.g., "2-space indent, no semicolons" instead of "format code properly"
- If the project has >50 source files, consider using a subagent to explore the codebase deeply without polluting the main conversation context`;
}

/**
 * 출력 포맷 섹션을 생성하는 헬퍼 — 권장 DHELIX.md 구조 정의
 *
 * Commands, Architecture, Code Style, Development 4개 필수 섹션과
 * 권장 포맷을 마크다운 예시로 제공합니다.
 *
 * @returns 출력 포맷 섹션 문자열
 */
function buildRequiredFormatSection(): string {
  const appNameUpper = APP_NAME.toUpperCase();

  return `## Required format

Use the following structure as a starting point. Add or remove sections based on what the project actually needs — do not include empty sections.

\`\`\`\`markdown
# ${appNameUpper}.md — {project-name}

{1-2 line project description}

## Commands

\`\`\`bash
{build/test/lint commands — include single test execution}
\`\`\`

## Architecture

{architecture description — layers, dependency direction, key modules}

## Code Style

- {import patterns — e.g., "ESM only, .js extensions required"}
- {naming conventions — e.g., "camelCase for functions, PascalCase for types"}
- {project-specific rules — e.g., "no default exports", "immutable state only"}

## Development

- {required env vars with purpose}
- {local dev environment setup}
- {prerequisite services}
\`\`\`\`

Write the result to \`${PROJECT_CONFIG_FILE}\` at the project root using file_write tool.`;
}

/**
 * 서브에이전트 탐색 지시 섹션을 생성하는 헬퍼
 *
 * 대규모 프로젝트(50+ 파일)에서 메인 컨텍스트를 오염시키지 않고
 * 깊은 코드베이스 탐색을 수행하기 위한 서브에이전트 활용 가이드입니다.
 *
 * @returns 서브에이전트 탐색 지시 섹션 문자열
 */
function buildSubagentDirectiveSection(): string {
  return `## Large project strategy

If the project contains more than 50 source files, consider the following approach to avoid overwhelming the main context:
- Use a subagent to perform deep exploration of the codebase (reading many files, tracing dependencies)
- Have the subagent report back a structured summary rather than dumping raw file contents
- Focus the main analysis on synthesizing the subagent's findings into a concise ${PROJECT_CONFIG_FILE}
- This keeps the main conversation context clean for the actual writing task`;
}

/**
 * 향상된 LLM 분석 프롬프트를 구성하는 함수 — 12단계 종합 코드베이스 분석
 *
 * 기존 {@link buildAnalysisPrompt}의 5단계 분석을 12단계로 확장하여
 * 더 정확하고 풍부한 DHELIX.md를 생성합니다.
 *
 * 프롬프트 구성:
 *   1. 컨텍스트 — .dhelix/ 생성 여부, 업데이트/신규 모드
 *   2. 포함 항목 — 7가지 분석 대상 (빌드, 아키텍처, 코드 스타일, 기술 결정, 개발환경, CI/CD, 모노레포)
 *   3. 분석 단계 — 12단계 순차 분석 절차
 *   4. 가이드라인 — 품질 기준 (200줄 제한, 구체성, 비자명 정보 우선)
 *   5. 출력 포맷 — 권장 DHELIX.md 마크다운 구조
 *   6. 서브에이전트 지시 — 대규모 프로젝트용 탐색 전략
 *
 * @param isUpdate - true면 기존 DHELIX.md를 분석하여 업데이트, false면 신규 생성
 * @param configDirCreated - .dhelix/ 디렉토리가 이번 호출에서 새로 생성되었는지 여부
 * @returns LLM에게 전달할 종합 분석 프롬프트 문자열
 *
 * @example
 * ```typescript
 * // 신규 생성 모드
 * const prompt = buildAnalysisPrompt(false, true);
 *
 * // 기존 파일 업데이트 모드
 * const prompt = buildAnalysisPrompt(true, false);
 * ```
 */
export function buildAnalysisPrompt(isUpdate: boolean, configDirCreated: boolean): string {
  const sections: readonly string[] = [
    buildContextSection(isUpdate, configDirCreated),
    buildWhatToIncludeSection(),
    "",
    buildAnalysisStepsSection(),
    "",
    buildGuidelinesSection(),
    "",
    buildRequiredFormatSection(),
    "",
    buildSubagentDirectiveSection(),
  ];

  return sections.join("\n");
}

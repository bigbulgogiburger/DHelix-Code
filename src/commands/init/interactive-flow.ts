/**
 * 대화형 초기화 플로우 모듈 — 4단계 인터랙티브 init 모드
 *
 * 기본 /init 명령이 원샷(one-shot) 방식으로 코드베이스를 분석하고
 * DBCODE.md를 바로 생성하는 것과 달리, 이 모듈은 사용자 참여를 통해
 * 4단계 대화형 초기화를 수행합니다.
 *
 * 동작 원리:
 *   /init 명령의 execute()가 반환하는 CommandResult의 output 필드는
 *   shouldInjectAsUserMessage: true에 의해 사용자 메시지로 에이전트 루프에
 *   주입됩니다. 이 모듈은 LLM이 4단계 대화형 프로세스를 수행하도록
 *   지시하는 프롬프트를 생성합니다.
 *
 * 4단계 플로우:
 *   1. 사용자 선택 — 생성할 항목을 사용자에게 질문
 *   2. 서브에이전트 탐색 — 프로젝트를 깊이 분석하는 서브에이전트 생성
 *   3. 후속 질문 — 분석 결과를 바탕으로 명확화 질문
 *   4. 미리보기 및 확인 — 작성 전 초안을 보여주고 사용자 확인
 *
 * @module commands/init/interactive-flow
 */

import { APP_NAME, PROJECT_CONFIG_FILE, PROJECT_CONFIG_DIR } from "../../constants.js";

/**
 * parseInteractiveArgs의 반환 타입 — 인터랙티브 모드 인자 파싱 결과
 *
 * @property interactive - --interactive 또는 -i 플래그 존재 여부
 * @property flags - 인터랙티브 관련 플래그를 제외한 나머지 인자 배열
 */
interface InteractiveArgs {
  readonly interactive: boolean;
  readonly flags: readonly string[];
}

/** 인터랙티브 모드를 활성화하는 플래그 목록 */
const INTERACTIVE_FLAGS: readonly string[] = ["--interactive", "-i"];

/**
 * /init 명령어의 인자를 파싱하여 인터랙티브 모드 여부를 판단하는 함수
 *
 * "--interactive" 또는 "-i" 플래그가 포함되어 있으면 인터랙티브 모드를
 * 활성화합니다. 해당 플래그를 제외한 나머지 인자들은 flags 배열로 반환됩니다.
 *
 * @example
 * ```typescript
 * const result = parseInteractiveArgs("--interactive --verbose");
 * // { interactive: true, flags: ["--verbose"] }
 *
 * const result2 = parseInteractiveArgs("-i");
 * // { interactive: true, flags: [] }
 *
 * const result3 = parseInteractiveArgs("");
 * // { interactive: false, flags: [] }
 * ```
 *
 * @param args - /init 명령어 뒤에 오는 인자 문자열 (예: "--interactive --verbose")
 * @returns 인터랙티브 모드 여부와 나머지 플래그를 포함한 불변 객체
 */
export function parseInteractiveArgs(args: string): InteractiveArgs {
  const tokens = args
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0);

  const interactive = tokens.some((token) => INTERACTIVE_FLAGS.includes(token));
  const flags = tokens.filter((token) => !INTERACTIVE_FLAGS.includes(token));

  return { interactive, flags };
}

/**
 * 4단계 대화형 초기화 프롬프트를 구성하는 함수
 *
 * LLM이 사용자와 대화하면서 프로젝트를 분석하고 설정 파일을 생성하도록
 * 지시하는 프롬프트를 반환합니다. 기본 /init의 원샷 분석과 달리,
 * 이 프롬프트는 LLM에게 4단계에 걸쳐 사용자 입력을 받으며 진행하도록 합니다.
 *
 * 각 단계의 역할:
 *   - Phase 1: 사용자에게 생성할 항목을 선택하게 하여 불필요한 작업 방지
 *   - Phase 2: 서브에이전트를 활용하여 메인 컨텍스트를 오염시키지 않고 깊이 분석
 *   - Phase 3: 자동 분석으로 파악하기 어려운 정보를 사용자에게 직접 질문
 *   - Phase 4: 최종 결과물을 사용자가 검토/수정할 기회를 제공
 *
 * @example
 * ```typescript
 * // 새 프로젝트 초기화 (디렉토리 새로 생성됨)
 * const prompt = buildInteractivePrompt(true, false);
 *
 * // 기존 DBCODE.md 업데이트
 * const prompt = buildInteractivePrompt(false, true);
 * ```
 *
 * @param configDirCreated - .dbcode/ 디렉토리가 이번 실행에서 새로 생성되었는지 여부
 * @param isUpdate - true면 기존 DBCODE.md를 업데이트, false면 새로 생성하는 모드
 * @returns LLM에게 전달할 4단계 대화형 초기화 프롬프트 문자열
 */
export function buildInteractivePrompt(configDirCreated: boolean, isUpdate: boolean): string {
  const sections: readonly string[] = [
    buildContextSection(configDirCreated, isUpdate),
    buildPhase1Section(),
    buildPhase2Section(),
    buildPhase3Section(),
    buildPhase4Section(isUpdate),
    buildGuidelinesSection(),
  ];

  return sections.join("\n\n");
}

/**
 * 컨텍스트 섹션 — 현재 상태와 모드 정보를 LLM에게 전달
 *
 * @param configDirCreated - 설정 디렉토리 생성 여부
 * @param isUpdate - 업데이트 모드 여부
 * @returns 컨텍스트 설명 문자열
 */
function buildContextSection(configDirCreated: boolean, isUpdate: boolean): string {
  const lines: string[] = [`[/init --interactive] Interactive initialization mode activated.`, ``];

  if (configDirCreated) {
    lines.push(
      `Project structure created:`,
      `  - ${PROJECT_CONFIG_DIR}/settings.json (model and tool configuration)`,
      `  - ${PROJECT_CONFIG_DIR}/rules/ (custom rules directory)`,
      ``,
    );
  }

  if (isUpdate) {
    lines.push(
      `A ${PROJECT_CONFIG_FILE} already exists. You will review and improve it through interactive conversation with the user.`,
      `Read the existing ${PROJECT_CONFIG_FILE} first before starting the interactive flow.`,
    );
  } else {
    lines.push(
      `No ${PROJECT_CONFIG_FILE} exists yet. You will create one through interactive conversation with the user.`,
      `The file will be read by ${APP_NAME} (AI coding assistant) at the start of every session.`,
    );
  }

  return lines.join("\n");
}

/**
 * Phase 1 섹션 — 사용자 선택 단계
 *
 * LLM에게 사용자에게 생성할 항목을 질문하도록 지시합니다.
 *
 * @returns Phase 1 프롬프트 문자열
 */
function buildPhase1Section(): string {
  return [
    `## Phase 1: User Selection`,
    ``,
    `Ask the user what they want to generate. Present the following options in Korean:`,
    ``,
    `"다음 중 생성할 항목을 선택하세요:`,
    `1. ${PROJECT_CONFIG_FILE} (프로젝트 가이드) [기본]`,
    `2. ${PROJECT_CONFIG_DIR}/rules/ 파일 (코딩 규칙)`,
    `3. 커스텀 규칙 파일 추가`,
    ``,
    `원하는 번호를 입력하세요 (기본: 1):"`,
    ``,
    `Wait for the user's response before proceeding to Phase 2.`,
    `If the user just presses Enter or says "1", proceed with ${PROJECT_CONFIG_FILE} generation.`,
    `If the user selects multiple options, handle all selected items through the remaining phases.`,
  ].join("\n");
}

/**
 * Phase 2 섹션 — 서브에이전트 탐색 단계
 *
 * LLM에게 서브에이전트를 생성하여 프로젝트를 깊이 분석하도록 지시합니다.
 * 서브에이전트를 사용하면 메인 컨텍스트를 깨끗하게 유지할 수 있습니다.
 *
 * @returns Phase 2 프롬프트 문자열
 */
function buildPhase2Section(): string {
  return [
    `## Phase 2: Subagent Exploration`,
    ``,
    `After the user selects what to generate, spawn a subagent with type 'explore' to deeply analyze this project:`,
    `- Read all config files (package.json, tsconfig.json, Cargo.toml, go.mod, pyproject.toml, Makefile, Dockerfile, docker-compose.yml, etc.)`,
    `- Read README.md and any existing documentation`,
    `- Read key source files to understand patterns and conventions`,
    `- Identify architecture: directory structure, layer separation, dependency direction`,
    `- Detect patterns: error handling, logging, testing, state management`,
    `- Detect CI/CD configuration (.github/workflows, .gitlab-ci.yml, Jenkinsfile, etc.)`,
    `- Detect Docker and containerization setup`,
    `- Detect environment variable requirements (.env.example, .env.template)`,
    `- Detect monorepo structure (workspaces, lerna, nx, turborepo)`,
    `- Check git history for commit conventions`,
    `- Return a structured summary with file paths and concrete examples`,
    ``,
    `This keeps the main conversation context clean while gathering comprehensive project information.`,
    `Inform the user that analysis is in progress: "프로젝트를 분석 중입니다..."`,
  ].join("\n");
}

/**
 * Phase 3 섹션 — 후속 질문 단계
 *
 * 서브에이전트의 분석 결과를 바탕으로 사용자에게 추가 정보를 질문하도록 지시합니다.
 * 자동 분석만으로는 파악하기 어려운 팀 규칙, 배포 환경 등을 수집합니다.
 *
 * @returns Phase 3 프롬프트 문자열
 */
function buildPhase3Section(): string {
  return [
    `## Phase 3: Follow-up Questions`,
    ``,
    `After the subagent returns its analysis, ask the user about anything unclear or not captured by automated analysis.`,
    `Present questions in Korean, adapting based on the analysis results:`,
    ``,
    `Possible questions (ask only relevant ones based on what the analysis found or missed):`,
    `- "테스트에 대한 특별한 요구사항이 있나요?" (Are there specific testing requirements?)`,
    `- "배포 대상 환경은 어디인가요? (예: AWS, GCP, 자체 호스팅)" (What's the deployment target?)`,
    `- "PR 리뷰 프로세스나 코딩 표준이 있나요?" (Any PR review process or coding standards?)`,
    `- "알려진 이슈나 기술 부채가 있나요?" (Any known issues or tech debt to document?)`,
    `- "팀에서 사용하는 특별한 워크플로우가 있나요?" (Any special team workflows?)`,
    ``,
    `Do not ask more than 3-4 questions. Skip questions if the analysis already clearly answers them.`,
    `Wait for the user's response before proceeding to Phase 4.`,
  ].join("\n");
}

/**
 * Phase 4 섹션 — 미리보기 및 확인 단계
 *
 * 최종 결과물을 파일에 쓰기 전에 사용자에게 미리보기를 보여주고
 * 확인을 받도록 지시합니다.
 *
 * @param isUpdate - 기존 파일 업데이트 모드인지 여부
 * @returns Phase 4 프롬프트 문자열
 */
function buildPhase4Section(isUpdate: boolean): string {
  const action = isUpdate ? "업데이트" : "생성";

  return [
    `## Phase 4: Preview and Confirm`,
    ``,
    `Before writing any files, present the complete draft to the user for review.`,
    `Show the preview in Korean:`,
    ``,
    `"다음 내용으로 ${PROJECT_CONFIG_FILE}를 ${action}하겠습니다:`,
    ``,
    `[제안 내용 미리보기 — show the full draft content here]`,
    ``,
    `계속하시겠습니까? (y/n/수정사항 입력)"`,
    ``,
    `Handle the user's response:`,
    `- "y", "yes", "네", "예" → Write the file using file_write tool`,
    `- "n", "no", "아니오" → Cancel and inform the user`,
    `- Any other text → Treat as modification request, apply changes, and show the updated preview again`,
    ``,
    `Only write the file after explicit user confirmation.`,
    `After writing, confirm to the user: "${PROJECT_CONFIG_FILE}가 ${action}되었습니다."`,
  ].join("\n");
}

/**
 * 가이드라인 섹션 — 전체 플로우에 적용되는 규칙
 *
 * @returns 가이드라인 프롬프트 문자열
 */
function buildGuidelinesSection(): string {
  return [
    `## Guidelines`,
    ``,
    `- Communicate with the user in Korean throughout the interactive flow`,
    `- Do NOT skip phases — each phase requires user interaction before moving to the next`,
    `- Do NOT write any files until Phase 4 confirmation is received`,
    `- Do NOT include obvious or generic instructions in the generated content`,
    `- Do NOT make up information — only include what is backed by actual project files`,
    `- Keep the generated content concise — aim for under 400 lines`,
    `- Use the project's actual directory structure, not hypothetical ones`,
    `- Start ${PROJECT_CONFIG_FILE} with:`,
    ``,
    "```",
    `# ${APP_NAME.toUpperCase()}.md`,
    ``,
    `This file provides guidance to ${APP_NAME} (AI coding assistant) when working with code in this repository.`,
    "```",
  ].join("\n");
}

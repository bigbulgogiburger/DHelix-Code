/**
 * 에이전트 유형 정의 레지스트리 — 내장 서브에이전트 유형들의 설정을 관리하는 모듈
 *
 * 서브에이전트(Subagent)란 메인 에이전트가 복잡한 작업을 분할하여
 * 별도의 에이전트에게 위임하는 패턴입니다.
 *
 * 각 에이전트 유형은 고유한 역할, 도구 권한, 반복 제한, 시스템 프롬프트를 가집니다.
 * 예를 들어 "explore" 유형은 읽기 전용 도구만 사용할 수 있고,
 * "general" 유형은 모든 도구에 접근할 수 있습니다.
 *
 * 현재 등록된 에이전트 유형:
 * - explore: 코드베이스 탐색 (읽기 전용)
 * - plan: 구현 계획 수립 (읽기 전용)
 * - general: 범용 작업 (모든 도구)
 * - code-reviewer: 코드 리뷰 (읽기 전용)
 * - test-runner: 테스트 실행 (읽기 + bash)
 * - security-auditor: 보안 감사 (읽기 전용)
 * - refactorer: 코드 리팩토링 (모든 도구)
 */

/** 개별 에이전트 유형의 설정 인터페이스 */
export interface AgentTypeConfig {
  /** 에이전트 유형 식별자 (예: "explore", "general") */
  readonly type: string;
  /** 에이전트의 역할과 용도를 설명하는 텍스트 */
  readonly description: string;
  /** 기본 최대 반복 횟수 — 에이전트가 최대 몇 번 도구를 호출할 수 있는지 */
  readonly defaultMaxIterations: number;
  /** 이 에이전트가 사용할 수 있는 도구 이름 목록 */
  readonly allowedTools: readonly string[];
  /** 서브에이전트 시스템 프롬프트에 추가할 지시사항 텍스트 */
  readonly systemPromptAdditions: string;
}

/**
 * 읽기 전용 도구 세트 — 여러 조사/분석용 에이전트가 공유하는 안전한 도구 목록
 * 파일 읽기, 검색만 가능하고 수정/삭제는 불가능합니다.
 */
const READ_ONLY_TOOLS = ["file_read", "glob_search", "grep_search", "list_dir"] as const;

/**
 * 모든 내장 도구 이름 목록 — 제한 없는 에이전트(general, refactorer)가 사용
 * 파일 읽기/쓰기, 코드 실행, 웹 검색 등 모든 기능 포함
 */
const ALL_TOOLS = [
  "file_read",      // 파일 내용 읽기
  "file_write",     // 파일 생성/덮어쓰기
  "file_edit",      // 파일 부분 수정
  "bash_exec",      // 셸 명령 실행
  "glob_search",    // 파일명 패턴 검색
  "grep_search",    // 파일 내용 텍스트 검색
  "list_dir",       // 디렉토리 목록 조회
  "web_fetch",      // URL에서 웹 페이지 가져오기
  "web_search",     // 웹 검색
  "notebook_edit",  // Jupyter 노트북 편집
  "mkdir",          // 디렉토리 생성
  "ask_user",       // 사용자에게 질문하기
  "agent",          // 하위 서브에이전트 생성 (중첩 위임)
  "todo_write",     // TODO 목록 관리
] as const;

/**
 * 내장 에이전트 유형 레지스트리
 *
 * 키(key)는 정규 유형 이름(소문자, 케밥 케이스)입니다.
 * 서브에이전트를 생성할 때 여기에 등록된 키를 참조하면
 * 도구 권한, 반복 제한, 시스템 프롬프트 등의 기본값을 자동으로 적용받습니다.
 *
 * Map 자료구조를 사용하여 O(1) 시간에 유형을 조회할 수 있습니다.
 */
export const AGENT_TYPES: ReadonlyMap<string, AgentTypeConfig> = new Map<string, AgentTypeConfig>([
  [
    "explore",
    {
      type: "explore",
      description:
        "Read-only codebase exploration. Investigates project structure, traces dependencies, and answers factual questions about the code.",
      defaultMaxIterations: 15,
      allowedTools: [...READ_ONLY_TOOLS],
      systemPromptAdditions: [
        "You are an explore agent. Your job is to investigate the codebase and answer questions.",
        "You have READ-ONLY access. Do NOT attempt to modify any files.",
        "Be thorough: check multiple locations and naming conventions before concluding.",
      ].join("\n"),
    },
  ],
  [
    "plan",
    {
      type: "plan",
      description:
        "Implementation planning with dependency analysis. Reads the codebase to produce structured plans, risk assessments, and phased breakdowns.",
      defaultMaxIterations: 10,
      allowedTools: [...READ_ONLY_TOOLS],
      systemPromptAdditions: [
        "You are a planning agent. Produce a clear, phased implementation plan.",
        "Identify dependencies, risks, and testing requirements for each phase.",
        "You have READ-ONLY access — do not modify files.",
      ].join("\n"),
    },
  ],
  [
    "general",
    {
      type: "general",
      description:
        "General-purpose agent with full tool access. Suitable for delegated tasks that require both reading and writing.",
      defaultMaxIterations: 25,
      allowedTools: [...ALL_TOOLS],
      systemPromptAdditions: [
        "You are a general-purpose subagent. Complete the assigned task thoroughly.",
        "Prefer minimal, targeted changes. Verify your work before finishing.",
      ].join("\n"),
    },
  ],
  [
    "code-reviewer",
    {
      type: "code-reviewer",
      description:
        "Code review agent. Reads the codebase and produces structured review feedback with severity levels (CRITICAL / HIGH / MEDIUM / LOW).",
      defaultMaxIterations: 15,
      allowedTools: [...READ_ONLY_TOOLS],
      systemPromptAdditions: [
        "You are a code-review agent. Analyze the code for correctness, style, performance, and security.",
        "Classify each finding as CRITICAL, HIGH, MEDIUM, or LOW.",
        "You have READ-ONLY access — do not modify files.",
      ].join("\n"),
    },
  ],
  [
    "test-runner",
    {
      type: "test-runner",
      description:
        "Test execution agent. Runs tests via bash, reads results, and reports failures with root-cause analysis.",
      defaultMaxIterations: 20,
      allowedTools: [...READ_ONLY_TOOLS, "bash_exec"], // 테스트 실행을 위해 bash_exec 추가
      systemPromptAdditions: [
        "You are a test-runner agent. Execute tests and analyze the results.",
        "If tests fail, investigate root causes by reading relevant source and test files.",
        "Summarize: total tests, passed, failed, and a brief root-cause for each failure.",
      ].join("\n"),
    },
  ],
  [
    "security-auditor",
    {
      type: "security-auditor",
      description:
        "Security audit agent. Scans the codebase for vulnerabilities, secret leaks, and insecure patterns.",
      defaultMaxIterations: 15,
      allowedTools: [...READ_ONLY_TOOLS],
      systemPromptAdditions: [
        "You are a security-auditor agent. Scan for vulnerabilities and insecure patterns.",
        "Check for: hardcoded secrets, injection risks, insecure dependencies, improper auth, and data exposure.",
        "Classify each finding by severity (CRITICAL / HIGH / MEDIUM / LOW) and provide remediation guidance.",
        "You have READ-ONLY access — do not modify files.",
      ].join("\n"),
    },
  ],
  [
    "refactorer",
    {
      type: "refactorer",
      description:
        "Refactoring agent with full tool access. Performs targeted code improvements: dead code removal, naming, extraction, deduplication.",
      defaultMaxIterations: 25,
      allowedTools: [...ALL_TOOLS],
      systemPromptAdditions: [
        "You are a refactoring agent. Improve code quality without changing external behavior.",
        "Focus on: dead code removal, naming clarity, function extraction, and deduplication.",
        "Make small, incremental changes. Verify the build or tests still pass after each change.",
      ].join("\n"),
    },
  ],
]);

/**
 * 이름으로 에이전트 유형 설정을 조회합니다.
 *
 * @param type - 에이전트 유형 이름 (예: "explore", "general")
 * @returns 해당 유형의 설정 객체, 등록되지 않은 유형이면 undefined
 */
export function getAgentTypeConfig(type: string): AgentTypeConfig | undefined {
  return AGENT_TYPES.get(type);
}

/**
 * 등록된 모든 에이전트 유형의 이름 목록을 반환합니다.
 *
 * @returns 에이전트 유형 이름 배열 (예: ["explore", "plan", "general", ...])
 */
export function listAgentTypes(): readonly string[] {
  return [...AGENT_TYPES.keys()];
}

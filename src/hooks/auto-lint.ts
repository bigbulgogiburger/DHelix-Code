/**
 * 자동 린트(Auto-Lint) — 파일 수정 도구 실행 후 린터를 자동 실행하는 피드백 루프
 *
 * file_write 또는 file_edit 도구가 파일을 수정하면,
 * 자동으로 린터(ESLint, ruff 등)를 실행하여 코드 품질 문제를 즉시 발견합니다.
 * 에이전트에게 린트 에러를 피드백하여 자동 수정을 유도합니다.
 *
 * 지원하는 언어별 기본 린터:
 * - .ts/.tsx/.js/.jsx → ESLint (또는 Prettier 폴백)
 * - .py → ruff check --fix || black
 * - .go → gofmt -w
 * - .rs → rustfmt
 *
 * @example
 * // 이벤트 버스에 자동 린트 등록
 * registerAutoLint(events, hookRunner, { enabled: true, lintCommand: "npx eslint" });
 *
 * @example
 * // 파일 확장자별 훅 규칙 생성
 * const rule = createAutoLintHookRule(".ts");
 * // → { matcher: "file_edit|file_write", hooks: [{ type: "command", command: "npx eslint --fix $FILE_PATH" }] }
 */

import { type HookRunner } from "./runner.js";
import { type ToolCallResult } from "../tools/types.js";
import { type AppEventEmitter } from "../utils/events.js";
import { type HookRule, type CommandHookHandler } from "./types.js";

/**
 * 파일을 수정하는 도구 이름 집합.
 * 이 도구들이 성공적으로 실행된 후 자동 린트가 트리거됩니다.
 */
const FILE_MUTATING_TOOLS = new Set(["file_write", "file_edit"]);

/**
 * 자동 린트 피드백 루프의 설정.
 */
export interface AutoLintConfig {
  /** 자동 린트 활성화 여부 (기본값: true) */
  readonly enabled: boolean;
  /** 실행할 린트 명령어 (기본값: "npx eslint --no-warn-ignored") */
  readonly lintCommand: string;
  /** 실행할 테스트 명령어 (기본값: 없음) */
  readonly testCommand?: string;
  /** 무한 루프 방지를 위한 최대 자동 수정 반복 횟수 (기본값: 3) */
  readonly maxIterations: number;
}

/** 기본 자동 린트 설정 */
export const DEFAULT_AUTO_LINT_CONFIG: AutoLintConfig = {
  enabled: true,
  lintCommand: "npx eslint --no-warn-ignored",
  maxIterations: 3,
};

/**
 * 자동 린트 검사 결과.
 */
export interface AutoLintResult {
  /** 린트한 파일 경로 */
  readonly filePath: string;
  /** 린터 출력 내용 */
  readonly lintOutput: string;
  /** 린트 에러가 있는지 여부 */
  readonly hasErrors: boolean;
  /** 테스트 출력 내용 (선택적) */
  readonly testOutput?: string;
  /** 테스트 실패 여부 (선택적) */
  readonly testFailed?: boolean;
}

/**
 * 린트 결과들을 분석하여 에이전트에게 전달할 피드백 메시지를 생성합니다.
 * 에러가 없으면 null을 반환합니다.
 *
 * @param results - 자동 린트 결과 배열
 * @returns 에러가 있으면 피드백 문자열, 없으면 null
 *
 * @example
 * const feedback = buildLintFeedback(results);
 * if (feedback) {
 *   // 에이전트 대화에 피드백 주입하여 자동 수정 유도
 *   conversation.addSystemMessage(feedback);
 * }
 */
export function buildLintFeedback(results: readonly AutoLintResult[]): string | null {
  // 에러가 있는 결과만 필터링
  const errors = results.filter((r) => r.hasErrors || r.testFailed);
  if (errors.length === 0) return null;

  const lines: string[] = ["Auto-lint detected issues in files you just modified:", ""];

  for (const result of errors) {
    // 린트 에러가 있으면 코드 블록으로 표시
    if (result.hasErrors) {
      lines.push(`## Lint errors in ${result.filePath}:`);
      lines.push("```");
      lines.push(result.lintOutput);
      lines.push("```");
      lines.push("");
    }
    // 테스트 실패가 있으면 별도로 표시
    if (result.testFailed && result.testOutput) {
      lines.push(`## Test failures after editing ${result.filePath}:`);
      lines.push("```");
      lines.push(result.testOutput);
      lines.push("```");
      lines.push("");
    }
  }

  lines.push("Please fix these issues before continuing.");

  return lines.join("\n");
}

/**
 * 파일 수정 도구의 결과에서 수정된 파일 경로를 추출합니다.
 *
 * @param toolName - 도구 이름 (예: "file_write", "file_edit")
 * @param toolResult - 도구 실행 결과
 * @returns 추출된 파일 경로, 또는 null (추출 불가 시)
 */
export function extractMutatedFiles(toolName: string, toolResult: ToolCallResult): string | null {
  // 파일 수정 도구가 아니거나 에러가 발생한 경우 무시
  if (!FILE_MUTATING_TOOLS.has(toolName)) return null;
  if (toolResult.isError) return null;

  // 출력에서 파일 경로 패턴 매칭 (wrote/created/edited/modified 뒤의 경로)
  const output = toolResult.output;
  const pathMatch = output.match(/(?:wrote|created|edited|modified)\s+(.+?)(?:\s|$)/i);
  if (pathMatch) return pathMatch[1];

  // 폴백: 출력에서 파일 경로 패턴(.확장자)을 찾기
  const fileMatch = output.match(/([^\s]+\.[a-zA-Z]{1,10})/);
  return fileMatch ? fileMatch[1] : null;
}

/**
 * 이벤트 버스에 자동 린트 핸들러를 등록합니다.
 *
 * tool:complete 이벤트를 수신하여, 파일 수정 도구가 성공적으로 완료되면
 * lint:request 이벤트를 발행합니다. CLI 레이어에서 이 이벤트를 받아
 * 실제 린트 명령을 실행합니다.
 *
 * @param events - 앱 이벤트 에미터
 * @param _hookRunner - 훅 러너 (현재 미사용, 향후 확장용)
 * @param config - 자동 린트 설정 (기본값: DEFAULT_AUTO_LINT_CONFIG)
 */
export function registerAutoLint(
  events: AppEventEmitter,
  _hookRunner: HookRunner,
  config: AutoLintConfig = DEFAULT_AUTO_LINT_CONFIG,
): void {
  if (!config.enabled) return;

  events.on("tool:complete", (payload) => {
    // 파일 수정 도구가 아니면 무시
    if (!FILE_MUTATING_TOOLS.has(payload.name)) return;
    // 도구 실행이 실패했으면 무시
    if (payload.isError) return;

    // lint:request 이벤트 발행 → CLI 레이어에서 실제 린트 명령 실행
    events.emit("lint:request", {
      toolName: payload.name,
      toolId: payload.id,
      lintCommand: config.lintCommand,
      testCommand: config.testCommand,
    });
  });
}

/**
 * 자동 린트 훅 규칙 생성 설정.
 */
export interface AutoLintHookRuleConfig {
  /** 린터 훅 활성화 여부 (기본값: true) */
  readonly enabled: boolean;
  /** 기본 린터 명령어를 재정의(override)할 명령어 */
  readonly linterOverride?: string;
}

/**
 * 파일 확장자별 기본 린터 명령어 매핑.
 * $FILE_PATH는 실행 시 실제 파일 경로로 치환됩니다.
 */
const DEFAULT_LINTERS: Readonly<Record<string, string>> = {
  ".ts": "npx eslint --fix $FILE_PATH",
  ".tsx": "npx eslint --fix $FILE_PATH",
  ".js": "npx eslint --fix $FILE_PATH",
  ".jsx": "npx eslint --fix $FILE_PATH",
  ".py": "ruff check --fix $FILE_PATH || black $FILE_PATH",
  ".go": "gofmt -w $FILE_PATH",
  ".rs": "rustfmt $FILE_PATH",
};

/** Prettier를 폴백 포매터로 사용할 수 있는 JS/TS 계열 확장자 */
const PRETTIER_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);

/**
 * 파일 확장자에 맞는 린터 명령어를 결정합니다.
 *
 * 우선순위:
 * 1. config.linterOverride (사용자 재정의)
 * 2. DEFAULT_LINTERS (확장자별 기본 명령어)
 * 3. Prettier 폴백 (JS/TS 계열만)
 * 4. null (지원하지 않는 확장자)
 *
 * @param fileExtension - 파일 확장자 (예: ".ts", ".py")
 * @param config - 린터 설정 (선택적)
 * @returns 린터 명령어 또는 null
 */
function resolveLinterCommand(
  fileExtension: string,
  config?: AutoLintHookRuleConfig,
): string | null {
  // 사용자가 명시적으로 재정의한 명령어가 있으면 우선 사용
  if (config?.linterOverride) {
    return config.linterOverride;
  }

  // 확장자별 기본 린터 명령어 조회
  const defaultCommand = DEFAULT_LINTERS[fileExtension];
  if (defaultCommand) return defaultCommand;

  // JS/TS 계열은 Prettier를 폴백으로 사용
  if (PRETTIER_EXTENSIONS.has(fileExtension)) {
    return `npx prettier --write $FILE_PATH`;
  }

  return null;
}

/**
 * 파일 확장자에 맞는 PostToolUse 훅 규칙을 생성합니다.
 *
 * file_edit과 file_write 도구에 매칭되며,
 * 해당 확장자의 린터를 command 핸들러로 실행합니다.
 *
 * @param fileExtension - 대상 파일 확장자 (예: ".ts", ".py")
 * @param config - 훅 규칙 설정 (기본값: { enabled: true })
 * @returns 설정된 HookRule, 또는 null (비활성이거나 미지원 확장자)
 *
 * @example
 * const rule = createAutoLintHookRule(".ts");
 * // → { matcher: "file_edit|file_write", hooks: [{ type: "command", command: "npx eslint --fix $FILE_PATH" }] }
 *
 * @example
 * const rule = createAutoLintHookRule(".py", { enabled: true, linterOverride: "mypy $FILE_PATH" });
 * // → 사용자 정의 명령어가 적용됨
 */
export function createAutoLintHookRule(
  fileExtension: string,
  config: AutoLintHookRuleConfig = { enabled: true },
): HookRule | null {
  if (!config.enabled) return null;

  // 확장자 정규화: 점(.)이 없으면 추가
  const normalizedExt = fileExtension.startsWith(".") ? fileExtension : `.${fileExtension}`;
  const linterCommand = resolveLinterCommand(normalizedExt, config);

  if (!linterCommand) return null;

  // command 핸들러 구성
  const handler: CommandHookHandler = {
    type: "command",
    command: linterCommand,
    timeoutMs: 30_000, // 30초 타임아웃
    blocking: false, // 린트 실패가 도구 실행을 차단하지 않음
  };

  return {
    matcher: "file_edit|file_write", // 파일 수정 도구에만 매칭
    hooks: [handler],
  };
}

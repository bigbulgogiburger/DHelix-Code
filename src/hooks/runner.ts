/**
 * 훅 러너(Hook Runner) — 이벤트에 매칭되는 훅 핸들러를 실행하는 엔진
 *
 * 이벤트 발생 시 설정된 규칙(HookRule)과 매칭하고,
 * 각 핸들러를 타입에 따라(command/http/prompt/agent) 실행합니다.
 *
 * 주요 특징:
 * - 에러 격리(error isolation): 개별 핸들러 실패가 전체 시스템을 멈추지 않음
 * - 변수 보간(interpolation): $FILE_PATH, $TOOL_NAME 등을 실제 값으로 치환
 * - 안전한 유효성 검사: eval() 대신 제한된 표현식 파싱 사용
 * - 차단(blocking) 지원: exit code 2를 반환하면 작업을 차단
 *
 * @example
 * const runner = new HookRunner(config);
 * const result = await runner.run("PostToolUse", payload);
 * if (result.blocked) {
 *   console.log("훅에 의해 차단됨:", result.blockReason);
 * }
 */

import { exec } from "node:child_process";
import { BaseError } from "../utils/error.js";
import {
  type HookConfig,
  type HookEvent,
  type HookEventPayload,
  type HookHandler,
  type HookHandlerResult,
  type HookRule,
  type HookRunResult,
  type CommandHookHandler,
  type HttpHookHandler,
  type PromptHookHandler,
  type AgentHookHandler,
} from "./types.js";

/** 훅 핸들러의 기본 타임아웃 (30초) */
const DEFAULT_HOOK_TIMEOUT_MS = 30_000;

/** 훅 실행 에러 */
export class HookError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "HOOK_ERROR", context);
  }
}

/**
 * 이벤트 페이로드의 값을 사용하여 템플릿 문자열의 변수를 치환합니다.
 *
 * 지원하는 변수:
 * - $FILE_PATH → payload.filePath
 * - $TOOL_NAME → payload.toolCall.name
 * - $SESSION_ID → payload.sessionId
 * - $WORKING_DIR → payload.workingDirectory (또는 process.cwd())
 * - $data.key → payload.data의 커스텀 키
 *
 * @param template - 변수가 포함된 템플릿 문자열
 * @param payload - 변수 값을 제공하는 이벤트 페이로드
 * @returns 변수가 치환된 문자열
 */
function interpolateVariables(template: string, payload: HookEventPayload): string {
  let result = template;
  result = result.replace(/\$FILE_PATH/g, payload.filePath ?? "");
  result = result.replace(/\$TOOL_NAME/g, payload.toolCall?.name ?? "");
  result = result.replace(/\$SESSION_ID/g, payload.sessionId ?? "");
  result = result.replace(/\$WORKING_DIR/g, payload.workingDirectory ?? process.cwd());

  // payload.data의 커스텀 키도 변수로 치환 (예: $taskId → payload.data.taskId)
  if (payload.data) {
    for (const [key, value] of Object.entries(payload.data)) {
      result = result.replace(new RegExp(`\\$${key}`, "g"), String(value));
    }
  }

  return result;
}

/**
 * 훅 규칙의 matcher가 현재 이벤트 컨텍스트와 일치하는지 확인합니다.
 *
 * - matcher가 없으면 항상 매칭됩니다.
 * - matcher는 파이프(|)로 구분된 패턴 목록입니다 (예: "file_edit|file_write").
 * - 각 패턴은 도구 이름과 정확히 일치하거나 *를 사용한 글로브 매칭을 지원합니다.
 *
 * @param rule - 확인할 훅 규칙
 * @param payload - 현재 이벤트 페이로드
 * @returns 매칭되면 true
 */
function matchesRule(rule: HookRule, payload: HookEventPayload): boolean {
  if (!rule.matcher) return true;

  // 파이프(|)로 분리하여 각 패턴을 검사
  const patterns = rule.matcher.split("|").map((p) => p.trim());
  const toolName = payload.toolCall?.name ?? "";

  return patterns.some((pattern) => {
    // 정확히 일치하는 경우
    if (pattern === toolName) return true;
    // 글로브 패턴: *를 .*로 변환하여 정규식 매칭
    const regex = new RegExp(`^${pattern.replace(/\*/g, ".*")}$`);
    return regex.test(toolName);
  });
}

/**
 * command 타입 훅 핸들러를 실행합니다.
 *
 * 실행 과정:
 * 1. 명령어 템플릿의 변수를 치환
 * 2. 셸 명령어를 자식 프로세스로 실행
 * 3. 이벤트 페이로드를 JSON으로 stdin에 전달
 * 4. 환경 변수로 DHELIX_EVENT, DHELIX_TOOL_NAME 등을 설정
 *
 * 종료 코드 의미:
 * - 0: 통과
 * - 2: 차단 (작업 중단 요청)
 * - 기타: 에러
 *
 * @param handler - command 핸들러 설정
 * @param payload - 이벤트 페이로드
 * @returns 핸들러 실행 결과
 */
async function executeCommandHandler(
  handler: CommandHookHandler,
  payload: HookEventPayload,
): Promise<HookHandlerResult> {
  // 변수 보간: $FILE_PATH 등을 실제 값으로 치환
  const command = interpolateVariables(handler.command, payload);
  const timeoutMs = handler.timeoutMs ?? DEFAULT_HOOK_TIMEOUT_MS;

  return new Promise<HookHandlerResult>((resolve) => {
    const child = exec(
      command,
      {
        timeout: timeoutMs,
        cwd: payload.workingDirectory ?? process.cwd(),
        // 환경 변수로 이벤트 정보를 전달 — 스크립트에서 활용 가능
        env: {
          ...process.env,
          DHELIX_EVENT: payload.event,
          DHELIX_TOOL_NAME: payload.toolCall?.name ?? "",
          DHELIX_FILE_PATH: payload.filePath ?? "",
          DHELIX_SESSION_ID: payload.sessionId ?? "",
        },
      },
      (error, stdout, stderr) => {
        // exec 에러 객체의 code 속성이 종료 코드
        const exitCode: number = error
          ? (((error as unknown as Record<string, unknown>).code as number) ?? 1)
          : 0;

        resolve({
          exitCode,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          blocked: exitCode === 2, // exit code 2는 차단을 의미
          handlerType: "command",
        });
      },
    );

    // 이벤트 페이로드를 JSON으로 stdin에 전달
    // EPIPE 에러를 우아하게 처리 — 자식 프로세스가 stdin 읽기 전에 종료할 수 있음
    if (child.stdin) {
      child.stdin.on("error", () => {
        // EPIPE 무시 — 자식 프로세스가 이미 종료된 정상 상황
      });
      child.stdin.write(JSON.stringify(payload));
      child.stdin.end();
    }
  });
}

/**
 * http 타입 훅 핸들러를 실행합니다.
 *
 * 이벤트 페이로드를 JSON으로 설정된 URL에 POST 전송합니다.
 * 응답이 JSON이면 { blocked: boolean, message: string } 형태를 파싱합니다.
 *
 * @param handler - http 핸들러 설정
 * @param payload - 이벤트 페이로드
 * @returns 핸들러 실행 결과
 */
async function executeHttpHandler(
  handler: HttpHookHandler,
  payload: HookEventPayload,
): Promise<HookHandlerResult> {
  const timeoutMs = handler.timeoutMs ?? DEFAULT_HOOK_TIMEOUT_MS;

  try {
    // AbortController: 타임아웃 시 요청을 중단하기 위한 메커니즘
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(handler.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...handler.headers,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timer);

    const text = await response.text();
    let blocked = false;
    let stdout = text;

    // 응답이 JSON 형태이면 blocked와 message 필드를 파싱
    try {
      const json = JSON.parse(text) as { blocked?: boolean; message?: string };
      blocked = json.blocked === true;
      stdout = json.message ?? text;
    } catch {
      // JSON이 아닌 응답 — 원시 텍스트를 그대로 사용
    }

    return {
      exitCode: response.ok ? (blocked ? 2 : 0) : 1,
      stdout,
      stderr: "",
      blocked,
      handlerType: "http",
    };
  } catch (error) {
    return {
      exitCode: 1,
      stdout: "",
      stderr: error instanceof Error ? error.message : String(error),
      blocked: false,
      handlerType: "http",
    };
  }
}

/**
 * prompt 타입 훅 핸들러를 실행합니다.
 *
 * 사용자에게 확인 프롬프트를 표시합니다.
 * - CI 모드(DHELIX_HOOK_AUTO_APPROVE=true): 자동 승인
 * - DHELIX_HOOK_REJECT=true: 자동 거부 (차단)
 * - 그 외: 프롬프트 메시지만 보고 통과
 *
 * @param handler - prompt 핸들러 설정
 * @param payload - 이벤트 페이로드
 * @returns 핸들러 실행 결과
 */
async function executePromptHandler(
  handler: PromptHookHandler,
  payload: HookEventPayload,
): Promise<HookHandlerResult> {
  // 변수 보간 적용
  const message = interpolateVariables(handler.promptMessage, payload);
  // CI 환경에서 자동 승인 여부 확인
  const isAutoApprove = process.env.DHELIX_HOOK_AUTO_APPROVE === "true";

  if (isAutoApprove) {
    return {
      exitCode: 0,
      stdout: `[prompt:auto-approved] ${message}`,
      stderr: "",
      blocked: false,
      handlerType: "prompt",
    };
  }

  // 인터랙티브 모드: 프롬프트 메시지를 보고합니다.
  // DHELIX_HOOK_REJECT 환경 변수가 "true"이면 거부(차단)로 처리
  const isRejected = process.env.DHELIX_HOOK_REJECT === "true";

  if (isRejected) {
    return {
      exitCode: 2,
      stdout: `[prompt:rejected] ${message}`,
      stderr: "",
      blocked: true,
      handlerType: "prompt",
    };
  }

  return {
    exitCode: 0,
    stdout: `[prompt:shown] ${message}`,
    stderr: "",
    blocked: false,
    handlerType: "prompt",
  };
}

/**
 * 객체에서 점(.)으로 구분된 경로를 따라 중첩된 속성 값을 안전하게 조회합니다.
 * 경로가 존재하지 않으면 undefined를 반환합니다.
 *
 * @param obj - 조회할 객체
 * @param path - 점(.)으로 구분된 속성 경로 (예: "toolCall.name")
 * @returns 조회된 값 또는 undefined
 *
 * @example
 * resolveProperty({ a: { b: { c: 42 } } }, "a.b.c") // → 42
 * resolveProperty({ a: 1 }, "a.b.c") // → undefined
 */
function resolveProperty(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/**
 * 유효성 검사 표현식을 페이로드에 대해 안전하게 평가합니다.
 *
 * eval()을 사용하지 않고, 제한된 비교 표현식만 파싱합니다:
 * - "payload.path.to.field !== 'value'" (불일치 비교)
 * - "payload.path.to.field === 'value'" (일치 비교)
 * - "!payload.path?.includes('substring')" (부정 포함 검사)
 * - "payload.path?.includes('substring')" (포함 검사)
 * - "&&" (논리 AND), "||" (논리 OR)로 복합 조건 지원
 *
 * @param validator - 유효성 검사 표현식 문자열
 * @param payload - 검사할 이벤트 페이로드
 * @returns 검증 통과 시 true (작업 허용), 실패 시 false (차단)
 */
function evaluateValidator(validator: string, payload: HookEventPayload): boolean {
  // 논리 OR(||): 하나라도 true면 통과
  if (validator.includes("||")) {
    const parts = validator.split("||").map((p) => p.trim());
    return parts.some((part) => evaluateValidator(part, payload));
  }

  // 논리 AND(&&): 모두 true여야 통과
  if (validator.includes("&&")) {
    const parts = validator.split("&&").map((p) => p.trim());
    return parts.every((part) => evaluateValidator(part, payload));
  }

  const trimmed = validator.trim();

  // 부정 includes: "!payload.path?.includes('value')"
  const negatedIncludesMatch = trimmed.match(
    /^!payload\.(.+?)\?\.includes\(\s*['"](.+?)['"]\s*\)$/,
  );
  if (negatedIncludesMatch) {
    const propPath = negatedIncludesMatch[1];
    const searchValue = negatedIncludesMatch[2];
    const resolved = resolveProperty(payload, propPath);
    if (typeof resolved === "string") {
      return !resolved.includes(searchValue);
    }
    if (Array.isArray(resolved)) {
      return !resolved.includes(searchValue);
    }
    // 속성이 없거나 string/array가 아닌 경우 — 부정이므로 true
    return true;
  }

  // 긍정 includes: "payload.path?.includes('value')"
  const includesMatch = trimmed.match(/^payload\.(.+?)\?\.includes\(\s*['"](.+?)['"]\s*\)$/);
  if (includesMatch) {
    const propPath = includesMatch[1];
    const searchValue = includesMatch[2];
    const resolved = resolveProperty(payload, propPath);
    if (typeof resolved === "string") {
      return resolved.includes(searchValue);
    }
    if (Array.isArray(resolved)) {
      return resolved.includes(searchValue);
    }
    return false;
  }

  // 엄격한 불일치(strict inequality): "payload.path !== 'value'"
  const neqMatch = trimmed.match(/^payload\.(.+?)\s*!==\s*(.+)$/);
  if (neqMatch) {
    const propPath = neqMatch[1];
    const rawValue = neqMatch[2].trim();
    const resolved = resolveProperty(payload, propPath);
    const compareValue = parseLiteralValue(rawValue);
    return resolved !== compareValue;
  }

  // 엄격한 일치(strict equality): "payload.path === 'value'"
  const eqMatch = trimmed.match(/^payload\.(.+?)\s*===\s*(.+)$/);
  if (eqMatch) {
    const propPath = eqMatch[1];
    const rawValue = eqMatch[2].trim();
    const resolved = resolveProperty(payload, propPath);
    const compareValue = parseLiteralValue(rawValue);
    return resolved === compareValue;
  }

  // 부정 truthy 검사: "!payload.path"
  const negatedTruthyMatch = trimmed.match(/^!payload\.(.+)$/);
  if (negatedTruthyMatch) {
    const propPath = negatedTruthyMatch[1];
    const resolved = resolveProperty(payload, propPath);
    return !resolved;
  }

  // truthy 검사: "payload.path"
  const truthyMatch = trimmed.match(/^payload\.(.+)$/);
  if (truthyMatch) {
    const propPath = truthyMatch[1];
    const resolved = resolveProperty(payload, propPath);
    return Boolean(resolved);
  }

  // 인식할 수 없는 표현식 — 안전을 위해 거부(false) 반환
  return false;
}

/**
 * 유효성 검사 표현식 문자열에서 리터럴 값을 파싱합니다.
 * 문자열, 불리언, null, undefined, 숫자를 지원합니다.
 *
 * @param raw - 파싱할 문자열 (예: "'hello'", "true", "42")
 * @returns 파싱된 JavaScript 값
 */
function parseLiteralValue(raw: string): unknown {
  // 따옴표로 감싸진 문자열
  const stringMatch = raw.match(/^['"](.*)['"]$/);
  if (stringMatch) return stringMatch[1];

  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw === "null") return null;
  if (raw === "undefined") return undefined;

  // 숫자
  const num = Number(raw);
  if (!Number.isNaN(num)) return num;

  return raw;
}

/**
 * agent 타입 훅 핸들러를 실행합니다.
 *
 * 선언적 유효성 검사 표현식을 이벤트 페이로드에 대해 평가합니다.
 * eval()을 사용하지 않고 안전한 표현식 파싱을 사용합니다.
 *
 * @param handler - agent 핸들러 설정
 * @param payload - 이벤트 페이로드
 * @returns 핸들러 실행 결과
 */
async function executeAgentHandler(
  handler: AgentHookHandler,
  payload: HookEventPayload,
): Promise<HookHandlerResult> {
  try {
    const passed = evaluateValidator(handler.validator, payload);

    if (passed) {
      return {
        exitCode: 0,
        stdout: `[agent:pass] ${handler.description}`,
        stderr: "",
        blocked: false,
        handlerType: "agent",
      };
    }

    return {
      exitCode: 2,
      stdout: `[agent:blocked] ${handler.description} — validator rejected the payload`,
      stderr: "",
      blocked: true,
      handlerType: "agent",
    };
  } catch (error) {
    return {
      exitCode: 1,
      stdout: "",
      stderr: `Agent validator error: ${error instanceof Error ? error.message : String(error)}`,
      blocked: false,
      handlerType: "agent",
    };
  }
}

/**
 * 단일 훅 핸들러를 타입에 따라 적절한 실행 함수로 디스패치합니다.
 *
 * @param handler - 실행할 핸들러
 * @param payload - 이벤트 페이로드
 * @returns 핸들러 실행 결과
 */
async function executeHandler(
  handler: HookHandler,
  payload: HookEventPayload,
): Promise<HookHandlerResult> {
  switch (handler.type) {
    case "command":
      return executeCommandHandler(handler, payload);
    case "http":
      return executeHttpHandler(handler, payload);
    case "prompt":
      return executePromptHandler(handler, payload);
    case "agent":
      return executeAgentHandler(handler, payload);
  }
}

/**
 * 훅 러너 — 이벤트에 매칭되는 규칙의 핸들러들을 실행하는 엔진.
 *
 * 에러 격리: 개별 핸들러의 실패가 시스템 전체를 멈추지 않습니다.
 * 실패한 핸들러의 에러 정보는 결과(results)에 포함됩니다.
 *
 * @example
 * const runner = new HookRunner(hookConfig);
 * const result = await runner.run("PostToolUse", payload);
 * if (result.blocked) {
 *   // 훅에 의해 작업이 차단됨
 * }
 */
export class HookRunner {
  constructor(private readonly config: HookConfig) {}

  /**
   * 주어진 이벤트에 대해 모든 매칭되는 훅을 실행합니다.
   *
   * 실행 순서:
   * 1. 이벤트에 설정된 규칙(rules)을 가져옵니다
   * 2. 각 규칙의 matcher와 페이로드를 대조합니다
   * 3. 매칭되는 규칙의 핸들러를 순차적으로 실행합니다
   * 4. 차단(blocking) 핸들러가 exit code 2를 반환하면 결과를 blocked로 표시합니다
   *
   * 참고: 차단 핸들러가 있어도 나머지 핸들러는 계속 실행됩니다.
   *
   * @param event - 훅 이벤트 이름
   * @param payload - 이벤트 페이로드
   * @returns 전체 훅 실행 결과
   */
  async run(event: HookEvent, payload: HookEventPayload): Promise<HookRunResult> {
    const rules = this.config[event];
    if (!rules || rules.length === 0) {
      return { blocked: false, results: [], contextOutput: "" };
    }

    // 이벤트 이름을 페이로드에 추가
    const fullPayload: HookEventPayload = { ...payload, event };
    const results: HookHandlerResult[] = [];
    let blocked = false;
    let blockReason: string | undefined;
    const contextParts: string[] = [];

    for (const rule of rules) {
      // matcher가 일치하지 않으면 건너뜀
      if (!matchesRule(rule, fullPayload)) continue;

      for (const handler of rule.hooks) {
        try {
          const result = await executeHandler(handler, fullPayload);
          results.push(result);

          // stdout이 있으면 컨텍스트 출력에 추가
          if (result.stdout) {
            contextParts.push(result.stdout);
          }

          // 차단 결과이고 핸들러가 blocking을 명시적으로 false로 설정하지 않았으면 차단
          if (result.blocked && handler.blocking !== false) {
            blocked = true;
            if (!blockReason && result.stdout) {
              blockReason = result.stdout;
            }
          }
        } catch (error) {
          // 에러 격리: 에러를 기록하되 전체 실행을 중단하지 않음
          results.push({
            exitCode: 1,
            stdout: "",
            stderr: error instanceof Error ? error.message : String(error),
            blocked: false,
            handlerType: handler.type,
          });
        }
      }
    }

    return {
      blocked,
      blockReason,
      results,
      contextOutput: contextParts.join("\n"),
    };
  }

  /**
   * 특정 이벤트에 훅이 설정되어 있는지 확인합니다.
   *
   * @param event - 확인할 이벤트 이름
   * @returns 훅이 설정되어 있으면 true
   */
  hasHooks(event: HookEvent): boolean {
    const rules = this.config[event];
    return rules !== undefined && rules.length > 0;
  }

  /**
   * 훅이 설정된 모든 이벤트 이름을 반환합니다.
   *
   * @returns 훅이 있는 이벤트 이름 배열
   */
  getConfiguredEvents(): readonly HookEvent[] {
    return (Object.keys(this.config) as HookEvent[]).filter((event) => this.hasHooks(event));
  }
}

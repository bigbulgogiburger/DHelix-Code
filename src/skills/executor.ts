/**
 * 스킬 실행기 — 스킬 본문의 동적 컨텍스트 주입과 변수 치환을 수행
 *
 * 스킬 실행 흐름 (보안상 순서가 중요):
 * 1. 동적 컨텍스트 주입 (resolveDynamicContext): `!command` 구문을 셸 명령 실행 결과로 교체
 * 2. 변수 치환 (interpolateVariables): $ARGUMENTS, $0, $1 등을 실제 값으로 교체
 * 3. 최종 프롬프트 생성: LLM에 전송할 준비 완료
 *
 * 보안 노트: 동적 컨텍스트(셸 명령)를 변수 치환보다 먼저 수행하여,
 * 사용자 입력($ARGUMENTS)이 exec()에 도달하는 셸 인젝션을 방지합니다.
 *
 * 예시 스킬 본문:
 * "현재 브랜치는 `!git branch --show-current`이고, $ARGUMENTS를 분석해주세요."
 * → "현재 브랜치는 main이고, src/index.ts를 분석해주세요."
 */

import { execFile } from "node:child_process";
import { BaseError } from "../utils/error.js";
import { type SkillDefinition, type SkillContext, type SkillExecutionResult } from "./types.js";

/**
 * 스킬 실행 에러 — 스킬 실행 중 발생한 오류를 래핑
 */
export class SkillExecutionError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "SKILL_EXECUTION_ERROR", context);
  }
}

/** 동적 컨텍스트 주입용 셸 명령 실행 타임아웃 (10초) */
const COMMAND_TIMEOUT_MS = 10_000;

/**
 * 스킬 본문의 변수를 실제 값으로 치환하는 함수
 *
 * 지원하는 변수 문법:
 * - $ARGUMENTS: 전체 인자 문자열 (예: "fix auth bug")
 * - $ARGUMENTS[N]: N번째 인자 (0부터 시작)
 * - $0, $1, $2...: 위치별 인자 (= $ARGUMENTS[N])
 * - ${DHELIX_SESSION_ID}: 현재 세션 ID
 * - ${DHELIX_SKILL_DIR}: 스킬 파일이 위치한 디렉토리
 * - ${DHELIX_PROJECT_DIR}: 프로젝트 루트 디렉토리
 *
 * @param body - 변수가 포함된 스킬 본문 원본
 * @param context - 변수에 대입할 런타임 컨텍스트 정보
 * @returns 변수가 치환된 결과 문자열
 */
function interpolateVariables(body: string, context: SkillContext): string {
  let result = body;

  // $ARGUMENTS — 전체 인자 문자열로 치환 (뒤에 [가 오는 경우는 제외)
  result = result.replace(/\$ARGUMENTS(?!\[)/g, context.arguments);

  // $ARGUMENTS[N] — 배열 문법으로 N번째 인자 접근
  result = result.replace(/\$ARGUMENTS\[(\d+)\]/g, (_, idx: string) => {
    return context.positionalArgs[Number(idx)] ?? "";
  });

  // $0, $1, $2 ... — 위치별 인자 (셸 스크립트의 $1, $2와 유사)
  result = result.replace(/\$(\d+)/g, (_, idx: string) => {
    return context.positionalArgs[Number(idx)] ?? "";
  });

  // ${DHELIX_SESSION_ID} — 현재 세션의 고유 식별자
  result = result.replace(/\$\{DHELIX_SESSION_ID\}/g, context.sessionId ?? "");

  // ${DHELIX_SKILL_DIR} — 스킬 파일이 있는 디렉토리 경로
  result = result.replace(/\$\{DHELIX_SKILL_DIR\}/g, context.skillDir ?? "");

  // ${DHELIX_PROJECT_DIR} — 프로젝트 루트 디렉토리 경로
  result = result.replace(/\$\{DHELIX_PROJECT_DIR\}/g, context.projectDir ?? "");

  return result;
}

/**
 * 셸 명령을 실행하고 표준 출력(stdout)을 반환하는 함수
 *
 * 동적 컨텍스트 주입(`!command` 구문)에서 사용됩니다.
 * 명령 실행 실패 시 에러 메시지를 반환하며, 예외를 던지지 않습니다.
 *
 * 보안: execFile을 사용하여 명령 문자열을 /bin/sh의 단일 인자로 전달합니다.
 * 실행 순서 변경(동적 컨텍스트 → 변수 치환)과 함께 defense-in-depth 역할을 합니다.
 *
 * @param command - 실행할 셸 명령어 (스킬 본문 원본에서 추출된 명령)
 * @param cwd - 명령어 실행 시 작업 디렉토리
 * @returns 명령 실행 결과 (stdout) 또는 에러 메시지
 */
async function executeShellCommand(command: string, cwd: string): Promise<string> {
  return new Promise<string>((resolve) => {
    // execFile로 /bin/sh -c에 명령을 단일 인자로 전달하여 제어된 셸 실행 수행
    // 실행 순서 변경으로 사용자 입력이 이 함수에 도달할 수 없지만, defense-in-depth로 유지
    execFile(
      "/bin/sh",
      ["-c", command],
      { timeout: COMMAND_TIMEOUT_MS, cwd },
      (error, stdout, stderr) => {
        if (error) {
          // 실패해도 프로세스를 중단하지 않고 에러 메시지를 본문에 삽입
          resolve(`[Command failed: ${stderr.trim() || error.message}]`);
          return;
        }
        resolve(stdout.trim());
      },
    );
  });
}

/**
 * 동적 컨텍스트 주입 — `!command` 백틱 구문을 셸 명령 실행 결과로 교체
 *
 * 스킬 본문에서 `!git status`처럼 백틱으로 감싼 명령어를 찾아,
 * 실제로 실행한 결과로 교체합니다.
 *
 * 예시: `!date` → "2026-03-15"
 *
 * @param body - 동적 컨텍스트 구문이 포함된 본문
 * @param cwd - 명령 실행 시 작업 디렉토리
 * @returns 명령 실행 결과가 삽입된 본문
 */
async function resolveDynamicContext(body: string, cwd: string): Promise<string> {
  // `!command args` 패턴을 찾는 정규식 — 백틱 내부의 !로 시작하는 문자열
  const pattern = /`!([^`]+)`/g;
  const matches = [...body.matchAll(pattern)];

  // 동적 컨텍스트 구문이 없으면 원본 그대로 반환
  if (matches.length === 0) return body;

  let result = body;
  // 명령어를 순차적으로 실행 (순서 의존성이 있을 수 있으므로 병렬이 아닌 순차)
  for (const match of matches) {
    const command = match[1];
    const output = await executeShellCommand(command, cwd);
    result = result.replace(match[0], output);
  }

  return result;
}

/**
 * 스킬을 실행하여 최종 프롬프트를 생성하는 메인 함수
 *
 * 실행 단계 (보안상 순서가 중요):
 * 1. 동적 컨텍스트 주입 (`!command` → 명령 실행 결과) — 스킬 원본 명령만 실행
 * 2. 변수 치환 ($ARGUMENTS, $0 등 → 실제 값) — 사용자 입력은 셸 실행 이후에 주입
 * 3. 결과 반환 (프롬프트 + 모델 오버라이드 + fork 여부 등)
 *
 * @param skill - 실행할 스킬 정의 (프론트매터 + 본문)
 * @param context - 런타임 컨텍스트 (인자, 세션 정보, 디렉토리 등)
 * @returns 실행 결과 (완성된 프롬프트와 실행 옵션)
 * @throws SkillExecutionError - 스킬 본문이 비어있을 때
 */
export async function executeSkill(
  skill: SkillDefinition,
  context: SkillContext,
): Promise<SkillExecutionResult> {
  const { frontmatter, body } = skill;

  // 본문이 없으면 실행 불가
  if (!body) {
    throw new SkillExecutionError("Skill has no body content", {
      skill: frontmatter.name,
    });
  }

  // 단계 1: 동적 컨텍스트 주입 — `!command` 구문을 실행 결과로 교체
  // 보안: 변수 치환 전에 실행하여 사용자 입력($ARGUMENTS)이 exec()에 도달하지 않도록 함
  const resolved = await resolveDynamicContext(body, context.workingDirectory);

  // 단계 2: 변수 치환 — $ARGUMENTS, $0 등을 실제 값으로 교체 (셸 실행 완료 후)
  const interpolated = interpolateVariables(resolved, context);

  return {
    prompt: interpolated,
    model: frontmatter.model ?? undefined,
    fork: frontmatter.context === "fork", // "fork"이면 서브에이전트로 실행
    agentType: frontmatter.agent,
    allowedTools: frontmatter.allowedTools,
  };
}

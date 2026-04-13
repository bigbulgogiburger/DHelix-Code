/**
 * Preflight Stage — 도구 호출 실행 전 검증 체인
 *
 * 각 도구 호출에 대해 다음 검사를 수행합니다:
 * 1. capability-filter: 모델이 해당 도구를 지원하는지 확인
 * 2. permission-check: 도구의 권한 수준이 충분한지 확인
 * 3. guardrail-scan: 입력 인수에 대한 가드레일 검사
 *
 * 모든 검사를 통과한 호출만 실행 단계로 진행됩니다.
 *
 * @module tools/pipeline/preflight
 */

import { type ExtractedToolCall, type ToolContext, type ToolCallResult } from "../types.js";
import { type ToolRegistry } from "../registry.js";
import { applyInputGuardrails } from "../../guardrails/index.js";

/**
 * 단일 preflight 검사 결과
 */
export interface PreflightResult {
  /** 도구 호출 실행이 허용되는지 여부 */
  readonly allowed: boolean;
  /** 거부된 경우 사유 */
  readonly reason?: string;
  /** 검사 과정에서 변환된 인수 (교정된 인수가 있을 때) */
  readonly transformedArgs?: Record<string, unknown>;
}

/**
 * Preflight 검사 인터페이스 — 등록 가능한 검사 단위
 */
export interface PreflightCheck {
  /** 검사 이름 (디버깅/로깅용) */
  readonly name: string;
  /** 검사 실행 함수 */
  readonly check: (call: ExtractedToolCall, context: PreflightContext) => Promise<PreflightResult>;
}

/**
 * Preflight 단계에 필요한 컨텍스트
 */
export interface PreflightContext {
  /** 도구 레지스트리 */
  readonly registry: ToolRegistry;
  /** 도구 실행 컨텍스트 */
  readonly toolContext: ToolContext;
  /** 가드레일 활성화 여부 */
  readonly enableGuardrails: boolean;
}

/**
 * 전체 preflight 실행 결과 — 각 호출에 대한 통과/거부 분류
 */
export interface PreflightOutput {
  /** 검사를 통과한 도구 호출 목록 */
  readonly passed: readonly ExtractedToolCall[];
  /** 검사에서 거부된 호출의 결과 목록 */
  readonly rejected: readonly ToolCallResult[];
}

/**
 * capability-filter 검사 — 레지스트리에 도구가 등록되어 있는지 확인
 *
 * @param call - 검사할 도구 호출
 * @param context - preflight 컨텍스트
 * @returns 검사 결과
 */
async function checkCapabilityFilter(
  call: ExtractedToolCall,
  context: PreflightContext,
): Promise<PreflightResult> {
  const tool = context.registry.get(call.name);
  if (!tool) {
    return {
      allowed: false,
      reason: `Unknown tool: ${call.name}`,
    };
  }
  return { allowed: true };
}

/**
 * permission-check 검사 — 도구 실행 권한을 확인
 *
 * ToolContext에 checkPermission 콜백이 있으면 사용하고,
 * 없으면 기본적으로 허용합니다.
 *
 * @param call - 검사할 도구 호출
 * @param context - preflight 컨텍스트
 * @returns 검사 결과
 */
async function checkPermissionLevel(
  call: ExtractedToolCall,
  context: PreflightContext,
): Promise<PreflightResult> {
  const { toolContext } = context;
  if (toolContext.checkPermission) {
    const result = await toolContext.checkPermission(call);
    if (result.allowed === false) {
      return {
        allowed: false,
        reason: result.reason ?? `Permission denied for tool: ${call.name}`,
      };
    }
  }
  return { allowed: true };
}

/**
 * guardrail-scan 검사 — 입력 인수에 대한 보안 가드레일 검사
 *
 * @param call - 검사할 도구 호출
 * @param context - preflight 컨텍스트
 * @returns 검사 결과
 */
async function checkGuardrailScan(
  call: ExtractedToolCall,
  context: PreflightContext,
): Promise<PreflightResult> {
  if (!context.enableGuardrails) {
    return { allowed: true };
  }

  const guardrailResult = applyInputGuardrails(
    call.name,
    call.arguments as Record<string, unknown>,
    context.toolContext.workingDirectory,
  );

  if (!guardrailResult.passed) {
    return {
      allowed: false,
      reason: `Guardrail blocked: ${guardrailResult.reason ?? "security violation"}`,
    };
  }

  return { allowed: true };
}

/**
 * 기본 preflight 검사 목록
 */
const DEFAULT_CHECKS: readonly PreflightCheck[] = [
  { name: "capability-filter", check: checkCapabilityFilter },
  { name: "permission-check", check: checkPermissionLevel },
  { name: "guardrail-scan", check: checkGuardrailScan },
];

/**
 * 도구 호출 목록에 대해 preflight 검사를 실행
 *
 * 각 호출에 대해 모든 검사를 순차적으로 실행하며,
 * 하나라도 실패하면 해당 호출을 거부합니다.
 *
 * @param calls - 검사할 도구 호출 목록
 * @param context - preflight 컨텍스트
 * @param checks - 사용할 검사 목록 (기본값: DEFAULT_CHECKS)
 * @returns 통과/거부 분류 결과
 */
export async function runPreflight(
  calls: readonly ExtractedToolCall[],
  context: PreflightContext,
  checks: readonly PreflightCheck[] = DEFAULT_CHECKS,
): Promise<PreflightOutput> {
  const passed: ExtractedToolCall[] = [];
  const rejected: ToolCallResult[] = [];

  for (const call of calls) {
    let isAllowed = true;
    let rejectReason = "";

    for (const check of checks) {
      const result = await check.check(call, context);
      if (!result.allowed) {
        isAllowed = false;
        rejectReason = result.reason ?? `Preflight check "${check.name}" failed`;
        break;
      }
    }

    if (isAllowed) {
      passed.push(call);
    } else {
      rejected.push({
        id: call.id,
        name: call.name,
        output: rejectReason,
        isError: true,
      });
    }
  }

  return { passed, rejected };
}

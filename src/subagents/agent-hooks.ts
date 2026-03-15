/**
 * 에이전트 훅(Hook) 변환기 — 에이전트 정의의 훅을 기존 훅 시스템 형식으로 변환하는 모듈
 *
 * 훅(Hook)이란 특정 이벤트가 발생했을 때 자동으로 실행되는 콜백(명령)입니다.
 * 예를 들어 "도구 사용 전에 린트를 돌려라" 같은 자동화 규칙을 정의할 수 있습니다.
 *
 * 에이전트 정의 파일(.md)의 프론트매터(frontmatter)에 훅을 설정할 수 있는데,
 * 이 모듈은 그 설정을 기존 훅 러너(hook runner) 시스템이 이해하는 형식으로 변환합니다.
 *
 * 훅 이벤트 종류:
 * - PreToolUse: 도구 사용 "전"에 실행 (예: 권한 검사)
 * - PostToolUse: 도구 사용 "후"에 실행 (예: 포맷팅)
 * - Stop (→ SubagentStop): 서브에이전트 종료 시 실행 (예: 정리 작업)
 */
import {
  type HookConfig,
  type HookEvent,
  type HookRule,
  type CommandHookHandler,
} from "../hooks/types.js";

/** 에이전트 훅 항목 — 실행할 셸 명령 하나를 나타냄 */
export interface AgentHookEntry {
  readonly type: "command";
  /** 실행할 셸 명령어 (예: "npm run lint") */
  readonly command: string;
}

/** 에이전트 훅 규칙 — 어떤 도구에 대해 어떤 훅을 실행할지 정의 */
export interface AgentHookRule {
  /** 도구 이름 매칭 패턴 (예: "file_*"). 생략하면 모든 도구에 적용 */
  readonly matcher?: string;
  /** 이 규칙에 해당할 때 실행할 훅 목록 */
  readonly hooks: readonly AgentHookEntry[];
}

/** 에이전트 프론트매터에서 읽어온 훅 설정 구조 */
export interface AgentHookConfig {
  /** 도구 사용 전에 실행할 훅 규칙 목록 */
  readonly PreToolUse?: readonly AgentHookRule[];
  /** 도구 사용 후에 실행할 훅 규칙 목록 */
  readonly PostToolUse?: readonly AgentHookRule[];
  /** 서브에이전트 종료 시 실행할 훅 규칙 목록 */
  readonly Stop?: readonly AgentHookRule[];
}

/**
 * 에이전트 프론트매터의 "Stop" 이벤트를 훅 시스템의 "SubagentStop" 이벤트로 매핑
 *
 * 에이전트 정의에서는 "Stop"이라고 쓰지만, 내부 훅 시스템에서는
 * "SubagentStop"이라는 이름으로 처리하므로 이름 변환이 필요합니다.
 */
const STOP_EVENT_MAPPING: Record<string, HookEvent> = {
  Stop: "SubagentStop",
} as const;

/**
 * 에이전트 훅 항목(AgentHookEntry)을 훅 러너가 이해하는 명령 핸들러로 변환합니다.
 *
 * @param entry - 에이전트 훅 항목 (command 타입)
 * @returns 훅 러너 시스템의 CommandHookHandler 형식
 */
function toCommandHandler(entry: AgentHookEntry): CommandHookHandler {
  return {
    type: "command",
    command: entry.command,
  };
}

/**
 * 에이전트 훅 규칙 배열을 훅 러너의 HookRule[] 형식으로 변환합니다.
 *
 * 각 규칙의 매처(matcher)는 유지하고, 훅 항목들을 CommandHookHandler로 변환합니다.
 *
 * @param rules - 에이전트 훅 규칙 배열
 * @returns 훅 러너 시스템의 HookRule 배열
 */
function convertRules(rules: readonly AgentHookRule[]): readonly HookRule[] {
  return rules.map((rule) => ({
    matcher: rule.matcher,
    hooks: rule.hooks.map(toCommandHandler),
  }));
}

/**
 * 에이전트 프론트매터의 훅 설정을 기존 훅 러너 시스템이 기대하는 형식으로 변환합니다.
 *
 * 주요 변환:
 * - PreToolUse, PostToolUse → 이름 그대로 유지
 * - Stop → "SubagentStop" 이벤트로 이름 변경 (매핑 테이블 사용)
 *
 * @param agentHooks - 에이전트 정의 파일에서 파싱된 훅 설정
 * @returns 훅 러너 시스템이 이해하는 HookConfig 형식
 */
export function convertAgentHooks(agentHooks: AgentHookConfig): HookConfig {
  const config: Partial<Record<HookEvent, readonly HookRule[]>> = {};

  // PreToolUse 훅이 있으면 변환하여 추가
  if (agentHooks.PreToolUse && agentHooks.PreToolUse.length > 0) {
    config.PreToolUse = convertRules(agentHooks.PreToolUse);
  }

  // PostToolUse 훅이 있으면 변환하여 추가
  if (agentHooks.PostToolUse && agentHooks.PostToolUse.length > 0) {
    config.PostToolUse = convertRules(agentHooks.PostToolUse);
  }

  // Stop 훅은 "SubagentStop"으로 이벤트명을 변환하여 추가
  if (agentHooks.Stop && agentHooks.Stop.length > 0) {
    const mappedEvent = STOP_EVENT_MAPPING.Stop ?? "SubagentStop";
    config[mappedEvent] = convertRules(agentHooks.Stop);
  }

  return config;
}

/**
 * 부모 세션의 훅 설정과 에이전트 고유 훅 설정을 병합합니다.
 *
 * 병합 규칙:
 * - 부모에만 있는 이벤트 → 그대로 유지
 * - 에이전트에만 있는 이벤트 → 그대로 추가
 * - 양쪽 모두 있는 이벤트 → 부모 규칙 뒤에 에이전트 규칙을 연결
 *   (에이전트 규칙이 나중에 평가되므로 우선순위가 높음)
 *
 * @param parentHooks - 부모 세션의 훅 설정 (없을 수 있음)
 * @param agentHooks - 에이전트 고유의 훅 설정
 * @returns 병합된 최종 훅 설정
 */
export function mergeHookConfigs(
  parentHooks: HookConfig | undefined,
  agentHooks: HookConfig,
): HookConfig {
  // 부모 훅이 없으면 에이전트 훅만 사용
  if (!parentHooks) {
    return agentHooks;
  }

  // 부모 훅을 기본값으로 복사
  const merged: Partial<Record<HookEvent, readonly HookRule[]>> = { ...parentHooks };

  // 에이전트 훅의 각 이벤트를 순회하며 병합
  for (const [event, agentRules] of Object.entries(agentHooks)) {
    const hookEvent = event as HookEvent;
    const parentRules = merged[hookEvent];

    if (parentRules && parentRules.length > 0) {
      // 양쪽 모두 있는 경우: 부모 규칙 먼저, 에이전트 규칙 나중에 (에이전트가 우선)
      merged[hookEvent] = [...parentRules, ...agentRules];
    } else {
      // 에이전트에만 있는 경우: 그대로 추가
      merged[hookEvent] = agentRules;
    }
  }

  return merged;
}

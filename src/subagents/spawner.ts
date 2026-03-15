/**
 * 서브에이전트 스포너(Spawner) — 서브에이전트를 생성하고 실행하는 핵심 모듈
 *
 * 서브에이전트(Subagent)란 메인 에이전트가 복잡한 작업을 분할하여
 * 별도의 에이전트에게 위임하는 패턴입니다.
 * 각 서브에이전트는 독립된 컨텍스트(대화 히스토리), 도구 세트, 이벤트 발행기를 가지며,
 * 실행이 완료되면 결과를 메인 에이전트에게 반환합니다.
 *
 * 이 모듈은 서브에이전트 시스템의 중심으로, 다음 기능을 제공합니다:
 *
 * 1. 서브에이전트 생성 및 실행 (spawnSubagent)
 *    - 도구 필터링 (허용 목록 / 차단 목록)
 *    - 모델 오버라이드 (sonnet/opus/haiku/inherit)
 *    - 시스템 프롬프트 구성 (내장 유형 또는 커스텀 에이전트 정의)
 *
 * 2. 고급 기능
 *    - 백그라운드 실행: 비동기로 실행하고 완료 시 이벤트 알림
 *    - Git 워크트리 격리: 별도의 워크트리에서 파일 수정 (메인 코드 보호)
 *    - 대화 이력 재개(resume): 이전 서브에이전트의 컨텍스트를 이어받아 실행
 *    - 공유 상태: 병렬 서브에이전트 간 데이터 공유 및 메시징
 *
 * 3. 히스토리 관리
 *    - 메모리 내 캐시 + 디스크 영속화 (~/.dbcode/agent-history/)
 *    - 최대 20개 파일 유지 (오래된 것 자동 삭제)
 *
 * 4. 병렬 실행 (spawnParallelSubagents)
 *    - 여러 서브에이전트를 동시에 실행하고 결과를 수집
 *    - 자동으로 공유 상태 인스턴스 생성 및 주입
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, readFile, readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { type LLMProvider, type ChatMessage } from "../llm/provider.js";
import { type ToolCallStrategy } from "../llm/tool-call-strategy.js";
import { ToolRegistry } from "../tools/registry.js";
import { runAgentLoop, type AgentLoopResult } from "../core/agent-loop.js";
import { buildSystemPrompt, type SessionState } from "../core/system-prompt-builder.js";
import { createEventEmitter, type AppEventEmitter } from "../utils/events.js";
import { BaseError } from "../utils/error.js";
import { type SharedAgentState, createSharedAgentState } from "./shared-state.js";
import {
  type AgentDefinition,
  type AgentModel,
  type AgentPermissionMode,
  type AgentMemoryScope,
} from "./definition-types.js";
import { resolveProvider } from "../llm/model-router.js";

/** execFile의 Promise 버전 — 비동기적으로 외부 프로세스를 실행 */
const execFileAsync = promisify(execFile);

/** 서브에이전트 대화 히스토리를 저장하는 디렉토리 경로 */
const AGENT_HISTORY_DIR = join(homedir(), ".dbcode", "agent-history");

/** 디스크에 유지할 최대 히스토리 파일 수 — 초과 시 오래된 것부터 삭제 */
const MAX_PERSISTED_HISTORIES = 20;

/**
 * 서브에이전트 실행 에러 클래스
 *
 * BaseError를 확장하여 에러 코드("SUBAGENT_ERROR")와
 * 에이전트 ID, 유형 등의 컨텍스트 정보를 포함합니다.
 */
export class SubagentError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "SUBAGENT_ERROR", context);
  }
}

/**
 * 서브에이전트 유형
 *
 * 내장 유형: "explore" | "plan" | "general"
 * 커스텀 유형: .dbcode/agents/*.md 파일로 정의한 이름 (string)
 *
 * (string & {}) 패턴은 TypeScript에서 자동완성은 제공하면서
 * 임의의 문자열도 허용하는 기법입니다.
 */
export type SubagentType = "explore" | "plan" | "general" | (string & {});

/**
 * 서브에이전트 생성 설정 — spawnSubagent()에 전달하는 모든 옵션
 *
 * 이 인터페이스는 서브에이전트 실행에 필요한 모든 정보를 담고 있습니다.
 * 필수 필드(type, prompt, client 등)와 선택 필드(signal, resume 등)로 나뉩니다.
 */
export interface SubagentConfig {
  /** 서브에이전트 유형 (예: "explore", "general", 또는 커스텀 이름) */
  readonly type: SubagentType;
  /** 서브에이전트에게 전달할 작업 지시(프롬프트) */
  readonly prompt: string;
  /** LLM API 클라이언트 (OpenAI 호환 인터페이스) */
  readonly client: LLMProvider;
  /** 사용할 AI 모델 식별자 */
  readonly model: string;
  /** 도구 호출 전략 (LLM이 도구를 어떻게 호출할지 결정) */
  readonly strategy: ToolCallStrategy;
  /** 사용 가능한 도구들의 레지스트리 (필터링 적용 가능) */
  readonly toolRegistry: ToolRegistry;
  /** 작업 디렉토리 */
  readonly workingDirectory?: string;
  /** 최대 반복(iteration) 횟수 — 무한루프 방지 */
  readonly maxIterations?: number;
  /** AbortSignal — 외부에서 실행을 취소할 수 있는 시그널 */
  readonly signal?: AbortSignal;
  /** 부모 에이전트의 이벤트 발행기 (알림 및 백그라운드 완료 통지용) */
  readonly parentEvents?: AppEventEmitter;
  /** 허용할 도구 이름 목록 (화이트리스트) */
  readonly allowedTools?: readonly string[];
  /** 백그라운드 실행 여부 — true이면 즉시 반환하고 나중에 이벤트로 결과 알림 */
  readonly run_in_background?: boolean;
  /** 격리 모드: "worktree"이면 별도 Git 워크트리에서 실행 (메인 코드 보호) */
  readonly isolation?: "worktree";
  /** 이전 서브에이전트의 대화를 이어받을 에이전트 ID */
  readonly resume?: string;
  /** 에이전트 간 통신을 위한 공유 상태 */
  readonly sharedState?: SharedAgentState;
  /** 모델 오버라이드: "sonnet"|"opus"|"haiku"|"inherit" (기본: 부모 모델 상속) */
  readonly modelOverride?: AgentModel;
  /** 권한 모드 — 도구 실행 시 사용자 확인 수준 */
  readonly permissionMode?: AgentPermissionMode;
  /** 최대 컨텍스트 토큰 수 — 초과 시 자동 압축(compaction) 수행 */
  readonly maxContextTokens?: number;
  /** 커스텀 에이전트 정의 (.dbcode/agents/*.md에서 로드) */
  readonly agentDefinition?: AgentDefinition;
  /** 차단할 도구 이름 목록 (블랙리스트, 허용 목록에서 제거) */
  readonly disallowedTools?: readonly string[];
  /** 미리 로드할 스킬 이름 목록 */
  readonly skills?: readonly string[];
  /** 영속적 메모리의 저장 범위 */
  readonly memory?: AgentMemoryScope;
}

/**
 * 서브에이전트 실행 결과 — 실행 완료 후 반환되는 데이터
 */
export interface SubagentResult {
  /** 이 실행의 고유 에이전트 ID (UUID) */
  readonly agentId: string;
  /** 서브에이전트 유형 */
  readonly type: SubagentType;
  /** 서브에이전트의 최종 응답 텍스트 */
  readonly response: string;
  /** 서브에이전트가 실행한 총 반복 횟수 */
  readonly iterations: number;
  /** 실행이 중단(abort)되었는지 여부 */
  readonly aborted: boolean;
  /** 전체 대화 히스토리 (검사 또는 resume 용도) */
  readonly messages: readonly ChatMessage[];
  /** 사용된 작업 디렉토리 (워크트리 격리 시 다를 수 있음) */
  readonly workingDirectory?: string;
  /** 실행 중 사용된 공유 상태 인스턴스 */
  readonly sharedState?: SharedAgentState;
}

/**
 * 완료된 서브에이전트의 대화 히스토리를 메모리에 보관하는 캐시
 * resume 기능에서 이전 대화를 빠르게 조회하기 위해 사용됩니다.
 */
const agentHistoryStore = new Map<string, readonly ChatMessage[]>();

/**
 * 에이전트 대화 히스토리를 디스크에 영속화합니다.
 *
 * ~/.dbcode/agent-history/{agentId}.json 형태로 저장하며,
 * 파일 수가 MAX_PERSISTED_HISTORIES(20)를 초과하면
 * 가장 오래된 파일부터 삭제합니다.
 *
 * 최선의 노력(best-effort) 방식으로, 저장 실패가 에이전트 실행을 중단시키지 않습니다.
 *
 * @param agentId - 에이전트 고유 ID
 * @param messages - 저장할 대화 히스토리
 */
async function persistAgentHistory(
  agentId: string,
  messages: readonly ChatMessage[],
): Promise<void> {
  try {
    // 히스토리 디렉토리가 없으면 생성
    await mkdir(AGENT_HISTORY_DIR, { recursive: true });
    const filePath = join(AGENT_HISTORY_DIR, `${agentId}.json`);
    await writeFile(filePath, JSON.stringify(messages), "utf-8");

    // 오래된 파일 정리 — MAX_PERSISTED_HISTORIES를 초과하면 가장 오래된 것부터 삭제
    const entries = await readdir(AGENT_HISTORY_DIR);
    const jsonFiles = entries.filter((f) => f.endsWith(".json"));

    if (jsonFiles.length > MAX_PERSISTED_HISTORIES) {
      // 파일의 수정 시각을 조회하여 오래된 순으로 정렬
      const fileStats = await Promise.all(
        jsonFiles.map(async (name) => {
          const fp = join(AGENT_HISTORY_DIR, name);
          const s = await stat(fp);
          return { name, mtimeMs: s.mtimeMs, path: fp };
        }),
      );
      fileStats.sort((a, b) => a.mtimeMs - b.mtimeMs); // 오래된 것 먼저

      // 초과분만큼 삭제
      const toRemove = fileStats.slice(0, fileStats.length - MAX_PERSISTED_HISTORIES);
      const { unlink } = await import("node:fs/promises");
      await Promise.all(toRemove.map((f) => unlink(f.path).catch(() => {})));
    }
  } catch {
    // 최선의 노력 영속화 — 실패해도 에이전트 실행에 영향 없음
  }
}

/**
 * 디스크에서 에이전트 대화 히스토리를 로드합니다.
 *
 * 파일이 없거나 파싱에 실패하면 undefined를 반환합니다.
 *
 * @param agentId - 로드할 에이전트의 고유 ID
 * @returns 대화 히스토리 배열, 또는 undefined
 */
async function loadAgentHistoryFromDisk(
  agentId: string,
): Promise<readonly ChatMessage[] | undefined> {
  try {
    const filePath = join(AGENT_HISTORY_DIR, `${agentId}.json`);
    const raw = await readFile(filePath, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed as ChatMessage[];
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * 완료된 에이전트의 대화 히스토리를 저장합니다 (메모리 캐시 + 디스크).
 *
 * 메모리 캐시는 50개까지만 유지하며, 초과 시 가장 오래된 항목을 제거합니다.
 * 디스크 영속화는 비동기적으로 수행됩니다.
 *
 * @param agentId - 에이전트 고유 ID
 * @param messages - 저장할 대화 히스토리
 */
async function storeAgentHistory(agentId: string, messages: readonly ChatMessage[]): Promise<void> {
  agentHistoryStore.set(agentId, messages);

  // 메모리 캐시 크기 제한 — 50개 초과 시 가장 오래된 것 제거
  if (agentHistoryStore.size > 50) {
    const firstKey = agentHistoryStore.keys().next().value;
    if (firstKey !== undefined) {
      agentHistoryStore.delete(firstKey);
    }
  }

  // 디스크에 비동기적으로 영속화
  await persistAgentHistory(agentId, messages);
}

/**
 * 이전 에이전트의 대화 히스토리를 조회합니다 (resume 기능용).
 *
 * 조회 순서:
 * 1. 메모리 캐시 확인 (빠른 조회)
 * 2. 디스크 파일 확인 (캐시 미스 시)
 * 3. 디스크에서 로드된 경우 메모리 캐시에 재등록
 *
 * @param agentId - 조회할 에이전트의 고유 ID
 * @returns 대화 히스토리 배열, 또는 undefined (찾지 못한 경우)
 */
export async function getAgentHistory(
  agentId: string,
): Promise<readonly ChatMessage[] | undefined> {
  // 1. 메모리 캐시에서 먼저 확인
  const cached = agentHistoryStore.get(agentId);
  if (cached) {
    return cached;
  }

  // 2. 디스크에서 로드 시도
  const fromDisk = await loadAgentHistoryFromDisk(agentId);
  if (fromDisk) {
    // 다음 조회를 위해 메모리 캐시에 재등록
    agentHistoryStore.set(agentId, fromDisk);
    return fromDisk;
  }

  return undefined;
}

/**
 * 허용 목록(allowlist)으로 필터링된 도구 레지스트리를 생성합니다.
 *
 * 원본 레지스트리에서 allowedTools에 포함된 도구만 새 레지스트리에 등록합니다.
 *
 * @param source - 원본 도구 레지스트리
 * @param allowedTools - 허용할 도구 이름 배열
 * @returns 필터링된 새 도구 레지스트리
 */
function createFilteredRegistry(
  source: ToolRegistry,
  allowedTools: readonly string[],
): ToolRegistry {
  const filtered = new ToolRegistry();
  const allowedSet = new Set(allowedTools); // Set으로 변환하여 O(1) 조회

  for (const tool of source.getAll()) {
    if (allowedSet.has(tool.name)) {
      filtered.register(tool);
    }
  }

  return filtered;
}

/**
 * 모델 별칭(alias)을 실제 모델 식별자로 매핑하는 테이블
 *
 * 에이전트 정의에서 "sonnet", "opus", "haiku" 같은 짧은 이름을 사용할 수 있게 합니다.
 */
const MODEL_ALIAS_MAP: Readonly<Record<string, string>> = {
  sonnet: "claude-sonnet-4-5-20250514",
  opus: "claude-opus-4-5-20250514",
  haiku: "claude-haiku-4-5-20251001",
};

/**
 * 서브에이전트의 모델과 LLM 프로바이더를 결정합니다.
 *
 * - override가 없거나 "inherit"이면 부모 에이전트의 모델/클라이언트를 그대로 사용
 * - "sonnet", "opus", "haiku" 등 별칭이면 해당 모델로 전환하고 적절한 프로바이더 생성
 *
 * @param parentModel - 부모 에이전트의 모델 식별자
 * @param parentClient - 부모 에이전트의 LLM 클라이언트
 * @param override - 모델 오버라이드 설정 (선택적)
 * @returns 결정된 모델 식별자와 LLM 클라이언트
 */
function resolveModelForSubagent(
  parentModel: string,
  parentClient: LLMProvider,
  override?: AgentModel,
): { readonly model: string; readonly client: LLMProvider } {
  // 오버라이드가 없거나 "inherit"이면 부모 설정 그대로 사용
  if (!override || override === "inherit") {
    return { model: parentModel, client: parentClient };
  }

  // 별칭을 실제 모델 ID로 변환하고, 해당 모델의 프로바이더를 생성
  const resolvedModel = MODEL_ALIAS_MAP[override] ?? override;
  const resolvedClient = resolveProvider(resolvedModel);
  return { model: resolvedModel, client: resolvedClient };
}

/**
 * 허용 목록(allowlist)과 차단 목록(denylist)을 모두 적용하여 필터링된 도구 레지스트리를 생성합니다.
 *
 * 적용 순서:
 * 1. 허용 목록이 있으면 먼저 적용 (허용된 도구만 남김)
 * 2. 차단 목록이 있으면 그 결과에서 추가로 제거
 *
 * @param source - 원본 도구 레지스트리
 * @param allowedTools - 허용할 도구 목록 (없으면 모든 도구 허용)
 * @param disallowedTools - 차단할 도구 목록 (없으면 차단 없음)
 * @returns 필터링된 새 도구 레지스트리
 */
function createFilteredRegistryWithBlacklist(
  source: ToolRegistry,
  allowedTools?: readonly string[],
  disallowedTools?: readonly string[],
): ToolRegistry {
  // 1단계: 허용 목록 적용 (없으면 원본 그대로)
  const afterAllow = allowedTools ? createFilteredRegistry(source, allowedTools) : source;

  // 2단계: 차단 목록 적용 (없으면 1단계 결과 그대로)
  if (!disallowedTools || disallowedTools.length === 0) {
    return afterAllow;
  }

  const denySet = new Set(disallowedTools);
  const result = new ToolRegistry();
  for (const tool of afterAllow.getAll()) {
    if (!denySet.has(tool.name)) {
      result.register(tool);
    }
  }
  return result;
}

/**
 * 서브에이전트 유형에 맞는 시스템 프롬프트를 구성합니다.
 *
 * SessionState 기반 조건부 섹션으로 유형별 지시사항을 포함합니다.
 * 예를 들어 "explore" 유형이면 읽기 전용 지시사항이 추가됩니다.
 *
 * @param type - 서브에이전트 유형
 * @param toolRegistry - 사용 가능한 도구 레지스트리 (프롬프트에 도구 목록 포함)
 * @returns 구성된 시스템 프롬프트 텍스트
 */
function buildSubagentSystemPrompt(type: SubagentType, toolRegistry: ToolRegistry): string {
  const toolNames = toolRegistry.getAll().map((t) => t.name);
  const builtinTypes = new Set<string>(["explore", "plan", "general"]);

  // 세션 상태 구성 — 서브에이전트임을 표시하고 유형별 설정 적용
  const sessionState: SessionState = {
    mode: "normal",
    isSubagent: true,
    subagentType: builtinTypes.has(type) ? (type as "explore" | "plan" | "general") : undefined,
    availableTools: toolNames,
    extendedThinkingEnabled: false,
    features: {},
  };

  return buildSystemPrompt({ toolRegistry, sessionState });
}

/**
 * 격리된 실행을 위한 Git 워크트리를 생성합니다.
 *
 * Git 워크트리(worktree)란 같은 저장소에서 별도의 작업 디렉토리를 만드는 기능입니다.
 * 서브에이전트가 워크트리에서 파일을 수정하면 메인 작업 디렉토리에는 영향이 없습니다.
 *
 * 워크트리는 .dbcode/worktrees/{agentId} 경로에 생성됩니다.
 * 실행 후 변경 사항이 없으면 자동 정리되고,
 * 변경 사항이 있으면 사용자 검토를 위해 브랜치를 유지합니다.
 *
 * @param baseDir - 기본 Git 저장소 경로
 * @param agentId - 에이전트 고유 ID (워크트리 이름으로 사용)
 * @returns 워크트리 경로, 브랜치 이름, 정리 함수
 */
async function createWorktree(
  baseDir: string,
  agentId: string,
): Promise<{ worktreePath: string; branchName: string; cleanup: () => Promise<void> }> {
  const worktreeDir = join(baseDir, ".dbcode", "worktrees");
  const worktreePath = join(worktreeDir, agentId);
  const branchName = `dbcode-worktree-${agentId}`;

  // 워크트리 디렉토리 생성
  await mkdir(worktreeDir, { recursive: true });

  try {
    // git worktree add 명령으로 새 워크트리와 브랜치 생성
    await execFileAsync("git", ["worktree", "add", "-b", branchName, worktreePath], {
      cwd: baseDir,
    });
  } catch (error) {
    throw new SubagentError("Failed to create git worktree", {
      worktreePath,
      cause: error instanceof Error ? error.message : String(error),
    });
  }

  // 정리(cleanup) 함수 — 실행 완료 후 호출
  const cleanup = async (): Promise<void> => {
    try {
      // 워크트리에 변경 사항이 있는지 확인
      const status = await execFileAsync("git", ["status", "--porcelain"], {
        cwd: worktreePath,
      });
      const hasChanges = status.stdout.trim().length > 0;

      if (!hasChanges) {
        // 변경 사항 없음 → 워크트리와 브랜치를 완전히 정리
        await execFileAsync("git", ["worktree", "remove", "--force", worktreePath], {
          cwd: baseDir,
        });
        await execFileAsync("git", ["branch", "-D", branchName], { cwd: baseDir });
      }
      // 변경 사항이 있으면 사용자 검토를 위해 브랜치를 유지
    } catch {
      // 최선의 노력 정리
    }
  };

  return { worktreePath, branchName, cleanup };
}

/**
 * 고아(orphaned) 워크트리를 감지하고 정리합니다.
 *
 * 앱 시작 시 호출되어 이전 세션에서 정리되지 않은 워크트리를 제거합니다.
 * 변경 사항이 없는 워크트리만 안전하게 제거합니다.
 *
 * @param repoRoot - Git 저장소 루트 경로
 * @returns 정리된 워크트리 수
 */
export async function cleanOrphanedWorktrees(repoRoot: string): Promise<number> {
  const worktreeDir = join(repoRoot, ".dbcode", "worktrees");

  try {
    const entries = await readdir(worktreeDir);
    let cleaned = 0;

    for (const entry of entries) {
      const worktreePath = join(worktreeDir, entry);
      try {
        // 변경 사항이 없는지 확인
        const { stdout } = await execFileAsync("git", ["status", "--porcelain"], {
          cwd: worktreePath,
        });

        if (stdout.trim().length === 0) {
          // 변경 사항 없음 → 안전하게 제거
          await execFileAsync("git", ["worktree", "remove", "--force", worktreePath], {
            cwd: repoRoot,
          });
          cleaned++;
        }
      } catch {
        // 유효하지 않은 워크트리 — 강제 제거 시도
        try {
          await execFileAsync("git", ["worktree", "remove", "--force", worktreePath], {
            cwd: repoRoot,
          });
          cleaned++;
        } catch {
          // 강제 제거도 실패하면 건너뜀
        }
      }
    }

    return cleaned;
  } catch {
    return 0; // 워크트리 디렉토리가 아직 존재하지 않음
  }
}

/**
 * 서브에이전트를 생성하고 실행합니다 — 이 모듈의 핵심 함수
 *
 * 서브에이전트는 격리된 컨텍스트에서 실행됩니다:
 * - 독립된 이벤트 발행기
 * - 선택적으로 필터링된 도구 세트
 * - 독립된 대화 히스토리
 *
 * 고급 기능:
 * - run_in_background: 비동기(non-blocking) 실행, 완료 시 parentEvents로 이벤트 알림
 * - isolation: "worktree" — Git 워크트리로 파일 수준 격리
 * - resume: 이전 에이전트의 대화 히스토리를 이어받아 컨텍스트 연속성 유지
 *
 * @param config - 서브에이전트 생성 설정 (SubagentConfig)
 * @returns 서브에이전트 실행 결과 (SubagentResult)
 * @throws SubagentError — 실행 실패 시
 */
export async function spawnSubagent(config: SubagentConfig): Promise<SubagentResult> {
  const {
    type,
    prompt,
    client,
    model,
    strategy,
    toolRegistry,
    workingDirectory,
    maxIterations = 20,
    signal,
    parentEvents,
    allowedTools,
    run_in_background,
    isolation,
    resume,
    sharedState,
    modelOverride,
    permissionMode,
    maxContextTokens,
    agentDefinition,
    disallowedTools,
    skills,
    memory,
  } = config;

  // 고유한 에이전트 ID 생성 (UUID v4)
  const agentId = randomUUID();

  // 실행에 필요한 파라미터를 모아놓은 객체
  const executeParams = {
    agentId,
    type,
    prompt,
    client,
    model,
    strategy,
    toolRegistry,
    workingDirectory,
    maxIterations,
    signal,
    parentEvents,
    allowedTools,
    isolation,
    resume,
    sharedState,
    modelOverride,
    permissionMode,
    maxContextTokens,
    agentDefinition,
    disallowedTools,
    skills,
    memory,
  };

  // ── 백그라운드 모드: 즉시 반환하고 나중에 이벤트로 결과 알림 ──
  if (run_in_background) {
    const backgroundPromise = executeSubagent(executeParams);

    // 백그라운드에서 실행 → 완료/실패 시 부모 이벤트 발행기를 통해 알림
    void backgroundPromise
      .then((result) => {
        parentEvents?.emit("tool:complete", {
          name: `subagent:${type}`,
          id: agentId,
          isError: false,
          output: result.response,
        });
      })
      .catch((error) => {
        parentEvents?.emit("tool:complete", {
          name: `subagent:${type}`,
          id: agentId,
          isError: true,
          output: error instanceof Error ? error.message : String(error),
        });
      });

    // 즉시 플레이스홀더 결과를 반환 — 실제 결과는 나중에 이벤트로 전달
    return {
      agentId,
      type,
      response: `[Subagent ${type} running in background with ID: ${agentId}]`,
      iterations: 0,
      aborted: false,
      messages: [],
      sharedState,
    };
  }

  // ── 동기 모드: 실행 완료까지 대기 후 결과 반환 ──
  return executeSubagent(executeParams);
}

/**
 * 서브에이전트의 실제 실행 로직 (동기/백그라운드 모드 모두 이 함수를 사용)
 *
 * 실행 흐름:
 * 1. 모델 오버라이드 적용 (필요 시 프로바이더 전환)
 * 2. 워크트리 격리 설정 (필요 시)
 * 3. 공유 상태에 초기 진행도 보고
 * 4. 도구 레지스트리 필터링 (허용/차단 목록 적용)
 * 5. 시스템 프롬프트 구성 (에이전트 정의 또는 기본값)
 * 6. 초기 메시지 구성 (resume 시 이전 히스토리 포함)
 * 7. 에이전트 루프 실행 (5분 타임아웃)
 * 8. 결과 저장 및 반환
 *
 * @param params - 실행에 필요한 모든 파라미터
 * @returns 서브에이전트 실행 결과
 * @throws SubagentError — 실행 실패 또는 타임아웃 시
 */
async function executeSubagent(params: {
  agentId: string;
  type: SubagentType;
  prompt: string;
  client: LLMProvider;
  model: string;
  strategy: ToolCallStrategy;
  toolRegistry: ToolRegistry;
  workingDirectory?: string;
  maxIterations: number;
  signal?: AbortSignal;
  parentEvents?: AppEventEmitter;
  allowedTools?: readonly string[];
  isolation?: "worktree";
  resume?: string;
  sharedState?: SharedAgentState;
  modelOverride?: AgentModel;
  permissionMode?: AgentPermissionMode;
  maxContextTokens?: number;
  agentDefinition?: AgentDefinition;
  disallowedTools?: readonly string[];
  skills?: readonly string[];
  memory?: AgentMemoryScope;
}): Promise<SubagentResult> {
  const {
    agentId,
    type,
    prompt,
    strategy,
    toolRegistry,
    maxIterations,
    signal,
    parentEvents,
    allowedTools,
    isolation,
    resume,
    sharedState,
    modelOverride,
    maxContextTokens,
    agentDefinition,
    disallowedTools,
  } = params;

  // 1단계: 모델 오버라이드 적용 — 별칭을 실제 모델로 변환하고 프로바이더 선택
  const { model: effectiveModel, client: effectiveClient } = resolveModelForSubagent(
    params.model,
    params.client,
    modelOverride,
  );

  let effectiveWorkingDir = params.workingDirectory;
  let worktreeCleanup: (() => Promise<void>) | undefined;

  // 2단계: 워크트리 격리 설정 (isolation === "worktree"일 때)
  if (isolation === "worktree" && effectiveWorkingDir) {
    const wt = await createWorktree(effectiveWorkingDir, agentId);
    effectiveWorkingDir = wt.worktreePath; // 워크트리 경로를 작업 디렉토리로 사용
    worktreeCleanup = wt.cleanup;
  }

  try {
    // 부모 에이전트에게 서브에이전트 시작을 알림
    parentEvents?.emit("agent:iteration", { iteration: 0 });

    // 3단계: 공유 상태에 초기 진행도 보고
    if (sharedState) {
      sharedState.reportProgress(agentId, 0, "starting");
    }

    // 4단계: 도구 레지스트리 필터링 (허용 목록 + 차단 목록 적용)
    let agentRegistry = createFilteredRegistryWithBlacklist(
      toolRegistry,
      allowedTools,
      disallowedTools,
    );

    // plan 모드에서는 MCP 도구와 위험한 도구를 추가로 차단
    if (params.permissionMode === "plan") {
      const planSafe = new ToolRegistry();
      for (const tool of agentRegistry.getAll()) {
        // MCP(Model Context Protocol) 도구는 외부 서비스와 통신하므로 차단
        if (tool.name.startsWith("mcp__")) continue;
        // "safe" 권한 레벨이 아닌 도구 차단 (파일 수정, 코드 실행 등)
        if (tool.permissionLevel !== "safe") continue;
        planSafe.register(tool);
      }
      agentRegistry = planSafe;
    }

    // 5단계: 시스템 프롬프트 구성
    // 커스텀 에이전트 정의가 있으면 그 본문을 사용, 없으면 유형 기반 기본 프롬프트 생성
    const systemPrompt = agentDefinition
      ? agentDefinition.systemPrompt
      : buildSubagentSystemPrompt(type, agentRegistry);

    // 격리된 이벤트 발행기 생성 — 서브에이전트의 이벤트가 부모에게 직접 전파되지 않음
    const events = createEventEmitter();

    // 6단계: 초기 메시지 구성
    const initialMessages: ChatMessage[] = [];

    if (resume) {
      // resume 모드: 이전 에이전트의 대화 히스토리를 로드하여 이어받기
      const previousHistory = await getAgentHistory(resume);
      if (previousHistory) {
        // 이전 대화를 그대로 포함하고, 새 사용자 메시지를 추가
        initialMessages.push(...previousHistory);
        initialMessages.push({
          role: "user",
          content: `[Resumed from agent ${resume}]\n\n${prompt}`,
        });
      } else {
        // 이전 히스토리를 찾지 못함 → 새로 시작
        initialMessages.push(
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        );
      }
    } else {
      // 일반 모드: 시스템 프롬프트와 사용자 프롬프트로 시작
      initialMessages.push(
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      );
    }

    // 7단계: 에이전트 루프 실행 (5분 타임아웃 적용)
    const SUBAGENT_TIMEOUT_MS = 300_000; // 5분 = 300초

    // 타임아웃 Promise — 5분 후 자동으로 에러 발생
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timer = setTimeout(
        () => reject(new SubagentError("Subagent timed out after 5 minutes")),
        SUBAGENT_TIMEOUT_MS,
      );
      // unref()를 호출하면 이 타이머가 프로세스 종료를 방해하지 않음
      if (typeof timer === "object" && "unref" in timer) {
        timer.unref();
      }
    });

    // Promise.race로 에이전트 루프와 타임아웃 중 먼저 완료되는 것을 사용
    const result: AgentLoopResult = await Promise.race([
      runAgentLoop(
        {
          client: effectiveClient,
          model: effectiveModel,
          toolRegistry: agentRegistry,
          strategy,
          events,
          maxIterations,
          signal,
          workingDirectory: effectiveWorkingDir,
          maxContextTokens,
        },
        initialMessages,
      ),
      timeoutPromise,
    ]);

    // 8단계: 대화 히스토리 저장 (메모리 캐시 + 디스크, resume 기능 지원)
    await storeAgentHistory(agentId, result.messages);

    // 마지막 어시스턴트 메시지를 최종 응답으로 추출
    const lastAssistantMessage = [...result.messages].reverse().find((m) => m.role === "assistant");

    const response = lastAssistantMessage?.content ?? "";

    // 공유 상태에 완료 보고 및 결과 전송
    if (sharedState) {
      sharedState.reportProgress(agentId, 1, "completed");
      sharedState.send({
        fromAgentId: agentId,
        type: "result",
        content: response,
        timestamp: Date.now(),
      });
    }

    return {
      agentId,
      type,
      response,
      iterations: result.iterations,
      aborted: result.aborted,
      messages: result.messages,
      workingDirectory: effectiveWorkingDir,
      sharedState,
    };
  } catch (error) {
    // 에러 발생 시 공유 상태에 실패 보고
    if (sharedState) {
      sharedState.reportProgress(agentId, 0, "failed");
      sharedState.send({
        fromAgentId: agentId,
        type: "error",
        content: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      });
    }

    throw new SubagentError(`Subagent (${type}) failed`, {
      agentId,
      type,
      cause: error instanceof Error ? error.message : String(error),
    });
  } finally {
    // 워크트리 정리 — 성공/실패와 관계없이 항상 실행
    if (worktreeCleanup) {
      await worktreeCleanup();
    }
  }
}

/**
 * 여러 서브에이전트를 병렬로 실행하고 결과를 수집합니다.
 *
 * 모든 서브에이전트는 같은 AbortSignal을 공유하여
 * 하나를 취소하면 전체를 취소할 수 있습니다.
 *
 * SharedAgentState 인스턴스가 자동으로 생성되어 모든 설정에 주입됩니다.
 * 이를 통해 병렬 실행 중인 에이전트들이 서로 데이터를 공유하고
 * 메시지를 주고받을 수 있습니다.
 *
 * @param configs - 병렬로 실행할 서브에이전트 설정 배열
 * @returns 모든 서브에이전트의 실행 결과 배열 (입력 순서와 동일)
 */
export async function spawnParallelSubagents(
  configs: readonly SubagentConfig[],
): Promise<readonly SubagentResult[]> {
  // 병렬 그룹 전체를 위한 공유 상태 인스턴스 생성
  const groupSharedState = createSharedAgentState();

  // 각 설정에 공유 상태를 주입 (이미 설정된 것이 있으면 유지)
  const enrichedConfigs = configs.map((cfg) => ({
    ...cfg,
    sharedState: cfg.sharedState ?? groupSharedState,
  }));

  // Promise.all로 모든 서브에이전트를 동시에 실행
  return Promise.all(enrichedConfigs.map(spawnSubagent));
}

/**
 * 에이전트 루프 설정 타입 — agent-loop과 runtime 모듈 간 공유
 *
 * 순환 의존성을 방지하기 위해 AgentLoopConfig와 PermissionResult를
 * agent-loop.ts에서 분리한 독립 타입 모듈입니다.
 *
 * @module core/agent-loop-config
 */

import { type LLMProvider, type ThinkingConfig } from "../llm/provider.js";
import { type ToolCallStrategy } from "../llm/tool-call-strategy.js";
import { type ToolRegistry } from "../tools/registry.js";
import { type ExtractedToolCall } from "../tools/types.js";
import { type AppEventEmitter } from "../utils/events.js";
import { type CheckpointManager } from "./checkpoint-manager.js";
import { type DualModelRouter } from "../llm/dual-model-router.js";

/**
 * 에이전트 루프 설정
 *
 * 루프의 동작을 제어하는 모든 옵션을 담고 있습니다.
 * LLM 클라이언트, 도구 레지스트리, 이벤트 이미터 등 필수 의존성과
 * 최대 반복 횟수, 토큰 제한 등 선택적 설정을 포함합니다.
 */
export interface AgentLoopConfig {
  /** LLM API 클라이언트 (OpenAI, Anthropic 등) */
  readonly client: LLMProvider;
  /** 사용할 LLM 모델명 (예: "gpt-4", "claude-3") */
  readonly model: string;
  /** 등록된 도구 목록을 관리하는 레지스트리 */
  readonly toolRegistry: ToolRegistry;
  /** 도구 호출 전략 (네이티브 함수 호출 / 텍스트 파싱) */
  readonly strategy: ToolCallStrategy;
  /** 이벤트 이미터 — UI에 진행 상황을 알리는 데 사용 */
  readonly events: AppEventEmitter;
  /** 최대 반복 횟수 (기본값: constants.ts의 AGENT_LOOP.maxIterations) */
  readonly maxIterations?: number;
  /** LLM 응답의 창의성 수준 (0 = 결정적, 1 = 창의적) */
  readonly temperature?: number;
  /** LLM 응답의 최대 토큰 수 */
  readonly maxTokens?: number;
  /** 취소 신호 — 사용자가 Esc를 누르면 전파됨 */
  readonly signal?: AbortSignal;
  /** 작업 디렉토리 경로 */
  readonly workingDirectory?: string;
  /** 도구 호출 전 권한 확인 콜백 (사용자에게 승인 요청) */
  readonly checkPermission?: (call: ExtractedToolCall) => Promise<PermissionResult>;
  /** Maximum LLM call retries per iteration (default: 2) */
  readonly maxRetries?: number;
  /** Use streaming for LLM calls (emits text deltas via events) */
  readonly useStreaming?: boolean;
  /** Maximum tokens for the context window (enables auto-compaction) */
  readonly maxContextTokens?: number;
  /** Maximum characters per individual tool result (default: 12000) */
  readonly maxToolResultChars?: number;
  /** Maximum tokens per individual tool result (overrides maxToolResultChars when set) */
  readonly maxToolResultTokens?: number;
  /** Enable security guardrails for tool calls (default: true) */
  readonly enableGuardrails?: boolean;
  /** Checkpoint manager for auto-checkpointing file mutations */
  readonly checkpointManager?: CheckpointManager;
  /** Session ID for checkpoint metadata */
  readonly sessionId?: string;
  /** Extended thinking configuration (for Claude models) */
  readonly thinking?: ThinkingConfig;
  /** Dual-model router for architect/editor pattern (optional) */
  readonly dualModelRouter?: DualModelRouter;
  /** Whether this agent loop is running as a subagent (for retry behavior) */
  readonly isSubagent?: boolean;
}

/**
 * 권한 확인 결과
 *
 * @property allowed - 도구 실행이 허용되었는지 여부
 * @property reason - 거부 시 거부 사유
 */
export interface PermissionResult {
  readonly allowed: boolean;
  readonly reason?: string;
}

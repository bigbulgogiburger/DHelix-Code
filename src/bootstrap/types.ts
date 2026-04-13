/**
 * Bootstrap 타입 정의 — AppContext 및 팩토리 옵션
 *
 * @module bootstrap/types
 */

import { type LLMProvider } from "../llm/provider.js";
import { type ToolCallStrategy } from "../llm/tool-call-strategy.js";
import { type ToolRegistry } from "../tools/registry.js";
import { type PermissionManager } from "../permissions/manager.js";
import { type ContextManager } from "../core/context-manager.js";
import { type SessionManager } from "../core/session-manager.js";
import { type HookRunner } from "../hooks/runner.js";
import { type CommandRegistry } from "../commands/registry.js";
import { type SkillManager } from "../skills/manager.js";
import { type MCPManagerConnector } from "../mcp/manager-connector.js";
import { type MCPManager } from "../mcp/manager.js";

/**
 * CLI에서 파싱된 옵션
 */
export interface CLIOptions {
  readonly model?: string;
  readonly baseUrl?: string;
  readonly apiKey?: string;
  readonly verbose: boolean;
  readonly continue?: boolean;
  readonly resume?: string;
  readonly print?: string;
  readonly outputFormat: string;
  readonly addDir?: string[];
}

/**
 * 앱 전체에서 공유되는 의존성 컨테이너
 *
 * Ink App, headless mode 모두 이 컨텍스트를 소비합니다.
 */
export interface AppContext {
  readonly client: LLMProvider;
  readonly model: string;
  readonly toolRegistry: ToolRegistry;
  readonly strategy: ToolCallStrategy;
  readonly permissionManager: PermissionManager;
  readonly contextManager: ContextManager;
  readonly sessionManager: SessionManager;
  readonly hookRunner: HookRunner;
  readonly commandRegistry: CommandRegistry;
  readonly skillManager: SkillManager;
  readonly config: ResolvedConfig;
  readonly mcpConnector?: MCPManagerConnector;
  readonly mcpManager?: MCPManager;
}

/**
 * loadConfig에서 반환되는 설정 구조의 최소 타입
 */
export interface ResolvedConfig {
  readonly llm: {
    readonly model: string;
    readonly baseUrl?: string;
    readonly apiKey?: string;
    readonly contextWindow: number;
    readonly timeout: number;
    readonly apiKeyHeader?: string;
  };
  readonly ui: {
    readonly statusBar: boolean;
  };
  readonly locale?: string;
  readonly tone?: string;
  readonly verbose?: boolean;
}

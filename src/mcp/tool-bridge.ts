/**
 * MCP 도구 브리지 — MCP 서버의 도구를 dbcode 도구 레지스트리에 연결하는 모듈
 *
 * MCP 서버는 자체적인 도구 정의(MCPToolDefinition)를 가지고 있고,
 * dbcode는 자체적인 도구 시스템(ToolDefinition)을 가지고 있습니다.
 * 이 모듈은 두 시스템을 "브리지(다리)"로 연결하여,
 * MCP 서버의 도구를 dbcode 내에서 자연스럽게 사용할 수 있게 합니다.
 *
 * 주요 변환 작업:
 * 1. 이름 네임스페이싱: MCP 도구 이름을 "mcp__서버명__도구명" 형태로 변환
 * 2. 스키마 변환: MCP의 JSON Schema를 Zod 스키마로 변환 (타입 검증용)
 * 3. 실행 프록시: dbcode가 도구를 호출하면 실제로는 MCP 클라이언트를 통해 서버에서 실행
 */
import { z } from "zod";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { type ToolDefinition, type ToolResult } from "../tools/types.js";
import { type ToolRegistry } from "../tools/registry.js";
import { BaseError } from "../utils/error.js";
import { getLogger } from "../utils/logger.js";
import { type MCPClient } from "./client.js";
import { type MCPToolDefinition } from "./types.js";

/**
 * MCP 도구 브리지 에러 클래스
 *
 * 브리지 동작 중 발생하는 에러를 나타냅니다.
 */
export class MCPBridgeError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "MCP_BRIDGE_ERROR", context);
  }
}

/**
 * MCP 도구 출력 최대 토큰 수 — 환경변수 MAX_MCP_OUTPUT_TOKENS로 조절 가능
 * Claude Code와 동일한 패턴: 기본 25,000 토큰 (Claude Code 기본값과 일치)
 */
const MAX_MCP_OUTPUT_TOKENS = (() => {
  const envValue = process.env.MAX_MCP_OUTPUT_TOKENS;
  if (envValue) {
    const parsed = parseInt(envValue, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return 25_000;
})();

/**
 * MCP 도구 실행 타임아웃 — 환경변수 MCP_TOOL_TIMEOUT으로 조절 가능
 * Claude Code는 기본 ~27.8시간이지만, dbcode는 실용적인 120초(2분)를 기본값으로 사용
 */
const MCP_TOOL_TIMEOUT_MS = (() => {
  const envValue = process.env.MCP_TOOL_TIMEOUT;
  if (envValue) {
    const parsed = parseInt(envValue, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return 120_000;
})();

/**
 * 대용량 MCP 출력을 파일로 저장하는 임계값 (문자 수)
 * Claude Code: 400,000자 초과 시 파일 저장 + preview(2,000자)만 LLM에 전달
 */
const LARGE_OUTPUT_THRESHOLD = 400_000;
const PREVIEW_SIZE = 2_000;

/**
 * 대용량 MCP 출력을 임시 파일로 저장하고 preview를 반환합니다.
 * Claude Code의 Tier 3 패턴: 전체 출력은 파일로, LLM에는 preview만 전달
 */
async function persistLargeOutput(
  output: string,
  toolName: string,
  serverName: string,
): Promise<string> {
  const logger = getLogger();
  try {
    const dir = join(tmpdir(), "dbcode-mcp-outputs");
    await mkdir(dir, { recursive: true });
    const timestamp = Date.now();
    const safeName = toolName.replace(/[^a-zA-Z0-9_-]/g, "_");
    const filepath = join(dir, `${safeName}_${timestamp}.txt`);
    await writeFile(filepath, output, "utf-8");

    const preview = output.slice(0, PREVIEW_SIZE);
    const isJson = output.trimStart().startsWith("{") || output.trimStart().startsWith("[");

    logger.info(
      { filepath, originalSize: output.length, serverName },
      `[MCP Bridge] Large output persisted to file`,
    );

    return (
      `<persisted-output>\n` +
      `Output too large (${output.length} characters). Full output saved to: ${filepath}\n\n` +
      `Preview (first ${PREVIEW_SIZE} chars):\n` +
      `${preview}\n...\n` +
      `</persisted-output>\n\n` +
      (isJson
        ? `[Hint] The full output is JSON. Use file_read to inspect the saved file if needed.`
        : `[Hint] Use file_read to inspect the saved file if you need more data.`)
    );
  } catch (err) {
    logger.warn(
      { error: err instanceof Error ? err.message : String(err) },
      `[MCP Bridge] Failed to persist large output`,
    );
    // 파일 저장 실패 시 기존 truncation으로 fallback
    const truncated = output.slice(0, MAX_MCP_OUTPUT_TOKENS * 4);
    return `${truncated}\n\n[Output truncated: exceeded ${MAX_MCP_OUTPUT_TOKENS} token limit. File persistence failed.]`;
  }
}

/**
 * MCP JSON Schema를 Zod 스키마로 변환합니다.
 *
 * Zod는 TypeScript용 스키마 유효성 검사 라이브러리로,
 * 런타임에서 데이터의 형태와 타입을 검증합니다.
 *
 * JSON Schema의 기본 타입(object, string, number, boolean, array)을
 * 대응하는 Zod 스키마로 변환합니다. 복잡한 스키마는 passthrough 처리합니다.
 *
 * @param schema - MCP 도구의 JSON Schema 객체
 * @returns 변환된 Zod 스키마
 */
function jsonSchemaToZod(schema: Readonly<Record<string, unknown>>): z.ZodType {
  const type = schema.type as string | undefined;

  // 객체 타입: 각 속성(property)을 재귀적으로 변환
  if (type === "object") {
    const properties = (schema.properties ?? {}) as Record<string, Record<string, unknown>>;
    const required = (schema.required ?? []) as string[];
    const shape: Record<string, z.ZodType> = {};

    for (const [key, propSchema] of Object.entries(properties)) {
      let field = jsonSchemaToZod(propSchema);
      // required 배열에 없는 필드는 선택적(optional)으로 설정
      if (!required.includes(key)) {
        field = field.optional();
      }
      shape[key] = field;
    }

    // passthrough(): 스키마에 정의되지 않은 추가 필드도 허용
    return z.object(shape).passthrough();
  }

  // 기본 타입 매핑
  if (type === "string") return z.string();
  if (type === "number" || type === "integer") return z.number();
  if (type === "boolean") return z.boolean();
  if (type === "array") {
    const items = schema.items as Record<string, unknown> | undefined;
    return z.array(items ? jsonSchemaToZod(items) : z.unknown());
  }

  // 알 수 없는 타입: 자유 형태의 Record로 폴백
  return z.record(z.unknown());
}

/**
 * MCP 도구 정의를 dbcode ToolDefinition으로 변환합니다.
 *
 * 변환된 도구는 호출 시 MCP 클라이언트를 통해 원격 서버에서 실행됩니다.
 * 즉, 실행 로직은 로컬이 아니라 MCP 서버 측에 있습니다.
 *
 * @param mcpTool - MCP 도구 정의 (이름, 설명, 입력 스키마)
 * @param client - 도구를 실행할 MCP 클라이언트
 * @param serverName - MCP 서버 이름 (네임스페이싱에 사용)
 * @returns dbcode 도구 정의
 */
function bridgeMCPTool(
  mcpTool: MCPToolDefinition,
  client: MCPClient,
  serverName: string,
): ToolDefinition {
  // 네임스페이싱: "mcp__서버명__도구명" 형태로 고유한 이름 생성
  // 예: mcp__github__create_issue
  const namespacedName = `mcp__${serverName}__${mcpTool.name}`;
  // JSON Schema → Zod 변환으로 입력 매개변수 검증 스키마 생성
  const parameterSchema = jsonSchemaToZod(mcpTool.inputSchema);

  return {
    name: namespacedName,
    description: `[MCP: ${serverName}] ${mcpTool.description}`,
    parameterSchema,
    // "confirm" 권한: 사용자에게 실행 확인을 요청
    permissionLevel: "confirm",
    timeoutMs: MCP_TOOL_TIMEOUT_MS,
    /**
     * 도구 실행 함수 — MCP 클라이언트를 통해 원격 서버에서 도구를 실행합니다.
     *
     * @param params - 사용자가 전달한 도구 매개변수
     * @returns 도구 실행 결과
     */
    execute: async (params: unknown): Promise<ToolResult> => {
      try {
        const args = (params ?? {}) as Record<string, unknown>;

        // MCP 도구 호출 디버그 로깅 — 전달되는 인수를 기록하여 문제 진단에 활용
        const logger = getLogger();
        logger.debug(
          { tool: namespacedName, args: JSON.stringify(args, null, 2) },
          `[MCP Bridge] Calling tool: ${mcpTool.name}`,
        );

        // MCP 서버에 도구 호출 요청
        const result = await client.callTool(mcpTool.name, args);

        // 결과의 텍스트 콘텐츠를 하나의 문자열로 합침
        const output = result.content
          .map((c) => c.text ?? "")
          .filter(Boolean)
          .join("\n");

        // 3-tier 출력 제한 (Claude Code 패턴)
        // Tier 3: 400,000자 초과 → 파일 저장 + preview
        if (output.length > LARGE_OUTPUT_THRESHOLD) {
          const persisted = await persistLargeOutput(output, mcpTool.name, serverName);
          return {
            output: persisted,
            isError: false,
            metadata: { truncated: true, persisted: true, serverName },
          };
        }
        // Tier 2: 토큰 한도 초과 → in-memory truncation
        if (output.length > MAX_MCP_OUTPUT_TOKENS * 4) {
          const truncated = output.slice(0, MAX_MCP_OUTPUT_TOKENS * 4);
          return {
            output: `${truncated}\n\n[OUTPUT TRUNCATED - exceeded ${MAX_MCP_OUTPUT_TOKENS} token limit]`,
            isError: false,
            metadata: { truncated: true, serverName },
          };
        }
        // Tier 1: 정상 범위 → 그대로 전달

        // MCP 서버가 에러를 반환한 경우 디버그 로깅
        if (result.isError) {
          logger.warn(
            {
              tool: namespacedName,
              output: output.slice(0, 300),
              args: JSON.stringify(args).slice(0, 300),
            },
            `[MCP Bridge] Tool returned error: ${mcpTool.name}`,
          );
        }

        return {
          output,
          isError: result.isError === true,
          metadata: { serverName },
        };
      } catch (error) {
        // 에러 발생 시 인수와 함께 로깅하여 디버깅 지원
        const logger = getLogger();
        const args = (params ?? {}) as Record<string, unknown>;
        logger.error(
          {
            tool: namespacedName,
            args: JSON.stringify(args, null, 2),
            error: error instanceof Error ? error.message : String(error),
          },
          `[MCP Bridge] Tool call failed: ${mcpTool.name}`,
        );
        const errorMsg = error instanceof Error ? error.message : String(error);
        const argsPreview = JSON.stringify(args).slice(0, 500);

        // MCP 에러 유형별 recovery hint 생성
        const recoveryHint = getMCPRecoveryHint(errorMsg, mcpTool.name);

        return {
          output: `MCP tool error: ${errorMsg}\n\n${recoveryHint}\n\n[Debug] Arguments sent: ${argsPreview}`,
          isError: true,
          metadata: { serverName, mcpErrorType: classifyMCPError(errorMsg) },
        };
      }
    },
  };
}

/**
 * MCP 에러 유형을 분류합니다.
 * agent-loop에서 MCP 특화 recovery를 적용하기 위한 메타데이터로 사용됩니다.
 */
type MCPErrorType = "timeout" | "connection" | "permission" | "server_error" | "unknown";

function classifyMCPError(errorMsg: string): MCPErrorType {
  const lower = errorMsg.toLowerCase();
  if (lower.includes("timed out") || lower.includes("timeout") || lower.includes("etimedout")) {
    return "timeout";
  }
  if (
    lower.includes("econnrefused") ||
    lower.includes("econnreset") ||
    lower.includes("disconnected")
  ) {
    return "connection";
  }
  if (lower.includes("permission") || lower.includes("denied") || lower.includes("forbidden")) {
    return "permission";
  }
  if (lower.includes("500") || lower.includes("internal") || lower.includes("-32")) {
    return "server_error";
  }
  return "unknown";
}

/**
 * MCP 에러 유형별 LLM recovery 힌트를 생성합니다.
 * LLM이 에러를 보고 적절한 다음 행동을 취하도록 유도합니다.
 */
function getMCPRecoveryHint(errorMsg: string, toolName: string): string {
  const errorType = classifyMCPError(errorMsg);
  switch (errorType) {
    case "timeout":
      return (
        `[Recovery hint] The MCP tool "${toolName}" timed out. ` +
        `Do NOT retry the same call. Instead: ` +
        `(1) Inform the user that this tool timed out, ` +
        `(2) Suggest an alternative approach or ask if they want to try again with different parameters.`
      );
    case "connection":
      return (
        `[Recovery hint] Cannot connect to the MCP server for "${toolName}". ` +
        `The server may be down or not started. ` +
        `Inform the user and suggest checking the MCP server status with /mcp command.`
      );
    case "permission":
      return (
        `[Recovery hint] Permission denied for "${toolName}". ` +
        `Do NOT retry. Inform the user and suggest an alternative approach.`
      );
    case "server_error":
      return (
        `[Recovery hint] The MCP server returned an internal error for "${toolName}". ` +
        `This may be a temporary issue. Inform the user of the error and ask if they want to retry.`
      );
    default:
      return (
        `[Recovery hint] The MCP tool "${toolName}" failed unexpectedly. ` +
        `Inform the user of the error and suggest an alternative approach.`
      );
  }
}

/**
 * MCP 도구 브리지 — MCP 서버에서 도구를 발견하고 dbcode 도구 레지스트리에 등록합니다.
 *
 * 지연 로딩(lazy loading)과 동적 업데이트를 지원합니다.
 * 서버에서 도구 목록이 변경되면 자동으로 갱신됩니다.
 */
export class MCPToolBridge {
  /** 서버별 등록된 도구 이름 맵 */
  private readonly registeredTools = new Map<string, readonly string[]>();

  /**
   * @param toolRegistry - 도구를 등록할 dbcode 도구 레지스트리
   */
  constructor(private readonly toolRegistry: ToolRegistry) {}

  /**
   * MCP 클라이언트에서 도구를 발견하고 레지스트리에 등록합니다.
   *
   * 도구 이름은 "mcp__<서버이름>__<도구이름>" 형태로 네임스페이싱되어
   * 여러 서버의 도구가 충돌하지 않습니다.
   *
   * @param client - 도구를 가져올 MCP 클라이언트
   * @param serverName - MCP 서버 이름
   * @returns 등록된 도구의 네임스페이싱된 이름 배열
   */
  async registerTools(client: MCPClient, serverName: string): Promise<readonly string[]> {
    // 서버에서 사용 가능한 도구 목록 조회
    const mcpTools = await client.listTools();
    const registeredNames: string[] = [];

    for (const mcpTool of mcpTools) {
      // MCP 도구를 dbcode 도구로 브리지(변환)
      const bridged = bridgeMCPTool(mcpTool, client, serverName);

      // 이미 등록된 도구는 건너뜀 (재연결 시 중복 방지)
      if (!this.toolRegistry.has(bridged.name)) {
        this.toolRegistry.register(bridged);
      }

      registeredNames.push(bridged.name);
    }

    this.registeredTools.set(serverName, registeredNames);

    // 도구 목록 변경 알림 핸들러 등록
    // 서버에서 "notifications/tools/list_changed" 알림이 오면 도구 목록을 갱신
    client.setToolsChangedCallback(() => {
      void this.handleListChanged(client, serverName);
    });

    return registeredNames;
  }

  /**
   * tools/list_changed 알림을 처리합니다.
   *
   * 서버에서 도구 목록이 변경되면 이 메서드가 호출되어
   * 새로운 도구를 발견하고 레지스트리에 등록합니다.
   * (현재 레지스트리는 도구 제거를 지원하지 않으므로 새 도구만 추가)
   *
   * @param client - MCP 클라이언트
   * @param serverName - 서버 이름
   */
  private async handleListChanged(client: MCPClient, serverName: string): Promise<void> {
    await this.registerTools(client, serverName);
  }

  /**
   * 특정 서버의 모든 등록된 도구를 레지스트리에서 제거합니다.
   *
   * @param serverName - 도구를 제거할 서버 이름
   * @returns 제거된 도구 이름 배열
   */
  unregisterServerTools(serverName: string): readonly string[] {
    const toolNames = this.registeredTools.get(serverName) ?? [];
    for (const name of toolNames) {
      this.toolRegistry.unregister(name);
    }
    this.registeredTools.delete(serverName);
    return toolNames;
  }

  /**
   * 특정 서버에서 등록된 모든 도구 이름을 반환합니다.
   *
   * @param serverName - 서버 이름
   * @returns 등록된 도구 이름 배열 (없으면 빈 배열)
   */
  getServerTools(serverName: string): readonly string[] {
    return this.registeredTools.get(serverName) ?? [];
  }

  /**
   * 도구가 등록된 모든 서버 이름을 반환합니다.
   *
   * @returns 서버 이름 배열
   */
  getRegisteredServers(): readonly string[] {
    return [...this.registeredTools.keys()];
  }

  /**
   * MCP 도구의 총 토큰 수가 지연 로딩 임계값을 초과하는지 확인합니다.
   *
   * 도구 스키마가 너무 많은 토큰을 차지하면 LLM 컨텍스트를 낭비하므로,
   * 이 경우 도구를 "지연 로딩(deferred)"으로 전환합니다.
   * 지연 로딩된 도구는 이름과 설명만 저장하고,
   * 실제 스키마는 ToolSearch를 통해 필요할 때만 로딩합니다.
   *
   * @param mcpToolTokens - MCP 도구의 총 토큰 수
   * @param maxContextTokens - LLM의 최대 컨텍스트 토큰 수
   * @returns true면 도구를 지연 로딩해야 함
   */
  shouldDeferTools(mcpToolTokens: number, maxContextTokens: number): boolean {
    // 도구 토큰이 전체 컨텍스트의 10%를 초과하면 지연 로딩
    return mcpToolTokens > maxContextTokens * 0.1;
  }
}

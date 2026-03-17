/**
 * 도구 레지스트리 — 모든 도구의 등록, 조회, LLM 형식 변환을 관리하는 중앙 저장소
 *
 * 레지스트리 패턴(Registry Pattern)을 사용하여 도구를 이름으로 등록하고 조회합니다.
 * LLM에 전달할 때는 Zod 스키마를 JSON Schema로 변환하여 OpenAI 호환 형식을 생성합니다.
 *
 * 주요 기능:
 * - 도구 등록/조회/목록 관리 (Map 기반)
 * - LLM 함수 호출(Function Calling) 형식으로 변환
 * - 지연 로딩(Deferred Loading): MCP 도구를 필요할 때만 로드하여 초기 로드 시간 단축
 * - Hot Tool 관리: 자주 사용하는 핵심 도구만 LLM에 항상 전달
 *
 * MCP(Model Context Protocol) — 외부 서비스/도구를 LLM에 연결하는 표준 프로토콜
 */
import { type ToolDefinition, type ToolDefinitionForLLM } from "./types.js";
import { zodSchemaToJsonSchema } from "./validation.js";
import { ToolError } from "../utils/error.js";
import { type MCPToolSearch } from "../mcp/tool-search.js";

/**
 * 도구 레지스트리 클래스 — 도구를 등록하고, 이름으로 조회하고, LLM 형식으로 변환하는 중앙 관리자
 */
export class ToolRegistry {
  /**
   * 도구 저장소 — 이름(key)으로 도구 정의(value)를 매핑하는 Map
   * Map을 사용하면 O(1) 시간에 도구를 조회할 수 있습니다.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly tools = new Map<string, ToolDefinition<any>>();

  /**
   * MCP 도구 검색 인스턴스 — 지연 로딩되는 MCP 도구를 검색하고 해석하는 데 사용
   * null이면 MCP 도구 지연 로딩이 비활성화된 상태
   */
  private toolSearch: MCPToolSearch | null = null;

  /**
   * "핫 도구(Hot Tools)" 목록 — 매 LLM 요청마다 항상 전체 스키마가 포함되는 핵심 도구들
   *
   * 이 도구들은 코딩 작업에서 가장 빈번하게 사용되므로,
   * 항상 LLM에 전체 정의를 전달하여 호출 정확도를 높입니다.
   */
  private readonly hotTools = new Set<string>([
    "file_read",
    "file_write",
    "file_edit",
    "bash_exec",
    "glob_search",
    "grep_search",
  ]);

  /**
   * 도구를 레지스트리에 등록
   *
   * 이미 같은 이름으로 등록된 도구가 있으면 ToolError를 던져 중복 등록을 방지합니다.
   *
   * @param tool - 등록할 도구 정의 객체
   * @throws {ToolError} 동일한 이름의 도구가 이미 등록된 경우
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register(tool: ToolDefinition<any>): void {
    if (this.tools.has(tool.name)) {
      throw new ToolError(`Tool already registered: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
  }

  /**
   * 여러 도구를 한 번에 등록 — 초기화 시 모든 내장 도구를 일괄 등록할 때 사용
   *
   * @param tools - 등록할 도구 정의 배열
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerAll(tools: readonly ToolDefinition<any>[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  /**
   * 이름으로 도구 조회 — 없으면 undefined 반환
   *
   * @param name - 찾을 도구의 이름 (예: "file_read")
   * @returns 도구 정의 또는 undefined
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get(name: string): ToolDefinition<any> | undefined {
    return this.tools.get(name);
  }

  /**
   * 이름으로 도구 조회 — 없으면 예외를 던짐 (반드시 존재해야 하는 경우에 사용)
   *
   * @param name - 찾을 도구의 이름
   * @returns 도구 정의
   * @throws {ToolError} 도구를 찾을 수 없는 경우
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  require(name: string): ToolDefinition<any> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new ToolError(`Tool not found: ${name}`);
    }
    return tool;
  }

  /**
   * 특정 이름의 도구가 등록되어 있는지 확인
   *
   * @param name - 확인할 도구 이름
   * @returns 등록 여부 (true/false)
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * 등록된 모든 도구의 이름 목록을 반환
   *
   * @returns 도구 이름 배열 (readonly)
   */
  getNames(): readonly string[] {
    return [...this.tools.keys()];
  }

  /**
   * 등록된 모든 도구 정의를 배열로 반환
   *
   * @returns 도구 정의 배열 (readonly)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getAll(): readonly ToolDefinition<any>[] {
    return [...this.tools.values()];
  }

  /**
   * 모든 도구를 LLM 함수 호출(Function Calling) 형식으로 변환
   *
   * 각 도구의 Zod 스키마를 JSON Schema로 변환하여
   * OpenAI API가 요구하는 { type: "function", function: { name, description, parameters } } 형식을 만듭니다.
   *
   * @returns LLM용 도구 정의 배열
   */
  getDefinitionsForLLM(): readonly ToolDefinitionForLLM[] {
    return this.getAll().map((tool) => ({
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: zodSchemaToJsonSchema(tool.parameterSchema),
      },
    }));
  }

  /**
   * 등록된 도구의 총 개수
   */
  get size(): number {
    return this.tools.size;
  }

  /**
   * MCP 도구 검색 인스턴스를 연결 — MCP 도구 지연 로딩을 활성화
   *
   * MCPToolSearch가 연결되면, MCP 도구들은 필요할 때만 전체 스키마를 로드합니다.
   * 이를 통해 수십~수백 개의 MCP 도구가 있어도 초기 로드 시간을 절약합니다.
   *
   * @param search - MCP 도구 검색 인스턴스
   */
  setToolSearch(search: MCPToolSearch): void {
    this.toolSearch = search;
  }

  /**
   * 지연 로딩 모드가 활성화되었는지 확인
   *
   * toolSearch가 연결되어 있고 지연 로딩할 도구가 1개 이상 있으면 true
   */
  get isDeferredMode(): boolean {
    return this.toolSearch !== null && this.toolSearch.size > 0;
  }

  /**
   * "핫 도구"와 내장(built-in) 도구만 LLM 형식으로 반환
   *
   * MCP 도구(이름이 "mcp__"로 시작)는 제외합니다.
   * MCP 도구는 지연 로딩 방식으로 필요할 때만 스키마를 제공하므로,
   * 매 요청마다 모든 MCP 도구 스키마를 전달하지 않아 토큰을 절약합니다.
   *
   * @returns 핫 도구 + 내장 도구의 LLM 형식 정의 배열
   */
  getHotDefinitionsForLLM(): readonly ToolDefinitionForLLM[] {
    return this.getAll()
      .filter((tool) => this.hotTools.has(tool.name) || !tool.name.startsWith("mcp__"))
      .map((tool) => ({
        type: "function" as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: zodSchemaToJsonSchema(tool.parameterSchema),
        },
      }));
  }

  /**
   * 지연 로딩 대상 MCP 도구들의 요약 정보를 생성
   *
   * 시스템 프롬프트에 삽입하여 LLM이 어떤 MCP 도구가 사용 가능한지 알 수 있게 합니다.
   * 전체 스키마 대신 이름과 간단한 설명만 포함하여 토큰을 절약합니다.
   *
   * @returns 지연 로딩 도구들의 요약 문자열 (toolSearch 미연결 시 빈 문자열)
   */
  getDeferredToolsSummary(): string {
    if (!this.toolSearch) {
      return "";
    }
    return this.toolSearch.generateDeferredToolsSummary();
  }

  /**
   * 네임스페이스 이름으로 지연 로딩 도구의 전체 스키마를 해석(resolve)
   *
   * LLM이 특정 MCP 도구를 사용하려고 할 때, 이 메서드로 전체 스키마를 가져옵니다.
   * 네임스페이스 이름 형식: "mcp__서버명__도구명"
   *
   * @param namespacedName - 네임스페이스가 포함된 도구 이름 (예: "mcp__github__create_issue")
   * @returns LLM용 도구 정의 또는 undefined (도구를 찾을 수 없는 경우)
   */
  resolveDeferredTool(namespacedName: string): ToolDefinitionForLLM | undefined {
    if (!this.toolSearch) {
      return undefined;
    }
    const result = this.toolSearch.getToolDefinition(namespacedName);
    if (!result) {
      return undefined;
    }
    return {
      type: "function" as const,
      function: {
        name: result.namespacedName,
        description: result.tool.description,
        parameters: result.tool.inputSchema as Record<string, unknown>,
      },
    };
  }

  /**
   * 키워드 쿼리로 지연 로딩 도구를 검색
   *
   * LLM이 필요한 도구를 찾기 위해 키워드로 검색할 때 사용합니다.
   * MCPToolSearch에 위임하여 관련도 높은 도구들의 전체 스키마를 반환합니다.
   *
   * @param query - 검색 키워드 (예: "github issue", "slack message")
   * @param maxResults - 최대 반환 개수 (선택사항)
   * @returns 검색 결과에 해당하는 LLM용 도구 정의 배열
   */
  searchDeferredTools(query: string, maxResults?: number): readonly ToolDefinitionForLLM[] {
    if (!this.toolSearch) {
      return [];
    }
    const results = this.toolSearch.search(query, maxResults);
    return results.map((r) => ({
      type: "function" as const,
      function: {
        name: r.namespacedName,
        description: r.tool.description,
        parameters: r.tool.inputSchema as Record<string, unknown>,
      },
    }));
  }
}

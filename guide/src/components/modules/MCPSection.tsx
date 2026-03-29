"use client";

import { SectionHeader } from "../SectionHeader";
import { FilePath } from "../FilePath";
import { MermaidDiagram } from "../MermaidDiagram";
import { ImplDirection } from "../ImplDirection";
import { RevealOnScroll } from "../RevealOnScroll";

const mcpLifecycleChart = `sequenceDiagram
    participant APP as App<br/>CLI 앱 진입점
    participant MGR as MCPManager<br/>MCP 서버 수명주기 관리
    participant SCOPE as ScopeManager<br/>local>project>user 설정 병합
    participant CLIENT as MCPClient<br/>개별 MCP 서버 연결 담당
    participant SERVER as External Server<br/>외부 MCP 서버 프로세스
    participant BRIDGE as ToolBridge<br/>MCP 도구를 dhelix 도구로 변환
    participant REG as ToolRegistry<br/>도구 등록 저장소

    APP->>MGR: connectAll() — 모든 MCP 서버 연결 시작
    MGR->>SCOPE: loadScopedConfigs() — 3-scope 설정 로드
    SCOPE-->>MGR: local > project > user 우선순위로 병합된 설정 반환

    loop 각 서버 (병렬)
        MGR->>CLIENT: connect(name, config) — 서버별 클라이언트 생성
        CLIENT->>SERVER: JSON-RPC initialize — 프로토콜 초기화 요청
        SERVER-->>CLIENT: capabilities — 서버 기능 목록 응답
        CLIENT->>SERVER: tools/list — 사용 가능한 도구 목록 요청
        SERVER-->>CLIENT: Tool[] 목록 — 도구 스키마 배열 반환
        CLIENT->>BRIDGE: registerTools(server, tools) — 도구 브릿지에 등록 요청
        BRIDGE->>REG: register(mcp__server__tool) — 네임스페이스 접두사로 도구 등록
    end

    MGR-->>APP: ConnectAllResult — 전체 연결 결과 반환`;

const transports = [
  {
    name: "stdio",
    protocol: "stdin/stdout",
    useCase: "로컬 CLI 도구 (playwright, serena)",
    note: "가장 일반적. 프로세스 직접 스폰",
  },
  { name: "http", protocol: "HTTP POST", useCase: "원격 API 서버", note: "요청/응답 1:1 매핑" },
  {
    name: "sse",
    protocol: "Server-Sent Events",
    useCase: "실시간 스트리밍 서버",
    note: "서버→클라이언트 단방향 스트림",
  },
];

const scopes = [
  {
    name: "Local (최우선)",
    path: ".dhelix/mcp-local.json",
    icon: "🔒",
    color: "border-t-red-600",
    desc: "개인 전용 설정. .gitignore에 포함. API 키가 들어간 서버 설정에 사용.",
  },
  {
    name: "Project",
    path: ".dhelix/mcp.json",
    icon: "👥",
    color: "border-t-blue-600",
    desc: "팀 공유 설정. Git에 커밋. 팀원 모두 같은 MCP 서버를 사용하도록.",
  },
  {
    name: "User (전역)",
    path: "~/.dhelix/mcp-servers.json",
    icon: "🌐",
    color: "border-t-emerald-600",
    desc: "모든 프로젝트에 적용되는 전역 MCP 서버 설정.",
  },
];

export function MCPSection() {
  return (
    <section
      id="mcp"
      className="py-16 bg-blue-50/50"
      style={{ paddingTop: "64px", paddingBottom: "64px" }}
    >
      <div className="center-container">
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <SectionHeader
              label="MODULE 06"
              labelColor="pink"
              title="MCP System — 외부 도구 연동 파이프라인"
              description="Model Context Protocol로 외부 서버의 도구/리소스/프롬프트를 표준화하여 연동합니다."
            />
          </div>
        </RevealOnScroll>

        <RevealOnScroll>
          <div className="flex gap-2 flex-wrap mb-6">
            <FilePath path="src/mcp/manager.ts" />
            <FilePath path="src/mcp/client.ts" />
            <FilePath path="src/mcp/tool-bridge.ts" />
            <FilePath path="src/mcp/scope-manager.ts" />
          </div>
        </RevealOnScroll>

        <RevealOnScroll>
          <MermaidDiagram chart={mcpLifecycleChart} title="MCP 서버 수명주기" titleColor="pink" />
        </RevealOnScroll>

        <RevealOnScroll>
          <h3
            className="text-lg font-semibold text-gray-900 mb-4"
            style={{ marginTop: "32px", marginBottom: "16px" }}
          >
            3-Scope 설정 우선순위
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5" style={{ gap: "20px" }}>
            {scopes.map((s) => (
              <div
                key={s.name}
                className={`border border-[#e2e8f0] rounded-lg p-5 bg-white hover:bg-gray-50 hover:border-gray-300 border-t-[3px] ${s.color}`}
                style={{ padding: "20px" }}
              >
                <h4 className="text-sm font-bold mb-2">
                  {s.icon} {s.name}
                </h4>
                <div className="mb-2">
                  <FilePath path={s.path} />
                </div>
                <p className="text-xs text-gray-600">{s.desc}</p>
              </div>
            ))}
          </div>
        </RevealOnScroll>

        <RevealOnScroll>
          <h3
            className="text-lg font-semibold text-gray-900 mt-8 mb-4"
            style={{ marginTop: "32px", marginBottom: "16px" }}
          >
            Transport Layer 종류
          </h3>
          <div
            className="border border-[#e2e8f0] rounded-lg overflow-hidden bg-white"
            style={{ marginBottom: "24px" }}
          >
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {["Transport", "프로토콜", "사용 사례", "특징"].map((h) => (
                    <th
                      key={h}
                      className="p-3 px-4 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500 bg-gray-50 border-b border-gray-200"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-sm">
                {transports.map((t) => (
                  <tr
                    key={t.name}
                    className="hover:bg-gray-50 border-b border-gray-100 transition-colors"
                  >
                    <td className="p-3 px-4 text-sm font-mono text-cyan-600 font-semibold">
                      {t.name}
                    </td>
                    <td className="p-3 px-4 text-sm">{t.protocol}</td>
                    <td className="p-3 px-4 text-sm">{t.useCase}</td>
                    <td className="p-3 px-4 text-sm">{t.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </RevealOnScroll>

        <RevealOnScroll>
          <ImplDirection
            items={[
              "<strong>새 Transport 추가</strong>: WebSocket 지원으로 양방향 실시간 통신",
              "<strong>도구 필터링 강화</strong>: MCPToolFilter에 include/exclude 규칙으로 노출 도구 제어",
              "<strong>MCP 서버 헬스 체크</strong>: 주기적 ping으로 서버 상태 모니터링 + 자동 재연결",
              "<strong>리소스 프로토콜</strong>: 도구 외에 resources/list, prompts/list 활용으로 동적 컨텍스트 주입",
            ]}
          />
        </RevealOnScroll>
      </div>
    </section>
  );
}

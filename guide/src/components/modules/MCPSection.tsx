"use client";

import { SectionHeader } from "../SectionHeader";
import { FilePath } from "../FilePath";
import { MermaidDiagram } from "../MermaidDiagram";
import { ImplDirection } from "../ImplDirection";
import { RevealOnScroll } from "../RevealOnScroll";

const mcpLifecycleChart = `sequenceDiagram
    participant APP as App
    participant MGR as MCPManager
    participant SCOPE as ScopeManager
    participant CLIENT as MCPClient
    participant SERVER as External Server
    participant BRIDGE as ToolBridge
    participant REG as ToolRegistry

    APP->>MGR: connectAll()
    MGR->>SCOPE: loadScopedConfigs()
    SCOPE-->>MGR: local > project > user 병합

    loop 각 서버 (병렬)
        MGR->>CLIENT: connect(name, config)
        CLIENT->>SERVER: JSON-RPC initialize
        SERVER-->>CLIENT: capabilities
        CLIENT->>SERVER: tools/list
        SERVER-->>CLIENT: Tool[] 목록
        CLIENT->>BRIDGE: registerTools(server, tools)
        BRIDGE->>REG: register(mcp__server__tool)
    end

    MGR-->>APP: ConnectAllResult`;

const transports = [
  { name: "stdio", protocol: "stdin/stdout", useCase: "로컬 CLI 도구 (playwright, serena)", note: "가장 일반적. 프로세스 직접 스폰" },
  { name: "http", protocol: "HTTP POST", useCase: "원격 API 서버", note: "요청/응답 1:1 매핑" },
  { name: "sse", protocol: "Server-Sent Events", useCase: "실시간 스트리밍 서버", note: "서버→클라이언트 단방향 스트림" },
];

const scopes = [
  { name: "Local (최우선)", path: ".dbcode/mcp-local.json", icon: "🔒", color: "border-t-accent-red", desc: "개인 전용 설정. .gitignore에 포함. API 키가 들어간 서버 설정에 사용." },
  { name: "Project", path: ".dbcode/mcp.json", icon: "👥", color: "border-t-accent-blue", desc: "팀 공유 설정. Git에 커밋. 팀원 모두 같은 MCP 서버를 사용하도록." },
  { name: "User (전역)", path: "~/.dbcode/mcp-servers.json", icon: "🌐", color: "border-t-accent-green", desc: "모든 프로젝트에 적용되는 전역 MCP 서버 설정." },
];

export function MCPSection() {
  return (
    <section id="mcp" className="py-20 bg-bg-secondary">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-8">
        <RevealOnScroll>
          <SectionHeader
            label="MODULE 06"
            labelColor="pink"
            title="MCP System — 외부 도구 연동 파이프라인"
            description="Model Context Protocol로 외부 서버의 도구/리소스/프롬프트를 표준화하여 연동합니다."
          />
        </RevealOnScroll>

        <RevealOnScroll>
          <div className="flex gap-2 flex-wrap mb-5">
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
          <h3 className="text-lg font-bold mb-4">3-Scope 설정 우선순위</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {scopes.map((s) => (
              <div key={s.name} className={`bg-bg-card border border-border rounded-2xl p-6 border-t-[3px] ${s.color}`}>
                <h4 className="text-sm font-bold mb-2">{s.icon} {s.name}</h4>
                <div className="mb-2"><FilePath path={s.path} /></div>
                <p className="text-xs text-text-secondary">{s.desc}</p>
              </div>
            ))}
          </div>
        </RevealOnScroll>

        <RevealOnScroll>
          <h3 className="text-lg font-bold mt-6 mb-4">Transport Layer 종류</h3>
          <div className="bg-bg-card border border-border rounded-2xl overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {["Transport", "프로토콜", "사용 사례", "특징"].map((h) => (
                    <th key={h} className="p-3 px-5 text-left text-[11px] font-bold uppercase tracking-wider text-text-muted bg-[rgba(255,255,255,0.02)] border-b border-border">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-[13px]">
                {transports.map((t) => (
                  <tr key={t.name} className="hover:bg-[rgba(59,130,246,0.03)] border-b border-[rgba(255,255,255,0.03)]">
                    <td className="p-3 px-5 font-mono text-accent-cyan font-semibold">{t.name}</td>
                    <td className="p-3 px-5">{t.protocol}</td>
                    <td className="p-3 px-5">{t.useCase}</td>
                    <td className="p-3 px-5">{t.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </RevealOnScroll>

        <RevealOnScroll>
          <ImplDirection items={[
            "<strong>새 Transport 추가</strong>: WebSocket 지원으로 양방향 실시간 통신",
            "<strong>도구 필터링 강화</strong>: MCPToolFilter에 include/exclude 규칙으로 노출 도구 제어",
            "<strong>MCP 서버 헬스 체크</strong>: 주기적 ping으로 서버 상태 모니터링 + 자동 재연결",
            "<strong>리소스 프로토콜</strong>: 도구 외에 resources/list, prompts/list 활용으로 동적 컨텍스트 주입",
          ]} />
        </RevealOnScroll>
      </div>
    </section>
  );
}

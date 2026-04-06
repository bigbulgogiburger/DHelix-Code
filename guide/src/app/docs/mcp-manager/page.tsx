"use client";

import { FilePath } from "@/components/FilePath";
import { LayerBadge } from "@/components/LayerBadge";
import { MermaidDiagram } from "@/components/MermaidDiagram";
import { CodeBlock } from "@/components/CodeBlock";
import { Callout } from "@/components/Callout";
import { RevealOnScroll } from "@/components/RevealOnScroll";
import { DeepDive } from "@/components/DeepDive";
import { ParamTable } from "@/components/ParamTable";
import { SeeAlso } from "@/components/SeeAlso";

export default function MCPManagerPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ───────────────────── 1. Header ───────────────────── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <FilePath path="src/mcp/manager.ts" />
              <LayerBadge layer="infra" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mb-3">
              <span className="text-gray-900">MCP Manager</span>
            </h1>
            <p className="text-[16px] text-gray-600 max-w-[640px]">
              MCP 서버의 전체 수명주기를 관리하는 모듈입니다. 3-Scope 설정(
              <span className="text-violet-600 font-semibold">local &gt; project &gt; user</span>)
              우선순위에 따라 서버를 병렬 연결하고,{" "}
              <span className="text-cyan-600 font-semibold">ToolBridge</span>를 통해 MCP 도구를
              dhelix의 도구 레지스트리에 자동 등록합니다.
            </p>
          </div>
        </RevealOnScroll>

        {/* ───────────────────── 2. 개요 ───────────────────── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>{"📋"}</span> 개요
            </h2>
            <p className="text-[14px] text-gray-600 leading-relaxed mb-4">
              MCP(Model Context Protocol) 서버는 외부 도구를 dhelix에 연결하는 표준 프로토콜입니다.
              <code className="text-cyan-600 text-xs"> MCPManager</code>는 설정 파일에서 서버 목록을
              읽어
              <strong className="text-gray-900"> 병렬로 연결</strong>한 뒤, 각 서버가 제공하는
              도구를 <span className="text-cyan-600 font-semibold">MCPToolBridge</span>를 통해
              dhelix의 <span className="text-violet-600 font-semibold">ToolRegistry</span>에 자동
              등록합니다. 일부 서버 연결이 실패해도 나머지 서버는 정상 동작하는
              <strong className="text-gray-900">
                {" "}
                부분 실패 허용(partial failure tolerance)
              </strong>{" "}
              설계입니다.
            </p>

            <Callout type="tip" icon="💡">
              <strong>핵심 원칙:</strong> MCP 서버 연결은{" "}
              <code className="text-cyan-600 text-xs">Promise.allSettled</code>로 병렬 수행됩니다.
              하나의 서버가 타임아웃되어도 다른 서버는 정상 연결됩니다.
            </Callout>

            <MermaidDiagram
              title="MCP Manager 아키텍처 위치"
              titleColor="orange"
              chart={`flowchart TB
  APP["App.tsx / useAgentLoop<br/><small>CLI 진입점 훅</small>"]
  CMD["commands/registry.ts<br/><small>슬래시 명령 레지스트리</small>"]
  MGR["MCPManager<br/><small>MCP 수명주기 관리</small>"]
  SCOPE["MCPScopeManager<br/><small>3-Scope 설정 병합</small>"]
  CLIENT["MCPClient<br/><small>서버별 연결 담당</small>"]
  BRIDGE["MCPToolBridge<br/><small>도구 자동 변환 등록</small>"]
  REG["ToolRegistry<br/><small>중앙 도구 레지스트리</small>"]

  APP -->|"connectAll()"| MGR
  CMD -->|"/mcp 명령"| MGR
  MGR --> SCOPE
  MGR --> CLIENT
  MGR --> BRIDGE
  BRIDGE --> REG
  SCOPE -->|"local>project>user"| MGR

  style MGR fill:#ede9fe,stroke:#8b5cf6,color:#1e293b
  style APP fill:#f1f5f9,stroke:#3b82f6,color:#1e293b
  style CMD fill:#f1f5f9,stroke:#3b82f6,color:#1e293b
  style SCOPE fill:#f1f5f9,stroke:#f59e0b,color:#1e293b
  style CLIENT fill:#f1f5f9,stroke:#06b6d4,color:#1e293b
  style BRIDGE fill:#f1f5f9,stroke:#10b981,color:#1e293b
  style REG fill:#f1f5f9,stroke:#ef4444,color:#1e293b`}
            />

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4">
              <h4 className="text-[14px] font-bold mb-3">MCPManager가 조율하는 4개 컴포넌트</h4>
              <div className="flex flex-col gap-2.5 text-[13px] text-gray-600">
                <div className="flex gap-3">
                  <span className="text-amber-600 font-bold shrink-0 w-28">ScopeManager</span>
                  <span>
                    3개 스코프(local/project/user)에서 설정 파일을 로드하고{" "}
                    <strong className="text-gray-900">우선순위 병합</strong>
                  </span>
                </div>
                <div className="flex gap-3">
                  <span className="text-cyan-600 font-bold shrink-0 w-28">MCPClient</span>
                  <span>개별 MCP 서버와의 연결 담당 &mdash; stdio 또는 HTTP 트랜스포트</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-emerald-600 font-bold shrink-0 w-28">MCPToolBridge</span>
                  <span>
                    MCP 서버의 도구를 dhelix{" "}
                    <code className="text-cyan-600 text-xs">ToolRegistry</code>에{" "}
                    <strong className="text-gray-900">자동 변환/등록</strong>
                  </span>
                </div>
                <div className="flex gap-3">
                  <span className="text-red-600 font-bold shrink-0 w-28">ToolRegistry</span>
                  <span>등록된 도구를 Agent Loop에 제공하는 중앙 레지스트리</span>
                </div>
              </div>
            </div>
          </section>
        </RevealOnScroll>

        {/* ───────────────────── 3. 레퍼런스 ───────────────────── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>{"📖"}</span> 레퍼런스
            </h2>

            {/* MCPManagerConfig */}
            <div className="mb-8">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">MCPManagerConfig</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                  exported
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-600">
                  interface
                </span>
              </h3>
              <p className="text-[13px] text-gray-600 mb-3">
                MCPManager 생성 시 전달하는 설정 인터페이스입니다.
              </p>

              <ParamTable
                params={[
                  {
                    name: "configPath",
                    type: "string | undefined",
                    required: false,
                    desc: "설정 파일 경로. 기본값: ~/.dhelix/mcp.json",
                  },
                  {
                    name: "workingDirectory",
                    type: "string | undefined",
                    required: false,
                    desc: "작업 디렉토리. 지정하면 3-Scope 설정(local>project>user)이 활성화됨",
                  },
                  {
                    name: "toolRegistry",
                    type: "ToolRegistry",
                    required: true,
                    desc: "MCP 도구를 등록할 대상 레지스트리",
                  },
                ]}
              />
            </div>

            {/* ConnectAllResult */}
            <div className="mb-8">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">ConnectAllResult</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                  exported
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-600">
                  interface
                </span>
              </h3>
              <p className="text-[13px] text-gray-600 mb-3">
                <code className="text-cyan-600 text-xs">connectAll()</code> 메서드의 반환값으로,
                성공/실패한 서버 목록을 분리하여 제공합니다.
              </p>

              <ParamTable
                params={[
                  {
                    name: "connected",
                    type: "string[]",
                    required: true,
                    desc: "성공적으로 연결된 서버 이름 목록",
                  },
                  {
                    name: "failed",
                    type: "Array<{ name: string; error: string }>",
                    required: true,
                    desc: "연결 실패한 서버 목록 (이름 + 에러 메시지)",
                  },
                ]}
              />
            </div>

            {/* MCPManager class */}
            <div className="mb-8">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">MCPManager</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                  exported
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-600">
                  class
                </span>
              </h3>
              <p className="text-[13px] text-gray-600 mb-3">
                MCP 서버 수명주기의 중심 클래스입니다. 설정 로딩, 연결 관리, 도구 브리지를 통합하여
                전체 수명주기를 관리합니다.
              </p>

              <div className="bg-white border border-gray-200 rounded-xl p-4 mb-3">
                <h4 className="text-[13px] font-bold mb-3">주요 메서드</h4>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-[12px]">
                    <thead>
                      <tr>
                        <th className="p-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-200">
                          메서드
                        </th>
                        <th className="p-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-200">
                          반환 타입
                        </th>
                        <th className="p-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-200">
                          설명
                        </th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      <tr className="border-b border-gray-200">
                        <td className="p-2.5 text-violet-600 font-semibold">loadConfig()</td>
                        <td className="p-2.5 text-cyan-600">
                          Promise&lt;Record&lt;string, MCPServerConfig&gt;&gt;
                        </td>
                        <td className="p-2.5 text-gray-600 font-sans">
                          설정 파일에서 서버 설정 로드. 파일 없으면 빈 객체 반환
                        </td>
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="p-2.5 text-violet-600 font-semibold">loadScopedConfigs()</td>
                        <td className="p-2.5 text-cyan-600">
                          Promise&lt;Record&lt;string, MCPServerConfig&gt;&gt;
                        </td>
                        <td className="p-2.5 text-gray-600 font-sans">
                          3-Scope 우선순위로 설정 로드 (local &gt; project &gt; user)
                        </td>
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="p-2.5 text-violet-600 font-semibold">connectAll()</td>
                        <td className="p-2.5 text-cyan-600">Promise&lt;ConnectAllResult&gt;</td>
                        <td className="p-2.5 text-gray-600 font-sans">
                          모든 서버에 병렬 연결 + 도구 등록
                        </td>
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="p-2.5 text-violet-600 font-semibold">
                          connectServer(name, config)
                        </td>
                        <td className="p-2.5 text-cyan-600">Promise&lt;readonly string[]&gt;</td>
                        <td className="p-2.5 text-gray-600 font-sans">
                          특정 서버 연결 + 도구 등록. 기존 연결 있으면 재연결
                        </td>
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="p-2.5 text-violet-600 font-semibold">disconnectAll()</td>
                        <td className="p-2.5 text-cyan-600">Promise&lt;void&gt;</td>
                        <td className="p-2.5 text-gray-600 font-sans">
                          모든 서버 연결 해제 + clients Map 초기화
                        </td>
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="p-2.5 text-violet-600 font-semibold">
                          getRegisteredTools()
                        </td>
                        <td className="p-2.5 text-cyan-600">
                          ReadonlyMap&lt;string, readonly string[]&gt;
                        </td>
                        <td className="p-2.5 text-gray-600 font-sans">
                          서버별 등록된 도구 이름 맵 반환
                        </td>
                      </tr>
                      <tr>
                        <td className="p-2.5 text-violet-600 font-semibold">
                          getConnectedServers()
                        </td>
                        <td className="p-2.5 text-cyan-600">readonly string[]</td>
                        <td className="p-2.5 text-gray-600 font-sans">
                          현재 연결된 서버 이름 목록 반환
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* MCPManagerError */}
            <div className="mb-4">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">MCPManagerError</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                  exported
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-50 text-red-600">
                  extends BaseError
                </span>
              </h3>
              <p className="text-[13px] text-gray-600 mb-3">
                설정 파싱 실패, 연결 오류 등 MCP 매니저에서 발생하는 에러 클래스입니다. 에러 코드는{" "}
                <code className="text-cyan-600 text-xs">MCP_MANAGER_ERROR</code>이며,
                <code className="text-cyan-600 text-xs"> context</code> 객체에 경로, 원인 등의 상세
                정보가 포함됩니다.
              </p>

              <ParamTable
                params={[
                  {
                    name: "message",
                    type: "string",
                    required: true,
                    desc: "에러 메시지",
                  },
                  {
                    name: "context",
                    type: "Record<string, unknown>",
                    required: false,
                    desc: "추가 컨텍스트 (path, cause 등). 기본값은 빈 객체 {}",
                  },
                ]}
              />
            </div>
          </section>
        </RevealOnScroll>

        {/* ───────────────────── 4. 사용법 ───────────────────── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>{"🚀"}</span> 사용법
            </h2>

            <h3
              className="text-[15px] font-bold"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              기본 사용 (앱 부팅 시 전체 연결)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              앱이 시작될 때 <code className="text-cyan-600 text-xs">MCPManager</code>를 생성하고
              <code className="text-cyan-600 text-xs"> connectAll()</code>을 호출합니다. 설정 파일의
              모든 서버에 병렬로 연결되며, 결과에서 성공/실패를 확인할 수 있습니다.
            </p>

            <CodeBlock>
              <span className="text-[#ff7b72]">import</span>{" "}
              <span className="text-[#c9d1d9]">{"{ "}</span>
              <span className="text-[#79c0ff]">MCPManager</span>
              <span className="text-[#c9d1d9]">{" }"}</span>{" "}
              <span className="text-[#ff7b72]">from</span>{" "}
              <span className="text-[#a5d6ff]">{'"./mcp/manager.js"'}</span>
              <span className="text-[#c9d1d9]">;</span>
              {"\n\n"}
              <span className="text-[#8b949e]">
                {"// 매니저 생성 (workingDirectory로 3-Scope 활성화)"}
              </span>
              {"\n"}
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#79c0ff]">manager</span>{" "}
              <span className="text-[#c9d1d9]">=</span> <span className="text-[#ff7b72]">new</span>{" "}
              <span className="text-[#d2a8ff]">MCPManager</span>
              <span className="text-[#c9d1d9]">({"{"}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"  "}</span>
              <span className="text-[#79c0ff]">workingDirectory</span>
              <span className="text-[#c9d1d9]">{": "}</span>
              <span className="text-[#a5d6ff]">{'"./my-project"'}</span>
              <span className="text-[#c9d1d9]">{","}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"  "}</span>
              <span className="text-[#79c0ff]">toolRegistry</span>
              <span className="text-[#c9d1d9]">{","}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"}"}</span>
              <span className="text-[#c9d1d9]">);</span>
              {"\n\n"}
              <span className="text-[#8b949e]">{"// 모든 서버에 병렬 연결"}</span>
              {"\n"}
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#c9d1d9]">{"{ "}</span>
              <span className="text-[#79c0ff]">connected</span>
              <span className="text-[#c9d1d9]">{", "}</span>
              <span className="text-[#79c0ff]">failed</span>
              <span className="text-[#c9d1d9]">{" }"}</span>{" "}
              <span className="text-[#c9d1d9]">=</span>{" "}
              <span className="text-[#ff7b72]">await</span>{" "}
              <span className="text-[#c9d1d9]">manager.</span>
              <span className="text-[#d2a8ff]">connectAll</span>
              <span className="text-[#c9d1d9]">();</span>
              {"\n\n"}
              <span className="text-[#8b949e]">{"// 결과 확인"}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">console.</span>
              <span className="text-[#d2a8ff]">log</span>
              <span className="text-[#c9d1d9]">(</span>
              <span className="text-[#a5d6ff]">{'"연결 성공:"'}</span>
              <span className="text-[#c9d1d9]">{", connected"}</span>
              <span className="text-[#c9d1d9]">);</span>
              <span className="text-[#8b949e]">{' // ["github", "slack"]'}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">console.</span>
              <span className="text-[#d2a8ff]">log</span>
              <span className="text-[#c9d1d9]">(</span>
              <span className="text-[#a5d6ff]">{'"연결 실패:"'}</span>
              <span className="text-[#c9d1d9]">{", failed"}</span>
              <span className="text-[#c9d1d9]">);</span>
              <span className="text-[#8b949e]">{' // [{ name: "jira", error: "timeout" }]'}</span>
            </CodeBlock>

            <h3
              className="text-[15px] font-bold"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              MCP 설정 파일 작성하기
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              <code className="text-cyan-600 text-xs">~/.dhelix/mcp.json</code> (사용자 전역) 또는
              프로젝트 디렉토리의 <code className="text-cyan-600 text-xs">.dhelix/mcp.json</code>{" "}
              (프로젝트별)에 서버 설정을 작성합니다.{" "}
              <code className="text-cyan-600 text-xs">mcpServers</code> 필드 안에 서버 이름을 키로
              사용합니다.
            </p>

            <CodeBlock>
              <span className="text-[#8b949e]">{"// ~/.dhelix/mcp.json"}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"{"}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"  "}</span>
              <span className="text-[#7ee787]">{'"mcpServers"'}</span>
              <span className="text-[#c9d1d9]">{": {"}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"    "}</span>
              <span className="text-[#7ee787]">{'"github"'}</span>
              <span className="text-[#c9d1d9]">{": {"}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"      "}</span>
              <span className="text-[#7ee787]">{'"transport"'}</span>
              <span className="text-[#c9d1d9]">{": "}</span>
              <span className="text-[#a5d6ff]">{'"stdio"'}</span>
              <span className="text-[#c9d1d9]">{","}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"      "}</span>
              <span className="text-[#7ee787]">{'"command"'}</span>
              <span className="text-[#c9d1d9]">{": "}</span>
              <span className="text-[#a5d6ff]">{'"npx"'}</span>
              <span className="text-[#c9d1d9]">{","}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"      "}</span>
              <span className="text-[#7ee787]">{'"args"'}</span>
              <span className="text-[#c9d1d9]">{": ["}</span>
              <span className="text-[#a5d6ff]">{'"@modelcontextprotocol/server-github"'}</span>
              <span className="text-[#c9d1d9]">{"],"}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"      "}</span>
              <span className="text-[#7ee787]">{'"env"'}</span>
              <span className="text-[#c9d1d9]">{": { "}</span>
              <span className="text-[#7ee787]">{'"GITHUB_TOKEN"'}</span>
              <span className="text-[#c9d1d9]">{": "}</span>
              <span className="text-[#a5d6ff]">{'"ghp_..."'}</span>
              <span className="text-[#c9d1d9]">{" }"}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"    },"}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"    "}</span>
              <span className="text-[#7ee787]">{'"my-api"'}</span>
              <span className="text-[#c9d1d9]">{": {"}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"      "}</span>
              <span className="text-[#7ee787]">{'"transport"'}</span>
              <span className="text-[#c9d1d9]">{": "}</span>
              <span className="text-[#a5d6ff]">{'"sse"'}</span>
              <span className="text-[#c9d1d9]">{","}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"      "}</span>
              <span className="text-[#7ee787]">{'"url"'}</span>
              <span className="text-[#c9d1d9]">{": "}</span>
              <span className="text-[#a5d6ff]">{'"http://localhost:3001/mcp"'}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"    }"}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"  }"}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"}"}</span>
            </CodeBlock>

            <Callout type="warn" icon="⚠️">
              설정 파일의 JSON 문법이 틀리면{" "}
              <code className="text-red-600 text-xs">MCPManagerError</code>가 발생합니다. 파일이
              아예 존재하지 않는 경우에는 에러 없이 빈 설정(서버 0개)으로 동작합니다. 이 두 가지
              상황을 구분하는 것이 중요합니다.
            </Callout>

            <DeepDive title="3-Scope 설정 우선순위 상세">
              <p className="mb-3">
                <code className="text-cyan-600 text-xs">workingDirectory</code>를 지정하면
                <code className="text-cyan-600 text-xs"> MCPScopeManager</code>가 활성화되어 3개
                스코프에서 설정을 찾습니다. 같은 이름의 서버가 여러 스코프에 있으면
                <strong> local이 최우선</strong>으로 적용됩니다.
              </p>

              <div className="bg-white border border-gray-200 rounded-xl p-4 mb-3">
                <h4 className="text-[13px] font-bold mb-3">스코프 우선순위</h4>
                <div className="flex flex-col gap-2 text-[13px] text-gray-600">
                  <div className="flex gap-3">
                    <span className="text-red-600 font-bold shrink-0 w-16">1순위</span>
                    <span>
                      <strong className="text-gray-900">local</strong> &mdash;{" "}
                      <code className="text-cyan-600 text-xs">.dhelix/mcp.json</code> (현재
                      디렉토리)
                    </span>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-amber-600 font-bold shrink-0 w-16">2순위</span>
                    <span>
                      <strong className="text-gray-900">project</strong> &mdash; 프로젝트 루트의
                      설정 파일
                    </span>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-emerald-600 font-bold shrink-0 w-16">3순위</span>
                    <span>
                      <strong className="text-gray-900">user</strong> &mdash;{" "}
                      <code className="text-cyan-600 text-xs">~/.dhelix/mcp.json</code> (전역 설정)
                    </span>
                  </div>
                </div>
              </div>

              <Callout type="info" icon="📝">
                <code className="text-cyan-600 text-xs">workingDirectory</code>가 설정되지 않으면
                스코프 매니저가 비활성화되고, 레거시{" "}
                <code className="text-cyan-600 text-xs">loadConfig()</code>로 폴백합니다. 이 경우{" "}
                <code className="text-cyan-600 text-xs">configPath</code> 단일 파일만 사용됩니다.
              </Callout>
            </DeepDive>

            <h3
              className="text-[15px] font-bold"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              특정 서버만 연결하기
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              <code className="text-cyan-600 text-xs">connectServer()</code>를 직접 호출하면 개별
              서버에 대한 세밀한 제어가 가능합니다. 이미 연결된 서버에 호출하면 기존 연결을 끊고
              재연결합니다.
            </p>

            <CodeBlock>
              <span className="text-[#8b949e]">{"// 특정 서버만 연결"}</span>
              {"\n"}
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#79c0ff]">toolNames</span>{" "}
              <span className="text-[#c9d1d9]">=</span>{" "}
              <span className="text-[#ff7b72]">await</span>{" "}
              <span className="text-[#c9d1d9]">manager.</span>
              <span className="text-[#d2a8ff]">connectServer</span>
              <span className="text-[#c9d1d9]">(</span>
              <span className="text-[#a5d6ff]">{'"github"'}</span>
              <span className="text-[#c9d1d9]">{", {"}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"  "}</span>
              <span className="text-[#79c0ff]">name</span>
              <span className="text-[#c9d1d9]">{": "}</span>
              <span className="text-[#a5d6ff]">{'"github"'}</span>
              <span className="text-[#c9d1d9]">{","}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"  "}</span>
              <span className="text-[#79c0ff]">transport</span>
              <span className="text-[#c9d1d9]">{": "}</span>
              <span className="text-[#a5d6ff]">{'"stdio"'}</span>
              <span className="text-[#c9d1d9]">{","}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"  "}</span>
              <span className="text-[#79c0ff]">command</span>
              <span className="text-[#c9d1d9]">{": "}</span>
              <span className="text-[#a5d6ff]">{'"npx"'}</span>
              <span className="text-[#c9d1d9]">{","}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"  "}</span>
              <span className="text-[#79c0ff]">args</span>
              <span className="text-[#c9d1d9]">{": ["}</span>
              <span className="text-[#a5d6ff]">{'"@modelcontextprotocol/server-github"'}</span>
              <span className="text-[#c9d1d9]">{"],"}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"}"}</span>
              <span className="text-[#c9d1d9]">);</span>
              {"\n\n"}
              <span className="text-[#c9d1d9]">console.</span>
              <span className="text-[#d2a8ff]">log</span>
              <span className="text-[#c9d1d9]">(toolNames);</span>
              <span className="text-[#8b949e]">
                {' // ["github_create_issue", "github_list_repos", ...]'}
              </span>
            </CodeBlock>

            <h3
              className="text-[15px] font-bold"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              종료 시 정리
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              앱 종료 시 반드시 <code className="text-cyan-600 text-xs">disconnectAll()</code>을
              호출하여 모든 MCP 서버 연결을 해제해야 합니다. stdio 트랜스포트의 경우 자식 프로세스가
              좀비로 남을 수 있습니다.
            </p>

            <CodeBlock>
              <span className="text-[#8b949e]">{"// 앱 종료 시 정리"}</span>
              {"\n"}
              <span className="text-[#ff7b72]">await</span>{" "}
              <span className="text-[#c9d1d9]">manager.</span>
              <span className="text-[#d2a8ff]">disconnectAll</span>
              <span className="text-[#c9d1d9]">();</span>
              {"\n\n"}
              <span className="text-[#8b949e]">{"// 연결된 서버 확인 (빈 배열이어야 함)"}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">manager.</span>
              <span className="text-[#d2a8ff]">getConnectedServers</span>
              <span className="text-[#c9d1d9]">();</span>
              <span className="text-[#8b949e]">{" // []"}</span>
            </CodeBlock>
          </section>
        </RevealOnScroll>

        {/* ───────────────────── 5. 내부 구현 ───────────────────── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>{"⚙️"}</span> 내부 구현
            </h2>

            <h3
              className="text-[15px] font-bold"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              connectAll() 실행 흐름
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              <code className="text-cyan-600 text-xs">connectAll()</code>은 설정 로드부터 도구
              등록까지 전체 연결 과정을 오케스트레이션합니다. 핵심은{" "}
              <code className="text-cyan-600 text-xs">Promise.allSettled</code>를 사용하여 개별 서버
              실패가 전체 연결에 영향을 주지 않도록 하는 것입니다.
            </p>

            <MermaidDiagram
              title="connectAll() 실행 흐름"
              titleColor="cyan"
              chart={`flowchart TD
  START["connectAll() 호출<br/><small>전체 연결 시작</small>"] --> LOAD["loadScopedConfigs()<br/><small>3-Scope 설정 로드</small>"]
  LOAD --> CHECK{"서버 설정이<br/><small>있는가?</small>"}
  CHECK -->|"없음"| EMPTY["즉시 반환<br/><small>빈 결과 객체 반환</small>"]
  CHECK -->|"있음"| PARALLEL["Promise.allSettled()<br/><small>모든 서버에 병렬 연결</small>"]
  PARALLEL --> S1["서버 A<br/><small>connectServer 호출</small>"]
  PARALLEL --> S2["서버 B<br/><small>connectServer 호출</small>"]
  PARALLEL --> S3["서버 C<br/><small>connectServer 호출</small>"]
  S1 --> CLASSIFY["결과 분류<br/><small>성공/실패 분리</small>"]
  S2 --> CLASSIFY
  S3 --> CLASSIFY
  CLASSIFY --> RESULT["ConnectAllResult 반환<br/><small>최종 연결 결과</small>"]

  style START fill:#f1f5f9,stroke:#06b6d4,color:#1e293b
  style PARALLEL fill:#ede9fe,stroke:#8b5cf6,color:#1e293b
  style CHECK fill:#f1f5f9,stroke:#f59e0b,color:#1e293b
  style EMPTY fill:#f1f5f9,stroke:#6b7280,color:#1e293b
  style CLASSIFY fill:#f1f5f9,stroke:#10b981,color:#1e293b
  style RESULT fill:#f8fafc,stroke:#06b6d4,color:#06b6d4,stroke-width:2px`}
            />

            <h3
              className="text-[15px] font-bold"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              connectServer() 재연결 로직
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              <code className="text-cyan-600 text-xs">connectServer()</code>는 이미 연결된 서버가
              있으면 먼저 <code className="text-cyan-600 text-xs">disconnect()</code>를 호출한 뒤
              새로 연결합니다. 이 &ldquo;disconnect-before-reconnect&rdquo; 패턴은 서버 설정이
              변경되었을 때 안전하게 갱신할 수 있도록 합니다.
            </p>

            <CodeBlock>
              <span className="text-[#8b949e]">{"// connectServer() 핵심 로직"}</span>
              {"\n"}
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#79c0ff]">existing</span>{" "}
              <span className="text-[#c9d1d9]">=</span> <span className="text-[#ff7b72]">this</span>
              <span className="text-[#c9d1d9]">.clients.</span>
              <span className="text-[#d2a8ff]">get</span>
              <span className="text-[#c9d1d9]">(name);</span>
              {"\n"}
              <span className="text-[#ff7b72]">if</span>{" "}
              <span className="text-[#c9d1d9]">(existing) {"{"}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"  "}</span>
              <span className="text-[#ff7b72]">await</span>{" "}
              <span className="text-[#c9d1d9]">existing.</span>
              <span className="text-[#d2a8ff]">disconnect</span>
              <span className="text-[#c9d1d9]">();</span>
              <span className="text-[#8b949e]">{" // 기존 연결 해제"}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"}"}</span>
              {"\n\n"}
              <span className="text-[#8b949e]">{"// 새 클라이언트 생성 → 연결 → Map에 저장"}</span>
              {"\n"}
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#79c0ff]">client</span>{" "}
              <span className="text-[#c9d1d9]">=</span> <span className="text-[#ff7b72]">new</span>{" "}
              <span className="text-[#d2a8ff]">MCPClient</span>
              <span className="text-[#c9d1d9]">(config);</span>
              {"\n"}
              <span className="text-[#ff7b72]">await</span>{" "}
              <span className="text-[#c9d1d9]">client.</span>
              <span className="text-[#d2a8ff]">connect</span>
              <span className="text-[#c9d1d9]">();</span>
              {"\n"}
              <span className="text-[#ff7b72]">this</span>
              <span className="text-[#c9d1d9]">.clients.</span>
              <span className="text-[#d2a8ff]">set</span>
              <span className="text-[#c9d1d9]">(name, client);</span>
              {"\n\n"}
              <span className="text-[#8b949e]">{"// ToolBridge로 도구 등록"}</span>
              {"\n"}
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#79c0ff]">toolNames</span>{" "}
              <span className="text-[#c9d1d9]">=</span>{" "}
              <span className="text-[#ff7b72]">await</span>{" "}
              <span className="text-[#ff7b72]">this</span>
              <span className="text-[#c9d1d9]">.bridge.</span>
              <span className="text-[#d2a8ff]">registerTools</span>
              <span className="text-[#c9d1d9]">(client, name);</span>
            </CodeBlock>

            <h3
              className="text-[15px] font-bold"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              설정 파일 파싱 전략
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              <code className="text-cyan-600 text-xs">loadConfig()</code>은 파일이 존재하지 않으면
              빈 객체를 반환하는 &ldquo;조용한 실패&rdquo; 전략을 사용합니다. 하지만 파일은
              존재하는데 JSON 파싱에 실패하면
              <code className="text-red-600 text-xs"> MCPManagerError</code>를 던집니다. 이 구분이
              중요합니다 &mdash; 파일이 없는 것은 &ldquo;아직 설정하지 않은 것&rdquo;이고, 파싱
              실패는 &ldquo;설정 오류&rdquo;이기 때문입니다.
            </p>

            <Callout type="info" icon="📝">
              <strong>설계 의도:</strong> <code className="text-cyan-600 text-xs">readFile()</code>
              의 에러는 catch하여 빈 객체를 반환하지만,{" "}
              <code className="text-cyan-600 text-xs">JSON.parse()</code>의 에러는
              <code className="text-red-600 text-xs"> MCPManagerError</code>로 래핑하여 던집니다.
              사용자가 설정 파일을 작성했는데 문법 오류가 있으면 즉시 알 수 있도록 하기 위함입니다.
            </Callout>
          </section>
        </RevealOnScroll>

        {/* ───────────────────── 6. 트러블슈팅 ───────────────────── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>{"🔧"}</span> 트러블슈팅
            </h2>

            <div className="flex flex-col gap-4">
              {/* FAQ 1 */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-600">Q.</span> MCPManagerError: Failed to parse MCP
                  config file 에러가 발생해요
                </h4>
                <div className="text-[13px] text-gray-600 leading-relaxed">
                  <p className="mb-2">
                    <strong className="text-gray-900">원인:</strong> 설정 파일(
                    <code className="text-cyan-600 text-xs">~/.dhelix/mcp.json</code> 또는 프로젝트
                    설정)의 JSON 문법이 잘못되었습니다.
                  </p>
                  <p>
                    <strong className="text-gray-900">해결:</strong> 터미널에서{" "}
                    <code className="text-cyan-600 text-xs">
                      cat ~/.dhelix/mcp.json | python3 -m json.tool
                    </code>
                    로 문법을 검증하세요. 후행 쉼표(trailing comma)나 따옴표 누락이 흔한 원인입니다.
                  </p>
                </div>
              </div>

              {/* FAQ 2 */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-600">Q.</span> MCP 서버가 연결됐다고 하는데 도구가
                  보이지 않아요
                </h4>
                <div className="text-[13px] text-gray-600 leading-relaxed">
                  <p className="mb-2">
                    <strong className="text-gray-900">확인 1:</strong>{" "}
                    <code className="text-cyan-600 text-xs">getRegisteredTools()</code>로 서버별
                    등록된 도구를 확인하세요. 서버에 연결은 됐지만 도구가 0개인 경우가 있습니다.
                  </p>
                  <p>
                    <strong className="text-gray-900">확인 2:</strong> MCP 서버가{" "}
                    <code className="text-cyan-600 text-xs">tools/list</code> 메서드를 올바르게
                    구현하고 있는지 확인하세요. 서버 쪽 로그를 활성화하면 진단이 쉬워집니다.
                  </p>
                </div>
              </div>

              {/* FAQ 3 */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-600">Q.</span> 프로젝트 설정의 서버가 전역 설정의 같은
                  이름 서버를 덮어쓰나요?
                </h4>
                <div className="text-[13px] text-gray-600 leading-relaxed">
                  <p>
                    <strong className="text-gray-900">네, 의도된 동작입니다.</strong> 3-Scope
                    우선순위에 따라 <strong>local &gt; project &gt; user</strong> 순서로 적용됩니다.
                    같은 이름의 서버가 여러 스코프에 정의되어 있으면 우선순위가 높은 스코프의 설정이
                    통째로 사용됩니다 (부분 병합이 아닌 전체 교체).
                  </p>
                </div>
              </div>

              {/* FAQ 4 */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-600">Q.</span> 일부 서버만 연결 실패했는데, 실패한
                  서버를 재시도하려면?
                </h4>
                <div className="text-[13px] text-gray-600 leading-relaxed">
                  <p className="mb-2">
                    <strong className="text-gray-900">방법:</strong>{" "}
                    <code className="text-cyan-600 text-xs">connectAll()</code>의 결과에서{" "}
                    <code className="text-cyan-600 text-xs">failed</code> 배열을 확인하고, 해당
                    서버에 대해{" "}
                    <code className="text-cyan-600 text-xs">connectServer(name, config)</code>를
                    개별 호출하면 됩니다. 이미 연결된 서버에{" "}
                    <code className="text-cyan-600 text-xs">connectServer()</code>를 호출해도
                    안전하게 재연결됩니다.
                  </p>
                </div>
              </div>

              {/* FAQ 5 */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-600">Q.</span> 앱 종료 후 MCP 서버 프로세스가 좀비로
                  남아요
                </h4>
                <div className="text-[13px] text-gray-600 leading-relaxed">
                  <p>
                    <strong className="text-gray-900">원인:</strong>{" "}
                    <code className="text-cyan-600 text-xs">disconnectAll()</code>이 호출되지
                    않았습니다. stdio 트랜스포트 서버는 자식 프로세스로 실행되므로, 연결 해제 없이
                    앱이 종료되면 프로세스가 남을 수 있습니다. 앱의 종료 핸들러에서 반드시{" "}
                    <code className="text-cyan-600 text-xs">disconnectAll()</code>을 호출하세요.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </RevealOnScroll>

        {/* ───────────────────── 7. 관련 문서 ───────────────────── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>{"🔗"}</span> 관련 문서
            </h2>

            <SeeAlso
              items={[
                {
                  name: "tools/registry.ts",
                  slug: "tool-registry",
                  relation: "sibling",
                  desc: "MCP 도구가 등록되는 중앙 도구 레지스트리 — ToolBridge의 최종 목적지",
                },
                {
                  name: "config/loader.ts",
                  slug: "config-loader",
                  relation: "child",
                  desc: "5-Layer 설정 병합 — mcp.json 경로 결정에 영향을 주는 하위 모듈",
                },
                {
                  name: "core/agent-loop.ts",
                  slug: "agent-loop",
                  relation: "parent",
                  desc: "MCP 도구를 소비하는 상위 Agent Loop — 도구 실행의 최종 소비자",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}

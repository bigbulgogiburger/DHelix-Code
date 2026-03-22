"use client";

import { MermaidDiagram } from "@/components/MermaidDiagram";
import { CodeBlock } from "@/components/CodeBlock";
import { Callout } from "@/components/Callout";
import { FilePath } from "@/components/FilePath";
import { RevealOnScroll } from "@/components/RevealOnScroll";
import { DeepDive } from "@/components/DeepDive";
import { ParamTable } from "@/components/ParamTable";
import { LayerBadge } from "@/components/LayerBadge";
import { SeeAlso } from "@/components/SeeAlso";

export default function CmdMcpPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}><div className="center-narrow">
      {/* ─── Header ─── */}
      <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <FilePath path="src/commands/mcp.ts" />
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
            <span className="text-gray-900">
              /mcp MCP 서버 관리
            </span>
          </h1>
          <div className="flex items-center gap-3 mb-5">
            <LayerBadge layer="leaf" />
          </div>
          <p className="text-[16px] text-gray-600 leading-relaxed">
            MCP(Model Context Protocol) 서버의 추가, 제거, 조회를 3-스코프 체계로 관리하는 명령어입니다.
          </p>
        </div>
      </RevealOnScroll>

      {/* ─── 1. 개요 (Overview) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>📋</span> 개요
          </h2>
          <div className="text-[14px] text-gray-600 leading-[1.85] mb-8 space-y-3">
            <p>
              <code className="text-cyan-600">/mcp</code>는 LLM에게 외부 도구와 데이터 소스를
              제공하는 MCP(Model Context Protocol) 서버의 연결을 관리하는 명령어입니다.
              데이터베이스, API, 파일 시스템 등을 MCP 서버로 연결하면 LLM이 직접 해당 리소스에
              접근할 수 있습니다.
            </p>
            <p>
              3-스코프 체계로 설정을 관리합니다: <strong>user</strong>(전역),
              <strong>project</strong>(팀 공유), <strong>local</strong>(개인).
              우선순위는 <code className="text-cyan-600">local &gt; project &gt; user</code> 순서이며,
              같은 이름의 서버가 여러 스코프에 있으면 높은 우선순위 스코프가 적용됩니다.
            </p>
            <p>
              서버 목록 조회 시 <code className="text-cyan-600">MCPManager</code>에서 실시간 연결 상태와
              등록된 도구 수도 함께 표시합니다.
            </p>
          </div>

          <MermaidDiagram
            title="/mcp 스코프 체계"
            titleColor="purple"
            chart={`graph TD
  CMD["/mcp 명령어"]
  LIST["list<br/><small>서버 목록 조회</small>"]
  ADD["add<br/><small>서버 추가</small>"]
  REMOVE["remove<br/><small>서버 제거</small>"]
  LOCAL[".dbcode/mcp-local.json<br/><small>local 스코프<br/>개인, gitignore</small>"]
  PROJ[".dbcode/mcp.json<br/><small>project 스코프<br/>팀 공유, git</small>"]
  USER["~/.dbcode/mcp-servers.json<br/><small>user 스코프<br/>전역</small>"]
  MGR["MCPManager<br/><small>연결 상태 + 도구 수</small>"]

  CMD --> LIST
  CMD --> ADD
  CMD --> REMOVE
  LIST --> LOCAL
  LIST --> PROJ
  LIST --> USER
  LIST --> MGR
  ADD --> LOCAL
  ADD --> PROJ
  ADD --> USER
  REMOVE --> LOCAL
  REMOVE --> PROJ
  REMOVE --> USER

  LOCAL -.->|"우선순위 1"| PROJ
  PROJ -.->|"우선순위 2"| USER

  style CMD fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style LOCAL fill:#fef3c7,stroke:#f59e0b,color:#1e293b,stroke-width:2px
  style PROJ fill:#dcfce7,stroke:#10b981,color:#065f46
  style USER fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style MGR fill:#e0e7ff,stroke:#64748b,color:#1e293b`}
          />

          <Callout type="info" icon="💡">
            <strong>비유:</strong> 3-스코프 체계는 환경변수의 우선순위와 비슷합니다.
            <code>.env.local</code>(개인) &gt; <code>.env</code>(프로젝트) &gt; 시스템 환경변수(전역) 순서로
            같은 이름이면 가장 가까운 설정이 적용됩니다.
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 2. 레퍼런스 (Reference) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>📖</span> 레퍼런스
          </h2>

          {/* ScopeServerEntry interface */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface ScopeServerEntry
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            MCP 서버 설정 엔트리입니다. 설정 파일의 각 서버 항목을 나타냅니다.
          </p>
          <ParamTable
            params={[
              { name: "transport", type: "string", required: false, desc: "전송 방식 (기본값: \"stdio\")" },
              { name: "command", type: "string", required: false, desc: "실행할 명령어 (stdio 전송 시)" },
              { name: "args", type: "string[]", required: false, desc: "명령어 인자 배열" },
              { name: "url", type: "string", required: false, desc: "서버 URL (HTTP 전송 시)" },
              { name: "env", type: "Record<string, string>", required: false, desc: "환경변수 맵" },
            ]}
          />

          {/* 스코프 테이블 */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            스코프 설정 파일
          </h3>
          <ParamTable
            params={[
              { name: "user", type: "~/.dbcode/mcp-servers.json", required: false, desc: "전역 설정 — 모든 프로젝트에 적용 (우선순위 3)" },
              { name: "project", type: ".dbcode/mcp.json", required: false, desc: "팀 공유 설정 — git 커밋 대상 (우선순위 2)" },
              { name: "local", type: ".dbcode/mcp-local.json", required: false, desc: "개인 설정 — gitignore 대상 (우선순위 1, 최우선)" },
            ]}
          />

          {/* 서브커맨드 */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            서브커맨드
          </h3>
          <ParamTable
            params={[
              { name: "/mcp list", type: "조회", required: false, desc: "모든 스코프의 MCP 서버 목록 (연결 상태, 도구 수 포함)" },
              { name: "/mcp add <name> <cmd>", type: "추가", required: false, desc: "stdio 기반 MCP 서버를 user 스코프에 추가 (기본)" },
              { name: "/mcp add -s <scope> <name> <cmd>", type: "추가", required: false, desc: "지정한 스코프에 MCP 서버 추가" },
              { name: "/mcp remove <name>", type: "제거", required: false, desc: "모든 스코프에서 MCP 서버 제거" },
              { name: "/mcp remove -s <scope> <name>", type: "제거", required: false, desc: "지정한 스코프에서만 MCP 서버 제거" },
            ]}
          />

          {/* 핵심 헬퍼 함수 */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            핵심 헬퍼 함수
          </h3>
          <CodeBlock>
            <span className="kw">function</span> <span className="fn">getConfigPath</span>(<span className="prop">scope</span>, <span className="prop">workingDirectory</span>): <span className="type">string</span>
            {"\n"}<span className="kw">async function</span> <span className="fn">readScopeConfig</span>(<span className="prop">filePath</span>): <span className="type">Promise</span>&lt;<span className="type">ScopeConfigFile</span>&gt;
            {"\n"}<span className="kw">async function</span> <span className="fn">addServerToConfig</span>(<span className="prop">filePath</span>, <span className="prop">name</span>, <span className="prop">entry</span>): <span className="type">Promise</span>&lt;<span className="type">void</span>&gt;
            {"\n"}<span className="kw">async function</span> <span className="fn">removeServerFromConfig</span>(<span className="prop">filePath</span>, <span className="prop">name</span>): <span className="type">Promise</span>&lt;<span className="type">boolean</span>&gt;
          </CodeBlock>

          {/* Caveats */}
          <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
          <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
            <li>
              <code className="text-cyan-600">/mcp add</code>의 기본 스코프는
              <code className="text-cyan-600">user</code>입니다. 프로젝트 팀과 공유하려면
              <code>-s project</code> 옵션을 사용하세요.
            </li>
            <li>
              <code className="text-cyan-600">/mcp remove</code>는 <code>-s</code> 옵션이 없으면
              <strong>모든 스코프</strong>에서 해당 서버를 제거합니다.
              특정 스코프만 제거하려면 <code>-s</code> 옵션을 명시하세요.
            </li>
            <li>
              서버를 추가/제거한 후 <strong>dbcode를 재시작</strong>해야 변경사항이 적용됩니다.
              설정 파일 수정만으로는 실시간 반영되지 않습니다.
            </li>
            <li>
              같은 이름의 서버가 여러 스코프에 존재하면, 낮은 우선순위 스코프의 서버는
              &quot;(overridden by higher-priority scope)&quot;로 표시됩니다.
            </li>
          </ul>
        </section>
      </RevealOnScroll>

      {/* ─── 3. 사용법 (Usage) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>🚀</span> 사용법
          </h2>

          {/* 기본 사용법 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>기본 사용법 &mdash; 서버 추가 및 조회</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            MCP 서버를 추가하고 현재 설정된 서버 목록을 확인합니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 1. MCP 서버 추가 (user 스코프, 기본)"}</span>
            {"\n"}<span className="str">/mcp add playwright npx @playwright/mcp@latest</span>
            {"\n"}
            {"\n"}<span className="cm">{"// 출력:"}</span>
            {"\n"}<span className="cm">{"// MCP server \"playwright\" added to user scope."}</span>
            {"\n"}<span className="cm">{"//   Config: ~/.dbcode/mcp-servers.json"}</span>
            {"\n"}<span className="cm">{"//   Command: npx @playwright/mcp@latest"}</span>
            {"\n"}<span className="cm">{"// Restart dbcode to connect to this server."}</span>
            {"\n"}
            {"\n"}<span className="cm">{"// 2. 서버 목록 확인"}</span>
            {"\n"}<span className="str">/mcp list</span>
            {"\n"}
            {"\n"}<span className="cm">{"// 출력 예시:"}</span>
            {"\n"}<span className="cm">{"//   user (~/.dbcode/mcp-servers.json)"}</span>
            {"\n"}<span className="cm">{"//     * playwright: npx @playwright/mcp@latest"}</span>
            {"\n"}<span className="cm">{"//       12 tools | connected"}</span>
            {"\n"}<span className="cm">{"//   project (.dbcode/mcp.json)"}</span>
            {"\n"}<span className="cm">{"//     - postgres: pg-mcp --port 5432"}</span>
            {"\n"}<span className="cm">{"//       not connected"}</span>
          </CodeBlock>

          <Callout type="warn" icon="!">
            <strong>주의:</strong> 서버를 추가한 후 반드시 <strong>dbcode를 재시작</strong>해야 연결됩니다.
            <code>/mcp list</code>에서 &quot;not connected&quot;로 표시되면 재시작이 필요합니다.
          </Callout>

          {/* 스코프별 서버 관리 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; 스코프별 서버 관리
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">-s</code> 옵션으로 스코프를 지정하여 서버를 추가하거나 제거합니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// project 스코프에 추가 (팀과 공유, git 커밋)"}</span>
            {"\n"}<span className="str">/mcp add -s project postgres pg-mcp --port 5432</span>
            {"\n"}
            {"\n"}<span className="cm">{"// local 스코프에 추가 (개인, gitignore)"}</span>
            {"\n"}<span className="str">/mcp add -s local dev-db npx @dev/mcp-db</span>
            {"\n"}
            {"\n"}<span className="cm">{"// 특정 스코프에서만 서버 제거"}</span>
            {"\n"}<span className="str">/mcp remove -s user playwright</span>
            {"\n"}
            {"\n"}<span className="cm">{"// 모든 스코프에서 서버 제거"}</span>
            {"\n"}<span className="str">/mcp remove playwright</span>
          </CodeBlock>

          <Callout type="tip" icon="*">
            <strong>팁:</strong> 스코프 선택 가이드:
            <br />- <strong>user:</strong> 모든 프로젝트에서 쓰는 도구 (playwright, context7 등)
            <br />- <strong>project:</strong> 팀과 공유할 프로젝트별 도구 (DB 연결 등)
            <br />- <strong>local:</strong> 개인적인 개발 환경 도구 (로컬 DB, 실험적 서버)
          </Callout>

          <DeepDive title="서버 목록의 연결 상태 표시">
            <p className="mb-3">
              <code>/mcp list</code>는 MCPManager에서 실시간 연결 상태를 조회합니다:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-gray-600">
              <li><code>*</code> &mdash; 연결됨 (connected). 도구 수도 함께 표시</li>
              <li><code>-</code> &mdash; 미연결 (not connected). 재시작 필요</li>
              <li><code>(overridden)</code> &mdash; 같은 이름이 높은 우선순위 스코프에 존재하여 무시됨</li>
            </ul>
            <p className="mt-3 text-gray-600">
              연결된 서버의 도구 수는 <code className="text-cyan-600">MCPManager.getRegisteredTools()</code>에서
              가져옵니다. 서버가 제공하는 도구가 많을수록 LLM이 활용할 수 있는 기능이 풍부해집니다.
            </p>
          </DeepDive>
        </section>
      </RevealOnScroll>

      {/* ─── 4. 내부 구현 (Internals) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>⚙️</span> 내부 구현
          </h2>

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>스코프 우선순위 해결 플로우</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">handleList()</code>는 local, project, user 순서로 스캔하며
            이미 표시된 서버 이름을 추적하여 중복을 처리합니다.
          </p>

          <MermaidDiagram
            title="스코프 우선순위 해결"
            titleColor="purple"
            chart={`graph TD
  LIST["handleList()"]
  ITER["SCOPES 순회<br/><small>local → project → user</small>"]
  READ["readScopeConfig()<br/><small>JSON 파일 읽기</small>"]
  CHECK{"이미 표시된<br/>서버 이름?"}
  SHOW["서버 표시<br/><small>* 연결됨 | - 미연결</small>"]
  OVER["(overridden)<br/><small>높은 우선순위에 의해 무시</small>"]
  TRACK["displayed Set에 추가"]
  MGR["MCPManager<br/><small>connectedServers<br/>registeredTools</small>"]

  LIST --> ITER
  ITER --> READ
  READ --> CHECK
  CHECK -->|"아니오"| SHOW
  CHECK -->|"예"| OVER
  SHOW --> TRACK
  SHOW --> MGR

  style LIST fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style CHECK fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style SHOW fill:#dcfce7,stroke:#10b981,color:#065f46
  style OVER fill:#fee2e2,stroke:#ef4444,color:#991b1b`}
          />

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>핵심 코드 분석</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            서버 추가 핸들러의 핵심 로직입니다. <code className="text-cyan-600">-s</code> 옵션을 파싱하고
            설정 파일에 서버를 기록합니다.
          </p>
          <CodeBlock>
            <span className="kw">async function</span> <span className="fn">handleAdd</span>(<span className="prop">parts</span>, <span className="prop">workingDirectory</span>) {"{"}
            {"\n"}{"  "}<span className="kw">let</span> <span className="prop">scope</span>: <span className="type">Scope</span> = <span className="str">&quot;user&quot;</span>;{"  "}<span className="cm">{"// 기본 스코프"}</span>
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// -s <scope> 옵션 파싱"}</span>
            {"\n"}{"  "}<span className="kw">if</span> (<span className="prop">remaining</span>[<span className="num">0</span>] === <span className="str">&quot;-s&quot;</span>) {"{"}
            {"\n"}{"    "}<span className="prop">scope</span> = <span className="prop">remaining</span>[<span className="num">1</span>];
            {"\n"}{"    "}<span className="prop">remaining</span> = <span className="prop">remaining</span>.<span className="fn">slice</span>(<span className="num">2</span>);
            {"\n"}{"  "}{"}"}
            {"\n"}
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">entry</span> = {"{"}
            {"\n"}{"    "}<span className="prop">transport</span>: <span className="str">&quot;stdio&quot;</span>,
            {"\n"}{"    "}<span className="prop">command</span>,
            {"\n"}{"    "}...(<span className="prop">cmdArgs</span>.<span className="prop">length</span> {">"} <span className="num">0</span> ? {"{"} <span className="prop">args</span>: <span className="prop">cmdArgs</span> {"}"} : {"{ }"})
            {"\n"}{"  "}{"}"};
            {"\n"}
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">configPath</span> = <span className="fn">getConfigPath</span>(<span className="prop">scope</span>, <span className="prop">workingDirectory</span>);
            {"\n"}{"  "}<span className="kw">await</span> <span className="fn">addServerToConfig</span>(<span className="prop">configPath</span>, <span className="prop">name</span>, <span className="prop">entry</span>);
            {"\n"}{"}"}
          </CodeBlock>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
            <p><strong className="text-gray-900">readScopeConfig()</strong> &mdash; 설정 파일이 없으면 빈 객체를 반환합니다. JSON 파싱 실패도 빈 객체로 안전하게 처리합니다.</p>
            <p><strong className="text-gray-900">addServerToConfig()</strong> &mdash; 디렉토리가 없으면 <code>mkdir recursive</code>로 자동 생성합니다. 기존 설정에 서버를 추가하고 덮어씁니다.</p>
            <p><strong className="text-gray-900">displayed Set</strong> &mdash; 이미 표시된 서버 이름을 추적하여, 낮은 우선순위 스코프에서 같은 이름이 나오면 &quot;overridden&quot;으로 표시합니다.</p>
          </div>
        </section>
      </RevealOnScroll>

      {/* ─── 5. 트러블슈팅 (Troubleshooting) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>🔧</span> 트러블슈팅
          </h2>

          {/* FAQ 1 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;서버를 추가했는데 /mcp list에서 &apos;not connected&apos;로 나와요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              서버 추가 후 <strong>dbcode를 재시작</strong>해야 합니다. 설정 파일에 기록되었지만
              실행 중인 세션에서는 자동으로 연결되지 않습니다.
              재시작 후에도 연결되지 않으면 명령어가 올바른지 터미널에서 직접 실행하여 확인하세요.
            </p>
          </div>

          {/* FAQ 2 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;같은 서버가 &apos;overridden&apos;으로 표시돼요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              같은 이름의 서버가 여러 스코프에 존재하면 우선순위가 높은 스코프
              (local &gt; project &gt; user)만 적용됩니다.
              의도적이라면 그대로 두고, 불필요한 중복이면
              <code>/mcp remove -s &lt;scope&gt; &lt;name&gt;</code>으로 낮은 우선순위 스코프에서 제거하세요.
            </p>
          </div>

          {/* FAQ 3 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;/mcp remove로 서버를 제거했는데 도구가 아직 보여요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              설정 파일에서는 제거되었지만, 현재 실행 중인 세션의 MCPManager는
              이미 연결된 서버를 유지합니다. dbcode를 재시작하면 해당 서버가 연결 목록에서 사라집니다.
            </p>
          </div>

          {/* FAQ 4 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;Invalid scope 에러가 나요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code>-s</code> 옵션에는 <code>local</code>, <code>project</code>, <code>user</code>만
              사용할 수 있습니다. 대소문자를 확인하고, 오타가 없는지 확인하세요.
            </p>
          </div>
        </section>
      </RevealOnScroll>

      {/* ─── 6. 관련 문서 (See Also) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>🔗</span> 관련 문서
          </h2>
          <SeeAlso
            items={[
              {
                name: "mcp-manager.ts",
                slug: "mcp-manager",
                relation: "sibling",
                desc: "MCP 서버 연결, 도구 등록, 생명주기 관리를 담당하는 매니저 모듈",
              },
              {
                name: "mcp-scope-manager.ts",
                slug: "mcp-scope-manager",
                relation: "sibling",
                desc: "3-스코프 설정 병합 및 우선순위 해결을 담당하는 스코프 매니저",
              },
              {
                name: "mcp-tool-bridge.ts",
                slug: "mcp-tool-bridge",
                relation: "sibling",
                desc: "MCP 서버의 도구를 dbcode 내장 도구 시스템으로 브리지하는 모듈",
              },
            ]}
          />
        </section>
      </RevealOnScroll>
    </div></div>
  );
}

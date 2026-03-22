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

export default function MCPScopeManagerPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}><div className="center-narrow">
      {/* ─── Header ─── */}
      <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <FilePath path="src/mcp/scope-manager.ts" />
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
            <span className="text-gray-900">
              MCPScopeManager
            </span>
          </h1>
          <div className="flex items-center gap-3 mb-5">
            <LayerBadge layer="infra" />
          </div>
          <p className="text-[16px] text-gray-600 leading-relaxed">
            세 가지 범위(local, project, user)의 MCP 서버 설정을 관리하는 3-Scope 설정 모듈입니다.
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
              <code className="text-cyan-600">MCPScopeManager</code>는 MCP 서버 설정을
              세 가지 스코프(범위)로 분리하여 관리합니다.
              팀 공용 서버 설정과 개인 개발 서버 설정을 분리할 수 있어,
              <code className="text-cyan-600">.gitignore</code>를 활용한 비밀 관리가 가능합니다.
            </p>
            <p>
              세 스코프의 우선순위는 <strong>local &gt; project &gt; user</strong>입니다.
              같은 이름의 서버가 여러 스코프에 정의되어 있으면 local이 우선합니다.
              이를 통해 팀 설정을 project에, 개인 설정을 local에 배치할 수 있습니다.
            </p>
            <p>
              내부적으로는 역순으로 로딩(user &rarr; project &rarr; local)하여,
              높은 우선순위 설정이 나중에 덮어쓰는 방식으로 병합합니다.
              파일이 없거나 JSON이 잘못된 경우 에러를 던지지 않고 해당 스코프를 건너뜁니다.
            </p>
          </div>

          <MermaidDiagram
            title="MCPScopeManager 3-Scope 병합 흐름"
            titleColor="purple"
            chart={`graph TD
  USER["~/.dbcode/mcp-servers.json<br/><small>User Scope (글로벌)</small>"]
  PROJECT[".dbcode/mcp.json<br/><small>Project Scope (팀 공유)</small>"]
  LOCAL[".dbcode/mcp-local.json<br/><small>Local Scope (개인, gitignore)</small>"]
  MANAGER["MCPScopeManager<br/><small>scope-manager.ts</small>"]
  MERGED["병합된 설정 Map<br/><small>서버이름 → MCPServerConfig</small>"]

  USER -->|"우선순위 3 (최저)"| MANAGER
  PROJECT -->|"우선순위 2"| MANAGER
  LOCAL -->|"우선순위 1 (최고)"| MANAGER
  MANAGER -->|"loadAllConfigs()"| MERGED

  style MANAGER fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style USER fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style PROJECT fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style LOCAL fill:#dcfce7,stroke:#10b981,color:#065f46
  style MERGED fill:#f1f5f9,stroke:#64748b,color:#1e293b`}
          />

          <Callout type="info" icon="💡">
            <strong>비유:</strong> 3-Scope 시스템은 CSS의 캐스케이드와 비슷합니다.
            브라우저 기본 스타일(user) → 외부 스타일시트(project) → 인라인 스타일(local) 순으로
            우선순위가 높아지며, 같은 속성은 더 구체적인 스코프가 덮어씁니다.
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 2. 레퍼런스 (Reference) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>📖</span> 레퍼런스
          </h2>

          {/* MCPScopeConfigFile interface */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface MCPScopeConfigFile
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            각 스코프의 JSON 파일 형식입니다. <code className="text-cyan-600">servers</code> 필드 아래에
            서버별 설정이 위치합니다.
          </p>
          <ParamTable
            params={[
              { name: "servers", type: "Record<string, MCPScopeServerEntry>", required: false, desc: "서버 이름 → 서버 설정 맵" },
            ]}
          />

          {/* MCPScopeServerEntry interface */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface MCPScopeServerEntry
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            스코프 설정 파일 내 개별 서버 항목입니다.
          </p>
          <ParamTable
            params={[
              { name: "transport", type: "MCPTransport", required: false, desc: "트랜스포트 타입 (기본값: \"stdio\")" },
              { name: "command", type: "string", required: false, desc: "실행할 명령어 (stdio 트랜스포트용)" },
              { name: "args", type: "readonly string[]", required: false, desc: "명령어 인자 (stdio 트랜스포트용)" },
              { name: "url", type: "string", required: false, desc: "서버 URL (http/sse 트랜스포트용)" },
              { name: "env", type: "Record<string, string>", required: false, desc: "환경 변수" },
            ]}
          />

          {/* MCPScopeManager class */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            class MCPScopeManager
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            세 가지 스코프의 MCP 서버 설정을 관리하는 메인 클래스입니다.
          </p>

          {/* Constructor */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            constructor
          </h4>
          <CodeBlock>
            <span className="kw">constructor</span>(<span className="prop">workingDirectory</span>: <span className="type">string</span>)
          </CodeBlock>
          <ParamTable
            params={[
              { name: "workingDirectory", type: "string", required: true, desc: "프로젝트 루트 디렉토리 (local/project 스코프의 기준 경로)" },
            ]}
          />

          {/* loadAllConfigs */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            loadAllConfigs()
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            모든 스코프의 설정을 로드하고 우선순위에 따라 병합합니다.
            결과는 서버 이름을 키로 하는 Map입니다.
          </p>
          <CodeBlock>
            <span className="kw">async</span> <span className="fn">loadAllConfigs</span>(): <span className="type">Promise{"<"}Map{"<"}string, MCPServerConfig{">"}{">"}</span>
          </CodeBlock>

          {/* getConfigsForScope */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            getConfigsForScope(scope)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            특정 스코프의 설정만 로드합니다.
            파일이 없거나 <code className="text-cyan-600">servers</code> 필드가 없으면 빈 배열을 반환합니다.
          </p>
          <CodeBlock>
            <span className="kw">async</span> <span className="fn">getConfigsForScope</span>(<span className="prop">scope</span>: <span className="str">&quot;local&quot;</span> | <span className="str">&quot;project&quot;</span> | <span className="str">&quot;user&quot;</span>): <span className="type">Promise{"<"}readonly MCPServerConfig[]{">"}</span>
          </CodeBlock>
          <ParamTable
            params={[
              { name: "scope", type: '"local" | "project" | "user"', required: true, desc: "로드할 스코프" },
            ]}
          />

          {/* getConfigPath */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            getConfigPath(scope)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            스코프별 설정 파일 경로를 반환합니다.
          </p>
          <CodeBlock>
            <span className="fn">getConfigPath</span>(<span className="prop">scope</span>: <span className="str">&quot;local&quot;</span> | <span className="str">&quot;project&quot;</span> | <span className="str">&quot;user&quot;</span>): <span className="type">string</span>
            {"\n"}
            {"\n"}<span className="cm">{"// 경로 규칙:"}</span>
            {"\n"}<span className="cm">{"// local:   {workingDir}/.dbcode/mcp-local.json"}</span>
            {"\n"}<span className="cm">{"// project: {workingDir}/.dbcode/mcp.json"}</span>
            {"\n"}<span className="cm">{"// user:    ~/.dbcode/mcp-servers.json"}</span>
          </CodeBlock>

          {/* Caveats */}
          <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
          <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
            <li>
              설정 파일이 존재하지 않거나 JSON 파싱에 실패하면 <strong>에러를 던지지 않고</strong>
              해당 스코프를 빈 상태로 처리합니다. 치명적 에러가 아닙니다.
            </li>
            <li>
              같은 이름의 서버가 여러 스코프에 있으면 <strong>local이 항상 우선</strong>합니다.
              project와 user 스코프의 같은 이름 서버는 무시됩니다.
            </li>
            <li>
              <code className="text-cyan-600">transport</code>를 생략하면 기본값
              <code className="text-cyan-600">&quot;stdio&quot;</code>가 적용됩니다.
            </li>
            <li>
              <code className="text-cyan-600">args</code>와 <code className="text-cyan-600">env</code>는
              원본 객체의 변경을 방지하기 위해 복사본을 생성합니다 (불변성 유지).
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
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>기본 사용법 &mdash; 전체 설정 로드</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            가장 일반적인 사용 패턴입니다.
            프로젝트 루트로 초기화하고 모든 스코프의 설정을 한 번에 로드합니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 1. ScopeManager 생성"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">scopeManager</span> = <span className="kw">new</span> <span className="fn">MCPScopeManager</span>(<span className="str">&quot;/path/to/project&quot;</span>);
            {"\n"}
            {"\n"}<span className="cm">{"// 2. 전체 설정 로드 (3-scope 병합)"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">configs</span> = <span className="kw">await</span> <span className="prop">scopeManager</span>.<span className="fn">loadAllConfigs</span>();
            {"\n"}
            {"\n"}<span className="cm">{"// 3. 각 서버에 대해 MCPClient 생성"}</span>
            {"\n"}<span className="kw">for</span> (<span className="kw">const</span> [<span className="prop">name</span>, <span className="prop">config</span>] <span className="kw">of</span> <span className="prop">configs</span>) {"{"}
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">client</span> = <span className="kw">new</span> <span className="fn">MCPClient</span>(<span className="prop">config</span>);
            {"\n"}{"  "}<span className="kw">await</span> <span className="prop">client</span>.<span className="fn">connect</span>();
            {"\n"}{"}"}
          </CodeBlock>

          <Callout type="warn" icon="!">
            <strong>주의:</strong> <code>mcp-local.json</code>은 <code>.gitignore</code>에 추가해야 합니다.
            API 키나 개인 서버 경로가 포함될 수 있으므로, 절대 Git에 커밋하지 마세요.
          </Callout>

          {/* 설정 파일 예시 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            설정 파일 예시
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            각 스코프의 JSON 파일 형식입니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// .dbcode/mcp.json (project 스코프 — 팀 공유)"}</span>
            {"\n"}{"{"}
            {"\n"}{"  "}<span className="str">&quot;servers&quot;</span>: {"{"}
            {"\n"}{"    "}<span className="str">&quot;github&quot;</span>: {"{"}
            {"\n"}{"      "}<span className="str">&quot;transport&quot;</span>: <span className="str">&quot;stdio&quot;</span>,
            {"\n"}{"      "}<span className="str">&quot;command&quot;</span>: <span className="str">&quot;npx&quot;</span>,
            {"\n"}{"      "}<span className="str">&quot;args&quot;</span>: [<span className="str">&quot;@github/mcp-server&quot;</span>]
            {"\n"}{"    "}{"}"}
            {"\n"}{"  "}{"}"}
            {"\n"}{"}"}
            {"\n"}
            {"\n"}<span className="cm">{"// .dbcode/mcp-local.json (local 스코프 — 개인, gitignore)"}</span>
            {"\n"}{"{"}
            {"\n"}{"  "}<span className="str">&quot;servers&quot;</span>: {"{"}
            {"\n"}{"    "}<span className="str">&quot;my-db&quot;</span>: {"{"}
            {"\n"}{"      "}<span className="str">&quot;command&quot;</span>: <span className="str">&quot;node&quot;</span>,
            {"\n"}{"      "}<span className="str">&quot;args&quot;</span>: [<span className="str">&quot;my-db-server.js&quot;</span>],
            {"\n"}{"      "}<span className="str">&quot;env&quot;</span>: {"{"} <span className="str">&quot;DB_URL&quot;</span>: <span className="str">&quot;postgres://...&quot;</span> {"}"}
            {"\n"}{"    "}{"}"}
            {"\n"}{"  "}{"}"}
            {"\n"}{"}"}
          </CodeBlock>

          {/* 고급 사용법: 특정 스코프만 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; 특정 스코프만 로드
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            디버깅이나 설정 확인을 위해 특정 스코프의 설정만 로드할 수 있습니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// local 스코프 설정만 조회"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">localConfigs</span> = <span className="kw">await</span> <span className="prop">scopeManager</span>.<span className="fn">getConfigsForScope</span>(<span className="str">&quot;local&quot;</span>);
            {"\n"}
            {"\n"}<span className="cm">{"// 경로 확인"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">path</span> = <span className="prop">scopeManager</span>.<span className="fn">getConfigPath</span>(<span className="str">&quot;project&quot;</span>);
            {"\n"}<span className="cm">{"// → \"/path/to/project/.dbcode/mcp.json\""}</span>
          </CodeBlock>

          <Callout type="tip" icon="*">
            <strong>팁:</strong> <code>/mcp</code> 슬래시 명령어를 사용하면
            현재 활성화된 MCP 서버 목록과 각 서버의 스코프를 확인할 수 있습니다.
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 4. 내부 구현 (Internals) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>⚙️</span> 내부 구현
          </h2>

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>병합 순서 다이어그램</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">loadAllConfigs()</code>는 우선순위 배열을 역순으로 순회합니다.
            나중에 로딩된 설정이 같은 이름의 서버를 덮어쓰므로, local이 최종 우선됩니다.
          </p>

          <MermaidDiagram
            title="loadAllConfigs() 병합 순서"
            titleColor="purple"
            chart={`graph LR
  PRIORITY["SCOPE_PRIORITY<br/><small>[local, project, user]</small>"]
  REV["역순 순회<br/><small>[user, project, local]</small>"]
  U["1. user 로드<br/><small>Map에 추가</small>"]
  P["2. project 로드<br/><small>같은 이름 덮어씀</small>"]
  L["3. local 로드<br/><small>최종 우선</small>"]
  RESULT["병합된 Map<br/><small>local 설정 우선</small>"]

  PRIORITY --> REV
  REV --> U --> P --> L --> RESULT

  style L fill:#dcfce7,stroke:#10b981,color:#065f46,stroke-width:2px
  style PRIORITY fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style U fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style P fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style RESULT fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style REV fill:#f1f5f9,stroke:#64748b,color:#1e293b`}
          />

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>핵심 코드 분석 &mdash; readConfigFile()</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            설정 파일 읽기의 방어적 프로그래밍 패턴입니다.
            파일 부재와 JSON 파싱 실패 모두 치명적 에러가 아닌 것으로 취급합니다.
          </p>
          <CodeBlock>
            <span className="kw">private async</span> <span className="fn">readConfigFile</span>(<span className="prop">filePath</span>: <span className="type">string</span>): <span className="type">Promise{"<"}MCPScopeConfigFile | null{">"}</span> {"{"}
            {"\n"}{"  "}<span className="kw">let</span> <span className="prop">raw</span>: <span className="type">string</span>;
            {"\n"}{"  "}<span className="kw">try</span> {"{"}
            {"\n"}{"    "}<span className="prop">raw</span> = <span className="kw">await</span> <span className="fn">readFile</span>(<span className="prop">filePath</span>, <span className="str">&quot;utf-8&quot;</span>);
            {"\n"}{"  "}<span className="kw">{"}"} catch {"{"}</span>
            {"\n"}{"    "}<span className="cm">{"// 파일이 없음 — 에러가 아님"}</span>
            {"\n"}{"    "}<span className="kw">return null</span>;
            {"\n"}{"  "}{"}"}
            {"\n"}
            {"\n"}{"  "}<span className="kw">try</span> {"{"}
            {"\n"}{"    "}<span className="kw">const</span> <span className="prop">parsed</span> = <span className="fn">JSON.parse</span>(<span className="prop">raw</span>);
            {"\n"}{"    "}<span className="kw">if</span> (<span className="kw">typeof</span> <span className="prop">parsed</span> !== <span className="str">&quot;object&quot;</span> || <span className="prop">parsed</span> === <span className="kw">null</span>) <span className="kw">return null</span>;
            {"\n"}{"    "}<span className="kw">return</span> <span className="prop">parsed</span>;
            {"\n"}{"  "}<span className="kw">{"}"} catch {"{"}</span>
            {"\n"}{"    "}<span className="cm">{"// 잘못된 JSON — 치명적이지 않음"}</span>
            {"\n"}{"    "}<span className="kw">return null</span>;
            {"\n"}{"  "}{"}"}
            {"\n"}{"}"}
          </CodeBlock>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
            <p><strong className="text-gray-900">이중 try-catch:</strong> 파일 읽기와 JSON 파싱을 분리하여, 각 단계의 실패를 독립적으로 처리합니다.</p>
            <p><strong className="text-gray-900">null 반환:</strong> 에러를 던지지 않고 null을 반환하여, 상위 코드가 &quot;설정 없음&quot;으로 자연스럽게 처리합니다.</p>
            <p><strong className="text-gray-900">타입 검사:</strong> <code className="text-cyan-600">typeof parsed !== &quot;object&quot;</code>로 최상위가 객체인지 검증합니다.</p>
          </div>

          <DeepDive title="스코프 우선순위 상수와 역순 로딩">
            <p className="mb-3">
              우선순위 배열은 <code className="text-cyan-600">SCOPE_PRIORITY = [&quot;local&quot;, &quot;project&quot;, &quot;user&quot;]</code>로
              인덱스가 낮을수록 우선순위가 높습니다. <code className="text-cyan-600">loadAllConfigs()</code>에서는
              이 배열을 <strong>역순</strong>으로 순회합니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 역순 순회: user(최저) → project → local(최고)"}</span>
              {"\n"}<span className="kw">for</span> (<span className="kw">const</span> <span className="prop">scope</span> <span className="kw">of</span> [...<span className="prop">SCOPE_PRIORITY</span>].<span className="fn">reverse</span>()) {"{"}
              {"\n"}{"  "}<span className="kw">const</span> <span className="prop">configs</span> = <span className="kw">await</span> <span className="kw">this</span>.<span className="fn">getConfigsForScope</span>(<span className="prop">scope</span>);
              {"\n"}{"  "}<span className="kw">for</span> (<span className="kw">const</span> <span className="prop">config</span> <span className="kw">of</span> <span className="prop">configs</span>) {"{"}
              {"\n"}{"    "}<span className="prop">merged</span>.<span className="fn">set</span>(<span className="prop">config</span>.<span className="prop">name</span>, <span className="prop">config</span>);
              {"\n"}{"  "}{"}"}
              {"\n"}{"}"}
            </CodeBlock>
            <p className="mt-3 text-amber-600">
              Map의 <code>set()</code>은 같은 키가 있으면 덮어쓰므로,
              나중에 설정된 local 스코프가 자연스럽게 최종 우선순위를 가집니다.
            </p>
          </DeepDive>
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
              &quot;설정 파일을 만들었는데 서버가 인식되지 않아요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              JSON 형식이 올바른지 확인하세요. 잘못된 JSON은 에러 없이 무시됩니다.
            </p>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>파일 경로가 정확한지 확인: <code className="text-cyan-600">.dbcode/mcp.json</code> (project) 또는 <code className="text-cyan-600">.dbcode/mcp-local.json</code> (local)</li>
              <li>JSON 최상위가 객체({"{}"})인지 확인 (배열이면 무시됩니다)</li>
              <li><code className="text-cyan-600">servers</code> 키가 정확한지 확인</li>
            </ul>
          </div>

          {/* FAQ 2 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;local 설정이 project 설정을 덮어쓰지 않아요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              서버 이름이 정확히 같은지 확인하세요. 대소문자가 다르면 별개의 서버로 인식됩니다.
              예: <code className="text-cyan-600">&quot;GitHub&quot;</code>와 <code className="text-cyan-600">&quot;github&quot;</code>는
              서로 다른 서버입니다.
            </p>
          </div>

          {/* FAQ 3 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;user 글로벌 설정 파일 위치가 어디인가요?&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">~/.dbcode/mcp-servers.json</code>입니다.
              <code className="text-cyan-600">getConfigPath(&quot;user&quot;)</code>로 정확한 경로를 확인할 수 있습니다.
              이 파일은 모든 프로젝트에 공통으로 적용됩니다.
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
                name: "client.ts",
                slug: "mcp-client",
                relation: "sibling",
                desc: "ScopeManager가 로드한 설정으로 생성되는 JSON-RPC MCP 클라이언트",
              },
              {
                name: "mcp-manager.ts",
                slug: "mcp-manager",
                relation: "parent",
                desc: "ScopeManager를 사용하여 MCP 서버 수명주기를 관리하는 상위 매니저",
              },
              {
                name: "config-loader.ts",
                slug: "config-loader",
                relation: "sibling",
                desc: "dbcode 전체 설정의 5-layer 병합 시스템 — MCP 스코프와 유사한 계층 구조",
              },
            ]}
          />
        </section>
      </RevealOnScroll>
    </div></div>
  );
}

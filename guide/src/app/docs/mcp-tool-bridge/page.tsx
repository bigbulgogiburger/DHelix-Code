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

export default function MCPToolBridgePage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}><div className="center-narrow">
      {/* ─── Header ─── */}
      <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <FilePath path="src/mcp/tool-bridge.ts" />
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
            <span className="text-gray-900">
              MCPToolBridge
            </span>
          </h1>
          <div className="flex items-center gap-3 mb-5">
            <LayerBadge layer="infra" />
          </div>
          <p className="text-[16px] text-gray-600 leading-relaxed">
            MCP 서버의 도구를 dbcode 도구 레지스트리에 변환하여 연결하는 브리지 모듈입니다.
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
              <code className="text-cyan-600">MCPToolBridge</code>는 MCP 서버의 도구 정의(MCPToolDefinition)를
              dbcode의 도구 시스템(ToolDefinition)으로 변환하는 &quot;다리&quot; 역할을 합니다.
              이 변환 덕분에 에이전트는 MCP 도구와 내장 도구를 구분 없이 동일한 인터페이스로 사용할 수 있습니다.
            </p>
            <p>
              변환 과정에서 세 가지 핵심 작업이 이루어집니다:
              (1) 이름 네임스페이싱 (<code className="text-cyan-600">mcp__서버명__도구명</code> 형태),
              (2) JSON Schema를 Zod 스키마로 변환 (런타임 타입 검증),
              (3) 실행 프록시 생성 (호출 시 MCP 클라이언트를 통해 원격 실행).
            </p>
            <p>
              대용량 출력에 대한 3-Tier 제한 시스템을 포함하며,
              에러 발생 시 유형별 recovery 힌트를 LLM에 제공하여
              적절한 대응을 유도합니다.
            </p>
          </div>

          <MermaidDiagram
            title="MCPToolBridge 변환 파이프라인"
            titleColor="purple"
            chart={`graph LR
  MCP_DEF["MCPToolDefinition<br/><small>이름 + 설명 + JSON Schema</small>"]
  BRIDGE["MCPToolBridge<br/><small>tool-bridge.ts</small>"]
  DB_DEF["ToolDefinition<br/><small>네임스페이스 이름 + Zod + 프록시</small>"]
  REGISTRY["Tool Registry<br/><small>도구 레지스트리</small>"]
  AGENT["Agent Loop<br/><small>도구 사용</small>"]

  MCP_DEF -->|"bridgeMCPTool()"| BRIDGE
  BRIDGE -->|"registerTools()"| DB_DEF
  DB_DEF -->|"register()"| REGISTRY
  REGISTRY -->|"도구 호출"| AGENT

  style BRIDGE fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style MCP_DEF fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style DB_DEF fill:#dcfce7,stroke:#10b981,color:#065f46
  style REGISTRY fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style AGENT fill:#e0e7ff,stroke:#3b82f6,color:#1e293b`}
          />

          <Callout type="info" icon="💡">
            <strong>비유:</strong> MCPToolBridge는 해외 전자기기를 쓸 때 필요한 &quot;전원 어댑터&quot;와 같습니다.
            MCP 서버의 도구(해외 플러그)를 dbcode의 도구 시스템(국내 콘센트)에 맞게 변환하여
            자연스럽게 사용할 수 있게 합니다.
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 2. 레퍼런스 (Reference) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>📖</span> 레퍼런스
          </h2>

          {/* MCPBridgeError class */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            class MCPBridgeError
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            브리지 동작 중 발생하는 에러 클래스입니다.
            에러 코드 <code className="text-cyan-600">&quot;MCP_BRIDGE_ERROR&quot;</code>로 식별됩니다.
          </p>

          {/* 상수 */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            상수 (Constants)
          </h3>
          <ParamTable
            params={[
              { name: "MAX_MCP_OUTPUT_TOKENS", type: "number", required: true, desc: "최대 출력 토큰 수 (기본 25,000). 환경변수 MAX_MCP_OUTPUT_TOKENS로 변경 가능" },
              { name: "MCP_TOOL_TIMEOUT_MS", type: "number", required: true, desc: "도구 실행 타임아웃 (기본 120초). 환경변수 MCP_TOOL_TIMEOUT으로 변경 가능" },
              { name: "LARGE_OUTPUT_THRESHOLD", type: "number", required: true, desc: "대용량 출력 파일 저장 임계값 (400,000자)" },
              { name: "PREVIEW_SIZE", type: "number", required: true, desc: "대용량 출력 시 LLM에 전달할 미리보기 크기 (2,000자)" },
            ]}
          />

          {/* MCPToolBridge class */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            class MCPToolBridge
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            MCP 도구를 발견하고 dbcode 도구 레지스트리에 등록하는 메인 클래스입니다.
          </p>

          {/* Constructor */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            constructor
          </h4>
          <CodeBlock>
            <span className="kw">constructor</span>(<span className="prop">toolRegistry</span>: <span className="type">ToolRegistry</span>)
          </CodeBlock>
          <ParamTable
            params={[
              { name: "toolRegistry", type: "ToolRegistry", required: true, desc: "도구를 등록할 dbcode 도구 레지스트리" },
            ]}
          />

          {/* registerTools */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            registerTools(client, serverName)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            MCP 클라이언트에서 도구를 발견하고 레지스트리에 등록합니다.
            도구 목록 변경 알림 핸들러도 자동으로 등록됩니다.
          </p>
          <CodeBlock>
            <span className="kw">async</span> <span className="fn">registerTools</span>(<span className="prop">client</span>: <span className="type">MCPClient</span>, <span className="prop">serverName</span>: <span className="type">string</span>): <span className="type">Promise{"<"}readonly string[]{">"}</span>
          </CodeBlock>
          <ParamTable
            params={[
              { name: "client", type: "MCPClient", required: true, desc: "도구를 가져올 MCP 클라이언트" },
              { name: "serverName", type: "string", required: true, desc: "MCP 서버 이름 (네임스페이싱에 사용)" },
            ]}
          />

          {/* getServerTools */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            getServerTools(serverName)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            특정 서버에서 등록된 모든 도구 이름을 반환합니다.
          </p>
          <CodeBlock>
            <span className="fn">getServerTools</span>(<span className="prop">serverName</span>: <span className="type">string</span>): <span className="type">readonly string[]</span>
          </CodeBlock>

          {/* getRegisteredServers */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            getRegisteredServers()
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            도구가 등록된 모든 서버 이름을 반환합니다.
          </p>
          <CodeBlock>
            <span className="fn">getRegisteredServers</span>(): <span className="type">readonly string[]</span>
          </CodeBlock>

          {/* shouldDeferTools */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            shouldDeferTools(mcpToolTokens, maxContextTokens)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            MCP 도구의 총 토큰 수가 지연 로딩 임계값(컨텍스트의 10%)을 초과하는지 확인합니다.
          </p>
          <CodeBlock>
            <span className="fn">shouldDeferTools</span>(<span className="prop">mcpToolTokens</span>: <span className="type">number</span>, <span className="prop">maxContextTokens</span>: <span className="type">number</span>): <span className="type">boolean</span>
          </CodeBlock>
          <ParamTable
            params={[
              { name: "mcpToolTokens", type: "number", required: true, desc: "MCP 도구의 총 토큰 수" },
              { name: "maxContextTokens", type: "number", required: true, desc: "LLM의 최대 컨텍스트 토큰 수" },
            ]}
          />

          {/* Caveats */}
          <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
          <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
            <li>
              네임스페이싱 규칙: <code className="text-cyan-600">mcp__서버명__도구명</code> &mdash;
              이중 밑줄(<code>__</code>)로 구분됩니다. 서버명이나 도구명에 이중 밑줄이 포함되면 충돌할 수 있습니다.
            </li>
            <li>
              이미 등록된 도구는 건너뜁니다 (재연결 시 중복 방지).
              현재 레지스트리는 도구 <strong>제거</strong>를 지원하지 않으므로 새 도구만 추가됩니다.
            </li>
            <li>
              모든 MCP 도구의 권한 레벨은 <code className="text-cyan-600">&quot;confirm&quot;</code>으로 설정됩니다.
              사용자에게 실행 확인을 요청합니다.
            </li>
            <li>
              <code className="text-cyan-600">jsonSchemaToZod()</code>는 기본 타입(object, string, number, boolean, array)만
              지원합니다. 복잡한 JSON Schema(<code>oneOf</code>, <code>allOf</code> 등)는
              <code className="text-cyan-600">z.record(z.unknown())</code>로 폴백됩니다.
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
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>기본 사용법 &mdash; MCP 도구 등록</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            MCPClient로 서버에 연결한 뒤, ToolBridge로 도구를 레지스트리에 등록합니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 1. 브리지 생성"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">bridge</span> = <span className="kw">new</span> <span className="fn">MCPToolBridge</span>(<span className="prop">toolRegistry</span>);
            {"\n"}
            {"\n"}<span className="cm">{"// 2. MCP 도구를 dbcode 도구로 등록"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">names</span> = <span className="kw">await</span> <span className="prop">bridge</span>.<span className="fn">registerTools</span>(<span className="prop">client</span>, <span className="str">&quot;github&quot;</span>);
            {"\n"}<span className="cm">{"// → [\"mcp__github__create_issue\", \"mcp__github__search\", ...]"}</span>
            {"\n"}
            {"\n"}<span className="cm">{"// 3. 등록된 도구 확인"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">tools</span> = <span className="prop">bridge</span>.<span className="fn">getServerTools</span>(<span className="str">&quot;github&quot;</span>);
            {"\n"}<span className="kw">const</span> <span className="prop">servers</span> = <span className="prop">bridge</span>.<span className="fn">getRegisteredServers</span>();
          </CodeBlock>

          <Callout type="warn" icon="!">
            <strong>주의:</strong> <code>registerTools()</code>는 <code>client.listTools()</code>를 호출하므로,
            MCPClient가 <code>&quot;connected&quot;</code> 상태여야 합니다.
            연결되지 않은 클라이언트를 전달하면 에러가 발생합니다.
          </Callout>

          {/* 3-Tier 출력 제한 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; 3-Tier 출력 제한 시스템
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            MCP 도구의 출력이 너무 클 때 LLM 컨텍스트를 보호하는 3단계 제한 시스템입니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// Tier 1: 정상 범위 → 그대로 전달"}</span>
            {"\n"}<span className="cm">{"// output.length <= MAX_MCP_OUTPUT_TOKENS * 4"}</span>
            {"\n"}
            {"\n"}<span className="cm">{"// Tier 2: 토큰 한도 초과 → in-memory truncation"}</span>
            {"\n"}<span className="cm">{"// output.length > 25000 * 4 = 100,000자"}</span>
            {"\n"}<span className="cm">{"// → 잘라내고 \"[OUTPUT TRUNCATED]\" 표시"}</span>
            {"\n"}
            {"\n"}<span className="cm">{"// Tier 3: 400,000자 초과 → 파일 저장 + preview"}</span>
            {"\n"}<span className="cm">{"// → /tmp/dbcode-mcp-outputs/ 에 저장"}</span>
            {"\n"}<span className="cm">{"// → 처음 2,000자만 LLM에 전달"}</span>
          </CodeBlock>

          {/* 환경변수 설정 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; 환경변수로 제한값 조절
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            기본값을 환경변수로 커스터마이징할 수 있습니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 최대 출력 토큰 수 변경 (기본: 25,000)"}</span>
            {"\n"}<span className="prop">MAX_MCP_OUTPUT_TOKENS</span>=<span className="num">50000</span>
            {"\n"}
            {"\n"}<span className="cm">{"// 도구 실행 타임아웃 변경 (기본: 120,000ms = 2분)"}</span>
            {"\n"}<span className="prop">MCP_TOOL_TIMEOUT</span>=<span className="num">300000</span>
          </CodeBlock>

          <Callout type="tip" icon="*">
            <strong>팁:</strong> <code>shouldDeferTools()</code>로 MCP 도구가 컨텍스트의 10%를 초과하는지
            미리 확인할 수 있습니다. 초과하면 지연 로딩(deferred)으로 전환하여 토큰을 절약하세요.
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 4. 내부 구현 (Internals) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>⚙️</span> 내부 구현
          </h2>

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>도구 변환 파이프라인</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">bridgeMCPTool()</code>이 수행하는 변환 과정입니다.
            하나의 MCP 도구를 dbcode ToolDefinition으로 변환합니다.
          </p>

          <MermaidDiagram
            title="bridgeMCPTool() 변환 과정"
            titleColor="purple"
            chart={`graph TD
  INPUT["MCPToolDefinition<br/><small>name + description + inputSchema</small>"]
  NS["1. 네임스페이싱<br/><small>mcp__서버명__도구명</small>"]
  ZOD["2. JSON Schema → Zod<br/><small>jsonSchemaToZod()</small>"]
  PROXY["3. 실행 프록시 생성<br/><small>client.callTool() 위임</small>"]
  OUTPUT["ToolDefinition<br/><small>name + schema + execute</small>"]

  INPUT --> NS --> ZOD --> PROXY --> OUTPUT

  EXEC["실행 시"]
  T1["Tier 1: 정상 전달"]
  T2["Tier 2: Truncation"]
  T3["Tier 3: 파일 저장"]

  OUTPUT -.->|"execute()"| EXEC
  EXEC -->|"< 100K자"| T1
  EXEC -->|"100K~400K자"| T2
  EXEC -->|"> 400K자"| T3

  style INPUT fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style OUTPUT fill:#dcfce7,stroke:#10b981,color:#065f46,stroke-width:2px
  style NS fill:#ede9fe,stroke:#8b5cf6,color:#1e293b
  style ZOD fill:#ede9fe,stroke:#8b5cf6,color:#1e293b
  style PROXY fill:#ede9fe,stroke:#8b5cf6,color:#1e293b
  style T1 fill:#dcfce7,stroke:#10b981,color:#065f46
  style T2 fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style T3 fill:#fee2e2,stroke:#ef4444,color:#991b1b`}
          />

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>핵심 코드 분석 &mdash; 에러 분류와 Recovery 힌트</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            MCP 도구 실행 실패 시, 에러 메시지를 분류하여 LLM에게 적절한 대응 방법을 안내합니다.
          </p>
          <CodeBlock>
            <span className="kw">type</span> <span className="type">MCPErrorType</span> = <span className="str">&quot;timeout&quot;</span> | <span className="str">&quot;connection&quot;</span> | <span className="str">&quot;permission&quot;</span> | <span className="str">&quot;server_error&quot;</span> | <span className="str">&quot;unknown&quot;</span>;
            {"\n"}
            {"\n"}<span className="kw">function</span> <span className="fn">classifyMCPError</span>(<span className="prop">errorMsg</span>: <span className="type">string</span>): <span className="type">MCPErrorType</span> {"{"}
            {"\n"}{"  "}<span className="cm">{"// \"timed out\" | \"timeout\" → timeout"}</span>
            {"\n"}{"  "}<span className="cm">{"// \"ECONNREFUSED\" | \"disconnected\" → connection"}</span>
            {"\n"}{"  "}<span className="cm">{"// \"permission\" | \"denied\" → permission"}</span>
            {"\n"}{"  "}<span className="cm">{"// \"500\" | \"internal\" | \"-32\" → server_error"}</span>
            {"\n"}{"  "}<span className="cm">{"// 그 외 → unknown"}</span>
            {"\n"}{"}"}
          </CodeBlock>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
            <p><strong className="text-gray-900">timeout:</strong> &quot;재시도하지 말고 사용자에게 알리세요&quot;</p>
            <p><strong className="text-gray-900">connection:</strong> &quot;서버가 실행 중인지 /mcp로 확인하세요&quot;</p>
            <p><strong className="text-gray-900">permission:</strong> &quot;재시도하지 말고 대안을 제시하세요&quot;</p>
            <p><strong className="text-gray-900">server_error:</strong> &quot;일시적 문제일 수 있으니 사용자에게 재시도 의사를 확인하세요&quot;</p>
          </div>

          <DeepDive title="jsonSchemaToZod() 변환 규칙 상세">
            <p className="mb-3">
              MCP의 JSON Schema를 Zod 스키마로 재귀적으로 변환합니다.
              지원하는 타입과 Zod 매핑:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-gray-600">
              <li><code className="text-cyan-600">&quot;object&quot;</code> &rarr; <code>z.object(shape).passthrough()</code> &mdash; 속성별 재귀 변환, 추가 필드 허용</li>
              <li><code className="text-cyan-600">&quot;string&quot;</code> &rarr; <code>z.string()</code></li>
              <li><code className="text-cyan-600">&quot;number&quot; / &quot;integer&quot;</code> &rarr; <code>z.number()</code></li>
              <li><code className="text-cyan-600">&quot;boolean&quot;</code> &rarr; <code>z.boolean()</code></li>
              <li><code className="text-cyan-600">&quot;array&quot;</code> &rarr; <code>z.array(itemSchema)</code></li>
              <li><strong>알 수 없는 타입</strong> &rarr; <code>z.record(z.unknown())</code> (자유 형태 폴백)</li>
            </ul>
            <p className="mt-3 text-amber-600">
              <code>required</code> 배열에 없는 속성은 자동으로 <code>.optional()</code>이 적용됩니다.
              <code>passthrough()</code>로 스키마에 정의되지 않은 추가 필드도 허용됩니다.
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
              &quot;MCP 도구 실행 결과가 잘려서 나와요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              3-Tier 출력 제한이 적용된 것입니다.
            </p>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li><code className="text-cyan-600">[OUTPUT TRUNCATED]</code> 표시: Tier 2 &mdash; <code>MAX_MCP_OUTPUT_TOKENS</code> 환경변수를 늘려보세요.</li>
              <li><code className="text-cyan-600">&lt;persisted-output&gt;</code> 표시: Tier 3 &mdash; 전체 출력이 임시 파일로 저장되었습니다. 경로를 확인하세요.</li>
            </ul>
          </div>

          {/* FAQ 2 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;MCP 도구가 계속 타임아웃 에러를 내요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              기본 타임아웃은 120초(2분)입니다. 오래 걸리는 도구라면
              <code className="text-cyan-600">MCP_TOOL_TIMEOUT</code> 환경변수를 높여보세요.
              예: <code className="text-cyan-600">MCP_TOOL_TIMEOUT=300000</code> (5분)
            </p>
          </div>

          {/* FAQ 3 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;에이전트가 MCP 도구를 찾지 못해요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              도구 이름이 네임스페이싱되어 있는지 확인하세요.
              MCP 도구는 <code className="text-cyan-600">mcp__서버명__도구명</code> 형태로 등록됩니다.
              <code className="text-cyan-600">getServerTools()</code>로 등록된 도구 목록을 확인하세요.
            </p>
          </div>

          {/* FAQ 4 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;JSON Schema 변환이 제대로 안 되는 것 같아요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">jsonSchemaToZod()</code>는 기본 타입만 지원합니다.
              <code>oneOf</code>, <code>allOf</code>, <code>$ref</code> 등 고급 JSON Schema 기능은
              <code className="text-cyan-600">z.record(z.unknown())</code>로 폴백됩니다.
              이 경우 타입 검증이 느슨해지지만, 도구 실행 자체는 정상적으로 동작합니다.
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
                desc: "ToolBridge가 도구 호출을 프록시하는 JSON-RPC MCP 클라이언트",
              },
              {
                name: "tool-registry.ts",
                slug: "tool-registry",
                relation: "sibling",
                desc: "브리지된 도구가 등록되는 dbcode 도구 레지스트리",
              },
              {
                name: "tool-search.ts",
                slug: "mcp-tool-search",
                relation: "sibling",
                desc: "대규모 MCP 도구 세트를 위한 지연 로딩(deferred) 검색 모듈",
              },
              {
                name: "tool-filter.ts",
                slug: "mcp-tool-filter",
                relation: "sibling",
                desc: "브리지 전에 도구를 허용/차단 목록으로 필터링하는 모듈",
              },
            ]}
          />
        </section>
      </RevealOnScroll>
    </div></div>
  );
}

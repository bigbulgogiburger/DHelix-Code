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

/* ─────────────────────── syntax highlighting helpers ─────────────────────── */
const kw = (t: string) => <span className="text-[#ff7b72]">{t}</span>;
const fn = (t: string) => <span className="text-[#d2a8ff]">{t}</span>;
const str = (t: string) => <span className="text-[#a5d6ff]">{t}</span>;
const cm = (t: string) => <span className="text-[#8b949e]">{t}</span>;
const tp = (t: string) => <span className="text-[#79c0ff]">{t}</span>;
const vr = (t: string) => <span className="text-[#ffa657]">{t}</span>;
const pc = (t: string) => <span className="text-[#c9d1d9]">{t}</span>;

export default function ToolRegistryPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">

        {/* ═══════════════════════ 1. Header ═══════════════════════ */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <div className="flex items-center gap-3 mb-4">
              <FilePath path="src/tools/registry.ts" />
              <LayerBadge layer="infra" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mb-4 text-gray-900">
                Tool Registry
            </h1>
            <p className="text-[16px] text-gray-600 max-w-[700px]">
              모든 도구의 등록, 조회, LLM 형식 변환을 관리하는 중앙 저장소입니다.
              Map 기반 레지스트리 패턴으로 O(1) 조회를 제공하며, Hot Tool과 Deferred Loading으로 토큰을 최적화합니다.
            </p>
          </div>
        </RevealOnScroll>

        {/* ═══════════════════════ 2. 개요 ═══════════════════════ */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2 className="text-2xl font-extrabold flex items-center gap-2" style={{ marginBottom: "24px", marginTop: "0" }}>
              🏗️ 개요
            </h2>

            <div className="text-[14px] text-gray-600 leading-relaxed space-y-4 mb-8">
              <p>
                <strong className="text-gray-900">ToolRegistry</strong>는 dbcode의 모든 도구(내장 16개 + MCP 외부 도구)를
                하나의 <code className="text-cyan-600 text-[13px]">Map&lt;string, ToolDefinition&gt;</code>에 저장하고 관리하는 싱글턴 클래스입니다.
                Agent Loop가 LLM에게 &ldquo;사용 가능한 도구 목록&rdquo;을 전달할 때, 이 레지스트리가 Zod 스키마를 JSON Schema로 변환하여
                OpenAI 호환 형식을 생성합니다.
              </p>
              <p>
                도구를 크게 두 가지 카테고리로 나눕니다:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                <div className="bg-white border border-gray-200 rounded-xl p-4 border-l-[3px] border-l-accent-green">
                  <div className="text-sm font-bold text-emerald-600 mb-1">🔥 Hot Tools</div>
                  <p className="text-[13px] text-gray-600">
                    매 LLM 요청마다 전체 스키마가 항상 포함되는 핵심 도구 6개.
                    file_read, file_write, file_edit, bash_exec, glob_search, grep_search.
                    코딩 작업에서 가장 빈번히 사용되므로 호출 정확도를 높입니다.
                  </p>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4 border-l-[3px] border-l-accent-purple">
                  <div className="text-sm font-bold text-violet-600 mb-1">💤 Deferred Tools</div>
                  <p className="text-[13px] text-gray-600">
                    MCP 외부 도구들은 이름과 설명만 시스템 프롬프트에 포함하고,
                    LLM이 실제로 호출하려 할 때만 전체 스키마를 로드합니다.
                    수십~수백 개의 MCP 도구가 있어도 토큰을 절약합니다.
                  </p>
                </div>
              </div>
            </div>

            <MermaidDiagram
              title="Tool System Architecture"
              titleColor="green"
              chart={`graph TD
    subgraph Registry["🗄️ ToolRegistry"]
        MAP["Map&lt;string, ToolDefinition&gt;<br/><small>도구 정의 중앙 저장소</small>"]
        HOT["Hot Tools Set (6개)<br/><small>항상 포함되는 핵심 도구</small>"]
        SEARCH["MCPToolSearch?<br/><small>MCP 도구 검색 어댑터</small>"]
    end

    subgraph Input["도구 등록"]
        BUILTIN["Built-in Tools (16개)<br/><small>내장 도구 모음</small>"]
        MCP["MCP Tools (외부)<br/><small>외부 MCP 서버 도구</small>"]
    end

    subgraph Output["도구 제공"]
        LLMFULL["getDefinitionsForLLM()\\n전체 도구 스키마<br/><small>모든 도구 JSON Schema</small>"]
        LLMHOT["getHotDefinitionsForLLM()\\nHot + Built-in만<br/><small>핵심 도구만 반환</small>"]
        DEFER["getDeferredToolsSummary()\\n이름+설명만<br/><small>토큰 절약용 요약</small>"]
        RESOLVE["resolveDeferredTool()\\n필요 시 스키마 로드<br/><small>지연 로딩 스키마 해석</small>"]
    end

    BUILTIN -->|register/registerAll| MAP
    MCP -->|register| MAP
    MCP -->|setToolSearch| SEARCH

    MAP --> LLMFULL
    MAP --> LLMHOT
    HOT -->|필터| LLMHOT
    SEARCH --> DEFER
    SEARCH --> RESOLVE

    style Registry fill:#dcfce7,stroke:#10b981,stroke-width:2px
    style HOT fill:#fee2e2,stroke:#ef4444,stroke-width:1px
    style SEARCH fill:#ede9fe,stroke:#8b5cf6,stroke-width:1px`}
            />

            <Callout type="info" icon="💡">
              <strong>왜 Hot / Deferred를 나누나요?</strong><br />
              LLM의 컨텍스트 윈도우에는 토큰 제한이 있습니다.
              MCP 도구가 50개라면 각 도구의 전체 JSON Schema를 매번 보내면 수천 토큰을 소비합니다.
              핵심 도구만 전체 스키마로 보내고, 나머지는 이름만 알려주면 토큰을 크게 절약할 수 있습니다.
            </Callout>
          </section>
        </RevealOnScroll>

        {/* ═══════════════════════ 3. 레퍼런스 ═══════════════════════ */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2 className="text-2xl font-extrabold flex items-center gap-2" style={{ marginBottom: "24px", marginTop: "0" }}>
              📖 레퍼런스
            </h2>

            {/* ── ToolDefinition interface ── */}
            <h3 className="text-lg font-bold flex items-center gap-2" style={{ marginTop: "32px", marginBottom: "16px" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan" />
              ToolDefinition&lt;TParams&gt; 인터페이스
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              모든 도구가 구현해야 하는 핵심 인터페이스입니다. 제네릭 <code className="text-violet-600">TParams</code>는
              Zod 스키마에서 추론된 매개변수 타입입니다.
            </p>
            <ParamTable params={[
              { name: "name", type: "string", required: true, desc: "도구 이름 — 레지스트리의 고유 키 (예: \"file_read\")" },
              { name: "description", type: "string", required: true, desc: "LLM이 도구 용도를 이해하는 자연어 설명" },
              { name: "parameterSchema", type: "z.ZodType<TParams>", required: true, desc: "Zod로 정의된 매개변수 검증 스키마" },
              { name: "permissionLevel", type: "PermissionLevel", required: true, desc: "\"safe\" | \"confirm\" | \"dangerous\" — 실행 전 승인 수준" },
              { name: "timeoutMs", type: "number", required: false, desc: "개별 타임아웃(ms). 미지정 시 전역 기본값 사용" },
              { name: "execute", type: "(params, context) => Promise<ToolResult>", required: true, desc: "검증된 매개변수와 컨텍스트를 받아 도구를 실행하는 비동기 함수" },
            ]} />

            <div className="my-6" />

            {/* ── ToolDefinitionForLLM interface ── */}
            <h3 className="text-lg font-bold flex items-center gap-2" style={{ marginTop: "32px", marginBottom: "16px" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-accent-purple" />
              ToolDefinitionForLLM 인터페이스
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              OpenAI 호환 Function Calling 형식. Zod 스키마를 JSON Schema로 변환한 결과물입니다.
            </p>
            <CodeBlock>
{kw("interface")} {tp("ToolDefinitionForLLM")} {pc("{")}{"\n"}
{"  "}{vr("type")}: {str("\"function\"")};{"\n"}
{"  "}{vr("function")}: {pc("{")}{"\n"}
{"    "}{vr("name")}:        {tp("string")};        {cm("// 도구 이름")}{"\n"}
{"    "}{vr("description")}: {tp("string")};        {cm("// 도구 설명")}{"\n"}
{"    "}{vr("parameters")}:  {tp("Record<string, unknown>")};  {cm("// JSON Schema")}{"\n"}
{"  "}{pc("}")};{"\n"}
{pc("}")}
            </CodeBlock>

            <div className="my-8" />

            {/* ── ToolRegistry class methods ── */}
            <h3 className="text-lg font-bold flex items-center gap-2" style={{ marginTop: "32px", marginBottom: "16px" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-accent-green" />
              ToolRegistry 클래스 메서드
            </h3>

            {/* register */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-3">
              <div className="flex items-center gap-2 mb-2">
                <code className="text-[13px] font-bold text-cyan-600">register(tool)</code>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">write</span>
              </div>
              <p className="text-[13px] text-gray-600">
                도구를 레지스트리에 등록합니다. 이미 같은 이름으로 등록된 도구가 있으면 <code className="text-red-600">ToolError</code>를 던져 중복 등록을 방지합니다.
              </p>
            </div>

            {/* registerAll */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-3">
              <div className="flex items-center gap-2 mb-2">
                <code className="text-[13px] font-bold text-cyan-600">registerAll(tools)</code>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">write</span>
              </div>
              <p className="text-[13px] text-gray-600">
                여러 도구를 한 번에 등록합니다. 초기화 시 16개 내장 도구를 일괄 등록할 때 사용합니다.
                내부적으로 <code className="text-cyan-600">register()</code>를 반복 호출합니다.
              </p>
            </div>

            {/* get */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-3">
              <div className="flex items-center gap-2 mb-2">
                <code className="text-[13px] font-bold text-cyan-600">get(name)</code>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-600">read</span>
              </div>
              <p className="text-[13px] text-gray-600">
                이름으로 도구를 조회합니다. 없으면 <code className="text-violet-600">undefined</code>를 반환합니다.
                도구가 존재하지 않을 수 있는 상황(예: MCP 도구 유무 확인)에 사용합니다.
              </p>
            </div>

            {/* require */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-3">
              <div className="flex items-center gap-2 mb-2">
                <code className="text-[13px] font-bold text-cyan-600">require(name)</code>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-600">read</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-50 text-red-600">throws</span>
              </div>
              <p className="text-[13px] text-gray-600">
                이름으로 도구를 조회하되, 없으면 <code className="text-red-600">ToolError</code>를 던집니다.
                반드시 존재해야 하는 내장 도구를 조회할 때 사용합니다. <code className="text-cyan-600">get()</code>의 안전 버전입니다.
              </p>
            </div>

            {/* has */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-3">
              <div className="flex items-center gap-2 mb-2">
                <code className="text-[13px] font-bold text-cyan-600">has(name)</code>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-600">read</span>
              </div>
              <p className="text-[13px] text-gray-600">
                특정 이름의 도구가 등록되어 있는지 <code className="text-violet-600">boolean</code>으로 반환합니다.
                중복 확인이나 조건부 로직에 사용합니다.
              </p>
            </div>

            {/* getAll / getNames */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-3">
              <div className="flex items-center gap-2 mb-2">
                <code className="text-[13px] font-bold text-cyan-600">getAll()</code>
                <span className="mx-1 text-gray-400">/</span>
                <code className="text-[13px] font-bold text-cyan-600">getNames()</code>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-600">read</span>
              </div>
              <p className="text-[13px] text-gray-600">
                등록된 모든 도구 정의 배열 또는 이름 배열을 <code className="text-violet-600">readonly</code>로 반환합니다.
                Map을 스프레드하여 새 배열을 생성하므로 원본은 수정되지 않습니다.
              </p>
            </div>

            {/* getDefinitionsForLLM */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-3">
              <div className="flex items-center gap-2 mb-2">
                <code className="text-[13px] font-bold text-cyan-600">getDefinitionsForLLM()</code>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-violet-50 text-violet-600">transform</span>
              </div>
              <p className="text-[13px] text-gray-600">
                <strong>모든</strong> 도구를 OpenAI Function Calling 형식으로 변환합니다.
                Zod 스키마 → JSON Schema 변환은 <code className="text-cyan-600">zodSchemaToJsonSchema()</code>에 위임합니다.
                Deferred 모드를 사용하지 않을 때 호출됩니다.
              </p>
            </div>

            {/* getHotDefinitionsForLLM */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-3">
              <div className="flex items-center gap-2 mb-2">
                <code className="text-[13px] font-bold text-cyan-600">getHotDefinitionsForLLM()</code>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-violet-50 text-violet-600">transform</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-600">핵심</span>
              </div>
              <p className="text-[13px] text-gray-600">
                Hot Tools + 내장 도구(non-MCP)만 LLM 형식으로 반환합니다.
                <code className="text-cyan-600">mcp__</code> 접두사 도구를 필터링하여 MCP 도구의 전체 스키마 전달을 방지합니다.
                Deferred 모드가 활성화된 상태에서 Agent Loop가 호출하는 메서드입니다.
              </p>
            </div>

            {/* setToolSearch / isDeferredMode */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-3">
              <div className="flex items-center gap-2 mb-2">
                <code className="text-[13px] font-bold text-cyan-600">setToolSearch(search)</code>
                <span className="mx-1 text-gray-400">/</span>
                <code className="text-[13px] font-bold text-cyan-600">isDeferredMode</code>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">config</span>
              </div>
              <p className="text-[13px] text-gray-600">
                <code className="text-cyan-600">MCPToolSearch</code> 인스턴스를 연결하여 Deferred Loading을 활성화합니다.
                <code className="text-cyan-600">isDeferredMode</code> getter는 toolSearch가 연결되어 있고
                지연 로딩할 도구가 1개 이상일 때 <code className="text-violet-600">true</code>를 반환합니다.
              </p>
            </div>

            {/* getDeferredToolsSummary */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-3">
              <div className="flex items-center gap-2 mb-2">
                <code className="text-[13px] font-bold text-cyan-600">getDeferredToolsSummary()</code>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-violet-50 text-violet-600">transform</span>
              </div>
              <p className="text-[13px] text-gray-600">
                지연 로딩 대상 MCP 도구들의 이름 + 간단 설명 요약을 생성합니다.
                시스템 프롬프트에 삽입하여 LLM이 어떤 MCP 도구가 사용 가능한지 알려줍니다.
                전체 스키마 대신 요약만 전달하여 토큰을 절약합니다.
              </p>
            </div>

            {/* resolveDeferredTool */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-3">
              <div className="flex items-center gap-2 mb-2">
                <code className="text-[13px] font-bold text-cyan-600">resolveDeferredTool(namespacedName)</code>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-600">read</span>
              </div>
              <p className="text-[13px] text-gray-600">
                네임스페이스 이름(예: <code className="text-amber-600">&quot;mcp__github__create_issue&quot;</code>)으로
                지연 로딩 도구의 전체 스키마를 해석합니다.
                LLM이 특정 MCP 도구를 사용하려고 할 때 Agent Loop가 호출합니다.
              </p>
            </div>

            {/* searchDeferredTools */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-3">
              <div className="flex items-center gap-2 mb-2">
                <code className="text-[13px] font-bold text-cyan-600">searchDeferredTools(query, maxResults?)</code>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-600">read</span>
              </div>
              <p className="text-[13px] text-gray-600">
                키워드 쿼리(예: <code className="text-amber-600">&quot;github issue&quot;</code>)로 지연 로딩 도구를 검색합니다.
                MCPToolSearch에 위임하여 관련도 높은 도구들의 전체 스키마를 반환합니다.
              </p>
            </div>

            {/* size */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-3">
              <div className="flex items-center gap-2 mb-2">
                <code className="text-[13px] font-bold text-cyan-600">size</code>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-600">getter</span>
              </div>
              <p className="text-[13px] text-gray-600">
                등록된 도구의 총 개수를 반환합니다. <code className="text-cyan-600">this.tools.size</code>를 위임합니다.
              </p>
            </div>

            <Callout type="warn" icon="⚠️">
              <strong>중복 등록 금지:</strong> 같은 이름으로 <code className="text-cyan-600">register()</code>를 두 번 호출하면
              <code className="text-red-600"> ToolError</code>가 발생합니다. MCP 도구를 재등록하려면 먼저 MCP 서버를 재연결해야 합니다.
            </Callout>
          </section>
        </RevealOnScroll>

        {/* ═══════════════════════ 4. 사용법 ═══════════════════════ */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2 className="text-2xl font-extrabold flex items-center gap-2" style={{ marginBottom: "24px", marginTop: "0" }}>
              🛠️ 사용법
            </h2>

            {/* 도구 등록 */}
            <h3 className="text-lg font-bold flex items-center gap-2" style={{ marginTop: "32px", marginBottom: "16px" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-accent-green" />
              도구 등록하기
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              내장 도구를 정의하고 레지스트리에 등록하는 기본 패턴입니다.
            </p>
            <CodeBlock>
{cm("// 1. 도구 정의")}{"\n"}
{kw("const")} {vr("myTool")}: {tp("ToolDefinition")}{"<"}MyParams{">"} = {pc("{")}{"\n"}
{"  "}{vr("name")}: {str("\"my_tool\"")},{"\n"}
{"  "}{vr("description")}: {str("\"도구가 하는 일에 대한 설명\"")},{"\n"}
{"  "}{vr("parameterSchema")}: {fn("z")}.{fn("object")}({pc("{")}{"\n"}
{"    "}{vr("filePath")}: {fn("z")}.{fn("string")}().{fn("describe")}({str("\"대상 파일 경로\"")}),{"\n"}
{"  "}{pc("}")}).{fn("strict")}(),{"\n"}
{"  "}{vr("permissionLevel")}: {str("\"safe\"")},{"\n"}
{"  "}{kw("async")} {fn("execute")}({vr("params")}, {vr("context")}) {pc("{")}{"\n"}
{"    "}{cm("// params는 Zod로 이미 검증됨")}{"\n"}
{"    "}{kw("return")} {pc("{")} {vr("output")}: {str("\"결과\"")}, {vr("isError")}: {kw("false")} {pc("}")};{"\n"}
{"  "}{pc("}")},{"\n"}
{pc("}")};{"\n"}
{"\n"}
{cm("// 2. 레지스트리에 등록")}{"\n"}
{vr("registry")}.{fn("register")}({vr("myTool")});{"\n"}
{"\n"}
{cm("// 3. 또는 여러 도구를 한 번에")}{"\n"}
{vr("registry")}.{fn("registerAll")}([{vr("fileReadTool")}, {vr("fileWriteTool")}, {vr("bashExecTool")}]);
            </CodeBlock>

            <div className="my-6" />

            {/* 도구 조회 */}
            <h3 className="text-lg font-bold flex items-center gap-2" style={{ marginTop: "32px", marginBottom: "16px" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-accent-blue" />
              도구 조회하기
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              상황에 따라 <code className="text-cyan-600">get()</code>과 <code className="text-cyan-600">require()</code>를 구분하여 사용합니다.
            </p>
            <CodeBlock>
{cm("// 존재할 수도 없을 수도 있는 경우 → get()")}{"\n"}
{kw("const")} {vr("tool")} = {vr("registry")}.{fn("get")}({str("\"mcp__slack__send_message\"")});{"\n"}
{kw("if")} ({vr("tool")}) {pc("{")}{"\n"}
{"  "}{cm("// MCP Slack 도구가 등록된 경우에만 실행")}{"\n"}
{pc("}")}{"\n"}
{"\n"}
{cm("// 반드시 존재해야 하는 경우 → require()")}{"\n"}
{kw("const")} {vr("bashTool")} = {vr("registry")}.{fn("require")}({str("\"bash_exec\"")});{"\n"}
{cm("// ToolError: \"Tool not found: bash_exec\" (등록 안 된 경우)")}{"\n"}
{"\n"}
{cm("// 등록 여부만 확인")}{"\n"}
{kw("if")} ({vr("registry")}.{fn("has")}({str("\"file_read\"")})) {pc("{")}{"\n"}
{"  "}{cm("// ...")}{"\n"}
{pc("}")}
            </CodeBlock>

            <div className="my-6" />

            {/* Hot Tools 개념 */}
            <h3 className="text-lg font-bold flex items-center gap-2" style={{ marginTop: "32px", marginBottom: "16px" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-accent-orange" />
              Hot Tools 개념
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              Agent Loop는 Deferred 모드가 활성화되면 <code className="text-cyan-600">getHotDefinitionsForLLM()</code>을 호출합니다.
              이 메서드는 다음 두 조건 중 하나를 만족하는 도구만 반환합니다:
            </p>
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <div className="text-[13px] text-gray-600 space-y-2">
                <div className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold shrink-0">1.</span>
                  <span><code className="text-cyan-600">hotTools</code> Set에 포함된 도구 (6개 핵심 도구)</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold shrink-0">2.</span>
                  <span>이름이 <code className="text-amber-600">&quot;mcp__&quot;</code>로 시작하지 않는 모든 내장 도구</span>
                </div>
              </div>
            </div>
            <p className="text-[13px] text-gray-600 mb-3">
              즉, MCP 도구만 필터링되고 나머지 내장 도구는 모두 포함됩니다.
            </p>
            <CodeBlock>
{cm("// Agent Loop에서의 사용 패턴")}{"\n"}
{kw("const")} {vr("tools")} = {vr("registry")}.{vr("isDeferredMode")}{"\n"}
{"  ? "}{vr("registry")}.{fn("getHotDefinitionsForLLM")}()   {cm("// MCP 도구 제외")}{"\n"}
{"  : "}{vr("registry")}.{fn("getDefinitionsForLLM")}();    {cm("// 전체 도구 포함")}{"\n"}
{"\n"}
{cm("// Deferred 모드라면 시스템 프롬프트에 요약 추가")}{"\n"}
{kw("if")} ({vr("registry")}.{vr("isDeferredMode")}) {pc("{")}{"\n"}
{"  "}{kw("const")} {vr("summary")} = {vr("registry")}.{fn("getDeferredToolsSummary")}();{"\n"}
{"  "}{cm("// → 시스템 프롬프트에 MCP 도구 이름+설명 삽입")}{"\n"}
{pc("}")}
            </CodeBlock>

            <DeepDive title="Deferred MCP Loading 상세 흐름">
              <div className="space-y-3">
                <p>
                  MCP(Model Context Protocol) 도구의 지연 로딩은 3단계로 동작합니다:
                </p>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="text-cyan-600 font-bold shrink-0">Step 1.</span>
                    <span>
                      MCP 서버 연결 시 <code className="text-cyan-600">setToolSearch(mcpToolSearch)</code>로
                      검색 인스턴스를 연결합니다. 이 시점에서 MCP 도구는 레지스트리에 등록되지만,
                      LLM에는 이름과 설명만 전달됩니다.
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-cyan-600 font-bold shrink-0">Step 2.</span>
                    <span>
                      LLM이 시스템 프롬프트에서 MCP 도구 요약을 보고 특정 도구를 사용하겠다고 결정하면,
                      <code className="text-cyan-600"> ToolSearch</code> 내장 도구를 호출하여
                      <code className="text-cyan-600"> searchDeferredTools()</code> 또는
                      <code className="text-cyan-600"> resolveDeferredTool()</code>로
                      전체 스키마를 가져옵니다.
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-cyan-600 font-bold shrink-0">Step 3.</span>
                    <span>
                      반환된 전체 스키마로 LLM이 정확한 매개변수를 구성하여 도구를 호출합니다.
                      이 과정은 대화 턴을 1회 추가로 소비하지만, 매 요청마다 수십 개 도구의 스키마를
                      보내는 것보다 전체 토큰 소비가 훨씬 적습니다.
                    </span>
                  </div>
                </div>
                <Callout type="tip" icon="💡">
                  네임스페이스 형식: <code className="text-amber-600">mcp__서버명__도구명</code> (예: <code className="text-amber-600">mcp__github__create_issue</code>).
                  이중 언더스코어로 서버와 도구를 구분합니다.
                </Callout>
              </div>
            </DeepDive>
          </section>
        </RevealOnScroll>

        {/* ═══════════════════════ 5. 내부 구현 ═══════════════════════ */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2 className="text-2xl font-extrabold flex items-center gap-2" style={{ marginBottom: "24px", marginTop: "0" }}>
              ⚙️ 내부 구현
            </h2>

            <h3 className="text-lg font-bold flex items-center gap-2" style={{ marginTop: "32px", marginBottom: "16px" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-accent-purple" />
              내부 저장 구조
            </h3>
            <p className="text-[14px] text-gray-600 mb-4">
              ToolRegistry는 3개의 private 필드로 구성됩니다.
              모든 필드는 <code className="text-violet-600">readonly</code>이거나 명시적 setter를 통해서만 변경 가능합니다.
            </p>

            <CodeBlock>
{kw("export class")} {tp("ToolRegistry")} {pc("{")}{"\n"}
{"\n"}
{"  "}{cm("// 1) 도구 저장소 — O(1) 조회")}{"\n"}
{"  "}{kw("private readonly")} {vr("tools")} = {kw("new")} {tp("Map")}{pc("<")}{tp("string")}, {tp("ToolDefinition")}{pc("<")}{tp("any")}{pc(">>")}();{"\n"}
{"\n"}
{"  "}{cm("// 2) MCP 도구 검색 — null이면 Deferred 비활성")}{"\n"}
{"  "}{kw("private")} {vr("toolSearch")}: {tp("MCPToolSearch")} | {tp("null")} = {kw("null")};{"\n"}
{"\n"}
{"  "}{cm("// 3) 핫 도구 목록 — 항상 전체 스키마 전달")}{"\n"}
{"  "}{kw("private readonly")} {vr("hotTools")} = {kw("new")} {tp("Set")}{pc("<")}{tp("string")}{pc(">")}([{"\n"}
{"    "}{str("\"file_read\"")},    {str("\"file_write\"")},  {str("\"file_edit\"")},{"\n"}
{"    "}{str("\"bash_exec\"")},    {str("\"glob_search\"")}, {str("\"grep_search\"")},{"\n"}
{"  "}]);{"\n"}
{"\n"}
{pc("}")}
            </CodeBlock>

            <div className="my-4" />

            <h3 className="text-lg font-bold flex items-center gap-2" style={{ marginTop: "32px", marginBottom: "16px" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan" />
              Hot Tool 필터링 로직
            </h3>
            <p className="text-[14px] text-gray-600 mb-4">
              <code className="text-cyan-600">getHotDefinitionsForLLM()</code>의 필터 조건은 두 가지입니다.
              Hot Set에 있거나 <strong>MCP 도구가 아닌</strong> 모든 도구가 포함됩니다.
            </p>

            <CodeBlock>
{fn("getHotDefinitionsForLLM")}(): {tp("readonly")} {tp("ToolDefinitionForLLM")}[] {pc("{")}{"\n"}
{"  "}{kw("return")} {kw("this")}.{fn("getAll")}(){"\n"}
{"    "}.{fn("filter")}(({vr("tool")}) {"=>"}{"\n"}
{"      "}{kw("this")}.{vr("hotTools")}.{fn("has")}({vr("tool")}.{vr("name")}) ||  {cm("// Hot Set에 있거나")}{"\n"}
{"      "}!{vr("tool")}.{vr("name")}.{fn("startsWith")}({str("\"mcp__\"")})     {cm("// MCP가 아닌 내장 도구")}{"\n"}
{"    "}){"\n"}
{"    "}.{fn("map")}(({vr("tool")}) {"=>"} ({pc("{")}{"\n"}
{"      "}{vr("type")}: {str("\"function\"")},{"\n"}
{"      "}{vr("function")}: {pc("{")}{"\n"}
{"        "}{vr("name")}: {vr("tool")}.{vr("name")},{"\n"}
{"        "}{vr("description")}: {vr("tool")}.{vr("description")},{"\n"}
{"        "}{vr("parameters")}: {fn("zodSchemaToJsonSchema")}({vr("tool")}.{vr("parameterSchema")}),{"\n"}
{"      "}{pc("}")},{"\n"}
{"    "}{pc("})")});{"\n"}
{pc("}")}
            </CodeBlock>

            <Callout type="tip" icon="🔍">
              <strong>Zod → JSON Schema 변환:</strong> <code className="text-cyan-600">zodSchemaToJsonSchema()</code>는
              <code className="text-cyan-600"> tools/validation.ts</code>에 정의되어 있습니다.
              Zod의 <code className="text-cyan-600">.describe()</code> 메서드로 추가한 필드 설명이
              JSON Schema의 <code className="text-cyan-600">description</code> 프로퍼티로 변환됩니다.
            </Callout>

            <MermaidDiagram
              title="도구 등록 → LLM 전달 흐름"
              titleColor="cyan"
              chart={`sequenceDiagram
    participant Init as 초기화
    participant Reg as ToolRegistry
    participant Agent as Agent Loop
    participant LLM as LLM API

    Init->>Reg: registerAll(builtinTools)
    Init->>Reg: register(mcpTool)
    Init->>Reg: setToolSearch(mcpSearch)

    Agent->>Reg: isDeferredMode?
    alt Deferred 모드
        Reg-->>Agent: true
        Agent->>Reg: getHotDefinitionsForLLM()
        Reg-->>Agent: Built-in 도구 (JSON Schema)
        Agent->>Reg: getDeferredToolsSummary()
        Reg-->>Agent: MCP 도구 요약 (이름+설명)
    else 일반 모드
        Reg-->>Agent: false
        Agent->>Reg: getDefinitionsForLLM()
        Reg-->>Agent: 전체 도구 (JSON Schema)
    end

    Agent->>LLM: tools + system prompt 전달`}
            />
          </section>
        </RevealOnScroll>

        {/* ═══════════════════════ 6. 트러블슈팅 ═══════════════════════ */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2 className="text-2xl font-extrabold flex items-center gap-2" style={{ marginBottom: "24px", marginTop: "0" }}>
              ❓ 트러블슈팅
            </h2>

            <div className="space-y-4">
              {/* FAQ 1 */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-[14px] font-bold text-amber-600 mb-2">
                  Q1. &quot;Tool already registered&quot; 에러가 발생합니다
                </h4>
                <p className="text-[13px] text-gray-600 leading-relaxed">
                  <strong>원인:</strong> 같은 이름의 도구를 <code className="text-cyan-600">register()</code>로 두 번 등록하려고 했습니다.
                  MCP 서버 재연결 시 이전 도구가 아직 등록된 상태일 수 있습니다.
                </p>
                <p className="text-[13px] text-gray-600 leading-relaxed mt-2">
                  <strong>해결:</strong> <code className="text-cyan-600">has(name)</code>으로 먼저 확인하거나,
                  MCP 서버 매니저의 재연결 로직에서 기존 도구를 정리한 후 다시 등록하세요.
                  ToolRegistry 자체는 <code className="text-red-600">delete()</code> 메서드를 제공하지 않으므로,
                  새 인스턴스를 생성하는 것이 가장 안전합니다.
                </p>
              </div>

              {/* FAQ 2 */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-[14px] font-bold text-amber-600 mb-2">
                  Q2. MCP 도구가 LLM에게 전달되지 않습니다
                </h4>
                <p className="text-[13px] text-gray-600 leading-relaxed">
                  <strong>원인:</strong> Deferred 모드가 활성화된 상태에서 <code className="text-cyan-600">getHotDefinitionsForLLM()</code>이
                  호출되면 <code className="text-cyan-600">mcp__</code> 접두사 도구는 전체 스키마에서 필터링됩니다.
                </p>
                <p className="text-[13px] text-gray-600 leading-relaxed mt-2">
                  <strong>해결:</strong> 이것은 의도된 동작입니다. MCP 도구는 시스템 프롬프트의 요약을 통해 LLM에게 알려지며,
                  LLM이 <code className="text-cyan-600">ToolSearch</code> 도구를 호출하면
                  <code className="text-cyan-600"> resolveDeferredTool()</code>이나
                  <code className="text-cyan-600"> searchDeferredTools()</code>로 전체 스키마가 제공됩니다.
                </p>
              </div>

              {/* FAQ 3 */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-[14px] font-bold text-amber-600 mb-2">
                  Q3. 새로 추가한 도구가 Hot Tools로 포함되지 않습니다
                </h4>
                <p className="text-[13px] text-gray-600 leading-relaxed">
                  <strong>원인:</strong> <code className="text-cyan-600">hotTools</code> Set은
                  클래스 내부에 하드코딩된 6개 도구명만 포함합니다.
                  새로 만든 내장 도구는 Hot Tool이 아니더라도 <code className="text-cyan-600">getHotDefinitionsForLLM()</code>에
                  포함됩니다(MCP 도구가 아니므로).
                </p>
                <p className="text-[13px] text-gray-600 leading-relaxed mt-2">
                  <strong>해결:</strong> 내장 도구(non-MCP)라면 별도 설정 없이 자동으로 LLM에 전달됩니다.
                  Hot Tool Set에 추가하고 싶다면 <code className="text-cyan-600">registry.ts</code>의
                  <code className="text-cyan-600"> hotTools</code> 초기값에 도구명을 추가하세요.
                  다만 현재 Hot Tool의 주 역할은 MCP 필터링 시 보존 대상을 지정하는 것이므로,
                  내장 도구에는 실질적 차이가 없습니다.
                </p>
              </div>
            </div>
          </section>
        </RevealOnScroll>

        {/* ═══════════════════════ 7. 관련 문서 ═══════════════════════ */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2 className="text-2xl font-extrabold flex items-center gap-2" style={{ marginBottom: "24px", marginTop: "0" }}>
              🔗 관련 문서
            </h2>
            <SeeAlso items={[
              {
                name: "tool-executor.ts",
                slug: "tool-executor",
                relation: "sibling",
                desc: "도구 실행 파이프라인 — Zod 검증, AbortSignal, 권한 확인 후 execute() 호출",
              },
              {
                name: "agent-loop.ts",
                slug: "agent-loop",
                relation: "parent",
                desc: "ReAct 패턴 메인 루프 — Registry에서 도구 목록을 가져와 LLM에 전달",
              },
              {
                name: "mcp/manager.ts",
                slug: "mcp-manager",
                relation: "child",
                desc: "MCP 서버 수명주기 관리 — 서버 연결 시 Registry에 MCP 도구를 등록",
              },
            ]} />
          </section>
        </RevealOnScroll>

      </div>
    </div>
  );
}

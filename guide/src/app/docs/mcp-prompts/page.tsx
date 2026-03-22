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

export default function MCPPromptsPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}><div className="center-narrow">
      {/* ─── Header ─── */}
      <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <FilePath path="src/mcp/prompts.ts" />
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
            <span className="text-gray-900">
              MCPPromptManager &amp; MCPResourceManager
            </span>
          </h1>
          <div className="flex items-center gap-3 mb-5">
            <LayerBadge layer="infra" />
          </div>
          <p className="text-[16px] text-gray-600 leading-relaxed">
            MCP 서버의 프롬프트 템플릿과 리소스를 발견, 실행, 캐싱하는 모듈입니다.
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
              <code className="text-cyan-600">MCPPromptManager</code>는 MCP 서버가 제공하는 재사용 가능한
              프롬프트 템플릿을 관리합니다. 사용자가 슬래시 명령(<code className="text-cyan-600">/mcp__서버이름__프롬프트이름</code>)으로
              프롬프트를 실행하면, 서버에서 인자가 치환된 메시지를 받아 대화에 주입합니다.
            </p>
            <p>
              <code className="text-cyan-600">MCPResourceManager</code>(<code className="text-cyan-600">resources.ts</code>)는
              MCP 서버의 외부 데이터(파일, DB 레코드, API 데이터 등)를 참조합니다.
              사용자가 <code className="text-cyan-600">@서버이름:리소스URI</code> 구문으로 멘션하면,
              해당 리소스의 콘텐츠를 가져와 대화 컨텍스트에 주입합니다.
            </p>
            <p>
              두 모듈 모두 네임스페이싱을 통해 여러 서버의 프롬프트/리소스가 충돌하지 않도록 합니다.
              리소스 매니저는 TTL(5분) 기반 캐시로 반복 읽기를 최적화하고,
              캐시 히트/미스 통계를 추적합니다.
            </p>
          </div>

          <MermaidDiagram
            title="MCPPromptManager & MCPResourceManager 아키텍처 위치"
            titleColor="purple"
            chart={`graph TD
  USER["사용자 입력<br/><small>/mcp__server__prompt 또는 @server:uri</small>"]
  PM["MCPPromptManager<br/><small>prompts.ts</small>"]
  RM["MCPResourceManager<br/><small>resources.ts</small>"]
  CLIENT["MCPClient<br/><small>client.ts</small>"]
  SLASH["SlashCommand<br/><small>슬래시 명령</small>"]
  CTX["대화 컨텍스트<br/><small>메시지 주입</small>"]
  CACHE["TTL 캐시<br/><small>5분</small>"]

  USER -->|"슬래시 명령"| SLASH
  SLASH -->|"실행 위임"| PM
  PM -->|"getPrompt()"| CLIENT
  CLIENT -->|"메시지 반환"| PM
  PM -->|"shouldInjectAsUserMessage"| CTX

  USER -->|"@멘션"| RM
  RM -->|"readResource()"| CLIENT
  RM -->|"캐시 히트"| CACHE
  RM -->|"formatResourcesForContext()"| CTX

  style PM fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style RM fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style USER fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style CACHE fill:#fef3c7,stroke:#f59e0b,color:#78350f
  style CTX fill:#dcfce7,stroke:#10b981,color:#065f46`}
          />

          <Callout type="info" icon="💡">
            <strong>비유:</strong> 프롬프트 매니저는 &quot;우편 주문 서비스&quot;입니다.
            양식(프롬프트 템플릿)에 빈칸(인자)을 채워 보내면, 서버가 완성된 편지(메시지)를 돌려줍니다.
            리소스 매니저는 &quot;도서관 사서&quot;입니다. @멘션으로 책(리소스)을 요청하면,
            캐시(최근 대출 목록)를 확인하고 없으면 서가(서버)에서 꺼내옵니다.
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 2. 레퍼런스 — MCPPromptManager ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>📖</span> 레퍼런스 &mdash; MCPPromptManager
          </h2>

          {/* MCPPromptMessage interface */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface MCPPromptMessage
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            프롬프트 실행 결과로 반환되는 메시지입니다. LLM 대화에 주입됩니다.
          </p>
          <ParamTable
            params={[
              { name: "role", type: '"user" | "assistant"', required: true, desc: "메시지 역할" },
              { name: "content", type: '{ type: "text"; text: string }', required: true, desc: "메시지 콘텐츠 (텍스트)" },
            ]}
          />

          {/* ResolvedPrompt interface */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface ResolvedPrompt
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            서버에서 인자가 치환된 최종 프롬프트입니다.
          </p>
          <ParamTable
            params={[
              { name: "serverName", type: "string", required: true, desc: "프롬프트를 제공한 서버 이름" },
              { name: "promptName", type: "string", required: true, desc: "프롬프트 이름" },
              { name: "description", type: "string | undefined", required: false, desc: "프롬프트 설명" },
              { name: "messages", type: "readonly MCPPromptMessage[]", required: true, desc: "서버에서 반환한 메시지 배열" },
            ]}
          />

          {/* PromptCapableClient interface */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface PromptCapableClient
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            프롬프트 기능에 필요한 MCPClient 인터페이스의 부분 집합입니다.
            테스트 시 목(mock) 객체를 쉽게 만들 수 있도록 분리되어 있습니다.
          </p>
          <ParamTable
            params={[
              { name: "listPrompts()", type: "Promise<readonly MCPPrompt[]>", required: true, desc: "사용 가능한 프롬프트 목록 조회" },
              { name: "getPrompt(name, args)", type: "Promise<{ messages }>", required: true, desc: "프롬프트 실행 (인자 치환)" },
            ]}
          />

          {/* MCPPromptManager class */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            class MCPPromptManager
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            MCP 프롬프트의 발견, 인자 파싱, 검증, 실행, 슬래시 명령 생성을 담당하는 메인 클래스입니다.
          </p>

          {/* discoverPrompts */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            discoverPrompts(client, serverName)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            MCP 클라이언트에서 프롬프트를 발견하고 <code className="text-cyan-600">mcp__서버이름__프롬프트이름</code> 키로 저장합니다.
          </p>
          <CodeBlock>
            <span className="kw">async</span> <span className="fn">discoverPrompts</span>(
            {"\n"}{"  "}<span className="prop">client</span>: <span className="type">PromptCapableClient</span>,
            {"\n"}{"  "}<span className="prop">serverName</span>: <span className="type">string</span>
            {"\n"}): <span className="type">Promise</span>&lt;<span className="kw">readonly</span> <span className="type">MCPPrompt</span>[]&gt;
          </CodeBlock>

          {/* parsePromptArgs */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            parsePromptArgs(argsString, promptArgs?)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            커맨드라인 문자열에서 인자를 파싱합니다.
            <code className="text-cyan-600">key=value</code>,
            <code className="text-cyan-600">key=&quot;quoted value&quot;</code>,
            <code className="text-cyan-600">key=&apos;single quoted&apos;</code> 형식을 지원합니다.
          </p>
          <CodeBlock>
            <span className="fn">parsePromptArgs</span>(
            {"\n"}{"  "}<span className="prop">argsString</span>: <span className="type">string</span>,
            {"\n"}{"  "}<span className="prop">promptArgs</span>?: <span className="kw">readonly</span> <span className="type">MCPPromptArgument</span>[]
            {"\n"}): <span className="type">Record</span>&lt;<span className="type">string</span>, <span className="type">string</span>&gt;
          </CodeBlock>
          <ParamTable
            params={[
              { name: "argsString", type: "string", required: true, desc: '파싱할 인자 문자열 (예: \'name="John" age=30\')' },
              { name: "promptArgs", type: "readonly MCPPromptArgument[]", required: false, desc: "프롬프트 인자 정의 (위치 인자 할당용)" },
            ]}
          />

          {/* validateArgs */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            validateArgs(args, promptDef)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            필수 인자가 모두 제공되었는지 검증합니다.
          </p>
          <CodeBlock>
            <span className="fn">validateArgs</span>(<span className="prop">args</span>: <span className="type">Record</span>&lt;<span className="type">string</span>, <span className="type">string</span>&gt;, <span className="prop">promptDef</span>: <span className="type">MCPPrompt</span>): {"{"}
            {"\n"}{"  "}<span className="kw">readonly</span> <span className="prop">valid</span>: <span className="type">boolean</span>;
            {"\n"}{"  "}<span className="kw">readonly</span> <span className="prop">missing</span>: <span className="kw">readonly</span> <span className="type">string</span>[];
            {"\n"}{"}"}
          </CodeBlock>

          {/* executePrompt */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            executePrompt(client, promptName, args)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            프롬프트를 실행합니다. 서버에 인자를 전달하고 치환된 메시지를 받아옵니다.
          </p>
          <CodeBlock>
            <span className="kw">async</span> <span className="fn">executePrompt</span>(
            {"\n"}{"  "}<span className="prop">client</span>: <span className="type">PromptCapableClient</span>,
            {"\n"}{"  "}<span className="prop">promptName</span>: <span className="type">string</span>,
            {"\n"}{"  "}<span className="prop">args</span>: <span className="type">Record</span>&lt;<span className="type">string</span>, <span className="type">string</span>&gt;
            {"\n"}): <span className="type">Promise</span>&lt;<span className="kw">readonly</span> <span className="type">MCPPromptMessage</span>[]&gt;
          </CodeBlock>

          {/* generateSlashCommands */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            generateSlashCommands(getClient)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            발견된 모든 프롬프트에 대해 슬래시 명령을 생성합니다.
            각 명령의 <code className="text-cyan-600">execute()</code>는 인자 파싱, 검증, 프롬프트 실행을 자동으로 수행합니다.
          </p>
          <CodeBlock>
            <span className="fn">generateSlashCommands</span>(
            {"\n"}{"  "}<span className="prop">getClient</span>: (<span className="prop">serverName</span>: <span className="type">string</span>) =&gt; <span className="type">PromptCapableClient</span> | <span className="type">undefined</span>
            {"\n"}): <span className="kw">readonly</span> {"{"} <span className="prop">name</span>; <span className="prop">description</span>; <span className="prop">usage</span>; <span className="prop">execute</span> {"}"}[]
          </CodeBlock>

          {/* Caveats */}
          <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
          <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
            <li>
              네임스페이싱 형식은 <code className="text-cyan-600">mcp__서버이름__프롬프트이름</code>입니다.
              서버 이름에 언더스코어가 있으면 파싱이 모호해질 수 있으니 주의하세요.
            </li>
            <li>
              <code className="text-cyan-600">parsePromptArgs()</code>에서 <code className="text-cyan-600">key=value</code>
              패턴이 없고 단일 문자열만 있으면, 첫 번째 인자 정의의 이름에 전체 문자열을 할당합니다.
            </li>
            <li>
              슬래시 명령 실행 결과의 <code className="text-cyan-600">shouldInjectAsUserMessage: true</code>는
              결과를 사용자 메시지로 대화에 주입하라는 신호입니다. UI 레이어가 이 플래그를 처리해야 합니다.
            </li>
          </ul>
        </section>
      </RevealOnScroll>

      {/* ─── 3. 레퍼런스 — MCPResourceManager ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>📖</span> 레퍼런스 &mdash; MCPResourceManager
          </h2>

          {/* ResolvedResource interface */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface ResolvedResource
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            서버에서 메타데이터와 콘텐츠를 읽어온 리소스입니다.
          </p>
          <ParamTable
            params={[
              { name: "serverName", type: "string", required: true, desc: "리소스를 제공한 서버 이름" },
              { name: "uri", type: "string", required: true, desc: "리소스 URI" },
              { name: "resource", type: "MCPResource", required: true, desc: "리소스 메타데이터 (이름, 설명, MIME 타입)" },
              { name: "content", type: "string", required: true, desc: "리소스 실제 콘텐츠 (텍스트)" },
            ]}
          />

          {/* ResourceMention interface */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface ResourceMention
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            사용자 텍스트에서 추출한 <code className="text-cyan-600">@server:uri</code> 멘션입니다.
          </p>
          <ParamTable
            params={[
              { name: "serverName", type: "string", required: true, desc: "서버 이름" },
              { name: "uri", type: "string", required: true, desc: "리소스 URI" },
            ]}
          />

          {/* CacheStats interface */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface CacheStats
          </h3>
          <ParamTable
            params={[
              { name: "size", type: "number", required: true, desc: "캐시에 저장된 항목 수" },
              { name: "hits", type: "number", required: true, desc: "캐시 히트 횟수" },
              { name: "misses", type: "number", required: true, desc: "캐시 미스 횟수" },
            ]}
          />

          {/* MCPResourceManager class */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            class MCPResourceManager
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            MCP 리소스의 발견, 읽기, 캐싱, @멘션 파싱을 담당하는 메인 클래스입니다.
          </p>

          {/* Constructor */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            constructor(ttlMs?)
          </h4>
          <CodeBlock>
            <span className="kw">constructor</span>(<span className="prop">ttlMs</span>?: <span className="type">number</span>)
            {"\n"}<span className="cm">{"// 기본값: 5 * 60 * 1000 (5분)"}</span>
          </CodeBlock>
          <ParamTable
            params={[
              { name: "ttlMs", type: "number", required: false, desc: "캐시 TTL (기본: 300,000ms = 5분)" },
            ]}
          />

          {/* parseResourceMentions */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            parseResourceMentions(text)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            텍스트에서 <code className="text-cyan-600">@server:resource</code> 멘션을 파싱합니다.
            동일한 서버:URI 조합의 중복은 자동으로 제거됩니다.
          </p>
          <CodeBlock>
            <span className="fn">parseResourceMentions</span>(<span className="prop">text</span>: <span className="type">string</span>): <span className="kw">readonly</span> <span className="type">ResourceMention</span>[]
          </CodeBlock>

          {/* readResource */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            readResource(client, serverName, uri)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            서버에서 리소스를 읽어 반환합니다. TTL 기반 캐시를 사용하여
            유효한 캐시가 있으면 서버 호출 없이 즉시 반환합니다.
          </p>
          <CodeBlock>
            <span className="kw">async</span> <span className="fn">readResource</span>(
            {"\n"}{"  "}<span className="prop">client</span>: <span className="type">MCPClient</span>,
            {"\n"}{"  "}<span className="prop">serverName</span>: <span className="type">string</span>,
            {"\n"}{"  "}<span className="prop">uri</span>: <span className="type">string</span>
            {"\n"}): <span className="type">Promise</span>&lt;<span className="type">string</span>&gt;
          </CodeBlock>

          {/* resolveResourceMentions */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            resolveResourceMentions(text, clients)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            텍스트 내의 모든 @멘션을 동시에(concurrently) 해석합니다.
            <code className="text-cyan-600">Promise.allSettled()</code>로 부분 실패를 허용합니다.
          </p>
          <CodeBlock>
            <span className="kw">async</span> <span className="fn">resolveResourceMentions</span>(
            {"\n"}{"  "}<span className="prop">text</span>: <span className="type">string</span>,
            {"\n"}{"  "}<span className="prop">clients</span>: <span className="type">ReadonlyMap</span>&lt;<span className="type">string</span>, <span className="type">MCPClient</span>&gt;
            {"\n"}): <span className="type">Promise</span>&lt;<span className="kw">readonly</span> <span className="type">ResolvedResource</span>[]&gt;
          </CodeBlock>

          {/* formatResourcesForContext */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            formatResourcesForContext(resources)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            해석된 리소스들을 대화 컨텍스트에 주입할 XML 형태로 포맷합니다.
          </p>
          <CodeBlock>
            <span className="fn">formatResourcesForContext</span>(<span className="prop">resources</span>: <span className="kw">readonly</span> <span className="type">ResolvedResource</span>[]): <span className="type">string</span>
            {"\n"}
            {"\n"}<span className="cm">{"// 출력 예시:"}</span>
            {"\n"}<span className="cm">{'// <resource server="myserver" uri="file:///data.txt">'}</span>
            {"\n"}<span className="cm">{"// 파일 내용..."}</span>
            {"\n"}<span className="cm">{"// </resource>"}</span>
          </CodeBlock>

          {/* getCacheStats / clearCache */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            getCacheStats() / clearCache() / clearExpiredCache()
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            캐시 통계 조회, 전체 캐시 초기화, 만료된 캐시만 제거하는 유틸리티 메서드들입니다.
          </p>
          <CodeBlock>
            <span className="fn">getCacheStats</span>(): <span className="type">CacheStats</span>
            {"\n"}<span className="fn">clearCache</span>(): <span className="type">void</span>{"       "}<span className="cm">{"// 전체 초기화 (히트/미스 카운터 포함)"}</span>
            {"\n"}<span className="fn">clearExpiredCache</span>(): <span className="type">void</span> <span className="cm">{"// 만료된 항목만 제거"}</span>
          </CodeBlock>

          {/* Resource Caveats */}
          <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
          <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
            <li>
              @멘션 패턴: <code className="text-cyan-600">@server:protocol://path</code> 또는 <code className="text-cyan-600">@server:name</code>.
              서버 이름은 <code className="text-cyan-600">\w[\w-]*</code> 패턴(영숫자, 하이픈)이어야 합니다.
            </li>
            <li>
              <code className="text-cyan-600">resolveResourceMentions()</code>는
              <code className="text-cyan-600">Promise.allSettled()</code>를 사용하므로,
              일부 멘션이 실패해도 성공한 멘션의 결과는 반환됩니다. 실패는 조용히 건너뜁니다.
            </li>
            <li>
              캐시 키는 <code className="text-cyan-600">serverName::uri</code> 형태입니다.
              TTL 만료 후에도 캐시 항목이 자동으로 삭제되지 않습니다.
              <code className="text-cyan-600">clearExpiredCache()</code>를 주기적으로 호출해야 메모리가 절약됩니다.
            </li>
            <li>
              <code className="text-cyan-600">formatResourcesForContext()</code>는 XML 속성에서
              특수 문자(&amp;, &quot;, &lt;, &gt;)를 이스케이프하여 XSS를 방지합니다.
            </li>
          </ul>
        </section>
      </RevealOnScroll>

      {/* ─── 4. 사용법 (Usage) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>🚀</span> 사용법
          </h2>

          {/* 프롬프트 기본 사용법 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>프롬프트 &mdash; 슬래시 명령으로 프롬프트 실행</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            MCP 서버에서 프롬프트를 발견하고, 슬래시 명령을 생성하여 실행하는 전체 흐름입니다.
          </p>
          <CodeBlock>
            <span className="kw">const</span> <span className="prop">manager</span> = <span className="kw">new</span> <span className="fn">MCPPromptManager</span>();
            {"\n"}
            {"\n"}<span className="cm">{"// 1. 서버에서 프롬프트 발견"}</span>
            {"\n"}<span className="kw">await</span> <span className="prop">manager</span>.<span className="fn">discoverPrompts</span>(<span className="prop">client</span>, <span className="str">&quot;github&quot;</span>);
            {"\n"}<span className="cm">{"// → prompts Map에 'mcp__github__create_pr' 등 저장"}</span>
            {"\n"}
            {"\n"}<span className="cm">{"// 2. 슬래시 명령 생성"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">commands</span> = <span className="prop">manager</span>.<span className="fn">generateSlashCommands</span>(
            {"\n"}{"  "}<span className="prop">getClient</span>
            {"\n"});
            {"\n"}
            {"\n"}<span className="cm">{"// 3. 사용자가 /mcp__github__create_pr description=\"Fix bug\" 실행"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">result</span> = <span className="kw">await</span> <span className="prop">commands</span>[<span className="num">0</span>].<span className="fn">execute</span>(<span className="str">&apos;description=&quot;Fix bug&quot;&apos;</span>);
            {"\n"}<span className="cm">{"// → { output: '...', success: true, shouldInjectAsUserMessage: true }"}</span>
          </CodeBlock>

          <Callout type="warn" icon="!">
            <strong>주의:</strong> <code>generateSlashCommands()</code>에 전달하는 <code>getClient</code> 함수가
            서버 이름으로 유효한 클라이언트를 반환하지 않으면, 실행 시
            &quot;MCP server is not connected&quot; 에러가 반환됩니다.
          </Callout>

          {/* 리소스 기본 사용법 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>리소스 &mdash; @멘션으로 리소스 참조</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            사용자 텍스트에서 @멘션을 파싱하고 리소스 콘텐츠를 가져오는 흐름입니다.
          </p>
          <CodeBlock>
            <span className="kw">const</span> <span className="prop">resourceManager</span> = <span className="kw">new</span> <span className="fn">MCPResourceManager</span>();
            {"\n"}
            {"\n"}<span className="cm">{"// 1. 사용자 텍스트에서 @멘션 파싱"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">text</span> = <span className="str">&quot;이 파일 분석해줘 @myserver:file:///data.txt&quot;</span>;
            {"\n"}<span className="kw">const</span> <span className="prop">mentions</span> = <span className="prop">resourceManager</span>.<span className="fn">parseResourceMentions</span>(<span className="prop">text</span>);
            {"\n"}<span className="cm">{"// → [{ serverName: 'myserver', uri: 'file:///data.txt' }]"}</span>
            {"\n"}
            {"\n"}<span className="cm">{"// 2. 모든 멘션을 동시에 해석"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">resources</span> = <span className="kw">await</span> <span className="prop">resourceManager</span>.<span className="fn">resolveResourceMentions</span>(<span className="prop">text</span>, <span className="prop">clients</span>);
            {"\n"}
            {"\n"}<span className="cm">{"// 3. 대화 컨텍스트에 주입할 형태로 포맷"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">formatted</span> = <span className="prop">resourceManager</span>.<span className="fn">formatResourcesForContext</span>(<span className="prop">resources</span>);
            {"\n"}<span className="cm">{"// → '<resource server=\"myserver\" uri=\"file:///data.txt\">내용...</resource>'"}</span>
          </CodeBlock>

          <Callout type="tip" icon="*">
            <strong>팁:</strong> 동일한 리소스를 여러 번 참조해도 캐시 덕분에 서버 호출은 한 번만 발생합니다.
            <code>getCacheStats()</code>로 캐시 히트율을 모니터링할 수 있습니다.
          </Callout>

          <DeepDive title="인자 파싱 상세 동작">
            <p className="mb-3">
              <code className="text-cyan-600">parsePromptArgs()</code>는 세 가지 형식을 지원합니다:
            </p>
            <CodeBlock>
              <span className="cm">{"// 1. 따옴표 없이"}</span>
              {"\n"}<span className="fn">parsePromptArgs</span>(<span className="str">&apos;name=John age=30&apos;</span>)
              {"\n"}<span className="cm">{"// → { name: 'John', age: '30' }"}</span>
              {"\n"}
              {"\n"}<span className="cm">{"// 2. 큰따옴표 (공백 포함)"}</span>
              {"\n"}<span className="fn">parsePromptArgs</span>(<span className="str">&apos;desc=&quot;Fix the bug&quot;&apos;</span>)
              {"\n"}<span className="cm">{"// → { desc: 'Fix the bug' }"}</span>
              {"\n"}
              {"\n"}<span className="cm">{"// 3. 위치 인자 (key=value 없이)"}</span>
              {"\n"}<span className="fn">parsePromptArgs</span>(<span className="str">&apos;Hello World&apos;</span>, [{"{"}name: <span className="str">&apos;query&apos;</span>{"}"}])
              {"\n"}<span className="cm">{"// → { query: 'Hello World' }"}</span>
            </CodeBlock>
            <p className="mt-3 text-amber-600">
              위치 인자는 key=value 패턴이 전혀 없을 때만 동작합니다.
              하나라도 key=value가 있으면 나머지 텍스트는 무시됩니다.
            </p>
          </DeepDive>
        </section>
      </RevealOnScroll>

      {/* ─── 5. 내부 구현 (Internals) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>⚙️</span> 내부 구현
          </h2>

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>슬래시 명령 실행 흐름</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            사용자가 슬래시 명령을 실행했을 때의 내부 처리 흐름입니다.
          </p>

          <MermaidDiagram
            title="프롬프트 슬래시 명령 실행 흐름"
            titleColor="purple"
            chart={`graph TD
  INPUT(("/mcp__server__prompt args")) --> FIND["getClient(serverName)"]
  FIND -->|"클라이언트 없음"| ERR1["'not connected'<br/>success: false"]
  FIND -->|"클라이언트 있음"| PARSE["parsePromptArgs()<br/><small>인자 파싱</small>"]
  PARSE --> VALIDATE["validateArgs()<br/><small>필수 인자 검증</small>"]
  VALIDATE -->|"누락 있음"| ERR2["'Missing required arguments'<br/>success: false"]
  VALIDATE -->|"통과"| EXEC["executePrompt()<br/><small>서버에 전달</small>"]
  EXEC -->|"성공"| RESULT["메시지 텍스트 합침<br/>shouldInjectAsUserMessage: true"]
  EXEC -->|"실패"| ERR3["에러 메시지<br/>success: false"]

  style INPUT fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style PARSE fill:#ede9fe,stroke:#8b5cf6,color:#1e293b
  style VALIDATE fill:#ede9fe,stroke:#8b5cf6,color:#1e293b
  style EXEC fill:#ede9fe,stroke:#8b5cf6,color:#1e293b
  style RESULT fill:#dcfce7,stroke:#10b981,color:#065f46
  style ERR1 fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style ERR2 fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style ERR3 fill:#fee2e2,stroke:#ef4444,color:#991b1b`}
          />

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>리소스 캐시 동작</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            리소스 읽기 시 TTL 캐시의 동작 흐름입니다.
          </p>
          <CodeBlock>
            <span className="kw">async</span> <span className="fn">readResource</span>(<span className="prop">client</span>, <span className="prop">serverName</span>, <span className="prop">uri</span>): <span className="type">Promise</span>&lt;<span className="type">string</span>&gt; {"{"}
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">cacheKey</span> = <span className="str">`${"{"}</span><span className="prop">serverName</span><span className="str">{"}"}::${"{"}</span><span className="prop">uri</span><span className="str">{"}"}`</span>;
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">cached</span> = <span className="kw">this</span>.<span className="prop">cache</span>.<span className="fn">get</span>(<span className="prop">cacheKey</span>);
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// 캐시 히트: 유효하면 즉시 반환"}</span>
            {"\n"}{"  "}<span className="kw">if</span> (<span className="prop">cached</span> && !<span className="kw">this</span>.<span className="fn">isExpired</span>(<span className="prop">cached</span>)) {"{"}
            {"\n"}{"    "}<span className="kw">this</span>.<span className="prop">cacheHits</span>++;
            {"\n"}{"    "}<span className="kw">return</span> <span className="prop">cached</span>.<span className="prop">content</span>;
            {"\n"}{"  "}{"}"}
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// 캐시 미스: 서버에서 읽고 캐시에 저장"}</span>
            {"\n"}{"  "}<span className="kw">this</span>.<span className="prop">cacheMisses</span>++;
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">content</span> = <span className="kw">await</span> <span className="prop">client</span>.<span className="fn">readResource</span>(<span className="prop">uri</span>);
            {"\n"}{"  "}<span className="kw">this</span>.<span className="prop">cache</span>.<span className="fn">set</span>(<span className="prop">cacheKey</span>, {"{"} <span className="prop">content</span>, <span className="prop">timestamp</span>: <span className="fn">Date</span>.<span className="fn">now</span>() {"}"});
            {"\n"}{"  "}<span className="kw">return</span> <span className="prop">content</span>;
            {"\n"}{"}"}
          </CodeBlock>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
            <p><strong className="text-gray-900">프롬프트 네임스페이싱:</strong> <code>mcp__serverName__promptName</code> 형태로 Map에 저장하여, 여러 서버의 같은 이름 프롬프트가 충돌하지 않습니다.</p>
            <p><strong className="text-gray-900">리소스 캐시 키:</strong> <code>serverName::uri</code> 형태로, 같은 URI라도 서버가 다르면 별도로 캐시됩니다.</p>
            <p><strong className="text-gray-900">부분 실패 허용:</strong> <code>resolveResourceMentions()</code>는 <code>Promise.allSettled()</code>를 사용하여, 하나의 멘션이 실패해도 다른 멘션의 해석을 차단하지 않습니다.</p>
          </div>
        </section>
      </RevealOnScroll>

      {/* ─── 6. 트러블슈팅 (Troubleshooting) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>🔧</span> 트러블슈팅
          </h2>

          {/* FAQ 1 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;Missing required arguments 에러가 발생합니다&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              프롬프트에 필수 인자(<code className="text-cyan-600">required: true</code>)가 누락되었습니다.
              슬래시 명령의 usage 힌트(<code>&lt;name&gt;</code>은 필수,
              <code>[name]</code>은 선택)를 확인하고, 필수 인자를 모두 전달하세요.
            </p>
            <CodeBlock>
              <span className="cm">{"// usage: /mcp__github__create_pr <description> [draft]"}</span>
              {"\n"}<span className="cm">{"// description은 필수, draft는 선택"}</span>
              {"\n"}<span className="str">/mcp__github__create_pr description=&quot;Fix bug&quot;</span>
            </CodeBlock>
          </div>

          {/* FAQ 2 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;@멘션이 인식되지 않습니다&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              @멘션 형식이 올바른지 확인하세요. 서버 이름은 영숫자와 하이픈만 허용됩니다.
              공백이나 특수 문자가 포함되면 파싱되지 않습니다.
              올바른 예: <code className="text-cyan-600">@my-server:file:///path</code>,
              잘못된 예: <code className="text-red-600">@my server:file:///path</code>
            </p>
          </div>

          {/* FAQ 3 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;리소스 캐시가 오래된 데이터를 반환합니다&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              기본 TTL은 5분입니다. 최신 데이터가 필요하면
              <code className="text-cyan-600">clearCache()</code>로 캐시를 초기화하거나,
              생성자에 더 짧은 TTL을 전달하세요.
            </p>
          </div>

          {/* FAQ 4 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;일부 @멘션만 해석되고 나머지는 무시됩니다&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">resolveResourceMentions()</code>는
              <code className="text-cyan-600">Promise.allSettled()</code>를 사용하므로,
              알 수 없는 서버나 존재하지 않는 리소스의 멘션은 조용히 건너뜁니다.
              클라이언트 Map에 해당 서버가 등록되어 있는지, 리소스 URI가 올바른지 확인하세요.
            </p>
          </div>
        </section>
      </RevealOnScroll>

      {/* ─── 7. 관련 문서 (See Also) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>🔗</span> 관련 문서
          </h2>
          <SeeAlso
            items={[
              {
                name: "mcp/client.ts",
                slug: "mcp-client",
                relation: "parent",
                desc: "MCPClient — 프롬프트와 리소스 API를 제공하는 MCP 클라이언트",
              },
              {
                name: "mcp/manager.ts",
                slug: "mcp-manager",
                relation: "parent",
                desc: "MCPManager — 여러 서버의 프롬프트/리소스를 통합 관리하는 오케스트레이터",
              },
              {
                name: "skill-command-bridge.ts",
                slug: "skill-command-bridge",
                relation: "sibling",
                desc: "MCP 프롬프트 슬래시 명령을 스킬 시스템에 통합하는 브리지",
              },
              {
                name: "mcp/transports/base.ts",
                slug: "mcp-transport-base",
                relation: "sibling",
                desc: "MCPTransportLayer — 프롬프트/리소스 요청이 전송되는 트랜스포트 계층",
              },
            ]}
          />
        </section>
      </RevealOnScroll>
    </div></div>
  );
}

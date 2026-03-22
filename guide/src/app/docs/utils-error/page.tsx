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

export default function UtilsErrorPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/utils/error.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">Error Classes</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="leaf" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              dbcode 전체에서 사용하는 구조화된 에러 클래스 계층입니다. BaseError를 루트로 하여
              ConfigError, LLMError, ToolError 등 도메인별 에러를 체계적으로 관리합니다.
            </p>
          </div>
        </RevealOnScroll>

        {/* ─── 1. 개요 (Overview) ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>📋</span> 개요
            </h2>
            <div className="text-[14px] text-gray-600 leading-[1.85] mb-8 space-y-3">
              <p>
                <code className="text-cyan-600">BaseError</code>는 모든 dbcode 에러의 공통 기반
                클래스입니다. 표준 <code className="text-cyan-600">Error</code>를 확장하여 에러
                코드(<code className="text-cyan-600">code</code>)와 불변 컨텍스트 객체(
                <code className="text-cyan-600">context</code>)를 함께 전달합니다.
              </p>
              <p>
                이를 상속하는 6개의 도메인 에러 클래스가 있습니다:{" "}
                <code className="text-cyan-600">ConfigError</code>,
                <code className="text-cyan-600">LLMError</code>,{" "}
                <code className="text-cyan-600">ToolError</code>,
                <code className="text-cyan-600">PermissionError</code>,{" "}
                <code className="text-cyan-600">AuthError</code>,
                <code className="text-cyan-600">ConversationError</code>. 각 클래스는 고유한 에러
                코드를 자동으로 설정합니다.
              </p>
              <p>
                타입 가드 함수 <code className="text-cyan-600">isBaseError()</code>를 사용하면
                <code className="text-cyan-600">unknown</code> 타입의 에러를 안전하게 식별하고
                타입을 좁힐 수 있습니다.
              </p>
            </div>

            <MermaidDiagram
              title="에러 클래스 계층 구조"
              titleColor="purple"
              chart={`graph TD
  ERROR["Error<br/><small>JavaScript 내장</small>"]
  BASE["BaseError<br/><small>code + context</small>"]
  CONFIG["ConfigError<br/><small>CONFIG_ERROR</small>"]
  LLM["LLMError<br/><small>LLM_ERROR</small>"]
  TOOL["ToolError<br/><small>TOOL_ERROR</small>"]
  PERM["PermissionError<br/><small>PERMISSION_ERROR</small>"]
  AUTH["AuthError<br/><small>AUTH_ERROR</small>"]
  CONV["ConversationError<br/><small>CONVERSATION_ERROR</small>"]
  GUARD["isBaseError()<br/><small>타입 가드 함수</small>"]

  ERROR --> BASE
  BASE --> CONFIG
  BASE --> LLM
  BASE --> TOOL
  BASE --> PERM
  BASE --> AUTH
  BASE --> CONV
  GUARD -.->|"instanceof 검사"| BASE

  style BASE fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style ERROR fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style CONFIG fill:#dbeafe,stroke:#3b82f6,color:#1e293b
  style LLM fill:#dbeafe,stroke:#3b82f6,color:#1e293b
  style TOOL fill:#dbeafe,stroke:#3b82f6,color:#1e293b
  style PERM fill:#dbeafe,stroke:#3b82f6,color:#1e293b
  style AUTH fill:#dbeafe,stroke:#3b82f6,color:#1e293b
  style CONV fill:#dbeafe,stroke:#3b82f6,color:#1e293b
  style GUARD fill:#fef3c7,stroke:#f59e0b,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>설계 원칙:</strong> 모든 에러는 <code>code</code>로 프로그래밍 방식 구분이
              가능하고,
              <code>context</code>에 디버깅 정보를 담습니다. context는 <code>Object.freeze()</code>
              로 불변 처리되어 실수로 변경하는 것을 방지합니다.
            </Callout>
          </section>
        </RevealOnScroll>

        {/* ─── 2. 레퍼런스 (Reference) ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>📖</span> 레퍼런스
            </h2>

            {/* BaseError class */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              class BaseError extends Error
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              모든 dbcode 에러의 기본 클래스입니다. 에러 코드와 불변 컨텍스트 객체를 함께 담습니다.
            </p>

            {/* Constructor */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">constructor</h4>
            <CodeBlock>
              <span className="kw">constructor</span>(<span className="prop">message</span>:{" "}
              <span className="type">string</span>, <span className="prop">code</span>:{" "}
              <span className="type">string</span>, <span className="prop">context</span>?:{" "}
              <span className="type">Record&lt;string, unknown&gt;</span>)
            </CodeBlock>
            <ParamTable
              params={[
                {
                  name: "message",
                  type: "string",
                  required: true,
                  desc: "에러 메시지 (사람이 읽을 수 있는 설명)",
                },
                {
                  name: "code",
                  type: "string",
                  required: true,
                  desc: "에러 코드 문자열 (프로그래밍 방식으로 에러 종류 구분)",
                },
                {
                  name: "context",
                  type: "Record<string, unknown>",
                  required: false,
                  desc: "에러 발생 맥락 정보 (기본값: {})",
                },
              ]}
            />

            {/* Properties */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">속성 (Properties)</h4>
            <ParamTable
              params={[
                {
                  name: "code",
                  type: "readonly string",
                  required: true,
                  desc: '에러 종류를 식별하는 코드 (예: "CONFIG_ERROR")',
                },
                {
                  name: "context",
                  type: "Readonly<Record<string, unknown>>",
                  required: true,
                  desc: "에러 발생 맥락을 담는 불변 객체",
                },
                {
                  name: "name",
                  type: "string",
                  required: true,
                  desc: "클래스 이름 (스택 트레이스에서 구분용)",
                },
              ]}
            />

            {/* withContext */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">withContext(extra)</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              기존 에러에 추가 컨텍스트를 덧붙인 새로운 에러를 생성합니다. 원본 에러는 변경하지
              않습니다(불변 패턴).
            </p>
            <CodeBlock>
              <span className="fn">withContext</span>(<span className="prop">extra</span>:{" "}
              <span className="type">Record&lt;string, unknown&gt;</span>):{" "}
              <span className="type">BaseError</span>
            </CodeBlock>
            <ParamTable
              params={[
                {
                  name: "extra",
                  type: "Record<string, unknown>",
                  required: true,
                  desc: "기존 context에 합칠 추가 정보",
                },
              ]}
            />

            {/* Domain Error Classes */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              도메인 에러 클래스
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              각 도메인 에러 클래스는 BaseError를 상속하며, 고유한 에러 코드를 자동 설정합니다. 모두
              동일한 시그니처를 사용합니다:
            </p>
            <CodeBlock>
              <span className="kw">constructor</span>(<span className="prop">message</span>:{" "}
              <span className="type">string</span>, <span className="prop">context</span>?:{" "}
              <span className="type">Record&lt;string, unknown&gt;</span>)
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">ConfigError</strong> &mdash; 설정 로딩/유효성 검사
                실패 (코드: <code className="text-cyan-600">CONFIG_ERROR</code>)
              </p>
              <p>
                <strong className="text-gray-900">LLMError</strong> &mdash; LLM 클라이언트 통신 에러
                (코드: <code className="text-cyan-600">LLM_ERROR</code>)
              </p>
              <p>
                <strong className="text-gray-900">ToolError</strong> &mdash; 도구 실행 에러 (코드:{" "}
                <code className="text-cyan-600">TOOL_ERROR</code>)
              </p>
              <p>
                <strong className="text-gray-900">PermissionError</strong> &mdash; 권한 거부 에러
                (코드: <code className="text-cyan-600">PERMISSION_ERROR</code>)
              </p>
              <p>
                <strong className="text-gray-900">AuthError</strong> &mdash; 인증 에러 (코드:{" "}
                <code className="text-cyan-600">AUTH_ERROR</code>)
              </p>
              <p>
                <strong className="text-gray-900">ConversationError</strong> &mdash; 대화 상태 에러
                (코드: <code className="text-cyan-600">CONVERSATION_ERROR</code>)
              </p>
            </div>

            {/* isBaseError */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              isBaseError(error)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              타입 가드 함수입니다. unknown 타입의 에러가 BaseError인지 확인하며, 조건문 안에서
              자동으로 타입이 좁혀집니다.
            </p>
            <CodeBlock>
              <span className="kw">function</span> <span className="fn">isBaseError</span>(
              <span className="prop">error</span>: <span className="type">unknown</span>):{" "}
              <span className="prop">error</span> <span className="kw">is</span>{" "}
              <span className="type">BaseError</span>
            </CodeBlock>

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                <code className="text-cyan-600">context</code>는{" "}
                <code className="text-cyan-600">Object.freeze()</code>로 불변 처리됩니다. 생성 후
                context를 수정하려 하면 에러가 발생합니다.
              </li>
              <li>
                <code className="text-cyan-600">withContext()</code>는 원본을 수정하지 않고 새
                인스턴스를 반환합니다. 반환값을 사용하지 않으면 추가 컨텍스트가 유실됩니다.
              </li>
              <li>
                <code className="text-cyan-600">this.name</code>은{" "}
                <code className="text-cyan-600">this.constructor.name</code>으로 설정됩니다. 코드
                번들러(uglify 등)로 이름이 변경되면 스택 트레이스에서 다른 이름이 표시될 수
                있습니다.
              </li>
            </ul>
          </section>
        </RevealOnScroll>

        {/* ─── 3. 사용법 (Usage) ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>🚀</span> 사용법
            </h2>

            {/* 기본 사용법 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              기본 사용법 &mdash; 도메인 에러 발생
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              각 도메인 에러 클래스는 메시지와 선택적 컨텍스트를 받아 생성합니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 설정 에러 — 필수 환경 변수 누락"}</span>
              {"\n"}
              <span className="kw">throw new</span> <span className="fn">ConfigError</span>(
              <span className="str">&quot;API key가 설정되지 않았습니다&quot;</span>, {"{"}
              {"\n"}
              {"  "}
              <span className="prop">envVar</span>:{" "}
              <span className="str">&quot;OPENAI_API_KEY&quot;</span>,{"\n"}
              {"}"});
              {"\n"}
              {"\n"}
              <span className="cm">{"// LLM 에러 — API 호출 실패"}</span>
              {"\n"}
              <span className="kw">throw new</span> <span className="fn">LLMError</span>(
              <span className="str">&quot;API 호출 시간 초과&quot;</span>, {"{"}
              {"\n"}
              {"  "}
              <span className="prop">model</span>: <span className="str">&quot;gpt-4&quot;</span>,
              {"\n"}
              {"  "}
              <span className="prop">timeoutMs</span>: <span className="num">30000</span>,{"\n"}
              {"}"});
              {"\n"}
              {"\n"}
              <span className="cm">{"// 도구 에러 — 파일 읽기 실패"}</span>
              {"\n"}
              <span className="kw">throw new</span> <span className="fn">ToolError</span>(
              <span className="str">&quot;파일을 찾을 수 없습니다&quot;</span>, {"{"}
              {"\n"}
              {"  "}
              <span className="prop">path</span>:{" "}
              <span className="str">&quot;/src/missing.ts&quot;</span>,{"\n"}
              {"}"});
            </CodeBlock>

            {/* 타입 가드 사용 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              타입 가드 &mdash; isBaseError()로 안전한 에러 처리
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">catch</code> 블록에서{" "}
              <code className="text-cyan-600">unknown</code> 타입의 에러를 안전하게 처리할 수
              있습니다.
            </p>
            <CodeBlock>
              <span className="kw">try</span> {"{"}
              {"\n"}
              {"  "}
              <span className="kw">await</span> <span className="fn">callLLM</span>(
              <span className="prop">messages</span>);
              {"\n"}
              {"}"} <span className="kw">catch</span> (<span className="prop">error</span>) {"{"}
              {"\n"}
              {"  "}
              <span className="kw">if</span> (<span className="fn">isBaseError</span>(
              <span className="prop">error</span>)) {"{"}
              {"\n"}
              {"    "}
              <span className="cm">{"// error는 BaseError로 타입이 좁혀짐"}</span>
              {"\n"}
              {"    "}
              <span className="fn">console</span>.<span className="fn">log</span>(
              <span className="prop">error</span>.<span className="prop">code</span>);{" "}
              <span className="cm">{'// "LLM_ERROR"'}</span>
              {"\n"}
              {"    "}
              <span className="fn">console</span>.<span className="fn">log</span>(
              <span className="prop">error</span>.<span className="prop">context</span>);{" "}
              <span className="cm">{'// { model: "gpt-4" }'}</span>
              {"\n"}
              {"  }"} <span className="kw">else</span> {"{"}
              {"\n"}
              {"    "}
              <span className="cm">{"// 일반 Error 또는 기타 예외"}</span>
              {"\n"}
              {"    "}
              <span className="kw">throw</span> <span className="prop">error</span>;{"\n"}
              {"  }"}
              {"\n"}
              {"}"}
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> <code>isBaseError()</code>는 <code>instanceof BaseError</code>
              를 사용합니다. 다른 패키지에서 별도로 번들된 BaseError 클래스는 같은 코드라도 다른
              클래스로 인식되어
              <code>false</code>를 반환할 수 있습니다.
            </Callout>

            {/* withContext 사용법 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; withContext()로 에러 보강
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              기존 에러에 추가 정보를 덧붙여 새 에러를 생성합니다. 원본은 불변이므로 안전합니다.
            </p>
            <CodeBlock>
              <span className="kw">const</span> <span className="prop">err</span> ={" "}
              <span className="kw">new</span> <span className="fn">BaseError</span>(
              <span className="str">&quot;실패&quot;</span>,{" "}
              <span className="str">&quot;SOME_ERROR&quot;</span>, {"{"}{" "}
              <span className="prop">step</span>: <span className="num">1</span> {"}"});
              {"\n"}
              <span className="kw">const</span> <span className="prop">enriched</span> ={" "}
              <span className="prop">err</span>.<span className="fn">withContext</span>({"{"}{" "}
              <span className="prop">userId</span>: <span className="str">&quot;abc&quot;</span>{" "}
              {"}"});
              {"\n"}
              {"\n"}
              <span className="cm">{'// enriched.context → { step: 1, userId: "abc" }'}</span>
              {"\n"}
              <span className="cm">{"// err.context → { step: 1 }  (원본 불변)"}</span>
            </CodeBlock>

            <Callout type="tip" icon="*">
              <strong>팁:</strong> <code>withContext()</code>는 에러를 catch한 후 상위 레이어에서
              추가 정보(userId, requestId 등)를 덧붙여 다시 throw할 때 유용합니다.
            </Callout>
          </section>
        </RevealOnScroll>

        {/* ─── 4. 내부 구현 (Internals) ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>⚙️</span> 내부 구현
            </h2>

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              에러 생성 흐름
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              도메인 에러는 BaseError의 constructor를 호출하면서 고유 코드를 자동으로 전달합니다.
              context는 <code className="text-cyan-600">Object.freeze()</code>로 즉시 동결됩니다.
            </p>

            <MermaidDiagram
              title="에러 생성 흐름"
              titleColor="purple"
              chart={`sequenceDiagram
  participant Caller as 호출자
  participant Domain as 도메인 에러<br/>(ConfigError 등)
  participant Base as BaseError
  participant JS as Error (내장)

  Caller->>Domain: new ConfigError(msg, ctx)
  Domain->>Base: super(msg, "CONFIG_ERROR", ctx)
  Base->>JS: super(msg)
  Base->>Base: this.name = "ConfigError"
  Base->>Base: this.code = "CONFIG_ERROR"
  Base->>Base: Object.freeze({...ctx})
  Base-->>Caller: ConfigError 인스턴스`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              핵심 코드 분석
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              BaseError constructor의 핵심 로직입니다.
            </p>
            <CodeBlock>
              <span className="kw">constructor</span>(<span className="prop">message</span>:{" "}
              <span className="type">string</span>, <span className="prop">code</span>:{" "}
              <span className="type">string</span>, <span className="prop">context</span>:{" "}
              <span className="type">Record&lt;string, unknown&gt;</span> = {"{}"}) {"{"}
              {"\n"}
              {"  "}
              <span className="kw">super</span>(<span className="prop">message</span>);
              {"\n"}
              {"  "}
              <span className="cm">
                {"// [1] 클래스 이름으로 설정 → 스택 트레이스에서 구분 가능"}
              </span>
              {"\n"}
              {"  "}
              <span className="kw">this</span>.<span className="prop">name</span> ={" "}
              <span className="kw">this</span>.<span className="prop">constructor</span>.
              <span className="prop">name</span>;{"\n"}
              {"  "}
              <span className="cm">{"// [2] 에러 코드 저장"}</span>
              {"\n"}
              {"  "}
              <span className="kw">this</span>.<span className="prop">code</span> ={" "}
              <span className="prop">code</span>;{"\n"}
              {"  "}
              <span className="cm">{"// [3] 스프레드 복사 후 동결 → 불변 보장"}</span>
              {"\n"}
              {"  "}
              <span className="kw">this</span>.<span className="prop">context</span> ={" "}
              <span className="fn">Object</span>.<span className="fn">freeze</span>({"{"} ...
              <span className="prop">context</span> {"}"});
              {"\n"}
              {"}"}
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">[1]</strong> <code>this.constructor.name</code>을
                사용하여 하위 클래스에서도 올바른 이름이 설정됩니다. ConfigError 인스턴스의 name은
                &quot;ConfigError&quot;가 됩니다.
              </p>
              <p>
                <strong className="text-gray-900">[2]</strong> code는 readonly로 선언되어 생성 후
                변경할 수 없습니다.
              </p>
              <p>
                <strong className="text-gray-900">[3]</strong> 스프레드 연산자로 얕은 복사를 먼저
                수행한 뒤 <code>Object.freeze()</code>로 동결합니다. 원본 context 객체의 변경이
                에러에 영향을 주지 않습니다.
              </p>
            </div>

            <DeepDive title="withContext()가 새 인스턴스를 반환하는 이유">
              <p className="mb-3">
                에러 객체의 불변성을 지키기 위해{" "}
                <code className="text-cyan-600">withContext()</code>는 기존 인스턴스를 수정하지 않고
                새로운 BaseError를 생성합니다.
              </p>
              <CodeBlock>
                <span className="fn">withContext</span>(<span className="prop">extra</span>:{" "}
                <span className="type">Record&lt;string, unknown&gt;</span>):{" "}
                <span className="type">BaseError</span> {"{"}
                {"\n"}
                {"  "}
                <span className="kw">return new</span> <span className="fn">BaseError</span>(
                <span className="kw">this</span>.<span className="prop">message</span>,{" "}
                <span className="kw">this</span>.<span className="prop">code</span>, {"{"}
                {"\n"}
                {"    "}...<span className="kw">this</span>.<span className="prop">context</span>,
                {"\n"}
                {"    "}...<span className="prop">extra</span>,{"\n"}
                {"  "}
                {"}"});
                {"\n"}
                {"}"}
              </CodeBlock>
              <p className="mt-3 text-amber-600">
                주의: 반환 타입이 항상 <code>BaseError</code>입니다. 하위 클래스(ConfigError 등)에서
                호출해도 BaseError 인스턴스가 반환됩니다. 하위 클래스 타입을 유지하려면 직접 새
                인스턴스를 생성하세요.
              </p>
            </DeepDive>
          </section>
        </RevealOnScroll>

        {/* ─── 5. 트러블슈팅 (Troubleshooting) ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>🔧</span> 트러블슈팅
            </h2>

            {/* FAQ 1 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;isBaseError()가 false를 반환해요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                <code className="text-cyan-600">instanceof</code> 검사를 사용하므로, 다른 패키지에서
                별도로 번들된 BaseError와는 호환되지 않습니다. monorepo 환경에서 같은{" "}
                <code className="text-cyan-600">error.ts</code>를 여러 패키지가 각각 번들하면 이
                문제가 발생합니다.
              </p>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                해결: 에러 패키지를 공유 의존성으로 설정하거나,
                <code className="text-cyan-600">error.code</code> 속성 존재 여부로 직접 판단하세요.
              </p>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;context를 수정하려는데 에러가 발생합니다&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">context</code>는{" "}
                <code className="text-cyan-600">Object.freeze()</code>로 불변 처리되어 있습니다.
                추가 정보를 덧붙이려면
                <code className="text-cyan-600">withContext()</code>로 새 인스턴스를 생성하세요.
              </p>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;스택 트레이스에서 에러 이름이 이상하게 나와요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                코드 번들러(Terser, esbuild minify 등)가 클래스 이름을 변경(mangling)하면
                <code className="text-cyan-600">this.constructor.name</code>이 원래 이름 대신 짧은
                이름(a, b 등)이 됩니다. 빌드 설정에서 클래스 이름 보존(keep_classnames) 옵션을
                확인하세요.
              </p>
            </div>
          </section>
        </RevealOnScroll>

        {/* ─── 6. 관련 문서 (See Also) ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>🔗</span> 관련 문서
            </h2>
            <SeeAlso
              items={[
                {
                  name: "recovery-executor.ts",
                  slug: "recovery-executor",
                  relation: "parent",
                  desc: "에러 유형별 복구 전략을 실행할 때 BaseError.code로 에러를 분류합니다",
                },
                {
                  name: "logger.ts",
                  slug: "utils-logger",
                  relation: "sibling",
                  desc: "에러 로깅 시 context 정보를 구조화된 JSON으로 기록합니다",
                },
                {
                  name: "token-manager.ts",
                  slug: "token-manager-auth",
                  relation: "parent",
                  desc: "토큰이 없을 때 AuthError를 발생시킵니다",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}

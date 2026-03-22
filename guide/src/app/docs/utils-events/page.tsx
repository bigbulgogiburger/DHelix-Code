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

export default function UtilsEventsPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}><div className="center-narrow">
      {/* ─── Header ─── */}
      <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <FilePath path="src/utils/events.ts" />
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
            <span className="text-gray-900">
              AppEventEmitter
            </span>
          </h1>
          <div className="flex items-center gap-3 mb-5">
            <LayerBadge layer="leaf" />
          </div>
          <p className="text-[16px] text-gray-600 leading-relaxed">
            mitt 기반 타입 안전 이벤트 시스템입니다. 앱 전체에서 느슨한 결합(loose coupling)으로
            LLM 스트리밍, 도구 실행, 에이전트 라이프사이클 등의 이벤트를 발행/구독합니다.
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
              <code className="text-cyan-600">AppEventEmitter</code>는 mitt 라이브러리를 사용한
              타입 안전 이벤트 에미터입니다. Node.js의 EventEmitter보다 가볍고,
              TypeScript의 타입 시스템을 활용하여 이벤트명과 페이로드 타입을 컴파일 타임에 검증합니다.
            </p>
            <p>
              10개 카테고리, 30개 이상의 이벤트 타입이 정의되어 있으며 UI 컴포넌트(Ink)와
              Core 로직 사이의 통신에 핵심적인 역할을 합니다. 새 이벤트를 추가하려면
              <code className="text-cyan-600">AppEvents</code> 타입에 정의를 추가하면 됩니다.
            </p>
            <p>
              메모리 누수 방지를 위한 <code className="text-cyan-600">checkListenerLeaks()</code>
              함수도 제공하며, 단일 이벤트 타입에 리스너가 20개를 초과하면 경고를 출력합니다.
            </p>
          </div>

          <MermaidDiagram
            title="이벤트 시스템 아키텍처 위치"
            titleColor="purple"
            chart={`graph TD
  CLI["CLI Layer<br/><small>Ink Components + Hooks</small>"]
  CORE["Core Layer<br/><small>Agent Loop, Context Manager</small>"]
  INFRA["Infrastructure<br/><small>LLM Client, Tools</small>"]
  EVENTS["AppEventEmitter<br/><small>events.ts — mitt 기반</small>"]

  INFRA -->|"llm:*, tool:*"| EVENTS
  CORE -->|"agent:*, context:*"| EVENTS
  EVENTS -->|"구독"| CLI
  EVENTS -->|"구독"| CORE

  style EVENTS fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style CLI fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style CORE fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style INFRA fill:#e0e7ff,stroke:#64748b,color:#1e293b`}
          />

          <Callout type="info" icon="💡">
            <strong>비유:</strong> AppEventEmitter는 방송국의 라디오 주파수처럼 작동합니다.
            LLM 클라이언트가 &quot;llm:text-delta&quot; 채널로 텍스트를 방송하면,
            UI 컴포넌트가 해당 채널을 수신하여 화면에 실시간으로 표시합니다.
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 2. 레퍼런스 (Reference) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>📖</span> 레퍼런스
          </h2>

          {/* AppEvents type */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            type AppEvents
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            앱 전체 이벤트 타입 정의입니다. Record&lt;이벤트명, 페이로드 타입&gt; 형태로
            모든 이벤트를 엄격하게 타이핑합니다.
          </p>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
            <p><strong className="text-indigo-600">llm:*</strong> &mdash; LLM 스트리밍 관련 (start, text-delta, tool-delta, complete, usage, thinking-delta, error, cache-stats)</p>
            <p><strong className="text-indigo-600">agent:*</strong> &mdash; 에이전트 루프 라이프사이클 (iteration, assistant-message, usage-update, complete, retry, tools-executing, tools-done)</p>
            <p><strong className="text-indigo-600">tool:*</strong> &mdash; 도구 실행 (start, complete, output-delta)</p>
            <p><strong className="text-indigo-600">context:*</strong> &mdash; 컨텍스트 압축 (pre-compact, post-compact)</p>
            <p><strong className="text-indigo-600">conversation:*</strong> &mdash; 대화 상태 (message, clear)</p>
            <p><strong className="text-indigo-600">input:*</strong> &mdash; 사용자 입력 (submit, abort)</p>
            <p><strong className="text-indigo-600">lint:*</strong> &mdash; 자동 린트 (request)</p>
            <p><strong className="text-indigo-600">checkpoint:*</strong> &mdash; 파일 체크포인트 (created, restored)</p>
            <p><strong className="text-indigo-600">voice:*</strong> &mdash; 음성 입력 (toggle)</p>
            <p><strong className="text-indigo-600">permission:*</strong> &mdash; 권한 모드 (mode-change)</p>
            <p><strong className="text-indigo-600">ask_user:*</strong> &mdash; 사용자 질문 (prompt, response)</p>
          </div>

          {/* AppEventEmitter type */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            type AppEventEmitter
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            mitt&lt;AppEvents&gt;의 반환 타입입니다. on(), off(), emit() 메서드를 제공합니다.
          </p>
          <CodeBlock>
            <span className="kw">type</span> <span className="type">AppEventEmitter</span> = <span className="type">ReturnType</span>&lt;<span className="kw">typeof</span> <span className="fn">mitt</span>&lt;<span className="type">AppEvents</span>&gt;&gt;;
          </CodeBlock>

          {/* createEventEmitter */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            createEventEmitter()
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            새로운 타입 안전 이벤트 에미터를 생성합니다.
          </p>
          <CodeBlock>
            <span className="kw">function</span> <span className="fn">createEventEmitter</span>(): <span className="type">AppEventEmitter</span>
          </CodeBlock>

          {/* checkListenerLeaks */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            checkListenerLeaks(emitter, threshold?)
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            모든 이벤트 타입의 리스너 수를 검사하여 메모리 누수를 감지합니다.
            특정 이벤트 타입에 리스너가 threshold를 초과하면 stderr에 경고를 출력합니다.
          </p>
          <CodeBlock>
            <span className="kw">function</span> <span className="fn">checkListenerLeaks</span>(<span className="prop">emitter</span>: <span className="type">AppEventEmitter</span>, <span className="prop">threshold</span>?: <span className="type">number</span>): <span className="type">number</span>
          </CodeBlock>
          <ParamTable
            params={[
              { name: "emitter", type: "AppEventEmitter", required: true, desc: "검사할 이벤트 에미터" },
              { name: "threshold", type: "number", required: false, desc: "경고 기준값 (기본값: 20)" },
            ]}
          />

          {/* LISTENER_WARN_THRESHOLD */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            LISTENER_WARN_THRESHOLD
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            리스너 메모리 누수 경고 임계값 상수입니다. 기본값은 20입니다.
          </p>
          <CodeBlock>
            <span className="kw">const</span> <span className="prop">LISTENER_WARN_THRESHOLD</span> = <span className="num">20</span>;
          </CodeBlock>

          {/* Caveats */}
          <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
          <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
            <li>
              mitt는 비동기 이벤트를 지원하지 않습니다. 핸들러에서 async/await를 사용해도
              mitt는 Promise 완료를 기다리지 않습니다.
            </li>
            <li>
              <code className="text-cyan-600">off()</code>를 호출하지 않으면 리스너가 누적되어
              메모리 누수가 발생합니다. React 컴포넌트에서는 반드시 cleanup에서 해제하세요.
            </li>
            <li>
              서브에이전트 이벤트는 <code className="text-cyan-600">subagentId</code>,
              <code className="text-cyan-600">subagentType</code> 필드로 구분됩니다.
              이 필드가 없으면 메인 에이전트의 이벤트입니다.
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
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>기본 사용법 &mdash; 이벤트 발행/구독</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">createEventEmitter()</code>로 에미터를 생성하고,
            <code className="text-cyan-600">on()</code>으로 구독, <code className="text-cyan-600">emit()</code>으로 발행합니다.
          </p>
          <CodeBlock>
            <span className="kw">import</span> {"{"} <span className="prop">createEventEmitter</span> {"}"} <span className="kw">from</span> <span className="str">&quot;./utils/events.js&quot;</span>;
            {"\n"}
            {"\n"}<span className="kw">const</span> <span className="prop">events</span> = <span className="fn">createEventEmitter</span>();
            {"\n"}
            {"\n"}<span className="cm">{"// 구독: 도구 실행 시작 이벤트"}</span>
            {"\n"}<span className="prop">events</span>.<span className="fn">on</span>(<span className="str">&quot;tool:start&quot;</span>, ({"{"} <span className="prop">name</span>, <span className="prop">id</span> {"}"}) =&gt; {"{"}
            {"\n"}{"  "}<span className="fn">console</span>.<span className="fn">log</span>(<span className="str">`도구 실행 시작: ${"{"}</span><span className="prop">name</span><span className="str">{"}"}`</span>);
            {"\n"}{"}"});
            {"\n"}
            {"\n"}<span className="cm">{"// 발행: 타입 안전하게 페이로드 전달"}</span>
            {"\n"}<span className="prop">events</span>.<span className="fn">emit</span>(<span className="str">&quot;tool:start&quot;</span>, {"{"} <span className="prop">name</span>: <span className="str">&quot;file_read&quot;</span>, <span className="prop">id</span>: <span className="str">&quot;123&quot;</span> {"}"});
          </CodeBlock>

          {/* React 컴포넌트에서 사용 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>React(Ink) 컴포넌트에서 사용</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            useEffect cleanup에서 반드시 리스너를 해제하세요.
          </p>
          <CodeBlock>
            <span className="fn">useEffect</span>(() =&gt; {"{"}
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">handler</span> = ({"{"} <span className="prop">text</span> {"}"}: {"{"} <span className="prop">text</span>: <span className="type">string</span> {"}"}) =&gt; {"{"}
            {"\n"}{"    "}<span className="fn">setOutput</span>(<span className="prop">prev</span> =&gt; <span className="prop">prev</span> + <span className="prop">text</span>);
            {"\n"}{"  "}{"}"};
            {"\n"}
            {"\n"}{"  "}<span className="prop">events</span>.<span className="fn">on</span>(<span className="str">&quot;llm:text-delta&quot;</span>, <span className="prop">handler</span>);
            {"\n"}{"  "}<span className="kw">return</span> () =&gt; <span className="prop">events</span>.<span className="fn">off</span>(<span className="str">&quot;llm:text-delta&quot;</span>, <span className="prop">handler</span>);
            {"\n"}{"}"}, [<span className="prop">events</span>]);
          </CodeBlock>

          <Callout type="warn" icon="!">
            <strong>주의:</strong> <code>off()</code>에 전달하는 함수 참조는 <code>on()</code>에 등록한
            것과 정확히 같은 참조여야 합니다. 인라인 화살표 함수를 on()에 직접 전달하면
            off()에서 같은 함수를 참조할 수 없으므로 리스너가 해제되지 않습니다.
          </Callout>

          {/* 메모리 누수 검사 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; 메모리 누수 검사
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">checkListenerLeaks()</code>를 주기적으로 호출하여
            리스너 누수를 조기에 발견할 수 있습니다.
          </p>
          <CodeBlock>
            <span className="kw">import</span> {"{"} <span className="prop">checkListenerLeaks</span> {"}"} <span className="kw">from</span> <span className="str">&quot;./utils/events.js&quot;</span>;
            {"\n"}
            {"\n"}<span className="cm">{"// 가장 많은 리스너를 가진 이벤트의 리스너 수 반환"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">maxCount</span> = <span className="fn">checkListenerLeaks</span>(<span className="prop">events</span>);
            {"\n"}<span className="cm">{"// 20개 초과 시 stderr에 경고 출력:"}</span>
            {"\n"}<span className="cm">{"// [events] Warning: \"llm:text-delta\" has 25 listeners..."}</span>
          </CodeBlock>

          <Callout type="tip" icon="*">
            <strong>팁:</strong> 테스트에서 <code>checkListenerLeaks(emitter, 5)</code>처럼
            낮은 임계값을 설정하면 소규모 누수도 빠르게 발견할 수 있습니다.
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 4. 내부 구현 (Internals) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>⚙️</span> 내부 구현
          </h2>

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>이벤트 발행/구독 흐름</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            mitt의 내부는 Map&lt;이벤트명, 핸들러 배열&gt; 구조입니다.
            emit() 시 해당 이벤트의 모든 핸들러를 동기적으로 호출합니다.
          </p>

          <MermaidDiagram
            title="이벤트 발행/구독 흐름"
            titleColor="purple"
            chart={`sequenceDiagram
  participant Producer as 이벤트 발행자<br/>(LLM Client 등)
  participant Emitter as AppEventEmitter<br/>(mitt)
  participant Consumer1 as UI Component
  participant Consumer2 as Logger

  Consumer1->>Emitter: on("llm:text-delta", handler1)
  Consumer2->>Emitter: on("llm:text-delta", handler2)
  Producer->>Emitter: emit("llm:text-delta", {text})
  Emitter->>Consumer1: handler1({text})
  Emitter->>Consumer2: handler2({text})
  Consumer1->>Emitter: off("llm:text-delta", handler1)`}
          />

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>리스너 누수 검사 로직</h3>
          <CodeBlock>
            <span className="kw">function</span> <span className="fn">checkListenerLeaks</span>(<span className="prop">emitter</span>, <span className="prop">threshold</span> = <span className="num">20</span>): <span className="type">number</span> {"{"}
            {"\n"}{"  "}<span className="kw">let</span> <span className="prop">maxCount</span> = <span className="num">0</span>;
            {"\n"}{"  "}<span className="cm">{"// emitter.all = Map<이벤트명, 핸들러[]>"}</span>
            {"\n"}{"  "}<span className="kw">for</span> (<span className="kw">const</span> [<span className="prop">eventType</span>, <span className="prop">handlers</span>] <span className="kw">of</span> <span className="prop">emitter</span>.<span className="prop">all</span>) {"{"}
            {"\n"}{"    "}<span className="kw">const</span> <span className="prop">count</span> = <span className="prop">handlers</span>?.<span className="prop">length</span> ?? <span className="num">0</span>;
            {"\n"}{"    "}<span className="kw">if</span> (<span className="prop">count</span> {">"} <span className="prop">maxCount</span>) <span className="prop">maxCount</span> = <span className="prop">count</span>;
            {"\n"}{"    "}<span className="kw">if</span> (<span className="prop">count</span> {">"} <span className="prop">threshold</span>) {"{"}
            {"\n"}{"      "}<span className="prop">process</span>.<span className="prop">stderr</span>.<span className="fn">write</span>(<span className="str">`[events] Warning: ...`</span>);
            {"\n"}{"    }"}
            {"\n"}{"  }"}
            {"\n"}{"  "}<span className="kw">return</span> <span className="prop">maxCount</span>;
            {"\n"}{"}"}
          </CodeBlock>

          <DeepDive title="mitt를 선택한 이유">
            <p className="mb-3">
              Node.js의 <code className="text-cyan-600">EventEmitter</code> 대비 mitt의 장점:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-gray-600">
              <li>번들 크기 ~200 bytes (EventEmitter는 Node.js 전용)</li>
              <li>TypeScript 타입 추론이 더 정교함 (제네릭 Map 기반)</li>
              <li>메서드가 3개뿐 (on, off, emit) &mdash; API가 단순</li>
              <li>와일드카드(*) 핸들러로 모든 이벤트를 한 번에 구독 가능</li>
            </ul>
            <p className="mt-3 text-amber-600">
              단점: 비동기 핸들러를 기다리지 않으며, once() 메서드가 없어
              1회성 리스너를 직접 구현해야 합니다.
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
              &quot;이벤트 핸들러가 호출되지 않아요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              이벤트명이 정확히 일치하는지 확인하세요. TypeScript가 타입 검사를 하지만,
              다른 에미터 인스턴스에 등록했을 수 있습니다. 앱 전체에서 동일한
              에미터 인스턴스를 공유하고 있는지 확인하세요.
            </p>
          </div>

          {/* FAQ 2 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;[events] Warning: ... has N listeners 경고가 나와요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              리스너 해제(off)를 빠뜨린 곳이 있습니다. React 컴포넌트가 언마운트될 때
              useEffect의 cleanup 함수에서 off()를 호출하고 있는지 확인하세요.
              특히 컴포넌트가 리렌더링될 때마다 새 핸들러를 등록하면서
              이전 핸들러를 해제하지 않으면 빠르게 누적됩니다.
            </p>
          </div>

          {/* FAQ 3 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;새 이벤트 타입을 추가하고 싶어요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">AppEvents</code> 타입에 새 이벤트를 추가하세요.
              네이밍 컨벤션은 <code className="text-cyan-600">&quot;카테고리:동작&quot;</code> 형식입니다
              (예: <code className="text-cyan-600">&quot;voice:toggle&quot;</code>).
              추가 후 TypeScript가 자동으로 emit/on에서 타입을 검증합니다.
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
                name: "agent-loop.ts",
                slug: "agent-loop",
                relation: "parent",
                desc: "agent:* 이벤트를 발행하고 llm:*/tool:* 이벤트를 조율합니다",
              },
              {
                name: "use-agent-loop.ts",
                slug: "use-agent-loop",
                relation: "parent",
                desc: "React Hook에서 이벤트를 구독하여 UI 상태를 업데이트합니다",
              },
              {
                name: "logger.ts",
                slug: "utils-logger",
                relation: "sibling",
                desc: "이벤트 기반 로깅과 함께 사용되는 구조화된 로거",
              },
            ]}
          />
        </section>
      </RevealOnScroll>
    </div></div>
  );
}

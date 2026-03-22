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

export default function ToolAskUserPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/tools/definitions/ask-user.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">ask_user</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="infra" />
              <span className="text-sm text-gray-500">사용자에게 질문 도구</span>
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              LLM이 사용자에게 직접 질문하거나 확인을 요청할 때 사용하는 도구입니다.
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
                <code className="text-cyan-600">ask_user</code>는 LLM이 작업 중 사용자의 입력이
                필요할 때 질문을 표시하고 응답을 기다리는 도구입니다. 명확하지 않은 요구사항을
                확인하거나, 여러 선택지 중 하나를 고르도록 요청할 때 사용됩니다.
              </p>
              <p>
                이벤트 기반 아키텍처를 사용합니다.{" "}
                <code className="text-cyan-600">&quot;ask_user:prompt&quot;</code> 이벤트로 UI에
                질문을 보내고, <code className="text-cyan-600">&quot;ask_user:response&quot;</code>{" "}
                이벤트로 사용자 응답을 수신합니다. 고유한{" "}
                <code className="text-cyan-600">toolCallId</code>로 질문과 응답을 매칭합니다.
              </p>
              <p>
                권한 수준은 <code className="text-emerald-600">&quot;safe&quot;</code>입니다.
                사용자에게 질문하는 것은 시스템에 영향을 주지 않으므로 안전합니다. 5분(300초)
                타임아웃이 설정되어 사용자가 응답하는 데 충분한 시간을 제공합니다.
              </p>
            </div>

            <MermaidDiagram
              title="ask_user 이벤트 흐름"
              titleColor="purple"
              chart={`graph TD
  LLM["LLM 응답<br/><small>질문이 필요한 상황</small>"]
  EXEC["Tool Executor<br/><small>tools/executor.ts</small>"]
  ASK["ask_user<br/><small>definitions/ask-user.ts</small>"]
  EVENT["EventEmitter<br/><small>ask_user:prompt</small>"]
  UI["CLI UI<br/><small>사용자에게 질문 표시</small>"]
  USER["사용자 입력"]
  RESP["EventEmitter<br/><small>ask_user:response</small>"]

  LLM -->|"도구 호출"| EXEC
  EXEC -->|"execute()"| ASK
  ASK -->|"이벤트 발행"| EVENT
  EVENT --> UI
  UI -->|"응답 입력"| USER
  USER --> RESP
  RESP -->|"toolCallId 매칭"| ASK

  style ASK fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style LLM fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style EXEC fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style EVENT fill:#fef3c7,stroke:#f59e0b,color:#78350f
  style UI fill:#dcfce7,stroke:#10b981,color:#065f46
  style RESP fill:#fef3c7,stroke:#f59e0b,color:#78350f`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> 음식점에서 웨이터가 손님에게 &quot;메인 디시는 스테이크와
              파스타 중 어떤 것으로 하시겠습니까?&quot;라고 묻는 것과 같습니다. LLM(웨이터)이 질문을
              하고, 사용자(손님)가 답하면, LLM이 그에 맞게 작업을 이어갑니다.
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

            {/* paramSchema */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              paramSchema (Zod)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              질문 텍스트와 선택지를 정의하는 입력 매개변수 스키마입니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "question",
                  type: "string",
                  required: true,
                  desc: "사용자에게 표시할 질문 텍스트",
                },
                {
                  name: "choices",
                  type: "string[]",
                  required: false,
                  desc: "선택지 목록 (제공하면 사용자가 선택지 중 하나를 고름)",
                },
              ]}
            />

            {/* ToolDefinition */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              askUserTool (ToolDefinition)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              도구 레지스트리에 등록되는 최종 도구 정의 객체입니다.
            </p>
            <ParamTable
              params={[
                { name: "name", type: '"ask_user"', required: true, desc: "도구 이름 식별자" },
                {
                  name: "permissionLevel",
                  type: '"safe"',
                  required: true,
                  desc: "안전 등급 — 시스템에 영향 없음",
                },
                {
                  name: "timeoutMs",
                  type: "300_000",
                  required: true,
                  desc: "5분 타임아웃 — 사용자 응답 대기 시간",
                },
              ]}
            />

            {/* 이벤트 인터페이스 */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              이벤트 인터페이스
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              질문과 응답은 이벤트 에미터를 통해 UI와 통신합니다.
            </p>

            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">ask_user:prompt (발행)</h4>
            <ParamTable
              params={[
                {
                  name: "toolCallId",
                  type: "string",
                  required: true,
                  desc: "고유 ID — ask_{timestamp} 형식",
                },
                { name: "question", type: "string", required: true, desc: "질문 텍스트" },
                {
                  name: "choices",
                  type: "string[] | undefined",
                  required: false,
                  desc: "선택지 목록",
                },
              ]}
            />

            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">ask_user:response (수신)</h4>
            <ParamTable
              params={[
                {
                  name: "toolCallId",
                  type: "string",
                  required: true,
                  desc: "매칭할 질문의 고유 ID",
                },
                { name: "answer", type: "string", required: true, desc: "사용자의 응답 텍스트" },
              ]}
            />

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                이벤트 에미터가 없는 환경(헤드리스 모드)에서는 폴백으로
                <code className="text-cyan-600">[Question for user] 질문텍스트</code> 형식의
                텍스트를 반환합니다. 이 경우 사용자 응답을 받을 수 없습니다.
              </li>
              <li>
                사용자가 Esc로 취소하면 <code className="text-cyan-600">AbortSignal</code>이
                발동되어
                <code className="text-cyan-600">[User cancelled]</code>이 응답으로 반환됩니다.
              </li>
              <li>
                5분 타임아웃 내에 사용자가 응답하지 않으면 도구 실행이 타임아웃됩니다. 타임아웃은{" "}
                <code className="text-cyan-600">ToolDefinition.timeoutMs</code> 수준에서 처리됩니다.
              </li>
              <li>
                <code className="text-cyan-600">toolCallId</code>로 질문과 응답을 매칭하므로, 여러{" "}
                <code className="text-cyan-600">ask_user</code> 호출이 동시에 진행되어도 안전합니다.
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
              기본 사용법 &mdash; 자유 형식 질문
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              LLM이 추가 정보가 필요할 때 사용자에게 자유 형식 질문을 합니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// LLM이 호출하는 도구 매개변수 예시"}</span>
              {"\n"}
              {"{"}
              {"\n"}
              {"  "}
              <span className="prop">question</span>:{" "}
              <span className="str">&quot;테스트 파일은 어느 디렉토리에 생성할까요?&quot;</span>
              {"\n"}
              {"}"}
            </CodeBlock>

            <p className="text-[13px] text-gray-600 mb-4 mt-4 leading-relaxed">반환되는 결과:</p>
            <CodeBlock>
              <span className="str">User responded: src/__tests__/ 디렉토리에 만들어주세요</span>
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> 이벤트 에미터가 없는 헤드리스 환경에서는 사용자 응답을 받을 수
              없습니다.
              <code>[Question for user] 질문텍스트</code> 형식의 텍스트만 반환됩니다.
            </Callout>

            {/* 선택지 제공 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 선택지 제공
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">choices</code> 매개변수를 사용하면 사용자에게 정해진
              선택지를 제공할 수 있습니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 선택지가 있는 질문"}</span>
              {"\n"}
              {"{"}
              {"\n"}
              {"  "}
              <span className="prop">question</span>:{" "}
              <span className="str">&quot;어떤 테스트 프레임워크를 사용할까요?&quot;</span>,{"\n"}
              {"  "}
              <span className="prop">choices</span>: [
              <span className="str">&quot;vitest&quot;</span>,{" "}
              <span className="str">&quot;jest&quot;</span>,{" "}
              <span className="str">&quot;mocha&quot;</span>]{"\n"}
              {"}"}
            </CodeBlock>

            <DeepDive title="이벤트 기반 통신 상세">
              <p className="mb-3">
                <code className="text-cyan-600">execute()</code> 함수는 Promise를 생성하여 사용자
                응답을 비동기로 대기합니다. 이벤트 흐름은 다음과 같습니다:
              </p>
              <CodeBlock>
                <span className="cm">{"// 1. 고유 ID 생성"}</span>
                {"\n"}
                <span className="kw">const</span> <span className="prop">toolCallId</span> ={" "}
                <span className="str">
                  `ask_${"{"}
                  <span className="fn">Date</span>.<span className="fn">now</span>(){"}"}`
                </span>
                ;{"\n"}
                {"\n"}
                <span className="cm">{"// 2. 응답 리스너 등록"}</span>
                {"\n"}
                <span className="prop">events</span>.<span className="fn">on</span>(
                <span className="str">&quot;ask_user:response&quot;</span>,{" "}
                <span className="prop">onResponse</span>);
                {"\n"}
                {"\n"}
                <span className="cm">{"// 3. UI에 질문 표시 요청"}</span>
                {"\n"}
                <span className="prop">events</span>.<span className="fn">emit</span>(
                <span className="str">&quot;ask_user:prompt&quot;</span>, {"{"}{" "}
                <span className="prop">toolCallId</span>, <span className="prop">question</span>,{" "}
                <span className="prop">choices</span> {"}"});
                {"\n"}
                {"\n"}
                <span className="cm">{"// 4. 응답 수신 시 toolCallId 매칭 후 resolve"}</span>
              </CodeBlock>
              <p className="mt-3 text-gray-600">
                <code className="text-cyan-600">AbortSignal</code>이 발동되면 리스너를 제거하고
                &quot;[User cancelled]&quot;로 resolve합니다. reject가 아닌 resolve를 사용하므로
                에이전트 루프가 중단되지 않고 취소 사실을 LLM에 전달할 수 있습니다.
              </p>
            </DeepDive>
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
              실행 흐름 다이어그램
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">execute()</code> 함수의 전체 실행 흐름입니다. 이벤트
              에미터 유무에 따라 두 가지 경로로 분기됩니다.
            </p>

            <MermaidDiagram
              title="ask_user 실행 흐름"
              titleColor="purple"
              chart={`graph TD
  START(("execute()")) --> CHECK{"events<br/>존재 여부"}
  CHECK -->|"없음"| FALLBACK["폴백 텍스트 반환<br/><small>[Question for user]</small>"]
  CHECK -->|"있음"| ID["toolCallId 생성<br/><small>ask_{timestamp}</small>"]
  ID --> PROMISE["Promise 생성"]
  PROMISE --> LISTEN["응답 리스너 등록<br/><small>ask_user:response</small>"]
  LISTEN --> ABORT["AbortSignal 리스너 등록"]
  ABORT --> EMIT["질문 이벤트 발행<br/><small>ask_user:prompt</small>"]
  EMIT --> WAIT(("사용자 응답<br/>대기..."))
  WAIT -->|"응답 수신"| MATCH{"toolCallId<br/>매칭?"}
  MATCH -->|"매칭"| RESOLVE["resolve(answer)"]
  WAIT -->|"Esc 취소"| CANCEL["resolve('[User cancelled]')"]
  RESOLVE --> RESULT["ToolResult 반환<br/><small>User responded: ...</small>"]
  CANCEL --> RESULT

  style START fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style CHECK fill:#fef3c7,stroke:#f59e0b,color:#78350f
  style EMIT fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style WAIT fill:#fef3c7,stroke:#f59e0b,color:#78350f
  style RESOLVE fill:#dcfce7,stroke:#10b981,color:#065f46
  style CANCEL fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style RESULT fill:#dcfce7,stroke:#10b981,color:#065f46`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              핵심 코드 분석
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              Promise와 이벤트 리스너를 조합한 비동기 대기 패턴입니다.
            </p>
            <CodeBlock>
              <span className="kw">const</span> <span className="prop">answer</span> ={" "}
              <span className="kw">await new</span> <span className="type">Promise</span>&lt;
              <span className="type">string</span>&gt;((<span className="prop">resolve</span>) =&gt;{" "}
              {"{"}
              {"\n"}
              {"  "}
              <span className="cm">{"// [1] 응답 이벤트 리스너"}</span>
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">onResponse</span> = (
              <span className="prop">data</span>) =&gt; {"{"}
              {"\n"}
              {"    "}
              <span className="kw">if</span> (<span className="prop">data</span>.
              <span className="prop">toolCallId</span> === <span className="prop">toolCallId</span>){" "}
              {"{"}
              {"\n"}
              {"      "}
              <span className="cm">{"// [2] ID 매칭 시 리스너 해제 + resolve"}</span>
              {"\n"}
              {"      "}
              <span className="prop">events</span>.<span className="fn">off</span>(
              <span className="str">&quot;ask_user:response&quot;</span>,{" "}
              <span className="prop">onResponse</span>);
              {"\n"}
              {"      "}
              <span className="fn">resolve</span>(<span className="prop">data</span>.
              <span className="prop">answer</span>);
              {"\n"}
              {"    "}
              {"}"}
              {"\n"}
              {"  "}
              {"}"};{"\n"}
              {"  "}
              <span className="prop">events</span>.<span className="fn">on</span>(
              <span className="str">&quot;ask_user:response&quot;</span>,{" "}
              <span className="prop">onResponse</span>);
              {"\n"}
              {"\n"}
              {"  "}
              <span className="cm">{"// [3] 취소 처리"}</span>
              {"\n"}
              {"  "}
              <span className="prop">abortSignal</span>.<span className="fn">addEventListener</span>
              (<span className="str">&quot;abort&quot;</span>, () =&gt; {"{"}
              {"\n"}
              {"    "}
              <span className="prop">events</span>.<span className="fn">off</span>(
              <span className="str">&quot;ask_user:response&quot;</span>,{" "}
              <span className="prop">onResponse</span>);
              {"\n"}
              {"    "}
              <span className="fn">resolve</span>(
              <span className="str">&quot;[User cancelled]&quot;</span>);
              {"\n"}
              {"  "}
              {"}"});
              {"\n"}
              {"\n"}
              {"  "}
              <span className="cm">{"// [4] UI에 질문 발행"}</span>
              {"\n"}
              {"  "}
              <span className="prop">events</span>.<span className="fn">emit</span>(
              <span className="str">&quot;ask_user:prompt&quot;</span>, {"{"}{" "}
              <span className="prop">toolCallId</span>, <span className="prop">question</span> {"}"}
              );
              {"\n"}
              {"}"});
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">[1]</strong>{" "}
                <code className="text-cyan-600">ask_user:response</code> 이벤트를 리슨합니다. 여러
                질문이 동시에 진행될 수 있으므로 ID로 필터링합니다.
              </p>
              <p>
                <strong className="text-gray-900">[2]</strong> toolCallId가 매칭되면 리스너를
                해제하고 Promise를 resolve합니다. 리스너 해제로 메모리 누수를 방지합니다.
              </p>
              <p>
                <strong className="text-gray-900">[3]</strong> 사용자가 Esc를 누르면 AbortSignal이
                발동되어 &quot;[User cancelled]&quot;로 resolve합니다. reject가 아닌 resolve를
                사용하는 점이 핵심입니다.
              </p>
              <p>
                <strong className="text-gray-900">[4]</strong> 리스너 등록 후에 이벤트를 발행합니다.
                순서가 바뀌면 응답을 놓칠 수 있습니다.
              </p>
            </div>
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
                &quot;질문이 표시되지 않아요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">context.events</code>가{" "}
                <code className="text-cyan-600">undefined</code>인지 확인하세요. 이벤트 에미터가
                없으면 폴백 모드로 동작하여
                <code className="text-cyan-600">[Question for user]</code> 텍스트만 반환합니다. Ink
                CLI 컴포넌트가 <code className="text-cyan-600">ask_user:prompt</code> 이벤트를
                올바르게 처리하고 있는지 확인하세요.
              </p>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;사용자 응답이 다른 질문에 전달돼요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">toolCallId</code>가 올바르게 매칭되고 있는지
                확인하세요. UI 측에서 <code className="text-cyan-600">ask_user:response</code>{" "}
                이벤트에 원래 질문의 <code className="text-cyan-600">toolCallId</code>를 포함해야
                합니다.
              </p>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;질문 후 5분이 지나면 어떻게 되나요?&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">timeoutMs: 300_000</code>(5분)이 설정되어 있습니다.
                5분 내에 사용자가 응답하지 않으면 도구 실행이 타임아웃 처리됩니다. 대부분의 경우
                사용자가 5분 내에 응답하므로 충분한 시간이지만, 더 긴 대기가 필요하면{" "}
                <code className="text-cyan-600">timeoutMs</code>를 조정해야 합니다.
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
                  name: "tool-registry.ts",
                  slug: "tool-registry",
                  relation: "parent",
                  desc: "ask_user를 포함한 모든 도구를 등록하고 관리하는 레지스트리",
                },
                {
                  name: "agent-loop.ts",
                  slug: "agent-loop",
                  relation: "parent",
                  desc: "ask_user의 응답을 LLM에 전달하는 메인 에이전트 루프",
                },
                {
                  name: "permission-manager.ts",
                  slug: "permission-manager",
                  relation: "sibling",
                  desc: "도구의 권한 수준(safe/confirm/danger)을 관리하는 모듈",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}

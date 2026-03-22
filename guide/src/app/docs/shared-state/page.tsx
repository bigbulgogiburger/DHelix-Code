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

export default function SharedStatePage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/subagents/shared-state.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">SharedAgentState</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="infra" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              서브에이전트 간 통신과 데이터 공유를 위한 워커 간 공유 상태 모듈입니다.
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
                <code className="text-cyan-600">SharedAgentState</code>는 여러 서브에이전트가 병렬로
                실행될 때 서로 데이터를 주고받거나 작업 진행 상황을 공유하기 위한 세 가지 통신
                메커니즘을 제공합니다.
              </p>
              <p>
                첫째, <strong>키-값 저장소(Key-Value Store)</strong>로 에이전트 간 데이터를
                공유합니다. 둘째, <strong>메시지 큐(Message Queue)</strong>로 에이전트 간 메시지를
                전달하거나 브로드캐스트합니다. 셋째, <strong>진행도 추적(Progress Tracking)</strong>
                으로 각 에이전트의 작업 진행률을 모니터링합니다.
              </p>
              <p>
                모든 자료구조는 동기적(synchronous) Map 기반으로, Node.js의 단일 스레드 환경에서
                Promise 인터리빙에 안전합니다. 별도의 락(lock)이 필요 없는 설계입니다.
              </p>
            </div>

            <MermaidDiagram
              title="SharedAgentState 통신 구조"
              titleColor="purple"
              chart={`graph TD
  A1["Agent A"]
  A2["Agent B"]
  A3["Agent C"]
  KV["Key-Value Store<br/><small>set / get / getAll</small>"]
  MQ["Message Queue<br/><small>send / getMessages</small>"]
  PT["Progress Tracker<br/><small>reportProgress / getProgress</small>"]
  SAS["SharedAgentState<br/><small>shared-state.ts</small>"]

  A1 -->|"set(key, value)"| SAS
  A2 -->|"get(key)"| SAS
  A1 -->|"send(message)"| SAS
  A3 -->|"getMessages(id)"| SAS
  A2 -->|"reportProgress()"| SAS

  SAS --- KV
  SAS --- MQ
  SAS --- PT

  style SAS fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style KV fill:#dbeafe,stroke:#3b82f6,color:#1e293b
  style MQ fill:#dcfce7,stroke:#10b981,color:#1e293b
  style PT fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style A1 fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style A2 fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style A3 fill:#e0e7ff,stroke:#64748b,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> 사무실의 공유 화이트보드를 떠올리세요. 아무나 데이터를
              써두고(KV Store), 메모를 남기고(Message Queue), 자기 진행 상황을 표시할 수
              있습니다(Progress Tracker). 다른 팀원은 필요할 때 화이트보드를 확인하면 됩니다.
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

            {/* SharedStateError class */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              class SharedStateError
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              공유 상태 작업 중 발생하는 에러 클래스입니다.
              <code className="text-cyan-600">BaseError</code>를 확장하며 에러 코드
              <code className="text-cyan-600">&quot;SHARED_STATE_ERROR&quot;</code>를 사용합니다.
            </p>
            <CodeBlock>
              <span className="kw">class</span> <span className="type">SharedStateError</span>{" "}
              <span className="kw">extends</span> <span className="type">BaseError</span> {"{"}
              {"\n"}
              {"  "}
              <span className="kw">constructor</span>(<span className="prop">message</span>:{" "}
              <span className="type">string</span>, <span className="prop">context</span>?:{" "}
              <span className="type">Record</span>&lt;<span className="type">string</span>,{" "}
              <span className="type">unknown</span>&gt;)
              {"\n"}
              {"}"}
            </CodeBlock>

            {/* AgentMessage interface */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface AgentMessage
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              에이전트 간에 교환되는 메시지 구조입니다.{" "}
              <code className="text-cyan-600">toAgentId</code>가 undefined이면 브로드캐스트(모든
              에이전트에게 전달)입니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "fromAgentId",
                  type: "string",
                  required: true,
                  desc: "메시지를 보낸 에이전트의 고유 ID",
                },
                {
                  name: "toAgentId",
                  type: "string | undefined",
                  required: false,
                  desc: "수신 에이전트 ID. undefined이면 브로드캐스트",
                },
                {
                  name: "type",
                  type: '"result" | "progress" | "request" | "error"',
                  required: true,
                  desc: "메시지 유형 (결과/진행/요청/에러)",
                },
                { name: "content", type: "string", required: true, desc: "메시지 내용 (텍스트)" },
                {
                  name: "timestamp",
                  type: "number",
                  required: true,
                  desc: "메시지 생성 시각 (Unix 타임스탬프, 밀리초)",
                },
              ]}
            />

            {/* AgentProgress interface */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface AgentProgress
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              개별 에이전트의 진행 상태 정보입니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "progress",
                  type: "number",
                  required: true,
                  desc: "진행률 (0.0 ~ 1.0, 예: 0.5 = 50%)",
                },
                {
                  name: "status",
                  type: "string",
                  required: true,
                  desc: '현재 상태 설명 (예: "파일 분석 중", "완료")',
                },
              ]}
            />

            {/* SharedAgentState interface */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface SharedAgentState
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              에이전트 간 통신을 위한 공유 상태 인터페이스입니다. 키-값 저장소, 메시징, 진행도 추적,
              라이프사이클 관리를 포함합니다.
            </p>

            {/* KV Store methods */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
              키-값 저장소 &mdash; set / get / getAll
            </h4>
            <p className="text-[13px] text-gray-600 mb-3">
              에이전트 간 데이터를 공유하기 위한 키-값 저장소입니다.
            </p>
            <CodeBlock>
              <span className="fn">set</span>(<span className="prop">key</span>:{" "}
              <span className="type">string</span>, <span className="prop">value</span>:{" "}
              <span className="type">unknown</span>): <span className="type">void</span>
              {"\n"}
              <span className="fn">get</span>(<span className="prop">key</span>:{" "}
              <span className="type">string</span>): <span className="type">unknown</span> |{" "}
              <span className="type">undefined</span>
              {"\n"}
              <span className="fn">getAll</span>(): <span className="type">ReadonlyMap</span>&lt;
              <span className="type">string</span>, <span className="type">unknown</span>&gt;
            </CodeBlock>

            {/* Messaging methods */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
              메시징 &mdash; send / getMessages / getBroadcasts
            </h4>
            <p className="text-[13px] text-gray-600 mb-3">
              에이전트 간 메시지를 교환합니다. 특정 에이전트 또는 전체 브로드캐스트가 가능합니다.
            </p>
            <CodeBlock>
              <span className="fn">send</span>(<span className="prop">message</span>:{" "}
              <span className="type">AgentMessage</span>): <span className="type">void</span>
              {"\n"}
              <span className="fn">getMessages</span>(<span className="prop">agentId</span>:{" "}
              <span className="type">string</span>): <span className="kw">readonly</span>{" "}
              <span className="type">AgentMessage</span>[]
              {"\n"}
              <span className="fn">getBroadcasts</span>(): <span className="kw">readonly</span>{" "}
              <span className="type">AgentMessage</span>[]
            </CodeBlock>

            {/* Progress methods */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
              진행도 추적 &mdash; reportProgress / getProgress
            </h4>
            <p className="text-[13px] text-gray-600 mb-3">
              에이전트의 작업 진행률을 보고하고 모니터링합니다. progress 값은 0~1 범위로 자동
              클램핑됩니다.
            </p>
            <CodeBlock>
              <span className="fn">reportProgress</span>(<span className="prop">agentId</span>:{" "}
              <span className="type">string</span>, <span className="prop">progress</span>:{" "}
              <span className="type">number</span>, <span className="prop">status</span>:{" "}
              <span className="type">string</span>): <span className="type">void</span>
              {"\n"}
              <span className="fn">getProgress</span>(): <span className="type">ReadonlyMap</span>
              &lt;<span className="type">string</span>, <span className="type">AgentProgress</span>
              &gt;
            </CodeBlock>

            {/* cleanup */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">cleanup()</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              모든 공유 상태, 메시지, 진행 추적 데이터를 초기화합니다.
            </p>
            <CodeBlock>
              <span className="fn">cleanup</span>(): <span className="type">void</span>
            </CodeBlock>

            {/* createSharedAgentState */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              createSharedAgentState()
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              새로운 SharedAgentState 인스턴스를 생성하는 팩토리 함수입니다. 구현 클래스(
              <code className="text-cyan-600">SharedAgentStateImpl</code>)를 직접 노출하지 않고
              인터페이스를 통해 사용할 수 있도록 합니다.
            </p>
            <CodeBlock>
              <span className="kw">function</span>{" "}
              <span className="fn">createSharedAgentState</span>():{" "}
              <span className="type">SharedAgentState</span>
            </CodeBlock>

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                메시지 큐의 최대 크기는 <code className="text-cyan-600">200</code>개입니다. 초과하면
                가장 오래된 메시지부터 FIFO 방식으로 제거됩니다.
              </li>
              <li>
                <code className="text-cyan-600">reportProgress()</code>에 전달하는 progress 값은
                <code className="text-cyan-600">Math.max(0, Math.min(1, value))</code>로 0~1 범위로
                클램핑됩니다. 범위를 벗어나는 값을 전달해도 에러가 발생하지 않습니다.
              </li>
              <li>
                <code className="text-cyan-600">getMessages(agentId)</code>는 해당 에이전트에게 직접
                보낸 메시지와 브로드캐스트 메시지를 모두 반환합니다. 자신이 보낸 메시지도 포함될 수
                있습니다.
              </li>
              <li>
                <code className="text-cyan-600">cleanup()</code>은 모든 데이터를 즉시 삭제합니다.
                진행 중인 에이전트가 있으면 데이터 손실이 발생할 수 있으므로 주의하세요.
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

            {/* 기본 사용법: 키-값 공유 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              기본 사용법 &mdash; 에이전트 간 데이터 공유
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              팩토리 함수로 인스턴스를 생성하고, 에이전트 간 데이터를 키-값으로 공유하는 기본
              패턴입니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 1. 공유 상태 생성"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">state</span> ={" "}
              <span className="fn">createSharedAgentState</span>();
              {"\n"}
              {"\n"}
              <span className="cm">{"// 2. Agent A가 분석 결과를 저장"}</span>
              {"\n"}
              <span className="prop">state</span>.<span className="fn">set</span>(
              <span className="str">&quot;분석결과&quot;</span>, {"{"}{" "}
              <span className="prop">files</span>: <span className="num">42</span>,{" "}
              <span className="prop">issues</span>: <span className="num">7</span> {"}"});
              {"\n"}
              {"\n"}
              <span className="cm">{"// 3. Agent B가 결과를 읽어 활용"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">result</span> ={" "}
              <span className="prop">state</span>.<span className="fn">get</span>(
              <span className="str">&quot;분석결과&quot;</span>);
              {"\n"}
              <span className="cm">{"// → { files: 42, issues: 7 }"}</span>
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> 키-값 저장소의 값은 타입이 <code>unknown</code>입니다. 읽은 후
              반드시 타입 가드나 Zod 등으로 검증하세요. 잘못된 타입 가정은 런타임 에러를 유발합니다.
            </Callout>

            {/* 고급 사용법: 메시징 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 에이전트 간 메시징과 브로드캐스트
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              특정 에이전트에게 1:1 메시지를 보내거나,{" "}
              <code className="text-cyan-600">toAgentId</code>를 생략하여 모든 에이전트에게
              브로드캐스트할 수 있습니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 1:1 메시지 전송"}</span>
              {"\n"}
              <span className="prop">state</span>.<span className="fn">send</span>({"{"}
              {"\n"}
              {"  "}
              <span className="prop">fromAgentId</span>:{" "}
              <span className="str">&quot;agent-a&quot;</span>,{"\n"}
              {"  "}
              <span className="prop">toAgentId</span>:{" "}
              <span className="str">&quot;agent-b&quot;</span>,{"\n"}
              {"  "}
              <span className="prop">type</span>: <span className="str">&quot;result&quot;</span>,
              {"\n"}
              {"  "}
              <span className="prop">content</span>:{" "}
              <span className="str">&quot;파일 분석 완료&quot;</span>,{"\n"}
              {"  "}
              <span className="prop">timestamp</span>: <span className="fn">Date</span>.
              <span className="fn">now</span>(),
              {"\n"}
              {"}"});
              {"\n"}
              {"\n"}
              <span className="cm">{"// 브로드캐스트 (toAgentId 생략)"}</span>
              {"\n"}
              <span className="prop">state</span>.<span className="fn">send</span>({"{"}
              {"\n"}
              {"  "}
              <span className="prop">fromAgentId</span>:{" "}
              <span className="str">&quot;leader&quot;</span>,{"\n"}
              {"  "}
              <span className="prop">type</span>: <span className="str">&quot;progress&quot;</span>,
              {"\n"}
              {"  "}
              <span className="prop">content</span>:{" "}
              <span className="str">&quot;전체 진행률 60%&quot;</span>,{"\n"}
              {"  "}
              <span className="prop">timestamp</span>: <span className="fn">Date</span>.
              <span className="fn">now</span>(),
              {"\n"}
              {"}"});
              {"\n"}
              {"\n"}
              <span className="cm">{"// Agent B가 자신의 메시지 확인"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">msgs</span> ={" "}
              <span className="prop">state</span>.<span className="fn">getMessages</span>(
              <span className="str">&quot;agent-b&quot;</span>);
              {"\n"}
              <span className="cm">{"// → 1:1 메시지 + 브로드캐스트 메시지 모두 포함"}</span>
            </CodeBlock>

            <Callout type="tip" icon="*">
              <strong>팁:</strong> 메시지 큐는 최대 200개까지만 보관합니다. 빈번하게 메시지를 보내는
              경우 오래된 메시지가 자동 삭제될 수 있으므로, 중요한 데이터는 키-값 저장소에 별도로
              저장하세요.
            </Callout>

            {/* 고급 사용법: 진행도 추적 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 진행도 추적과 모니터링
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              각 에이전트가 자신의 진행률을 보고하면, 리더 에이전트나 UI가 전체 진행 상황을
              실시간으로 모니터링할 수 있습니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 워커 에이전트가 진행 상황 보고"}</span>
              {"\n"}
              <span className="prop">state</span>.<span className="fn">reportProgress</span>(
              <span className="str">&quot;worker-a&quot;</span>, <span className="num">0.5</span>,{" "}
              <span className="str">&quot;파일 분석 중&quot;</span>);
              {"\n"}
              <span className="prop">state</span>.<span className="fn">reportProgress</span>(
              <span className="str">&quot;worker-b&quot;</span>, <span className="num">0.8</span>,{" "}
              <span className="str">&quot;테스트 작성 중&quot;</span>);
              {"\n"}
              {"\n"}
              <span className="cm">{"// 리더가 전체 진행 상황 확인"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">progress</span> ={" "}
              <span className="prop">state</span>.<span className="fn">getProgress</span>();
              {"\n"}
              <span className="kw">for</span> (<span className="kw">const</span> [
              <span className="prop">agentId</span>, <span className="prop">info</span>]{" "}
              <span className="kw">of</span> <span className="prop">progress</span>) {"{"}
              {"\n"}
              {"  "}
              <span className="fn">console</span>.<span className="fn">log</span>(
              <span className="str">
                {"`${agentId}: ${info.progress * 100}% — ${info.status}`"}
              </span>
              );
              {"\n"}
              {"}"}
            </CodeBlock>

            <DeepDive title="메시지 큐 크기 제한 상세">
              <p className="mb-3">
                메시지 큐의 최대 크기(
                <code className="text-cyan-600">MAX_MESSAGE_QUEUE_SIZE = 200</code>)는 메모리 과다
                사용을 방지하기 위한 안전장치입니다.
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-gray-600">
                <li>
                  큐가 200개를 초과하면 <code className="text-cyan-600">splice(0, excess)</code>로
                  가장 오래된 메시지부터 제거합니다.
                </li>
                <li>이는 FIFO(First In, First Out) 정책입니다.</li>
                <li>메시지 큐 크기는 모듈 내부에 하드코딩되어 있어 외부에서 변경할 수 없습니다.</li>
              </ul>
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
              3가지 통신 채널 구조
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">SharedAgentStateImpl</code>은 세 개의 독립적인
              자료구조로 통신 채널을 분리합니다. 각 채널은 서로 간섭하지 않습니다.
            </p>

            <MermaidDiagram
              title="SharedAgentStateImpl 내부 구조"
              titleColor="purple"
              chart={`graph LR
  IMPL["SharedAgentStateImpl"]
  STORE["store<br/><small>Map&lt;string, unknown&gt;</small>"]
  MSGS["messages<br/><small>AgentMessage[]<br/>max 200</small>"]
  PROG["progressMap<br/><small>Map&lt;string, AgentProgress&gt;</small>"]

  IMPL -->|"set / get / getAll"| STORE
  IMPL -->|"send / getMessages"| MSGS
  IMPL -->|"reportProgress / getProgress"| PROG

  CLEANUP["cleanup()"] -.->|"clear()"| STORE
  CLEANUP -.->|"length = 0"| MSGS
  CLEANUP -.->|"clear()"| PROG

  style IMPL fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style STORE fill:#dbeafe,stroke:#3b82f6,color:#1e293b
  style MSGS fill:#dcfce7,stroke:#10b981,color:#1e293b
  style PROG fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style CLEANUP fill:#f1f5f9,stroke:#64748b,color:#1e293b`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              핵심 코드 분석 &mdash; send 메서드
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              메시지 전송과 큐 크기 관리의 핵심 로직입니다.
            </p>
            <CodeBlock>
              <span className="fn">send</span>(<span className="prop">message</span>:{" "}
              <span className="type">AgentMessage</span>): <span className="type">void</span> {"{"}
              {"\n"}
              {"  "}
              <span className="cm">{"// [1] 메시지를 큐에 추가"}</span>
              {"\n"}
              {"  "}
              <span className="kw">this</span>.<span className="prop">messages</span>.
              <span className="fn">push</span>(<span className="prop">message</span>);
              {"\n"}
              {"\n"}
              {"  "}
              <span className="cm">
                {"// [2] 큐 크기 제한 초과 시 가장 오래된 메시지 제거 (FIFO)"}
              </span>
              {"\n"}
              {"  "}
              <span className="kw">if</span> (<span className="kw">this</span>.
              <span className="prop">messages</span>.<span className="prop">length</span> {">"}{" "}
              <span className="num">200</span>) {"{"}
              {"\n"}
              {"    "}
              <span className="kw">const</span> <span className="prop">excess</span> ={" "}
              <span className="kw">this</span>.<span className="prop">messages</span>.
              <span className="prop">length</span> - <span className="num">200</span>;{"\n"}
              {"    "}
              <span className="kw">this</span>.<span className="prop">messages</span>.
              <span className="fn">splice</span>(<span className="num">0</span>,{" "}
              <span className="prop">excess</span>);
              {"\n"}
              {"  "}
              {"}"}
              {"\n"}
              {"}"}
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">[1]</strong> 메시지를 배열 끝에 추가합니다. 순서가
                보장됩니다.
              </p>
              <p>
                <strong className="text-gray-900">[2]</strong> 200개 제한을 초과하면 앞에서부터(가장
                오래된 순으로) 초과분만큼 제거합니다.
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
                &quot;오래된 메시지가 사라졌어요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                메시지 큐의 최대 크기가 200개로 제한되어 있습니다. 200개를 초과하면 가장 오래된
                메시지부터 자동 삭제됩니다. 중요한 데이터는 키-값 저장소(
                <code className="text-cyan-600">set</code>)에 별도로 저장하세요.
              </p>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;getMessages()에 자기가 보낸 메시지도 포함돼요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">getMessages(agentId)</code>는 해당 에이전트에게 온
                메시지와 모든 브로드캐스트 메시지를 반환합니다. 자신이 보낸 브로드캐스트는{" "}
                <code className="text-cyan-600">toAgentId</code>가 undefined이므로 자신에게도
                보입니다. 필요하면 <code className="text-cyan-600">fromAgentId</code>로
                필터링하세요.
              </p>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;progress 값을 2.0으로 보고했는데 에러가 없어요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">reportProgress()</code>는 값을 0~1 범위로 자동
                클램핑합니다. 2.0을 전달하면 내부적으로 1.0으로 변환됩니다. 에러를 발생시키지 않고
                조용히 처리하므로, 의도치 않은 값을 보내지 않도록 호출 측에서 범위를 확인하세요.
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
                  name: "task-list.ts",
                  slug: "subagent-task-list",
                  relation: "sibling",
                  desc: "여러 에이전트가 협업할 때 작업을 조율하는 팀 작업 목록 관리 모듈",
                },
                {
                  name: "agent-hooks.ts",
                  slug: "agent-hooks",
                  relation: "sibling",
                  desc: "에이전트 정의의 훅을 기존 훅 시스템 형식으로 변환하는 모듈",
                },
                {
                  name: "agent-memory.ts",
                  slug: "agent-memory-sub",
                  relation: "sibling",
                  desc: "서브에이전트의 세션 간 영속적 메모리를 관리하는 모듈",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}

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

export default function ActivityCollectorPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}><div className="center-narrow">
      {/* ─── Header ─── */}
      <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <FilePath path="src/core/activity.ts" />
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
            <span className="text-gray-900">
              ActivityCollector
            </span>
          </h1>
          <div className="flex items-center gap-3 mb-5">
            <LayerBadge layer="core" />
          </div>
          <p className="text-[16px] text-gray-600 leading-relaxed">
            턴 활동 수집 &mdash; TurnActivity, ActivityEntry 타입 + ActivityCollector
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
              <code className="text-cyan-600">ActivityCollector</code>는 에이전트 루프 실행 중
              발생하는 모든 활동을 수집하고 관리하는 모듈입니다. 활동은 &quot;턴(turn)&quot; 단위로
              그룹화되며, 하나의 턴은 사용자 메시지 1개와 에이전트의 전체 응답 사이클을 포함합니다.
            </p>
            <p>
              &quot;턴&quot;이란 사용자가 질문하고 AI가 답변하는 하나의 왕복 과정입니다.
              하나의 턴 안에서 여러 도구 호출, 에러, 중간 응답 등이 발생할 수 있습니다.
              이 모듈은 그 모든 과정을 시간순으로 기록하는 &quot;활동 로그&quot; 역할을 합니다.
            </p>
            <p>
              수집된 활동 데이터는 UI에서 실시간 활동 피드를 표시하거나,
              디버깅 시 에이전트의 행동을 추적하는 데 활용됩니다.
              한번 저장된 항목(entry)은 변경되지 않는 <strong>불변 저장</strong> 방식을 사용합니다.
            </p>
          </div>

          <MermaidDiagram
            title="ActivityCollector 아키텍처 위치"
            titleColor="purple"
            chart={`graph TD
  AGENT["Agent Loop<br/><small>agent-loop.ts</small>"]
  AC["ActivityCollector<br/><small>activity.ts</small>"]
  UI["Activity Feed UI<br/><small>ActivityFeed.tsx</small>"]
  TOOLS["Tool Executor<br/><small>tools/executor.ts</small>"]

  AGENT -->|"startTurn() / completeTurn()"| AC
  AGENT -->|"addEntry(type, data)"| AC
  TOOLS -->|"tool-start / tool-complete"| AC
  AC -->|"getAllTurns()"| UI

  style AC fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style AGENT fill:#dbeafe,stroke:#3b82f6,color:#1e293b
  style UI fill:#dbeafe,stroke:#3b82f6,color:#1e293b
  style TOOLS fill:#f1f5f9,stroke:#64748b,color:#1e293b`}
          />

          <Callout type="info" icon="💡">
            <strong>비유:</strong> ActivityCollector는 야구 경기의 &quot;기록원&quot;과 비슷합니다.
            각 이닝(턴)마다 타석, 안타, 아웃 등의 모든 플레이(활동 항목)를 시간순으로 기록합니다.
            경기가 끝나면 전체 이닝의 기록을 모아볼 수 있습니다.
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 2. 레퍼런스 (Reference) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>📖</span> 레퍼런스
          </h2>

          {/* ActivityEntryType */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            type ActivityEntryType
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            활동 피드에 나타날 수 있는 항목 유형입니다. 8가지 종류가 있습니다.
          </p>
          <CodeBlock>
            <span className="kw">type</span> <span className="type">ActivityEntryType</span> =
            {"\n"}{"  "}| <span className="str">&quot;user-message&quot;</span>
            {"\n"}{"  "}| <span className="str">&quot;assistant-text&quot;</span>
            {"\n"}{"  "}| <span className="str">&quot;assistant-intermediate&quot;</span>
            {"\n"}{"  "}| <span className="str">&quot;thinking&quot;</span>
            {"\n"}{"  "}| <span className="str">&quot;tool-start&quot;</span>
            {"\n"}{"  "}| <span className="str">&quot;tool-complete&quot;</span>
            {"\n"}{"  "}| <span className="str">&quot;tool-denied&quot;</span>
            {"\n"}{"  "}| <span className="str">&quot;error&quot;</span>;
          </CodeBlock>
          <div className="text-[13px] text-gray-600 mt-2 space-y-1">
            <p>&bull; <code className="text-cyan-600">&quot;user-message&quot;</code> &mdash; 사용자가 입력한 메시지</p>
            <p>&bull; <code className="text-cyan-600">&quot;assistant-text&quot;</code> &mdash; AI의 최종 텍스트 응답</p>
            <p>&bull; <code className="text-cyan-600">&quot;assistant-intermediate&quot;</code> &mdash; AI의 중간 응답 (도구 호출 전 등)</p>
            <p>&bull; <code className="text-cyan-600">&quot;thinking&quot;</code> &mdash; AI의 사고 과정 (thinking 모드)</p>
            <p>&bull; <code className="text-cyan-600">&quot;tool-start&quot;</code> &mdash; 도구 실행 시작</p>
            <p>&bull; <code className="text-emerald-600">&quot;tool-complete&quot;</code> &mdash; 도구 실행 완료</p>
            <p>&bull; <code className="text-red-600">&quot;tool-denied&quot;</code> &mdash; 도구 실행이 권한에 의해 거부됨</p>
            <p>&bull; <code className="text-red-600">&quot;error&quot;</code> &mdash; 에러 발생</p>
          </div>

          {/* ActivityEntry interface */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface ActivityEntry
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            턴 내의 단일 활동 항목입니다. 활동의 종류, 발생 시각, 추가 데이터를 담고 있습니다.
          </p>
          <ParamTable
            params={[
              { name: "type", type: "ActivityEntryType", required: true, desc: "활동의 종류 (8가지 중 하나)" },
              { name: "timestamp", type: "Date", required: true, desc: "활동이 발생한 시각" },
              { name: "data", type: "Record<string, unknown>", required: true, desc: "활동에 대한 추가 정보 (도구 이름, 에러 메시지 등)" },
            ]}
          />

          {/* TurnActivity interface */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface TurnActivity
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            하나의 완성된 활동 턴입니다. 사용자 메시지 하나와 그에 대한 에이전트의 전체 응답 사이클을 포함합니다.
          </p>
          <ParamTable
            params={[
              { name: "id", type: "string", required: true, desc: "턴의 고유 식별자 (UUID)" },
              { name: "entries", type: "readonly ActivityEntry[]", required: true, desc: "이 턴에서 발생한 모든 활동 항목 목록" },
              { name: "isComplete", type: "boolean", required: true, desc: "이 턴이 완료되었는지 여부" },
            ]}
          />

          {/* ActivityCollector class */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            class ActivityCollector
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            에이전트 루프 실행 중 활동 항목을 수집하는 메인 클래스입니다.
            항목들을 턴(turn) 단위로 정리하며, 한번 저장된 항목은 변경되지 않습니다.
          </p>

          {/* startTurn */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            startTurn()
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            새로운 턴을 시작합니다. 진행 중인 턴이 있으면 먼저 자동으로 완료 처리한 뒤 새 턴을 시작합니다.
          </p>
          <CodeBlock>
            <span className="fn">startTurn</span>(): <span className="type">string</span>
            {"\n"}<span className="cm">// 반환값: 새 턴의 UUID</span>
          </CodeBlock>

          {/* addEntry */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            addEntry(type, data?)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            현재 턴에 활동 항목을 추가합니다. 활성 턴이 없으면 자동으로 새 턴을 시작합니다.
          </p>
          <CodeBlock>
            <span className="fn">addEntry</span>(<span className="prop">type</span>: <span className="type">ActivityEntryType</span>, <span className="prop">data</span>?: <span className="type">Record</span>{"<"}<span className="type">string</span>, <span className="type">unknown</span>{">"}): <span className="type">void</span>
          </CodeBlock>
          <ParamTable
            params={[
              { name: "type", type: "ActivityEntryType", required: true, desc: "활동 유형 (예: 'tool-start', 'error')" },
              { name: "data", type: "Record<string, unknown>", required: false, desc: "활동에 대한 추가 데이터 (기본값: 빈 객체)" },
            ]}
          />

          {/* completeTurn */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            completeTurn()
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            현재 턴을 완료 상태로 표시합니다. 완료된 턴은 내부 배열에 저장되고, 현재 턴은 null로 초기화됩니다.
          </p>
          <CodeBlock>
            <span className="fn">completeTurn</span>(): <span className="type">void</span>
          </CodeBlock>

          {/* getCurrentTurn */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            getCurrentTurn()
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            현재 진행 중인 턴의 스냅샷을 반환합니다. 활성 턴이 없으면 <code className="text-cyan-600">null</code>을 반환합니다.
          </p>
          <CodeBlock>
            <span className="fn">getCurrentTurn</span>(): <span className="type">TurnActivity</span> | <span className="type">null</span>
          </CodeBlock>

          {/* getCompletedTurns */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            getCompletedTurns()
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            완료된 모든 턴의 목록을 반환합니다.
          </p>
          <CodeBlock>
            <span className="fn">getCompletedTurns</span>(): <span className="kw">readonly</span> <span className="type">TurnActivity</span>[]
          </CodeBlock>

          {/* getAllTurns */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            getAllTurns()
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            모든 턴(완료 + 진행 중)을 반환합니다. UI에서 전체 활동 히스토리를 표시할 때 유용합니다.
          </p>
          <CodeBlock>
            <span className="fn">getAllTurns</span>(): <span className="kw">readonly</span> <span className="type">TurnActivity</span>[]
          </CodeBlock>

          {/* Caveats */}
          <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
          <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
            <li>
              <code className="text-cyan-600">startTurn()</code> 호출 시 이전 턴이 열려있으면
              <strong>자동으로 완료 처리</strong>됩니다. 명시적으로 <code className="text-cyan-600">completeTurn()</code>을
              호출하지 않아도 데이터가 유실되지 않습니다.
            </li>
            <li>
              <code className="text-cyan-600">addEntry()</code> 호출 시 활성 턴이 없으면
              자동으로 새 턴이 시작됩니다. 즉, <code className="text-cyan-600">startTurn()</code> 호출을
              잊어도 항목이 버려지지 않습니다.
            </li>
            <li>
              <code className="text-cyan-600">getCurrentTurn()</code>과 <code className="text-cyan-600">getCompletedTurns()</code>는
              내부 데이터의 <strong>복사본</strong>을 반환합니다.
              반환값을 변경해도 내부 상태에는 영향이 없습니다.
            </li>
            <li>
              활동 데이터는 메모리에만 존재하며 디스크에 자동 저장되지 않습니다.
              프로세스가 종료되면 활동 기록이 사라집니다.
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
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>기본 사용법 &mdash; 에이전트 루프에서 활동 수집</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            에이전트 루프의 각 턴에서 활동을 수집하는 기본 패턴입니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 1. ActivityCollector 인스턴스 생성"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">collector</span> = <span className="kw">new</span> <span className="fn">ActivityCollector</span>();
            {"\n"}
            {"\n"}<span className="cm">{"// 2. 새 턴 시작"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">turnId</span> = <span className="prop">collector</span>.<span className="fn">startTurn</span>();
            {"\n"}
            {"\n"}<span className="cm">{"// 3. 사용자 메시지 기록"}</span>
            {"\n"}<span className="prop">collector</span>.<span className="fn">addEntry</span>(<span className="str">&quot;user-message&quot;</span>, {"{"}{"\n"}{"  "}<span className="prop">content</span>: <span className="str">&quot;파일을 수정해주세요&quot;</span>,
            {"\n"}{"}"});
            {"\n"}
            {"\n"}<span className="cm">{"// 4. 도구 실행 활동 기록"}</span>
            {"\n"}<span className="prop">collector</span>.<span className="fn">addEntry</span>(<span className="str">&quot;tool-start&quot;</span>, {"{"} <span className="prop">toolName</span>: <span className="str">&quot;EditFile&quot;</span> {"}"});
            {"\n"}<span className="prop">collector</span>.<span className="fn">addEntry</span>(<span className="str">&quot;tool-complete&quot;</span>, {"{"} <span className="prop">toolName</span>: <span className="str">&quot;EditFile&quot;</span>, <span className="prop">success</span>: <span className="kw">true</span> {"}"});
            {"\n"}
            {"\n"}<span className="cm">{"// 5. AI 응답 기록"}</span>
            {"\n"}<span className="prop">collector</span>.<span className="fn">addEntry</span>(<span className="str">&quot;assistant-text&quot;</span>, {"{"}{"\n"}{"  "}<span className="prop">content</span>: <span className="str">&quot;파일을 수정했습니다.&quot;</span>,
            {"\n"}{"}"});
            {"\n"}
            {"\n"}<span className="cm">{"// 6. 턴 완료"}</span>
            {"\n"}<span className="prop">collector</span>.<span className="fn">completeTurn</span>();
          </CodeBlock>

          <Callout type="warn" icon="!">
            <strong>주의:</strong> 활동 데이터는 <strong>메모리에만</strong> 존재합니다.
            프로세스가 종료되면 모든 활동 기록이 사라집니다.
            영구 저장이 필요하면 별도로 디스크에 저장하는 로직을 구현해야 합니다.
          </Callout>

          {/* UI에서 활동 피드 표시 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            UI에서 활동 피드 표시
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">getAllTurns()</code>를 사용하여 전체 활동 히스토리를 UI에 표시합니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 전체 턴 목록 가져오기 (완료 + 진행 중)"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">allTurns</span> = <span className="prop">collector</span>.<span className="fn">getAllTurns</span>();
            {"\n"}
            {"\n"}<span className="kw">for</span> (<span className="kw">const</span> <span className="prop">turn</span> <span className="kw">of</span> <span className="prop">allTurns</span>) {"{"}
            {"\n"}{"  "}<span className="fn">console</span>.<span className="fn">log</span>(<span className="str">{"`턴 ${turn.id} (${turn.isComplete ? '완료' : '진행 중'})`"}</span>);
            {"\n"}{"  "}<span className="kw">for</span> (<span className="kw">const</span> <span className="prop">entry</span> <span className="kw">of</span> <span className="prop">turn</span>.<span className="prop">entries</span>) {"{"}
            {"\n"}{"    "}<span className="fn">console</span>.<span className="fn">log</span>(<span className="str">{"`  [${entry.type}] ${entry.timestamp}`"}</span>);
            {"\n"}{"  "}{"}"}
            {"\n"}{"}"}
          </CodeBlock>

          {/* 에러 추적 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; 에러 추적과 도구 실행 모니터링
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            에러나 도구 거부 등 특정 유형의 활동만 필터링하여 분석할 수 있습니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 현재 턴에서 에러 항목만 필터링"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">currentTurn</span> = <span className="prop">collector</span>.<span className="fn">getCurrentTurn</span>();
            {"\n"}<span className="kw">if</span> (<span className="prop">currentTurn</span>) {"{"}
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">errors</span> = <span className="prop">currentTurn</span>.<span className="prop">entries</span>
            {"\n"}{"    "}.<span className="fn">filter</span>(<span className="prop">e</span> ={">"} <span className="prop">e</span>.<span className="prop">type</span> === <span className="str">&quot;error&quot;</span>);
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">denied</span> = <span className="prop">currentTurn</span>.<span className="prop">entries</span>
            {"\n"}{"    "}.<span className="fn">filter</span>(<span className="prop">e</span> ={">"} <span className="prop">e</span>.<span className="prop">type</span> === <span className="str">&quot;tool-denied&quot;</span>);
            {"\n"}
            {"\n"}{"  "}<span className="fn">console</span>.<span className="fn">log</span>(<span className="str">{"`에러 ${errors.length}건, 거부 ${denied.length}건`"}</span>);
            {"\n"}{"}"}
          </CodeBlock>

          <DeepDive title="자동 턴 관리의 안전장치">
            <p className="mb-3">
              <code className="text-cyan-600">ActivityCollector</code>는 두 가지 안전장치를 가지고 있어서
              개발자가 턴 관리를 잊어도 데이터가 유실되지 않습니다:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-gray-600">
              <li>
                <strong>startTurn() 자동 완료:</strong> 새 턴을 시작할 때 이전 턴이 열려있으면
                자동으로 <code className="text-cyan-600">completeTurn()</code>을 호출합니다.
              </li>
              <li>
                <strong>addEntry() 자동 시작:</strong> 활성 턴이 없는 상태에서 항목을 추가하면
                자동으로 <code className="text-cyan-600">startTurn()</code>을 호출합니다.
              </li>
            </ul>
            <p className="mt-3 text-amber-600">
              이 안전장치 덕분에 <code>startTurn()</code>이나 <code>completeTurn()</code> 호출을
              빠뜨려도 크래시가 발생하지 않습니다. 다만 턴 경계가 정확하게 기록되지 않을 수 있으므로,
              가능한 한 명시적으로 호출하는 것을 권장합니다.
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

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>턴 생명주기 다이어그램</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            턴은 &quot;시작 &rarr; 항목 추가 &rarr; 완료&quot;의 생명주기를 거칩니다.
            완료된 턴은 내부 배열에 불변 객체로 저장됩니다.
          </p>

          <MermaidDiagram
            title="턴(Turn) 생명주기"
            titleColor="purple"
            chart={`graph TD
  START(("시작")) --> IDLE["Idle<br/><small>활성 턴 없음<br/>_currentTurn = null</small>"]
  IDLE -->|"startTurn()"| ACTIVE["Active Turn<br/><small>항목 수집 중<br/>_currentTurn != null</small>"]
  IDLE -->|"addEntry()"| AUTO_START["자동 startTurn()<br/><small>안전장치 작동</small>"]
  AUTO_START --> ACTIVE
  ACTIVE -->|"addEntry()"| ACTIVE
  ACTIVE -->|"completeTurn()"| COMPLETE["Turn 완료<br/><small>completedTurns에 추가</small>"]
  ACTIVE -->|"startTurn()"| AUTO_COMPLETE["자동 completeTurn()<br/><small>이전 턴 완료 처리</small>"]
  AUTO_COMPLETE --> COMPLETE
  COMPLETE --> IDLE

  style IDLE fill:#f1f5f9,stroke:#64748b,color:#1e293b,stroke-width:2px
  style ACTIVE fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style COMPLETE fill:#dcfce7,stroke:#10b981,color:#065f46,stroke-width:2px
  style AUTO_START fill:#dbeafe,stroke:#3b82f6,color:#1e293b
  style AUTO_COMPLETE fill:#dbeafe,stroke:#3b82f6,color:#1e293b`}
          />

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>핵심 코드 분석 &mdash; completeTurn()</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            턴 완료 시 현재 턴의 항목들을 복사하여 불변 객체로 저장하는 핵심 로직입니다.
          </p>
          <CodeBlock>
            <span className="fn">completeTurn</span>(): <span className="type">void</span> {"{"}
            {"\n"}{"  "}<span className="cm">{"// [1] 활성 턴이 없으면 아무것도 하지 않음"}</span>
            {"\n"}{"  "}<span className="kw">if</span> (!<span className="kw">this</span>.<span className="prop">_currentTurn</span>) <span className="kw">return</span>;
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// [2] 완료된 턴 목록에 추가 (배열 복사로 불변성 보장)"}</span>
            {"\n"}{"  "}<span className="kw">this</span>.<span className="prop">_completedTurns</span>.<span className="fn">push</span>({"{"}{"\n"}{"    "}<span className="prop">id</span>: <span className="kw">this</span>.<span className="prop">_currentTurn</span>.<span className="prop">id</span>,
            {"\n"}{"    "}<span className="prop">entries</span>: [...<span className="kw">this</span>.<span className="prop">_currentTurn</span>.<span className="prop">entries</span>], <span className="cm">{"// 배열 복사"}</span>
            {"\n"}{"    "}<span className="prop">isComplete</span>: <span className="kw">true</span>,
            {"\n"}{"  "}{"}"});
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// [3] 현재 턴 초기화"}</span>
            {"\n"}{"  "}<span className="kw">this</span>.<span className="prop">_currentTurn</span> = <span className="kw">null</span>;
            {"\n"}{"}"}
          </CodeBlock>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
            <p><strong className="text-gray-900">[1]</strong> 활성 턴이 없는 상태에서 <code className="text-cyan-600">completeTurn()</code>을 호출하면 아무 동작도 하지 않습니다 (안전한 no-op).</p>
            <p><strong className="text-gray-900">[2]</strong> 스프레드 연산자(<code className="text-cyan-600">[...entries]</code>)로 배열을 복사합니다. 이렇게 하면 이후에 <code className="text-cyan-600">_currentTurn.entries</code>를 변경해도 완료된 턴의 데이터에 영향을 미치지 않습니다.</p>
            <p><strong className="text-gray-900">[3]</strong> 현재 턴을 null로 초기화하여 다음 <code className="text-cyan-600">startTurn()</code> 호출을 준비합니다.</p>
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
              &quot;getAllTurns()가 빈 배열을 반환해요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">addEntry()</code>를 호출했는지 확인하세요.
              또한 현재 진행 중인 턴은 <code className="text-cyan-600">completeTurn()</code>을 호출해야
              <code className="text-cyan-600">getCompletedTurns()</code>에 포함됩니다.
              <code className="text-cyan-600">getAllTurns()</code>는 진행 중인 턴도 포함하므로,
              완전히 비어있다면 아직 아무 항목도 추가하지 않은 것입니다.
            </p>
          </div>

          {/* FAQ 2 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;턴 경계가 이상하게 나뉘어요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">startTurn()</code>과 <code className="text-cyan-600">completeTurn()</code>의
              호출 위치를 확인하세요. 자동 안전장치가 작동하면 의도하지 않은 시점에 턴이 나뉠 수 있습니다.
              에이전트 루프에서 사용자 메시지 처리 시작 시 <code className="text-cyan-600">startTurn()</code>,
              응답 완료 시 <code className="text-cyan-600">completeTurn()</code>을 명시적으로 호출하는 것을 권장합니다.
            </p>
          </div>

          {/* FAQ 3 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;프로세스 재시작 후 활동 기록이 사라졌어요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">ActivityCollector</code>는 메모리 전용(in-memory) 저장소입니다.
              디스크에 자동 저장되지 않으므로, 프로세스가 종료되면 데이터가 사라집니다.
              이것은 의도된 설계입니다 &mdash; 활동 로그는 세션의 일시적 정보이며,
              영구 저장이 필요한 대화 내용은 <code className="text-cyan-600">SessionManager</code>에서 관리합니다.
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
                desc: "에이전트 루프가 매 턴마다 ActivityCollector에 활동을 기록하는 메인 루프",
              },
              {
                name: "session-manager.ts",
                slug: "session-manager",
                relation: "sibling",
                desc: "세션 생명주기 관리 — 활동은 세션 내에서 수집되며, 메시지는 SessionManager에 저장",
              },
              {
                name: "conversation.ts",
                slug: "conversation-manager",
                relation: "sibling",
                desc: "불변 대화 상태 관리 — ActivityCollector의 활동과 Conversation의 메시지는 같은 턴에서 발생",
              },
            ]}
          />
        </section>
      </RevealOnScroll>
    </div></div>
  );
}

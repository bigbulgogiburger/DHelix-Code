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

export default function TurnBlockPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/cli/components/TurnBlock.tsx" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">TurnBlock</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="cli" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              하나의 대화 턴(사용자 입력 + AI 응답)을 독립적으로 렌더링하는 컴포넌트입니다.
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
                <code className="text-cyan-600">TurnBlock</code>은 하나의 &quot;턴&quot;을 화면에
                표시합니다. &quot;턴&quot;이란 사용자가 메시지를 보내고 에이전트가 응답을
                완료하기까지의 한 사이클을 의미합니다. 한 턴에는 사용자 메시지, AI 텍스트 응답, 도구
                호출(여러 개), thinking 블록, 에러 등 여러 항목이 포함될 수 있습니다.
              </p>
              <p>
                내부적으로 <code className="text-cyan-600">turn.entries</code> 배열을 순회하면서 각
                항목의 타입(<code>user-message</code>, <code>assistant-text</code>,
                <code>tool-start</code> 등)에 따라 적절한 하위 컴포넌트로 분기합니다.
                <code className="text-cyan-600">StreamingMessage</code>,
                <code className="text-cyan-600">ToolCallBlock</code>,
                <code className="text-cyan-600">ThinkingBlock</code> 등을 조합하여 한 턴의 전체
                내용을 세로로 나열합니다.
              </p>
              <p>
                <code className="text-cyan-600">React.memo</code>로 감싸져 있어 props가 변경되지
                않으면 리렌더링을 건너뜁니다.
              </p>
            </div>

            <MermaidDiagram
              title="TurnBlock 아키텍처 위치"
              titleColor="purple"
              chart={`graph TD
  AF["ActivityFeed<br/><small>활동 피드</small>"]
  TB["TurnBlock<br/><small>대화 턴 블록</small>"]
  SM["StreamingMessage<br/><small>AI 텍스트 스트리밍</small>"]
  TCB["ToolCallBlock<br/><small>도구 호출 표시</small>"]
  TH["ThinkingBlock<br/><small>사고 과정 표시</small>"]
  ACT["TurnActivity<br/><small>core/activity.ts</small>"]

  AF -->|"turn 데이터 전달"| TB
  TB -->|"assistant-text"| SM
  TB -->|"tool-start/complete"| TCB
  TB -->|"thinking"| TH
  ACT -->|"entries 배열"| TB

  style TB fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style AF fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style SM fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style TCB fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style TH fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style ACT fill:#f1f5f9,stroke:#64748b,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> 채팅 앱에서 하나의 메시지 &quot;버블&quot;을 생각하세요.
              TurnBlock은 그 버블 안에 텍스트, 코드, 도구 실행 결과 등을 모두 포함하는 확장된 메시지
              버블입니다. 하나의 질문-응답 사이클 전체가 하나의 TurnBlock입니다.
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

            {/* TurnBlockProps */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface TurnBlockProps
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              TurnBlock 컴포넌트에 전달하는 props입니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "turn",
                  type: "TurnActivity",
                  required: true,
                  desc: "표시할 대화 턴 데이터. entries 배열에 모든 활동 항목이 포함됩니다.",
                },
                {
                  name: "isLive",
                  type: "boolean",
                  required: false,
                  desc: "현재 진행 중인 턴인지 여부 (기본값: false). true이면 스트리밍 표시가 활성화됩니다.",
                },
                {
                  name: "isExpanded",
                  type: "boolean",
                  required: false,
                  desc: "도구 출력을 확장해서 보여줄지 여부. Ctrl+O(verbose 모드)와 연동됩니다.",
                },
              ]}
            />

            {/* ActivityEntry 분기 */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              renderEntry() &mdash; 항목 타입별 분기
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              각 <code className="text-cyan-600">ActivityEntry</code>의 타입에 따라 다른 컴포넌트를
              렌더링합니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "user-message",
                  type: "→ Text",
                  required: true,
                  desc: "사용자 입력 메시지. 초록색 '>' 접두사와 함께 표시됩니다.",
                },
                {
                  name: "assistant-text",
                  type: "→ StreamingMessage",
                  required: true,
                  desc: "AI 텍스트 응답. isLive에 따라 스트리밍 또는 완료 상태로 표시됩니다.",
                },
                {
                  name: "thinking",
                  type: "→ ThinkingBlock",
                  required: true,
                  desc: "AI의 사고 과정(extended thinking). 접을 수 있는 블록으로 표시됩니다.",
                },
                {
                  name: "assistant-intermediate",
                  type: "→ Text (cyan)",
                  required: true,
                  desc: "중간 응답. 시안색 '⏺' 아이콘과 함께 표시됩니다.",
                },
                {
                  name: "tool-start / tool-complete / tool-denied",
                  type: "→ ToolCallBlock",
                  required: true,
                  desc: "도구 호출 상태. running/complete/error/denied 상태에 따라 표시됩니다.",
                },
                {
                  name: "error",
                  type: "→ Text (red)",
                  required: true,
                  desc: "에러 메시지. 빨간색으로 들여쓰기하여 표시됩니다.",
                },
              ]}
            />

            {/* 헬퍼 함수들 */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              헬퍼 함수
            </h3>

            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">getToolStatus(entry)</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              ActivityEntry의 타입에서 도구 호출 상태를 결정합니다.
            </p>
            <CodeBlock>
              <span className="fn">getToolStatus</span>(<span className="prop">entry</span>:{" "}
              <span className="type">ActivityEntry</span>):{" "}
              <span className="str">&quot;running&quot;</span> |{" "}
              <span className="str">&quot;complete&quot;</span> |{" "}
              <span className="str">&quot;error&quot;</span> |{" "}
              <span className="str">&quot;denied&quot;</span>
            </CodeBlock>

            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
              findStartTime(entries, toolId)
            </h4>
            <p className="text-[13px] text-gray-600 mb-3">
              주어진 도구 ID의 시작 시간을 entries에서 찾아 반환합니다. 소요 시간 계산에 사용됩니다.
            </p>
            <CodeBlock>
              <span className="fn">findStartTime</span>(<span className="prop">entries</span>:{" "}
              <span className="kw">readonly</span> <span className="type">ActivityEntry</span>[],{" "}
              <span className="prop">toolId</span>: <span className="type">string</span> |{" "}
              <span className="type">undefined</span>): <span className="type">number</span> |{" "}
              <span className="type">undefined</span>
            </CodeBlock>

            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
              findMetadata(entries, toolId)
            </h4>
            <p className="text-[13px] text-gray-600 mb-3">
              주어진 도구 ID의 메타데이터를 tool-complete 항목에서 찾아 반환합니다.
            </p>
            <CodeBlock>
              <span className="fn">findMetadata</span>(<span className="prop">entries</span>:{" "}
              <span className="kw">readonly</span> <span className="type">ActivityEntry</span>[],{" "}
              <span className="prop">toolId</span>: <span className="type">string</span> |{" "}
              <span className="type">undefined</span>): <span className="type">Record</span>&lt;
              <span className="type">string</span>, <span className="type">unknown</span>&gt; |{" "}
              <span className="type">undefined</span>
            </CodeBlock>

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                <code className="text-cyan-600">isLive</code>가 <code>true</code>이면
                <code className="text-cyan-600">assistant-text</code> 항목이 스트리밍 상태로
                표시됩니다. 완료된 턴에는 반드시 <code>false</code>를 전달하세요.
              </li>
              <li>
                <code className="text-cyan-600">tool-start</code> 항목이 있어도 대응하는
                <code className="text-cyan-600">tool-complete</code>가 아직 없으면 도구가
                &quot;running&quot; 상태로 표시됩니다.
              </li>
              <li>
                <code className="text-cyan-600">assistant-intermediate</code>의 content가 빈
                문자열이면
                <code>null</code>을 반환하여 아무것도 렌더링하지 않습니다.
              </li>
              <li>
                <code className="text-cyan-600">entries</code> 배열의 순서가 곧 렌더링 순서입니다.
                시간순으로 정렬되어 있어야 올바르게 표시됩니다.
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
              기본 사용법 &mdash; 완료된 턴 표시
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              이미 완료된 턴을 표시할 때는 <code className="text-cyan-600">isLive</code>를
              생략하거나 <code>false</code>로 전달합니다.
            </p>
            <CodeBlock>
              <span className="kw">import</span> {"{"} <span className="type">TurnBlock</span> {"}"}{" "}
              <span className="kw">from</span>{" "}
              <span className="str">&quot;./TurnBlock.js&quot;</span>;{"\n"}
              {"\n"}
              <span className="cm">{"// 완료된 턴 렌더링"}</span>
              {"\n"}
              {"<"}
              <span className="type">TurnBlock</span> <span className="prop">turn</span>={"{"}
              <span className="prop">completedTurn</span>
              {"}"} {"/>"}
              {"\n"}
              {"\n"}
              <span className="cm">{"// 도구 출력 확장 모드"}</span>
              {"\n"}
              {"<"}
              <span className="type">TurnBlock</span> <span className="prop">turn</span>={"{"}
              <span className="prop">completedTurn</span>
              {"}"} <span className="prop">isExpanded</span>={"{"}
              <span className="kw">true</span>
              {"}"} {"/>"}
            </CodeBlock>

            {/* 라이브 턴 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 진행 중인 턴(라이브 모드)
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              현재 에이전트가 응답 중인 턴은 <code className="text-cyan-600">isLive=true</code>로
              표시합니다. 이 모드에서는 AI 텍스트가 스트리밍 애니메이션으로 표시되고, 도구 호출이
              &quot;실행 중&quot; 상태로 나타납니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 진행 중인 턴 — 스트리밍 + 도구 실행 중 표시"}</span>
              {"\n"}
              {"<"}
              <span className="type">TurnBlock</span>
              {"\n"}
              {"  "}
              <span className="prop">turn</span>={"{"}
              <span className="prop">currentTurn</span>
              {"}"}
              {"\n"}
              {"  "}
              <span className="prop">isLive</span>={"{"}
              <span className="kw">true</span>
              {"}"}
              {"\n"}
              {"  "}
              <span className="prop">isExpanded</span>={"{"}
              <span className="prop">verboseMode</span>
              {"}"}
              {"\n"}
              {"/>"}
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> <code>isLive=true</code>인 턴이 여러 개 동시에 표시되면
              스트리밍 커서가 여러 곳에서 깜빡이며 혼란스러울 수 있습니다. ActivityFeed는 마지막
              턴만 라이브 상태로 표시합니다.
            </Callout>

            <DeepDive title="TurnActivity 데이터 구조">
              <p className="mb-3">
                <code className="text-cyan-600">TurnActivity</code>는
                <code className="text-cyan-600">core/activity.ts</code>에 정의된 인터페이스입니다.
                핵심 필드는 다음과 같습니다:
              </p>
              <CodeBlock>
                <span className="kw">interface</span> <span className="type">TurnActivity</span>{" "}
                {"{"}
                {"\n"}
                {"  "}
                <span className="prop">entries</span>: <span className="kw">readonly</span>{" "}
                <span className="type">ActivityEntry</span>[];
                {"\n"}
                {"  "}
                <span className="cm">{"// ActivityEntry.type:"}</span>
                {"\n"}
                {"  "}
                <span className="cm">{"//   'user-message' | 'assistant-text' | 'thinking'"}</span>
                {"\n"}
                {"  "}
                <span className="cm">{"//   'assistant-intermediate' | 'tool-start'"}</span>
                {"\n"}
                {"  "}
                <span className="cm">{"//   'tool-complete' | 'tool-denied' | 'error'"}</span>
                {"\n"}
                {"}"}
              </CodeBlock>
              <p className="mt-3 text-gray-600">
                각 <code className="text-cyan-600">ActivityEntry</code>는
                <code className="text-cyan-600">type</code>과
                <code className="text-cyan-600">data</code> 필드를 가지며,
                <code>data</code>의 구조는 타입에 따라 다릅니다.
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
              항목 타입별 렌더링 흐름
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">renderEntry()</code> 함수는
              <code className="text-cyan-600">switch(entry.type)</code>으로 각 항목을 적절한
              컴포넌트에 매핑합니다.
            </p>

            <MermaidDiagram
              title="renderEntry() 분기 흐름"
              titleColor="purple"
              chart={`graph TD
  ENTRY["ActivityEntry"] --> SW{"entry.type?"}

  SW -->|"user-message"| UM["Text<br/><small>초록색 '>' + content</small>"]
  SW -->|"assistant-text"| AT["StreamingMessage<br/><small>isComplete 판단</small>"]
  SW -->|"thinking"| TH["ThinkingBlock<br/><small>isStreaming + isExpanded</small>"]
  SW -->|"assistant-intermediate"| AI["Text<br/><small>시안색 '⏺' + content</small>"]
  SW -->|"tool-*"| TC["ToolCallBlock<br/><small>status + args + output</small>"]
  SW -->|"error"| ER["Text<br/><small>빨간색 에러 메시지</small>"]
  SW -->|"default"| NULL["null<br/><small>렌더링 안 함</small>"]

  style ENTRY fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style SW fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style UM fill:#dcfce7,stroke:#10b981,color:#065f46
  style AT fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style TH fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style AI fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style TC fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style ER fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style NULL fill:#f1f5f9,stroke:#64748b,color:#1e293b`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              도구 상태 결정 로직
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              도구 관련 항목(<code>tool-start</code>, <code>tool-complete</code>,
              <code>tool-denied</code>)은 <code className="text-cyan-600">getToolStatus()</code>로
              상태를 결정한 후 <code className="text-cyan-600">ToolCallBlock</code>에 전달합니다.
            </p>
            <CodeBlock>
              <span className="kw">function</span> <span className="fn">getToolStatus</span>(
              <span className="prop">entry</span>: <span className="type">ActivityEntry</span>){" "}
              {"{"}
              {"\n"}
              {"  "}
              <span className="kw">switch</span> (<span className="prop">entry</span>.
              <span className="prop">type</span>) {"{"}
              {"\n"}
              {"    "}
              <span className="kw">case</span> <span className="str">&quot;tool-start&quot;</span>:{" "}
              <span className="kw">return</span> <span className="str">&quot;running&quot;</span>;
              {"\n"}
              {"    "}
              <span className="kw">case</span>{" "}
              <span className="str">&quot;tool-complete&quot;</span>:{" "}
              <span className="kw">return</span> <span className="prop">entry</span>.
              <span className="prop">data</span>.<span className="prop">isError</span> ?{" "}
              <span className="str">&quot;error&quot;</span> :{" "}
              <span className="str">&quot;complete&quot;</span>;{"\n"}
              {"    "}
              <span className="kw">case</span> <span className="str">&quot;tool-denied&quot;</span>:{" "}
              <span className="kw">return</span> <span className="str">&quot;denied&quot;</span>;
              {"\n"}
              {"    "}
              <span className="kw">default</span>: <span className="kw">return</span>{" "}
              <span className="str">&quot;complete&quot;</span>;{"\n"}
              {"  "}
              {"}"}
              {"\n"}
              {"}"}
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">tool-start</strong> &mdash; 도구 실행이
                시작되었지만 아직 완료되지 않음. 스피너가 표시됩니다.
              </p>
              <p>
                <strong className="text-gray-900">tool-complete (isError: false)</strong> &mdash;
                도구 실행 성공. 초록색 체크와 결과가 표시됩니다.
              </p>
              <p>
                <strong className="text-gray-900">tool-complete (isError: true)</strong> &mdash;
                도구 실행 실패. 빨간색 에러 표시가 나타납니다.
              </p>
              <p>
                <strong className="text-gray-900">tool-denied</strong> &mdash; 사용자가 권한을
                거부함. 노란색 거부 표시가 나타납니다.
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
                &quot;도구 호출 결과가 보이지 않아요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">isExpanded</code>가 <code>false</code>이면 도구
                출력이 접힌 상태로 표시됩니다. <kbd>Ctrl+O</kbd>(verbose 모드)를 눌러 확장하거나,{" "}
                <code>isExpanded=true</code>를 전달하세요.
              </p>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;스트리밍이 끝났는데 커서가 계속 깜빡여요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">isLive</code>가 여전히 <code>true</code>로 전달되고
                있을 가능성이 있습니다. 턴이 완료되면
                <code className="text-cyan-600">isLive=false</code>로 전환되어야 합니다.
                ActivityFeed가 자동으로 이를 관리하므로, 직접 TurnBlock을 사용하는 경우에만 이
                문제가 발생합니다.
              </p>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;도구 실행 시간이 표시되지 않아요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">findStartTime()</code>이 대응하는
                <code className="text-cyan-600">tool-start</code> 항목을 찾지 못했을 수 있습니다.
                <code className="text-cyan-600">tool-start</code>의
                <code className="text-cyan-600">data.id</code>와
                <code className="text-cyan-600">tool-complete</code>의
                <code className="text-cyan-600">data.id</code>가 일치해야 합니다.
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
                  name: "ActivityFeed",
                  slug: "activity-feed",
                  relation: "parent",
                  desc: "여러 TurnBlock을 순서대로 렌더링하는 메인 피드 컴포넌트",
                },
                {
                  name: "ToolCallBlock",
                  slug: "tool-call-block",
                  relation: "child",
                  desc: "TurnBlock 내부에서 도구 호출을 렌더링하는 컴포넌트",
                },
                {
                  name: "StreamingMessage",
                  slug: "streaming-message",
                  relation: "child",
                  desc: "TurnBlock 내부에서 AI 텍스트 응답을 스트리밍으로 표시하는 컴포넌트",
                },
                {
                  name: "ThinkingBlock",
                  slug: "thinking-block",
                  relation: "child",
                  desc: "TurnBlock 내부에서 AI의 사고 과정을 표시하는 컴포넌트",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}

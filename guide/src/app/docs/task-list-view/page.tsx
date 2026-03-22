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

export default function TaskListViewPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}><div className="center-narrow">
      {/* ─── Header ─── */}
      <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <FilePath path="src/cli/components/TaskListView.tsx" />
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
            <span className="text-gray-900">
              TaskListView
            </span>
          </h1>
          <div className="flex items-center gap-3 mb-5">
            <LayerBadge layer="cli" />
          </div>
          <p className="text-[16px] text-gray-600 leading-relaxed">
            에이전트의 작업(Task) 목록을 계층적 트리 뷰로 표시하는 CLI 컴포넌트입니다.
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
              <code className="text-cyan-600">TaskListView</code>는 에이전트가 관리하는 작업 목록을
              터미널에 계층적 트리 형태로 렌더링합니다. 각 작업은 상태에 따라 고유한 아이콘과 색상으로
              시각적으로 구분되며, 부모-자식 관계는 들여쓰기로 표현됩니다.
            </p>
            <p>
              내부적으로 <code className="text-cyan-600">parentId</code> 기반의 부모-자식 맵을 구축하여
              루트 작업부터 자식 작업까지 재귀적으로 렌더링합니다. 상단에는 &quot;Tasks (완료/전체 complete)&quot;
              요약 정보가 표시되어 전체 진행 상황을 한눈에 파악할 수 있습니다.
            </p>
            <p>
              상태 아이콘은 다섯 가지입니다: <code className="text-gray-500">○</code> 대기(pending),
              <code className="text-yellow-600">◐</code> 진행 중(in_progress),
              <code className="text-emerald-600">●</code> 완료(completed),
              <code className="text-red-600">✕</code> 실패(failed),
              <code className="text-gray-500">⊘</code> 취소(cancelled).
            </p>
          </div>

          <MermaidDiagram
            title="TaskListView 아키텍처 위치"
            titleColor="purple"
            chart={`graph TD
  APP["App.tsx<br/><small>메인 애플리케이션</small>"]
  TLV["TaskListView<br/><small>작업 목록 트리 뷰</small>"]
  TI["TaskItem<br/><small>개별 작업 항목 (재귀)</small>"]
  TM["TaskManager<br/><small>core/task-manager.ts</small>"]
  TVP["TaskViewPanel<br/><small>작업 상세 패널</small>"]

  APP -->|"tasks 배열 전달"| TLV
  TLV -->|"루트 작업 렌더링"| TI
  TI -->|"자식 작업 재귀"| TI
  TM -->|"Task 데이터 제공"| APP
  APP -->|"tasks 배열 전달"| TVP

  style TLV fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style TI fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style APP fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style TM fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style TVP fill:#e0e7ff,stroke:#64748b,color:#1e293b`}
          />

          <Callout type="info" icon="💡">
            <strong>비유:</strong> 파일 탐색기의 폴더 트리를 떠올리세요. 최상위 폴더(루트 작업)가 있고,
            그 안에 하위 폴더(자식 작업)가 들여쓰기되어 나타납니다. 각 폴더 옆의 아이콘은
            작업의 현재 상태를 나타냅니다.
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 2. 레퍼런스 (Reference) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>📖</span> 레퍼런스
          </h2>

          {/* STATUS_COLORS */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            const STATUS_COLORS
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            작업 상태별 Ink 색상을 매핑하는 레코드입니다. 각 상태에 시각적으로 구분되는 색상을 할당합니다.
          </p>
          <ParamTable
            params={[
              { name: "pending", type: '"gray"', required: true, desc: "대기 상태 — 회색으로 표시" },
              { name: "in_progress", type: '"yellow"', required: true, desc: "진행 중 — 노란색으로 강조" },
              { name: "completed", type: '"green"', required: true, desc: "완료 — 초록색으로 표시" },
              { name: "failed", type: '"red"', required: true, desc: "실패 — 빨간색으로 경고" },
              { name: "cancelled", type: '"gray"', required: true, desc: "취소 — 회색으로 흐리게" },
            ]}
          />

          {/* STATUS_SYMBOLS */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            const STATUS_SYMBOLS
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            작업 상태별 유니코드 심볼을 매핑합니다. 터미널에서 직관적으로 상태를 구분할 수 있게 합니다.
          </p>
          <CodeBlock>
            <span className="kw">const</span> <span className="prop">STATUS_SYMBOLS</span>: <span className="type">Record</span>&lt;<span className="type">TaskStatus</span>, <span className="type">string</span>&gt; = {"{"}
            {"\n"}{"  "}<span className="prop">pending</span>: <span className="str">&quot;○&quot;</span>,{"     "}<span className="cm">{"// 빈 원 — 아직 시작하지 않음"}</span>
            {"\n"}{"  "}<span className="prop">in_progress</span>: <span className="str">&quot;◐&quot;</span>,{" "}<span className="cm">{"// 반원 — 현재 진행 중"}</span>
            {"\n"}{"  "}<span className="prop">completed</span>: <span className="str">&quot;●&quot;</span>,{"   "}<span className="cm">{"// 채워진 원 — 완료됨"}</span>
            {"\n"}{"  "}<span className="prop">failed</span>: <span className="str">&quot;✕&quot;</span>,{"      "}<span className="cm">{"// X 표시 — 실패"}</span>
            {"\n"}{"  "}<span className="prop">cancelled</span>: <span className="str">&quot;⊘&quot;</span>,{"   "}<span className="cm">{"// 금지 — 취소됨"}</span>
            {"\n"}{"}"};
          </CodeBlock>

          {/* TaskItemProps */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface TaskItemProps
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            내부 서브 컴포넌트 <code className="text-cyan-600">TaskItem</code>의 Props입니다.
            단일 작업 항목을 재귀적으로 렌더링할 때 사용됩니다.
          </p>
          <ParamTable
            params={[
              { name: "task", type: "Task", required: true, desc: "렌더링할 작업 객체 (id, title, status, description, parentId 포함)" },
              { name: "depth", type: "number", required: true, desc: "현재 깊이 — 들여쓰기 수준을 결정 (루트=0)" },
              { name: "children", type: "readonly Task[]", required: false, desc: "이 작업의 자식 작업 배열 (없으면 리프 노드)" },
            ]}
          />

          {/* TaskListViewProps */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface TaskListViewProps
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            메인 컴포넌트 <code className="text-cyan-600">TaskListView</code>의 Props입니다.
          </p>
          <ParamTable
            params={[
              { name: "tasks", type: "readonly Task[]", required: true, desc: "표시할 전체 작업 배열 (부모-자식 관계 포함)" },
              { name: "title", type: "string", required: false, desc: "작업 목록 상단에 표시할 제목 (미지정 시 제목 없음)" },
            ]}
          />

          {/* TaskListView function */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            function TaskListView
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            작업 목록을 계층적 트리 뷰로 렌더링하는 메인 함수 컴포넌트입니다.
            <code className="text-cyan-600">parentId</code> 기반으로 부모-자식 맵을 구축한 뒤,
            루트 작업부터 재귀적으로 <code className="text-cyan-600">TaskItem</code>을 호출합니다.
          </p>
          <CodeBlock>
            <span className="kw">export function</span> <span className="fn">TaskListView</span>({"{"} <span className="prop">tasks</span>, <span className="prop">title</span> {"}"}: <span className="type">TaskListViewProps</span>): <span className="type">JSX.Element</span>
          </CodeBlock>

          {/* Caveats */}
          <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
          <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
            <li>
              작업 배열이 비어 있으면 <code className="text-cyan-600">&quot;No tasks.&quot;</code>라는
              회색 텍스트만 표시됩니다.
            </li>
            <li>
              <code className="text-cyan-600">parentId</code>가 <code className="text-cyan-600">undefined</code>인
              작업만 루트 작업으로 간주됩니다. 존재하지 않는 parentId를 가진 작업은 표시되지 않습니다.
            </li>
            <li>
              <code className="text-cyan-600">TaskItem</code>은 내부(non-exported) 컴포넌트로, 재귀 호출을 통해
              트리 깊이를 표현합니다. 깊이가 깊을수록 들여쓰기가 2칸씩 증가합니다.
            </li>
            <li>
              <code className="text-cyan-600">in_progress</code> 상태의 작업은 제목이 <strong>볼드</strong>로 강조됩니다.
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
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>기본 사용법 &mdash; 작업 목록 표시하기</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">TaskManager</code>에서 가져온 작업 배열을
            그대로 전달하면 트리 뷰가 렌더링됩니다.
          </p>
          <CodeBlock>
            <span className="kw">import</span> {"{"} <span className="type">TaskListView</span> {"}"} <span className="kw">from</span> <span className="str">&quot;./TaskListView.js&quot;</span>;
            {"\n"}
            {"\n"}<span className="cm">{"// TaskManager에서 작업 목록 가져오기"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">tasks</span> = <span className="prop">taskManager</span>.<span className="fn">getAllTasks</span>();
            {"\n"}
            {"\n"}<span className="cm">{"// 제목 포함하여 렌더링"}</span>
            {"\n"}&lt;<span className="type">TaskListView</span> <span className="prop">tasks</span>={"{"}tasks{"}"} <span className="prop">title</span>=<span className="str">&quot;현재 작업 목록&quot;</span> /&gt;
          </CodeBlock>

          <Callout type="warn" icon="!">
            <strong>주의:</strong> <code>tasks</code> 배열 내의 각 <code>Task</code> 객체는
            반드시 고유한 <code>id</code>를 가져야 합니다. 중복 id가 있으면
            부모-자식 맵 구축 시 예기치 않은 동작이 발생합니다.
          </Callout>

          {/* 부모-자식 관계 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; 부모-자식 계층 구조
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            작업의 <code className="text-cyan-600">parentId</code>를 설정하면 계층 구조가 자동으로 구성됩니다.
            트리의 깊이에 따라 들여쓰기가 적용되어 시각적으로 관계를 파악할 수 있습니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 계층 구조 예시"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">tasks</span> = [
            {"\n"}{"  "}{"{"} <span className="prop">id</span>: <span className="str">&quot;1&quot;</span>, <span className="prop">title</span>: <span className="str">&quot;API 구현&quot;</span>, <span className="prop">status</span>: <span className="str">&quot;in_progress&quot;</span> {"}"},
            {"\n"}{"  "}{"{"} <span className="prop">id</span>: <span className="str">&quot;2&quot;</span>, <span className="prop">title</span>: <span className="str">&quot;라우터 설정&quot;</span>, <span className="prop">status</span>: <span className="str">&quot;completed&quot;</span>, <span className="prop">parentId</span>: <span className="str">&quot;1&quot;</span> {"}"},
            {"\n"}{"  "}{"{"} <span className="prop">id</span>: <span className="str">&quot;3&quot;</span>, <span className="prop">title</span>: <span className="str">&quot;핸들러 작성&quot;</span>, <span className="prop">status</span>: <span className="str">&quot;pending&quot;</span>, <span className="prop">parentId</span>: <span className="str">&quot;1&quot;</span> {"}"},
            {"\n"}];
            {"\n"}
            {"\n"}<span className="cm">{"// 렌더링 결과:"}</span>
            {"\n"}<span className="cm">{"// ◐ API 구현 [in_progress]"}</span>
            {"\n"}<span className="cm">{"//   ● 라우터 설정 [completed]"}</span>
            {"\n"}<span className="cm">{"//   ○ 핸들러 작성 [pending]"}</span>
          </CodeBlock>

          <Callout type="tip" icon="*">
            <strong>팁:</strong> <code>title</code> prop을 지정하면 목록 상단에 제목과 함께
            <code>(완료/전체 complete)</code> 형태의 진행률 요약이 자동으로 표시됩니다.
          </Callout>

          <DeepDive title="부모-자식 맵 구축 로직 상세">
            <p className="mb-3">
              <code className="text-cyan-600">TaskListView</code>는 렌더링 전에 다음 과정을 거칩니다:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-gray-600">
              <li>전체 작업 배열을 순회하며 <code className="text-cyan-600">parentId</code>를 키로 하는 <code className="text-cyan-600">Map</code>을 구축합니다.</li>
              <li><code className="text-cyan-600">parentId</code>가 <code className="text-cyan-600">undefined</code>인 작업을 루트 작업으로 추출합니다.</li>
              <li>루트 작업부터 시작하여 각 작업의 <code className="text-cyan-600">id</code>로 자식을 조회하며 재귀 렌더링합니다.</li>
            </ul>
            <p className="mt-3 text-amber-600">
              이 맵 구축은 렌더링마다 수행되므로, 작업 수가 매우 많으면 성능에 영향을 줄 수 있습니다.
              일반적인 사용에서는 문제가 되지 않지만, 수백 개 이상의 작업이 있다면
              <code>useMemo</code> 도입을 고려할 수 있습니다.
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

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>렌더링 플로우</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            컴포넌트가 렌더링될 때의 내부 처리 흐름입니다.
            빈 배열 체크 → 부모-자식 맵 구축 → 진행률 계산 → 트리 렌더링 순서로 진행됩니다.
          </p>

          <MermaidDiagram
            title="TaskListView 렌더링 플로우"
            titleColor="purple"
            chart={`graph TD
  START(("tasks 전달")) --> CHECK{"tasks.length === 0?"}
  CHECK -->|"예"| EMPTY["'No tasks.' 표시<br/><small>회색 텍스트</small>"]
  CHECK -->|"아니오"| MAP["childMap 구축<br/><small>parentId → Task[] 매핑</small>"]
  MAP --> ROOT["rootTasks 추출<br/><small>parentId === undefined</small>"]
  ROOT --> STATS["진행률 계산<br/><small>completed / total</small>"]
  STATS --> TITLE{"title 존재?"}
  TITLE -->|"예"| HEADER["제목 + 진행률 표시<br/><small>title (N/M complete)</small>"]
  TITLE -->|"아니오"| TREE["트리 렌더링"]
  HEADER --> TREE
  TREE --> ITEM["TaskItem 재귀 호출<br/><small>depth+1로 자식 렌더링</small>"]

  style START fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style CHECK fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style MAP fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style ROOT fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style STATS fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style TITLE fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style HEADER fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style EMPTY fill:#fee2e2,stroke:#ef4444,color:#1e293b
  style TREE fill:#dcfce7,stroke:#10b981,color:#1e293b
  style ITEM fill:#dcfce7,stroke:#10b981,color:#1e293b`}
          />

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>핵심 코드 분석</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            부모-자식 맵 구축과 루트 작업 추출의 핵심 로직입니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// [1] 부모-자식 맵 구축"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">childMap</span> = <span className="kw">new</span> <span className="type">Map</span>&lt;<span className="type">string</span> | <span className="type">undefined</span>, <span className="type">Task</span>[]&gt;();
            {"\n"}<span className="kw">for</span> (<span className="kw">const</span> <span className="prop">task</span> <span className="kw">of</span> <span className="prop">tasks</span>) {"{"}
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">parentKey</span> = <span className="prop">task</span>.<span className="prop">parentId</span>;
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">existing</span> = <span className="prop">childMap</span>.<span className="fn">get</span>(<span className="prop">parentKey</span>) ?? [];
            {"\n"}{"  "}<span className="prop">childMap</span>.<span className="fn">set</span>(<span className="prop">parentKey</span>, [...<span className="prop">existing</span>, <span className="prop">task</span>]);
            {"\n"}{"}"}
            {"\n"}
            {"\n"}<span className="cm">{"// [2] 루트 작업 추출 (parentId가 undefined인 항목)"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">rootTasks</span> = <span className="prop">childMap</span>.<span className="fn">get</span>(<span className="kw">undefined</span>) ?? [];
            {"\n"}
            {"\n"}<span className="cm">{"// [3] 진행률 요약 계산"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">completed</span> = <span className="prop">tasks</span>.<span className="fn">filter</span>(<span className="prop">t</span> =&gt; <span className="prop">t</span>.<span className="prop">status</span> === <span className="str">&quot;completed&quot;</span>).<span className="prop">length</span>;
            {"\n"}<span className="kw">const</span> <span className="prop">total</span> = <span className="prop">tasks</span>.<span className="prop">length</span>;
          </CodeBlock>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
            <p><strong className="text-gray-900">[1]</strong> 모든 작업을 순회하며 <code className="text-cyan-600">parentId</code>를 키로 하는 Map을 구축합니다. 같은 부모를 가진 작업들이 배열로 그룹화됩니다.</p>
            <p><strong className="text-gray-900">[2]</strong> <code className="text-cyan-600">parentId</code>가 <code className="text-cyan-600">undefined</code>인 작업을 루트 작업으로 추출합니다. 이들이 트리의 최상위 노드가 됩니다.</p>
            <p><strong className="text-gray-900">[3]</strong> 전체 작업 중 <code className="text-cyan-600">completed</code> 상태인 것을 카운트하여 진행률 요약에 사용합니다.</p>
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
              &quot;작업이 있는데 화면에 아무것도 안 나와요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              모든 작업의 <code className="text-cyan-600">parentId</code>가 존재하지 않는 id를 참조하고 있을 수 있습니다.
              루트 작업은 반드시 <code className="text-cyan-600">parentId</code>가 <code className="text-cyan-600">undefined</code>여야 합니다.
            </p>
            <Callout type="tip" icon="*">
              적어도 하나의 작업은 <code>parentId</code>가 <code>undefined</code>이어야
              트리의 시작점이 됩니다.
            </Callout>
          </div>

          {/* FAQ 2 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;진행률이 0/0으로 표시돼요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">title</code> prop을 지정하지 않으면 진행률 요약 자체가 표시되지 않습니다.
              진행률을 보려면 <code className="text-cyan-600">title</code>을 전달하세요.
            </p>
          </div>

          {/* FAQ 3 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;작업 상태가 변경되었는데 색상이 안 바뀌어요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">tasks</code> 배열이 새로운 참조로 전달되어야 React가 리렌더링합니다.
              기존 배열을 직접 수정(mutate)하면 변경이 감지되지 않습니다.
              항상 <code className="text-cyan-600">readonly</code> 배열을 spread 복사로 갱신하세요.
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
                name: "TaskViewPanel.tsx",
                slug: "task-view-panel",
                relation: "sibling",
                desc: "작업 목록을 테이블 형태로 표시하는 토글 가능한 오버레이 패널",
              },
              {
                name: "task-manager.ts",
                slug: "task-manager",
                relation: "parent",
                desc: "작업 생성, 상태 관리, 부모-자식 관계를 관리하는 코어 모듈",
              },
              {
                name: "TeammateStatus.tsx",
                slug: "teammate-status",
                relation: "sibling",
                desc: "멀티 에이전트 팀의 상태를 표시하는 컴포넌트 모음",
              },
            ]}
          />
        </section>
      </RevealOnScroll>
    </div></div>
  );
}

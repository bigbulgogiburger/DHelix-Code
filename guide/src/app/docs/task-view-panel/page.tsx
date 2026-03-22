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

export default function TaskViewPanelPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}><div className="center-narrow">
      {/* ─── Header ─── */}
      <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <FilePath path="src/cli/components/TaskViewPanel.tsx" />
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
            <span className="text-gray-900">
              TaskViewPanel
            </span>
          </h1>
          <div className="flex items-center gap-3 mb-5">
            <LayerBadge layer="cli" />
          </div>
          <p className="text-[16px] text-gray-600 leading-relaxed">
            멀티 에이전트 작업의 진행 상황을 테이블 형태로 보여주는 토글 가능한 오버레이 패널입니다.
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
              <code className="text-cyan-600">TaskViewPanel</code>은 Ctrl+T로 표시/숨김을 토글할 수 있는
              오버레이 패널입니다. 각 작업을 우선순위(★), 상태(아이콘), 제목, 담당자 열로 구성된
              테이블 형태로 보여줍니다.
            </p>
            <p>
              이 파일에는 표시용 타입 정의, 상수(아이콘/색상/우선순위/정렬 가중치), 헬퍼 함수(정렬/통계/아이콘 조회),
              서브 컴포넌트(<code className="text-cyan-600">TaskRow</code>, <code className="text-cyan-600">TaskSummaryBar</code>),
              그리고 메인 패널 컴포넌트가 모두 포함되어 있습니다.
            </p>
            <p>
              작업은 기본적으로 우선순위 순으로 정렬됩니다: <code className="text-red-600">critical</code>(★★★★) →
              <code className="text-yellow-600">high</code>(★★★) → <code className="text-blue-600">medium</code>(★★) →
              <code className="text-gray-500">low</code>(★). 하단에는 상태별 요약 바가 표시됩니다.
            </p>
          </div>

          <MermaidDiagram
            title="TaskViewPanel 아키텍처 위치"
            titleColor="purple"
            chart={`graph TD
  APP["App.tsx<br/><small>Ctrl+T 토글 관리</small>"]
  TVP["TaskViewPanel<br/><small>오버레이 패널</small>"]
  TR["TaskRow<br/><small>개별 작업 행</small>"]
  TSB["TaskSummaryBar<br/><small>상태별 요약</small>"]
  SORT["sortTasks<br/><small>우선순위/상태 정렬</small>"]
  STATS["getTaskStats<br/><small>통계 집계</small>"]

  APP -->|"visible, tasks"| TVP
  TVP -->|"정렬된 tasks"| TR
  TVP -->|"stats 객체"| TSB
  TVP -->|"tasks 정렬"| SORT
  TVP -->|"통계 계산"| STATS

  style TVP fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style TR fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style TSB fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style SORT fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style STATS fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style APP fill:#e0e7ff,stroke:#64748b,color:#1e293b`}
          />

          <Callout type="info" icon="💡">
            <strong>비유:</strong> 프로젝트 관리 도구의 칸반 보드를 떠올리세요. TaskViewPanel은
            모든 작업을 한 화면에 표 형태로 정리하여 보여주며, 각 행에는 우선순위 별, 상태 아이콘,
            제목, 담당자가 깔끔하게 정렬되어 있습니다.
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 2. 레퍼런스 (Reference) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>📖</span> 레퍼런스
          </h2>

          {/* TaskDisplayItem */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface TaskDisplayItem
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            표시용으로 간소화된 작업 데이터입니다. 코어의 Task와 달리 UI 표시에 필요한 필드만 포함합니다.
          </p>
          <ParamTable
            params={[
              { name: "id", type: "string", required: true, desc: "작업 고유 식별자" },
              { name: "title", type: "string", required: true, desc: "작업 제목 (40자 초과 시 말줄임 처리)" },
              { name: "status", type: "string", required: true, desc: "작업 상태 (pending, in_progress, completed, failed, blocked, cancelled)" },
              { name: "priority", type: "string", required: true, desc: "우선순위 (critical, high, medium, low)" },
              { name: "assignedTo", type: "string", required: false, desc: "담당 에이전트 이름 (시안색으로 표시)" },
              { name: "dependsOn", type: "readonly string[]", required: false, desc: "의존하는 작업 ID 배열 (개수만 표시)" },
              { name: "elapsed", type: "number", required: false, desc: "경과 시간 (밀리초)" },
              { name: "results", type: "string", required: false, desc: "작업 결과 요약 텍스트" },
            ]}
          />

          {/* TaskViewOptions */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface TaskViewOptions
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            작업 정렬 및 필터링 옵션입니다.
          </p>
          <ParamTable
            params={[
              { name: "sortBy", type: '"priority" | "status" | "created"', required: true, desc: '정렬 기준 — 우선순위, 상태, 또는 생성 순서' },
              { name: "filterStatus", type: "string", required: false, desc: "특정 상태만 표시할 필터 (미사용 시 전체 표시)" },
              { name: "showCompleted", type: "boolean", required: true, desc: "완료된 작업도 표시할지 여부" },
            ]}
          />

          {/* TaskStats */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface TaskStats
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            집계된 작업 통계입니다. <code className="text-cyan-600">TaskSummaryBar</code>에 전달됩니다.
          </p>
          <ParamTable
            params={[
              { name: "total", type: "number", required: true, desc: "전체 작업 수" },
              { name: "completed", type: "number", required: true, desc: "완료된 작업 수" },
              { name: "running", type: "number", required: true, desc: "실행 중인 작업 수" },
              { name: "pending", type: "number", required: true, desc: "대기 중인 작업 수" },
              { name: "blocked", type: "number", required: true, desc: "차단된 작업 수" },
              { name: "failed", type: "number", required: true, desc: "실패한 작업 수" },
              { name: "cancelled", type: "number", required: true, desc: "취소된 작업 수" },
            ]}
          />

          {/* Exported helper functions */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            헬퍼 함수들
          </h3>

          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            sortTasks(tasks, sortBy)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            지정된 기준으로 작업을 정렬합니다. 원본 배열을 변경하지 않고 새 배열을 반환합니다.
          </p>
          <CodeBlock>
            <span className="kw">export function</span> <span className="fn">sortTasks</span>(
            {"\n"}{"  "}<span className="prop">tasks</span>: <span className="type">readonly TaskDisplayItem</span>[],
            {"\n"}{"  "}<span className="prop">sortBy</span>: <span className="type">string</span>,
            {"\n"}): <span className="type">readonly TaskDisplayItem</span>[]
          </CodeBlock>
          <ParamTable
            params={[
              { name: "tasks", type: "readonly TaskDisplayItem[]", required: true, desc: "정렬할 작업 배열" },
              { name: "sortBy", type: "string", required: true, desc: '"priority" → 우선순위순, "status" → 상태순, "created" → 원래 순서' },
            ]}
          />

          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            getTaskStats(tasks)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            작업 목록에서 상태별 집계 통계를 계산하여 <code className="text-cyan-600">TaskStats</code> 객체를 반환합니다.
          </p>
          <CodeBlock>
            <span className="kw">export function</span> <span className="fn">getTaskStats</span>(<span className="prop">tasks</span>: <span className="type">readonly TaskDisplayItem</span>[]): <span className="type">TaskStats</span>
          </CodeBlock>

          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            truncateTitle(title, maxLength?)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            제목을 최대 길이로 자르고, 초과 시 말줄임(…)을 추가합니다. 기본 최대 길이는 40자입니다.
          </p>
          <CodeBlock>
            <span className="kw">export function</span> <span className="fn">truncateTitle</span>(<span className="prop">title</span>: <span className="type">string</span>, <span className="prop">maxLength</span>?: <span className="type">number</span>): <span className="type">string</span>
          </CodeBlock>

          {/* TaskViewPanelProps */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface TaskViewPanelProps
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            메인 패널 컴포넌트의 Props입니다.
          </p>
          <ParamTable
            params={[
              { name: "visible", type: "boolean", required: true, desc: "패널 표시 여부 (false면 null 반환)" },
              { name: "tasks", type: "readonly TaskDisplayItem[]", required: true, desc: "표시할 작업 배열" },
              { name: "teamName", type: "string", required: false, desc: "헤더에 표시할 팀/프로젝트 이름" },
              { name: "onClose", type: "() => void", required: false, desc: "패널 닫기 요청 시 호출되는 콜백" },
            ]}
          />

          {/* Caveats */}
          <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
          <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
            <li>
              이 컴포넌트는 키보드 입력을 직접 처리하지 않습니다. Ctrl+T 토글은
              부모 컴포넌트(<code className="text-cyan-600">App.tsx</code>)에서 관리합니다.
            </li>
            <li>
              <code className="text-cyan-600">visible</code>이 <code className="text-cyan-600">false</code>이면
              <code className="text-cyan-600">null</code>을 반환하여 DOM에 아무것도 렌더링하지 않습니다.
            </li>
            <li>
              작업 정렬은 항상 <code className="text-cyan-600">&quot;priority&quot;</code> 기준으로 고정되어 있습니다.
              현재 <code className="text-cyan-600">TaskViewOptions</code>의 <code className="text-cyan-600">sortBy</code>를
              동적으로 변경하는 UI는 구현되어 있지 않습니다.
            </li>
            <li>
              <code className="text-cyan-600">TaskRow</code>와 <code className="text-cyan-600">TaskSummaryBar</code>는
              <code className="text-cyan-600">React.memo</code>로 감싸져 있어 불필요한 리렌더링을 방지합니다.
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
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>기본 사용법 &mdash; 오버레이 패널 표시하기</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            부모 컴포넌트에서 <code className="text-cyan-600">visible</code> 상태를 관리하고,
            Ctrl+T 등의 키보드 단축키로 토글합니다.
          </p>
          <CodeBlock>
            <span className="kw">import</span> {"{"} <span className="type">TaskViewPanel</span> {"}"} <span className="kw">from</span> <span className="str">&quot;./TaskViewPanel.js&quot;</span>;
            {"\n"}
            {"\n"}<span className="cm">{"// 부모 컴포넌트에서 토글 상태 관리"}</span>
            {"\n"}<span className="kw">const</span> [<span className="prop">visible</span>, <span className="prop">setVisible</span>] = <span className="fn">useState</span>(<span className="kw">false</span>);
            {"\n"}
            {"\n"}<span className="cm">{"// Ctrl+T로 토글"}</span>
            {"\n"}<span className="fn">useInput</span>((<span className="prop">_input</span>, <span className="prop">key</span>) =&gt; {"{"}
            {"\n"}{"  "}<span className="kw">if</span> (<span className="prop">key</span>.<span className="prop">ctrl</span> && <span className="prop">_input</span> === <span className="str">&quot;t&quot;</span>) {"{"}
            {"\n"}{"    "}<span className="fn">setVisible</span>(<span className="prop">v</span> =&gt; !<span className="prop">v</span>);
            {"\n"}{"  "}{"}"}
            {"\n"}{"}"});
            {"\n"}
            {"\n"}&lt;<span className="type">TaskViewPanel</span>
            {"\n"}{"  "}<span className="prop">visible</span>={"{"}visible{"}"}
            {"\n"}{"  "}<span className="prop">tasks</span>={"{"}tasks{"}"}
            {"\n"}{"  "}<span className="prop">teamName</span>=<span className="str">&quot;Backend Team&quot;</span>
            {"\n"}/&gt;
          </CodeBlock>

          <Callout type="warn" icon="!">
            <strong>주의:</strong> <code>TaskDisplayItem</code>의 <code>status</code> 필드는
            코어의 <code>TaskStatus</code> 타입이 아니라 <code>string</code>입니다.
            정의되지 않은 상태값을 전달하면 아이콘이 &quot;?&quot;로, 색상이 &quot;gray&quot;로 표시됩니다.
          </Callout>

          {/* 헬퍼 함수 직접 사용 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; 헬퍼 함수 직접 사용하기
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">sortTasks</code>, <code className="text-cyan-600">getTaskStats</code>,
            <code className="text-cyan-600">getStatusIcon</code> 등은 모두 export되어 다른 컴포넌트에서도 사용할 수 있습니다.
          </p>
          <CodeBlock>
            <span className="kw">import</span> {"{"}
            {"\n"}{"  "}<span className="type">sortTasks</span>,
            {"\n"}{"  "}<span className="type">getTaskStats</span>,
            {"\n"}{"  "}<span className="type">getStatusIcon</span>,
            {"\n"}{"  "}<span className="type">getPriorityStars</span>,
            {"\n"}{"}"} <span className="kw">from</span> <span className="str">&quot;./TaskViewPanel.js&quot;</span>;
            {"\n"}
            {"\n"}<span className="cm">{"// 상태순으로 정렬"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">sorted</span> = <span className="fn">sortTasks</span>(<span className="prop">tasks</span>, <span className="str">&quot;status&quot;</span>);
            {"\n"}
            {"\n"}<span className="cm">{"// 통계 집계"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">stats</span> = <span className="fn">getTaskStats</span>(<span className="prop">tasks</span>);
            {"\n"}<span className="fn">console</span>.<span className="fn">log</span>(<span className="str">`${"{"}</span><span className="prop">stats</span>.<span className="prop">completed</span><span className="str">{"}"}/${"{"}</span><span className="prop">stats</span>.<span className="prop">total</span><span className="str">{"}"} 완료`</span>);
            {"\n"}
            {"\n"}<span className="cm">{"// 아이콘/별 직접 조회"}</span>
            {"\n"}<span className="fn">getStatusIcon</span>(<span className="str">&quot;completed&quot;</span>); <span className="cm">{"// → ●"}</span>
            {"\n"}<span className="fn">getPriorityStars</span>(<span className="str">&quot;high&quot;</span>);{"     "}<span className="cm">{"// → ★★★"}</span>
          </CodeBlock>

          <Callout type="tip" icon="*">
            <strong>팁:</strong> <code>sortTasks</code>는 원본 배열을 변경하지 않고 새 배열을 반환합니다.
            <code>readonly</code> 배열을 안전하게 전달할 수 있습니다.
          </Callout>

          <DeepDive title="우선순위/상태 정렬 가중치 체계">
            <p className="mb-3">
              정렬은 각 값에 할당된 숫자 가중치를 비교하여 수행됩니다.
              숫자가 작을수록 목록 앞에 배치됩니다.
            </p>
            <div className="grid grid-cols-2 gap-4 text-[13px] text-gray-600">
              <div>
                <p className="font-bold text-gray-900 mb-2">우선순위 가중치</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>critical: 0 (최우선)</li>
                  <li>high: 1</li>
                  <li>medium: 2</li>
                  <li>low: 3</li>
                </ul>
              </div>
              <div>
                <p className="font-bold text-gray-900 mb-2">상태 가중치</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>in_progress: 0 (최우선)</li>
                  <li>pending: 1</li>
                  <li>blocked: 2</li>
                  <li>failed: 3</li>
                  <li>completed: 4</li>
                  <li>cancelled: 5</li>
                </ul>
              </div>
            </div>
            <p className="mt-3 text-amber-600">
              정의되지 않은 값은 가중치 99가 할당되어 목록 맨 뒤로 밀립니다.
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

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>패널 렌더링 구조</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            패널은 파란색 테두리의 Box 안에 헤더, 열 제목, 구분선, 작업 행, 요약 바, 안내문이
            세로로 배치됩니다.
          </p>

          <MermaidDiagram
            title="TaskViewPanel 렌더링 구조"
            titleColor="purple"
            chart={`graph TD
  VISIBLE{"visible === true?"}
  VISIBLE -->|"아니오"| NULL["null 반환<br/><small>렌더링 없음</small>"]
  VISIBLE -->|"예"| PANEL["Panel Box<br/><small>borderStyle=single, blue</small>"]
  PANEL --> HEADER["헤더<br/><small>Task View + teamName</small>"]
  PANEL --> EMPTY{"tasks.length === 0?"}
  EMPTY -->|"예"| NODATA["'No tasks.' 표시"]
  EMPTY -->|"아니오"| COLUMNS["열 제목<br/><small>Priority | Status | Title | Assigned</small>"]
  COLUMNS --> SEP["구분선<br/><small>────────</small>"]
  SEP --> ROWS["TaskRow 반복<br/><small>useMemo 정렬 결과</small>"]
  ROWS --> SUMMARY["TaskSummaryBar<br/><small>N/M complete | N running</small>"]
  PANEL --> FOOTER["안내문<br/><small>Press Ctrl+T to close</small>"]

  style PANEL fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style VISIBLE fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style EMPTY fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style HEADER fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style COLUMNS fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style ROWS fill:#dcfce7,stroke:#10b981,color:#1e293b
  style SUMMARY fill:#dcfce7,stroke:#10b981,color:#1e293b
  style NULL fill:#fee2e2,stroke:#ef4444,color:#1e293b
  style NODATA fill:#fee2e2,stroke:#ef4444,color:#1e293b
  style SEP fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style FOOTER fill:#f1f5f9,stroke:#64748b,color:#1e293b`}
          />

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>핵심 코드 분석</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            패널 내부에서 <code className="text-cyan-600">useMemo</code>를 사용하여 정렬과 통계를
            캐싱하는 패턴입니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// [1] 우선순위 기준으로 정렬 (tasks 변경 시에만 재계산)"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">sorted</span> = <span className="fn">useMemo</span>(() =&gt; <span className="fn">sortTasks</span>(<span className="prop">tasks</span>, <span className="str">&quot;priority&quot;</span>), [<span className="prop">tasks</span>]);
            {"\n"}
            {"\n"}<span className="cm">{"// [2] 상태별 통계 계산 (tasks 변경 시에만 재계산)"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">stats</span> = <span className="fn">useMemo</span>(() =&gt; <span className="fn">getTaskStats</span>(<span className="prop">tasks</span>), [<span className="prop">tasks</span>]);
            {"\n"}
            {"\n"}<span className="cm">{"// [3] visible이 false면 즉시 null 반환"}</span>
            {"\n"}<span className="kw">if</span> (!<span className="prop">visible</span>) <span className="kw">return</span> <span className="kw">null</span>;
          </CodeBlock>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
            <p><strong className="text-gray-900">[1]</strong> <code className="text-cyan-600">sortTasks</code>는 내부에서 배열을 복사(<code>[...tasks]</code>)한 뒤 정렬하므로 원본을 변경하지 않습니다. <code className="text-cyan-600">useMemo</code> 덕분에 tasks 참조가 같으면 재정렬하지 않습니다.</p>
            <p><strong className="text-gray-900">[2]</strong> 통계 객체도 메모이제이션됩니다. <code className="text-cyan-600">TaskSummaryBar</code>가 <code className="text-cyan-600">React.memo</code>로 감싸져 있어 stats가 같으면 리렌더링하지 않습니다.</p>
            <p><strong className="text-gray-900">[3]</strong> <code className="text-cyan-600">useMemo</code> 호출 후에 <code className="text-cyan-600">visible</code> 체크를 합니다. Hook 규칙상 조건부 렌더링 전에 모든 Hook을 호출해야 하기 때문입니다.</p>
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
              &quot;Ctrl+T를 눌러도 패널이 안 나와요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              이 컴포넌트 자체는 키보드 입력을 처리하지 않습니다.
              부모 컴포넌트(<code className="text-cyan-600">App.tsx</code>)에서
              <code className="text-cyan-600">visible</code> 상태를 토글하는 로직이 올바르게 연결되어 있는지 확인하세요.
            </p>
          </div>

          {/* FAQ 2 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;작업 제목이 잘려서 보여요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">truncateTitle</code>이 기본적으로 40자 제한을 적용합니다.
              이는 <code className="text-cyan-600">MAX_TITLE_LENGTH</code> 상수로 제어되며,
              모듈 내부에 하드코딩되어 있어 외부에서 변경할 수 없습니다.
            </p>
          </div>

          {/* FAQ 3 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;상태 아이콘이 ?로 표시돼요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">STATUS_ICONS</code>에 정의되지 않은 상태값을 사용하고 있습니다.
              유효한 상태는 <code className="text-cyan-600">pending</code>,
              <code className="text-cyan-600">in_progress</code>,
              <code className="text-cyan-600">completed</code>,
              <code className="text-cyan-600">failed</code>,
              <code className="text-cyan-600">blocked</code>,
              <code className="text-cyan-600">cancelled</code>입니다.
            </p>
          </div>

          {/* FAQ 4 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;요약 바에 pending 수가 안 보여요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">TaskSummaryBar</code>는 0보다 큰 값만 표시합니다.
              <code className="text-cyan-600">running</code>, <code className="text-cyan-600">blocked</code>,
              <code className="text-cyan-600">failed</code>, <code className="text-cyan-600">cancelled</code>가
              0이면 해당 항목은 생략됩니다. <code className="text-cyan-600">pending</code>은
              요약 바에 표시되지 않는 항목입니다 (완료 비율만 표시).
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
                name: "TaskListView.tsx",
                slug: "task-list-view",
                relation: "sibling",
                desc: "작업 목록을 트리 형태로 표시하는 경량 컴포넌트",
              },
              {
                name: "TeammateStatus.tsx",
                slug: "teammate-status",
                relation: "sibling",
                desc: "팀 멤버(서브에이전트)의 상태를 표시하는 컴포넌트 — 동일한 아이콘/색상 규칙 사용",
              },
              {
                name: "task-manager.ts",
                slug: "task-manager",
                relation: "parent",
                desc: "작업 생성/관리/상태 변경을 담당하는 코어 모듈",
              },
              {
                name: "subagent-task-list.ts",
                slug: "subagent-task-list",
                relation: "sibling",
                desc: "서브에이전트 작업 목록을 관리하는 SharedTaskList 구현",
              },
            ]}
          />
        </section>
      </RevealOnScroll>
    </div></div>
  );
}

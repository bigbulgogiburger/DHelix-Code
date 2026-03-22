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

export default function TeammateStatusPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}><div className="center-narrow">
      {/* ─── Header ─── */}
      <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <FilePath path="src/cli/components/TeammateStatus.tsx" />
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
            <span className="text-gray-900">
              TeammateStatus
            </span>
          </h1>
          <div className="flex items-center gap-3 mb-5">
            <LayerBadge layer="cli" />
          </div>
          <p className="text-[16px] text-gray-600 leading-relaxed">
            멀티 에이전트 팀의 팀원(서브에이전트) 상태를 세 가지 수준으로 표시하는 컴포넌트 모음입니다.
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
              <code className="text-cyan-600">TeammateStatus.tsx</code>는 멀티 에이전트 실행 시
              팀원들의 상태를 시각적으로 보여주는 세 가지 컴포넌트를 제공합니다.
              타입 정의, 헬퍼 함수, 컴포넌트가 하나의 파일에 모두 포함되어 있습니다.
            </p>
            <p>
              세 가지 표시 수준:
              <code className="text-cyan-600">TeammateIndicator</code>는 상태 바에 한 줄 요약을,
              <code className="text-cyan-600">TeammateDetailPanel</code>은 팀별 상세 패널을,
              <code className="text-cyan-600">TeamMemberRow</code>는 개별 멤버의 상태를 표시합니다.
            </p>
            <p>
              상태 아이콘과 색상 체계는 <code className="text-cyan-600">TaskViewPanel</code>과
              동일한 규칙을 따릅니다: <code className="text-gray-500">○</code> 대기,
              <code className="text-yellow-600">◐</code> 실행 중,
              <code className="text-emerald-600">●</code> 완료,
              <code className="text-red-600">✕</code> 실패,
              <code className="text-gray-500">⊘</code> 취소.
            </p>
          </div>

          <MermaidDiagram
            title="TeammateStatus 아키텍처 위치"
            titleColor="purple"
            chart={`graph TD
  APP["App.tsx<br/><small>메인 애플리케이션</small>"]
  SB["StatusBar<br/><small>상태 바 영역</small>"]
  TI["TeammateIndicator<br/><small>한 줄 요약</small>"]
  TDP["TeammateDetailPanel<br/><small>팀별 상세 패널</small>"]
  TMR["TeamMemberRow<br/><small>개별 멤버 행</small>"]
  TMS["TeamManager<br/><small>core/team-manager.ts</small>"]

  APP --> SB
  SB -->|"teams 배열"| TI
  APP -->|"teams 배열"| TDP
  TDP -->|"member 반복"| TMR
  TMS -->|"TeamSession 데이터"| APP

  style TI fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style TDP fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style TMR fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style APP fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style SB fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style TMS fill:#e0e7ff,stroke:#64748b,color:#1e293b`}
          />

          <Callout type="info" icon="💡">
            <strong>비유:</strong> 채팅 앱의 온라인 상태 표시를 떠올리세요.
            <code>TeammateIndicator</code>는 &quot;3명 온라인&quot; 같은 요약이고,
            <code>TeammateDetailPanel</code>은 친구 목록을 펼친 것이며,
            <code>TeamMemberRow</code>는 각 친구의 상세 상태를 나타냅니다.
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 2. 레퍼런스 (Reference) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>📖</span> 레퍼런스
          </h2>

          {/* TeamMemberSummary */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface TeamMemberSummary
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            표시용 팀 멤버 데이터입니다. 코어의 상세한 에이전트 데이터에서 UI에 필요한 필드만 추출한 것입니다.
          </p>
          <ParamTable
            params={[
              { name: "name", type: "string", required: true, desc: "멤버 이름 (최대 20자, 초과 시 말줄임)" },
              { name: "role", type: "string", required: true, desc: "멤버 역할 (예: researcher, coder)" },
              { name: "status", type: "string", required: true, desc: "상태 (pending, running, completed, failed, cancelled)" },
              { name: "elapsed", type: "number", required: false, desc: "경과 시간 (밀리초, 0보다 클 때만 표시)" },
            ]}
          />

          {/* TeamSessionSummary */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface TeamSessionSummary
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            표시용 팀 세션 데이터입니다. 팀 이름, 상태, 소속 멤버 배열을 포함합니다.
          </p>
          <ParamTable
            params={[
              { name: "id", type: "string", required: true, desc: "팀 세션 고유 ID" },
              { name: "name", type: "string", required: true, desc: "팀 이름 (최대 40자, 초과 시 말줄임)" },
              { name: "status", type: "string", required: true, desc: '팀 상태 ("active", "running", "completed" 등)' },
              { name: "members", type: "readonly TeamMemberSummary[]", required: true, desc: "소속 멤버 배열" },
              { name: "createdAt", type: "number", required: true, desc: "팀 생성 시각 (타임스탬프)" },
              { name: "completedAt", type: "number", required: false, desc: "팀 완료 시각 (미완료 시 undefined)" },
            ]}
          />

          {/* 헬퍼 함수들 */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            헬퍼 함수들
          </h3>

          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            formatElapsedTime(ms)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            밀리초를 사람이 읽기 쉬운 문자열로 변환합니다.
          </p>
          <CodeBlock>
            <span className="kw">export function</span> <span className="fn">formatElapsedTime</span>(<span className="prop">ms</span>: <span className="type">number</span>): <span className="type">string</span>
            {"\n"}<span className="cm">{"// 예시: 5000 → \"5s\", 150000 → \"2m 30s\", 4500000 → \"1h 15m\""}</span>
          </CodeBlock>

          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            getTeamProgress(members)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            팀 멤버 중 완료된 수와 전체 수를 반환합니다.
          </p>
          <CodeBlock>
            <span className="kw">export function</span> <span className="fn">getTeamProgress</span>(<span className="prop">members</span>: <span className="type">readonly TeamMemberSummary</span>[]): {"{"}
            {"\n"}{"  "}<span className="kw">readonly</span> <span className="prop">completed</span>: <span className="type">number</span>;
            {"\n"}{"  "}<span className="kw">readonly</span> <span className="prop">total</span>: <span className="type">number</span>;
            {"\n"}{"}"}
          </CodeBlock>

          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            countActiveTeams(teams)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            활성 팀 수를 계산합니다. <code className="text-cyan-600">&quot;active&quot;</code> 또는
            <code className="text-cyan-600">&quot;running&quot;</code> 상태인 팀만 카운트합니다.
          </p>
          <CodeBlock>
            <span className="kw">export function</span> <span className="fn">countActiveTeams</span>(<span className="prop">teams</span>: <span className="type">readonly TeamSessionSummary</span>[]): <span className="type">number</span>
          </CodeBlock>

          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            getAggregateMemberCounts(teams)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            모든 팀의 멤버 수를 합산하여 전체 완료/전체 수를 반환합니다.
          </p>
          <CodeBlock>
            <span className="kw">export function</span> <span className="fn">getAggregateMemberCounts</span>(<span className="prop">teams</span>: <span className="type">readonly TeamSessionSummary</span>[]): {"{"}
            {"\n"}{"  "}<span className="kw">readonly</span> <span className="prop">completed</span>: <span className="type">number</span>;
            {"\n"}{"  "}<span className="kw">readonly</span> <span className="prop">total</span>: <span className="type">number</span>;
            {"\n"}{"}"}
          </CodeBlock>

          {/* 컴포넌트 Props */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            컴포넌트 Props
          </h3>

          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            TeammateIndicatorProps
          </h4>
          <ParamTable
            params={[
              { name: "teams", type: "readonly TeamSessionSummary[]", required: true, desc: "표시할 팀 세션 배열 (비어 있으면 null 반환)" },
            ]}
          />

          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            TeammateDetailPanelProps
          </h4>
          <ParamTable
            params={[
              { name: "teams", type: "readonly TeamSessionSummary[]", required: true, desc: "표시할 팀 세션 배열" },
              { name: "expanded", type: "boolean", required: false, desc: "확장 모드 여부 (기본값: true, false면 헤더+진행률만 표시)" },
            ]}
          />

          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            TeamMemberRowProps
          </h4>
          <ParamTable
            params={[
              { name: "member", type: "TeamMemberSummary", required: true, desc: "표시할 멤버 데이터" },
              { name: "maxNameLength", type: "number", required: false, desc: "이름 최대 표시 길이 (기본값: 20)" },
            ]}
          />

          {/* Caveats */}
          <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
          <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
            <li>
              <code className="text-cyan-600">TeammateIndicator</code>와
              <code className="text-cyan-600">TeammateDetailPanel</code> 모두 팀 배열이 비어 있으면
              <code className="text-cyan-600">null</code>을 반환합니다.
            </li>
            <li>
              상태 키가 <code className="text-cyan-600">TaskViewPanel</code>과 다릅니다.
              여기서는 <code className="text-cyan-600">&quot;running&quot;</code>을 사용하고,
              TaskViewPanel은 <code className="text-cyan-600">&quot;in_progress&quot;</code>를 사용합니다.
            </li>
            <li>
              <code className="text-cyan-600">formatElapsedTime</code>은 음수 입력에 대해
              <code className="text-cyan-600">&quot;0s&quot;</code>를 반환합니다.
            </li>
            <li>
              모든 컴포넌트가 <code className="text-cyan-600">React.memo</code>로 감싸져 있어
              props 변경이 없으면 리렌더링하지 않습니다.
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

          {/* TeammateIndicator 사용법 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            기본 사용법 &mdash; 상태 바에 간략 표시
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">TeammateIndicator</code>는 상태 바 영역에 한 줄로
            팀 요약을 표시합니다.
          </p>
          <CodeBlock>
            <span className="kw">import</span> {"{"} <span className="type">TeammateIndicator</span> {"}"} <span className="kw">from</span> <span className="str">&quot;./TeammateStatus.js&quot;</span>;
            {"\n"}
            {"\n"}<span className="cm">{"// 상태 바에 팀 요약 표시"}</span>
            {"\n"}&lt;<span className="type">TeammateIndicator</span> <span className="prop">teams</span>={"{"}teams{"}"} /&gt;
            {"\n"}
            {"\n"}<span className="cm">{"// 출력 예시:"}</span>
            {"\n"}<span className="cm">{"// [Teams: 2 active | 5/8 members done]"}</span>
          </CodeBlock>

          <Callout type="warn" icon="!">
            <strong>주의:</strong> <code>TeammateIndicator</code>는 모든 멤버가 완료되면 색상이
            초록색으로 바뀌고, 아직 진행 중이면 노란색으로 표시됩니다.
            팀이 없으면(<code>teams.length === 0</code>) 아무것도 렌더링하지 않습니다.
          </Callout>

          {/* TeammateDetailPanel 사용법 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; 상세 패널 표시
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">TeammateDetailPanel</code>은 팀마다 테두리가 있는 박스로
            멤버 행을 표시합니다.
          </p>
          <CodeBlock>
            <span className="kw">import</span> {"{"} <span className="type">TeammateDetailPanel</span> {"}"} <span className="kw">from</span> <span className="str">&quot;./TeammateStatus.js&quot;</span>;
            {"\n"}
            {"\n"}<span className="cm">{"// 확장 모드 (기본) — 모든 멤버 행 표시"}</span>
            {"\n"}&lt;<span className="type">TeammateDetailPanel</span> <span className="prop">teams</span>={"{"}teams{"}"} /&gt;
            {"\n"}
            {"\n"}<span className="cm">{"// 축소 모드 — 팀 헤더와 진행률만 표시"}</span>
            {"\n"}&lt;<span className="type">TeammateDetailPanel</span> <span className="prop">teams</span>={"{"}teams{"}"} <span className="prop">expanded</span>={"{"}false{"}"} /&gt;
          </CodeBlock>

          <Callout type="tip" icon="*">
            <strong>팁:</strong> 모든 멤버가 완료된 팀은 테두리가 초록색으로, 아직 진행 중인 팀은
            노란색으로 표시됩니다. 이를 통해 어느 팀이 아직 작업 중인지 한눈에 파악할 수 있습니다.
          </Callout>

          {/* 헬퍼 함수 활용 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; 헬퍼 함수 활용
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            모든 헬퍼 함수가 export되어 다른 컴포넌트에서도 활용 가능합니다.
          </p>
          <CodeBlock>
            <span className="kw">import</span> {"{"}
            {"\n"}{"  "}<span className="type">formatElapsedTime</span>,
            {"\n"}{"  "}<span className="type">getTeamProgress</span>,
            {"\n"}{"  "}<span className="type">countActiveTeams</span>,
            {"\n"}{"  "}<span className="type">getAggregateMemberCounts</span>,
            {"\n"}{"}"} <span className="kw">from</span> <span className="str">&quot;./TeammateStatus.js&quot;</span>;
            {"\n"}
            {"\n"}<span className="cm">{"// 경과 시간 포맷팅"}</span>
            {"\n"}<span className="fn">formatElapsedTime</span>(<span className="num">5000</span>);{"    "}<span className="cm">{"// → \"5s\""}</span>
            {"\n"}<span className="fn">formatElapsedTime</span>(<span className="num">150000</span>);{"  "}<span className="cm">{"// → \"2m 30s\""}</span>
            {"\n"}<span className="fn">formatElapsedTime</span>(<span className="num">4500000</span>); <span className="cm">{"// → \"1h 15m\""}</span>
            {"\n"}
            {"\n"}<span className="cm">{"// 팀 진행률 확인"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">progress</span> = <span className="fn">getTeamProgress</span>(<span className="prop">team</span>.<span className="prop">members</span>);
            {"\n"}<span className="fn">console</span>.<span className="fn">log</span>(<span className="str">`${"{"}</span><span className="prop">progress</span>.<span className="prop">completed</span><span className="str">{"}"}/${"{"}</span><span className="prop">progress</span>.<span className="prop">total</span><span className="str">{"}"} 완료`</span>);
          </CodeBlock>

          <DeepDive title="경과 시간 포맷팅 로직 상세">
            <p className="mb-3">
              <code className="text-cyan-600">formatElapsedTime</code>은 세 가지 단위로 변환합니다:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-gray-600">
              <li><strong>60초 미만:</strong> <code>&quot;Ns&quot;</code> (초만 표시)</li>
              <li><strong>60분 미만:</strong> <code>&quot;Nm Ns&quot;</code> (분 + 초, 초가 0이면 분만)</li>
              <li><strong>60분 이상:</strong> <code>&quot;Nh Nm&quot;</code> (시 + 분, 분이 0이면 시만)</li>
            </ul>
            <p className="mt-3 text-amber-600">
              음수 입력에 대해서는 <code>&quot;0s&quot;</code>를 반환합니다.
              밀리초를 초로 변환할 때 <code>Math.floor</code>를 사용하므로 소수점은 버림됩니다.
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

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>세 가지 표시 수준의 관계</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            이 파일의 세 컴포넌트는 서로 다른 수준의 정보를 제공하며,
            화면의 다른 영역에 배치됩니다.
          </p>

          <MermaidDiagram
            title="TeammateStatus 컴포넌트 계층"
            titleColor="purple"
            chart={`graph TD
  TEAMS["teams: TeamSessionSummary[]<br/><small>입력 데이터</small>"]

  TEAMS -->|"전체 요약"| IND["TeammateIndicator<br/><small>상태 바 한 줄 요약</small>"]
  TEAMS -->|"팀별 상세"| DET["TeammateDetailPanel<br/><small>팀 박스 + 멤버 행</small>"]
  DET -->|"멤버 반복"| ROW["TeamMemberRow<br/><small>아이콘 + 이름 + 상태 + 시간</small>"]

  IND --> OUT1["[Teams: 2 active | 5/8 done]<br/><small>노란/초록색 한 줄</small>"]
  DET --> OUT2["팀 박스 (테두리)<br/><small>노란/초록 테두리</small>"]
  ROW --> OUT3["◐ agent-1  running  5s<br/><small>개별 멤버 행</small>"]

  HELPER1["countActiveTeams<br/><small>활성 팀 수</small>"] -.-> IND
  HELPER2["getAggregateMemberCounts<br/><small>전체 완료/총 수</small>"] -.-> IND
  HELPER3["getTeamProgress<br/><small>팀별 진행률</small>"] -.-> DET
  HELPER4["formatElapsedTime<br/><small>시간 포맷팅</small>"] -.-> ROW

  style TEAMS fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style IND fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style DET fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style ROW fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style OUT1 fill:#dcfce7,stroke:#10b981,color:#1e293b
  style OUT2 fill:#dcfce7,stroke:#10b981,color:#1e293b
  style OUT3 fill:#dcfce7,stroke:#10b981,color:#1e293b
  style HELPER1 fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style HELPER2 fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style HELPER3 fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style HELPER4 fill:#fef3c7,stroke:#f59e0b,color:#1e293b`}
          />

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>핵심 코드 분석</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">TeammateDetailPanel</code>의 팀별 렌더링 로직입니다.
            완료 상태에 따라 테두리 색상이 동적으로 변합니다.
          </p>
          <CodeBlock>
            {"{"}teams.<span className="fn">map</span>((<span className="prop">team</span>) =&gt; {"{"}
            {"\n"}{"  "}<span className="cm">{"// [1] 팀 진행률 계산"}</span>
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">progress</span> = <span className="fn">getTeamProgress</span>(<span className="prop">team</span>.<span className="prop">members</span>);
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// [2] 팀명 자르기 (최대 40자)"}</span>
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">displayTeamName</span> = <span className="fn">truncateString</span>(<span className="prop">team</span>.<span className="prop">name</span>, <span className="num">40</span>);
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// [3] 전원 완료 시 초록, 아니면 노란 테두리"}</span>
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">isTeamDone</span> = <span className="prop">progress</span>.<span className="prop">completed</span> === <span className="prop">progress</span>.<span className="prop">total</span>
            {"\n"}{"    "}&& <span className="prop">progress</span>.<span className="prop">total</span> {">"} <span className="num">0</span>;
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">borderColor</span> = <span className="prop">isTeamDone</span> ? <span className="str">&quot;green&quot;</span> : <span className="str">&quot;yellow&quot;</span>;
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// [4] 축소 모드에서는 멤버 행을 숨기고 진행률만 표시"}</span>
            {"\n"}{"  "}<span className="kw">return</span> (
            {"\n"}{"    "}&lt;<span className="type">Box</span> <span className="prop">borderStyle</span>=<span className="str">&quot;single&quot;</span> <span className="prop">borderColor</span>={"{"}borderColor{"}"}&gt;
            {"\n"}{"      "}<span className="cm">{"// ... 헤더 + 멤버 행 + 진행률"}</span>
            {"\n"}{"    "}&lt;/<span className="type">Box</span>&gt;
            {"\n"}{"  "});
            {"\n"}{"}"})
          </CodeBlock>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
            <p><strong className="text-gray-900">[1]</strong> <code className="text-cyan-600">getTeamProgress</code>로 완료 멤버 수와 전체 멤버 수를 계산합니다.</p>
            <p><strong className="text-gray-900">[2]</strong> 팀 이름이 40자를 초과하면 말줄임(…)으로 잘립니다.</p>
            <p><strong className="text-gray-900">[3]</strong> 모든 멤버가 완료되면 테두리가 초록색, 아니면 노란색입니다. 멤버가 0명인 팀은 노란색입니다.</p>
            <p><strong className="text-gray-900">[4]</strong> <code className="text-cyan-600">expanded</code>가 <code className="text-cyan-600">false</code>면 멤버 행과 하단 진행률이 숨겨지고, 헤더에 축약 진행률이 표시됩니다.</p>
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
              &quot;팀 인디케이터가 화면에 안 나와요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">TeammateIndicator</code>는 <code className="text-cyan-600">teams</code> 배열이
              비어 있으면 <code className="text-cyan-600">null</code>을 반환합니다. 팀 데이터가
              올바르게 전달되고 있는지 확인하세요.
            </p>
          </div>

          {/* FAQ 2 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;멤버 이름이 잘려서 보여요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">TeamMemberRow</code>는 기본적으로 이름을 20자로 제한합니다.
              <code className="text-cyan-600">maxNameLength</code> prop을 전달하면 제한을 변경할 수 있지만,
              기본 상수 <code className="text-cyan-600">MAX_DISPLAY_NAME_LENGTH</code>는 20으로 고정되어 있습니다.
            </p>
          </div>

          {/* FAQ 3 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;active 팀 수가 0으로 나와요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              <code className="text-cyan-600">countActiveTeams</code>는 <code className="text-cyan-600">&quot;active&quot;</code>
              또는 <code className="text-cyan-600">&quot;running&quot;</code> 상태인 팀만 카운트합니다.
              팀의 <code className="text-cyan-600">status</code> 필드가 이 두 값 중 하나인지 확인하세요.
            </p>
            <Callout type="tip" icon="*">
              <code>&quot;completed&quot;</code>, <code>&quot;failed&quot;</code>, <code>&quot;cancelled&quot;</code> 상태의
              팀은 활성 팀으로 카운트되지 않습니다.
            </Callout>
          </div>

          {/* FAQ 4 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;경과 시간이 표시되지 않아요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">TeamMemberRow</code>는 <code className="text-cyan-600">elapsed</code>가
              <code className="text-cyan-600">undefined</code>이거나 0 이하일 때 경과 시간을 표시하지 않습니다.
              밀리초 단위의 양수값을 전달해야 합니다.
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
                desc: "동일한 아이콘/색상 규칙을 사용하는 작업 상세 패널 — 작업 단위 표시",
              },
              {
                name: "team-manager.ts",
                slug: "team-manager",
                relation: "parent",
                desc: "팀 생성/관리/해체를 담당하는 코어 모듈 — TeamSession 데이터 제공",
              },
              {
                name: "subagent-spawner.ts",
                slug: "subagent-spawner",
                relation: "sibling",
                desc: "서브에이전트를 생성하고 관리하는 모듈 — 멤버 상태 변경의 원천",
              },
              {
                name: "TaskListView.tsx",
                slug: "task-list-view",
                relation: "sibling",
                desc: "작업 목록을 트리 형태로 표시하는 경량 컴포넌트",
              },
            ]}
          />
        </section>
      </RevealOnScroll>
    </div></div>
  );
}

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

export default function TeamManagerPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}><div className="center-narrow">
      {/* ─── Header ─── */}
      <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <FilePath path="src/subagents/team-manager.ts" />
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
            <span className="text-gray-900">
              Team Manager
            </span>
          </h1>
          <div className="flex items-center gap-3 mb-5">
            <LayerBadge layer="infra" />
          </div>
          <p className="text-[16px] text-gray-600 leading-relaxed">
            팀 생성 + 워커 배분 + 결과 병합 &mdash; 여러 워커 에이전트로 구성된 팀을 생성하고 실행하는 오케스트레이터입니다.
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
              &quot;팀&quot;이란 공통 목표를 위해 협업하는 여러 서브에이전트의 그룹입니다.
              <code className="text-cyan-600">AgentTeamManager</code>는 이 팀의 전체 라이프사이클을 관리합니다:
              팀 생성, 의존성 인식 스케줄링(위상 정렬), 동시성 제한 병렬 실행, 실패 전파, 이벤트 알림.
            </p>
            <p>
              멤버 간 의존 관계를 분석하여 위상 정렬(Topological Sort, Kahn&apos;s Algorithm)로
              실행 순서를 결정합니다. 예를 들어 A&rarr;B&rarr;D, A&rarr;C&rarr;D에서
              실행 순서는 [A] &rarr; [B, C] &rarr; [D]가 되며, 같은 레벨(B와 C)은 병렬 실행됩니다.
            </p>
            <p>
              멤버 실패 시 해당 멤버에 의존하는 모든 후속 멤버를 BFS(너비 우선 탐색)로
              전이적(transitive)으로 취소합니다.
              의존성 주입 패턴으로 에이전트를 직접 실행하지 않고,
              외부에서 주입된 <code className="text-cyan-600">AgentExecutor</code> 함수를 통해 실행합니다.
            </p>
          </div>

          <MermaidDiagram
            title="Team Manager 아키텍처 위치"
            titleColor="purple"
            chart={`graph TD
  TOOL["Team Tool<br/><small>tools/ — /team 슬래시 명령</small>"]
  TM["Team Manager<br/><small>subagents/team-manager.ts — 오케스트레이션</small>"]
  SP["Spawner<br/><small>subagents/spawner.ts — 에이전트 실행</small>"]
  SS["Shared State<br/><small>subagents/shared-state.ts — 상태 공유</small>"]
  TT["Team Types<br/><small>subagents/team-types.ts — 타입 정의</small>"]

  TOOL -->|"createTeam + executeTeam"| TM
  TM -->|"AgentExecutor 호출"| SP
  TM -->|"팀 전용 상태 생성"| SS
  TT -->|"타입 정의 제공"| TM

  style TM fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style TOOL fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style SP fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style SS fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style TT fill:#e0e7ff,stroke:#64748b,color:#1e293b`}
          />

          <Callout type="info" icon="💡">
            <strong>비유:</strong> 건설 현장의 공정 관리자를 떠올리세요.
            기초 공사(A)가 끝나야 골조(B)와 배관(C)을 동시에 시작할 수 있고,
            둘 다 끝나야 마감(D)을 할 수 있습니다.
            Team Manager는 이런 공정 순서를 자동으로 계산하고,
            가용 인력(동시성 제한) 내에서 최대한 병렬로 작업을 진행합니다.
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 2. 레퍼런스 (Reference) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>📖</span> 레퍼런스
          </h2>

          {/* TeamManagerError class */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            class TeamManagerError
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            팀 작업 중 발생하는 에러 클래스입니다.
            <code className="text-cyan-600"> BaseError</code>를 확장하며, 에러 코드
            <code className="text-cyan-600"> &quot;TEAM_MANAGER_ERROR&quot;</code>와 팀 ID, 멤버 정보 등의 컨텍스트를 포함합니다.
          </p>
          <CodeBlock>
            <span className="kw">class</span> <span className="type">TeamManagerError</span> <span className="kw">extends</span> <span className="type">BaseError</span> {"{"}
            {"\n"}{"  "}<span className="kw">constructor</span>(<span className="prop">message</span>: <span className="type">string</span>, <span className="prop">context</span>?: <span className="type">Record</span>{"<"}<span className="type">string</span>, <span className="type">unknown</span>{">"})
            {"\n"}{"}"}
          </CodeBlock>

          {/* AgentExecutor type */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            type AgentExecutor
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            에이전트 실행 함수의 타입입니다. Team Manager는 에이전트를 직접 실행하지 않고,
            외부에서 주입된 이 함수를 통해 각 멤버를 실행합니다 (의존성 주입 패턴).
          </p>
          <CodeBlock>
            <span className="kw">type</span> <span className="type">AgentExecutor</span> = (
            {"\n"}{"  "}<span className="prop">member</span>: <span className="type">TeamMember</span>,
            {"\n"}{"  "}<span className="prop">sharedState</span>: <span className="type">SharedAgentState</span>,
            {"\n"}) ={">"} <span className="type">Promise</span>{"<"}{"{"} <span className="prop">agentId</span>: <span className="type">string</span>; <span className="prop">response</span>: <span className="type">string</span> {"}"}{">"}
          </CodeBlock>

          {/* AgentTeamManager class */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            class AgentTeamManager
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            팀을 생성하고 실행하는 핵심 오케스트레이터 클래스입니다.
          </p>

          {/* createTeam */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            createTeam(config)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            설정으로부터 새로운 팀을 생성합니다. 멤버의 dependsOn에 이름을 사용한 경우
            자동으로 UUID로 변환합니다.
          </p>
          <CodeBlock>
            <span className="fn">createTeam</span>(<span className="prop">config</span>: <span className="type">CreateTeamConfig</span>): <span className="type">TeamSession</span>
          </CodeBlock>
          <ParamTable
            params={[
              { name: "config.name", type: "string", required: true, desc: "팀 이름" },
              { name: "config.description", type: "string", required: false, desc: "팀 설명" },
              { name: "config.objective", type: "string", required: true, desc: "팀의 목표" },
              { name: "config.members", type: "MemberConfig[]", required: true, desc: "멤버 설정 배열 (최소 1명)" },
              { name: "config.maxConcurrency", type: "number", required: false, desc: "최대 동시 실행 수 (기본: 레벨 전체)" },
            ]}
          />

          {/* executeTeam */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            executeTeam(teamId, executor, options?)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            팀을 실행합니다. 의존성과 동시성을 고려하여 멤버들을 병렬 실행합니다.
          </p>
          <CodeBlock>
            <span className="kw">async</span> <span className="fn">executeTeam</span>(
            {"\n"}{"  "}<span className="prop">teamId</span>: <span className="type">string</span>,
            {"\n"}{"  "}<span className="prop">executor</span>: <span className="type">AgentExecutor</span>,
            {"\n"}{"  "}<span className="prop">options</span>?: {"{"} <span className="prop">signal</span>?: <span className="type">AbortSignal</span> {"}"},{"\n"}): <span className="type">Promise</span>{"<"}<span className="type">TeamSession</span>{">"}
          </CodeBlock>
          <ParamTable
            params={[
              { name: "teamId", type: "string", required: true, desc: "실행할 팀의 세션 ID (createTeam 반환값)" },
              { name: "executor", type: "AgentExecutor", required: true, desc: "각 멤버를 실행할 함수 (의존성 주입)" },
              { name: "options.signal", type: "AbortSignal", required: false, desc: "취소 시그널 (발동 시 대기 멤버 전부 취소)" },
            ]}
          />

          {/* cancelTeam */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            cancelTeam(teamId)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            실행 중인 팀을 취소합니다. 대기/실행 중 멤버를 &quot;cancelled&quot;로 변경합니다.
          </p>
          <CodeBlock>
            <span className="kw">async</span> <span className="fn">cancelTeam</span>(<span className="prop">teamId</span>: <span className="type">string</span>): <span className="type">Promise</span>{"<"}<span className="type">void</span>{">"}
          </CodeBlock>

          {/* getSession, getActiveSessions, getTeamSummary */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            getSession(teamId) / getActiveSessions() / getTeamSummary(teamId)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            팀 세션 조회, 활성 세션 목록, 상태 요약 텍스트를 제공합니다.
          </p>
          <CodeBlock>
            <span className="fn">getSession</span>(<span className="prop">teamId</span>: <span className="type">string</span>): <span className="type">TeamSession</span> | <span className="type">undefined</span>
            {"\n"}<span className="fn">getActiveSessions</span>(): <span className="kw">readonly</span> <span className="type">TeamSession</span>[]
            {"\n"}<span className="fn">getTeamSummary</span>(<span className="prop">teamId</span>: <span className="type">string</span>): <span className="type">string</span>
          </CodeBlock>

          {/* onEvent */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            onEvent(listener)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            팀 이벤트 리스너를 등록합니다. 해제(unsubscribe) 함수를 반환합니다.
          </p>
          <CodeBlock>
            <span className="fn">onEvent</span>(<span className="prop">listener</span>: (<span className="prop">event</span>: <span className="type">TeamEvent</span>) ={">"} <span className="type">void</span>): () ={">"} <span className="type">void</span>
          </CodeBlock>

          {/* cleanup */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            cleanup()
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            완료/실패한 팀 세션을 정리합니다. 공유 상태의 메모리를 해제하고 세션을 삭제합니다.
          </p>
          <CodeBlock>
            <span className="fn">cleanup</span>(): <span className="type">void</span>
          </CodeBlock>

          {/* Caveats */}
          <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
          <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
            <li>
              <code className="text-cyan-600">createTeam</code>은 멤버가 0명이면
              <code className="text-cyan-600"> TeamManagerError</code>를 throw합니다.
            </li>
            <li>
              <code className="text-cyan-600">executeTeam</code>은 &quot;creating&quot; 상태에서만 호출 가능합니다.
              이미 실행 중이거나 완료된 팀에는 호출할 수 없습니다.
            </li>
            <li>
              멤버의 <code className="text-cyan-600">dependsOn</code>에 멤버 이름을 사용하면
              자동으로 UUID로 변환됩니다. 직접 ID를 지정할 수도 있습니다.
            </li>
            <li>
              순환 참조(circular dependency)가 있으면 위상 정렬에서 감지되어 에러가 발생합니다.
            </li>
            <li>
              멤버 하나라도 실패하거나 취소되면 팀 전체 상태가
              <code className="text-cyan-600"> &quot;failed&quot;</code>가 됩니다.
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
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>기본 사용법 &mdash; 팀 생성 및 실행</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            팀을 생성하고 executor 함수를 전달하여 실행합니다.
          </p>
          <CodeBlock>
            <span className="kw">import</span> {"{"} <span className="type">AgentTeamManager</span> {"}"} <span className="kw">from</span> <span className="str">&quot;./subagents/team-manager.js&quot;</span>;
            {"\n"}
            {"\n"}<span className="kw">const</span> <span className="prop">manager</span> = <span className="kw">new</span> <span className="type">AgentTeamManager</span>();
            {"\n"}
            {"\n"}<span className="cm">{"// 1. 팀 생성"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">team</span> = <span className="prop">manager</span>.<span className="fn">createTeam</span>({"{"}
            {"\n"}{"  "}<span className="prop">name</span>: <span className="str">&quot;코드 분석 팀&quot;</span>,
            {"\n"}{"  "}<span className="prop">objective</span>: <span className="str">&quot;프로젝트 전체 분석&quot;</span>,
            {"\n"}{"  "}<span className="prop">members</span>: [
            {"\n"}{"    "}{"{"} <span className="prop">name</span>: <span className="str">&quot;프론트엔드&quot;</span>, <span className="prop">role</span>: <span className="str">&quot;explore&quot;</span>, <span className="prop">task</span>: <span className="str">&quot;React 코드 분석&quot;</span> {"}"},{"\n"}{"    "}{"{"} <span className="prop">name</span>: <span className="str">&quot;백엔드&quot;</span>, <span className="prop">role</span>: <span className="str">&quot;explore&quot;</span>, <span className="prop">task</span>: <span className="str">&quot;API 코드 분석&quot;</span> {"}"},{"\n"}{"    "}{"{"} <span className="prop">name</span>: <span className="str">&quot;종합&quot;</span>, <span className="prop">role</span>: <span className="str">&quot;general&quot;</span>, <span className="prop">task</span>: <span className="str">&quot;결과 종합&quot;</span>,
            {"\n"}{"      "}<span className="prop">dependsOn</span>: [<span className="str">&quot;프론트엔드&quot;</span>, <span className="str">&quot;백엔드&quot;</span>] {"}"},{"\n"}{"  "}],
            {"\n"}{"}"});
            {"\n"}
            {"\n"}<span className="cm">{"// 2. executor 함수 정의"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">executor</span> = <span className="kw">async</span> (<span className="prop">member</span>, <span className="prop">sharedState</span>) ={">"} {"{"}
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">result</span> = <span className="kw">await</span> <span className="fn">spawnSubagent</span>({"{"} ...<span className="prop">config</span>, <span className="prop">sharedState</span> {"}"});
            {"\n"}{"  "}<span className="kw">return</span> {"{"} <span className="prop">agentId</span>: <span className="prop">result</span>.<span className="prop">agentId</span>, <span className="prop">response</span>: <span className="prop">result</span>.<span className="prop">response</span> {"}"};
            {"\n"}{"}"};
            {"\n"}
            {"\n"}<span className="cm">{"// 3. 팀 실행"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">session</span> = <span className="kw">await</span> <span className="prop">manager</span>.<span className="fn">executeTeam</span>(<span className="prop">team</span>.<span className="prop">id</span>, <span className="prop">executor</span>);
            {"\n"}<span className="fn">console</span>.<span className="fn">log</span>(<span className="prop">manager</span>.<span className="fn">getTeamSummary</span>(<span className="prop">team</span>.<span className="prop">id</span>));
          </CodeBlock>

          <Callout type="warn" icon="!">
            <strong>주의:</strong> <code>dependsOn</code>에 존재하지 않는 멤버 이름을 지정하면
            <code> executeTeam</code> 호출 시 <code>TeamManagerError</code>가 발생합니다.
            순환 참조(A&rarr;B&rarr;A)도 마찬가지로 에러입니다.
          </Callout>

          {/* 고급: 이벤트 모니터링 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; 이벤트 모니터링
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            팀 이벤트를 구독하여 실시간 진행 상황을 UI에 표시할 수 있습니다.
          </p>
          <CodeBlock>
            <span className="kw">const</span> <span className="prop">unsubscribe</span> = <span className="prop">manager</span>.<span className="fn">onEvent</span>((<span className="prop">event</span>) ={">"} {"{"}
            {"\n"}{"  "}<span className="kw">switch</span> (<span className="prop">event</span>.<span className="prop">type</span>) {"{"}
            {"\n"}{"    "}<span className="kw">case</span> <span className="str">&quot;team:created&quot;</span>:
            {"\n"}{"      "}<span className="fn">console</span>.<span className="fn">log</span>(<span className="str">&quot;팀 생성됨&quot;</span>); <span className="kw">break</span>;
            {"\n"}{"    "}<span className="kw">case</span> <span className="str">&quot;team:member-started&quot;</span>:
            {"\n"}{"      "}<span className="fn">console</span>.<span className="fn">log</span>(<span className="str">`멤버 시작: ${"{"}</span><span className="prop">event</span>.<span className="prop">memberId</span><span className="str">{"}"}`</span>); <span className="kw">break</span>;
            {"\n"}{"    "}<span className="kw">case</span> <span className="str">&quot;team:member-completed&quot;</span>:
            {"\n"}{"      "}<span className="fn">console</span>.<span className="fn">log</span>(<span className="str">`멤버 완료: ${"{"}</span><span className="prop">event</span>.<span className="prop">result</span><span className="str">{"}"}`</span>); <span className="kw">break</span>;
            {"\n"}{"    "}<span className="kw">case</span> <span className="str">&quot;team:completed&quot;</span>:
            {"\n"}{"      "}<span className="fn">console</span>.<span className="fn">log</span>(<span className="str">&quot;팀 완료!&quot;</span>); <span className="kw">break</span>;
            {"\n"}{"  "}{"}"}
            {"\n"}{"}"});
            {"\n"}
            {"\n"}<span className="cm">{"// 필요 없어지면 구독 해제"}</span>
            {"\n"}<span className="fn">unsubscribe</span>();
          </CodeBlock>

          {/* 고급: 동시성 제한 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; 동시성 제한과 취소
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">maxConcurrency</code>로 동시 실행 수를 제한하고,
            <code className="text-cyan-600"> AbortSignal</code>로 전체 팀을 취소할 수 있습니다.
          </p>
          <CodeBlock>
            <span className="kw">const</span> <span className="prop">team</span> = <span className="prop">manager</span>.<span className="fn">createTeam</span>({"{"}
            {"\n"}{"  "}<span className="prop">name</span>: <span className="str">&quot;대규모 분석&quot;</span>,
            {"\n"}{"  "}<span className="prop">objective</span>: <span className="str">&quot;10개 모듈 분석&quot;</span>,
            {"\n"}{"  "}<span className="prop">maxConcurrency</span>: <span className="num">3</span>, <span className="cm">{"// 최대 3개 동시 실행"}</span>
            {"\n"}{"  "}<span className="prop">members</span>: [...<span className="prop">tenMembers</span>],
            {"\n"}{"}"});
            {"\n"}
            {"\n"}<span className="kw">const</span> <span className="prop">controller</span> = <span className="kw">new</span> <span className="type">AbortController</span>();
            {"\n"}
            {"\n"}<span className="cm">{"// 30초 후 자동 취소"}</span>
            {"\n"}<span className="fn">setTimeout</span>(() ={">"} <span className="prop">controller</span>.<span className="fn">abort</span>(), <span className="num">30000</span>);
            {"\n"}
            {"\n"}<span className="kw">const</span> <span className="prop">session</span> = <span className="kw">await</span> <span className="prop">manager</span>.<span className="fn">executeTeam</span>(
            {"\n"}{"  "}<span className="prop">team</span>.<span className="prop">id</span>, <span className="prop">executor</span>, {"{"} <span className="prop">signal</span>: <span className="prop">controller</span>.<span className="prop">signal</span> {"}"},{"\n"});
          </CodeBlock>

          <Callout type="tip" icon="*">
            <strong>팁:</strong> <code>maxConcurrency</code>를 설정하지 않으면
            같은 레벨의 모든 멤버가 동시에 실행됩니다. API 레이트 리밋이 있는 경우
            동시성을 적절히 제한하세요.
          </Callout>

          <DeepDive title="dependsOn에 이름 사용하기">
            <p className="mb-3">
              <code className="text-cyan-600">dependsOn</code>에 멤버의 UUID 대신 이름을 사용할 수 있습니다.
              <code className="text-cyan-600"> createTeam</code> 내부에서 자동으로 이름을 UUID로 변환합니다:
            </p>
            <CodeBlock>
              <span className="cm">{"// 이름으로 의존성 지정 — UUID를 몰라도 됨"}</span>
              {"\n"}<span className="prop">members</span>: [
              {"\n"}{"  "}{"{"} <span className="prop">name</span>: <span className="str">&quot;분석&quot;</span>, <span className="prop">task</span>: <span className="str">&quot;코드 분석&quot;</span> {"}"},{"\n"}{"  "}{"{"} <span className="prop">name</span>: <span className="str">&quot;보고서&quot;</span>, <span className="prop">task</span>: <span className="str">&quot;결과 정리&quot;</span>,
              {"\n"}{"    "}<span className="prop">dependsOn</span>: [<span className="str">&quot;분석&quot;</span>] <span className="cm">{"// ← 이름으로 참조"}</span>
              {"\n"}{"  "}{"}"},{"\n"}]
            </CodeBlock>
            <p className="mt-3 text-gray-600">
              이름과 UUID가 모두 매핑에 없는 경우 원래 값을 그대로 사용합니다
              (이미 UUID가 직접 지정된 경우를 위해).
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

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>위상 정렬 + 병렬 실행 흐름</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            Kahn&apos;s Algorithm으로 실행 레벨을 구성한 뒤, 각 레벨 내에서
            세마포어 패턴으로 동시성을 제한하며 병렬 실행합니다.
          </p>

          <MermaidDiagram
            title="위상 정렬 기반 실행 흐름"
            titleColor="purple"
            chart={`graph TD
  VALID["의존성 검증<br/><small>순환참조, 누락 검사</small>"]
  TOPO["위상 정렬<br/><small>Kahn's Algorithm — 레벨 구성</small>"]
  L1["Level 0: A<br/><small>의존성 없는 멤버</small>"]
  L2["Level 1: B, C<br/><small>A에 의존 — 병렬 실행</small>"]
  L3["Level 2: D<br/><small>B, C에 의존</small>"]
  SEM["세마포어<br/><small>maxConcurrency로 동시 실행 제한</small>"]
  DONE{"전부 성공?"}
  COMP["status: completed<br/><small>team:completed 이벤트</small>"]
  FAIL["status: failed<br/><small>team:failed 이벤트</small>"]

  VALID --> TOPO
  TOPO --> L1
  L1 --> L2
  L2 --> L3
  L2 -.->|"동시성 제한"| SEM
  L3 --> DONE
  DONE -->|"Yes"| COMP
  DONE -->|"No"| FAIL

  style TOPO fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style L1 fill:#dcfce7,stroke:#10b981,color:#065f46
  style L2 fill:#dcfce7,stroke:#10b981,color:#065f46
  style L3 fill:#dcfce7,stroke:#10b981,color:#065f46
  style SEM fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style COMP fill:#dcfce7,stroke:#10b981,color:#065f46
  style FAIL fill:#fee2e2,stroke:#ef4444,color:#991b1b`}
          />

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>핵심 코드 분석</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            위상 정렬(Kahn&apos;s Algorithm)의 핵심 로직입니다.
            BFS로 진입 차수(in-degree)가 0인 노드를 레벨별로 수집합니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// [1] 각 멤버의 진입 차수 계산"}</span>
            {"\n"}<span className="kw">for</span> (<span className="kw">const</span> <span className="prop">member</span> <span className="kw">of</span> <span className="prop">members</span>) {"{"}
            {"\n"}{"  "}<span className="kw">if</span> (<span className="prop">member</span>.<span className="prop">dependsOn</span>) {"{"}
            {"\n"}{"    "}<span className="kw">for</span> (<span className="kw">const</span> <span className="prop">depId</span> <span className="kw">of</span> <span className="prop">member</span>.<span className="prop">dependsOn</span>) {"{"}
            {"\n"}{"      "}<span className="cm">{"// [2] 의존하는 멤버가 있으면 진입 차수 증가"}</span>
            {"\n"}{"      "}<span className="prop">inDegree</span>.<span className="fn">set</span>(<span className="prop">member</span>.<span className="prop">id</span>, (<span className="prop">inDegree</span>.<span className="fn">get</span>(<span className="prop">member</span>.<span className="prop">id</span>) ?? <span className="num">0</span>) + <span className="num">1</span>);
            {"\n"}{"      "}<span className="cm">{"// [3] 의존 대상의 후속 멤버 목록에 추가"}</span>
            {"\n"}{"      "}<span className="prop">dependents</span>.<span className="fn">get</span>(<span className="prop">depId</span>)!.<span className="fn">push</span>(<span className="prop">member</span>.<span className="prop">id</span>);
            {"\n"}{"    "}{"}"}
            {"\n"}{"  "}{"}"}
            {"\n"}{"}"}
            {"\n"}
            {"\n"}<span className="cm">{"// [4] 진입 차수 0인 멤버 = 첫 번째 레벨"}</span>
            {"\n"}<span className="kw">let</span> <span className="prop">currentLevel</span> = <span className="prop">members</span>
            {"\n"}{"  "}.<span className="fn">filter</span>(<span className="prop">m</span> ={">"} (<span className="prop">inDegree</span>.<span className="fn">get</span>(<span className="prop">m</span>.<span className="prop">id</span>) ?? <span className="num">0</span>) === <span className="num">0</span>)
            {"\n"}{"  "}.<span className="fn">map</span>(<span className="prop">m</span> ={">"} <span className="prop">m</span>.<span className="prop">id</span>);
            {"\n"}
            {"\n"}<span className="cm">{"// [5] BFS로 레벨별 실행 순서 구성"}</span>
            {"\n"}<span className="kw">while</span> (<span className="prop">currentLevel</span>.<span className="prop">length</span> {">"} <span className="num">0</span>) {"{"}
            {"\n"}{"  "}<span className="prop">levels</span>.<span className="fn">push</span>([...<span className="prop">currentLevel</span>]);
            {"\n"}{"  "}<span className="cm">{"// 현재 레벨 처리 후 진입 차수 0이 된 멤버 = 다음 레벨"}</span>
            {"\n"}{"  "}<span className="cm">{"// ..."}</span>
            {"\n"}{"}"}
          </CodeBlock>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
            <p><strong className="text-gray-900">[1]</strong> 모든 멤버의 진입 차수(의존하는 멤버 수)를 0으로 초기화한 뒤, 의존 관계에 따라 증가시킵니다.</p>
            <p><strong className="text-gray-900">[2-3]</strong> 인접 리스트(adjacency list) 형태로 의존 그래프를 구성합니다. 양방향 정보를 유지합니다.</p>
            <p><strong className="text-gray-900">[4]</strong> 진입 차수가 0인 멤버는 어떤 멤버에도 의존하지 않으므로 먼저 실행할 수 있습니다.</p>
            <p><strong className="text-gray-900">[5]</strong> BFS 반복: 현재 레벨의 멤버를 &quot;완료&quot;로 처리하고, 그에 의존하는 멤버의 진입 차수를 1 감소시킵니다. 진입 차수가 0이 되면 다음 레벨에 추가합니다.</p>
          </div>

          <DeepDive title="실패 전파 (cancelDependents) 상세">
            <p className="mb-3">
              멤버가 실패하면 BFS로 의존 체인을 따라가며 대기(pending) 상태의
              모든 후속 멤버를 전이적(transitive)으로 취소합니다:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-gray-600">
              <li>실패한 멤버 ID를 큐에 넣고 BFS 시작</li>
              <li>해당 멤버에 dependsOn으로 의존하는 pending 멤버를 찾아 cancelled로 변경</li>
              <li>취소된 멤버도 큐에 넣어 그 멤버에 의존하는 멤버까지 연쇄 취소</li>
            </ul>
            <p className="mt-3 text-amber-600">
              이미 실행 중(running)이거나 완료(completed)된 멤버는 취소하지 않습니다.
              오직 pending 상태의 멤버만 취소 대상입니다.
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
              &quot;Circular dependency detected in team members 에러가 발생해요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              멤버 간 순환 참조가 있습니다. 예를 들어 A가 B에 의존하고 B가 A에 의존하면
              실행 순서를 결정할 수 없습니다. 위상 정렬 결과에 모든 멤버가 포함되는지 확인하여 감지합니다.
              <code className="text-cyan-600"> dependsOn</code> 설정을 검토하여 순환을 제거하세요.
            </p>
          </div>

          {/* FAQ 2 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;하나의 멤버가 실패하니 다른 멤버들도 모두 취소됐어요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              이것은 의도된 동작입니다. 실패한 멤버에 의존하는 모든 후속 멤버가
              전이적으로 취소됩니다. 독립적인 멤버는 영향을 받지 않습니다.
            </p>
            <Callout type="tip" icon="*">
              멤버 간 의존 관계를 최소화하면 하나의 실패가 다른 멤버에 미치는 영향을 줄일 수 있습니다.
              가능하면 독립적으로 실행 가능한 작업 단위로 분할하세요.
            </Callout>
          </div>

          {/* FAQ 3 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;Team is not in a valid state for execution 에러가 발생해요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">executeTeam</code>은 &quot;creating&quot; 상태에서만 호출 가능합니다.
              이미 실행이 시작되었거나(<code className="text-cyan-600">&quot;active&quot;</code>),
              완료(<code className="text-cyan-600">&quot;completed&quot;</code>) 또는
              실패(<code className="text-cyan-600">&quot;failed&quot;</code>)한 팀을 다시 실행할 수 없습니다.
              새 팀을 생성(<code className="text-cyan-600">createTeam</code>)하세요.
            </p>
          </div>

          {/* FAQ 4 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;메모리 사용량이 계속 증가해요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              완료된 팀 세션이 메모리에 남아 있을 수 있습니다.
              <code className="text-cyan-600"> cleanup()</code>을 주기적으로 호출하여
              완료/실패한 세션을 정리하세요. 이 메서드는 공유 상태의 메모리도 해제합니다.
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
                name: "spawner.ts",
                slug: "subagent-spawner",
                relation: "sibling",
                desc: "Team Manager가 AgentExecutor를 통해 호출하는 서브에이전트 생성/실행 모듈",
              },
              {
                name: "agent-loop.ts",
                slug: "agent-loop",
                relation: "parent",
                desc: "각 팀 멤버의 에이전트 루프를 실행하는 핵심 모듈",
              },
              {
                name: "circuit-breaker.ts",
                slug: "circuit-breaker",
                relation: "sibling",
                desc: "각 서브에이전트 루프의 무한 반복을 방지하는 안전장치",
              },
              {
                name: "context-manager.ts",
                slug: "context-manager",
                relation: "sibling",
                desc: "팀 내 공유 상태와 별도로, 각 에이전트의 컨텍스트 토큰을 관리하는 모듈",
              },
            ]}
          />
        </section>
      </RevealOnScroll>
    </div></div>
  );
}

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

export default function CmdTeamPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}><div className="center-narrow">
      {/* ─── Header ─── */}
      <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <FilePath path="src/commands/team.ts" />
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
            <span className="text-gray-900">
              /team 팀 오케스트레이션
            </span>
          </h1>
          <div className="flex items-center gap-3 mb-5">
            <LayerBadge layer="leaf" />
          </div>
          <p className="text-[16px] text-gray-600 leading-relaxed">
            여러 AI 에이전트를 병렬로 실행하여 복잡한 작업을 분담하는 팀 관리 명령어입니다.
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
              <code className="text-cyan-600">/team</code>은 여러 AI 에이전트를 동시에 실행하여
              복잡한 작업을 분담하는 <strong>팀 오케스트레이션</strong> 명령어입니다.
              예를 들어, &quot;보안 분석&quot;, &quot;성능 리뷰&quot;, &quot;타입 검사&quot;를
              각각 다른 에이전트에게 병렬로 맡겨 전체 작업 시간을 단축할 수 있습니다.
            </p>
            <p>
              팩토리 패턴(<code className="text-cyan-600">createTeamCommand</code>)을 사용하여
              <code className="text-cyan-600">AgentTeamManager</code> 의존성을 주입받습니다.
              이로써 명령어와 팀 관리 로직 사이의 강한 결합을 방지합니다.
            </p>
            <p>
              팀의 생명주기는 <code className="text-cyan-600">creating</code> &rarr;
              <code className="text-cyan-600">active</code> &rarr;
              <code className="text-cyan-600">completing</code> &rarr;
              <code className="text-cyan-600">completed</code>(또는 <code className="text-red-600">failed</code>)로
              진행되며, 각 멤버(에이전트)는 독립적인 실행 상태를 가집니다.
            </p>
          </div>

          <MermaidDiagram
            title="/team 아키텍처"
            titleColor="purple"
            chart={`graph TD
  CMD["/team 명령어"]
  FACTORY["createTeamCommand()<br/><small>팩토리 패턴</small>"]
  MGR["AgentTeamManager<br/><small>의존성 주입</small>"]
  CREATE["create<br/><small>팀 생성</small>"]
  STATUS["status<br/><small>상태 조회</small>"]
  CANCEL["cancel<br/><small>팀 취소</small>"]
  LIST["list<br/><small>전체 목록</small>"]
  SUMMARY["summary<br/><small>상세 요약</small>"]
  AGENTS["Agent 1<br/>Agent 2<br/>Agent 3<br/><small>병렬 실행</small>"]

  CMD --> FACTORY
  FACTORY -->|"DI"| MGR
  MGR --> CREATE
  MGR --> STATUS
  MGR --> CANCEL
  MGR --> LIST
  MGR --> SUMMARY
  CREATE --> AGENTS

  style CMD fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style FACTORY fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style MGR fill:#dcfce7,stroke:#10b981,color:#065f46,stroke-width:2px
  style AGENTS fill:#fef3c7,stroke:#f59e0b,color:#1e293b`}
          />

          <Callout type="info" icon="💡">
            <strong>비유:</strong> /team은 프로젝트 매니저입니다. 여러 전문가(에이전트)에게
            각자의 역할을 배정하고, 진행 상황을 모니터링하며, 필요하면 작업을 취소할 수 있습니다.
            각 전문가는 독립적으로 일하지만, 의존 관계를 설정하여 순서를 제어할 수도 있습니다.
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 2. 레퍼런스 (Reference) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>📖</span> 레퍼런스
          </h2>

          {/* TeamMember interface */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface TeamMember
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            팀의 개별 멤버(에이전트)를 나타내는 인터페이스입니다.
          </p>
          <ParamTable
            params={[
              { name: "id", type: "string", required: true, desc: "멤버 고유 ID" },
              { name: "name", type: "string", required: true, desc: "멤버 이름 (예: \"보안 분석가\")" },
              { name: "role", type: "string", required: true, desc: "역할 설명" },
              { name: "type", type: "string", required: true, desc: "에이전트 타입" },
              { name: "prompt", type: "string", required: true, desc: "에이전트에게 전달할 프롬프트" },
              { name: "status", type: "MemberStatus", required: true, desc: "현재 실행 상태 (pending | running | completed | failed | cancelled)" },
              { name: "dependsOn", type: "string[]", required: false, desc: "이 멤버가 의존하는 다른 멤버의 ID 배열" },
            ]}
          />

          {/* TeamSession interface */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface TeamSession
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            팀 세션의 전체 정보를 담는 구조체입니다.
          </p>
          <ParamTable
            params={[
              { name: "id", type: "string", required: true, desc: "팀 세션 고유 ID" },
              { name: "name", type: "string", required: true, desc: "팀 이름" },
              { name: "status", type: "TeamStatus", required: true, desc: "팀 상태 (creating | active | completing | completed | failed)" },
              { name: "members", type: "TeamMember[]", required: true, desc: "팀 멤버 배열" },
              { name: "createdAt", type: "number", required: true, desc: "팀 생성 시각 (밀리초 타임스탬프)" },
              { name: "completedAt", type: "number", required: false, desc: "팀 완료 시각 (선택적)" },
            ]}
          />

          {/* AgentTeamManager interface */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface AgentTeamManager
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            팀 관리 기능을 제공하는 의존성 인터페이스입니다.
            팩토리 함수에서 주입받습니다.
          </p>
          <CodeBlock>
            <span className="kw">interface</span> <span className="type">AgentTeamManager</span> {"{"}
            {"\n"}{"  "}<span className="fn">createTeam</span>(<span className="prop">config</span>: <span className="type">TeamConfig</span>): <span className="type">Promise</span>&lt;<span className="type">TeamSession</span>&gt;
            {"\n"}{"  "}<span className="fn">executeTeam</span>(<span className="prop">teamId</span>: <span className="type">string</span>): <span className="type">Promise</span>&lt;<span className="type">TeamResult</span>&gt;
            {"\n"}{"  "}<span className="fn">cancelTeam</span>(<span className="prop">teamId</span>: <span className="type">string</span>): <span className="type">Promise</span>&lt;<span className="type">void</span>&gt;
            {"\n"}{"  "}<span className="fn">getTeamStatus</span>(<span className="prop">teamId</span>: <span className="type">string</span>): <span className="type">TeamSession | undefined</span>
            {"\n"}{"  "}<span className="fn">getActiveTeams</span>(): <span className="type">TeamSession[]</span>
            {"\n"}{"  "}<span className="fn">getTeamSummary</span>(<span className="prop">teamId</span>: <span className="type">string</span>): <span className="type">string</span>
            {"\n"}{"  "}<span className="fn">cleanup</span>(): <span className="type">void</span>
            {"\n"}{"}"}
          </CodeBlock>

          {/* 서브커맨드 */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            서브커맨드
          </h3>
          <ParamTable
            params={[
              { name: "/team create <이름>", type: "생성", required: false, desc: "새 팀 생성 — LLM에게 멤버 구성을 안내하는 프롬프트 주입" },
              { name: "/team status [ID]", type: "조회", required: false, desc: "전체 활성 팀 또는 특정 팀의 멤버별 상태 표시" },
              { name: "/team cancel <ID>", type: "취소", required: false, desc: "실행 중인 팀 취소 (완료/실패 팀은 취소 불가)" },
              { name: "/team list", type: "목록", required: false, desc: "모든 팀 테이블 (ID, 이름, 상태, 멤버 진행률, 생성 시각)" },
              { name: "/team summary <ID>", type: "요약", required: false, desc: "팀 상세 요약 — 전체 실행 결과 리포트" },
              { name: "/team help", type: "도움", required: false, desc: "사용법 안내" },
            ]}
          />

          {/* Caveats */}
          <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
          <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
            <li>
              <code className="text-cyan-600">/team create</code>는
              <code className="text-cyan-600">shouldInjectAsUserMessage: true</code>를 반환하여
              LLM이 팀 멤버 구성을 진행하도록 합니다. 직접 멤버를 추가하지 않습니다.
            </li>
            <li>
              이미 <code className="text-red-600">completed</code> 또는
              <code className="text-red-600">failed</code> 상태인 팀은 취소할 수 없습니다.
              <code className="text-cyan-600">cancel</code>은 active 상태에서만 유효합니다.
            </li>
            <li>
              <code className="text-cyan-600">TeamCommandError</code>는
              <code className="text-cyan-600">BaseError</code>를 상속하며,
              에러 코드는 <code>&quot;TEAM_COMMAND_ERROR&quot;</code>입니다.
            </li>
            <li>
              팀 ID는 8자로 잘려서 표시됩니다. 전체 ID가 필요하면
              <code className="text-cyan-600">/team summary</code>를 사용하세요.
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
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>기본 사용법 &mdash; 팀 생성 및 모니터링</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            팀을 생성하면 LLM이 작업에 맞는 멤버(에이전트)를 구성하고 병렬로 실행합니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 1. 팀 생성"}</span>
            {"\n"}<span className="str">/team create &quot;Code Review Team&quot;</span>
            {"\n"}
            {"\n"}<span className="cm">{"// 출력: Team created: Code Review Team (a1b2c3d4)"}</span>
            {"\n"}<span className="cm">{"// LLM이 멤버 역할을 정의하고 실행 시작"}</span>
            {"\n"}
            {"\n"}<span className="cm">{"// 2. 팀 상태 확인"}</span>
            {"\n"}<span className="str">/team status</span>
            {"\n"}
            {"\n"}<span className="cm">{"// 출력 예시:"}</span>
            {"\n"}<span className="cm">{"// Team: Code Review Team (a1b2c3d4)"}</span>
            {"\n"}<span className="cm">{"// Status: active | Members: 1/3 complete"}</span>
            {"\n"}<span className="cm">{"//   ● security-reviewer  completed   (12s)"}</span>
            {"\n"}<span className="cm">{"//   ◐ perf-reviewer      running     (8s)"}</span>
            {"\n"}<span className="cm">{"//   ○ type-checker       pending"}</span>
            {"\n"}
            {"\n"}<span className="cm">{"// 3. 팀 목록 보기"}</span>
            {"\n"}<span className="str">/team list</span>
          </CodeBlock>

          <Callout type="warn" icon="!">
            <strong>주의:</strong> <code>/team create</code>에 팀 이름을 반드시 지정하세요.
            이름이 없으면 에러가 발생합니다. 따옴표로 감싸면 공백이 포함된 이름도 사용 가능합니다.
          </Callout>

          {/* 고급 사용법 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; 팀 취소 및 상세 요약
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            실행 중인 팀을 취소하거나, 완료된 팀의 상세 실행 결과를 확인할 수 있습니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 실행 중인 팀 취소"}</span>
            {"\n"}<span className="str">/team cancel a1b2c3d4</span>
            {"\n"}
            {"\n"}<span className="cm">{"// 출력:"}</span>
            {"\n"}<span className="cm">{"// Team \"Code Review Team\" cancelled."}</span>
            {"\n"}<span className="cm">{"// Affected members (2):"}</span>
            {"\n"}<span className="cm">{"//   - perf-reviewer (성능 분석): was running"}</span>
            {"\n"}<span className="cm">{"//   - type-checker (타입 검사): was pending"}</span>
            {"\n"}
            {"\n"}<span className="cm">{"// 팀 상세 요약 보기"}</span>
            {"\n"}<span className="str">/team summary a1b2c3d4</span>
          </CodeBlock>

          <Callout type="tip" icon="*">
            <strong>팁:</strong> 멤버 상태 아이콘의 의미:
            ○ pending (대기), ◐ running (실행 중), ● completed (완료),
            ✕ failed (실패), ⊘ cancelled (취소됨)
          </Callout>

          <DeepDive title="팩토리 패턴과 의존성 주입">
            <p className="mb-3">
              /team 명령어는 팩토리 함수 <code className="text-cyan-600">createTeamCommand()</code>로
              생성됩니다. 이 패턴을 사용하는 이유:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-gray-600">
              <li><strong>테스트 용이성:</strong> AgentTeamManager를 Mock으로 교체 가능</li>
              <li><strong>느슨한 결합:</strong> 명령어가 팀 관리 구현체에 직접 의존하지 않음</li>
              <li><strong>지연 초기화:</strong> 등록 시점에 Manager가 준비되어야 하므로 팩토리로 제어</li>
            </ul>
            <CodeBlock>
              <span className="cm">{"// 명령어 등록 시 팩토리로 생성"}</span>
              {"\n"}<span className="kw">const</span> <span className="prop">teamCmd</span> = <span className="fn">createTeamCommand</span>(<span className="prop">teamManager</span>);
              {"\n"}<span className="prop">registry</span>.<span className="fn">register</span>(<span className="prop">teamCmd</span>);
            </CodeBlock>
          </DeepDive>
        </section>
      </RevealOnScroll>

      {/* ─── 4. 내부 구현 (Internals) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>⚙️</span> 내부 구현
          </h2>

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>팀 생명주기 다이어그램</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            팀과 멤버는 각각 독립적인 상태 전이를 가집니다.
          </p>

          <MermaidDiagram
            title="팀 + 멤버 상태 전이"
            titleColor="purple"
            chart={`graph TD
  subgraph Team["팀 상태"]
    T_CREATE["creating"] --> T_ACTIVE["active"]
    T_ACTIVE --> T_COMPLETING["completing"]
    T_COMPLETING --> T_DONE["completed"]
    T_ACTIVE --> T_FAIL["failed"]
    T_COMPLETING --> T_FAIL
  end

  subgraph Member["멤버 상태"]
    M_PEND["pending"] --> M_RUN["running"]
    M_RUN --> M_DONE["completed"]
    M_RUN --> M_FAIL["failed"]
    M_PEND --> M_CANCEL["cancelled"]
    M_RUN --> M_CANCEL
  end

  style T_CREATE fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style T_ACTIVE fill:#dcfce7,stroke:#10b981,color:#065f46,stroke-width:2px
  style T_COMPLETING fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style T_DONE fill:#dcfce7,stroke:#10b981,color:#065f46
  style T_FAIL fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style M_PEND fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style M_RUN fill:#dcfce7,stroke:#10b981,color:#065f46,stroke-width:2px
  style M_DONE fill:#dcfce7,stroke:#10b981,color:#065f46
  style M_FAIL fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style M_CANCEL fill:#f1f5f9,stroke:#64748b,color:#1e293b`}
          />

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>핵심 코드 분석</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            /team cancel 핸들러는 팀 상태를 확인한 후 취소를 수행합니다.
            이미 종료된 팀은 취소할 수 없도록 가드합니다.
          </p>
          <CodeBlock>
            <span className="kw">async function</span> <span className="fn">handleCancel</span>(<span className="prop">idArg</span>, <span className="prop">teamManager</span>) {"{"}
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">team</span> = <span className="prop">teamManager</span>.<span className="fn">getTeamStatus</span>(<span className="prop">idArg</span>);
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// 이미 종료된 팀은 취소 불가"}</span>
            {"\n"}{"  "}<span className="kw">if</span> (<span className="prop">team</span>.<span className="prop">status</span> === <span className="str">&quot;completed&quot;</span> || <span className="prop">team</span>.<span className="prop">status</span> === <span className="str">&quot;failed&quot;</span>) {"{"}
            {"\n"}{"    "}<span className="kw">return</span> {"{"} <span className="prop">success</span>: <span className="kw">false</span> {"}"};
            {"\n"}{"  "}{"}"}
            {"\n"}
            {"\n"}{"  "}<span className="kw">await</span> <span className="prop">teamManager</span>.<span className="fn">cancelTeam</span>(<span className="prop">idArg</span>);
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// 영향받는 멤버 목록 (running + pending)"}</span>
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">affected</span> = <span className="prop">team</span>.<span className="prop">members</span>.<span className="fn">filter</span>(
            {"\n"}{"    "}<span className="prop">m</span> =&gt; <span className="prop">m</span>.<span className="prop">status</span> === <span className="str">&quot;running&quot;</span> || <span className="prop">m</span>.<span className="prop">status</span> === <span className="str">&quot;pending&quot;</span>
            {"\n"}{"  "});
            {"\n"}{"}"}
          </CodeBlock>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
            <p><strong className="text-gray-900">formatElapsed()</strong> &mdash; 시작~종료 경과 시간을 &quot;12s&quot;, &quot;2m 30s&quot;, &quot;1h 3m&quot; 형식으로 포맷합니다.</p>
            <p><strong className="text-gray-900">formatTimestamp()</strong> &mdash; 타임스탬프를 &quot;2m ago&quot;, &quot;1h ago&quot;, &quot;3d ago&quot; 형식의 상대 시간으로 변환합니다.</p>
            <p><strong className="text-gray-900">formatTeamTable()</strong> &mdash; 팀 목록을 ID, 이름, 상태, 멤버 진행률, 생성 시각 컬럼의 테이블로 포맷합니다.</p>
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
              &quot;/team create 후 아무 일도 일어나지 않아요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              <code>/team create</code>는 팀을 생성하고 LLM에게 멤버 구성을 안내하는
              프롬프트를 주입합니다. LLM이 작업 역할을 정의하고 에이전트를 스폰할 때까지
              기다려주세요. 이전 대화에서 작업 내용을 설명했는지 확인하세요.
            </p>
          </div>

          {/* FAQ 2 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;완료된 팀을 취소하려고 하면 에러가 나요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              이미 <code className="text-cyan-600">completed</code> 또는
              <code className="text-cyan-600">failed</code> 상태인 팀은 취소할 수 없습니다.
              <code>/team status &lt;ID&gt;</code>로 현재 상태를 먼저 확인하세요.
              취소는 <code>active</code> 또는 <code>creating</code> 상태에서만 가능합니다.
            </p>
          </div>

          {/* FAQ 3 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;팀 ID를 잊어버렸어요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code>/team list</code>로 모든 팀의 ID(8자 축약), 이름, 상태를 확인할 수 있습니다.
              <code>/team status</code>(ID 없이)를 입력하면 현재 활성 팀만 보여줍니다.
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
                name: "team-manager.ts",
                slug: "team-manager",
                relation: "sibling",
                desc: "AgentTeamManager 구현체 — 팀 생성, 실행, 취소의 실제 로직을 담당",
              },
              {
                name: "subagent-spawner.ts",
                slug: "subagent-spawner",
                relation: "sibling",
                desc: "서브에이전트 생성 — 팀 멤버(에이전트)를 실제로 스폰하는 모듈",
              },
              {
                name: "cmd-agents",
                slug: "cmd-agents",
                relation: "sibling",
                desc: "/agents 명령어 — 에이전트 정의 관리 및 내장 타입 조회",
              },
            ]}
          />
        </section>
      </RevealOnScroll>
    </div></div>
  );
}

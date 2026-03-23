"use client";

import { FilePath } from "@/components/FilePath";
import { LayerBadge } from "@/components/LayerBadge";
import { MermaidDiagram } from "@/components/MermaidDiagram";
import { CodeBlock } from "@/components/CodeBlock";
import { Callout } from "@/components/Callout";
import { RevealOnScroll } from "@/components/RevealOnScroll";
import { DeepDive } from "@/components/DeepDive";
import { ParamTable } from "@/components/ParamTable";
import { SeeAlso } from "@/components/SeeAlso";

export default function HookTeamEventsPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ───────────────────── 1. Header ───────────────────── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <FilePath path="src/hooks/team-events.ts" />
              <LayerBadge layer="leaf" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mb-3">
              <span className="text-gray-900">Hook Team Events</span>
            </h1>
            <p className="text-[16px] text-gray-600 max-w-[640px]">
              에이전트 팀 매니저와 훅 시스템을 연결하는 브리지 모듈입니다. 팀 멤버가 작업을
              완료하거나 실패할 때 <span className="text-cyan-600 font-semibold">TeammateIdle</span>
              과 <span className="text-violet-600 font-semibold">TaskCompleted</span> 훅 이벤트를
              발행하며, 에러 격리로 훅 실패가 팀 실행을 절대 중단시키지 않습니다.
            </p>
          </div>
        </RevealOnScroll>

        {/* ───────────────────── 2. 개요 ───────────────────── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>{"📋"}</span> 개요
            </h2>
            <p className="text-[14px] text-gray-600 leading-relaxed mb-4">
              멀티 에이전트 팀이 병렬로 작업할 때, 각 멤버의 완료·실패 상태를 외부 시스템(웹훅,
              알림, 모니터링 등)에 전달하는 것은 중요합니다.{" "}
              <strong className="text-gray-900">TeamHookEmitter</strong>는{" "}
              <code className="text-cyan-600 text-xs">AgentTeamManager</code>의 이벤트를 받아 훅
              시스템의 표준 페이로드로 변환하여 발행합니다. 6가지 팀 이벤트 중{" "}
              <code className="text-cyan-600 text-xs">team:member-completed</code>와{" "}
              <code className="text-cyan-600 text-xs">team:member-failed</code>만 TeammateIdle로,{" "}
              <code className="text-cyan-600 text-xs">team:completed</code>는 TaskCompleted로
              변환됩니다.
            </p>

            <Callout type="tip" icon="💡">
              <strong>에러 격리 원칙:</strong> 훅 핸들러가 실패(네트워크 오류, 타임아웃 등)해도 팀
              실행이 중단되지 않습니다. 모든 에러는 조용히 삼켜집니다(swallowed). 팀 작업의 정확성이
              훅 알림보다 항상 우선입니다.
            </Callout>

            <MermaidDiagram
              title="팀 이벤트 → 훅 이벤트 변환"
              titleColor="cyan"
              chart={`flowchart LR
  TEAM["AgentTeamManager<br/><small>팀 이벤트 발행</small>"]
  HANDLER["createTeamEventHandler()<br/><small>이벤트 콜백</small>"]
  EMITTER["TeamHookEmitter<br/><small>페이로드 변환</small>"]
  RUNNER["HookRunner<br/><small>훅 실행</small>"]

  TEAM -->|team:member-completed| HANDLER
  TEAM -->|team:member-failed| HANDLER
  TEAM -->|team:completed| HANDLER
  HANDLER -->|TeammateIdle| EMITTER
  HANDLER -->|TaskCompleted| EMITTER
  EMITTER --> RUNNER

  style TEAM fill:#f1f5f9,stroke:#06b6d4,color:#1e293b
  style HANDLER fill:#fef3c7,stroke:#f59e0b,color:#1e293b,stroke-width:2px
  style EMITTER fill:#f1f5f9,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style RUNNER fill:#f8fafc,stroke:#10b981,color:#10b981`}
            />
          </section>
        </RevealOnScroll>

        {/* ───────────────────── 3. 레퍼런스 ───────────────────── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>{"📖"}</span> 레퍼런스
            </h2>

            {/* TeamHookEmitter */}
            <div className="mb-8">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">TeamHookEmitter</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-600">
                  class
                </span>
              </h3>
              <p className="text-[13px] text-gray-600 mb-3">
                팀 이벤트를 훅 이벤트로 변환하여 발행하는 핵심 클래스입니다.{" "}
                <code className="text-cyan-600 text-xs">TeamHookEmitterConfig</code>를 받아
                생성합니다.
              </p>
              <ParamTable
                params={[
                  {
                    name: "config.hookRunner",
                    type: "HookRunner",
                    required: true,
                    desc: "훅 러너 인스턴스 — 실제 핸들러 실행 담당",
                  },
                  {
                    name: "config.sessionId",
                    type: "string",
                    required: true,
                    desc: "현재 세션 ID — 훅 페이로드에 포함",
                  },
                  {
                    name: "config.workingDirectory",
                    type: "string",
                    required: true,
                    desc: "작업 디렉토리 경로 — 훅 페이로드에 포함",
                  },
                ]}
              />

              <div className="mt-4 bg-white border border-gray-200 rounded-xl p-4">
                <h4 className="text-[13px] font-bold mb-2 text-gray-900">주요 메서드</h4>
                <div className="flex flex-col gap-2.5 text-[13px] text-gray-600">
                  <div className="flex gap-3">
                    <code className="text-cyan-600 font-bold shrink-0 w-52">
                      emitTeammateIdle(data)
                    </code>
                    <span>
                      멤버 완료/실패 시 TeammateIdle 훅 이벤트 발행 →{" "}
                      <code className="text-cyan-600 text-xs">Promise&lt;HookRunResult&gt;</code>
                    </span>
                  </div>
                  <div className="flex gap-3">
                    <code className="text-cyan-600 font-bold shrink-0 w-52">
                      emitTaskCompleted(data)
                    </code>
                    <span>
                      작업 완료 시 TaskCompleted 훅 이벤트 발행 →{" "}
                      <code className="text-cyan-600 text-xs">Promise&lt;HookRunResult&gt;</code>
                    </span>
                  </div>
                  <div className="flex gap-3">
                    <code className="text-cyan-600 font-bold shrink-0 w-52">
                      handleTeamEvent(event)
                    </code>
                    <span>팀 이벤트를 받아 적절한 훅 이벤트로 변환하여 발행</span>
                  </div>
                  <div className="flex gap-3">
                    <code className="text-cyan-600 font-bold shrink-0 w-52">hasTeamHooks()</code>
                    <span>TeammateIdle 또는 TaskCompleted 훅이 설정되어 있는지 확인</span>
                  </div>
                </div>
              </div>
            </div>

            {/* TeammateIdleData */}
            <div className="mb-8">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">TeammateIdleData</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-600">
                  interface
                </span>
              </h3>
              <p className="text-[13px] text-gray-600 mb-3">
                TeammateIdle 이벤트에 포함되는 팀 멤버 상태 데이터입니다.
              </p>
              <ParamTable
                params={[
                  {
                    name: "teamId",
                    type: "string",
                    required: true,
                    desc: "팀 ID",
                  },
                  {
                    name: "memberId",
                    type: "string",
                    required: true,
                    desc: "멤버 ID",
                  },
                  {
                    name: "memberName",
                    type: "string",
                    required: true,
                    desc: "멤버 이름",
                  },
                  {
                    name: "status",
                    type: '"completed"|"failed"|"cancelled"',
                    required: true,
                    desc: "멤버 완료 상태",
                  },
                  {
                    name: "remainingMembers",
                    type: "number",
                    required: true,
                    desc: "아직 작업 중인 남은 멤버 수",
                  },
                  {
                    name: "totalMembers",
                    type: "number",
                    required: true,
                    desc: "팀 전체 멤버 수",
                  },
                  {
                    name: "result",
                    type: "string?",
                    required: false,
                    desc: "작업 결과 (완료 시)",
                  },
                  {
                    name: "error",
                    type: "string?",
                    required: false,
                    desc: "에러 메시지 (실패 시)",
                  },
                  {
                    name: "elapsedMs",
                    type: "number?",
                    required: false,
                    desc: "소요 시간 (밀리초)",
                  },
                ]}
              />
            </div>

            {/* createTeamHookEmitter / createTeamEventHandler */}
            <div className="mb-8">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">createTeamHookEmitter()</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                  exported
                </span>
              </h3>
              <p className="text-[13px] text-gray-600">
                <code className="text-cyan-600 text-xs">TeamHookEmitter</code> 인스턴스를 생성하는
                팩토리 함수입니다.
              </p>
            </div>

            <div className="mb-4">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="font-mono text-cyan-600">createTeamEventHandler()</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                  exported
                </span>
              </h3>
              <p className="text-[13px] text-gray-600 mb-3">
                <code className="text-cyan-600 text-xs">TeamHookEmitter</code>를 팀 매니저의 이벤트
                콜백에 연결합니다. 남은 멤버 수를 자동으로 추적하며,{" "}
                <code className="text-cyan-600 text-xs">AgentTeamManager</code>의{" "}
                <code className="text-cyan-600 text-xs">onEvent</code> 콜백으로 사용하기에
                적합합니다.
              </p>
              <ParamTable
                params={[
                  {
                    name: "emitter",
                    type: "TeamHookEmitter",
                    required: true,
                    desc: "TeamHookEmitter 인스턴스",
                  },
                  {
                    name: "teamName",
                    type: "string",
                    required: true,
                    desc: "팀 이름 — 훅 페이로드에 포함",
                  },
                  {
                    name: "totalMembers",
                    type: "number",
                    required: true,
                    desc: "팀 전체 멤버 수 — 남은 멤버 수 추적의 초기값",
                  },
                ]}
              />
              <div className="mt-3 bg-white border border-gray-200 rounded-xl p-4 text-[13px] text-gray-600">
                <span className="font-bold text-gray-900">반환값:</span>{" "}
                <code className="text-cyan-600 text-xs">
                  {"(event: TeamEvent) => Promise<void>"}
                </code>{" "}
                — 팀 이벤트를 처리하는 콜백 함수
              </div>
            </div>

            <Callout type="warn" icon="⚠️">
              <strong>이벤트 변환 규칙:</strong>{" "}
              <code className="text-red-600 text-xs">team:created</code>,{" "}
              <code className="text-red-600 text-xs">team:member-started</code>,{" "}
              <code className="text-red-600 text-xs">team:failed</code>에 대해서는 훅이 발행되지
              않습니다. 이 이벤트들은 팀 내부 상태 추적용이며 외부 알림 대상이 아닙니다.
            </Callout>
          </section>
        </RevealOnScroll>

        {/* ───────────────────── 4. 사용법 ───────────────────── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>{"🚀"}</span> 사용법
            </h2>

            <h3 className="text-[15px] font-bold" style={{ marginTop: "0", marginBottom: "16px" }}>
              기본 연결
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              <code className="text-cyan-600 text-xs">createTeamEventHandler()</code>로 콜백을
              만들어 팀 매니저에 연결합니다.
            </p>

            <CodeBlock>
              <span className="text-[#ff7b72]">import</span>{" "}
              <span className="text-[#c9d1d9]">{"{ "}</span>
              <span className="text-[#79c0ff]">createTeamHookEmitter</span>
              <span className="text-[#c9d1d9]">{","}</span>{" "}
              <span className="text-[#79c0ff]">createTeamEventHandler</span>
              <span className="text-[#c9d1d9]">{" }"}</span>{" "}
              <span className="text-[#ff7b72]">from</span>{" "}
              <span className="text-[#a5d6ff]">{'"./hooks/team-events.js"'}</span>
              <span className="text-[#c9d1d9]">;</span>
              {"\n\n"}
              <span className="text-[#ff7b72]">const</span>{" "}
              <span className="text-[#79c0ff]">emitter</span>{" "}
              <span className="text-[#c9d1d9]">=</span>{" "}
              <span className="text-[#d2a8ff]">createTeamHookEmitter</span>
              <span className="text-[#c9d1d9]">({"{"}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"  "}</span>
              <span className="text-[#79c0ff]">hookRunner</span>
              <span className="text-[#c9d1d9]">,</span>{" "}
              <span className="text-[#79c0ff]">sessionId</span>
              <span className="text-[#c9d1d9]">,</span>{" "}
              <span className="text-[#79c0ff]">workingDirectory</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"}"});</span>
              {"\n\n"}
              <span className="text-[#8b949e]">{"// 팀 매니저의 onEvent 콜백으로 연결"}</span>
              {"\n"}
              <span className="text-[#79c0ff]">teamManager</span>
              <span className="text-[#c9d1d9]">.onEvent =</span>{" "}
              <span className="text-[#d2a8ff]">createTeamEventHandler</span>
              <span className="text-[#c9d1d9]">(</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"  "}</span>
              <span className="text-[#79c0ff]">emitter</span>
              <span className="text-[#c9d1d9]">,</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"  "}</span>
              <span className="text-[#a5d6ff]">{'"분석팀"'}</span>
              <span className="text-[#c9d1d9]">,</span>{" "}
              <span className="text-[#8b949e]">{"// 팀 이름"}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"  "}</span>
              <span className="text-[#79c0ff]">3</span>{" "}
              <span className="text-[#8b949e]">{"// 전체 멤버 수"}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">);</span>
            </CodeBlock>

            <h3
              className="text-[15px] font-bold"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              직접 이벤트 발행
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              콜백 방식 없이 이미터를 직접 사용하여 훅 이벤트를 발행할 수도 있습니다.
            </p>

            <CodeBlock>
              <span className="text-[#ff7b72]">await</span>{" "}
              <span className="text-[#79c0ff]">emitter</span>
              <span className="text-[#c9d1d9]">.</span>
              <span className="text-[#d2a8ff]">emitTeammateIdle</span>
              <span className="text-[#c9d1d9]">({"{"}</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"  "}</span>
              <span className="text-[#79c0ff]">teamId</span>
              <span className="text-[#c9d1d9]">{": "}</span>
              <span className="text-[#a5d6ff]">{'"team-1"'}</span>
              <span className="text-[#c9d1d9]">,</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"  "}</span>
              <span className="text-[#79c0ff]">teamName</span>
              <span className="text-[#c9d1d9]">{": "}</span>
              <span className="text-[#a5d6ff]">{'"분석팀"'}</span>
              <span className="text-[#c9d1d9]">,</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"  "}</span>
              <span className="text-[#79c0ff]">memberId</span>
              <span className="text-[#c9d1d9]">{": "}</span>
              <span className="text-[#a5d6ff]">{'"member-1"'}</span>
              <span className="text-[#c9d1d9]">,</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"  "}</span>
              <span className="text-[#79c0ff]">memberName</span>
              <span className="text-[#c9d1d9]">{": "}</span>
              <span className="text-[#a5d6ff]">{'"보안 분석가"'}</span>
              <span className="text-[#c9d1d9]">,</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"  "}</span>
              <span className="text-[#79c0ff]">memberRole</span>
              <span className="text-[#c9d1d9]">{": "}</span>
              <span className="text-[#a5d6ff]">{'"security"'}</span>
              <span className="text-[#c9d1d9]">,</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"  "}</span>
              <span className="text-[#79c0ff]">status</span>
              <span className="text-[#c9d1d9]">{": "}</span>
              <span className="text-[#a5d6ff]">{'"completed"'}</span>
              <span className="text-[#c9d1d9]">,</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"  "}</span>
              <span className="text-[#79c0ff]">remainingMembers</span>
              <span className="text-[#c9d1d9]">{": "}</span>
              <span className="text-[#79c0ff]">2</span>
              <span className="text-[#c9d1d9]">,</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"  "}</span>
              <span className="text-[#79c0ff]">totalMembers</span>
              <span className="text-[#c9d1d9]">{": "}</span>
              <span className="text-[#79c0ff]">3</span>
              {"\n"}
              <span className="text-[#c9d1d9]">{"}"});</span>
            </CodeBlock>

            <DeepDive title="남은 멤버 수 자동 추적">
              <p className="mb-3">
                <code className="text-cyan-600 text-xs">createTeamEventHandler()</code>는 클로저를
                사용하여 남은 멤버 수를 자동으로 추적합니다. 멤버 완료 또는 실패 이벤트가 발생할
                때마다 <code className="text-cyan-600 text-xs">remaining</code>이 1씩 감소합니다 (0
                미만으로는 내려가지 않음).
              </p>
              <p className="text-[13px] text-gray-600">
                직접 <code className="text-cyan-600 text-xs">emitTeammateIdle()</code>을 호출할 때는
                <code className="text-cyan-600 text-xs"> remainingMembers</code>와{" "}
                <code className="text-cyan-600 text-xs">totalMembers</code>를 수동으로 관리해야
                합니다.
              </p>
            </DeepDive>
          </section>
        </RevealOnScroll>

        {/* ───────────────────── 5. 내부 구현 ───────────────────── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>{"⚙️"}</span> 내부 구현
            </h2>

            <h3 className="text-[15px] font-bold" style={{ marginTop: "0", marginBottom: "16px" }}>
              이벤트 변환 매트릭스
            </h3>

            <MermaidDiagram
              title="TeamEvent → HookEvent 변환 규칙"
              titleColor="purple"
              chart={`flowchart TD
  CREATED["team:created"] -->|훅 없음| IGNORE["무시됨"]
  STARTED["team:member-started"] -->|훅 없음| IGNORE
  TFAILED["team:failed"] -->|훅 없음| IGNORE
  COMPLETED["team:member-completed"] -->|TeammateIdle<br/>status: completed| RUNNER["HookRunner.run()"]
  FAILED["team:member-failed"] -->|TeammateIdle<br/>status: failed| RUNNER
  TCOMP["team:completed"] -->|TaskCompleted| RUNNER

  style IGNORE fill:#f1f5f9,stroke:#94a3b8,color:#94a3b8
  style RUNNER fill:#f8fafc,stroke:#10b981,color:#10b981,stroke-width:2px
  style COMPLETED fill:#f1f5f9,stroke:#3b82f6,color:#1e293b
  style FAILED fill:#f1f5f9,stroke:#ef4444,color:#1e293b
  style TCOMP fill:#f1f5f9,stroke:#8b5cf6,color:#1e293b`}
            />

            <h3
              className="text-[15px] font-bold"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              페이로드 빌더
            </h3>
            <p className="text-[13px] text-gray-600 mb-4">
              내부 함수 <code className="text-cyan-600 text-xs">buildTeammateIdlePayload()</code>와{" "}
              <code className="text-cyan-600 text-xs">buildTaskCompletedPayload()</code>가 팀
              데이터를 <code className="text-cyan-600 text-xs">HookEventPayload</code> 형식으로
              변환합니다. 두 함수 모두 <code className="text-cyan-600 text-xs">sessionId</code>와{" "}
              <code className="text-cyan-600 text-xs">workingDirectory</code>를 페이로드에 자동으로
              포함시킵니다.
            </p>

            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex flex-col gap-2.5 text-[13px] text-gray-600">
                <div className="flex gap-3">
                  <code className="text-cyan-600 font-bold shrink-0 w-48">
                    event: "TeammateIdle"
                  </code>
                  <span>
                    teamId, memberId, memberName, memberRole, status, result/error, elapsedMs,
                    remaining/total
                  </span>
                </div>
                <div className="flex gap-3">
                  <code className="text-cyan-600 font-bold shrink-0 w-48">
                    event: "TaskCompleted"
                  </code>
                  <span>
                    taskId, taskTitle, taskPriority, assignedTo, result, elapsedMs, dependentTasks,
                    teamId
                  </span>
                </div>
              </div>
            </div>

            <Callout type="info" icon="📝">
              <strong>TeamHookError:</strong> 이 모듈은 자체 에러 클래스{" "}
              <code className="text-cyan-600 text-xs">TeamHookError</code>를 export하지만, 실제로
              모든 에러는 <code className="text-cyan-600 text-xs">try/catch</code>로 삼켜집니다.
              향후 에러 로깅이나 모니터링이 필요할 때 이 클래스를 활용할 수 있습니다.
            </Callout>
          </section>
        </RevealOnScroll>

        {/* ───────────────────── 6. 트러블슈팅 ───────────────────── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>{"🔧"}</span> 트러블슈팅
            </h2>

            <div className="flex flex-col gap-4">
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-600">Q.</span> 웹훅이 팀 이벤트를 수신하지 못합니다
                </h4>
                <div className="text-[13px] text-gray-600 leading-relaxed">
                  <p>
                    먼저 <code className="text-cyan-600 text-xs">emitter.hasTeamHooks()</code>로
                    훅이 설정되어 있는지 확인하세요. 설정이 있지만 동작하지 않는다면{" "}
                    <code className="text-cyan-600 text-xs">hookRunner</code>가 올바른 인스턴스인지,
                    settings.json에 TeammateIdle 또는 TaskCompleted 이벤트 훅이 등록되어 있는지
                    확인하세요.
                  </p>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-600">Q.</span> remainingMembers 값이 0으로 고정됩니다
                </h4>
                <div className="text-[13px] text-gray-600 leading-relaxed">
                  <p>
                    <code className="text-cyan-600 text-xs">handleTeamEvent()</code>를 직접 사용하면
                    <code className="text-cyan-600 text-xs"> remainingMembers</code>가 항상 0입니다.
                    정확한 남은 멤버 수 추적이 필요하면{" "}
                    <code className="text-cyan-600 text-xs">createTeamEventHandler()</code>를
                    사용하세요. 클로저를 통해 자동으로 감소시킵니다.
                  </p>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-600">Q.</span> 훅 실행 실패를 추적하고 싶습니다
                </h4>
                <div className="text-[13px] text-gray-600 leading-relaxed">
                  <p>
                    현재 모든 에러는 조용히 삼켜집니다. 에러 로깅이 필요하다면{" "}
                    <code className="text-cyan-600 text-xs">handleTeamEvent()</code>의{" "}
                    <code className="text-cyan-600 text-xs">catch</code> 블록에 로거를 추가하거나,
                    <code className="text-cyan-600 text-xs"> emitTeammateIdle()</code>의 결과값(
                    <code className="text-cyan-600 text-xs">HookRunResult</code>)을 직접 검사하세요.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </RevealOnScroll>

        {/* ───────────────────── 7. 관련 문서 ───────────────────── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>{"🔗"}</span> 관련 문서
            </h2>

            <SeeAlso
              items={[
                {
                  name: "hooks/runner.ts",
                  slug: "hook-runner",
                  relation: "parent",
                  desc: "훅 실행 엔진 — TeamHookEmitter가 발행한 TeammateIdle/TaskCompleted를 처리",
                },
                {
                  name: "hooks/loader.ts",
                  slug: "hook-loader",
                  relation: "sibling",
                  desc: "settings.json에서 훅 규칙을 로드 — TeammateIdle/TaskCompleted 이벤트 훅 설정",
                },
                {
                  name: "hooks/auto-lint.ts",
                  slug: "hook-auto-lint",
                  relation: "sibling",
                  desc: "파일 수정 후 자동 린트 — team-events와 함께 훅 시스템의 두 확장 통합 모듈",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}

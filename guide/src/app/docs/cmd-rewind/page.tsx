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

export default function CmdRewindPage() {
  return (
    <div className="min-h-screen pt-10 pb-20">
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/commands/rewind.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">/rewind</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="leaf" />
              <span
                className="text-xs font-semibold rounded-md bg-cyan-100 text-cyan-700"
                style={{ padding: "5px 14px" }}
              >
                Slash Command
              </span>
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              LLM이 파일을 수정하기 전에 자동 생성된 체크포인트 목록을 조회하거나, 특정 체크포인트로
              파일을 복원하는 슬래시 명령어입니다.
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
                <code className="text-cyan-600">/rewind</code> 명령어는 LLM이 파일을 수정하기 전에
                자동으로 생성되는 <strong>체크포인트(checkpoint)</strong>를 관리합니다. 체크포인트란
                파일의 특정 시점 스냅샷으로, 문제가 생겼을 때 이전 상태로 되돌릴 수 있게 해줍니다.
              </p>
              <p>
                인자 없이 실행하면 현재 세션에서 사용 가능한 체크포인트 목록을 보여주고, 체크포인트
                ID를 인자로 전달하면 해당 시점으로 파일을 복원합니다. 복원 전에 현재 파일 상태와
                체크포인트 상태를 비교하여 변경 내역(diff)을 확인합니다.
              </p>
              <p>
                각 체크포인트에는 생성 시각, 설명, 추적 중인 파일 수, 그리고 현재 파일과의
                차이(수정됨/삭제됨/변경 없음)가 함께 표시됩니다.
              </p>
            </div>

            <MermaidDiagram
              title="/rewind 명령어 분기 흐름"
              titleColor="purple"
              chart={`graph TD
  USER["/rewind 입력"] --> CMD["rewindCommand.execute()"]
  CMD --> SESSION{"세션 활성?"}
  SESSION -->|"없음"| ERR["에러: No active session"]
  SESSION -->|"있음"| ARGS{"체크포인트 ID<br/>인자 있는가?"}
  ARGS -->|"없음"| LIST["listCheckpoints()<br/><small>체크포인트 목록 + diff 요약</small>"]
  ARGS -->|"있음"| RESTORE["restoreCheckpoint()<br/><small>diff 확인 → 파일 복원</small>"]
  RESTORE --> EMIT["checkpoint:restored<br/><small>이벤트 발생</small>"]

  style CMD fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style LIST fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style RESTORE fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style EMIT fill:#dcfce7,stroke:#10b981,color:#065f46`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> <code>/rewind</code>는 게임의 &quot;세이브 포인트&quot;와
              같습니다. LLM이 코드를 수정할 때마다 자동으로 세이브되고, 잘못되었을 때 원하는 세이브
              포인트로 되돌아갈 수 있습니다.
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

            {/* rewindCommand */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              rewindCommand: SlashCommand
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">/rewind</code> 슬래시 명령어의 메인 정의 객체입니다.
            </p>
            <ParamTable
              params={[
                { name: "name", type: '"rewind"', required: true, desc: "명령어 이름" },
                {
                  name: "description",
                  type: "string",
                  required: true,
                  desc: '"List or restore a checkpoint"',
                },
                {
                  name: "usage",
                  type: "string",
                  required: true,
                  desc: '"/rewind [checkpoint-id]"',
                },
                {
                  name: "execute",
                  type: "(args, context) => Promise<CommandResult>",
                  required: true,
                  desc: "명령어 실행 핸들러",
                },
              ]}
            />

            {/* listCheckpoints */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              listCheckpoints(checkpointManager, workingDirectory)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              모든 체크포인트를 파일 변경 요약과 함께 나열합니다. 각 체크포인트의 ID, 생성 시각,
              설명, 추적 중인 파일 수, 현재와의 차이(modified/deleted/unchanged)를 표시합니다.
            </p>
            <CodeBlock>
              <span className="kw">async function</span> <span className="fn">listCheckpoints</span>
              ({"\n"}
              {"  "}
              <span className="prop">checkpointManager</span>:{" "}
              <span className="type">CheckpointManager</span>,{"\n"}
              {"  "}
              <span className="prop">workingDirectory</span>: <span className="type">string</span>,
              {"\n"}): <span className="type">Promise</span>&lt;
              <span className="type">CommandResult</span>&gt;
            </CodeBlock>
            <ParamTable
              params={[
                {
                  name: "checkpointManager",
                  type: "CheckpointManager",
                  required: true,
                  desc: "체크포인트 관리 객체 (세션 디렉토리 기반)",
                },
                {
                  name: "workingDirectory",
                  type: "string",
                  required: true,
                  desc: "현재 작업 디렉토리 (diff 비교 기준)",
                },
              ]}
            />

            {/* restoreCheckpoint */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              restoreCheckpoint(checkpointManager, checkpointId, context)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              특정 체크포인트로 파일을 복원합니다. 복원 전에 현재 파일과의 diff를 확인하고, 변경된
              파일만 선택적으로 복원합니다. 복원 후{" "}
              <code className="text-cyan-600">checkpoint:restored</code> 이벤트를 발생시킵니다.
            </p>
            <CodeBlock>
              <span className="kw">async function</span>{" "}
              <span className="fn">restoreCheckpoint</span>({"\n"}
              {"  "}
              <span className="prop">checkpointManager</span>:{" "}
              <span className="type">CheckpointManager</span>,{"\n"}
              {"  "}
              <span className="prop">checkpointId</span>: <span className="type">string</span>,
              {"\n"}
              {"  "}
              <span className="prop">context</span>: <span className="type">CommandContext</span>,
              {"\n"}): <span className="type">Promise</span>&lt;
              <span className="type">CommandResult</span>&gt;
            </CodeBlock>
            <ParamTable
              params={[
                {
                  name: "checkpointManager",
                  type: "CheckpointManager",
                  required: true,
                  desc: "체크포인트 관리 객체",
                },
                {
                  name: "checkpointId",
                  type: "string",
                  required: true,
                  desc: "복원할 체크포인트 ID",
                },
                {
                  name: "context",
                  type: "CommandContext",
                  required: true,
                  desc: "작업 디렉토리, 이벤트 emitter 포함",
                },
              ]}
            />

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                활성 세션이 없으면 (<code className="text-cyan-600">context.sessionId</code>가
                없으면) 체크포인트를 사용할 수 없습니다. 세션이 시작된 후에만 동작합니다.
              </li>
              <li>
                체크포인트 데이터는 <code className="text-cyan-600">SESSIONS_DIR</code> 하위 세션
                디렉토리에 저장됩니다. 세션이 삭제되면 체크포인트도 함께 사라집니다.
              </li>
              <li>
                이미 체크포인트 상태와 동일한 파일은 &quot;Nothing to restore&quot;로 스킵됩니다.
                불필요한 덮어쓰기를 방지합니다.
              </li>
              <li>
                복원 후 <code className="text-cyan-600">checkpoint:restored</code> 이벤트가 발생하여
                다른 모듈(예: UI)이 이를 감지할 수 있습니다.
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

            {/* 기본 사용법: 목록 조회 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              기본 사용법 &mdash; 체크포인트 목록 조회
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              인자 없이 <code className="text-cyan-600">/rewind</code>만 입력하면 사용 가능한
              체크포인트 목록이 표시됩니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 입력"}</span>
              {"\n"}
              <span className="str">/rewind</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// 출력 예시"}</span>
              {"\n"}
              <span className="prop">Available checkpoints:</span>
              {"\n"}
              {"\n"}
              {"  "}
              <span className="str">cp_a1b2c3</span>
              {"  "}
              <span className="type">3/22/2026, 2:30:00 PM</span>
              {"  "}
              <span className="prop">Before editing src/index.ts</span>
              {"\n"}
              {"          "}
              <span className="cm">2 file(s) tracked</span>
              {"\n"}
              {"          "}
              <span className="cm">Current state: 1 modified, 1 unchanged</span>
              {"\n"}
              {"\n"}
              {"  "}
              <span className="str">cp_d4e5f6</span>
              {"  "}
              <span className="type">3/22/2026, 2:25:00 PM</span>
              {"  "}
              <span className="prop">Before editing src/utils.ts</span>
              {"\n"}
              {"          "}
              <span className="cm">1 file(s) tracked</span>
              {"\n"}
              {"          "}
              <span className="cm">Current state: 1 modified</span>
              {"\n"}
              {"\n"}
              <span className="prop">
                Use /rewind &lt;checkpoint-id&gt; to restore a checkpoint.
              </span>
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> 체크포인트로 복원하면 현재 파일이 해당 시점의 내용으로{" "}
              <strong>덮어쓰기</strong>됩니다. 복원 전에 현재 변경 사항이 중요하다면 먼저{" "}
              <code>git stash</code>나 <code>/diff</code>로 확인하세요.
            </Callout>

            {/* 복원 사용법 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 특정 체크포인트로 복원
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              체크포인트 ID를 인자로 전달하면 해당 시점으로 파일을 복원합니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 특정 체크포인트로 복원"}</span>
              {"\n"}
              <span className="str">/rewind cp_a1b2c3</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// 출력 예시"}</span>
              {"\n"}
              <span className="prop">Restored checkpoint: cp_a1b2c3</span>
              {"\n"}
              {"  "}
              <span className="cm">Before editing src/index.ts</span>
              {"\n"}
              {"\n"}
              <span className="prop">Restored 1 file(s):</span>
              {"\n"}
              {"  "}
              <span className="fn">+</span> <span className="type">src/index.ts</span>{" "}
              <span className="str">(was modified)</span>
              {"\n"}
              {"\n"}
              <span className="prop">Skipped 1 file(s):</span>
              {"\n"}
              {"  "}
              <span className="fn">-</span> <span className="type">src/config.ts</span>
            </CodeBlock>

            <DeepDive title="복원 프로세스 상세">
              <p className="mb-3">복원은 다음 단계로 진행됩니다:</p>
              <ul className="list-disc list-inside space-y-1.5 text-gray-600">
                <li>
                  <strong>Diff 비교</strong>: 현재 파일 상태와 체크포인트 상태를 비교합니다.
                </li>
                <li>
                  <strong>변경 감지</strong>: <code className="text-cyan-600">modified</code>,{" "}
                  <code className="text-cyan-600">deleted</code>,{" "}
                  <code className="text-cyan-600">unchanged</code>로 분류합니다.
                </li>
                <li>
                  <strong>선택적 복원</strong>: <code className="text-cyan-600">unchanged</code>가
                  아닌 파일만 복원 대상이 됩니다.
                </li>
                <li>
                  <strong>이벤트 발생</strong>: 복원 완료 후{" "}
                  <code className="text-cyan-600">checkpoint:restored</code> 이벤트를 emit합니다.
                </li>
              </ul>
              <p className="mt-3 text-amber-600">
                복원에 실패하면 에러 메시지만 반환하고 파일은 건드리지 않습니다. 부분적으로 복원된
                상태는 발생하지 않습니다.
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
              복원 상태 전이
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">restoreCheckpoint()</code>는 체크포인트와 현재 파일
              상태를 비교한 후 파일을 복원합니다. 이미 동일한 상태면 복원을 건너뜁니다.
            </p>

            <MermaidDiagram
              title="/rewind 복원 상태 전이"
              titleColor="purple"
              chart={`graph TD
  START(("시작")) --> DIFF["diffFromCheckpoint()<br/><small>현재 vs 체크포인트 비교</small>"]
  DIFF --> CHECK{"변경된 파일<br/>있는가?"}
  CHECK -->|"없음"| SKIP["Nothing to restore<br/><small>모든 파일이 이미 동일</small>"]
  CHECK -->|"있음"| EXEC["restoreCheckpoint()<br/><small>파일 내용 덮어쓰기</small>"]
  EXEC --> RESULT["결과 수집<br/><small>restored + skipped 분류</small>"]
  RESULT --> EVENT["checkpoint:restored<br/><small>이벤트 emit</small>"]
  EVENT --> OUTPUT["복원 결과 출력"]

  style DIFF fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style EXEC fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style EVENT fill:#dcfce7,stroke:#10b981,color:#065f46`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              핵심 코드 분석
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">restoreCheckpoint()</code> 함수의 핵심 로직입니다.
              diff 확인 후 변경된 파일만 복원합니다.
            </p>
            <CodeBlock>
              <span className="kw">async function</span>{" "}
              <span className="fn">restoreCheckpoint</span>(...) {"{"}
              {"\n"}
              {"  "}
              <span className="cm">{"// [1] 현재 파일과 체크포인트의 diff 확인"}</span>
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">diff</span> ={" "}
              <span className="kw">await</span> <span className="prop">checkpointManager</span>.
              <span className="fn">diffFromCheckpoint</span>({"\n"}
              {"    "}
              <span className="prop">checkpointId</span>, <span className="prop">context</span>.
              <span className="prop">workingDirectory</span>
              {"\n"}
              {"  "});
              {"\n"}
              {"\n"}
              {"  "}
              <span className="cm">{"// [2] 변경된 파일만 필터링"}</span>
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">changesToRevert</span> ={" "}
              <span className="prop">diff</span>.<span className="fn">filter</span>({"\n"}
              {"    "}
              <span className="prop">d</span> =&gt; <span className="prop">d</span>.
              <span className="prop">status</span> !=={" "}
              <span className="str">&quot;unchanged&quot;</span>
              {"\n"}
              {"  "});
              {"\n"}
              {"\n"}
              {"  "}
              <span className="cm">{"// [3] 변경 없으면 조기 반환"}</span>
              {"\n"}
              {"  "}
              <span className="kw">if</span> (<span className="prop">changesToRevert</span>.
              <span className="prop">length</span> === <span className="num">0</span>) {"{"}
              {"\n"}
              {"    "}
              <span className="kw">return</span> {"{"} <span className="prop">output</span>:{" "}
              <span className="str">&quot;Nothing to restore.&quot;</span>,{" "}
              <span className="prop">success</span>: <span className="kw">true</span> {"}"};{"\n"}
              {"  "}
              {"}"}
              {"\n"}
              {"\n"}
              {"  "}
              <span className="cm">{"// [4] 실제 복원 수행"}</span>
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">result</span> ={" "}
              <span className="kw">await</span> <span className="prop">checkpointManager</span>.
              <span className="fn">restoreCheckpoint</span>(...);
              {"\n"}
              {"\n"}
              {"  "}
              <span className="cm">{"// [5] checkpoint:restored 이벤트 발생"}</span>
              {"\n"}
              {"  "}
              <span className="prop">context</span>.<span className="fn">emit</span>(
              <span className="str">&quot;checkpoint:restored&quot;</span>, {"{"}
              {"\n"}
              {"    "}
              <span className="prop">checkpointId</span>,{"\n"}
              {"    "}
              <span className="prop">restoredFiles</span>: <span className="prop">result</span>.
              <span className="prop">restoredFiles</span>.<span className="prop">length</span>,
              {"\n"}
              {"    "}
              <span className="prop">skippedFiles</span>: <span className="prop">result</span>.
              <span className="prop">skippedFiles</span>.<span className="prop">length</span>,{"\n"}
              {"  "}
              {"}"});
              {"\n"}
              {"}"}
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">[1]</strong> 체크포인트의 파일 내용과 현재 작업
                디렉토리의 파일 내용을 비교합니다.
              </p>
              <p>
                <strong className="text-gray-900">[2]</strong>{" "}
                <code className="text-cyan-600">unchanged</code> 상태(이미 동일)인 파일을 제외하여
                불필요한 덮어쓰기를 방지합니다.
              </p>
              <p>
                <strong className="text-gray-900">[3]</strong> 모든 파일이 이미 체크포인트 상태와
                동일하면 복원할 것이 없으므로 조기 반환합니다.
              </p>
              <p>
                <strong className="text-gray-900">[4]</strong>{" "}
                <code className="text-cyan-600">CheckpointManager</code>에 실제 복원을 위임합니다.
                복원된 파일과 스킵된 파일이 분류되어 반환됩니다.
              </p>
              <p>
                <strong className="text-gray-900">[5]</strong> 복원 결과를 이벤트로 emit하여 UI나
                다른 모듈이 반응할 수 있게 합니다.
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
                &quot;No active session. Checkpoints require an active session.&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                체크포인트는 세션 단위로 관리됩니다. 세션이 시작되지 않은 상태에서는 사용할 수
                없습니다. 대화가 정상적으로 시작된 후에{" "}
                <code className="text-cyan-600">/rewind</code>를 실행하세요.
                <code className="text-cyan-600">/resume</code>으로 이전 세션을 복원할 수도 있습니다.
              </p>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;No checkpoints found for this session.&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                현재 세션에서 LLM이 아직 파일을 수정하지 않았거나, 체크포인트 생성이 비활성화된
                경우입니다. 파일 수정 도구(file-edit, file-write 등)가 실행되어야 체크포인트가 자동
                생성됩니다.
              </p>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;All files are already at checkpoint state. Nothing to restore.&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                현재 파일 내용이 이미 해당 체크포인트 시점과 동일합니다. 다른 체크포인트를
                선택하거나, 이미 복원이 완료된 상태임을 확인하세요.
              </p>
            </div>

            {/* FAQ 4 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;Failed to restore checkpoint 에러가 발생해요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                체크포인트 데이터가 손상되었거나, 파일 시스템 권한 문제일 수 있습니다. 세션
                디렉토리(<code className="text-cyan-600">~/.dhelix/sessions/</code>)의 권한을
                확인하세요. 또한 체크포인트 ID가 정확한지 확인하세요 &mdash;{" "}
                <code className="text-cyan-600">/rewind</code>로 목록을 먼저 조회하여 올바른 ID를
                복사하는 것이 좋습니다.
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
                  name: "core/checkpoint-manager.ts",
                  slug: "checkpoint-manager",
                  relation: "parent",
                  desc: "체크포인트 생성/조회/복원/diff 로직을 담당하는 핵심 관리 모듈",
                },
                {
                  name: "commands/undo.ts",
                  slug: "cmd-undo",
                  relation: "sibling",
                  desc: "/undo 명령어 — 가장 최근 체크포인트로 빠르게 되돌리는 간편 명령어",
                },
                {
                  name: "commands/diff.ts",
                  slug: "cmd-diff",
                  relation: "sibling",
                  desc: "/diff 명령어 — 복원 전 현재 변경 사항 확인에 활용",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}

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

export default function ToolKillShellPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/tools/definitions/kill-shell.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">kill_shell Tool</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="infra" />
              <span className="text-sm text-gray-500">백그라운드 프로세스 종료</span>
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              실행 중인 백그라운드 셸 프로세스에 SIGTERM / SIGKILL / SIGINT 시그널을 보내 종료하는
              도구입니다.
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
                <code className="text-cyan-600">kill_shell</code>은{" "}
                <code className="text-cyan-600">bash_exec</code>의{" "}
                <code className="text-cyan-600">run_in_background: true</code>로 시작한 프로세스를
                종료합니다. 세 가지 시그널 중 하나를 선택하여 종료 방식을 제어할 수 있습니다.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                <div className="glass-card p-4">
                  <div className="text-sm font-bold text-emerald-600 mb-1">SIGTERM (기본값)</div>
                  <p className="text-[13px] text-gray-600">
                    정상 종료 요청. 프로세스가 정리 작업(파일 닫기, 데이터 저장)을 마치고
                    종료합니다. 대부분의 경우 이 시그널을 사용하세요.
                  </p>
                </div>
                <div className="glass-card p-4">
                  <div className="text-sm font-bold text-amber-600 mb-1">SIGINT</div>
                  <p className="text-[13px] text-gray-600">
                    인터럽트. Ctrl+C를 누른 것과 동일합니다. 프로세스가 SIGINT를 캐치하여 정리할 수
                    있습니다.
                  </p>
                </div>
                <div className="glass-card p-4">
                  <div className="text-sm font-bold text-red-600 mb-1">SIGKILL</div>
                  <p className="text-[13px] text-gray-600">
                    강제 종료. OS가 즉시 프로세스를 종료합니다. 정리 작업 없이 즉시 종료가 필요할 때
                    사용합니다.
                  </p>
                </div>
              </div>

              <p>
                권한 수준은 <code className="text-amber-600">&quot;confirm&quot;</code>으로, 실행
                중인 프로세스를 종료하는 것은 되돌릴 수 없으므로 사용자 확인이 필요합니다.
              </p>
            </div>

            <MermaidDiagram
              title="kill_shell 아키텍처 위치"
              titleColor="purple"
              chart={`graph TD
  AGENT["Agent Loop<br/><small>agent-loop.ts</small>"]
  EXEC["Tool Executor<br/><small>tools/executor.ts</small>"]
  PERM["Permission Manager<br/><small>permissions/</small>"]
  KS["kill_shell<br/><small>kill-shell.ts</small>"]
  BPM["BackgroundProcessManager<br/><small>executor.ts 내부</small>"]
  OS["OS 프로세스<br/><small>kill(pid, signal)</small>"]

  AGENT -->|"도구 호출"| EXEC
  EXEC -->|"권한 확인"| PERM
  PERM -->|"confirm"| KS
  KS -->|"kill(processId, signal)"| BPM
  BPM -->|"process.kill(pid)"| OS

  style KS fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style AGENT fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style EXEC fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style PERM fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style BPM fill:#dcfce7,stroke:#10b981,color:#065f46
  style OS fill:#fee2e2,stroke:#ef4444,color:#991b1b`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> 작업 관리자(Task Manager)에서 프로세스를 선택하고 &ldquo;작업
              끝내기&rdquo; 버튼을 누르는 것과 같습니다. SIGTERM은 &ldquo;정상 종료 요청&rdquo;이고,
              SIGKILL은 &ldquo;강제 종료&rdquo;입니다.
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

            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              매개변수 스키마 (paramSchema)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              프로세스 ID는 필수이며, 시그널은 기본값이 SIGTERM입니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "processId",
                  type: "string",
                  required: true,
                  desc: '종료할 프로세스 ID (예: "bg-1")',
                },
                {
                  name: "signal",
                  type: '"SIGTERM" | "SIGKILL" | "SIGINT"',
                  required: false,
                  desc: "보낼 시그널 — 기본값: SIGTERM",
                },
              ]}
            />

            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              killShellTool (ToolDefinition)
            </h3>
            <ParamTable
              params={[
                {
                  name: "name",
                  type: '"kill_shell"',
                  required: true,
                  desc: "도구 이름 — 레지스트리에서 이 이름으로 호출됨",
                },
                {
                  name: "permissionLevel",
                  type: '"confirm"',
                  required: true,
                  desc: "실행 중인 프로세스 종료는 되돌릴 수 없으므로 사용자 확인 필요",
                },
              ]}
            />

            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                이미 종료된 프로세스에 <code className="text-cyan-600">kill_shell</code>을 호출하면
                에러 없이 &ldquo;has already exited&rdquo; 메시지를 반환합니다. 멱등성을 보장합니다.
              </li>
              <li>
                SIGKILL은 프로세스가 정리 작업 없이 즉시 종료됩니다. 파일 쓰기 중이었다면 데이터
                손실이 발생할 수 있습니다. SIGTERM → 대기 → SIGKILL 순서를 권장합니다.
              </li>
              <li>
                존재하지 않는 <code className="text-cyan-600">processId</code>를 전달하면{" "}
                <code className="text-cyan-600">isError: true</code>를 반환합니다.
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

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              기본 사용법 &mdash; 정상 종료 (SIGTERM)
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              기본값인 SIGTERM으로 개발 서버를 정상 종료합니다.
            </p>
            <CodeBlock>
              {"// 기본 종료 (SIGTERM)\n"}
              {"{\n"}
              {"  processId: 'bg-1'\n"}
              {"}\n"}
              {"\n"}
              {"// 반환 예시:\n"}
              {"// Sent SIGTERM to process bg-1 (PID 12345)."}
            </CodeBlock>

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 강제 종료 (SIGKILL)
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              SIGTERM으로 종료되지 않는 프로세스를 강제 종료합니다.
            </p>
            <CodeBlock>
              {"// 강제 종료\n"}
              {"{\n"}
              {"  processId: 'bg-2',\n"}
              {"  signal: 'SIGKILL'\n"}
              {"}\n"}
              {"\n"}
              {"// 반환 예시:\n"}
              {"// Sent SIGKILL to process bg-2 (PID 22222)."}
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> SIGKILL은 즉시 강제 종료합니다. 파일을 쓰거나 데이터베이스
              트랜잭션 중인 프로세스에 사용하면 데이터 손실이 발생할 수 있습니다. 먼저 SIGTERM을
              시도하고, 프로세스가 종료되지 않을 때만 SIGKILL을 사용하세요.
            </Callout>

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              이미 종료된 프로세스 처리
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              이미 종료된 프로세스에 시그널을 보내면 에러 없이 상태를 반환합니다.
            </p>
            <CodeBlock>
              {"// 반환 예시 (이미 종료된 경우):\n"}
              {"// Process bg-1 (PID 12345) has already exited with code 0."}
            </CodeBlock>

            <DeepDive title="Unix 시그널(Signal) 심층 이해">
              <p className="mb-3">
                Unix 시그널은 프로세스에 비동기 알림을 보내는 메커니즘입니다. 세 가지 시그널의
                차이를 이해하면 올바른 시그널을 선택할 수 있습니다.
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-600 text-[13px]">
                <li>
                  <strong>SIGTERM (15):</strong> 프로세스에 종료를 &ldquo;요청&rdquo;합니다.
                  프로세스가 이 시그널을 캐치하여 정리(cleanup) 작업을 수행하고 종료할 수 있습니다.
                  프로세스가 응답하지 않으면 종료되지 않을 수 있습니다.
                </li>
                <li>
                  <strong>SIGINT (2):</strong> 인터럽트 요청. 터미널에서 Ctrl+C를 눌렀을 때 발생하는
                  시그널과 동일합니다. 많은 프로그램이 SIGINT를 캐치하여 현재 작업을 중단합니다.
                </li>
                <li>
                  <strong>SIGKILL (9):</strong> OS 커널이 직접 프로세스를 강제 종료합니다.
                  프로세스가 이 시그널을 캐치하거나 무시할 수 없습니다. 항상 즉시 종료됩니다.
                </li>
              </ul>
              <p className="mt-3 text-gray-600 text-[13px]">
                Node.js에서는 <code className="text-cyan-600">process.kill(pid, signal)</code>로
                시그널을 보냅니다. Windows에서는 신호 체계가 달라 SIGTERM과 SIGKILL이 모두 강제
                종료로 동작할 수 있습니다.
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
              실행 흐름 다이어그램
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">execute()</code> 함수의 전체 흐름입니다. 프로세스 존재
              여부, 이미 종료된 경우, 시그널 전송 결과 순서로 분기합니다.
            </p>

            <MermaidDiagram
              title="kill_shell 실행 흐름"
              titleColor="purple"
              chart={`graph TD
  START(("execute()")) --> LOOKUP["getStatus(processId)"]
  LOOKUP --> FOUND{"프로세스<br/>존재?"}
  FOUND -->|"없음"| ERR["isError: true 반환"]
  FOUND -->|"있음"| RUNNING{"실행 중?"}
  RUNNING -->|"이미 종료됨"| ALREADY["종료 코드와 함께<br/>isError: false 반환"]
  RUNNING -->|"실행 중"| KILL["process.kill(pid, signal)"]
  KILL --> SENT{"시그널<br/>전송 성공?"}
  SENT -->|"성공"| OK["Sent SIGNAL 메시지 반환"]
  SENT -->|"실패"| FAIL["Failed to send 메시지 반환<br/>isError: true"]

  style START fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style FOUND fill:#fef3c7,stroke:#f59e0b,color:#78350f
  style ERR fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style KILL fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style OK fill:#dcfce7,stroke:#10b981,color:#065f46
  style ALREADY fill:#dcfce7,stroke:#10b981,color:#065f46
  style FAIL fill:#fee2e2,stroke:#ef4444,color:#991b1b`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              핵심 코드 분석
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              이미 종료된 프로세스 처리와 시그널 전송 패턴입니다.
            </p>
            <CodeBlock>
              {"// 이미 종료된 경우 — 멱등성 보장\n"}
              {"if (!status.running) {\n"}
              {"  return {\n"}
              {"    output: `Process ${status.processId} has already exited\n"}
              {"             with code ${status.exitCode ?? 'unknown'}.`,\n"}
              {"    isError: false,\n"}
              {"  };\n"}
              {"}\n"}
              {"\n"}
              {"// 시그널 전송\n"}
              {"const signal = params.signal ?? 'SIGTERM';\n"}
              {"const killed = backgroundProcessManager.kill(\n"}
              {"  params.processId,\n"}
              {"  signal as NodeJS.Signals\n"}
              {");"}
            </CodeBlock>
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

            <div className="space-y-6">
              <div className="glass-card p-5">
                <h4 className="text-sm font-bold text-gray-900 mb-2">
                  Q: SIGTERM을 보냈는데 프로세스가 종료되지 않습니다.
                </h4>
                <p className="text-[13px] text-gray-600">
                  일부 프로세스는 SIGTERM을 무시하거나 종료에 시간이 걸릴 수 있습니다. 잠시 후{" "}
                  <code className="text-cyan-600">bash_output</code>으로 상태를 확인하고, 여전히
                  실행 중이면 <code className="text-cyan-600">signal: &quot;SIGKILL&quot;</code>로
                  강제 종료하세요.
                </p>
              </div>

              <div className="glass-card p-5">
                <h4 className="text-sm font-bold text-gray-900 mb-2">
                  Q: &ldquo;Failed to send SIGTERM&rdquo; 오류가 납니다.
                </h4>
                <p className="text-[13px] text-gray-600">
                  시그널 전송 중 프로세스가 이미 종료되었거나, OS 권한 문제가 발생했을 수 있습니다.{" "}
                  <code className="text-cyan-600">bash_output</code>으로 현재 프로세스 상태를
                  확인하세요.
                </p>
              </div>

              <div className="glass-card p-5">
                <h4 className="text-sm font-bold text-gray-900 mb-2">
                  Q: Windows에서 시그널이 예상과 다르게 동작합니다.
                </h4>
                <p className="text-[13px] text-gray-600">
                  Windows는 Unix 시그널 체계를 완전히 지원하지 않습니다. SIGTERM과 SIGKILL 모두 강제
                  종료로 동작할 수 있습니다. SIGINT는 일부 프로세스에서만 지원됩니다.
                </p>
              </div>

              <div className="glass-card p-5">
                <h4 className="text-sm font-bold text-gray-900 mb-2">
                  Q: 프로세스를 종료했는데 포트가 아직 점유 중입니다.
                </h4>
                <p className="text-[13px] text-gray-600">
                  프로세스가 종료되어도 OS가 포트를 해제하기까지 TIME_WAIT 상태로 잠시 점유될 수
                  있습니다. 일반적으로 몇 초 후 자동으로 해제됩니다.
                </p>
              </div>
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
              links={[
                {
                  href: "/docs/tool-bash-exec",
                  title: "bash_exec Tool",
                  desc: "셸 명령 실행 — run_in_background로 프로세스를 시작합니다",
                },
                {
                  href: "/docs/tool-bash-output",
                  title: "bash_output Tool",
                  desc: "백그라운드 프로세스의 출력을 증분 읽기 방식으로 확인합니다",
                },
                {
                  href: "/docs/tool-executor",
                  title: "Tool Executor",
                  desc: "BackgroundProcessManager를 포함한 도구 실행 파이프라인",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}

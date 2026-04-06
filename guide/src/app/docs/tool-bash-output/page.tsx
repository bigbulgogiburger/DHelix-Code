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

export default function ToolBashOutputPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/tools/definitions/bash-output.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">bash_output Tool</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="infra" />
              <span className="text-sm text-gray-500">백그라운드 프로세스 출력 읽기</span>
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              백그라운드에서 실행 중인 셸 프로세스의 새 출력을 증분 읽기 방식으로 확인하는
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
                <code className="text-cyan-600">bash_output</code>은{" "}
                <code className="text-cyan-600">bash_exec</code>의{" "}
                <code className="text-cyan-600">run_in_background: true</code>로 시작한 프로세스의
                출력을 확인하는 도구입니다. 백그라운드로 시작한 개발 서버, 빌드 프로세스, 장시간
                실행 스크립트의 현재 상태를 조회할 때 사용합니다.
              </p>
              <p>
                핵심 기능은 <strong>증분 읽기(incremental read)</strong>입니다. 이전에 읽은 위치를
                기억하고, 마지막 확인 이후 새로 추가된 출력만 반환합니다. 매번 전체 로그를 읽어오지
                않으므로 LLM 컨텍스트를 절약하면서 프로세스를 폴링할 수 있습니다.
              </p>
              <p>
                프로세스 상태(실행 중 / 종료)와 종료 코드도 함께 반환합니다. 권한 수준은{" "}
                <code className="text-emerald-600">&quot;safe&quot;</code>로, 출력을 읽기만 하므로
                사용자 확인 없이 실행됩니다.
              </p>
            </div>

            <MermaidDiagram
              title="bash_output 아키텍처 위치"
              titleColor="purple"
              chart={`graph TD
  AGENT["Agent Loop<br/><small>agent-loop.ts</small>"]
  EXEC["Tool Executor<br/><small>tools/executor.ts</small>"]
  BO["bash_output<br/><small>bash-output.ts</small>"]
  BPM["BackgroundProcessManager<br/><small>executor.ts 내부</small>"]
  LOG["임시 로그 파일<br/><small>/tmp/dhelix-bg-*.log</small>"]

  AGENT -->|"도구 호출"| EXEC
  EXEC --> BO
  BO -->|"getStatus(processId)"| BPM
  BO -->|"getIncrementalOutput()"| BPM
  BPM -->|"증분 읽기"| LOG

  style BO fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style AGENT fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style EXEC fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style BPM fill:#dcfce7,stroke:#10b981,color:#065f46
  style LOG fill:#f1f5f9,stroke:#64748b,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> 백그라운드 프로세스는 로그 파일을 계속 작성하는 작업자와
              같습니다. <code>bash_output</code>은 그 로그 파일을 &ldquo;마지막으로 읽은
              위치부터&rdquo; 읽어주는 책갈피입니다.
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
              단 하나의 필수 매개변수만 받습니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "processId",
                  type: "string",
                  required: true,
                  desc: 'bash_exec 백그라운드 실행 시 반환된 프로세스 ID (예: "bg-1")',
                },
              ]}
            />

            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              반환값 구조
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              <code className="text-cyan-600">ToolResult.output</code>은 아래 형식의 문자열입니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "processId",
                  type: "string",
                  required: true,
                  desc: "프로세스 ID (예: bg-1)",
                },
                { name: "pid", type: "number", required: true, desc: "OS 수준 PID" },
                {
                  name: "running",
                  type: "boolean",
                  required: true,
                  desc: "프로세스 실행 여부 — false이면 exitCode 포함",
                },
                {
                  name: "exitCode",
                  type: "number | null",
                  required: false,
                  desc: "종료 코드 (종료 시)",
                },
                {
                  name: "hasNewOutput",
                  type: "boolean",
                  required: true,
                  desc: "마지막 확인 이후 새 출력 유무",
                },
              ]}
            />

            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                존재하지 않는 <code className="text-cyan-600">processId</code>를 전달하면{" "}
                <code className="text-cyan-600">isError: true</code>를 반환합니다. 이는 프로세스가
                이미 정리된 경우에도 해당됩니다.
              </li>
              <li>
                증분 위치는 <code className="text-cyan-600">BackgroundProcessManager</code> 내부에
                저장됩니다. 프로세스가 종료된 후에도 마지막 출력을 한 번 더 읽을 수 있습니다.
              </li>
              <li>
                새 출력이 없으면 <code className="text-cyan-600">(no new output)</code>을
                반환합니다. 에러가 아닙니다.
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
              기본 패턴 &mdash; 백그라운드 서버 시작 후 출력 확인
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">bash_exec</code>로 서버를 시작하고,{" "}
              <code className="text-cyan-600">bash_output</code>으로 준비 완료를 확인합니다.
            </p>
            <CodeBlock>
              {"// 1단계: 개발 서버를 백그라운드로 시작\n"}
              {"// bash_exec({ command: 'npm run dev', run_in_background: true })\n"}
              {"// → 'Process ID: bg-1' 반환\n"}
              {"\n"}
              {"// 2단계: 출력 확인\n"}
              {"{\n"}
              {"  processId: 'bg-1'\n"}
              {"}\n"}
              {"\n"}
              {"// 출력 예시:\n"}
              {"// Process bg-1 (PID 12345)\n"}
              {"// Command: npm run dev\n"}
              {"// Status: running\n"}
              {"//\n"}
              {"// Output:\n"}
              {"// ✓ Ready in 1.2s\n"}
              {"// ○ Local: http://localhost:3000"}
            </CodeBlock>

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 종료 감지
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              프로세스가 종료되면 <code className="text-cyan-600">Status: exited</code>와 종료
              코드가 반환됩니다.
            </p>
            <CodeBlock>
              {"// 빌드가 완료된 후 확인\n"}
              {"// Process bg-2 (PID 22222)\n"}
              {"// Command: npm run build\n"}
              {"// Status: exited (code 0)\n"}
              {"//\n"}
              {"// Output:\n"}
              {"// ✓ Compiled successfully\n"}
              {"// ✓ Linting... done"}
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> <code>bash_output</code>은 증분 읽기를 사용합니다. 같은{" "}
              <code>processId</code>로 두 번 호출하면 두 번째 호출에서는 첫 번째 이후의 새 출력만
              반환됩니다. 전체 로그를 다시 보려면 프로세스를 재시작해야 합니다.
            </Callout>

            <DeepDive title="증분 읽기(incremental read) 내부 동작">
              <p className="mb-3">
                <code className="text-cyan-600">BackgroundProcessManager</code>는 각 프로세스마다{" "}
                <code className="text-cyan-600">readOffset</code>을 관리합니다.
              </p>
              <p className="mb-3">
                <code className="text-cyan-600">getIncrementalOutput()</code>이 호출될 때마다:
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-gray-600 text-[13px]">
                <li>
                  임시 로그 파일을 <code>readOffset</code> 위치부터 읽습니다.
                </li>
                <li>
                  읽은 바이트 수만큼 <code>readOffset</code>을 증가시킵니다.
                </li>
                <li>다음 호출에서는 그 이후의 데이터만 반환합니다.</li>
              </ul>
              <p className="mt-3 text-gray-600 text-[13px]">
                이 방식은 Node.js의{" "}
                <code className="text-cyan-600">fs.read(fd, buffer, offset, length, position)</code>
                을 활용하여 파일 전체를 메모리에 올리지 않고 효율적으로 읽습니다.
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
              <code className="text-cyan-600">execute()</code> 함수의 전체 흐름입니다. 프로세스
              조회, 증분 읽기, 상태 판단 순서로 진행됩니다.
            </p>

            <MermaidDiagram
              title="bash_output 실행 흐름"
              titleColor="purple"
              chart={`graph TD
  START(("execute()")) --> LOOKUP["getStatus(processId)"]
  LOOKUP --> FOUND{"프로세스<br/>존재?"}
  FOUND -->|"없음"| ERR["isError: true 반환"]
  FOUND -->|"있음"| INC["getIncrementalOutput()"]
  INC --> STATUS{"running?"}
  STATUS -->|"실행 중"| R1["Status: running"]
  STATUS -->|"종료됨"| R2["Status: exited (code N)"]
  R1 --> OUTPUT{"새 출력<br/>있음?"}
  R2 --> OUTPUT
  OUTPUT -->|"있음"| SHOW["Output 섹션 포함"]
  OUTPUT -->|"없음"| EMPTY["(no new output)"]
  SHOW --> RESULT["ToolResult 반환"]
  EMPTY --> RESULT

  style START fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style FOUND fill:#fef3c7,stroke:#f59e0b,color:#78350f
  style ERR fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style INC fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style RESULT fill:#dcfce7,stroke:#10b981,color:#065f46`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              핵심 코드 분석
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              증분 출력을 읽고 상태 문자열을 조합하는 핵심 로직입니다.
            </p>
            <CodeBlock>
              {"// BackgroundProcessManager에서 상태 조회\n"}
              {"const status = backgroundProcessManager.getStatus(params.processId);\n"}
              {"\n"}
              {"// 증분 읽기 — 마지막 확인 이후 새 출력만\n"}
              {"const { output, running, exitCode } =\n"}
              {"  backgroundProcessManager.getIncrementalOutput(params.processId);\n"}
              {"\n"}
              {"// 상태 텍스트\n"}
              {"const statusLine = running\n"}
              {"  ? 'Status: running'\n"}
              {"  : `Status: exited (code ${exitCode ?? 'unknown'})`;\n"}
              {"\n"}
              {"// 출력 섹션 (새 출력 없으면 no new output)\n"}
              {"const outputSection = output.length > 0\n"}
              {"  ? `\\n\\nOutput:\\n${output}`\n"}
              {"  : '\\n\\n(no new output)';"}
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
                  Q: &ldquo;No background process found&rdquo; 오류가 납니다.
                </h4>
                <p className="text-[13px] text-gray-600">
                  <code className="text-cyan-600">processId</code>가 올바른지 확인하세요.{" "}
                  <code className="text-cyan-600">bash_exec</code>의 백그라운드 실행 결과에서{" "}
                  <code className="text-cyan-600">Process ID: bg-N</code> 형식으로 반환됩니다.
                  세션이 재시작되면 프로세스 목록이 초기화됩니다.
                </p>
              </div>

              <div className="glass-card p-5">
                <h4 className="text-sm font-bold text-gray-900 mb-2">
                  Q: 항상 &ldquo;(no new output)&rdquo;만 반환됩니다.
                </h4>
                <p className="text-[13px] text-gray-600">
                  증분 읽기를 사용하기 때문에, 이전 호출 이후 새 출력이 없으면 빈 결과를 반환합니다.
                  프로세스가 아직 아무것도 출력하지 않았거나, 이미 모든 출력을 읽은 경우입니다. 잠시
                  후 다시 호출해보세요.
                </p>
              </div>

              <div className="glass-card p-5">
                <h4 className="text-sm font-bold text-gray-900 mb-2">
                  Q: 전체 로그를 처음부터 보려면 어떻게 해야 하나요?
                </h4>
                <p className="text-[13px] text-gray-600">
                  증분 읽기 특성상 이미 읽은 출력은 다시 제공되지 않습니다. 전체 로그가 필요하면{" "}
                  <code className="text-cyan-600">kill_shell</code>로 기존 프로세스를 종료하고{" "}
                  <code className="text-cyan-600">bash_exec</code>로 새로 시작하세요.
                </p>
              </div>

              <div className="glass-card p-5">
                <h4 className="text-sm font-bold text-gray-900 mb-2">
                  Q: 프로세스가 종료되었는데 출력을 아직 못 읽었습니다.
                </h4>
                <p className="text-[13px] text-gray-600">
                  프로세스가 종료된 후에도 <code className="text-cyan-600">bash_output</code>을
                  호출하여 마지막 출력을 읽을 수 있습니다.{" "}
                  <code className="text-cyan-600">Status: exited (code 0)</code>과 함께 미읽은
                  출력이 반환됩니다.
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
                  desc: "셸 명령 실행 — 백그라운드 모드로 프로세스를 시작합니다",
                },
                {
                  href: "/docs/tool-kill-shell",
                  title: "kill_shell Tool",
                  desc: "백그라운드 프로세스에 시그널을 보내 종료합니다",
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

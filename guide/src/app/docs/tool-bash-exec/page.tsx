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

export default function ToolBashExecPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/tools/definitions/bash-exec.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">bash_exec Tool</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="infra" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              셸 명령 실행 도구 — 빌드, 테스트, Git 등 시스템 명령을 실행하고 결과를 반환합니다.
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
                <code className="text-cyan-600">bash_exec</code>는 셸 명령을 실행하고
                stdout/stderr를 반환하는 도구입니다. 빌드, 테스트 실행, Git 명령, 패키지 설치 등
                시스템 수준의 작업을 에이전트가 수행할 수 있게 합니다.
              </p>
              <p>
                <strong>포그라운드(동기) 실행</strong>과 <strong>백그라운드(비동기) 실행</strong>을
                모두 지원합니다. 포그라운드 실행은 명령이 완료될 때까지 대기하고, 백그라운드 실행은
                즉시 PID를 반환하여 장시간 명령을 비동기로 실행합니다.
              </p>
              <p>
                대화형 명령(vim, git rebase -i 등)은 자동으로 감지하여 차단합니다. 실시간 출력
                스트리밍을 지원하여 UI에서 명령 실행 상황을 실시간으로 볼 수 있습니다. 권한 수준은{" "}
                <code className="text-amber-600">&quot;confirm&quot;</code>으로, 시스템 명령 실행 전
                사용자 확인이 필요합니다.
              </p>
            </div>

            <MermaidDiagram
              title="bash_exec 아키텍처 위치"
              titleColor="purple"
              chart={`graph TD
  AGENT["Agent Loop<br/><small>agent-loop.ts</small>"]
  EXEC["Tool Executor<br/><small>tools/executor.ts</small>"]
  PERM["Permission Manager<br/><small>permissions/</small>"]
  BE["bash_exec<br/><small>bash-exec.ts</small>"]
  FG["포그라운드 실행<br/><small>spawn + pipe</small>"]
  BG["백그라운드 실행<br/><small>BackgroundProcessManager</small>"]
  SHELL["셸 감지<br/><small>bash / zsh / cmd / Git Bash</small>"]

  AGENT -->|"도구 호출"| EXEC
  EXEC -->|"권한 확인"| PERM
  PERM -->|"confirm"| BE
  BE -->|"run_in_background: false"| FG
  BE -->|"run_in_background: true"| BG
  BE -->|"플랫폼별 셸 선택"| SHELL

  style BE fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style AGENT fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style EXEC fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style PERM fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style FG fill:#dcfce7,stroke:#10b981,color:#065f46
  style BG fill:#dcfce7,stroke:#10b981,color:#065f46
  style SHELL fill:#f1f5f9,stroke:#64748b,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> 터미널을 에이전트에게 빌려주는 것과 같습니다. 에이전트가
              터미널에 명령을 입력하고, 결과를 읽어 다음 행동을 결정합니다. 단, 위험한 대화형
              명령(vim 등)은 자동으로 차단되어 안전합니다.
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

            {/* paramSchema */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              매개변수 스키마 (paramSchema)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              Zod로 정의된 입력 매개변수입니다. command만 필수이고 나머지는 선택사항입니다.
            </p>
            <ParamTable
              params={[
                { name: "command", type: "string", required: true, desc: "실행할 셸 명령 문자열" },
                {
                  name: "description",
                  type: "string",
                  required: false,
                  desc: "명령에 대한 간단한 설명 — UI에 표시됨",
                },
                {
                  name: "run_in_background",
                  type: "boolean",
                  required: false,
                  desc: "백그라운드 실행 여부 — true이면 즉시 PID 반환",
                },
                {
                  name: "timeout",
                  type: "number",
                  required: false,
                  desc: "타임아웃(ms). 기본 120초, 최소 1초, 최대 600초",
                },
              ]}
            />

            {/* ToolDefinition */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              bashExecTool (ToolDefinition)
            </h3>
            <ParamTable
              params={[
                {
                  name: "name",
                  type: '"bash_exec"',
                  required: true,
                  desc: "도구 이름 — 레지스트리에서 이 이름으로 호출됨",
                },
                {
                  name: "permissionLevel",
                  type: '"confirm"',
                  required: true,
                  desc: "시스템 명령 실행이므로 사용자 확인 필요",
                },
                {
                  name: "description",
                  type: "동적 생성",
                  required: true,
                  desc: "buildDescription()으로 플랫폼에 따라 동적 생성",
                },
                {
                  name: "timeoutMs",
                  type: "TOOL_TIMEOUTS.bash",
                  required: true,
                  desc: "constants.ts에서 정의된 타임아웃 (기본 120초)",
                },
              ]}
            />

            {/* 대화형 명령 목록 */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              차단되는 대화형 명령 (INTERACTIVE_COMMANDS)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              터미널 입력이 필요한 대화형 명령은 비대화형 환경에서 실행할 수 없어 자동으로
              차단됩니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "git rebase -i",
                  type: "Git",
                  required: true,
                  desc: '대화형 rebase — 대안: "git rebase --onto"',
                },
                {
                  name: "git add -i / -p",
                  type: "Git",
                  required: true,
                  desc: "대화형/패치 모드 add",
                },
                {
                  name: "git commit --amend",
                  type: "Git",
                  required: true,
                  desc: '편집기 실행 — 대안: "git commit --amend -m"',
                },
                {
                  name: "vim / nvim / nano / emacs",
                  type: "에디터",
                  required: true,
                  desc: "터미널 에디터 — 파이프 환경에서 사용 불가",
                },
                {
                  name: "less / more / top / htop",
                  type: "유틸",
                  required: true,
                  desc: "페이저/모니터 — 대화형 입력 필요",
                },
                {
                  name: "ssh / python -i / irb",
                  type: "셸/REPL",
                  required: true,
                  desc: "원격 셸 및 대화형 인터프리터",
                },
              ]}
            />

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                stdin은 <code className="text-cyan-600">&quot;ignore&quot;</code>로 설정되어 있어
                사용자 입력을 받을 수 없습니다. 대화형 명령은 반드시 비대화형 대안을 사용하세요.
              </li>
              <li>
                타임아웃 초과 시 <code className="text-cyan-600">SIGTERM</code>으로 프로세스를
                종료합니다. 기본 120초이며, 최대 600초(10분)까지 설정 가능합니다.
              </li>
              <li>
                도구 설명은 <code className="text-cyan-600">buildDescription()</code>으로{" "}
                <strong>플랫폼에 따라 동적으로 생성</strong>됩니다. Git Bash, cmd.exe, POSIX 셸에
                따라 다른 안내를 제공합니다.
              </li>
              <li>
                WSL1 환경에서는 파일 I/O 성능 저하 경고가 출력에 추가됩니다. WSL2로 업그레이드를
                권장합니다.
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
              기본 사용법 &mdash; 포그라운드 실행
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              가장 기본적인 사용 패턴입니다. 명령이 완료될 때까지 대기하고 결과를 반환합니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 빌드 실행"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">result</span> ={" "}
              <span className="kw">await</span> <span className="fn">execute</span>({"{"}
              {"\n"}
              {"  "}
              <span className="prop">command</span>:{" "}
              <span className="str">&quot;npm run build&quot;</span>,{"\n"}
              {"  "}
              <span className="prop">description</span>:{" "}
              <span className="str">&quot;프로젝트 빌드&quot;</span>,{"\n"}
              {"}"}, <span className="prop">context</span>);
              {"\n"}
              {"\n"}
              <span className="cm">{"// 테스트 실행 (타임아웃 300초)"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">testResult</span> ={" "}
              <span className="kw">await</span> <span className="fn">execute</span>({"{"}
              {"\n"}
              {"  "}
              <span className="prop">command</span>:{" "}
              <span className="str">&quot;npm test&quot;</span>,{"\n"}
              {"  "}
              <span className="prop">timeout</span>: <span className="num">300_000</span>,{"\n"}
              {"}"}, <span className="prop">context</span>);
            </CodeBlock>

            {/* 백그라운드 실행 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 백그라운드 실행
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">run_in_background: true</code>로 장시간 명령을
              비동기로 실행합니다. 즉시 PID를 반환하여 다른 작업을 계속할 수 있습니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 개발 서버를 백그라운드로 시작"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">result</span> ={" "}
              <span className="kw">await</span> <span className="fn">execute</span>({"{"}
              {"\n"}
              {"  "}
              <span className="prop">command</span>:{" "}
              <span className="str">&quot;npm run dev&quot;</span>,{"\n"}
              {"  "}
              <span className="prop">run_in_background</span>: <span className="kw">true</span>,
              {"\n"}
              {"  "}
              <span className="prop">description</span>:{" "}
              <span className="str">&quot;개발 서버 시작&quot;</span>,{"\n"}
              {"}"}, <span className="prop">context</span>);
              {"\n"}
              {"\n"}
              <span className="cm">{"// 반환 형식:"}</span>
              {"\n"}
              <span className="cm">{"// Background process started (개발 서버 시작)."}</span>
              {"\n"}
              <span className="cm">{"// Process ID: bg_1"}</span>
              {"\n"}
              <span className="cm">{"// PID: 12345"}</span>
              {"\n"}
              <span className="cm">{"// Output file: /tmp/dhelix-bg-12345.log"}</span>
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> 대화형 명령(vim, git rebase -i 등)을 실행하면 에러를
              반환합니다. 비대화형 대안을 사용하세요. 예: <code>git rebase -i</code> 대신{" "}
              <code>git rebase --onto</code>,<code> git commit --amend</code> 대신{" "}
              <code>git commit --amend -m &quot;msg&quot;</code>
            </Callout>

            <Callout type="tip" icon="*">
              <strong>팁:</strong> 포그라운드 실행 중 stdout/stderr는 실시간으로 이벤트(
              <code>tool:output-delta</code>)로 스트리밍됩니다. UI에서 명령 실행 상황을 실시간으로
              볼 수 있습니다.
            </Callout>

            <DeepDive title="크로스 플랫폼 셸 선택 로직">
              <p className="mb-3">
                <code className="text-cyan-600">bash_exec</code>는 플랫폼에 따라 적절한 셸을
                자동으로 선택합니다:
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-gray-600">
                <li>
                  <strong>macOS/Linux:</strong> <code>bash</code> 또는 <code>zsh</code> (시스템 기본
                  셸)
                </li>
                <li>
                  <strong>Windows + Git Bash:</strong> Git Bash를 사용하여 POSIX 명령 호환성 확보
                </li>
                <li>
                  <strong>Windows (Git Bash 없음):</strong> <code>cmd.exe</code> 사용 (POSIX 비호환
                  경고 표시)
                </li>
              </ul>
              <p className="mt-3 text-gray-600">
                Windows + Git Bash 환경에서는{" "}
                <code className="text-cyan-600">MSYS=winsymlinks:nativestrict</code>와
                <code className="text-cyan-600"> CHERE_INVOKING=1</code> 환경변수를 설정하여 심볼릭
                링크 호환과 셸 시작 디렉토리 유지를 보장합니다.
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
              <code className="text-cyan-600">execute()</code> 함수의 전체 실행 흐름입니다. 대화형
              명령 감지, WSL1 경고, 백그라운드/포그라운드 분기를 포함합니다.
            </p>

            <MermaidDiagram
              title="bash_exec 실행 흐름"
              titleColor="purple"
              chart={`graph TD
  START(("execute()")) --> INTER{"대화형 명령?"}
  INTER -->|"Yes"| ERR["에러 + 대안 안내"]
  INTER -->|"No"| WSL{"WSL1?"}
  WSL -->|"Yes"| WARN["경고 메시지 추가"]
  WSL -->|"No"| BG_CHECK
  WARN --> BG_CHECK{"run_in_background?"}
  BG_CHECK -->|"true"| BG_START["BackgroundProcessManager<br/><small>detached 모드</small>"]
  BG_CHECK -->|"false"| SHELL["셸 + 인수 결정<br/><small>getShellCommand()</small>"]
  SHELL --> SPAWN["spawn()<br/><small>자식 프로세스 생성</small>"]
  SPAWN --> STREAM["stdout/stderr 스트리밍<br/><small>실시간 이벤트 전달</small>"]
  STREAM --> TIMER["타임아웃 타이머<br/><small>SIGTERM 예약</small>"]
  TIMER --> CLOSE["프로세스 종료 대기"]
  CLOSE --> RESULT(("ToolResult<br/><small>exit code 확인</small>"))
  BG_START --> PID(("PID + processId 반환"))

  style START fill:#ede9fe,stroke:#8b5cf6,color:#1e293b
  style INTER fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style BG_CHECK fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style WSL fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style ERR fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style RESULT fill:#dcfce7,stroke:#10b981,color:#065f46
  style PID fill:#dcfce7,stroke:#10b981,color:#065f46`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              핵심 코드 분석 &mdash; 프로세스 생성과 스트리밍
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">spawn()</code>으로 자식 프로세스를 생성하고,
              stdout/stderr를 실시간으로 이벤트에 전달합니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// [1] 자식 프로세스 생성"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">proc</span> ={" "}
              <span className="fn">spawn</span>(<span className="prop">shell</span>, [...
              <span className="prop">args</span>], {"{"}
              {"\n"}
              {"  "}
              <span className="prop">cwd</span>: <span className="prop">context</span>.
              <span className="prop">workingDirectory</span>,{"\n"}
              {"  "}
              <span className="prop">signal</span>: <span className="prop">context</span>.
              <span className="prop">abortSignal</span>,{"  "}
              <span className="cm">{"// 사용자 취소 지원"}</span>
              {"\n"}
              {"  "}
              <span className="prop">stdio</span>: [<span className="str">&quot;ignore&quot;</span>,{" "}
              <span className="str">&quot;pipe&quot;</span>,{" "}
              <span className="str">&quot;pipe&quot;</span>],{"  "}
              <span className="cm">{"// stdin 무시"}</span>
              {"\n"}
              {"}"});
              {"\n"}
              {"\n"}
              <span className="cm">{"// [2] 실시간 출력 스트리밍"}</span>
              {"\n"}
              <span className="prop">proc</span>.<span className="prop">stdout</span>.
              <span className="fn">on</span>(<span className="str">&quot;data&quot;</span>, (
              <span className="prop">chunk</span>) =&gt; {"{"}
              {"\n"}
              {"  "}
              <span className="prop">chunks</span>.<span className="fn">push</span>(
              <span className="prop">chunk</span>);
              {"\n"}
              {"  "}
              <span className="prop">context</span>.<span className="prop">events</span>?.
              <span className="fn">emit</span>(
              <span className="str">&quot;tool:output-delta&quot;</span>, {"{"}
              {"\n"}
              {"    "}
              <span className="prop">id</span>: <span className="prop">context</span>.
              <span className="prop">toolCallId</span>,{"\n"}
              {"    "}
              <span className="prop">chunk</span>: <span className="prop">chunk</span>.
              <span className="fn">toString</span>(<span className="str">&quot;utf-8&quot;</span>),
              {"\n"}
              {"  "}
              {"}"});
              {"\n"}
              {"}"});
              {"\n"}
              {"\n"}
              <span className="cm">{"// [3] 타임아웃 → SIGTERM"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">timer</span> ={" "}
              <span className="fn">setTimeout</span>(() =&gt; {"{"}
              {"\n"}
              {"  "}
              <span className="prop">proc</span>.<span className="fn">kill</span>(
              <span className="str">&quot;SIGTERM&quot;</span>);
              {"\n"}
              {"}"}, <span className="prop">timeoutMs</span>);
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">[1]</strong>{" "}
                <code className="text-cyan-600">
                  stdio: [&quot;ignore&quot;, &quot;pipe&quot;, &quot;pipe&quot;]
                </code>{" "}
                &mdash; stdin을 무시하여 대화형 입력을 차단하고, stdout/stderr를 파이프로
                캡처합니다.
              </p>
              <p>
                <strong className="text-gray-900">[2]</strong>{" "}
                <code className="text-cyan-600">tool:output-delta</code> 이벤트를 통해 UI가
                실시간으로 출력을 표시합니다. 이벤트가 연결되지 않으면 버퍼에만 저장됩니다.
              </p>
              <p>
                <strong className="text-gray-900">[3]</strong> 타임아웃이 되면{" "}
                <code className="text-cyan-600">SIGTERM</code>으로 프로세스를 정상 종료합니다.{" "}
                <code>close</code> 이벤트에서 타이머를 정리합니다.
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
                &quot;interactive command 에러가 나요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                대화형 명령은 비대화형 환경에서 실행할 수 없어 자동으로 차단됩니다. 비대화형 대안을
                사용하세요:
              </p>
              <ul className="text-[13px] text-gray-600 space-y-1 list-disc list-inside">
                <li>
                  <code>git rebase -i</code> &rarr; <code>git rebase --onto</code>
                </li>
                <li>
                  <code>git commit --amend</code> &rarr;{" "}
                  <code>git commit --amend -m &quot;msg&quot;</code>
                </li>
                <li>
                  <code>vim file.ts</code> &rarr; <code>file_edit</code> 도구 사용
                </li>
              </ul>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;명령이 타임아웃으로 종료됐어요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                기본 타임아웃은 120초입니다. 빌드나 테스트 등 시간이 오래 걸리는 명령은
                <code className="text-cyan-600"> timeout</code> 매개변수로 최대 600초(10분)까지 늘릴
                수 있습니다.
              </p>
              <CodeBlock>
                <span className="fn">execute</span>({"{"} <span className="prop">command</span>:{" "}
                <span className="str">&quot;npm test&quot;</span>,{" "}
                <span className="prop">timeout</span>: <span className="num">600_000</span> {"}"});
              </CodeBlock>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;Windows에서 POSIX 명령이 안 돼요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                Git Bash가 설치되어 있지 않으면 <code>cmd.exe</code>를 사용하므로
                <code> ls</code>, <code>grep</code> 등 POSIX 명령이 동작하지 않습니다.
                <a href="https://gitforwindows.org/" className="text-cyan-600 underline ml-1">
                  Git for Windows
                </a>
                를 설치하면 Git Bash를 통해 POSIX 명령 호환성이 확보됩니다.
              </p>
            </div>

            {/* FAQ 4 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;백그라운드 프로세스의 출력을 어떻게 확인하나요?&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">bash_output</code> 도구로 백그라운드 프로세스의
                출력을 확인하고,
                <code className="text-cyan-600"> kill_shell</code> 도구로 프로세스를 종료할 수
                있습니다. 출력은 <code className="text-cyan-600">/tmp/dhelix-bg-{"{PID}"}.log</code>{" "}
                파일에도 저장됩니다.
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
                  name: "tool-registry.ts",
                  slug: "tool-registry",
                  relation: "parent",
                  desc: "도구 레지스트리 — bashExecTool을 등록하고 에이전트에 노출하는 모듈",
                },
                {
                  name: "permission-manager.ts",
                  slug: "permission-manager",
                  relation: "sibling",
                  desc: "권한 관리자 — bash_exec의 'confirm' 권한 수준을 검증하는 모듈",
                },
                {
                  name: "file-edit.ts",
                  slug: "tool-file-edit",
                  relation: "sibling",
                  desc: "파일 수정 도구 — vim 대신 안전한 문자열 교체로 파일을 수정하는 도구",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}

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

export default function SandboxSeatbeltPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/sandbox/seatbelt.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">macOS Seatbelt 샌드박스</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="leaf" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              macOS의 내장 샌드박스 프레임워크(Seatbelt)를 사용하여 sandbox-exec로 프로세스를 격리된
              환경에서 실행하는 모듈입니다.
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
                <code className="text-cyan-600">seatbelt.ts</code>는 macOS의 Seatbelt 프레임워크를
                활용하여 프로세스를 샌드박스 안에서 실행합니다. Seatbelt 프로파일은
                S-expression(Lisp 유사 문법)으로 작성되며, &quot;deny default&quot;로 시작하여
                필요한 권한만 명시적으로 허용하는 화이트리스트 방식을 사용합니다.
              </p>
              <p>
                파일 시스템 접근은 프로젝트 디렉토리와 /tmp, 홈 디렉토리 일부만 읽기/쓰기를
                허용하고, 시스템 경로는 읽기 전용입니다. 네트워크는 아웃바운드(외부로 나가는) TCP
                연결과 DNS 해석만 허용하고, 인바운드(들어오는) 연결은 완전히 차단합니다.
              </p>
              <p>
                macOS가 아닌 플랫폼에서는 샌드박스 없이 직접 명령을 실행합니다. 프로파일은 실행
                시마다 임시 파일로 생성되며, 실행 완료 후{" "}
                <code className="text-cyan-600">finally</code> 블록에서 반드시 삭제됩니다.
              </p>
            </div>

            <MermaidDiagram
              title="Seatbelt 샌드박스 아키텍처 위치"
              titleColor="purple"
              chart={`graph TD
  TOOL["Tool Executor<br/><small>tools/executor.ts</small>"]
  SEATBELT["seatbelt.ts<br/><small>macOS 샌드박스</small>"]
  SANDNET["sandboxed-network.ts<br/><small>네트워크 정책 통합</small>"]
  LINUX["linux.ts<br/><small>Linux 샌드박스</small>"]
  POLICY["network-policy.ts<br/><small>정책 엔진</small>"]

  TOOL -->|"macOS (darwin)"| SEATBELT
  TOOL -->|"Linux"| LINUX
  SANDNET --> SEATBELT
  SANDNET --> POLICY

  style SEATBELT fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style TOOL fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style SANDNET fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style LINUX fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style POLICY fill:#e0e7ff,stroke:#64748b,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> Seatbelt는 자동차의 &quot;안전벨트&quot;입니다. 프로세스가
              돌아다닐 수 있는 범위를 제한하여, 사고(악성 코드 실행)가 발생해도 시스템 전체로 피해가
              확산되지 않도록 보호합니다.
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

            {/* SandboxConfig interface */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface SandboxConfig
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              샌드박스 내 명령 실행 설정입니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "command",
                  type: "string",
                  required: true,
                  desc: "샌드박스 안에서 실행할 명령어",
                },
                {
                  name: "args",
                  type: "readonly string[]",
                  required: false,
                  desc: "명령어의 인수 배열",
                },
                { name: "cwd", type: "string", required: false, desc: "작업 디렉토리" },
                {
                  name: "projectDir",
                  type: "string",
                  required: true,
                  desc: "파일 시스템 접근을 허용할 프로젝트 디렉토리",
                },
                {
                  name: "homeDir",
                  type: "string",
                  required: false,
                  desc: "홈 디렉토리 (기본값: $HOME)",
                },
                {
                  name: "timeoutMs",
                  type: "number",
                  required: false,
                  desc: "실행 타임아웃 밀리초 (기본값: 120000)",
                },
                {
                  name: "env",
                  type: "Record<string, string>",
                  required: false,
                  desc: "전달할 환경 변수",
                },
              ]}
            />

            {/* generateSeatbeltProfile */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              generateSeatbeltProfile(config)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              macOS Seatbelt(sandbox-exec) 프로파일을 생성합니다. S-expression 형식의 보안 규칙
              문자열을 반환합니다.
            </p>
            <CodeBlock>
              <span className="kw">function</span>{" "}
              <span className="fn">generateSeatbeltProfile</span>(
              <span className="prop">config</span>: {"{"}
              {"\n"}
              {"  "}
              <span className="prop">projectDir</span>: <span className="type">string</span>;{"\n"}
              {"  "}
              <span className="prop">homeDir</span>: <span className="type">string</span>;{"\n"}
              {"  "}
              <span className="prop">tmpDir</span>: <span className="type">string</span>;{"\n"}
              {"}"}): <span className="type">string</span>
            </CodeBlock>

            {/* executeSandboxed */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              executeSandboxed(config)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              macOS Seatbelt 샌드박스 안에서 명령을 실행합니다. macOS가 아닌 플랫폼에서는 샌드박스
              없이 직접 실행합니다.
            </p>
            <CodeBlock>
              <span className="kw">async function</span>{" "}
              <span className="fn">executeSandboxed</span>({"\n"}
              {"  "}
              <span className="prop">config</span>: <span className="type">SandboxConfig</span>
              {"\n"}): <span className="type">Promise</span>&lt;{"{"}
              {"\n"}
              {"  "}
              <span className="prop">stdout</span>: <span className="type">string</span>;{"\n"}
              {"  "}
              <span className="prop">stderr</span>: <span className="type">string</span>;{"\n"}
              {"}"}&gt;
            </CodeBlock>
            <ParamTable
              params={[
                {
                  name: "config",
                  type: "SandboxConfig",
                  required: true,
                  desc: "샌드박스 실행 설정",
                },
              ]}
            />

            {/* SandboxError */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              class SandboxError
            </h3>
            <p className="text-[13px] text-gray-600 mb-3">
              샌드박스 실행 에러입니다. 타임아웃 또는 명령 실행 실패 시 발생합니다. 에러 코드는{" "}
              <code className="text-cyan-600">SANDBOX_ERROR</code>입니다.
            </p>
            <CodeBlock>
              <span className="kw">class</span> <span className="type">SandboxError</span>{" "}
              <span className="kw">extends</span> <span className="type">BaseError</span> {"{"}
              {"\n"}
              {"  "}
              <span className="kw">constructor</span>(<span className="prop">message</span>:{" "}
              <span className="type">string</span>, <span className="prop">context</span>?:{" "}
              <span className="type">Record</span>&lt;<span className="type">string</span>,{" "}
              <span className="type">unknown</span>&gt;)
              {"\n"}
              {"}"}
            </CodeBlock>

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                <code className="text-cyan-600">sandbox-exec</code>는 macOS에서 deprecated
                상태이지만, 아직 동작하며 대안이 제한적입니다. 향후 macOS 업데이트에서 제거될 수
                있습니다.
              </li>
              <li>
                macOS가 아닌 플랫폼에서 <code className="text-cyan-600">executeSandboxed()</code>를
                호출하면 샌드박스 없이 직접 실행됩니다. 보안 보장이 없으므로 주의하세요.
              </li>
              <li>
                프로파일 임시 파일은 UUID를 사용하여 고유 이름을 생성하며,
                <code className="text-cyan-600">finally</code> 블록에서 삭제됩니다. 프로세스가
                비정상 종료되면 /tmp에 잔여 파일이 남을 수 있습니다.
              </li>
              <li>
                인바운드 네트워크가 차단되므로, 샌드박스 안에서 서버를 시작하고 외부에서 접속하는
                것은 불가능합니다.
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
              기본 사용법 &mdash; 샌드박스 안에서 명령 실행
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              macOS에서 프로세스를 격리하여 실행합니다. 프로젝트 디렉토리에만 읽기/쓰기 접근이
              허용됩니다.
            </p>
            <CodeBlock>
              <span className="kw">const</span> <span className="prop">result</span> ={" "}
              <span className="kw">await</span> <span className="fn">executeSandboxed</span>({"{"}
              {"\n"}
              {"  "}
              <span className="prop">command</span>: <span className="str">&quot;node&quot;</span>,
              {"\n"}
              {"  "}
              <span className="prop">args</span>: [
              <span className="str">&quot;script.js&quot;</span>],
              {"\n"}
              {"  "}
              <span className="prop">projectDir</span>:{" "}
              <span className="str">&quot;/Users/name/project&quot;</span>,{"\n"}
              {"}"});
              {"\n"}
              {"\n"}
              <span className="fn">console</span>.<span className="fn">log</span>(
              <span className="prop">result</span>.<span className="prop">stdout</span>);
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> macOS가 아닌 플랫폼에서 호출하면 샌드박스 보호 없이 직접
              실행됩니다. Linux에서는 <code>bubblewrap.ts</code>를 사용해야 합니다.
            </Callout>

            {/* 환경 변수 전달 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 환경 변수와 타임아웃 설정
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              환경 변수를 주입하고 타임아웃을 커스터마이징할 수 있습니다.
            </p>
            <CodeBlock>
              <span className="kw">const</span> <span className="prop">result</span> ={" "}
              <span className="kw">await</span> <span className="fn">executeSandboxed</span>({"{"}
              {"\n"}
              {"  "}
              <span className="prop">command</span>:{" "}
              <span className="str">&quot;python3&quot;</span>,{"\n"}
              {"  "}
              <span className="prop">args</span>: [
              <span className="str">&quot;analysis.py&quot;</span>],
              {"\n"}
              {"  "}
              <span className="prop">projectDir</span>:{" "}
              <span className="str">&quot;/Users/name/data-project&quot;</span>,{"\n"}
              {"  "}
              <span className="prop">timeoutMs</span>: <span className="num">300_000</span>,{" "}
              <span className="cm">{"// 5분"}</span>
              {"\n"}
              {"  "}
              <span className="prop">env</span>: {"{"}
              {"\n"}
              {"    "}
              <span className="prop">PYTHONPATH</span>:{" "}
              <span className="str">&quot;/Users/name/data-project/lib&quot;</span>,{"\n"}
              {"  "}
              {"}"},{"\n"}
              {"}"});
            </CodeBlock>

            {/* 프로파일 직접 생성 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 프로파일 내용 직접 확인
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">generateSeatbeltProfile()</code>로 생성되는 프로파일
              내용을 디버깅 목적으로 확인할 수 있습니다.
            </p>
            <CodeBlock>
              <span className="kw">const</span> <span className="prop">profile</span> ={" "}
              <span className="fn">generateSeatbeltProfile</span>({"{"}
              {"\n"}
              {"  "}
              <span className="prop">projectDir</span>:{" "}
              <span className="str">&quot;/Users/name/project&quot;</span>,{"\n"}
              {"  "}
              <span className="prop">homeDir</span>:{" "}
              <span className="str">&quot;/Users/name&quot;</span>,{"\n"}
              {"  "}
              <span className="prop">tmpDir</span>: <span className="str">&quot;/tmp&quot;</span>,
              {"\n"}
              {"}"});
              {"\n"}
              {"\n"}
              <span className="fn">console</span>.<span className="fn">log</span>(
              <span className="prop">profile</span>);
              {"\n"}
              <span className="cm">{"// (version 1)"}</span>
              {"\n"}
              <span className="cm">{"// (deny default)"}</span>
              {"\n"}
              <span className="cm">{"// (allow process-fork) ..."}</span>
            </CodeBlock>

            <DeepDive title="Seatbelt 프로파일 구조 상세">
              <p className="mb-3">생성되는 프로파일은 다음과 같은 보안 규칙을 포함합니다:</p>
              <ul className="list-disc list-inside space-y-1.5 text-gray-600">
                <li>
                  <strong>기본 정책:</strong> <code className="text-red-600">(deny default)</code>{" "}
                  &mdash; 모든 것을 차단한 뒤 필요한 것만 허용
                </li>
                <li>
                  <strong>프로세스:</strong> fork/exec 허용 (bash 도구 실행에 필수)
                </li>
                <li>
                  <strong>시스템 읽기:</strong> /usr, /bin, /sbin, /Library, /System, /private/etc,
                  /dev
                </li>
                <li>
                  <strong>프로젝트 읽기/쓰기:</strong> projectDir 전체
                </li>
                <li>
                  <strong>임시 디렉토리 읽기/쓰기:</strong> tmpDir, /private/tmp,
                  /private/var/folders
                </li>
                <li>
                  <strong>홈 설정 읽기/쓰기:</strong> .config, .local, .npm, .node_modules, .cache,
                  .claude, .git
                </li>
                <li>
                  <strong>홈 도구 읽기 전용:</strong> .nvm, .volta, .rustup, .cargo
                </li>
                <li>
                  <strong>아웃바운드 TCP:</strong> LLM API 호출용
                </li>
                <li>
                  <strong>DNS (UDP 53):</strong> 도메인 해석용
                </li>
                <li>
                  <strong>인바운드 차단:</strong>{" "}
                  <code className="text-red-600">(deny network-inbound)</code>
                </li>
                <li>
                  <strong>IPC/Mach:</strong> Node.js 내부 동작에 필요
                </li>
              </ul>
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
              실행 플로우
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">executeSandboxed()</code>의 실행 과정입니다.
              macOS에서만 샌드박스가 적용됩니다.
            </p>

            <MermaidDiagram
              title="Seatbelt 실행 플로우"
              titleColor="purple"
              chart={`graph TD
  START(("시작")) --> PLATFORM{"process.platform<br/>== 'darwin'?"}
  PLATFORM -->|"아니오"| DIRECT["직접 실행<br/><small>샌드박스 없음</small>"]
  PLATFORM -->|"예"| PROFILE["Seatbelt 프로파일 생성<br/><small>S-expression 형식</small>"]
  PROFILE --> TMPFILE["임시 파일 저장<br/><small>/tmp/dhelix-sandbox-UUID.sb</small>"]
  TMPFILE --> EXEC["sandbox-exec -f 프로파일 명령어"]
  EXEC --> CLEANUP["finally: 임시 파일 삭제"]
  DIRECT --> RESULT(("결과"))
  CLEANUP --> RESULT

  style PROFILE fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style EXEC fill:#dcfce7,stroke:#10b981,color:#065f46,stroke-width:2px
  style CLEANUP fill:#fef3c7,stroke:#f59e0b,color:#92400e
  style DIRECT fill:#fee2e2,stroke:#ef4444,color:#991b1b`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              경로 이스케이프
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              프로파일 경로에 포함된 쌍따옴표는{" "}
              <code className="text-cyan-600">escapeProfilePath()</code>로 이스케이프됩니다.
              S-expression 파싱 오류를 방지하기 위한 안전장치입니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 경로 이스케이프"}</span>
              {"\n"}
              <span className="kw">function</span> <span className="fn">escapeProfilePath</span>(
              <span className="prop">path</span>: <span className="type">string</span>):{" "}
              <span className="type">string</span> {"{"}
              {"\n"}
              {"  "}
              <span className="kw">return</span> <span className="prop">path</span>.
              <span className="fn">replace</span>(<span className="str">/&quot;/g</span>,{" "}
              <span className="str">&apos;\\&quot;&apos;</span>);
              {"\n"}
              {"}"}
            </CodeBlock>

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              임시 파일 생명주기
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              프로파일 임시 파일은 <code className="text-cyan-600">randomUUID()</code>로 고유 이름을
              생성하고,
              <code className="text-cyan-600">finally</code> 블록에서 삭제합니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 임시 파일 경로 생성"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">profilePath</span> ={" "}
              <span className="fn">join</span>(<span className="fn">tmpdir</span>(),{" "}
              <span className="str">`dhelix-sandbox-${"{"}</span>
              <span className="fn">randomUUID</span>()<span className="str">{"}"}.sb`</span>);
              {"\n"}
              {"\n"}
              <span className="kw">try</span> {"{"}
              {"\n"}
              {"  "}
              <span className="cm">{"// sandbox-exec로 실행"}</span>
              {"\n"}
              {"}"} <span className="kw">finally</span> {"{"}
              {"\n"}
              {"  "}
              <span className="cm">{"// 에러가 발생해도 반드시 삭제"}</span>
              {"\n"}
              {"  "}
              <span className="kw">await</span> <span className="fn">unlink</span>(
              <span className="prop">profilePath</span>).<span className="fn">catch</span>(() =&gt;{" "}
              {"{"}
              {"}"});
              {"\n"}
              {"}"}
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">UUID 사용:</strong> 여러 샌드박스가 동시에
                실행되어도 파일 이름 충돌이 발생하지 않습니다.
              </p>
              <p>
                <strong className="text-gray-900">
                  .catch(() =&gt; {"{"}
                  {"}"}):
                </strong>{" "}
                임시 파일이 이미 삭제되었거나 접근할 수 없는 경우에도 에러를 무시합니다.
              </p>
              <p>
                <strong className="text-gray-900">maxBuffer 10MB:</strong> 출력 크기가 10MB를
                초과하면 버퍼 초과 에러가 발생합니다.
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
                &quot;sandbox-exec: command not found 에러가 발생해요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">sandbox-exec</code>는 macOS에만 포함된 명령어입니다.
                Linux에서는 <code className="text-cyan-600">bubblewrap.ts</code>를 사용하세요.
                macOS에서 이 에러가 발생하면 시스템 무결성이 손상되었을 수 있으며, macOS 재설치를
                고려해야 합니다.
              </p>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;샌드박스 안에서 npm install이 실패해요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                npm은 <code className="text-cyan-600">~/.npm</code> 캐시 디렉토리에 쓰기 접근이
                필요합니다. 프로파일에서 <code className="text-cyan-600">.npm</code>은 읽기/쓰기가
                허용되어 있으므로 정상적으로 동작해야 합니다. 문제가 지속되면{" "}
                <code className="text-cyan-600">.cache</code>
                디렉토리 권한을 확인하세요.
              </p>
              <Callout type="tip" icon="*">
                <code>generateSeatbeltProfile()</code>의 출력을 확인하여 해당 경로가 프로파일에
                포함되어 있는지 검증할 수 있습니다.
              </Callout>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;Sandboxed command timed out 에러가 발생해요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                기본 타임아웃은 2분(120,000ms)입니다.
                <code className="text-cyan-600">timeoutMs</code> 값을 늘려서 설정하세요. 빌드나
                테스트처럼 오래 걸리는 작업은 5분(300,000ms) 이상을 권장합니다.
              </p>
            </div>

            {/* FAQ 4 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;/tmp에 dhelix-sandbox-*.sb 파일이 남아 있어요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                정상적인 경우 <code className="text-cyan-600">finally</code> 블록에서 삭제됩니다.
                프로세스가 강제 종료(SIGKILL 등)된 경우 잔여 파일이 남을 수 있습니다. 안전하게
                삭제해도 됩니다:
                <code className="text-cyan-600 ml-2">rm /tmp/dhelix-sandbox-*.sb</code>
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
                  name: "linux.ts",
                  slug: "sandbox-linux",
                  relation: "sibling",
                  desc: "Linux Bubblewrap 샌드박스 — Linux 환경 감지와 bwrap 실행",
                },
                {
                  name: "bubblewrap.ts",
                  slug: "sandbox-bubblewrap",
                  relation: "sibling",
                  desc: "Bubblewrap 래퍼 — Linux용 프로세스 격리 실행기",
                },
                {
                  name: "network-proxy.ts",
                  slug: "sandbox-network-proxy",
                  relation: "child",
                  desc: "네트워크 프록시와 정책 통합 샌드박스 실행",
                },
                {
                  name: "network-policy.ts",
                  slug: "sandbox-network-policy",
                  relation: "child",
                  desc: "네트워크 접근 정책 — 도메인별 허용/차단 규칙 엔진",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}

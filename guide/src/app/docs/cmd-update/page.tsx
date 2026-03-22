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

export default function CmdUpdatePage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/commands/update.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">/update</span>
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
              npm 레지스트리에서 최신 버전을 확인하고, 차이가 있으면 자동으로 글로벌 업데이트를
              수행하는 슬래시 명령어입니다.
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
                <code className="text-cyan-600">/update</code> 명령어는 dbcode를 최신 버전으로
                업데이트합니다. 대화 중에 바로 실행할 수 있어 터미널을 따로 열어 npm 명령을 입력할
                필요가 없습니다.
              </p>
              <p>
                실행하면 세 단계로 동작합니다: (1) npm 레지스트리에서 최신 버전을 조회하고, (2) 현재
                설치된 버전과 비교하고, (3) 차이가 있으면{" "}
                <code className="text-cyan-600">npm install -g</code>로 자동 업데이트합니다.
              </p>
              <p>
                인터넷이 차단된 에어갭(air-gapped) 환경에서는 레지스트리 조회가 실패하므로, 수동
                업데이트 명령어를 안내합니다.
              </p>
            </div>

            <MermaidDiagram
              title="/update 명령어 실행 흐름"
              titleColor="purple"
              chart={`graph TD
  USER["/update 입력"] --> CMD["updateCommand.execute()"]
  CMD --> CHECK["npm view dbcode version<br/><small>최신 버전 조회 (30초 타임아웃)</small>"]
  CHECK -->|"실패/ERR"| AIRGAP["에어갭 환경 안내<br/><small>수동 업데이트 명령 표시</small>"]
  CHECK -->|"성공"| COMPARE{"현재 버전 =<br/>최신 버전?"}
  COMPARE -->|"같음"| LATEST["이미 최신 버전"]
  COMPARE -->|"다름"| INSTALL["npm install -g dbcode@latest<br/><small>글로벌 업데이트 실행</small>"]
  INSTALL -->|"성공"| DONE["업데이트 완료<br/><small>재시작 안내</small>"]
  INSTALL -->|"실패/ERR"| MANUAL["수동 업데이트 안내"]

  style CMD fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style CHECK fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style INSTALL fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style DONE fill:#dcfce7,stroke:#10b981,color:#065f46`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> <code>/update</code>는 스마트폰의 &quot;소프트웨어 업데이트
              확인&quot; 버튼과 같습니다. 현재 버전과 최신 버전을 비교하고, 새 버전이 있으면
              자동으로 다운로드하여 설치합니다.
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

            {/* updateCommand */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              updateCommand: SlashCommand
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">/update</code> 슬래시 명령어의 메인 정의 객체입니다.
              인자를 받지 않으며, 실행 시 자동으로 버전 확인 및 업데이트를 수행합니다.
            </p>
            <ParamTable
              params={[
                { name: "name", type: '"update"', required: true, desc: "명령어 이름" },
                {
                  name: "description",
                  type: "string",
                  required: true,
                  desc: '"Update dbcode to the latest version"',
                },
                { name: "usage", type: "string", required: true, desc: '"/update"' },
                {
                  name: "execute",
                  type: "() => Promise<CommandResult>",
                  required: true,
                  desc: "명령어 실행 핸들러 (args, context 사용하지 않음)",
                },
              ]}
            />

            {/* runCommand */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              runCommand(command)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              셸 명령어를 실행하고 stdout을 반환하는 헬퍼 함수입니다.
              <code className="text-cyan-600">child_process.exec</code>를 promisify하여
              async/await로 사용합니다.
            </p>
            <CodeBlock>
              <span className="kw">async function</span> <span className="fn">runCommand</span>(
              <span className="prop">command</span>: <span className="type">string</span>):{" "}
              <span className="type">Promise</span>&lt;<span className="type">string</span>&gt;
            </CodeBlock>
            <ParamTable
              params={[
                { name: "command", type: "string", required: true, desc: "실행할 셸 명령어" },
              ]}
            />

            {/* 의존 상수 */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              사용 상수
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              <code className="text-cyan-600">constants.ts</code>에서 가져오는 상수들입니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "APP_NAME",
                  type: "string",
                  required: true,
                  desc: "패키지 이름 (npm view와 npm install에 사용)",
                },
                {
                  name: "VERSION",
                  type: "string",
                  required: true,
                  desc: "현재 설치된 버전 (최신 버전과 비교 대상)",
                },
              ]}
            />

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                <code className="text-cyan-600">runCommand()</code>에 <strong>30초 타임아웃</strong>
                이 설정되어 있습니다. 느린 네트워크에서는 타임아웃으로 실패할 수 있습니다.
              </li>
              <li>
                <code className="text-cyan-600">npm install -g</code>를 사용하므로{" "}
                <strong>글로벌 설치 권한</strong>이 필요합니다. 권한 부족 시{" "}
                <code className="text-red-600">EACCES</code> 에러가 발생합니다.
              </li>
              <li>
                업데이트 후 반드시 dbcode를 <strong>재시작</strong>해야 새 버전이 적용됩니다. 실행
                중인 프로세스는 이전 버전의 코드를 계속 사용합니다.
              </li>
              <li>
                에러 판별은 출력에 <code className="text-cyan-600">&quot;ERR&quot;</code> 문자열이
                포함되었는지로 간단히 확인합니다. npm의 다양한 에러 형식을 포괄적으로 잡습니다.
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
              기본 사용법 &mdash; 업데이트 확인 및 설치
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">/update</code>를 입력하면 자동으로 최신 버전을
              확인하고 업데이트합니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 입력"}</span>
              {"\n"}
              <span className="str">/update</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// 출력 예시 1: 업데이트 가능"}</span>
              {"\n"}
              <span className="prop">Current version: 1.2.0</span>
              {"\n"}
              {"\n"}
              <span className="prop">Latest version: 1.3.0</span>
              {"\n"}
              {"\n"}
              <span className="prop">Updating dbcode...</span>
              {"\n"}
              <span className="fn">Updated to 1.3.0 successfully.</span>
              {"\n"}
              <span className="cm">Restart dbcode to use the new version.</span>
            </CodeBlock>

            <CodeBlock>
              <span className="cm">{"// 출력 예시 2: 이미 최신"}</span>
              {"\n"}
              <span className="prop">Current version: 1.3.0</span>
              {"\n"}
              {"\n"}
              <span className="fn">Already running the latest version (1.3.0).</span>
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> <code>npm install -g</code>는 시스템 전역 패키지를 수정합니다.
              macOS/Linux에서 권한 에러가 발생하면 <code>sudo npm install -g dbcode@latest</code>로
              수동 설치하거나, nvm/volta 등의 노드 버전 관리자를 사용하세요.
            </Callout>

            {/* 에어갭 환경 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 에어갭 환경에서의 수동 업데이트
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              인터넷이 차단된 환경에서는 npm 레지스트리에 접근할 수 없어 자동 업데이트가 실패합니다.
              이때 수동 업데이트 안내가 표시됩니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 에어갭 환경 출력"}</span>
              {"\n"}
              <span className="prop">Current version: 1.2.0</span>
              {"\n"}
              {"\n"}
              <span className="str">Could not check latest version from npm registry.</span>
              {"\n"}
              <span className="str">You may be in an air-gapped environment.</span>
              {"\n"}
              {"\n"}
              <span className="prop">Manual update:</span>
              {"\n"}
              {"  "}
              <span className="fn">npm install -g dbcode@latest</span>
            </CodeBlock>

            <DeepDive title="runCommand() 내부 동작">
              <p className="mb-3">셸 명령어 실행 헬퍼는 다음과 같은 특징이 있습니다:</p>
              <ul className="list-disc list-inside space-y-1.5 text-gray-600">
                <li>
                  <strong>Dynamic import</strong>:{" "}
                  <code className="text-cyan-600">node:child_process</code>와{" "}
                  <code className="text-cyan-600">node:util</code>을 동적으로 import합니다.
                </li>
                <li>
                  <strong>Promisify</strong>: <code className="text-cyan-600">exec</code>를{" "}
                  <code className="text-cyan-600">promisify</code>로 감싸 async/await를 지원합니다.
                </li>
                <li>
                  <strong>30초 타임아웃</strong>: 네트워크 지연으로 무한 대기하는 것을 방지합니다.
                </li>
              </ul>
              <CodeBlock>
                <span className="kw">async function</span> <span className="fn">runCommand</span>(
                <span className="prop">command</span>: <span className="type">string</span>):{" "}
                <span className="type">Promise</span>&lt;<span className="type">string</span>&gt;{" "}
                {"{"}
                {"\n"}
                {"  "}
                <span className="kw">const</span> {"{"} <span className="prop">exec</span> {"}"} ={" "}
                <span className="kw">await</span> <span className="fn">import</span>(
                <span className="str">&quot;node:child_process&quot;</span>);
                {"\n"}
                {"  "}
                <span className="kw">const</span> {"{"} <span className="prop">promisify</span>{" "}
                {"}"} = <span className="kw">await</span> <span className="fn">import</span>(
                <span className="str">&quot;node:util&quot;</span>);
                {"\n"}
                {"  "}
                <span className="kw">const</span> <span className="prop">execAsync</span> ={" "}
                <span className="fn">promisify</span>(<span className="prop">exec</span>);
                {"\n"}
                {"  "}
                <span className="kw">const</span> {"{"} <span className="prop">stdout</span> {"}"} ={" "}
                <span className="kw">await</span> <span className="fn">execAsync</span>(
                <span className="prop">command</span>, {"{"} <span className="prop">timeout</span>:{" "}
                <span className="num">30_000</span> {"}"});
                {"\n"}
                {"  "}
                <span className="kw">return</span> <span className="prop">stdout</span>;{"\n"}
                {"}"}
              </CodeBlock>
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
              에러 처리 분기
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">/update</code>는 세 겹의 에러 처리 계층을 가지고
              있습니다. 네트워크 문제, npm 에러, 권한 문제 등 다양한 실패 시나리오를 모두
              처리합니다.
            </p>

            <MermaidDiagram
              title="/update 에러 처리 계층"
              titleColor="purple"
              chart={`graph TD
  EXEC["execute()"] --> TRY["try 블록"]
  TRY --> NPM_VIEW["npm view 실행"]
  NPM_VIEW --> CHK_ERR{"출력에 ERR<br/>포함?"}
  CHK_ERR -->|"예"| AIRGAP["에어갭/레지스트리 에러<br/><small>수동 업데이트 안내</small>"]
  CHK_ERR -->|"아니오"| VER_CHK{"버전 비교"}
  VER_CHK -->|"같음"| UP_TO_DATE["이미 최신"]
  VER_CHK -->|"다름"| NPM_INSTALL["npm install -g 실행"]
  NPM_INSTALL --> INST_ERR{"설치 출력에<br/>ERR 포함?"}
  INST_ERR -->|"예"| INST_FAIL["설치 실패<br/><small>수동 업데이트 안내</small>"]
  INST_ERR -->|"아니오"| SUCCESS["업데이트 성공"]
  TRY -->|"catch"| EXCEPTION["예외 발생<br/><small>타임아웃, 네트워크 등</small>"]

  style EXEC fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style AIRGAP fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style INST_FAIL fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style EXCEPTION fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style SUCCESS fill:#dcfce7,stroke:#10b981,color:#065f46`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              핵심 코드 분석
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">execute()</code> 핸들러의 핵심 버전 비교 및 업데이트
              로직입니다.
            </p>
            <CodeBlock>
              <span className="kw">async</span> () =&gt; {"{"}
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">lines</span>:{" "}
              <span className="type">string</span>[] = [];
              {"\n"}
              {"  "}
              <span className="prop">lines</span>.<span className="fn">push</span>(
              <span className="str">`Current version: ${"{"}</span>
              <span className="prop">VERSION</span>
              <span className="str">{"}"}`</span>);
              {"\n"}
              {"\n"}
              {"  "}
              <span className="kw">try</span> {"{"}
              {"\n"}
              {"    "}
              <span className="cm">{"// [1] npm 레지스트리에서 최신 버전 조회"}</span>
              {"\n"}
              {"    "}
              <span className="kw">const</span> <span className="prop">checkResult</span> ={" "}
              <span className="kw">await</span> <span className="fn">runCommand</span>({"\n"}
              {"      "}
              <span className="str">{"`npm view ${APP_NAME} version`"}</span>
              {"\n"}
              {"    "});
              {"\n"}
              {"    "}
              <span className="kw">const</span> <span className="prop">latestVersion</span> ={" "}
              <span className="prop">checkResult</span>.<span className="fn">trim</span>();
              {"\n"}
              {"\n"}
              {"    "}
              <span className="cm">{"// [2] 에러 확인 (ERR 문자열 포함 여부)"}</span>
              {"\n"}
              {"    "}
              <span className="kw">if</span> (!<span className="prop">latestVersion</span> ||{" "}
              <span className="prop">latestVersion</span>.<span className="fn">includes</span>(
              <span className="str">&quot;ERR&quot;</span>)) {"{"}
              {"\n"}
              {"      "}
              <span className="kw">return</span> {"{"} <span className="prop">output</span>:{" "}
              <span className="str">&quot;...수동 업데이트 안내...&quot;</span>,{" "}
              <span className="prop">success</span>: <span className="kw">false</span> {"}"};{"\n"}
              {"    "}
              {"}"}
              {"\n"}
              {"\n"}
              {"    "}
              <span className="cm">{"// [3] 버전 비교 — 문자열 동등 비교"}</span>
              {"\n"}
              {"    "}
              <span className="kw">if</span> (<span className="prop">latestVersion</span> ==={" "}
              <span className="prop">VERSION</span>
              {")"} {"{"}
              {"\n"}
              {"      "}
              <span className="kw">return</span> {"{"} <span className="prop">output</span>:{" "}
              <span className="str">&quot;Already running the latest...&quot;</span>,{" "}
              <span className="prop">success</span>: <span className="kw">true</span> {"}"};{"\n"}
              {"    "}
              {"}"}
              {"\n"}
              {"\n"}
              {"    "}
              <span className="cm">{"// [4] 자동 업데이트 실행"}</span>
              {"\n"}
              {"    "}
              <span className="kw">const</span> <span className="prop">updateResult</span> ={" "}
              <span className="kw">await</span> <span className="fn">runCommand</span>({"\n"}
              {"      "}
              <span className="str">`npm install -g ${"{"}</span>
              <span className="prop">APP_NAME</span>
              <span className="str">
                {"}"}@${"{"}
              </span>
              <span className="prop">latestVersion</span>
              <span className="str">{"}"} 2&gt;&amp;1`</span>
              {"\n"}
              {"    "}
              {");"}
              {"\n"}
              {"  "}
              <span className="kw">{"}"} catch</span> {"("}
              <span className="prop">error</span>
              {")"} {"{"}
              {"\n"}
              {"    "}
              <span className="cm">{"// [5] 예외 처리 (타임아웃, 네트워크 등)"}</span>
              {"\n"}
              {"    "}
              <span className="kw">return</span> {"{"} <span className="prop">output</span>:{" "}
              <span className="str">&quot;Update check failed...&quot;</span>,{" "}
              <span className="prop">success</span>: <span className="kw">false</span> {"}"};{"\n"}
              {"  "}
              {"}"}
              {"\n"}
              {"}"}
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">[1]</strong>{" "}
                <code className="text-cyan-600">npm view</code>로 레지스트리에서 최신 버전을
                조회합니다. <code className="text-cyan-600">2&gt;&amp;1</code>로 stderr도
                캡처합니다.
              </p>
              <p>
                <strong className="text-gray-900">[2]</strong> 출력이 비어있거나{" "}
                <code className="text-cyan-600">&quot;ERR&quot;</code>을 포함하면 레지스트리 접근
                실패로 판단합니다.
              </p>
              <p>
                <strong className="text-gray-900">[3]</strong> 현재 버전(
                <code className="text-cyan-600">VERSION</code>)과 최신 버전을 단순 문자열
                비교합니다. 같으면 이미 최신입니다.
              </p>
              <p>
                <strong className="text-gray-900">[4]</strong>{" "}
                <code className="text-cyan-600">npm install -g</code>로 특정 버전을 글로벌
                설치합니다. <code className="text-cyan-600">@latest</code>가 아닌 정확한 버전을
                지정합니다.
              </p>
              <p>
                <strong className="text-gray-900">[5]</strong> try/catch 최외곽에서 타임아웃(30초),
                네트워크 단절 등의 예외를 처리합니다.
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
                &quot;Could not check latest version from npm registry.&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                npm 레지스트리에 접근할 수 없는 경우입니다. 인터넷 연결을 확인하거나, 프록시/방화벽
                설정을 확인하세요. 에어갭 환경이라면 패키지 파일을 직접 복사하여{" "}
                <code className="text-cyan-600">npm install -g ./dbcode-1.3.0.tgz</code>로 설치할 수
                있습니다.
              </p>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;Update failed 에러가 나요 (EACCES)&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                글로벌 npm 디렉토리에 쓰기 권한이 없는 경우입니다. 해결 방법은 세 가지입니다:
              </p>
              <ul className="text-[13px] text-gray-600 space-y-1 list-disc list-inside mt-2">
                <li>
                  <code className="text-cyan-600">sudo npm install -g dbcode@latest</code>{" "}
                  (macOS/Linux)
                </li>
                <li>nvm이나 volta를 사용하여 노드 관리 (권한 문제 해결)</li>
                <li>npm의 prefix를 사용자 디렉토리로 변경</li>
              </ul>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;업데이트 성공했는데 새 기능이 안 보여요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                업데이트 후 반드시 dbcode를 <strong>재시작</strong>해야 합니다. 현재 실행 중인
                프로세스는 이전 버전의 코드를 메모리에서 계속 사용합니다.
                <code className="text-cyan-600">Ctrl+D</code>로 종료한 후 다시 실행하세요.
              </p>
            </div>

            {/* FAQ 4 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;타임아웃으로 실패해요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">runCommand()</code>의 타임아웃은 30초입니다. 느린
                네트워크 환경에서는 이 시간 안에 npm 레지스트리 응답을 받지 못할 수 있습니다. 이
                경우 터미널에서 직접{" "}
                <code className="text-cyan-600">npm install -g dbcode@latest</code>를 실행하면
                타임아웃 제한 없이 설치할 수 있습니다.
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
                  name: "constants.ts",
                  slug: "constants",
                  relation: "sibling",
                  desc: "APP_NAME과 VERSION 상수 정의 — 패키지명과 현재 버전 정보",
                },
                {
                  name: "commands/registry.ts",
                  slug: "cmd-registry",
                  relation: "parent",
                  desc: "모든 슬래시 명령어를 등록하고 실행하는 레지스트리",
                },
                {
                  name: "commands/stats.ts",
                  slug: "cmd-stats",
                  relation: "sibling",
                  desc: "/stats 명령어 — 현재 세션의 통계 및 버전 정보 확인",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}

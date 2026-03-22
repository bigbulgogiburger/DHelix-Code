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

export default function UtilsPlatformPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}><div className="center-narrow">
      {/* ─── Header ─── */}
      <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <FilePath path="src/utils/platform.ts" />
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
            <span className="text-gray-900">
              Platform Detection
            </span>
          </h1>
          <div className="flex items-center gap-3 mb-5">
            <LayerBadge layer="leaf" />
          </div>
          <p className="text-[16px] text-gray-600 leading-relaxed">
            OS, WSL, Git Bash, 셸 타입 등을 감지하는 크로스 플랫폼 유틸리티입니다.
            샌드박스, 경로 처리, 셸 명령 실행 등에서 플랫폼별 분기에 사용됩니다.
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
              dbcode는 macOS, Windows, Linux에서 실행되며, WSL(Windows Subsystem for Linux)과
              Git Bash 환경도 지원합니다. 이 모듈은 현재 실행 환경을 감지하여
              플랫폼별로 다른 동작(셸 선택, 경로 형식, 샌드박스 설정 등)을 가능하게 합니다.
            </p>
            <p>
              <code className="text-cyan-600">getPlatform()</code>으로 OS를 감지하고,
              <code className="text-cyan-600">getShellCommand()</code>로 적합한 셸 실행 파일을 선택합니다.
              Windows에서는 Git Bash를 우선 사용하고, 없으면 cmd.exe를 폴백으로 사용합니다.
            </p>
            <p>
              WSL2/WSL1 구분, Git Bash 자동 탐색, 셸 인수 형식 변환 등
              Windows 환경의 복잡한 엣지 케이스를 처리합니다.
            </p>
          </div>

          <MermaidDiagram
            title="플랫폼 감지 결정 트리"
            titleColor="purple"
            chart={`graph TD
  START(("시작")) --> PLATFORM{"getPlatform()"}
  PLATFORM -->|"darwin"| MACOS["macOS<br/><small>셸: $SHELL 또는 /bin/bash</small>"]
  PLATFORM -->|"linux"| LINUX{"isWSL()?"}
  PLATFORM -->|"win32"| WIN{"hasGitBash()?"}

  LINUX -->|"No"| NATIVE_LINUX["Linux<br/><small>셸: $SHELL 또는 /bin/bash</small>"]
  LINUX -->|"Yes"| WSL{"isWSL2()?"}
  WSL -->|"Yes"| WSL2["WSL2<br/><small>커널 4.19+</small>"]
  WSL -->|"No"| WSL1["WSL1<br/><small>커널 4.4.x</small>"]

  WIN -->|"Yes"| GITBASH["Git Bash<br/><small>셸: bash.exe</small>"]
  WIN -->|"No"| CMD["cmd.exe<br/><small>셸: /c 플래그</small>"]

  style PLATFORM fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style MACOS fill:#dcfce7,stroke:#10b981,color:#065f46
  style NATIVE_LINUX fill:#dcfce7,stroke:#10b981,color:#065f46
  style WSL2 fill:#dbeafe,stroke:#3b82f6,color:#1e293b
  style WSL1 fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style GITBASH fill:#dbeafe,stroke:#3b82f6,color:#1e293b
  style CMD fill:#fee2e2,stroke:#ef4444,color:#991b1b`}
          />

          <Callout type="info" icon="💡">
            <strong>Windows 전략:</strong> Windows에서는 Git Bash를 우선 사용합니다.
            Unix 명령어(ls, cat, grep 등)를 사용할 수 있고, 경로 구분자가 포워드 슬래시(/)로
            통일되어 크로스 플랫폼 호환성이 높아집니다.
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 2. 레퍼런스 (Reference) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>📖</span> 레퍼런스
          </h2>

          {/* Types */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            type Platform / ShellType
          </h3>
          <CodeBlock>
            <span className="kw">type</span> <span className="type">Platform</span> = <span className="str">&quot;win32&quot;</span> | <span className="str">&quot;darwin&quot;</span> | <span className="str">&quot;linux&quot;</span>;
            {"\n"}<span className="kw">type</span> <span className="type">ShellType</span> = <span className="str">&quot;bash&quot;</span> | <span className="str">&quot;git-bash&quot;</span> | <span className="str">&quot;cmd&quot;</span> | <span className="str">&quot;powershell&quot;</span>;
          </CodeBlock>

          {/* OS Detection */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            OS 감지 함수
          </h3>
          <div className="bg-white border border-gray-200 rounded-xl p-5 text-[13px] text-gray-600 space-y-2.5">
            <p><code className="text-cyan-600">getPlatform()</code>: <span className="text-gray-900">Platform</span> &mdash; 현재 OS 반환 (인식 불가 시 &quot;linux&quot; 폴백)</p>
            <p><code className="text-cyan-600">isWindows()</code>: <span className="text-gray-900">boolean</span> &mdash; Windows 여부</p>
            <p><code className="text-cyan-600">isMacOS()</code>: <span className="text-gray-900">boolean</span> &mdash; macOS 여부</p>
            <p><code className="text-cyan-600">isLinux()</code>: <span className="text-gray-900">boolean</span> &mdash; Linux 여부</p>
          </div>

          {/* WSL Detection */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            WSL 감지 함수
          </h3>
          <div className="bg-white border border-gray-200 rounded-xl p-5 text-[13px] text-gray-600 space-y-2.5">
            <p><code className="text-cyan-600">isWSL()</code>: <span className="text-gray-900">boolean</span> &mdash; WSL_DISTRO_NAME 환경 변수 존재 여부</p>
            <p><code className="text-cyan-600">isWSL2()</code>: <span className="text-gray-900">boolean</span> &mdash; /proc/version에서 &quot;microsoft&quot; + 커널 4.19+ 확인</p>
            <p><code className="text-cyan-600">isWSL1()</code>: <span className="text-gray-900">boolean</span> &mdash; WSL이지만 WSL2가 아닌 경우</p>
          </div>

          {/* Shell Functions */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            셸 관련 함수
          </h3>
          <div className="bg-white border border-gray-200 rounded-xl p-5 text-[13px] text-gray-600 space-y-2.5">
            <p><code className="text-cyan-600">getShellType()</code>: <span className="text-gray-900">ShellType</span> &mdash; 현재 셸 타입 반환</p>
            <p><code className="text-cyan-600">getShellCommand()</code>: <span className="text-gray-900">string</span> &mdash; 셸 실행 파일 경로 반환</p>
            <p><code className="text-cyan-600">hasGitBash()</code>: <span className="text-gray-900">boolean</span> &mdash; Git Bash 설치 여부</p>
          </div>

          {/* getShellArgs */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            getShellArgs(command, shell?)
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            명령 문자열을 실행하기 위한 셸 인수 배열을 반환합니다.
          </p>
          <CodeBlock>
            <span className="kw">function</span> <span className="fn">getShellArgs</span>(<span className="prop">command</span>: <span className="type">string</span>, <span className="prop">shell</span>?: <span className="type">string</span>): <span className="kw">readonly</span> <span className="type">string</span>[]
          </CodeBlock>
          <ParamTable
            params={[
              { name: "command", type: "string", required: true, desc: "실행할 명령 문자열" },
              { name: "shell", type: "string", required: false, desc: "사용할 셸 (미지정 시 플랫폼에 맞게 자동 결정)" },
            ]}
          />
          <div className="text-[13px] text-gray-600 mt-2 space-y-1">
            <p>&bull; cmd.exe: <code className="text-cyan-600">[&quot;/c&quot;, command]</code></p>
            <p>&bull; bash 계열: <code className="text-cyan-600">[&quot;-c&quot;, command]</code></p>
          </div>

          {/* Utility functions */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            유틸리티 함수
          </h3>
          <div className="bg-white border border-gray-200 rounded-xl p-5 text-[13px] text-gray-600 space-y-2.5">
            <p><code className="text-cyan-600">getHomeDir()</code>: <span className="text-gray-900">string</span> &mdash; 사용자 홈 디렉토리 경로</p>
            <p><code className="text-cyan-600">getTempDir()</code>: <span className="text-gray-900">string</span> &mdash; 시스템 임시 디렉토리 경로</p>
          </div>

          {/* Caveats */}
          <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
          <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
            <li>
              인식되지 않는 OS(FreeBSD, Solaris 등)는 <code className="text-cyan-600">&quot;linux&quot;</code>로
              폴백됩니다. 대부분의 UNIX 계열을 포함하기 위한 설계입니다.
            </li>
            <li>
              Git Bash 경로 탐색은 파일 시스템 접근을 수반합니다.
              결과는 내부적으로 캐시되어 한 번만 탐색합니다.
            </li>
            <li>
              <code className="text-cyan-600">isWSL2()</code>는 <code className="text-cyan-600">/proc/version</code>을
              동기적으로 읽습니다(<code className="text-cyan-600">readFileSync</code>). 초기화 시점에만 호출하세요.
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
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>기본 사용법 &mdash; 플랫폼별 분기</h3>
          <CodeBlock>
            <span className="kw">import</span> {"{"} <span className="prop">isWindows</span>, <span className="prop">isMacOS</span>, <span className="prop">getShellCommand</span> {"}"} <span className="kw">from</span> <span className="str">&quot;./utils/platform.js&quot;</span>;
            {"\n"}
            {"\n"}<span className="kw">if</span> (<span className="fn">isMacOS</span>()) {"{"}
            {"\n"}{"  "}<span className="cm">{"// macOS 전용: Seatbelt 샌드박스 설정"}</span>
            {"\n"}{"}"} <span className="kw">else if</span> (<span className="fn">isWindows</span>()) {"{"}
            {"\n"}{"  "}<span className="cm">{"// Windows 전용: 경로 구분자 처리"}</span>
            {"\n"}{"}"}
            {"\n"}
            {"\n"}<span className="cm">{"// 플랫폼에 맞는 셸로 명령 실행"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">shell</span> = <span className="fn">getShellCommand</span>();
            {"\n"}<span className="cm">{"// macOS: \"/bin/zsh\", Windows+Git Bash: \"C:\\\\...\\\\bash.exe\""}</span>
          </CodeBlock>

          {/* 셸 명령 실행 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>셸 명령 실행</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">getShellCommand()</code>와 <code className="text-cyan-600">getShellArgs()</code>를
            조합하여 child_process를 생성합니다.
          </p>
          <CodeBlock>
            <span className="kw">import</span> {"{"} <span className="prop">spawn</span> {"}"} <span className="kw">from</span> <span className="str">&quot;node:child_process&quot;</span>;
            {"\n"}<span className="kw">import</span> {"{"} <span className="prop">getShellCommand</span>, <span className="prop">getShellArgs</span> {"}"} <span className="kw">from</span> <span className="str">&quot;./utils/platform.js&quot;</span>;
            {"\n"}
            {"\n"}<span className="kw">const</span> <span className="prop">shell</span> = <span className="fn">getShellCommand</span>();
            {"\n"}<span className="kw">const</span> <span className="prop">args</span> = <span className="fn">getShellArgs</span>(<span className="str">&quot;ls -la&quot;</span>, <span className="prop">shell</span>);
            {"\n"}<span className="kw">const</span> <span className="prop">proc</span> = <span className="fn">spawn</span>(<span className="prop">shell</span>, <span className="prop">args</span>);
          </CodeBlock>

          <Callout type="warn" icon="!">
            <strong>주의:</strong> cmd.exe는 <code>/c</code> 플래그를, bash는 <code>-c</code> 플래그를
            사용합니다. 직접 하드코딩하지 말고 반드시 <code>getShellArgs()</code>를 사용하세요.
          </Callout>

          <Callout type="tip" icon="*">
            <strong>팁:</strong> WSL 환경을 감지하면 Windows 호스트의 파일 시스템 접근 시
            <code>/mnt/c/</code> 경로를 사용해야 합니다.
            <code>isWSL()</code>로 확인하여 경로를 적절히 변환하세요.
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 4. 내부 구현 (Internals) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>⚙️</span> 내부 구현
          </h2>

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>Git Bash 탐색 로직</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            Windows에서 Git Bash를 찾는 우선순위입니다.
            한 번 찾은 결과는 캐시되어 재탐색하지 않습니다.
          </p>

          <MermaidDiagram
            title="Git Bash 탐색 우선순위"
            titleColor="purple"
            chart={`graph TD
  START(("findGitBash()")) --> ENV{"GIT_BASH_PATH<br/>환경 변수?"}
  ENV -->|"존재"| FOUND["경로 반환"]
  ENV -->|"없음"| STD{"표준 경로<br/>C:\\Program Files\\Git\\bin\\bash.exe"}
  STD -->|"존재"| FOUND
  STD -->|"없음"| PATH{"PATH에서<br/>git.exe 위치 탐색"}
  PATH -->|"발견"| INFER["git 루트에서<br/>bin/bash.exe 유추"]
  INFER -->|"존재"| FOUND
  PATH -->|"미발견"| PROG{"PROGRAMFILES<br/>환경 변수"}
  PROG -->|"존재"| FOUND
  PROG -->|"없음"| NULL["null 반환"]

  FOUND --> CACHE["캐시 저장"]

  style START fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style FOUND fill:#dcfce7,stroke:#10b981,color:#065f46
  style NULL fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style CACHE fill:#fef3c7,stroke:#f59e0b,color:#1e293b`}
          />

          <DeepDive title="WSL2 판별 알고리즘 상세">
            <p className="mb-3">
              WSL2는 3단계 검사로 판별합니다:
            </p>
            <CodeBlock>
              <span className="cm">{"// 1단계: WSL 여부 확인"}</span>
              {"\n"}<span className="kw">if</span> (!<span className="fn">isWSL</span>()) <span className="kw">return false</span>;
              {"\n"}
              {"\n"}<span className="cm">{"// 2단계: /proc/version에 \"microsoft\" 포함 확인"}</span>
              {"\n"}<span className="kw">const</span> <span className="prop">procVersion</span> = <span className="fn">readFileSync</span>(<span className="str">&quot;/proc/version&quot;</span>);
              {"\n"}<span className="kw">if</span> (!<span className="prop">procVersion</span>.<span className="fn">includes</span>(<span className="str">&quot;microsoft&quot;</span>)) <span className="kw">return false</span>;
              {"\n"}
              {"\n"}<span className="cm">{"// 3단계: 커널 버전 4.19 이상 확인"}</span>
              {"\n"}<span className="cm">{"// WSL1: 4.4.x, WSL2: 4.19+ (Hyper-V 커널)"}</span>
              {"\n"}<span className="kw">const</span> [<span className="prop">major</span>, <span className="prop">minor</span>] = <span className="prop">kernelVersion</span>;
              {"\n"}<span className="kw">return</span> <span className="prop">major</span> {">"} <span className="num">4</span> || (<span className="prop">major</span> === <span className="num">4</span> && <span className="prop">minor</span> {">="} <span className="num">19</span>);
            </CodeBlock>
            <p className="mt-3 text-amber-600">
              <code>/proc/version</code>은 동기적으로 읽습니다. 이 파일은 커널이 제공하는
              가상 파일이므로 실제 디스크 I/O는 발생하지 않습니다.
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

          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;Windows에서 Git Bash를 찾지 못해요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">GIT_BASH_PATH</code> 환경 변수에 bash.exe 경로를 직접 설정하세요.
              또는 Git을 기본 경로(<code>C:\Program Files\Git</code>)에 설치했는지 확인하세요.
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;WSL 환경인데 isWSL()이 false를 반환해요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">WSL_DISTRO_NAME</code> 환경 변수가 설정되어 있는지 확인하세요.
              일부 WSL 배포판에서는 이 변수가 누락될 수 있습니다.
              <code className="text-cyan-600">echo $WSL_DISTRO_NAME</code>으로 확인하세요.
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;cmd.exe에서 Unix 명령어가 실행되지 않아요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              Git Bash가 설치되어 있지 않으면 cmd.exe가 사용됩니다.
              cmd.exe는 <code>ls</code>, <code>cat</code>, <code>grep</code> 등의 Unix 명령을
              지원하지 않습니다. Git for Windows를 설치하면 자동으로 Git Bash가 감지됩니다.
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
                name: "path.ts",
                slug: "utils-path",
                relation: "parent",
                desc: "크로스 플랫폼 경로 유틸리티 — isWindows()를 사용하여 경로 구분자를 결정합니다",
              },
              {
                name: "tool-executor.ts",
                slug: "tool-executor",
                relation: "parent",
                desc: "bash 도구 실행 시 getShellCommand()로 적합한 셸을 선택합니다",
              },
              {
                name: "recorder.ts",
                slug: "voice-recorder",
                relation: "sibling",
                desc: "SoX 프로세스 실행 시 플랫폼에 맞는 셸을 사용합니다",
              },
            ]}
          />
        </section>
      </RevealOnScroll>
    </div></div>
  );
}

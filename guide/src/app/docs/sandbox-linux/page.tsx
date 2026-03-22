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

export default function SandboxLinuxPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}><div className="center-narrow">
      {/* ─── Header ─── */}
      <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <FilePath path="src/sandbox/linux.ts" />
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
            <span className="text-gray-900">
              Linux Bubblewrap 샌드박스
            </span>
          </h1>
          <div className="flex items-center gap-3 mb-5">
            <LayerBadge layer="leaf" />
          </div>
          <p className="text-[16px] text-gray-600 leading-relaxed">
            Linux 환경을 감지하고, bubblewrap(bwrap) 샌드박스의 설치 상태를 확인하며,
            bwrap 인수를 생성하고 샌드박스 안에서 명령을 실행하는 모듈입니다.
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
              <code className="text-cyan-600">linux.ts</code>는 Linux 환경에서 프로세스를 격리 실행하기 위한
              bubblewrap(bwrap) 샌드박스의 전반적인 환경 관리를 담당합니다.
              네이티브 Linux, WSL2, WSL1 환경을 자동으로 감지하고, bubblewrap 설치 여부와
              버전을 확인하며, 배포판별 설치 안내를 제공합니다.
            </p>
            <p>
              WSL2는 완전한 Linux 커널 네임스페이스를 지원하므로 bubblewrap을 사용할 수 있지만,
              WSL1은 네임스페이스 기능이 없어 bubblewrap을 사용할 수 없습니다.
              이 모듈은 이러한 환경 차이를 투명하게 처리합니다.
            </p>
            <p>
              bwrap 인수 생성 시 시스템 경로는 읽기 전용으로, 프로젝트 디렉토리는 읽기/쓰기로
              마운트하며, PID 네임스페이스 격리와 세션 격리를 통해 호스트 시스템을 보호합니다.
            </p>
          </div>

          <MermaidDiagram
            title="Linux 샌드박스 아키텍처 위치"
            titleColor="purple"
            chart={`graph TD
  TOOL["Tool Executor<br/><small>tools/executor.ts</small>"]
  LINUX["linux.ts<br/><small>환경 감지 + bwrap 실행</small>"]
  BWRAP["bubblewrap.ts<br/><small>bwrap 래퍼</small>"]
  SEATBELT["seatbelt.ts<br/><small>macOS 샌드박스</small>"]
  NP["network-policy.ts<br/><small>네트워크 정책</small>"]

  TOOL -->|"Linux 플랫폼"| LINUX
  TOOL -->|"macOS 플랫폼"| SEATBELT
  LINUX --> BWRAP
  BWRAP --> NP

  style LINUX fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style TOOL fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style BWRAP fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style SEATBELT fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style NP fill:#e0e7ff,stroke:#64748b,color:#1e293b`}
          />

          <Callout type="info" icon="💡">
            <strong>비유:</strong> 건물에 들어가기 전 보안 게이트를 떠올리세요.
            linux.ts는 &quot;이 건물에 보안 시스템이 설치되어 있는가?&quot;를 확인하고,
            설치되어 있다면 적절한 보안 규칙(마운트/격리)을 설정한 뒤 입장시키는 역할입니다.
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 2. 레퍼런스 (Reference) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>📖</span> 레퍼런스
          </h2>

          {/* LinuxSandboxConfig interface */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface LinuxSandboxConfig
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            bubblewrap 샌드박스 실행에 필요한 설정을 정의합니다.
          </p>
          <ParamTable
            params={[
              { name: "command", type: "string", required: true, desc: "샌드박스 안에서 실행할 명령어" },
              { name: "args", type: "readonly string[]", required: false, desc: "명령어 인수 배열" },
              { name: "cwd", type: "string", required: false, desc: "작업 디렉토리" },
              { name: "projectDir", type: "string", required: true, desc: "프로젝트 디렉토리 (읽기/쓰기 접근 허용)" },
              { name: "homeDir", type: "string", required: false, desc: "홈 디렉토리 (일부 읽기 전용 접근 허용)" },
              { name: "timeoutMs", type: "number", required: false, desc: "실행 타임아웃 밀리초 (기본값: 120000)" },
              { name: "env", type: "Record<string, string>", required: false, desc: "전달할 환경 변수" },
              { name: "allowNetwork", type: "boolean", required: false, desc: "네트워크 접근 허용 여부 (기본값: true)" },
            ]}
          />

          {/* SandboxReadiness interface */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface SandboxReadiness
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            Linux 샌드박스 준비 상태 확인 결과입니다.
            <code className="text-cyan-600">checkLinuxSandboxReady()</code>가 반환합니다.
          </p>
          <ParamTable
            params={[
              { name: "available", type: "boolean", required: true, desc: "샌드박스 사용 가능 여부" },
              { name: "reason", type: "string | undefined", required: false, desc: "사용 불가 시 이유" },
              { name: "environment", type: '"native-linux" | "wsl2" | "wsl1" | "unknown"', required: true, desc: "감지된 환경 타입" },
              { name: "bubblewrapInstalled", type: "boolean", required: true, desc: "bubblewrap 설치 여부" },
              { name: "bubblewrapVersion", type: "string | undefined", required: false, desc: "bubblewrap 버전 문자열" },
              { name: "recommendations", type: "readonly string[]", required: true, desc: "설치 안내 등의 권장 사항" },
            ]}
          />

          {/* isWSL2 */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            isWSL2()
          </h3>
          <p className="text-[13px] text-gray-600 mb-3">
            WSL2 환경에서 실행 중인지 감지합니다. <code className="text-cyan-600">/proc/version</code>에
            &quot;microsoft&quot; 문자열이 있고, WSLInterop 파일이 존재하면 WSL2로 판단합니다.
          </p>
          <CodeBlock>
            <span className="kw">async function</span> <span className="fn">isWSL2</span>(): <span className="type">Promise</span>&lt;<span className="type">boolean</span>&gt;
          </CodeBlock>

          {/* isWSL1 */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            isWSL1()
          </h3>
          <p className="text-[13px] text-gray-600 mb-3">
            WSL1 환경에서 실행 중인지 감지합니다. /proc/version에 &quot;Microsoft&quot;가 있지만
            WSLInterop이 없으면 WSL1입니다.
          </p>
          <CodeBlock>
            <span className="kw">async function</span> <span className="fn">isWSL1</span>(): <span className="type">Promise</span>&lt;<span className="type">boolean</span>&gt;
          </CodeBlock>

          {/* hasBubblewrap */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            hasBubblewrap()
          </h3>
          <p className="text-[13px] text-gray-600 mb-3">
            bubblewrap(bwrap)가 설치되어 있고 실행 가능한지 확인합니다.
          </p>
          <CodeBlock>
            <span className="kw">async function</span> <span className="fn">hasBubblewrap</span>(): <span className="type">Promise</span>&lt;<span className="type">boolean</span>&gt;
          </CodeBlock>

          {/* generateBwrapArgs */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            generateBwrapArgs(config)
          </h3>
          <p className="text-[13px] text-gray-600 mb-3">
            bubblewrap 명령의 인수 배열을 생성합니다. 시스템 경로 읽기 전용 마운트, PID 격리, 세션 격리,
            선택적 네트워크 격리 등의 플래그를 포함합니다.
          </p>
          <CodeBlock>
            <span className="kw">function</span> <span className="fn">generateBwrapArgs</span>(<span className="prop">config</span>: <span className="type">LinuxSandboxConfig</span>): <span className="type">readonly string[]</span>
          </CodeBlock>

          {/* executeBubblewrap */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            executeBubblewrap(config)
          </h3>
          <p className="text-[13px] text-gray-600 mb-3">
            Linux bubblewrap 샌드박스 안에서 명령을 실행합니다.
            bwrap 미설치, WSL1, 타임아웃, 실행 실패 시 <code className="text-cyan-600">BubblewrapError</code>를 던집니다.
          </p>
          <CodeBlock>
            <span className="kw">async function</span> <span className="fn">executeBubblewrap</span>(<span className="prop">config</span>: <span className="type">LinuxSandboxConfig</span>): <span className="type">Promise</span>&lt;{"{"}
            {"\n"}{"  "}<span className="prop">stdout</span>: <span className="type">string</span>;
            {"\n"}{"  "}<span className="prop">stderr</span>: <span className="type">string</span>;
            {"\n"}{"}"}&gt;
          </CodeBlock>

          {/* checkLinuxSandboxReady */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            checkLinuxSandboxReady()
          </h3>
          <p className="text-[13px] text-gray-600 mb-3">
            Linux 샌드박스의 전체 준비 상태를 확인합니다. 환경 감지, bwrap 설치 확인,
            배포판별 설치 안내 제공 등을 종합적으로 수행합니다.
          </p>
          <CodeBlock>
            <span className="kw">async function</span> <span className="fn">checkLinuxSandboxReady</span>(): <span className="type">Promise</span>&lt;<span className="type">SandboxReadiness</span>&gt;
          </CodeBlock>

          {/* Caveats */}
          <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
          <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
            <li>
              WSL1에서는 커널 네임스페이스 기능이 없으므로 bubblewrap을 사용할 수 없습니다.
              <code className="text-cyan-600">checkLinuxSandboxReady()</code>가 WSL2 업그레이드를 권장합니다.
            </li>
            <li>
              <code className="text-cyan-600">READONLY_SYSTEM_PATHS</code>와
              <code className="text-cyan-600">HOME_READONLY_PATHS</code>는 모듈 내부에
              하드코딩되어 있으며, 외부에서 커스터마이징할 수 없습니다.
            </li>
            <li>
              <code className="text-cyan-600">allowNetwork</code>가 <code className="text-cyan-600">false</code>일 때만
              <code className="text-cyan-600">--unshare-net</code> 플래그가 추가됩니다.
              기본값은 <code className="text-cyan-600">true</code>이므로 네트워크가 열려 있습니다.
            </li>
            <li>
              최대 출력 버퍼는 10MB로 고정되어 있습니다. 대량의 stdout을 생성하는 명령은
              버퍼 초과 에러가 발생할 수 있습니다.
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
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>기본 사용법 &mdash; 샌드박스 준비 상태 확인</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            샌드박스를 사용하기 전에 먼저 환경이 준비되었는지 확인합니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 1. 샌드박스 준비 상태 확인"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">readiness</span> = <span className="kw">await</span> <span className="fn">checkLinuxSandboxReady</span>();
            {"\n"}
            {"\n"}<span className="kw">if</span> (!<span className="prop">readiness</span>.<span className="prop">available</span>) {"{"}
            {"\n"}{"  "}<span className="fn">console</span>.<span className="fn">log</span>(<span className="str">`샌드박스 사용 불가: ${"{"}</span><span className="prop">readiness</span>.<span className="prop">reason</span><span className="str">{"}"}`</span>);
            {"\n"}{"  "}<span className="prop">readiness</span>.<span className="prop">recommendations</span>.<span className="fn">forEach</span>(<span className="prop">r</span> =&gt; <span className="fn">console</span>.<span className="fn">log</span>(<span className="prop">r</span>));
            {"\n"}{"  "}<span className="kw">return</span>;
            {"\n"}{"}"}
            {"\n"}
            {"\n"}<span className="cm">{"// 2. 환경 정보 확인"}</span>
            {"\n"}<span className="fn">console</span>.<span className="fn">log</span>(<span className="str">`환경: ${"{"}</span><span className="prop">readiness</span>.<span className="prop">environment</span><span className="str">{"}"}`</span>);
            {"\n"}<span className="fn">console</span>.<span className="fn">log</span>(<span className="str">`bwrap 버전: ${"{"}</span><span className="prop">readiness</span>.<span className="prop">bubblewrapVersion</span><span className="str">{"}"}`</span>);
          </CodeBlock>

          {/* 샌드박스 실행 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>샌드박스 안에서 명령 실행</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            준비 상태 확인 후, <code className="text-cyan-600">executeBubblewrap()</code>으로
            격리된 환경에서 명령을 실행합니다.
          </p>
          <CodeBlock>
            <span className="kw">const</span> <span className="prop">result</span> = <span className="kw">await</span> <span className="fn">executeBubblewrap</span>({"{"}
            {"\n"}{"  "}<span className="prop">command</span>: <span className="str">&quot;node&quot;</span>,
            {"\n"}{"  "}<span className="prop">args</span>: [<span className="str">&quot;script.js&quot;</span>],
            {"\n"}{"  "}<span className="prop">projectDir</span>: <span className="str">&quot;/home/user/project&quot;</span>,
            {"\n"}{"  "}<span className="prop">timeoutMs</span>: <span className="num">60_000</span>,
            {"\n"}{"  "}<span className="prop">allowNetwork</span>: <span className="kw">true</span>,
            {"\n"}{"}"});
            {"\n"}
            {"\n"}<span className="fn">console</span>.<span className="fn">log</span>(<span className="prop">result</span>.<span className="prop">stdout</span>);
          </CodeBlock>

          <Callout type="warn" icon="!">
            <strong>주의:</strong> <code>executeBubblewrap()</code>은 내부에서 bwrap 설치 여부와 WSL1 환경을
            자동으로 확인합니다. 하지만 사전에 <code>checkLinuxSandboxReady()</code>를 호출하여
            사용자에게 설치 안내를 제공하는 것이 좋습니다.
          </Callout>

          {/* 고급: 네트워크 격리 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; 네트워크 격리 모드
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">allowNetwork: false</code>를 설정하면
            샌드박스 내부에서 외부 네트워크에 접근할 수 없습니다.
            신뢰할 수 없는 스크립트를 실행할 때 유용합니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 네트워크 완전 차단된 샌드박스"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">isolated</span> = <span className="kw">await</span> <span className="fn">executeBubblewrap</span>({"{"}
            {"\n"}{"  "}<span className="prop">command</span>: <span className="str">&quot;python3&quot;</span>,
            {"\n"}{"  "}<span className="prop">args</span>: [<span className="str">&quot;untrusted_script.py&quot;</span>],
            {"\n"}{"  "}<span className="prop">projectDir</span>: <span className="str">&quot;/home/user/sandbox-test&quot;</span>,
            {"\n"}{"  "}<span className="prop">allowNetwork</span>: <span className="kw">false</span>,
            {"\n"}{"}"});
          </CodeBlock>

          <DeepDive title="마운트 구조 상세">
            <p className="mb-3">
              <code className="text-cyan-600">generateBwrapArgs()</code>가 생성하는 마운트 구조입니다:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-gray-600">
              <li><strong>읽기 전용 시스템 경로:</strong> /usr, /bin, /lib, /lib64, /etc, /sbin</li>
              <li><strong>특수 파일 시스템:</strong> /proc (procfs), /dev (devfs)</li>
              <li><strong>휘발성 임시:</strong> /tmp (tmpfs)</li>
              <li><strong>읽기/쓰기:</strong> 프로젝트 디렉토리 (--bind)</li>
              <li><strong>홈 디렉토리 읽기 전용:</strong> .config, .npm, .cache, .nvm, .volta, .rustup, .cargo, .dbcode, .claude, .git (--ro-bind-try)</li>
            </ul>
            <p className="mt-3 text-amber-600">
              <code>--ro-bind-try</code>는 경로가 존재하지 않아도 에러를 발생시키지 않습니다.
              따라서 모든 홈 하위 경로를 안전하게 마운트 시도할 수 있습니다.
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

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>환경 감지 플로우</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">checkLinuxSandboxReady()</code>는 환경을 단계적으로 감지합니다.
            먼저 Linux 플랫폼인지 확인하고, WSL 버전을 판별한 뒤, bubblewrap 설치를 확인합니다.
          </p>

          <MermaidDiagram
            title="환경 감지 및 준비 상태 확인 플로우"
            titleColor="purple"
            chart={`graph TD
  START(("시작")) --> PLATFORM{"process.platform<br/>== 'linux'?"}
  PLATFORM -->|"아니오"| UNKNOWN["environment: 'unknown'<br/>available: false"]
  PLATFORM -->|"예"| WSL2{"isWSL2()?"}
  WSL2 -->|"예"| ENV_WSL2["environment: 'wsl2'"]
  WSL2 -->|"아니오"| WSL1{"isWSL1()?"}
  WSL1 -->|"예"| ENV_WSL1["environment: 'wsl1'<br/>available: false<br/><small>WSL2 업그레이드 권장</small>"]
  WSL1 -->|"아니오"| ENV_NATIVE["environment: 'native-linux'"]
  ENV_WSL2 --> BWRAP{"bwrap 설치?"}
  ENV_NATIVE --> BWRAP
  BWRAP -->|"예"| READY["available: true"]
  BWRAP -->|"아니오"| DISTRO["배포판 감지<br/>→ 설치 안내 생성"]

  style READY fill:#dcfce7,stroke:#10b981,color:#065f46,stroke-width:2px
  style UNKNOWN fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style ENV_WSL1 fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style DISTRO fill:#fef3c7,stroke:#f59e0b,color:#92400e`}
          />

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>WSL 감지 메커니즘</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            WSL 판별은 <code className="text-cyan-600">/proc/version</code> 파일과
            <code className="text-cyan-600">/proc/sys/fs/binfmt_misc/WSLInterop</code> 파일을 기반으로 합니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// WSL2 감지 핵심 로직"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">version</span> = <span className="kw">await</span> <span className="fn">readFile</span>(<span className="str">&quot;/proc/version&quot;</span>, <span className="str">&quot;utf-8&quot;</span>);
            {"\n"}<span className="kw">const</span> <span className="prop">hasMicrosoftKernel</span> = <span className="str">/microsoft/i</span>.<span className="fn">test</span>(<span className="prop">version</span>);
            {"\n"}
            {"\n"}<span className="kw">if</span> (<span className="prop">hasMicrosoftKernel</span>) {"{"}
            {"\n"}{"  "}<span className="cm">{"// WSLInterop 존재 → WSL2 (네임스페이스 지원)"}</span>
            {"\n"}{"  "}<span className="cm">{"// WSLInterop 부재 → WSL1 (네임스페이스 미지원)"}</span>
            {"\n"}{"  "}<span className="kw">await</span> <span className="fn">access</span>(<span className="str">&quot;/proc/sys/fs/binfmt_misc/WSLInterop&quot;</span>);
            {"\n"}{"}"}
          </CodeBlock>

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>배포판별 설치 안내</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            bubblewrap가 미설치일 때, <code className="text-cyan-600">/etc/os-release</code>를 파싱하여
            배포판 계열(Debian, Fedora, Arch)에 맞는 설치 명령을 제공합니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 배포판별 설치 명령"}</span>
            {"\n"}<span className="str">&quot;debian&quot;</span>  → <span className="str">&quot;sudo apt install bubblewrap&quot;</span>
            {"\n"}<span className="str">&quot;fedora&quot;</span>  → <span className="str">&quot;sudo dnf install bubblewrap&quot;</span>
            {"\n"}<span className="str">&quot;arch&quot;</span>    → <span className="str">&quot;sudo pacman -S bubblewrap&quot;</span>
            {"\n"}<span className="str">&quot;unknown&quot;</span> → 세 가지 모두 안내
          </CodeBlock>
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
              &quot;bubblewrap (bwrap) is not installed 에러가 발생해요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              bwrap가 시스템에 설치되어 있지 않거나 PATH에 없습니다.
              <code className="text-cyan-600">checkLinuxSandboxReady()</code>를 호출하면
              배포판에 맞는 설치 명령을 확인할 수 있습니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// Ubuntu/Debian"}</span>
              {"\n"}<span className="prop">sudo apt install bubblewrap</span>
              {"\n"}
              {"\n"}<span className="cm">{"// Fedora"}</span>
              {"\n"}<span className="prop">sudo dnf install bubblewrap</span>
              {"\n"}
              {"\n"}<span className="cm">{"// Arch"}</span>
              {"\n"}<span className="prop">sudo pacman -S bubblewrap</span>
            </CodeBlock>
          </div>

          {/* FAQ 2 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;WSL1에서 bubblewrap sandbox is not supported 에러가 발생해요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              WSL1은 Linux 네임스페이스 기능을 지원하지 않아 bubblewrap을 사용할 수 없습니다.
              WSL2로 업그레이드해야 합니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// WSL2로 업그레이드"}</span>
              {"\n"}<span className="prop">wsl --set-version &lt;distro&gt; 2</span>
            </CodeBlock>
          </div>

          {/* FAQ 3 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;Sandboxed command timed out 에러가 발생해요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              명령이 기본 타임아웃(120초)을 초과했습니다.
              <code className="text-cyan-600">timeoutMs</code> 값을 늘려서 설정하거나,
              실행하는 명령 자체가 무한 루프에 빠지지 않았는지 확인하세요.
            </p>
          </div>

          {/* FAQ 4 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;checkLinuxSandboxReady()가 unknown 환경을 반환해요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">process.platform</code>이 &quot;linux&quot;가 아닌 경우입니다.
              macOS에서는 <code className="text-cyan-600">seatbelt.ts</code>를 사용해야 합니다.
              Linux 샌드박스는 Linux 환경에서만 동작합니다.
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
                name: "bubblewrap.ts",
                slug: "sandbox-bubblewrap",
                relation: "sibling",
                desc: "bubblewrap 래퍼 — bwrap 인수 생성과 실행을 위한 고수준 래퍼 모듈",
              },
              {
                name: "seatbelt.ts",
                slug: "sandbox-seatbelt",
                relation: "sibling",
                desc: "macOS Seatbelt 샌드박스 — macOS 환경에서의 프로세스 격리",
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
    </div></div>
  );
}

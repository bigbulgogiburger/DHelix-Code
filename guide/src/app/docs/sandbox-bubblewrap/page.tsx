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

export default function SandboxBubblewrapPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}><div className="center-narrow">
      {/* ─── Header ─── */}
      <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <FilePath path="src/sandbox/bubblewrap.ts" />
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
            <span className="text-gray-900">
              Bubblewrap 래퍼
            </span>
          </h1>
          <div className="flex items-center gap-3 mb-5">
            <LayerBadge layer="leaf" />
          </div>
          <p className="text-[16px] text-gray-600 leading-relaxed">
            Linux의 네임스페이스 기능을 활용하여 프로세스를 격리된 환경에서 실행하는
            bubblewrap(bwrap) 고수준 래퍼 모듈입니다.
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
              <code className="text-cyan-600">bubblewrap.ts</code>는 Linux의
              bubblewrap(bwrap) 명령을 감싸는 고수준 래퍼입니다. Docker 같은 컨테이너보다 가볍고,
              루트 권한 없이 프로세스를 격리할 수 있습니다.
              <code className="text-cyan-600">linux.ts</code>가 환경 감지와 기본 실행을 담당한다면,
              이 모듈은 더 정교한 마운트 관리, WSL2 Windows 홈 디렉토리 지원,
              AbortController 기반 타임아웃 관리 등 고급 기능을 제공합니다.
            </p>
            <p>
              마운트(mount) 구조는 &quot;최소 권한 원칙&quot;을 따릅니다. 시스템 경로는 읽기 전용으로,
              프로젝트 디렉토리만 읽기/쓰기로 마운트하며, 홈 디렉토리의 설정 폴더는 읽기 전용으로 접근합니다.
              일부 배포판에서는 /lib, /bin 등이 심볼릭 링크인 경우를 자동으로 처리합니다.
            </p>
            <p>
              WSL2 환경에서는 Windows 홈 디렉토리(<code className="text-cyan-600">/mnt/c/Users/...</code>)를
              자동 감지하여 읽기 전용으로 마운트합니다.
              사용자 지정 경로 마운트도 <code className="text-cyan-600">allowedPaths</code>를 통해 지원합니다.
            </p>
          </div>

          <MermaidDiagram
            title="Bubblewrap 래퍼 아키텍처 위치"
            titleColor="purple"
            chart={`graph TD
  LINUX["linux.ts<br/><small>환경 감지</small>"]
  BWRAP["bubblewrap.ts<br/><small>bwrap 래퍼</small>"]
  SANDNET["sandboxed-network.ts<br/><small>네트워크 정책 통합</small>"]
  PROXY["network-proxy.ts<br/><small>HTTP 프록시</small>"]
  POLICY["network-policy.ts<br/><small>정책 엔진</small>"]

  SANDNET --> BWRAP
  BWRAP -->|"isWSL2()"| LINUX
  SANDNET --> PROXY
  PROXY --> POLICY

  style BWRAP fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style LINUX fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style SANDNET fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style PROXY fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style POLICY fill:#e0e7ff,stroke:#64748b,color:#1e293b`}
          />

          <Callout type="info" icon="💡">
            <strong>비유:</strong> bubblewrap.ts는 투명한 &quot;버블 랩(뽁뽁이)&quot;과 같습니다.
            프로세스를 감싸서 외부 충격(파일 시스템 손상, 네트워크 남용)으로부터 보호하면서도,
            필요한 부분은 구멍을 뚫어(마운트) 접근할 수 있게 해줍니다.
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 2. 레퍼런스 (Reference) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>📖</span> 레퍼런스
          </h2>

          {/* PathMount interface */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface PathMount
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            bubblewrap 샌드박스에 마운트할 파일 시스템 경로를 정의합니다.
          </p>
          <ParamTable
            params={[
              { name: "hostPath", type: "string", required: true, desc: "호스트(실제) 파일 시스템의 경로" },
              { name: "sandboxPath", type: "string | undefined", required: false, desc: "샌드박스 내부에서의 경로 (생략 시 hostPath와 동일)" },
              { name: "writable", type: "boolean", required: true, desc: "쓰기 허용 여부 (true면 --bind, false면 --ro-bind)" },
            ]}
          />

          {/* BubblewrapConfig interface */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface BubblewrapConfig
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            bubblewrap 샌드박스 실행의 전체 설정입니다.
          </p>
          <ParamTable
            params={[
              { name: "command", type: "string", required: true, desc: "샌드박스 안에서 실행할 명령어" },
              { name: "args", type: "readonly string[]", required: false, desc: "명령어 인수 배열" },
              { name: "cwd", type: "string", required: false, desc: "작업 디렉토리" },
              { name: "projectDir", type: "string", required: true, desc: "프로젝트 디렉토리 (읽기/쓰기로 마운트)" },
              { name: "homeDir", type: "string", required: false, desc: "홈 디렉토리 (기본값: os.homedir())" },
              { name: "tmpDir", type: "string", required: false, desc: "임시 디렉토리 (기본값: os.tmpdir())" },
              { name: "timeoutMs", type: "number", required: false, desc: "실행 타임아웃 밀리초 (기본값: 120000)" },
              { name: "env", type: "Record<string, string>", required: false, desc: "샌드박스 내부에 설정할 환경 변수" },
              { name: "networkAccess", type: "boolean", required: false, desc: "네트워크 접근 허용 여부 (기본값: true)" },
              { name: "allowedPaths", type: "readonly PathMount[]", required: false, desc: "추가로 마운트할 경로 목록" },
            ]}
          />

          {/* SandboxResult interface */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface SandboxResult
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            bubblewrap 실행 결과입니다.
          </p>
          <ParamTable
            params={[
              { name: "stdout", type: "string", required: true, desc: "표준 출력(stdout)" },
              { name: "stderr", type: "string", required: true, desc: "표준 에러(stderr)" },
              { name: "exitCode", type: "number", required: true, desc: "종료 코드 (0이면 성공)" },
              { name: "timedOut", type: "boolean", required: true, desc: "타임아웃으로 종료되었는지 여부" },
            ]}
          />

          {/* generateBubblewrapArgs */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            generateBubblewrapArgs(config)
          </h3>
          <p className="text-[13px] text-gray-600 mb-3">
            bubblewrap 명령의 인수 배열을 생성합니다.
            시스템 경로 존재 여부를 확인하고, 심볼릭 링크를 처리하며,
            WSL2 Windows 홈 디렉토리를 자동 감지합니다.
          </p>
          <CodeBlock>
            <span className="kw">async function</span> <span className="fn">generateBubblewrapArgs</span>(
            {"\n"}{"  "}<span className="prop">config</span>: <span className="type">BubblewrapConfig</span>
            {"\n"}): <span className="type">Promise</span>&lt;<span className="type">readonly string[]</span>&gt;
          </CodeBlock>

          {/* executeBubblewrapped */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            executeBubblewrapped(config)
          </h3>
          <p className="text-[13px] text-gray-600 mb-3">
            bubblewrap 샌드박스 안에서 명령을 실행합니다.
            AbortController 기반 타임아웃 관리, 권한 에러 처리,
            비정상 종료 코드 처리를 포함합니다.
          </p>
          <CodeBlock>
            <span className="kw">async function</span> <span className="fn">executeBubblewrapped</span>(
            {"\n"}{"  "}<span className="prop">config</span>: <span className="type">BubblewrapConfig</span>
            {"\n"}): <span className="type">Promise</span>&lt;<span className="type">SandboxResult</span>&gt;
          </CodeBlock>

          {/* Caveats */}
          <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
          <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
            <li>
              <code className="text-cyan-600">generateBubblewrapArgs()</code>는 <strong>async</strong>입니다.
              각 시스템 경로와 홈 디렉토리 하위 경로의 존재 여부를 비동기로 확인하기 때문입니다.
            </li>
            <li>
              타임아웃 시 종료 코드 <code className="text-cyan-600">124</code>를 반환합니다.
              이는 Linux의 <code className="text-cyan-600">timeout</code> 명령과 동일한 규약입니다.
            </li>
            <li>
              EACCES 에러가 발생하면 커널의 unprivileged user namespace 설정을 확인해야 합니다:
              <code className="text-cyan-600">sysctl kernel.unprivileged_userns_clone=1</code>
            </li>
            <li>
              <code className="text-cyan-600">networkAccess: true</code>이면
              <code className="text-cyan-600">--share-net</code>,
              <code className="text-cyan-600">false</code>이면
              <code className="text-cyan-600">--unshare-net</code>이 사용됩니다.
            </li>
            <li>
              <code className="text-cyan-600">.local</code> 디렉토리는 예외적으로
              읽기/쓰기로 마운트됩니다 (일부 도구가 여기에 기록하기 때문).
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
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>기본 사용법 &mdash; 샌드박스 안에서 명령 실행</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">executeBubblewrapped()</code>로 격리된 환경에서 명령을 실행합니다.
          </p>
          <CodeBlock>
            <span className="kw">const</span> <span className="prop">result</span> = <span className="kw">await</span> <span className="fn">executeBubblewrapped</span>({"{"}
            {"\n"}{"  "}<span className="prop">command</span>: <span className="str">&quot;node&quot;</span>,
            {"\n"}{"  "}<span className="prop">args</span>: [<span className="str">&quot;script.js&quot;</span>],
            {"\n"}{"  "}<span className="prop">projectDir</span>: <span className="str">&quot;/home/user/project&quot;</span>,
            {"\n"}{"}"});
            {"\n"}
            {"\n"}<span className="kw">if</span> (<span className="prop">result</span>.<span className="prop">timedOut</span>) {"{"}
            {"\n"}{"  "}<span className="fn">console</span>.<span className="fn">error</span>(<span className="str">&quot;명령이 타임아웃되었습니다&quot;</span>);
            {"\n"}{"}"} <span className="kw">else if</span> (<span className="prop">result</span>.<span className="prop">exitCode</span> !== <span className="num">0</span>) {"{"}
            {"\n"}{"  "}<span className="fn">console</span>.<span className="fn">error</span>(<span className="str">`종료 코드: ${"{"}</span><span className="prop">result</span>.<span className="prop">exitCode</span><span className="str">{"}"}`</span>);
            {"\n"}{"}"} <span className="kw">else</span> {"{"}
            {"\n"}{"  "}<span className="fn">console</span>.<span className="fn">log</span>(<span className="prop">result</span>.<span className="prop">stdout</span>);
            {"\n"}{"}"}
          </CodeBlock>

          <Callout type="warn" icon="!">
            <strong>주의:</strong> bwrap가 설치되어 있지 않으면 <code>BubblewrapError</code>를 던집니다.
            사전에 <code>linux.ts</code>의 <code>checkLinuxSandboxReady()</code>로
            설치 상태를 확인하는 것을 권장합니다.
          </Callout>

          {/* 추가 경로 마운트 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; 사용자 지정 경로 마운트
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">allowedPaths</code>를 사용하여 추가 경로를 마운트할 수 있습니다.
            각 경로의 읽기/쓰기 여부와 샌드박스 내부 경로를 개별적으로 지정할 수 있습니다.
          </p>
          <CodeBlock>
            <span className="kw">const</span> <span className="prop">result</span> = <span className="kw">await</span> <span className="fn">executeBubblewrapped</span>({"{"}
            {"\n"}{"  "}<span className="prop">command</span>: <span className="str">&quot;python3&quot;</span>,
            {"\n"}{"  "}<span className="prop">args</span>: [<span className="str">&quot;train.py&quot;</span>],
            {"\n"}{"  "}<span className="prop">projectDir</span>: <span className="str">&quot;/home/user/ml-project&quot;</span>,
            {"\n"}{"  "}<span className="prop">allowedPaths</span>: [
            {"\n"}{"    "}{"{"}
            {"\n"}{"      "}<span className="prop">hostPath</span>: <span className="str">&quot;/data/datasets&quot;</span>,
            {"\n"}{"      "}<span className="prop">writable</span>: <span className="kw">false</span>,  <span className="cm">{"// 읽기 전용"}</span>
            {"\n"}{"    "}{"}"},{"\n"}{"    "}{"{"}
            {"\n"}{"      "}<span className="prop">hostPath</span>: <span className="str">&quot;/data/output&quot;</span>,
            {"\n"}{"      "}<span className="prop">sandboxPath</span>: <span className="str">&quot;/output&quot;</span>,  <span className="cm">{"// 내부 경로 변경"}</span>
            {"\n"}{"      "}<span className="prop">writable</span>: <span className="kw">true</span>,   <span className="cm">{"// 쓰기 허용"}</span>
            {"\n"}{"    "}{"}"},{"\n"}{"  "}],
            {"\n"}{"}"});
          </CodeBlock>

          {/* 환경 변수 주입 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; 환경 변수 주입
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">env</code> 옵션으로 샌드박스 내부에 환경 변수를 설정합니다.
            <code className="text-cyan-600">HOME</code>은 자동으로 설정됩니다.
          </p>
          <CodeBlock>
            <span className="kw">const</span> <span className="prop">result</span> = <span className="kw">await</span> <span className="fn">executeBubblewrapped</span>({"{"}
            {"\n"}{"  "}<span className="prop">command</span>: <span className="str">&quot;node&quot;</span>,
            {"\n"}{"  "}<span className="prop">args</span>: [<span className="str">&quot;app.js&quot;</span>],
            {"\n"}{"  "}<span className="prop">projectDir</span>: <span className="str">&quot;/home/user/project&quot;</span>,
            {"\n"}{"  "}<span className="prop">env</span>: {"{"}
            {"\n"}{"    "}<span className="prop">NODE_ENV</span>: <span className="str">&quot;production&quot;</span>,
            {"\n"}{"    "}<span className="prop">API_KEY</span>: <span className="str">&quot;sk-...&quot;</span>,
            {"\n"}{"  "}{"}"},{"\n"}{"}"});
          </CodeBlock>

          <DeepDive title="심볼릭 링크 자동 처리">
            <p className="mb-3">
              일부 Linux 배포판에서는 <code className="text-cyan-600">/bin</code>,
              <code className="text-cyan-600">/lib</code> 등이 심볼릭 링크입니다
              (예: <code className="text-cyan-600">/bin</code> &rarr; <code className="text-cyan-600">/usr/bin</code>).
            </p>
            <p className="mb-3">
              <code className="text-cyan-600">generateBubblewrapArgs()</code>는 이를 자동으로 감지하여,
              실제 경로가 없으면 <code className="text-cyan-600">--symlink</code> 플래그로 심볼릭 링크를 생성합니다:
            </p>
            <CodeBlock>
              <span className="cm">{"// /lib이 없고 /usr/lib이 있으면"}</span>
              {"\n"}<span className="prop">--symlink usr/lib /lib</span>
              {"\n"}
              {"\n"}<span className="cm">{"// /bin이 없고 /usr/bin이 있으면"}</span>
              {"\n"}<span className="prop">--symlink usr/bin /bin</span>
            </CodeBlock>
            <p className="mt-3 text-amber-600">
              이 처리가 없으면 일부 배포판에서 &quot;No such file or directory&quot; 에러가 발생합니다.
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

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>마운트 구조 다이어그램</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">generateBubblewrapArgs()</code>가 생성하는
            샌드박스 내부의 파일 시스템 마운트 구조입니다.
          </p>

          <MermaidDiagram
            title="Bubblewrap 마운트 구조"
            titleColor="purple"
            chart={`graph TD
  ROOT["/  (샌드박스 루트)"]
  SYS["시스템 경로<br/><small>/usr, /bin, /lib, /etc, /sbin</small><br/>🔒 읽기 전용"]
  PROC["/proc  (procfs)<br/>/dev  (devfs)"]
  TMP["/tmp  (tmpfs 휘발성)<br/>/tmp/dbcode  (쓰기 가능)"]
  PROJ["프로젝트 디렉토리<br/>📝 읽기/쓰기"]
  HOME["홈 설정 폴더<br/><small>.config, .npm, .cache 등</small><br/>🔒 읽기 전용"]
  LOCAL["~/.local<br/>📝 읽기/쓰기 (예외)"]
  CUSTOM["사용자 지정 경로<br/><small>allowedPaths</small>"]

  ROOT --> SYS
  ROOT --> PROC
  ROOT --> TMP
  ROOT --> PROJ
  ROOT --> HOME
  ROOT --> LOCAL
  ROOT --> CUSTOM

  style PROJ fill:#dcfce7,stroke:#10b981,color:#065f46,stroke-width:2px
  style SYS fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style HOME fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style LOCAL fill:#dcfce7,stroke:#10b981,color:#065f46
  style TMP fill:#fef3c7,stroke:#f59e0b,color:#92400e`}
          />

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>에러 처리 분기</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">executeBubblewrapped()</code>는 다양한 에러 유형을 구분하여 처리합니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 에러 유형별 처리 분기"}</span>
            {"\n"}<span className="kw">catch</span> (<span className="prop">error</span>) {"{"}
            {"\n"}{"  "}<span className="cm">{"// 1. AbortError → 타임아웃 (exitCode: 124)"}</span>
            {"\n"}{"  "}<span className="cm">{"// 2. killed === true → 시그널에 의한 강제 종료"}</span>
            {"\n"}{"  "}<span className="cm">{"// 3. EACCES → 네임스페이스 권한 부족"}</span>
            {"\n"}{"  "}<span className="cm">{"//    → sysctl kernel.unprivileged_userns_clone=1 안내"}</span>
            {"\n"}{"  "}<span className="cm">{"// 4. code가 number → 비정상 종료 코드 (정상 결과로 반환)"}</span>
            {"\n"}{"  "}<span className="cm">{"// 5. 그 외 → BubblewrapError 던짐"}</span>
            {"\n"}{"}"}
          </CodeBlock>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
            <p><strong className="text-gray-900">AbortController:</strong> 타임아웃 관리에 <code className="text-cyan-600">AbortController</code>와 <code className="text-cyan-600">setTimeout</code>을 이중으로 사용합니다. <code className="text-cyan-600">finally</code>에서 타이머를 반드시 정리합니다.</p>
            <p><strong className="text-gray-900">종료 코드 124:</strong> Linux의 <code className="text-cyan-600">timeout</code> 명령과 동일한 규약으로, 타임아웃으로 종료되었음을 나타냅니다.</p>
            <p><strong className="text-gray-900">비정상 종료 코드:</strong> 명령 자체가 실행은 되었지만 실패한 경우(예: 종료 코드 1), 에러를 던지지 않고 <code className="text-cyan-600">SandboxResult</code>로 반환합니다.</p>
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
              &quot;Permission denied when executing bubblewrap 에러가 발생해요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              커널이 unprivileged user namespace를 허용하지 않는 설정일 수 있습니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 현재 설정 확인"}</span>
              {"\n"}<span className="prop">sysctl kernel.unprivileged_userns_clone</span>
              {"\n"}
              {"\n"}<span className="cm">{"// 활성화 (root 필요)"}</span>
              {"\n"}<span className="prop">sudo sysctl -w kernel.unprivileged_userns_clone=1</span>
            </CodeBlock>
          </div>

          {/* FAQ 2 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;샌드박스 안에서 파일이 보이지 않아요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              마운트 목록에 포함되지 않은 경로는 샌드박스 안에서 접근할 수 없습니다.
              <code className="text-cyan-600">allowedPaths</code>를 사용하여 필요한 경로를 추가 마운트하세요.
            </p>
            <Callout type="tip" icon="*">
              <code>generateBubblewrapArgs()</code>는 존재하지 않는 경로를 자동으로 건너뜁니다.
              경로가 실제로 호스트 시스템에 존재하는지 확인하세요.
            </Callout>
          </div>

          {/* FAQ 3 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;WSL2에서 Windows 파일에 접근할 수 없어요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              WSL2 환경에서 Windows 홈 디렉토리는 자동으로 읽기 전용으로 마운트됩니다.
              <code className="text-cyan-600">wslpath</code> 유틸리티가 설치되어 있고,
              <code className="text-cyan-600">/mnt/c/Users/...</code> 경로로 접근 가능한지 확인하세요.
              쓰기가 필요하면 <code className="text-cyan-600">allowedPaths</code>에
              <code className="text-cyan-600">writable: true</code>로 추가하세요.
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
                name: "linux.ts",
                slug: "sandbox-linux",
                relation: "sibling",
                desc: "Linux 환경 감지, WSL 판별, bubblewrap 설치 확인 모듈",
              },
              {
                name: "seatbelt.ts",
                slug: "sandbox-seatbelt",
                relation: "sibling",
                desc: "macOS Seatbelt 샌드박스 — macOS 환경에서의 프로세스 격리",
              },
              {
                name: "network-proxy.ts",
                slug: "sandbox-network-proxy",
                relation: "child",
                desc: "네트워크 프록시 — 네트워크 정책을 적용하는 HTTP 프록시 서버",
              },
            ]}
          />
        </section>
      </RevealOnScroll>
    </div></div>
  );
}

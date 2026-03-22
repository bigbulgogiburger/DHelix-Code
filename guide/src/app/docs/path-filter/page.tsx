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

export default function PathFilterPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}><div className="center-narrow">
      {/* ─── Header ─── */}
      <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <FilePath path="src/guardrails/path-filter.ts" />
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
            <span className="text-gray-900">
              Path Filter
            </span>
          </h1>
          <div className="flex items-center gap-3 mb-5">
            <LayerBadge layer="infra" />
          </div>
          <p className="text-[16px] text-gray-600 leading-relaxed">
            경로 접근 제한 필터 &mdash; 파일 경로의 안전성을 검사하여 민감한 시스템 파일과 인증 정보에 대한 접근을 차단하는 보안 모듈입니다.
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
              <code className="text-cyan-600">path-filter</code>는 AI가 파일을 읽거나 쓸 때,
              민감한 시스템 파일이나 인증 정보 파일에 접근하는 것을 방지하는 보안 모듈입니다.
              네 가지 위협을 탐지합니다: 경로 순회(Path Traversal), 민감한 시스템 파일 접근,
              민감한 홈 디렉토리 파일 접근, 심볼릭 링크를 통한 탈출(Symlink Escape).
            </p>
            <p>
              경로 순회란 <code className="text-cyan-600">../../etc/passwd</code>처럼
              <code className="text-cyan-600">../</code> 시퀀스를 사용하여 작업 디렉토리 외부의
              파일에 접근하는 공격 기법입니다. 이 모듈은 상대 경로를 절대 경로로 해석한 후
              작업 디렉토리 내에 있는지 확인합니다.
            </p>
            <p>
              또한 <code className="text-cyan-600">~/.ssh</code>, <code className="text-cyan-600">~/.aws/credentials</code>,
              <code className="text-cyan-600">/etc/shadow</code> 등 절대 외부에 노출되어서는 안 되는
              민감한 파일들에 대한 직접 접근과 심볼릭 링크를 통한 간접 접근을 모두 차단합니다.
            </p>
          </div>

          <MermaidDiagram
            title="Path Filter 아키텍처 위치"
            titleColor="purple"
            chart={`graph TD
  TOOL["Tool Executor<br/><small>파일 읽기/쓰기 요청</small>"]
  PF["Path Filter<br/><small>path-filter.ts</small>"]
  TRAV["경로 순회 검사<br/><small>../ 탈출 감지</small>"]
  SYS["시스템 파일 검사<br/><small>/etc/shadow 등</small>"]
  HOME["홈 디렉토리 검사<br/><small>~/.ssh, ~/.aws 등</small>"]
  LINK["심볼릭 링크 검사<br/><small>realpath 확인</small>"]
  FS["File System<br/><small>실제 파일 접근</small>"]

  TOOL -->|"경로 검사"| PF
  PF --> TRAV
  PF --> SYS
  PF --> HOME
  PF --> LINK
  TRAV -->|"안전"| FS
  SYS -->|"안전"| FS
  HOME -->|"안전"| FS
  LINK -->|"안전"| FS

  style PF fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style TOOL fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style TRAV fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style SYS fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style HOME fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style LINK fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style FS fill:#dcfce7,stroke:#10b981,color:#065f46`}
          />

          <Callout type="info" icon="💡">
            <strong>비유:</strong> 회사의 출입 통제 시스템을 떠올리세요. 사원증(작업 디렉토리)이 있는 직원은
            자기 층(프로젝트 디렉토리)에서 자유롭게 이동할 수 있지만, 서버실(~/.ssh), 금고(~/.aws/credentials),
            본사 기밀실(/etc/shadow)에는 별도의 보안 승인 없이 들어갈 수 없습니다.
            비상구(심볼릭 링크)를 통한 우회 접근도 차단됩니다.
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 2. 레퍼런스 (Reference) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>📖</span> 레퍼런스
          </h2>

          {/* PathFilterResult interface */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface PathFilterResult
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            경로 필터 검사 결과를 나타냅니다.
          </p>
          <ParamTable
            params={[
              { name: "safe", type: "boolean", required: true, desc: "경로가 안전한지 여부 (false이면 접근 차단)" },
              { name: "reason", type: "string | undefined", required: false, desc: "안전하지 않은 경우 차단 이유를 설명하는 메시지" },
            ]}
          />

          {/* checkPath function */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            checkPath(path, workingDirectory)
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            파일 경로의 안전성을 검사합니다. 작업 디렉토리 내에 있고, 민감한 파일에 접근하지 않으며,
            심볼릭 링크를 통한 탈출이 없는지 5단계로 검사합니다.
          </p>
          <CodeBlock>
            <span className="kw">export function</span> <span className="fn">checkPath</span>(<span className="prop">path</span>: <span className="type">string</span>, <span className="prop">workingDirectory</span>: <span className="type">string</span>): <span className="type">PathFilterResult</span>
          </CodeBlock>
          <ParamTable
            params={[
              { name: "path", type: "string", required: true, desc: "검사할 파일 경로 (상대 또는 절대)" },
              { name: "workingDirectory", type: "string", required: true, desc: "현재 작업 디렉토리 (상대 경로의 기준점)" },
            ]}
          />

          {/* 민감한 시스템 경로 */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            차단되는 시스템 경로 (SENSITIVE_SYSTEM_PATHS)
          </h4>
          <div className="text-[13px] text-gray-600 mt-2 space-y-1">
            <p>&bull; <code className="text-red-600">/etc/shadow</code> &mdash; 해시된 사용자 비밀번호</p>
            <p>&bull; <code className="text-red-600">/etc/passwd</code> &mdash; 사용자 계정 정보</p>
            <p>&bull; <code className="text-red-600">/etc/sudoers</code> &mdash; sudo 권한 설정</p>
            <p>&bull; <code className="text-red-600">/etc/master.passwd</code> &mdash; BSD/macOS 비밀번호</p>
            <p>&bull; <code className="text-red-600">/private/etc/shadow</code> &mdash; macOS shadow 파일</p>
            <p>&bull; <code className="text-red-600">/private/etc/master.passwd</code> &mdash; macOS master.passwd</p>
          </div>

          {/* 민감한 홈 디렉토리 경로 */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            차단되는 홈 디렉토리 경로 (SENSITIVE_HOME_PATHS)
          </h4>
          <div className="text-[13px] text-gray-600 mt-2 space-y-1">
            <p>&bull; <code className="text-red-600">~/.ssh</code> &mdash; SSH 키 쌍 및 접근 설정</p>
            <p>&bull; <code className="text-red-600">~/.gnupg</code>, <code className="text-red-600">~/.gpg</code> &mdash; GPG 암호화 키</p>
            <p>&bull; <code className="text-red-600">~/.aws/credentials</code> &mdash; AWS 인증 정보</p>
            <p>&bull; <code className="text-red-600">~/.azure/credentials</code> &mdash; Azure 인증 정보</p>
            <p>&bull; <code className="text-red-600">~/.config/gcloud</code> &mdash; Google Cloud 인증 정보</p>
            <p>&bull; <code className="text-red-600">~/.docker/config.json</code> &mdash; Docker 레지스트리 인증</p>
            <p>&bull; <code className="text-red-600">~/.npmrc</code> &mdash; npm 레지스트리 인증 토큰</p>
            <p>&bull; <code className="text-red-600">~/.pypirc</code> &mdash; PyPI 배포 인증 정보</p>
            <p>&bull; <code className="text-red-600">~/.netrc</code> &mdash; FTP/HTTP 인증 자격 증명</p>
            <p>&bull; <code className="text-red-600">~/.kube/config</code> &mdash; Kubernetes 접근 인증</p>
            <p>&bull; <code className="text-red-600">~/.env</code> &mdash; 환경 변수 파일</p>
          </div>

          {/* Caveats */}
          <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
          <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
            <li>
              <code className="text-cyan-600">../</code>가 포함된 경로라도 해석 결과가 작업 디렉토리
              <strong>내부</strong>에 있으면 허용됩니다. 예: <code>/project/src/../lib/util.ts</code>는
              <code>/project/lib/util.ts</code>로 해석되어 안전합니다.
            </li>
            <li>
              심볼릭 링크 검사는 파일이 <strong>이미 존재</strong>하는 경우에만 수행됩니다.
              아직 생성되지 않은 파일에 대해서는 심볼릭 링크 검사가 건너뛰어집니다.
            </li>
            <li>
              홈 디렉토리는 <code className="text-cyan-600">HOME</code> 또는 <code className="text-cyan-600">USERPROFILE</code>
              환경 변수에서 가져옵니다. 이 변수가 설정되지 않으면 홈 디렉토리 기반 검사가 건너뛰어집니다.
            </li>
            <li>
              경로 정규화에 <code className="text-cyan-600">normalizePath()</code>(<code>utils/path.ts</code>)를
              사용하여 슬래시를 통일합니다. Windows의 백슬래시도 올바르게 처리됩니다.
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
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>기본 사용법 &mdash; 파일 접근 전 안전 검사</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            파일을 읽거나 쓰기 전에 <code className="text-cyan-600">checkPath()</code>로 경로의 안전성을 검사합니다.
          </p>
          <CodeBlock>
            <span className="kw">import</span> {"{"} <span className="fn">checkPath</span> {"}"} <span className="kw">from</span> <span className="str">&quot;./guardrails/path-filter.js&quot;</span>;
            {"\n"}
            {"\n"}<span className="kw">const</span> <span className="prop">workDir</span> = <span className="str">&quot;/home/user/project&quot;</span>;
            {"\n"}
            {"\n"}<span className="cm">{"// 경로 순회 공격 → 차단"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">r1</span> = <span className="fn">checkPath</span>(<span className="str">&quot;../../etc/passwd&quot;</span>, <span className="prop">workDir</span>);
            {"\n"}<span className="cm">{"// r1.safe === false"}</span>
            {"\n"}<span className="cm">{"// r1.reason === 'Path traversal detected: ...'"}</span>
            {"\n"}
            {"\n"}<span className="cm">{"// 민감한 홈 파일 접근 → 차단"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">r2</span> = <span className="fn">checkPath</span>(<span className="str">&quot;/home/user/.ssh/id_rsa&quot;</span>, <span className="prop">workDir</span>);
            {"\n"}<span className="cm">{"// r2.safe === false"}</span>
            {"\n"}<span className="cm">{"// r2.reason === 'Access to sensitive path blocked: ~/.ssh'"}</span>
            {"\n"}
            {"\n"}<span className="cm">{"// 안전한 경로 → 허용"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">r3</span> = <span className="fn">checkPath</span>(<span className="str">&quot;src/index.ts&quot;</span>, <span className="prop">workDir</span>);
            {"\n"}<span className="cm">{"// r3.safe === true"}</span>
          </CodeBlock>

          <Callout type="warn" icon="!">
            <strong>주의:</strong> <code>checkPath()</code>는 동기(sync) 함수입니다.
            심볼릭 링크 검사에서 <code>lstatSync()</code>와 <code>realpathSync()</code>를 사용합니다.
            대량의 경로를 검사할 때 I/O 블로킹에 주의하세요.
          </Callout>

          {/* 고급: 작업 디렉토리 내부의 ../  */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; 작업 디렉토리 내부의 상대 경로
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">../</code>가 포함되어 있더라도, 해석 결과가 작업 디렉토리
            내부에 있으면 안전합니다.
          </p>
          <CodeBlock>
            <span className="kw">const</span> <span className="prop">workDir</span> = <span className="str">&quot;/home/user/project&quot;</span>;
            {"\n"}
            {"\n"}<span className="cm">{"// src/../lib/util.ts → /home/user/project/lib/util.ts (내부 → 안전)"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">r1</span> = <span className="fn">checkPath</span>(<span className="str">&quot;src/../lib/util.ts&quot;</span>, <span className="prop">workDir</span>);
            {"\n"}<span className="cm">{"// r1.safe === true"}</span>
            {"\n"}
            {"\n"}<span className="cm">{"// ../../etc/passwd → /home/etc/passwd (외부 → 차단)"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">r2</span> = <span className="fn">checkPath</span>(<span className="str">&quot;../../etc/passwd&quot;</span>, <span className="prop">workDir</span>);
            {"\n"}<span className="cm">{"// r2.safe === false"}</span>
          </CodeBlock>

          <DeepDive title="심볼릭 링크 탈출(Symlink Escape)이란?">
            <p className="mb-3">
              심볼릭 링크(Symbolic Link)는 다른 파일이나 디렉토리를 가리키는 바로가기입니다.
              공격자가 프로젝트 내에 <code className="text-cyan-600">/project/safe/link</code>라는 심볼릭 링크를 만들어
              실제로는 <code className="text-cyan-600">/home/user/.ssh/id_rsa</code>를 가리키게 하면,
              경로만으로는 안전해 보이지만 실제로는 민감한 파일에 접근하게 됩니다.
            </p>
            <p className="mb-3">
              이 모듈은 <code className="text-cyan-600">lstatSync()</code>로 파일이 심볼릭 링크인지 확인하고,
              <code className="text-cyan-600">realpathSync()</code>로 실제 대상 경로를 확인한 후,
              대상 경로가 민감한 파일을 가리키면 차단합니다.
            </p>
            <p className="text-amber-600">
              파일이 아직 존재하지 않거나 접근 불가능한 경우에는 심볼릭 링크 검사가 건너뛰어집니다.
              <code>try/catch</code>로 에러를 잡아 조용히 무시합니다.
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

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>5단계 검사 파이프라인</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">checkPath()</code>는 다섯 단계를 순서대로 실행하며,
            어느 단계에서든 위험이 발견되면 즉시 차단 결과를 반환합니다.
          </p>

          <MermaidDiagram
            title="checkPath() 5단계 검사 흐름"
            titleColor="purple"
            chart={`graph TD
  INPUT(("경로 입력")) --> S1["1단계: 경로 순회 검사<br/><small>../ 포함 시 resolve 후 범위 확인</small>"]
  S1 -->|"외부 탈출"| BLOCK1["차단: Path traversal detected"]
  S1 -->|"내부 또는 ../ 없음"| S2["2단계: 절대 경로 변환<br/><small>resolve(workDir, path)</small>"]
  S2 --> S3["3단계: 시스템 파일 검사<br/><small>SENSITIVE_SYSTEM_PATHS 비교</small>"]
  S3 -->|"매칭"| BLOCK2["차단: sensitive system file"]
  S3 -->|"통과"| S4["4단계: 홈 디렉토리 검사<br/><small>SENSITIVE_HOME_PATHS 비교</small>"]
  S4 -->|"매칭"| BLOCK3["차단: sensitive path blocked"]
  S4 -->|"통과"| S5["5단계: 심볼릭 링크 검사<br/><small>lstatSync + realpathSync</small>"]
  S5 -->|"민감한 대상"| BLOCK4["차단: Symlink escape detected"]
  S5 -->|"안전 또는 비존재"| SAFE["안전 판정<br/><small>safe: true</small>"]

  style INPUT fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style S1 fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style S3 fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style S4 fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style S5 fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style BLOCK1 fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style BLOCK2 fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style BLOCK3 fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style BLOCK4 fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style SAFE fill:#dcfce7,stroke:#10b981,color:#065f46`}
          />

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>핵심 코드 분석</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">checkPath()</code> 함수의 핵심 로직입니다.
            경로 순회부터 심볼릭 링크까지 5단계를 순서대로 검사합니다.
          </p>
          <CodeBlock>
            <span className="kw">export function</span> <span className="fn">checkPath</span>(<span className="prop">path</span>: <span className="type">string</span>, <span className="prop">workingDirectory</span>: <span className="type">string</span>): <span className="type">PathFilterResult</span> {"{"}
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">normalizedWorkDir</span> = <span className="fn">normalizePath</span>(<span className="fn">resolve</span>(<span className="prop">workingDirectory</span>));
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// [1] 경로 순회(Path Traversal) 탐지"}</span>
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">normalizedInput</span> = <span className="fn">normalizePath</span>(<span className="prop">path</span>);
            {"\n"}{"  "}<span className="kw">if</span> (<span className="prop">normalizedInput</span>.<span className="fn">includes</span>(<span className="str">&quot;../&quot;</span>)) {"{"}
            {"\n"}{"    "}<span className="kw">const</span> <span className="prop">resolved</span> = <span className="fn">normalizePath</span>(<span className="fn">resolve</span>(<span className="prop">workingDirectory</span>, <span className="prop">path</span>));
            {"\n"}{"    "}<span className="kw">if</span> (!<span className="prop">resolved</span>.<span className="fn">startsWith</span>(<span className="prop">normalizedWorkDir</span> + <span className="str">&quot;/&quot;</span>)) {"{"}
            {"\n"}{"      "}<span className="kw">return</span> {"{"} <span className="prop">safe</span>: <span className="num">false</span>, <span className="prop">reason</span>: <span className="str">`Path traversal detected`</span> {"}"};
            {"\n"}{"    "}{"}"}
            {"\n"}{"  "}{"}"}
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// [2] 절대 경로로 변환"}</span>
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">resolvedPath</span> = <span className="fn">normalizePath</span>(<span className="fn">resolve</span>(<span className="prop">workingDirectory</span>, <span className="prop">path</span>));
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// [3] 민감한 시스템 파일 접근 검사"}</span>
            {"\n"}{"  "}<span className="kw">for</span> (<span className="kw">const</span> <span className="prop">sensitive</span> <span className="kw">of</span> <span className="prop">SENSITIVE_SYSTEM_PATHS</span>) {"{"}
            {"\n"}{"    "}<span className="kw">if</span> (<span className="prop">resolvedPath</span> === <span className="prop">sensitive</span> || <span className="prop">resolvedPath</span>.<span className="fn">startsWith</span>(<span className="prop">sensitive</span> + <span className="str">&quot;/&quot;</span>)) {"{"}
            {"\n"}{"      "}<span className="kw">return</span> {"{"} <span className="prop">safe</span>: <span className="num">false</span>, <span className="prop">reason</span>: <span className="str">`Access to sensitive system file blocked`</span> {"}"};
            {"\n"}{"    "}{"}"}
            {"\n"}{"  "}{"}"}
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// [4] 민감한 홈 디렉토리 경로 접근 검사"}</span>
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">sensitiveMatch</span> = <span className="fn">checkSensitivePath</span>(<span className="prop">resolvedPath</span>);
            {"\n"}{"  "}<span className="kw">if</span> (<span className="prop">sensitiveMatch</span>) <span className="kw">return</span> {"{"} <span className="prop">safe</span>: <span className="num">false</span>, <span className="prop">reason</span>: <span className="prop">sensitiveMatch</span> {"}"};
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// [5] 심볼릭 링크 탈출 탐지"}</span>
            {"\n"}{"  "}<span className="kw">try</span> {"{"}
            {"\n"}{"    "}<span className="kw">const</span> <span className="prop">stat</span> = <span className="fn">lstatSync</span>(<span className="prop">resolvedPath</span>);
            {"\n"}{"    "}<span className="kw">if</span> (<span className="prop">stat</span>.<span className="fn">isSymbolicLink</span>()) {"{"}
            {"\n"}{"      "}<span className="kw">const</span> <span className="prop">realPath</span> = <span className="fn">normalizePath</span>(<span className="fn">realpathSync</span>(<span className="prop">resolvedPath</span>));
            {"\n"}{"      "}<span className="cm">{"// realPath를 시스템/홈 경로와 재검사..."}</span>
            {"\n"}{"    "}{"}"}
            {"\n"}{"  "}<span className="kw">{"}"} catch {"{"}</span> <span className="cm">{"/* 파일 미존재 시 건너뜀 */"}</span> {"}"}
            {"\n"}
            {"\n"}{"  "}<span className="kw">return</span> {"{"} <span className="prop">safe</span>: <span className="num">true</span> {"}"};
            {"\n"}{"}"}
          </CodeBlock>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
            <p><strong className="text-gray-900">[1]</strong> <code>../</code>가 포함된 경로를 <code className="text-cyan-600">resolve()</code>로 절대 경로로 변환한 후, 작업 디렉토리 내에 있는지 확인합니다. 작업 디렉토리 외부로 탈출하면 즉시 차단합니다.</p>
            <p><strong className="text-gray-900">[2]</strong> 모든 후속 검사에 사용할 절대 경로를 생성합니다. <code className="text-cyan-600">normalizePath()</code>로 슬래시를 통일합니다.</p>
            <p><strong className="text-gray-900">[3]</strong> <code>/etc/shadow</code>, <code>/etc/passwd</code> 등 시스템 파일과 정확히 일치하거나 해당 디렉토리 하위 파일인지 검사합니다.</p>
            <p><strong className="text-gray-900">[4]</strong> <code className="text-cyan-600">checkSensitivePath()</code> 헬퍼 함수를 호출하여 <code>HOME</code> 환경 변수 기준으로 민감한 홈 디렉토리 경로를 검사합니다.</p>
            <p><strong className="text-gray-900">[5]</strong> <code>lstatSync()</code>로 심볼릭 링크를 탐지하고, <code>realpathSync()</code>로 실제 대상을 확인한 후, 대상이 민감한 경로를 가리키면 차단합니다.</p>
          </div>

          <DeepDive title="checkSensitivePath() 헬퍼 함수">
            <p className="mb-3">
              <code className="text-cyan-600">checkSensitivePath()</code>는 절대 경로가 사용자 홈 디렉토리의
              민감한 경로에 해당하는지 검사하는 내부 헬퍼 함수입니다.
            </p>
            <CodeBlock>
              <span className="kw">function</span> <span className="fn">checkSensitivePath</span>(<span className="prop">resolvedPath</span>: <span className="type">string</span>): <span className="type">string | undefined</span> {"{"}
              {"\n"}{"  "}<span className="kw">const</span> <span className="prop">homeDir</span> = <span className="fn">normalizePath</span>(
              {"\n"}{"    "}<span className="prop">process</span>.<span className="prop">env</span>[<span className="str">&quot;HOME&quot;</span>] ?? <span className="prop">process</span>.<span className="prop">env</span>[<span className="str">&quot;USERPROFILE&quot;</span>] ?? <span className="str">&quot;&quot;</span>
              {"\n"}{"  "});
              {"\n"}
              {"\n"}{"  "}<span className="kw">for</span> (<span className="kw">const</span> <span className="prop">sensitive</span> <span className="kw">of</span> <span className="prop">SENSITIVE_HOME_PATHS</span>) {"{"}
              {"\n"}{"    "}<span className="kw">const</span> <span className="prop">fullPath</span> = <span className="prop">homeDir</span> + <span className="prop">sensitive</span>;
              {"\n"}{"    "}<span className="kw">if</span> (<span className="prop">resolvedPath</span> === <span className="prop">fullPath</span> || <span className="prop">resolvedPath</span>.<span className="fn">startsWith</span>(<span className="prop">fullPath</span> + <span className="str">&quot;/&quot;</span>)) {"{"}
              {"\n"}{"      "}<span className="kw">return</span> <span className="str">`Access to sensitive path blocked: ~${"{"}</span><span className="prop">sensitive</span><span className="str">{"}"}`</span>;
              {"\n"}{"    "}{"}"}
              {"\n"}{"  "}{"}"}
              {"\n"}{"  "}<span className="kw">return</span> <span className="num">undefined</span>;
              {"\n"}{"}"}
            </CodeBlock>
            <p className="mt-3 text-gray-600">
              Linux에서는 <code className="text-cyan-600">HOME</code>, Windows에서는 <code className="text-cyan-600">USERPROFILE</code>
              환경 변수를 사용합니다. 두 변수 모두 설정되지 않으면 <code className="text-cyan-600">undefined</code>를
              반환하여 홈 디렉토리 기반 검사를 건너뜁니다.
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

          {/* FAQ 1 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;프로젝트 내 .env 파일에 접근할 수 없어요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              <code className="text-cyan-600">~/.env</code>는 차단 대상이지만, 이것은 <strong>홈 디렉토리의</strong>
              <code>.env</code> 파일을 의미합니다. 프로젝트 루트의 <code>/project/.env</code>는
              홈 디렉토리가 아니므로 차단되지 않습니다.
            </p>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              만약 차단되었다면, 프로젝트 경로가 홈 디렉토리와 동일하게 설정되어 있지 않은지 확인하세요.
              <code className="text-cyan-600">result.reason</code>을 확인하면 정확한 이유를 알 수 있습니다.
            </p>
          </div>

          {/* FAQ 2 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;심볼릭 링크를 사용해야 하는데 차단돼요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              심볼릭 링크 자체가 차단되는 것이 아니라, 심볼릭 링크의 <strong>실제 대상</strong>이
              민감한 경로를 가리킬 때만 차단됩니다. 프로젝트 내부의 다른 디렉토리를 가리키는
              심볼릭 링크는 안전하게 허용됩니다.
            </p>
          </div>

          {/* FAQ 3 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;Windows에서 경로 검사가 올바르게 작동하나요?&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              네, <code className="text-cyan-600">normalizePath()</code>가 Windows의 백슬래시(<code>\</code>)를
              슬래시(<code>/</code>)로 변환합니다. 홈 디렉토리는 <code className="text-cyan-600">USERPROFILE</code>
              환경 변수에서 가져옵니다. 단, <code>/etc/shadow</code> 같은 Linux 전용 시스템 경로는
              Windows에서는 의미가 없습니다.
            </p>
          </div>

          {/* FAQ 4 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;민감한 경로 목록에 새 경로를 추가하고 싶어요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">SENSITIVE_SYSTEM_PATHS</code>와
              <code className="text-cyan-600">SENSITIVE_HOME_PATHS</code> 배열은 모듈 내부에 하드코딩되어 있습니다.
              새 경로를 추가하려면 소스 코드를 직접 수정해야 합니다.
              홈 디렉토리 경로는 <code className="text-cyan-600">&quot;/.경로&quot;</code> 형태로 추가하세요.
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
                name: "command-filter.ts",
                slug: "command-filter",
                relation: "sibling",
                desc: "위험한 쉘 명령어를 탐지하고 차단하는 명령어 필터 모듈",
              },
              {
                name: "injection-detector.ts",
                slug: "injection-detector",
                relation: "sibling",
                desc: "프롬프트 인젝션 공격을 탐지하여 AI의 안전을 보호하는 모듈",
              },
              {
                name: "secret-scanner.ts",
                slug: "secret-scanner",
                relation: "sibling",
                desc: "알려진 형식의 비밀 정보를 패턴 매칭으로 탐지하는 시크릿 스캐너",
              },
              {
                name: "tool-executor.ts",
                slug: "tool-executor",
                relation: "parent",
                desc: "파일 읽기/쓰기 도구 실행 전 경로 필터를 호출하여 안전 검사를 수행하는 도구 실행기",
              },
            ]}
          />
        </section>
      </RevealOnScroll>
    </div></div>
  );
}

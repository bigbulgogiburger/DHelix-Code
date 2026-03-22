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

export default function CommandFilterPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/guardrails/command-filter.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">Command Filter</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="infra" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              위험 명령어 필터 &mdash; 시스템을 파괴하거나 보안을 위협하는 쉘 명령어를 탐지하고
              차단하는 보안 모듈입니다.
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
                <code className="text-cyan-600">command-filter</code>는 AI가 쉘 명령어를 실행하기
                전에 해당 명령어의 안전성을 검사하는 보안 모듈입니다. 시스템을 복구 불가능하게
                손상시킬 수 있는 명령어는 즉시 차단하고, 주의가 필요하지만 합법적인 용도가 있는
                명령어는 경고를 표시합니다.
              </p>
              <p>
                위험도에 따라 두 단계로 분류합니다:
                <code className="text-red-600">&quot;block&quot;</code>(차단 &mdash; 실행하면
                시스템이 파괴될 수 있는 명령어)과
                <code className="text-amber-600">&quot;warn&quot;</code>(경고 &mdash; 주의가
                필요하지만 실행은 허용하는 명령어). 어떤 패턴에도 매칭되지 않으면{" "}
                <code className="text-emerald-600">&quot;info&quot;</code>(안전)로 판단합니다.
              </p>
              <p>
                차단 대상에는 루트 파일시스템 삭제(<code>rm -rf /</code>), 포크 폭탄, 리버스 쉘,
                원격 코드 실행(<code>curl | sh</code>) 등이 포함됩니다. 경고 대상에는 SQL DROP
                TABLE, <code>chmod 777</code>, Git force push 등이 포함됩니다.
              </p>
            </div>

            <MermaidDiagram
              title="Command Filter 아키텍처 위치"
              titleColor="purple"
              chart={`graph TD
  AGENT["Agent Loop<br/><small>agent-loop.ts</small>"]
  TOOL["Tool Executor<br/><small>Bash 도구 실행 요청</small>"]
  CF["Command Filter<br/><small>command-filter.ts</small>"]
  BLOCK_PATTERNS["BLOCK 패턴<br/><small>7가지 차단 규칙</small>"]
  WARN_PATTERNS["WARN 패턴<br/><small>10가지 경고 규칙</small>"]
  SHELL["Shell 실행<br/><small>실제 명령어 실행</small>"]

  AGENT --> TOOL
  TOOL -->|"명령어 검사"| CF
  CF --> BLOCK_PATTERNS
  CF --> WARN_PATTERNS
  BLOCK_PATTERNS -->|"차단"| TOOL
  WARN_PATTERNS -->|"경고 + 허용"| SHELL
  CF -->|"안전"| SHELL

  style CF fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style AGENT fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style TOOL fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style BLOCK_PATTERNS fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style WARN_PATTERNS fill:#fef3c7,stroke:#f59e0b,color:#92400e
  style SHELL fill:#dcfce7,stroke:#10b981,color:#065f46`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> 건물 경비원을 떠올리세요. 폭발물(rm -rf /, 포크 폭탄)을 가진
              사람은 즉시 출입을 차단하고, 칼(sudo rm, git force push)을 가진 사람은
              &quot;조심하세요&quot;라고 경고하며 통과시킵니다. 일반 방문객(npm install, ls 등)은
              자유롭게 통과합니다.
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

            {/* GuardrailResult interface */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface GuardrailResult
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              가드레일 검사 결과를 나타냅니다. 모든 보안 검사 함수가 공유하는 공통 인터페이스입니다.
              (<code className="text-cyan-600">guardrails/types.ts</code>에서 import)
            </p>
            <ParamTable
              params={[
                {
                  name: "passed",
                  type: "boolean",
                  required: true,
                  desc: "검사를 통과했는지 여부 (false면 실행 차단)",
                },
                {
                  name: "modified",
                  type: "string | undefined",
                  required: false,
                  desc: "수정된 출력 텍스트 (이 모듈에서는 사용하지 않음)",
                },
                {
                  name: "reason",
                  type: "string | undefined",
                  required: false,
                  desc: "차단 또는 경고의 이유를 설명하는 메시지",
                },
                {
                  name: "severity",
                  type: '"block" | "warn" | "info"',
                  required: true,
                  desc: "심각도 — block: 차단, warn: 경고, info: 안전",
                },
              ]}
            />

            {/* CommandPattern interface */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface CommandPattern
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              개별 명령어 검사 패턴을 정의합니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "regex",
                  type: "RegExp",
                  required: true,
                  desc: "위험한 명령어를 탐지하는 정규식 패턴",
                },
                {
                  name: "description",
                  type: "string",
                  required: true,
                  desc: "이 패턴이 탐지하는 위험의 설명 (영문, 로그에 사용)",
                },
              ]}
            />

            {/* checkCommand function */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              checkCommand(command)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              쉘 명령어의 안전성을 검사합니다. 차단 패턴에 매칭되면 실행을 거부하고, 경고 패턴에
              매칭되면 경고와 함께 실행을 허용합니다.
            </p>
            <CodeBlock>
              <span className="kw">export function</span> <span className="fn">checkCommand</span>(
              <span className="prop">command</span>: <span className="type">string</span>):{" "}
              <span className="type">GuardrailResult</span>
            </CodeBlock>
            <ParamTable
              params={[
                {
                  name: "command",
                  type: "string",
                  required: true,
                  desc: "검사할 쉘 명령어 문자열",
                },
              ]}
            />

            {/* 차단 패턴 목록 */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
              차단 패턴 (BLOCK_PATTERNS &mdash; 7가지)
            </h4>
            <div className="text-[13px] text-gray-600 mt-2 space-y-1">
              <p>
                &bull; <code className="text-red-600">rm -rf /</code> &mdash; 루트 파일시스템 재귀
                삭제
              </p>
              <p>
                &bull; <code className="text-red-600">&gt; /dev/sd*</code> &mdash; 디스크 장치에
                직접 쓰기
              </p>
              <p>
                &bull; <code className="text-red-600">mkfs</code> &mdash; 파일시스템 포맷 명령어
              </p>
              <p>
                &bull; <code className="text-red-600">dd if=</code> &mdash; 저수준 디스크 쓰기
              </p>
              <p>
                &bull; <code className="text-red-600">{":(){\u0020:|:&\u0020};:"}</code> &mdash;
                포크 폭탄(Fork Bomb)
              </p>
              <p>
                &bull; <code className="text-red-600">curl ... | sh</code> &mdash; 원격 스크립트
                실행
              </p>
              <p>
                &bull; <code className="text-red-600">nc -e /bin/sh</code> &mdash; 리버스 쉘(Reverse
                Shell)
              </p>
            </div>

            {/* 경고 패턴 목록 */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
              경고 패턴 (WARN_PATTERNS &mdash; 10가지)
            </h4>
            <div className="text-[13px] text-gray-600 mt-2 space-y-1">
              <p>
                &bull; <code className="text-amber-600">DROP TABLE</code> &mdash; SQL 테이블 삭제
              </p>
              <p>
                &bull; <code className="text-amber-600">DELETE FROM</code> &mdash; SQL 레코드 삭제
              </p>
              <p>
                &bull; <code className="text-amber-600">chmod 777</code> &mdash; 과도한 권한 부여
              </p>
              <p>
                &bull; <code className="text-amber-600">sudo rm</code> &mdash; 관리자 권한 파일 삭제
              </p>
              <p>
                &bull; <code className="text-amber-600">git push --force</code> &mdash; 원격
                히스토리 덮어쓰기
              </p>
              <p>
                &bull; <code className="text-amber-600">git push -f</code> &mdash; force push 단축
                옵션
              </p>
              <p>
                &bull; <code className="text-amber-600">git reset --hard</code> &mdash; 로컬
                변경사항 영구 삭제
              </p>
              <p>
                &bull; <code className="text-amber-600">npm publish</code> &mdash; 패키지 레지스트리
                게시
              </p>
              <p>
                &bull; <code className="text-amber-600">docker run --privileged</code> &mdash; 특권
                컨테이너 실행
              </p>
              <p>
                &bull; <code className="text-amber-600">eval / exec</code> &mdash; 변수 확장을 통한
                코드 실행
              </p>
            </div>

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                차단 패턴이 경고 패턴보다 먼저 검사됩니다. 하나의 명령어가 양쪽 모두에 매칭되면
                차단이 우선합니다.
              </li>
              <li>
                <code className="text-cyan-600">rm -rf /tmp</code>처럼 루트가 아닌 경로를 대상으로
                하는 명령어는 차단되지 않습니다. <code className="text-cyan-600">/(?!\w)</code>{" "}
                조건으로 구분합니다.
              </li>
              <li>
                <code className="text-cyan-600">git push --force-with-lease</code>는 안전한 변형으로
                간주되어 경고 대상에서 제외됩니다. <code className="text-cyan-600">(?!-)</code>{" "}
                조건으로 구분합니다.
              </li>
              <li>
                패턴 목록은 모듈 내부에 하드코딩되어 있습니다. 새로운 위험 명령어를 추가하려면 소스
                코드를 직접 수정해야 합니다.
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
              기본 사용법 &mdash; 명령어 실행 전 안전 검사
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              Bash 도구가 명령어를 실행하기 전에{" "}
              <code className="text-cyan-600">checkCommand()</code>로 안전성을 검사합니다.
            </p>
            <CodeBlock>
              <span className="kw">import</span> {"{"} <span className="fn">checkCommand</span>{" "}
              {"}"} <span className="kw">from</span>{" "}
              <span className="str">&quot;./guardrails/command-filter.js&quot;</span>;{"\n"}
              {"\n"}
              <span className="cm">{"// 위험한 명령어 → 차단"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">result1</span> ={" "}
              <span className="fn">checkCommand</span>(
              <span className="str">&quot;rm -rf /&quot;</span>);
              {"\n"}
              <span className="cm">{"// result1.passed === false"}</span>
              {"\n"}
              <span className="cm">{'// result1.severity === "block"'}</span>
              {"\n"}
              <span className="cm">
                {
                  '// result1.reason === "Blocked dangerous command: Recursive delete of root filesystem"'
                }
              </span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// 경고 대상 명령어 → 경고 + 허용"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">result2</span> ={" "}
              <span className="fn">checkCommand</span>(
              <span className="str">&quot;git push --force origin main&quot;</span>);
              {"\n"}
              <span className="cm">{"// result2.passed === true"}</span>
              {"\n"}
              <span className="cm">{'// result2.severity === "warn"'}</span>
              {"\n"}
              <span className="cm">{'// result2.reason === "Warning: Git force push"'}</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// 안전한 명령어 → 통과"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">result3</span> ={" "}
              <span className="fn">checkCommand</span>(
              <span className="str">&quot;npm install express&quot;</span>);
              {"\n"}
              <span className="cm">{"// result3.passed === true"}</span>
              {"\n"}
              <span className="cm">{'// result3.severity === "info"'}</span>
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> <code>checkCommand()</code>는 정규식 기반 검사입니다. 명령어를
              난독화하거나 변수 치환을 통해 우회할 수 있으므로, 이 검사만으로 완전한 보안을 보장하지
              않습니다. 권한 시스템과 함께 사용하세요.
            </Callout>

            {/* 고급: 결과에 따른 분기 처리 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; severity에 따른 분기 처리
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              실제 도구 실행기에서는 <code className="text-cyan-600">severity</code>에 따라 다른
              동작을 수행합니다.
            </p>
            <CodeBlock>
              <span className="kw">const</span> <span className="prop">result</span> ={" "}
              <span className="fn">checkCommand</span>(<span className="prop">command</span>);
              {"\n"}
              {"\n"}
              <span className="kw">switch</span> (<span className="prop">result</span>.
              <span className="prop">severity</span>) {"{"}
              {"\n"}
              {"  "}
              <span className="kw">case</span> <span className="str">&quot;block&quot;</span>:{"\n"}
              {"    "}
              <span className="cm">{"// 실행 거부 — 사용자에게 차단 이유 표시"}</span>
              {"\n"}
              {"    "}
              <span className="kw">throw new</span> <span className="type">Error</span>(
              <span className="prop">result</span>.<span className="prop">reason</span>);
              {"\n"}
              {"  "}
              <span className="kw">case</span> <span className="str">&quot;warn&quot;</span>:{"\n"}
              {"    "}
              <span className="cm">{"// 사용자에게 경고 표시 후 실행 허용"}</span>
              {"\n"}
              {"    "}
              <span className="fn">logger</span>.<span className="fn">warn</span>(
              <span className="prop">result</span>.<span className="prop">reason</span>);
              {"\n"}
              {"    "}
              <span className="kw">await</span> <span className="fn">executeShell</span>(
              <span className="prop">command</span>);
              {"\n"}
              {"    "}
              <span className="kw">break</span>;{"\n"}
              {"  "}
              <span className="kw">case</span> <span className="str">&quot;info&quot;</span>:{"\n"}
              {"    "}
              <span className="cm">{"// 안전 — 바로 실행"}</span>
              {"\n"}
              {"    "}
              <span className="kw">await</span> <span className="fn">executeShell</span>(
              <span className="prop">command</span>);
              {"\n"}
              {"    "}
              <span className="kw">break</span>;{"\n"}
              {"}"}
            </CodeBlock>

            <DeepDive title="포크 폭탄(Fork Bomb)이란?">
              <p className="mb-3">
                <code className="text-cyan-600">{":(){\u0020:|:&\u0020};:"}</code>는 포크 폭탄(Fork
                Bomb)이라 불리는 공격입니다. 이 코드는 함수 <code>:</code>를 정의한 후, 자기 자신을
                재귀적으로 호출하면서 백그라운드로 파이프합니다.
              </p>
              <p className="mb-3">
                분해하면: <code>:()</code> 함수 정의, <code>{"{\u0020:|:&\u0020}"}</code> 자기
                자신을 파이프하며 백그라운드 실행, <code>;:</code> 함수 호출. 프로세스가
                기하급수적으로 증가하여 시스템의 모든 리소스를 소진시킵니다.
              </p>
              <p className="text-amber-600">
                한 번 실행되면 시스템을 재부팅하지 않는 한 복구가 거의 불가능합니다. 이것이 이
                패턴이 즉시 차단(block)되는 이유입니다.
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
              검사 흐름 다이어그램
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">checkCommand()</code>는 두 단계를 순서대로 검사합니다.
              차단 패턴을 먼저 검사하여 가장 위험한 명령어를 빠르게 걸러냅니다.
            </p>

            <MermaidDiagram
              title="checkCommand() 검사 흐름"
              titleColor="purple"
              chart={`graph TD
  INPUT(("명령어 입력")) --> STEP1["1단계: BLOCK 패턴 검사<br/><small>7가지 차단 규칙 순회</small>"]
  STEP1 -->|"매칭됨"| BLOCK["차단 결과 반환<br/><small>passed: false, severity: block</small>"]
  STEP1 -->|"매칭 없음"| STEP2["2단계: WARN 패턴 검사<br/><small>10가지 경고 규칙 순회</small>"]
  STEP2 -->|"매칭됨"| WARN["경고 결과 반환<br/><small>passed: true, severity: warn</small>"]
  STEP2 -->|"매칭 없음"| SAFE["안전 판정<br/><small>passed: true, severity: info</small>"]

  style INPUT fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style STEP1 fill:#fee2e2,stroke:#ef4444,color:#991b1b,stroke-width:2px
  style STEP2 fill:#fef3c7,stroke:#f59e0b,color:#92400e,stroke-width:2px
  style BLOCK fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style WARN fill:#fef3c7,stroke:#f59e0b,color:#92400e
  style SAFE fill:#dcfce7,stroke:#10b981,color:#065f46`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              핵심 코드 분석
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">checkCommand()</code> 함수의 전체 로직입니다. 간결한
              2단계 구조로, 차단과 경고를 순서대로 검사합니다.
            </p>
            <CodeBlock>
              <span className="kw">export function</span> <span className="fn">checkCommand</span>(
              <span className="prop">command</span>: <span className="type">string</span>):{" "}
              <span className="type">GuardrailResult</span> {"{"}
              {"\n"}
              {"  "}
              <span className="cm">{"// [1] 차단 패턴 검사 — 매칭되면 즉시 실행 거부"}</span>
              {"\n"}
              {"  "}
              <span className="kw">for</span> (<span className="kw">const</span> {"{"}{" "}
              <span className="prop">regex</span>, <span className="prop">description</span> {"}"}{" "}
              <span className="kw">of</span> <span className="prop">BLOCK_PATTERNS</span>) {"{"}
              {"\n"}
              {"    "}
              <span className="kw">if</span> (<span className="prop">regex</span>.
              <span className="fn">test</span>(<span className="prop">command</span>)) {"{"}
              {"\n"}
              {"      "}
              <span className="kw">return</span> {"{"}
              {"\n"}
              {"        "}
              <span className="prop">passed</span>: <span className="num">false</span>,{"\n"}
              {"        "}
              <span className="prop">reason</span>:{" "}
              <span className="str">`Blocked dangerous command: ${"{"}</span>
              <span className="prop">description</span>
              <span className="str">{"}"}`</span>,{"\n"}
              {"        "}
              <span className="prop">severity</span>: <span className="str">&quot;block&quot;</span>
              ,{"\n"}
              {"      "}
              {"}"};{"\n"}
              {"    "}
              {"}"}
              {"\n"}
              {"  "}
              {"}"}
              {"\n"}
              {"\n"}
              {"  "}
              <span className="cm">{"// [2] 경고 패턴 검사 — 매칭되면 경고 + 실행 허용"}</span>
              {"\n"}
              {"  "}
              <span className="kw">for</span> (<span className="kw">const</span> {"{"}{" "}
              <span className="prop">regex</span>, <span className="prop">description</span> {"}"}{" "}
              <span className="kw">of</span> <span className="prop">WARN_PATTERNS</span>) {"{"}
              {"\n"}
              {"    "}
              <span className="kw">if</span> (<span className="prop">regex</span>.
              <span className="fn">test</span>(<span className="prop">command</span>)) {"{"}
              {"\n"}
              {"      "}
              <span className="kw">return</span> {"{"}
              {"\n"}
              {"        "}
              <span className="prop">passed</span>: <span className="num">true</span>,{"\n"}
              {"        "}
              <span className="prop">reason</span>: <span className="str">`Warning: ${"{"}</span>
              <span className="prop">description</span>
              <span className="str">{"}"}`</span>,{"\n"}
              {"        "}
              <span className="prop">severity</span>: <span className="str">&quot;warn&quot;</span>,
              {"\n"}
              {"      "}
              {"}"};{"\n"}
              {"    "}
              {"}"}
              {"\n"}
              {"  "}
              {"}"}
              {"\n"}
              {"\n"}
              {"  "}
              <span className="cm">{"// [3] 안전 — 모든 패턴 통과"}</span>
              {"\n"}
              {"  "}
              <span className="kw">return</span> {"{"} <span className="prop">passed</span>:{" "}
              <span className="num">true</span>, <span className="prop">severity</span>:{" "}
              <span className="str">&quot;info&quot;</span> {"}"};{"\n"}
              {"}"}
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">[1]</strong> 차단(BLOCK) 패턴을 먼저 검사합니다.
                시스템을 복구 불가능하게 손상시킬 수 있는 명령어를 빠르게 걸러내기 위해 높은
                우선순위를 가집니다. <code className="text-cyan-600">passed: false</code>를 반환하여
                실행을 거부합니다.
              </p>
              <p>
                <strong className="text-gray-900">[2]</strong> 경고(WARN) 패턴을 검사합니다.
                합법적인 용도가 있지만 주의가 필요한 명령어입니다.{" "}
                <code className="text-cyan-600">passed: true</code>를 반환하므로 실행은 허용되지만,{" "}
                <code className="text-cyan-600">reason</code>에 경고 메시지가 포함됩니다.
              </p>
              <p>
                <strong className="text-gray-900">[3]</strong> 어떤 패턴에도 매칭되지 않으면 안전한
                명령어로 판단하고 <code className="text-cyan-600">severity: &quot;info&quot;</code>
                를 반환합니다.
              </p>
            </div>

            <DeepDive title="정규식 패턴의 세밀한 제어">
              <p className="mb-3">
                몇몇 패턴은 오탐을 줄이기 위해 세밀한 정규식 조건을 사용합니다:
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-gray-600">
                <li>
                  <code className="text-cyan-600">rm -rf /(?!\w)</code> &mdash; <code>/</code> 뒤에
                  영문자가 없어야 매칭.
                  <code>rm -rf /tmp</code>는 허용되지만 <code>rm -rf /</code>는 차단됩니다.
                </li>
                <li>
                  <code className="text-cyan-600">--force(?!-)</code> &mdash; <code>--force</code>{" "}
                  뒤에 하이픈이 없어야 매칭.
                  <code>--force-with-lease</code>는 안전한 변형으로 허용됩니다.
                </li>
                <li>
                  <code className="text-cyan-600">-f(?:\s|$)</code> &mdash; <code>-f</code> 뒤에
                  공백이나 문자열 끝이 와야 매칭.
                  <code>-fast</code> 같은 다른 옵션과 구별됩니다.
                </li>
              </ul>
            </DeepDive>
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
                &quot;rm -rf ./build/ 명령어가 차단됐어요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                <code className="text-cyan-600">rm -rf /</code> 패턴은 슬래시 뒤에 영문자가{" "}
                <strong>없는</strong> 경우만 차단합니다. <code>rm -rf ./build/</code>는 상대
                경로이므로 차단되지 않아야 합니다.
              </p>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                만약 차단되었다면, 명령어에 <code>rm -rf /</code> 패턴이 부분 매칭된 것은 아닌지
                확인하세요.
                <code className="text-cyan-600">result.reason</code> 필드에 정확한 차단 이유가
                표시됩니다.
              </p>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;curl로 파일을 다운로드만 하려는데 차단돼요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">curl URL | sh</code> 패턴만 차단됩니다.
                <code>curl -O https://example.com/file.zip</code>처럼 파이프(<code>|</code>) 없이
                쉘에 전달하지 않는 curl 명령어는 안전하게 통과합니다.
              </p>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;git push --force-with-lease도 경고가 떠요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">--force-with-lease</code>는{" "}
                <code className="text-cyan-600">(?!-)</code>
                부정 전방 탐색에 의해 경고 대상에서 제외됩니다. 경고가 발생한다면 명령어에{" "}
                <code>--force</code>가 별도로 포함되어 있지 않은지 확인하세요.
              </p>
            </div>

            {/* FAQ 4 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;명령어를 변수로 감싸면 우회되나요?&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                네, <code className="text-cyan-600">checkCommand()</code>는 전달된 문자열을 그대로
                정규식으로 검사합니다. <code>$CMD</code> 같은 변수나 <code>$(cat script.sh)</code>{" "}
                같은 명령어 치환은 탐지하지 못합니다. 이것이{" "}
                <code className="text-cyan-600">eval</code>과{" "}
                <code className="text-cyan-600">exec</code>
                경고 패턴이 존재하는 이유입니다.
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
                  name: "path-filter.ts",
                  slug: "path-filter",
                  relation: "sibling",
                  desc: "파일 경로의 안전성을 검사하여 민감한 시스템 파일 접근을 차단하는 모듈",
                },
                {
                  name: "injection-detector.ts",
                  slug: "injection-detector",
                  relation: "sibling",
                  desc: "프롬프트 인젝션 공격을 탐지하여 AI의 안전을 보호하는 모듈",
                },
                {
                  name: "permission-manager.ts",
                  slug: "permission-manager",
                  relation: "sibling",
                  desc: "5가지 권한 모드로 도구 실행을 제어하는 권한 관리 모듈",
                },
                {
                  name: "tool-executor.ts",
                  slug: "tool-executor",
                  relation: "parent",
                  desc: "명령어 필터를 호출하여 Bash 도구 실행 전 안전 검사를 수행하는 도구 실행기",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}

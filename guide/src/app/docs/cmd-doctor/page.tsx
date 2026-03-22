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

export default function CmdDoctorPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/commands/doctor.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">/doctor</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="leaf" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              dbcode 실행 환경의 12가지 항목을 자동 점검하는 환경 진단 명령어입니다.
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
                <code className="text-cyan-600">/doctor</code>는 dbcode가 제대로 동작하지 않을 때
                원인을 빠르게 진단하기 위한 명령어입니다. Node.js 버전, Git 설치 상태, 모델 설정,
                API 키, 디스크 공간, 설정 디렉토리 권한, 구문 하이라이터, LLM 연결, 메모리 사용량,
                토큰 캐시, 세션 잠금 등 총 12가지 항목을 순차적으로 점검합니다.
              </p>
              <p>
                각 항목은 <code className="text-emerald-600">ok</code>(정상),
                <code className="text-amber-600">warn</code>(경고),
                <code className="text-red-600">fail</code>(실패) 세 가지 상태로 표시되며, 문제가
                있는 항목에는 구체적인 해결 방법(Fix)을 안내합니다.
              </p>
              <p>
                모든 점검이 완료되면 통과/경고/실패 카운트를 요약하고, 하나라도{" "}
                <code className="text-red-600">fail</code>이 있으면
                <code className="text-cyan-600">success: false</code>를 반환합니다.
              </p>
            </div>

            <MermaidDiagram
              title="/doctor 아키텍처 위치"
              titleColor="purple"
              chart={`graph TD
  USER["사용자 입력<br/><small>/doctor</small>"]
  REG["Command Registry<br/><small>registry.ts</small>"]
  DOC["doctorCommand<br/><small>doctor.ts</small>"]
  ENV["환경 점검 12항목"]
  TOKEN["Token Cache<br/><small>token-counter.ts</small>"]
  FS["파일시스템<br/><small>~/.dbcode, git, df</small>"]
  NET["네트워크<br/><small>LLM API fetch</small>"]

  USER -->|"슬래시 명령"| REG
  REG -->|"execute()"| DOC
  DOC --> ENV
  ENV --> TOKEN
  ENV --> FS
  ENV --> NET

  style DOC fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style REG fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style ENV fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style TOKEN fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style FS fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style NET fill:#e0e7ff,stroke:#64748b,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> 병원의 종합 건강검진을 떠올리세요. 혈압, 시력, 혈액 검사 등
              여러 항목을 한 번에 체크하듯, <code>/doctor</code>는 dbcode의 &quot;건강 상태&quot;를
              12가지 관점에서 한 번에 확인합니다.
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

            {/* DiagnosticCheck interface */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface DiagnosticCheck
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              각 진단 항목의 점검 결과를 담는 인터페이스입니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "name",
                  type: "string",
                  required: true,
                  desc: '점검 항목 이름 (예: "Node.js", "Git", "API key")',
                },
                {
                  name: "status",
                  type: '"ok" | "warn" | "fail"',
                  required: true,
                  desc: "점검 결과 상태 (ok=정상, warn=경고, fail=실패)",
                },
                {
                  name: "detail",
                  type: "string",
                  required: true,
                  desc: '상세 설명 (예: "v20.11.0 (>=20 required)")',
                },
                {
                  name: "fix",
                  type: "string | undefined",
                  required: false,
                  desc: "문제 해결 방법 (정상일 때는 undefined)",
                },
              ]}
            />

            {/* doctorCommand */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              doctorCommand: SlashCommand
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">/doctor</code> 슬래시 명령어의 정의 객체입니다. 인자
              없이 실행되며, 12가지 진단 항목을 순차적으로 점검합니다.
            </p>
            <CodeBlock>
              <span className="kw">export const</span> <span className="prop">doctorCommand</span>:{" "}
              <span className="type">SlashCommand</span> = {"{"}
              {"\n"}
              {"  "}
              <span className="prop">name</span>: <span className="str">&quot;doctor&quot;</span>,
              {"\n"}
              {"  "}
              <span className="prop">description</span>:{" "}
              <span className="str">&quot;Run diagnostic checks&quot;</span>,{"\n"}
              {"  "}
              <span className="prop">usage</span>: <span className="str">&quot;/doctor&quot;</span>,
              {"\n"}
              {"  "}
              <span className="fn">execute</span>: <span className="kw">async</span> (
              <span className="prop">_args</span>, <span className="prop">context</span>) =&gt;{" "}
              {"{ ... }"}
              {"\n"}
              {"}"}
            </CodeBlock>

            {/* formatBytes */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              formatBytes(bytes)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              바이트 수를 사람이 읽기 쉬운 형식으로 변환합니다. 메모리 사용량 표시에 사용됩니다.
            </p>
            <CodeBlock>
              <span className="fn">formatBytes</span>(<span className="prop">bytes</span>:{" "}
              <span className="type">number</span>): <span className="type">string</span>
              {"\n"}
              <span className="cm">
                // 512 &rarr; &quot;512 B&quot;, 1536 &rarr; &quot;1.5 KB&quot;, 268435456 &rarr;
                &quot;256.0 MB&quot;
              </span>
            </CodeBlock>
            <ParamTable
              params={[{ name: "bytes", type: "number", required: true, desc: "변환할 바이트 수" }]}
            />

            {/* 12가지 점검 항목 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              12가지 점검 항목
            </h3>
            <div className="bg-white border border-gray-200 rounded-xl p-5 text-[13px] text-gray-600 space-y-2">
              <p>
                <strong className="text-gray-900">1. Node.js</strong> &mdash; 버전 20 이상 필요.
                미달 시 fail
              </p>
              <p>
                <strong className="text-gray-900">2. Git</strong> &mdash; PATH에서 git 실행 가능
                여부. 미설치 시 fail
              </p>
              <p>
                <strong className="text-gray-900">3. Git repo</strong> &mdash; 작업 디렉토리가 git
                저장소인지. 아니면 warn
              </p>
              <p>
                <strong className="text-gray-900">4. Model</strong> &mdash; context.model 설정 여부.
                없으면 fail
              </p>
              <p>
                <strong className="text-gray-900">5. API key</strong> &mdash;
                OPENAI/DBCODE/ANTHROPIC API 키 존재 여부. 없으면 warn
              </p>
              <p>
                <strong className="text-gray-900">6. Disk space</strong> &mdash;{" "}
                <code>df -h .</code>로 여유 공간 확인
              </p>
              <p>
                <strong className="text-gray-900">7. Config directory</strong> &mdash; ~/.dbcode
                디렉토리 존재 및 쓰기 권한
              </p>
              <p>
                <strong className="text-gray-900">8. Syntax highlighter</strong> &mdash; Shiki
                라이브러리 로드 가능 여부
              </p>
              <p>
                <strong className="text-gray-900">9. LLM connectivity</strong> &mdash; API
                엔드포인트 연결 테스트 (5초 타임아웃)
              </p>
              <p>
                <strong className="text-gray-900">10. Memory usage</strong> &mdash; RSS &gt; 512MB
                또는 Heap &gt; 90% 시 warn
              </p>
              <p>
                <strong className="text-gray-900">11. Token cache</strong> &mdash; 캐시 크기, 히트율
                표시
              </p>
              <p>
                <strong className="text-gray-900">12. Session lock</strong> &mdash; 세션 잠금 파일
                나이 확인. 30분 초과 시 stale warn
              </p>
            </div>

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                LLM 연결 테스트는 <code className="text-cyan-600">AbortController</code>로 5초
                타임아웃이 적용됩니다. 네트워크가 느린 환경에서는 타임아웃으로 인해 warn이 표시될 수
                있습니다.
              </li>
              <li>
                디스크 공간 점검은 <code className="text-cyan-600">df -h .</code> 명령어를
                사용하므로 Windows 환경에서는 정상 작동하지 않을 수 있습니다.
              </li>
              <li>
                <code className="text-cyan-600">success: false</code>는 하나라도
                <code className="text-red-600">fail</code>이 있을 때만 반환됩니다. warn은 성공으로
                처리됩니다.
              </li>
              <li>
                세션 잠금 점검은 <code className="text-cyan-600">context.sessionId</code>가 없으면
                &quot;No active session&quot;으로 ok를 반환합니다.
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
              기본 사용법
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              인자 없이 <code className="text-cyan-600">/doctor</code>를 입력하면 즉시 12가지 진단이
              실행됩니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 터미널에서 입력"}</span>
              {"\n"}
              <span className="str">/doctor</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// 출력 예시"}</span>
              {"\n"}
              <span className="prop">dbcode Doctor</span>
              {"\n"}
              <span className="prop">=============</span>
              {"\n"}
              {"\n"}
              {"  "}
              <span className="str">✓</span> <span className="prop">Node.js</span>: v20.11.0 ({">="}
              20 required)
              {"\n"}
              {"  "}
              <span className="str">✓</span> <span className="prop">Git</span>: 2.43.0
              {"\n"}
              {"  "}
              <span className="str">✓</span> <span className="prop">Git repo</span>:
              /Users/dev/my-project
              {"\n"}
              {"  "}
              <span className="str">✓</span> <span className="prop">Model</span>: gpt-4o
              {"\n"}
              {"  "}
              <span className="str">✓</span> <span className="prop">API key</span>: configured
              {"\n"}
              {"  "}
              <span className="str">✓</span> <span className="prop">Disk space</span>: 128Gi free
              {"\n"}
              {"  "}
              <span className="str">✓</span> <span className="prop">Config directory</span>:
              ~/.dbcode (writable)
              {"\n"}
              {"  "}
              <span className="str">✓</span> <span className="prop">Syntax highlighter</span>: Shiki
              available
              {"\n"}
              {"  "}
              <span className="str">✓</span> <span className="prop">LLM connectivity</span>:
              https://api.openai.com/v1 reachable
              {"\n"}
              {"  "}
              <span className="str">✓</span> <span className="prop">Memory usage</span>: RSS: 85.2
              MB, Heap: 42.1/64.0 MB (66%)
              {"\n"}
              {"  "}
              <span className="str">✓</span> <span className="prop">Token cache</span>: 15 entries,
              78.3% hit rate
              {"\n"}
              {"  "}
              <span className="str">✓</span> <span className="prop">Session lock</span>: Active (2m
              old)
              {"\n"}
              {"\n"}
              <span className="prop">12/12 checks passed</span>
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> LLM 연결 테스트는 실제 API 호출(<code>GET /models</code>)을
              수행합니다. API 키가 없으면 연결 테스트를 건너뛰고, 키가 유효하지 않으면 HTTP 상태
              코드와 함께 warn이 표시됩니다.
            </Callout>

            {/* 문제 진단 사용법 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 문제 진단 시나리오
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              문제가 발견되면 <code className="text-cyan-600">Fix:</code> 줄에 해결 방법이
              표시됩니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 문제가 있는 출력 예시"}</span>
              {"\n"}
              <span className="prop">dbcode Doctor</span>
              {"\n"}
              <span className="prop">=============</span>
              {"\n"}
              {"\n"}
              {"  "}
              <span className="str">✗</span> <span className="prop">Node.js</span>: v18.17.0
              (UPGRADE NEEDED: {">="}20)
              {"\n"}
              {"    "}
              <span className="cm">Fix: Install Node.js 20+ from https://nodejs.org</span>
              {"\n"}
              {"  "}
              <span className="str">✓</span> <span className="prop">Git</span>: 2.43.0
              {"\n"}
              {"  "}
              <span className="str">⚠</span> <span className="prop">API key</span>: No API key
              found
              {"\n"}
              {"    "}
              <span className="cm">
                Fix: Set OPENAI_API_KEY, DBCODE_API_KEY, or ANTHROPIC_API_KEY
              </span>
              {"\n"}
              {"  "}
              <span className="str">⚠</span> <span className="prop">Memory usage</span>: RSS: 612.3
              MB, Heap: ...
              {"\n"}
              {"    "}
              <span className="cm">Fix: Consider restarting dbcode to free memory</span>
              {"\n"}
              {"\n"}
              <span className="prop">9/12 checks passed, 2 warnings, 1 failure</span>
            </CodeBlock>

            <Callout type="tip" icon="*">
              <strong>팁:</strong> <code>/doctor</code>의 결과를 <code>/export</code>로 내보내면
              팀원이나 이슈 리포트에 환경 정보를 쉽게 공유할 수 있습니다.
            </Callout>

            <DeepDive title="LLM 연결 테스트 상세">
              <p className="mb-3">LLM 연결 테스트는 다음 순서로 동작합니다:</p>
              <ul className="list-disc list-inside space-y-1.5 text-gray-600">
                <li>API 키 존재 여부 확인 (없으면 &quot;Skipped&quot;)</li>
                <li>
                  <code className="text-cyan-600">OPENAI_BASE_URL</code> 또는 기본 엔드포인트로{" "}
                  <code>GET /models</code> 요청
                </li>
                <li>
                  <code className="text-cyan-600">AbortController</code>로 5초 타임아웃 적용
                </li>
                <li>HTTP 200이면 ok, 그 외 상태 코드면 warn</li>
                <li>타임아웃 시 &quot;Connection timed out (5s)&quot; warn</li>
              </ul>
              <p className="mt-3 text-amber-600">
                로컬 LLM 서버를 사용하는 경우 <code>OPENAI_BASE_URL</code>을 설정해야 올바른
                엔드포인트로 연결 테스트가 수행됩니다.
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
              진단 실행 흐름
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              12가지 점검은 순차적으로 실행되며, 각 점검은 독립적으로 try-catch로 감싸져 있어 하나가
              실패해도 나머지 점검이 계속 진행됩니다.
            </p>

            <MermaidDiagram
              title="/doctor 실행 흐름"
              titleColor="purple"
              chart={`graph TD
  START(("시작")) --> N["1. Node.js 버전"]
  N --> G["2. Git 설치"]
  G --> GR["3. Git repo"]
  GR --> M["4. 모델 설정"]
  M --> K["5. API 키"]
  K --> D["6. 디스크 공간"]
  D --> C["7. Config 디렉토리"]
  C --> S["8. Shiki"]
  S --> L["9. LLM 연결"]
  L --> MEM["10. 메모리"]
  MEM --> TC["11. 토큰 캐시"]
  TC --> SL["12. 세션 잠금"]
  SL --> FMT["결과 포맷팅"]
  FMT --> RES["ok/warn/fail 카운트 요약"]
  RES --> END(("종료"))

  style START fill:#dcfce7,stroke:#10b981,color:#065f46
  style FMT fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style RES fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style END fill:#fee2e2,stroke:#ef4444,color:#991b1b`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              핵심 코드 분석
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              결과 출력 포맷팅과 성공/실패 판정 로직입니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 상태별 기호 매핑"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">statusSymbol</span> = {"{"}
              {"\n"}
              {"  "}
              <span className="prop">ok</span>: <span className="str">&quot;✓&quot;</span>,{"\n"}
              {"  "}
              <span className="prop">warn</span>: <span className="str">&quot;⚠&quot;</span>,{"\n"}
              {"  "}
              <span className="prop">fail</span>: <span className="str">&quot;✗&quot;</span>,{"\n"}
              {"}"};{"\n"}
              {"\n"}
              <span className="cm">{"// 각 항목 출력 — fix가 있으면 해결 방법도 표시"}</span>
              {"\n"}
              <span className="kw">for</span> (<span className="kw">const</span>{" "}
              <span className="prop">check</span> <span className="kw">of</span>{" "}
              <span className="prop">checks</span>) {"{"}
              {"\n"}
              {"  "}
              <span className="prop">lines</span>.<span className="fn">push</span>(
              <span className="str">
                {"`  ${statusSymbol[check.status]} ${check.name}: ${check.detail}`"}
              </span>
              );
              {"\n"}
              {"  "}
              <span className="kw">if</span> (<span className="prop">check</span>.
              <span className="prop">fix</span>) {"{"}
              {"\n"}
              {"    "}
              <span className="prop">lines</span>.<span className="fn">push</span>(
              <span className="str">{"`    Fix: ${check.fix}`"}</span>);
              {"\n"}
              {"  "}
              {"}"}
              {"\n"}
              {"}"}
              {"\n"}
              {"\n"}
              <span className="cm">{"// 최종 판정: fail이 하나라도 있으면 success: false"}</span>
              {"\n"}
              <span className="kw">return</span> {"{"}
              {"\n"}
              {"  "}
              <span className="prop">output</span>: <span className="prop">lines</span>.
              <span className="fn">join</span>(<span className="str">&quot;\n&quot;</span>),
              {"\n"}
              {"  "}
              <span className="prop">success</span>: <span className="prop">checks</span>.
              <span className="fn">every</span>(<span className="prop">c</span> =&gt;{" "}
              <span className="prop">c</span>.<span className="prop">status</span> !=={" "}
              <span className="str">&quot;fail&quot;</span>),
              {"\n"}
              {"}"};
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">ok/warn/fail 3단계 시스템:</strong> ok는 정상,
                warn은 동작에 문제는 없지만 주의가 필요, fail은 dbcode 실행에 지장이 있는 심각한
                문제입니다.
              </p>
              <p>
                <strong className="text-gray-900">success 판정 기준:</strong>{" "}
                <code className="text-cyan-600">
                  checks.every(c =&gt; c.status !== &quot;fail&quot;)
                </code>{" "}
                &mdash; warn은 무시하고 fail만 체크합니다.
              </p>
              <p>
                <strong className="text-gray-900">독립적 try-catch:</strong> 각 점검 항목이 개별
                try-catch로 감싸져 있어 하나의 점검이 예외를 던져도 나머지 항목은 정상 실행됩니다.
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
                &quot;LLM connectivity가 warn으로 나와요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                세 가지 원인이 있을 수 있습니다:
              </p>
              <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
                <li>
                  <strong>API 키 미설정:</strong>{" "}
                  <code className="text-cyan-600">OPENAI_API_KEY</code>,
                  <code className="text-cyan-600">DBCODE_API_KEY</code>, 또는
                  <code className="text-cyan-600">ANTHROPIC_API_KEY</code> 환경변수를 확인하세요.
                </li>
                <li>
                  <strong>네트워크 타임아웃:</strong> 5초 내에 응답이 오지 않으면 타임아웃됩니다.
                  VPN이나 프록시 설정을 확인하세요.
                </li>
                <li>
                  <strong>잘못된 엔드포인트:</strong> 로컬 LLM 사용 시{" "}
                  <code className="text-cyan-600">OPENAI_BASE_URL</code>이 올바르게 설정되어 있는지
                  확인하세요.
                </li>
              </ul>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;Memory usage가 warn인데 어떻게 하나요?&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                RSS가 512MB를 넘거나 힙 사용률이 90%를 초과하면 warn이 표시됩니다. dbcode를
                재시작하면 메모리가 해제됩니다. 긴 세션을 사용 중이라면{" "}
                <code className="text-cyan-600">/compact</code>로 컨텍스트를 압축하는 것도 도움이
                됩니다.
              </p>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;Session lock이 stale이라고 나와요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                세션 잠금 파일이 30분 이상 오래되면 stale(유효기간 경과) 경고가 표시됩니다. 이전
                세션이 비정상 종료되었을 가능성이 있습니다. dbcode를 재시작하면 잠금이 갱신됩니다.
              </p>
            </div>

            {/* FAQ 4 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;Config directory가 fail이에요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">~/.dbcode</code> 디렉토리에 읽기/쓰기 권한이
                없습니다. 터미널에서 <code className="text-cyan-600">chmod u+rw ~/.dbcode</code>를
                실행하여 권한을 복구하세요.
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
                  name: "token-counter.ts",
                  slug: "token-counter",
                  relation: "sibling",
                  desc: "토큰 캐시 통계를 제공하는 모듈 (/doctor의 11번째 점검 항목)",
                },
                {
                  name: "model-capabilities.ts",
                  slug: "model-capabilities",
                  relation: "sibling",
                  desc: "모델 설정 유효성 확인에 사용되는 모델 역량 정보",
                },
                {
                  name: "config-loader.ts",
                  slug: "config-loader",
                  relation: "sibling",
                  desc: "~/.dbcode 설정 디렉토리와 config.json을 관리하는 모듈",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}

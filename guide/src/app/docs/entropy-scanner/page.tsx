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

export default function EntropyScannerPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/guardrails/entropy-scanner.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">Entropy Scanner</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="infra" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              엔트로피 기반 이상 감지 &mdash; Shannon 엔트로피를 사용하여 코드 내 비밀 정보를
              통계적으로 탐지하는 보안 모듈입니다.
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
                <code className="text-cyan-600">entropy-scanner</code>는 코드나 설정 파일에서 변수
                할당에 높은 엔트로피 값을 가진 문자열이 포함되어 있는지 탐지합니다. 일반 영어
                텍스트는 약 3.5비트/문자의 엔트로피를 가지지만, 무작위로 생성된 API 키나 비밀번호는
                약 4.5비트/문자 이상입니다.
              </p>
              <p>
                이 모듈은 시크릿 스캐너(<code className="text-cyan-600">secret-scanner.ts</code>)를
                보완합니다. 시크릿 스캐너는 알려진 형식(예: <code>sk-</code> 접두사)을 패턴 매칭으로
                탐지하고, 엔트로피 스캐너는 <strong>형식을 모르는</strong> 비밀 정보를 통계적으로
                탐지합니다.
              </p>
              <p>
                동작 방식: (1) 코드에서 비밀 정보 변수 패턴(KEY, TOKEN, SECRET 등)을 찾고, (2)
                할당된 값의 Shannon 엔트로피를 계산하여, (3) 임계값(4.5비트/문자)을 초과하면
                플래그합니다.
              </p>
            </div>

            <MermaidDiagram
              title="Entropy Scanner 아키텍처 위치"
              titleColor="purple"
              chart={`graph TD
  CODE["소스 코드 / 설정 파일<br/><small>변수 할당 포함</small>"]
  ES["Entropy Scanner<br/><small>entropy-scanner.ts</small>"]
  SS["Secret Scanner<br/><small>secret-scanner.ts</small>"]
  GUARD["Guardrails<br/><small>통합 보안 검사</small>"]
  TOOLS["Tool Executor<br/><small>파일 읽기/쓰기 시</small>"]

  CODE --> ES
  CODE --> SS
  ES -->|"높은 엔트로피 후보"| GUARD
  SS -->|"알려진 형식 매칭"| GUARD
  GUARD --> TOOLS

  style ES fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style CODE fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style SS fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style GUARD fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style TOOLS fill:#e0e7ff,stroke:#64748b,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> 금속 탐지기를 떠올리세요. 시크릿 스캐너가 &quot;이 열쇠는 금고
              열쇠처럼 생겼다&quot;(형태 매칭)고 판단한다면, 엔트로피 스캐너는 &quot;이 물체에서
              비정상적으로 높은 무작위성이 감지된다&quot;(통계 분석)고 판단합니다. 두 가지를 함께
              사용하면 미지의 비밀 정보도 놓치지 않습니다.
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

            {/* SecretCandidate interface */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface SecretCandidate
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              높은 엔트로피가 탐지된 변수 할당 정보를 나타냅니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "value",
                  type: "string",
                  required: true,
                  desc: '탐지된 값의 처음 8자 + "..." (보안을 위해 전체 값은 숨김)',
                },
                {
                  name: "entropy",
                  type: "number",
                  required: true,
                  desc: "계산된 Shannon 엔트로피 (비트/문자, 소수점 2자리)",
                },
                {
                  name: "line",
                  type: "number",
                  required: true,
                  desc: "값이 발견된 줄 번호 (1부터 시작)",
                },
                {
                  name: "pattern",
                  type: "string",
                  required: true,
                  desc: "매칭된 변수 이름 또는 패턴 이름",
                },
              ]}
            />

            {/* shannonEntropy function */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              shannonEntropy(str)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              문자열의 Shannon 엔트로피를 계산합니다. 문자열의 무작위성(정보 밀도)을 비트/문자
              단위로 반환합니다.
            </p>
            <CodeBlock>
              <span className="kw">export function</span> <span className="fn">shannonEntropy</span>
              (<span className="prop">str</span>: <span className="type">string</span>):{" "}
              <span className="type">number</span>
            </CodeBlock>
            <ParamTable
              params={[
                { name: "str", type: "string", required: true, desc: "엔트로피를 계산할 문자열" },
              ]}
            />
            <div className="text-[13px] text-gray-600 mt-3 space-y-1">
              <p>
                &bull; <strong>0 비트</strong> &mdash; 모든 문자가 동일 (&quot;aaaaaa&quot;)
              </p>
              <p>
                &bull; <strong>~3.5 비트</strong> &mdash; 일반 영어 텍스트 (&quot;hello world&quot;)
              </p>
              <p>
                &bull; <strong>~4.0 비트</strong> &mdash; 구조화된 코드/데이터
              </p>
              <p>
                &bull; <strong>~4.5+ 비트</strong> &mdash; 무작위/암호화된 문자열 (API 키, 비밀번호)
              </p>
              <p>
                &bull; <strong>~6.0 비트</strong> &mdash; 완전히 무작위인 문자열
              </p>
            </div>

            {/* detectHighEntropySecrets function */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              detectHighEntropySecrets(content)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              코드/설정 파일에서 높은 엔트로피의 비밀 정보 후보를 탐지합니다. 비밀 변수 할당 패턴을
              검색하고 각 값의 엔트로피를 계산합니다.
            </p>
            <CodeBlock>
              <span className="kw">export function</span>{" "}
              <span className="fn">detectHighEntropySecrets</span>(
              <span className="prop">content</span>: <span className="type">string</span>):{" "}
              <span className="type">readonly SecretCandidate[]</span>
            </CodeBlock>
            <ParamTable
              params={[
                {
                  name: "content",
                  type: "string",
                  required: true,
                  desc: "검사할 소스 코드 또는 설정 파일 내용",
                },
              ]}
            />

            {/* 할당 패턴 목록 */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
              지원하는 할당 패턴 (5가지)
            </h4>
            <div className="text-[13px] text-gray-600 mt-2 space-y-1">
              <p>
                &bull; <code className="text-cyan-600">quoted_assignment</code> &mdash; KEY =
                &quot;value&quot; 형태 (대문자 상수)
              </p>
              <p>
                &bull; <code className="text-cyan-600">export_assignment</code> &mdash; export
                KEY=&quot;value&quot; 형태 (쉘 환경변수)
              </p>
              <p>
                &bull; <code className="text-cyan-600">js_const_assignment</code> &mdash; const
                secretKey = &quot;value&quot; 형태 (JS/TS)
              </p>
              <p>
                &bull; <code className="text-cyan-600">yaml_assignment</code> &mdash; secret_key:
                value 형태 (YAML 설정)
              </p>
              <p>
                &bull; <code className="text-cyan-600">generic_assignment</code> &mdash; api_key =
                &quot;value&quot; 형태 (범용 패턴)
              </p>
            </div>

            {/* 상수 */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">주요 상수</h4>
            <ParamTable
              params={[
                {
                  name: "ENTROPY_THRESHOLD",
                  type: "number",
                  required: true,
                  desc: "엔트로피 임계값 = 4.5비트/문자. 이 값을 초과하면 비밀 정보 후보로 플래그",
                },
                {
                  name: "MIN_VALUE_LENGTH",
                  type: "number",
                  required: true,
                  desc: "최소 분석 대상 길이 = 8자. 이보다 짧은 문자열은 건너뜀",
                },
              ]}
            />

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                엔트로피 임계값(<code className="text-cyan-600">4.5</code>)은 보수적인 기준입니다.
                일반 텍스트(~3.5비트)의 오탐은 적지만, 약한 비밀번호(낮은 엔트로피)는 놓칠 수
                있습니다.
              </li>
              <li>
                변수 이름에 KEY, TOKEN, SECRET, PASSWORD, CREDENTIAL, AUTH가 포함된 경우만
                검사합니다. 다른 이름의 변수에 할당된 비밀 정보는 탐지되지 않습니다.
              </li>
              <li>
                같은 줄에서 여러 패턴이 같은 값을 매칭하면 중복이 제거됩니다(deduplication).
                <code className="text-cyan-600">&quot;줄번호:값&quot;</code> 조합으로 고유성을
                판단합니다.
              </li>
              <li>
                YAML 패턴은 따옴표 없는 12자 이상의 값만 매칭합니다. 따옴표로 감싼 YAML 값은
                <code className="text-cyan-600">quoted_assignment</code> 패턴이 처리합니다.
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
              기본 사용법 &mdash; 코드에서 비밀 정보 탐지
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              파일 내용을 전달하여 높은 엔트로피의 비밀 정보 후보를 찾습니다.
            </p>
            <CodeBlock>
              <span className="kw">import</span> {"{"}{" "}
              <span className="fn">detectHighEntropySecrets</span> {"}"}{" "}
              <span className="kw">from</span>{" "}
              <span className="str">&quot;./guardrails/entropy-scanner.js&quot;</span>;{"\n"}
              {"\n"}
              <span className="kw">const</span> <span className="prop">code</span> ={" "}
              <span className="str">
                ` const API_KEY = &quot;xK9mP2nQ5rT8vW1yZ3bC4dE6fG7hJ0k&quot;; const appName =
                &quot;my-application&quot;; `
              </span>
              ;{"\n"}
              {"\n"}
              <span className="kw">const</span> <span className="prop">candidates</span> ={" "}
              <span className="fn">detectHighEntropySecrets</span>(
              <span className="prop">code</span>);
              {"\n"}
              {"\n"}
              <span className="kw">for</span> (<span className="kw">const</span>{" "}
              <span className="prop">c</span> <span className="kw">of</span>{" "}
              <span className="prop">candidates</span>) {"{"}
              {"\n"}
              {"  "}
              <span className="fn">console</span>.<span className="fn">log</span>({"\n"}
              {"    "}
              <span className="str">`[줄 ${"{"}</span>
              <span className="prop">c</span>.<span className="prop">line</span>
              <span className="str">
                {"}"}] ${"{"}
              </span>
              <span className="prop">c</span>.<span className="prop">pattern</span>
              <span className="str">
                {"}"}: ${"{"}
              </span>
              <span className="prop">c</span>.<span className="prop">value</span>
              <span className="str">
                {"}"} (엔트로피: ${"{"}
              </span>
              <span className="prop">c</span>.<span className="prop">entropy</span>
              <span className="str">{"}"})`</span>
              {"\n"}
              {"  "});
              {"\n"}
              {"}"}
              {"\n"}
              <span className="cm">{"// 출력: [줄 2] API_KEY: xK9mP2nQ... (엔트로피: 4.75)"}</span>
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> <code>appName</code>에 할당된 &quot;my-application&quot;은 변수
              이름에 KEY/TOKEN/SECRET 등이 포함되지 않으므로 검사 대상에서 제외됩니다. 엔트로피
              스캐너는 <strong>변수 이름 패턴과 엔트로피 값</strong> 두 가지 모두 충족해야
              탐지합니다.
            </Callout>

            {/* 고급: Shannon 엔트로피 직접 계산 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; Shannon 엔트로피 직접 계산
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">shannonEntropy()</code>를 직접 호출하여 임의의
              문자열의 엔트로피를 측정할 수 있습니다.
            </p>
            <CodeBlock>
              <span className="kw">import</span> {"{"} <span className="fn">shannonEntropy</span>{" "}
              {"}"} <span className="kw">from</span>{" "}
              <span className="str">&quot;./guardrails/entropy-scanner.js&quot;</span>;{"\n"}
              {"\n"}
              <span className="fn">shannonEntropy</span>(
              <span className="str">&quot;aaaaaa&quot;</span>);{"              "}
              <span className="cm">{"// 0 (엔트로피 없음)"}</span>
              {"\n"}
              <span className="fn">shannonEntropy</span>(
              <span className="str">&quot;hello world&quot;</span>);{"         "}
              <span className="cm">{"// ~3.18"}</span>
              {"\n"}
              <span className="fn">shannonEntropy</span>(
              <span className="str">&quot;sk-abc123XYZ!@#$%^&quot;</span>);{"  "}
              <span className="cm">{"// ~4.5+ (높은 엔트로피)"}</span>
            </CodeBlock>

            <DeepDive title="Shannon 엔트로피 수학적 배경">
              <p className="mb-3">
                Shannon 엔트로피(정보 엔트로피)는 Claude Shannon이 1948년 정보이론에서 제안한
                문자열의 무작위성(정보 밀도)을 측정하는 수학적 지표입니다.
              </p>
              <CodeBlock>
                <span className="cm">{"// 계산 공식: H = -Σ p(x) * log2(p(x))"}</span>
                {"\n"}
                <span className="cm">{"// p(x) = 각 문자의 출현 확률"}</span>
                {"\n"}
                {"\n"}
                <span className="cm">{"// 구현 코드:"}</span>
                {"\n"}
                <span className="kw">const</span> <span className="prop">freq</span> ={" "}
                <span className="kw">new</span> <span className="type">Map</span>&lt;
                <span className="type">string</span>, <span className="type">number</span>&gt;();
                {"\n"}
                <span className="kw">for</span> (<span className="kw">const</span>{" "}
                <span className="prop">char</span> <span className="kw">of</span>{" "}
                <span className="prop">str</span>) {"{"}
                {"\n"}
                {"  "}
                <span className="prop">freq</span>.<span className="fn">set</span>(
                <span className="prop">char</span>, (<span className="prop">freq</span>.
                <span className="fn">get</span>(<span className="prop">char</span>) ??{" "}
                <span className="num">0</span>) + <span className="num">1</span>);
                {"\n"}
                {"}"}
                {"\n"}
                {"\n"}
                <span className="kw">let</span> <span className="prop">entropy</span> ={" "}
                <span className="num">0</span>;{"\n"}
                <span className="kw">for</span> (<span className="kw">const</span>{" "}
                <span className="prop">count</span> <span className="kw">of</span>{" "}
                <span className="prop">freq</span>.<span className="fn">values</span>()) {"{"}
                {"\n"}
                {"  "}
                <span className="kw">const</span> <span className="prop">p</span> ={" "}
                <span className="prop">count</span> / <span className="prop">len</span>;{"\n"}
                {"  "}
                <span className="prop">entropy</span> -= <span className="prop">p</span> *{" "}
                <span className="type">Math</span>.<span className="fn">log2</span>(
                <span className="prop">p</span>);
                {"\n"}
                {"}"}
              </CodeBlock>
              <p className="mt-3 text-gray-600">
                모든 문자가 동일하면 확률이 1이므로 log2(1) = 0, 엔트로피는 0입니다. 문자가 고르게
                분포할수록 엔트로피가 높아지며, 최대값은 log2(고유 문자 수)입니다.
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
              탐지 흐름 다이어그램
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">detectHighEntropySecrets()</code>의 내부 동작
              흐름입니다. 변수 할당 패턴을 찾고, 엔트로피를 계산하여, 임계값을 초과하는 후보를
              수집합니다.
            </p>

            <MermaidDiagram
              title="detectHighEntropySecrets() 탐지 흐름"
              titleColor="purple"
              chart={`graph TD
  INPUT(("소스 코드 입력")) --> LINES["줄 시작 위치 맵 생성<br/><small>buildLineStarts()</small>"]
  LINES --> LOOP["할당 패턴 순회<br/><small>5가지 ASSIGNMENT_PATTERNS</small>"]
  LOOP --> MATCH{"정규식 매칭?"}
  MATCH -->|"매칭됨"| LEN{"값 길이 >= 8자?"}
  MATCH -->|"매칭 없음"| NEXT["다음 패턴"]
  LEN -->|"Yes"| CALC["Shannon 엔트로피 계산<br/><small>shannonEntropy(value)</small>"]
  LEN -->|"No"| NEXT
  CALC --> THRESH{"엔트로피 >= 4.5?"}
  THRESH -->|"Yes"| ADD["후보 추가<br/><small>값 8자로 잘라서 저장</small>"]
  THRESH -->|"No"| NEXT
  ADD --> NEXT
  NEXT --> LOOP
  LOOP -->|"모든 패턴 완료"| DEDUP["중복 제거<br/><small>줄번호:값 기준</small>"]
  DEDUP --> RESULT(("후보 배열 반환"))

  style INPUT fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style CALC fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style THRESH fill:#fef3c7,stroke:#f59e0b,color:#92400e,stroke-width:2px
  style ADD fill:#dcfce7,stroke:#10b981,color:#065f46
  style DEDUP fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style RESULT fill:#e0e7ff,stroke:#3b82f6,color:#1e293b`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              핵심 코드 분석
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">detectHighEntropySecrets()</code>의 핵심 로직입니다.
              패턴 순회, 엔트로피 계산, 후보 수집을 수행합니다.
            </p>
            <CodeBlock>
              <span className="kw">export function</span>{" "}
              <span className="fn">detectHighEntropySecrets</span>(
              <span className="prop">content</span>: <span className="type">string</span>):{" "}
              <span className="type">readonly SecretCandidate[]</span> {"{"}
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">candidates</span>:{" "}
              <span className="type">SecretCandidate[]</span> = [];
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">lineStarts</span> ={" "}
              <span className="fn">buildLineStarts</span>(<span className="prop">content</span>);
              {"\n"}
              {"\n"}
              {"  "}
              <span className="kw">for</span> (<span className="kw">const</span> {"{"}{" "}
              <span className="prop">name</span>, <span className="prop">regex</span> {"}"}{" "}
              <span className="kw">of</span> <span className="prop">ASSIGNMENT_PATTERNS</span>){" "}
              {"{"}
              {"\n"}
              {"    "}
              <span className="cm">{"// [1] 정규식 lastIndex 초기화를 위해 새 객체 생성"}</span>
              {"\n"}
              {"    "}
              <span className="kw">const</span> <span className="prop">pattern</span> ={" "}
              <span className="kw">new</span> <span className="type">RegExp</span>(
              <span className="prop">regex</span>.<span className="prop">source</span>,{" "}
              <span className="prop">regex</span>.<span className="prop">flags</span>);
              {"\n"}
              {"    "}
              <span className="kw">let</span> <span className="prop">match</span>;{"\n"}
              {"\n"}
              {"    "}
              <span className="kw">while</span> ((<span className="prop">match</span> ={" "}
              <span className="prop">pattern</span>.<span className="fn">exec</span>(
              <span className="prop">content</span>)) !== <span className="num">null</span>) {"{"}
              {"\n"}
              {"      "}
              <span className="kw">const</span> <span className="prop">value</span> ={" "}
              <span className="prop">match</span>[<span className="num">2</span>];
              {"\n"}
              {"      "}
              <span className="kw">if</span> (!<span className="prop">value</span> ||{" "}
              <span className="prop">value</span>.<span className="prop">length</span> {"<"}{" "}
              <span className="num">8</span>) <span className="kw">continue</span>;{"\n"}
              {"\n"}
              {"      "}
              <span className="cm">{"// [2] Shannon 엔트로피 계산"}</span>
              {"\n"}
              {"      "}
              <span className="kw">const</span> <span className="prop">entropy</span> ={" "}
              <span className="fn">shannonEntropy</span>(<span className="prop">value</span>);
              {"\n"}
              {"      "}
              <span className="kw">if</span> (<span className="prop">entropy</span> {">="}{" "}
              <span className="num">4.5</span>) {"{"}
              {"\n"}
              {"        "}
              <span className="cm">{"// [3] 줄 번호 계산 + 값 잘라내기 + 후보 추가"}</span>
              {"\n"}
              {"        "}
              <span className="prop">candidates</span>.<span className="fn">push</span>({"{"}{" "}
              <span className="prop">value</span>: <span className="prop">truncated</span>,{" "}
              <span className="prop">entropy</span>, <span className="prop">line</span>,{" "}
              <span className="prop">pattern</span> {"}"});
              {"\n"}
              {"      "}
              {"}"}
              {"\n"}
              {"    "}
              {"}"}
              {"\n"}
              {"  "}
              {"}"}
              {"\n"}
              {"\n"}
              {"  "}
              <span className="kw">return</span> <span className="fn">deduplicateCandidates</span>(
              <span className="prop">candidates</span>);
              {"\n"}
              {"}"}
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">[1]</strong> 전역 플래그(<code>/g</code>)가 있는
                정규식은 <code>lastIndex</code>를 공유하므로, 매번 새로운 <code>RegExp</code> 객체를
                생성하여 상태를 초기화합니다.
              </p>
              <p>
                <strong className="text-gray-900">[2]</strong> 8자 이상의 값에 대해 Shannon
                엔트로피를 계산합니다. 짧은 문자열은 자연스럽게 낮은 엔트로피 다양성을 가지므로 의미
                있는 분석이 어렵습니다.
              </p>
              <p>
                <strong className="text-gray-900">[3]</strong> 임계값(4.5비트/문자) 이상이면 후보로
                기록합니다. 보안을 위해 값은 처음 8자만 저장하고, <code>match.index</code>를 이진
                탐색으로 줄 번호로 변환합니다.
              </p>
            </div>

            <DeepDive title="줄 번호 변환: buildLineStarts + getLineNumber">
              <p className="mb-3">
                <code className="text-cyan-600">buildLineStarts()</code>는 텍스트의 각 줄 시작
                위치를 배열로 생성하고,
                <code className="text-cyan-600">getLineNumber()</code>는 이진 탐색(Binary
                Search)으로 문자 오프셋을 O(log n) 시간에 줄 번호로 변환합니다.
              </p>
              <CodeBlock>
                <span className="cm">{'// buildLineStarts("abc\\ndef\\n") → [0, 4, 8]'}</span>
                {"\n"}
                <span className="cm">
                  {"// 1번째 줄은 오프셋 0, 2번째 줄은 4, 3번째 줄은 8에서 시작"}
                </span>
                {"\n"}
                {"\n"}
                <span className="cm">
                  {"// getLineNumber([0, 4, 8], 5) → 2 (오프셋 5는 2번째 줄)"}
                </span>
                {"\n"}
                <span className="cm">{"// 이진 탐색: O(log n) 시간 복잡도"}</span>
              </CodeBlock>
              <p className="mt-3 text-gray-600">
                이진 탐색에서{" "}
                <code className="text-cyan-600">
                  {">"}
                  {">"}
                  {">"} 1
                </code>
                (부호 없는 오른쪽 시프트)을 사용하여 2로 나누는데, 이는 정수 오버플로우를 방지하는
                안전한 방식입니다.
              </p>
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
                &quot;일반 문자열인데 비밀 정보로 탐지돼요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                변수 이름에 KEY, TOKEN, SECRET 등이 포함되어 있고, 할당된 값의 엔트로피가 4.5
                이상이면 탐지됩니다. 예를 들어,{" "}
                <code className="text-cyan-600">
                  const licenseKey = &quot;AbCdEfGh12345678&quot;
                </code>
                는 라이선스 키이지만 높은 엔트로피로 인해 탐지될 수 있습니다.
              </p>
              <Callout type="tip" icon="*">
                오탐이 발생하면 변수 이름에서 KEY/TOKEN/SECRET 같은 키워드를 피하거나, 해당 값이
                실제 비밀 정보가 아님을 코드 주석으로 명시하세요.
              </Callout>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;비밀 정보인데 탐지되지 않아요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                두 가지 가능성이 있습니다: (1) 변수 이름에 KEY/TOKEN/SECRET 등의 키워드가 없는 경우,
                (2) 값의 엔트로피가 4.5 미만인 경우(짧거나 단순한 비밀번호). 알려진 형식의 비밀
                정보는
                <code className="text-cyan-600">secret-scanner.ts</code>를 함께 사용하세요.
              </p>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;같은 줄에서 중복 탐지가 발생해요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                여러 할당 패턴이 동일한 변수를 매칭할 수 있습니다. 예를 들어{" "}
                <code>const API_KEY = &quot;...&quot;</code>는
                <code className="text-cyan-600">quoted_assignment</code>와{" "}
                <code className="text-cyan-600">js_const_assignment</code>
                모두에 매칭됩니다. <code className="text-cyan-600">deduplicateCandidates()</code>가
                &quot;줄번호:값&quot; 기준으로 중복을 제거합니다.
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
                  name: "secret-scanner.ts",
                  slug: "secret-scanner",
                  relation: "sibling",
                  desc: "알려진 형식(AWS 키, GitHub 토큰 등)의 비밀 정보를 패턴 매칭으로 탐지하는 모듈",
                },
                {
                  name: "injection-detector.ts",
                  slug: "injection-detector",
                  relation: "sibling",
                  desc: "프롬프트 인젝션 공격을 탐지하여 AI의 안전을 보호하는 모듈",
                },
                {
                  name: "command-filter.ts",
                  slug: "command-filter",
                  relation: "sibling",
                  desc: "위험한 쉘 명령어를 탐지하고 차단하는 명령어 필터 모듈",
                },
                {
                  name: "path-filter.ts",
                  slug: "path-filter",
                  relation: "sibling",
                  desc: "민감한 시스템 파일과 경로 순회 공격을 차단하는 경로 필터 모듈",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}

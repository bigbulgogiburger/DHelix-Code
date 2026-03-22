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

export default function ToolRetryPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}><div className="center-narrow">
      {/* ─── Header ─── */}
      <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <FilePath path="src/tools/tool-retry.ts" />
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
            <span className="text-gray-900">
              Tool Retry
            </span>
          </h1>
          <div className="flex items-center gap-3 mb-5">
            <LayerBadge layer="infra" />
          </div>
          <p className="text-[16px] text-gray-600 leading-relaxed">
            도구 실행 재시도 로직 — 실패한 도구 호출을 분석하고 자동으로 교정하여 재시도합니다.
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
              <code className="text-cyan-600">retryWithCorrection</code>은 도구 실행이 실패했을 때
              에러 유형을 분석하여 자동 교정을 시도하는 모듈입니다.
              Tool Call Corrector가 &quot;사전 교정&quot;이라면, 이 모듈은 &quot;사후 교정&quot;입니다.
            </p>
            <p>
              핵심 알고리즘은 <strong>Levenshtein 거리</strong>(편집 거리)입니다.
              파일 경로에 오타가 있으면 같은 디렉토리에서 가장 비슷한 파일을 찾아 자동으로 교정합니다.
              예를 들어 <code className="text-cyan-600">&quot;indx.ts&quot;</code>가 실패하면
              <code className="text-cyan-600">&quot;index.ts&quot;</code>로 교정하여 재시도합니다.
            </p>
            <p>
              에러 유형별 교정 전략: ENOENT(파일 없음) &rarr; 유사 파일명 검색,
              JSON 파싱 에러 &rarr; 잘못된 JSON 수리, 권한 에러(EACCES) &rarr; 교정 불가(null 반환).
            </p>
          </div>

          <MermaidDiagram
            title="Tool Retry 아키텍처 위치"
            titleColor="purple"
            chart={`graph TD
  TE["Tool Executor<br/><small>tools/executor.ts</small>"]
  TR["Tool Retry<br/><small>tools/tool-retry.ts</small>"]
  FS["File System<br/><small>node:fs/promises</small>"]
  TCC["Tool Call Corrector<br/><small>사전 교정</small>"]
  AL["Agent Loop<br/><small>agent-loop.ts</small>"]

  AL --> TE
  TE -->|"실행 실패"| TR
  TR -->|"ENOENT: 유사 파일 검색"| FS
  TR -->|"교정된 인수"| TE
  TCC -->|"사전 교정"| TE

  style TR fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style TE fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style FS fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style TCC fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style AL fill:#e0e7ff,stroke:#64748b,color:#1e293b`}
          />

          <Callout type="info" icon="💡">
            <strong>비유:</strong> 내비게이션에 잘못된 주소를 입력했을 때를 떠올리세요.
            &quot;서울시 강남구 역삼동 123-45&quot;가 아닌 &quot;역삼동 123-46&quot;을 입력하면,
            내비가 &quot;혹시 123-45를 찾으시나요?&quot;라고 비슷한 주소를 제안하는 것과 같습니다.
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 2. 레퍼런스 (Reference) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>📖</span> 레퍼런스
          </h2>

          {/* CorrectedToolCall interface */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface CorrectedToolCall
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            교정된 도구 호출을 나타냅니다. 수정된 인수와 교정 이유를 포함합니다.
          </p>
          <ParamTable
            params={[
              { name: "args", type: "Record<string, unknown>", required: true, desc: "교정된 인수 객체" },
              { name: "reason", type: "string", required: true, desc: "교정 이유 설명 (사용자/LLM에게 보여줄 메시지)" },
            ]}
          />

          {/* retryWithCorrection function */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            retryWithCorrection()
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            실패한 도구 호출을 분석하고 자동 교정을 시도하는 핵심 함수입니다.
            교정이 가능하면 <code className="text-cyan-600">CorrectedToolCall</code>을 반환하고,
            불가능하면 <code className="text-cyan-600">null</code>을 반환합니다.
          </p>
          <CodeBlock>
            <span className="kw">async function</span> <span className="fn">retryWithCorrection</span>(
            {"\n"}{"  "}<span className="prop">toolName</span>: <span className="type">string</span>,
            {"\n"}{"  "}<span className="prop">originalArgs</span>: <span className="type">Record</span>{"<"}<span className="type">string</span>, <span className="type">unknown</span>{">"}{","}
            {"\n"}{"  "}<span className="prop">error</span>: <span className="type">Error</span>,
            {"\n"}{"  "}<span className="prop">workingDirectory</span>: <span className="type">string</span>,
            {"\n"}): <span className="type">Promise</span>{"<"}<span className="type">CorrectedToolCall</span> | <span className="type">null</span>{">"}
          </CodeBlock>
          <ParamTable
            params={[
              { name: "toolName", type: "string", required: true, desc: "실패한 도구의 이름" },
              { name: "originalArgs", type: "Record<string, unknown>", required: true, desc: "실패를 일으킨 원본 인수 객체" },
              { name: "error", type: "Error", required: true, desc: "발생한 에러 객체" },
              { name: "workingDirectory", type: "string", required: true, desc: "현재 작업 디렉토리" },
            ]}
          />

          {/* levenshtein function */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            levenshtein() &mdash; 내부 함수
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            두 문자열 간의 Levenshtein 거리(편집 거리)를 계산합니다.
            동적 프로그래밍(DP)으로 구현되며, 파일명 오타 감지에 사용됩니다.
          </p>
          <CodeBlock>
            <span className="kw">function</span> <span className="fn">levenshtein</span>(<span className="prop">a</span>: <span className="type">string</span>, <span className="prop">b</span>: <span className="type">string</span>): <span className="type">number</span>
            {"\n"}<span className="cm">// 삽입, 삭제, 교체 연산의 최소 횟수를 반환</span>
          </CodeBlock>

          {/* Caveats */}
          <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
          <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
            <li>
              <code className="text-cyan-600">retryWithCorrection</code>은 <strong>비동기</strong>(async) 함수입니다.
              파일 시스템을 읽어 유사 파일을 검색하기 때문입니다.
            </li>
            <li>
              교정 허용 거리는 <code className="text-cyan-600">max(2, 파일명길이 * 0.3)</code>입니다.
              너무 다른 파일명으로 교정되는 것을 방지합니다.
            </li>
            <li>
              파일명 비교는 <strong>대소문자 무시</strong>(case-insensitive)로 수행됩니다.
              <code className="text-cyan-600">&quot;Index.ts&quot;</code>와 <code className="text-cyan-600">&quot;index.ts&quot;</code>는
              거리 0으로 계산됩니다.
            </li>
            <li>
              권한 에러(<code className="text-cyan-600">EACCES</code>)는 자동 교정이 불가능합니다.
              사용자가 직접 파일 권한을 변경해야 합니다.
            </li>
            <li>
              JSON 수리는 후행 쉼표 제거, 작은따옴표 &rarr; 큰따옴표, 따옴표 없는 키 보정의 세 가지만 지원합니다.
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
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>기본 사용법 &mdash; 도구 실행 실패 후 재시도</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            도구 실행이 실패하면 에러를 분석하여 교정 가능한 경우 자동으로 재시도합니다.
          </p>
          <CodeBlock>
            <span className="kw">try</span> {"{"}
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">result</span> = <span className="kw">await</span> <span className="fn">executeTool</span>(<span className="prop">toolName</span>, <span className="prop">args</span>);
            {"\n"}<span className="kw">{"}"} catch</span> (<span className="prop">error</span>) {"{"}
            {"\n"}{"  "}<span className="cm">{"// 자동 교정 시도"}</span>
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">correction</span> = <span className="kw">await</span> <span className="fn">retryWithCorrection</span>(
            {"\n"}{"    "}<span className="prop">toolName</span>, <span className="prop">args</span>, <span className="prop">error</span>, <span className="prop">workingDirectory</span>,
            {"\n"}{"  "});
            {"\n"}
            {"\n"}{"  "}<span className="kw">if</span> (<span className="prop">correction</span>) {"{"}
            {"\n"}{"    "}<span className="cm">{"// 교정 성공 → 교정된 인수로 재시도"}</span>
            {"\n"}{"    "}<span className="fn">logger</span>.<span className="fn">info</span>(<span className="prop">correction</span>.<span className="prop">reason</span>);
            {"\n"}{"    "}<span className="kw">const</span> <span className="prop">retryResult</span> = <span className="kw">await</span> <span className="fn">executeTool</span>(
            {"\n"}{"      "}<span className="prop">toolName</span>, <span className="prop">correction</span>.<span className="prop">args</span>,
            {"\n"}{"    "});
            {"\n"}{"  "}<span className="kw">{"}"} else {"{"}</span>
            {"\n"}{"    "}<span className="cm">{"// 교정 불가 → 에러를 LLM에 전달"}</span>
            {"\n"}{"    "}<span className="kw">throw</span> <span className="prop">error</span>;
            {"\n"}{"  "}{"}"}
            {"\n"}{"}"}
          </CodeBlock>

          <Callout type="warn" icon="!">
            <strong>주의:</strong> 재시도는 <strong>한 번만</strong> 수행해야 합니다.
            교정된 인수로도 실패하면 무한 재시도에 빠질 수 있으므로,
            두 번째 실패 시에는 에러를 그대로 LLM에 전달하세요.
          </Callout>

          {/* 고급 사용법: ENOENT 교정 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; 파일명 오타 교정 예시
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            LLM이 <code className="text-cyan-600">&quot;indx.ts&quot;</code>라고 잘못 입력한 경우,
            같은 디렉토리에서 가장 비슷한 파일을 찾아 자동으로 교정합니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 원본: { file_path: \"/project/src/indx.ts\" }"}</span>
            {"\n"}<span className="cm">{"// 에러: ENOENT — no such file or directory"}</span>
            {"\n"}
            {"\n"}<span className="kw">const</span> <span className="prop">correction</span> = <span className="kw">await</span> <span className="fn">retryWithCorrection</span>(
            {"\n"}{"  "}<span className="str">&quot;file_read&quot;</span>,
            {"\n"}{"  "}{"{"} <span className="prop">file_path</span>: <span className="str">&quot;/project/src/indx.ts&quot;</span> {"}"},
            {"\n"}{"  "}<span className="kw">new</span> <span className="fn">Error</span>(<span className="str">&quot;ENOENT: no such file&quot;</span>),
            {"\n"}{"  "}<span className="str">&quot;/project&quot;</span>,
            {"\n"});
            {"\n"}
            {"\n"}<span className="cm">{"// correction.args → { file_path: \"/project/src/index.ts\" }"}</span>
            {"\n"}<span className="cm">{"// correction.reason → 'File not found: \"indx.ts\" — corrected to: \"index.ts\"'"}</span>
          </CodeBlock>

          <Callout type="tip" icon="*">
            <strong>팁:</strong> Levenshtein 거리가 0인 경우(완전 일치)는 교정하지 않습니다.
            파일이 실제로 존재하지 않는 경우이므로, 디렉토리 자체가 잘못되었을 수 있습니다.
          </Callout>

          <DeepDive title="JSON 수리(repairJsonArgs) 상세">
            <p className="mb-3">
              LLM이 인수를 JSON 문자열로 전달할 때 발생하는 흔한 오류를 자동으로 수리합니다.
              세 가지 패턴을 순서대로 적용합니다:
            </p>
            <CodeBlock>
              <span className="cm">{"// 1. 후행 쉼표 제거"}</span>
              {"\n"}<span className="str">{`'{"a": 1, }'`}</span> → <span className="str">{`'{"a": 1}'`}</span>
              {"\n"}
              {"\n"}<span className="cm">{"// 2. 작은따옴표 → 큰따옴표"}</span>
              {"\n"}<span className="str">{`"{'a': 1}"`}</span> → <span className="str">{`'{"a": 1}'`}</span>
              {"\n"}
              {"\n"}<span className="cm">{"// 3. 따옴표 없는 키에 따옴표 추가"}</span>
              {"\n"}<span className="str">{`'{a: 1}'`}</span> → <span className="str">{`'{"a": 1}'`}</span>
            </CodeBlock>
            <p className="mt-3 text-gray-600">
              수리는 값이 <code className="text-cyan-600">{`{}`}</code>나 <code className="text-cyan-600">[]</code>로
              감싸진 문자열에만 적용됩니다. 일반 문자열은 JSON 파싱을 시도하지 않습니다.
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

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>에러 유형별 교정 흐름</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            에러 메시지의 패턴을 정규식으로 매칭하여 교정 전략을 결정합니다.
            매칭 순서대로 검사하며, 첫 번째로 매칭되는 전략을 실행합니다.
          </p>

          <MermaidDiagram
            title="에러 유형별 교정 전략"
            titleColor="purple"
            chart={`graph TD
  ERR["에러 발생<br/><small>error.message 분석</small>"]

  ERR -->|"EACCES / permission denied"| NULL1["null 반환<br/><small>자동 교정 불가</small>"]
  ERR -->|"ENOENT / not found"| LEV["Levenshtein 검색<br/><small>같은 디렉토리에서 유사 파일 탐색</small>"]
  ERR -->|"parse error / invalid json"| JSON["JSON 수리<br/><small>후행 쉼표, 따옴표 교정</small>"]
  ERR -->|"기타 에러"| NULL2["null 반환<br/><small>알 수 없는 에러</small>"]

  LEV -->|"거리 <= max"| CORR1["CorrectedToolCall<br/><small>교정된 경로 + 이유</small>"]
  LEV -->|"거리 > max"| NULL3["null 반환<br/><small>너무 다른 파일</small>"]
  JSON -->|"수리 성공"| CORR2["CorrectedToolCall<br/><small>수리된 JSON + 이유</small>"]
  JSON -->|"수리 실패"| NULL4["null 반환"]

  style ERR fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style NULL1 fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style NULL2 fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style NULL3 fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style NULL4 fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style LEV fill:#ede9fe,stroke:#8b5cf6,color:#1e293b
  style JSON fill:#fef3c7,stroke:#f59e0b,color:#78350f
  style CORR1 fill:#dcfce7,stroke:#10b981,color:#065f46,stroke-width:2px
  style CORR2 fill:#dcfce7,stroke:#10b981,color:#065f46,stroke-width:2px`}
          />

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>핵심 코드 분석 &mdash; Levenshtein 거리</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            파일명 오타 교정의 핵심인 Levenshtein 거리 알고리즘입니다.
            동적 프로그래밍(DP)으로 두 문자열 간의 최소 편집 횟수를 계산합니다.
          </p>
          <CodeBlock>
            <span className="fn">levenshtein</span>(<span className="prop">a</span>: <span className="type">string</span>, <span className="prop">b</span>: <span className="type">string</span>): <span className="type">number</span> {"{"}
            {"\n"}{"  "}<span className="cm">{"// [1] DP 테이블: (m+1) x (n+1) 크기"}</span>
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">dp</span> = <span className="fn">Array</span>.<span className="fn">from</span>(
            {"\n"}{"    "}{"{"} <span className="prop">length</span>: <span className="prop">m</span> + <span className="num">1</span> {"}"},
            {"\n"}{"    "}() {"=>"} <span className="fn">Array</span>(<span className="prop">n</span> + <span className="num">1</span>).<span className="fn">fill</span>(<span className="num">0</span>),
            {"\n"}{"  "});
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// [2] 기저 사례: 빈 문자열 → 삽입 횟수"}</span>
            {"\n"}{"  "}<span className="kw">for</span> (<span className="prop">i</span> = <span className="num">0</span>; <span className="prop">i</span> {"<="} <span className="prop">m</span>; <span className="prop">i</span>++) <span className="prop">dp</span>[<span className="prop">i</span>][<span className="num">0</span>] = <span className="prop">i</span>;
            {"\n"}{"  "}<span className="kw">for</span> (<span className="prop">j</span> = <span className="num">0</span>; <span className="prop">j</span> {"<="} <span className="prop">n</span>; <span className="prop">j</span>++) <span className="prop">dp</span>[<span className="num">0</span>][<span className="prop">j</span>] = <span className="prop">j</span>;
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// [3] 삽입/삭제/교체 중 최소값 선택"}</span>
            {"\n"}{"  "}<span className="kw">for</span> (<span className="prop">i</span> = <span className="num">1</span>; <span className="prop">i</span> {"<="} <span className="prop">m</span>; <span className="prop">i</span>++) {"{"}
            {"\n"}{"    "}<span className="kw">for</span> (<span className="prop">j</span> = <span className="num">1</span>; <span className="prop">j</span> {"<="} <span className="prop">n</span>; <span className="prop">j</span>++) {"{"}
            {"\n"}{"      "}<span className="kw">const</span> <span className="prop">cost</span> = <span className="prop">a</span>[<span className="prop">i</span>-<span className="num">1</span>] === <span className="prop">b</span>[<span className="prop">j</span>-<span className="num">1</span>] ? <span className="num">0</span> : <span className="num">1</span>;
            {"\n"}{"      "}<span className="prop">dp</span>[<span className="prop">i</span>][<span className="prop">j</span>] = <span className="fn">Math</span>.<span className="fn">min</span>(
            {"\n"}{"        "}<span className="prop">dp</span>[<span className="prop">i</span>-<span className="num">1</span>][<span className="prop">j</span>] + <span className="num">1</span>,{"     "}<span className="cm">{"// 삭제"}</span>
            {"\n"}{"        "}<span className="prop">dp</span>[<span className="prop">i</span>][<span className="prop">j</span>-<span className="num">1</span>] + <span className="num">1</span>,{"     "}<span className="cm">{"// 삽입"}</span>
            {"\n"}{"        "}<span className="prop">dp</span>[<span className="prop">i</span>-<span className="num">1</span>][<span className="prop">j</span>-<span className="num">1</span>] + <span className="prop">cost</span>, <span className="cm">{"// 교체"}</span>
            {"\n"}{"      "});
            {"\n"}{"    "}{"}"}
            {"\n"}{"  "}{"}"}
            {"\n"}{"  "}<span className="kw">return</span> <span className="prop">dp</span>[<span className="prop">m</span>][<span className="prop">n</span>];
            {"\n"}{"}"}
          </CodeBlock>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
            <p><strong className="text-gray-900">[1]</strong> 2차원 DP 테이블을 생성합니다. <code className="text-cyan-600">dp[i][j]</code>는 a의 처음 i글자와 b의 처음 j글자를 같게 만드는 최소 편집 횟수입니다.</p>
            <p><strong className="text-gray-900">[2]</strong> 빈 문자열에서 길이 k인 문자열을 만들려면 k번의 삽입이 필요하므로, 첫 행과 첫 열을 인덱스 값으로 초기화합니다.</p>
            <p><strong className="text-gray-900">[3]</strong> 각 셀에서 삽입(dp[i][j-1]+1), 삭제(dp[i-1][j]+1), 교체(dp[i-1][j-1]+cost) 중 최소값을 선택합니다. 같은 문자면 cost=0이므로 교체가 무료입니다.</p>
          </div>

          <DeepDive title="교정 허용 거리(maxDistance) 계산">
            <p className="mb-3">
              파일명 오타 교정 시, 너무 다른 파일로 교정되는 것을 방지하기 위해
              최대 허용 거리를 계산합니다:
            </p>
            <CodeBlock>
              <span className="kw">const</span> <span className="prop">maxDistance</span> = <span className="fn">Math</span>.<span className="fn">max</span>(<span className="num">2</span>, <span className="fn">Math</span>.<span className="fn">floor</span>(<span className="prop">target</span>.<span className="prop">length</span> * <span className="num">0.3</span>));
            </CodeBlock>
            <ul className="list-disc list-inside space-y-1.5 text-gray-600 mt-3">
              <li>짧은 파일명(예: <code>&quot;a.ts&quot;</code>, 4글자) &rarr; maxDistance = max(2, 1) = <strong>2</strong></li>
              <li>중간 파일명(예: <code>&quot;index.ts&quot;</code>, 8글자) &rarr; maxDistance = max(2, 2) = <strong>2</strong></li>
              <li>긴 파일명(예: <code>&quot;authentication-service.ts&quot;</code>, 26글자) &rarr; maxDistance = max(2, 7) = <strong>7</strong></li>
            </ul>
            <p className="mt-3 text-amber-600">
              거리가 0이면 완전 일치(교정 불필요), maxDistance를 초과하면 너무 다른 파일이므로 교정하지 않습니다.
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
              &quot;오타가 있는데 교정이 안 돼요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              교정 허용 거리를 초과했을 수 있습니다. Levenshtein 거리가
              <code className="text-cyan-600">max(2, 파일명길이 * 0.3)</code>을 초과하면
              교정하지 않습니다. 파일명이 짧을수록 허용 범위가 좁습니다.
            </p>
          </div>

          {/* FAQ 2 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;엉뚱한 파일로 교정됩니다&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              Levenshtein 거리 기반이므로, 원본 파일명과 비슷한 다른 파일이 있으면
              그쪽으로 교정될 수 있습니다. 이런 경우 LLM에게 정확한 파일명을
              확인하라는 피드백을 제공하는 것이 더 효과적입니다.
            </p>
          </div>

          {/* FAQ 3 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;JSON 수리가 작동하지 않아요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              JSON 수리는 세 가지 패턴만 지원합니다: 후행 쉼표, 작은따옴표, 따옴표 없는 키.
              이 외의 JSON 오류(예: 누락된 닫기 괄호, 이스케이프 문자 오류)는 수리되지 않습니다.
            </p>
            <Callout type="tip" icon="*">
              JSON 수리는 값이 <code>{`{...}`}</code>나 <code>[...]</code>로 시작하는 문자열에만 적용됩니다.
              인수가 이미 파싱된 객체이면 수리 대상이 아닙니다.
            </Callout>
          </div>

          {/* FAQ 4 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;권한 에러인데 왜 null이 반환되나요?&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              권한 에러(<code className="text-cyan-600">EACCES</code>, <code className="text-cyan-600">permission denied</code>)는
              프로그래밍적으로 해결할 수 없습니다. 사용자가 직접 파일 시스템 권한을 변경하거나,
              적절한 권한으로 실행해야 합니다. 이 경우 에러 메시지를 LLM에 전달하여
              사용자에게 안내하도록 하세요.
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
                name: "tool-call-corrector.ts",
                slug: "tool-call-corrector",
                relation: "sibling",
                desc: "도구 실행 전 사전 교정 — 경로/타입 오류를 미리 방지",
              },
              {
                name: "adaptive-schema.ts",
                slug: "adaptive-schema",
                relation: "sibling",
                desc: "등급별 스키마 축소로 오류 가능성 자체를 낮춤",
              },
              {
                name: "circuit-breaker.ts",
                slug: "circuit-breaker",
                relation: "sibling",
                desc: "동일 에러 반복 감지 — 재시도 후에도 같은 에러가 반복되면 루프 차단",
              },
              {
                name: "recovery-executor.ts",
                slug: "recovery-executor",
                relation: "sibling",
                desc: "에러 유형별 복구 전략 — 더 넓은 범위의 에러 복구 시스템",
              },
            ]}
          />
        </section>
      </RevealOnScroll>
    </div></div>
  );
}

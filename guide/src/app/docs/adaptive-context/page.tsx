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

export default function AdaptiveContextPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/core/adaptive-context.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">AdaptiveContext</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="core" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              모델별 컨텍스트 윈도우를 최적화하는 적응형 컨텍스트 로딩 모듈입니다.
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
                <code className="text-cyan-600">AdaptiveContext</code>는 사용자 입력의 복잡도를
                분석하여 LLM에게 전달할 컨텍스트의 양을 자동으로 조절하는 모듈입니다. &quot;ls
                실행해줘&quot; 같은 간단한 요청에 프로젝트 전체 구조를 보낼 필요는 없고, &quot;전체
                아키텍처를 리팩토링해줘&quot; 같은 복잡한 작업에는 모든 정보가 필요합니다.
              </p>
              <p>
                <strong>점수 기반 휴리스틱</strong>으로 작업 복잡도를
                <code className="text-cyan-600">&quot;simple&quot;</code>,
                <code className="text-cyan-600">&quot;moderate&quot;</code>,
                <code className="text-cyan-600">&quot;complex&quot;</code> 중 하나로 분류합니다.
                키워드 패턴 매칭, 입력 길이(단어 수), 파일 참조 수 등 세 가지 신호를 종합적으로
                평가합니다.
              </p>
              <p>
                분류된 복잡도에 따라 <code className="text-cyan-600">ContextStrategy</code>가
                결정되며, 이 전략은 레포 맵 포함 여부, 전체 지침 포함 여부, 시스템 프롬프트 섹션 수
                등을 제어합니다. 결과적으로 간단한 작업은 빠르게, 복잡한 작업은 풍부한 정보와 함께
                처리됩니다.
              </p>
            </div>

            <MermaidDiagram
              title="AdaptiveContext 아키텍처 위치"
              titleColor="purple"
              chart={`graph TD
  USER["사용자 입력<br/><small>자연어 메시지</small>"]
  AC["AdaptiveContext<br/><small>adaptive-context.ts</small>"]
  SPB["System Prompt Builder<br/><small>system-prompt.ts</small>"]
  RM["Repo Map<br/><small>프로젝트 파일 구조</small>"]
  INST["Instructions<br/><small>DBCODE.md, 설정 파일</small>"]
  LLM["LLM Client<br/><small>llm/client.ts</small>"]

  USER -->|"estimateTaskComplexity()"| AC
  AC -->|"ContextStrategy"| SPB
  SPB -->|"includeRepoMap?"| RM
  SPB -->|"includeFullInstructions?"| INST
  SPB -->|"시스템 프롬프트"| LLM

  style AC fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style USER fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style SPB fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style RM fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style INST fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style LLM fill:#e0e7ff,stroke:#64748b,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> 택배 배송을 떠올리세요. 편지봉투(간단한 질문)에는 소형 차량,
              가전제품(일반 작업)에는 중형 트럭, 이사짐(대규모 리팩토링)에는 대형 트럭을 보냅니다.
              화물(컨텍스트)의 크기에 맞춰 차량(프롬프트)을 자동으로 배정하는 것이 이 모듈의
              역할입니다.
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

            {/* TaskComplexity type */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              type TaskComplexity
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              작업 복잡도 수준을 나타내는 유니온 타입입니다.
            </p>
            <CodeBlock>
              <span className="kw">type</span> <span className="type">TaskComplexity</span> ={" "}
              <span className="str">&quot;simple&quot;</span> |{" "}
              <span className="str">&quot;moderate&quot;</span> |{" "}
              <span className="str">&quot;complex&quot;</span>;
            </CodeBlock>
            <div className="text-[13px] text-gray-600 mt-2 space-y-1">
              <p>
                &bull; <code className="text-emerald-600">&quot;simple&quot;</code> &mdash; 파일
                읽기, 간단한 질문, 한 줄 수정 등
              </p>
              <p>
                &bull; <code className="text-amber-600">&quot;moderate&quot;</code> &mdash; 함수
                추가, 버그 수정 등 일반적인 개발 작업
              </p>
              <p>
                &bull; <code className="text-red-600">&quot;complex&quot;</code> &mdash; 대규모
                리팩토링, 아키텍처 변경, 다중 파일 수정
              </p>
            </div>

            {/* ContextStrategy interface */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface ContextStrategy
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              작업 복잡도에 따른 컨텍스트 로딩 전략입니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "includeRepoMap",
                  type: "boolean",
                  required: true,
                  desc: "저장소 맵(프로젝트 파일 구조)을 시스템 프롬프트에 포함할지",
                },
                {
                  name: "includeFullInstructions",
                  type: "boolean",
                  required: true,
                  desc: "전체 프로젝트 지침(DBCODE.md 등)을 포함할지",
                },
                {
                  name: "maxSystemPromptSections",
                  type: "number",
                  required: true,
                  desc: "시스템 프롬프트에 포함할 최대 섹션 수",
                },
              ]}
            />

            <div className="overflow-x-auto mt-4">
              <table className="w-full text-[12px] text-gray-600 border-collapse">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 pr-3 text-gray-900 font-bold">복잡도</th>
                    <th className="text-left py-2 pr-3 text-gray-900 font-bold">repoMap</th>
                    <th className="text-left py-2 pr-3 text-gray-900 font-bold">
                      fullInstructions
                    </th>
                    <th className="text-left py-2 pr-3 text-gray-900 font-bold">maxSections</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 pr-3">
                      <code className="text-emerald-600">simple</code>
                    </td>
                    <td className="py-2 pr-3">false</td>
                    <td className="py-2 pr-3">false</td>
                    <td className="py-2 pr-3">4</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 pr-3">
                      <code className="text-amber-600">moderate</code>
                    </td>
                    <td className="py-2 pr-3">true</td>
                    <td className="py-2 pr-3">true</td>
                    <td className="py-2 pr-3">8</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-3">
                      <code className="text-red-600">complex</code>
                    </td>
                    <td className="py-2 pr-3">true</td>
                    <td className="py-2 pr-3">true</td>
                    <td className="py-2 pr-3">16</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* estimateTaskComplexity */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              estimateTaskComplexity(input)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              사용자 입력 텍스트로부터 작업 복잡도를 추정합니다. 점수 기반 휴리스틱으로 키워드,
              길이, 파일 참조를 종합 평가합니다.
            </p>
            <CodeBlock>
              <span className="kw">function</span>{" "}
              <span className="fn">estimateTaskComplexity</span>(<span className="prop">input</span>
              : <span className="type">string</span>): <span className="type">TaskComplexity</span>
            </CodeBlock>
            <ParamTable
              params={[
                {
                  name: "input",
                  type: "string",
                  required: true,
                  desc: "사용자의 원본 입력 텍스트",
                },
                {
                  name: "(반환)",
                  type: "TaskComplexity",
                  required: true,
                  desc: '추정된 복잡도 ("simple" | "moderate" | "complex")',
                },
              ]}
            />

            {/* getContextStrategy */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              getContextStrategy(complexity)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              주어진 작업 복잡도에 맞는 컨텍스트 로딩 전략을 반환합니다.
            </p>
            <CodeBlock>
              <span className="kw">function</span> <span className="fn">getContextStrategy</span>(
              <span className="prop">complexity</span>: <span className="type">TaskComplexity</span>
              ): <span className="type">ContextStrategy</span>
            </CodeBlock>
            <ParamTable
              params={[
                {
                  name: "complexity",
                  type: "TaskComplexity",
                  required: true,
                  desc: "추정된 작업 복잡도",
                },
                {
                  name: "(반환)",
                  type: "ContextStrategy",
                  required: true,
                  desc: "해당 복잡도에 맞는 컨텍스트 전략 객체",
                },
              ]}
            />

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                복잡도 추정은 <strong>휴리스틱</strong>입니다. 100% 정확하지 않으며, 짧지만 복잡한
                요청이나 길지만 간단한 요청에서 오판할 수 있습니다.
              </li>
              <li>
                빈 문자열 입력은 항상 <code className="text-cyan-600">&quot;simple&quot;</code>로
                분류됩니다.
              </li>
              <li>
                키워드 패턴은 <strong>영어</strong> 기반입니다. 한국어로
                &quot;리팩토링해줘&quot;라고 입력해도
                <code className="text-cyan-600">COMPLEX_INDICATORS</code>에 매칭되지 않습니다. 단,
                &quot;refactor&quot; 같은 영어 키워드가 포함되면 매칭됩니다.
              </li>
              <li>
                파일 참조 감지는 확장자 기반(<code>.ts</code>, <code>.py</code> 등)이므로, 확장자
                없는 파일이나 비표준 확장자는 감지되지 않습니다.
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
              기본 사용법 &mdash; 프롬프트 빌더에서 활용
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              사용자 입력을 받으면 복잡도를 추정하고, 전략에 따라 시스템 프롬프트를 구성합니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 1. 복잡도 추정"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">complexity</span> ={" "}
              <span className="fn">estimateTaskComplexity</span>(
              <span className="prop">userInput</span>);
              {"\n"}
              {"\n"}
              <span className="cm">{"// 2. 전략 가져오기"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">strategy</span> ={" "}
              <span className="fn">getContextStrategy</span>(
              <span className="prop">complexity</span>);
              {"\n"}
              {"\n"}
              <span className="cm">{"// 3. 전략에 따라 프롬프트 구성"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">sections</span>:{" "}
              <span className="type">string</span>[] = [];
              {"\n"}
              <span className="kw">if</span> (<span className="prop">strategy</span>.
              <span className="prop">includeRepoMap</span>) {"{"}
              {"\n"}
              {"  "}
              <span className="prop">sections</span>.<span className="fn">push</span>(
              <span className="kw">await</span> <span className="fn">buildRepoMap</span>());
              {"\n"}
              {"}"}
              {"\n"}
              <span className="kw">if</span> (<span className="prop">strategy</span>.
              <span className="prop">includeFullInstructions</span>) {"{"}
              {"\n"}
              {"  "}
              <span className="prop">sections</span>.<span className="fn">push</span>(
              <span className="kw">await</span> <span className="fn">loadInstructions</span>());
              {"\n"}
              {"}"}
              {"\n"}
              {"\n"}
              <span className="cm">{"// 최대 섹션 수 제한"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">limited</span> ={" "}
              <span className="prop">sections</span>.<span className="fn">slice</span>(
              <span className="num">0</span>, <span className="prop">strategy</span>.
              <span className="prop">maxSystemPromptSections</span>);
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> 복잡도 추정은 첫 번째 사용자 입력에 대해서만 수행됩니다. 대화
              도중 작업 복잡도가 변할 수 있지만, 이미 로드된 컨텍스트를 줄이지는 않습니다. 필요하면{" "}
              <code>estimateTaskComplexity()</code>를 다시 호출하여 전략을 업데이트하세요.
            </Callout>

            {/* 점수 계산 예시 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 점수 계산 예시
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              다양한 입력에 대한 점수 계산 과정을 보여줍니다.
            </p>
            <CodeBlock>
              <span className="cm">{'// 예시 1: "ls 실행해줘" → simple'}</span>
              {"\n"}
              <span className="cm">{"// - SIMPLE_INDICATORS 매칭: /^ls\\b/ → -2"}</span>
              {"\n"}
              <span className="cm">{"// - 단어 수: 2개 (임계값 미달)"}</span>
              {"\n"}
              <span className="cm">{"// - 최종 점수: -2 → simple"}</span>
              {"\n"}
              {"\n"}
              <span className="cm">{'// 예시 2: "auth 모듈 refactor해줘" → moderate'}</span>
              {"\n"}
              <span className="cm">{"// - COMPLEX_INDICATORS 매칭: /refactor/i → +2"}</span>
              {"\n"}
              <span className="cm">{"// - 단어 수: 3개 (임계값 미달)"}</span>
              {"\n"}
              <span className="cm">{"// - 최종 점수: 2 → moderate"}</span>
              {"\n"}
              {"\n"}
              <span className="cm">
                {'// 예시 3: "implement a new pipeline across multiple files" → complex'}
              </span>
              {"\n"}
              <span className="cm">
                {"// - COMPLEX_INDICATORS 매칭: /implement\\s+...pipeline/ → +2"}
              </span>
              {"\n"}
              <span className="cm">
                {"// - COMPLEX_INDICATORS 매칭: /across\\s+multiple\\s+files/ → +2"}
              </span>
              {"\n"}
              <span className="cm">{"// - 최종 점수: 4 → complex"}</span>
            </CodeBlock>

            <DeepDive title="점수 보정 규칙 상세">
              <p className="mb-3">복잡도 점수는 다음 4가지 신호를 종합하여 계산됩니다:</p>
              <ul className="list-disc list-inside space-y-1.5 text-gray-600">
                <li>
                  <strong>복잡한 키워드</strong> 매칭: <code className="text-cyan-600">+2점</code>{" "}
                  (refactor, architect, migrate, implement new system 등 12개 패턴)
                </li>
                <li>
                  <strong>간단한 키워드</strong> 매칭: <code className="text-cyan-600">-2점</code>{" "}
                  (what, where, ls, cat, fix a typo 등 8개 패턴)
                </li>
                <li>
                  <strong>단어 수</strong>: 30개 이상 <code>+1점</code>, 80개 이상 <code>+2점</code>
                </li>
                <li>
                  <strong>파일 참조</strong>: 3개 이상의 파일명(.ts, .py 등) <code>+1점</code>
                </li>
              </ul>
              <p className="mt-3">최종 점수 매핑:</p>
              <ul className="list-disc list-inside space-y-1 text-gray-600 mt-1">
                <li>
                  <code>3점 이상</code> → <code className="text-red-600">&quot;complex&quot;</code>
                </li>
                <li>
                  <code>1~2점</code> → <code className="text-amber-600">&quot;moderate&quot;</code>
                </li>
                <li>
                  <code>0점 이하</code> →{" "}
                  <code className="text-emerald-600">&quot;simple&quot;</code>
                </li>
              </ul>
              <p className="mt-3 text-amber-600">
                여러 복잡한 키워드가 동시에 매칭되면 점수가 합산됩니다. 예를 들어 &quot;refactor and
                migrate&quot;는 +4점으로 바로 &quot;complex&quot;가 됩니다. 반면 복잡한 키워드와
                간단한 키워드가 동시에 있으면 상쇄됩니다.
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
              복잡도 추정 흐름
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              사용자 입력이 들어오면 세 가지 분석을 수행하여 최종 점수를 계산합니다.
            </p>

            <MermaidDiagram
              title="복잡도 추정 파이프라인"
              titleColor="purple"
              chart={`graph TD
  INPUT["사용자 입력<br/><small>자연어 텍스트</small>"]
  EMPTY{"빈 문자열?"}
  KW["키워드 분석<br/><small>COMPLEX: +2 / SIMPLE: -2</small>"]
  WC["단어 수 분석<br/><small>30+ 단어: +1 / 80+: +2</small>"]
  FR["파일 참조 분석<br/><small>3+ 파일: +1</small>"]
  SCORE["점수 합산"]
  S3{"점수 >= 3?"}
  S1{"점수 >= 1?"}
  COMPLEX["complex<br/><small>전체 컨텍스트 로드</small>"]
  MODERATE["moderate<br/><small>균형 잡힌 컨텍스트</small>"]
  SIMPLE["simple<br/><small>최소 컨텍스트</small>"]

  INPUT --> EMPTY
  EMPTY -->|"Yes"| SIMPLE
  EMPTY -->|"No"| KW
  KW --> SCORE
  WC --> SCORE
  FR --> SCORE
  SCORE --> S3
  S3 -->|"Yes"| COMPLEX
  S3 -->|"No"| S1
  S1 -->|"Yes"| MODERATE
  S1 -->|"No"| SIMPLE

  style INPUT fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style SCORE fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style COMPLEX fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style MODERATE fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style SIMPLE fill:#dcfce7,stroke:#10b981,color:#065f46`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              핵심 코드 분석
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">estimateTaskComplexity()</code>의 점수 계산 핵심
              로직입니다.
            </p>
            <CodeBlock>
              <span className="kw">function</span>{" "}
              <span className="fn">estimateTaskComplexity</span>(<span className="prop">input</span>
              : <span className="type">string</span>): <span className="type">TaskComplexity</span>{" "}
              {"{"}
              {"\n"}
              {"  "}
              <span className="kw">let</span> <span className="prop">score</span> ={" "}
              <span className="num">0</span>;{"\n"}
              {"\n"}
              {"  "}
              <span className="cm">{"// [1] 복잡한 키워드: +2점씩"}</span>
              {"\n"}
              {"  "}
              <span className="kw">for</span> (<span className="kw">const</span>{" "}
              <span className="prop">pattern</span> <span className="kw">of</span>{" "}
              <span className="prop">COMPLEX_INDICATORS</span>) {"{"}
              {"\n"}
              {"    "}
              <span className="kw">if</span> (<span className="prop">pattern</span>.
              <span className="fn">test</span>(<span className="prop">trimmed</span>)){" "}
              <span className="prop">score</span> += <span className="num">2</span>;{"\n"}
              {"  "}
              {"}"}
              {"\n"}
              {"\n"}
              {"  "}
              <span className="cm">{"// [2] 간단한 키워드: -2점씩"}</span>
              {"\n"}
              {"  "}
              <span className="kw">for</span> (<span className="kw">const</span>{" "}
              <span className="prop">pattern</span> <span className="kw">of</span>{" "}
              <span className="prop">SIMPLE_INDICATORS</span>) {"{"}
              {"\n"}
              {"    "}
              <span className="kw">if</span> (<span className="prop">pattern</span>.
              <span className="fn">test</span>(<span className="prop">trimmed</span>)){" "}
              <span className="prop">score</span> -= <span className="num">2</span>;{"\n"}
              {"  "}
              {"}"}
              {"\n"}
              {"\n"}
              {"  "}
              <span className="cm">{"// [3] 단어 수 보정"}</span>
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">wordCount</span> ={" "}
              <span className="prop">trimmed</span>.<span className="fn">split</span>(
              <span className="str">/\\s+/</span>).<span className="prop">length</span>;{"\n"}
              {"  "}
              <span className="kw">if</span> (<span className="prop">wordCount</span> {">="}{" "}
              <span className="num">80</span>) <span className="prop">score</span> +={" "}
              <span className="num">2</span>;{"\n"}
              {"  "}
              <span className="kw">else if</span> (<span className="prop">wordCount</span> {">="}{" "}
              <span className="num">30</span>) <span className="prop">score</span> +={" "}
              <span className="num">1</span>;{"\n"}
              {"\n"}
              {"  "}
              <span className="cm">{"// [4] 파일 참조 수 보정"}</span>
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">fileRefs</span> ={" "}
              <span className="prop">trimmed</span>.<span className="fn">match</span>(
              <span className="str">/[\\w.-]+\\.(?:ts|js|py|...)/g</span>);
              {"\n"}
              {"  "}
              <span className="kw">if</span> ((<span className="prop">fileRefs</span>?.
              <span className="prop">length</span> ?? <span className="num">0</span>) {">="}{" "}
              <span className="num">3</span>) <span className="prop">score</span> +={" "}
              <span className="num">1</span>;{"\n"}
              {"\n"}
              {"  "}
              <span className="cm">{"// [5] 최종 분류"}</span>
              {"\n"}
              {"  "}
              <span className="kw">if</span> (<span className="prop">score</span> {">="}{" "}
              <span className="num">3</span>) <span className="kw">return</span>{" "}
              <span className="str">&quot;complex&quot;</span>;{"\n"}
              {"  "}
              <span className="kw">if</span> (<span className="prop">score</span> {">="}{" "}
              <span className="num">1</span>) <span className="kw">return</span>{" "}
              <span className="str">&quot;moderate&quot;</span>;{"\n"}
              {"  "}
              <span className="kw">return</span> <span className="str">&quot;simple&quot;</span>;
              {"\n"}
              {"}"}
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">[1-2]</strong> 복잡/간단 키워드를 모두 스캔합니다.
                하나의 입력에 여러 키워드가 매칭되면 점수가 누적됩니다.
              </p>
              <p>
                <strong className="text-gray-900">[3]</strong> 단어 수가 많을수록 복잡한 요청일
                가능성이 높습니다. 80단어 이상이면 +2점, 30단어 이상이면 +1점.
              </p>
              <p>
                <strong className="text-gray-900">[4]</strong> 3개 이상의 소스 파일을 참조하면 다중
                파일 작업으로 판단하여 +1점.
              </p>
              <p>
                <strong className="text-gray-900">[5]</strong> 최종 점수를 3단계로 매핑합니다. 상쇄
                효과로 음수가 될 수도 있으며, 0 이하는 모두 &quot;simple&quot;입니다.
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
                &quot;복잡한 작업인데 simple로 분류돼요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                키워드 패턴은 영어 기반이므로, 한국어만으로 작성된 요청은 복잡도 신호가 부족할 수
                있습니다. &quot;refactor&quot;, &quot;migrate&quot;, &quot;implement new
                system&quot; 같은 영어 키워드를 포함하면 정확하게 분류됩니다. 또한 단어 수가 30개
                미만이고 파일 참조도 3개 미만이면 점수가 올라갈 여지가 없습니다.
              </p>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;간단한 질문인데 complex로 분류돼요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                &quot;what is the architecture decision for...&quot;처럼 질문 형태이지만
                &quot;architecture&quot; 같은 복잡 키워드가 포함되면 점수가 올라갑니다.
                <code className="text-cyan-600">SIMPLE_INDICATORS</code>의 <code>/^what\\b/i</code>{" "}
                패턴으로 -2점 상쇄되지만, 복잡 키워드가 여러 개 매칭되면 상쇄를 넘어설 수 있습니다.
              </p>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;컨텍스트 전략을 수동으로 오버라이드하고 싶어요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                현재 수동 오버라이드 API는 없습니다.{" "}
                <code className="text-cyan-600">getContextStrategy()</code>를 직접 호출하여 원하는
                복잡도의 전략을 가져올 수 있습니다. 예:{" "}
                <code className="text-cyan-600">getContextStrategy(&quot;complex&quot;)</code>로
                항상 최대 컨텍스트를 사용.
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
                  name: "context-manager.ts",
                  slug: "context-manager",
                  relation: "parent",
                  desc: "3-Layer 컨텍스트 관리 - AdaptiveContext의 전략에 따라 프롬프트 크기를 조절",
                },
                {
                  name: "system-prompt-cache.ts",
                  slug: "system-prompt-cache",
                  relation: "sibling",
                  desc: "컨텍스트 전략이 바뀌면 캐시 무효화가 필요할 수 있음",
                },
                {
                  name: "token-counter.ts",
                  slug: "token-counter",
                  relation: "sibling",
                  desc: "컨텍스트 전략의 maxSystemPromptSections 한도를 토큰 기반으로 검증",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}

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

export default function CmdStatsPage() {
  return (
    <div className="min-h-screen pt-10 pb-20">
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/commands/stats.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">/stats</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="leaf" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              현재 세션의 종합 사용 통계를 시각적 막대 차트와 함께 표시하는 슬래시 명령어입니다.
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
                <code className="text-cyan-600">/stats</code>는 현재 세션의 사용 현황을 한눈에
                파악할 수 있는 통계 대시보드를 제공합니다. 세션 지속 시간, 토큰 사용량, 예상 비용,
                도구별 호출 빈도, 사용자 턴 수, 에러 횟수 등을 시각적 블록 차트로 보여줍니다.
              </p>
              <p>
                내부적으로 <code className="text-cyan-600">metrics</code> 텔레메트리 시스템에서
                카운터 데이터를 수집합니다. 토큰 사용량은 입력/출력 비율을 블록 막대로 시각화하고,
                도구 호출은 사용 빈도 순으로 정렬하여 막대 차트를 생성합니다.
              </p>
              <p>
                이 파일은 명령어 외에도 <code className="text-cyan-600">formatDuration()</code>과
                <code className="text-cyan-600">getToolBreakdown()</code> 유틸리티 함수를 export하여
                다른 모듈에서도 재사용할 수 있습니다.
              </p>
            </div>

            <MermaidDiagram
              title="/stats 데이터 수집 흐름"
              titleColor="purple"
              chart={`graph TD
  CMD["/stats 실행"]

  CMD --> DUR["세션 지속 시간<br/><small>Date.now() - sessionStartedAt</small>"]
  CMD --> TOK["토큰 사용량<br/><small>metrics.getCounter(tokensUsed)</small>"]
  CMD --> COST["예상 비용<br/><small>metrics.getCounter(tokenCost)</small>"]
  CMD --> TOOLS["도구 사용 빈도<br/><small>getToolBreakdown()</small>"]
  CMD --> TURNS["사용자 턴 수<br/><small>messages.filter(user)</small>"]
  CMD --> ERRS["에러 횟수<br/><small>metrics.getCounter(errors)</small>"]

  DUR --> OUTPUT["텍스트 출력<br/><small>시각적 막대 차트</small>"]
  TOK --> OUTPUT
  COST --> OUTPUT
  TOOLS --> OUTPUT
  TURNS --> OUTPUT
  ERRS --> OUTPUT

  style CMD fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style OUTPUT fill:#dcfce7,stroke:#10b981,color:#065f46,stroke-width:2px
  style DUR fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style TOK fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style COST fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style TOOLS fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style TURNS fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style ERRS fill:#e0e7ff,stroke:#64748b,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>출력 예시:</strong> <code>/stats</code>는 텍스트 기반 대시보드를 출력합니다.
              토큰 입력/출력 비율과 도구별 사용 빈도를 블록 문자(&#x2588;)로 시각화하여 터미널에서도
              직관적으로 파악할 수 있습니다.
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

            {/* formatDuration */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              formatDuration(ms)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              밀리초 단위의 시간을 사람이 읽기 쉬운 형식으로 변환합니다. 다른 모듈에서도 재사용할 수
              있도록 export됩니다.
            </p>
            <CodeBlock>
              <span className="kw">export function</span> <span className="fn">formatDuration</span>
              (<span className="prop">ms</span>: <span className="type">number</span>):{" "}
              <span className="type">string</span>
            </CodeBlock>
            <ParamTable
              params={[{ name: "ms", type: "number", required: true, desc: "밀리초 단위 시간" }]}
            />
            <div className="text-[13px] text-gray-600 mt-3 space-y-1">
              <p>
                &bull; <code className="text-cyan-600">7200000</code> &rarr;{" "}
                <code className="text-emerald-600">&quot;2h 0m 0s&quot;</code>
              </p>
              <p>
                &bull; <code className="text-cyan-600">2712000</code> &rarr;{" "}
                <code className="text-emerald-600">&quot;45m 12s&quot;</code>
              </p>
              <p>
                &bull; <code className="text-cyan-600">30000</code> &rarr;{" "}
                <code className="text-emerald-600">&quot;30s&quot;</code>
              </p>
            </div>

            {/* getToolBreakdown */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              getToolBreakdown()
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              메트릭에서 도구별 호출 횟수를 수집합니다. 알려진 도구(KNOWN_TOOLS) 13개를 먼저 확인한
              후, 카운터 데이터에서 추가 도구도 스캔합니다. 결과는 호출 횟수 내림차순으로
              정렬됩니다.
            </p>
            <CodeBlock>
              <span className="kw">export function</span>{" "}
              <span className="fn">getToolBreakdown</span>():{" "}
              <span className="type">ReadonlyArray</span>&lt;{"{"}
              {"\n"}
              {"  "}
              <span className="kw">readonly</span> <span className="prop">name</span>:{" "}
              <span className="type">string</span>;{"\n"}
              {"  "}
              <span className="kw">readonly</span> <span className="prop">count</span>:{" "}
              <span className="type">number</span>;{"\n"}
              {"}"}&gt;
            </CodeBlock>

            {/* KNOWN_TOOLS */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              KNOWN_TOOLS
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              사용량을 추적하는 도구 목록 상수입니다. 13개의 내장 도구를 포함합니다.
            </p>
            <CodeBlock>
              <span className="kw">const</span> <span className="prop">KNOWN_TOOLS</span>:{" "}
              <span className="kw">readonly</span> <span className="type">string</span>[] = [{"\n"}
              {"  "}
              <span className="str">&quot;file_read&quot;</span>,{" "}
              <span className="str">&quot;file_edit&quot;</span>,{" "}
              <span className="str">&quot;file_write&quot;</span>,{"\n"}
              {"  "}
              <span className="str">&quot;bash_exec&quot;</span>,{" "}
              <span className="str">&quot;grep_search&quot;</span>,{" "}
              <span className="str">&quot;glob_search&quot;</span>,{"\n"}
              {"  "}
              <span className="str">&quot;list_dir&quot;</span>,{" "}
              <span className="str">&quot;web_search&quot;</span>,{" "}
              <span className="str">&quot;web_fetch&quot;</span>,{"\n"}
              {"  "}
              <span className="str">&quot;notebook_edit&quot;</span>,{" "}
              <span className="str">&quot;mcp_tool&quot;</span>,{"\n"}
              {"  "}
              <span className="str">&quot;agent&quot;</span>,{" "}
              <span className="str">&quot;task&quot;</span>,{"\n"}]{" "}
              <span className="kw">as const</span>;
            </CodeBlock>

            {/* statsCommand */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              statsCommand: SlashCommand
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              <code className="text-cyan-600">/stats</code> 슬래시 명령어의 정의 객체입니다. 메트릭
              데이터를 수집하여 시각적 통계 출력을 생성합니다.
            </p>
            <ParamTable
              params={[
                { name: "name", type: '"stats"', required: true, desc: "명령어 이름" },
                {
                  name: "description",
                  type: "string",
                  required: true,
                  desc: '"Show usage statistics"',
                },
                { name: "usage", type: "string", required: true, desc: '"/stats"' },
                {
                  name: "execute",
                  type: "(args, context) => Promise<CommandResult>",
                  required: true,
                  desc: "명령어 실행 함수",
                },
              ]}
            />

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                <code className="text-cyan-600">sessionStartedAt</code>은 모듈 로드 시점에
                고정됩니다. 세션이 재개되더라도 &quot;지속 시간&quot;은 프로세스 시작 이후의 시간을
                표시합니다.
              </li>
              <li>
                토큰 사용량과 비용은 <code className="text-cyan-600">context.model</code>을 기준으로
                필터링합니다. 모델을 전환한 경우 이전 모델의 통계는 표시되지 않을 수 있습니다.
              </li>
              <li>
                <code className="text-cyan-600">getToolBreakdown()</code>은{" "}
                <code className="text-cyan-600">status: &quot;success&quot;</code>인 호출만
                카운트합니다. 실패한 도구 호출은 통계에 포함되지 않습니다.
              </li>
              <li>
                막대 차트의 최대 길이는 토큰에 30블록, 도구에 14블록으로 하드코딩되어 있습니다.
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
              기본 사용법 &mdash; 세션 통계 확인
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              인자 없이 실행하면 현재 세션의 전체 통계를 표시합니다.
            </p>
            <CodeBlock>
              <span className="fn">/stats</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// 출력 예시:"}</span>
              {"\n"}
              <span className="cm">{"// Session Statistics"}</span>
              {"\n"}
              <span className="cm">{"// =================="}</span>
              {"\n"}
              <span className="cm">{"// "}</span>
              {"\n"}
              <span className="cm">{"//   Duration:    45m 12s"}</span>
              {"\n"}
              <span className="cm">{"//   Model:       gpt-4o"}</span>
              {"\n"}
              <span className="cm">{"//   Session:     a1b2c3d4"}</span>
              {"\n"}
              <span className="cm">{"// "}</span>
              {"\n"}
              <span className="cm">{"//   Tokens:"}</span>
              {"\n"}
              <span className="cm">{"//     Input:     12,345     ████████████████████"}</span>
              {"\n"}
              <span className="cm">{"//     Output:    3,456      ██████████"}</span>
              {"\n"}
              <span className="cm">{"//     Total:     15,801"}</span>
              {"\n"}
              <span className="cm">{"// "}</span>
              {"\n"}
              <span className="cm">{"//   Cost:        $0.24"}</span>
              {"\n"}
              <span className="cm">{"// "}</span>
              {"\n"}
              <span className="cm">{"//   Tool Usage:  42 invocations"}</span>
              {"\n"}
              <span className="cm">{"//     file_read     18  ██████████████"}</span>
              {"\n"}
              <span className="cm">{"//     bash_exec     12  █████████"}</span>
              {"\n"}
              <span className="cm">{"//     file_edit      8  ██████"}</span>
              {"\n"}
              <span className="cm">{"//     grep_search    4  ███"}</span>
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> <code>/stats</code>는 현재 프로세스의 세션만 표시합니다. 이전
              세션의 통계를 보려면 해당 세션을 <code>/resume</code>로 재개한 후 확인하세요. 모델
              전환 시 이전 모델의 토큰/비용 통계는 표시되지 않을 수 있습니다.
            </Callout>

            <DeepDive title="시각적 막대 차트 생성 원리">
              <p className="mb-3">막대 차트는 블록 문자(&#x2588;)를 반복하여 생성합니다:</p>
              <CodeBlock>
                <span className="cm">{"// 토큰 막대: 최대 30블록"}</span>
                {"\n"}
                <span className="kw">const</span> <span className="prop">inputBar</span> ={" "}
                <span className="type">Math</span>.<span className="fn">round</span>({"\n"}
                {"  "}(<span className="prop">tokensInput</span> /{" "}
                <span className="prop">totalTokens</span>) * <span className="num">30</span>
                {"\n"});
                {"\n"}
                {"\n"}
                <span className="cm">{"// 도구 막대: 최대 14블록, 최소 1블록"}</span>
                {"\n"}
                <span className="kw">const</span> <span className="prop">barLen</span> ={" "}
                <span className="type">Math</span>.<span className="fn">max</span>(
                <span className="num">1</span>,{"\n"}
                {"  "}
                <span className="type">Math</span>.<span className="fn">round</span>((
                <span className="prop">tool</span>.<span className="prop">count</span> /{" "}
                <span className="prop">maxToolCount</span>) * <span className="num">14</span>){"\n"}
                );
              </CodeBlock>
              <p className="mt-3 text-gray-600">
                토큰 막대는 입력/출력의 <strong>비율</strong>을 나타내고, 도구 막대는 가장 많이
                사용된 도구 대비 <strong>상대적 빈도</strong>를 나타냅니다.
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
              도구 사용량 수집 전략
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">getToolBreakdown()</code>은 두 단계로 도구 사용량을
              수집합니다. 먼저 알려진 도구(KNOWN_TOOLS)를 확인한 뒤, 카운터 데이터에서 추가 도구를
              스캔합니다.
            </p>

            <MermaidDiagram
              title="getToolBreakdown() 수집 흐름"
              titleColor="purple"
              chart={`graph TD
  START["getToolBreakdown()"]

  START --> KNOWN["Phase 1: KNOWN_TOOLS 순회<br/><small>13개 알려진 도구 확인</small>"]
  START --> SCAN["Phase 2: 카운터 데이터 스캔<br/><small>추가 도구 발견</small>"]

  KNOWN --> CHECK1{"count > 0?"}
  SCAN --> PARSE["키 파싱<br/><small>tool=xyz, status=success</small>"]

  CHECK1 -->|"Yes"| ADD["toolCounts에 추가"]
  CHECK1 -->|"No"| SKIP["건너뛰기"]

  PARSE --> CHECK2{"이미 알려진 도구?"}
  CHECK2 -->|"Yes"| SKIP2["건너뛰기 (중복 방지)"]
  CHECK2 -->|"No"| ADD

  ADD --> SORT["호출 횟수 내림차순 정렬"]

  style START fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style KNOWN fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style SCAN fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style SORT fill:#dcfce7,stroke:#10b981,color:#065f46
  style CHECK1 fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style CHECK2 fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style ADD fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style PARSE fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style SKIP fill:#f1f5f9,stroke:#94a3b8,color:#64748b
  style SKIP2 fill:#f1f5f9,stroke:#94a3b8,color:#64748b`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              핵심 코드 분석
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              카운터 데이터에서 추가 도구를 스캔하는 Phase 2 로직입니다. 키 형식을 정규식으로
              파싱하여 도구명과 성공 상태를 추출합니다.
            </p>
            <CodeBlock>
              <span className="kw">const</span> <span className="prop">counterData</span> ={" "}
              <span className="prop">metrics</span>.<span className="fn">getCounterData</span>();
              {"\n"}
              <span className="kw">const</span> <span className="prop">toolPrefix</span> ={" "}
              <span className="prop">COUNTERS</span>.<span className="prop">toolInvocations</span>.
              <span className="prop">name</span>;{"\n"}
              {"\n"}
              <span className="kw">for</span> (<span className="kw">const</span>{" "}
              <span className="prop">key</span> <span className="kw">of</span>{" "}
              <span className="prop">counterData</span>.<span className="fn">keys</span>()) {"{"}
              {"\n"}
              {"  "}
              <span className="kw">if</span> (!<span className="prop">key</span>.
              <span className="fn">startsWith</span>(<span className="prop">toolPrefix</span>)){" "}
              <span className="kw">continue</span>;{"\n"}
              {"  "}
              <span className="cm">
                {"// 키 형식: dbcode.tools.invocations{status=success,tool=xyz}"}
              </span>
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">toolMatch</span> ={" "}
              <span className="prop">key</span>.<span className="fn">match</span>(
              <span className="str">/tool=([^,{"}"}]+)/</span>);
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">statusMatch</span> ={" "}
              <span className="prop">key</span>.<span className="fn">match</span>(
              <span className="str">/status=success/</span>);
              {"\n"}
              {"  "}
              <span className="kw">if</span> (<span className="prop">toolMatch</span> &&{" "}
              <span className="prop">statusMatch</span>) {"{"}
              {"\n"}
              {"    "}
              <span className="kw">const</span> <span className="prop">toolName</span> ={" "}
              <span className="prop">toolMatch</span>[<span className="num">1</span>];
              {"\n"}
              {"    "}
              <span className="cm">{"// 와일드카드와 이미 알려진 도구는 건너뛰기"}</span>
              {"\n"}
              {"    "}
              <span className="kw">if</span> (<span className="prop">toolName</span> ==={" "}
              <span className="str">&quot;*&quot;</span> || <span className="prop">knownSet</span>.
              <span className="fn">has</span>(<span className="prop">toolName</span>)){" "}
              <span className="kw">continue</span>;{"\n"}
              {"    "}
              <span className="cm">{"// 마지막 값이 카운트"}</span>
              {"\n"}
              {"    "}
              <span className="kw">const</span> <span className="prop">count</span> ={" "}
              <span className="prop">values</span>[<span className="prop">values</span>.
              <span className="prop">length</span> - <span className="num">1</span>].
              <span className="prop">value</span>;{"\n"}
              {"  "}
              {"}"}
              {"\n"}
              {"}"}
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">키 형식:</strong> 메트릭 카운터 키는{" "}
                <code className="text-cyan-600">
                  dbcode.tools.invocations{"{"}status=success,tool=file_read{"}"}
                </code>{" "}
                형식으로 레이블이 인코딩되어 있습니다.
              </p>
              <p>
                <strong className="text-gray-900">와일드카드 제외:</strong>{" "}
                <code className="text-cyan-600">tool=*</code>는 전체 집계용 와일드카드이므로 개별
                도구 목록에서 제외됩니다.
              </p>
              <p>
                <strong className="text-gray-900">중복 방지:</strong>{" "}
                <code className="text-cyan-600">knownSet</code>으로 Phase 1에서 이미 추가한 도구를
                건너뛰어 중복 카운팅을 방지합니다.
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
                &quot;토큰 사용량이 0으로 표시돼요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                토큰 메트릭은 <code className="text-cyan-600">context.model</code>을 기준으로
                필터링합니다. 세션 도중에 모델을 전환한 경우, 이전 모델의 통계는 현재 모델 기준에서
                보이지 않습니다. 또한 LLM 호출이 아직 발생하지 않은 세션 초기에는 당연히 0입니다.
              </p>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;도구 사용량에 특정 도구가 빠져 있어요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">getToolBreakdown()</code>은{" "}
                <code className="text-cyan-600">status: &quot;success&quot;</code>인 호출만
                카운트합니다. 도구 호출이 모두 실패했다면 통계에 나타나지 않습니다. 또한 MCP 도구 등
                KNOWN_TOOLS에 없는 도구는 Phase 2에서 카운터 데이터를 스캔하여 발견하는데, 카운터에
                기록되지 않은 경우 누락될 수 있습니다.
              </p>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;세션 지속 시간이 실제보다 짧게 표시돼요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">sessionStartedAt</code>은 stats.ts 모듈이
                <strong>로드되는 시점</strong>에 <code className="text-cyan-600">Date.now()</code>로
                고정됩니다.
                <code className="text-cyan-600">/resume</code>로 세션을 재개하더라도 원래 세션의
                시작 시각이 아닌 현재 프로세스의 시작 시각을 기준으로 계산합니다.
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
                  name: "registry.ts",
                  slug: "cmd-registry",
                  relation: "parent",
                  desc: "모든 슬래시 명령어를 등록하고 관리하는 레지스트리 — statsCommand도 여기에 등록됩니다",
                },
                {
                  name: "token-counter.ts",
                  slug: "token-counter",
                  relation: "sibling",
                  desc: "토큰 수를 정확하게 카운팅하는 모듈 — /stats에서 표시하는 토큰 데이터의 원천",
                },
                {
                  name: "resume.ts",
                  slug: "cmd-resume",
                  relation: "sibling",
                  desc: "/resume — 이전 세션을 재개하여 해당 세션의 통계를 확인할 수 있는 명령어",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}

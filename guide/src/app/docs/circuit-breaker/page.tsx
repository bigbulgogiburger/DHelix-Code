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

export default function CircuitBreakerPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}><div className="center-narrow">
      {/* ─── Header ─── */}
      <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <FilePath path="src/core/circuit-breaker.ts" />
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
            <span className="text-gray-900">
              CircuitBreaker
            </span>
          </h1>
          <div className="flex items-center gap-3 mb-5">
            <LayerBadge layer="core" />
          </div>
          <p className="text-[16px] text-gray-600 leading-relaxed">
            에이전트 루프가 무한 반복에 빠지는 것을 방지하는 안전장치 모듈입니다.
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
              <code className="text-cyan-600">CircuitBreaker</code>는 전기의 차단기(circuit breaker)에서
              이름을 따온 안전 패턴입니다. 에이전트 루프는 LLM 호출, 도구 실행, 결과 전달을 계속 반복하는데,
              가끔 LLM이 같은 실수를 되풀이하거나 아무 진전 없이 빙빙 도는 상황이 발생합니다.
            </p>
            <p>
              이 모듈은 매 반복마다 &quot;진전이 있는가?&quot;를 판단하고, 문제가 감지되면 회로를 차단하여
              루프를 자동으로 멈춥니다. 차단기가 없으면 토큰과 시간이 무한히 소모되므로,
              프로덕션 에이전트에서 반드시 필요한 안전장치입니다.
            </p>
            <p>
              상태는 두 가지뿐입니다: <code className="text-emerald-600">&quot;closed&quot;</code>(정상 &mdash;
              전기가 흐르는 상태)와 <code className="text-red-600">&quot;open&quot;</code>(차단됨 &mdash; 전기가
              끊긴 상태). 일반적인 &quot;열림/닫힘&quot; 직관과 반대라는 점을 주의하세요.
            </p>
          </div>

          <MermaidDiagram
            title="CircuitBreaker 아키텍처 위치"
            titleColor="purple"
            chart={`graph TD
  AL["Agent Loop<br/><small>agent-loop.ts</small>"]
  CB["CircuitBreaker<br/><small>circuit-breaker.ts</small>"]
  RE["Recovery Executor<br/><small>recovery-executor.ts</small>"]
  LLM["LLM Client<br/><small>llm/client.ts</small>"]
  TOOLS["Tool Executor<br/><small>tools/executor.ts</small>"]

  AL -->|"매 반복 결과 기록"| CB
  CB -->|"shouldContinue()"| AL
  AL --> LLM
  AL --> TOOLS
  AL -->|"차단 시 복구 위임"| RE

  style CB fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style AL fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style RE fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style LLM fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style TOOLS fill:#e0e7ff,stroke:#64748b,color:#1e293b`}
          />

          <Callout type="info" icon="💡">
            <strong>비유:</strong> 집의 전기 차단기를 떠올리세요. 전선에 과부하가 걸리면 차단기가 &quot;탁&quot;
            내려가서 전기를 끊어 화재를 방지합니다. 마찬가지로 이 모듈은 에이전트 루프의 과부하(무한 반복)를
            감지하면 루프를 자동으로 중단시킵니다.
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 2. 레퍼런스 (Reference) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>📖</span> 레퍼런스
          </h2>

          {/* IterationResult interface */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface IterationResult
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            에이전트 루프의 한 번의 반복 결과를 나타냅니다.
            서킷 브레이커가 &quot;진전이 있는지&quot; 판단하기 위해 이 데이터를 분석합니다.
          </p>
          <ParamTable
            params={[
              { name: "filesModified", type: "ReadonlySet<string>", required: true, desc: "이번 반복에서 수정된 파일 경로 목록 (빈 Set이면 파일 변경 없음)" },
              { name: "error", type: "string | undefined", required: false, desc: "발생한 에러 메시지 (없으면 undefined)" },
              { name: "hasOutput", type: "boolean", required: true, desc: "LLM이 텍스트 출력을 생성했는지 여부" },
            ]}
          />

          {/* CircuitState type */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            type CircuitState
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            서킷 브레이커의 두 가지 상태를 나타내는 유니온 타입입니다.
          </p>
          <CodeBlock>
            <span className="kw">type</span> <span className="type">CircuitState</span> = <span className="str">&quot;closed&quot;</span> | <span className="str">&quot;open&quot;</span>;
          </CodeBlock>
          <div className="text-[13px] text-gray-600 mt-2 space-y-1">
            <p>&bull; <code className="text-emerald-600">&quot;closed&quot;</code> &mdash; 정상 상태. 루프가 계속 실행됩니다. (전기가 흐르는 상태)</p>
            <p>&bull; <code className="text-red-600">&quot;open&quot;</code> &mdash; 차단 상태. 루프가 즉시 중단됩니다. (전기가 끊긴 상태)</p>
          </div>

          {/* CircuitBreakerStatus interface */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface CircuitBreakerStatus
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            서킷 브레이커의 현재 상태 스냅샷입니다. 디버깅이나 UI 표시에 사용됩니다.
          </p>
          <ParamTable
            params={[
              { name: "state", type: "CircuitState", required: true, desc: '현재 회로 상태 ("closed" 또는 "open")' },
              { name: "reason", type: "string | undefined", required: false, desc: "차단된 이유 (차단되지 않았으면 undefined)" },
              { name: "iterationCount", type: "number", required: true, desc: "지금까지 실행된 반복 횟수" },
              { name: "consecutiveNoChangeCount", type: "number", required: true, desc: "연속으로 변경이 없었던 횟수" },
              { name: "consecutiveSameErrorCount", type: "number", required: true, desc: "연속으로 같은 에러가 발생한 횟수" },
            ]}
          />

          {/* CircuitBreaker class */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            class CircuitBreaker
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            에이전트 루프의 무한 반복을 방지하는 메인 클래스입니다.
            세 가지 차단 조건 중 하나라도 충족되면 회로를 엽니다(차단).
          </p>

          {/* Constructor */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            constructor
          </h4>
          <CodeBlock>
            <span className="kw">constructor</span>(<span className="prop">maxIterations</span>?: <span className="type">number</span>)
          </CodeBlock>
          <ParamTable
            params={[
              { name: "maxIterations", type: "number | undefined", required: false, desc: "최대 허용 반복 횟수 (기본값: 50)" },
            ]}
          />

          {/* recordIteration */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            recordIteration(result)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            매 반복이 끝날 때마다 호출합니다. 결과를 분석하여 진전 여부를 판단하고,
            문제가 감지되면 회로를 차단합니다.
          </p>
          <CodeBlock>
            <span className="fn">recordIteration</span>(<span className="prop">result</span>: <span className="type">IterationResult</span>): <span className="type">void</span>
          </CodeBlock>
          <ParamTable
            params={[
              { name: "result", type: "IterationResult", required: true, desc: "이번 반복의 실행 결과 객체" },
            ]}
          />

          {/* shouldContinue */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            shouldContinue()
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            에이전트 루프가 계속 실행해도 되는지 확인합니다.
          </p>
          <CodeBlock>
            <span className="fn">shouldContinue</span>(): <span className="type">boolean</span>
            {"\n"}<span className="cm">// true  → 계속 실행 가능 (closed 상태)</span>
            {"\n"}<span className="cm">// false → 즉시 중지 필요 (open 상태)</span>
          </CodeBlock>

          {/* getStatus */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            getStatus()
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            현재 서킷 브레이커의 상태 스냅샷을 반환합니다. 디버깅이나 UI 표시에 유용합니다.
          </p>
          <CodeBlock>
            <span className="fn">getStatus</span>(): <span className="type">CircuitBreakerStatus</span>
          </CodeBlock>

          {/* reset */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            reset()
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            서킷 브레이커를 초기 상태로 리셋합니다.
            새 에이전트 루프를 시작하거나 수동 복구 후에 사용합니다.
          </p>
          <CodeBlock>
            <span className="fn">reset</span>(): <span className="type">void</span>
          </CodeBlock>

          {/* Caveats */}
          <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
          <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
            <li>
              <code className="text-cyan-600">&quot;closed&quot;</code>가 &quot;정상&quot;이고
              <code className="text-cyan-600">&quot;open&quot;</code>이 &quot;차단&quot;입니다.
              일상적인 열림/닫힘 직관과 반대이므로 주의하세요.
            </li>
            <li>
              이미 <code className="text-cyan-600">&quot;open&quot;</code> 상태에서
              <code className="text-cyan-600">recordIteration()</code>을 호출하면 아무 동작도 하지 않습니다.
              (early return)
            </li>
            <li>
              <code className="text-cyan-600">reset()</code>을 호출하면 모든 카운터와 상태가 초기화됩니다.
              새 대화/루프 시작 전에 반드시 호출해야 합니다.
            </li>
            <li>
              임계값 상수(<code className="text-cyan-600">NO_CHANGE_THRESHOLD = 5</code>,
              <code className="text-cyan-600">SAME_ERROR_THRESHOLD = 5</code>,
              <code className="text-cyan-600">DEFAULT_MAX_ITERATIONS = 50</code>)는
              모듈 내부에 하드코딩되어 있어 외부에서 변경할 수 없습니다.
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
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>기본 사용법 &mdash; 에이전트 루프에서 사용하기</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            가장 일반적인 사용 패턴입니다.
            에이전트 루프의 <code className="text-cyan-600">while</code> 조건으로 사용하고,
            매 반복 끝에 결과를 기록합니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 1. 서킷 브레이커 생성 (최대 50회 반복 허용)"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">circuitBreaker</span> = <span className="kw">new</span> <span className="fn">CircuitBreaker</span>(<span className="num">50</span>);
            {"\n"}
            {"\n"}<span className="cm">{"// 2. 루프 실행 — shouldContinue()가 false면 즉시 탈출"}</span>
            {"\n"}<span className="kw">while</span> (<span className="prop">circuitBreaker</span>.<span className="fn">shouldContinue</span>()) {"{"}
            {"\n"}{"  "}<span className="cm">{"// 3. LLM 호출 + 도구 실행"}</span>
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">response</span> = <span className="kw">await</span> <span className="fn">callLLM</span>(<span className="prop">messages</span>);
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">toolResult</span> = <span className="kw">await</span> <span className="fn">executeTool</span>(<span className="prop">response</span>);
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// 4. 반복 결과를 서킷 브레이커에 기록"}</span>
            {"\n"}{"  "}<span className="prop">circuitBreaker</span>.<span className="fn">recordIteration</span>({"{"}{"\n"}{"    "}<span className="prop">filesModified</span>: <span className="prop">toolResult</span>.<span className="prop">modifiedFiles</span>,
            {"\n"}{"    "}<span className="prop">error</span>: <span className="prop">toolResult</span>.<span className="prop">error</span>,
            {"\n"}{"    "}<span className="prop">hasOutput</span>: <span className="prop">response</span>.<span className="prop">text</span>.<span className="prop">length</span> {">"} <span className="num">0</span>,
            {"\n"}{"  "}{"}"});
            {"\n"}{"}"}
            {"\n"}
            {"\n"}<span className="cm">{"// 5. 루프 종료 후 상태 확인"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">status</span> = <span className="prop">circuitBreaker</span>.<span className="fn">getStatus</span>();
            {"\n"}<span className="kw">if</span> (<span className="prop">status</span>.<span className="prop">state</span> === <span className="str">&quot;open&quot;</span>) {"{"}
            {"\n"}{"  "}<span className="fn">logger</span>.<span className="fn">warn</span>(<span className="str">`서킷 브레이커 작동: ${"{"}</span><span className="prop">status</span>.<span className="prop">reason</span><span className="str">{"}"}`</span>);
            {"\n"}{"}"}
          </CodeBlock>

          <Callout type="warn" icon="!">
            <strong>주의:</strong> <code>recordIteration()</code>을 호출하지 않으면 서킷 브레이커가 아무것도
            감지하지 못합니다. 반드시 매 반복의 마지막에 호출하세요.
            호출을 잊으면 무한 루프에 빠질 수 있습니다.
          </Callout>

          {/* 고급 사용법: 커스텀 maxIterations */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; 반복 횟수 제한 커스터마이징
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            기본 최대 반복 횟수는 50회입니다. 서브에이전트처럼 짧은 작업에는 낮게,
            대규모 리팩토링처럼 긴 작업에는 높게 설정할 수 있습니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 서브에이전트용: 최대 10회"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">shortCB</span> = <span className="kw">new</span> <span className="fn">CircuitBreaker</span>(<span className="num">10</span>);
            {"\n"}
            {"\n"}<span className="cm">{"// 대규모 작업용: 최대 200회"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">longCB</span> = <span className="kw">new</span> <span className="fn">CircuitBreaker</span>(<span className="num">200</span>);
            {"\n"}
            {"\n"}<span className="cm">{"// 기본값 사용: 최대 50회"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">defaultCB</span> = <span className="kw">new</span> <span className="fn">CircuitBreaker</span>();
          </CodeBlock>

          {/* 고급 사용법: 상태 모니터링 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; 상태 모니터링과 차단 이유 확인
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">getStatus()</code>로 실시간 상태를 확인하여
            UI에 표시하거나 로그에 기록할 수 있습니다.
          </p>
          <CodeBlock>
            <span className="kw">const</span> <span className="prop">status</span> = <span className="prop">circuitBreaker</span>.<span className="fn">getStatus</span>();
            {"\n"}
            {"\n"}<span className="fn">console</span>.<span className="fn">log</span>(<span className="str">`상태: ${"{"}</span><span className="prop">status</span>.<span className="prop">state</span><span className="str">{"}"}`</span>);
            {"\n"}<span className="fn">console</span>.<span className="fn">log</span>(<span className="str">`반복 횟수: ${"{"}</span><span className="prop">status</span>.<span className="prop">iterationCount</span><span className="str">{"}"}`</span>);
            {"\n"}<span className="fn">console</span>.<span className="fn">log</span>(<span className="str">`무변경 연속: ${"{"}</span><span className="prop">status</span>.<span className="prop">consecutiveNoChangeCount</span><span className="str">{"}"}`</span>);
            {"\n"}<span className="fn">console</span>.<span className="fn">log</span>(<span className="str">`동일에러 연속: ${"{"}</span><span className="prop">status</span>.<span className="prop">consecutiveSameErrorCount</span><span className="str">{"}"}`</span>);
            {"\n"}
            {"\n"}<span className="kw">if</span> (<span className="prop">status</span>.<span className="prop">reason</span>) {"{"}
            {"\n"}{"  "}<span className="fn">console</span>.<span className="fn">log</span>(<span className="str">`차단 이유: ${"{"}</span><span className="prop">status</span>.<span className="prop">reason</span><span className="str">{"}"}`</span>);
            {"\n"}{"}"}
          </CodeBlock>

          <Callout type="tip" icon="*">
            <strong>팁:</strong> <code>getStatus()</code>는 상태의 <em>스냅샷</em>을 반환합니다.
            반환값을 변경해도 서킷 브레이커 내부 상태에는 영향이 없습니다 (readonly 프로퍼티).
          </Callout>

          <DeepDive title="reset() 사용 시 주의사항">
            <p className="mb-3">
              <code className="text-cyan-600">reset()</code>을 호출하면 <strong>모든</strong> 내부
              카운터가 0으로, 상태가 <code className="text-emerald-600">&quot;closed&quot;</code>로 돌아갑니다.
              다음 상황에서만 사용하세요:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-gray-600">
              <li>새로운 대화/에이전트 루프를 시작할 때</li>
              <li>사용자가 명시적으로 &quot;재시도&quot;를 요청했을 때</li>
              <li>Recovery Executor가 복구 전략을 적용한 후</li>
            </ul>
            <p className="mt-3 text-amber-600">
              루프 도중에 무분별하게 <code>reset()</code>을 호출하면 서킷 브레이커의
              보호 기능이 무효화되므로, 반드시 정당한 이유가 있을 때만 사용하세요.
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

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>상태 전이 다이어그램</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            서킷 브레이커는 두 상태 사이를 전이합니다.
            <code className="text-emerald-600">&quot;closed&quot;</code>에서 시작하여,
            차단 조건이 충족되면 <code className="text-red-600">&quot;open&quot;</code>으로 이동합니다.
            <code className="text-cyan-600">reset()</code>을 호출하면 다시
            <code className="text-emerald-600">&quot;closed&quot;</code>로 돌아갑니다.
          </p>

          <MermaidDiagram
            title="CircuitBreaker 상태 전이"
            titleColor="purple"
            chart={`graph TD
  START(("시작")) --> CLOSED["Closed<br/><small>정상 — 루프 실행 중</small>"]
  CLOSED -->|"진전 있음<br/>(파일 수정 or 출력)"| CLOSED
  CLOSED -->|"무변경 5회 연속"| OPEN["Open<br/><small>차단 — 루프 즉시 중단</small>"]
  CLOSED -->|"동일 에러 5회 연속"| OPEN
  CLOSED -->|"최대 반복 횟수 초과"| OPEN
  OPEN -->|"reset() 호출"| CLOSED
  OPEN -->|"루프 종료"| END(("종료"))

  RECORD["recordIteration()<br/><small>반복 결과 기록 + 카운터 분석</small>"] -.-> CLOSED
  REASON["openReason<br/><small>차단 사유 저장 + 추가 기록 무시</small>"] -.-> OPEN

  style CLOSED fill:#dcfce7,stroke:#10b981,color:#065f46,stroke-width:2px
  style OPEN fill:#fee2e2,stroke:#ef4444,color:#991b1b,stroke-width:2px
  style RECORD fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style REASON fill:#f1f5f9,stroke:#64748b,color:#1e293b`}
          />

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>핵심 코드 분석</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">recordIteration()</code> 메서드의 핵심 로직입니다.
            매 반복마다 이 코드가 실행되어 &quot;진전&quot;을 판단합니다.
          </p>
          <CodeBlock>
            <span className="fn">recordIteration</span>(<span className="prop">result</span>: <span className="type">IterationResult</span>): <span className="type">void</span> {"{"}
            {"\n"}{"  "}<span className="cm">{"// [1] 이미 open 상태면 아무것도 하지 않음"}</span>
            {"\n"}{"  "}<span className="kw">if</span> (<span className="kw">this</span>.<span className="prop">currentState</span> === <span className="str">&quot;open&quot;</span>) <span className="kw">return</span>;
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// [2] 반복 횟수 증가"}</span>
            {"\n"}{"  "}<span className="kw">this</span>.<span className="prop">iterationCount</span>++;
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// [3] 파일 수정도 없고 출력도 없으면 '무변경' 카운터 증가"}</span>
            {"\n"}{"  "}<span className="kw">if</span> (<span className="prop">result</span>.<span className="prop">filesModified</span>.<span className="prop">size</span> === <span className="num">0</span> && !<span className="prop">result</span>.<span className="prop">hasOutput</span>) {"{"}
            {"\n"}{"    "}<span className="kw">this</span>.<span className="prop">consecutiveNoChangeCount</span>++;
            {"\n"}{"  "}<span className="kw">{"}"} else {"{"}</span>
            {"\n"}{"    "}<span className="cm">{"// [4] 진전이 있으면 카운터 초기화"}</span>
            {"\n"}{"    "}<span className="kw">this</span>.<span className="prop">consecutiveNoChangeCount</span> = <span className="num">0</span>;
            {"\n"}{"  "}{"}"}
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// [5] 에러 반복 추적"}</span>
            {"\n"}{"  "}<span className="kw">if</span> (<span className="prop">result</span>.<span className="prop">error</span>) {"{"}
            {"\n"}{"    "}<span className="kw">if</span> (<span className="prop">result</span>.<span className="prop">error</span> === <span className="kw">this</span>.<span className="prop">lastError</span>) {"{"}
            {"\n"}{"      "}<span className="cm">{"// [6] 이전과 같은 에러 → 카운터 증가"}</span>
            {"\n"}{"      "}<span className="kw">this</span>.<span className="prop">consecutiveSameErrorCount</span>++;
            {"\n"}{"    "}<span className="kw">{"}"} else {"{"}</span>
            {"\n"}{"      "}<span className="cm">{"// [7] 다른 에러 → 카운터 리셋, 새 에러 저장"}</span>
            {"\n"}{"      "}<span className="kw">this</span>.<span className="prop">consecutiveSameErrorCount</span> = <span className="num">1</span>;
            {"\n"}{"      "}<span className="kw">this</span>.<span className="prop">lastError</span> = <span className="prop">result</span>.<span className="prop">error</span>;
            {"\n"}{"    "}{"}"}
            {"\n"}{"  "}<span className="kw">{"}"} else {"{"}</span>
            {"\n"}{"    "}<span className="cm">{"// [8] 에러 없으면 에러 카운터 초기화"}</span>
            {"\n"}{"    "}<span className="kw">this</span>.<span className="prop">consecutiveSameErrorCount</span> = <span className="num">0</span>;
            {"\n"}{"    "}<span className="kw">this</span>.<span className="prop">lastError</span> = <span className="kw">undefined</span>;
            {"\n"}{"  "}{"}"}
            {"\n"}{"}"}
          </CodeBlock>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
            <p><strong className="text-gray-900">[1]</strong> 이미 차단된 상태에서는 추가 기록이 의미 없으므로 즉시 반환합니다.</p>
            <p><strong className="text-gray-900">[2]</strong> 총 반복 횟수를 1 증가시킵니다. 이 값이 <code className="text-cyan-600">maxIterations</code>에 도달하면 차단됩니다.</p>
            <p><strong className="text-gray-900">[3-4]</strong> 파일 수정이나 텍스트 출력이 없으면 &quot;진전 없음&quot;으로 판단합니다. 진전이 있으면 무변경 카운터를 0으로 초기화합니다.</p>
            <p><strong className="text-gray-900">[5-6]</strong> 에러가 발생했고 이전 반복과 <strong>정확히 같은</strong> 에러 메시지라면, 같은 문제를 반복하고 있다고 판단합니다.</p>
            <p><strong className="text-gray-900">[7]</strong> 에러가 발생했지만 이전과 다른 에러라면, 카운터를 1로 리셋하고 새 에러를 저장합니다. (다른 문제이므로 연속 카운트 시작)</p>
            <p><strong className="text-gray-900">[8]</strong> 에러 없이 성공하면 에러 관련 카운터를 모두 초기화합니다.</p>
          </div>

          <DeepDive title="차단 조건 검사 로직 상세">
            <p className="mb-3">
              카운터 업데이트 후, 세 가지 차단 조건을 <strong>우선순위</strong> 순서로 검사합니다:
            </p>
            <CodeBlock>
              <span className="cm">{"// 조건 1: 최대 반복 횟수 초과 (하드 리밋)"}</span>
              {"\n"}<span className="kw">if</span> (<span className="kw">this</span>.<span className="prop">iterationCount</span> {">="} <span className="kw">this</span>.<span className="prop">maxIterations</span>) {"{"}
              {"\n"}{"  "}<span className="kw">this</span>.<span className="prop">currentState</span> = <span className="str">&quot;open&quot;</span>;
              {"\n"}{"  "}<span className="kw">this</span>.<span className="prop">openReason</span> = <span className="str">`Exceeded maximum iteration limit`</span>;
              {"\n"}{"}"}
              {"\n"}<span className="cm">{"// 조건 2: 연속 5회 무변경"}</span>
              {"\n"}<span className="kw">else if</span> (<span className="kw">this</span>.<span className="prop">consecutiveNoChangeCount</span> {">="} <span className="num">5</span>) {"{"}
              {"\n"}{"  "}<span className="kw">this</span>.<span className="prop">currentState</span> = <span className="str">&quot;open&quot;</span>;
              {"\n"}{"  "}<span className="kw">this</span>.<span className="prop">openReason</span> = <span className="str">`5 consecutive iterations with no change`</span>;
              {"\n"}{"}"}
              {"\n"}<span className="cm">{"// 조건 3: 동일 에러 5회 연속"}</span>
              {"\n"}<span className="kw">else if</span> (<span className="kw">this</span>.<span className="prop">consecutiveSameErrorCount</span> {">="} <span className="num">5</span>) {"{"}
              {"\n"}{"  "}<span className="kw">this</span>.<span className="prop">currentState</span> = <span className="str">&quot;open&quot;</span>;
              {"\n"}{"  "}<span className="kw">this</span>.<span className="prop">openReason</span> = <span className="str">`5 consecutive same error: ...`</span>;
              {"\n"}{"}"}
            </CodeBlock>
            <p className="mt-3 text-gray-600">
              <code className="text-amber-600">else if</code> 구조이므로, 여러 조건이 동시에 충족되더라도
              <strong>첫 번째로 매칭되는 조건</strong>만 차단 이유로 기록됩니다.
              최대 반복 횟수 초과가 가장 높은 우선순위를 가집니다.
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
              &quot;에이전트가 5번만에 멈춰요. 더 오래 실행하고 싶어요.&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              두 가지 가능성이 있습니다:
            </p>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                <strong>무변경 감지:</strong> LLM이 파일을 수정하지 않고 텍스트 출력도 하지 않는 반복이
                5회 연속되면 차단됩니다. LLM의 응답이 빈 문자열인지 확인하세요.
                <code className="text-cyan-600">hasOutput: true</code>만 되어도 카운터가 초기화됩니다.
              </li>
              <li>
                <strong>동일 에러 반복:</strong> 같은 에러 메시지가 5회 연속 발생하면 차단됩니다.
                에러 메시지가 정확히 동일한 문자열인지 확인하세요. 타임스탬프 등이 포함되면
                &quot;다른 에러&quot;로 인식되어 카운터가 리셋됩니다.
              </li>
            </ul>
            <Callout type="tip" icon="*">
              <code>getStatus()</code>를 호출하여 <code>reason</code> 필드를 확인하면
              정확한 차단 원인을 알 수 있습니다.
            </Callout>
          </div>

          {/* FAQ 2 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;서킷 브레이커가 작동했는데 다시 시작하려면 어떻게 하나요?&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              <code className="text-cyan-600">reset()</code>을 호출하면 모든 카운터가 초기화되고
              상태가 <code className="text-emerald-600">&quot;closed&quot;</code>로 돌아갑니다.
              단, 실제 코드에서는 <code className="text-cyan-600">Recovery Executor</code>가
              이 판단을 자동으로 수행합니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 차단 상태 확인 후 리셋"}</span>
              {"\n"}<span className="kw">if</span> (!<span className="prop">circuitBreaker</span>.<span className="fn">shouldContinue</span>()) {"{"}
              {"\n"}{"  "}<span className="kw">const</span> <span className="prop">status</span> = <span className="prop">circuitBreaker</span>.<span className="fn">getStatus</span>();
              {"\n"}{"  "}<span className="fn">logger</span>.<span className="fn">warn</span>(<span className="str">`차단됨: ${"{"}</span><span className="prop">status</span>.<span className="prop">reason</span><span className="str">{"}"}`</span>);
              {"\n"}
              {"\n"}{"  "}<span className="cm">{"// 복구 전략 적용 후 리셋"}</span>
              {"\n"}{"  "}<span className="kw">await</span> <span className="fn">recoveryExecutor</span>.<span className="fn">recover</span>(<span className="prop">status</span>);
              {"\n"}{"  "}<span className="prop">circuitBreaker</span>.<span className="fn">reset</span>();
              {"\n"}{"}"}
            </CodeBlock>
          </div>

          {/* FAQ 3 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;shouldContinue()가 계속 true인데 루프가 끝나지 않아요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              <code className="text-cyan-600">recordIteration()</code>을 매 반복마다 호출하고 있는지
              확인하세요. 이 메서드를 호출하지 않으면 서킷 브레이커는 어떤 반복이 일어났는지 알 수 없으므로,
              영원히 <code className="text-emerald-600">&quot;closed&quot;</code> 상태를 유지합니다.
            </p>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              또한 <code className="text-cyan-600">IterationResult</code>의 필드가 올바르게 채워져 있는지
              확인하세요. 예를 들어, 파일을 수정했는데 <code className="text-cyan-600">filesModified</code>에
              빈 Set을 전달하면 &quot;무변경&quot;으로 잘못 판단합니다.
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
                name: "agent-loop.ts",
                slug: "agent-loop",
                relation: "parent",
                desc: "CircuitBreaker를 생성하고 매 반복마다 recordIteration()을 호출하는 메인 루프",
              },
              {
                name: "recovery-executor.ts",
                slug: "recovery-executor",
                relation: "sibling",
                desc: "서킷 브레이커가 차단한 후 에러 유형별 복구 전략을 실행하는 모듈",
              },
              {
                name: "context-manager.ts",
                slug: "context-manager",
                relation: "sibling",
                desc: "3-Layer 토큰 관리 — 컨텍스트 초과로 인한 에러를 줄여 서킷 브레이커 작동을 예방",
              },
            ]}
          />
        </section>
      </RevealOnScroll>
    </div></div>
  );
}

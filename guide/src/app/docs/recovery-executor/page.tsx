"use client";

import { FilePath } from "@/components/FilePath";
import { LayerBadge } from "@/components/LayerBadge";
import { MermaidDiagram } from "@/components/MermaidDiagram";
import { CodeBlock } from "@/components/CodeBlock";
import { Callout } from "@/components/Callout";
import { RevealOnScroll } from "@/components/RevealOnScroll";
import { DeepDive } from "@/components/DeepDive";
import { ParamTable } from "@/components/ParamTable";
import { SeeAlso } from "@/components/SeeAlso";

export default function RecoveryExecutorPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">

        {/* ─── 1. Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <div className="flex items-center gap-3 mb-4">
              <FilePath path="src/core/recovery-executor.ts" />
              <LayerBadge layer="core" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mb-3">
              <span className="text-gray-900">
                Recovery Executor
              </span>
            </h1>
            <p className="text-[16px] text-gray-600 max-w-[640px]">
              에러 유형별 복구 전략을 실제로 실행하는 모듈입니다. compact, retry, fallback 세 가지 전략으로
              LLM 호출 실패를 자동 복구합니다.
            </p>
          </div>
        </RevealOnScroll>

        {/* ─── 2. 개요 ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2 className="text-[22px] font-extrabold flex items-center gap-2" style={{ marginBottom: "24px", marginTop: "0" }}>
              <span>🔍</span> 개요
            </h2>

            <div className="text-[14px] text-gray-600 leading-[1.85] space-y-4">
              <p>
                LLM 기반 에이전트는 네트워크 타임아웃, 컨텍스트 초과, JSON 파싱 실패 등
                다양한 에러를 만납니다. 이런 에러가 발생할 때마다 사용자에게 실패를 보여주면
                경험이 크게 나빠집니다.
              </p>
              <p>
                <span className="font-mono text-cyan-600 text-[13px]">recovery-executor.ts</span>는
                <span className="font-mono text-cyan-600 text-[13px]"> recovery-strategy.ts</span>가 결정한
                복구 전략을 <strong className="text-gray-900">실제로 실행</strong>하는 모듈입니다.
                에러 종류에 따라 메시지를 압축하거나, 지수 백오프로 재시도하거나,
                도구 호출 방식을 전환하는 세 가지 복구 행동을 수행합니다.
              </p>
              <p>
                이 모듈은 <strong className="text-gray-900">Agent Loop</strong> 안에서
                에러 발생 시 호출되며, 복구 결과에 따라 Agent Loop가
                재시도(<span className="font-mono text-emerald-600 text-[13px]">retry</span>) 또는
                중단(<span className="font-mono text-red-600 text-[13px]">abort</span>)을 결정합니다.
              </p>
            </div>

            <MermaidDiagram
              title="Agent Loop과 Recovery Executor의 관계"
              titleColor="red"
              chart={`sequenceDiagram
    participant AL as Agent Loop
    participant RS as Recovery Strategy
    participant RE as Recovery Executor
    participant LLM as LLM Client

    AL->>LLM: LLM 호출
    LLM-->>AL: 에러 발생!
    AL->>RS: findRecoveryStrategy(error)
    RS-->>AL: 전략 반환 (compact/retry/fallback)
    AL->>RE: executeRecovery(strategy, error, messages)
    RE-->>AL: RecoveryResult (retry 또는 abort)
    alt action === "retry"
        AL->>LLM: 수정된 메시지로 재시도
    else action === "abort"
        AL->>AL: 사용자에게 에러 표시
    end`}
            />
          </section>
        </RevealOnScroll>

        {/* ─── 3. 레퍼런스 ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2 className="text-[22px] font-extrabold flex items-center gap-2" style={{ marginBottom: "24px", marginTop: "0" }}>
              <span>📘</span> 레퍼런스
            </h2>

            {/* executeRecovery */}
            <div className="mb-8">
              <h3 className="text-[17px] font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
                executeRecovery()
              </h3>
              <p className="text-[14px] text-gray-600 leading-[1.85] mb-4">
                <span className="font-mono text-cyan-600 text-[13px]">findRecoveryStrategy()</span>에서
                결정된 복구 전략을 실제로 실행합니다. 전략 유형에 따라 메시지 압축, 지수 백오프 대기,
                도구 호출 방식 전환 중 하나를 수행하고 결과를 반환합니다.
              </p>

              <CodeBlock>
                <span className="text-[#ff7b72]">async function</span>{" "}
                <span className="text-[#d2a8ff]">executeRecovery</span>(
                {"\n"}{"  "}
                <span className="text-[#ffa657]">strategy</span>:{" "}
                <span className="text-[#79c0ff]">RecoveryStrategy</span>,
                {"\n"}{"  "}
                <span className="text-[#ffa657]">_error</span>:{" "}
                <span className="text-[#79c0ff]">Error</span>,
                {"\n"}{"  "}
                <span className="text-[#ffa657]">messages</span>:{" "}
                <span className="text-[#79c0ff]">readonly ChatMessage[]</span>,
                {"\n"}{"  "}
                <span className="text-[#ffa657]">options</span>?:{" "}
                <span className="text-[#79c0ff]">RecoveryExecutorOptions</span>
                {"\n"}): <span className="text-[#79c0ff]">Promise</span>{"<"}
                <span className="text-[#79c0ff]">RecoveryResult</span>{">"}
              </CodeBlock>

              <ParamTable
                params={[
                  {
                    name: "strategy",
                    type: "RecoveryStrategy",
                    required: true,
                    desc: "실행할 복구 전략 객체. findRecoveryStrategy()의 반환값을 전달합니다.",
                  },
                  {
                    name: "_error",
                    type: "Error",
                    required: true,
                    desc: "발생한 원본 에러. 현재는 미사용이지만 향후 에러별 분기 확장을 위해 예약됨.",
                  },
                  {
                    name: "messages",
                    type: "readonly ChatMessage[]",
                    required: true,
                    desc: "현재 대화 메시지 배열. compact 전략 시 이 배열이 압축됩니다.",
                  },
                  {
                    name: "options",
                    type: "RecoveryExecutorOptions",
                    required: false,
                    desc: "maxContextTokens(최대 토큰 수), signal(AbortSignal) 등 실행 옵션.",
                  },
                ]}
              />
            </div>

            {/* resetRetryState */}
            <div className="mb-8">
              <h3 className="text-[17px] font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
                resetRetryState()
              </h3>
              <p className="text-[14px] text-gray-600 leading-[1.85] mb-4">
                모든 전략의 재시도 카운터를 초기화합니다. 새 세션 시작 시 또는 테스트 코드에서 호출합니다.
              </p>

              <CodeBlock>
                <span className="text-[#ff7b72]">function</span>{" "}
                <span className="text-[#d2a8ff]">resetRetryState</span>():{" "}
                <span className="text-[#79c0ff]">void</span>
              </CodeBlock>

              <Callout type="warn" icon="⚠️">
                <span className="text-[13px]">
                  <strong>주의:</strong> <code className="text-cyan-600">resetRetryState()</code>를 호출하지 않으면
                  이전 세션의 재시도 횟수가 남아 있어, 새 세션에서 복구를 시도하기도 전에
                  <code className="text-red-600"> abort</code>가 반환될 수 있습니다.
                </span>
              </Callout>
            </div>

            {/* RecoveryResult 인터페이스 */}
            <div className="mb-8">
              <h3 className="text-[17px] font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
                RecoveryResult 인터페이스
              </h3>
              <p className="text-[14px] text-gray-600 leading-[1.85] mb-4">
                <code className="text-cyan-600">executeRecovery()</code>가 반환하는 결과 객체입니다.
                Agent Loop는 이 결과를 보고 다음 행동을 결정합니다.
              </p>

              <ParamTable
                params={[
                  {
                    name: "action",
                    type: '"retry" | "abort"',
                    required: true,
                    desc: '"retry"면 수정된 메시지로 LLM 재호출, "abort"면 복구 포기.',
                  },
                  {
                    name: "messages",
                    type: "readonly ChatMessage[]",
                    required: false,
                    desc: "compact 전략으로 압축된 메시지 배열. retry 전략에서는 원본 그대로.",
                  },
                  {
                    name: "overrides",
                    type: "Record<string, unknown>",
                    required: false,
                    desc: "재시도 시 변경할 설정값. fallback 전략에서 toolCallStrategy를 변경.",
                  },
                  {
                    name: "strategyUsed",
                    type: "string",
                    required: true,
                    desc: "사용된 복구 전략의 사람이 읽을 수 있는 설명 문구.",
                  },
                ]}
              />
            </div>
          </section>
        </RevealOnScroll>

        {/* ─── 4. 사용법 ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2 className="text-[22px] font-extrabold flex items-center gap-2" style={{ marginBottom: "24px", marginTop: "0" }}>
              <span>🛠️</span> 사용법
            </h2>

            <p className="text-[14px] text-gray-600 leading-[1.85] mb-6">
              Recovery Executor는 세 가지 복구 전략을 지원합니다.
              각 전략은 <span className="font-mono text-cyan-600 text-[13px]">recovery-strategy.ts</span>에서
              에러 메시지 패턴 매칭으로 자동 선택됩니다.
            </p>

            {/* Compact 전략 */}
            <Callout type="info" icon="📦">
              <div>
                <strong className="text-blue-600">Compact 전략</strong>
                <span className="text-[13px] block mt-1">
                  컨텍스트 윈도우 초과 에러 발생 시, 시스템 메시지와 최근 3개 메시지를 유지하고
                  나머지를 요약 메시지로 대체합니다. 매칭 패턴:{" "}
                  <code className="text-cyan-600">request too large | context.*exceed | token.*limit</code>
                </span>
              </div>
            </Callout>

            <CodeBlock>
              <span className="text-[#8b949e]">// 원본: system + user1 + assistant1 + user2 + assistant2 + user3</span>
              {"\n"}
              <span className="text-[#8b949e]">// compact 후:</span>
              {"\n"}
              <span className="text-[#8b949e]">// system + [요약: 3개 메시지 압축됨] + assistant2 + user3</span>
              {"\n\n"}
              <span className="text-[#ff7b72]">const</span> result = <span className="text-[#ff7b72]">await</span>{" "}
              <span className="text-[#d2a8ff]">executeRecovery</span>(strategy, error, messages);
              {"\n"}
              <span className="text-[#8b949e]">// result.action === "retry"</span>
              {"\n"}
              <span className="text-[#8b949e]">// result.messages === 압축된 메시지 배열</span>
            </CodeBlock>

            {/* Retry 전략 */}
            <Callout type="tip" icon="🔄">
              <div>
                <strong className="text-emerald-600">Retry 전략</strong>
                <span className="text-[13px] block mt-1">
                  네트워크 타임아웃, 파일 잠금 에러 시 지수 백오프(exponential backoff)로 대기한 뒤
                  원본 메시지 그대로 재시도합니다. AbortSignal을 지원하여 대기 중 취소 가능합니다.
                </span>
              </div>
            </Callout>

            <DeepDive title="지수 백오프(Exponential Backoff) 계산식">
              <div className="space-y-3">
                <p>
                  재시도 대기 시간은 시도할 때마다 2배로 증가합니다. 이렇게 하면
                  일시적 장애 시 서버에 과도한 부하를 주지 않으면서도 빠른 복구가 가능합니다.
                </p>
                <CodeBlock>
                  <span className="text-[#8b949e]">// 공식: delay = backoffMs * 2^(attempt - 1)</span>
                  {"\n\n"}
                  <span className="text-[#ff7b72]">const</span> backoffMs = strategy.backoffMs ??{" "}
                  <span className="text-[#79c0ff]">1000</span>;
                  {"\n"}
                  <span className="text-[#ff7b72]">const</span> delay = backoffMs *{" "}
                  <span className="text-[#d2a8ff]">Math.pow</span>(<span className="text-[#79c0ff]">2</span>,
                  state.attempts - <span className="text-[#79c0ff]">1</span>);
                </CodeBlock>
                <div className="bg-violet-50 border border-gray-200 rounded-lg p-4 mt-3">
                  <p className="text-[12px] text-gray-400 mb-2 font-bold">예시: backoffMs = 2000일 때</p>
                  <table className="text-[12px] font-mono">
                    <tbody>
                      <tr><td className="pr-6 text-violet-600">1회차</td><td>2000 * 2^0 = <strong className="text-gray-900">2,000ms</strong> (2초)</td></tr>
                      <tr><td className="pr-6 text-violet-600">2회차</td><td>2000 * 2^1 = <strong className="text-gray-900">4,000ms</strong> (4초)</td></tr>
                      <tr><td className="pr-6 text-violet-600">3회차</td><td>2000 * 2^2 = <strong className="text-gray-900">8,000ms</strong> (8초)</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </DeepDive>

            {/* Fallback 전략 */}
            <Callout type="danger" icon="🔀">
              <div>
                <strong className="text-red-600">Fallback Strategy 전략</strong>
                <span className="text-[13px] block mt-1">
                  JSON 파싱 에러가 발생하면 도구 호출 방식을 JSON 기반에서 텍스트 파싱 방식으로 전환합니다.
                  <code className="text-cyan-600 ml-1">overrides.toolCallStrategy = &quot;text-parsing&quot;</code> 설정을
                  반환하여 Agent Loop가 다음 LLM 호출에서 텍스트 기반 도구 추출을 사용하도록 합니다.
                </span>
              </div>
            </Callout>
          </section>
        </RevealOnScroll>

        {/* ─── 5. 내부 구현 ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2 className="text-[22px] font-extrabold flex items-center gap-2" style={{ marginBottom: "24px", marginTop: "0" }}>
              <span>🔬</span> 내부 구현
            </h2>

            <p className="text-[14px] text-gray-600 leading-[1.85] mb-6">
              Recovery Executor의 내부 처리 흐름은 크게 세 단계입니다:
              에러 분류 → 전략 선택 → 전략 실행. 아래 플로우차트는 전체 과정을 보여줍니다.
            </p>

            <MermaidDiagram
              title="에러 복구 전체 플로우"
              titleColor="orange"
              chart={`flowchart TD
    ERR["에러 발생<br/><small>LLM 호출 실패 감지</small>"] --> FIND["findRecoveryStrategy()<br/><small>에러 패턴으로 전략 검색</small>"]
    FIND --> MATCH{"에러 패턴<br/>매칭?"}
    MATCH -->|"매칭 없음"| NORECOV["복구 불가<br/><small>에러 그대로 throw</small>"]
    MATCH -->|"매칭됨"| EXEC["executeRecovery()<br/><small>복구 전략 실행 시작</small>"]
    EXEC --> MAXCHECK{"attempts ≥<br/>maxRetries?"}
    MAXCHECK -->|"초과"| ABORT["action: abort<br/><small>복구 포기, 에러 반환</small>"]
    MAXCHECK -->|"미초과"| INC["attempts++<br/><small>재시도 카운터 증가</small>"]
    INC --> SWITCH{"strategy<br/>.action?"}
    SWITCH -->|"compact"| COMPACT["메시지 압축<br/><small>system + 요약 + 최근 3개</small>"]
    SWITCH -->|"retry"| BACKOFF["지수 백오프 대기<br/><small>backoffMs × 2^(n-1)</small>"]
    SWITCH -->|"fallback-strategy"| FALLBACK["도구 호출 전환<br/><small>text-parsing 모드로 변경</small>"]
    COMPACT --> RETRY["action: retry<br/><small>수정된 messages 반환</small>"]
    BACKOFF --> RETRY2["action: retry<br/><small>원본 messages 유지</small>"]
    FALLBACK --> RETRY3["action: retry<br/><small>overrides 설정 포함</small>"]

    style ERR fill:#fee2e2,stroke:#ef4444,color:#991b1b
    style ABORT fill:#fee2e2,stroke:#ef4444,color:#991b1b
    style COMPACT fill:#dbeafe,stroke:#3b82f6,color:#1e40af
    style BACKOFF fill:#dcfce7,stroke:#10b981,color:#065f46
    style FALLBACK fill:#ede9fe,stroke:#8b5cf6,color:#5b21b6
    style RETRY fill:#dbeafe,stroke:#3b82f6,color:#1e40af
    style RETRY2 fill:#dcfce7,stroke:#10b981,color:#065f46
    style RETRY3 fill:#ede9fe,stroke:#8b5cf6,color:#5b21b6`}
            />

            <div className="text-[14px] text-gray-600 leading-[1.85] space-y-4 mt-6">
              <p>
                <strong className="text-gray-900">에러 패턴 매칭 (recovery-strategy.ts)</strong>:
                <code className="text-cyan-600 mx-1">RECOVERY_STRATEGIES</code> 배열에 6개 전략이
                정의되어 있습니다. 각 전략은 <code className="text-violet-600">errorPattern</code> 정규표현식으로
                에러 메시지를 매칭합니다. 배열 순서대로 검사하며 첫 번째 매칭된 전략이 사용됩니다.
              </p>
            </div>

            <CodeBlock>
              <span className="text-[#8b949e]">// recovery-strategy.ts — 6개 사전 정의 전략</span>
              {"\n"}
              <span className="text-[#ff7b72]">export const</span> RECOVERY_STRATEGIES: <span className="text-[#79c0ff]">readonly RecoveryStrategy[]</span> = [
              {"\n"}{"  "}{"{ "}errorPattern: <span className="text-[#a5d6ff]">/request too large|context.*exceed|token.*limit/i</span>,
              {"\n"}{"    "}action: <span className="text-[#a5d6ff]">&quot;compact&quot;</span>, maxRetries: <span className="text-[#79c0ff]">1</span> {"}"},
              {"\n"}{"  "}{"{ "}errorPattern: <span className="text-[#a5d6ff]">/MCP tool error.*timed out/i</span>,
              {"\n"}{"    "}action: <span className="text-[#a5d6ff]">&quot;retry&quot;</span>, maxRetries: <span className="text-[#79c0ff]">1</span>, backoffMs: <span className="text-[#79c0ff]">3000</span> {"}"},
              {"\n"}{"  "}{"{ "}errorPattern: <span className="text-[#a5d6ff]">/MCP.*ECONNREFUSED|MCP.*disconnected/i</span>,
              {"\n"}{"    "}action: <span className="text-[#a5d6ff]">&quot;compact&quot;</span>, maxRetries: <span className="text-[#79c0ff]">1</span> {"}"},
              {"\n"}{"  "}{"{ "}errorPattern: <span className="text-[#a5d6ff]">/ETIMEDOUT|timeout|timed out/i</span>,
              {"\n"}{"    "}action: <span className="text-[#a5d6ff]">&quot;retry&quot;</span>, maxRetries: <span className="text-[#79c0ff]">2</span>, backoffMs: <span className="text-[#79c0ff]">2000</span> {"}"},
              {"\n"}{"  "}{"{ "}errorPattern: <span className="text-[#a5d6ff]">/parse.*error|invalid.*json/i</span>,
              {"\n"}{"    "}action: <span className="text-[#a5d6ff]">&quot;fallback-strategy&quot;</span>, maxRetries: <span className="text-[#79c0ff]">1</span> {"}"},
              {"\n"}{"  "}{"{ "}errorPattern: <span className="text-[#a5d6ff]">/ELOCK|lock.*exist|locked/i</span>,
              {"\n"}{"    "}action: <span className="text-[#a5d6ff]">&quot;retry&quot;</span>, maxRetries: <span className="text-[#79c0ff]">3</span>, backoffMs: <span className="text-[#79c0ff]">1000</span> {"}"},
              {"\n"}];
            </CodeBlock>

            <Callout type="info" icon="💡">
              <span className="text-[13px]">
                <strong>재시도 상태 관리:</strong> 내부적으로{" "}
                <code className="text-cyan-600">Map&lt;string, RetryState&gt;</code>로
                전략별 시도 횟수를 추적합니다.{" "}
                <code className="text-cyan-600">strategy.description</code>을 키로 사용하므로
                동일한 전략이 반복 호출되면 카운터가 누적되어 <code className="text-violet-600">maxRetries</code> 초과 시
                자동으로 <code className="text-red-600">abort</code>를 반환합니다.
              </span>
            </Callout>

            <DeepDive title="compactMessages() — 메시지 압축 알고리즘">
              <div className="space-y-3">
                <p>
                  메시지가 4개 이하면 압축하지 않습니다. 5개 이상일 때만 다음 로직을 수행합니다:
                </p>
                <ol className="list-decimal list-inside space-y-1.5 ml-2">
                  <li><strong className="text-gray-900">시스템 메시지 분리:</strong> role이 &quot;system&quot;인 메시지를 별도로 보관합니다.</li>
                  <li><strong className="text-gray-900">최근 3개 유지:</strong> 비시스템 메시지 중 마지막 3개만 유지합니다.</li>
                  <li><strong className="text-gray-900">요약 메시지 삽입:</strong> 제거된 N개 메시지를 대체하는 요약 메시지 1개를 삽입합니다.</li>
                  <li><strong className="text-gray-900">재조립:</strong> system + 요약 + 최근 3개 순서로 배열을 반환합니다.</li>
                </ol>
                <CodeBlock>
                  <span className="text-[#8b949e]">// 압축 전: [sys, u1, a1, u2, a2, u3, a3, u4]</span>
                  {"\n"}
                  <span className="text-[#8b949e]">// 압축 후: [sys, summary(&quot;5개 메시지 압축됨&quot;), a3, u4]</span>
                  {"\n\n"}
                  <span className="text-[#ff7b72]">return</span> [...systemMessages, summaryMessage, ...recentMessages];
                </CodeBlock>
              </div>
            </DeepDive>
          </section>
        </RevealOnScroll>

        {/* ─── 6. 트러블슈팅 ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2 className="text-[22px] font-extrabold flex items-center gap-2" style={{ marginBottom: "24px", marginTop: "0" }}>
              <span>🩺</span> 트러블슈팅
            </h2>

            <div className="space-y-5">
              {/* FAQ 1 */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-600">Q.</span>
                  복구를 시도하지도 않고 바로 abort가 반환됩니다
                </h4>
                <p className="text-[13px] text-gray-600 leading-[1.8]">
                  <span className="text-emerald-600 font-bold">A.</span>{" "}
                  이전 세션의 재시도 카운터가 초기화되지 않았을 가능성이 큽니다.
                  새 세션 시작 시 <code className="text-cyan-600">resetRetryState()</code>를 반드시 호출하세요.
                  모듈 스코프의 <code className="text-cyan-600">retryStates</code> Map은 프로세스가 살아 있는 한
                  유지되므로, 세션 간 오염이 발생할 수 있습니다.
                </p>
              </div>

              {/* FAQ 2 */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-600">Q.</span>
                  Esc를 눌렀는데 재시도 대기가 취소되지 않습니다
                </h4>
                <p className="text-[13px] text-gray-600 leading-[1.8]">
                  <span className="text-emerald-600 font-bold">A.</span>{" "}
                  <code className="text-cyan-600">options.signal</code>에
                  AbortSignal을 전달했는지 확인하세요.
                  <code className="text-cyan-600"> delayWithSignal()</code>은
                  signal이 없으면 일반 <code className="text-cyan-600">setTimeout</code>으로 동작하여
                  중간 취소가 불가능합니다. Agent Loop에서 AbortController를 생성하고
                  Esc 키 핸들러에서 <code className="text-cyan-600">controller.abort()</code>를 호출해야 합니다.
                </p>
              </div>

              {/* FAQ 3 */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-600">Q.</span>
                  compact 후에도 여전히 &quot;context exceeded&quot; 에러가 납니다
                </h4>
                <p className="text-[13px] text-gray-600 leading-[1.8]">
                  <span className="text-emerald-600 font-bold">A.</span>{" "}
                  현재 <code className="text-cyan-600">compactMessages()</code>는 시스템 메시지 + 최근 3개 메시지를
                  유지하는 단순 방식입니다. 시스템 메시지 자체가 매우 크거나, 최근 3개 메시지에
                  대용량 도구 출력이 포함된 경우 압축 후에도 토큰 한도를 초과할 수 있습니다.
                  이 경우 <code className="text-cyan-600">context-manager.ts</code>의
                  3-Layer Compaction 시스템을 활용하여 더 정교한 압축을 수행해야 합니다.
                  compact 전략의 <code className="text-violet-600">maxRetries</code>가 1이므로 두 번째 시도는
                  자동으로 abort됩니다.
                </p>
              </div>
            </div>
          </section>
        </RevealOnScroll>

        {/* ─── 7. 관련 문서 ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2 className="text-[22px] font-extrabold flex items-center gap-2" style={{ marginBottom: "24px", marginTop: "0" }}>
              <span>🔗</span> 관련 문서
            </h2>

            <SeeAlso
              items={[
                {
                  name: "agent-loop.ts",
                  slug: "agent-loop",
                  relation: "parent",
                  desc: "Recovery Executor를 호출하는 ReAct 패턴 메인 루프. 에러 발생 시 복구 결과에 따라 재시도/중단을 결정합니다.",
                },
                {
                  name: "circuit-breaker.ts",
                  slug: "circuit-breaker",
                  relation: "sibling",
                  desc: "무한 루프 방지 모듈. Recovery Executor가 계속 retry를 반환해도 Circuit Breaker가 최종 중단을 보장합니다.",
                },
                {
                  name: "context-manager.ts",
                  slug: "context-manager",
                  relation: "sibling",
                  desc: "3-Layer Compaction 시스템. compact 전략의 상위 호환으로, 더 정교한 메시지 압축을 수행합니다.",
                },
              ]}
            />
          </section>
        </RevealOnScroll>

      </div>
    </div>
  );
}

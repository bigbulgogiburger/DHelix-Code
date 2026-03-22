"use client";

import { SectionHeader } from "../SectionHeader";
import { FilePath } from "../FilePath";
import { MermaidDiagram } from "../MermaidDiagram";
import { CodeBlock } from "../CodeBlock";
import { ImplDirection } from "../ImplDirection";
import { RevealOnScroll } from "../RevealOnScroll";

const circuitBreakerChart = `stateDiagram-v2
    [*] --> CLOSED: 초기 상태
    CLOSED --> CLOSED: recordIteration() 정상

    CLOSED --> OPEN_NO_CHANGE: 5회 연속 무변경
    CLOSED --> OPEN_SAME_ERROR: 5회 동일 에러
    CLOSED --> OPEN_MAX_ITER: 50회 반복 도달

    state OPEN {
        OPEN_NO_CHANGE: 파일 미수정 + LLM 무출력
        OPEN_SAME_ERROR: 같은 에러 메시지 반복
        OPEN_MAX_ITER: 최대 반복 초과
    }

    OPEN --> RECOVERY: Recovery Executor 호출
    RECOVERY --> CLOSED: reset() 복구 성공
    RECOVERY --> ABORT: 복구 실패 중단`;

const recoveryChart = `graph LR
    ERROR["에러 발생"] --> CLASSIFY{"에러 분류"}
    CLASSIFY -->|"request too large"| COMPACT["Compact 전략"]
    CLASSIFY -->|"ETIMEDOUT / 502"| RETRY["Retry 전략"]
    CLASSIFY -->|"parse error"| FALLBACK["Fallback 전략"]
    CLASSIFY -->|"ELOCK"| RETRY_LOCK["Lock Retry"]
    COMPACT --> C_ACT["메시지 압축 재시도 1회"]
    RETRY --> R_ACT["지수 백오프 최대 3회"]
    FALLBACK --> F_ACT["text-parsing 전환 1회"]
    RETRY_LOCK --> RL_ACT["1s 대기 최대 3회"]
    C_ACT --> RESULT{"결과"}
    R_ACT --> RESULT
    F_ACT --> RESULT
    RL_ACT --> RESULT
    RESULT -->|"성공"| OK["루프 계속"]
    RESULT -->|"실패"| ABORT_R["루프 중단"]
    style ERROR fill:#3a1e1e,stroke:#ef4444,color:#f1f5f9
    style OK fill:#1e3a2a,stroke:#10b981,color:#f1f5f9
    style ABORT_R fill:#3a1e1e,stroke:#ef4444,color:#f1f5f9`;

export function RecoverySection() {
  return (
    <section id="recovery" className="py-20">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-8">
        <RevealOnScroll>
          <SectionHeader
            label="MODULE 07"
            labelColor="red"
            title="Recovery & Circuit Breaker"
            description="에러 발생 시 자동 복구하고, 무한 루프를 감지하여 차단하는 안전장치입니다."
          />
        </RevealOnScroll>

        <RevealOnScroll>
          <div className="flex gap-2 flex-wrap mb-5">
            <FilePath path="src/core/circuit-breaker.ts" />
            <FilePath path="src/core/recovery-executor.ts" />
          </div>
        </RevealOnScroll>

        <RevealOnScroll>
          <MermaidDiagram chart={circuitBreakerChart} title="Circuit Breaker 상태 전이" titleColor="red" />
        </RevealOnScroll>

        <RevealOnScroll>
          <MermaidDiagram chart={recoveryChart} title="에러 유형별 복구 전략 라우팅" titleColor="orange" />
        </RevealOnScroll>

        <RevealOnScroll>
          <h3 className="text-lg font-bold mb-4">Circuit Breaker 내부 상태</h3>
          <CodeBlock>
            <span className="kw">class</span> <span className="type">CircuitBreaker</span> {"{"}{"\n"}
            {"  "}<span className="cm">{"// 카운터"}</span>{"\n"}
            {"  "}<span className="kw">private</span> <span className="prop">iterationCount</span> = <span className="num">0</span>;{"\n"}
            {"  "}<span className="kw">private</span> <span className="prop">consecutiveNoChangeCount</span> = <span className="num">0</span>;    <span className="cm">{"// → 5에 도달하면 trip"}</span>{"\n"}
            {"  "}<span className="kw">private</span> <span className="prop">consecutiveSameErrorCount</span> = <span className="num">0</span>;   <span className="cm">{"// → 5에 도달하면 trip"}</span>{"\n"}
            {"  "}<span className="kw">private</span> <span className="prop">lastError</span>?: <span className="type">string</span>;{"\n\n"}
            {"  "}<span className="cm">{"// 상태"}</span>{"\n"}
            {"  "}<span className="kw">private</span> <span className="prop">currentState</span>: <span className="str">{'"closed"'}</span> | <span className="str">{'"open"'}</span> = <span className="str">{'"closed"'}</span>;{"\n"}
            {"  "}<span className="kw">private</span> <span className="prop">openReason</span>?: <span className="type">string</span>;{"\n\n"}
            {"  "}<span className="cm">{"// 공개 메서드"}</span>{"\n"}
            {"  "}<span className="fn">recordIteration</span>(<span className="prop">result</span>: <span className="type">IterationResult</span>): <span className="kw">void</span>{"\n"}
            {"  "}<span className="fn">shouldContinue</span>(): <span className="type">boolean</span>{"\n"}
            {"  "}<span className="fn">getStatus</span>(): <span className="type">CircuitBreakerStatus</span>{"\n"}
            {"  "}<span className="fn">reset</span>(): <span className="kw">void</span>{"\n"}
            {"}"}
          </CodeBlock>
        </RevealOnScroll>

        <RevealOnScroll>
          <ImplDirection items={[
            "<strong>시맨틱 진행 분석</strong>: 단순 변경 유무 → '의미 있는 진행' 분석으로 더 정교한 트립 조건",
            "<strong>Half-Open 상태</strong>: 현재 closed/open 2상태 → half-open 추가로 점진적 복구 시도",
            "<strong>복구 전략 우선순위</strong>: 에러 히스토리 기반으로 가장 효과적인 전략을 먼저 시도",
            "<strong>사용자 알림 개선</strong>: trip 시 '왜 멈췄는지' + '어떤 복구를 시도했는지' 상세 피드백",
          ]} />
        </RevealOnScroll>
      </div>
    </section>
  );
}

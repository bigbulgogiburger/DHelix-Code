"use client";

import { SectionHeader } from "../SectionHeader";
import { FilePath } from "../FilePath";
import { MermaidDiagram } from "../MermaidDiagram";
import { CodeBlock } from "../CodeBlock";
import { ImplDirection } from "../ImplDirection";
import { RevealOnScroll } from "../RevealOnScroll";

const circuitBreakerChart = `graph TD
    START(("시작")) --> CLOSED["CLOSED (정상)<br/><small>recordIteration() 반복 실행 중</small>"]

    CLOSED -->|"5회 연속 무변경"| OPEN1["OPEN: 파일 미수정 + LLM 무출력<br/><small>파일 변경 없이 도구만 반복 호출</small>"]
    CLOSED -->|"5회 동일 에러"| OPEN2["OPEN: 같은 에러 메시지 반복<br/><small>동일한 에러가 5회 연속 발생</small>"]
    CLOSED -->|"50회 반복 도달"| OPEN3["OPEN: 최대 반복 초과<br/><small>maxIterations 한계에 도달</small>"]

    OPEN1 --> RECOVERY["RECOVERY<br/><small>Recovery Executor 호출</small>"]
    OPEN2 --> RECOVERY
    OPEN3 --> RECOVERY

    RECOVERY -->|"reset() 복구 성공"| CLOSED
    RECOVERY -->|"복구 실패"| ABORT["ABORT<br/><small>루프 중단</small>"]

    style CLOSED fill:#dcfce7,stroke:#10b981,color:#065f46,stroke-width:2px
    style OPEN1 fill:#fef3c7,stroke:#f59e0b,color:#92400e
    style OPEN2 fill:#fef3c7,stroke:#f59e0b,color:#92400e
    style OPEN3 fill:#fef3c7,stroke:#f59e0b,color:#92400e
    style RECOVERY fill:#dbeafe,stroke:#3b82f6,color:#1e40af
    style ABORT fill:#fee2e2,stroke:#ef4444,color:#991b1b`;

const recoveryChart = `graph TD
    ERROR["ERROR<br/><small>도구 실행 또는 LLM 호출에서 에러 감지</small>"] --> CLASSIFY{"CLASSIFY<br/><small>RecoveryStrategy 매핑으로 유형 판별</small>"}
    CLASSIFY -->|"request too large"| COMPACT["COMPACT<br/><small>컨텍스트 토큰 초과 에러</small>"]
    CLASSIFY -->|"ETIMEDOUT / 502"| RETRY["RETRY<br/><small>일시적 네트워크/API 에러</small>"]
    CLASSIFY -->|"parse error"| FALLBACK["FALLBACK<br/><small>모델 능력 부족 에러</small>"]
    CLASSIFY -->|"ELOCK"| RETRY_LOCK["RETRY_LOCK<br/><small>파일 잠금 충돌</small>"]
    COMPACT --> C_ACT["메시지 압축 재시도 1회<br/><small>압축 후 재시도</small>"]
    RETRY --> R_ACT["지수 백오프 최대 3회<br/><small>지수 백오프 후 재시도</small>"]
    FALLBACK --> F_ACT["text-parsing 전환 1회<br/><small>대체 모델로 전환</small>"]
    RETRY_LOCK --> RL_ACT["1s 대기 최대 3회<br/><small>대기 후 재시도</small>"]
    C_ACT --> RESULT{"RESULT<br/><small>복구 시도 결과 판정</small>"}
    R_ACT --> RESULT
    F_ACT --> RESULT
    RL_ACT --> RESULT
    RESULT -->|"성공"| OK["OK<br/><small>복구 성공 → 에이전트 루프 재개</small>"]
    RESULT -->|"실패"| ABORT_R["ABORT<br/><small>복구 실패 → 사용자에게 에러 보고</small>"]
    style ERROR fill:#fee2e2,stroke:#ef4444,color:#1e293b
    style OK fill:#dcfce7,stroke:#10b981,color:#1e293b
    style ABORT_R fill:#fee2e2,stroke:#ef4444,color:#1e293b`;

export function RecoverySection() {
  return (
    <section
      id="recovery"
      className="py-16 bg-violet-50/50"
      style={{ paddingTop: "64px", paddingBottom: "64px" }}
    >
      <div className="center-container">
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <SectionHeader
              label="MODULE 07"
              labelColor="red"
              title="Recovery & Circuit Breaker"
              description="에러 발생 시 자동 복구하고, 무한 루프를 감지하여 차단하는 안전장치입니다."
            />
          </div>
        </RevealOnScroll>

        <RevealOnScroll>
          <div className="flex gap-2 flex-wrap mb-6">
            <FilePath path="src/core/circuit-breaker.ts" />
            <FilePath path="src/core/recovery-executor.ts" />
          </div>
        </RevealOnScroll>

        <RevealOnScroll>
          <MermaidDiagram
            chart={circuitBreakerChart}
            title="Circuit Breaker 상태 전이"
            titleColor="red"
          />
        </RevealOnScroll>

        <RevealOnScroll>
          <MermaidDiagram
            chart={recoveryChart}
            title="에러 유형별 복구 전략 라우팅"
            titleColor="orange"
          />
        </RevealOnScroll>

        <RevealOnScroll>
          <h3
            className="text-lg font-semibold text-gray-900 mb-4"
            style={{ marginTop: "32px", marginBottom: "16px" }}
          >
            Circuit Breaker 내부 상태
          </h3>
          <CodeBlock>
            <span className="kw">class</span> <span className="type">CircuitBreaker</span> {"{"}
            {"\n"}
            {"  "}
            <span className="cm">{"// 카운터"}</span>
            {"\n"}
            {"  "}
            <span className="kw">private</span> <span className="prop">iterationCount</span> ={" "}
            <span className="num">0</span>;{"\n"}
            {"  "}
            <span className="kw">private</span>{" "}
            <span className="prop">consecutiveNoChangeCount</span> = <span className="num">0</span>;{" "}
            <span className="cm">{"// → 5에 도달하면 trip"}</span>
            {"\n"}
            {"  "}
            <span className="kw">private</span>{" "}
            <span className="prop">consecutiveSameErrorCount</span> = <span className="num">0</span>
            ; <span className="cm">{"// → 5에 도달하면 trip"}</span>
            {"\n"}
            {"  "}
            <span className="kw">private</span> <span className="prop">lastError</span>?:{" "}
            <span className="type">string</span>;{"\n\n"}
            {"  "}
            <span className="cm">{"// 상태"}</span>
            {"\n"}
            {"  "}
            <span className="kw">private</span> <span className="prop">currentState</span>:{" "}
            <span className="str">{'"closed"'}</span> | <span className="str">{'"open"'}</span> ={" "}
            <span className="str">{'"closed"'}</span>;{"\n"}
            {"  "}
            <span className="kw">private</span> <span className="prop">openReason</span>?:{" "}
            <span className="type">string</span>;{"\n\n"}
            {"  "}
            <span className="cm">{"// 공개 메서드"}</span>
            {"\n"}
            {"  "}
            <span className="fn">recordIteration</span>(<span className="prop">result</span>:{" "}
            <span className="type">IterationResult</span>): <span className="kw">void</span>
            {"\n"}
            {"  "}
            <span className="fn">shouldContinue</span>(): <span className="type">boolean</span>
            {"\n"}
            {"  "}
            <span className="fn">getStatus</span>():{" "}
            <span className="type">CircuitBreakerStatus</span>
            {"\n"}
            {"  "}
            <span className="fn">reset</span>(): <span className="kw">void</span>
            {"\n"}
            {"}"}
          </CodeBlock>
        </RevealOnScroll>

        <RevealOnScroll>
          <ImplDirection
            items={[
              "<strong>시맨틱 진행 분석</strong>: 단순 변경 유무 → '의미 있는 진행' 분석으로 더 정교한 트립 조건",
              "<strong>Half-Open 상태</strong>: 현재 closed/open 2상태 → half-open 추가로 점진적 복구 시도",
              "<strong>복구 전략 우선순위</strong>: 에러 히스토리 기반으로 가장 효과적인 전략을 먼저 시도",
              "<strong>사용자 알림 개선</strong>: trip 시 '왜 멈췄는지' + '어떤 복구를 시도했는지' 상세 피드백",
            ]}
          />
        </RevealOnScroll>
      </div>
    </section>
  );
}

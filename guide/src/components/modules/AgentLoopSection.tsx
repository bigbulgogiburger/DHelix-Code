"use client";

import { SectionHeader } from "../SectionHeader";
import { FilePath } from "../FilePath";
import { MermaidDiagram } from "../MermaidDiagram";
import { CodeBlock } from "../CodeBlock";
import { ImplDirection } from "../ImplDirection";
import { RevealOnScroll } from "../RevealOnScroll";

const stateMachineChart = `stateDiagram-v2
    [*] --> INIT: 사용자 입력 수신
    INIT --> CONTEXT_PREPARE: 메시지 + 시스템 프롬프트 조립
    CONTEXT_PREPARE --> CHECK_COMPACT: 컨텍스트 사용률 확인
    CHECK_COMPACT --> AUTO_COMPACT: >= 83.5%
    CHECK_COMPACT --> INPUT_GUARD: < 83.5%
    AUTO_COMPACT --> INPUT_GUARD: 압축 완료
    INPUT_GUARD --> LLM_CALL: 보안 통과
    INPUT_GUARD --> BLOCKED: 인젝션 감지
    LLM_CALL --> OUTPUT_PARSE: 스트리밍 완료
    OUTPUT_PARSE --> NO_TOOLS: tool_calls 없음
    OUTPUT_PARSE --> VALIDATE_TOOLS: tool_calls 있음
    NO_TOOLS --> [*]: 응답 반환
    VALIDATE_TOOLS --> PERMISSION_CHECK: Zod 스키마 통과
    VALIDATE_TOOLS --> TOOL_CORRECT: 스키마 실패 (Low Tier)
    TOOL_CORRECT --> PERMISSION_CHECK: 자동 교정 완료
    PERMISSION_CHECK --> CHECKPOINT: 승인됨
    PERMISSION_CHECK --> DENIED: 거부됨
    DENIED --> LLM_CALL: 거부 사유 피드백
    CHECKPOINT --> TOOL_GROUP: 스냅샷 저장
    TOOL_GROUP --> PARALLEL_EXEC: 읽기 전용 그룹
    TOOL_GROUP --> SERIAL_EXEC: 쓰기 포함 그룹
    PARALLEL_EXEC --> OBS_MASK: 실행 완료
    SERIAL_EXEC --> OBS_MASK: 실행 완료
    OBS_MASK --> CIRCUIT_CHECK: 마스킹 적용
    CIRCUIT_CHECK --> LLM_CALL: OK (closed)
    CIRCUIT_CHECK --> RECOVERY: Trip (open)
    RECOVERY --> LLM_CALL: compact / retry
    RECOVERY --> STRATEGY_SWITCH: fallback
    STRATEGY_SWITCH --> LLM_CALL: text-parsing 전환
    BLOCKED --> [*]: 에러 반환`;

export function AgentLoopSection() {
  return (
    <section id="agent-loop" className="py-20">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-8">
        <RevealOnScroll>
          <SectionHeader
            label="MODULE 01"
            labelColor="purple"
            title="Agent Loop — ReAct 상태머신"
            description="dbcode의 심장. 사용자 입력을 받아 LLM 호출 → 도구 실행 → 결과 피드백을 반복하는 핵심 루프입니다."
          />
        </RevealOnScroll>

        <RevealOnScroll>
          <FilePath path="src/core/agent-loop.ts" />
        </RevealOnScroll>

        <RevealOnScroll>
          <MermaidDiagram chart={stateMachineChart} title="Agent Loop 내부 상태머신" titleColor="purple" />
        </RevealOnScroll>

        <RevealOnScroll>
          <h3 className="text-lg font-bold mb-4">핵심 인터페이스</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CodeBlock>
              <span className="cm">{"// Agent Loop 설정"}</span>{"\n"}
              <span className="kw">interface</span> <span className="type">AgentLoopConfig</span> {"{"}{"\n"}
              {"  "}<span className="prop">client</span>: <span className="type">LLMProvider</span>;          <span className="cm">{"// LLM 클라이언트"}</span>{"\n"}
              {"  "}<span className="prop">model</span>: <span className="type">string</span>;                <span className="cm">{"// 모델명"}</span>{"\n"}
              {"  "}<span className="prop">toolRegistry</span>: <span className="type">ToolRegistry</span>;  <span className="cm">{"// 도구 저장소"}</span>{"\n"}
              {"  "}<span className="prop">strategy</span>: <span className="type">ToolCallStrategy</span>;   <span className="cm">{"// native | text-parsing"}</span>{"\n"}
              {"  "}<span className="prop">maxIterations</span>: <span className="type">number</span>;       <span className="cm">{"// 기본 50"}</span>{"\n"}
              {"  "}<span className="prop">signal</span>: <span className="type">AbortSignal</span>;          <span className="cm">{"// 취소 신호"}</span>{"\n"}
              {"  "}<span className="prop">checkPermission</span>: <span className="type">PermCheckFn</span>; <span className="cm">{"// 권한 콜백"}</span>{"\n"}
              {"  "}<span className="prop">useStreaming</span>: <span className="type">boolean</span>;        <span className="cm">{"// SSE 여부"}</span>{"\n"}
              {"  "}<span className="prop">dualModelRouter</span>?: <span className="type">DualModelRouter</span>;{"\n"}
              {"  "}<span className="prop">enableGuardrails</span>: <span className="type">boolean</span>;   <span className="cm">{"// 보안 필터"}</span>{"\n"}
              {"}"}
            </CodeBlock>
            <CodeBlock>
              <span className="cm">{"// 실행 결과"}</span>{"\n"}
              <span className="kw">interface</span> <span className="type">AgentLoopResult</span> {"{"}{"\n"}
              {"  "}<span className="prop">messages</span>: <span className="type">ChatMessage</span>[];     <span className="cm">{"// 전체 대화 히스토리"}</span>{"\n"}
              {"  "}<span className="prop">iterations</span>: <span className="type">number</span>;          <span className="cm">{"// 반복 횟수"}</span>{"\n"}
              {"  "}<span className="prop">aborted</span>: <span className="type">boolean</span>;            <span className="cm">{"// 사용자 취소 여부"}</span>{"\n"}
              {"  "}<span className="prop">usage</span>: <span className="type">AggregatedUsage</span>;      <span className="cm">{"// 토큰 통계"}</span>{"\n"}
              {"}"}{"\n\n"}
              <span className="kw">interface</span> <span className="type">AggregatedUsage</span> {"{"}{"\n"}
              {"  "}<span className="prop">inputTokens</span>: <span className="type">number</span>;{"\n"}
              {"  "}<span className="prop">outputTokens</span>: <span className="type">number</span>;{"\n"}
              {"  "}<span className="prop">totalTokens</span>: <span className="type">number</span>;{"\n"}
              {"  "}<span className="prop">toolCalls</span>: <span className="type">number</span>;           <span className="cm">{"// 도구 호출 총 횟수"}</span>{"\n"}
              {"  "}<span className="prop">retries</span>: <span className="type">number</span>;             <span className="cm">{"// 재시도 횟수"}</span>{"\n"}
              {"}"}
            </CodeBlock>
          </div>
        </RevealOnScroll>

        <RevealOnScroll>
          <ImplDirection
            items={[
              "<strong>새 도구 추가 시</strong>: ToolRegistry에 등록만 하면 자동으로 Agent Loop가 인식. 루프 코드 수정 불필요",
              "<strong>새 LLM 제공자</strong>: LLMProvider 인터페이스만 구현하면 client 교체로 연동 가능",
              "<strong>Guardrail 추가</strong>: enableGuardrails=true일 때 INPUT_GUARD/OUTPUT_PARSE 단계에 필터 체인 추가",
              "<strong>반복 제한 조정</strong>: maxIterations로 제어. 복잡한 작업은 높이고, 서브에이전트는 낮추는 전략",
              "<strong>Dual Model 확장</strong>: 현재 plan/execute/review 3단계 → 향후 debug, test 등 추가 가능",
            ]}
          />
        </RevealOnScroll>
      </div>
    </section>
  );
}

"use client";

import { SectionHeader } from "../SectionHeader";
import { FilePath } from "../FilePath";
import { MermaidDiagram } from "../MermaidDiagram";
import { CodeBlock } from "../CodeBlock";
import { ImplDirection } from "../ImplDirection";
import { RevealOnScroll } from "../RevealOnScroll";

const stateMachineChart = `graph TD
    START(("시작")) --> INIT["INIT<br/><small>시스템 프롬프트 + 도구 목록 초기화</small>"]
    INIT -->|"메시지 + 시스템 프롬프트 조립"| CONTEXT_PREPARE["CONTEXT_PREPARE<br/><small>메시지 배열 조립 + 토큰 계산</small>"]
    CONTEXT_PREPARE -->|"컨텍스트 사용률 확인"| CHECK_COMPACT{"CHECK_COMPACT<br/><small>사용률 >= 83.5% 인지 확인</small>"}
    CHECK_COMPACT -->|">= 83.5%"| AUTO_COMPACT["AUTO_COMPACT<br/><small>LLM 요약으로 오래된 메시지 압축</small>"]
    CHECK_COMPACT -->|"< 83.5%"| INPUT_GUARD["INPUT_GUARD<br/><small>프롬프트 인젝션 + 비밀 키 검사</small>"]
    AUTO_COMPACT -->|"압축 완료"| INPUT_GUARD
    INPUT_GUARD -->|"보안 통과"| LLM_CALL["LLM_CALL<br/><small>OpenAI API 스트리밍 요청</small>"]
    INPUT_GUARD -->|"인젝션 감지"| BLOCKED["BLOCKED<br/><small>서킷 차단 → 루프 중단</small>"]
    LLM_CALL -->|"스트리밍 완료"| OUTPUT_PARSE["OUTPUT_PARSE<br/><small>텍스트 / 도구 호출 분리</small>"]
    OUTPUT_PARSE -->|"tool_calls 없음"| NO_TOOLS["NO_TOOLS<br/><small>도구 호출 없음 → 응답 반환</small>"]
    OUTPUT_PARSE -->|"tool_calls 있음"| VALIDATE_TOOLS["VALIDATE_TOOLS<br/><small>Zod 스키마로 인자 타입 검증</small>"]
    NO_TOOLS --> END(("종료"))
    VALIDATE_TOOLS -->|"Zod 스키마 통과"| PERMISSION_CHECK["PERMISSION_CHECK<br/><small>5단계 권한 결정 트리 확인</small>"]
    VALIDATE_TOOLS -->|"스키마 실패 (Low Tier)"| TOOL_CORRECT["TOOL_CORRECT<br/><small>저성능 모델의 잘못된 인자 자동 교정</small>"]
    TOOL_CORRECT -->|"자동 교정 완료"| PERMISSION_CHECK
    PERMISSION_CHECK -->|"승인됨"| CHECKPOINT["CHECKPOINT<br/><small>파일 수정 전 SHA-256 스냅샷</small>"]
    PERMISSION_CHECK -->|"거부됨"| DENIED["DENIED<br/><small>사용자가 도구 실행 거부</small>"]
    DENIED -->|"거부 사유 피드백"| LLM_CALL
    CHECKPOINT -->|"스냅샷 저장"| TOOL_GROUP["TOOL_GROUP<br/><small>병렬/직렬 실행 그룹 분류</small>"]
    TOOL_GROUP -->|"읽기 전용 그룹"| PARALLEL_EXEC["PARALLEL_EXEC<br/><small>Promise.allSettled 병렬 실행</small>"]
    TOOL_GROUP -->|"쓰기 포함 그룹"| SERIAL_EXEC["SERIAL_EXEC<br/><small>순차적 도구 실행</small>"]
    PARALLEL_EXEC -->|"실행 완료"| OBS_MASK["OBS_MASK<br/><small>읽기 전용 도구 출력을 플레이스홀더로 대체</small>"]
    SERIAL_EXEC -->|"실행 완료"| OBS_MASK
    OBS_MASK -->|"마스킹 적용"| CIRCUIT_CHECK["CIRCUIT_CHECK<br/><small>무변경/에러 반복 횟수 확인</small>"]
    CIRCUIT_CHECK -->|"OK (closed)"| LLM_CALL
    CIRCUIT_CHECK -->|"Trip (open)"| RECOVERY["RECOVERY<br/><small>에러 유형별 복구 전략 실행</small>"]
    RECOVERY -->|"compact / retry"| LLM_CALL
    RECOVERY -->|"fallback"| STRATEGY_SWITCH["STRATEGY_SWITCH<br/><small>도구 호출 전략 변경</small>"]
    STRATEGY_SWITCH -->|"text-parsing 전환"| LLM_CALL
    BLOCKED --> END`;

export function AgentLoopSection() {
  return (
    <section
      id="agent-loop"
      className="py-16 bg-violet-50/50"
      style={{ paddingTop: "64px", paddingBottom: "64px" }}
    >
      <div className="center-container">
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
          <MermaidDiagram
            chart={stateMachineChart}
            title="Agent Loop 내부 상태머신"
            titleColor="purple"
          />
        </RevealOnScroll>

        <RevealOnScroll>
          <h3
            className="text-lg font-semibold text-gray-900 mb-4"
            style={{ marginTop: "32px", marginBottom: "16px" }}
          >
            핵심 인터페이스
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5" style={{ gap: "20px" }}>
            <CodeBlock>
              <span className="cm">{"// Agent Loop 설정"}</span>
              {"\n"}
              <span className="kw">interface</span> <span className="type">AgentLoopConfig</span>{" "}
              {"{"}
              {"\n"}
              {"  "}
              <span className="prop">client</span>: <span className="type">LLMProvider</span>;{" "}
              <span className="cm">{"// LLM 클라이언트"}</span>
              {"\n"}
              {"  "}
              <span className="prop">model</span>: <span className="type">string</span>;{" "}
              <span className="cm">{"// 모델명"}</span>
              {"\n"}
              {"  "}
              <span className="prop">toolRegistry</span>: <span className="type">ToolRegistry</span>
              ; <span className="cm">{"// 도구 저장소"}</span>
              {"\n"}
              {"  "}
              <span className="prop">strategy</span>: <span className="type">ToolCallStrategy</span>
              ; <span className="cm">{"// native | text-parsing"}</span>
              {"\n"}
              {"  "}
              <span className="prop">maxIterations</span>: <span className="type">number</span>;{" "}
              <span className="cm">{"// 기본 50"}</span>
              {"\n"}
              {"  "}
              <span className="prop">signal</span>: <span className="type">AbortSignal</span>;{" "}
              <span className="cm">{"// 취소 신호"}</span>
              {"\n"}
              {"  "}
              <span className="prop">checkPermission</span>:{" "}
              <span className="type">PermCheckFn</span>;{" "}
              <span className="cm">{"// 권한 콜백"}</span>
              {"\n"}
              {"  "}
              <span className="prop">useStreaming</span>: <span className="type">boolean</span>;{" "}
              <span className="cm">{"// SSE 여부"}</span>
              {"\n"}
              {"  "}
              <span className="prop">dualModelRouter</span>?:{" "}
              <span className="type">DualModelRouter</span>;{"\n"}
              {"  "}
              <span className="prop">enableGuardrails</span>: <span className="type">boolean</span>;{" "}
              <span className="cm">{"// 보안 필터"}</span>
              {"\n"}
              {"}"}
            </CodeBlock>
            <CodeBlock>
              <span className="cm">{"// 실행 결과"}</span>
              {"\n"}
              <span className="kw">interface</span> <span className="type">AgentLoopResult</span>{" "}
              {"{"}
              {"\n"}
              {"  "}
              <span className="prop">messages</span>: <span className="type">ChatMessage</span>[];{" "}
              <span className="cm">{"// 전체 대화 히스토리"}</span>
              {"\n"}
              {"  "}
              <span className="prop">iterations</span>: <span className="type">number</span>;{" "}
              <span className="cm">{"// 반복 횟수"}</span>
              {"\n"}
              {"  "}
              <span className="prop">aborted</span>: <span className="type">boolean</span>;{" "}
              <span className="cm">{"// 사용자 취소 여부"}</span>
              {"\n"}
              {"  "}
              <span className="prop">usage</span>: <span className="type">AggregatedUsage</span>;{" "}
              <span className="cm">{"// 토큰 통계"}</span>
              {"\n"}
              {"}"}
              {"\n\n"}
              <span className="kw">interface</span> <span className="type">AggregatedUsage</span>{" "}
              {"{"}
              {"\n"}
              {"  "}
              <span className="prop">inputTokens</span>: <span className="type">number</span>;{"\n"}
              {"  "}
              <span className="prop">outputTokens</span>: <span className="type">number</span>;
              {"\n"}
              {"  "}
              <span className="prop">totalTokens</span>: <span className="type">number</span>;{"\n"}
              {"  "}
              <span className="prop">toolCalls</span>: <span className="type">number</span>;{" "}
              <span className="cm">{"// 도구 호출 총 횟수"}</span>
              {"\n"}
              {"  "}
              <span className="prop">retries</span>: <span className="type">number</span>;{" "}
              <span className="cm">{"// 재시도 횟수"}</span>
              {"\n"}
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

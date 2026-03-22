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

export default function LlmStreamingPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/llm/streaming.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">LLM Streaming</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="infra" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              SSE 스트리밍 파서 + 청크 누적 &mdash; LLM의 실시간 스트리밍 응답을 누적하고 관리하는
              모듈입니다.
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
                LLM은 응답을 한 번에 보내지 않고, 토큰 단위로 점진적으로 보냅니다(스트리밍). 이
                모듈은 이러한 스트리밍 청크(chunk)를 받아서 텍스트, 도구 호출, 사고(thinking) 내용을
                하나의 <code className="text-cyan-600">StreamAccumulator</code> 객체로 누적합니다.
              </p>
              <p>
                메모리 과다 사용을 방지하는 백프레셔(backpressure) 메커니즘이 내장되어 있어, 매우 긴
                응답에서도 버퍼가 무한정 커지지 않습니다. 기본 1MB 한도를 초과하면 앞부분(오래된
                텍스트)을 자동으로 잘라냅니다.
              </p>
              <p>
                모든 상태 업데이트는 불변(immutable) 패턴을 따릅니다. 기존 객체를 수정하지 않고 매번
                새 객체를 생성하여 반환하므로, 상태 추적과 디버깅이 용이합니다. 에러 발생 시에도
                이미 누적된 부분 데이터를 복구할 수 있습니다.
              </p>
            </div>

            <MermaidDiagram
              title="Streaming 아키텍처 위치"
              titleColor="purple"
              chart={`graph TD
  LLM["LLM Client<br/><small>llm/client.ts — API 호출</small>"]
  STREAM["Streaming<br/><small>llm/streaming.ts — 청크 누적</small>"]
  PROV["Provider<br/><small>llm/provider.ts — ChatChunk 정의</small>"]
  AL["Agent Loop<br/><small>core/agent-loop.ts — 결과 소비</small>"]
  UI["CLI UI<br/><small>Ink 컴포넌트 — 실시간 표시</small>"]

  LLM -->|"AsyncIterable<ChatChunk>"| STREAM
  PROV -->|"타입 정의"| STREAM
  STREAM -->|"StreamAccumulator"| AL
  STREAM -->|"onTextDelta 콜백"| UI

  style STREAM fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style LLM fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style PROV fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style AL fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style UI fill:#e0e7ff,stroke:#64748b,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> 라디오 방송을 떠올리세요. 방송국(LLM)이 음파(토큰)를 연속으로
              보내면, 라디오 수신기(이 모듈)가 음파를 모아 완성된 음악(응답)으로 재구성합니다. 전파
              장애(에러)가 발생해도 이미 들은 부분은 보존됩니다.
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

            {/* DEFAULT_MAX_BUFFER_BYTES constant */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              const DEFAULT_MAX_BUFFER_BYTES
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              기본 최대 버퍼 크기 상수입니다. 백프레셔 설정을 생략하면 이 값이 사용됩니다.
            </p>
            <CodeBlock>
              <span className="kw">export const</span>{" "}
              <span className="prop">DEFAULT_MAX_BUFFER_BYTES</span> ={" "}
              <span className="num">1024</span> * <span className="num">1024</span>;{"\n"}
              <span className="cm">{"// = 1,048,576 바이트 (1MB)"}</span>
            </CodeBlock>

            {/* BackpressureConfig interface */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface BackpressureConfig
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              메모리 사용량을 제한하는 백프레셔 설정입니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "maxBufferBytes",
                  type: "number | undefined",
                  required: false,
                  desc: "최대 버퍼 크기 (바이트). 기본값: 1MB (1,048,576). 이 값을 초과하면 오래된 텍스트를 자동으로 잘라냅니다.",
                },
              ]}
            />

            {/* StreamAccumulator interface */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface StreamAccumulator
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              현재까지 받은 모든 스트리밍 데이터의 스냅샷입니다. 불변 객체이므로 매번 새 인스턴스가
              생성됩니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "text",
                  type: "string",
                  required: true,
                  desc: "지금까지 누적된 텍스트 응답",
                },
                {
                  name: "toolCalls",
                  type: "readonly ToolCallRequest[]",
                  required: true,
                  desc: "지금까지 조립된 도구 호출 목록",
                },
                {
                  name: "isComplete",
                  type: "boolean",
                  required: true,
                  desc: "스트리밍이 완료되었는지 여부",
                },
                {
                  name: "partial",
                  type: "boolean | undefined",
                  required: false,
                  desc: "스트림이 중간에 끊겨서 부분 데이터만 복구된 경우 true",
                },
                {
                  name: "usage",
                  type: "TokenUsage | undefined",
                  required: false,
                  desc: "API가 보고한 토큰 사용량 (완료 시 제공)",
                },
                {
                  name: "thinking",
                  type: "string | undefined",
                  required: false,
                  desc: "Extended Thinking에서 누적된 사고 내용",
                },
                {
                  name: "bufferBytes",
                  type: "number | undefined",
                  required: false,
                  desc: "현재 추정 버퍼 크기 (바이트)",
                },
                {
                  name: "trimmed",
                  type: "boolean | undefined",
                  required: false,
                  desc: "백프레셔로 인해 텍스트가 잘렸으면 true",
                },
                {
                  name: "finishReason",
                  type: "string | undefined",
                  required: false,
                  desc: 'API가 보고한 응답 종료 사유 ("stop", "length", "tool_calls" 등)',
                },
              ]}
            />

            {/* createStreamAccumulator */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              createStreamAccumulator()
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              새로운 빈 StreamAccumulator를 생성합니다. 스트리밍 시작 시 초기 상태로 사용합니다.
            </p>
            <CodeBlock>
              <span className="fn">createStreamAccumulator</span>():{" "}
              <span className="type">StreamAccumulator</span>
              {"\n"}
              <span className="cm">
                {'// 반환: { text: "", toolCalls: [], isComplete: false, bufferBytes: 0 }'}
              </span>
            </CodeBlock>

            {/* accumulateChunk */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              accumulateChunk(state, chunk, backpressure?)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              하나의 스트리밍 청크를 처리하여 갱신된 누적 상태를 반환합니다. 불변 업데이트 &mdash;
              기존 상태를 수정하지 않고 새 객체를 생성합니다.
            </p>
            <CodeBlock>
              <span className="fn">accumulateChunk</span>({"\n"}
              {"  "}
              <span className="prop">state</span>: <span className="type">StreamAccumulator</span>,
              {"\n"}
              {"  "}
              <span className="prop">chunk</span>: <span className="type">ChatChunk</span>,{"\n"}
              {"  "}
              <span className="prop">backpressure</span>?:{" "}
              <span className="type">BackpressureConfig</span>,{"\n"}):{" "}
              <span className="type">StreamAccumulator</span>
            </CodeBlock>
            <ParamTable
              params={[
                {
                  name: "state",
                  type: "StreamAccumulator",
                  required: true,
                  desc: "현재 누적 상태",
                },
                {
                  name: "chunk",
                  type: "ChatChunk",
                  required: true,
                  desc: "처리할 스트리밍 청크 (text-delta, tool-call-delta, thinking-delta, done)",
                },
                {
                  name: "backpressure",
                  type: "BackpressureConfig",
                  required: false,
                  desc: "백프레셔 설정 (선택적, 기본 1MB)",
                },
              ]}
            />

            {/* consumeStream */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              consumeStream(stream, callbacks?, backpressure?)
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              스트리밍 응답을 소비하며 콜백을 호출하는 고수준 함수입니다. AsyncIterable을 순회하면서
              각 청크를 누적하고, 타입별 콜백을 호출합니다.
            </p>
            <CodeBlock>
              <span className="kw">async</span> <span className="fn">consumeStream</span>({"\n"}
              {"  "}
              <span className="prop">stream</span>: <span className="type">AsyncIterable</span>
              {"<"}
              <span className="type">ChatChunk</span>
              {">"},{"\n"}
              {"  "}
              <span className="prop">callbacks</span>?: {"{"}
              {"\n"}
              {"    "}
              <span className="prop">onTextDelta</span>?: (<span className="prop">text</span>:{" "}
              <span className="type">string</span>) ={">"} <span className="type">void</span>;{"\n"}
              {"    "}
              <span className="prop">onToolCallDelta</span>?: (
              <span className="prop">toolCall</span>: <span className="type">Partial</span>
              {"<"}
              <span className="type">ToolCallRequest</span>
              {">"}) ={">"} <span className="type">void</span>;{"\n"}
              {"    "}
              <span className="prop">onThinkingDelta</span>?: (<span className="prop">text</span>:{" "}
              <span className="type">string</span>) ={">"} <span className="type">void</span>;{"\n"}
              {"    "}
              <span className="prop">onComplete</span>?: (<span className="prop">acc</span>:{" "}
              <span className="type">StreamAccumulator</span>) ={">"}{" "}
              <span className="type">void</span>;{"\n"}
              {"    "}
              <span className="prop">onUsage</span>?: (<span className="prop">usage</span>:{" "}
              <span className="type">TokenUsage</span>) ={">"} <span className="type">void</span>;
              {"\n"}
              {"  "}
              {"}"},{"\n"}
              {"  "}
              <span className="prop">backpressure</span>?:{" "}
              <span className="type">BackpressureConfig</span>,{"\n"}):{" "}
              <span className="type">Promise</span>
              {"<"}
              <span className="type">StreamAccumulator</span>
              {">"}
            </CodeBlock>

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                <code className="text-cyan-600">accumulateChunk</code>는 순수 함수입니다. 기존 state
                객체를 변경하지 않으며, 매번 새로운 객체를 반환합니다.
              </li>
              <li>
                <code className="text-cyan-600">tool-call-delta</code> 청크에서{" "}
                <code className="text-cyan-600">id</code>와
                <code className="text-cyan-600"> name</code>이 모두 없으면 해당 청크는
                무시(DROP)됩니다.
              </li>
              <li>
                <code className="text-cyan-600">trimmed</code> 플래그는 한 번 true가 되면 이후
                상태에서도 true를 유지합니다. 백프레셔로 잘린 이력이 있음을 나타냅니다.
              </li>
              <li>
                <code className="text-cyan-600">consumeStream</code>에서 에러 발생 시, 이미 누적된
                텍스트나 도구 호출이 있으면 <code className="text-cyan-600">partial: true</code>로
                부분 데이터를 보존합니다. 누적 데이터가 없으면 에러를 재throw합니다.
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
              기본 사용법 &mdash; consumeStream으로 스트리밍 소비
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              가장 일반적인 패턴입니다. LLM Client가 반환한 AsyncIterable을
              <code className="text-cyan-600"> consumeStream()</code>에 전달하고 콜백으로 실시간
              UI를 업데이트합니다.
            </p>
            <CodeBlock>
              <span className="kw">import</span> {"{"} <span className="prop">consumeStream</span>{" "}
              {"}"} <span className="kw">from</span>{" "}
              <span className="str">&quot;./llm/streaming.js&quot;</span>;{"\n"}
              {"\n"}
              <span className="cm">{"// LLM 스트리밍 응답 소비"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">result</span> ={" "}
              <span className="kw">await</span> <span className="fn">consumeStream</span>(
              <span className="prop">stream</span>, {"{"}
              {"\n"}
              {"  "}
              <span className="fn">onTextDelta</span>: (<span className="prop">text</span>) ={">"}{" "}
              <span className="fn">process</span>.<span className="prop">stdout</span>.
              <span className="fn">write</span>(<span className="prop">text</span>),
              {"\n"}
              {"  "}
              <span className="fn">onToolCallDelta</span>: (<span className="prop">tc</span>) ={">"}{" "}
              <span className="fn">showToolProgress</span>(<span className="prop">tc</span>),
              {"\n"}
              {"  "}
              <span className="fn">onComplete</span>: (<span className="prop">acc</span>) ={">"}{" "}
              <span className="fn">handleComplete</span>(<span className="prop">acc</span>),
              {"\n"}
              {"  "}
              <span className="fn">onUsage</span>: (<span className="prop">usage</span>) ={">"}{" "}
              <span className="fn">trackCost</span>(<span className="prop">usage</span>),
              {"\n"}
              {"}"});
              {"\n"}
              {"\n"}
              <span className="cm">{"// 결과 확인"}</span>
              {"\n"}
              <span className="fn">console</span>.<span className="fn">log</span>(
              <span className="prop">result</span>.<span className="prop">text</span>);
              {"\n"}
              <span className="fn">console</span>.<span className="fn">log</span>(
              <span className="prop">result</span>.<span className="prop">toolCalls</span>);
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> <code>consumeStream</code>은 스트림을 끝까지 소비합니다. 동일
              스트림을 두 번 소비할 수 없으므로, 여러 곳에서 결과가 필요하면 반환된{" "}
              <code>StreamAccumulator</code>를 공유하세요.
            </Callout>

            {/* 고급 사용법: 백프레셔 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 백프레셔 설정
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              기본 버퍼 한도는 1MB입니다. 메모리 제약이 있는 환경에서는 더 낮게, 긴 응답이 예상되면
              더 높게 설정할 수 있습니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 256KB로 제한 (메모리 제약 환경)"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">result</span> ={" "}
              <span className="kw">await</span> <span className="fn">consumeStream</span>(
              <span className="prop">stream</span>, <span className="prop">callbacks</span>, {"{"}
              {"\n"}
              {"  "}
              <span className="prop">maxBufferBytes</span>: <span className="num">256</span> *{" "}
              <span className="num">1024</span>,{"\n"}
              {"}"});
              {"\n"}
              {"\n"}
              <span className="cm">{"// 잘림 여부 확인"}</span>
              {"\n"}
              <span className="kw">if</span> (<span className="prop">result</span>.
              <span className="prop">trimmed</span>) {"{"}
              {"\n"}
              {"  "}
              <span className="fn">logger</span>.<span className="fn">warn</span>(
              <span className="str">&quot;응답이 백프레셔로 잘렸습니다&quot;</span>);
              {"\n"}
              {"}"}
            </CodeBlock>

            {/* 고급 사용법: 저수준 accumulateChunk */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; accumulateChunk로 직접 제어
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">consumeStream</code>이 제공하지 않는 세밀한 제어가
              필요할 때,
              <code className="text-cyan-600"> accumulateChunk</code>를 직접 사용합니다.
            </p>
            <CodeBlock>
              <span className="kw">import</span> {"{"}{" "}
              <span className="prop">createStreamAccumulator</span>,{" "}
              <span className="prop">accumulateChunk</span> {"}"} <span className="kw">from</span>{" "}
              <span className="str">&quot;./llm/streaming.js&quot;</span>;{"\n"}
              {"\n"}
              <span className="kw">let</span> <span className="prop">state</span> ={" "}
              <span className="fn">createStreamAccumulator</span>();
              {"\n"}
              {"\n"}
              <span className="kw">for await</span> (<span className="kw">const</span>{" "}
              <span className="prop">chunk</span> <span className="kw">of</span>{" "}
              <span className="prop">stream</span>) {"{"}
              {"\n"}
              {"  "}
              <span className="prop">state</span> = <span className="fn">accumulateChunk</span>(
              <span className="prop">state</span>, <span className="prop">chunk</span>);
              {"\n"}
              {"  "}
              <span className="cm">{"// 중간 상태에서 커스텀 로직 수행 가능"}</span>
              {"\n"}
              {"  "}
              <span className="kw">if</span> (<span className="prop">state</span>.
              <span className="prop">toolCalls</span>.<span className="prop">length</span> {">"}{" "}
              <span className="num">3</span>) <span className="kw">break</span>;{"\n"}
              {"}"}
            </CodeBlock>

            <DeepDive title="에러 복구 동작 상세">
              <p className="mb-3">
                <code className="text-cyan-600">consumeStream</code>은 스트리밍 중 에러 발생 시 두
                가지 전략을 사용합니다:
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-gray-600">
                <li>
                  <strong>부분 데이터 보존:</strong> 이미 텍스트나 도구 호출이 누적되었으면
                  <code className="text-cyan-600"> partial: true</code>를 설정하여 부분 결과를
                  반환합니다. 사용자에게 아무것도 보여주지 않는 것보다 부분 응답이라도 보여주는 것이
                  낫습니다.
                </li>
                <li>
                  <strong>에러 재throw:</strong> 누적된 데이터가 전혀 없으면 에러를 그대로 throw하여
                  상위 호출자(Agent Loop)가 재시도할 수 있도록 합니다.
                </li>
              </ul>
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
              청크 타입별 처리 흐름
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">accumulateChunk</code>는 청크 타입에 따라 서로 다른
              처리를 수행합니다. switch 문으로 분기하며, 모든 경우에 불변 업데이트를 수행합니다.
            </p>

            <MermaidDiagram
              title="청크 타입별 처리 흐름"
              titleColor="purple"
              chart={`graph TD
  CHUNK["ChatChunk 수신<br/><small>스트리밍 청크 도착</small>"]
  SW{"chunk.type<br/><small>타입 분기</small>"}
  TH["thinking-delta<br/><small>사고 내용 누적</small>"]
  TX["text-delta<br/><small>텍스트 누적 + 백프레셔</small>"]
  TC["tool-call-delta<br/><small>도구 호출 조립</small>"]
  DN["done<br/><small>완료 플래그 + 사용량 저장</small>"]
  BP{"버퍼 초과?<br/><small>maxBufferBytes 비교</small>"}
  TRIM["앞쪽 절반 잘라내기<br/><small>trimmed = true</small>"]
  OUT["갱신된 StreamAccumulator<br/><small>새 불변 객체 반환</small>"]

  CHUNK --> SW
  SW -->|"thinking-delta"| TH
  SW -->|"text-delta"| TX
  SW -->|"tool-call-delta"| TC
  SW -->|"done"| DN
  TX --> BP
  BP -->|"초과"| TRIM
  BP -->|"이내"| OUT
  TRIM --> OUT
  TH --> OUT
  TC --> OUT
  DN --> OUT

  style CHUNK fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style SW fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style TX fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style BP fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style TRIM fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style OUT fill:#dcfce7,stroke:#10b981,color:#065f46`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              핵심 코드 분석
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">accumulateChunk</code>의 text-delta 처리 로직입니다.
              텍스트를 누적한 뒤 백프레셔를 적용합니다.
            </p>
            <CodeBlock>
              <span className="kw">case</span> <span className="str">&quot;text-delta&quot;</span>:{" "}
              {"{"}
              {"\n"}
              {"  "}
              <span className="cm">{"// [1] 새로운 텍스트 조각을 기존 텍스트에 이어 붙임"}</span>
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">delta</span> ={" "}
              <span className="prop">chunk</span>.<span className="prop">text</span> ??{" "}
              <span className="str">&quot;&quot;</span>;{"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">newText</span> ={" "}
              <span className="prop">state</span>.<span className="prop">text</span> +{" "}
              <span className="prop">delta</span>;{"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">newBytes</span> = (
              <span className="prop">state</span>.<span className="prop">bufferBytes</span> ??{" "}
              <span className="num">0</span>) + <span className="fn">estimateByteLength</span>(
              <span className="prop">delta</span>);
              {"\n"}
              {"\n"}
              {"  "}
              <span className="cm">
                {"// [2] 백프레셔: 버퍼 크기가 한도 초과 시 앞쪽 절반 잘라냄"}
              </span>
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">bp</span> ={" "}
              <span className="fn">applyBackpressure</span>(<span className="prop">newText</span>,{" "}
              <span className="prop">newBytes</span>, <span className="prop">maxBytes</span>);
              {"\n"}
              {"\n"}
              {"  "}
              <span className="cm">{"// [3] 불변 업데이트: 새 객체를 생성하여 반환"}</span>
              {"\n"}
              {"  "}
              <span className="kw">return</span> {"{"}
              {"\n"}
              {"    "}...<span className="prop">state</span>,{"\n"}
              {"    "}
              <span className="prop">text</span>: <span className="prop">bp</span>.
              <span className="prop">text</span>,{"\n"}
              {"    "}
              <span className="prop">bufferBytes</span>: <span className="prop">bp</span>.
              <span className="prop">bufferBytes</span>,{"\n"}
              {"    "}
              <span className="cm">{"// [4] 한 번이라도 잘렸으면 trimmed = true 유지"}</span>
              {"\n"}
              {"    "}
              <span className="prop">trimmed</span>: <span className="prop">bp</span>.
              <span className="prop">trimmed</span> || <span className="prop">state</span>.
              <span className="prop">trimmed</span>,{"\n"}
              {"  "}
              {"}"};{"\n"}
              {"}"}
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">[1]</strong> 텍스트 조각(delta)을 기존 누적
                텍스트에 이어 붙여 전체 텍스트를 구성합니다.
              </p>
              <p>
                <strong className="text-gray-900">[2]</strong>{" "}
                <code className="text-cyan-600">estimateByteLength</code>로 UTF-8 바이트 길이를
                빠르게 추정합니다. Buffer.byteLength보다 성능이 좋습니다.
              </p>
              <p>
                <strong className="text-gray-900">[3]</strong> 스프레드 연산자로 기존 상태를
                복사하고, 변경된 필드만 덮어씁니다 (불변 업데이트).
              </p>
              <p>
                <strong className="text-gray-900">[4]</strong>{" "}
                <code className="text-cyan-600">trimmed</code>는 OR 논리로 한 번이라도 잘린 이력이
                있으면 영구적으로 true를 유지합니다.
              </p>
            </div>

            <DeepDive title="estimateByteLength 성능 최적화">
              <p className="mb-3">
                정확한 UTF-8 인코딩 대신 <code className="text-cyan-600">charCodeAt</code> 기반
                근사치를 사용합니다. 스트리밍 중 매 청크마다 호출되므로 성능이 중요합니다:
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-gray-600">
                <li>ASCII (0x00~0x7F): 1바이트</li>
                <li>라틴 확장 (0x80~0x7FF): 2바이트</li>
                <li>한글, CJK 등 (0x800~): 3바이트</li>
              </ul>
              <p className="mt-3 text-amber-600">
                서로게이트 페어(이모지 등 4바이트 문자)는 3바이트로 과소 추정될 수 있지만, 백프레셔
                임계값의 정밀도에는 충분합니다.
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
                &quot;응답 텍스트의 앞부분이 잘려 있어요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                백프레셔가 작동한 것입니다. <code className="text-cyan-600">result.trimmed</code>가
                <code className="text-cyan-600"> true</code>인지 확인하세요.
              </p>
              <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
                <li>기본 1MB 한도를 초과하면 앞쪽 절반이 자동으로 잘립니다.</li>
                <li>
                  더 긴 응답이 필요하면 <code className="text-cyan-600">maxBufferBytes</code>를
                  늘리세요.
                </li>
              </ul>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;도구 호출이 누락되거나 불완전해요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                도구 호출 청크에 <code className="text-cyan-600">id</code>와
                <code className="text-cyan-600"> name</code>이 모두 있어야 새 도구 호출로
                등록됩니다.
                <code className="text-cyan-600"> DBCODE_VERBOSE=1</code>을 설정하면 DROP된 청크를
                로그에서 확인할 수 있습니다.
              </p>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;스트리밍 중 에러가 발생했는데 부분 응답이 반환됐어요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                이것은 의도된 동작입니다. <code className="text-cyan-600">partial: true</code>로
                표시된 결과는 네트워크 에러 등으로 스트림이 중간에 끊긴 경우입니다. 이미 받은
                데이터를 버리지 않고 보존하여 사용자에게 보여줍니다.
                <code className="text-cyan-600"> isComplete</code>가{" "}
                <code className="text-cyan-600">false</code>이므로 완전한 응답이 아님을 구분할 수
                있습니다.
              </p>
            </div>

            {/* FAQ 4 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;onTextDelta 콜백이 호출되지 않아요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                LLM이 텍스트 대신 도구 호출만 반환하는 경우입니다.
                <code className="text-cyan-600"> onToolCallDelta</code> 콜백도 등록했는지
                확인하세요. 또한 <code className="text-cyan-600">chunk.text</code>가 빈 문자열이면
                콜백이 호출되지 않습니다.
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
                  name: "llm-client.ts",
                  slug: "llm-client",
                  relation: "parent",
                  desc: "LLM Client가 스트리밍 API를 호출하고 AsyncIterable<ChatChunk>를 반환합니다",
                },
                {
                  name: "llm-provider.ts",
                  slug: "llm-provider",
                  relation: "sibling",
                  desc: "ChatChunk, TokenUsage, ToolCallRequest 등 스트리밍에 사용되는 타입을 정의합니다",
                },
                {
                  name: "agent-loop.ts",
                  slug: "agent-loop",
                  relation: "parent",
                  desc: "Agent Loop가 consumeStream을 호출하여 LLM 응답을 소비합니다",
                },
                {
                  name: "token-counter.ts",
                  slug: "token-counter",
                  relation: "sibling",
                  desc: "스트리밍 완료 후 usage 데이터를 기반으로 토큰 사용량을 추적합니다",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}

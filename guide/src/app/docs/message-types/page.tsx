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

export default function MessageTypesPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/core/message-types.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">Message Types</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="core" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              LLM과 주고받는 모든 채팅 메시지의 타입 정의, 역할 상수, 타입 가드 함수를 제공하는
              핵심 타입 모듈입니다.
            </p>
          </div>
        </RevealOnScroll>

        {/* ─── 1. 개요 ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>📋</span> 개요
            </h2>

            <div className="text-[14px] text-gray-600 leading-[1.85] space-y-4">
              <p>
                <code className="text-cyan-600 text-[13px]">message-types.ts</code>는 dbcode
                전체에서 사용하는{" "}
                <strong className="text-gray-900">채팅 메시지의 설계도</strong>입니다. 모든 LLM
                호출, 컨텍스트 관리, 도구 실행 결과 전달에서 이 타입들이 사용됩니다.
              </p>
              <p>
                메시지는 네 가지 역할(role)로 구분됩니다:{" "}
                <code className="text-violet-600 text-[13px]">system</code>(행동 규칙 설정),{" "}
                <code className="text-violet-600 text-[13px]">user</code>(사용자 입력),{" "}
                <code className="text-violet-600 text-[13px]">assistant</code>(LLM 응답),{" "}
                <code className="text-violet-600 text-[13px]">tool</code>(도구 실행 결과). 이
                구조는 OpenAI Chat Completions API 형식을 따릅니다.
              </p>
              <p>
                TypeScript의{" "}
                <strong className="text-gray-900">구별된 유니온(discriminated union)</strong>{" "}
                패턴을 사용합니다. role 필드를 판별자(discriminant)로 사용하여 각 메시지 타입을
                컴파일 타임에 안전하게 좁힐 수 있습니다.
              </p>
            </div>

            <MermaidDiagram
              title="메시지 타입 계층 구조"
              titleColor="purple"
              chart={`classDiagram
    class ChatMessage {
        +role MessageRoleValue
        +content string
        +timestamp Date
    }
    class UserMessage {
        +role "user"
    }
    class AssistantMessage {
        +role "assistant"
        +toolCalls readonly ToolCall[]
    }
    class ToolMessage {
        +role "tool"
        +toolCallId string
        +isError boolean
    }
    class SystemMessage {
        +role "system"
    }
    class ToolCall {
        +id string
        +name string
        +arguments string
    }

    ChatMessage <|-- UserMessage
    ChatMessage <|-- AssistantMessage
    ChatMessage <|-- ToolMessage
    ChatMessage <|-- SystemMessage
    AssistantMessage --> ToolCall`}
            />
          </section>
        </RevealOnScroll>

        {/* ─── 2. 레퍼런스 ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>📖</span> 레퍼런스
            </h2>

            {/* MessageRole */}
            <div className="mb-8">
              <h3
                className="text-[17px] font-bold text-indigo-600 font-mono"
                style={{ marginTop: "32px", marginBottom: "16px" }}
              >
                MessageRole 상수
              </h3>
              <p className="text-[14px] text-gray-600 leading-[1.85] mb-4">
                채팅에서 메시지 발신자 역할을 나타내는 상수 객체입니다.{" "}
                <code className="text-cyan-600">as const</code>로 선언하여 리터럴 타입으로
                사용합니다.
              </p>
              <CodeBlock>
                <span className="text-[#ff7b72]">const</span> MessageRole = {"{"}{"\n"}
                {"  "}System: <span className="text-[#a5d6ff]">"system"</span>,{"\n"}
                {"  "}User: <span className="text-[#a5d6ff]">"user"</span>,{"\n"}
                {"  "}Assistant: <span className="text-[#a5d6ff]">"assistant"</span>,{"\n"}
                {"  "}Tool: <span className="text-[#a5d6ff]">"tool"</span>,{"\n"}
                {"}"} <span className="text-[#ff7b72]">as const</span>
              </CodeBlock>
            </div>

            {/* ChatMessage */}
            <div className="mb-8">
              <h3
                className="text-[17px] font-bold text-indigo-600 font-mono"
                style={{ marginTop: "32px", marginBottom: "16px" }}
              >
                ChatMessage 인터페이스
              </h3>
              <p className="text-[14px] text-gray-600 leading-[1.85] mb-4">
                모든 메시지가 공통으로 가지는 기본 인터페이스입니다.
              </p>
              <ParamTable
                params={[
                  {
                    name: "role",
                    type: "MessageRoleValue",
                    required: true,
                    desc: '"system" | "user" | "assistant" | "tool" 중 하나.',
                  },
                  {
                    name: "content",
                    type: "string",
                    required: true,
                    desc: "메시지 본문 텍스트.",
                  },
                  {
                    name: "timestamp",
                    type: "Date",
                    required: true,
                    desc: "메시지 생성 시각.",
                  },
                ]}
              />
            </div>

            {/* AssistantMessage */}
            <div className="mb-8">
              <h3
                className="text-[17px] font-bold text-indigo-600 font-mono"
                style={{ marginTop: "32px", marginBottom: "16px" }}
              >
                AssistantMessage 인터페이스
              </h3>
              <p className="text-[14px] text-gray-600 leading-[1.85] mb-4">
                LLM이 생성한 응답 메시지. 도구 호출 목록을 포함할 수 있습니다.
              </p>
              <ParamTable
                params={[
                  {
                    name: "role",
                    type: '"assistant"',
                    required: true,
                    desc: "항상 "assistant".",
                  },
                  {
                    name: "toolCalls",
                    type: "readonly ToolCall[]",
                    required: true,
                    desc: "LLM이 요청한 도구 호출 배열. 도구 호출 없으면 빈 배열.",
                  },
                ]}
              />
            </div>

            {/* ToolMessage */}
            <div className="mb-8">
              <h3
                className="text-[17px] font-bold text-indigo-600 font-mono"
                style={{ marginTop: "32px", marginBottom: "16px" }}
              >
                ToolMessage 인터페이스
              </h3>
              <p className="text-[14px] text-gray-600 leading-[1.85] mb-4">
                도구 실행 결과를 LLM에 전달하는 메시지 타입입니다.
              </p>
              <ParamTable
                params={[
                  {
                    name: "role",
                    type: '"tool"',
                    required: true,
                    desc: "항상 "tool".",
                  },
                  {
                    name: "toolCallId",
                    type: "string",
                    required: true,
                    desc: "이 결과가 응답하는 ToolCall의 id 값. LLM이 요청과 결과를 매칭하는 데 사용됩니다.",
                  },
                  {
                    name: "isError",
                    type: "boolean",
                    required: true,
                    desc: "도구 실행 중 에러 발생 여부.",
                  },
                ]}
              />
            </div>

            {/* ToolCall */}
            <div className="mb-8">
              <h3
                className="text-[17px] font-bold text-indigo-600 font-mono"
                style={{ marginTop: "32px", marginBottom: "16px" }}
              >
                ToolCall 인터페이스
              </h3>
              <ParamTable
                params={[
                  {
                    name: "id",
                    type: "string",
                    required: true,
                    desc: "도구 호출의 고유 식별자. ToolMessage와 매칭하는 데 사용됩니다.",
                  },
                  {
                    name: "name",
                    type: "string",
                    required: true,
                    desc: "호출할 도구 이름. 예: "file_read", "bash_exec".",
                  },
                  {
                    name: "arguments",
                    type: "string",
                    required: true,
                    desc: "도구에 전달할 인자. JSON 문자열 형태.",
                  },
                ]}
              />
            </div>

            {/* 타입 가드 */}
            <div className="mb-8">
              <h3
                className="text-[17px] font-bold text-indigo-600 font-mono"
                style={{ marginTop: "32px", marginBottom: "16px" }}
              >
                타입 가드 함수
              </h3>
              <p className="text-[14px] text-gray-600 leading-[1.85] mb-4">
                런타임에 메시지 타입을 좁히는 타입 가드 함수 4개를 제공합니다.
              </p>
              <CodeBlock>
                <span className="text-[#ff7b72]">function</span>{" "}
                <span className="text-[#d2a8ff]">isUserMessage</span>(
                <span className="text-[#ffa657]">msg</span>:{" "}
                <span className="text-[#79c0ff]">ChatMessage</span>):{" "}
                <span className="text-[#79c0ff]">msg is UserMessage</span>
                {"\n"}
                <span className="text-[#ff7b72]">function</span>{" "}
                <span className="text-[#d2a8ff]">isAssistantMessage</span>(
                <span className="text-[#ffa657]">msg</span>:{" "}
                <span className="text-[#79c0ff]">ChatMessage</span>):{" "}
                <span className="text-[#79c0ff]">msg is AssistantMessage</span>
                {"\n"}
                <span className="text-[#ff7b72]">function</span>{" "}
                <span className="text-[#d2a8ff]">isToolMessage</span>(
                <span className="text-[#ffa657]">msg</span>:{" "}
                <span className="text-[#79c0ff]">ChatMessage</span>):{" "}
                <span className="text-[#79c0ff]">msg is ToolMessage</span>
                {"\n"}
                <span className="text-[#ff7b72]">function</span>{" "}
                <span className="text-[#d2a8ff]">isSystemMessage</span>(
                <span className="text-[#ffa657]">msg</span>:{" "}
                <span className="text-[#79c0ff]">ChatMessage</span>):{" "}
                <span className="text-[#79c0ff]">msg is SystemMessage</span>
              </CodeBlock>
            </div>
          </section>
        </RevealOnScroll>

        {/* ─── 3. 사용법 ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>🚀</span> 사용법
            </h2>

            <p className="text-[14px] text-gray-600 leading-[1.85] mb-6">
              타입 가드를 이용하면 메시지 배열에서 각 타입을 안전하게 처리할 수 있습니다.
            </p>

            <CodeBlock>
              <span className="text-[#8b949e]">// 타입 가드로 메시지 분기 처리</span>
              {"\n"}
              <span className="text-[#ff7b72]">for</span> (
              <span className="text-[#ff7b72]">const</span> msg{" "}
              <span className="text-[#ff7b72]">of</span> messages) {"{"}{"\n"}
              {"  "}
              <span className="text-[#ff7b72]">if</span> (
              <span className="text-[#d2a8ff]">isAssistantMessage</span>(msg)) {"{"}{"\n"}
              {"    "}
              <span className="text-[#8b949e]">// msg.toolCalls에 안전하게 접근 가능</span>
              {"\n"}
              {"    "}
              <span className="text-[#ff7b72]">for</span> (
              <span className="text-[#ff7b72]">const</span> tc{" "}
              <span className="text-[#ff7b72]">of</span> msg.toolCalls) {"{"}{"\n"}
              {"      "}console.
              <span className="text-[#d2a8ff]">log</span>(tc.name, tc.arguments);{"\n"}
              {"    "}
              {"}"}{"\n"}
              {"  "}
              {"}"}{"\n"}
              {"  "}
              <span className="text-[#ff7b72]">if</span> (
              <span className="text-[#d2a8ff]">isToolMessage</span>(msg)) {"{"}{"\n"}
              {"    "}
              <span className="text-[#8b949e]">// msg.toolCallId, msg.isError에 안전하게 접근</span>
              {"\n"}
              {"    "}console.
              <span className="text-[#d2a8ff]">log</span>(msg.toolCallId, msg.isError);{"\n"}
              {"  "}
              {"}"}
              {"\n"}
              {"}"}
            </CodeBlock>

            <Callout type="warn" icon="⚠️">
              <span className="text-[13px]">
                <strong>주의:</strong> 타입 가드 없이 role 문자열로 직접 분기하면 TypeScript가
                해당 타입의 추가 필드(예: toolCalls, toolCallId)를 알 수 없어 컴파일 에러가
                발생합니다. 항상 제공된 타입 가드 함수를 사용하세요.
              </span>
            </Callout>

            <DeepDive title="AnyMessage — 구별된 유니온 패턴">
              <div className="space-y-3">
                <p>
                  <code className="text-cyan-600">AnyMessage</code>는 네 가지 메시지 타입의
                  유니온입니다. TypeScript는 role 필드를 판별자로 자동 인식하여 switch/if 분기에서
                  타입을 자동으로 좁혀줍니다.
                </p>
                <CodeBlock>
                  <span className="text-[#8b949e]">// switch로 모든 메시지 타입 처리</span>
                  {"\n"}
                  <span className="text-[#ff7b72]">function</span>{" "}
                  <span className="text-[#d2a8ff]">processMessage</span>(
                  <span className="text-[#ffa657]">msg</span>:{" "}
                  <span className="text-[#79c0ff]">AnyMessage</span>) {"{"}{"\n"}
                  {"  "}
                  <span className="text-[#ff7b72]">switch</span> (msg.role) {"{"}{"\n"}
                  {"    "}
                  <span className="text-[#ff7b72]">case</span> MessageRole.Assistant:{"\n"}
                  {"      "}
                  <span className="text-[#8b949e]">// TypeScript가 AssistantMessage로 자동 추론</span>
                  {"\n"}
                  {"      "}
                  <span className="text-[#ff7b72]">return</span> msg.toolCalls.length;{"\n"}
                  {"    "}
                  <span className="text-[#ff7b72]">case</span> MessageRole.Tool:{"\n"}
                  {"      "}
                  <span className="text-[#ff7b72]">return</span> msg.toolCallId;{"\n"}
                  {"  "}
                  {"}"}
                  {"\n"}
                  {"}"}
                </CodeBlock>
              </div>
            </DeepDive>
          </section>
        </RevealOnScroll>

        {/* ─── 4. 내부 구현 ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>⚙️</span> 내부 구현
            </h2>

            <MermaidDiagram
              title="LLM 요청/응답 메시지 흐름"
              titleColor="blue"
              chart={`sequenceDiagram
    participant LOOP as Agent Loop
    participant LLM as LLM Client
    participant TOOL as Tool Executor

    LOOP->>LLM: [SystemMessage, UserMessage, ...]
    LLM-->>LOOP: AssistantMessage { toolCalls: [...] }
    LOOP->>TOOL: toolCalls[0].name, toolCalls[0].arguments
    TOOL-->>LOOP: ToolCallResult { output, isError }
    LOOP->>LLM: [...prev, AssistantMessage, ToolMessage { toolCallId, isError }]
    LLM-->>LOOP: AssistantMessage { content: "결과 분석..." }`}
            />

            <div className="text-[14px] text-gray-600 leading-[1.85] space-y-4 mt-6">
              <p>
                <strong className="text-gray-900">MessageRoleValue 타입:</strong>{" "}
                <code className="text-cyan-600">
                  (typeof MessageRole)[keyof typeof MessageRole]
                </code>{" "}
                패턴으로 추출합니다. 이렇게 하면 MessageRole 객체에 새 역할이 추가될 때 타입도
                자동으로 업데이트됩니다.
              </p>
              <p>
                <strong className="text-gray-900">readonly 프로퍼티:</strong> 모든 인터페이스의
                필드가 <code className="text-cyan-600">readonly</code>로 선언되어 불변성을
                보장합니다. 메시지 생성 후 필드를 변경하면 컴파일 에러가 발생합니다.
              </p>
            </div>

            <Callout type="info" icon="💡">
              <span className="text-[13px]">
                <strong>ToolCall.arguments:</strong> LLM은 도구 인자를 JSON{" "}
                <em>문자열</em>로 반환합니다. 실제 객체가 필요하면{" "}
                <code className="text-cyan-600">JSON.parse(tc.arguments)</code>로 변환하세요. 단,
                LLM이 잘못된 JSON을 반환할 수 있으니 try-catch가 필요합니다.
              </span>
            </Callout>
          </section>
        </RevealOnScroll>

        {/* ─── 5. 트러블슈팅 ─── */}
        <RevealOnScroll>
          <section style={{ marginBottom: "64px" }}>
            <h2
              className="text-2xl font-extrabold flex items-center gap-3"
              style={{ marginBottom: "24px", marginTop: "0" }}
            >
              <span>🔧</span> 트러블슈팅
            </h2>

            <div className="space-y-5">
              <div className="glass-card p-5 rounded-xl">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-500">Q.</span>
                  msg.toolCalls에 접근할 수 없다는 TypeScript 에러가 납니다
                </h4>
                <p className="text-[13px] text-gray-600 leading-[1.8]">
                  <span className="text-emerald-600 font-bold">A.</span> 변수 타입이{" "}
                  <code className="text-cyan-600">ChatMessage</code>로 넓게 추론되고 있습니다.{" "}
                  <code className="text-cyan-600">isAssistantMessage(msg)</code>로 먼저 좁히거나,
                  변수 타입을 <code className="text-cyan-600">AssistantMessage</code>로 명시적으로
                  선언하세요.
                </p>
              </div>

              <div className="glass-card p-5 rounded-xl">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-500">Q.</span>
                  ToolMessage의 toolCallId가 AssistantMessage의 ToolCall id와 일치하지 않습니다
                </h4>
                <p className="text-[13px] text-gray-600 leading-[1.8]">
                  <span className="text-emerald-600 font-bold">A.</span> LLM은 자신이 요청한
                  ToolCall의 id를 그대로 돌려받아야 매칭합니다. 도구 실행 결과를 ToolMessage로
                  변환할 때 반드시{" "}
                  <code className="text-cyan-600">toolCallId: tc.id</code>를 사용하세요. id를
                  새로 생성하면 LLM이 어떤 호출의 결과인지 알 수 없습니다.
                </p>
              </div>

              <div className="glass-card p-5 rounded-xl">
                <h4 className="text-[14px] font-bold mb-2 flex items-center gap-2">
                  <span className="text-red-500">Q.</span>
                  메시지 배열에서 시스템 메시지를 필터링하고 싶습니다
                </h4>
                <p className="text-[13px] text-gray-600 leading-[1.8]">
                  <span className="text-emerald-600 font-bold">A.</span>{" "}
                  <code className="text-cyan-600">messages.filter(isSystemMessage)</code>로 시스템
                  메시지만, <code className="text-cyan-600">messages.filter((m) =&gt; !isSystemMessage(m))</code>
                  로 시스템 메시지를 제외한 배열을 얻을 수 있습니다. TypeScript의 타입 추론이
                  필터 결과에도 자동 적용됩니다.
                </p>
              </div>
            </div>
          </section>
        </RevealOnScroll>

        {/* ─── 6. 관련 문서 ─── */}
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
                  name: "agent-loop.ts",
                  slug: "agent-loop",
                  relation: "parent",
                  desc: "ChatMessage 배열을 생성하고 관리하는 메인 루프. AssistantMessage에서 도구 호출을 추출하고 ToolMessage를 추가합니다.",
                },
                {
                  name: "context-manager.ts",
                  slug: "context-manager",
                  relation: "sibling",
                  desc: "ChatMessage 배열을 압축하고 최적화합니다. isSystemMessage(), isToolMessage() 타입 가드를 활용합니다.",
                },
                {
                  name: "recovery-executor.ts",
                  slug: "recovery-executor",
                  relation: "sibling",
                  desc: "compact 전략에서 ChatMessage 배열을 압축하여 반환합니다.",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}

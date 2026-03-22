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

export default function ConversationManagerPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}><div className="center-narrow">
      {/* ─── Header ─── */}
      <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <FilePath path="src/core/conversation.ts" />
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
            <span className="text-gray-900">
              Conversation
            </span>
          </h1>
          <div className="flex items-center gap-3 mb-5">
            <LayerBadge layer="core" />
          </div>
          <p className="text-[16px] text-gray-600 leading-relaxed">
            대화 메시지 관리 &mdash; 추가, 변환, 직렬화
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
              <code className="text-cyan-600">Conversation</code>은 사용자와 AI 간의 대화를
              <strong>불변(immutable) 객체</strong>로 관리하는 클래스입니다.
              모든 변경(메시지 추가, 메타데이터 설정)은 기존 객체를 수정하지 않고
              새로운 <code className="text-cyan-600">Conversation</code> 인스턴스를 반환합니다.
            </p>
            <p>
              &quot;불변(immutable)&quot;이란 한번 만들어진 객체를 절대 바꾸지 않는 패턴입니다.
              메시지를 추가하면 기존 대화를 복사하고 새 메시지를 포함한 새 객체를 만듭니다.
              이렇게 하면 실수로 데이터를 변경하는 버그를 방지할 수 있습니다.
              React의 상태 관리에서도 같은 원리를 사용합니다.
            </p>
            <p>
              4가지 역할의 메시지를 지원합니다: <code className="text-cyan-600">system</code>(시스템 지침),
              <code className="text-cyan-600">user</code>(사용자 입력),
              <code className="text-cyan-600">assistant</code>(AI 응답),
              <code className="text-cyan-600">tool</code>(도구 실행 결과).
              또한 <code className="text-cyan-600">toMessagesForLLM()</code> 메서드로
              LLM API 호출에 적합한 형태로 변환할 수 있습니다.
            </p>
          </div>

          <MermaidDiagram
            title="Conversation 아키텍처 위치"
            titleColor="purple"
            chart={`graph TD
  AGENT["Agent Loop<br/><small>agent-loop.ts</small>"]
  CONV["Conversation<br/><small>conversation.ts</small>"]
  LLM["LLM Client<br/><small>llm/client.ts</small>"]
  CTX["Context Manager<br/><small>context-manager.ts</small>"]
  SM["SessionManager<br/><small>session-manager.ts</small>"]

  AGENT -->|"appendUserMessage()"| CONV
  AGENT -->|"appendAssistantMessage()"| CONV
  CONV -->|"toMessagesForLLM()"| LLM
  CTX -->|"메시지 수 기반 압축"| CONV
  SM -->|"메시지 저장/복원"| CONV

  style CONV fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style AGENT fill:#dbeafe,stroke:#3b82f6,color:#1e293b
  style LLM fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style CTX fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style SM fill:#f1f5f9,stroke:#64748b,color:#1e293b`}
          />

          <Callout type="info" icon="💡">
            <strong>비유:</strong> Conversation은 &quot;사진 앨범&quot;과 비슷합니다.
            사진(메시지)을 추가하면 새 앨범이 만들어지고, 원래 앨범은 그대로 유지됩니다.
            앨범을 누군가에게 보여줘도(참조 전달), 그 사람이 사진을 추가하거나 빼도
            내 원본 앨범에는 영향이 없습니다. 이것이 불변 객체의 핵심 장점입니다.
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 2. 레퍼런스 (Reference) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>📖</span> 레퍼런스
          </h2>

          {/* Conversation class */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            class Conversation
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            불변 대화 상태 클래스입니다. 모든 수정 메서드(<code className="text-cyan-600">append~</code>,
            <code className="text-cyan-600">with~</code>)는 새로운 인스턴스를 반환합니다.
            <code className="text-cyan-600">private constructor</code>를 사용하므로,
            반드시 <code className="text-cyan-600">Conversation.create()</code> 팩토리 메서드로 생성해야 합니다.
          </p>

          {/* Properties */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            프로퍼티
          </h4>
          <ParamTable
            params={[
              { name: "id", type: "string", required: true, desc: "대화의 고유 식별자" },
              { name: "messages", type: "readonly AnyMessage[]", required: true, desc: "지금까지의 모든 메시지 목록 (읽기 전용 배열)" },
              { name: "createdAt", type: "Date", required: true, desc: "대화 생성 시각" },
              { name: "metadata", type: "Record<string, unknown>", required: true, desc: "대화에 첨부된 메타데이터 (키-값 쌍)" },
              { name: "length", type: "number", required: true, desc: "전체 메시지 수 (getter)" },
              { name: "lastMessage", type: "AnyMessage | undefined", required: true, desc: "가장 마지막 메시지 (getter)" },
            ]}
          />

          {/* create */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            static create(id)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            새로운 빈 대화를 생성하는 팩토리 메서드입니다.
            constructor가 <code className="text-cyan-600">private</code>이므로 유일한 생성 방법입니다.
          </p>
          <CodeBlock>
            <span className="kw">static</span> <span className="fn">create</span>(<span className="prop">id</span>: <span className="type">string</span>): <span className="type">Conversation</span>
          </CodeBlock>

          {/* appendSystemMessage */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            appendSystemMessage(content)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            시스템 메시지를 추가합니다. LLM에게 행동 지침을 전달하는 용도이며,
            보통 대화 시작 시 한 번 추가됩니다. 새로운 <code className="text-cyan-600">Conversation</code>을 반환합니다.
          </p>
          <CodeBlock>
            <span className="fn">appendSystemMessage</span>(<span className="prop">content</span>: <span className="type">string</span>): <span className="type">Conversation</span>
          </CodeBlock>

          {/* appendUserMessage */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            appendUserMessage(content)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            사용자 메시지를 추가합니다. 새로운 <code className="text-cyan-600">Conversation</code>을 반환합니다.
          </p>
          <CodeBlock>
            <span className="fn">appendUserMessage</span>(<span className="prop">content</span>: <span className="type">string</span>): <span className="type">Conversation</span>
          </CodeBlock>

          {/* appendAssistantMessage */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            appendAssistantMessage(content, toolCalls?)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            어시스턴트(AI) 응답 메시지를 추가합니다.
            도구 호출 목록을 함께 포함할 수 있습니다.
          </p>
          <CodeBlock>
            <span className="fn">appendAssistantMessage</span>(<span className="prop">content</span>: <span className="type">string</span>, <span className="prop">toolCalls</span>?: <span className="kw">readonly</span> <span className="type">ToolCall</span>[]): <span className="type">Conversation</span>
          </CodeBlock>
          <ParamTable
            params={[
              { name: "content", type: "string", required: true, desc: "AI가 생성한 응답 텍스트" },
              { name: "toolCalls", type: "readonly ToolCall[]", required: false, desc: "AI가 요청한 도구 호출 목록 (기본값: 빈 배열)" },
            ]}
          />

          {/* appendToolResults */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            appendToolResults(results)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            도구 실행 결과 메시지를 추가합니다. 여러 도구의 결과를 한번에 추가할 수 있습니다.
          </p>
          <CodeBlock>
            <span className="fn">appendToolResults</span>(<span className="prop">results</span>: <span className="kw">readonly</span> <span className="type">ToolCallResult</span>[]): <span className="type">Conversation</span>
          </CodeBlock>

          {/* withMetadata */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            withMetadata(key, value)
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            메타데이터 값을 설정합니다. 대화에 부가 정보(예: 사용 모델명, 태그 등)를 저장하는 용도입니다.
          </p>
          <CodeBlock>
            <span className="fn">withMetadata</span>(<span className="prop">key</span>: <span className="type">string</span>, <span className="prop">value</span>: <span className="type">unknown</span>): <span className="type">Conversation</span>
          </CodeBlock>

          {/* toMessagesForLLM */}
          <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">
            toMessagesForLLM()
          </h4>
          <p className="text-[13px] text-gray-600 mb-3">
            LLM API 호출에 적합한 형태로 메시지를 변환합니다.
            타임스탬프 같은 내부 전용 필드는 제거되고, 도구 호출/결과 정보가 적절히 포함됩니다.
          </p>
          <CodeBlock>
            <span className="fn">toMessagesForLLM</span>(): <span className="kw">readonly</span> {"{"}{"\n"}{"  "}<span className="prop">role</span>: <span className="type">string</span>;
            {"\n"}{"  "}<span className="prop">content</span>: <span className="type">string</span>;
            {"\n"}{"  "}<span className="prop">tool_call_id</span>?: <span className="type">string</span>;
            {"\n"}{"  "}<span className="prop">tool_calls</span>?: <span className="kw">readonly</span> <span className="type">ToolCall</span>[];
            {"\n"}{"}"}[]
          </CodeBlock>

          {/* Caveats */}
          <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
          <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
            <li>
              <code className="text-cyan-600">constructor</code>가 <code className="text-cyan-600">private</code>이므로,
              <code className="text-cyan-600">new Conversation()</code>으로 직접 생성할 수 없습니다.
              반드시 <code className="text-cyan-600">Conversation.create(id)</code>를 사용하세요.
            </li>
            <li>
              모든 <code className="text-cyan-600">append~</code>, <code className="text-cyan-600">with~</code> 메서드는
              <strong>새로운 인스턴스</strong>를 반환합니다.
              반환값을 변수에 저장하지 않으면 변경 사항이 유실됩니다.
            </li>
            <li>
              <code className="text-cyan-600">toMessagesForLLM()</code>에서 도구 호출 정보는
              어시스턴트 메시지에 <code className="text-cyan-600">toolCalls</code>가 있을 때만 포함됩니다.
              빈 배열이면 <code className="text-cyan-600">tool_calls</code> 필드가 생략됩니다.
            </li>
            <li>
              메시지 배열은 <code className="text-cyan-600">readonly</code>이므로 외부에서
              <code className="text-cyan-600">push()</code>나 <code className="text-cyan-600">splice()</code>로
              직접 수정할 수 없습니다.
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
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>기본 사용법 &mdash; 대화 생성과 메시지 추가</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            대화를 생성하고 메시지를 추가하는 기본 패턴입니다.
            <strong>반환값을 반드시 변수에 저장</strong>해야 합니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 1. 새 대화 생성"}</span>
            {"\n"}<span className="kw">let</span> <span className="prop">conv</span> = <span className="type">Conversation</span>.<span className="fn">create</span>(<span className="str">&quot;conv-001&quot;</span>);
            {"\n"}
            {"\n"}<span className="cm">{"// 2. 시스템 메시지 추가 (LLM 지침)"}</span>
            {"\n"}<span className="prop">conv</span> = <span className="prop">conv</span>.<span className="fn">appendSystemMessage</span>(<span className="str">&quot;당신은 코딩 어시스턴트입니다.&quot;</span>);
            {"\n"}
            {"\n"}<span className="cm">{"// 3. 사용자 메시지 추가"}</span>
            {"\n"}<span className="prop">conv</span> = <span className="prop">conv</span>.<span className="fn">appendUserMessage</span>(<span className="str">&quot;안녕하세요!&quot;</span>);
            {"\n"}
            {"\n"}<span className="cm">{"// 4. AI 응답 추가"}</span>
            {"\n"}<span className="prop">conv</span> = <span className="prop">conv</span>.<span className="fn">appendAssistantMessage</span>(<span className="str">&quot;안녕하세요! 무엇을 도와드릴까요?&quot;</span>);
            {"\n"}
            {"\n"}<span className="fn">console</span>.<span className="fn">log</span>(<span className="prop">conv</span>.<span className="prop">length</span>); <span className="cm">{"// 3 (system + user + assistant)"}</span>
          </CodeBlock>

          <Callout type="warn" icon="!">
            <strong>주의:</strong> 불변 객체이므로 <code>append~</code> 메서드의 반환값을 반드시 변수에 다시 할당하세요.
            <code>conv.appendUserMessage(&quot;hello&quot;)</code>만 호출하고 결과를 저장하지 않으면
            메시지가 추가된 새 객체가 버려지고 <code>conv</code>는 변하지 않습니다.
          </Callout>

          {/* 도구 호출 포함 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            도구 호출이 포함된 대화 흐름
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            AI가 도구를 호출하고 결과를 받는 전체 흐름입니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 1. AI가 도구 호출을 요청하는 응답"}</span>
            {"\n"}<span className="prop">conv</span> = <span className="prop">conv</span>.<span className="fn">appendAssistantMessage</span>(<span className="str">&quot;파일을 읽어보겠습니다.&quot;</span>, [{"{"}{"\n"}{"  "}<span className="prop">id</span>: <span className="str">&quot;call-1&quot;</span>,
            {"\n"}{"  "}<span className="prop">type</span>: <span className="str">&quot;function&quot;</span>,
            {"\n"}{"  "}<span className="prop">function</span>: {"{"} <span className="prop">name</span>: <span className="str">&quot;ReadFile&quot;</span>, <span className="prop">arguments</span>: <span className="str">&quot;...&quot;</span> {"}"},
            {"\n"}{"}"}]);
            {"\n"}
            {"\n"}<span className="cm">{"// 2. 도구 실행 결과 추가"}</span>
            {"\n"}<span className="prop">conv</span> = <span className="prop">conv</span>.<span className="fn">appendToolResults</span>([{"{"}{"\n"}{"  "}<span className="prop">id</span>: <span className="str">&quot;call-1&quot;</span>,
            {"\n"}{"  "}<span className="prop">output</span>: <span className="str">&quot;파일 내용입니다...&quot;</span>,
            {"\n"}{"  "}<span className="prop">isError</span>: <span className="kw">false</span>,
            {"\n"}{"}"}]);
            {"\n"}
            {"\n"}<span className="cm">{"// 3. LLM API 호출용으로 변환"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">llmMessages</span> = <span className="prop">conv</span>.<span className="fn">toMessagesForLLM</span>();
          </CodeBlock>

          {/* 메타데이터 활용 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; 메타데이터 활용
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            대화에 부가 정보를 저장할 수 있습니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 모델명과 태그를 메타데이터로 저장"}</span>
            {"\n"}<span className="prop">conv</span> = <span className="prop">conv</span>
            {"\n"}{"  "}.<span className="fn">withMetadata</span>(<span className="str">&quot;model&quot;</span>, <span className="str">&quot;gpt-4o&quot;</span>)
            {"\n"}{"  "}.<span className="fn">withMetadata</span>(<span className="str">&quot;tags&quot;</span>, [<span className="str">&quot;refactoring&quot;</span>, <span className="str">&quot;typescript&quot;</span>]);
            {"\n"}
            {"\n"}<span className="cm">{"// 메타데이터 읽기"}</span>
            {"\n"}<span className="fn">console</span>.<span className="fn">log</span>(<span className="prop">conv</span>.<span className="prop">metadata</span>.<span className="prop">model</span>); <span className="cm">{"// 'gpt-4o'"}</span>
          </CodeBlock>

          <DeepDive title="불변 패턴이 중요한 이유">
            <p className="mb-3">
              Conversation이 불변 패턴을 사용하는 이유는 크게 세 가지입니다:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-gray-600">
              <li>
                <strong>예측 가능성:</strong> 한번 생성된 대화 객체는 절대 변하지 않으므로,
                코드의 어디에서든 같은 객체를 참조하면 같은 내용을 볼 수 있습니다.
              </li>
              <li>
                <strong>동시성 안전:</strong> 여러 곳에서 동시에 같은 대화를 읽어도
                데이터 경쟁(race condition)이 발생하지 않습니다.
              </li>
              <li>
                <strong>이력 추적:</strong> 매 변경마다 새 객체가 생성되므로,
                이전 상태를 보관하면 대화 이력을 자연스럽게 추적할 수 있습니다.
              </li>
            </ul>
            <p className="mt-3 text-amber-600">
              단점은 매 변경마다 메시지 배열을 복사(<code>[...this.messages, newMsg]</code>)하므로
              메시지가 수천 개일 때 성능 이슈가 있을 수 있습니다.
              이 경우 Context Manager가 오래된 메시지를 압축하여 배열 크기를 관리합니다.
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

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>메시지 흐름 다이어그램</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            각 <code className="text-cyan-600">append~</code> 메서드는 새로운 Conversation을 생성하는 파이프라인을 형성합니다.
            LLM 호출 시 <code className="text-cyan-600">toMessagesForLLM()</code>이 내부 메시지를 API 형식으로 변환합니다.
          </p>

          <MermaidDiagram
            title="Conversation 메시지 파이프라인"
            titleColor="purple"
            chart={`graph TD
  CREATE["Conversation.create(id)<br/><small>빈 대화 생성</small>"]
  SYS["appendSystemMessage()<br/><small>시스템 지침 추가</small>"]
  USER["appendUserMessage()<br/><small>사용자 메시지 추가</small>"]
  ASST["appendAssistantMessage()<br/><small>AI 응답 + 도구 호출</small>"]
  TOOL["appendToolResults()<br/><small>도구 실행 결과</small>"]
  LLM["toMessagesForLLM()<br/><small>LLM API 형식으로 변환</small>"]

  CREATE -->|"새 Conversation"| SYS
  SYS -->|"새 Conversation"| USER
  USER -->|"새 Conversation"| ASST
  ASST -->|"새 Conversation"| TOOL
  TOOL -->|"새 Conversation"| USER
  ASST -->|"최종 변환"| LLM

  style CREATE fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style SYS fill:#dbeafe,stroke:#3b82f6,color:#1e293b
  style USER fill:#dcfce7,stroke:#10b981,color:#065f46
  style ASST fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style TOOL fill:#dbeafe,stroke:#3b82f6,color:#1e293b
  style LLM fill:#fee2e2,stroke:#ef4444,color:#991b1b,stroke-width:2px`}
          />

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>핵심 코드 분석 &mdash; toMessagesForLLM()</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            내부 메시지 구조에서 LLM이 이해하는 형식으로 변환하는 핵심 로직입니다.
          </p>
          <CodeBlock>
            <span className="fn">toMessagesForLLM</span>() {"{"}
            {"\n"}{"  "}<span className="kw">return</span> <span className="kw">this</span>.<span className="prop">messages</span>.<span className="fn">map</span>((<span className="prop">msg</span>) ={">"} {"{"}
            {"\n"}{"    "}<span className="cm">{"// [1] 기본 구조: role + content만 포함"}</span>
            {"\n"}{"    "}<span className="kw">const</span> <span className="prop">base</span> = {"{"} <span className="prop">role</span>: <span className="prop">msg</span>.<span className="prop">role</span>, <span className="prop">content</span>: <span className="prop">msg</span>.<span className="prop">content</span> {"}"};
            {"\n"}
            {"\n"}{"    "}<span className="cm">{"// [2] Tool 메시지 → tool_call_id 추가"}</span>
            {"\n"}{"    "}<span className="kw">if</span> (<span className="prop">msg</span>.<span className="prop">role</span> === <span className="str">&quot;tool&quot;</span>) {"{"}
            {"\n"}{"      "}<span className="kw">return</span> {"{"} ...<span className="prop">base</span>, <span className="prop">tool_call_id</span>: <span className="prop">msg</span>.<span className="prop">toolCallId</span> {"}"};
            {"\n"}{"    "}{"}"}
            {"\n"}
            {"\n"}{"    "}<span className="cm">{"// [3] Assistant 메시지 → tool_calls 추가 (있을 때만)"}</span>
            {"\n"}{"    "}<span className="kw">if</span> (<span className="prop">msg</span>.<span className="prop">role</span> === <span className="str">&quot;assistant&quot;</span> && <span className="prop">msg</span>.<span className="prop">toolCalls</span>.<span className="prop">length</span> {">"} <span className="num">0</span>) {"{"}
            {"\n"}{"      "}<span className="kw">return</span> {"{"} ...<span className="prop">base</span>, <span className="prop">tool_calls</span>: <span className="prop">msg</span>.<span className="prop">toolCalls</span> {"}"};
            {"\n"}{"    "}{"}"}
            {"\n"}
            {"\n"}{"    "}<span className="cm">{"// [4] 그 외 (system, user) → 기본 구조만"}</span>
            {"\n"}{"    "}<span className="kw">return</span> <span className="prop">base</span>;
            {"\n"}{"  "}{"}"});
            {"\n"}{"}"}
          </CodeBlock>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
            <p><strong className="text-gray-900">[1]</strong> 모든 메시지의 공통 필드인 <code className="text-cyan-600">role</code>과 <code className="text-cyan-600">content</code>만 기본으로 포함합니다. <code className="text-cyan-600">timestamp</code> 같은 내부 전용 필드는 제외됩니다.</p>
            <p><strong className="text-gray-900">[2]</strong> 도구 결과 메시지에는 어떤 도구 호출에 대한 결과인지 식별하는 <code className="text-cyan-600">tool_call_id</code>를 추가합니다.</p>
            <p><strong className="text-gray-900">[3]</strong> 어시스턴트 메시지에 도구 호출이 있으면 <code className="text-cyan-600">tool_calls</code>를 포함합니다. 빈 배열이면 생략하여 API 호출을 깔끔하게 유지합니다.</p>
            <p><strong className="text-gray-900">[4]</strong> 시스템 메시지와 사용자 메시지는 <code className="text-cyan-600">role</code>과 <code className="text-cyan-600">content</code>만 필요합니다.</p>
          </div>
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
              &quot;메시지를 추가했는데 conv.messages가 비어있어요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">append~</code> 메서드의 <strong>반환값</strong>을
              변수에 저장했는지 확인하세요. Conversation은 불변 객체이므로,
              반환값을 저장하지 않으면 변경 사항이 유실됩니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 잘못된 사용법 — 반환값을 저장하지 않음"}</span>
              {"\n"}<span className="prop">conv</span>.<span className="fn">appendUserMessage</span>(<span className="str">&quot;hello&quot;</span>); <span className="cm">{"// 새 객체가 버려짐!"}</span>
              {"\n"}
              {"\n"}<span className="cm">{"// 올바른 사용법 — 반환값을 다시 할당"}</span>
              {"\n"}<span className="prop">conv</span> = <span className="prop">conv</span>.<span className="fn">appendUserMessage</span>(<span className="str">&quot;hello&quot;</span>);
            </CodeBlock>
          </div>

          {/* FAQ 2 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;new Conversation()을 호출하면 에러가 발생해요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">constructor</code>가 <code className="text-cyan-600">private</code>입니다.
              <code className="text-cyan-600">Conversation.create(id)</code> 정적 메서드를 사용하세요.
              이것은 팩토리 메서드 패턴으로, 생성 로직을 명확하게 표현하기 위한 의도적인 설계입니다.
            </p>
          </div>

          {/* FAQ 3 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;toMessagesForLLM()에서 tool_calls가 누락돼요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">appendAssistantMessage()</code> 호출 시
              두 번째 인자로 <code className="text-cyan-600">toolCalls</code> 배열을 전달했는지 확인하세요.
              빈 배열(<code className="text-cyan-600">[]</code>)이면 <code className="text-cyan-600">tool_calls</code> 필드가
              의도적으로 생략됩니다. LLM API는 빈 <code className="text-cyan-600">tool_calls</code>를 허용하지 않는 경우가 있기 때문입니다.
            </p>
          </div>

          {/* FAQ 4 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;메시지가 너무 많아서 성능이 느려요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              불변 패턴은 매번 배열을 복사하므로 메시지가 수천 개일 때 느려질 수 있습니다.
              <code className="text-cyan-600">Context Manager</code>가 오래된 메시지를 요약하여
              배열 크기를 자동으로 관리합니다. 직접 배열 크기를 줄이려 하지 마세요 &mdash;
              Context Manager에게 맡기는 것이 안전합니다.
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
                desc: "에이전트 루프가 Conversation에 메시지를 추가하고 LLM에 전달하는 메인 루프",
              },
              {
                name: "context-manager.ts",
                slug: "context-manager",
                relation: "sibling",
                desc: "3-Layer 토큰 관리 — Conversation의 메시지를 압축하여 컨텍스트 윈도우 내로 유지",
              },
              {
                name: "session-manager.ts",
                slug: "session-manager",
                relation: "sibling",
                desc: "세션 생명주기 관리 — Conversation의 메시지를 디스크에 저장하고 복원",
              },
            ]}
          />
        </section>
      </RevealOnScroll>
    </div></div>
  );
}

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

export default function UseStreamingPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/cli/hooks/useStreaming.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">useStreaming</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="cli" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              LLM 응답을 실시간 스트리밍으로 수신하고 텍스트를 축적하는 React 훅입니다.
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
                <code className="text-cyan-600">useStreaming</code>은 LLM에 메시지를 보내고 응답을
                실시간 스트리밍으로 받아 <code className="text-cyan-600">streamingText</code> 상태에
                축적하는 훅입니다. 텍스트 청크가 도착할 때마다 React 상태가 업데이트되어 UI에 타이핑
                효과를 제공합니다.
              </p>
              <p>
                <code className="text-cyan-600">AbortController</code>를 내장하여 진행 중인
                스트리밍을 언제든 취소할 수 있습니다. 취소 시{" "}
                <code className="text-cyan-600">AbortError</code>를 자동으로 감지하고 무시하며, 빈{" "}
                <code className="text-cyan-600">StreamAccumulator</code>를 반환합니다.
              </p>
              <p>
                참고: 메인 에이전트 루프는 <code className="text-cyan-600">useAgentLoop</code>에서
                직접 스트리밍을 처리하므로, 이 훅은 독립적인 스트리밍이 필요한 경우(예: 미리보기,
                요약 등)에 사용됩니다.
              </p>
            </div>

            <MermaidDiagram
              title="useStreaming 아키텍처 위치"
              titleColor="purple"
              chart={`graph TD
  COMP["React 컴포넌트<br/><small>독립 스트리밍 UI</small>"]
  HOOK["useStreaming<br/><small>useStreaming.ts</small>"]
  LLM["LLMProvider<br/><small>llm/provider.ts</small>"]
  STREAM["consumeStream<br/><small>llm/streaming.ts</small>"]
  ABORT["AbortController<br/><small>취소 메커니즘</small>"]

  COMP -->|"sendMessage()"| HOOK
  COMP -->|"abort()"| HOOK
  HOOK -->|"client.stream()"| LLM
  HOOK -->|"consumeStream()"| STREAM
  HOOK -->|"signal"| ABORT
  STREAM -->|"onTextDelta"| HOOK

  style HOOK fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style COMP fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style LLM fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style STREAM fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style ABORT fill:#fef3c7,stroke:#f59e0b,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> 유튜브의 실시간 자막처럼, LLM의 응답이 생성되는 동시에 화면에
              텍스트가 한 글자씩 나타나는 효과를 제공합니다. 사용자가 기다리지 않고 즉시 응답을 읽기
              시작할 수 있어 UX가 크게 향상됩니다.
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

            {/* UseStreamingOptions interface */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface UseStreamingOptions
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              <code className="text-cyan-600">useStreaming</code> 훅의 설정 옵션입니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "client",
                  type: "LLMProvider",
                  required: true,
                  desc: "LLM 프로바이더 (stream() 메서드를 가진 객체)",
                },
                {
                  name: "model",
                  type: "string",
                  required: true,
                  desc: '사용할 모델명 (예: "gpt-4o", "claude-sonnet-4-20250514")',
                },
                {
                  name: "temperature",
                  type: "number",
                  required: false,
                  desc: "응답의 무작위성 (0=결정적, 1=창의적, 기본값: 0)",
                },
                {
                  name: "maxTokens",
                  type: "number",
                  required: false,
                  desc: "최대 응답 토큰 수 (기본값: 4096)",
                },
              ]}
            />

            {/* useStreaming hook */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              useStreaming(options)
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              LLM 스트리밍 상태를 관리하는 메인 훅입니다.
            </p>
            <CodeBlock>
              <span className="kw">function</span> <span className="fn">useStreaming</span>(
              <span className="prop">options</span>:{" "}
              <span className="type">UseStreamingOptions</span>): {"{"}
              {"\n"}
              {"  "}
              <span className="prop">streamingText</span>: <span className="type">string</span>;
              {"\n"}
              {"  "}
              <span className="prop">isStreaming</span>: <span className="type">boolean</span>;
              {"\n"}
              {"  "}
              <span className="prop">error</span>: <span className="type">string | undefined</span>;
              {"\n"}
              {"  "}
              <span className="prop">sendMessage</span>: (<span className="prop">messages</span>:{" "}
              <span className="type">readonly ChatMessage[]</span>) =&gt;{" "}
              <span className="type">Promise&lt;StreamAccumulator&gt;</span>;{"\n"}
              {"  "}
              <span className="prop">abort</span>: () =&gt; <span className="type">void</span>;
              {"\n"}
              {"}"}
            </CodeBlock>

            {/* Return values */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">반환값</h4>
            <ParamTable
              params={[
                {
                  name: "streamingText",
                  type: "string",
                  required: true,
                  desc: "현재까지 축적된 스트리밍 텍스트. 텍스트 청크가 도착할 때마다 업데이트",
                },
                {
                  name: "isStreaming",
                  type: "boolean",
                  required: true,
                  desc: "스트리밍 진행 중 여부. sendMessage()부터 완료/에러/취소까지 true",
                },
                {
                  name: "error",
                  type: "string | undefined",
                  required: true,
                  desc: "에러 메시지. AbortError를 제외한 에러 발생 시 설정",
                },
                {
                  name: "sendMessage",
                  type: "(messages) => Promise<StreamAccumulator>",
                  required: true,
                  desc: "메시지를 보내고 스트리밍을 시작. 완료 시 축적된 결과를 반환",
                },
                {
                  name: "abort",
                  type: "() => void",
                  required: true,
                  desc: "진행 중인 스트리밍을 취소. AbortController.abort() 호출",
                },
              ]}
            />

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                <code className="text-cyan-600">sendMessage()</code>를 호출하면 이전
                <code className="text-cyan-600">streamingText</code>가 빈 문자열로 초기화됩니다.
                이전 결과를 보존하려면 호출 전에 별도로 저장해야 합니다.
              </li>
              <li>
                <code className="text-cyan-600">abort()</code> 후{" "}
                <code className="text-cyan-600">sendMessage()</code>의 Promise는 빈{" "}
                <code className="text-cyan-600">StreamAccumulator</code>를 반환합니다. 에러가 아닌
                정상 반환으로 처리됩니다.
              </li>
              <li>
                <code className="text-cyan-600">options</code>의 값이 변경되면
                <code className="text-cyan-600">sendMessage</code> 콜백이 새로 생성됩니다. 불필요한
                리렌더링을 방지하려면 <code className="text-cyan-600">options</code>를
                메모이제이션하세요.
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
              기본 사용법 &mdash; LLM 응답 스트리밍
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              LLM 프로바이더와 모델명을 전달하고,
              <code className="text-cyan-600">sendMessage</code>로 스트리밍을 시작합니다.
            </p>
            <CodeBlock>
              <span className="kw">const</span> {"{"} <span className="prop">streamingText</span>,{" "}
              <span className="prop">isStreaming</span>, <span className="prop">error</span>,{" "}
              <span className="prop">sendMessage</span>, <span className="prop">abort</span> {"}"}
              {"\n"}
              {"  "}= <span className="fn">useStreaming</span>({"{"}
              {"\n"}
              {"    "}
              <span className="prop">client</span>: <span className="prop">llmProvider</span>,{"\n"}
              {"    "}
              <span className="prop">model</span>: <span className="str">&quot;gpt-4o&quot;</span>,
              {"\n"}
              {"    "}
              <span className="prop">temperature</span>: <span className="num">0</span>,{"\n"}
              {"    "}
              <span className="prop">maxTokens</span>: <span className="num">4096</span>,{"\n"}
              {"  "}
              {"}"});
              {"\n"}
              {"\n"}
              <span className="cm">{"// 스트리밍 시작"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">result</span> ={" "}
              <span className="kw">await</span> <span className="fn">sendMessage</span>([
              {"\n"}
              {"  "}
              {"{"} <span className="prop">role</span>:{" "}
              <span className="str">&quot;user&quot;</span>, <span className="prop">content</span>:{" "}
              <span className="str">&quot;코드를 설명해 주세요&quot;</span> {"}"},{"\n"}]);
              {"\n"}
              {"\n"}
              <span className="cm">{"// UI에서 실시간 텍스트 표시"}</span>
              {"\n"}
              <span className="kw">return</span> ({"\n"}
              {"  "}&lt;&gt;
              {"\n"}
              {"    "}
              {"{"}isStreaming && &lt;<span className="type">Spinner</span> /&gt;{"}"}
              {"\n"}
              {"    "}&lt;<span className="type">Text</span>&gt;{"{"}streamingText{"}"}&lt;/
              <span className="type">Text</span>&gt;
              {"\n"}
              {"    "}
              {"{"}error && &lt;<span className="type">Text</span>{" "}
              <span className="prop">color</span>=<span className="str">&quot;red&quot;</span>&gt;
              {"{"}error{"}"}&lt;/<span className="type">Text</span>&gt;{"}"}
              {"\n"}
              {"  "}&lt;/&gt;
              {"\n"});
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> <code>sendMessage()</code>는 호출 즉시
              <code>streamingText</code>를 빈 문자열로 리셋합니다. 이전 응답을 유지하면서 새 요청을
              보내려면 별도 상태에 저장하세요.
            </Callout>

            {/* 고급: 취소 처리 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 스트리밍 취소 처리
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              사용자가 Escape를 누르거나 취소 버튼을 클릭하면
              <code className="text-cyan-600">abort()</code>로 즉시 스트리밍을 중단할 수 있습니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// Escape 키로 취소"}</span>
              {"\n"}
              <span className="fn">useKeybindings</span>([{"{"}
              {"\n"}
              {"  "}
              <span className="prop">key</span>: <span className="str">&quot;escape&quot;</span>,
              {"\n"}
              {"  "}
              <span className="prop">handler</span>: () =&gt; {"{"}
              {"\n"}
              {"    "}
              <span className="kw">if</span> (<span className="prop">isStreaming</span>){" "}
              <span className="fn">abort</span>();
              {"\n"}
              {"  "}
              {"}"},{"\n"}
              {"}"}]);
              {"\n"}
              {"\n"}
              <span className="cm">{"// abort() 후 sendMessage()의 결과"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">result</span> ={" "}
              <span className="kw">await</span> <span className="fn">sendMessage</span>(
              <span className="prop">messages</span>);
              {"\n"}
              <span className="cm">{"// → 취소 시 빈 StreamAccumulator 반환 (에러 아님)"}</span>
            </CodeBlock>

            <DeepDive title="AbortController 생명주기">
              <p className="mb-3">
                <code className="text-cyan-600">AbortController</code>는 매{" "}
                <code className="text-cyan-600">sendMessage()</code>
                호출마다 새로 생성됩니다. 이전 컨트롤러는 자동으로 폐기됩니다.
              </p>
              <CodeBlock>
                <span className="cm">{"// sendMessage() 내부"}</span>
                {"\n"}
                <span className="kw">const</span> <span className="prop">controller</span> ={" "}
                <span className="kw">new</span> <span className="fn">AbortController</span>();
                {"\n"}
                <span className="prop">abortControllerRef</span>.
                <span className="prop">current</span> = <span className="prop">controller</span>;
                {"\n"}
                {"\n"}
                <span className="cm">{"// stream()에 signal 전달"}</span>
                {"\n"}
                <span className="prop">options</span>.<span className="prop">client</span>.
                <span className="fn">stream</span>({"{"} ...<span className="prop">params</span>,{" "}
                <span className="prop">signal</span>: <span className="prop">controller</span>.
                <span className="prop">signal</span> {"}"});
                {"\n"}
                {"\n"}
                <span className="cm">{"// finally 블록에서 정리"}</span>
                {"\n"}
                <span className="prop">abortControllerRef</span>.
                <span className="prop">current</span> = <span className="kw">null</span>;
              </CodeBlock>
              <p className="mt-3 text-gray-600">
                <code className="text-cyan-600">abort()</code>는{" "}
                <code className="text-cyan-600">ref.current?.abort()</code>로 안전하게 호출됩니다.
                ref가 null이면 (스트리밍 중이 아니면) 아무 동작도 하지 않습니다.
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
              스트리밍 생명주기 다이어그램
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">sendMessage()</code> 호출부터 완료까지의 상태
              전이입니다.
            </p>

            <MermaidDiagram
              title="스트리밍 상태 전이"
              titleColor="purple"
              chart={`graph TD
  IDLE["유휴 상태<br/><small>isStreaming=false, text=&quot;&quot;</small>"]
  STREAMING["스트리밍 중<br/><small>isStreaming=true</small>"]
  DONE["완료<br/><small>isStreaming=false, text=전체 응답</small>"]
  ABORTED["취소됨<br/><small>isStreaming=false, 빈 결과</small>"]
  ERRORED["에러<br/><small>isStreaming=false, error 설정</small>"]

  IDLE -->|"sendMessage()"| STREAMING
  STREAMING -->|"onTextDelta<br/>텍스트 축적"| STREAMING
  STREAMING -->|"스트림 완료"| DONE
  STREAMING -->|"abort()"| ABORTED
  STREAMING -->|"네트워크 에러 등"| ERRORED
  DONE -->|"sendMessage()"| STREAMING
  ABORTED -->|"sendMessage()"| STREAMING
  ERRORED -->|"sendMessage()"| STREAMING

  style IDLE fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style STREAMING fill:#dbeafe,stroke:#3b82f6,color:#1e3a5f,stroke-width:2px
  style DONE fill:#dcfce7,stroke:#10b981,color:#065f46
  style ABORTED fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style ERRORED fill:#fee2e2,stroke:#ef4444,color:#991b1b`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              핵심 코드 분석
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">sendMessage</code>의 try-catch-finally 구조입니다.
              에러 유형에 따라 다른 처리를 합니다.
            </p>
            <CodeBlock>
              <span className="kw">const</span> <span className="prop">sendMessage</span> ={" "}
              <span className="fn">useCallback</span>({"\n"}
              {"  "}
              <span className="kw">async</span> (<span className="prop">messages</span>:{" "}
              <span className="type">readonly ChatMessage[]</span>) =&gt; {"{"}
              {"\n"}
              {"    "}
              <span className="cm">{"// [1] 새 AbortController 생성"}</span>
              {"\n"}
              {"    "}
              <span className="kw">const</span> <span className="prop">controller</span> ={" "}
              <span className="kw">new</span> <span className="fn">AbortController</span>();
              {"\n"}
              {"    "}
              <span className="fn">setIsStreaming</span>(<span className="kw">true</span>);
              {"\n"}
              {"    "}
              <span className="fn">setStreamingText</span>(<span className="str">&quot;&quot;</span>
              );
              {"\n"}
              {"\n"}
              {"    "}
              <span className="kw">try</span> {"{"}
              {"\n"}
              {"      "}
              <span className="cm">{"// [2] LLM 스트림 시작"}</span>
              {"\n"}
              {"      "}
              <span className="kw">const</span> <span className="prop">stream</span> ={" "}
              <span className="prop">options</span>.<span className="prop">client</span>.
              <span className="fn">stream</span>({"{"}...<span className="prop">params</span>,{" "}
              <span className="prop">signal</span>
              {"}"});
              {"\n"}
              {"      "}
              <span className="cm">{"// [3] 텍스트 청크 축적"}</span>
              {"\n"}
              {"      "}
              <span className="kw">return await</span> <span className="fn">consumeStream</span>(
              <span className="prop">stream</span>, {"{"}
              {"\n"}
              {"        "}
              <span className="prop">onTextDelta</span>: (<span className="prop">text</span>) =&gt;{" "}
              <span className="fn">setStreamingText</span>(<span className="prop">prev</span> =&gt;{" "}
              <span className="prop">prev</span> + <span className="prop">text</span>),
              {"\n"}
              {"      "}
              {"}"});
              {"\n"}
              {"    "}
              <span className="kw">{"}"} catch</span> (<span className="prop">err</span>) {"{"}
              {"\n"}
              {"      "}
              <span className="cm">{"// [4] AbortError는 무시"}</span>
              {"\n"}
              {"      "}
              <span className="kw">if</span> (<span className="prop">err</span>.
              <span className="prop">name</span> ==={" "}
              <span className="str">&quot;AbortError&quot;</span>){" "}
              <span className="kw">return</span> <span className="fn">createStreamAccumulator</span>
              ();
              {"\n"}
              {"      "}
              <span className="cm">{"// [5] 다른 에러는 상태에 저장"}</span>
              {"\n"}
              {"      "}
              <span className="fn">setError</span>(<span className="prop">err</span>.
              <span className="prop">message</span>);
              {"\n"}
              {"      "}
              <span className="kw">return</span> <span className="fn">createStreamAccumulator</span>
              ();
              {"\n"}
              {"    "}
              <span className="kw">{"}"} finally</span> {"{"}
              {"\n"}
              {"      "}
              <span className="cm">{"// [6] 항상 정리"}</span>
              {"\n"}
              {"      "}
              <span className="fn">setIsStreaming</span>(<span className="kw">false</span>);
              {"\n"}
              {"      "}
              <span className="prop">abortControllerRef</span>.<span className="prop">current</span>{" "}
              = <span className="kw">null</span>;{"\n"}
              {"    "}
              {"}"}
              {"\n"}
              {"  "}
              {"}"}, [<span className="prop">options</span>]{"\n"});
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">[1]</strong> 매 호출마다 새{" "}
                <code className="text-cyan-600">AbortController</code>를 생성하고 ref에 저장합니다.
              </p>
              <p>
                <strong className="text-gray-900">[2]</strong> LLM 프로바이더의{" "}
                <code className="text-cyan-600">stream()</code> 메서드로 스트리밍을 시작합니다.
              </p>
              <p>
                <strong className="text-gray-900">[3]</strong>{" "}
                <code className="text-cyan-600">consumeStream</code>의{" "}
                <code className="text-cyan-600">onTextDelta</code> 콜백으로 텍스트를 누적합니다.
                함수형 업데이트(<code className="text-cyan-600">prev + text</code>)로 동시성
                안전합니다.
              </p>
              <p>
                <strong className="text-gray-900">[4]</strong>{" "}
                <code className="text-cyan-600">abort()</code>로 취소된 경우 에러를 무시하고 빈
                결과를 반환합니다.
              </p>
              <p>
                <strong className="text-gray-900">[5]</strong> 네트워크 에러 등 실제 문제가 발생하면{" "}
                <code className="text-cyan-600">error</code> 상태에 메시지를 저장합니다.
              </p>
              <p>
                <strong className="text-gray-900">[6]</strong>{" "}
                <code className="text-cyan-600">finally</code> 블록에서 항상{" "}
                <code className="text-cyan-600">isStreaming</code>을 false로, ref를 null로
                정리합니다.
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
                &quot;스트리밍 텍스트가 업데이트되지 않아요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">LLMProvider</code>의{" "}
                <code className="text-cyan-600">stream()</code>
                메서드가 올바른 스트림을 반환하는지 확인하세요. 텍스트 청크가{" "}
                <code className="text-cyan-600">onTextDelta</code> 콜백으로 전달되지 않으면 UI가
                업데이트되지 않습니다.
              </p>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;abort()를 호출했는데 에러가 표시돼요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                정상적으로는 <code className="text-cyan-600">AbortError</code>가 자동으로
                무시됩니다. 하지만 LLM 프로바이더가{" "}
                <code className="text-cyan-600">AbortError</code> 대신 커스텀 에러를 던지면 catch
                블록에서 일반 에러로 처리됩니다. 프로바이더의 에러 처리를 확인하세요.
              </p>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;이전 응답이 사라지고 새 응답만 보여요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                의도된 동작입니다. <code className="text-cyan-600">sendMessage()</code>는 호출 시
                <code className="text-cyan-600">streamingText</code>를 빈 문자열로 초기화합니다.
                이전 응답을 유지하려면 <code className="text-cyan-600">sendMessage</code> 호출 전에
                현재 <code className="text-cyan-600">streamingText</code>를 별도 상태 변수에
                저장하세요.
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
                  name: "llm/client.ts",
                  slug: "llm-client",
                  relation: "child",
                  desc: "LLM API 클라이언트 — stream() 메서드를 제공하는 LLMProvider 구현체",
                },
                {
                  name: "useAgentLoop.ts",
                  slug: "use-agent-loop",
                  relation: "sibling",
                  desc: "에이전트 루프 브릿지 — 메인 스트리밍은 이 훅에서 직접 처리",
                },
                {
                  name: "useKeybindings.ts",
                  slug: "use-keybindings",
                  relation: "sibling",
                  desc: "키바인딩 시스템 — Escape 키로 abort()를 트리거하는 단축키 연결",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}

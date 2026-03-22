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

export default function DualModelRouterPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/llm/dual-model-router.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">DualModelRouter</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="infra" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              Architect/Editor 모델 자동 전환 라우터 &mdash; 작업 페이즈(plan/execute/review)에 따라
              고성능/저비용 모델을 자동 분기합니다.
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
                <code className="text-cyan-600">DualModelRouter</code>는 하나의 작업을 두 모델이
                역할을 나눠서 처리하는 Architect/Editor 패턴을 구현합니다. 설계와 리뷰 같은 중요한
                결정은 고성능 모델(Architect)이 담당하고, 코드 생성 같은 반복적인 작업은 비용
                효율적인 모델(Editor)이 담당합니다.
              </p>
              <p>
                예를 들어, Claude Opus를 Architect로, Claude Sonnet을 Editor로 구성하면 &mdash;
                <code className="text-cyan-600">&quot;plan&quot;</code>(계획)이나
                <code className="text-cyan-600">&quot;review&quot;</code>(리뷰) 단계에서는 Opus가
                깊은 추론으로 설계를 잡아주고,{" "}
                <code className="text-cyan-600">&quot;execute&quot;</code>(실행) 단계에서는 Sonnet이
                빠르고 저렴하게 코드를 생성합니다.
              </p>
              <p>
                이 모듈은 작업 단계(TaskPhase)를 수동으로 지정하거나, 사용자 메시지의 키워드를
                분석하여 자동으로 단계를 감지하는{" "}
                <code className="text-cyan-600">detectPhase()</code> 함수를 제공합니다. 기본 단계는{" "}
                <code className="text-cyan-600">&quot;execute&quot;</code>이며, 이는 대부분의 작업이
                코드 생성(실행)이기 때문입니다.
              </p>
            </div>

            <MermaidDiagram
              title="DualModelRouter 아키텍처 위치"
              titleColor="purple"
              chart={`graph TD
  AL["Agent Loop<br/><small>core/agent-loop.ts</small>"]
  DMR["DualModelRouter<br/><small>llm/dual-model-router.ts</small>"]
  LLM["LLM Client<br/><small>llm/client.ts</small>"]
  MC["Model Capabilities<br/><small>llm/model-capabilities.ts</small>"]
  ARCH["Architect Model<br/><small>고성능 (e.g. Opus)</small>"]
  EDIT["Editor Model<br/><small>비용 효율 (e.g. Sonnet)</small>"]

  AL -->|"페이즈 감지/설정"| DMR
  DMR -->|"plan/review"| ARCH
  DMR -->|"execute"| EDIT
  AL --> LLM
  LLM --> MC

  style DMR fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style AL fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style LLM fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style MC fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style ARCH fill:#dcfce7,stroke:#22c55e,color:#1e293b
  style EDIT fill:#fef9c3,stroke:#eab308,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> 건축 프로젝트를 떠올리세요. 건축가(Architect)가 도면을 설계하고
              감리(review)를 하며, 시공사(Editor)가 실제로 건물을 짓습니다. 각자 전문 분야에
              집중하면 품질도 올라가고 비용도 최적화됩니다. DualModelRouter가 바로 이 역할 분담을
              LLM에 적용한 것입니다.
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

            {/* DualModelConfig interface */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface DualModelConfig
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              듀얼 모델 설정 객체입니다. Architect/Editor 모델 이름과 라우팅 전략을 정의합니다. 모든
              프로퍼티가 <code className="text-cyan-600">readonly</code>이므로 생성 후 변경할 수
              없습니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "architectModel",
                  type: "string",
                  required: true,
                  desc: "설계자(Architect) 모델 이름 — 계획 수립, 코드 리뷰에 사용되는 고성능 모델 (e.g. claude-opus-4-20250514)",
                },
                {
                  name: "editorModel",
                  type: "string",
                  required: true,
                  desc: "편집자(Editor) 모델 이름 — 코드 생성, 실행에 사용되는 비용 효율적 모델 (e.g. claude-sonnet-4-20250514)",
                },
                {
                  name: "routingStrategy",
                  type: '"auto" | "plan-execute" | "manual"',
                  required: true,
                  desc: "라우팅 전략 — auto: 메시지 키워드 자동 분석, plan-execute: 명시적 단계 분리, manual: 외부에서 직접 지정",
                },
              ]}
            />

            {/* TaskPhase type */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              type TaskPhase
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              작업 실행 단계를 나타내는 유니온 타입입니다. 각 단계에 따라 사용되는 모델이
              달라집니다.
            </p>
            <CodeBlock>
              <span className="kw">type</span> <span className="type">TaskPhase</span> ={" "}
              <span className="str">&quot;plan&quot;</span> |{" "}
              <span className="str">&quot;execute&quot;</span> |{" "}
              <span className="str">&quot;review&quot;</span>;
            </CodeBlock>
            <div className="text-[13px] text-gray-600 mt-2 space-y-1">
              <p>
                &bull; <code className="text-emerald-600">&quot;plan&quot;</code> &mdash; 계획 수립
                단계. Architect 모델(고성능)을 사용합니다.
              </p>
              <p>
                &bull; <code className="text-amber-600">&quot;execute&quot;</code> &mdash; 실행
                단계. Editor 모델(비용 효율)을 사용합니다. <strong>기본값</strong>입니다.
              </p>
              <p>
                &bull; <code className="text-emerald-600">&quot;review&quot;</code> &mdash; 리뷰
                단계. Architect 모델(고성능)을 사용합니다.
              </p>
            </div>

            {/* DualModelRouter class */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              class DualModelRouter
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              작업 단계에 따라 적절한 LLM 클라이언트를 선택하는 라우터 클래스입니다. plan/review
              단계에서는 Architect 모델을, execute 단계에서는 Editor 모델을 반환합니다.
            </p>

            {/* Constructor */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">constructor</h4>
            <CodeBlock>
              <span className="kw">constructor</span>({"\n"}
              {"  "}
              <span className="prop">config</span>: <span className="type">DualModelConfig</span>,
              {"\n"}
              {"  "}
              <span className="prop">architectClient</span>:{" "}
              <span className="type">LLMProvider</span>,{"\n"}
              {"  "}
              <span className="prop">editorClient</span>: <span className="type">LLMProvider</span>,
              {"\n"})
            </CodeBlock>
            <ParamTable
              params={[
                {
                  name: "config",
                  type: "DualModelConfig",
                  required: true,
                  desc: "듀얼 모델 설정 (모델 이름, 라우팅 전략)",
                },
                {
                  name: "architectClient",
                  type: "LLMProvider",
                  required: true,
                  desc: "설계자 모델의 LLM 클라이언트 인스턴스",
                },
                {
                  name: "editorClient",
                  type: "LLMProvider",
                  required: true,
                  desc: "편집자 모델의 LLM 클라이언트 인스턴스",
                },
              ]}
            />

            {/* setPhase */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">setPhase(phase)</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              현재 작업 단계를 변경합니다. 이후{" "}
              <code className="text-cyan-600">getClientForPhase()</code> 호출 시 변경된 단계에
              해당하는 모델이 반환됩니다.
            </p>
            <CodeBlock>
              <span className="fn">setPhase</span>(<span className="prop">phase</span>:{" "}
              <span className="type">TaskPhase</span>): <span className="type">void</span>
            </CodeBlock>
            <ParamTable
              params={[
                {
                  name: "phase",
                  type: "TaskPhase",
                  required: true,
                  desc: '새 작업 단계 ("plan", "execute", "review")',
                },
              ]}
            />

            {/* getPhase */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">getPhase()</h4>
            <p className="text-[13px] text-gray-600 mb-3">현재 작업 단계를 반환합니다.</p>
            <CodeBlock>
              <span className="fn">getPhase</span>(): <span className="type">TaskPhase</span>
            </CodeBlock>

            {/* getConfig */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">getConfig()</h4>
            <p className="text-[13px] text-gray-600 mb-3">현재 듀얼 모델 설정 객체를 반환합니다.</p>
            <CodeBlock>
              <span className="fn">getConfig</span>(): <span className="type">DualModelConfig</span>
            </CodeBlock>

            {/* getClientForPhase */}
            <h4 className="text-sm font-bold text-gray-900 mb-2 mt-6">getClientForPhase(phase?)</h4>
            <p className="text-[13px] text-gray-600 mb-3">
              지정된 단계(또는 현재 단계)에 적합한 클라이언트, 모델 이름, 역할을 반환합니다.
              <code className="text-cyan-600">&quot;plan&quot;</code>이나{" "}
              <code className="text-cyan-600">&quot;review&quot;</code>이면 Architect를,{" "}
              <code className="text-cyan-600">&quot;execute&quot;</code>이면 Editor를 반환합니다.
            </p>
            <CodeBlock>
              <span className="fn">getClientForPhase</span>(<span className="prop">phase</span>?:{" "}
              <span className="type">TaskPhase</span>): {"{"}
              {"\n"}
              {"  "}
              <span className="kw">readonly</span> <span className="prop">client</span>:{" "}
              <span className="type">LLMProvider</span>;{"\n"}
              {"  "}
              <span className="kw">readonly</span> <span className="prop">model</span>:{" "}
              <span className="type">string</span>;{"\n"}
              {"  "}
              <span className="kw">readonly</span> <span className="prop">role</span>:{" "}
              <span className="str">&quot;architect&quot;</span> |{" "}
              <span className="str">&quot;editor&quot;</span>;{"\n"}
              {"}"}
            </CodeBlock>
            <ParamTable
              params={[
                {
                  name: "phase",
                  type: "TaskPhase | undefined",
                  required: false,
                  desc: "조회할 단계 (생략하면 현재 단계를 사용)",
                },
              ]}
            />
            <div className="text-[13px] text-gray-600 mt-2 space-y-1">
              <p>
                &bull; <span className="font-semibold">client</span> &mdash; 해당 단계의 LLM
                클라이언트 인스턴스
              </p>
              <p>
                &bull; <span className="font-semibold">model</span> &mdash; 해당 단계의 모델 이름
                문자열
              </p>
              <p>
                &bull; <span className="font-semibold">role</span> &mdash;{" "}
                <code className="text-emerald-600">&quot;architect&quot;</code> 또는{" "}
                <code className="text-amber-600">&quot;editor&quot;</code>
              </p>
            </div>

            {/* detectPhase function */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              function detectPhase
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              대화 메시지를 분석하여 작업 단계를 자동으로 감지하는 함수입니다. 마지막 사용자
              메시지에 계획/분석 관련 키워드가 포함되어 있으면
              <code className="text-cyan-600">&quot;plan&quot;</code>을, 아니면
              <code className="text-cyan-600">&quot;execute&quot;</code>를 반환합니다.
            </p>
            <CodeBlock>
              <span className="kw">function</span> <span className="fn">detectPhase</span>({"\n"}
              {"  "}
              <span className="prop">messages</span>: <span className="kw">readonly</span> {"{"}{" "}
              <span className="kw">readonly</span> <span className="prop">role</span>:{" "}
              <span className="type">string</span>; <span className="kw">readonly</span>{" "}
              <span className="prop">content</span>: <span className="type">string</span> {"}"}[],
              {"\n"}): <span className="type">TaskPhase</span>
            </CodeBlock>
            <ParamTable
              params={[
                {
                  name: "messages",
                  type: "readonly { role: string; content: string }[]",
                  required: true,
                  desc: "대화 메시지 배열 — 마지막 user 메시지에서 키워드를 검색합니다",
                },
              ]}
            />

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                기본 단계가 <code className="text-cyan-600">&quot;execute&quot;</code>입니다.
                <code className="text-cyan-600">setPhase()</code>를 호출하지 않으면 항상 Editor
                모델이 사용됩니다.
              </li>
              <li>
                <code className="text-cyan-600">detectPhase()</code>는{" "}
                <code className="text-cyan-600">&quot;review&quot;</code>를 반환하지 않습니다.
                키워드에 &quot;review&quot;가 포함되어 있어도{" "}
                <code className="text-cyan-600">&quot;plan&quot;</code>으로 반환됩니다 (plan과
                review 모두 Architect 모델을 사용하므로 실질적 차이는 없음).
              </li>
              <li>
                <code className="text-cyan-600">detectPhase()</code>는 메시지 배열을{" "}
                <strong>뒤에서부터</strong> 탐색하여 마지막 사용자 메시지를 찾습니다. 사용자
                메시지가 없으면 기본값 <code className="text-cyan-600">&quot;execute&quot;</code>를
                반환합니다.
              </li>
              <li>
                키워드 매칭은 대소문자를 구분하지 않습니다 (
                <code className="text-cyan-600">toLowerCase()</code> 적용). 단,{" "}
                <code className="text-cyan-600">&quot;RFC&quot;</code>는 소문자로 변환된{" "}
                <code className="text-cyan-600">&quot;rfc&quot;</code>로 매칭됩니다.
              </li>
              <li>
                <code className="text-cyan-600">getClientForPhase()</code>에{" "}
                <code className="text-cyan-600">phase</code> 인자를 전달하면{" "}
                <code className="text-cyan-600">currentPhase</code>를 변경하지 않고 해당 단계의
                클라이언트만 조회합니다.
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
              기본 사용법 &mdash; 수동 페이즈 전환
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              가장 간단한 사용 패턴입니다.
              <code className="text-cyan-600">setPhase()</code>로 작업 단계를 직접 지정하고,
              <code className="text-cyan-600">getClientForPhase()</code>로 해당 단계의 클라이언트를
              가져옵니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 1. 라우터 생성"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">router</span> ={" "}
              <span className="kw">new</span> <span className="fn">DualModelRouter</span>({"\n"}
              {"  "}
              {"{"} <span className="prop">architectModel</span>:{" "}
              <span className="str">&quot;claude-opus-4-20250514&quot;</span>,{"\n"}
              {"    "}
              <span className="prop">editorModel</span>:{" "}
              <span className="str">&quot;claude-sonnet-4-20250514&quot;</span>,{"\n"}
              {"    "}
              <span className="prop">routingStrategy</span>:{" "}
              <span className="str">&quot;manual&quot;</span> {"}"},{"\n"}
              {"  "}
              <span className="prop">architectClient</span>,{"\n"}
              {"  "}
              <span className="prop">editorClient</span>,{"\n"});
              {"\n"}
              {"\n"}
              <span className="cm">{"// 2. 계획 단계 — Architect 모델 사용"}</span>
              {"\n"}
              <span className="prop">router</span>.<span className="fn">setPhase</span>(
              <span className="str">&quot;plan&quot;</span>);
              {"\n"}
              <span className="kw">const</span> <span className="prop">planResult</span> ={" "}
              <span className="prop">router</span>.<span className="fn">getClientForPhase</span>();
              {"\n"}
              <span className="cm">
                {'// → { client: architectClient, model: "claude-opus-4-...", role: "architect" }'}
              </span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// 3. 실행 단계 — Editor 모델 사용"}</span>
              {"\n"}
              <span className="prop">router</span>.<span className="fn">setPhase</span>(
              <span className="str">&quot;execute&quot;</span>);
              {"\n"}
              <span className="kw">const</span> <span className="prop">execResult</span> ={" "}
              <span className="prop">router</span>.<span className="fn">getClientForPhase</span>();
              {"\n"}
              <span className="cm">
                {'// → { client: editorClient, model: "claude-sonnet-4-...", role: "editor" }'}
              </span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// 4. 리뷰 단계 — Architect 모델 사용"}</span>
              {"\n"}
              <span className="prop">router</span>.<span className="fn">setPhase</span>(
              <span className="str">&quot;review&quot;</span>);
              {"\n"}
              <span className="kw">const</span> <span className="prop">reviewResult</span> ={" "}
              <span className="prop">router</span>.<span className="fn">getClientForPhase</span>();
              {"\n"}
              <span className="cm">
                {'// → { client: architectClient, model: "claude-opus-4-...", role: "architect" }'}
              </span>
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> <code>routingStrategy</code>를 <code>&quot;manual&quot;</code>
              로 설정한 경우
              <code>setPhase()</code>를 직접 호출하지 않으면 기본값 <code>&quot;execute&quot;</code>
              가 유지됩니다. Architect 모델이 필요한 시점에 반드시{" "}
              <code>setPhase(&quot;plan&quot;)</code> 또는
              <code>setPhase(&quot;review&quot;)</code>를 호출하세요.
            </Callout>

            {/* 고급 사용법: auto 라우팅 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 키워드 기반 자동 라우팅
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">routingStrategy: &quot;auto&quot;</code>를 사용하면
              <code className="text-cyan-600">detectPhase()</code> 함수로 사용자 메시지의 키워드를
              분석하여 자동으로 적절한 모델을 선택합니다.
            </p>
            <CodeBlock>
              <span className="kw">import</span> {"{"} <span className="type">DualModelRouter</span>
              , <span className="fn">detectPhase</span> {"}"} <span className="kw">from</span>{" "}
              <span className="str">&quot;./llm/dual-model-router.js&quot;</span>;{"\n"}
              {"\n"}
              <span className="cm">{"// 사용자 메시지에서 페이즈 자동 감지"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">messages</span> = [{"\n"}
              {"  "}
              {"{"} <span className="prop">role</span>:{" "}
              <span className="str">&quot;user&quot;</span>, <span className="prop">content</span>:{" "}
              <span className="str">&quot;이 코드의 아키텍처를 설계해줘&quot;</span> {"}"},{"\n"}];
              {"\n"}
              {"\n"}
              <span className="kw">const</span> <span className="prop">phase</span> ={" "}
              <span className="fn">detectPhase</span>(<span className="prop">messages</span>);
              {"\n"}
              <span className="cm">{'// → "plan" ("설계" 키워드 감지)'}</span>
              {"\n"}
              {"\n"}
              <span className="prop">router</span>.<span className="fn">setPhase</span>(
              <span className="prop">phase</span>);
              {"\n"}
              <span className="kw">const</span> {"{"} <span className="prop">client</span>,{" "}
              <span className="prop">model</span>, <span className="prop">role</span> {"}"} ={" "}
              <span className="prop">router</span>.<span className="fn">getClientForPhase</span>();
              {"\n"}
              <span className="cm">{"// → Architect 모델이 선택됨"}</span>
            </CodeBlock>

            {/* 고급 사용법: 특정 페이즈 조회 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 현재 페이즈 변경 없이 특정 단계 조회
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">getClientForPhase()</code>에 인자를 전달하면 현재
              단계(<code className="text-cyan-600">currentPhase</code>)를 변경하지 않고 특정 단계의
              클라이언트를 조회할 수 있습니다.
            </p>
            <CodeBlock>
              <span className="cm">{'// 현재 단계는 "execute"로 유지'}</span>
              {"\n"}
              <span className="prop">router</span>.<span className="fn">setPhase</span>(
              <span className="str">&quot;execute&quot;</span>);
              {"\n"}
              {"\n"}
              <span className="cm">
                {'// plan 단계의 클라이언트만 조회 (currentPhase는 여전히 "execute")'}
              </span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">planClient</span> ={" "}
              <span className="prop">router</span>.<span className="fn">getClientForPhase</span>(
              <span className="str">&quot;plan&quot;</span>);
              {"\n"}
              <span className="fn">console</span>.<span className="fn">log</span>(
              <span className="prop">router</span>.<span className="fn">getPhase</span>());{" "}
              <span className="cm">{'// "execute" — 변경 안 됨'}</span>
            </CodeBlock>

            <Callout type="tip" icon="*">
              <strong>팁:</strong> 에이전트 루프에서 &quot;다음 단계는 무슨 모델을 쓸까?&quot; 같은
              사전 확인이 필요할 때 유용합니다. 현재 실행 흐름을 방해하지 않으면서 다른 단계의 모델
              정보를 미리 확인할 수 있습니다.
            </Callout>

            <DeepDive title="PLAN_KEYWORDS 전체 목록과 감지 로직">
              <p className="mb-3">
                <code className="text-cyan-600">detectPhase()</code>는 아래 키워드 중{" "}
                <strong>하나라도</strong>
                사용자 메시지에 포함되면 <code className="text-cyan-600">&quot;plan&quot;</code>으로
                판단합니다. 키워드 매칭은 <code className="text-cyan-600">String.includes()</code>를
                사용하므로 부분 문자열 매칭입니다.
              </p>
              <div className="overflow-x-auto">
                <table className="text-[13px] text-gray-600 w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 pr-4 font-semibold text-gray-900">키워드</th>
                      <th className="text-left py-2 font-semibold text-gray-900">설명</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr>
                      <td className="py-1.5 pr-4">
                        <code>plan</code>
                      </td>
                      <td>계획</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 pr-4">
                        <code>설계</code>
                      </td>
                      <td>설계 (한국어)</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 pr-4">
                        <code>분석</code>
                      </td>
                      <td>분석 (한국어)</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 pr-4">
                        <code>리뷰</code>
                      </td>
                      <td>리뷰 (한국어)</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 pr-4">
                        <code>review</code>
                      </td>
                      <td>코드 리뷰</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 pr-4">
                        <code>architecture</code>
                      </td>
                      <td>아키텍처 설계</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 pr-4">
                        <code>design</code>
                      </td>
                      <td>설계</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 pr-4">
                        <code>analyze</code> / <code>analyse</code>
                      </td>
                      <td>분석 (미국식/영국식)</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 pr-4">
                        <code>strategy</code>
                      </td>
                      <td>전략</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 pr-4">
                        <code>approach</code>
                      </td>
                      <td>접근 방식</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 pr-4">
                        <code>proposal</code>
                      </td>
                      <td>제안</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 pr-4">
                        <code>RFC</code>
                      </td>
                      <td>Request for Comments &mdash; 기술 제안서</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-gray-600">
                배열을 <strong>역순</strong>으로 탐색하여 마지막{" "}
                <code className="text-cyan-600">user</code> 역할 메시지를 찾습니다.{" "}
                <code className="text-cyan-600">[...messages].reverse().find()</code> 패턴을
                사용하며, 원본 배열은 변경하지 않습니다.
              </p>
              <p className="mt-2 text-amber-600">
                키워드가 다른 단어의 일부로 포함될 수 있습니다. 예를 들어 &quot;explain&quot;에는
                &quot;plan&quot;이 포함되어 있으므로 <code>&quot;plan&quot;</code>으로 잘못 감지될
                수 있습니다. 이는 알려진 한계점입니다.
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
              라우팅 흐름 다이어그램
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              에이전트 루프가 DualModelRouter를 통해 모델을 선택하는 전체 흐름입니다.
              <code className="text-cyan-600">routingStrategy</code>에 따라 페이즈 결정 방식이
              달라집니다.
            </p>

            <MermaidDiagram
              title="DualModelRouter 라우팅 흐름"
              titleColor="purple"
              chart={`flowchart TD
  START["에이전트 루프 시작<br/><small>라우팅 판단 시작</small>"]
  STRATEGY{"routingStrategy?<br/><small>라우팅 전략 확인</small>"}
  AUTO["detectPhase(messages)<br/><small>키워드 자동 분석</small>"]
  MANUAL["setPhase() 호출<br/><small>외부에서 직접 지정</small>"]
  PHASE{"currentPhase?<br/><small>현재 작업 단계 확인</small>"}
  ARCH["Architect 모델<br/><small>고성능 깊은 추론</small>"]
  EDIT["Editor 모델<br/><small>비용 효율 빠른 응답</small>"]
  CALL["LLM 호출 실행<br/><small>선택된 모델로 요청</small>"]

  START --> STRATEGY
  STRATEGY -->|"auto"| AUTO
  STRATEGY -->|"manual / plan-execute"| MANUAL
  AUTO --> PHASE
  MANUAL --> PHASE
  PHASE -->|"plan / review"| ARCH
  PHASE -->|"execute"| EDIT
  ARCH --> CALL
  EDIT --> CALL

  style PHASE fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style ARCH fill:#dcfce7,stroke:#22c55e,color:#1e293b
  style EDIT fill:#fef9c3,stroke:#eab308,color:#1e293b
  style START fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style STRATEGY fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style AUTO fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style MANUAL fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style CALL fill:#e0e7ff,stroke:#64748b,color:#1e293b`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              핵심 코드 분석
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">getClientForPhase()</code> 메서드의 핵심 라우팅
              로직입니다. 단 두 줄로 plan/review는 Architect, execute는 Editor로 분기합니다.
            </p>
            <CodeBlock>
              <span className="fn">getClientForPhase</span>(<span className="prop">phase</span>?:{" "}
              <span className="type">TaskPhase</span>): {"{"} <span className="prop">client</span>;{" "}
              <span className="prop">model</span>; <span className="prop">role</span> {"}"} {"{"}
              {"\n"}
              {"  "}
              <span className="cm">{"// [1] 인자가 없으면 현재 단계 사용"}</span>
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">p</span> ={" "}
              <span className="prop">phase</span> ?? <span className="kw">this</span>.
              <span className="prop">currentPhase</span>;{"\n"}
              {"\n"}
              {"  "}
              <span className="cm">{"// [2] plan과 review는 Architect, 나머지는 Editor"}</span>
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">isArchitect</span> ={" "}
              <span className="prop">p</span> === <span className="str">&quot;plan&quot;</span> ||{" "}
              <span className="prop">p</span> === <span className="str">&quot;review&quot;</span>;
              {"\n"}
              {"\n"}
              {"  "}
              <span className="cm">{"// [3] 해당 역할의 클라이언트, 모델 이름, 역할을 반환"}</span>
              {"\n"}
              {"  "}
              <span className="kw">return</span> <span className="prop">isArchitect</span>
              {"\n"}
              {"    "}? {"{"} <span className="prop">client</span>: <span className="kw">this</span>
              .<span className="prop">architectClient</span>, <span className="prop">model</span>:{" "}
              <span className="kw">this</span>.<span className="prop">config</span>.
              <span className="prop">architectModel</span>, <span className="prop">role</span>:{" "}
              <span className="str">&quot;architect&quot;</span> {"}"}
              {"\n"}
              {"    "}: {"{"} <span className="prop">client</span>: <span className="kw">this</span>
              .<span className="prop">editorClient</span>, <span className="prop">model</span>:{" "}
              <span className="kw">this</span>.<span className="prop">config</span>.
              <span className="prop">editorModel</span>, <span className="prop">role</span>:{" "}
              <span className="str">&quot;editor&quot;</span> {"}"};{"\n"}
              {"}"}
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">[1]</strong> nullish coalescing (
                <code className="text-cyan-600">??</code>)으로 인자가 없으면 현재 저장된 단계를
                사용합니다. 인자를 전달해도 <code className="text-cyan-600">currentPhase</code>는
                변경되지 않습니다.
              </p>
              <p>
                <strong className="text-gray-900">[2]</strong> plan과 review는 모두 설계/분석
                작업이므로 동일하게 Architect 모델을 사용합니다. 나머지(execute)는 Editor 모델을
                사용합니다.
              </p>
              <p>
                <strong className="text-gray-900">[3]</strong> 반환 객체의 모든 프로퍼티가{" "}
                <code className="text-cyan-600">readonly</code>이므로 호출자가 값을 변경할 수
                없습니다.
              </p>
            </div>

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              detectPhase 감지 로직
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">detectPhase()</code>의 핵심 로직입니다. 메시지 배열을
              역순으로 탐색하여 마지막 사용자 메시지를 찾고, 키워드를 분석합니다.
            </p>
            <CodeBlock>
              <span className="kw">function</span> <span className="fn">detectPhase</span>(
              <span className="prop">messages</span>): <span className="type">TaskPhase</span> {"{"}
              {"\n"}
              {"  "}
              <span className="cm">
                {"// [1] 배열을 복사하고 뒤집어서 마지막 user 메시지를 찾음"}
              </span>
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">lastUser</span> = [...
              <span className="prop">messages</span>].<span className="fn">reverse</span>().
              <span className="fn">find</span>(<span className="prop">m</span> ={">"}{" "}
              <span className="prop">m</span>.<span className="prop">role</span> ==={" "}
              <span className="str">&quot;user&quot;</span>);
              {"\n"}
              {"\n"}
              {"  "}
              <span className="cm">{'// [2] 사용자 메시지가 없으면 기본값 "execute"'}</span>
              {"\n"}
              {"  "}
              <span className="kw">if</span> (!<span className="prop">lastUser</span>){" "}
              <span className="kw">return</span> <span className="str">&quot;execute&quot;</span>;
              {"\n"}
              {"\n"}
              {"  "}
              <span className="cm">{"// [3] 소문자로 변환하여 대소문자 무관 매칭"}</span>
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">content</span> ={" "}
              <span className="prop">lastUser</span>.<span className="prop">content</span>.
              <span className="fn">toLowerCase</span>();
              {"\n"}
              {"\n"}
              {"  "}
              <span className="cm">{'// [4] PLAN_KEYWORDS 중 하나라도 포함되면 "plan"'}</span>
              {"\n"}
              {"  "}
              <span className="kw">return</span> <span className="prop">PLAN_KEYWORDS</span>.
              <span className="fn">some</span>(<span className="prop">k</span> ={">"}{" "}
              <span className="prop">content</span>.<span className="fn">includes</span>(
              <span className="prop">k</span>)) ? <span className="str">&quot;plan&quot;</span> :{" "}
              <span className="str">&quot;execute&quot;</span>;{"\n"}
              {"}"}
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">[1]</strong>{" "}
                <code className="text-cyan-600">[...messages]</code>로 배열을 얕은 복사한 후{" "}
                <code className="text-cyan-600">reverse()</code>합니다. 원본 배열은{" "}
                <code className="text-cyan-600">readonly</code>이므로 직접 뒤집을 수 없습니다.
              </p>
              <p>
                <strong className="text-gray-900">[2]</strong> user 역할 메시지가 전혀 없는
                경우(시스템 메시지만 있는 초기 상태 등)에 대한 방어 코드입니다.
              </p>
              <p>
                <strong className="text-gray-900">[3]</strong> 대소문자를 통일하여
                &quot;Design&quot;, &quot;DESIGN&quot;, &quot;design&quot; 모두 감지합니다.
              </p>
              <p>
                <strong className="text-gray-900">[4]</strong>{" "}
                <code className="text-cyan-600">Array.some()</code>으로 키워드 중 하나라도 포함되면
                즉시 <code className="text-cyan-600">true</code>를 반환합니다 (short-circuit 평가).
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
                &quot;항상 Editor 모델만 사용되고 Architect 모델이 호출되지 않아요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                기본 단계가 <code className="text-cyan-600">&quot;execute&quot;</code>이므로,
                <code className="text-cyan-600">setPhase()</code>를 호출하지 않으면 항상 Editor
                모델이 사용됩니다.
              </p>
              <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
                <li>
                  <strong>manual 전략:</strong> 에이전트 루프에서 적절한 시점에
                  <code className="text-cyan-600">setPhase(&quot;plan&quot;)</code>을 호출하고
                  있는지 확인하세요.
                </li>
                <li>
                  <strong>auto 전략:</strong> <code className="text-cyan-600">detectPhase()</code>를
                  호출하고 그 결과를 <code className="text-cyan-600">setPhase()</code>에 전달하고
                  있는지 확인하세요. 사용자 메시지에 PLAN_KEYWORDS에 해당하는 키워드가 포함되어
                  있어야 합니다.
                </li>
              </ul>
              <Callout type="tip" icon="*">
                <code>getPhase()</code>를 호출하여 현재 단계를 로그로 출력하면 디버깅에 도움이
                됩니다.
              </Callout>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;코드 생성 요청인데 Architect(고비용) 모델이 사용되어 비용이 많이 나와요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                <code className="text-cyan-600">detectPhase()</code>의 키워드 매칭이 부분 문자열
                기반이라 의도치 않은 매칭이 발생할 수 있습니다.
              </p>
              <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
                <li>
                  <code className="text-cyan-600">&quot;explain&quot;</code>에{" "}
                  <code className="text-cyan-600">&quot;plan&quot;</code>이 포함되어 있으므로{" "}
                  <code className="text-cyan-600">&quot;plan&quot;</code>으로 감지됩니다.
                </li>
                <li>
                  <code className="text-cyan-600">&quot;replacement&quot;</code>에{" "}
                  <code className="text-cyan-600">&quot;plan&quot;</code>이 아닌{" "}
                  <code className="text-cyan-600">&quot;ace&quot;</code>는 키워드가 아니므로
                  안전합니다.
                </li>
                <li>
                  이런 문제가 자주 발생하면{" "}
                  <code className="text-cyan-600">routingStrategy: &quot;manual&quot;</code>로
                  전환하여 외부에서 명시적으로 단계를 제어하세요.
                </li>
              </ul>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;두 모델이 서로 다른 API 키/엔드포인트를 사용해야 하는데 어떻게
                설정하나요?&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                <code className="text-cyan-600">architectClient</code>와{" "}
                <code className="text-cyan-600">editorClient</code>는 각각 독립적인{" "}
                <code className="text-cyan-600">LLMProvider</code> 인스턴스입니다. 서로 다른 API 키,
                엔드포인트, 설정을 가진 클라이언트를 별도로 생성하여 전달하면 됩니다.
              </p>
              <CodeBlock>
                <span className="kw">const</span> <span className="prop">archClient</span> ={" "}
                <span className="fn">createLLMProvider</span>({"{"}{" "}
                <span className="prop">apiKey</span>: <span className="prop">OPUS_KEY</span>, ...{" "}
                {"}"});
                {"\n"}
                <span className="kw">const</span> <span className="prop">editClient</span> ={" "}
                <span className="fn">createLLMProvider</span>({"{"}{" "}
                <span className="prop">apiKey</span>: <span className="prop">SONNET_KEY</span>, ...{" "}
                {"}"});
                {"\n"}
                {"\n"}
                <span className="kw">const</span> <span className="prop">router</span> ={" "}
                <span className="kw">new</span> <span className="fn">DualModelRouter</span>(
                <span className="prop">config</span>, <span className="prop">archClient</span>,{" "}
                <span className="prop">editClient</span>);
              </CodeBlock>
            </div>

            {/* FAQ 4 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;detectPhase()가 &apos;review&apos;를 반환하지 않는 이유가 뭔가요?&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                설계상 의도된 동작입니다. <code className="text-cyan-600">detectPhase()</code>는
                <code className="text-cyan-600">&quot;plan&quot;</code>과{" "}
                <code className="text-cyan-600">&quot;execute&quot;</code>만 반환합니다.
                &quot;review&quot; 키워드가 감지되면{" "}
                <code className="text-cyan-600">&quot;plan&quot;</code>으로 반환되는데, plan과
                review 모두 Architect 모델을 사용하므로 실질적인 차이가 없습니다. 명시적으로{" "}
                <code className="text-cyan-600">&quot;review&quot;</code> 단계를 사용하고 싶다면
                <code className="text-cyan-600">setPhase(&quot;review&quot;)</code>를 직접
                호출하세요.
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
                  name: "agent-loop.ts",
                  slug: "agent-loop",
                  relation: "parent",
                  desc: "DualModelRouter를 사용하여 작업 단계별로 적절한 모델을 선택하는 메인 에이전트 루프",
                },
                {
                  name: "llm-client.ts",
                  slug: "llm-client",
                  relation: "sibling",
                  desc: "DualModelRouter가 반환하는 LLMProvider 클라이언트의 구현체 — 실제 LLM API 호출 담당",
                },
                {
                  name: "model-capabilities.ts",
                  slug: "model-capabilities",
                  relation: "sibling",
                  desc: "모델별 기능과 제한사항 정의 — Architect/Editor 모델 선택 시 참고하는 모델 스펙",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}

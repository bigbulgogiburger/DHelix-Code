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

export default function CmdDualModelPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/commands/dual-model.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">/dual, /architect, /editor</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="leaf" />
              <span
                className="text-xs font-semibold rounded-md bg-cyan-100 text-cyan-700"
                style={{ padding: "5px 14px" }}
              >
                Slash Command
              </span>
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              작업 유형에 따라 서로 다른 LLM 모델을 자동으로 선택하는 듀얼 모델 라우팅을 설정하는 세
              가지 슬래시 명령어입니다.
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
                듀얼 모델 라우팅은 하나의 대화에서 <strong>두 개의 모델</strong>을 역할에 따라
                자동으로 전환하는 방식입니다. 기획/분석/리뷰 같은 고수준 사고가 필요한 작업에는
                <strong>아키텍트 모델</strong>(고성능)을, 코드 생성/실행 같은 실무 작업에는
                <strong>에디터 모델</strong>(비용 효율적)을 사용합니다.
              </p>
              <p>이 파일에는 세 가지 명령어가 정의되어 있습니다:</p>
              <ul className="list-disc list-inside space-y-1 text-[14px] text-gray-600">
                <li>
                  <code className="text-cyan-600">/architect</code> &mdash; 기획/리뷰용 고성능
                  모델을 설정합니다.
                </li>
                <li>
                  <code className="text-cyan-600">/editor</code> &mdash; 코드 생성용 비용 효율
                  모델을 설정합니다.
                </li>
                <li>
                  <code className="text-cyan-600">/dual</code> &mdash; 듀얼 모델 라우팅을
                  활성화/비활성화합니다.
                </li>
              </ul>
              <p>
                이를 통해 품질은 유지하면서 비용을 절감할 수 있습니다. 예를 들어 아키텍트에
                claude-opus를, 에디터에 gpt-4o-mini를 설정하면 복잡한 설계는 최고 성능으로, 단순
                코드 작성은 저렴하게 처리됩니다.
              </p>
            </div>

            <MermaidDiagram
              title="듀얼 모델 라우팅 개념"
              titleColor="purple"
              chart={`graph TD
  USER["사용자 메시지"] --> DETECT["키워드 감지<br/><small>plan, review, design, analyze...</small>"]
  DETECT -->|"기획/리뷰 키워드"| ARCH["Architect 모델<br/><small>예: claude-opus-4-6</small>"]
  DETECT -->|"코드/실행 키워드"| EDIT["Editor 모델<br/><small>예: gpt-4o-mini</small>"]

  ARCH --> RESPONSE["고품질 설계/분석 응답"]
  EDIT --> RESPONSE2["빠른 코드 생성 응답"]

  CMD_A["/architect 모델명"] -.->|"설정"| ARCH
  CMD_E["/editor 모델명"] -.->|"설정"| EDIT
  CMD_D["/dual on|off"] -.->|"활성화/비활성화"| DETECT

  style DETECT fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style ARCH fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style EDIT fill:#dbeafe,stroke:#3b82f6,color:#1e293b
  style CMD_A fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style CMD_E fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style CMD_D fill:#f1f5f9,stroke:#64748b,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> 듀얼 모델은 건축 프로젝트와 같습니다.
              <strong>건축가(Architect)</strong>가 설계도를 그리고, <strong>시공자(Editor)</strong>
              가 실제 건물을 짓습니다. 건축가에게는 최고의 전문성이 필요하지만, 시공은 효율적인 팀이
              맡으면 됩니다.
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

            {/* architectCommand */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              architectCommand: SlashCommand
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              아키텍트 모델을 설정하거나 현재 상태를 조회합니다. 인자 없이 호출하면 사용법을
              안내하고, 모델명을 전달하면 설정합니다.
            </p>
            <ParamTable
              params={[
                { name: "name", type: '"architect"', required: true, desc: "명령어 이름" },
                {
                  name: "description",
                  type: "string",
                  required: true,
                  desc: '"Set or show the architect model (planning/review)"',
                },
                {
                  name: "usage",
                  type: "string",
                  required: true,
                  desc: '"/architect [model-name]"',
                },
                {
                  name: "execute",
                  type: "(args, context) => Promise<CommandResult>",
                  required: true,
                  desc: "명령어 실행 핸들러",
                },
              ]}
            />

            {/* editorCommand */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              editorCommand: SlashCommand
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              에디터 모델을 설정하거나 현재 상태를 조회합니다. 코드 생성 및 실행 단계에서 사용되는
              비용 효율적 모델을 지정합니다.
            </p>
            <ParamTable
              params={[
                { name: "name", type: '"editor"', required: true, desc: "명령어 이름" },
                {
                  name: "description",
                  type: "string",
                  required: true,
                  desc: '"Set or show the editor model (code generation)"',
                },
                { name: "usage", type: "string", required: true, desc: '"/editor [model-name]"' },
                {
                  name: "execute",
                  type: "(args, context) => Promise<CommandResult>",
                  required: true,
                  desc: "명령어 실행 핸들러",
                },
              ]}
            />

            {/* dualCommand */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              dualCommand: SlashCommand
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              듀얼 모델 라우팅을 활성화/비활성화하거나 상태를 조회합니다.
            </p>
            <ParamTable
              params={[
                { name: "name", type: '"dual"', required: true, desc: "명령어 이름" },
                {
                  name: "description",
                  type: "string",
                  required: true,
                  desc: '"Toggle dual-model (architect/editor) routing"',
                },
                { name: "usage", type: "string", required: true, desc: '"/dual [on|off|status]"' },
                {
                  name: "execute",
                  type: "(args, context) => Promise<CommandResult>",
                  required: true,
                  desc: "명령어 실행 핸들러",
                },
              ]}
            />

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                <code className="text-cyan-600">/architect</code>와{" "}
                <code className="text-cyan-600">/editor</code>로 모델을 설정해도 메인 모델(
                <code className="text-cyan-600">context.model</code>)은 변경되지 않습니다.
                <code className="text-cyan-600">newModel: undefined</code>로 명시적으로 처리됩니다.
              </li>
              <li>
                <code className="text-cyan-600">/dual on</code>을 실행하기 전에 반드시
                <code className="text-cyan-600">/architect</code>와{" "}
                <code className="text-cyan-600">/editor</code>로 모델을 먼저 설정해야 합니다.
              </li>
              <li>
                라우팅 키워드 감지는 사용자 메시지의 텍스트 기반으로 동작합니다.
                <code className="text-cyan-600">plan</code>,{" "}
                <code className="text-cyan-600">review</code>,
                <code className="text-cyan-600">design</code>,{" "}
                <code className="text-cyan-600">analyze</code> 등의 키워드가 포함되면 아키텍트
                모델로 라우팅됩니다.
              </li>
              <li>
                <code className="text-cyan-600">/dual off</code>로 비활성화하면 단일 모델 모드로
                돌아갑니다.
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

            {/* 기본 사용법: 설정 워크플로 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              기본 사용법 &mdash; 듀얼 모델 설정 워크플로
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              듀얼 모델 라우팅을 활성화하는 일반적인 3단계 워크플로입니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// Step 1: 아키텍트 모델 설정 (고성능)"}</span>
              {"\n"}
              <span className="str">/architect claude-opus-4-6</span>
              {"\n"}
              <span className="cm">{'// → "Architect model set to: claude-opus-4-6."'}</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// Step 2: 에디터 모델 설정 (비용 효율)"}</span>
              {"\n"}
              <span className="str">/editor gpt-4o-mini</span>
              {"\n"}
              <span className="cm">{'// → "Editor model set to: gpt-4o-mini."'}</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// Step 3: 듀얼 모델 라우팅 활성화"}</span>
              {"\n"}
              <span className="str">/dual on</span>
              {"\n"}
              <span className="cm">{'// → "Dual-model routing enabled."'}</span>
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> <code>/architect</code>와 <code>/editor</code> 모델을 설정하지
              않고
              <code>/dual on</code>만 실행하면 라우팅할 모델이 없어 기본 모델이 사용됩니다. 반드시
              모델을 먼저 설정하세요.
            </Callout>

            {/* 상태 확인 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 현재 상태 확인 및 비활성화
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              각 명령어를 인자 없이 실행하면 현재 상태와 사용법을 확인할 수 있습니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 현재 듀얼 모델 상태 확인"}</span>
              {"\n"}
              <span className="str">/dual</span>
              {"\n"}
              <span className="cm">{"// → 라우팅 방식 설명 + 명령어 목록 표시"}</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// 아키텍트 모델 현재 상태 확인"}</span>
              {"\n"}
              <span className="str">/architect</span>
              {"\n"}
              <span className="cm">{"// → 현재 메인 모델명 + 사용법 안내"}</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// 듀얼 모델 라우팅 비활성화"}</span>
              {"\n"}
              <span className="str">/dual off</span>
              {"\n"}
              <span className="cm">
                {'// → "Dual-model routing disabled. Using single model for all phases."'}
              </span>
            </CodeBlock>

            <DeepDive title="라우팅 전략 상세">
              <p className="mb-3">듀얼 모델 활성화 시 라우팅 전략은 다음과 같습니다:</p>
              <ul className="list-disc list-inside space-y-1.5 text-gray-600">
                <li>
                  <strong>Architect로 라우팅되는 키워드</strong>: plan, review, design, analyze,
                  architecture, refactor
                </li>
                <li>
                  <strong>Editor로 라우팅되는 작업</strong>: 코드 생성, 도구 실행, 파일 수정
                </li>
                <li>키워드가 감지되지 않으면 기본적으로 Editor 모델이 사용됩니다.</li>
              </ul>
              <p className="mt-3 text-gray-600">
                이 전략은 <code className="text-cyan-600">dual-model-router.ts</code>에서 구현되며,
                여기서 정의된 명령어는 라우터의 설정 값만 변경합니다.
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
              명령어 분기 구조
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              세 명령어 모두 동일한 패턴을 따릅니다: 인자가 없으면 상태/사용법 표시, 인자가 있으면
              설정을 변경합니다.
            </p>

            <MermaidDiagram
              title="듀얼 모델 명령어 분기 구조"
              titleColor="purple"
              chart={`graph TD
  A["/architect"] --> A_CHK{"인자 있는가?"}
  A_CHK -->|"없음"| A_INFO["현재 상태 + 사용법 표시"]
  A_CHK -->|"모델명"| A_SET["Architect 모델 설정"]

  E["/editor"] --> E_CHK{"인자 있는가?"}
  E_CHK -->|"없음"| E_INFO["현재 상태 + 사용법 표시"]
  E_CHK -->|"모델명"| E_SET["Editor 모델 설정"]

  D["/dual"] --> D_CHK{"인자 값?"}
  D_CHK -->|"on"| D_ON["라우팅 활성화"]
  D_CHK -->|"off"| D_OFF["라우팅 비활성화"]
  D_CHK -->|"없음/기타"| D_INFO["상태 + 명령어 목록"]

  style A fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style E fill:#dbeafe,stroke:#3b82f6,color:#1e293b
  style D fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              핵심 코드 분석
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">/dual</code> 명령어의 분기 로직입니다. 인자를 소문자로
              정규화한 후 <code className="text-cyan-600">on</code>/
              <code className="text-cyan-600">off</code>를 매칭합니다.
            </p>
            <CodeBlock>
              <span className="kw">async</span> <span className="fn">execute</span>(
              <span className="prop">args</span>: <span className="type">string</span>,{" "}
              <span className="prop">_context</span>: <span className="type">CommandContext</span>){" "}
              {"{"}
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">arg</span> ={" "}
              <span className="prop">args</span>.<span className="fn">trim</span>().
              <span className="fn">toLowerCase</span>();
              {"\n"}
              {"\n"}
              {"  "}
              <span className="cm">{"// [1] 활성화: 라우팅 전략 설명 포함"}</span>
              {"\n"}
              {"  "}
              <span className="kw">if</span> (<span className="prop">arg</span> ==={" "}
              <span className="str">&quot;on&quot;</span>) {"{"}
              {"\n"}
              {"    "}
              <span className="kw">return</span> {"{"} <span className="prop">output</span>:{" "}
              <span className="str">&quot;Dual-model routing enabled...&quot;</span>,{" "}
              <span className="prop">success</span>: <span className="kw">true</span> {"}"};{"\n"}
              {"  "}
              {"}"}
              {"\n"}
              {"\n"}
              {"  "}
              <span className="cm">{"// [2] 비활성화: 단일 모델 모드로 전환"}</span>
              {"\n"}
              {"  "}
              <span className="kw">if</span> (<span className="prop">arg</span> ==={" "}
              <span className="str">&quot;off&quot;</span>) {"{"}
              {"\n"}
              {"    "}
              <span className="kw">return</span> {"{"} <span className="prop">output</span>:{" "}
              <span className="str">&quot;Dual-model routing disabled...&quot;</span>,{" "}
              <span className="prop">success</span>: <span className="kw">true</span> {"}"};{"\n"}
              {"  "}
              {"}"}
              {"\n"}
              {"\n"}
              {"  "}
              <span className="cm">{"// [3] 기본: 상태 및 명령어 가이드 표시"}</span>
              {"\n"}
              {"  "}
              <span className="kw">return</span> {"{"} <span className="prop">output</span>:{" "}
              <span className="str">
                &quot;Dual-model routing (Architect/Editor pattern)...&quot;
              </span>
              , <span className="prop">success</span>: <span className="kw">true</span> {"}"};{"\n"}
              {"}"}
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">[1]</strong> 활성화 시 라우팅 전략(plan/review →
                architect, execute → editor)을 설명합니다. 페이즈는 메시지에서 자동 감지됩니다.
              </p>
              <p>
                <strong className="text-gray-900">[2]</strong> 비활성화 시 모든 작업에 단일 모델을
                사용하는 기본 모드로 돌아갑니다.
              </p>
              <p>
                <strong className="text-gray-900">[3]</strong> 인자 없이 실행하면 Architect/Editor
                패턴 설명과 사용 가능한 명령어 목록을 보여줍니다.
              </p>
            </div>

            <Callout type="tip" icon="*">
              <strong>팁:</strong> <code>/architect</code>와 <code>/editor</code> 명령어는 모두
              <code className="text-cyan-600"> newModel: undefined</code>를 반환합니다. 메인 모델을
              변경하지 않고 라우터의 설정만 업데이트하기 때문입니다. 메인 모델을 직접 변경하려면{" "}
              <code className="text-cyan-600">/model</code> 명령어를 사용하세요.
            </Callout>
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
                &quot;/dual on 했는데 항상 같은 모델만 사용돼요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">/architect</code>와{" "}
                <code className="text-cyan-600">/editor</code>로 각각 다른 모델을 설정했는지
                확인하세요. 모델이 설정되지 않으면 기본 모델이 양쪽 모두에 사용됩니다. 또한 메시지에
                라우팅 키워드(plan, review, design 등)가 포함되어야 아키텍트 모델로 전환됩니다.
              </p>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;/architect로 모델을 설정했는데 /model에서 변경이 안 보여요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">/architect</code>와{" "}
                <code className="text-cyan-600">/editor</code>는 메인 모델을 변경하지 않습니다.
                이들은 듀얼 라우터의 설정만 업데이트하며,
                <code className="text-cyan-600">/model</code>에 표시되는 메인 모델과는 별개입니다.
                <code className="text-cyan-600">/dual on</code> 상태에서만 라우팅이 적용됩니다.
              </p>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;비용이 줄지 않는 것 같아요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                비용 절감 효과는 에디터 모델에 저렴한 모델을 설정했을 때 나타납니다. 양쪽 모두 같은
                가격대의 모델을 설정하면 비용 차이가 없습니다.
                <code className="text-cyan-600">/cost</code> 명령어로 실제 비용을 확인하세요.
              </p>
            </div>

            {/* FAQ 4 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;특정 메시지가 잘못된 모델로 라우팅돼요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                키워드 기반 감지는 완벽하지 않을 수 있습니다. 메시지에 &quot;plan&quot; 같은 단어가
                의도치 않게 포함되면 아키텍트 모델로 라우팅될 수 있습니다. 이런 경우{" "}
                <code className="text-cyan-600">/dual off</code>로 비활성화하거나, 메시지를 다시
                작성해 보세요.
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
                  name: "llm/dual-model-router.ts",
                  slug: "dual-model-router",
                  relation: "parent",
                  desc: "듀얼 모델 자동 전환 라우터 — 작업 페이즈별 모델 선택 로직 구현",
                },
                {
                  name: "llm/model-capabilities.ts",
                  slug: "model-capabilities",
                  relation: "sibling",
                  desc: "모델별 능력 레지스트리 — 사용 가능한 모델 목록과 특성 확인",
                },
                {
                  name: "cost-tracker.ts",
                  slug: "cost-tracker",
                  relation: "sibling",
                  desc: "비용 추적 모듈 — 듀얼 모델 사용 시 모델별 비용 분석",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}

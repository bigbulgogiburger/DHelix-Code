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

export default function StructuredOutputPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}><div className="center-narrow">
      {/* ─── Header ─── */}
      <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <FilePath path="src/llm/structured-output.ts" />
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
            <span className="text-gray-900">
              Structured Output
            </span>
          </h1>
          <div className="flex items-center gap-3 mb-5">
            <LayerBadge layer="infra" />
          </div>
          <p className="text-[16px] text-gray-600 leading-relaxed">
            구조화된 출력 (JSON mode) &mdash; 모델 능력 티어에 따라 적절한 JSON 출력 설정을 생성하는 모듈입니다.
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
              LLM에게 도구 호출을 요청할 때, 모든 모델이 네이티브 function calling을 지원하지는 않습니다.
              이 모듈은 모델의 능력 수준(<code className="text-cyan-600">CapabilityTier</code>)과
              프로바이더(OpenAI, Anthropic, Ollama 등)에 따라 적절한 구조화 출력 설정을 생성합니다.
            </p>
            <p>
              HIGH 티어 모델(GPT-4o, Claude 등)은 네이티브 function calling을 지원하므로 추가 설정이 불필요합니다.
              MEDIUM 티어는 JSON 스키마 모드를, LOW 티어는 프롬프트에 스키마 가이드 텍스트를 주입하여
              모델이 올바른 JSON을 생성하도록 유도합니다.
            </p>
            <p>
              프로바이더마다 JSON 출력을 강제하는 방법이 다릅니다. OpenAI는 <code className="text-cyan-600">response_format</code>,
              Anthropic은 prefill 기법, Ollama는 <code className="text-cyan-600">format: &quot;json&quot;</code>을 사용합니다.
              이 차이를 한 곳에서 추상화하여 호출자가 프로바이더별 세부사항을 몰라도 되게 합니다.
            </p>
          </div>

          <MermaidDiagram
            title="Structured Output 아키텍처 위치"
            titleColor="purple"
            chart={`graph TD
  TCS["Tool Call Strategy<br/><small>llm/tool-call-strategy.ts — 전략 선택</small>"]
  SO["Structured Output<br/><small>llm/structured-output.ts — JSON 설정 생성</small>"]
  MC["Model Capabilities<br/><small>llm/model-capabilities.ts — 티어 판별</small>"]
  PROV["LLM Provider<br/><small>OpenAI / Anthropic / Ollama</small>"]
  SP["System Prompt<br/><small>core/system-prompt-builder.ts</small>"]

  TCS -->|"프로바이더 + 티어 전달"| SO
  MC -->|"CapabilityTier 제공"| SO
  SO -->|"response_format 설정"| PROV
  SO -->|"schema_guidance 텍스트"| SP

  style SO fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style TCS fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style MC fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style PROV fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style SP fill:#e0e7ff,stroke:#64748b,color:#1e293b`}
          />

          <Callout type="info" icon="💡">
            <strong>비유:</strong> 외국어 통역을 떠올리세요. 영어를 잘하는 사람(HIGH)에게는
            그냥 말하면 되지만, 초급(LOW) 수준이면 번역 가이드와 예시 문장을 함께 제공해야 합니다.
            이 모듈은 모델의 &quot;언어 능력&quot;에 맞는 통역 가이드를 제공합니다.
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 2. 레퍼런스 (Reference) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>📖</span> 레퍼런스
          </h2>

          {/* StructuredOutputConfig interface */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            interface StructuredOutputConfig
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            프로바이더에 전달할 추가 설정입니다. 각 프로바이더마다 다른 필드를 포함할 수 있으므로
            인덱스 시그니처(<code className="text-cyan-600">[key: string]: unknown</code>)를 사용합니다.
          </p>
          <CodeBlock>
            <span className="kw">interface</span> <span className="type">StructuredOutputConfig</span> {"{"}
            {"\n"}{"  "}<span className="kw">readonly</span> [<span className="prop">key</span>: <span className="type">string</span>]: <span className="type">unknown</span>;
            {"\n"}{"}"}
          </CodeBlock>

          {/* buildStructuredOutputConfig */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            buildStructuredOutputConfig(provider, toolSchema, tier)
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            프로바이더와 능력 티어에 따른 구조화된 출력 설정을 생성합니다.
            HIGH 티어 모델은 네이티브 function calling을 지원하므로 <code className="text-cyan-600">null</code>을 반환합니다.
          </p>
          <CodeBlock>
            <span className="fn">buildStructuredOutputConfig</span>(
            {"\n"}{"  "}<span className="prop">provider</span>: <span className="type">string</span>,
            {"\n"}{"  "}<span className="prop">toolSchema</span>: <span className="type">Record</span>{"<"}<span className="type">string</span>, <span className="type">unknown</span>{">"},{"\n"}{"  "}<span className="prop">tier</span>: <span className="type">CapabilityTier</span>,
            {"\n"}): <span className="type">Record</span>{"<"}<span className="type">string</span>, <span className="type">unknown</span>{">"} | <span className="kw">null</span>
          </CodeBlock>
          <ParamTable
            params={[
              { name: "provider", type: "string", required: true, desc: 'LLM 프로바이더 이름 (예: "openai", "anthropic", "ollama")' },
              { name: "toolSchema", type: "Record<string, unknown>", required: true, desc: "도구의 매개변수 JSON 스키마" },
              { name: "tier", type: "CapabilityTier", required: true, desc: '모델의 능력 티어 ("high", "medium", "low")' },
            ]}
          />

          {/* 프로바이더별 반환값 */}
          <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">프로바이더별 반환값</h4>
          <div className="bg-white border border-gray-200 rounded-xl p-5 text-[13px] text-gray-600 space-y-3">
            <p><strong className="text-gray-900">OpenAI (MEDIUM):</strong> <code className="text-cyan-600">response_format.type = &quot;json_schema&quot;</code> + strict 모드 &mdash; 스키마에 정확히 일치하는 JSON만 생성</p>
            <p><strong className="text-gray-900">OpenAI (LOW):</strong> <code className="text-cyan-600">response_format.type = &quot;json_object&quot;</code> + schema_guidance 텍스트 &mdash; JSON 형식만 보장, 스키마 준수는 미보장</p>
            <p><strong className="text-gray-900">Anthropic:</strong> <code className="text-cyan-600">schema_guidance</code> 텍스트 + <code className="text-cyan-600">prefill: {'"{"tool_name":"'}</code> &mdash; 어시스턴트 턴에 JSON 시작 부분을 미리 채움</p>
            <p><strong className="text-gray-900">Ollama:</strong> <code className="text-cyan-600">format: &quot;json&quot;</code> + schema_guidance + template_wrapper &mdash; Ollama의 JSON 출력 모드 활용</p>
            <p><strong className="text-gray-900">기타:</strong> <code className="text-cyan-600">schema_guidance</code> 텍스트만 제공 &mdash; 범용 가이드</p>
          </div>

          {/* Caveats */}
          <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
          <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
            <li>
              HIGH 티어 모델에서는 항상 <code className="text-cyan-600">null</code>을 반환합니다.
              호출자는 null 체크 후 네이티브 function calling을 사용해야 합니다.
            </li>
            <li>
              프로바이더 이름은 대소문자를 구분하지 않습니다 (<code className="text-cyan-600">toLowerCase()</code> 적용).
            </li>
            <li>
              <code className="text-cyan-600">schema_guidance</code> 텍스트는 시스템 프롬프트에 주입되어
              컨텍스트 토큰을 소비합니다. LOW 티어 모델에서는 이 오버헤드를 고려해야 합니다.
            </li>
            <li>
              Anthropic의 <code className="text-cyan-600">prefill</code>은 어시스턴트 턴의 시작 부분에
              삽입되므로, 응답 파싱 시 이 접두사를 제거해야 할 수 있습니다.
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
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>기본 사용법 &mdash; 티어별 설정 생성</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            Tool Call Strategy에서 프로바이더와 모델 티어를 전달하여 적절한 설정을 받습니다.
          </p>
          <CodeBlock>
            <span className="kw">import</span> {"{"} <span className="prop">buildStructuredOutputConfig</span> {"}"} <span className="kw">from</span> <span className="str">&quot;./llm/structured-output.js&quot;</span>;
            {"\n"}
            {"\n"}<span className="kw">const</span> <span className="prop">toolSchema</span> = {"{"}
            {"\n"}{"  "}<span className="prop">type</span>: <span className="str">&quot;object&quot;</span>,
            {"\n"}{"  "}<span className="prop">properties</span>: {"{"}
            {"\n"}{"    "}<span className="prop">file_path</span>: {"{"} <span className="prop">type</span>: <span className="str">&quot;string&quot;</span> {"}"},
            {"\n"}{"  "}{"}"},{"\n"}{"}"};
            {"\n"}
            {"\n"}<span className="cm">{"// HIGH 티어 → null (네이티브 function calling 사용)"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">highConfig</span> = <span className="fn">buildStructuredOutputConfig</span>(<span className="str">&quot;openai&quot;</span>, <span className="prop">toolSchema</span>, <span className="str">&quot;high&quot;</span>);
            {"\n"}<span className="cm">{"// highConfig === null"}</span>
            {"\n"}
            {"\n"}<span className="cm">{"// MEDIUM 티어 → json_schema 설정 반환"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">medConfig</span> = <span className="fn">buildStructuredOutputConfig</span>(<span className="str">&quot;openai&quot;</span>, <span className="prop">toolSchema</span>, <span className="str">&quot;medium&quot;</span>);
            {"\n"}<span className="cm">{"// medConfig.response_format.type === \"json_schema\""}</span>
            {"\n"}
            {"\n"}<span className="cm">{"// LOW 티어 → json_object + 가이드 텍스트"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">lowConfig</span> = <span className="fn">buildStructuredOutputConfig</span>(<span className="str">&quot;openai&quot;</span>, <span className="prop">toolSchema</span>, <span className="str">&quot;low&quot;</span>);
            {"\n"}<span className="cm">{"// lowConfig.response_format.type === \"json_object\""}</span>
            {"\n"}<span className="cm">{"// lowConfig.schema_guidance → 시스템 프롬프트에 주입"}</span>
          </CodeBlock>

          <Callout type="warn" icon="!">
            <strong>주의:</strong> <code>buildStructuredOutputConfig</code>가 null을 반환하면
            추가 래퍼 없이 네이티브 function calling을 직접 사용해야 합니다.
            null 체크를 잊으면 설정이 누락될 수 있습니다.
          </Callout>

          {/* 고급 사용법: Anthropic prefill */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; Anthropic의 prefill 기법
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            Anthropic은 네이티브 JSON 모드를 제공하지 않습니다. 대신 어시스턴트 턴에
            JSON 시작 부분을 미리 채워 넣어 모델이 JSON으로 응답하도록 유도합니다.
          </p>
          <CodeBlock>
            <span className="kw">const</span> <span className="prop">config</span> = <span className="fn">buildStructuredOutputConfig</span>(<span className="str">&quot;anthropic&quot;</span>, <span className="prop">toolSchema</span>, <span className="str">&quot;medium&quot;</span>);
            {"\n"}
            {"\n"}<span className="cm">{"// config.prefill === '{\"tool_name\":\"'"}</span>
            {"\n"}<span className="cm">{"// → 어시스턴트 메시지의 시작 부분에 삽입"}</span>
            {"\n"}<span className="cm">{"// → 모델이 이어서 JSON을 완성하도록 유도"}</span>
            {"\n"}
            {"\n"}<span className="cm">{"// config.schema_guidance → 시스템 프롬프트에 스키마 설명 추가"}</span>
          </CodeBlock>

          <Callout type="tip" icon="*">
            <strong>팁:</strong> Anthropic의 prefill은 모든 티어(MEDIUM/LOW)에서 동일하게 적용됩니다.
            Anthropic 모델은 프롬프트 엔지니어링으로 충분히 정확한 JSON을 생성할 수 있기 때문입니다.
          </Callout>

          <DeepDive title="도구 호출 래퍼(envelope) 구조">
            <p className="mb-3">
              모델이 생성해야 하는 JSON의 최상위 구조입니다. 도구의 매개변수 스키마를
              표준 봉투(envelope) 형식으로 감쌉니다:
            </p>
            <CodeBlock>
              {"{"}
              {"\n"}{"  "}<span className="str">&quot;tool_name&quot;</span>: <span className="str">&quot;파일_읽기&quot;</span>,
              {"\n"}{"  "}<span className="str">&quot;tool_input&quot;</span>: {"{"}
              {"\n"}{"    "}<span className="str">&quot;file_path&quot;</span>: <span className="str">&quot;/path/to/file&quot;</span>
              {"\n"}{"  "}{"}"}{"\n"}{"}"}
            </CodeBlock>
            <p className="mt-3 text-gray-600">
              <code className="text-cyan-600">additionalProperties: false</code>가 설정되어
              스키마에 정의되지 않은 추가 필드를 금지합니다.
              이를 통해 모델이 예상치 못한 필드를 생성하는 것을 방지합니다.
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

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>프로바이더 + 티어 분기 흐름</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">buildStructuredOutputConfig</code>는 먼저 티어를 확인하고,
            그 다음 프로바이더별 전용 빌더 함수로 분기합니다.
          </p>

          <MermaidDiagram
            title="프로바이더 + 티어 분기 흐름"
            titleColor="purple"
            chart={`graph TD
  IN["buildStructuredOutputConfig<br/><small>provider + toolSchema + tier</small>"]
  HIGH{"tier === high?"}
  NULL["return null<br/><small>네이티브 function calling</small>"]
  PROV{"provider 확인"}
  OAI["buildOpenAIStructuredOutput<br/><small>response_format 설정</small>"]
  ANT["buildAnthropicStructuredOutput<br/><small>prefill + guidance</small>"]
  OLL["buildOllamaStructuredOutput<br/><small>format: json</small>"]
  GEN["buildGenericStructuredOutput<br/><small>schema_guidance만</small>"]

  IN --> HIGH
  HIGH -->|"Yes"| NULL
  HIGH -->|"No"| PROV
  PROV -->|"openai"| OAI
  PROV -->|"anthropic"| ANT
  PROV -->|"ollama / local"| OLL
  PROV -->|"기타"| GEN

  style IN fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style HIGH fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style NULL fill:#dcfce7,stroke:#10b981,color:#065f46
  style PROV fill:#fef3c7,stroke:#f59e0b,color:#1e293b
  style OAI fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style ANT fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style OLL fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style GEN fill:#e0e7ff,stroke:#64748b,color:#1e293b`}
          />

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>핵심 코드 분석</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            OpenAI MEDIUM 티어의 strict JSON 스키마 설정 생성 로직입니다.
          </p>
          <CodeBlock>
            <span className="kw">if</span> (<span className="prop">tier</span> === <span className="str">&quot;medium&quot;</span>) {"{"}
            {"\n"}{"  "}<span className="cm">{"// [1] strict: true — 스키마에 정확히 일치하는 JSON만 생성"}</span>
            {"\n"}{"  "}<span className="kw">return</span> {"{"}
            {"\n"}{"    "}<span className="prop">response_format</span>: {"{"}
            {"\n"}{"      "}<span className="prop">type</span>: <span className="str">&quot;json_schema&quot;</span>,
            {"\n"}{"      "}<span className="prop">json_schema</span>: {"{"}
            {"\n"}{"        "}<span className="prop">name</span>: <span className="str">&quot;tool_call&quot;</span>,
            {"\n"}{"        "}<span className="prop">strict</span>: <span className="kw">true</span>,
            {"\n"}{"        "}<span className="cm">{"// [2] toolSchema를 표준 래퍼로 감싸기"}</span>
            {"\n"}{"        "}<span className="prop">schema</span>: <span className="fn">buildToolCallWrapper</span>(<span className="prop">toolSchema</span>),
            {"\n"}{"      "}{"}"},{"\n"}{"    "}{"}"},{"\n"}{"  "}{"}"};
            {"\n"}{"}"}
          </CodeBlock>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
            <p><strong className="text-gray-900">[1]</strong> <code className="text-cyan-600">strict: true</code>는 OpenAI의 Structured Outputs 기능으로, 모델이 스키마에 정확히 일치하는 JSON만 생성하도록 강제합니다.</p>
            <p><strong className="text-gray-900">[2]</strong> <code className="text-cyan-600">buildToolCallWrapper</code>는 도구의 매개변수 스키마를 <code className="text-cyan-600">tool_name</code> + <code className="text-cyan-600">tool_input</code> 봉투(envelope)로 감쌉니다.</p>
          </div>

          <DeepDive title="schema_guidance 텍스트 생성 상세">
            <p className="mb-3">
              LOW 티어 모델을 위해 시스템 프롬프트에 주입되는 자연어 가이드 텍스트입니다.
              다음 요소를 포함합니다:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-gray-600">
              <li>전체 도구 호출 래퍼 JSON 스키마 (코드 블록)</li>
              <li>도구 매개변수 스키마 상세 (코드 블록)</li>
              <li>&quot;Do not include any text outside the JSON object&quot; 지시</li>
            </ul>
            <p className="mt-3 text-amber-600">
              이 가이드 텍스트는 시스템 프롬프트에 추가되므로 컨텍스트 토큰을 소비합니다.
              스키마가 복잡할수록 더 많은 토큰을 사용하므로, LOW 티어에서 도구 수를
              줄이는 것이 토큰 효율성에 도움이 됩니다.
            </p>
          </DeepDive>
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
              &quot;LOW 티어 모델이 유효하지 않은 JSON을 반환해요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              LOW 티어 모델은 JSON 형식만 보장되고 스키마 준수는 보장되지 않습니다.
            </p>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                <code className="text-cyan-600">schema_guidance</code> 텍스트가 시스템 프롬프트에
                실제로 주입되었는지 확인하세요.
              </li>
              <li>
                도구 스키마가 너무 복잡하면 단순화하거나 MEDIUM/HIGH 티어 모델로 전환하세요.
              </li>
            </ul>
          </div>

          {/* FAQ 2 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;buildStructuredOutputConfig가 null을 반환하는데 도구 호출이 안 돼요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              null은 &quot;추가 설정 불필요&quot;를 의미합니다. HIGH 티어 모델에서는
              네이티브 function calling을 사용해야 합니다. Tool Call Strategy가
              네이티브 모드로 올바르게 설정되었는지 확인하세요.
            </p>
          </div>

          {/* FAQ 3 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;Anthropic 모델의 응답 앞에 이상한 JSON 조각이 붙어요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">prefill</code> 값(<code className="text-cyan-600">{'"{"tool_name":"'}</code>)이
              어시스턴트 메시지의 시작 부분에 삽입된 것입니다. 응답 파서에서 이 접두사를 적절히 처리해야 합니다.
              이는 Anthropic 모델이 JSON 형식으로 응답하도록 유도하는 표준 기법입니다.
            </p>
          </div>

          {/* FAQ 4 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;새 프로바이더를 추가하고 싶은데 어떻게 하나요?&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">buildStructuredOutputConfig</code> 함수에
              새 프로바이더를 위한 <code className="text-cyan-600">if</code> 분기를 추가하고,
              해당 프로바이더의 JSON 출력 설정을 반환하는 빌더 함수를 구현하세요.
              알 수 없는 프로바이더는 자동으로 <code className="text-cyan-600">buildGenericStructuredOutput</code>으로
              폴백(fallback)됩니다.
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
                name: "model-capabilities.ts",
                slug: "model-capabilities",
                relation: "sibling",
                desc: "CapabilityTier를 결정하는 모듈 — HIGH/MEDIUM/LOW 모델 분류를 제공합니다",
              },
              {
                name: "llm-client.ts",
                slug: "llm-client",
                relation: "parent",
                desc: "LLM Client가 구조화 출력 설정을 프로바이더 API 호출에 적용합니다",
              },
              {
                name: "tool-registry.ts",
                slug: "tool-registry",
                relation: "sibling",
                desc: "도구의 JSON 스키마를 제공하는 레지스트리 — toolSchema의 출처입니다",
              },
              {
                name: "system-prompt-builder.ts",
                slug: "system-prompt-builder",
                relation: "sibling",
                desc: "schema_guidance 텍스트를 시스템 프롬프트에 주입하는 모듈입니다",
              },
            ]}
          />
        </section>
      </RevealOnScroll>
    </div></div>
  );
}

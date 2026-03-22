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

export default function AdaptiveSchemaPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/tools/adaptive-schema.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">Adaptive Schema</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="infra" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              모델 능력별 도구 스키마 축소 — LLM 성능 등급(CapabilityTier)에 따라 도구 스키마를
              최적화합니다.
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
                <code className="text-cyan-600">adaptToolSchema</code>는 LLM 모델의 성능 등급에 따라
                도구 스키마를 3단계로 적응시키는 모듈입니다. 고성능 모델에는 전체 스키마를 제공하고,
                저성능 모델에는 핵심 정보만 제공하여 정확도와 비용을 동시에 최적화합니다.
              </p>
              <p>
                LLM 모델마다 이해력과 토큰 처리 비용이 다릅니다. 선택적 매개변수가 많으면 저성능
                모델이 잘못된 값을 전달할 가능성이 높아지고, 토큰 비용도 증가합니다. 이 모듈은
                등급별로 스키마를 축소하여 이런 문제를 해결합니다.
              </p>
              <p>
                3단계 전략: <code className="text-emerald-600">HIGH</code>(전체 스키마),
                <code className="text-amber-600">MEDIUM</code>(핵심 매개변수 + 2문장 설명),
                <code className="text-red-600">LOW</code>(필수 매개변수만 + 1문장 + few-shot 예시).
              </p>
            </div>

            <MermaidDiagram
              title="Adaptive Schema 아키텍처 위치"
              titleColor="purple"
              chart={`graph TD
  TE["Tool Executor<br/><small>tools/executor.ts</small>"]
  AS["Adaptive Schema<br/><small>tools/adaptive-schema.ts</small>"]
  MC["Model Capabilities<br/><small>llm/model-capabilities.ts</small>"]
  LLM["LLM Client<br/><small>llm/client.ts</small>"]
  TR["Tool Registry<br/><small>tools/tool-registry.ts</small>"]

  TR -->|"도구 정의 제공"| AS
  MC -->|"CapabilityTier 제공"| AS
  AS -->|"축소된 스키마"| LLM
  TE --> TR
  TE --> AS

  style AS fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style MC fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style TR fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style LLM fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style TE fill:#e0e7ff,stroke:#64748b,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> 레스토랑 메뉴판을 떠올리세요. 미식가(HIGH)에게는 전체 메뉴를
              보여주고, 일반 고객(MEDIUM)에게는 인기 메뉴 위주로 보여주며, 처음 방문한
              고객(LOW)에게는 대표 메뉴 몇 개와 주문 예시를 보여주는 것과 같습니다.
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

            {/* AdaptedToolInfo interface */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface AdaptedToolInfo
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              성능 등급에 맞게 적응된 도구 정보입니다.{" "}
              <code className="text-cyan-600">adaptToolSchema</code> 함수의 반환 타입입니다.
            </p>
            <ParamTable
              params={[
                { name: "name", type: "string", required: true, desc: "도구 이름" },
                {
                  name: "description",
                  type: "string",
                  required: true,
                  desc: "성능 등급에 맞게 축소된 설명",
                },
                {
                  name: "parameters",
                  type: "Record<string, unknown>",
                  required: true,
                  desc: "성능 등급에 맞게 필터링된 매개변수 JSON Schema",
                },
                {
                  name: "examples",
                  type: "readonly string[]",
                  required: false,
                  desc: "사용 예시 목록 (LOW 등급에서만 제공) — few-shot 프롬프팅에 사용",
                },
              ]}
            />

            {/* adaptToolSchema function */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              adaptToolSchema()
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              모델 성능 등급에 따라 도구 스키마를 적응시키는 핵심 함수입니다. 등급별로 설명 길이,
              매개변수 범위, 예시 포함 여부가 달라집니다.
            </p>
            <CodeBlock>
              <span className="kw">function</span> <span className="fn">adaptToolSchema</span>(
              {"\n"}
              {"  "}
              <span className="prop">name</span>: <span className="type">string</span>,{"\n"}
              {"  "}
              <span className="prop">description</span>: <span className="type">string</span>,{"\n"}
              {"  "}
              <span className="prop">parameters</span>: <span className="type">Record</span>
              {"<"}
              <span className="type">string</span>, <span className="type">unknown</span>
              {">"}
              {","}
              {"\n"}
              {"  "}
              <span className="prop">tier</span>: <span className="type">CapabilityTier</span>,
              {"\n"}
              {"  "}
              <span className="prop">_workingDirectory</span>: <span className="type">string</span>,
              {"\n"}): <span className="type">AdaptedToolInfo</span>
            </CodeBlock>
            <ParamTable
              params={[
                { name: "name", type: "string", required: true, desc: "도구 이름" },
                { name: "description", type: "string", required: true, desc: "원본 도구 설명" },
                {
                  name: "parameters",
                  type: "Record<string, unknown>",
                  required: true,
                  desc: "원본 JSON Schema 매개변수 객체",
                },
                {
                  name: "tier",
                  type: "CapabilityTier",
                  required: true,
                  desc: '모델 성능 등급 ("high" | "medium" | "low")',
                },
                {
                  name: "_workingDirectory",
                  type: "string",
                  required: true,
                  desc: "작업 디렉토리 (향후 경로 기반 예시 생성에 사용 예정)",
                },
              ]}
            />

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                <code className="text-cyan-600">HIGH</code> 등급은 원본 스키마를 그대로 반환합니다.
                어떤 변환도 적용되지 않습니다.
              </li>
              <li>
                <code className="text-cyan-600">MEDIUM</code> 등급에서는 기본값(
                <code className="text-cyan-600">default</code>)이 있는 선택적 매개변수가 제거됩니다.
                기본값이 없는 선택적 매개변수는 중요할 수 있으므로 유지됩니다.
              </li>
              <li>
                <code className="text-cyan-600">LOW</code> 등급에서는{" "}
                <code className="text-cyan-600">required</code> 배열에 포함된 매개변수만 남습니다.{" "}
                <code className="text-cyan-600">required</code>가 비어 있으면 원본을 그대로
                반환합니다.
              </li>
              <li>
                Few-shot 예시(<code className="text-cyan-600">TOOL_EXAMPLES</code>)는 6개 핵심
                도구에만 정의되어 있습니다:
                <code className="text-cyan-600">file_read</code>,{" "}
                <code className="text-cyan-600">file_write</code>,
                <code className="text-cyan-600">file_edit</code>,{" "}
                <code className="text-cyan-600">bash_exec</code>,
                <code className="text-cyan-600">grep_search</code>,{" "}
                <code className="text-cyan-600">glob_search</code>.
              </li>
              <li>
                문장 구분은 마침표(<code className="text-cyan-600">.</code>) 뒤에 공백 또는 줄바꿈이
                오는 경우에만 인식됩니다. URL이나 소수점 등은 문장 끝으로 인식되지 않습니다.
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
              기본 사용법 &mdash; 등급별 스키마 적응
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              모델의 <code className="text-cyan-600">CapabilityTier</code>를 확인한 후, 각 도구
              스키마를 해당 등급에 맞게 적응시킵니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 1. 모델의 성능 등급 확인"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">tier</span> ={" "}
              <span className="fn">getCapabilityTier</span>(<span className="prop">modelId</span>);
              {"\n"}
              {"\n"}
              <span className="cm">{"// 2. 각 도구의 스키마를 등급에 맞게 적응"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">adapted</span> ={" "}
              <span className="fn">adaptToolSchema</span>({"\n"}
              {"  "}
              <span className="str">&quot;file_read&quot;</span>,{"\n"}
              {"  "}
              <span className="prop">tool</span>.<span className="prop">description</span>,{"\n"}
              {"  "}
              <span className="prop">tool</span>.<span className="prop">parameters</span>,{"\n"}
              {"  "}
              <span className="prop">tier</span>,{"\n"}
              {"  "}
              <span className="prop">workingDirectory</span>,{"\n"});
              {"\n"}
              {"\n"}
              <span className="cm">{"// 3. 적응된 스키마를 LLM에 전달"}</span>
              {"\n"}
              <span className="fn">sendToLLM</span>({"{"} <span className="prop">tools</span>: [
              <span className="prop">adapted</span>] {"}"});
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> <code>adaptToolSchema</code>는 원본 스키마를 수정하지 않고 새
              객체를 반환합니다. 원본 도구 정의를 보존하면서 등급별로 다른 스키마를 생성할 수
              있습니다.
            </Callout>

            {/* 고급 사용법: 등급별 결과 비교 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; 등급별 결과 비교
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              같은 도구에 대해 등급별로 어떻게 스키마가 달라지는지 보여줍니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// HIGH: 전체 스키마 그대로"}</span>
              {"\n"}
              <span className="cm">{"// → description: 원본 전체, parameters: 모든 매개변수"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">high</span> ={" "}
              <span className="fn">adaptToolSchema</span>(
              <span className="str">&quot;file_read&quot;</span>, <span className="prop">desc</span>
              , <span className="prop">params</span>, <span className="str">&quot;high&quot;</span>,{" "}
              <span className="prop">cwd</span>);
              {"\n"}
              {"\n"}
              <span className="cm">{"// MEDIUM: 핵심 매개변수 + 2문장 설명"}</span>
              {"\n"}
              <span className="cm">{"// → 기본값 있는 선택적 매개변수 제거"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">med</span> ={" "}
              <span className="fn">adaptToolSchema</span>(
              <span className="str">&quot;file_read&quot;</span>, <span className="prop">desc</span>
              , <span className="prop">params</span>,{" "}
              <span className="str">&quot;medium&quot;</span>, <span className="prop">cwd</span>);
              {"\n"}
              {"\n"}
              <span className="cm">{"// LOW: 필수 매개변수만 + 1문장 + few-shot 예시"}</span>
              {"\n"}
              <span className="cm">{"// → examples 필드가 추가됨"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">low</span> ={" "}
              <span className="fn">adaptToolSchema</span>(
              <span className="str">&quot;file_read&quot;</span>, <span className="prop">desc</span>
              , <span className="prop">params</span>, <span className="str">&quot;low&quot;</span>,{" "}
              <span className="prop">cwd</span>);
              {"\n"}
              <span className="fn">console</span>.<span className="fn">log</span>(
              <span className="prop">low</span>.<span className="prop">examples</span>);
              {"\n"}
              <span className="cm">
                {'// → [\'file_read({"file_path": "/absolute/path/to/file.ts"})\']'}
              </span>
            </CodeBlock>

            <Callout type="tip" icon="*">
              <strong>팁:</strong> LOW 등급의 few-shot 예시는 <code>TOOL_EXAMPLES</code> 상수에
              정의된 도구에만 제공됩니다. 커스텀 도구에는 예시가 포함되지 않습니다.
            </Callout>

            <DeepDive title="truncateToSentences 동작 상세">
              <p className="mb-3">
                설명 텍스트를 N문장으로 자르는 내부 함수입니다. 문장 구분자는 마침표(
                <code className="text-cyan-600">.</code>) 뒤에 공백이나 줄바꿈이 오는 경우입니다.
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-gray-600">
                <li>
                  <code>&quot;First sentence. Second sentence. Third.&quot;</code> → 2문장 →{" "}
                  <code>&quot;First sentence. Second sentence.&quot;</code>
                </li>
                <li>
                  URL 속 마침표(예: <code>&quot;api.example.com&quot;</code>)는 뒤에 공백이 없으므로
                  문장 끝으로 인식되지 않습니다.
                </li>
                <li>N개 미만의 문장만 있으면 원본 텍스트를 그대로 반환합니다.</li>
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
              등급별 스키마 축소 흐름
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">adaptToolSchema</code>는{" "}
              <code className="text-cyan-600">tier</code>에 따라 서로 다른 필터 함수를 조합하여
              스키마를 축소합니다.
            </p>

            <MermaidDiagram
              title="등급별 스키마 축소 전략"
              titleColor="purple"
              chart={`graph TD
  INPUT["원본 스키마<br/><small>name + description + parameters</small>"]

  INPUT -->|"tier = high"| HIGH["그대로 반환<br/><small>전체 스키마 + 완전한 설명</small>"]
  INPUT -->|"tier = medium"| MED_DESC["truncateToSentences(2)<br/><small>설명 2문장 축소</small>"]
  INPUT -->|"tier = low"| LOW_DESC["truncateToSentences(1)<br/><small>설명 1문장 축소</small>"]

  MED_DESC --> MED_PARAM["filterToCoreParams()<br/><small>기본값 있는 선택 매개변수 제거</small>"]
  MED_PARAM --> MED_OUT["AdaptedToolInfo<br/><small>핵심 스키마</small>"]

  LOW_DESC --> LOW_PARAM["filterToRequiredOnly()<br/><small>필수 매개변수만 남김</small>"]
  LOW_PARAM --> LOW_EX["TOOL_EXAMPLES 추가<br/><small>few-shot 프롬프팅</small>"]
  LOW_EX --> LOW_OUT["AdaptedToolInfo<br/><small>최소 스키마 + 예시</small>"]

  style INPUT fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style HIGH fill:#dcfce7,stroke:#10b981,color:#065f46,stroke-width:2px
  style MED_DESC fill:#fef3c7,stroke:#f59e0b,color:#78350f
  style MED_PARAM fill:#fef3c7,stroke:#f59e0b,color:#78350f
  style MED_OUT fill:#fef3c7,stroke:#f59e0b,color:#78350f,stroke-width:2px
  style LOW_DESC fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style LOW_PARAM fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style LOW_EX fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style LOW_OUT fill:#fee2e2,stroke:#ef4444,color:#991b1b,stroke-width:2px`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              핵심 코드 분석
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">filterToCoreParams</code>와
              <code className="text-cyan-600">filterToRequiredOnly</code>는 JSON Schema의{" "}
              <code className="text-cyan-600">properties</code>를 필터링하여 등급에 맞는 매개변수만
              남깁니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// filterToCoreParams — MEDIUM 등급"}</span>
              {"\n"}
              <span className="cm">{"// 기본값(default)이 있는 비필수 매개변수를 제거"}</span>
              {"\n"}
              <span className="kw">for</span> (<span className="kw">const</span> [
              <span className="prop">key</span>, <span className="prop">value</span>]{" "}
              <span className="kw">of</span> <span className="fn">Object</span>.
              <span className="fn">entries</span>(<span className="prop">properties</span>)) {"{"}
              {"\n"}
              {"  "}
              <span className="kw">if</span> (<span className="prop">requiredSet</span>.
              <span className="fn">has</span>(<span className="prop">key</span>)) {"{"}
              {"\n"}
              {"    "}
              <span className="cm">{"// [1] 필수 매개변수 → 항상 포함"}</span>
              {"\n"}
              {"    "}
              <span className="prop">filtered</span>[<span className="prop">key</span>] ={" "}
              <span className="prop">value</span>;{"\n"}
              {"  "}
              <span className="kw">{"}"}</span> <span className="kw">else if</span> (
              <span className="prop">value</span> && !(
              <span className="str">&quot;default&quot;</span> <span className="kw">in</span>{" "}
              <span className="prop">value</span>)) {"{"}
              {"\n"}
              {"    "}
              <span className="cm">{"// [2] 비필수 + 기본값 없음 → 포함 (중요할 수 있음)"}</span>
              {"\n"}
              {"    "}
              <span className="prop">filtered</span>[<span className="prop">key</span>] ={" "}
              <span className="prop">value</span>;{"\n"}
              {"  "}
              {"}"}
              {"\n"}
              {"  "}
              <span className="cm">{"// [3] 비필수 + 기본값 있음 → 제거 (LLM이 생략해도 OK)"}</span>
              {"\n"}
              {"}"}
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">[1]</strong>{" "}
                <code className="text-cyan-600">required</code> 배열에 포함된 매개변수는 어떤
                등급에서든 항상 유지됩니다.
              </p>
              <p>
                <strong className="text-gray-900">[2]</strong> 기본값이 없는 선택적 매개변수는
                의도적으로 값을 지정해야 할 수 있으므로 MEDIUM에서 유지합니다.
              </p>
              <p>
                <strong className="text-gray-900">[3]</strong> 기본값이 있는 선택적 매개변수는 LLM이
                생략하더라도 기본값이 자동 적용되므로 안전하게 제거할 수 있습니다.
              </p>
            </div>

            <DeepDive title="TOOL_EXAMPLES — few-shot 프롬프팅 상수">
              <p className="mb-3">
                LOW 등급에서만 사용되는 도구별 사용 예시입니다. 저성능 모델은 예시가 있을 때 올바른
                호출 형식을 훨씬 잘 따릅니다.
              </p>
              <CodeBlock>
                <span className="kw">const</span> <span className="prop">TOOL_EXAMPLES</span> ={" "}
                {"{"}
                {"\n"}
                {"  "}
                <span className="prop">file_read</span>: [{"\n"}
                {"    "}
                <span className="str">{`'file_read({"file_path": "/absolute/path/to/file.ts"})'`}</span>
                ,{"\n"}
                {"    "}
                <span className="str">{`'file_read({"file_path": "...", "offset": 10, "limit": 50})'`}</span>
                ,{"\n"}
                {"  "}],
                {"\n"}
                {"  "}
                <span className="prop">bash_exec</span>: [{"\n"}
                {"    "}
                <span className="str">{`'bash_exec({"command": "npm test"})'`}</span>,{"\n"}
                {"  "}],
                {"\n"}
                {"  "}
                <span className="cm">
                  {"// ... file_write, file_edit, grep_search, glob_search"}
                </span>
                {"\n"}
                {"}"};
              </CodeBlock>
              <p className="mt-3 text-gray-600">
                예시가 정의되지 않은 도구는 <code className="text-cyan-600">examples</code> 필드가
                반환 객체에 포함되지 않습니다 (spread 조건부 할당).
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
                &quot;저성능 모델이 선택적 매개변수를 전달하지 못해요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                LOW 등급에서는 <code className="text-cyan-600">required</code> 매개변수만 스키마에
                포함됩니다. 특정 선택적 매개변수가 반드시 필요하다면, 해당 도구 정의에서 그
                매개변수를
                <code className="text-cyan-600">required</code> 배열에 추가하세요.
              </p>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;설명이 중간에 잘려서 의미가 불명확해요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                <code className="text-cyan-600">truncateToSentences</code>는 마침표 기준으로 문장을
                자릅니다. 도구 설명의 첫 문장(MEDIUM) 또는 첫 문장(LOW)에 핵심 정보가 담기도록
                설명을 작성하는 것이 중요합니다.
              </p>
              <Callout type="tip" icon="*">
                도구 설명의 첫 문장은 &quot;이 도구는 무엇을 하는가&quot;를 명확히 담으세요. 세부
                사항은 두 번째 문장 이후에 적으면 됩니다.
              </Callout>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;커스텀 도구에 few-shot 예시를 추가하고 싶어요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">TOOL_EXAMPLES</code> 상수에 도구 이름을 키로, 예시
                문자열 배열을 값으로 추가하세요. LOW 등급에서 자동으로 반환 객체의
                <code className="text-cyan-600">examples</code> 필드에 포함됩니다.
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
                  name: "model-capabilities.ts",
                  slug: "model-capabilities",
                  relation: "parent",
                  desc: "CapabilityTier를 결정하는 모델 성능 등급 시스템",
                },
                {
                  name: "tool-call-corrector.ts",
                  slug: "tool-call-corrector",
                  relation: "sibling",
                  desc: "저성능 모델의 도구 호출 인수를 자동 교정하는 모듈",
                },
                {
                  name: "lazy-tool-loader.ts",
                  slug: "lazy-tool-loader",
                  relation: "sibling",
                  desc: "등급별 도구 스키마 지연 로딩 — 토큰 비용 추가 절약",
                },
                {
                  name: "tool-registry.ts",
                  slug: "tool-registry",
                  relation: "sibling",
                  desc: "도구 정의를 관리하는 레지스트리 — 원본 스키마 제공자",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}

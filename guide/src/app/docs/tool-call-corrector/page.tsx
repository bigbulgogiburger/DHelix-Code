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

export default function ToolCallCorrectorPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}><div className="center-narrow">
      {/* ─── Header ─── */}
      <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <FilePath path="src/tools/tool-call-corrector.ts" />
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
            <span className="text-gray-900">
              Tool Call Corrector
            </span>
          </h1>
          <div className="flex items-center gap-3 mb-5">
            <LayerBadge layer="infra" />
          </div>
          <p className="text-[16px] text-gray-600 leading-relaxed">
            저성능 모델 인자 자동 교정 — LLM이 도구를 호출할 때 흔히 발생하는 인수 오류를 자동으로 교정합니다.
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
              <code className="text-cyan-600">correctToolCall</code>은 LLM 모델이 도구를 호출할 때
              발생하는 흔한 인수 오류를 자동으로 감지하고 교정하는 모듈입니다.
              교정은 도구 실행 전에 인수 전처리 단계에서 이루어집니다.
            </p>
            <p>
              주요 교정 대상은 세 가지입니다: Git Bash 경로를 Windows 경로로 변환,
              상대 경로를 절대 경로로 변환, 그리고 문자열로 잘못 전달된 boolean/number 값의 타입 교정.
              이 중 Git Bash 경로 변환은 모든 성능 등급에 적용되고,
              나머지 교정은 저성능(low/medium) 모델에만 적용됩니다.
            </p>
            <p>
              고성능 모델은 스키마를 정확히 따르므로 추가 교정이 불필요하지만,
              저성능 모델은 상대 경로를 사용하거나 <code className="text-cyan-600">&quot;true&quot;</code>를
              문자열로 보내는 실수를 자주 합니다.
            </p>
          </div>

          <MermaidDiagram
            title="Tool Call Corrector 아키텍처 위치"
            titleColor="purple"
            chart={`graph TD
  AL["Agent Loop<br/><small>agent-loop.ts</small>"]
  TE["Tool Executor<br/><small>tools/executor.ts</small>"]
  TCC["Tool Call Corrector<br/><small>tools/tool-call-corrector.ts</small>"]
  MC["Model Capabilities<br/><small>llm/model-capabilities.ts</small>"]
  TOOLS["Built-in Tools<br/><small>도구 실행</small>"]

  AL -->|"도구 호출 요청"| TE
  TE -->|"인수 전처리"| TCC
  MC -->|"CapabilityTier 제공"| TCC
  TCC -->|"교정된 인수"| TE
  TE -->|"교정된 인수로 실행"| TOOLS

  style TCC fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style AL fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style TE fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style MC fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style TOOLS fill:#e0e7ff,stroke:#64748b,color:#1e293b`}
          />

          <Callout type="info" icon="💡">
            <strong>비유:</strong> 우체부가 편지를 배달하기 전에 주소를 확인하는 과정을 떠올리세요.
            &quot;옆집&quot;이라고 쓰인 주소를 정확한 도로명 주소로 바꾸고,
            &quot;O&quot;(영문 O)로 쓰인 우편번호를 &quot;0&quot;(숫자)으로 교정하는 것과 같습니다.
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 2. 레퍼런스 (Reference) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>📖</span> 레퍼런스
          </h2>

          {/* correctToolCall function */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            correctToolCall()
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            도구 호출 인수를 자동 교정하는 핵심 함수입니다.
            원본을 수정하지 않고 새 객체를 반환합니다.
          </p>
          <CodeBlock>
            <span className="kw">function</span> <span className="fn">correctToolCall</span>(
            {"\n"}{"  "}<span className="prop">args</span>: <span className="type">Record</span>{"<"}<span className="type">string</span>, <span className="type">unknown</span>{">"}{","}
            {"\n"}{"  "}<span className="prop">workingDirectory</span>: <span className="type">string</span>,
            {"\n"}{"  "}<span className="prop">tier</span>: <span className="type">CapabilityTier</span>,
            {"\n"}): <span className="type">Record</span>{"<"}<span className="type">string</span>, <span className="type">unknown</span>{">"}
          </CodeBlock>
          <ParamTable
            params={[
              { name: "args", type: "Record<string, unknown>", required: true, desc: "LLM이 전달한 원시 인수 객체" },
              { name: "workingDirectory", type: "string", required: true, desc: "상대 경로 해석의 기준이 되는 작업 디렉토리" },
              { name: "tier", type: "CapabilityTier", required: true, desc: '모델 성능 등급 ("high" | "medium" | "low")' },
            ]}
          />

          {/* isPathKey helper */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            isPathKey() &mdash; 내부 함수
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            매개변수 키가 파일 경로를 나타내는지 판별합니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 경로로 인식되는 키 목록"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">pathKeys</span> = [<span className="str">&quot;file_path&quot;</span>, <span className="str">&quot;path&quot;</span>, <span className="str">&quot;directory&quot;</span>,
            {"\n"}{"  "}<span className="str">&quot;dir&quot;</span>, <span className="str">&quot;filepath&quot;</span>, <span className="str">&quot;filename&quot;</span>];
          </CodeBlock>

          {/* isNumericKey helper */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            isNumericKey() &mdash; 내부 함수
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            매개변수 키가 숫자 값을 기대하는지 판별합니다.
            숫자 관련 키에만 문자열 &rarr; 숫자 변환을 적용하여 잘못된 변환을 방지합니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 숫자로 인식되는 키 목록"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">numKeys</span> = [<span className="str">&quot;limit&quot;</span>, <span className="str">&quot;offset&quot;</span>, <span className="str">&quot;timeout&quot;</span>,
            {"\n"}{"  "}<span className="str">&quot;line&quot;</span>, <span className="str">&quot;count&quot;</span>, <span className="str">&quot;depth&quot;</span>];
          </CodeBlock>

          {/* Caveats */}
          <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
          <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
            <li>
              <code className="text-cyan-600">HIGH</code> 등급에서는 Git Bash 경로 변환만 적용되고,
              상대 경로/타입 교정은 적용되지 않습니다.
            </li>
            <li>
              경로 키 판별(<code className="text-cyan-600">isPathKey</code>)은 대소문자를 무시합니다.
              <code className="text-cyan-600">&quot;File_Path&quot;</code>도 경로 키로 인식됩니다.
            </li>
            <li>
              숫자 변환은 <code className="text-cyan-600">isNumericKey</code>에 정의된 키에만 적용됩니다.
              <code className="text-cyan-600">&quot;123&quot;</code>이라는 문자열이 <code className="text-cyan-600">content</code> 키에
              있으면 변환되지 않습니다.
            </li>
            <li>
              Git Bash 경로 변환은 Windows 환경(<code className="text-cyan-600">isWindows()</code>)에서만
              실행됩니다. macOS/Linux에서는 건너뜁니다.
            </li>
            <li>
              원본 인수 객체는 변경되지 않습니다. 항상 얕은 복사(spread copy)로 새 객체를 생성합니다.
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
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>기본 사용법 &mdash; 도구 실행 전 인수 교정</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            도구 실행기(Tool Executor)에서 도구를 실행하기 전에 인수를 교정합니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// LLM이 반환한 원시 인수"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">rawArgs</span> = {"{"} <span className="prop">file_path</span>: <span className="str">&quot;src/index.ts&quot;</span>, <span className="prop">offset</span>: <span className="str">&quot;10&quot;</span> {"}"};
            {"\n"}
            {"\n"}<span className="cm">{"// 교정 적용"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">corrected</span> = <span className="fn">correctToolCall</span>(
            {"\n"}{"  "}<span className="prop">rawArgs</span>,
            {"\n"}{"  "}<span className="str">&quot;/home/user/project&quot;</span>,
            {"\n"}{"  "}<span className="str">&quot;low&quot;</span>,
            {"\n"});
            {"\n"}
            {"\n"}<span className="cm">{"// 교정 결과:"}</span>
            {"\n"}<span className="cm">{"// { file_path: \"/home/user/project/src/index.ts\", offset: 10 }"}</span>
            {"\n"}<span className="cm">{"// → 상대 경로 → 절대 경로, 문자열 \"10\" → 숫자 10"}</span>
          </CodeBlock>

          <Callout type="warn" icon="!">
            <strong>주의:</strong> <code>correctToolCall</code>은 도구 실행 <strong>전에</strong> 호출해야 합니다.
            실행 후에 호출하면 이미 잘못된 인수로 도구가 실행된 뒤이므로 교정 효과가 없습니다.
          </Callout>

          {/* 고급 사용법: Git Bash 경로 교정 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; Git Bash 경로 교정 (Windows)
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            Windows의 Git Bash 환경에서 LLM이 <code className="text-cyan-600">/c/Users/...</code> 형식의
            경로를 반환하는 경우, 자동으로 <code className="text-cyan-600">C:\Users\...</code>로 변환합니다.
            이 교정은 모든 성능 등급에서 적용됩니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// Windows Git Bash 경로 → Windows 네이티브 경로"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">args</span> = {"{"} <span className="prop">file_path</span>: <span className="str">&quot;/c/Users/DBInc/project/src/index.ts&quot;</span> {"}"};
            {"\n"}<span className="kw">const</span> <span className="prop">corrected</span> = <span className="fn">correctToolCall</span>(<span className="prop">args</span>, <span className="prop">cwd</span>, <span className="str">&quot;high&quot;</span>);
            {"\n"}<span className="cm">{"// → { file_path: \"C:\\\\Users\\\\DBInc\\\\project\\\\src\\\\index.ts\" }"}</span>
          </CodeBlock>

          <Callout type="tip" icon="*">
            <strong>팁:</strong> Git Bash 경로 교정은 <code>isGitBashPath()</code>로 판별합니다.
            <code>/c/</code>, <code>/d/</code> 등 드라이브 문자로 시작하는 경로만 변환 대상입니다.
          </Callout>

          <DeepDive title="타입 강제 변환(Type Coercion) 상세">
            <p className="mb-3">
              저성능 모델이 JSON 스키마의 타입을 무시하고 모든 값을 문자열로 보내는 경우가 있습니다.
              이 모듈은 다음 규칙으로 타입을 교정합니다:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-gray-600">
              <li><code className="text-cyan-600">&quot;true&quot;</code> &rarr; <code className="text-emerald-600">true</code> (boolean)</li>
              <li><code className="text-cyan-600">&quot;false&quot;</code> &rarr; <code className="text-red-600">false</code> (boolean)</li>
              <li><code className="text-cyan-600">&quot;10&quot;</code> &rarr; <code className="text-amber-600">10</code> (숫자 키에만 적용: limit, offset, timeout, line, count, depth)</li>
            </ul>
            <p className="mt-3 text-amber-600">
              숫자 변환은 <code>isNumericKey</code> 목록에 없는 키에는 적용되지 않습니다.
              예를 들어 <code>&quot;command&quot;: &quot;123&quot;</code>은 변환되지 않습니다.
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

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>교정 파이프라인</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            교정은 3단계 파이프라인으로 실행됩니다.
            각 단계는 이전 단계의 결과를 입력으로 받아 순차적으로 교정합니다.
          </p>

          <MermaidDiagram
            title="교정 파이프라인 흐름"
            titleColor="purple"
            chart={`graph TD
  INPUT["LLM 원시 인수<br/><small>args: Record&lt;string, unknown&gt;</small>"]

  INPUT --> S0["0단계: Git Bash 경로 변환<br/><small>모든 tier — /c/Users → C:\\Users</small>"]
  S0 -->|"tier = high"| OUT_H["교정 완료<br/><small>Git Bash 변환만 적용</small>"]
  S0 -->|"tier = medium/low"| S1["1단계: 상대 → 절대 경로<br/><small>resolve(cwd, path)</small>"]
  S1 --> S2["2단계: 타입 교정<br/><small>string → boolean/number</small>"]
  S2 --> OUT_L["교정 완료<br/><small>전체 교정 적용</small>"]

  style INPUT fill:#f1f5f9,stroke:#64748b,color:#1e293b
  style S0 fill:#dbeafe,stroke:#3b82f6,color:#1e293b
  style S1 fill:#fef3c7,stroke:#f59e0b,color:#78350f
  style S2 fill:#fce7f3,stroke:#ec4899,color:#831843
  style OUT_H fill:#dcfce7,stroke:#10b981,color:#065f46,stroke-width:2px
  style OUT_L fill:#dcfce7,stroke:#10b981,color:#065f46,stroke-width:2px`}
          />

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>핵심 코드 분석</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">correctToolCall</code> 함수의 핵심 흐름입니다.
            각 단계가 순차적으로 적용되며, HIGH 등급은 0단계 후 즉시 반환합니다.
          </p>
          <CodeBlock>
            <span className="fn">correctToolCall</span>(<span className="prop">args</span>, <span className="prop">workingDirectory</span>, <span className="prop">tier</span>) {"{"}
            {"\n"}{"  "}<span className="cm">{"// [0] Git Bash 경로 → Windows 경로 (모든 tier)"}</span>
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">gitBashCorrected</span> = <span className="fn">correctGitBashPaths</span>(<span className="prop">args</span>);
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// [1] HIGH 등급은 추가 교정 없이 반환"}</span>
            {"\n"}{"  "}<span className="kw">if</span> (<span className="prop">tier</span> === <span className="str">&quot;high&quot;</span>) <span className="kw">return</span> <span className="prop">gitBashCorrected</span>;
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// [2] 얕은 복사 (원본 불변)"}</span>
            {"\n"}{"  "}<span className="kw">const</span> <span className="prop">corrected</span> = {"{"} ...<span className="prop">gitBashCorrected</span> {"}"};
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// [3] 상대 경로 → 절대 경로"}</span>
            {"\n"}{"  "}<span className="kw">for</span> (<span className="kw">const</span> [<span className="prop">key</span>, <span className="prop">value</span>] <span className="kw">of</span> <span className="fn">Object</span>.<span className="fn">entries</span>(<span className="prop">corrected</span>)) {"{"}
            {"\n"}{"    "}<span className="kw">if</span> (<span className="fn">isPathKey</span>(<span className="prop">key</span>) && !<span className="fn">isAbsolute</span>(<span className="prop">value</span>))
            {"\n"}{"      "}<span className="prop">corrected</span>[<span className="prop">key</span>] = <span className="fn">resolve</span>(<span className="prop">workingDirectory</span>, <span className="prop">value</span>);
            {"\n"}{"  "}{"}"}
            {"\n"}
            {"\n"}{"  "}<span className="cm">{"// [4] 타입 강제 변환"}</span>
            {"\n"}{"  "}<span className="cm">{"// \"true\" → true, \"false\" → false, \"10\" → 10"}</span>
            {"\n"}{"  "}<span className="kw">return</span> <span className="prop">corrected</span>;
            {"\n"}{"}"}
          </CodeBlock>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
            <p><strong className="text-gray-900">[0]</strong> Git Bash 경로 변환은 Windows에서만 동작하며, 변경 사항이 없으면 원본 참조를 그대로 반환합니다 (불필요한 복사 방지).</p>
            <p><strong className="text-gray-900">[1]</strong> HIGH 등급 모델은 스키마를 잘 따르므로 추가 교정이 불필요합니다. 성능 오버헤드를 최소화합니다.</p>
            <p><strong className="text-gray-900">[2]</strong> 얕은 복사(spread)로 원본 불변성을 보장합니다. 중첩 객체는 복사되지 않지만, 도구 인수는 일반적으로 평면(flat) 구조입니다.</p>
            <p><strong className="text-gray-900">[3]</strong> <code className="text-cyan-600">isPathKey</code>로 경로 키만 선별하고, <code className="text-cyan-600">isAbsolute</code>로 이미 절대 경로인지 확인합니다.</p>
            <p><strong className="text-gray-900">[4]</strong> boolean 변환은 모든 키에 적용되지만, 숫자 변환은 <code className="text-cyan-600">isNumericKey</code> 목록의 키에만 적용됩니다.</p>
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
              &quot;경로가 교정되지 않아요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
              두 가지 가능성을 확인하세요:
            </p>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                <strong>키 이름:</strong> 경로 매개변수의 키가 <code className="text-cyan-600">isPathKey</code> 목록에
                포함되어 있는지 확인하세요. <code className="text-cyan-600">&quot;target_path&quot;</code> 같은
                커스텀 키는 인식되지 않습니다.
              </li>
              <li>
                <strong>성능 등급:</strong> <code className="text-cyan-600">HIGH</code> 등급에서는
                상대 경로 교정이 적용되지 않습니다. 등급을 확인하세요.
              </li>
            </ul>
          </div>

          {/* FAQ 2 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;숫자 값이 문자열로 남아 있어요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              숫자 변환은 <code className="text-cyan-600">isNumericKey</code> 목록의 키에만 적용됩니다.
              커스텀 키(예: <code className="text-cyan-600">&quot;max_results&quot;</code>)에 숫자 변환이 필요하면
              <code className="text-cyan-600">numKeys</code> 배열에 해당 키를 추가하세요.
            </p>
          </div>

          {/* FAQ 3 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;Git Bash 경로 변환이 macOS에서 적용되어요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              그럴 수 없습니다. <code className="text-cyan-600">correctGitBashPaths</code>는 내부에서
              <code className="text-cyan-600">isWindows()</code>를 먼저 확인합니다. Windows가 아닌 환경에서는
              원본 인수를 그대로 반환합니다.
            </p>
          </div>

          {/* FAQ 4 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;고성능 모델인데도 경로 오류가 발생해요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              HIGH 등급에서는 Git Bash 변환만 적용됩니다. 상대 경로 교정이 필요하다면
              시스템 프롬프트에 &quot;절대 경로를 사용하세요&quot;라는 지시를 추가하거나,
              모델의 성능 등급을 MEDIUM으로 재분류하는 것을 고려하세요.
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
                name: "adaptive-schema.ts",
                slug: "adaptive-schema",
                relation: "sibling",
                desc: "등급별 도구 스키마 축소 — 스키마를 줄여서 오류 가능성 자체를 낮춤",
              },
              {
                name: "tool-retry.ts",
                slug: "tool-retry",
                relation: "sibling",
                desc: "도구 실행 실패 후 자동 교정 재시도 — 사후 교정 (이 모듈은 사전 교정)",
              },
              {
                name: "model-capabilities.ts",
                slug: "model-capabilities",
                relation: "parent",
                desc: "CapabilityTier를 결정하는 모델 성능 등급 시스템",
              },
              {
                name: "lazy-tool-loader.ts",
                slug: "lazy-tool-loader",
                relation: "sibling",
                desc: "등급별 도구 스키마 지연 로딩으로 토큰 비용 절약",
              },
            ]}
          />
        </section>
      </RevealOnScroll>
    </div></div>
  );
}

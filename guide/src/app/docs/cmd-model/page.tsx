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

export default function CmdModelPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/commands/model.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">/model</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="leaf" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              세션 중간에 활성 LLM 모델과 프로바이더를 전환하는 모델 변경 명령어입니다.
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
                <code className="text-cyan-600">/model</code>은 세션을 종료하지 않고도 활성 LLM
                모델을 전환할 수 있는 명령어입니다. 인자 없이 호출하면 대화형 모델
                선택기(interactive select)를 표시하고, 모델명을 직접 입력하면 즉시 전환합니다.
              </p>
              <p>
                프로바이더 프로필을 지원하여
                <code className="text-cyan-600">Local Default</code>와
                <code className="text-cyan-600">OpenAI Default</code> 선택 시 model, baseURL, apiKey
                3종 세트가 함께 전환됩니다. 이를 통해 로컬 LLM과 클라우드 API를 한 번의 선택으로
                전환할 수 있습니다.
              </p>
              <p>
                선택한 모델은 <code className="text-cyan-600">~/.dhelix/config.json</code>에
                영속화되어 다음 세션에서도 기본값으로 사용됩니다.
              </p>
            </div>

            <MermaidDiagram
              title="/model 아키텍처 위치"
              titleColor="purple"
              chart={`graph TD
  USER["사용자 입력<br/><small>/model [model-name]</small>"]
  CMD["modelCommand<br/><small>model.ts</small>"]
  SELECT["Interactive Select<br/><small>모델 목록 UI</small>"]
  PROVIDER{"프로바이더<br/>키 선택?"}
  LOCAL["Local Provider<br/><small>LOCAL_MODEL +<br/>LOCAL_API_BASE_URL</small>"]
  OPENAI["OpenAI Provider<br/><small>OPENAI_MODEL +<br/>OPENAI_BASE_URL</small>"]
  CAPS["Model Capabilities<br/><small>model-capabilities.ts</small>"]
  CONFIG["config.json<br/><small>~/.dhelix/config.json</small>"]
  CLIENT["LLM Client<br/><small>재생성</small>"]

  USER --> CMD
  CMD -->|"인자 없음"| SELECT
  CMD -->|"모델명 직접 입력"| PROVIDER
  SELECT -->|"선택 완료"| PROVIDER
  PROVIDER -->|"__provider:local__"| LOCAL
  PROVIDER -->|"__provider:openai__"| OPENAI
  PROVIDER -->|"일반 모델명"| CAPS
  LOCAL --> CONFIG
  OPENAI --> CONFIG
  CAPS --> CONFIG
  LOCAL -->|"newProvider"| CLIENT
  OPENAI -->|"newProvider"| CLIENT

  style CMD fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style CONFIG fill:#fef3c7,stroke:#f59e0b,color:#1e293b,stroke-width:2px
  style SELECT fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style LOCAL fill:#dcfce7,stroke:#10b981,color:#065f46
  style OPENAI fill:#dbeafe,stroke:#3b82f6,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>비유:</strong> 자동차의 기어 변속을 떠올리세요. 고속도로(복잡한 작업)에서는
              고성능 기어(claude-opus-4-6)를, 시내 주행(간단한 작업)에서는 연비 좋은
              기어(gpt-4o-mini)를 선택하듯, 작업에 맞는 모델로 세션 중간에 전환할 수 있습니다.
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

            {/* ProviderProfile interface */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface ProviderProfile
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              프로바이더 프로필 정보를 담는 인터페이스입니다. 모델, API 엔드포인트, API 키 3종
              세트입니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "model",
                  type: "string",
                  required: true,
                  desc: '모델 ID (예: "gpt-4o", "deepseek-chat")',
                },
                { name: "baseURL", type: "string", required: true, desc: "API 엔드포인트 URL" },
                {
                  name: "apiKey",
                  type: "string",
                  required: true,
                  desc: 'API 인증 키 (로컬 모델은 "no-key-required")',
                },
              ]}
            />

            {/* persistModelChoice */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              persistModelChoice(model)
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              선택한 모델을 <code className="text-cyan-600">~/.dhelix/config.json</code>의
              <code className="text-cyan-600">llm.model</code> 필드에 영속화합니다. 영속화 실패 시
              세션에 영향을 주지 않습니다 (silent fail).
            </p>
            <CodeBlock>
              <span className="kw">async function</span>{" "}
              <span className="fn">persistModelChoice</span>(<span className="prop">model</span>:{" "}
              <span className="type">string</span>): <span className="type">Promise</span>&lt;
              <span className="type">void</span>&gt;
            </CodeBlock>

            {/* getKnownModels */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              getKnownModels()
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              대화형 선택 목록에 표시할 모델 목록을 반환합니다. 환경변수 기반 프로바이더 프로필이
              목록 상단에 표시됩니다.
            </p>
            <CodeBlock>
              <span className="fn">getKnownModels</span>():{" "}
              <span className="type">ReadonlyArray</span>&lt;{"{"}
              {"\n"}
              {"  "}
              <span className="prop">label</span>: <span className="type">string</span>;{"\n"}
              {"  "}
              <span className="prop">value</span>: <span className="type">string</span>;{"\n"}
              {"  "}
              <span className="prop">description</span>: <span className="type">string</span>;{"\n"}
              {"}"}&gt;
            </CodeBlock>

            {/* STATIC_MODELS */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              정적 모델 목록 (STATIC_MODELS)
            </h3>
            <div className="bg-white border border-gray-200 rounded-xl p-5 text-[13px] text-gray-600 space-y-2">
              <p>
                <strong className="text-gray-900">gpt-4o</strong> &mdash; 128k context
              </p>
              <p>
                <strong className="text-gray-900">gpt-4o-mini</strong> &mdash; Cost-effective
              </p>
              <p>
                <strong className="text-gray-900">claude-sonnet-4-6</strong> &mdash; Best coding
              </p>
              <p>
                <strong className="text-gray-900">claude-opus-4-6</strong> &mdash; Deepest reasoning
              </p>
              <p>
                <strong className="text-gray-900">claude-haiku-4-5-20251001</strong> &mdash; Fast
              </p>
              <p>
                <strong className="text-gray-900">o3-mini</strong> &mdash; Reasoning
              </p>
              <p>
                <strong className="text-gray-900">deepseek-chat</strong> &mdash; Open-source
              </p>
            </div>

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                프로바이더 프로필 선택 시 <code className="text-cyan-600">newProvider</code>가
                반환되어 LLM 클라이언트가 재생성됩니다. 일반 모델명 선택은 모델만 변경하고
                baseURL/apiKey는 유지됩니다.
              </li>
              <li>
                프로바이더 프로필은 환경변수 기반입니다.
                <code className="text-cyan-600">LOCAL_MODEL</code>,
                <code className="text-cyan-600">LOCAL_API_BASE_URL</code>,
                <code className="text-cyan-600">LOCAL_API_KEY</code> 등이 설정되어야 목록에
                표시됩니다.
              </li>
              <li>
                <code className="text-cyan-600">persistModelChoice()</code>는 실패해도 예외를 던지지
                않습니다 (silent catch). 세션 내 모델 전환은 항상 성공하며, 영속화만 실패할 수
                있습니다.
              </li>
              <li>
                목록에 없는 모델명도 직접 입력하면 전환 가능합니다.
                <code className="text-cyan-600">getModelCapabilities()</code>가 기본값을 반환합니다.
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

            {/* 기본: 대화형 선택 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              기본 사용법 &mdash; 대화형 모델 선택
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              인자 없이 <code className="text-cyan-600">/model</code>을 입력하면 현재 모델 정보와
              함께 선택 목록이 표시됩니다.
            </p>
            <CodeBlock>
              <span className="str">/model</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// 출력"}</span>
              {"\n"}
              <span className="prop">Current</span>: gpt-4o (128K context)
              {"\n"}
              {"\n"}
              <span className="cm">{"// 대화형 선택 목록 (환경변수에 따라 달라짐)"}</span>
              {"\n"}
              <span className="str">{"🏠 Local Default (deepseek-chat)"}</span>
              {"  "}localhost:1234
              {"\n"}
              <span className="str">{"☁️  OpenAI Default (gpt-4o)"}</span>
              {"        "}api.openai.com
              {"\n"}
              <span className="prop">gpt-4o-mini</span>
              {"                         "}Cost-effective
              {"\n"}
              <span className="prop">claude-sonnet-4-6</span>
              {"                  "}Best coding
              {"\n"}
              <span className="prop">claude-opus-4-6</span>
              {"                    "}Deepest reasoning
              {"\n"}
              <span className="prop">o3-mini</span>
              {"                             "}Reasoning
            </CodeBlock>

            {/* 직접 입력 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              모델명 직접 지정
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              모델 ID를 직접 입력하면 즉시 전환됩니다. 목록에 없는 커스텀 모델도 사용 가능합니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 클라우드 모델로 전환"}</span>
              {"\n"}
              <span className="str">/model claude-sonnet-4-6</span>
              {"\n"}
              <span className="cm">
                {"// → Model switched to: claude-sonnet-4-6 (200K context)"}
              </span>
              {"\n"}
              <span className="cm">{"//   ✓ Saved as default for future sessions"}</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"// 비용 절약을 위해 작은 모델로 전환"}</span>
              {"\n"}
              <span className="str">/model gpt-4o-mini</span>
              {"\n"}
              <span className="cm">{"// → Model switched to: gpt-4o-mini (128K context)"}</span>
              {"\n"}
              <span className="cm">{"//   ✓ Saved as default for future sessions"}</span>
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> 모델을 전환하면 이전 대화의 컨텍스트는 유지되지만, 새 모델의
              컨텍스트 윈도우 크기에 따라 잘릴 수 있습니다. 컨텍스트가 긴 대화에서 작은 모델로
              전환할 때 주의하세요.
            </Callout>

            {/* 프로바이더 전환 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              고급 &mdash; Local/Cloud 프로바이더 전환
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              프로바이더 프로필 선택 시 model + baseURL + apiKey가 함께 전환되어 LLM 클라이언트가
              재생성됩니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 환경변수 설정 (사전 준비)"}</span>
              {"\n"}
              <span className="prop">LOCAL_MODEL</span>=deepseek-chat
              {"\n"}
              <span className="prop">LOCAL_API_BASE_URL</span>=http://localhost:1234/v1
              {"\n"}
              <span className="prop">LOCAL_API_KEY</span>=no-key-required
              {"\n"}
              {"\n"}
              <span className="cm">{"// 대화형 선택에서 '🏠 Local Default' 선택"}</span>
              {"\n"}
              <span className="cm">
                {"// → 🏠 Local provider로 전환: deepseek-chat (32K context)"}
              </span>
              {"\n"}
              <span className="cm">{"//   ✓ Saved as default for future sessions"}</span>
            </CodeBlock>

            <Callout type="tip" icon="*">
              <strong>팁:</strong> 복잡한 아키텍처 결정에는
              <code className="text-cyan-600">claude-opus-4-6</code>(Deepest reasoning)를 사용하고,
              간단한 코드 생성에는 <code className="text-cyan-600">gpt-4o-mini</code>
              (Cost-effective)로 전환하면 비용을 크게 절약할 수 있습니다.
            </Callout>

            <DeepDive title="프로바이더 프로필 환경변수 상세">
              <p className="mb-3">두 가지 프로바이더 프로필을 지원합니다:</p>
              <div className="space-y-4">
                <div>
                  <p className="font-bold text-gray-900 mb-1">Local Default</p>
                  <ul className="list-disc list-inside space-y-1 text-gray-600">
                    <li>
                      <code className="text-cyan-600">LOCAL_MODEL</code> &mdash; 모델 ID (필수)
                    </li>
                    <li>
                      <code className="text-cyan-600">LOCAL_API_BASE_URL</code> &mdash; API URL
                      (필수)
                    </li>
                    <li>
                      <code className="text-cyan-600">LOCAL_API_KEY</code> &mdash; API 키 (선택,
                      기본값: &quot;no-key-required&quot;)
                    </li>
                  </ul>
                </div>
                <div>
                  <p className="font-bold text-gray-900 mb-1">OpenAI Default</p>
                  <ul className="list-disc list-inside space-y-1 text-gray-600">
                    <li>
                      <code className="text-cyan-600">OPENAI_MODEL</code> &mdash; 모델 ID (필수)
                    </li>
                    <li>
                      <code className="text-cyan-600">OPENAI_BASE_URL</code> &mdash; API URL (필수)
                    </li>
                    <li>
                      <code className="text-cyan-600">OPENAI_API_KEY</code> &mdash; API 키 (필수)
                    </li>
                  </ul>
                </div>
              </div>
              <p className="mt-3 text-amber-600">
                필수 환경변수가 하나라도 없으면 해당 프로바이더는 선택 목록에 표시되지 않습니다.
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
              모델 선택 분기 흐름
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              인자의 유무와 프로바이더 키 여부에 따라 세 가지 경로로 분기합니다.
            </p>

            <MermaidDiagram
              title="모델 선택 로직"
              titleColor="purple"
              chart={`graph TD
  INPUT{"args.trim()<br/>비어있음?"}
  SELECT["interactiveSelect 반환<br/><small>options + prompt + onSelect</small>"]
  PROV{"handleProviderSelection<br/>결과가 있음?"}
  LOCAL_P["Local Provider<br/><small>model + baseURL + apiKey</small>"]
  OPENAI_P["OpenAI Provider<br/><small>model + baseURL + apiKey</small>"]
  NORMAL["일반 모델명<br/><small>getModelCapabilities()</small>"]
  PERSIST["persistModelChoice()<br/><small>~/.dhelix/config.json</small>"]
  RESULT["CommandResult<br/><small>newModel + newProvider?</small>"]

  INPUT -->|"예"| SELECT
  INPUT -->|"아니오"| PROV
  PROV -->|"__provider:local__"| LOCAL_P
  PROV -->|"__provider:openai__"| OPENAI_P
  PROV -->|"undefined (일반)"| NORMAL
  LOCAL_P --> PERSIST
  OPENAI_P --> PERSIST
  NORMAL --> PERSIST
  PERSIST --> RESULT

  style INPUT fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style PERSIST fill:#fef3c7,stroke:#f59e0b,color:#1e293b,stroke-width:2px
  style LOCAL_P fill:#dcfce7,stroke:#10b981,color:#065f46
  style OPENAI_P fill:#dbeafe,stroke:#3b82f6,color:#1e293b`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              핵심 코드 분석
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              모델 영속화와 모델 역량 정보 생성 로직입니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 모델 영속화 — config.json의 llm.model 필드 업데이트"}</span>
              {"\n"}
              <span className="kw">async function</span>{" "}
              <span className="fn">persistModelChoice</span>(<span className="prop">model</span>:{" "}
              <span className="type">string</span>): <span className="type">Promise</span>&lt;
              <span className="type">void</span>&gt; {"{"}
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">configPath</span> ={" "}
              <span className="fn">joinPath</span>(<span className="prop">CONFIG_DIR</span>,{" "}
              <span className="str">&quot;config.json&quot;</span>);
              {"\n"}
              {"  "}
              <span className="kw">let</span> <span className="prop">existing</span> = {"{}"};{" "}
              <span className="cm">{"// 파일 없으면 빈 객체"}</span>
              {"\n"}
              {"  "}
              <span className="kw">try</span> {"{"}
              {"\n"}
              {"    "}
              <span className="prop">existing</span> = JSON.<span className="fn">parse</span>(
              <span className="kw">await</span> <span className="fn">readFile</span>(
              <span className="prop">configPath</span>,{" "}
              <span className="str">&quot;utf-8&quot;</span>));
              {"\n"}
              {"  "}
              <span className="kw">
                {"}"} catch {"{"}
              </span>{" "}
              <span className="cm">{"/* ENOENT 등 무시 */"}</span> {"}"}
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">llm</span> = (
              <span className="prop">existing</span>.<span className="prop">llm</span> ?? {"{}"});{" "}
              <span className="cm">{"// 기존 llm 설정 보존"}</span>
              {"\n"}
              {"  "}
              <span className="prop">existing</span>.<span className="prop">llm</span> = {"{ ..."}
              <span className="prop">llm</span>, <span className="prop">model</span> {"}"};{"\n"}
              {"  "}
              <span className="kw">await</span> <span className="fn">writeFile</span>(
              <span className="prop">configPath</span>, JSON.<span className="fn">stringify</span>(
              <span className="prop">existing</span>, <span className="kw">null</span>,{" "}
              <span className="num">2</span>));
              {"\n"}
              {"}"}
              {"\n"}
              {"\n"}
              <span className="cm">{"// 일반 모델명 선택 — 역량 정보로 안내 메시지 구성"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">caps</span> ={" "}
              <span className="fn">getModelCapabilities</span>(
              <span className="prop">newModel</span>);
              {"\n"}
              <span className="kw">const</span> <span className="prop">notes</span>:{" "}
              <span className="type">string</span>[] = [];
              {"\n"}
              <span className="kw">if</span> (!<span className="prop">caps</span>.
              <span className="prop">supportsTools</span>) <span className="prop">notes</span>.
              <span className="fn">push</span>(
              <span className="str">&quot;text-parsing fallback for tools&quot;</span>);
              {"\n"}
              <span className="kw">if</span> (<span className="prop">caps</span>.
              <span className="prop">useDeveloperRole</span>) <span className="prop">notes</span>.
              <span className="fn">push</span>(
              <span className="str">&quot;developer role instead of system&quot;</span>);
              {"\n"}
              <span className="kw">if</span> (!<span className="prop">caps</span>.
              <span className="prop">supportsTemperature</span>) <span className="prop">notes</span>
              .<span className="fn">push</span>(
              <span className="str">&quot;temperature not supported&quot;</span>);
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">스프레드 보존:</strong>{" "}
                <code className="text-cyan-600">{"{ ...llm, model }"}</code> 패턴으로 기존 llm
                설정(apiKey, baseURL 등)을 보존하면서 model만 업데이트합니다.
              </p>
              <p>
                <strong className="text-gray-900">Silent Fail:</strong>{" "}
                <code className="text-cyan-600">persistModelChoice()</code>의 외부 try-catch는 모든
                예외를 무시합니다. 파일 권한 문제 등으로 영속화가 실패해도 세션 내 모델 전환은 정상
                동작합니다.
              </p>
              <p>
                <strong className="text-gray-900">역량 노트:</strong> 도구 미지원, developer role
                사용, temperature 미지원 등 모델의 제한사항이 전환 메시지에 자동으로 표시됩니다.
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
                &quot;Local Default가 목록에 표시되지 않아요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">
                <code className="text-cyan-600">LOCAL_MODEL</code>과
                <code className="text-cyan-600">LOCAL_API_BASE_URL</code> 환경변수가 둘 다
                설정되어야 목록에 표시됩니다.
                <code className="text-cyan-600">.env</code> 파일이나 쉘 프로파일에서 확인하세요.
              </p>
              <CodeBlock>
                <span className="cm">{"// .env 또는 쉘 프로파일에 추가"}</span>
                {"\n"}
                <span className="prop">LOCAL_MODEL</span>=deepseek-chat
                {"\n"}
                <span className="prop">LOCAL_API_BASE_URL</span>=http://localhost:1234/v1
              </CodeBlock>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;모델을 바꿨는데 다음 세션에서 유지되지 않아요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">~/.dhelix/config.json</code>의 쓰기 권한을
                확인하세요.
                <code className="text-cyan-600">persistModelChoice()</code>는 실패해도 에러를
                표시하지 않으므로, 직접 파일을 확인해야 합니다.
                <code className="text-cyan-600">/doctor</code>로 Config directory 권한을 점검할 수
                있습니다.
              </p>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;목록에 없는 모델을 사용하고 싶어요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                모델 ID를 직접 입력하면 됩니다. 예:{" "}
                <code className="text-cyan-600">/model my-custom-model</code>.
                <code className="text-cyan-600">getModelCapabilities()</code>는 알 수 없는 모델에
                대해 기본값을 반환하므로 동작은 합니다. 다만 도구 지원, 컨텍스트 크기 등이 실제와
                다를 수 있으므로 주의가 필요합니다.
              </p>
            </div>

            {/* FAQ 4 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;text-parsing fallback for tools 경고가 나와요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                선택한 모델이 네이티브 함수 호출(function calling)을 지원하지 않는다는 뜻입니다.
                dhelix는 텍스트 파싱으로 도구 호출을 대체하지만, 정확도가 낮아질 수 있습니다.
                가능하면 함수 호출을 지원하는 모델을 사용하세요.
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
                  relation: "sibling",
                  desc: "모델별 컨텍스트 크기, 도구 지원, 가격 정보를 제공하는 역량 레지스트리",
                },
                {
                  name: "llm-client.ts",
                  slug: "llm-client",
                  relation: "parent",
                  desc: "newProvider 반환 시 클라이언트를 재생성하여 새 엔드포인트로 연결하는 LLM 클라이언트",
                },
                {
                  name: "dual-model-router.ts",
                  slug: "dual-model-router",
                  relation: "sibling",
                  desc: "복잡도에 따라 자동으로 모델을 선택하는 듀얼 모델 라우터",
                },
                {
                  name: "config-loader.ts",
                  slug: "config-loader",
                  relation: "sibling",
                  desc: "config.json의 llm.model 필드를 5-layer 설정 병합에서 사용하는 모듈",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}

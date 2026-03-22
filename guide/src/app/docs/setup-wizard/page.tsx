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

export default function SetupWizardPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/cli/setup-wizard.ts" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">Setup Wizard</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="cli" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              dbcode를 처음 실행할 때 API 키와 모델을 설정하는 대화형 마법사입니다. 환경변수나 설정
              파일에 API 키가 없으면 자동으로 실행됩니다.
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
                <code className="text-cyan-600">setup-wizard.ts</code>는 dbcode의 최초 실행
                경험(OOBE)을 담당합니다. 사용자가 API 키를 설정하지 않은 상태에서 dbcode를 실행하면,
                이 마법사가 자동으로 시작되어 모델 선택과 API 키 입력을 안내합니다.
              </p>
              <p>
                설정은 <code className="text-cyan-600">~/.dbcode/config.json</code>에 저장되며, 기존
                설정 파일이 있으면 병합(merge)하여 기존 값을 보존합니다.
                <code className="text-cyan-600">readline</code> 인터페이스를 사용하여 터미널에서
                대화형으로 입력을 받습니다.
              </p>
              <p>
                6개의 미리 정의된 모델 프리셋(OpenAI, Anthropic, Ollama)을 제공하여 사용자가 번호만
                선택하면 바로 시작할 수 있습니다. 커스텀 모델과 base URL도 직접 입력할 수 있습니다.
              </p>
            </div>

            <MermaidDiagram
              title="Setup Wizard 아키텍처 위치"
              titleColor="purple"
              chart={`graph TD
  CLI["dbcode 실행<br/><small>index.ts</small>"]
  CHECK["needsSetup()<br/><small>설정 필요 여부 확인</small>"]
  ENV["환경변수 확인<br/><small>OPENAI_API_KEY / DBCODE_API_KEY</small>"]
  CFG["config.json 확인<br/><small>~/.dbcode/config.json</small>"]
  WIZ["runSetupWizard()<br/><small>대화형 설정 마법사</small>"]
  SAVE["설정 저장<br/><small>~/.dbcode/config.json</small>"]
  APP["App 시작<br/><small>App.tsx 렌더링</small>"]

  CLI --> CHECK
  CHECK --> ENV
  CHECK --> CFG
  ENV -->|"키 있음"| APP
  CFG -->|"키 있음"| APP
  ENV -->|"키 없음"| WIZ
  CFG -->|"키 없음"| WIZ
  WIZ --> SAVE
  SAVE --> APP

  style WIZ fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style CHECK fill:#fef3c7,stroke:#d97706,color:#1e293b,stroke-width:2px
  style CLI fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style ENV fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style CFG fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style SAVE fill:#dcfce7,stroke:#10b981,color:#065f46
  style APP fill:#e0e7ff,stroke:#64748b,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>자동 감지:</strong> 마법사는 <code>OPENAI_API_KEY</code>,{" "}
              <code>DBCODE_API_KEY</code> 환경변수, 또는 <code>~/.dbcode/config.json</code>의{" "}
              <code>apiKey</code> 중 하나라도 있으면 실행되지 않습니다. 즉, 환경변수만 설정해도
              마법사를 건너뛸 수 있습니다.
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

            {/* MODEL_PRESETS */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              const MODEL_PRESETS
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              미리 정의된 모델 프리셋 목록입니다. 사용자가 번호로 선택할 수 있습니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "1. Default",
                  type: "env model",
                  required: false,
                  desc: "환경변수의 기본 모델을 사용 (model/baseUrl 빈 문자열)",
                },
                {
                  name: "2. GPT-4o-mini",
                  type: "OpenAI",
                  required: false,
                  desc: "저렴한 OpenAI 모델 (api.openai.com/v1)",
                },
                {
                  name: "3. GPT-4o",
                  type: "OpenAI",
                  required: false,
                  desc: "고성능 OpenAI 모델 (api.openai.com/v1)",
                },
                {
                  name: "4. Claude Sonnet 4.5",
                  type: "Anthropic",
                  required: false,
                  desc: "Anthropic의 코딩 특화 모델 (api.anthropic.com/v1)",
                },
                {
                  name: "5. Claude Haiku 3.5",
                  type: "Anthropic",
                  required: false,
                  desc: "Anthropic의 경량 모델 (api.anthropic.com/v1)",
                },
                {
                  name: "6. Ollama",
                  type: "Local",
                  required: false,
                  desc: "로컬 실행 모델 qwen3:8b (localhost:11434/v1)",
                },
              ]}
            />

            {/* SetupConfig interface */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface SetupConfig
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              설정 마법사에서 저장하는 구성 데이터의 구조입니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "llm.model",
                  type: "string",
                  required: false,
                  desc: "선택한 모델명 (빈 문자열이면 기본값 사용)",
                },
                {
                  name: "llm.baseUrl",
                  type: "string",
                  required: false,
                  desc: "API 엔드포인트 URL",
                },
                {
                  name: "llm.apiKey",
                  type: "string",
                  required: false,
                  desc: "API 키 (직접 입력 시에만 포함)",
                },
              ]}
            />

            {/* needsSetup function */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              async function needsSetup()
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              설정 마법사 실행이 필요한지 확인합니다. 환경변수 또는 설정 파일에 API 키가 있으면{" "}
              <code className="text-cyan-600">false</code>, 없으면{" "}
              <code className="text-cyan-600">true</code>를 반환합니다.
            </p>
            <CodeBlock>
              <span className="kw">export async function</span>{" "}
              <span className="fn">needsSetup</span>():{" "}
              <span className="type">Promise&lt;boolean&gt;</span>
            </CodeBlock>

            {/* runSetupWizard function */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              async function runSetupWizard()
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              대화형 설정 마법사를 실행합니다. 모델 선택, API 키 입력을 거쳐
              <code className="text-cyan-600">~/.dbcode/config.json</code>에 설정을 저장합니다.
            </p>
            <CodeBlock>
              <span className="kw">export async function</span>{" "}
              <span className="fn">runSetupWizard</span>():{" "}
              <span className="type">Promise&lt;SetupConfig&gt;</span>
            </CodeBlock>

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                설정 파일 경로(<code className="text-cyan-600">CONFIG_PATH</code>)는
                <code className="text-cyan-600">CONFIG_DIR</code> 상수에서 파생됩니다. 일반적으로{" "}
                <code className="text-cyan-600">~/.dbcode/config.json</code>입니다.
              </li>
              <li>
                기존 설정 파일이 있으면 <strong>병합(merge)</strong>합니다.
                <code className="text-cyan-600">llm</code> 객체의 필드만 덮어쓰고, 다른 최상위 키는
                보존됩니다.
              </li>
              <li>
                API 키를 입력하지 않고 환경변수를 선택하면,{" "}
                <code className="text-cyan-600">apiKey</code> 필드가 설정 파일에 포함되지 않습니다.
                이 경우 <code className="text-cyan-600">OPENAI_API_KEY</code> 환경변수를 직접
                설정해야 합니다.
              </li>
              <li>
                readline 인터페이스는 <code className="text-cyan-600">finally</code> 블록에서 반드시
                닫힙니다. 에러가 발생해도 stdin이 해제됩니다.
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
              기본 사용법 &mdash; 자동 실행
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              dbcode를 처음 실행하면 API 키가 감지되지 않아 자동으로 마법사가 시작됩니다.
              <code className="text-cyan-600">index.ts</code>에서 다음과 같이 호출합니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// index.ts에서의 호출 패턴"}</span>
              {"\n"}
              <span className="kw">import</span> {"{"} <span className="type">needsSetup</span>,{" "}
              <span className="type">runSetupWizard</span> {"}"} <span className="kw">from</span>{" "}
              <span className="str">&quot;./cli/setup-wizard.js&quot;</span>;{"\n"}
              {"\n"}
              <span className="kw">if</span> (<span className="kw">await</span>{" "}
              <span className="fn">needsSetup</span>()) {"{"}
              {"\n"}
              {"  "}
              <span className="kw">await</span> <span className="fn">runSetupWizard</span>();
              {"\n"}
              {"}"}
              {"\n"}
              <span className="cm">{"// 이후 App 렌더링 진행..."}</span>
            </CodeBlock>

            {/* 마법사 실행 화면 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              마법사 실행 화면
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              실행하면 터미널에 다음과 같은 대화형 프롬프트가 표시됩니다.
            </p>
            <CodeBlock>
              {"  Welcome to dbcode! Let's get you set up."}
              {"\n"}
              {"\n"}
              {"  Choose a model:"}
              {"\n"}
              {"    1. Default (env: gpt-4o)"}
              {"\n"}
              {"    2. GPT-4o-mini (저렴)"}
              {"\n"}
              {"    3. GPT-4o"}
              {"\n"}
              {"    4. Claude Sonnet 4.5"}
              {"\n"}
              {"    5. Claude Haiku 3.5"}
              {"\n"}
              {"    6. Ollama (로컬 모델)"}
              {"\n"}
              {"    7. Custom (enter model name + base URL)"}
              {"\n"}
              {"\n"}
              {"  Select [1-7]: "}
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> API 키를 마법사에서 입력하면 <code>~/.dbcode/config.json</code>
              에<strong>평문으로</strong> 저장됩니다. 보안이 중요한 환경에서는 환경변수(
              <code>OPENAI_API_KEY</code>)를 사용하는 것을 권장합니다. 설정 파일의 권한이 적절한지
              확인하세요.
            </Callout>

            {/* 환경변수로 건너뛰기 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              환경변수로 마법사 건너뛰기
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              CI/CD 환경이나 Docker 컨테이너에서는 환경변수를 설정하여 마법사를 건너뛸 수 있습니다.
            </p>
            <CodeBlock>
              <span className="cm">{"# 방법 1: OPENAI_API_KEY 환경변수"}</span>
              {"\n"}
              <span className="kw">export</span> OPENAI_API_KEY=
              <span className="str">&quot;sk-...&quot;</span>
              {"\n"}dbcode <span className="cm">{"# 마법사 없이 바로 시작"}</span>
              {"\n"}
              {"\n"}
              <span className="cm">{"# 방법 2: DBCODE_API_KEY 환경변수"}</span>
              {"\n"}
              <span className="kw">export</span> DBCODE_API_KEY=
              <span className="str">&quot;sk-...&quot;</span>
              {"\n"}dbcode <span className="cm">{"# 마법사 없이 바로 시작"}</span>
            </CodeBlock>

            <DeepDive title="커스텀 모델 설정 상세">
              <p className="mb-3">
                프리셋 목록에 없는 모델을 사용하려면 &quot;Custom&quot; 옵션(7번)을 선택합니다.
                모델명과 API base URL을 직접 입력할 수 있습니다.
              </p>
              <CodeBlock>
                <span className="cm">{"// 커스텀 모델 입력 흐름"}</span>
                {"\n"}
                <span className="prop">model</span> = <span className="kw">await</span>{" "}
                <span className="prop">rl</span>.<span className="fn">question</span>(
                <span className="str">&quot;Model name [gpt-4o]: &quot;</span>);
                {"\n"}
                <span className="prop">baseUrl</span> = <span className="kw">await</span>{" "}
                <span className="prop">rl</span>.<span className="fn">question</span>(
                <span className="str">&quot;API base URL [https://api.openai.com/v1]: &quot;</span>
                );
              </CodeBlock>
              <p className="mt-3 text-gray-600">
                빈 입력 시 기본값이 사용됩니다: 모델은{" "}
                <code className="text-cyan-600">DEFAULT_MODEL</code> 상수, base URL은{" "}
                <code className="text-cyan-600">https://api.openai.com/v1</code>입니다. OpenAI 호환
                API를 사용하는 로컬 서버(LMStudio, text-generation-webui 등)에도 이 방법으로 연결할
                수 있습니다.
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
              설정 검사 흐름
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">needsSetup()</code> 함수가 API 키 존재 여부를 확인하는
              순서입니다. 환경변수를 먼저 확인하고, 없으면 설정 파일을 확인합니다.
            </p>

            <MermaidDiagram
              title="needsSetup() 검사 흐름"
              titleColor="purple"
              chart={`graph TD
  START(("시작")) --> ENV{"환경변수 확인<br/><small>OPENAI_API_KEY or DBCODE_API_KEY</small>"}
  ENV -->|"있음"| FALSE["return false<br/><small>설정 불필요</small>"]
  ENV -->|"없음"| FILE{"config.json 확인<br/><small>~/.dbcode/config.json</small>"}
  FILE -->|"파일 있음 + apiKey 있음"| FALSE
  FILE -->|"파일 없음 or apiKey 없음"| TRUE["return true<br/><small>설정 필요</small>"]

  style ENV fill:#fef3c7,stroke:#d97706,color:#1e293b,stroke-width:2px
  style FILE fill:#fef3c7,stroke:#d97706,color:#1e293b,stroke-width:2px
  style FALSE fill:#dcfce7,stroke:#10b981,color:#065f46
  style TRUE fill:#fee2e2,stroke:#ef4444,color:#991b1b`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              설정 파일 병합 로직
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              기존 설정 파일이 있으면 새 설정과 <strong>얕은 병합(shallow merge)</strong>합니다.
              최상위 키는 보존되고, <code className="text-cyan-600">llm</code> 객체의 필드만
              덮어씁니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 기존 설정 로드"}</span>
              {"\n"}
              <span className="kw">let</span> <span className="prop">existing</span>:{" "}
              <span className="type">Record&lt;string, unknown&gt;</span> = {"{}"};{"\n"}
              <span className="kw">try</span> {"{"}
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">raw</span> ={" "}
              <span className="kw">await</span> <span className="fn">readFile</span>(
              <span className="prop">CONFIG_PATH</span>,{" "}
              <span className="str">&quot;utf-8&quot;</span>);
              {"\n"}
              {"  "}
              <span className="prop">existing</span> = <span className="fn">JSON.parse</span>(
              <span className="prop">raw</span>);
              {"\n"}
              {"}"} <span className="kw">catch</span> {"{"}{" "}
              <span className="cm">{"/* 기존 파일 없음 */"}</span> {"}"}
              {"\n"}
              {"\n"}
              <span className="cm">{"// 병합: existing의 다른 키 보존 + llm 필드만 덮어쓰기"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">merged</span> = {"{"}
              {"\n"}
              {"  "}...<span className="prop">existing</span>,{"\n"}
              {"  "}
              <span className="prop">llm</span>: {"{"} ...(<span className="prop">existing</span>.
              <span className="prop">llm</span> ?? {"{}"}), ...<span className="prop">config</span>.
              <span className="prop">llm</span> {"}"},{"\n"}
              {"}"};{"\n"}
              <span className="kw">await</span> <span className="fn">writeFile</span>(
              <span className="prop">CONFIG_PATH</span>, <span className="fn">JSON.stringify</span>(
              <span className="prop">merged</span>, <span className="kw">null</span>,{" "}
              <span className="num">2</span>) + <span className="str">&quot;\n&quot;</span>);
            </CodeBlock>

            <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
              <p>
                <strong className="text-gray-900">스프레드 연산자 병합:</strong>{" "}
                <code className="text-cyan-600">...existing</code>으로 기존 최상위 키(hooks, theme
                등)를 보존하고, <code className="text-cyan-600">llm</code> 키만 새 값으로
                교체합니다.
              </p>
              <p>
                <strong className="text-gray-900">llm 내부 병합:</strong>{" "}
                <code className="text-cyan-600">...existing.llm</code>으로 기존 llm 설정(예:
                maxTokens)을 보존하면서 model, baseUrl, apiKey만 업데이트합니다.
              </p>
              <p>
                <strong className="text-gray-900">디렉토리 생성:</strong>{" "}
                <code className="text-cyan-600">
                  mkdir(CONFIG_DIR, {"{"} recursive: true {"}"})
                </code>
                로 <code>~/.dbcode</code> 디렉토리가 없으면 자동 생성합니다.
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
                &quot;매번 실행할 때마다 마법사가 나타나요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed mb-3">다음을 확인하세요:</p>
              <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
                <li>
                  <code className="text-cyan-600">~/.dbcode/config.json</code>에{" "}
                  <code className="text-cyan-600">llm.apiKey</code>
                  필드가 있는지 확인하세요. 마법사에서 &quot;환경변수 사용&quot;을 선택했다면
                  apiKey가 저장되지 않습니다.
                </li>
                <li>
                  <code className="text-cyan-600">OPENAI_API_KEY</code> 또는{" "}
                  <code className="text-cyan-600">DBCODE_API_KEY</code>
                  환경변수가 설정되어 있는지 확인하세요.
                </li>
                <li>
                  설정 파일의 JSON 형식이 올바른지 확인하세요. 파싱 실패 시 &quot;설정
                  없음&quot;으로 판단됩니다.
                </li>
              </ul>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;설정을 변경하고 싶어요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                마법사를 다시 실행하려면{" "}
                <code className="text-cyan-600">~/.dbcode/config.json</code>에서
                <code className="text-cyan-600">llm.apiKey</code> 필드를 삭제하고,
                <code className="text-cyan-600">OPENAI_API_KEY</code> 환경변수도 해제한 뒤 dbcode를
                실행하세요. 또는 설정 파일을 직접 편집할 수도 있습니다.
              </p>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;Ollama(로컬 모델)를 선택했는데 연결이 안 돼요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                Ollama 프리셋은 <code className="text-cyan-600">http://localhost:11434/v1</code>에
                연결합니다. Ollama 서버가 실행 중인지 확인하세요 (
                <code className="text-cyan-600">ollama serve</code>). 모델도 미리 다운로드해야
                합니다 (<code className="text-cyan-600">ollama pull qwen3:8b</code>).
              </p>
            </div>

            {/* FAQ 4 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;기존 설정이 마법사 실행 후 사라졌어요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                마법사는 기존 설정과 <strong>병합</strong>합니다. 그러나{" "}
                <code className="text-cyan-600">llm</code> 객체 내부의 같은 키는 새 값으로
                덮어쓰여집니다. 예를 들어, 기존에{" "}
                <code className="text-cyan-600">llm.maxTokens</code>가 있었다면 보존되지만,
                <code className="text-cyan-600">llm.model</code>은 새로 선택한 값으로 교체됩니다.
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
                  name: "config-loader.ts",
                  slug: "config-loader",
                  relation: "child",
                  desc: "5-layer 설정 병합 시스템 — setup-wizard가 저장한 config.json을 로드",
                },
                {
                  name: "App.tsx",
                  slug: "app-entry",
                  relation: "sibling",
                  desc: "설정 완료 후 렌더링되는 루트 컴포넌트",
                },
                {
                  name: "model-capabilities.ts",
                  slug: "model-capabilities",
                  relation: "sibling",
                  desc: "모델 프리셋의 기능/가격 정보를 관리하는 모듈",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}

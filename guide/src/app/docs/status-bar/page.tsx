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

export default function StatusBarPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}>
      <div className="center-narrow">
        {/* ─── Header ─── */}
        <RevealOnScroll>
          <div style={{ marginBottom: "48px" }}>
            <FilePath path="src/cli/components/StatusBar.tsx" />
            <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
              <span className="text-gray-900">StatusBar</span>
            </h1>
            <div className="flex items-center gap-3 mb-5">
              <LayerBadge layer="cli" />
            </div>
            <p className="text-[16px] text-gray-600 leading-relaxed">
              화면 하단에 표시되는 상태 바 컴포넌트입니다. 현재 모델, 컨텍스트 사용률, 세션 비용,
              권한 모드, 에이전트 상태 등을 한 줄로 보여줍니다.
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
                <code className="text-cyan-600">StatusBar</code>는 터미널 하단에 고정되는 정보
                표시줄입니다. 현재 사용 중인 LLM 모델명, dbcode 버전, 컨텍스트 사용률(시각적 바 +
                퍼센트), 세션 비용, 권한 모드, Verbose/Thinking 상태, MCP 연결 상태, 에이전트 단계를
                한 줄에 압축하여 보여줍니다.
              </p>
              <p>
                <code className="text-cyan-600">React.memo</code>로 감싸져 있어 Props가 변경될 때만
                리렌더링됩니다. 컨텍스트 사용률이 80%를 넘으면 테두리가 빨간색으로 변하고 경고
                메시지가 표시되어 사용자에게 <code className="text-cyan-600">/compact</code> 명령
                사용을 유도합니다.
              </p>
              <p>
                비용 계산은 <code className="text-cyan-600">model-capabilities.ts</code>의 가격
                정보를 단일 진실 공급원(SSOT)으로 사용합니다. 입력/출력 토큰 수와 모델별 단가를
                곱하여 실시간으로 세션 비용을 추적합니다.
              </p>
            </div>

            <MermaidDiagram
              title="StatusBar 아키텍처 위치"
              titleColor="purple"
              chart={`graph TD
  APP["App.tsx<br/><small>루트 컴포넌트</small>"]
  SB["StatusBar<br/><small>하단 상태 바</small>"]
  MC["model-capabilities.ts<br/><small>모델 가격 정보</small>"]
  AL["useAgentLoop<br/><small>토큰/모델/단계 상태</small>"]
  CONST["constants.ts<br/><small>VERSION 상수</small>"]

  APP -->|"Props 전달"| SB
  AL -->|"tokenCount, inputTokens, outputTokens"| APP
  AL -->|"activeModel, agentPhase"| APP
  SB -->|"calculateCost()"| MC
  SB -->|"VERSION"| CONST

  style SB fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style APP fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style MC fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style AL fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style CONST fill:#e0e7ff,stroke:#64748b,color:#1e293b`}
            />

            <Callout type="info" icon="💡">
              <strong>시각적 구조:</strong> StatusBar는 3개의 영역으로 나뉩니다. 왼쪽은 모델명과
              버전, 가운데는 사용량 바와 태그들, 오른쪽은 에이전트 상태입니다.
              <code>justifyContent=&quot;space-between&quot;</code>으로 양 끝 정렬됩니다.
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

            {/* StatusBarProps interface */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              interface StatusBarProps
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              StatusBar 컴포넌트에 전달되는 모든 Props를 정의합니다.
            </p>
            <ParamTable
              params={[
                {
                  name: "model",
                  type: "string",
                  required: true,
                  desc: "현재 사용 중인 모델 ID (비용 계산에 사용)",
                },
                {
                  name: "tokenCount",
                  type: "number",
                  required: true,
                  desc: "누적 토큰 수 (컨텍스트 사용률 계산용)",
                },
                {
                  name: "maxTokens",
                  type: "number",
                  required: true,
                  desc: "모델의 최대 컨텍스트 토큰 수",
                },
                {
                  name: "isStreaming",
                  type: "boolean",
                  required: true,
                  desc: "LLM 응답 스트리밍 중 여부 (fallback 상태 표시)",
                },
                {
                  name: "agentPhase",
                  type: "string",
                  required: false,
                  desc: "에이전트 단계: idle / llm-thinking / llm-streaming / tools-running / tools-done",
                },
                {
                  name: "effortLevel",
                  type: "string",
                  required: false,
                  desc: "노력 수준 표시 (예: [high])",
                },
                { name: "sessionName", type: "string", required: false, desc: "세션 이름 표시" },
                {
                  name: "modelName",
                  type: "string",
                  required: false,
                  desc: "표시할 모델 이름 (model과 다를 수 있음)",
                },
                {
                  name: "inputTokens",
                  type: "number",
                  required: false,
                  desc: "입력 토큰 수 (기본값: 0, 비용 계산용)",
                },
                {
                  name: "outputTokens",
                  type: "number",
                  required: false,
                  desc: "출력 토큰 수 (기본값: 0, 비용 계산용)",
                },
                {
                  name: "permissionMode",
                  type: "string",
                  required: false,
                  desc: "현재 권한 모드 레이블 (예: Default, Plan)",
                },
                {
                  name: "verboseMode",
                  type: "boolean",
                  required: false,
                  desc: "Verbose 모드 활성화 여부 ([Verbose] 태그 표시)",
                },
                {
                  name: "thinkingEnabled",
                  type: "boolean",
                  required: false,
                  desc: "확장 사고 활성화 여부 ([Thinking] 태그 표시)",
                },
                {
                  name: "mcpStatus",
                  type: "string",
                  required: false,
                  desc: "MCP 연결 상태 메시지 (일시적으로 표시)",
                },
              ]}
            />

            {/* calculateCost function */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              function calculateCost()
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              토큰 수와 모델 가격 정보로 세션 비용을 계산합니다.
              <code className="text-cyan-600">model-capabilities.ts</code>의 pricing 정보가 단일
              진실 공급원입니다.
            </p>
            <CodeBlock>
              <span className="kw">function</span> <span className="fn">calculateCost</span>({"\n"}
              {"  "}
              <span className="prop">model</span>: <span className="type">string</span>,{"\n"}
              {"  "}
              <span className="prop">inputTokens</span>: <span className="type">number</span>,{"\n"}
              {"  "}
              <span className="prop">outputTokens</span>: <span className="type">number</span>,
              {"\n"}): <span className="type">number</span> {"{"}
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">caps</span> ={" "}
              <span className="fn">getModelCapabilities</span>(<span className="prop">model</span>);
              {"\n"}
              {"  "}
              <span className="kw">const</span> <span className="prop">pricing</span> ={" "}
              <span className="prop">caps</span>.<span className="prop">pricing</span>;{"\n"}
              {"  "}
              <span className="kw">return</span> ({"\n"}
              {"    "}(<span className="prop">inputTokens</span> /{" "}
              <span className="num">1_000_000</span>) * <span className="prop">pricing</span>.
              <span className="prop">inputPerMillion</span> +{"\n"}
              {"    "}(<span className="prop">outputTokens</span> /{" "}
              <span className="num">1_000_000</span>) * <span className="prop">pricing</span>.
              <span className="prop">outputPerMillion</span>
              {"\n"}
              {"  "});
              {"\n"}
              {"}"}
            </CodeBlock>

            {/* formatCost function */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              function formatCost()
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              비용을 달러 문자열로 포맷합니다. $0.01 미만이면 소수점 4자리까지 표시합니다.
            </p>
            <CodeBlock>
              <span className="kw">function</span> <span className="fn">formatCost</span>(
              <span className="prop">cost</span>: <span className="type">number</span>):{" "}
              <span className="type">string</span>
              {"\n"}
              <span className="cm">{'// cost === 0 → "" (빈 문자열)'}</span>
              {"\n"}
              <span className="cm">{'// cost < 0.01 → "$0.0012"'}</span>
              {"\n"}
              <span className="cm">{'// cost >= 0.01 → "$0.15"'}</span>
            </CodeBlock>

            {/* usageBar function */}
            <h3
              className="text-lg font-bold text-indigo-600 font-mono"
              style={{ marginTop: "32px", marginBottom: "16px" }}
            >
              function usageBar()
            </h3>
            <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
              시각적 사용량 바를 생성합니다.{" "}
              <code className="text-cyan-600">[#####----------]</code> 형태로 채워진 부분과 빈
              부분을 비율로 계산합니다.
            </p>
            <CodeBlock>
              <span className="kw">function</span> <span className="fn">usageBar</span>(
              <span className="prop">ratio</span>: <span className="type">number</span>,{" "}
              <span className="prop">width</span> = <span className="num">15</span>):{" "}
              <span className="type">string</span>
              {"\n"}
              <span className="cm">{'// ratio=0.33, width=15 → "[#####----------]"'}</span>
              {"\n"}
              <span className="cm">{'// ratio=0.80, width=15 → "[############---]"'}</span>
              {"\n"}
              <span className="cm">{'// ratio=1.00, width=15 → "[###############]"'}</span>
            </CodeBlock>

            {/* Caveats */}
            <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
            <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
              <li>
                <code className="text-cyan-600">React.memo</code>로 감싸져 있어 Props가 변경되지
                않으면 리렌더링되지 않습니다. 불필요한 렌더링을 방지하기 위한 성능 최적화입니다.
              </li>
              <li>
                비용 계산 시 <code className="text-cyan-600">inputTokens</code>와{" "}
                <code className="text-cyan-600">outputTokens</code>의 기본값은 0입니다. 값이
                전달되지 않으면 비용이 $0.00으로 표시됩니다.
              </li>
              <li>
                컨텍스트 경고(80% 초과)는 <code className="text-cyan-600">borderColor</code>를
                빨간색으로 변경하고 &quot;!! Context XX%&quot; 텍스트를 추가로 표시합니다. 이
                상태에서는
                <code className="text-cyan-600">/compact</code> 명령으로 컨텍스트를 압축하는 것이
                권장됩니다.
              </li>
              <li>
                <code className="text-cyan-600">agentPhase</code>가 없을 때는{" "}
                <code className="text-cyan-600">isStreaming</code>으로 fallback합니다. 두 값 모두
                없으면 &quot;ready&quot;가 표시됩니다.
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
              기본 사용법 &mdash; App에서 사용하기
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              App 컴포넌트에서 StatusBar를 렌더링하는 패턴입니다.
              <code className="text-cyan-600">showStatusBar</code> Props로 표시 여부를 제어합니다.
            </p>
            <CodeBlock>
              {"{"}showStatusBar ? ({"\n"}
              {"  "}&lt;<span className="type">StatusBar</span>
              {"\n"}
              {"    "}
              <span className="prop">model</span>={"{"}activeModel{"}"}
              {"\n"}
              {"    "}
              <span className="prop">modelName</span>={"{"}activeModel{"}"}
              {"\n"}
              {"    "}
              <span className="prop">tokenCount</span>={"{"}tokenCount{"}"}
              {"\n"}
              {"    "}
              <span className="prop">maxTokens</span>={"{"}
              getModelCapabilities(activeModel).maxContextTokens{"}"}
              {"\n"}
              {"    "}
              <span className="prop">isStreaming</span>={"{"}isProcessing{"}"}
              {"\n"}
              {"    "}
              <span className="prop">agentPhase</span>={"{"}agentPhase{"}"}
              {"\n"}
              {"    "}
              <span className="prop">inputTokens</span>={"{"}inputTokens{"}"}
              {"\n"}
              {"    "}
              <span className="prop">outputTokens</span>={"{"}outputTokens{"}"}
              {"\n"}
              {"    "}
              <span className="prop">permissionMode</span>={"{"}MODE_LABELS[permissionMode]{"}"}
              {"\n"}
              {"    "}
              <span className="prop">verboseMode</span>={"{"}verboseMode{"}"}
              {"\n"}
              {"    "}
              <span className="prop">thinkingEnabled</span>={"{"}thinkingEnabled{"}"}
              {"\n"}
              {"    "}
              <span className="prop">mcpStatus</span>={"{"}mcpStatus{"}"}
              {"\n"}
              {"  "}/&gt;
              {"\n"}) : <span className="kw">null</span>
            </CodeBlock>

            <Callout type="warn" icon="!">
              <strong>주의:</strong> 컨텍스트 사용률이 80%를 넘으면 빨간색 경고가 표시됩니다. 이
              상태에서 계속 대화하면 컨텍스트 윈도우 초과로 에러가 발생할 수 있습니다.
              <code>/compact</code> 명령으로 대화 히스토리를 압축하거나 새 세션을 시작하세요.
            </Callout>

            {/* 상태 표시 패턴 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              에이전트 단계별 상태 표시
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              <code className="text-cyan-600">agentPhase</code> 값에 따라 오른쪽 영역에 다른 상태
              텍스트가 표시됩니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// agentPhase 값에 따른 표시"}</span>
              {"\n"}
              <span className="str">&quot;llm-thinking&quot;</span>
              {"   → "}
              <span className="prop">thinking...</span>
              {"   "}
              <span className="cm">{"(노란색)"}</span>
              {"\n"}
              <span className="str">&quot;llm-streaming&quot;</span>
              {"  → "}
              <span className="prop">streaming...</span>
              {"  "}
              <span className="cm">{"(노란색)"}</span>
              {"\n"}
              <span className="str">&quot;tools-running&quot;</span>
              {"  → "}
              <span className="prop">tools running...</span>{" "}
              <span className="cm">{"(시안색)"}</span>
              {"\n"}
              <span className="str">&quot;tools-done&quot;</span>
              {"     → "}
              <span className="prop">preparing...</span>
              {"  "}
              <span className="cm">{"(시안색)"}</span>
              {"\n"}
              <span className="str">&quot;idle&quot;</span>
              {"           → "}
              <span className="prop">ready</span>
              {"         "}
              <span className="cm">{"(회색)"}</span>
              {"\n"}
              {"\n"}
              <span className="cm">
                {"// agentPhase 없고 isStreaming=true → streaming... (노란색)"}
              </span>
              {"\n"}
              <span className="cm">{"// agentPhase 없고 isStreaming=false → ready (회색)"}</span>
            </CodeBlock>

            {/* 색상 코드 */}
            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              사용량 바 색상 코드
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              컨텍스트 사용률에 따라 사용량 바의 색상이 변합니다.
            </p>
            <CodeBlock>
              <span className="cm">{"// 사용률에 따른 색상 변화"}</span>
              {"\n"}
              {"0% ~ 60%  → "}
              <span className="prop" style={{ color: "#10b981" }}>
                초록색
              </span>
              {"  [####-----------] 25%"}
              {"\n"}
              {"61% ~ 80% → "}
              <span className="prop" style={{ color: "#d97706" }}>
                노란색
              </span>
              {"  [##########-----] 67%"}
              {"\n"}
              {"81% ~     → "}
              <span className="prop" style={{ color: "#ef4444" }}>
                빨간색
              </span>
              {"  [#############--] 87% !! Context 87%"}
            </CodeBlock>

            <DeepDive title="비용 계산 공식 상세">
              <p className="mb-3">
                세션 비용은 <code className="text-cyan-600">model-capabilities.ts</code>에 정의된
                모델별 가격 정보를 기반으로 계산됩니다.
              </p>
              <CodeBlock>
                <span className="cm">
                  {"// 비용 = (입력 토큰 / 1M) * 입력 단가 + (출력 토큰 / 1M) * 출력 단가"}
                </span>
                {"\n"}
                <span className="prop">cost</span> = (<span className="prop">inputTokens</span> /{" "}
                <span className="num">1_000_000</span>) * <span className="prop">pricing</span>.
                <span className="prop">inputPerMillion</span>
                {"\n"}
                {"     "}+ (<span className="prop">outputTokens</span> /{" "}
                <span className="num">1_000_000</span>) * <span className="prop">pricing</span>.
                <span className="prop">outputPerMillion</span>
              </CodeBlock>
              <p className="mt-3 text-gray-600">
                예를 들어, GPT-4o에서 입력 10,000 토큰, 출력 5,000 토큰이면:
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-gray-600 mt-2">
                <li>입력: (10,000 / 1,000,000) * $2.50 = $0.025</li>
                <li>출력: (5,000 / 1,000,000) * $10.00 = $0.050</li>
                <li>합계: $0.075 &rarr; 상태 바에 &quot;$0.08&quot;로 표시</li>
              </ul>
              <p className="mt-3 text-amber-600">
                비용은 <strong>세션 단위</strong>로 누적됩니다. 새 세션을 시작하면 0으로
                초기화됩니다. 실제 API 청구 비용과 약간의 차이가 있을 수 있습니다 (반올림, 캐시 히트
                등).
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
              StatusBar 렌더링 구조
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              StatusBar는 Ink의 <code className="text-cyan-600">Box</code> 컴포넌트를 사용하여 3개
              영역을 <code className="text-cyan-600">justifyContent=&quot;space-between&quot;</code>
              으로 배치합니다.
            </p>

            <MermaidDiagram
              title="StatusBar 렌더링 구조"
              titleColor="purple"
              chart={`graph LR
  OUTER["Box borderStyle=single<br/><small>paddingX=1, justifyContent=space-between</small>"]

  LEFT["왼쪽 영역<br/><small>모델명 + 버전 + 세션명</small>"]
  CENTER["가운데 영역<br/><small>사용량 바 + 비용 + 태그들</small>"]
  RIGHT["오른쪽 영역<br/><small>MCP 상태 + 에이전트 단계</small>"]

  BAR["usageBar()<br/><small>[####----] 45%</small>"]
  COST["formatCost()<br/><small>$0.15</small>"]
  TAGS["모드 태그들<br/><small>[Default] [Verbose] [Thinking]</small>"]
  PHASE["에이전트 단계<br/><small>thinking... / ready</small>"]

  OUTER --> LEFT
  OUTER --> CENTER
  OUTER --> RIGHT
  CENTER --> BAR
  CENTER --> COST
  CENTER --> TAGS
  RIGHT --> PHASE

  style OUTER fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:2px
  style LEFT fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style CENTER fill:#fef3c7,stroke:#d97706,color:#1e293b
  style RIGHT fill:#e0e7ff,stroke:#64748b,color:#1e293b
  style BAR fill:#dcfce7,stroke:#10b981,color:#065f46
  style COST fill:#dcfce7,stroke:#10b981,color:#065f46
  style TAGS fill:#dcfce7,stroke:#10b981,color:#065f46
  style PHASE fill:#dcfce7,stroke:#10b981,color:#065f46`}
            />

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              컨텍스트 경고 판단 로직
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              컨텍스트 사용률이 80%를 넘으면 UI에 경고가 표시됩니다.
            </p>
            <CodeBlock>
              <span className="kw">const</span> <span className="prop">usage</span> ={" "}
              <span className="prop">maxTokens</span> &gt; <span className="num">0</span>
              {"\n"}
              {"  "}? <span className="fn">Math.round</span>((
              <span className="prop">tokenCount</span> / <span className="prop">maxTokens</span>) *{" "}
              <span className="num">100</span>){"\n"}
              {"  "}: <span className="num">0</span>;{"\n"}
              {"\n"}
              <span className="cm">{"// 색상 결정"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">usageColor</span> ={" "}
              <span className="prop">usage</span> &gt; <span className="num">80</span> ?{" "}
              <span className="str">&quot;red&quot;</span>
              {"\n"}
              {"  "}: <span className="prop">usage</span> &gt; <span className="num">60</span> ?{" "}
              <span className="str">&quot;yellow&quot;</span>
              {"\n"}
              {"  "}: <span className="str">&quot;green&quot;</span>;{"\n"}
              {"\n"}
              <span className="cm">{"// 80% 초과 시 테두리 + 경고 메시지"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">contextWarning</span> ={" "}
              <span className="prop">usage</span> &gt; <span className="num">80</span>;{"\n"}
              <span className="cm">{"// borderColor → 'red', 추가 텍스트 → '!! Context 85%'"}</span>
            </CodeBlock>

            <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
              useMemo 최적화
            </h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              비용 계산과 색상 결정에 <code className="text-cyan-600">useMemo</code>를 사용하여
              의존성이 변경되지 않으면 재계산을 방지합니다.
            </p>
            <CodeBlock>
              <span className="cm">
                {"// 비용은 model, inputTokens, outputTokens가 변경될 때만 재계산"}
              </span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">cost</span> ={" "}
              <span className="fn">useMemo</span>({"\n"}
              {"  "}() =&gt; <span className="fn">calculateCost</span>(
              <span className="prop">model</span>, <span className="prop">inputTokens</span>,{" "}
              <span className="prop">outputTokens</span>),
              {"\n"}
              {"  "}[<span className="prop">model</span>, <span className="prop">inputTokens</span>,{" "}
              <span className="prop">outputTokens</span>],
              {"\n"});
              {"\n"}
              {"\n"}
              <span className="cm">{"// 색상은 usage가 변경될 때만 재계산"}</span>
              {"\n"}
              <span className="kw">const</span> <span className="prop">usageColor</span> ={" "}
              <span className="fn">useMemo</span>({"\n"}
              {"  "}() =&gt; (<span className="prop">usage</span> &gt;{" "}
              <span className="num">80</span> ? <span className="str">&quot;red&quot;</span> :{" "}
              <span className="prop">usage</span> &gt; <span className="num">60</span> ?{" "}
              <span className="str">&quot;yellow&quot;</span> :{" "}
              <span className="str">&quot;green&quot;</span>),
              {"\n"}
              {"  "}[<span className="prop">usage</span>],
              {"\n"});
            </CodeBlock>
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
                &quot;비용이 $0.00으로 표시돼요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">inputTokens</code>와{" "}
                <code className="text-cyan-600">outputTokens</code>가 Props로 전달되지 않으면 기본값
                0이 사용되어 비용이 $0.00입니다. 또한 비용이 0이면 빈 문자열이 반환되어 아예
                표시되지 않습니다.
                <code className="text-cyan-600">useAgentLoop</code>에서 토큰 카운트가 정상적으로
                추적되고 있는지 확인하세요.
              </p>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;상태 바가 빨간색으로 변했어요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                컨텍스트 사용률이 80%를 넘었다는 의미입니다.
                <code className="text-cyan-600">/compact</code> 명령으로 대화 히스토리를 압축하세요.
                그래도 80%를 넘으면 새 세션을 시작하는 것이 좋습니다. 컨텍스트 윈도우의 마지막
                20%에서는 LLM의 응답 품질이 저하될 수 있습니다.
              </p>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;상태가 계속 &apos;thinking...&apos;에서 멈춰있어요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                <code className="text-cyan-600">agentPhase</code>가{" "}
                <code className="text-cyan-600">&quot;llm-thinking&quot;</code>
                상태에서 업데이트되지 않는 경우입니다. LLM API 응답이 지연되고 있을 수 있습니다. Esc
                키를 눌러 현재 작업을 취소하고, 네트워크 연결을 확인하세요. API rate limit에
                걸렸다면 <code className="text-cyan-600">RetryCountdown</code>이 표시되어야 합니다.
              </p>
            </div>

            {/* FAQ 4 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-amber-600 mb-3">
                &quot;상태 바가 표시되지 않아요&quot;
              </h4>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                App 컴포넌트의 <code className="text-cyan-600">showStatusBar</code> Props가
                <code className="text-cyan-600">false</code>로 설정되어 있을 수 있습니다. 기본값은{" "}
                <code className="text-cyan-600">true</code>이므로, 명시적으로 false를 전달하지
                않았다면 다른 원인을 확인하세요.
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
                  name: "App.tsx",
                  slug: "app-entry",
                  relation: "parent",
                  desc: "StatusBar를 렌더링하고 Props를 전달하는 루트 컴포넌트",
                },
                {
                  name: "model-capabilities.ts",
                  slug: "model-capabilities",
                  relation: "child",
                  desc: "모델별 가격 정보(pricing)를 제공하여 비용 계산의 SSOT 역할",
                },
                {
                  name: "token-counter.ts",
                  slug: "token-counter",
                  relation: "sibling",
                  desc: "토큰 수를 계산하여 StatusBar의 사용률 표시에 데이터를 제공",
                },
                {
                  name: "UserInput",
                  slug: "user-input",
                  relation: "sibling",
                  desc: "StatusBar 바로 위에 렌더링되는 사용자 입력 컴포넌트",
                },
                {
                  name: "context-manager.ts",
                  slug: "context-manager",
                  relation: "sibling",
                  desc: "컨텍스트 압축(/compact)으로 사용률을 낮추는 모듈",
                },
              ]}
            />
          </section>
        </RevealOnScroll>
      </div>
    </div>
  );
}

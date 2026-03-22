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

export default function CmdContextPage() {
  return (
    <div className="min-h-screen" style={{ paddingTop: "40px", paddingBottom: "80px" }}><div className="center-narrow">
      {/* ─── Header ─── */}
      <RevealOnScroll>
        <div style={{ marginBottom: "48px" }}>
          <FilePath path="src/commands/context.ts" />
          <h1 className="text-3xl font-bold tracking-tight leading-[1.15] mt-4 mb-4">
            <span className="text-gray-900">
              /context
            </span>
          </h1>
          <div className="flex items-center gap-3 mb-5">
            <LayerBadge layer="leaf" />
            <span className="text-xs font-semibold rounded-md bg-cyan-100 text-cyan-700" style={{ padding: "5px 14px" }}>
              Slash Command
            </span>
          </div>
          <p className="text-[16px] text-gray-600 leading-relaxed">
            현재 컨텍스트 윈도우의 사용 현황을 시각적 진행 막대와 수치로 보여주는 슬래시 명령어입니다.
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
              <code className="text-cyan-600">/context</code> 명령어는 현재 대화에서 얼마나 많은 토큰을
              사용하고 있는지를 한눈에 보여줍니다. LLM은 한 번에 처리할 수 있는 텍스트 양에 한계가 있는데,
              이것을 &quot;컨텍스트 윈도우&quot;라고 합니다.
            </p>
            <p>
              대화가 길어지면 컨텍스트 윈도우가 가득 차서 모델이 이전 내용을 잊거나
              에러가 발생할 수 있습니다. 이 명령어로 현재 사용량을 확인하고,
              필요하면 <code className="text-cyan-600">/compact</code>로 압축할 수 있습니다.
            </p>
            <p>
              모델명, 최대 토큰 수, 사용량 퍼센트, 압축 임계값까지의 남은 토큰,
              메시지 수 등 종합적인 정보를 제공합니다.
            </p>
          </div>

          <MermaidDiagram
            title="/context 명령어 데이터 흐름"
            titleColor="purple"
            chart={`graph TD
  USER["/context 입력"] --> CMD["contextCommand.execute()"]
  CMD --> CAPS["getModelCapabilities()<br/><small>모델별 최대 토큰 조회</small>"]
  CMD --> COUNT["countMessageTokens()<br/><small>현재 메시지 토큰 계산</small>"]
  CAPS --> RATIO["사용량 비율 계산<br/><small>used / max</small>"]
  COUNT --> RATIO
  RATIO --> BAR["진행 막대 생성<br/><small>[####------] 40칸</small>"]
  RATIO --> COMP["압축 임계값 계산<br/><small>남은 토큰 수</small>"]
  BAR --> OUTPUT["포맷된 현황 출력"]
  COMP --> OUTPUT

  style CMD fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style CAPS fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style COUNT fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style OUTPUT fill:#dcfce7,stroke:#10b981,color:#065f46`}
          />

          <Callout type="info" icon="💡">
            <strong>비유:</strong> <code>/context</code>는 스마트폰의 &quot;저장 공간&quot; 화면과 같습니다.
            전체 용량 중 얼마나 사용 중인지 막대 그래프로 보여주고,
            공간이 부족해지면 정리(= <code>/compact</code>)를 권합니다.
          </Callout>
        </section>
      </RevealOnScroll>

      {/* ─── 2. 레퍼런스 (Reference) ─── */}
      <RevealOnScroll>
        <section style={{ marginBottom: "64px" }}>
          <h2 className="text-2xl font-extrabold flex items-center gap-3" style={{ marginBottom: "24px", marginTop: "0" }}>
            <span>📖</span> 레퍼런스
          </h2>

          {/* formatTokenCount */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            formatTokenCount(count)
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            토큰 수를 천 단위 구분자와 함께 포맷합니다. (예: 12345 → &quot;12,345&quot;)
          </p>
          <CodeBlock>
            <span className="kw">function</span> <span className="fn">formatTokenCount</span>(<span className="prop">count</span>: <span className="type">number</span>): <span className="type">string</span>
          </CodeBlock>
          <ParamTable
            params={[
              { name: "count", type: "number", required: true, desc: "포맷할 토큰 수" },
            ]}
          />

          {/* contextCommand */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            contextCommand: SlashCommand
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">/context</code> 슬래시 명령어의 메인 정의 객체입니다.
          </p>
          <ParamTable
            params={[
              { name: "name", type: "\"context\"", required: true, desc: "명령어 이름" },
              { name: "description", type: "string", required: true, desc: "\"Show context window usage\"" },
              { name: "usage", type: "string", required: true, desc: "\"/context\"" },
              { name: "execute", type: "(args, context) => Promise<CommandResult>", required: true, desc: "명령어 실행 핸들러" },
            ]}
          />

          {/* 의존 모듈 */}
          <h3 className="text-lg font-bold text-indigo-600 font-mono" style={{ marginTop: "32px", marginBottom: "16px" }}>
            외부 의존 모듈
          </h3>
          <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">
            이 명령어는 세 가지 모듈에서 데이터를 가져옵니다.
          </p>
          <ParamTable
            params={[
              { name: "getModelCapabilities", type: "함수", required: true, desc: "모델명으로 최대 컨텍스트/출력 토큰, 능력 티어 등 조회" },
              { name: "countMessageTokens", type: "함수", required: true, desc: "메시지 배열의 총 토큰 수를 계산" },
              { name: "AGENT_LOOP.compactionThreshold", type: "number", required: true, desc: "자동 압축이 트리거되는 사용량 비율 (예: 0.8 = 80%)" },
            ]}
          />

          {/* Caveats */}
          <h4 className="text-sm font-bold text-gray-900 mb-3 mt-8">주의사항 (Caveats)</h4>
          <ul className="text-[13px] text-gray-600 space-y-2 list-disc list-inside">
            <li>
              토큰 수는 <code className="text-cyan-600">countMessageTokens()</code>의 <strong>추정값</strong>입니다.
              실제 API 호출 시 사용되는 토큰 수와 약간의 차이가 있을 수 있습니다.
            </li>
            <li>
              메시지가 없는 경우(첫 입력 전) 토큰 사용량은 0으로 표시됩니다.
            </li>
            <li>
              진행 막대의 너비는 40칸으로 고정되어 있어, 터미널 너비에 관계없이 일정합니다.
            </li>
            <li>
              <code className="text-cyan-600">compactionThreshold</code>는 <code className="text-cyan-600">constants.ts</code>에서
              가져오며, 실행 중 변경할 수 없습니다.
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
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>기본 사용법 &mdash; 컨텍스트 현황 확인</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">/context</code>를 입력하면 현재 대화의 컨텍스트 사용 현황이 표시됩니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// 입력"}</span>
            {"\n"}<span className="str">/context</span>
            {"\n"}
            {"\n"}<span className="cm">{"// 출력 예시"}</span>
            {"\n"}<span className="prop">Context Window</span>
            {"\n"}<span className="prop">==============</span>
            {"\n"}
            {"\n"}{"  "}<span className="prop">Model: claude-sonnet-4-20250514 (high tier)</span>
            {"\n"}{"  "}<span className="prop">Max context: 200K tokens</span>
            {"\n"}{"  "}<span className="prop">Max output: 16K tokens</span>
            {"\n"}
            {"\n"}{"  "}<span className="prop">Usage: [########--------------------------------] 20%</span>
            {"\n"}{"         "}<span className="str">40,000 / 200,000 tokens</span>
            {"\n"}
            {"\n"}{"  "}<span className="prop">Compaction threshold: 80.0%</span>
            {"\n"}{"  "}<span className="prop">Tokens until compaction: ~120,000</span>
            {"\n"}
            {"\n"}{"  "}<span className="prop">Messages: 24 total (12 user, 12 assistant)</span>
            {"\n"}
            {"\n"}{"  "}<span className="cm">Tip: Use /compact to reduce context usage when approaching limits.</span>
          </CodeBlock>

          <Callout type="warn" icon="!">
            <strong>주의:</strong> 사용량이 압축 임계값(기본 80%)에 근접하면 자동 압축이 트리거됩니다.
            그 전에 <code>/compact</code>를 수동으로 실행하면 더 제어된 압축이 가능합니다.
          </Callout>

          {/* 표시 정보 해설 */}
          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>
            고급 &mdash; 출력 항목별 해설
          </h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            출력에 포함되는 각 항목의 의미를 설명합니다.
          </p>
          <ParamTable
            params={[
              { name: "Model", type: "텍스트", required: true, desc: "현재 사용 중인 LLM 모델명과 능력 티어 (high/medium/low)" },
              { name: "Max context", type: "텍스트", required: true, desc: "모델이 한 번에 처리 가능한 최대 토큰 수 (K 단위)" },
              { name: "Max output", type: "텍스트", required: true, desc: "모델이 한 번에 생성 가능한 최대 출력 토큰 수" },
              { name: "Usage", type: "진행 막대", required: true, desc: "40칸 진행 막대와 퍼센트로 시각화된 사용량" },
              { name: "Compaction threshold", type: "퍼센트", required: true, desc: "자동 압축이 트리거되는 사용량 비율" },
              { name: "Tokens until compaction", type: "숫자", required: true, desc: "압축 임계값까지 남은 토큰 수 (근사값)" },
              { name: "Messages", type: "숫자", required: true, desc: "전체 메시지 수와 user/assistant 분류" },
            ]}
          />

          <DeepDive title="진행 막대 계산 로직">
            <p className="mb-3">
              진행 막대는 40칸 고정 너비로, 사용 비율에 따라 <code className="text-cyan-600">#</code>과
              <code className="text-cyan-600">-</code>의 수를 결정합니다:
            </p>
            <CodeBlock>
              <span className="kw">const</span> <span className="prop">barWidth</span> = <span className="num">40</span>;
              {"\n"}<span className="kw">const</span> <span className="prop">filledCount</span> = <span className="fn">Math.round</span>(<span className="prop">usedRatio</span> * <span className="prop">barWidth</span>);
              {"\n"}<span className="kw">const</span> <span className="prop">emptyCount</span> = <span className="prop">barWidth</span> - <span className="prop">filledCount</span>;
              {"\n"}<span className="kw">const</span> <span className="prop">bar</span> = <span className="str">&quot;[&quot;</span> + <span className="str">&quot;#&quot;</span>.<span className="fn">repeat</span>(<span className="prop">filledCount</span>) + <span className="str">&quot;-&quot;</span>.<span className="fn">repeat</span>(<span className="prop">emptyCount</span>) + <span className="str">&quot;]&quot;</span>;
            </CodeBlock>
            <p className="mt-3 text-gray-600">
              예를 들어 사용량이 25%이면 <code className="text-cyan-600">[##########------------------------------]</code>처럼
              10칸이 채워지고 30칸이 비어 있습니다. <code className="text-cyan-600">Math.round</code>로 반올림하므로
              항상 정확히 40칸이 됩니다.
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

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>데이터 수집 및 계산 흐름</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            <code className="text-cyan-600">/context</code>는 여러 모듈에서 정보를 수집하여
            하나의 통합 뷰로 조립합니다.
          </p>

          <MermaidDiagram
            title="/context 내부 데이터 조립"
            titleColor="purple"
            chart={`graph LR
  MODEL["context.model"] --> CAPS["getModelCapabilities()"]
  CAPS --> MAX["maxContextTokens<br/>maxOutputTokens<br/>capabilityTier"]
  MSGS["context.messages"] --> TOKEN["countMessageTokens()"]
  TOKEN --> USED["estimatedTokens"]
  CONST["AGENT_LOOP"] --> THRESH["compactionThreshold"]
  MAX --> CALC["비율·통계 계산"]
  USED --> CALC
  THRESH --> CALC
  CALC --> OUTPUT["포맷된 출력"]

  style CALC fill:#ede9fe,stroke:#8b5cf6,color:#1e293b,stroke-width:3px
  style CAPS fill:#e0e7ff,stroke:#3b82f6,color:#1e293b
  style TOKEN fill:#e0e7ff,stroke:#3b82f6,color:#1e293b`}
          />

          <h3 className="text-lg font-bold" style={{ marginTop: "32px", marginBottom: "16px" }}>핵심 코드 분석</h3>
          <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
            사용량 비율 계산과 압축 임계값까지의 남은 토큰 계산 로직입니다.
          </p>
          <CodeBlock>
            <span className="cm">{"// [1] 사용량 비율: 0~1 사이로 클램프"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">usedRatio</span> = <span className="prop">maxTokens</span> &gt; <span className="num">0</span>
            {"\n"}{"  "}? <span className="fn">Math.min</span>(<span className="prop">estimatedTokens</span> / <span className="prop">maxTokens</span>, <span className="num">1</span>)
            {"\n"}{"  "}: <span className="num">0</span>;
            {"\n"}
            {"\n"}<span className="cm">{"// [2] 압축 임계값(토큰 수)과 남은 토큰 계산"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">compactionTokens</span> = <span className="fn">Math.round</span>(<span className="prop">maxTokens</span> * <span className="prop">compactionThreshold</span>);
            {"\n"}<span className="kw">const</span> <span className="prop">tokensUntilCompaction</span> = <span className="fn">Math.max</span>(<span className="num">0</span>, <span className="prop">compactionTokens</span> - <span className="prop">estimatedTokens</span>);
            {"\n"}
            {"\n"}<span className="cm">{"// [3] 메시지 분류"}</span>
            {"\n"}<span className="kw">const</span> <span className="prop">userMessages</span> = <span className="prop">messages</span>.<span className="fn">filter</span>(<span className="prop">m</span> =&gt; <span className="prop">m</span>.<span className="prop">role</span> === <span className="str">&quot;user&quot;</span>).<span className="prop">length</span>;
            {"\n"}<span className="kw">const</span> <span className="prop">assistantMessages</span> = <span className="prop">messages</span>.<span className="fn">filter</span>(<span className="prop">m</span> =&gt; <span className="prop">m</span>.<span className="prop">role</span> === <span className="str">&quot;assistant&quot;</span>).<span className="prop">length</span>;
          </CodeBlock>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 text-[13px] text-gray-600 space-y-2.5">
            <p><strong className="text-gray-900">[1]</strong> <code className="text-cyan-600">Math.min(..., 1)</code>로 100%를 초과하지 않도록 클램프합니다. <code className="text-cyan-600">maxTokens</code>가 0인 경우(알 수 없는 모델) 비율을 0으로 처리합니다.</p>
            <p><strong className="text-gray-900">[2]</strong> 압축 임계값(예: 80%)을 절대 토큰 수로 변환하고, 현재 사용량과의 차이를 계산합니다. 이미 초과한 경우 <code className="text-cyan-600">Math.max(0, ...)</code>로 음수를 방지합니다.</p>
            <p><strong className="text-gray-900">[3]</strong> 전체 메시지를 role별로 분류하여 대화의 균형(user vs assistant)을 보여줍니다.</p>
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
              &quot;사용량이 0%로 표시되는데 이미 대화를 많이 했어요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">context.messages</code>가 비어 있는 경우에 발생합니다.
              명령어 실행 시점에 메시지 목록이 올바르게 전달되고 있는지 확인하세요.
              대화 시작 직후에는 메시지가 아직 기록되지 않아 0%로 표시될 수 있습니다.
            </p>
          </div>

          {/* FAQ 2 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;실제 API 응답과 토큰 수가 다른 것 같아요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">countMessageTokens()</code>는 tiktoken 기반 <strong>추정값</strong>을
              사용합니다. 실제 API는 시스템 프롬프트, 도구 정의 등 추가 토큰을 포함하므로
              표시된 값보다 다소 높을 수 있습니다. 약 10~15%의 여유를 두고 판단하세요.
            </p>
          </div>

          {/* FAQ 3 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;Tokens until compaction이 0인데 압축이 안 돼요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">/context</code>는 현황을 보여줄 뿐, 자동 압축을 트리거하지 않습니다.
              자동 압축은 에이전트 루프의 다음 반복에서 <code className="text-cyan-600">ContextManager</code>가
              판단합니다. 즉시 압축하려면 <code className="text-cyan-600">/compact</code>를 실행하세요.
            </p>
          </div>

          {/* FAQ 4 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-amber-600 mb-3">
              &quot;모델을 변경했는데 Max context가 이전 모델 값이에요&quot;
            </h4>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <code className="text-cyan-600">/context</code>는 실행 시점의 <code className="text-cyan-600">context.model</code>을
              기준으로 조회합니다. <code className="text-cyan-600">/model</code>로 모델을 변경한 뒤
              다시 <code className="text-cyan-600">/context</code>를 실행하면 새 모델의 정보가 표시됩니다.
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
                name: "llm/model-capabilities.ts",
                slug: "model-capabilities",
                relation: "sibling",
                desc: "모델별 능력 레지스트리 — maxContextTokens, maxOutputTokens, capabilityTier 등 제공",
              },
              {
                name: "llm/token-counter.ts",
                slug: "token-counter",
                relation: "sibling",
                desc: "토큰 계산 모듈 — tiktoken 기반 정확 계산 + 빠른 추정, LRU 캐시",
              },
              {
                name: "context-manager.ts",
                slug: "context-manager",
                relation: "parent",
                desc: "3-Layer 토큰 관리 — 자동 압축 임계값 기반 Microcompaction/Auto-compaction 실행",
              },
            ]}
          />
        </section>
      </RevealOnScroll>
    </div></div>
  );
}
